-- Fase 5 — Testes do apoio à baixa por recibo.
-- Sem saída = passou.

begin;

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALHOU: %', msg; end if;
end;
$$;

create or replace function pg_temp.deve_falhar(p_sql text, p_msg text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FALHOU: % (o banco aceitou algo que deveria recusar)', p_msg;
end;
$$;

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
      'tenant_id', p_tenant, 'perimetro', p_perimetro, 'papel', p_papel,
      'empresa_id', p_empresa, 'departamentos', p_departamentos
    )
  )::text, true);
end;
$$;

-- Item de revisão com o CNPJ da Padaria Vila Nova, que existe na base.
insert into recibo_revisao (id, tenant_id, hash_arquivo, storage_path, motivo,
                            cnpj_lido, codigo_obrigacao_lido, competencia_lida)
values ('4e000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        repeat('b', 64), '11111111/e0000001/bbb.pdf', 'entrega_nao_parametrizada',
        '12.345.678/0001-95', 'DCTFWEB', '07/2026');

-- Guarda o alvo antes de trocar de sessão, para o teste de tenant cruzado ser
-- um ataque de verdade e não um insert de zero linhas.
create temp table alvos as
select
  (select id from entrega
    where empresa_id = 'e0000001-0000-0000-0000-000000000001'
      and competencia = '2026-07-01' and status <> 'ENTREGUE' limit 1) as entrega_mg,
  (select id from entrega
    where tenant_id = '22222222-2222-2222-2222-222222222222' limit 1) as entrega_vizinha;

-- Sem este GRANT a sessão `authenticated` recebe "permission denied" ao ler a
-- temp table — e `deve_falhar` contaria isso como se a policy tivesse
-- recusado. O teste passaria sem nunca ter tentado o ataque.
grant select on alvos to authenticated;

set local role authenticated;

select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'COLABORADOR', 'ADMIN',
  null, 'aaaa0000-0000-0000-0000-0000000000a0', '["FISCAL","CONTABIL","PESSOAL"]'::jsonb
);

-- ------------------------------------------------ 1. de-para é por tenant

select pg_temp.assert(count(*) = 2, 'o de-para do seed deveria ter 2 termos da DCTFWeb, tem ' || count(*))
from recibo_termo;

select pg_temp.assert(
  not exists (select 1 from recibo_termo where tenant_id <> '11111111-1111-1111-1111-111111111111'),
  'de-para não pode atravessar tenant'
);

-- Termo tem de estar em minúsculas: o parser compara com o texto rebaixado.
select pg_temp.deve_falhar($$
  insert into recibo_termo (tenant_id, obrigacao_id, termo)
  values ('11111111-1111-1111-1111-111111111111',
          '0b000003-0000-0000-0000-000000000003', 'DCTFWeb MAIUSCULO')
$$, 'termo com maiúsculas');

-- ------------------------------------------ 2. candidatas vêm pelo CNPJ lido

select pg_temp.assert(
  count(*) > 0,
  'deveria haver entregas candidatas para o CNPJ lido'
) from candidatas_para_revisao('4e000001-0000-0000-0000-000000000001');

select pg_temp.assert(
  not exists (
    select 1 from candidatas_para_revisao('4e000001-0000-0000-0000-000000000001')
    where status = 'ENTREGUE'
  ),
  'entrega já baixada não pode ser sugerida'
);

-- Só entregas da empresa daquele CNPJ, não do escritório inteiro.
select pg_temp.assert(
  not exists (
    select 1 from candidatas_para_revisao('4e000001-0000-0000-0000-000000000001') c
    join entrega e on e.id = c.entrega_id
    where e.empresa_id <> 'e0000001-0000-0000-0000-000000000001'
  ),
  'candidatas não podem incluir entregas de outra empresa'
);

-- ------------------------------------------------ 3. resolver_revisao

-- Entrega de outro tenant: não existe para esta sessão.
select pg_temp.deve_falhar(
  format($$ select resolver_revisao('4e000001-0000-0000-0000-000000000001', %L) $$,
         (select entrega_vizinha from alvos)),
  'resolver revisão apontando entrega de outro tenant');

select resolver_revisao(
  '4e000001-0000-0000-0000-000000000001',
  (select entrega_mg from alvos)
);

select pg_temp.assert(
  status = 'ENTREGUE' and origem_baixa = 'AUTOMATICA_RECIBO'
    and anexo_path = '11111111/e0000001/bbb.pdf' and recibo_hash = repeat('b', 64),
  'a entrega deveria ficar baixada, com anexo e hash do recibo'
) from entrega where id = (select entrega_mg from alvos);

select pg_temp.assert(
  status = 'RESOLVIDO' and resolvido_em is not null,
  'o item de revisão deveria ficar RESOLVIDO'
) from recibo_revisao where id = '4e000001-0000-0000-0000-000000000001';

-- Idempotência do watcher: o mesmo recibo não volta a ser processado.
select pg_temp.assert(
  count(*) = 1, 'o hash resolvido deveria constar em recibo_processado'
) from recibo_processado where hash_arquivo = repeat('b', 64);

-- Resolver duas vezes não faz nada de novo.
select pg_temp.deve_falhar($$
  select resolver_revisao('4e000001-0000-0000-0000-000000000001',
                          (select entrega_mg from alvos))
$$, 'resolver um item já resolvido');

-- ------------------------------ 4. um recibo não baixa duas entregas

select pg_temp.deve_falhar(
  format($$
    update entrega set recibo_hash = %L
     where id <> %L and tenant_id = '11111111-1111-1111-1111-111111111111'
       and status <> 'ENTREGUE'
  $$, repeat('b', 64), (select entrega_mg from alvos)),
  'o mesmo hash de recibo em duas entregas');

-- Hash tem de ser SHA-256 hexadecimal.
select pg_temp.deve_falhar(
  format($$ update entrega set recibo_hash = 'nao-e-hash' where id = %L $$,
         (select entrega_mg from alvos)),
  'recibo_hash fora do formato');

rollback;
