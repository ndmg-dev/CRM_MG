-- ============================================================
-- Ouvidoria Corporativa — SSO (login unificado com o CRM) + políticas RLS
-- Execute no SQL Editor do projeto Supabase da Ouvidoria (não é o mesmo
-- projeto do CRM nem o da Central de Suporte).
--
-- Contexto: o app Flask original (ndmg-dev/ouvidoria-mg) tem seu próprio
-- fluxo de login Google OAuth 2.0 e gerencia sessão via cookie do Flask,
-- acessando este banco com a SUPABASE_SERVICE_ROLE_KEY (que ignora RLS).
-- A versão nativa dentro do CRM (frontend/src/systems/ouvidoria) faz login
-- único (SSO): o idToken do Google já validado pelo login do CRM autentica
-- também aqui via signInWithIdToken, e o front passa a falar DIRETO com
-- este Supabase usando a anon key — por isso o RLS precisa de políticas de
-- verdade a partir de agora (hoje está habilitado mas sem nenhuma política,
-- ver sql/fix_security_advisor.sql do repo original: isso já nega tudo
-- pra anon/authenticated, então esta migration só ADICIONA acesso, nunca
-- remove — não há risco de destravar algo que já estava fechado).
--
-- RLS é reforçado aqui só pro caminho novo (SSO/anon key). O app Flask
-- original, se continuar rodando, segue funcionando igual (service_role
-- sempre ignora RLS).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Link entre o usuário próprio da Ouvidoria (public.users) e o usuário
--    do Supabase Auth (auth.users) criado pelo signInWithIdToken.
--
--    NÃO reaproveitamos users.id como o auth.uid() (like central-suporte
--    faz com profiles.id) porque users.id já é referenciado por FKs de
--    dados reais em produção (complaints.user_id, complaint_messages
--    .sender_id, etc.) — trocar a PK exigiria reescrever todas essas FKs.
--    Uma coluna nova e nullable é mais seguro.
-- ------------------------------------------------------------

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- ------------------------------------------------------------
-- 2. Helpers usados pelas políticas RLS abaixo. SECURITY DEFINER pra não
--    ficar preso em recursão de RLS ao consultar a própria public.users.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ouvidoria_current_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.ouvidoria_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT COALESCE(
        (SELECT role = 'admin' FROM public.users WHERE auth_user_id = auth.uid()),
        FALSE
    );
$$;

GRANT EXECUTE ON FUNCTION public.ouvidoria_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ouvidoria_is_admin() TO authenticated;

-- ------------------------------------------------------------
-- 3. Provisionamento — chamada pelo front logo após o
--    supabase.auth.signInWithIdToken (mesmo padrão de
--    ensure_support_user_profile() da Central de Suporte). Cria a linha em
--    public.users no primeiro login, ou linka auth_user_id numa linha já
--    existente (usuário migrado do Flask, casado por e-mail).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_ouvidoria_user_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_id UUID := auth.uid();
    v_email TEXT := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
    v_name TEXT := coalesce(
        auth.jwt() -> 'user_metadata' ->> 'full_name',
        auth.jwt() -> 'user_metadata' ->> 'name',
        split_part(v_email, '@', 1)
    );
    v_avatar TEXT := auth.jwt() -> 'user_metadata' ->> 'avatar_url';
BEGIN
    IF v_auth_id IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'Sessão inválida';
    END IF;

    IF v_email NOT LIKE '%@mendoncagalvao.com.br' THEN
        RAISE EXCEPTION 'Acesso restrito ao domínio @mendoncagalvao.com.br';
    END IF;

    -- Já existe linha (migrada do Flask ou login anterior via SSO)?
    UPDATE public.users
       SET auth_user_id = v_auth_id,
           full_name = coalesce(nullif(full_name, ''), v_name),
           avatar_url = coalesce(avatar_url, v_avatar),
           last_login_at = now()
     WHERE email = v_email
       AND (auth_user_id IS NULL OR auth_user_id = v_auth_id);

    IF NOT FOUND THEN
        INSERT INTO public.users (email, full_name, avatar_url, domain, role, auth_user_id, last_login_at)
        VALUES (v_email, v_name, v_avatar, split_part(v_email, '@', 2), 'user', v_auth_id, now())
        ON CONFLICT (email) DO UPDATE
            SET auth_user_id = excluded.auth_user_id,
                last_login_at = excluded.last_login_at;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_ouvidoria_user_profile() TO authenticated;

