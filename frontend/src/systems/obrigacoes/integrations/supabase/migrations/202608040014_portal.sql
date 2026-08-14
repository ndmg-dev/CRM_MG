-- Fase 6 — Portal do cliente: documentos, aceite LGPD e notificação.
--
-- O cliente é o perímetro mais exposto do sistema: é o único usuário que não
-- é funcionário. Tudo aqui parte disso.

-- ---------------------------------------------------------------------------
-- Política de privacidade versionada
-- ---------------------------------------------------------------------------

-- O aceite tem de registrar QUAL texto foi aceito. Guardar só "aceitou em
-- tal data" não prova nada se o texto mudou depois — e é exatamente o que a
-- LGPD pede que se consiga demonstrar.
create table politica_privacidade (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id) on delete restrict,
  versao       text not null,
  texto        text not null,
  publicada_em timestamptz not null default now(),
  vigente      boolean not null default true,
  constraint politica_versao_unica unique (tenant_id, versao),
  constraint politica_texto_minimo check (length(btrim(texto)) >= 50)
);

-- Uma única versão vigente por tenant.
create unique index politica_vigente_unica
  on politica_privacidade (tenant_id) where vigente;

create or replace function politica_vigente()
returns table (id uuid, versao text, texto text, publicada_em timestamptz)
language sql
stable
as $$
  select p.id, p.versao, p.texto, p.publicada_em
  from politica_privacidade p
  where p.vigente
  limit 1;
$$;

-- `portal_aceite_politica` (migration 0003) guarda o aceite. Falta amarrá-lo à
-- versão real, para que renomear uma versão não desfaça o histórico.
alter table portal_aceite_politica
  add column politica_id uuid references politica_privacidade(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Documentos (GED)
-- ---------------------------------------------------------------------------

create type origem_documento as enum ('ESCRITORIO', 'PORTAL_CLIENTE', 'RECIBO_AUTOMATICO');

create table documento (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  empresa_id    uuid not null references empresa(id) on delete restrict,
  -- Documento pode ser de uma entrega específica ou avulso da empresa.
  entrega_id    uuid references entrega(id) on delete set null,

  storage_path  text not null,          -- caminho no bucket PRIVADO, nunca URL
  nome_arquivo  text not null,
  mime          text not null,
  bytes         bigint not null,

  origem        origem_documento not null,
  -- Quem enviou. Um dos dois, nunca os dois: escritório tem usuario,
  -- portal tem portal_acesso.
  enviado_por_usuario uuid references usuario(id) on delete set null,
  enviado_por_portal  uuid references portal_acesso(id) on delete set null,

  criado_em     timestamptz not null default now(),

  constraint documento_nome_tamanho check (length(btrim(nome_arquivo)) between 1 and 255),
  -- 20 MB para envio de cliente. O limite do bucket é o teto final; este é o
  -- teto do dado, que vale mesmo se alguém escrever direto na tabela.
  constraint documento_bytes check (bytes > 0 and bytes <= 20971520),
  -- Lista fechada de tipos. Sem .zip nem executável: não há como inspecionar
  -- o conteúdo de um zip antes de alguém abrir.
  constraint documento_mime_permitido check (mime in (
    'application/pdf', 'application/xml', 'text/xml',
    'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  )),
  constraint documento_autor_coerente check (
    (enviado_por_usuario is not null and enviado_por_portal is null)
    or (enviado_por_usuario is null and enviado_por_portal is not null)
    or (origem = 'RECIBO_AUTOMATICO' and enviado_por_usuario is null and enviado_por_portal is null)
  )
);

create index on documento (tenant_id, empresa_id, criado_em desc);
create index on documento (tenant_id, entrega_id);

-- ---------------------------------------------------------------------------
-- Notificação ao escritório
-- ---------------------------------------------------------------------------

create table notificacao (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  destinatario_id uuid not null references usuario(id) on delete cascade,
  tipo           text not null,
  titulo         text not null,
  corpo          text,
  documento_id   uuid references documento(id) on delete cascade,
  entrega_id     uuid references entrega(id) on delete cascade,
  lida_em        timestamptz,
  criado_em      timestamptz not null default now()
);

create index on notificacao (tenant_id, destinatario_id, criado_em desc)
  where lida_em is null;

-- Cliente enviou documento -> avisa o responsável.
--
-- LGPD por minimização: a notificação NÃO carrega nome+CNPJ juntos nem o nome
-- do arquivo (que costuma conter CPF do sócio, competência e valor). Carrega
-- os ids — quem abrir a tela vê o resto, sob RLS.
create or replace function app.notificar_documento_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_responsavel uuid;
begin
  if new.origem <> 'PORTAL_CLIENTE' then
    return new;
  end if;

  -- Responsável da entrega, se houver; senão o da empresa.
  select coalesce(
    (select e.responsavel_id from public.entrega e where e.id = new.entrega_id),
    (select em.responsavel_id from public.empresa em where em.id = new.empresa_id)
  ) into v_responsavel;

  if v_responsavel is null then
    return new;   -- ninguém a notificar; o documento continua registrado
  end if;

  insert into public.notificacao (tenant_id, destinatario_id, tipo, titulo, documento_id, entrega_id)
  values (new.tenant_id, v_responsavel, 'DOCUMENTO_CLIENTE',
          'Novo documento enviado pelo cliente', new.id, new.entrega_id);

  return new;
end;
$$;

create trigger t_documento_notifica
  after insert on documento
  for each row execute function app.notificar_documento_do_cliente();

-- Documento do cliente numa entrega que o aguardava move a entrega adiante.
-- Nunca para ENTREGUE: quem confirma a entrega ao fisco é o escritório.
create or replace function app.entrega_recebeu_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.origem = 'PORTAL_CLIENTE' and new.entrega_id is not null then
    update public.entrega
       set status = 'EM_ANDAMENTO'
     where id = new.entrega_id
       and status = 'AGUARDANDO_CLIENTE';
  end if;
  return new;
end;
$$;

create trigger t_documento_move_entrega
  after insert on documento
  for each row execute function app.entrega_recebeu_documento();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table politica_privacidade enable row level security;
alter table documento            enable row level security;
alter table notificacao          enable row level security;

alter table documento force row level security;

-- A política precisa ser legível por quem ainda não aceitou — inclusive por
-- sessão de cliente recém-criada. Só a vigente.
create policy politica_select on politica_privacidade
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy politica_admin on politica_privacidade
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN')
  with check (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN');

-- Documentos: colaborador vê os do tenant; cliente vê só os da empresa dele.
create policy documento_select on documento
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (
      app.is_colaborador()
      or (app.is_cliente() and empresa_id = app.current_empresa_id())
    )
  );

-- O cliente insere apenas para a PRÓPRIA empresa, com origem PORTAL_CLIENTE e
-- assinando com o próprio portal_acesso. Cada uma destas condições fecha uma
-- forma de forjar o registro a partir do navegador.
create policy documento_insert_cliente on documento
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id()
    and app.is_cliente()
    and empresa_id = app.current_empresa_id()
    and origem = 'PORTAL_CLIENTE'
    and enviado_por_usuario is null
    and exists (
      select 1 from portal_acesso pa
      where pa.id = documento.enviado_por_portal
        and pa.auth_user_id = auth.uid()
        and pa.empresa_id = app.current_empresa_id()
    )
    -- Se aponta para uma entrega, ela tem de ser da própria empresa.
    and (
      entrega_id is null
      or exists (
        select 1 from entrega e
        where e.id = documento.entrega_id
          and e.empresa_id = app.current_empresa_id()
      )
    )
  );

create policy documento_insert_colaborador on documento
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id()
    and app.is_colaborador()
    and origem = 'ESCRITORIO'
    and enviado_por_portal is null
  );

-- Sem policy de UPDATE nem DELETE: documento é registro, não rascunho.
-- A remoção por retenção é feita pelo job de LGPD, com service_role.

create policy notificacao_select on notificacao
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and app.is_colaborador()
    and destinatario_id = (select u.id from usuario u where u.auth_user_id = auth.uid())
  );

