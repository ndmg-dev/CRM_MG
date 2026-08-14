-- Teste de RLS exigido pelo plano: dado de dois tenants na MESMA tabela, e
-- verificação de que nenhuma sessão de portal enxerga além da própria empresa.
--
-- Rodar depois do seed:  psql "$DATABASE_URL" -f supabase/tests/rls_dois_tenants.sql
-- Qualquer falha aborta com exceção. Sem saída = passou.

begin;

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then
    raise exception 'FALHOU: %', msg;
  end if;
end;
$$;

-- Simula uma sessão autenticada montando os claims como o GoTrue os entrega.
create or replace function pg_temp.sessao(
  p_tenant uuid, p_perimetro text, p_papel text,
  p_empresa uuid default null, p_sub uuid default null,
  p_departamentos jsonb default '[]'::jsonb
) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', coalesce(p_sub, gen_random_uuid()),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object(
      'tenant_id', p_tenant,
      'perimetro', p_perimetro,
      'papel', p_papel,
      'empresa_id', p_empresa,
      'departamentos', p_departamentos
    )
  )::text, true);
end;
$$;

set local role authenticated;

-- ---------------------------------------------- 1. isolamento entre tenants

select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'COLABORADOR', 'ADMIN',
  null, 'aaaa0000-0000-0000-0000-0000000000a0', '["FISCAL","CONTABIL","PESSOAL"]'::jsonb
);

select pg_temp.assert(count(*) = 4, 'colaborador MG deveria ver exatamente as 4 empresas do próprio tenant, viu ' || count(*))
from empresa;

select pg_temp.assert(count(*) = 0, 'colaborador MG NÃO pode ver empresa do tenant vizinho')
from empresa where tenant_id = '22222222-2222-2222-2222-222222222222';

select pg_temp.assert(count(*) = 7, 'catálogo deveria ficar restrito ao tenant MG, viu ' || count(*))
from obrigacao;

select pg_temp.assert(count(*) = 13, 'parametrização deveria ficar restrita ao tenant MG, viu ' || count(*))
from empresa_obrigacao;

select pg_temp.assert(count(*) = 13, 'entregas deveriam ficar restritas ao tenant MG, viu ' || count(*))
from entrega;

-- Escrita cruzada é barrada mesmo com o id do vizinho em mãos.
do $$
begin
  update empresa set razao_social = 'INVADIDA'
  where id = 'e0000009-0000-0000-0000-000000000009';
  if found then
    raise exception 'FALHOU: colaborador MG conseguiu alterar empresa de outro tenant';
  end if;
end;
$$;

-- ------------------------------------------- 2. perímetro do portal (cliente)

select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'CLIENTE', 'LEITURA',
  'e0000001-0000-0000-0000-000000000001', 'cccc0001-0000-0000-0000-0000000000c1'
);

select pg_temp.assert(count(*) = 1, 'cliente deveria enxergar somente a própria empresa, viu ' || count(*))
from empresa;

select pg_temp.assert(
  (select id from empresa) = 'e0000001-0000-0000-0000-000000000001',
  'a empresa visível ao cliente tem de ser a do claim empresa_id'
);

select pg_temp.assert(count(*) = 3, 'cliente deveria ver só as próprias parametrizações, viu ' || count(*))
from empresa_obrigacao;

select pg_temp.assert(count(*) = 3, 'cliente deveria ver só as próprias entregas, viu ' || count(*))
from entrega;

select pg_temp.assert(
  not exists (select 1 from entrega where empresa_id <> 'e0000001-0000-0000-0000-000000000001'),
  'nenhuma entrega de outra empresa pode vazar para o portal'
);

select pg_temp.assert(count(*) = 0, 'cliente NÃO pode ler a lista de colaboradores')
from usuario;

select pg_temp.assert(count(*) = 0, 'cliente NÃO pode ler a trilha de auditoria de entregas')
from entrega_evento;

-- A fila de revisão carrega CNPJ de terceiros: é do escritório, não do portal.
select pg_temp.assert(count(*) = 0, 'cliente NÃO pode ler a fila de revisão de recibos')
from recibo_revisao;