-- ------------------------------------------------------------
-- 4. Políticas RLS. Tabelas já estão com RLS habilitado (ver
--    sql/fix_security_advisor.sql do repo original) e SEM NENHUMA
--    política — ou seja, hoje anon/authenticated não leem/escrevem nada
--    por aqui. As políticas abaixo replicam exatamente as mesmas regras
--    já aplicadas hoje pelo Flask (ver app/routes/*.py e
--    app/utils/decorators.py do repo ndmg-dev/ouvidoria-mg), nada mais
--    permissivo nem mais restritivo.
-- ------------------------------------------------------------

-- users: info tipo "diretório interno" (nome/avatar/role) já era exposta
-- sem restrição nenhuma pelos joins do Flask (service_role ignora RLS) em
-- toda listagem de manifestações/mensagens/notas — inclusive pro admin ver
-- nome de qualquer colaborador. Leitura ampla pra autenticado replica esse
-- comportamento; escrita só via a RPC acima (nenhuma policy de
-- INSERT/UPDATE = negado por padrão pro client).
CREATE POLICY users_select_authenticated ON public.users
    FOR SELECT TO authenticated
    USING (true);

-- complaints: dono vê as próprias; admin vê tudo. Igual
-- get_user_complaints() / get_all_complaints() do ouvidoria_service.py.
CREATE POLICY complaints_select_own_or_admin ON public.complaints
    FOR SELECT TO authenticated
    USING (
        is_deleted = false
        AND (user_id = public.ouvidoria_current_user_id() OR public.ouvidoria_is_admin())
    );

-- Criar manifestação: só pra si mesmo (igual ouvidoria.create, que sempre
-- usa session['user']['id'] como user_id, nunca um valor vindo do form).
CREATE POLICY complaints_insert_own ON public.complaints
    FOR INSERT TO authenticated
    WITH CHECK (user_id = public.ouvidoria_current_user_id());

-- Mudar status/prioridade/atribuição/notas de IA: só admin (admin.py inteiro
-- é @admin_required; não existe rota de update de complaint pro usuário
-- comum).
CREATE POLICY complaints_update_admin ON public.complaints
    FOR UPDATE TO authenticated
    USING (public.ouvidoria_is_admin())
    WITH CHECK (public.ouvidoria_is_admin());

-- complaint_messages: ver/enviar mensagem só na própria manifestação (ou
-- qualquer uma, se admin) — igual ouvidoria.add_message/get_messages e
-- admin.admin_reply/get_messages.
CREATE POLICY complaint_messages_select_own_or_admin ON public.complaint_messages
    FOR SELECT TO authenticated
    USING (
        is_deleted = false
        AND (
            public.ouvidoria_is_admin()
            OR EXISTS (
                SELECT 1 FROM public.complaints c
                 WHERE c.id = complaint_messages.complaint_id
                   AND c.user_id = public.ouvidoria_current_user_id()
            )
        )
    );

CREATE POLICY complaint_messages_insert_own_or_admin ON public.complaint_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = public.ouvidoria_current_user_id()
        AND (
            (sender_type = 'admin' AND public.ouvidoria_is_admin())
            OR (
                sender_type = 'user'
                AND EXISTS (
                    SELECT 1 FROM public.complaints c
                     WHERE c.id = complaint_messages.complaint_id
                       AND c.user_id = public.ouvidoria_current_user_id()
                )
            )
        )
    );

-- complaint_internal_notes: só admin (add_note/get_internal_notes são
-- @admin_required; usuário comum nunca vê nem escreve nota interna).
CREATE POLICY complaint_internal_notes_admin_all ON public.complaint_internal_notes
    FOR ALL TO authenticated
    USING (public.ouvidoria_is_admin())
    WITH CHECK (public.ouvidoria_is_admin() AND author_id = public.ouvidoria_current_user_id());

-- complaint_attachments: anexar/ver só na própria manifestação, ou
-- qualquer uma se admin (upload_attachment/get_attachments).
CREATE POLICY complaint_attachments_select_own_or_admin ON public.complaint_attachments
    FOR SELECT TO authenticated
    USING (
        public.ouvidoria_is_admin()
        OR EXISTS (
            SELECT 1 FROM public.complaints c
             WHERE c.id = complaint_attachments.complaint_id
               AND c.user_id = public.ouvidoria_current_user_id()
        )
    );

CREATE POLICY complaint_attachments_insert_own ON public.complaint_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by = public.ouvidoria_current_user_id()
        AND EXISTS (
            SELECT 1 FROM public.complaints c
             WHERE c.id = complaint_attachments.complaint_id
               AND c.user_id = public.ouvidoria_current_user_id()
        )
    );

-- chat_sessions / chat_messages: 100% privado do próprio usuário — nenhuma
-- rota admin toca nessas tabelas no app original (chat.py é só
-- @login_required, sem noção de admin).
CREATE POLICY chat_sessions_own ON public.chat_sessions
    FOR ALL TO authenticated
    USING (user_id = public.ouvidoria_current_user_id())
    WITH CHECK (user_id = public.ouvidoria_current_user_id());

CREATE POLICY chat_messages_own ON public.chat_messages
    FOR ALL TO authenticated
    USING (user_id = public.ouvidoria_current_user_id())
    WITH CHECK (user_id = public.ouvidoria_current_user_id());

-- knowledge_documents: só admin gerencia (admin.knowledge*); usuário comum
-- nunca lista/lê documento diretamente (só conversa com a IRIS, que busca
-- os chunks via service_role no n8n, fora do RLS).
CREATE POLICY knowledge_documents_admin_all ON public.knowledge_documents
    FOR ALL TO authenticated
    USING (public.ouvidoria_is_admin())
    WITH CHECK (public.ouvidoria_is_admin());

-- knowledge_chunks: nenhuma policy = acesso negado por padrão pro client
-- (só service_role, usado pelo n8n e pelo proxy de criação manual do CRM,
-- lê/escreve aqui). Não precisa ir num browser nunca.

-- audit_logs: só admin lê; inserir só a própria ação (log_audit sempre usa
-- o id de quem está logado, nunca um valor arbitrário vindo do client).
CREATE POLICY audit_logs_select_admin ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.ouvidoria_is_admin());

CREATE POLICY audit_logs_insert_admin_own ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.ouvidoria_is_admin() AND user_id = public.ouvidoria_current_user_id());

-- ------------------------------------------------------------
-- 5. Storage (bucket "complaint-attachments") — é um sistema de RLS
--    separado das tabelas acima (storage.objects), já vem com RLS
--    habilitado por padrão em todo bucket do Supabase. O bucket precisa já
--    existir (criado pelo repo original — Storage > Buckets). Path pattern
--    "{complaint_id}/{uuid}.{ext}", ver upload_attachment() em
--    ouvidoria_service.py: por isso dá pra derivar o dono a partir do
--    primeiro segmento do path, sem precisar de tabela extra.
-- ------------------------------------------------------------

CREATE POLICY complaint_attachments_storage_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'complaint-attachments'
        AND EXISTS (
            SELECT 1 FROM public.complaints c
             WHERE c.id::text = (storage.foldername(name))[1]
               AND c.user_id = public.ouvidoria_current_user_id()
        )
    );

CREATE POLICY complaint_attachments_storage_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'complaint-attachments'
        AND (
            public.ouvidoria_is_admin()
            OR EXISTS (
                SELECT 1 FROM public.complaints c
                 WHERE c.id::text = (storage.foldername(name))[1]
                   AND c.user_id = public.ouvidoria_current_user_id()
            )
        )
    );
