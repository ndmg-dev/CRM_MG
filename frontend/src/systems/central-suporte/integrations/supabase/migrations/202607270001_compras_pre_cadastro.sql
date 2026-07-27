-- Central de Suporte: setor Compras + pré-cadastro seguro de usuários.
-- Executar no SQL Editor do Supabase da Central de Suporte.

insert into public.sectors (name)
select 'Compras'
where not exists (
  select 1 from public.sectors where lower(btrim(name)) = 'compras'
);

create table if not exists public.support_user_pre_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  sector_id uuid references public.sectors(id) on delete set null,
  roles public.app_role[] not null default array['user'::public.app_role],
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  constraint support_user_pre_registrations_email_normalized
    check (email = lower(btrim(email)))
);

alter table public.support_user_pre_registrations enable row level security;
revoke all on public.support_user_pre_registrations from anon, authenticated;

create or replace function public.admin_pre_register_support_user(
  _email text,
  _full_name text,
  _sector_id uuid,
  _roles public.app_role[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(_email));
  v_name text := btrim(_full_name);
  v_roles public.app_role[] := coalesce(_roles, array['user'::public.app_role]);
begin
  if auth.uid() is null
     or not (
       public.has_role(auth.uid(), 'admin_ti'::public.app_role)
       or public.is_direction(auth.uid())
     ) then
    raise exception 'Sem permissão para pré-cadastrar usuários';
  end if;
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail inválido';
  end if;
  if v_email not like '%@mendoncagalvao.com.br' then
    raise exception 'Use um e-mail corporativo @mendoncagalvao.com.br';
  end if;
  if v_name = '' then raise exception 'Nome completo é obrigatório'; end if;
  if cardinality(v_roles) = 0 then raise exception 'Selecione ao menos um perfil'; end if;
  if _sector_id is not null
     and not exists (select 1 from public.sectors where id = _sector_id) then
    raise exception 'Setor inexistente';
  end if;
  if exists (select 1 from public.profiles where lower(email) = v_email) then
    raise exception 'Este usuário já possui cadastro na Central';
  end if;

  insert into public.support_user_pre_registrations (
    email, full_name, sector_id, roles, created_by, claimed_by, claimed_at
  ) values (
    v_email, v_name, _sector_id, v_roles, auth.uid(), null, null
  )
  on conflict (email) do update
    set full_name = excluded.full_name,
        sector_id = excluded.sector_id,
        roles = excluded.roles,
        created_by = excluded.created_by,
        created_at = now(),
        claimed_by = null,
        claimed_at = null;
end;
$$;

grant execute on function public.admin_pre_register_support_user(
  text, text, uuid, public.app_role[]
) to authenticated;

create or replace function public.ensure_support_user_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_name text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    split_part(v_email, '@', 1)
  );
  v_pre public.support_user_pre_registrations%rowtype;
  v_role public.app_role;
begin
  if v_user_id is null or v_email = '' then raise exception 'Sessão inválida'; end if;
  if v_email not like '%@mendoncagalvao.com.br' then
    raise exception 'Acesso restrito ao domínio mendoncagalvao.com.br';
  end if;

  select * into v_pre
    from public.support_user_pre_registrations
   where email = v_email and claimed_at is null
   for update;

  insert into public.profiles (id, email, full_name, sector_id)
  values (
    v_user_id, v_email, coalesce(nullif(v_pre.full_name, ''), v_name), v_pre.sector_id
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when v_pre.id is not null then excluded.full_name
          else coalesce(public.profiles.full_name, excluded.full_name)
        end,
        sector_id = case
          when v_pre.id is not null then excluded.sector_id
          else public.profiles.sector_id
        end,
        updated_at = now();

  if v_pre.id is not null then
    delete from public.user_roles where user_id = v_user_id;
    foreach v_role in array v_pre.roles loop
      insert into public.user_roles (user_id, role) values (v_user_id, v_role);
    end loop;
    update public.support_user_pre_registrations
       set claimed_by = v_user_id, claimed_at = now()
     where id = v_pre.id;
  elsif not exists (select 1 from public.user_roles where user_id = v_user_id) then
    insert into public.user_roles (user_id, role)
    values (v_user_id, 'user'::public.app_role);
  end if;
end;
$$;

grant execute on function public.ensure_support_user_profile() to authenticated;
