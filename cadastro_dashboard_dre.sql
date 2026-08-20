-- Cadastro do "Dashboard DRE" no CRM — rodar no Postgres do CRM
-- (crm_mendonca_galvao).
--
-- Existe porque não há endpoint nem tela de administração para cadastrar
-- sistemas: `GET /api/v1/sistemas` é a única rota, e a tabela é populada por
-- SQL. E porque `sistemas_seed.sql`, na raiz, está em UTF-16 — o psql lê
-- apenas encodings de 8 bits, então aquele arquivo serve de versionamento,
-- não de script aplicável. A linha foi acrescentada lá também.
--
--   psql "$DATABASE_URL_CRM" -f cadastro_dashboard_dre.sql
--
-- Idempotente: rodar duas vezes não duplica.
--
-- ATENÇÃO — https://dash-razao.vercel.app/ responde 401 com HTTP Basic Auth
-- (WWW-Authenticate: Basic realm="Dashboard DRE"). Navegadores baseados em
-- Chromium bloqueiam o prompt de autenticação em iframe de outra origem, então
-- o sistema tende a aparecer em branco embutido no CRM. O SystemViewer oferece
-- "Abrir em nova aba", onde o prompt funciona normalmente. Para embutir de
-- fato, a proteção precisa sair do nível HTTP (login dentro da própria
-- aplicação, ou liberação por IP/SSO no Vercel).

insert into public.sistemas
  (id, nome, descricao, slug, categoria, url, icone, allowed_origin, ativo, created_at, setor)
values (
  '0917fd1f-540c-4f75-8113-9e08d9e15c81',
  'Dashboard DRE',
  'Dashboard de métricas do DRE (Demonstração do Resultado do Exercício)',
  -- Slug sem correspondência em `systems/registry.tsx`: o SystemViewer não
  -- acha componente nativo e cai no iframe, que é o esperado aqui.
  'dashboard-dre',
  -- MAIN (aparece como "Principal"): é um painel que se abre para consultar,
  -- não uma automação. BIMG é AUTOMATION, mas aquela categoria concentra os
  -- bots e copilotos — trocar para AUTOMATION é só mudar esta palavra.
  'MAIN',
  'https://dash-razao.vercel.app/',
  -- 'pie-chart' está livre no ICON_MAP e não colide com o 'bar-chart-3' do
  -- BIMG, que fica na mesma categoria Contábil.
  'pie-chart',
  -- Sem postMessage entre CRM e o dashboard, então não há origem a liberar.
  null,
  true,
  now(),
  'CONTABIL'
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
