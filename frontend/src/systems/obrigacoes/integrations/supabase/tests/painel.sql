-- Fase 4 — Testes dos agregados do Painel/Agenda.
--
-- O que importa aqui não é só a conta bater: é que as funções continuem
-- respeitando o RLS quando chamadas por uma sessão de cliente. Uma função
-- SECURITY DEFINER mal colocada aqui vazaria o tenant inteiro para o portal.
-- Sem saída = passou.

begin;

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALHOU: %', msg; end if;
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

-- O seed traz 13 entregas no total, mas só 11 são da competência 07/2026:
-- as duas de EFD Contribuições são de 06/2026 (a regra vence no segundo mês
-- seguinte). Dessas 11: 3 ENTREGUE, 1 ATRASADA, 7 PENDENTE.
set local role authenticated;

-- ------------------------------------------------ 1. visão do colaborador

select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'COLABORADOR', 'ADMIN',
  null, 'aaaa0000-0000-0000-0000-0000000000a0', '["FISCAL","CONTABIL","PESSOAL"]'::jsonb
);

select pg_temp.assert(total = 11,    'painel_resumo deveria contar as 11 entregas de 07/2026, contou ' || total)
from painel_resumo('2026-07-01');

select pg_temp.assert(entregues = 3, 'painel_resumo deveria contar 3 entregues, contou ' || entregues)
from painel_resumo('2026-07-01');

select pg_temp.assert(atrasadas = 1, 'painel_resumo deveria contar 1 atrasada, contou ' || atrasadas)
from painel_resumo('2026-07-01');

-- A competência anterior existe e tem as duas de EFD Contribuições: prova que
-- o filtro por competência é real, e não que tudo cai num balde só.
select pg_temp.assert(total = 2, 'competência 06/2026 deveria ter as 2 de EFD Contribuições, tem ' || total)
from painel_resumo('2026-06-01');

-- Competência sem entrega nenhuma devolve zeros, não linha vazia.
select pg_temp.assert(total = 0, 'competência vazia deveria devolver zero, não nada')
from painel_resumo('2020-01-01');

-- A carga soma exatamente o total: ninguém pode sumir do agrupamento.
select pg_temp.assert(
  (select coalesce(sum(total), 0) from painel_carga_responsavel('2026-07-01')) = 11,
  'a soma da carga por responsável tem de fechar com o total'
);

select pg_temp.assert(
  (select count(*) from painel_proximos_vencimentos(10)) <= 10,
  'painel_proximos_vencimentos deve respeitar o limite'
);

-- Entrega já entregue não é "próximo vencimento".
select pg_temp.assert(
  not exists (select 1 from painel_proximos_vencimentos(100) where status = 'ENTREGUE'),
  'entrega ENTREGUE não pode aparecer em próximos vencimentos'
);

-- Limite absurdo é limitado, não repassado cru ao banco.
select pg_temp.assert(
  (select count(*) from painel_proximos_vencimentos(999999)) <= 100,
  'limite deve ser travado em 100'
);

select pg_temp.assert(
  (select count(*) from empresas_com_situacao('2026-07-01')) = 4,
  'empresas_com_situacao deveria listar as 4 empresas do tenant'
);

-- Empresa sem entrega na competência ainda aparece, com zero (LEFT JOIN).
select pg_temp.assert(
  (select count(*) from empresas_com_situacao('2020-01-01')) = 4,
  'empresa sem entrega na competência não pode sumir da lista'
);

select pg_temp.assert(
  (select coalesce(sum(total), 0) from agenda_mes(2026, 8)) > 0,
  'agenda_mes deveria encontrar vencimentos em agosto/2026'
);

-- ---------------------------------------- 2. as mesmas funções pelo portal

-- Padaria Vila Nova tem 3 entregas na competência 07/2026.
select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'CLIENTE', 'LEITURA',
  'e0000001-0000-0000-0000-000000000001', 'cccc0001-0000-0000-0000-0000000000c1'
);

select pg_temp.assert(
  total = 3,
  'painel_resumo pelo portal deve contar só as entregas da empresa do JWT, contou ' || total
) from painel_resumo('2026-07-01');

-- Este é o teste que importa: se alguma dessas funções fosse SECURITY DEFINER,
-- o cliente enxergaria o escritório inteiro por dentro delas.
select pg_temp.assert(
  (select coalesce(sum(total), 0) from painel_carga_responsavel('2026-07-01')) = 3,
  'agregado de carga não pode vazar entregas de outras empresas para o portal'
);

select pg_temp.assert(
  (select count(*) from empresas_com_situacao('2026-07-01')) = 1,
  'pelo portal, empresas_com_situacao deve devolver apenas a própria empresa'
);

select pg_temp.assert(
  (select coalesce(sum(total), 0) from agenda_mes(2026, 8)) = 3,
  'agenda pelo portal não pode contar vencimento de outra empresa'
);

-- --------------------------------- 3. sessão sem tenant não agrega nada

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);

select pg_temp.assert(total = 0, 'sessão sem tenant não pode agregar nada')
from painel_resumo('2026-07-01');

rollback;