select pg_temp.assert(count(*) = 0, 'cliente NÃO pode ler as pastas monitoradas')
from pasta_monitorada;

-- --------------------------------------- 3. RBAC por departamento na escrita

-- Operador só do Fiscal não pode mexer no catálogo de Pessoal.
-- Ana é OPERADOR só do Fiscal.
select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'COLABORADOR', 'OPERADOR',
  null, 'aaaa0001-0000-0000-0000-0000000000a1', '["FISCAL"]'::jsonb
);

do $$
begin
  update obrigacao set nome = 'alterado'
  where id = '0b000006-0000-0000-0000-000000000006';  -- eSocial — Folha, dep. PESSOAL
  if found then
    raise exception 'FALHOU: operador Fiscal alterou obrigação do departamento Pessoal';
  end if;
end;
$$;

-- Assert positivo: prova que os UPDATEs realmente chegam ao banco, e que os
-- testes negativos acima não passam por estarem todos bloqueados.
do $$
begin
  update obrigacao set nome = 'DAS — Simples Nacional'
  where id = '0b000001-0000-0000-0000-000000000001';  -- DAS, dep. FISCAL
  if not found then
    raise exception 'FALHOU: operador Fiscal deveria conseguir alterar obrigação do próprio departamento';
  end if;
end;
$$;

-- O mesmo RBAC vale para dar baixa em entrega de outro departamento.
do $$
begin
  update entrega set status = 'ENTREGUE'
  where obrigacao_id = '0b000006-0000-0000-0000-000000000006';  -- PESSOAL
  if found then
    raise exception 'FALHOU: operador Fiscal deu baixa em entrega do departamento Pessoal';
  end if;
end;
$$;

-- E dar baixa no PRÓPRIO departamento precisa FUNCIONAR.
--
-- Este assert existe porque a trilha de auditoria (gatilho que escreve em
-- entrega_evento) bloqueou toda mudança de status vinda de sessão autenticada:
-- a tabela tem RLS sem policy de INSERT, e o gatilho rodava com as permissões
-- do usuário. Passava despercebido porque o job mensal roda como service_role,
-- que bypassa RLS. Ver migration 202608040016.
do $$
declare
  v_id uuid;
begin
  select e.id into v_id
  from entrega e
  join obrigacao o on o.id = e.obrigacao_id
  where o.departamento = 'FISCAL' and e.status <> 'ENTREGUE'
  limit 1;

  update entrega
     set status = 'ENTREGUE', entregue_em = now(), origem_baixa = 'MANUAL'
   where id = v_id;

  if not found then
    raise exception 'FALHOU: operador Fiscal deveria conseguir baixar entrega do seu departamento';
  end if;

  if not exists (
    select 1 from entrega_evento where entrega_id = v_id and status_para = 'ENTREGUE'
  ) then
    raise exception 'FALHOU: a trilha de auditoria não registrou a baixa';
  end if;
end;
$$;

-- ------------------------------ 4. parametrização se encerra, não se deleta

-- Duas defesas: sem policy de DELETE o RLS filtra tudo (0 linhas), e se algum
-- caminho privilegiado escapar, o gatilho levanta restrict_violation.
do $$
declare
  removidas int;
begin
  begin
    delete from empresa_obrigacao;
    get diagnostics removidas = row_count;
    if removidas > 0 then
      raise exception 'FALHOU: % linha(s) de parametrização foram deletadas', removidas;
    end if;
  exception
    when insufficient_privilege or restrict_violation then null;
  end;
end;
$$;

-- ----------------------------------------- 5. sessão sem tenant não vê nada

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);

select pg_temp.assert(count(*) = 0, 'sessão sem claim de tenant não pode ler empresa')  from empresa;
select pg_temp.assert(count(*) = 0, 'sessão sem claim de tenant não pode ler obrigacao') from obrigacao;
select pg_temp.assert(count(*) = 0, 'sessão sem claim de tenant não pode ler entrega')   from entrega;

rollback;
