-- Central de Suporte: corrige get_recent_ticket_previews sumindo com
-- chamados recém-criados na lista de conversas do chat flutuante.
--
-- A versão original (202608271200_recent_ticket_previews_rpc.sql) fazia
-- INNER JOIN com `comments` — um chamado só entra em `comments` quando
-- alguém (solicitante ou TI) manda a primeira mensagem pelo chat; a
-- descrição da abertura fica em `tickets.description`, não vira comentário.
-- Resultado: chamado novo, sem nenhuma mensagem ainda, ficava INVISÍVEL na
-- lista inteira (em qualquer aba, "Abertos" incluso) até a primeira troca
-- de mensagem — parecia que "os novos chamados não aparecem em Abertos".
--
-- Fix: LEFT JOIN (LATERAL) em vez de INNER JOIN — todo chamado não
-- arquivado aparece, com a prévia caindo pra `description` e `created_at`
-- quando ainda não tem comentário.

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
  select
    t.id as ticket_id,
    coalesce(c.content, t.description, '') as last_content,
    coalesce(c.created_at, t.created_at) as last_created_at
  from public.tickets t
  left join lateral (
    select content, created_at
    from public.comments
    where ticket_id = t.id
      and internal_only = false
    order by created_at desc
    limit 1
  ) c on true
  where t.archived_at is null
  order by coalesce(c.created_at, t.created_at) desc
  limit p_limit;
$$;

comment on function public.get_recent_ticket_previews(int) is
  'Último comentário visível (não interno) de cada chamado não arquivado, ou a descrição/criação do chamado quando ainda não tem comentário — limitado aos N mais recentes. LEFT JOIN de propósito: chamado novo sem mensagem ainda precisa continuar aparecendo na lista de conversas do chat flutuante.';

grant execute on function public.get_recent_ticket_previews(int) to authenticated;
