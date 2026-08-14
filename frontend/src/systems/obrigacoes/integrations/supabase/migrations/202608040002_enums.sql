-- Fase 1 — Tipos de domínio.
-- Enums em vez de text livre: o banco é a última linha de validação de entrada.

create type departamento as enum ('FISCAL', 'CONTABIL', 'PESSOAL');

-- INTERNA: entregável que o escritório controla mas que não é obrigação de
-- fisco nenhum (Balancete mensal, p.ex.). Sem esfera de governo, sem UF.
create type esfera as enum ('FEDERAL', 'ESTADUAL', 'MUNICIPAL', 'INTERNA');

create type periodicidade as enum (
  'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'QUADRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'EVENTUAL'
);

create type regime_tributario as enum (
  'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI', 'IMUNE_ISENTA', 'TERCEIRO_SETOR'
);

-- Contagem do prazo.
create type tipo_dia as enum ('UTIL', 'CORRIDO');

-- A partir de qual mês o dia_base é contado, relativo à competência.
create type referencia_prazo as enum (
  'MES_COMPETENCIA',      -- vence dentro do próprio mês de competência
  'MES_SEGUINTE',         -- vence no mês seguinte ao da competência (caso mais comum)
  'SEGUNDO_MES_SEGUINTE'
);

-- O que fazer quando o dia calculado cai em dia não útil.
create type ajuste_nao_util as enum ('ANTECIPA', 'POSTERGA', 'NENHUM');

-- Origem rastreada do vínculo empresa↔obrigação. Aplicar regime tributário
-- nunca sobrescreve vínculo criado por GRUPO ou MANUAL.
create type origem_vinculo as enum ('REGIME', 'GRUPO', 'MANUAL');

create type status_entrega as enum (
  'PENDENTE',
  'AGUARDANDO_CLIENTE',
  'EM_ANDAMENTO',
  'ENTREGUE',
  'ATRASADA',
  'DISPENSADA'
);

-- Como a entrega foi baixada. AUTOMATICA_RECIBO é o único caminho não humano
-- previsto (artefato do Domínio) — não existe baixa por robô de UI.
create type origem_baixa as enum ('MANUAL', 'AUTOMATICA_RECIBO');

create type papel_usuario as enum ('ADMIN', 'GESTOR', 'OPERADOR', 'LEITURA');

create type abrangencia_feriado as enum ('NACIONAL', 'ESTADUAL', 'MUNICIPAL');
