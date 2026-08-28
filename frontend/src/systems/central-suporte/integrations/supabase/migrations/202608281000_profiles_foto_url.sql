-- Central de Suporte: foto de perfil (Google) em `profiles`.
--
-- Antes disso, todo avatar do sistema (card do Kanban, chat flutuante,
-- modal de detalhes) mostrava só iniciais — a foto do Google nunca era
-- capturada nem salva em lugar nenhum.
--
-- Cada usuário grava a PRÓPRIA foto (vinda de user_metadata.avatar_url da
-- própria sessão de login, ver hooks/useSyncProfilePhoto.ts) toda vez que
-- abre o sistema — não precisa de webhook nem cron pra manter atualizado,
-- o próximo login já resincroniza sozinho. Todo mundo já podia LER a linha
-- de qualquer outro usuário em `profiles` (é assim que nome/e-mail do
-- solicitante/responsável já aparecem hoje) — só falta o campo pra guardar
-- a foto.

alter table public.profiles
  add column if not exists foto_url text;

comment on column public.profiles.foto_url is
  'URL da foto de perfil do Google (user.user_metadata.avatar_url/picture da sessão OAuth), gravada pelo próprio usuário a cada login. RLS de UPDATE em profiles já restringe cada um a mexer só na própria linha — nenhuma policy nova é necessária além da existente, mas VALE CONFIRMAR isso rodando `select policyname, cmd, qual, with_check from pg_policies where tablename = ''profiles''` antes de considerar concluído.';
