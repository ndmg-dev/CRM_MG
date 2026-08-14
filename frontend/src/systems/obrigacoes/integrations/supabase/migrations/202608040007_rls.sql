-- Fase 1 — RLS em todas as tabelas de negócio.
--
-- Defesa em profundidade: a aplicação SEMPRE filtra por tenant_id na query, e o
-- banco SEMPRE valida de novo aqui. Nunca só um dos dois.
--
-- Ausência de policy = negado. Onde não há policy de DELETE, deletar é
-- impossível por definição (parametrização e regra de prazo, que se encerram).

alter table tenant                 enable row level security;
alter table usuario                enable row level security;
alter table usuario_departamento   enable row level security;
alter table empresa                enable row level security;
alter table portal_acesso          enable row level security;
alter table portal_aceite_politica enable row level security;
alter table obrigacao              enable row level security;
alter table obrigacao_prazo        enable row level security;
alter table feriado                enable row level security;
alter table empresa_obrigacao      enable row level security;
alter table entrega                enable row level security;
alter table entrega_evento         enable row level security;

-- Nem o dono da tabela escapa das policies (protege jobs que rodem como owner).
alter table empresa_obrigacao force row level security;
alter table entrega           force row level security;

-- ----------------------------------------------------------------- tenant

create policy tenant_select on tenant
  for select to authenticated
  using (id = app.current_tenant_id());

-- ---------------------------------------------------------------- usuario

create policy usuario_select on usuario
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_colaborador());

create policy usuario_update_self on usuario
  for update to authenticated
  using (tenant_id = app.current_tenant_id() and auth_user_id = auth.uid())
  with check (tenant_id = app.current_tenant_id() and auth_user_id = auth.uid());

create policy usuario_admin_all on usuario
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN')
  with check (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN');

create policy usuario_departamento_select on usuario_departamento
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_colaborador());

create policy usuario_departamento_admin on usuario_departamento
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN')
  with check (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') = 'ADMIN');

-- ---------------------------------------------------------------- empresa

-- Colaborador enxerga as empresas do tenant; cliente enxerga APENAS a empresa
-- do próprio JWT — e empresa_id vem só de app.current_empresa_id().
create policy empresa_select on empresa
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (
      app.is_colaborador()
      or (app.is_cliente() and id = app.current_empresa_id())
    )
  );

create policy empresa_write on empresa
  for all to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and app.is_colaborador()
    and app.jwt_claim('papel') in ('ADMIN', 'GESTOR')
  )
  with check (
    tenant_id = app.current_tenant_id()
    and app.is_colaborador()
    and app.jwt_claim('papel') in ('ADMIN', 'GESTOR')
  );

-- ----------------------------------------------------------- portal_acesso

create policy portal_acesso_colaborador on portal_acesso
  for all to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and app.is_colaborador()
    and app.jwt_claim('papel') in ('ADMIN', 'GESTOR')
  )
  with check (
    tenant_id = app.current_tenant_id()
    and app.is_colaborador()
    and app.jwt_claim('papel') in ('ADMIN', 'GESTOR')
  );

create policy portal_acesso_self on portal_acesso
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and auth_user_id = auth.uid());

create policy aceite_select on portal_aceite_politica
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (
      app.is_colaborador()
      or exists (
        select 1 from portal_acesso pa
        where pa.id = portal_aceite_politica.portal_acesso_id
          and pa.auth_user_id = auth.uid()
      )
    )
  );

-- O aceite é ato do titular: só ele insere, e só para si.
create policy aceite_insert_self on portal_aceite_politica
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id()
    and app.is_cliente()
    and exists (
      select 1 from portal_acesso pa
      where pa.id = portal_aceite_politica.portal_acesso_id
        and pa.auth_user_id = auth.uid()
        and pa.tenant_id = app.current_tenant_id()
    )
  );

-- -------------------------------------------------------------- catálogo

-- Catálogo e feriados são legíveis pelos dois perímetros (o cliente precisa do
-- nome da obrigação na tela); escrita é do colaborador, restrita ao seu
-- departamento — RBAC por departamento vale também no banco.
create policy obrigacao_select on obrigacao
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy obrigacao_write on obrigacao
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.pode_departamento(departamento::text))
  with check (tenant_id = app.current_tenant_id() and app.pode_departamento(departamento::text));

create policy prazo_select on obrigacao_prazo
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

-- Sem policy de UPDATE nem DELETE: regra de prazo se versiona, não se edita.
create policy prazo_insert on obrigacao_prazo
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id()
    and exists (
      select 1 from obrigacao o
      where o.id = obrigacao_prazo.obrigacao_id
        and o.tenant_id = app.current_tenant_id()
        and app.pode_departamento(o.departamento::text)
    )
  );

-- Encerrar a vigência da versão anterior é a única mutação permitida.
create policy prazo_encerrar on obrigacao_prazo
  for update to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and vigencia_fim is null
    and exists (
      select 1 from obrigacao o
      where o.id = obrigacao_prazo.obrigacao_id
        and app.pode_departamento(o.departamento::text)
    )
  )
  with check (tenant_id = app.current_tenant_id() and vigencia_fim is not null);

create policy feriado_select on feriado
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy feriado_write on feriado
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') in ('ADMIN', 'GESTOR'))
  with check (tenant_id = app.current_tenant_id() and app.jwt_claim('papel') in ('ADMIN', 'GESTOR'));

-- --------------------------------------------------------- parametrização

create policy empresa_obrigacao_select on empresa_obrigacao
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (
      app.is_colaborador()
      or (app.is_cliente() and empresa_id = app.current_empresa_id())
    )
  );

create policy empresa_obrigacao_insert on empresa_obrigacao
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id()
    and exists (
      select 1 from obrigacao o
      where o.id = empresa_obrigacao.obrigacao_id
        and o.tenant_id = app.current_tenant_id()
        and app.pode_departamento(o.departamento::text)
    )
    and exists (
      select 1 from empresa e
      where e.id = empresa_obrigacao.empresa_id
        and e.tenant_id = app.current_tenant_id()
    )
  );

create policy empresa_obrigacao_update on empresa_obrigacao
  for update to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and exists (
      select 1 from obrigacao o
      where o.id = empresa_obrigacao.obrigacao_id
        and app.pode_departamento(o.departamento::text)
    )
  )
  with check (tenant_id = app.current_tenant_id());

-- (sem policy de DELETE — encerrar, nunca deletar)

-- --------------------------------------------------------------- entregas

create policy entrega_select on entrega
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (
      app.is_colaborador()
      or (app.is_cliente() and empresa_id = app.current_empresa_id())
    )
  );

-- Entrega é gerada pelo job (service_role), não criada por usuário de tela.
create policy entrega_update_colaborador on entrega
  for update to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and exists (
      select 1 from obrigacao o
      where o.id = entrega.obrigacao_id
        and app.pode_departamento(o.departamento::text)
    )
  )
  with check (tenant_id = app.current_tenant_id());

create policy entrega_evento_select on entrega_evento
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_colaborador());
