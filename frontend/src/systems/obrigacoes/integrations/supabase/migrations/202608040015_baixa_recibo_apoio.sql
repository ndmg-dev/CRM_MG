-- Fase 5 — Apoio à baixa automática por recibo.
--
-- Três coisas que faltavam para o worker sair do esboço:
--   1. o de-para do parser vira DADO, não constante no código Python;
--   2. a entrega guarda a prova de como foi baixada (hash e protocolo);
--   3. resolver uma revisão vira uma operação atômica, não três chamadas.

-- ---------------------------------------------------------------------------
-- 1. De-para: termo do recibo -> obrigação
-- ---------------------------------------------------------------------------

-- Estava como dicionário no `baixa_recibo.py`. Como dado, dá para começar por
-- UM tipo de recibo (o de maior volume), validar e só então ligar os outros —
-- que é o que o plano manda — sem redeploy do worker a cada ajuste.
create table recibo_termo (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id) on delete restrict,
  obrigacao_id uuid not null references obrigacao(id) on delete restrict,
  -- Texto que aparece no recibo, em minúsculas. O parser compara por conteúdo.
  termo        text not null,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  constraint recibo_termo_unico unique (tenant_id, termo),
  constraint recibo_termo_minusculo check (termo = lower(btrim(termo))),
  constraint recibo_termo_tamanho check (length(termo) between 2 and 200)
);

create index on recibo_termo (tenant_id) where ativo;

comment on table recibo_termo is
  'De-para do parser de recibo. Casar por palpite é o que gera baixa errada: '
  'o que não estiver aqui vai para revisão manual.';

alter table recibo_termo enable row level security;

create policy recibo_termo_select on recibo_termo
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_colaborador());

create policy recibo_termo_admin on recibo_termo
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN')
  with check (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 2. Prova da baixa na entrega
-- ---------------------------------------------------------------------------

alter table entrega
  add column recibo_hash text,
  add column protocolo   text;

-- Um mesmo recibo não pode baixar duas entregas diferentes.
create unique index entrega_recibo_hash_unico
  on entrega (tenant_id, recibo_hash) where recibo_hash is not null;

alter table entrega
  add constraint entrega_protocolo_tamanho
    check (protocolo is null or length(protocolo) between 1 and 100),
  add constraint entrega_recibo_hash_formato
    check (recibo_hash is null or recibo_hash ~ '^[0-9a-f]{64}$');

-- ---------------------------------------------------------------------------
-- 3. Resolver revisão — atômico
-- ---------------------------------------------------------------------------

-- A tela de Revisão precisava de três passos (baixar a entrega, anexar o
-- documento, fechar o item). Em três chamadas, uma falha no meio deixa item
-- fechado sem baixa, ou baixa sem item fechado. Aqui é tudo ou nada.
--
-- SECURITY INVOKER: roda sob o RLS de quem chamou. Um DEFINER aqui deixaria
-- qualquer sessão resolver revisão de qualquer tenant.
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

  -- A entrega é buscada sob RLS: se for de outro tenant, simplesmente não
  -- existe para esta sessão.
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

  insert into recibo_processado (tenant_id, hash_arquivo, resultado, entrega_id)
  values (v_item.tenant_id, v_item.hash_arquivo, 'resolvido_manual', p_entrega_id)
  on conflict (tenant_id, hash_arquivo) do update
     set resultado = 'resolvido_manual', entrega_id = excluded.entrega_id;
end;
$$;

revoke execute on function resolver_revisao(uuid, uuid) from anon;

-- Candidatas para a tela de Revisão: entregas da empresa cujo CNPJ o parser
-- leu, ainda em aberto. Poupa o humano de procurar a entrega na mão.
create or replace function candidatas_para_revisao(p_item_id uuid)
returns table (
  entrega_id  uuid,
  empresa     text,
  obrigacao   text,
  competencia date,
  vencimento  date,
  status      status_entrega
)
language sql
stable
as $$
  select e.id, coalesce(em.nome_fantasia, em.razao_social), o.nome,
         e.competencia, e.vencimento, e.status
  from recibo_revisao r
  join empresa em
    on em.tenant_id = r.tenant_id
   and em.cnpj = regexp_replace(coalesce(r.cnpj_lido, ''), '\D', '', 'g')
  join entrega e on e.empresa_id = em.id
  join obrigacao o on o.id = e.obrigacao_id
  where r.id = p_item_id
    and e.status <> 'ENTREGUE'
  order by e.competencia desc, o.nome;
$$;

revoke execute on function candidatas_para_revisao(uuid) from anon;

-- O conteúdo do de-para é DADO por tenant: vive no seed / no provisionamento,
-- não aqui. Migration que popula linha de negócio roda antes de a obrigação
-- existir e não grava nada (já aconteceu com `tenant.dominios_email`).
