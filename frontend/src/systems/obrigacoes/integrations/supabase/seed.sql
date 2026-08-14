-- Seed de DESENVOLVIMENTO. Dados fictícios — nunca rodar em produção.
--
-- Empresas, obrigações, responsáveis, competências e prazos vêm do protótipo
-- `GestaoObrigacoes.jsx`, para que as telas portadas mostrem exatamente o que
-- já foi validado. Os códigos de obrigação seguem `_DE_PARA_OBRIGACAO` do
-- `baixa_recibo.py` — catálogo e parser precisam falar a mesma língua.
--
-- Cria DOIS tenants de propósito: o teste de RLS exigido pelo plano precisa de
-- dado de dois tenants convivendo na mesma tabela.

begin;

-- ------------------------------------------------------------------ tenants

-- dominios_email restringe o login de COLABORADOR. O tenant de controle fica
-- sem restrição de propósito, para o teste cobrir os dois caminhos.
insert into tenant (id, nome, slug, dominios_email) values
  ('11111111-1111-1111-1111-111111111111', 'Mendonça Galvão Contadores Associados', 'mg',
   array['mendoncagalvao.com.br']),
  ('22222222-2222-2222-2222-222222222222', 'Escritório Fictício (controle de RLS)', 'ctrl',
   '{}');

-- ---------------------------------------------------------------- usuários

