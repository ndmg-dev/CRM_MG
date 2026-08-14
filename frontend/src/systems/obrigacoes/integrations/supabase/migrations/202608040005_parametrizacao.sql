-- Fase 1 — Vínculo empresa↔obrigação (parametrização).

-- Nunca deletar parametrização — encerrar (ativa=false + fim=data).
-- O histórico de por que uma obrigação existiu numa competência é auditável.
create table empresa_obrigacao (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  empresa_id     uuid not null references empresa(id) on delete restrict,
  obrigacao_id   uuid not null references obrigacao(id) on delete restrict,
  origem         origem_vinculo not null,
  origem_ref     text,                          -- id do grupo / regime que originou o vínculo
  responsavel_id uuid references usuario(id) on delete set null,
  inicio         date not null,
  fim            date,
  ativa          boolean not null default true,
  observacao     text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references usuario(id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  encerrado_por  uuid references usuario(id) on delete set null,
  constraint vinculo_periodo_coerente check (fim is null or fim >= inicio),
  constraint vinculo_encerrado_tem_fim check (ativa or fim is not null)
);

-- Um vínculo ativo por (empresa, obrigação, origem): aplicar o regime tributário
-- cria/encerra apenas linhas de origem REGIME, sem tocar em GRUPO ou MANUAL.
create unique index empresa_obrigacao_ativa_unica
  on empresa_obrigacao (empresa_id, obrigacao_id, origem)
  where ativa;

create index on empresa_obrigacao (tenant_id, empresa_id) where ativa;
create index on empresa_obrigacao (tenant_id, obrigacao_id) where ativa;

create trigger t_empresa_obrigacao_touch
  before update on empresa_obrigacao
  for each row execute function app.touch_atualizado_em();

-- Defesa em profundidade contra o erro clássico: encerrar é update, não delete.
-- A ausência de policy de DELETE no RLS já barra o usuário autenticado; este
-- gatilho barra também caminhos que rodem como owner (jobs, service_role).
create or replace function app.bloqueia_delete_parametrizacao()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Parametrização não é deletável. Encerre com ativa=false e fim=<data>.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger t_empresa_obrigacao_no_delete
  before delete on empresa_obrigacao
  for each row execute function app.bloqueia_delete_parametrizacao();

create trigger t_obrigacao_prazo_no_delete
  before delete on obrigacao_prazo
  for each row execute function app.bloqueia_delete_parametrizacao();
