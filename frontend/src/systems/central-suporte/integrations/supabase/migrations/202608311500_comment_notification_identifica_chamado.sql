-- Central de Suporte: notificação de "Novo comentário" mostrava o texto CRU
-- do comentário (`left(new.content, 140)`) — sem número do chamado, título
-- ou quem é o solicitante, só dava pra saber do que se tratava lendo o
-- comentário em si (às vezes ilegível: um print colado vira "📎 nome.png",
-- um texto qualquer aparece truncado sem contexto nenhum).
--
-- Mesmo padrão que `notify_staff_new_ticket` já usa pro aviso de chamado
-- novo (ver 202608250001_ticket_notification_requester_name.sql): número
-- do chamado + título + nome de quem abriu, pra identificar de cara qual
-- chamado é, sem precisar abrir.
--
-- O título da notificação ('Novo comentário') continua EXATAMENTE igual —
-- é nele que o Header.tsx filtra o que cai no dropdown de Mensagens
-- (MESSAGE_TITLE, string exata); mudar isso quebraria esse roteamento.
--
-- Executar no SQL Editor do Supabase da Central de Suporte.

create or replace function public.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket record;
  v_title text := 'Novo comentário';
  v_message text;
  v_requester_name text;
begin
  select assignee_id, requester_id, title, ticket_code
    into v_ticket
    from public.tickets
   where id = new.ticket_id;

  if v_ticket is null then
    return new;
  end if;

  select full_name into v_requester_name
    from public.profiles
   where id = v_ticket.requester_id;

  v_message := '#' || lpad(v_ticket.ticket_code::text, 3, '0') || ' · '
    || coalesce(v_ticket.title, 'Chamado') || ' · '
    || coalesce(v_requester_name, 'Solicitante desconhecido');

  -- Responsável (se houver e não for quem comentou)
  if v_ticket.assignee_id is not null and v_ticket.assignee_id <> new.author_id then
    insert into public.notifications (user_id, title, message, ticket_id)
    values (v_ticket.assignee_id, v_title, v_message, new.ticket_id);
  end if;

  -- Solicitante (só para comentários públicos — internos ele nem enxerga)
  if not coalesce(new.internal_only, false)
     and v_ticket.requester_id is not null
     and v_ticket.requester_id <> new.author_id
     and v_ticket.requester_id is distinct from v_ticket.assignee_id then
    insert into public.notifications (user_id, title, message, ticket_id)
    values (v_ticket.requester_id, v_title, v_message, new.ticket_id);
  end if;

  return new;
end;
$$;
