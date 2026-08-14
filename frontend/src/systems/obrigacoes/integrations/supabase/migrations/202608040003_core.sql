-- Fase 1 — Tenant, usuários dos dois perímetros e empresas.

create table tenant (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  slug          text not null unique,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table tenant is 'Escritórios. Hoje só a MG, mas o isolamento existe desde o schema.';

-- ---------------------------------------------------------------- colaborador

create table usuario (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  auth_user_id  uuid not null unique,          -- auth.users.id (Supabase Auth / Google OAuth)
  nome          text not null,
  email         citext,
  papel         papel_usuario not null default 'OPERADOR',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint usuario_email_por_tenant unique (tenant_id, email)
);

comment on table usuario is 'Colaborador do escritório — perímetro /app.';

-- RBAC por departamento: quem parametriza Fiscal não mexe em Pessoal.
create table usuario_departamento (
  usuario_id   uuid not null references usuario(id) on delete cascade,
  tenant_id    uuid not null references tenant(id) on delete restrict,
  departamento departamento not null,
  primary key (usuario_id, departamento)
);

create index on usuario_departamento (tenant_id, departamento);

-- -------------------------------------------------------------------- empresa

create table empresa (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant(id) on delete restrict,
  razao_social      text not null,
  nome_fantasia     text,
  cnpj              char(14) not null,          -- só dígitos; formatação é da UI
  regime            regime_tributario not null,
  uf                char(2),
  codigo_municipio  char(7),                    -- IBGE, para feriado municipal
  responsavel_id    uuid references usuario(id) on delete set null,
  ativa             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  constraint empresa_cnpj_por_tenant unique (tenant_id, cnpj),
  constraint empresa_cnpj_digitos check (cnpj ~ '^[0-9]{14}$'),
  constraint empresa_uf_valida check (uf is null or uf ~ '^[A-Z]{2}$'),
  constraint empresa_municipio_valido check (codigo_municipio is null or codigo_municipio ~ '^[0-9]{7}$')
);

create index on empresa (tenant_id, ativa);
create index on empresa (tenant_id, responsavel_id);

-- ------------------------------------------------------- acesso do cliente

-- Perímetro /portal. Um login de cliente está sempre amarrado a uma empresa;
-- a empresa vai para o claim app_metadata.empresa_id do JWT.
create table portal_acesso (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  empresa_id    uuid not null references empresa(id) on delete restrict,
  auth_user_id  uuid unique,                    -- null enquanto o convite não foi aceito
  email         citext not null,
  nome          text,
  ativo         boolean not null default true,
  convidado_em  timestamptz not null default now(),
  aceito_em     timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint portal_acesso_email_por_tenant unique (tenant_id, email)
);

create index on portal_acesso (tenant_id, empresa_id);

-- LGPD: aceite de política é registro com data e versão do texto aceito.
create table portal_aceite_politica (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant(id) on delete restrict,
  portal_acesso_id  uuid not null references portal_acesso(id) on delete cascade,
  versao_politica   text not null,
  aceito_em         timestamptz not null default now(),
  constraint aceite_unico_por_versao unique (portal_acesso_id, versao_politica)
);

-- ------------------------------------------------------------------ triggers

create trigger t_tenant_touch          before update on tenant          for each row execute function app.touch_atualizado_em();
create trigger t_usuario_touch         before update on usuario         for each row execute function app.touch_atualizado_em();
create trigger t_empresa_touch         before update on empresa         for each row execute function app.touch_atualizado_em();
create trigger t_portal_acesso_touch   before update on portal_acesso   for each row execute function app.touch_atualizado_em();
