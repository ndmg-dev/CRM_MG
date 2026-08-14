-- Fase 4 — Testes da validação de entrada.
--
-- A tela valida antes de enviar, mas o PostgREST aceita qualquer requisição
-- com JWT válido — inclusive de curl. Estes testes verificam a camada que
-- realmente garante: o banco.
-- Sem saída = passou.

begin;

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALHOU: %', msg; end if;
end;
$$;

-- Executa um comando e confirma que ele foi REJEITADO pelo banco.
create or replace function pg_temp.deve_falhar(p_sql text, p_msg text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;   -- rejeitado, como esperado
  end;
  raise exception 'FALHOU: % (o banco aceitou algo que deveria recusar)', p_msg;
end;
$$;

-- ------------------------------------------------------------ 1. CNPJ: DV

-- Controles com CNPJs reais sabidamente válidos. Se estes falharem, a função
-- está errada — e não os dados de teste.
select pg_temp.assert(cnpj_valido('11222333000181'), 'CNPJ real válido foi recusado (11222333000181)');
select pg_temp.assert(cnpj_valido('33000167000101'), 'CNPJ real válido foi recusado (33000167000101)');

-- O clássico "12.345.678/0001-90" é inválido: o DV correto é 95.
select pg_temp.assert(not cnpj_valido('12345678000190'), '12345678000190 tem DV inválido e deveria ser recusado');
select pg_temp.assert(cnpj_valido('12345678000195'), '12345678000195 tem DV correto e deveria passar');

-- Um dígito trocado invalida.
select pg_temp.assert(not cnpj_valido('11222333000182'), 'DV errado deveria ser recusado');

-- Sequências repetidas passam no cálculo mas não existem.
select pg_temp.assert(not cnpj_valido('00000000000000'), 'CNPJ zerado deveria ser recusado');
select pg_temp.assert(not cnpj_valido('11111111111111'), 'CNPJ repetido deveria ser recusado');

-- Formato.
select pg_temp.assert(not cnpj_valido('1122233300018'),   'CNPJ curto deveria ser recusado');
select pg_temp.assert(not cnpj_valido('11.222.333/0001-81'), 'função opera sobre dígitos, não sobre texto formatado');
select pg_temp.assert(not cnpj_valido(null),              'null não é CNPJ válido');
select pg_temp.assert(not cnpj_valido(''),                'vazio não é CNPJ válido');

-- ------------------------------------------- 2. constraint na tabela empresa

select pg_temp.deve_falhar($$
  insert into empresa (tenant_id, razao_social, cnpj, regime)
  values ('11111111-1111-1111-1111-111111111111', 'Empresa Falsa', '12345678000190', 'MEI')
$$, 'empresa com CNPJ de DV inválido');

select pg_temp.deve_falhar($$
  insert into empresa (tenant_id, razao_social, cnpj, regime)
  values ('11111111-1111-1111-1111-111111111111', 'X', '11222333000181', 'MEI')
$$, 'razão social de 1 caractere');

select pg_temp.deve_falhar($$
  insert into empresa (tenant_id, razao_social, cnpj, regime)
  values ('11111111-1111-1111-1111-111111111111', repeat('a', 300), '11222333000181', 'MEI')
$$, 'razão social acima de 255 caracteres');

-- ------------------------------------------------------- 3. normalização

-- A tela pode mandar o CNPJ formatado: o trigger limpa antes do CHECK rodar.
insert into empresa (id, tenant_id, razao_social, nome_fantasia, cnpj, regime, uf)
values ('eeee0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        '  Empresa Formatada LTDA  ', '   ', '11.222.333/0001-81', 'MEI', 'go');

select pg_temp.assert(
  cnpj = '11222333000181' and razao_social = 'Empresa Formatada LTDA'
    and nome_fantasia is null and uf = 'GO',
  'trigger deveria limpar CNPJ, aparar espaços, anular fantasia vazia e subir a UF'
) from empresa where id = 'eeee0001-0000-0000-0000-000000000001';

-- Código de obrigação sobe para maiúscula: o de-para do parser de recibo
-- procura 'DAS', e divergência de caixa aqui vira recibo não casado lá.
insert into obrigacao (id, tenant_id, codigo, nome, departamento, esfera, periodicidade)
values ('0b0000ff-0000-0000-0000-0000000000ff', '11111111-1111-1111-1111-111111111111',
        '  novo_codigo  ', '  Obrigação Nova  ', 'FISCAL', 'FEDERAL', 'MENSAL');

select pg_temp.assert(
  codigo = 'NOVO_CODIGO' and nome = 'Obrigação Nova',
  'trigger deveria normalizar código para maiúscula e aparar o nome'
) from obrigacao where id = '0b0000ff-0000-0000-0000-0000000000ff';

-- ------------------------------------------------ 4. formato do código

select pg_temp.deve_falhar($$
  insert into obrigacao (tenant_id, codigo, nome, departamento, esfera, periodicidade)
  values ('11111111-1111-1111-1111-111111111111', 'código-com-acento', 'Teste', 'FISCAL', 'FEDERAL', 'MENSAL')
$$, 'código com acento e hífen');

select pg_temp.deve_falhar($$
  insert into obrigacao (tenant_id, codigo, nome, departamento, esfera, periodicidade)
  values ('11111111-1111-1111-1111-111111111111', 'X', 'Teste', 'FISCAL', 'FEDERAL', 'MENSAL')
$$, 'código de 1 caractere');

-- Texto absurdo em campo livre não é persistido.
select pg_temp.deve_falhar($$
  insert into obrigacao (tenant_id, codigo, nome, descricao, departamento, esfera, periodicidade)
  values ('11111111-1111-1111-1111-111111111111', 'GRANDE', 'Teste', repeat('a', 5000), 'FISCAL', 'FEDERAL', 'MENSAL')
$$, 'descrição de 5000 caracteres');

rollback;
