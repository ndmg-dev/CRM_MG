-- =====================================================================
-- PROPOSTA (Fases 2 e 3) — Emissão de eventos Férias → Cronos
-- ⚠️  NÃO APLICAR em produção até:
--     (1) contrato do payload FECHADO com o lado Cronos
--     (2) secrets gravados no Vault (ver seção 0)
--     (3) aprovação explícita do responsável
--
-- Mecanismo: Database Webhook via pg_net, assinado com HMAC-SHA256 sobre
-- string canônica (ver CONTRATO_FERIAS_CRONOS.md, seção 4).
-- Transições de início/fim vêm do job diário (pg_cron); aprovação/cancelamento
-- vêm de trigger. Entrega confiável (retry + captura de resposta) na seção 6.
-- Dependências (já presentes neste Supabase): pg_net, pg_cron, pgcrypto
-- (extensions.hmac), vault.
-- =====================================================================

-- 0) Secrets no Vault (rodar UMA vez, com valores reais):
--    select vault.create_secret('https://cronos.exemplo/integrations/ferias/webhook', 'cronos_webhook_url');
--    select vault.create_secret('<segredo-hmac-combinado>',                            'cronos_webhook_secret');
--    select vault.create_secret('<tenant_id-fixo-combinado>',                          'cronos_tenant_id');

create schema if not exists integracao_cronos;

-- 1) Dedup lógico: cada (férias, status) é uma transição lógica única.
create table if not exists integracao_cronos.transicoes_emitidas (
  ferias_ref_id uuid  not null,
  status        text  not null,
  emitido_em    timestamptz not null default now(),
  primary key (ferias_ref_id, status)
);

-- 2) Log/estado de entrega (1 linha por transição lógica).
create table if not exists integracao_cronos.eventos_log (
  id                bigint generated always as identity primary key,
  ferias_ref_id     uuid  not null,
  status            text  not null,
  payload           jsonb not null,
  request_id        bigint,                 -- id do net.http_post mais recente
  http_status       int,                    -- status HTTP da última resposta
  entregue          boolean not null default false,
  tentativas        int     not null default 1,
  proxima_tentativa timestamptz not null default now(),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  unique (ferias_ref_id, status)
);

-- 3) Assinatura canônica (usada na 1ª emissão E no retry → sempre idêntica).
-- Ordem EXATA definida pelo lado Cronos (fonte da verdade, sem evento_em):
--   ferias_ref_id \n tenant_id \n email \n data_inicio \n data_fim \n status
create or replace function integracao_cronos.montar_canonico(p jsonb)
returns text language sql immutable as $$
  select concat_ws(
    E'\n',
    p->>'ferias_ref_id', p->>'tenant_id', p->>'email',
    p->>'data_inicio', p->>'data_fim', p->>'status'
  );
$$;

-- Chave do HMAC = a STRING do segredo como texto UTF-8, EXATAMENTE como está
-- (o Cronos faz secret.encode('utf-8') sem decodificar; se o valor tiver o
-- prefixo "base64:", ele FAZ parte da chave). Guardar no Vault o valor idêntico
-- ao do Cronos. Funciona igual para segredo hex ou base64 — é sempre texto opaco.
create or replace function integracao_cronos.assinar(p jsonb, p_secret text)
returns text language sql as $$
  select 'sha256=' || encode(
    extensions.hmac(integracao_cronos.montar_canonico(p), p_secret, 'sha256'), 'hex');
$$;

-- Helper: POST assinado via pg_net; devolve o request_id.
create or replace function integracao_cronos._post(p jsonb, p_url text, p_secret text)
returns bigint language plpgsql as $$
declare v_req bigint;
begin
  select net.http_post(
    url     := p_url,
    headers := jsonb_build_object(
      'Content-Type',       'application/json',
      'X-Cronos-Signature', integracao_cronos.assinar(p, p_secret)
    ),
    body    := p,
    timeout_milliseconds := 8000
  ) into v_req;
  return v_req;
end;
$$;

