-- Testa o Custom Access Token Hook: quais claims cada tipo de login recebe.
-- Este é o ponto onde tenant_id e empresa_id são decididos — se ele errar,
-- todo o RLS erra junto.
--
--   psql ... -f supabase/tests/auth_hook.sql
-- Sem saída = passou.

begin;

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALHOU: %', msg; end if;
end;
$$;

-- Monta o `event` como o GoTrue o entrega ao hook.
create or replace function pg_temp.emitir(p_user_id uuid, p_email text)
returns jsonb language sql as $$
  select public.custom_access_token(jsonb_build_object(
    'user_id', p_user_id,
    'claims', jsonb_build_object('sub', p_user_id, 'email', p_email, 'app_metadata', '{}'::jsonb)
  )) -> 'app_metadata';
$$;

-- ------------------------------------------------- 1. colaborador (Google)

-- Ana: OPERADOR do Fiscal.
select pg_temp.assert(
  pg_temp.emitir('aaaa0001-0000-0000-0000-0000000000a1', 'ana@mendoncagalvao.com.br')
    = jsonb_build_object(
        'tenant_id', '11111111-1111-1111-1111-111111111111',
        'perimetro', 'COLABORADOR',
        'papel', 'OPERADOR',
        'departamentos', '["FISCAL"]'::jsonb),
  'claims do colaborador saíram errados: ' || pg_temp.emitir('aaaa0001-0000-0000-0000-0000000000a1', 'ana@mendoncagalvao.com.br')::text
);

-- Colaborador nunca recebe empresa_id — senão o portal e o /app se confundiriam.
select pg_temp.assert(
  pg_temp.emitir('aaaa0000-0000-0000-0000-0000000000a0', 'admin@mendoncagalvao.com.br') -> 'empresa_id' is null,
  'colaborador não pode receber claim empresa_id'
);

-- Provisionado, mas logando por e-mail fora do domínio do escritório: nega.
-- Cobre a conta Google pessoal de alguém que é colaborador de verdade.
select pg_temp.assert(
  pg_temp.emitir('aaaa0001-0000-0000-0000-0000000000a1', 'ana.pessoal@gmail.com') = '{}'::jsonb,
  'colaborador logando fora do domínio do escritório não pode receber claims'
);

-- Subdomínio parecido não pode passar por domínio permitido.
select pg_temp.assert(
  pg_temp.emitir('aaaa0001-0000-0000-0000-0000000000a1', 'ana@mendoncagalvao.com.br.evil.com') = '{}'::jsonb,
  'domínio que apenas contém o do escritório não pode ser aceito'
);

-- Tenant sem restrição de domínio configurada segue funcionando.
select pg_temp.assert(
  pg_temp.emitir('bbbb0001-0000-0000-0000-0000000000b1', 'admin@ctrl.test') ->> 'perimetro' = 'COLABORADOR',
  'tenant sem dominios_email não deveria ter restrição'
);

-- --------------------------------------------- 2. cliente do portal (link)

-- Convite ainda não aceito: casa por e-mail e já sai com a empresa correta.
select pg_temp.assert(
  pg_temp.emitir('dddd0001-0000-0000-0000-0000000000d1', 'financeiro@vilanova.test')
    = jsonb_build_object(
        'tenant_id', '11111111-1111-1111-1111-111111111111',
        'perimetro', 'CLIENTE',
        'papel', 'LEITURA',
        'empresa_id', 'e0000001-0000-0000-0000-000000000001'),
  'claims do cliente saíram errados: ' || pg_temp.emitir('dddd0001-0000-0000-0000-0000000000d1', 'financeiro@vilanova.test')::text
);

-- Case do e-mail não pode virar bypass nem negar acesso legítimo.
select pg_temp.assert(
  pg_temp.emitir('dddd0001-0000-0000-0000-0000000000d1', 'Financeiro@VilaNova.test') ->> 'perimetro' = 'CLIENTE',
  'e-mail com maiúsculas deveria casar o convite do portal'
);

-- ------------------------------------------- 3. quem não é ninguém no sistema

-- Qualquer conta Google consegue autenticar; o que ela NÃO pode é sair com
-- tenant. Sem tenant, o RLS já nega tudo (ver rls_dois_tenants.sql, seção 5).
select pg_temp.assert(
  pg_temp.emitir('9999ffff-0000-0000-0000-00000000ffff', 'estranho@gmail.com') = '{}'::jsonb,
  'usuário desconhecido não pode receber claim nenhum'
);

-- Colaborador inativo perde o acesso na emissão do próximo token.
update usuario set ativo = false where id = 'aaaa0001-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.emitir('aaaa0001-0000-0000-0000-0000000000a1', 'ana@mendoncagalvao.com.br') = '{}'::jsonb,
  'colaborador inativo não pode receber claims'
);

-- Cliente desativado idem.
update portal_acesso set ativo = false where id = 'c0000001-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.emitir('dddd0001-0000-0000-0000-0000000000d1', 'financeiro@vilanova.test') = '{}'::jsonb,
  'cliente desativado não pode receber claims'
);

-- ---------------------------------- 4. o gatilho que carimba o aceite

update portal_acesso set ativo = true where id = 'c0000001-0000-0000-0000-000000000001';

insert into auth.users (id, email, email_confirmed_at)
values ('dddd0001-0000-0000-0000-0000000000d1', 'financeiro@vilanova.test', now());

select pg_temp.assert(
  auth_user_id = 'dddd0001-0000-0000-0000-0000000000d1' and aceito_em is not null,
  'primeiro login confirmado deveria vincular o convite ao usuário do GoTrue'
) from portal_acesso where id = 'c0000001-0000-0000-0000-000000000001';

-- Um segundo usuário não pode sequestrar um convite já vinculado.
insert into auth.users (id, email, email_confirmed_at)
values ('eeee0002-0000-0000-0000-0000000000e2', 'financeiro@vilanova.test', now());

select pg_temp.assert(
  auth_user_id = 'dddd0001-0000-0000-0000-0000000000d1',
  'convite já aceito não pode ser reapontado para outro usuário'
) from portal_acesso where id = 'c0000001-0000-0000-0000-000000000001';

rollback;