insert into usuario (id, tenant_id, auth_user_id, nome, email, papel) values
  -- Domínio real: o tenant MG restringe login de colaborador a
  -- @mendoncagalvao.com.br (ver migration 1000).
  ('aaaa0000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'aaaa0000-0000-0000-0000-0000000000a0', 'Admin MG', 'admin@mendoncagalvao.com.br', 'ADMIN'),
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaa0001-0000-0000-0000-0000000000a1', 'Ana',      'ana@mendoncagalvao.com.br',   'OPERADOR'),
  ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaa0002-0000-0000-0000-0000000000a2', 'Bruno',    'bruno@mendoncagalvao.com.br', 'OPERADOR'),
  ('aaaa0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'aaaa0003-0000-0000-0000-0000000000a3', 'Carla',    'carla@mendoncagalvao.com.br', 'OPERADOR'),
  ('aaaa0004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'aaaa0004-0000-0000-0000-0000000000a4', 'Diego',    'diego@mendoncagalvao.com.br', 'OPERADOR'),
  ('bbbb0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'bbbb0001-0000-0000-0000-0000000000b1', 'Admin Ctrl', 'admin@ctrl.test',   'ADMIN');

-- No protótipo o responsável é só um nome; aqui vira RBAC de verdade.
insert into usuario_departamento (usuario_id, tenant_id, departamento) values
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'FISCAL'),
  ('aaaa0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'FISCAL'),
  ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'PESSOAL'),
  ('aaaa0004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'CONTABIL');

-- ---------------------------------------------------------------- empresas

-- Os CNPJs do protótipo tinham dígito verificador inválido — inclusive o
-- clássico "12.345.678/0001-90", que não passa no cálculo. Preservamos os 12
-- primeiros dígitos de cada um e corrigimos só o DV, para que continuem
-- reconhecíveis e passem na constraint `empresa_cnpj_digito_verificador`.
insert into empresa (id, tenant_id, razao_social, nome_fantasia, cnpj, regime, uf, codigo_municipio, responsavel_id) values
  ('e0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Padaria Vila Nova LTDA', 'Padaria Vila Nova', '12345678000195', 'SIMPLES_NACIONAL', 'GO', '5208707',
   'aaaa0001-0000-0000-0000-000000000001'),
  ('e0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Transportes Serra Azul LTDA', 'Transportes Serra Azul', '98765432000198', 'LUCRO_PRESUMIDO', 'GO', '5208707',
   'aaaa0001-0000-0000-0000-000000000001'),
  ('e0000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Clínica Bem Estar LTDA', 'Clínica Bem Estar', '45612789000170', 'LUCRO_PRESUMIDO', 'GO', '5208707',
   'aaaa0003-0000-0000-0000-000000000003'),
  ('e0000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Metalúrgica Ponto Certo LTDA', 'Metalúrgica Ponto Certo', '33221100000105', 'LUCRO_REAL', 'GO', '5208707',
   'aaaa0001-0000-0000-0000-000000000001'),
  -- empresa do outro tenant: nenhuma sessão MG pode enxergá-la
  ('e0000009-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222',
   'Delta Vizinha LTDA', 'Delta', '99000111000165', 'SIMPLES_NACIONAL', 'SP', '3550308', null);

-- --------------------------------------------------------------- catálogo

insert into obrigacao (id, tenant_id, codigo, nome, departamento, esfera, periodicidade, uf) values
  ('0b000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'DAS',           'DAS — Simples Nacional',   'FISCAL',   'FEDERAL',   'MENSAL', null),
  ('0b000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'PGDAS_D',       'PGDAS-D',                  'FISCAL',   'FEDERAL',   'MENSAL', null),
  ('0b000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'DCTFWEB',       'DCTFWeb',                  'FISCAL',   'FEDERAL',   'MENSAL', null),
  ('0b000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'EFD_CONTRIB',   'EFD Contribuições',        'FISCAL',   'FEDERAL',   'MENSAL', null),
  ('0b000005-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'EFD_ICMS_IPI',  'EFD ICMS/IPI',             'FISCAL',   'ESTADUAL',  'MENSAL', 'GO'),
  ('0b000006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
   'ESOCIAL_FOLHA', 'eSocial — Folha',          'PESSOAL',  'FEDERAL',   'MENSAL', null),
  ('0b000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
   'BALANCETE',     'Balancete mensal',         'CONTABIL', 'INTERNA',   'MENSAL', null),
  ('0b000009-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222',
   'DAS',           'DAS — Simples Nacional',   'FISCAL',   'FEDERAL',   'MENSAL', null);

-- Regras de prazo. Os parâmetros foram inferidos dos vencimentos do protótipo
-- (competência 07/2026 vencendo em agosto/2026) — CONFERIR contra a legislação
-- antes de gerar entrega real; o protótipo era ilustrativo.
-- Versionadas: quando mudarem, fecha-se a vigência e insere-se nova linha.
insert into obrigacao_prazo (tenant_id, obrigacao_id, tipo_dia, dia_base, referencia, ajuste, sabado_e_util, vigencia_inicio) values
  ('11111111-1111-1111-1111-111111111111', '0b000001-0000-0000-0000-000000000001',
   'CORRIDO', 20, 'MES_SEGUINTE',         'POSTERGA', false, '2024-01-01'),  -- DAS      -> 20/08
  ('11111111-1111-1111-1111-111111111111', '0b000002-0000-0000-0000-000000000002',
   'CORRIDO', 20, 'MES_SEGUINTE',         'POSTERGA', false, '2024-01-01'),  -- PGDAS-D  -> 20/08
  ('11111111-1111-1111-1111-111111111111', '0b000003-0000-0000-0000-000000000003',
   'CORRIDO', 15, 'MES_SEGUINTE',         'ANTECIPA', false, '2024-01-01'),  -- DCTFWeb  -> 15/08
  ('11111111-1111-1111-1111-111111111111', '0b000004-0000-0000-0000-000000000004',
   'UTIL',    10, 'SEGUNDO_MES_SEGUINTE', 'NENHUM',   false, '2024-01-01'),  -- EFD Contrib: comp 06 -> 14/08
  ('11111111-1111-1111-1111-111111111111', '0b000005-0000-0000-0000-000000000005',
   'CORRIDO', 10, 'MES_SEGUINTE',         'POSTERGA', false, '2024-01-01'),  -- EFD ICMS -> 10/08
  ('11111111-1111-1111-1111-111111111111', '0b000006-0000-0000-0000-000000000006',
   'CORRIDO',  7, 'MES_SEGUINTE',         'ANTECIPA', false, '2024-01-01'),  -- eSocial  -> 07/08
  ('11111111-1111-1111-1111-111111111111', '0b000007-0000-0000-0000-000000000007',
   'CORRIDO', 25, 'MES_SEGUINTE',         'POSTERGA', false, '2024-01-01');  -- Balancete-> 25/08

insert into feriado (tenant_id, data, nome, abrangencia) values
  ('11111111-1111-1111-1111-111111111111', '2026-01-01', 'Confraternização Universal', 'NACIONAL'),
  ('11111111-1111-1111-1111-111111111111', '2026-04-21', 'Tiradentes',                 'NACIONAL'),
  ('11111111-1111-1111-1111-111111111111', '2026-05-01', 'Dia do Trabalho',            'NACIONAL'),
  ('11111111-1111-1111-1111-111111111111', '2026-09-07', 'Independência',              'NACIONAL'),
  ('11111111-1111-1111-1111-111111111111', '2026-10-12', 'Nossa Senhora Aparecida',    'NACIONAL'),
  ('11111111-1111-1111-1111-111111111111', '2026-11-02', 'Finados',                    'NACIONAL'),
  ('11111111-1111-1111-1111-111111111111', '2026-11-15', 'Proclamação da República',   'NACIONAL'),
  ('11111111-1111-1111-1111-111111111111', '2026-12-25', 'Natal',                      'NACIONAL');

insert into feriado (tenant_id, data, nome, abrangencia, uf, codigo_municipio) values
  ('11111111-1111-1111-1111-111111111111', '2026-10-24', 'Aniversário de Goiânia', 'MUNICIPAL', 'GO', '5208707');

-- ----------------------------------------------------------- parametrização

-- 13 vínculos, espelhando o `seed` do protótipo.
insert into empresa_obrigacao (tenant_id, empresa_id, obrigacao_id, origem, origem_ref, inicio, responsavel_id)
select '11111111-1111-1111-1111-111111111111', v.empresa_id, v.obrigacao_id, v.origem::origem_vinculo,
       v.origem_ref, date '2026-01-01', v.responsavel_id
from (values
  ('e0000001-0000-0000-0000-000000000001'::uuid, '0b000001-0000-0000-0000-000000000001'::uuid, 'REGIME', 'SIMPLES_NACIONAL', 'aaaa0001-0000-0000-0000-000000000001'::uuid),
  ('e0000001-0000-0000-0000-000000000001',       '0b000002-0000-0000-0000-000000000002',       'REGIME', 'SIMPLES_NACIONAL', 'aaaa0001-0000-0000-0000-000000000001'),
  ('e0000001-0000-0000-0000-000000000001',       '0b000006-0000-0000-0000-000000000006',       'MANUAL', null,               'aaaa0002-0000-0000-0000-000000000002'),
  ('e0000002-0000-0000-0000-000000000002',       '0b000004-0000-0000-0000-000000000004',       'REGIME', 'LUCRO_PRESUMIDO',  'aaaa0001-0000-0000-0000-000000000001'),
  ('e0000002-0000-0000-0000-000000000002',       '0b000003-0000-0000-0000-000000000003',       'REGIME', 'LUCRO_PRESUMIDO',  'aaaa0003-0000-0000-0000-000000000003'),
  ('e0000002-0000-0000-0000-000000000002',       '0b000007-0000-0000-0000-000000000007',       'MANUAL', null,               'aaaa0004-0000-0000-0000-000000000004'),
  ('e0000003-0000-0000-0000-000000000003',       '0b000003-0000-0000-0000-000000000003',       'REGIME', 'LUCRO_PRESUMIDO',  'aaaa0003-0000-0000-0000-000000000003'),
  ('e0000003-0000-0000-0000-000000000003',       '0b000006-0000-0000-0000-000000000006',       'MANUAL', null,               'aaaa0002-0000-0000-0000-000000000002'),
  ('e0000003-0000-0000-0000-000000000003',       '0b000007-0000-0000-0000-000000000007',       'MANUAL', null,               'aaaa0004-0000-0000-0000-000000000004'),
  ('e0000004-0000-0000-0000-000000000004',       '0b000005-0000-0000-0000-000000000005',       'MANUAL', null,               'aaaa0001-0000-0000-0000-000000000001'),
  ('e0000004-0000-0000-0000-000000000004',       '0b000004-0000-0000-0000-000000000004',       'REGIME', 'LUCRO_REAL',       'aaaa0001-0000-0000-0000-000000000001'),
  ('e0000004-0000-0000-0000-000000000004',       '0b000007-0000-0000-0000-000000000007',       'MANUAL', null,               'aaaa0004-0000-0000-0000-000000000004'),
  ('e0000004-0000-0000-0000-000000000004',       '0b000006-0000-0000-0000-000000000006',       'MANUAL', null,               'aaaa0002-0000-0000-0000-000000000002')
) as v(empresa_id, obrigacao_id, origem, origem_ref, responsavel_id);

-- ---------------------------------------------------------------- entregas

-- Em produção quem cria isto é o job mensal da Fase 3. Aqui é seed de tela,
-- com os mesmos status/prazos do protótipo (data de referência: 03/08/2026).
insert into entrega (tenant_id, empresa_id, obrigacao_id, empresa_obrigacao_id,
                     competencia, vencimento, prazo_id, status, responsavel_id,
                     entregue_em, origem_baixa, anexo_nome)
select
  eo.tenant_id, eo.empresa_id, eo.obrigacao_id, eo.id,
  v.competencia, v.vencimento,
  (select p.id from obrigacao_prazo p where p.obrigacao_id = eo.obrigacao_id limit 1),
  v.status::status_entrega, eo.responsavel_id,
  case when v.status = 'ENTREGUE' then v.vencimento - 1 else null end,
  case when v.status = 'ENTREGUE' then 'MANUAL'::origem_baixa else null end,
  case when v.status = 'ENTREGUE' then 'recibo.pdf' else null end
from (values
  ('e0000001-0000-0000-0000-000000000001'::uuid, '0b000001-0000-0000-0000-000000000001'::uuid, date '2026-07-01', date '2026-08-20', 'PENDENTE'),
  ('e0000001-0000-0000-0000-000000000001',       '0b000002-0000-0000-0000-000000000002',       '2026-07-01', '2026-08-20', 'PENDENTE'),
  ('e0000001-0000-0000-0000-000000000001',       '0b000006-0000-0000-0000-000000000006',       '2026-07-01', '2026-08-07', 'ATRASADA'),
  ('e0000002-0000-0000-0000-000000000002',       '0b000004-0000-0000-0000-000000000004',       '2026-06-01', '2026-08-14', 'PENDENTE'),
  ('e0000002-0000-0000-0000-000000000002',       '0b000003-0000-0000-0000-000000000003',       '2026-07-01', '2026-08-15', 'PENDENTE'),
  ('e0000002-0000-0000-0000-000000000002',       '0b000007-0000-0000-0000-000000000007',       '2026-07-01', '2026-08-25', 'PENDENTE'),
  ('e0000003-0000-0000-0000-000000000003',       '0b000003-0000-0000-0000-000000000003',       '2026-07-01', '2026-08-15', 'ENTREGUE'),
  ('e0000003-0000-0000-0000-000000000003',       '0b000006-0000-0000-0000-000000000006',       '2026-07-01', '2026-08-07', 'ENTREGUE'),
  ('e0000003-0000-0000-0000-000000000003',       '0b000007-0000-0000-0000-000000000007',       '2026-07-01', '2026-08-25', 'PENDENTE'),
  ('e0000004-0000-0000-0000-000000000004',       '0b000005-0000-0000-0000-000000000005',       '2026-07-01', '2026-08-10', 'PENDENTE'),
  ('e0000004-0000-0000-0000-000000000004',       '0b000004-0000-0000-0000-000000000004',       '2026-06-01', '2026-07-14', 'ATRASADA'),
  ('e0000004-0000-0000-0000-000000000004',       '0b000007-0000-0000-0000-000000000007',       '2026-07-01', '2026-08-25', 'PENDENTE'),
  ('e0000004-0000-0000-0000-000000000004',       '0b000006-0000-0000-0000-000000000006',       '2026-07-01', '2026-08-07', 'ENTREGUE')
) as v(empresa_id, obrigacao_id, competencia, vencimento, status)
join empresa_obrigacao eo
  on eo.empresa_id = v.empresa_id and eo.obrigacao_id = v.obrigacao_id and eo.ativa;

-- ------------------------------------------------------- acesso ao portal

insert into portal_acesso (id, tenant_id, empresa_id, email, nome) values
  ('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'e0000001-0000-0000-0000-000000000001', 'financeiro@vilanova.test', 'Financeiro Vila Nova');

-- ------------------------------------------------------- baixa por recibo

insert into pasta_monitorada (tenant_id, caminho) values
  ('11111111-1111-1111-1111-111111111111', 'C:\MG\Dominio\Recibos');

-- Item na fila de revisão: CNPJ que não existe na base. Contém dado fiscal,
-- então o teste de RLS confere que o portal do cliente não o enxerga.
insert into recibo_revisao (tenant_id, hash_arquivo, storage_path, motivo,
                            cnpj_lido, codigo_obrigacao_lido, competencia_lida) values
  ('11111111-1111-1111-1111-111111111111',
   repeat('a', 64), 'recibos/11111111/aaaa.pdf', 'empresa_nao_encontrada',
   '00.111.222/0001-33', 'DCTFWEB', '07/2026');

-- ------------------------------------------------------- política LGPD

insert into politica_privacidade (id, tenant_id, versao, texto, vigente) values
  ('f0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '2026-08-01',
   'Tratamos os dados da sua empresa exclusivamente para a execução dos serviços '
   || 'contábeis contratados, incluindo a apuração e a entrega de obrigações acessórias. '
   || 'Os documentos enviados por este portal ficam armazenados em ambiente privado, '
   || 'acessíveis apenas à sua empresa e aos colaboradores responsáveis pelo seu '
   || 'atendimento. Não compartilhamos seus dados com terceiros além do exigido por '
   || 'obrigação legal ou regulatória. O espelho dos documentos é mantido por 12 meses; '
   || 'o arquivo original permanece sob sua guarda.',
   true);

-- ------------------------------------------------- de-para do parser

-- Só a DCTFWeb, de propósito: o plano manda começar por UM tipo de recibo, o
-- de maior volume, validar contra arquivos reais do Domínio e só então
-- expandir. Recibo cujo termo não estiver aqui vai para revisão manual — que
-- é o comportamento certo enquanto não há certeza.
insert into recibo_termo (tenant_id, obrigacao_id, termo)
select o.tenant_id, o.id, t.termo
from obrigacao o
cross join (values
  ('dctfweb'),
  ('declaração de débitos e créditos tributários federais')
) as t(termo)
where o.codigo = 'DCTFWEB'
  and o.tenant_id = '11111111-1111-1111-1111-111111111111';

commit;
