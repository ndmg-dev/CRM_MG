-- Fase 1 — Entregas.
--
-- Entrega é GERADA pelo job mensal a partir da parametrização, nunca digitada.
-- A unicidade por (empresa, obrigação, competência) é o que torna o job
-- idempotente e o reprocessamento seguro.

create table entrega (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenant(id) on delete restrict,
  empresa_id          uuid not null references empresa(id) on delete restrict,
  obrigacao_id        uuid not null references obrigacao(id) on delete restrict,
  empresa_obrigacao_id uuid references empresa_obrigacao(id) on delete set null,

  competencia         date not null,            -- sempre o 1º dia do mês
  vencimento          date not null,            -- calculado pela regra vigente na competência
  prazo_id            uuid references obrigacao_prazo(id) on delete set null, -- versão usada

  status              status_entrega not null default 'PENDENTE',
  responsavel_id      uuid references usuario(id) on delete set null,

  entregue_em         timestamptz,
  origem_baixa        origem_baixa,
  baixado_por         uuid references usuario(id) on delete set null,

  anexo_path          text,                     -- caminho no bucket privado
  anexo_nome          text,
  anexo_mime          text,
  anexo_bytes         bigint,

  observacao          text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),

  constraint entrega_unica unique (empresa_id, obrigacao_id, competencia),
  constraint entrega_competencia_dia1 check (extract(day from competencia) = 1),
  constraint entrega_baixa_coerente check (
    (status = 'ENTREGUE' and entregue_em is not null and origem_baixa is not null)
    or (status <> 'ENTREGUE' and entregue_em is null)
  ),
  constraint entrega_anexo_tamanho check (anexo_bytes is null or anexo_bytes <= 52428800) -- 50 MB
);

create index on entrega (tenant_id, competencia, status);
create index on entrega (tenant_id, empresa_id, competencia);
create index on entrega (tenant_id, responsavel_id, status);
create index on entrega (tenant_id, vencimento) where status <> 'ENTREGUE';

create trigger t_entrega_touch before update on entrega for each row execute function app.touch_atualizado_em();

-- Trilha de auditoria da entrega. Sem conteúdo de recibo e sem nome+CNPJ
-- juntos (LGPD por minimização) — só ids, transição e autor.
create table entrega_evento (
  id            bigserial primary key,
  tenant_id     uuid not null references tenant(id) on delete restrict,
  entrega_id    uuid not null references entrega(id) on delete cascade,
  status_de     status_entrega,
  status_para   status_entrega not null,
  origem        origem_baixa,
  usuario_id    uuid references usuario(id) on delete set null,
  ocorrido_em   timestamptz not null default now()
);

create index on entrega_evento (tenant_id, entrega_id, ocorrido_em desc);

create or replace function app.registra_evento_entrega()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  insert into entrega_evento (tenant_id, entrega_id, status_de, status_para, origem, usuario_id)
  values (
    new.tenant_id,
    new.id,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    new.origem_baixa,
    coalesce(new.baixado_por, new.responsavel_id)
  );
  return new;
end;
$$;

create trigger t_entrega_evento
  after insert or update of status on entrega
  for each row execute function app.registra_evento_entrega();
