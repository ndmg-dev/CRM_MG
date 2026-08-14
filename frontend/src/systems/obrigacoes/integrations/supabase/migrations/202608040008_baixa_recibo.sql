-- Fase 1 — Módulo de baixa automática por recibo.
--
-- Origem: `schema_baixa_recibo.sql` (já especificado). Desenho preservado;
-- três adaptações, todas previstas pelo próprio arquivo original:
--   1. tenant_id ganha FK para tenant (o original não tinha o catálogo à mão);
--   2. o claim sai de app.current_tenant_id() em vez de auth.jwt()->>'tenant_id'
--      — o original já pedia "ajustar ao claim real do CRM"; tenant vive em
--      app_metadata, que o usuário não consegue forjar pelo client;
--   3. policies explicitamente por comando e por perímetro. As originais eram
--      `using(...)` sem `for`/`to`, o que vale para ALL e para public — a fila
--      de revisão contém CNPJ e não pode ser legível pelo portal do cliente.

-- Controle de idempotência: cada recibo processado uma única vez por tenant.
create table recibo_processado (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  hash_arquivo  text not null,            -- SHA-256 do conteúdo
  resultado     text not null,            -- 'baixado','duplicado','revisao_*','ja_entregue'
  entrega_id    uuid references entrega(id),
  processado_em timestamptz not null default now(),
  unique (tenant_id, hash_arquivo)
);

create index idx_recibo_proc_tenant on recibo_processado (tenant_id, processado_em desc);

-- Fila de revisão manual: recibos que não casaram automaticamente.
create table recibo_revisao (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenant(id) on delete restrict,
  hash_arquivo          text not null,
  storage_path          text not null,      -- path no bucket privado (não URL)
  motivo                text not null check (motivo in (
                          'empresa_nao_encontrada','entrega_nao_parametrizada',
                          'dados_ilegiveis','multiplas_entregas')),
  -- o que o parser conseguiu ler (pode ser parcial) — ajuda o humano a decidir
  cnpj_lido             text,
  codigo_obrigacao_lido text,
  competencia_lida      text,
  status                text not null default 'ABERTO'
                          check (status in ('ABERTO','RESOLVIDO','DESCARTADO')),
  resolvido_por         uuid references usuario(id),
  resolvido_em          timestamptz,
  criado_em             timestamptz not null default now(),
  unique (tenant_id, hash_arquivo)
);

create index idx_revisao_abertos on recibo_revisao (tenant_id, criado_em)
  where status = 'ABERTO';

-- Configuração das pastas monitoradas — uma ou mais por tenant.
-- O tenant_id vem daqui, NÃO do conteúdo do arquivo.
create table pasta_monitorada (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete restrict,
  caminho     text not null,
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (tenant_id, caminho)
);

-- ---------------------------------------------------------------------------
-- RLS — isolamento por tenant, e a fila de revisão é do escritório apenas.
-- ---------------------------------------------------------------------------

alter table recibo_processado enable row level security;
alter table recibo_revisao    enable row level security;
alter table pasta_monitorada  enable row level security;

create policy recibo_proc_select on recibo_processado
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_colaborador());

create policy recibo_revisao_select on recibo_revisao
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_colaborador());

-- Resolver/descartar é update do colaborador. Inserir na fila é do worker
-- (service_role) — o cliente do portal não escreve aqui em hipótese nenhuma.
create policy recibo_revisao_update on recibo_revisao
  for update to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_colaborador())
  with check (tenant_id = app.current_tenant_id());

create policy pasta_select on pasta_monitorada
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_colaborador());

create policy pasta_admin on pasta_monitorada
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN')
  with check (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN');

-- O worker do watcher roda com service role (bypassa RLS): por isso ele
-- SEMPRE passa tenant_id explícito em toda query. RLS é a segunda camada,
-- para o acesso vindo da aplicação/usuário. Nunca confie só numa das duas.

-- ---------------------------------------------------------------------------
-- Retenção (LGPD): o recibo espelhado no GED não é o arquivo legal — o
-- original é do cliente. Job periódico apaga conteúdo do bucket e anonimiza
-- metadados de recibos processados há mais de N meses (ex: 12), mantendo
-- apenas o vínculo de que a entrega foi baixada. Implementar como cron.
-- ---------------------------------------------------------------------------
