-- Backfill: notificações antigas de "Novo comentário" (title exato, ver
-- MESSAGE_TITLE no Header.tsx) foram criadas com o texto cru do comentário
-- em `message` — antes da correção em 202608311500, que passou a montar
-- "#001 · Título · Solicitante". Isso só corrige daqui pra frente; as
-- notificações que já existem continuam com o formato antigo até rodar
-- este update.
--
-- Reaplica a mesma lógica da função (número do chamado + título + nome do
-- solicitante) em cima de tudo que já está na tabela, casando pelo
-- ticket_id da própria notificação.
--
-- Executar no SQL Editor do Supabase da Central de Suporte, DEPOIS de já
-- ter aplicado 202608311500 (senão a próxima leva de comentários volta a
-- gerar o formato antigo).

update public.notifications n
   set message = '#' || lpad(t.ticket_code::text, 3, '0') || ' · '
     || coalesce(t.title, 'Chamado') || ' · '
     || coalesce(p.full_name, 'Solicitante desconhecido')
  from public.tickets t
  left join public.profiles p on p.id = t.requester_id
 where n.title = 'Novo comentário'
   and n.ticket_id = t.id;
