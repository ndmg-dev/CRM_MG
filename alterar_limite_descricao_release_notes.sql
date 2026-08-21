-- Amplia o limite de description em release_notes de 1000 pra 4000
-- caracteres — rodar no Postgres do CRM (crm_mendonca_galvao).
--
-- O modelo SQLAlchemy só cria tabelas que ainda não existem
-- (Base.metadata.create_all), não altera colunas de tabelas já criadas,
-- então o ajuste de VARCHAR(1000) -> VARCHAR(4000) precisa ser manual.
--
--   psql "$DATABASE_URL_CRM" -f alterar_limite_descricao_release_notes.sql
--
-- Idempotente: ALTER COLUMN TYPE não falha se já estiver em VARCHAR(4000).

ALTER TABLE release_notes ALTER COLUMN description TYPE VARCHAR(4000);