-- 4) Emissão de uma transição (idempotente por ref+status).
create or replace function integracao_cronos.enviar_evento(
  p_ferias_ref_id uuid,
  p_status        text     -- 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text; v_secret text; v_tenant text;
  v_email text; v_ini date; v_fim date;
  v_payload jsonb; v_req bigint;
begin
  insert into integracao_cronos.transicoes_emitidas(ferias_ref_id, status)
  values (p_ferias_ref_id, p_status)
  on conflict do nothing;
  if not found then
    return;  -- transição já emitida
  end if;

  select decrypted_secret into v_url    from vault.decrypted_secrets where name='cronos_webhook_url'    limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='cronos_webhook_secret' limit 1;
  select decrypted_secret into v_tenant from vault.decrypted_secrets where name='cronos_tenant_id'      limit 1;
  if v_url is null or v_secret is null or v_tenant is null then
    raise notice 'integracao_cronos: secrets ausentes no Vault; evento % nao enviado', p_status;
    return;
  end if;

  select lower(btrim(c.email)), s.data_inicio, s.data_fim
    into v_email, v_ini, v_fim
    from solicitacoes s
    join colaboradores c on c.id = s.colaborador_id
   where s.id = p_ferias_ref_id;

  if v_email is null or v_email = '' then
    raise notice 'integracao_cronos: colaborador sem e-mail (ref %); nao enviado', p_ferias_ref_id;
    return;
  end if;

  -- Payload mínimo (LGPD): só o necessário para bloqueio + crédito.
  v_payload := jsonb_build_object(
    'tenant_id',     v_tenant,
    'email',         v_email,
    'ferias_ref_id', p_ferias_ref_id::text,
    'data_inicio',   to_char(v_ini, 'YYYY-MM-DD'),
    'data_fim',      to_char(v_fim, 'YYYY-MM-DD'),
    'status',        p_status,
    'evento_em',     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  v_req := integracao_cronos._post(v_payload, v_url, v_secret);

  insert into integracao_cronos.eventos_log(ferias_ref_id, status, payload, request_id, proxima_tentativa)
  values (p_ferias_ref_id, p_status, v_payload, v_req, now() + interval '2 minutes');
end;
$$;

-- 5) Trigger: aprovação → 'agendada'; rejeição/cancelamento → 'cancelada'.
--    Só para férias reais (case-insensitive). Início/fim NÃO saem daqui.
create or replace function integracao_cronos.on_solicitacao_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(btrim(coalesce(new.tipo_afastamento,''))) not like 'f%rias' then
    return new;
  end if;

  -- Fase 3.1: a integração NUNCA pode quebrar a operação principal do Férias.
  begin
    if lower(btrim(coalesce(new.status,''))) = 'aprovada'
       and (tg_op = 'INSERT' or lower(btrim(coalesce(old.status,''))) is distinct from 'aprovada') then
      perform integracao_cronos.enviar_evento(new.id, 'agendada');

    elsif lower(btrim(coalesce(new.status,''))) in ('rejeitada','reprovada','cancelada')
       and tg_op = 'UPDATE'
       and lower(btrim(coalesce(old.status,''))) = 'aprovada' then
      perform integracao_cronos.enviar_evento(new.id, 'cancelada');
    end if;
  exception when others then
    raise warning 'integracao_cronos: falha ao emitir evento (ref %): %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_cronos_solicitacao on public.solicitacoes;
create trigger trg_cronos_solicitacao
  after insert or update of status on public.solicitacoes
  for each row execute function integracao_cronos.on_solicitacao_change();

-- 6) CONFIABILIDADE (Fase 3): captura de resposta + retry com backoff.
--    Roda periódico (pg_cron). pg_net entrega de forma assíncrona e guarda a
--    resposta em net._http_response (TTL curto) — aqui reconciliamos e
--    reenviamos o que falhou. Retry reusa o MESMO payload assinado.
create or replace function integracao_cronos.conciliar_entregas()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text; v_secret text; rec record; v_req bigint;
begin
  -- (A) captura da resposta das entregas ainda não resolvidas
  update integracao_cronos.eventos_log e
     set http_status   = r.status_code,
         entregue      = (r.status_code between 200 and 299),
         atualizado_em = now()
    from net._http_response r
   where r.id = e.request_id
     and e.entregue = false
     and e.http_status is null;

  -- (B) retry das que ainda não foram entregues (backoff exponencial, teto 10)
  select decrypted_secret into v_url    from vault.decrypted_secrets where name='cronos_webhook_url'    limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='cronos_webhook_secret' limit 1;
  if v_url is null or v_secret is null then
    return;
  end if;

  for rec in
    select * from integracao_cronos.eventos_log
     where entregue = false
       and tentativas < 10
       and proxima_tentativa <= now()
  loop
    v_req := integracao_cronos._post(rec.payload, v_url, v_secret);
    update integracao_cronos.eventos_log
       set request_id        = v_req,
           http_status       = null,
           tentativas        = tentativas + 1,
           proxima_tentativa = now() + make_interval(mins => least((2 ^ tentativas)::int, 240)),
           atualizado_em     = now()
     where id = rec.id;
  end loop;
end;
$$;

-- 7) Agendamentos pg_cron (descomentar ao aplicar).
-- Transições início/fim (03:05 UTC):
create or replace function integracao_cronos.processar_transicoes_diarias()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform integracao_cronos.enviar_evento(s.id, 'em_andamento')
    from solicitacoes s
   where lower(btrim(s.tipo_afastamento)) like 'f%rias'
     and lower(btrim(s.status)) = 'aprovada'
     and s.data_inicio = current_date;

  perform integracao_cronos.enviar_evento(s.id, 'concluida')
    from solicitacoes s
   where lower(btrim(s.tipo_afastamento)) like 'f%rias'
     and lower(btrim(s.status)) = 'aprovada'
     and s.data_fim < current_date;
end;
$$;

-- select cron.schedule('cronos_transicoes_ferias', '5 3 * * *',
--   $job$ select integracao_cronos.processar_transicoes_diarias(); $job$);
-- select cron.schedule('cronos_conciliar_entregas', '*/5 * * * *',
--   $job$ select integracao_cronos.conciliar_entregas(); $job$);
