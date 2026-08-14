-- Correção — a trilha de auditoria bloqueava a própria mudança de status.
--
-- `entrega_evento` tem RLS com policy apenas de SELECT (de propósito: trilha
-- de auditoria não deve ser gravável por usuário). Mas o gatilho que a
-- alimenta rodava com as permissões de quem disparou o UPDATE, então o insert
-- do evento caía na ausência de policy de INSERT e a transação inteira
-- falhava com "new row violates row-level security policy".
--
-- Efeito prático: qualquer mudança de status de entrega feita por sessão
-- autenticada falhava — registrar entrega pela tela, resolver revisão,
-- documento do cliente movendo a entrega para EM_ANDAMENTO. Só passava por
-- service_role/superuser, que bypassa RLS — e era por isso que o job mensal
-- (que roda assim) nunca esbarrou no problema.
--
-- Correção: o gatilho passa a ser SECURITY DEFINER. Quem escreve a trilha é o
-- sistema, com a identidade do dono do schema; o usuário continua sem policy
-- de INSERT, ou seja, segue impedido de forjar evento à mão.

create or replace function app.registra_evento_entrega()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.entrega_evento (tenant_id, entrega_id, status_de, status_para, origem, usuario_id)
  values (
    new.tenant_id,
    new.id,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    new.origem_baixa,
    coalesce(new.baixado_por, new.responsavel_id)
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mesma classe de problema em `recibo_processado`.
--
-- A tabela é controle de idempotência do worker: tem policy de SELECT para o
-- colaborador e nenhuma de INSERT, porque quem escreve nela é o worker (com
-- service_role). Mas `resolver_revisao` também precisa registrar o hash — se
-- não registrar, o mesmo recibo voltaria a ser processado na próxima varredura
-- da pasta e reabriria a revisão que o humano acabou de resolver.
--
-- A saída NÃO é tornar `resolver_revisao` SECURITY DEFINER: ela depende do RLS
-- para verificar que a entrega alvo é do tenant da sessão, e como DEFINER
-- passaria a enxergar todos os tenants. Só o registro de idempotência sai
-- para uma função própria, com escopo mínimo.
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER que recebe tenant_id por parâmetro seria um buraco: daria
-- para gravar em nome de qualquer escritório. Por isso ela confere o tenant
-- contra a sessão e só aceita colaborador.
create or replace function app.registrar_recibo_processado(
  p_tenant_id uuid, p_hash text, p_resultado text, p_entrega_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_colaborador() or p_tenant_id is distinct from app.current_tenant_id() then
    raise exception 'não autorizado a registrar recibo neste tenant'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.recibo_processado (tenant_id, hash_arquivo, resultado, entrega_id)
  values (p_tenant_id, p_hash, p_resultado, p_entrega_id)
  on conflict (tenant_id, hash_arquivo) do update
     set resultado = excluded.resultado, entrega_id = excluded.entrega_id;
end;
$$;

revoke execute on function app.registrar_recibo_processado(uuid, text, text, uuid)
  from public, anon;
grant execute on function app.registrar_recibo_processado(uuid, text, text, uuid)
  to authenticated;

-- Reemite `resolver_revisao` usando a função acima. O resto do corpo é
-- idêntico ao da migration 0015.
create or replace function resolver_revisao(p_item_id uuid, p_entrega_id uuid)
returns void
language plpgsql
as $$
declare
  v_item    recibo_revisao;
  v_entrega entrega;
  v_usuario uuid;
begin
  select * into v_item from recibo_revisao where id = p_item_id and status = 'ABERTO';
  if not found then
    raise exception 'Item de revisão não encontrado ou já resolvido'
      using errcode = 'no_data_found';
  end if;

  -- Sob RLS: entrega de outro tenant simplesmente não existe para esta sessão.
  select * into v_entrega from entrega where id = p_entrega_id;
  if not found then
    raise exception 'Entrega não encontrada' using errcode = 'no_data_found';
  end if;

  if v_entrega.status = 'ENTREGUE' then
    raise exception 'Esta entrega já está baixada' using errcode = 'unique_violation';
  end if;

  select u.id into v_usuario from usuario u where u.auth_user_id = auth.uid();

  update entrega
     set status       = 'ENTREGUE',
         entregue_em  = now(),
         origem_baixa = 'AUTOMATICA_RECIBO',
         baixado_por  = v_usuario,
         anexo_path   = v_item.storage_path,
         recibo_hash  = v_item.hash_arquivo
   where id = p_entrega_id;

  update recibo_revisao
     set status        = 'RESOLVIDO',
         resolvido_por = v_usuario,
         resolvido_em  = now()
   where id = p_item_id;

  perform app.registrar_recibo_processado(
    v_item.tenant_id, v_item.hash_arquivo, 'resolvido_manual', p_entrega_id
  );
end;
$$;

revoke execute on function resolver_revisao(uuid, uuid) from anon;
