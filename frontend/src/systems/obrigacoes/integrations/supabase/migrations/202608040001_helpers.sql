-- Fase 1 — Fundação: schema auxiliar e funções de contexto de sessão.
--
-- Regra não negociável: tenant_id nunca vem do client. Estas funções são a
-- única fonte de verdade sobre "quem é o requisitante", lendo exclusivamente
-- os claims assinados do JWT. Toda policy de RLS depende delas.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create schema if not exists app;
comment on schema app is 'Funções internas de contexto de sessão e utilitários. Não expor via PostgREST.';

revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

-- Claims ficam em app_metadata: o usuário não consegue alterá-los pelo client
-- (user_metadata seria editável pelo próprio usuário — nunca usar para autorização).
create or replace function app.jwt_claim(claim text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(
    coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> claim, ''),
    ''
  );
$$;

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app.jwt_claim('tenant_id')::uuid;
$$;

-- 'COLABORADOR' (perímetro /app) ou 'CLIENTE' (perímetro /portal).
create or replace function app.current_perimetro()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.jwt_claim('perimetro'), 'NENHUM');
$$;

create or replace function app.is_colaborador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.current_perimetro() = 'COLABORADOR' and app.current_tenant_id() is not null;
$$;

-- Empresa do usuário-cliente. Null para colaborador. Jamais aceitar este valor
-- por parâmetro de rota ou query string — só daqui.
create or replace function app.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.current_perimetro() = 'CLIENTE' then app.jwt_claim('empresa_id')::uuid
    else null
  end;
$$;

create or replace function app.is_cliente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.current_perimetro() = 'CLIENTE'
     and app.current_tenant_id() is not null
     and app.current_empresa_id() is not null;
$$;

-- Departamentos que o colaborador administra (RBAC da Fase 1).
create or replace function app.departamentos_do_usuario()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array(
      select jsonb_array_elements_text(
        coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' -> 'departamentos', '[]'::jsonb)
      )
    ),
    array[]::text[]
  );
$$;

create or replace function app.pode_departamento(dep text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_colaborador()
     and (app.jwt_claim('papel') = 'ADMIN' or dep = any(app.departamentos_do_usuario()));
$$;

-- Gatilho de auditoria mínima, sem dado pessoal (LGPD por minimização).
create or replace function app.touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
