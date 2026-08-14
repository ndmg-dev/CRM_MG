-- Fase 6 — Testes do portal do cliente.
--
-- O cliente é o único usuário do sistema que não é funcionário. Estes testes
-- tentam, a partir da sessão dele, fazer o que ele não deveria conseguir.
-- Sem saída = passou.

begin;

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALHOU: %', msg; end if;
end;
$$;

create or replace function pg_temp.deve_falhar(p_sql text, p_msg text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FALHOU: % (o banco aceitou algo que deveria recusar)', p_msg;
end;
$$;

create or replace function pg_temp.sessao(
  p_tenant uuid, p_perimetro text, p_papel text,
  p_empresa uuid default null, p_sub uuid default null,
  p_departamentos jsonb default '[]'::jsonb
) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', coalesce(p_sub, gen_random_uuid()),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object(
      'tenant_id', p_tenant, 'perimetro', p_perimetro, 'papel', p_papel,
      'empresa_id', p_empresa, 'departamentos', p_departamentos
    )
  )::text, true);
end;
$$;

-- Vincula o convite da Padaria Vila Nova a um usuário do GoTrue.
update portal_acesso
   set auth_user_id = 'cccc0001-0000-0000-0000-0000000000c1', aceito_em = now()
 where id = 'c0000001-0000-0000-0000-000000000001';

-- Uma segunda empresa com portal, para testar vazamento entre clientes.
insert into portal_acesso (id, tenant_id, empresa_id, email, nome, auth_user_id, aceito_em)
values ('c0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        'e0000002-0000-0000-0000-000000000002', 'financeiro@serraazul.test', 'Serra Azul',
        'cccc0002-0000-0000-0000-0000000000c2', now());

-- Captura ids de OUTRA empresa antes de assumir a sessão do cliente. Sem isso
-- um `insert ... select` filtrado pelo RLS insere zero linhas e o teste passa
-- por vacuidade, sem nunca ter tentado o ataque.
create temp table alvo_vizinho as
select id as entrega_e2 from entrega
where empresa_id = 'e0000002-0000-0000-0000-000000000002' limit 1;

-- Sem este GRANT a sessão `authenticated` recebe "permission denied" ao ler a
-- temp table, e `deve_falhar` contaria isso como recusa da policy — o teste
-- passaria sem nunca ter tentado o ataque.
grant select on alvo_vizinho to authenticated;

set local role authenticated;

-- ------------------------------------------------ 1. envio legítimo funciona

select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'CLIENTE', 'LEITURA',
  'e0000001-0000-0000-0000-000000000001', 'cccc0001-0000-0000-0000-0000000000c1'
);

insert into documento (tenant_id, empresa_id, entrega_id, storage_path, nome_arquivo,
                       mime, bytes, origem, enviado_por_portal)
select '11111111-1111-1111-1111-111111111111', 'e0000001-0000-0000-0000-000000000001',
       e.id, '11111111/e0000001/abc-nota.pdf', 'nota.pdf', 'application/pdf', 1024,
       'PORTAL_CLIENTE', 'c0000001-0000-0000-0000-000000000001'
from entrega e
where e.empresa_id = 'e0000001-0000-0000-0000-000000000001'
  and e.competencia = '2026-07-01'
limit 1;

select pg_temp.assert(count(*) = 1, 'cliente deveria conseguir enviar documento da própria empresa')
from documento;

-- ---------------------------------------- 2. o que o cliente NÃO pode fazer

-- Enviar para outra empresa, mesmo tendo o id em mãos.
select pg_temp.deve_falhar($$
  insert into documento (tenant_id, empresa_id, storage_path, nome_arquivo, mime, bytes,
                         origem, enviado_por_portal)
  values ('11111111-1111-1111-1111-111111111111', 'e0000002-0000-0000-0000-000000000002',
          'x/y/z.pdf', 'z.pdf', 'application/pdf', 10, 'PORTAL_CLIENTE',
          'c0000001-0000-0000-0000-000000000001')
$$, 'cliente enviando documento para outra empresa');

-- Assinar como o portal_acesso de outro cliente.
select pg_temp.deve_falhar($$
  insert into documento (tenant_id, empresa_id, storage_path, nome_arquivo, mime, bytes,
                         origem, enviado_por_portal)
  values ('11111111-1111-1111-1111-111111111111', 'e0000001-0000-0000-0000-000000000001',
          'x/y/z.pdf', 'z.pdf', 'application/pdf', 10, 'PORTAL_CLIENTE',
          'c0000002-0000-0000-0000-000000000002')
$$, 'cliente assinando com o portal_acesso de outro');

-- Fingir que o documento veio do escritório.
select pg_temp.deve_falhar($$
  insert into documento (tenant_id, empresa_id, storage_path, nome_arquivo, mime, bytes,
                         origem, enviado_por_usuario)
  values ('11111111-1111-1111-1111-111111111111', 'e0000001-0000-0000-0000-000000000001',
          'x/y/z.pdf', 'z.pdf', 'application/pdf', 10, 'ESCRITORIO',
          'aaaa0001-0000-0000-0000-000000000001')
$$, 'cliente forjando documento de origem ESCRITORIO');

-- Anexar a uma entrega de outra empresa, com o id em mãos (capturado acima).
select pg_temp.deve_falhar($$
  insert into documento (tenant_id, empresa_id, entrega_id, storage_path, nome_arquivo,
                         mime, bytes, origem, enviado_por_portal)
  values ('11111111-1111-1111-1111-111111111111', 'e0000001-0000-0000-0000-000000000001',
          (select entrega_e2 from alvo_vizinho),
          'x/y/z.pdf', 'z.pdf', 'application/pdf', 10, 'PORTAL_CLIENTE',
          'c0000001-0000-0000-0000-000000000001')
$$, 'cliente anexando documento a entrega de outra empresa');