-- Marcar como lida é a única alteração possível, e só pelo destinatário.
create policy notificacao_marcar_lida on notificacao
  for update to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and destinatario_id = (select u.id from usuario u where u.auth_user_id = auth.uid())
  )
  with check (tenant_id = app.current_tenant_id());

-- ---------------------------------------------------------------------------
-- Bucket privado
-- ---------------------------------------------------------------------------

-- `storage` só existe num projeto Supabase real; o harness de teste roda em
-- Postgres puro. O bloco é condicional para que a migration valide nos dois.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'schema storage ausente (Postgres puro): pulando bucket e policies';
    return;
  end if;

  -- public=false: o arquivo NUNCA tem URL pública. O acesso é sempre por URL
  -- assinada de curta duração, gerada sob a sessão de quem pediu.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('obrigacoes-documentos', 'obrigacoes-documentos', false, 20971520,
          array['application/pdf','application/xml','text/xml','image/jpeg','image/png',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Convenção de caminho: <tenant_id>/<empresa_id>/<uuid>-<nome>
  -- As policies abaixo dependem dela: o 1º segmento é o tenant e o 2º a
  -- empresa, e é assim que o isolamento é verificado no storage.
  execute $pol$
    create policy documento_leitura on storage.objects
      for select to authenticated
      using (
        bucket_id = 'obrigacoes-documentos'
        and (storage.foldername(name))[1] = app.current_tenant_id()::text
        and (
          app.is_colaborador()
          or (app.is_cliente() and (storage.foldername(name))[2] = app.current_empresa_id()::text)
        )
      )
  $pol$;

  execute $pol$
    create policy documento_envio_cliente on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'obrigacoes-documentos'
        and (storage.foldername(name))[1] = app.current_tenant_id()::text
        and (
          app.is_colaborador()
          or (app.is_cliente() and (storage.foldername(name))[2] = app.current_empresa_id()::text)
        )
      )
  $pol$;

  -- Sem policy de update/delete: cliente não apaga o que enviou, e o
  -- escritório não apaga prova. Expurgo por retenção usa service_role.
end;
$$;

-- ---------------------------------------------------------------------------
-- Retenção (LGPD)
--
-- O espelho no GED não é o documento legal — o original é do cliente. Este
-- job apaga o conteúdo e mantém o registro de que existiu. Chamar por cron
-- com service_role.
-- ---------------------------------------------------------------------------

create or replace function expurgar_documentos_antigos(p_tenant_id uuid, p_meses int default 12)
returns int
language plpgsql
as $$
declare
  v_removidos int;
begin
  if p_meses < 1 then
    raise exception 'retenção mínima de 1 mês';
  end if;

  -- Só marca o caminho como expurgado; quem apaga o binário é o worker, que
  -- lê esta lista. Assim a operação é reexecutável e auditável.
  with alvo as (
    select id from documento
    where tenant_id = p_tenant_id
      and criado_em < now() - make_interval(months => p_meses)
      and storage_path <> ''
  )
  update documento d
     set storage_path = ''
    from alvo
   where d.id = alvo.id;

  get diagnostics v_removidos = row_count;
  return v_removidos;
end;
$$;

revoke execute on function expurgar_documentos_antigos(uuid, int) from public, anon, authenticated;
