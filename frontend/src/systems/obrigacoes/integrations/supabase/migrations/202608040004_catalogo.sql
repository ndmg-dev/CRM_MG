-- Fase 1 — Catálogo mestre de obrigações, regra de prazo versionada e feriados.

create table obrigacao (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  codigo         text not null,                 -- DAS, DCTFWEB, ESOCIAL, ...
  nome           text not null,
  descricao      text,
  departamento   departamento not null,
  esfera         esfera not null,
  periodicidade  periodicidade not null,
  uf             char(2),                       -- preenchido quando esfera = ESTADUAL
  codigo_municipio char(7),                     -- preenchido quando esfera = MUNICIPAL
  ativa          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint obrigacao_codigo_por_tenant unique (tenant_id, codigo),
  constraint obrigacao_escopo_coerente check (
    (esfera in ('FEDERAL', 'INTERNA') and uf is null and codigo_municipio is null) or
    (esfera = 'ESTADUAL'  and uf is not null and codigo_municipio is null) or
    (esfera = 'MUNICIPAL' and codigo_municipio is not null)
  )
);

create index on obrigacao (tenant_id, departamento, ativa);

comment on table obrigacao is 'Cadastro único por tipo de obrigação — nunca por empresa.';

-- --------------------------------------------------------------- regra de prazo

-- Versionada por vigência. Nunca editar linha existente: quando a regra muda,
-- fecha-se vigencia_fim da versão atual e insere-se uma nova. Reprocessamento
-- retroativo precisa da regra que valia na competência, não da de hoje.
create table obrigacao_prazo (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenant(id) on delete restrict,
  obrigacao_id     uuid not null references obrigacao(id) on delete restrict,
  tipo_dia         tipo_dia not null,
  dia_base         smallint not null,
  referencia       referencia_prazo not null default 'MES_SEGUINTE',
  ajuste           ajuste_nao_util not null default 'ANTECIPA',
  sabado_e_util    boolean not null default false,
  vigencia_inicio  date not null,               -- 1º dia da 1ª competência em que vale
  vigencia_fim     date,                        -- null = vigente
  observacao       text,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references usuario(id) on delete set null,
  constraint prazo_dia_base_valido check (dia_base between 1 and 31),
  constraint prazo_vigencia_coerente check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create index on obrigacao_prazo (tenant_id, obrigacao_id, vigencia_inicio desc);

-- Garante que duas versões da regra nunca se sobreponham no tempo.
create extension if not exists btree_gist;

alter table obrigacao_prazo
  add constraint prazo_sem_sobreposicao
  exclude using gist (
    obrigacao_id with =,
    daterange(vigencia_inicio, vigencia_fim, '[]') with &&
  );

-- Regra vigente numa competência específica.
create or replace function prazo_vigente(p_obrigacao_id uuid, p_competencia date)
returns obrigacao_prazo
language sql
stable
as $$
  select p.*
  from obrigacao_prazo p
  where p.obrigacao_id = p_obrigacao_id
    and p.vigencia_inicio <= p_competencia
    and (p.vigencia_fim is null or p.vigencia_fim >= p_competencia)
  order by p.vigencia_inicio desc
  limit 1;
$$;

-- ------------------------------------------------------------------- feriados

-- Feriado é dado compartilhado por tenant (cada escritório mantém o seu),
-- segmentado por abrangência. Municipal usa código IBGE, não nome de cidade.
create table feriado (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenant(id) on delete restrict,
  data             date not null,
  nome             text not null,
  abrangencia      abrangencia_feriado not null,
  uf               char(2),
  codigo_municipio char(7),
  criado_em        timestamptz not null default now(),
  constraint feriado_escopo_coerente check (
    (abrangencia = 'NACIONAL'  and uf is null and codigo_municipio is null) or
    (abrangencia = 'ESTADUAL'  and uf is not null and codigo_municipio is null) or
    (abrangencia = 'MUNICIPAL' and uf is not null and codigo_municipio is not null)
  )
);

create unique index feriado_unico
  on feriado (tenant_id, data, abrangencia, coalesce(uf, '--'), coalesce(codigo_municipio, '-------'));

create index on feriado (tenant_id, data);

create trigger t_obrigacao_touch before update on obrigacao for each row execute function app.touch_atualizado_em();
