-- Fase 3 — Testes do motor de prazo e da geração de entregas.
--
-- Todas as datas esperadas foram conferidas contra o calendário de 2026
-- (dia da semana verificado no proprio Postgres, nao deduzido de cabeca).
-- Sem saída = passou.

begin;

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALHOU: %', msg; end if;
end;
$$;

create or replace function pg_temp.eq(obtido date, esperado date, msg text)
returns void language plpgsql as $$
begin
  if obtido is distinct from esperado then
    raise exception 'FALHOU: % — esperado %, obtido %', msg, esperado, obtido;
  end if;
end;
$$;

-- Feriados nacionais de 2026 usados nos casos abaixo.
create or replace function pg_temp.fer() returns date[] language sql immutable as $$
  select array['2026-01-01','2026-04-21','2026-05-01','2026-09-07',
               '2026-10-12','2026-11-02','2026-11-15','2026-12-25']::date[];
$$;

-- ------------------------------------------------------- 1. eh_dia_util

select pg_temp.assert(    eh_dia_util('2026-08-20', pg_temp.fer()), 'quinta-feira comum é dia útil');
select pg_temp.assert(not eh_dia_util('2026-08-15', pg_temp.fer()), 'sábado não é útil por padrão');
select pg_temp.assert(    eh_dia_util('2026-08-15', pg_temp.fer(), true), 'sábado é útil quando a regra diz que é');
select pg_temp.assert(not eh_dia_util('2026-08-16', pg_temp.fer(), true), 'domingo nunca é útil, nem com sabado_e_util');
select pg_temp.assert(not eh_dia_util('2026-09-07', pg_temp.fer()), 'feriado nacional em segunda-feira não é útil');

-- ------------------------------- 2. dia CORRIDO, sem necessidade de ajuste

-- DAS, competência 07/2026: dia 20 do mês seguinte = 20/08/2026 (quinta).
select pg_temp.eq(
  calcula_prazo('CORRIDO', 20, 'MES_SEGUINTE', 'POSTERGA', false, '2026-07-01', pg_temp.fer()),
  '2026-08-20', 'DAS 07/2026');

-- eSocial, competência 07/2026: dia 7 de agosto = sexta.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 7, 'MES_SEGUINTE', 'ANTECIPA', false, '2026-07-01', pg_temp.fer()),
  '2026-08-07', 'eSocial 07/2026');

-- ---------------------------------------------- 3. ajuste em fim de semana

-- DCTFWeb, competência 07/2026: dia 15/08/2026 cai SÁBADO -> antecipa 14 (sexta).
select pg_temp.eq(
  calcula_prazo('CORRIDO', 15, 'MES_SEGUINTE', 'ANTECIPA', false, '2026-07-01', pg_temp.fer()),
  '2026-08-14', 'DCTFWeb 07/2026 deve antecipar do sábado para a sexta');

-- Mesma data, regra que posterga: vai para segunda 17.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 15, 'MES_SEGUINTE', 'POSTERGA', false, '2026-07-01', pg_temp.fer()),
  '2026-08-17', 'POSTERGA deve pular o fim de semana inteiro');

-- E a regra que não ajusta mantém o sábado.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 15, 'MES_SEGUINTE', 'NENHUM', false, '2026-07-01', pg_temp.fer()),
  '2026-08-15', 'NENHUM não pode mexer na data');

-- DAS, competência 08/2026: 20/09/2026 é DOMINGO -> posterga para 21 (segunda).
select pg_temp.eq(
  calcula_prazo('CORRIDO', 20, 'MES_SEGUINTE', 'POSTERGA', false, '2026-08-01', pg_temp.fer()),
  '2026-09-21', 'DAS 08/2026 deve postergar do domingo para a segunda');

-- ---------------------------------------------------- 4. ajuste em feriado

