-- Remove o trigger antigo de notificação de comentário (on_comment_added /
-- notify_comment_added), que já existia antes de trg_notify_new_comment /
-- notify_new_comment(). Os dois disparavam juntos em todo INSERT em
-- `comments`, gerando duas linhas em `notifications` pro mesmo evento — uma
-- com o título exato "Novo comentário" (a nossa, cai em Mensagens) e outra
-- com título "Novo comentário no chamado {número}" (a antiga, não bate no
-- filtro exato do Header e cai em Notificações) — daí o som e o aviso
-- duplicados.
--
-- Executar no SQL Editor do Supabase da Central de Suporte
-- (projeto uayuqlgceggqteyrmuij).

drop trigger if exists on_comment_added on public.comments;
drop function if exists public.notify_comment_added();
