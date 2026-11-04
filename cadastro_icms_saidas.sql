-- Cadastro do sistema "ICMS Saídas" no CRM — rodar no Postgres do CRM (crm_mendonca_galvao).
--
-- Não há endpoint nem tela para cadastrar sistemas: a tabela é populada por SQL (ver cadastro_dashboard_dre.sql). O slug
-- 'icms-saidas' casa com frontend/src/systems/registry.tsx, então o CRM renderiza o módulo nativo (não iframe); a url '#' é só
-- marcador. Quem enxerga o card: setor FISCAL (visibilidade por setor) e quem receber acesso explícito; as AÇÕES dentro do módulo
-- dependem das permissões icms_saidas.* (tela "Permissões" do próprio sistema, só ADMIN).
--
--   psql "$DATABASE_URL_CRM" -f cadastro_icms_saidas.sql
--
-- Idempotente: rodar duas vezes não duplica.

insert into public.sistemas
  (id, nome, descricao, slug, categoria, url, icone, allowed_origin, ativo, created_at, setor)
values (
  '15e7f754-780f-4889-93b0-52216146fcdc',
  'ICMS Saídas',
  'Apuração mensal de ICMS das saídas (Outros Débitos / Estornos de Débito) com memória tributária por empresa',
  'icms-saidas',
  'MAIN',
  '#',
  'calculator',
  null,
  true,
  now(),
  'FISCAL'
)
on conflict (id) do update
  set nome       = excluded.nome,
      descricao  = excluded.descricao,
      slug       = excluded.slug,
      categoria  = excluded.categoria,
      url        = excluded.url,
      icone      = excluded.icone,
      setor      = excluded.setor,
      ativo      = true,
      updated_at = now();