-- eSocial, competência 08/2026: 07/09 é segunda E feriado (Independência).
-- Antecipa para sexta 04/09 — pula o feriado e o fim de semana atrás dele.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 7, 'MES_SEGUINTE', 'ANTECIPA', false, '2026-08-01', pg_temp.fer()),
  '2026-09-04', 'feriado na segunda deve antecipar até a sexta anterior');

-- Sem o feriado na lista, a mesma conta pararia na própria segunda.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 7, 'MES_SEGUINTE', 'ANTECIPA', false, '2026-08-01', '{}'::date[]),
  '2026-09-07', 'sem feriado carregado, 07/09 seria dia útil — prova que a lista importa');

-- Feriado municipal entra na conta como qualquer outro.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 26, 'MES_SEGUINTE', 'POSTERGA', false, '2026-09-01',
                array['2026-10-26']::date[]),
  '2026-10-27', 'feriado municipal na segunda deve empurrar para terça');

-- ------------------------------------------------------- 5. dia ÚTIL

-- EFD Contribuições, competência 06/2026: 10º dia útil do SEGUNDO mês
-- seguinte. Agosto/2026 começa sábado; os úteis são 3,4,5,6,7,10,11,12,13,14.
select pg_temp.eq(
  calcula_prazo('UTIL', 10, 'SEGUNDO_MES_SEGUINTE', 'NENHUM', false, '2026-06-01', pg_temp.fer()),
  '2026-08-14', 'EFD Contribuições 06/2026 = 10º dia útil de agosto');

-- 1º dia útil de agosto/2026 é segunda 03, não o sábado 01.
select pg_temp.eq(
  calcula_prazo('UTIL', 1, 'MES_SEGUINTE', 'NENHUM', false, '2026-07-01', pg_temp.fer()),
  '2026-08-03', 'contagem de dia útil não pode começar no sábado');

-- Com sábado valendo como útil, o mesmo 1º dia útil vira 01/08.
select pg_temp.eq(
  calcula_prazo('UTIL', 1, 'MES_SEGUINTE', 'NENHUM', true, '2026-07-01', pg_temp.fer()),
  '2026-08-01', 'sabado_e_util deve mudar a contagem de dia útil');

-- Feriado não conta como dia útil: setembro/2026 tem 07 (seg) feriado.
-- Úteis: 1,2,3,4,(5-6 fds),8,9,10,11 -> 8º = 11/09.
select pg_temp.eq(
  calcula_prazo('UTIL', 8, 'MES_COMPETENCIA', 'NENHUM', false, '2026-09-01', pg_temp.fer()),
  '2026-09-11', 'feriado não pode ser contado como dia útil');

-- Pedir mais dias úteis do que o mês tem cai no último útil, sem vazar de mês.
select pg_temp.eq(
  calcula_prazo('UTIL', 99, 'MES_COMPETENCIA', 'NENHUM', false, '2026-08-01', pg_temp.fer()),
  '2026-08-31', 'dia útil além do fim do mês deve parar no último útil');

-- ------------------------------------------------- 6. bordas de calendário

-- Dia 31 em mês de 30 dias não pode virar 01 do mês seguinte.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 31, 'MES_SEGUINTE', 'NENHUM', false, '2026-03-01', pg_temp.fer()),
  '2026-04-30', 'dia 31 em abril deve cair no dia 30');

-- Fevereiro de ano não bissexto.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 30, 'MES_SEGUINTE', 'NENHUM', false, '2026-01-01', pg_temp.fer()),
  '2026-02-28', 'dia 30 em fevereiro/2026 deve cair no dia 28');

-- Virada de ano: competência 12/2026 vence em janeiro/2027, e 01/01 é feriado.
select pg_temp.eq(
  calcula_prazo('CORRIDO', 1, 'MES_SEGUINTE', 'POSTERGA', false, '2026-12-01',
                array['2027-01-01']::date[]),
  '2027-01-04', 'competência de dezembro deve atravessar o ano corretamente');

