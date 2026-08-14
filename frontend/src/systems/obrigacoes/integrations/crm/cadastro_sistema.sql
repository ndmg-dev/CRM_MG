-- Cadastro do módulo no CRM — rodar no Postgres do CRM (crm_mendonca_galvao),
-- NÃO no Supabase do módulo. São bancos diferentes.
--
-- Este arquivo existe porque `sistemas_seed.sql`, na raiz do repositório, está
-- em UTF-16 (o psql lê apenas encodings de 8 bits, então aquele arquivo não é
-- aplicável direto) e com os acentos das linhas antigas corrompidos. A linha
-- foi acrescentada lá para o versionamento ficar completo; para APLICAR, use
-- este aqui.
--
--   psql "$DATABASE_URL_CRM" -f cadastro_sistema.sql
--
-- Idempotente: rodar duas vezes não duplica nem sobrescreve alterações feitas
-- pela tela de Admin, exceto os campos abaixo.

insert into public.sistemas
  (id, nome, descricao, slug, categoria, url, icone, allowed_origin, ativo, created_at, setor)
values (
  '9b7f2a10-4d3e-4c8a-b1f6-0e5a7c2d9143',
  'Obrigações Acessórias',
  'Controle de entregas de obrigações acessórias, prazos e documentos do cliente',
  -- O slug é o que liga ao registry do frontend (systems/registry.tsx). Mudar
  -- aqui sem mudar lá faz o CRM cair no iframe e mostrar "URL não configurada".
  'obrigacoes-acessorias',
  'MAIN',
  -- Sistema NATIVO: o SystemViewer resolve pelo registry antes de olhar a URL.
  -- O '#' é o mesmo marcador usado pelos outros sistemas migrados.
  '#',
  'clipboard-list',
  -- Sem iframe, então sem origem a liberar para postMessage.
  null,
  true,
  now(),
  -- GERAL, não FISCAL: o módulo cruza Fiscal, Contábil e Pessoal. Marcá-lo
  -- como de um departamento faria a política de visibilidade escondê-lo de
  -- quem também precisa dele.
  'GERAL'
)
on conflict (id) do update
  set nome      = excluded.nome,
      descricao = excluded.descricao,
      slug      = excluded.slug,
      categoria = excluded.categoria,
      icone     = excluded.icone,
      setor     = excluded.setor,
      ativo     = true,
      updated_at = now();
