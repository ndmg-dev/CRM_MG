-- Fase 3 — Motor de obrigações: cálculo de prazo e geração de entregas.
--
-- Fica no banco, não na aplicação, por dois motivos: o job mensal vira um
-- único comando idempotente, e o reprocessamento retroativo não depende de
-- reconstruir estado em memória.

-- ---------------------------------------------------------------------------
-- Dia útil
-- ---------------------------------------------------------------------------

-- `p_sabado_e_util` existe porque algumas obrigações contam sábado como útil.
-- Domingo nunca é útil; feriado nunca é útil.
create or replace function eh_dia_util(
  p_data          date,
  p_feriados      date[],
  p_sabado_e_util boolean default false
) returns boolean
language sql
immutable
as $$
  select case extract(isodow from p_data)
           when 7 then false                    -- domingo
           when 6 then coalesce(p_sabado_e_util, false)
           else true
         end
     and not (p_data = any(coalesce(p_feriados, '{}'::date[])));
$$;

-- ---------------------------------------------------------------------------
-- calcula_prazo
-- ---------------------------------------------------------------------------

-- Recebe a REGRA decomposta (não o id) de propósito: a regra usada tem de ser
-- a vigente na competência processada, e quem escolhe a versão é o chamador.
-- Assim a função continua pura e testável com casos sintéticos.
create or replace function calcula_prazo(
  p_tipo_dia      tipo_dia,
  p_dia_base      int,
  p_referencia    referencia_prazo,
  p_ajuste        ajuste_nao_util,
  p_sabado_e_util boolean,
  p_competencia   date,
  p_feriados      date[]
) returns date
language plpgsql
immutable
as $$
declare
  v_mes_base date;
  v_ultimo   date;
  v_alvo     date;
  v_contados int := 0;
  v_passos   int := 0;
begin
  if p_dia_base is null or p_dia_base < 1 then
    raise exception 'dia_base inválido: %', p_dia_base;
  end if;

  v_mes_base := date_trunc('month', p_competencia)::date + (
    case p_referencia
      when 'MES_COMPETENCIA'      then 0
      when 'MES_SEGUINTE'         then 1
      when 'SEGUNDO_MES_SEGUINTE' then 2
    end || ' months'
  )::interval;

  v_ultimo := (date_trunc('month', v_mes_base) + interval '1 month - 1 day')::date;

  if p_tipo_dia = 'CORRIDO' then
    -- "Dia 31" em mês de 30 cai no último dia, não vaza para o mês seguinte.
    v_alvo := least(v_mes_base + (p_dia_base - 1), v_ultimo);

    -- Ajuste só existe para dia corrido: contagem em dia útil já cai em útil.
    if p_ajuste <> 'NENHUM' then
      while not eh_dia_util(v_alvo, p_feriados, p_sabado_e_util) loop
        v_alvo := v_alvo + (case p_ajuste when 'ANTECIPA' then -1 else 1 end);
        v_passos := v_passos + 1;
        if v_passos > 60 then
          raise exception 'não achei dia útil perto de % (feriados demais?)', v_alvo;
        end if;
      end loop;
    end if;

  else  -- UTIL: o p_dia_base-ésimo dia útil do mês base
    v_alvo := v_mes_base;
    loop
      if eh_dia_util(v_alvo, p_feriados, p_sabado_e_util) then
        v_contados := v_contados + 1;
        exit when v_contados = p_dia_base;
      end if;

      -- Pediram mais dias úteis do que o mês tem: usa o último útil do mês.
      if v_alvo >= v_ultimo then
        while not eh_dia_util(v_alvo, p_feriados, p_sabado_e_util) loop
          v_alvo := v_alvo - 1;
        end loop;
        exit;
      end if;

      v_alvo := v_alvo + 1;
    end loop;
  end if;

  return v_alvo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Feriados aplicáveis a uma empresa
-- ---------------------------------------------------------------------------

-- Nacionais do tenant + estaduais da UF da empresa + municipais do município.
-- O feriado municipal de Goiânia não pode atrasar a obrigação de um cliente
-- de Anápolis.
create or replace function feriados_da_empresa(p_empresa_id uuid)
returns date[]
language sql
stable
as $$
  select coalesce(array_agg(f.data order by f.data), '{}'::date[])
  from empresa e
  join feriado f on f.tenant_id = e.tenant_id
   and (
     f.abrangencia = 'NACIONAL'
     or (f.abrangencia = 'ESTADUAL'  and f.uf = e.uf)
     or (f.abrangencia = 'MUNICIPAL' and f.codigo_municipio = e.codigo_municipio)
   )
  where e.id = p_empresa_id;
$$;

-- ---------------------------------------------------------------------------
-- Periodicidade
-- ---------------------------------------------------------------------------