-- ------------------------------------------------------- 7. periodicidade

select pg_temp.assert(    competencia_casa('MENSAL',     '2026-07-01'), 'mensal vale todo mês');
select pg_temp.assert(    competencia_casa('TRIMESTRAL', '2026-09-01'), 'trimestral vale em setembro');
select pg_temp.assert(not competencia_casa('TRIMESTRAL', '2026-07-01'), 'trimestral não vale em julho');
select pg_temp.assert(    competencia_casa('ANUAL',      '2026-12-01'), 'anual vale em dezembro');
select pg_temp.assert(not competencia_casa('ANUAL',      '2026-07-01'), 'anual não vale em julho');
select pg_temp.assert(not competencia_casa('EVENTUAL',   '2026-07-01'), 'eventual nunca é gerada pelo job');

-- --------------------------------------------- 8. feriados_da_empresa

-- Padaria Vila Nova é de Goiânia/GO: pega nacional + municipal de Goiânia.
select pg_temp.assert(
  '2026-10-24' = any(feriados_da_empresa('e0000001-0000-0000-0000-000000000001')),
  'empresa de Goiânia deveria receber o feriado municipal de Goiânia'
);

select pg_temp.assert(
  '2026-09-07' = any(feriados_da_empresa('e0000001-0000-0000-0000-000000000001')),
  'toda empresa deveria receber os feriados nacionais'
);

-- Empresa do outro tenant não herda feriado da MG.
select pg_temp.assert(
  not ('2026-10-24' = any(feriados_da_empresa('e0000009-0000-0000-0000-000000000009'))),
  'feriado não pode atravessar tenant'
);

-- ------------------------------------------------------ 9. gerar_entregas

-- Competência nova (09/2026): o seed não tem nenhuma entrega dela.
select pg_temp.assert(
  (select criadas from gerar_entregas('11111111-1111-1111-1111-111111111111', '2026-09-01')) = 13,
  'primeira execução deveria criar as 13 entregas da competência'
);

-- Rodar de novo não duplica e não "atualiza" nada — idempotência de verdade.
select pg_temp.assert(
  (select criadas + atualizadas from gerar_entregas('11111111-1111-1111-1111-111111111111', '2026-09-01')) = 0,
  'segunda execução não pode criar nem alterar nada'
);

select pg_temp.assert(
  (select count(*) from entrega where competencia = '2026-09-01') = 13,
  'não pode haver entrega duplicada por (empresa, obrigação, competência)'
);

-- O job usou a regra certa: DAS 09/2026 vence 20/10/2026 (terça).
select pg_temp.eq(
  (select vencimento from entrega
    where competencia = '2026-09-01'
      and empresa_id = 'e0000001-0000-0000-0000-000000000001'
      and obrigacao_id = '0b000001-0000-0000-0000-000000000001'),
  '2026-10-20', 'vencimento do DAS 09/2026 gerado pelo job');

-- Não gera para tenant errado.
select pg_temp.assert(
  (select count(*) from entrega e join empresa em on em.id = e.empresa_id
    where e.competencia = '2026-09-01'
      and em.tenant_id <> '11111111-1111-1111-1111-111111111111') = 0,
  'job não pode gerar entrega fora do tenant pedido'
);

-- ------------------------------- 10. reprocessamento não reescreve história

-- Marca uma entrega como ENTREGUE e força um vencimento diferente.
update entrega
   set status = 'ENTREGUE', entregue_em = now(), origem_baixa = 'MANUAL',
       vencimento = '2026-10-01'
 where competencia = '2026-09-01'
   and empresa_id = 'e0000001-0000-0000-0000-000000000001'
   and obrigacao_id = '0b000001-0000-0000-0000-000000000001';

select gerar_entregas('11111111-1111-1111-1111-111111111111', '2026-09-01');

