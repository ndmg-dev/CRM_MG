-- Fase 2 — Restrição de domínio do login de colaborador.
--
-- Hoje a barreira é o provisionamento: quem não está em `usuario` sai sem
-- claims. Isto acrescenta uma segunda: mesmo provisionado, o colaborador só
-- recebe claims se o e-mail for de um domínio do escritório.
--
-- Por que no banco e não só no Google Console: o "hosted domain" do Console
-- vale para o consentimento OAuth, e nada impede que amanhã se habilite outro
-- provedor. Aqui a regra vale para qualquer caminho de autenticação.
--
-- Coluna por tenant, não constante no código: o dia que houver um segundo
-- escritório, o domínio dele é outro.

alter table tenant
  add column dominios_email text[] not null default '{}';

comment on column tenant.dominios_email is
  'Domínios aceitos no login de colaborador (sem @). Vazio = sem restrição.';

-- O valor por tenant é DADO, não schema: vive no seed / no provisionamento do
-- tenant. Migration que popula linha de negócio roda antes de a linha existir.

create or replace function app.dominio_permitido(p_tenant_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(array_length(t.dominios_email, 1), 0) = 0 then true
    else split_part(lower(p_email), '@', 2) = any(t.dominios_email)
  end
  from public.tenant t
  where t.id = p_tenant_id;
$$;

-- Reemite o hook com a checagem. O resto do corpo é idêntico ao da migration
-- 0900 — só o ramo do colaborador ganha a condição de domínio.
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

  -- Provisionado, mas logando por um e-mail fora do domínio do escritório:
  -- não recebe claims. Vale para Google e para qualquer provedor futuro.
  if found and app.dominio_permitido(r_colab.tenant_id, v_email) then
    v_extra := jsonb_build_object(
      'tenant_id',     r_colab.tenant_id,
      'perimetro',     'COLABORADOR',
      'papel',         r_colab.papel::text,
      'departamentos', r_colab.departamentos
    );

  elsif found then
    v_extra := '{}'::jsonb;

  else
    -- 2. Cliente (perímetro /portal). O domínio NÃO se aplica aqui: o cliente
    --    usa o e-mail da empresa dele. A barreira do portal é o convite.
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
      -- 3. Autenticou mas não é nem colaborador nem cliente: sai sem claim.
      v_extra := '{}'::jsonb;
    end if;
  end if;

  return jsonb_set(v_claims, '{app_metadata}', v_meta || v_extra);
end;
$$;

grant execute on function public.custom_access_token(jsonb) to supabase_auth_admin;
grant select on public.tenant to supabase_auth_admin;
revoke execute on function public.custom_access_token(jsonb) from authenticated, anon, public;
