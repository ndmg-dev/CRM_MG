-- Fase 4 — Validação de entrada no banco.
--
-- As telas de cadastro validam antes de enviar, mas validação de cliente é
-- conveniência, não garantia: o PostgREST aceita qualquer requisição com um
-- JWT válido, venha ela da tela ou de curl. Quem garante é o banco.

-- ---------------------------------------------------------------------- CNPJ

-- Confere os dois dígitos verificadores. O check anterior (`^[0-9]{14}$`)
-- deixava passar CNPJ inexistente, o que só apareceria muito depois, quando um
-- recibo do Domínio não casasse com nenhuma empresa e caísse na fila de
-- revisão sem motivo aparente.
create or replace function cnpj_valido(p_cnpj text)
returns boolean
language plpgsql
immutable
as $$
declare
  d      int[];
  pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  soma   int;
  dv1    int;
  dv2    int;
  i      int;
begin
  if p_cnpj is null or p_cnpj !~ '^[0-9]{14}$' then
    return false;
  end if;

  -- 00000000000000, 11111111111111, … passam no cálculo mas não existem.
  if p_cnpj ~ '^(.)\1{13}$' then
    return false;
  end if;

  select array_agg(c::int order by ord)
    into d
    from unnest(string_to_array(p_cnpj, null)) with ordinality as t(c, ord);

  soma := 0;
  for i in 1..12 loop
    soma := soma + d[i] * pesos1[i];
  end loop;
  dv1 := soma % 11;
  dv1 := case when dv1 < 2 then 0 else 11 - dv1 end;

  soma := 0;
  for i in 1..13 loop
    soma := soma + d[i] * pesos2[i];
  end loop;
  dv2 := soma % 11;
  dv2 := case when dv2 < 2 then 0 else 11 - dv2 end;

  return d[13] = dv1 and d[14] = dv2;
end;
$$;

-- `char(14)` rejeitava "12.345.678/0001-90" por tamanho ANTES de qualquer
-- trigger rodar, o que tornava a normalização abaixo inalcançável e devolvia
-- à tela um erro de tipo em vez de "CNPJ inválido". `text` + CHECK dá o mesmo
-- rigor sem o padding e sem o limite de largura no meio do caminho.
alter table empresa alter column cnpj type text;

alter table empresa
  add constraint empresa_cnpj_digito_verificador check (cnpj_valido(cnpj));

-- ------------------------------------------------------- texto vindo de tela

-- Campos livres com limite de tamanho: sem isso, um POST pode gravar megabytes
-- num campo de nome. Não substitui escapar na renderização — o React já faz
-- isso —, mas evita lixo persistido.
alter table empresa
  add constraint empresa_razao_social_tamanho
    check (length(btrim(razao_social)) between 2 and 255),
  add constraint empresa_nome_fantasia_tamanho
    check (nome_fantasia is null or length(btrim(nome_fantasia)) <= 150);

alter table obrigacao
  add constraint obrigacao_codigo_formato
    check (codigo ~ '^[A-Z0-9_]{2,30}$'),
  add constraint obrigacao_nome_tamanho
    check (length(btrim(nome)) between 2 and 150),
  add constraint obrigacao_descricao_tamanho
    check (descricao is null or length(descricao) <= 2000);

alter table empresa_obrigacao
  add constraint vinculo_observacao_tamanho
    check (observacao is null or length(observacao) <= 2000);

alter table entrega
  add constraint entrega_observacao_tamanho
    check (observacao is null or length(observacao) <= 2000);

-- Normaliza o código da obrigação na escrita: o usuário digita "das" e o
-- de-para do parser de recibo procura "DAS". Divergência de caixa aqui vira
-- recibo não casado lá.
create or replace function app.normaliza_obrigacao()
returns trigger
language plpgsql
as $$
begin
  new.codigo := upper(btrim(new.codigo));
  new.nome   := btrim(new.nome);
  return new;
end;
$$;

create trigger t_obrigacao_normaliza
  before insert or update on obrigacao
  for each row execute function app.normaliza_obrigacao();

create or replace function app.normaliza_empresa()
returns trigger
language plpgsql
as $$
begin
  new.cnpj          := regexp_replace(coalesce(new.cnpj, ''), '\D', '', 'g');
  new.razao_social  := btrim(new.razao_social);
  new.nome_fantasia := nullif(btrim(coalesce(new.nome_fantasia, '')), '');
  new.uf            := upper(nullif(btrim(coalesce(new.uf, '')), ''));
  return new;
end;
$$;

-- BEFORE do trigger roda antes dos CHECKs, então a tela pode enviar o CNPJ
-- formatado ("12.345.678/0001-90") que ele chega limpo à constraint.
create trigger t_empresa_normaliza
  before insert or update on empresa
  for each row execute function app.normaliza_empresa();