select pg_temp.eq(
  (select vencimento from entrega
    where competencia = '2026-09-01'
      and empresa_id = 'e0000001-0000-0000-0000-000000000001'
      and obrigacao_id = '0b000001-0000-0000-0000-000000000001'),
  '2026-10-01', 'reprocessar NÃO pode recalcular vencimento de entrega já ENTREGUE');

-- Já uma pendente com vencimento errado é corrigida.
update entrega set vencimento = '2026-01-01'
 where competencia = '2026-09-01'
   and empresa_id = 'e0000002-0000-0000-0000-000000000002'
   and obrigacao_id = '0b000003-0000-0000-0000-000000000003';

select pg_temp.assert(
  (select atualizadas from gerar_entregas('11111111-1111-1111-1111-111111111111', '2026-09-01')) = 1,
  'reprocessar deveria corrigir exatamente a entrega pendente adulterada'
);

-- ------------------------------- 11. regra versionada e retroatividade

-- Nova versão do DAS a partir de 10/2026: dia 25 em vez de 20.
update obrigacao_prazo set vigencia_fim = '2026-09-30'
 where obrigacao_id = '0b000001-0000-0000-0000-000000000001' and vigencia_fim is null;

insert into obrigacao_prazo (tenant_id, obrigacao_id, tipo_dia, dia_base, referencia, ajuste, sabado_e_util, vigencia_inicio)
values ('11111111-1111-1111-1111-111111111111', '0b000001-0000-0000-0000-000000000001',
        'CORRIDO', 25, 'MES_SEGUINTE', 'POSTERGA', false, '2026-10-01');

-- Competência 10/2026 usa a regra nova: 25/11/2026 (quarta).
select gerar_entregas('11111111-1111-1111-1111-111111111111', '2026-10-01');
select pg_temp.eq(
  (select vencimento from entrega
    where competencia = '2026-10-01'
      and empresa_id = 'e0000001-0000-0000-0000-000000000001'
      and obrigacao_id = '0b000001-0000-0000-0000-000000000001'),
  '2026-11-25', 'competência posterior deve usar a regra nova');

-- E o reprocessamento de uma competência ANTIGA continua usando a regra antiga.
-- Este é o ponto inteiro de versionar a regra em vez de editá-la.
update entrega set vencimento = '2026-01-01'
 where competencia = '2026-09-01'
   and empresa_id = 'e0000001-0000-0000-0000-000000000001'
   and obrigacao_id = '0b000001-0000-0000-0000-000000000001'
   and status <> 'ENTREGUE';

update entrega set status = 'PENDENTE', entregue_em = null, origem_baixa = null,
                   vencimento = '2026-01-01'
 where competencia = '2026-09-01'
   and empresa_id = 'e0000001-0000-0000-0000-000000000001'
   and obrigacao_id = '0b000001-0000-0000-0000-000000000001';

select gerar_entregas('11111111-1111-1111-1111-111111111111', '2026-09-01');
select pg_temp.eq(
  (select vencimento from entrega
    where competencia = '2026-09-01'
      and empresa_id = 'e0000001-0000-0000-0000-000000000001'
      and obrigacao_id = '0b000001-0000-0000-0000-000000000001'),
  '2026-10-20', 'reprocessar competência antiga deve usar a regra vigente NAQUELA competência');

-- ------------------------------------------------ 12. reprocessar_entregas

select pg_temp.assert(
  (select count(*) from reprocessar_entregas('11111111-1111-1111-1111-111111111111',
                                             '2026-11-01', '2027-01-01')) = 3,
  'reprocessar deveria percorrer as 3 competências do intervalo'
);

do $$
begin
  begin
    perform reprocessar_entregas('11111111-1111-1111-1111-111111111111', '2026-12-01', '2026-10-01');
    raise exception 'FALHOU: intervalo invertido deveria ser rejeitado';
  exception when others then
    if sqlerrm like 'FALHOU:%' then raise; end if;
  end;
end;
$$;

rollback;
