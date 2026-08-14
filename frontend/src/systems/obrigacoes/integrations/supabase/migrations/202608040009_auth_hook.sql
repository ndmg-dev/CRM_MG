-- Fase 2 — Custom Access Token Hook.
--
-- O GoTrue (Google OAuth para o escritório, magic link para o portal) emite um
-- JWT sem nenhum claim de negócio. Esta função é o que injeta tenant_id,
-- perímetro, papel, departamentos e empresa_id em app_metadata — e é o único
-- lugar do sistema onde esses valores são decididos.
--
-- Por que app_metadata e não user_metadata: user_metadata é gravável pelo
-- próprio usuário via /auth/v1/user. Um cliente do portal poderia se declarar
-- COLABORADOR de outro tenant. app_metadata só o servidor escreve.
--
-- Registrar em: Dashboard > Authentication > Hooks > Customize Access Token,
-- ou em config.toml (ver supabase/config.toml).

create or replace function public.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := (event ->> 'user_id')::uuid;
  v_email     text := lower(coalesce(event #>> '{claims,email}', ''));
  v_claims    jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_meta      jsonb := coalesce(v_claims -> 'app_metadata', '{}'::jsonb);
  v_extra     jsonb;
  r_colab     record;
  r_cliente   record;
begin
  -- 1. Colaborador do escritório (perímetro /app).
  select u.tenant_id, u.papel, u.ativo,
         coalesce(
           (select jsonb_agg(ud.departamento::text)
              from public.usuario_departamento ud
             where ud.usuario_id = u.id),
           '[]'::jsonb
         ) as departamentos
    into r_colab
    from public.usuario u
   where u.auth_user_id = v_user_id
     and u.ativo;

  if found then
    v_extra := jsonb_build_object(
      'tenant_id',     r_colab.tenant_id,
      'perimetro',     'COLABORADOR',
      'papel',         r_colab.papel::text,
      'departamentos', r_colab.departamentos
    );

  else
    -- 2. Cliente (perímetro /portal). Casa por auth_user_id; no primeiro login
    --    o convite ainda só tem o e-mail, então casa por e-mail também.
    select pa.tenant_id, pa.empresa_id
      into r_cliente
      from public.portal_acesso pa
     where pa.ativo
       and (pa.auth_user_id = v_user_id
            or (pa.auth_user_id is null and v_email <> '' and pa.email = v_email))
     limit 1;

    if found then
      v_extra := jsonb_build_object(
        'tenant_id',  r_cliente.tenant_id,
        'perimetro',  'CLIENTE',
        'papel',      'LEITURA',
        'empresa_id', r_cliente.empresa_id
      );
    else
      -- 3. Autenticou no Google mas não é nem colaborador nem cliente:
      --    sai sem claim nenhum. O RLS já nega tudo nesse estado (testado).
      v_extra := '{}'::jsonb;
    end if;
  end if;

  return jsonb_set(v_claims, '{app_metadata}', v_meta || v_extra);
end;
$$;

-- O hook roda como supabase_auth_admin, que por padrão não enxerga o schema
-- da aplicação. Concede-se o mínimo: executar a função e ler as duas tabelas
-- de identidade — nada de empresa, entrega ou recibo.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token(jsonb) to supabase_auth_admin;
grant select on public.usuario, public.usuario_departamento, public.portal_acesso
  to supabase_auth_admin;

revoke execute on function public.custom_access_token(jsonb) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- Vínculo do convite do portal ao usuário do GoTrue.
--
-- O hook é `stable` (não escreve). Quem carimba o auth_user_id no aceite do
-- convite é este gatilho, disparado quando o usuário confirma o magic link.
-- ---------------------------------------------------------------------------

create or replace function public.vincular_portal_acesso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.portal_acesso
     set auth_user_id = new.id,
         aceito_em    = coalesce(aceito_em, now())
   where auth_user_id is null
     and ativo
     and email = lower(new.email);
  return new;
end;
$$;

comment on function public.vincular_portal_acesso is
  'Liga o convite de portal ao usuário do GoTrue no primeiro login confirmado.';

do $$
begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists t_vincular_portal on auth.users;
    create trigger t_vincular_portal
      after insert or update of email_confirmed_at on auth.users
      for each row
      when (new.email_confirmed_at is not null)
      execute function public.vincular_portal_acesso();
  end if;
end;
$$;