-- Tipo de arquivo fora da lista fechada.
select pg_temp.deve_falhar($$
  insert into documento (tenant_id, empresa_id, storage_path, nome_arquivo, mime, bytes,
                         origem, enviado_por_portal)
  values ('11111111-1111-1111-1111-111111111111', 'e0000001-0000-0000-0000-000000000001',
          'x/y/z.exe', 'z.exe', 'application/x-msdownload', 10, 'PORTAL_CLIENTE',
          'c0000001-0000-0000-0000-000000000001')
$$, 'executável deveria ser recusado pelo CHECK de mime');

select pg_temp.deve_falhar($$
  insert into documento (tenant_id, empresa_id, storage_path, nome_arquivo, mime, bytes,
                         origem, enviado_por_portal)
  values ('11111111-1111-1111-1111-111111111111', 'e0000001-0000-0000-0000-000000000001',
          'x/y/z.zip', 'z.zip', 'application/zip', 10, 'PORTAL_CLIENTE',
          'c0000001-0000-0000-0000-000000000001')
$$, 'zip deveria ser recusado — não dá para inspecionar o conteúdo antes de abrir');

-- Arquivo acima de 20 MB.
select pg_temp.deve_falhar($$
  insert into documento (tenant_id, empresa_id, storage_path, nome_arquivo, mime, bytes,
                         origem, enviado_por_portal)
  values ('11111111-1111-1111-1111-111111111111', 'e0000001-0000-0000-0000-000000000001',
          'x/y/z.pdf', 'z.pdf', 'application/pdf', 99999999, 'PORTAL_CLIENTE',
          'c0000001-0000-0000-0000-000000000001')
$$, 'arquivo acima do limite de 20 MB');

-- Documento é registro, não rascunho: sem UPDATE nem DELETE.
do $$
declare n int;
begin
  delete from documento;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALHOU: cliente conseguiu apagar documento'; end if;
end;
$$;

-- ------------------------------------- 3. o cliente não vê o do vizinho

select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'CLIENTE', 'LEITURA',
  'e0000002-0000-0000-0000-000000000002', 'cccc0002-0000-0000-0000-0000000000c2'
);

select pg_temp.assert(count(*) = 0, 'cliente NÃO pode ver documento de outra empresa')
from documento;

select pg_temp.assert(count(*) = 0, 'cliente NÃO pode ler notificações do escritório')
from notificacao;

-- --------------------------------- 4. notificação chegou ao responsável

-- Ana é responsável pela Padaria Vila Nova.
select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'COLABORADOR', 'OPERADOR',
  null, 'aaaa0001-0000-0000-0000-0000000000a1', '["FISCAL"]'::jsonb
);

select pg_temp.assert(count(*) = 1, 'responsável deveria ter recebido 1 notificação, teve ' || count(*))
from notificacao where tipo = 'DOCUMENTO_CLIENTE';

-- LGPD por minimização: a notificação não carrega nome de arquivo nem CNPJ.
select pg_temp.assert(
  titulo not like '%.pdf%' and coalesce(corpo, '') = '',
  'notificação não pode carregar nome de arquivo nem conteúdo identificável'
) from notificacao where tipo = 'DOCUMENTO_CLIENTE';

-- Outro colaborador não recebe a notificação alheia.
select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'COLABORADOR', 'OPERADOR',
  null, 'aaaa0004-0000-0000-0000-0000000000a4', '["CONTABIL"]'::jsonb
);
select pg_temp.assert(count(*) = 0, 'notificação é do destinatário, não de todo o escritório')
from notificacao;

-- ------------------------- 5. documento move a entrega, mas não a entrega

select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'COLABORADOR', 'ADMIN',
  null, 'aaaa0000-0000-0000-0000-0000000000a0', '["FISCAL","CONTABIL","PESSOAL"]'::jsonb
);

select pg_temp.assert(
  not exists (
    select 1 from entrega e
    join documento d on d.entrega_id = e.id
    where e.status = 'ENTREGUE'
  ),
  'documento enviado pelo cliente NUNCA pode marcar a entrega como ENTREGUE'
);

-- ---------------------------------------------- 6. aceite da política

select pg_temp.assert((select count(*) from politica_vigente()) = 1,
  'deveria haver exatamente uma política vigente');

select pg_temp.sessao(
  '11111111-1111-1111-1111-111111111111', 'CLIENTE', 'LEITURA',
  'e0000001-0000-0000-0000-000000000001', 'cccc0001-0000-0000-0000-0000000000c1'
);

select pg_temp.assert((select count(*) from politica_vigente()) = 1,
  'o cliente precisa conseguir LER a política antes de aceitá-la');

insert into portal_aceite_politica (tenant_id, portal_acesso_id, versao_politica, politica_id)
values ('11111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001',
        '2026-08-01', 'f0000001-0000-0000-0000-000000000001');

select pg_temp.assert(count(*) = 1, 'cliente deveria conseguir registrar o próprio aceite')
from portal_aceite_politica;

-- Aceitar em nome de outro cliente, não.
select pg_temp.deve_falhar($$
  insert into portal_aceite_politica (tenant_id, portal_acesso_id, versao_politica)
  values ('11111111-1111-1111-1111-111111111111', 'c0000002-0000-0000-0000-000000000002', '2026-08-01')
$$, 'cliente aceitando política em nome de outro');

-- O mesmo aceite duas vezes não duplica o registro.
select pg_temp.deve_falhar($$
  insert into portal_aceite_politica (tenant_id, portal_acesso_id, versao_politica)
  values ('11111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001', '2026-08-01')
$$, 'aceite duplicado da mesma versão');

rollback;
