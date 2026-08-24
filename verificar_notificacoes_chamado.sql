-- Diagnóstico: título real das notificações de chamado (não comentário) e
-- triggers ativos na tabela tickets. Rodar no Supabase da Central de
-- Suporte (projeto uayuqlgceggqteyrmuij). Não altera nada.

-- 1) Últimos 15 títulos de notificação de chamado, pra ver o texto exato
--    (o Header do CRM procura a palavra "Encerrado" dentro do título)
SELECT title, message, ticket_id, created_at
FROM notifications
WHERE title <> 'Novo comentário'
ORDER BY created_at DESC
LIMIT 15;

-- 2) Triggers ativos em tickets (o que dispara ao abrir/mudar status/fechar)
SELECT tgname, pg_get_triggerdef(oid) AS definicao
FROM pg_trigger
WHERE tgrelid = 'public.tickets'::regclass
  AND NOT tgisinternal;
