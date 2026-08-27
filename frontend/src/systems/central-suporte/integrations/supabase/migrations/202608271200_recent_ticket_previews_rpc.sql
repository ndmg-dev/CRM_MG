-- Central de Suporte: evita que a lista de conversas do chat flutuante
-- (ConversationList.tsx) precise baixar até 300 comentários pra derivar só
-- os 30 chamados com mensagem mais recente. Essa function faz a mesma coisa
-- direto no banco (DISTINCT ON), devolvendo só o que realmente é usado.
--
-- SECURITY INVOKER (padrão) de propósito: roda com os privilégios de quem
-- chama, então a RLS de `comments` e `tickets` continua se aplicando
-- normalmente — cada usuário só enxerga os mesmos chamados que já enxergava
-- antes com a consulta feita direto do client.

create or replace function public.get_recent_ticket_previews(p_limit int default 30)
returns table (
  ticket_id uuid,
  last_content text,
  last_created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select ticket_id, last_content, last_created_at
  from (
    select distinct on (c.ticket_id)
      c.ticket_id,
      c.content as last_content,
      c.created_at as last_created_at
    from public.comments c
    join public.tickets t on t.id = c.ticket_id
    where c.internal_only = false
      and t.archived_at is null
    order by c.ticket_id, c.created_at desc
  ) latest
  order by last_created_at desc
  limit p_limit;
$$;

comment on function public.get_recent_ticket_previews(int) is
  'Último comentário visível (não interno) de cada chamado não arquivado, limitado aos N mais recentes — usado pela lista de conversas do chat flutuante em vez de baixar centenas de comentários pro client filtrar.';

grant execute on function public.get_recent_ticket_previews(int) to authenticated;
