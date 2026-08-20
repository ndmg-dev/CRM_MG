-- Central de Suporte: notificação (som + badge) ao receber comentário novo.
-- Hoje inserir em `comments` não gera nenhuma linha em `notifications`, então
-- o NotificationBell nunca toca o som "comment_received" nem soma o badge.
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
begin
  select assignee_id, requester_id, title
    into v_ticket
    from public.tickets
   where id = new.ticket_id;

  if v_ticket is null then
    return new;
  end if;

  v_message := left(coalesce(new.content, ''), 140);

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

drop trigger if exists trg_notify_new_comment on public.comments;
create trigger trg_notify_new_comment
  after insert on public.comments
  for each row execute function public.notify_new_comment();