-- Em quais competências a obrigação existe. EVENTUAL nunca é gerada pelo job:
-- por definição não tem calendário — entra por parametrização manual.
create or replace function competencia_casa(p_periodicidade periodicidade, p_competencia date)
returns boolean
language sql
immutable
as $$
  select case p_periodicidade
    when 'MENSAL'        then true
    when 'BIMESTRAL'     then extract(month from p_competencia)::int % 2 = 0
    when 'TRIMESTRAL'    then extract(month from p_competencia)::int % 3 = 0
    when 'QUADRIMESTRAL' then extract(month from p_competencia)::int % 4 = 0
    when 'SEMESTRAL'     then extract(month from p_competencia)::int % 6 = 0
    when 'ANUAL'         then extract(month from p_competencia)::int = 12
    when 'EVENTUAL'      then false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Job mensal de geração
-- ---------------------------------------------------------------------------

-- Idempotente por (empresa, obrigação, competência). Rodar duas vezes no mesmo
-- mês não duplica nada; rodar de novo depois de a Receita mudar um prazo
-- recalcula o vencimento das que ainda não foram entregues.
--
-- O que ele NUNCA faz: mexer em entrega já ENTREGUE. Recalcular o vencimento
-- de algo já baixado reescreveria história.
create or replace function gerar_entregas(
  p_tenant_id   uuid,
  p_competencia date
) returns table (criadas int, atualizadas int)
language plpgsql
as $$
declare
  v_comp date := date_trunc('month', p_competencia)::date;
begin
  return query
  with candidatas as (
    select
      eo.tenant_id, eo.empresa_id, eo.obrigacao_id, eo.id as vinculo_id,
      eo.responsavel_id,
      pz.id as prazo_id,
      calcula_prazo(
        pz.tipo_dia, pz.dia_base, pz.referencia, pz.ajuste, pz.sabado_e_util,
        v_comp, feriados_da_empresa(eo.empresa_id)
      ) as vencimento
    from empresa_obrigacao eo
    join empresa   e on e.id = eo.empresa_id and e.ativa
    join obrigacao o on o.id = eo.obrigacao_id and o.ativa
    -- A regra VIGENTE NA COMPETÊNCIA, não a de hoje: é isto que faz o
    -- reprocessamento retroativo devolver o prazo histórico correto.
    cross join lateral prazo_vigente(eo.obrigacao_id, v_comp) pz
    where eo.tenant_id = p_tenant_id
      and eo.ativa
      and eo.inicio <= v_comp
      and (eo.fim is null or eo.fim >= v_comp)
      and competencia_casa(o.periodicidade, v_comp)
      and pz.id is not null
  ),
  gravadas as (
    insert into entrega as en (
      tenant_id, empresa_id, obrigacao_id, empresa_obrigacao_id,
      competencia, vencimento, prazo_id, status, responsavel_id
    )
    select
      c.tenant_id, c.empresa_id, c.obrigacao_id, c.vinculo_id,
      v_comp, c.vencimento, c.prazo_id, 'PENDENTE', c.responsavel_id
    from candidatas c
    on conflict (empresa_id, obrigacao_id, competencia) do update
      set vencimento = excluded.vencimento,
          prazo_id   = excluded.prazo_id
      where en.status <> 'ENTREGUE'
        and (en.vencimento, en.prazo_id) is distinct from (excluded.vencimento, excluded.prazo_id)
    returning (xmax = 0) as inserida
  )
  select
    count(*) filter (where inserida)::int,
    count(*) filter (where not inserida)::int
  from gravadas;
end;
$$;

comment on function gerar_entregas is
  'Job mensal. Idempotente. Não toca em entrega já ENTREGUE.';

-- ---------------------------------------------------------------------------
-- Reprocessamento manual
-- ---------------------------------------------------------------------------

-- Para quando a Receita muda prazo no meio do mês ou se corrige um feriado.
-- Refaz um intervalo de competências de uma vez.
create or replace function reprocessar_entregas(
  p_tenant_id   uuid,
  p_de          date,
  p_ate         date
) returns table (competencia date, criadas int, atualizadas int)
language plpgsql
as $$
declare
  v_comp date;
  r      record;
begin
  if p_ate < p_de then
    raise exception 'intervalo invertido: % > %', p_de, p_ate;
  end if;

  v_comp := date_trunc('month', p_de)::date;
  while v_comp <= date_trunc('month', p_ate)::date loop
    select * into r from gerar_entregas(p_tenant_id, v_comp);
    competencia := v_comp;
    criadas     := r.criadas;
    atualizadas := r.atualizadas;
    return next;
    v_comp := (v_comp + interval '1 month')::date;
  end loop;
end;
$$;

-- Estas funções escrevem em `entrega`, que tem FORCE RLS: rodam pelo worker
-- com service_role. Nenhuma delas é exposta ao usuário autenticado.
revoke execute on function gerar_entregas(uuid, date)             from public, anon, authenticated;
revoke execute on function reprocessar_entregas(uuid, date, date) from public, anon, authenticated;
