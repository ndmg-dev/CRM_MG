-- Visibilidade de sistemas por usuário — rodar no Postgres do CRM
-- (crm_mendonca_galvao) ANTES de subir o backend com esta versão.
--
--   psql "$DATABASE_URL_CRM" -f migracao_visibilidade_por_usuario.sql
--
-- Por que SQL e não migration: o Alembic está configurado mas sem nenhuma
-- revisão, e o container do backend sobe direto no uvicorn, sem
-- `alembic upgrade`. O `Base.metadata.create_all` do main.py cria tabelas que
-- faltam, mas NÃO acrescenta coluna em tabela que já existe — então sem este
-- script o backend novo quebra ao consultar `usuarios`.
--
-- Idempotente e sem downtime de dados: o DEFAULT preenche as linhas
-- existentes, e 'SETOR' é exatamente o comportamento que elas já tinham.

alter table public.usuarios
  add column if not exists visibilidade_sistemas varchar(20) not null default 'SETOR';

-- Rede de segurança: qualquer valor fora do enum viraria comportamento
-- indefinido no visibility_service.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usuarios_visibilidade_sistemas_check'
  ) then
    alter table public.usuarios
      add constraint usuarios_visibilidade_sistemas_check
      check (visibilidade_sistemas in ('SETOR', 'INDIVIDUAL'));
  end if;
end $$;

-- Conferência:
--   select visibilidade_sistemas, count(*) from public.usuarios group by 1;
