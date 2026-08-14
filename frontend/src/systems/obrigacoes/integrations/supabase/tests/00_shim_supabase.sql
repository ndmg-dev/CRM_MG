-- Stub mínimo do ambiente Supabase, para validar as migrations num Postgres puro.
-- NÃO faz parte das migrations — só é carregado pelo harness de teste local.
-- Em produção, quem fornece o schema auth e os roles é o próprio Supabase.

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- Recorte de auth.users suficiente para exercitar o hook e o gatilho de
-- vínculo do portal. O GoTrue real tem dezenas de colunas a mais.
create table if not exists auth.users (
  id                 uuid primary key,
  email              text,
  email_confirmed_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
