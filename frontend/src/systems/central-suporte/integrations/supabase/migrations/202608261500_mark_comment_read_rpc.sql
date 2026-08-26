-- Central de Suporte: corrige o tick de leitura do chat rápido (✓ / ✓✓),
-- que não estava atualizando. Executar no SQL Editor do Supabase da
-- Central de Suporte.
--
-- Causa provável: a política de RLS de UPDATE em `comments` só permite o
-- autor alterar a própria linha. Quem MARCA como lido é sempre o
-- destinatário (outra pessoa), então o `UPDATE ... SET read_at = now()`
-- feito pelo front falha silenciosamente (0 linhas afetadas, sem erro) —
-- read_at nunca é gravado e o tick nunca vira duplo.
--
-- Em vez de abrir a política de UPDATE da tabela inteira (o que deixaria
-- qualquer coluna, não só read_at, editável por qualquer um), esta função
-- roda com os privilégios do dono da tabela (SECURITY DEFINER) e só grava
-- read_at — content, reason, attachment_url etc. continuam protegidos pela
-- RLS normal.

create or replace function public.mark_comments_read(p_comment_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.comments
  set read_at = now()
  where id = any(p_comment_ids)
    and author_id is distinct from auth.uid()
    and read_at is null;
end;
$$;

comment on function public.mark_comments_read(uuid[]) is
  'Marca comentários como lidos (read_at) em nome do usuário autenticado — só afeta linhas de outro autor e ainda sem leitura. SECURITY DEFINER porque a RLS de UPDATE em comments é restrita ao autor.';

-- Só usuários autenticados podem chamar — mesma exigência já feita dentro
-- da função via auth.uid().
grant execute on function public.mark_comments_read(uuid[]) to authenticated;
