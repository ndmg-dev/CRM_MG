-- =====================================================================
-- CORREÇÃO (pós go-live, 28/07) — dois gaps encontrados em produção:
--
-- 1) Período que já começou ficava preso em "agendada" até o job das
--    03:05 UTC do dia seguinte rodar. Corrigido: se data_inicio <= hoje
--    no momento da aprovação, emite 'em_andamento' direto.
--
-- 2) Exclusão física (DELETE) de uma solicitação no Férias não notificava
--    o Cronos — o trigger só escutava INSERT/UPDATE. O período ficava
--    órfão no Cronos para sempre. Corrigido: trigger de DELETE emite
--    'cancelada' quando uma solicitação aprovada é apagada.
--
-- Rodar no SQL editor do Supabase de Férias.
-- =====================================================================

-- 1) Trigger de UPDATE/INSERT: emite em_andamento direto se já começou.
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

  begin
    if lower(btrim(coalesce(new.status,''))) = 'aprovada'
       and (tg_op = 'INSERT' or lower(btrim(coalesce(old.status,''))) is distinct from 'aprovada') then
      if new.data_inicio <= current_date then
        -- Período já começou (ou começa hoje): pula direto para em_andamento,
        -- não espera o job diário das 03:05 UTC.
        perform integracao_cronos.enviar_evento(new.id, 'em_andamento');
      else
        perform integracao_cronos.enviar_evento(new.id, 'agendada');
      end if;

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

-- 2) Trigger de DELETE: exclusão física de solicitação aprovada = cancelada.
create or replace function integracao_cronos.on_solicitacao_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(btrim(coalesce(old.tipo_afastamento,''))) like 'f%rias'
     and lower(btrim(coalesce(old.status,''))) = 'aprovada' then
    begin
      perform integracao_cronos.enviar_evento(old.id, 'cancelada');
    exception when others then
      raise warning 'integracao_cronos: falha ao emitir cancelamento por delete (ref %): %', old.id, sqlerrm;
    end;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_cronos_solicitacao_delete on public.solicitacoes;
create trigger trg_cronos_solicitacao_delete
  after delete on public.solicitacoes
  for each row execute function integracao_cronos.on_solicitacao_delete();

-- 3) Catch-up manual: os que já foram emitidos como 'agendada' mas o
--    período já começou (caso da Rayla/Tiago testados hoje) — emite
--    em_andamento agora, sem esperar o job de amanhã.
do $$
declare rec record;
begin
  for rec in
    select id from solicitacoes
     where lower(btrim(tipo_afastamento)) like 'f%rias'
       and lower(btrim(status)) = 'aprovada'
       and data_inicio <= current_date
  loop
    perform integracao_cronos.enviar_evento(rec.id, 'em_andamento');
  end loop;
end $$;

select integracao_cronos.conciliar_entregas();
