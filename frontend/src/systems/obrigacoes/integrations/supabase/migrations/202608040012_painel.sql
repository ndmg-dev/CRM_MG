-- Fase 4 — Agregados do Painel e da Agenda.
--
-- Ficam no banco porque o frontend não pode baixar a tabela de entregas
-- inteira para contar no cliente: ela cresce por competência, e cada linha
-- carrega nome de empresa. Contar aqui é performance E minimização.
--
-- Todas são SECURITY INVOKER (padrão): rodam com as permissões de quem chama,
-- então o RLS continua valendo. Colaborador vê o tenant; cliente vê a empresa
-- dele. Nenhuma recebe tenant_id ou empresa_id por parâmetro.

-- ---------------------------------------------------------------- indicadores

create or replace function painel_resumo(p_competencia date)
returns table (
  total              int,
  entregues          int,
  pendentes          int,
  atrasadas          int,
  aguardando_cliente int,
  vencendo_3_dias    int
)
language sql
stable
as $$
  select
    count(*)::int,
    count(*) filter (where status = 'ENTREGUE')::int,
    count(*) filter (where status in ('PENDENTE', 'EM_ANDAMENTO'))::int,
    count(*) filter (where status = 'ATRASADA')::int,
    count(*) filter (where status = 'AGUARDANDO_CLIENTE')::int,
    count(*) filter (
      where status not in ('ENTREGUE', 'DISPENSADA')
        and vencimento between current_date and current_date + 3
    )::int
  from entrega
  where competencia = date_trunc('month', p_competencia)::date;
$$;

-- ------------------------------------------------------- carga por responsável

create or replace function painel_carga_responsavel(p_competencia date)
returns table (
  responsavel_id uuid,
  responsavel    text,
  total          int,
  pendentes      int,
  atrasadas      int
)
language sql
stable
as $$
  select
    e.responsavel_id,
    coalesce(u.nome, 'Sem responsável'),
    count(*)::int,
    count(*) filter (where e.status not in ('ENTREGUE', 'DISPENSADA'))::int,
    count(*) filter (where e.status = 'ATRASADA')::int
  from entrega e
  left join usuario u on u.id = e.responsavel_id
  where e.competencia = date_trunc('month', p_competencia)::date
  group by e.responsavel_id, u.nome
  order by count(*) filter (where e.status = 'ATRASADA') desc, count(*) desc;
$$;

-- ------------------------------------------------------- próximos vencimentos

create or replace function painel_proximos_vencimentos(p_limite int default 10)
returns table (
  entrega_id     uuid,
  empresa        text,
  obrigacao      text,
  departamento   departamento,
  competencia    date,
  vencimento     date,
  dias_restantes int,
  status         status_entrega,
  responsavel    text
)
language sql
stable
as $$
  select
    e.id,
    coalesce(em.nome_fantasia, em.razao_social),
    o.nome,
    o.departamento,
    e.competencia,
    e.vencimento,
    (e.vencimento - current_date)::int,
    e.status,
    u.nome
  from entrega e
  join empresa   em on em.id = e.empresa_id
  join obrigacao o  on o.id = e.obrigacao_id
  left join usuario u on u.id = e.responsavel_id
  where e.status not in ('ENTREGUE', 'DISPENSADA')
  order by e.vencimento, em.razao_social
  limit greatest(1, least(coalesce(p_limite, 10), 100));
$$;

-- ------------------------------------------------------------------- agenda

-- Vencimentos plotados por dia, para o calendário mensal. Devolve o dia e a
-- contagem por situação — a tela não precisa da lista inteira para pintar o
-- calendário, só para abrir um dia específico.
create or replace function agenda_mes(p_ano int, p_mes int)
returns table (
  dia          date,
  total        int,
  atrasadas    int,
  entregues    int
)
language sql
stable
as $$
  select
    e.vencimento,
    count(*)::int,
    count(*) filter (where e.status = 'ATRASADA')::int,
    count(*) filter (where e.status = 'ENTREGUE')::int
  from entrega e
  where e.vencimento >= make_date(p_ano, p_mes, 1)
    and e.vencimento <  (make_date(p_ano, p_mes, 1) + interval '1 month')::date
  group by e.vencimento
  order by e.vencimento;
$$;

-- ------------------------------------------------ situação por empresa

-- Usada na tela de Empresas: quantas entregas cada cliente tem em aberto.
create or replace function empresas_com_situacao(p_competencia date)
returns table (
  empresa_id    uuid,
  razao_social  text,
  nome_fantasia text,
  cnpj          text,
  regime        regime_tributario,
  responsavel   text,
  total         int,
  entregues     int,
  atrasadas     int
)
language sql
stable
as $$
  select
    em.id, em.razao_social, em.nome_fantasia, em.cnpj, em.regime, u.nome,
    count(e.id)::int,
    count(e.id) filter (where e.status = 'ENTREGUE')::int,
    count(e.id) filter (where e.status = 'ATRASADA')::int
  from empresa em
  left join usuario u on u.id = em.responsavel_id
  left join entrega e
    on e.empresa_id = em.id
   and e.competencia = date_trunc('month', p_competencia)::date
  where em.ativa
  group by em.id, em.razao_social, em.nome_fantasia, em.cnpj, em.regime, u.nome
  order by em.razao_social;
$$;

-- O portal do cliente não usa nenhuma destas exceto painel_resumo (que o RLS
-- já reduz à empresa dele); as demais são de tela de escritório.
revoke execute on function painel_carga_responsavel(date)   from anon;
revoke execute on function painel_proximos_vencimentos(int) from anon;
revoke execute on function empresas_com_situacao(date)      from anon;
revoke execute on function agenda_mes(int, int)             from anon;
revoke execute on function painel_resumo(date)              from anon;
