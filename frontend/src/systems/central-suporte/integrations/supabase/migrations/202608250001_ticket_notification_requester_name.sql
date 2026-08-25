-- Central de Suporte: notificação de chamado novo passa a incluir o nome de
-- quem abriu ("Fulano: ACESSO" em vez de só "ACESSO"). Executar no SQL Editor
-- do Supabase da Central de Suporte.
--
-- Única mudança em relação à função atual: busca profiles.full_name do
-- requester_id e prefixa a mensagem enviada ao staff. A auto-notificação do
-- próprio solicitante ("Chamado Criado: ...") não muda — já é sobre ele mesmo.

create or replace function public.notify_staff_new_ticket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  staff_record record;
  _requester_name text;
begin
  select full_name into _requester_name
  from public.profiles
  where id = new.requester_id;

  if new.requester_id is not null then
    insert into public.notifications (user_id, title, message, ticket_id)
    values (
      new.requester_id,
      'Chamado Criado: ' || lpad(new.ticket_code::text, 3, '0'),
      'Você criou o chamado "' || new.title || '"',
      new.id
    );
  end if;

  for staff_record in
    select distinct user_id from public.user_roles
    where role in ('support_agent', 'dev', 'admin_ti', 'coordinator', 'viewer')
      and user_id is distinct from new.requester_id
  loop
    insert into public.notifications (user_id, title, message, ticket_id)
    values (
      staff_record.user_id,
      'Você recebeu um chamado: ' || lpad(new.ticket_code::text, 3, '0'),
      coalesce(_requester_name, 'Alguém') || ': ' || new.title,
      new.id
    );
  end loop;
  return new;
exception when others then return new;
end;
$function$;
