-- ============================================================
-- Métricas TM Resposta / TM Resolução — Central de Suporte
-- Executar no SQL editor do Lovable Cloud (projeto dos chamados).
-- 100% aditivo: nova coluna, triggers e backfill que só preenche
-- valores nulos. Nenhum dado existente é alterado ou removido.
-- ============================================================

-- 1) Coluna com o momento real da resolução
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- 2) Trigger em tickets: registra resposta (status saiu de 'new')
--    e resolução (status entrou em resolved/closed)
CREATE OR REPLACE FUNCTION public.track_ticket_tm_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Primeira resposta: qualquer saída do status inicial conta,
    -- caso não haja comentário de agente antes (ver trigger 3)
    IF OLD.status = 'new' AND NEW.responded_at IS NULL THEN
      NEW.responded_at := now();
    END IF;

    -- Resolução: grava ao entrar em resolved/closed…
    IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
      NEW.resolved_at := now();
    END IF;

    -- …e limpa se o chamado for reaberto (a resolução final é a que vale)
    IF NEW.status IN ('new', 'open', 'pending') AND OLD.status IN ('resolved', 'closed') THEN
      NEW.resolved_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_tm_metrics ON public.tickets;
CREATE TRIGGER trg_ticket_tm_metrics
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.track_ticket_tm_metrics();

-- 3) Trigger em comments: primeiro comentário visível de alguém que
--    não é o solicitante marca a primeira resposta
CREATE OR REPLACE FUNCTION public.track_ticket_first_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.internal_only, false) = false AND NEW.ticket_id IS NOT NULL THEN
    UPDATE public.tickets t
       SET responded_at = COALESCE(NEW.created_at, now())
     WHERE t.id = NEW.ticket_id
       AND t.responded_at IS NULL
       AND NEW.author_id IS DISTINCT FROM t.requester_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_first_response ON public.comments;
CREATE TRIGGER trg_ticket_first_response
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.track_ticket_first_response();

-- 4) Backfill histórico (só preenche onde está NULL)
-- IMPORTANTE: a tabela tickets tem trigger que auto-atualiza updated_at em
-- qualquer UPDATE — e o painel/TV filtra "concluído hoje" por updated_at.
-- Sem desligar os triggers, o backfill marcaria todos os resolvidos
-- históricos como atualizados hoje (regressão real ocorrida em 23/07/2026).
ALTER TABLE public.tickets DISABLE TRIGGER USER;
-- 4a) TM Resposta real, recuperada dos comentários já existentes
UPDATE public.tickets t
   SET responded_at = fr.first_response
  FROM (
    SELECT c.ticket_id, MIN(c.created_at) AS first_response
      FROM public.comments c
      JOIN public.tickets t2 ON t2.id = c.ticket_id
     WHERE COALESCE(c.internal_only, false) = false
       AND c.author_id IS DISTINCT FROM t2.requester_id
     GROUP BY c.ticket_id
  ) fr
 WHERE fr.ticket_id = t.id
   AND t.responded_at IS NULL;

-- 4b) Resolução aproximada para os já resolvidos (updated_at era a
--     melhor referência disponível até aqui)
UPDATE public.tickets
   SET resolved_at = updated_at
 WHERE status IN ('resolved', 'closed')
   AND resolved_at IS NULL;

ALTER TABLE public.tickets ENABLE TRIGGER USER;
