# Handoff — Migração de sistemas iframe → nativo no CRM

Contexto completo pra continuar o trabalho numa conversa nova. Leia isso antes de começar
qualquer coisa nova nessa frente.

## Onde as coisas estão

- **Branch fixa de trabalho**: `feat/migracoes-arthur` no `CRM_MG`, criada a partir de
  `origin/Features-Edu`. Continuamos commitando e dando push direto nela, abrindo um PR novo
  pra `main` a cada leva de commits prontos pra revisão (não ficamos numa branch por sistema).
- Repos satélite clonados localmente em `C:\Users\User\Projetos\`: `COPILOT_CONTABIL`,
  `BIBM-MG` (BIMG), `ContAI_PRO`, `GERADOR_DE_NOTAS`, `PROJETO-CARNE-LEAO`.

## Sistemas já migrados (nativos, funcionando)

| Sistema | Slug | Repo satélite | Auth |
|---|---|---|---|
| Copilot Contábil | `copilot-contabil` | COPILOT_CONTABIL | Supabase próprio, SSO via `signInWithIdToken` |
| BIMG (Business Intelligence) | `bimg-business-intelligence` | BIBM-MG | Supabase próprio, SSO via `signInWithIdToken` |
| ContAI | `cont-ai` | ContAI_PRO | Sem Supabase — Bearer JWT do próprio CRM |
| Documentação Contábil (era "Gerador de Notas") | `documentacao-contabil` | GERADOR_DE_NOTAS | Sem auth nenhuma (decisão de projeto original, mantida) |
| Contábil Script (Carnê-Leão) | `contabil-script-estatico` | PROJETO-CARNE-LEAO | Sem auth. **Continua hospedado na Vercel** (`https://contabilscript.vercel.app/`), não no Coolify — ver nota abaixo |

**Desativado** (não abolir do banco, só `ativo = false`): Portal do Colaborador
(`portal-do-colaborador`) — decisão do usuário, sistema abandonado.

**Nota sobre o Carnê-Leão**: existe um branch companion mesclado em
`PROJETO-CARNE-LEAO` (`feat/google-drive-integration`, já em `main`) com uma reescrita
completa pra rodar no Coolify com Google Drive API + Docker + Tesseract + auth Bearer.
Essa reescrita **não está em uso** — o usuário decidiu manter a versão estática já
deployada na Vercel (dataset fixo, sem Google Drive live). O código novo fica dormente no
repo, sem quebrar nada (fail-open: se `CRM_JWT_SECRET`/`GOOGLE_SERVICE_ACCOUNT_JSON` não
estiverem configuradas, cai nos fallbacks antigos). Se um dia precisar reativar essa via,
o código já existe, só falta configurar as env vars e trocar o slug no `registry.tsx` de
volta pra apontar pro deploy Coolify em vez do Vercel.

## O playbook de migração (repetir pros próximos sistemas)

1. **Investigar o sistema original**: stack (React puro? Next.js? Flask+Jinja2?), auth
   (Supabase próprio? Google OAuth direto? Sem auth?), onde está deployado hoje (Coolify?
   Vercel?), se já está cadastrado em `sistemas_seed.sql`/no banco (esse arquivo fica
   desatualizado — **sempre confirmar no banco de produção via psql**, nunca confiar só no
   seed).
2. **Portar o frontend** pra `frontend/src/systems/<slug>/`:
   - Entrypoint `<Nome>App.tsx`.
   - Sem `<Router>`/`<BrowserRouter>` aninhado — o sistema é montado em `/sistemas/:id/*`
     dentro do Router do CRM. Usar `useNativeSystemBase`/`useNativeSystemPath`
     (`frontend/src/hooks/useNativeSystemBase.ts`) pra qualquer navegação interna.
   - Nav/topbar do sistema original vira um componente `Topbar.tsx` portalizado pro
     `#system-menu-slot` do header do CRM via `createPortal` (ver
     `frontend/src/systems/contai/components/Topbar.tsx` como referência), não um
     `<header>` próprio fixo — senão colide visualmente com os controles do CRM (bug real
     que já aconteceu com o Abertura de Empresa: um botão com `position: fixed; top; right`
     ficava por cima do sino/chat/avatar do CRM).
   - CSS original escopado sob uma classe raiz (`.{sistema}-root`) pra não vazar reset/tema
     pro resto do CRM. **Atenção**: se algum elemento for portalizado pra fora dessa árvore
     (como o Topbar), CSS vars definidas só em `.{sistema}-root` não chegam nele — usar
     valores diretos (hex/rgba) nesses casos, não `var(--x)`.
3. **Aliases**: adicionar em `frontend/vite.config.ts` (`resolve.alias`) e
   `frontend/tsconfig.app.json` (`compilerOptions.paths`).
4. **Registry**: `frontend/src/systems/registry.tsx` — `'<slug>': lazy(() => import('@alias/App'))`.
5. **Dockerfile/docker-compose — BUG QUE JÁ ACONTECEU 3 VEZES**: toda env var `VITE_*` nova
   precisa de `ARG`+`ENV` no `frontend/Dockerfile` **e** de uma entrada em `args:` do serviço
   `frontend` no `docker-compose.yml`. Sem isso, o Coolify até aceita a variável configurada
   no painel, mas ela nunca chega no `npm run build` (Vite só vê env vars que existem de
   verdade no processo do build) — quebra silenciosamente, sem erro óbvio.
6. **Auth — duas estratégias, dependendo do sistema original**:
   - **Sistema com Supabase Auth próprio** (Copilot, BIMG): adicionar um bloco em
     `frontend/src/lib/unifiedAuth.ts` (`establishUnifiedSession`/`endUnifiedSession`) que
     chama `supabase.auth.signInWithIdToken({provider:'google', token: googleIdToken})` com
     o mesmo idToken do Google já validado no login do CRM. Fail-soft (try/catch,
     `console.warn`, nunca bloqueia o login do CRM). **Pendência externa**: o Supabase desse
     sistema precisa ter o Client ID do Google do CRM liberado em Authentication → Providers
     → Google → Authorized Client IDs, senão dá "Unacceptable audience in id_token".
   - **Sistema sem Supabase, com backend próprio** (ContAI): backend passa a aceitar
     `Authorization: Bearer <jwt-do-crm>` além do método de auth original, validando o JWT
     com o MESMO `JWT_SECRET` do backend-fastapi do CRM (variável nova no sistema satélite:
     `CRM_JWT_SECRET`, precisa ser **exatamente igual**). O JWT do CRM precisou ganhar um
     claim `email` extra (`backend-fastapi/app/core/security.py`,
     `create_access_token(..., extra_claims={"email": user.email})`) pra o backend satélite
     conseguir validar domínio sem consultar o Postgres do CRM. Isso é SSO automático e mais
     simples que o Supabase (não depende de nenhuma config externa) — **preferir essa
     abordagem quando o sistema não tiver Supabase Auth já embutido**.
   - **Gotcha de CSRF** (Flask + Flask-WTF): se o backend satélite usa
     `CSRFProtect(app)` global, toda chamada de escrita (POST/DELETE) via Bearer vai falhar
     com 400 "CSRF token missing", porque CSRF é pensado pra sessão de cookie, não Bearer
     stateless. Fix: `app.config['WTF_CSRF_CHECK_DEFAULT'] = False` + chamar
     `csrf.protect()` manualmente só no caminho de auth por cookie (ver
     `ContAI_PRO/app/web/routes/decorators.py`).
   - **Gotcha de CORS**: o CORS do backend satélite geralmente só cobre `/api/*`. Se o
     sistema tiver rotas fora desse prefixo que o frontend nativo precisa chamar (ex:
     `/empresas/lista` no ContAI, usado pelo seletor de empresa), elas ficam de fora do CORS
     por padrão e dão erro de preflight — precisa adicionar esse path também nos
     `resources` do `CORS()`.
   - **Sistema sem nenhuma auth** (Documentação Contábil, Contábil Script): não inventar
     auth nova — só confirmar que o CORS do backend original libera a origem do CRM
     (`https://crmmg.mendoncagalvao.com.br`).
7. **Padrão de seletor de "empresa ativa"** (multi-tenant por sessão): sistemas que
   dependiam de `session['active_empresa']` (Flask) quebram numa API stateless via Bearer —
   cada chamada precisa do `empresa_id` explícito (query param). Solução: endpoint
   `GET /empresas/lista` já costuma existir (só protegido por `login_required`, então já
   funciona com Bearer sem mudança de backend); o frontend guarda a escolha em
   `localStorage` (chave escopada tipo `<sistema>_empresa_id`) e passa `empresa_id` em toda
   chamada subsequente. Seletor visual: pill dourada no topbar portalizado (ver
   `frontend/src/systems/contai/components/Topbar.tsx` + `context/EmpresaContext.tsx`).
8. **Validar antes de commitar**: `cd frontend && npx tsc --noEmit -p tsconfig.app.json` e
   `npm run build` (com as `VITE_*` novas setadas como env temporária pra não falhar por
   variável ausente).
9. **Nunca inventar/inserir sistema novo no banco sem confirmar com o usuário** — sempre
   perguntar antes de rodar INSERT. Pra descobrir o slug real de um sistema que já existe
   (o `sistemas_seed.sql` do repo fica desatualizado), pedir pro usuário rodar no terminal
   do container Postgres do Coolify:
   ```sh
   psql -U crm_admin -d crm_mendonca_galvao -c "SELECT id, nome, slug, url, setor FROM public.sistemas WHERE nome ILIKE '%termo%';"
   ```
10. **Hotfix em produção**: quando algo quebra o build/deploy já mesclado na `main`
    (ex: dependência faltante, env var não propagada), preferir cherry-pick direto pra
    `main` (branch temporária `main-hotfix`, cherry-pick do commit, push, delete branch) em
    vez de esperar um PR normal — só quando for realmente urgente (produção quebrada).

## Erros reais que já aconteceram (não repetir)

- Build quebrou 2x por falta de `ARG`/`ENV` no Dockerfile pra uma env var nova.
- `katex`/`rehype-katex`/`remark-gfm`/`remark-math` faltando no `package.json` do CRM
  (o Copilot usa mas o CRM não tinha) — checar sempre se todas as deps do sistema original
  existem no `frontend/package.json` do CRM antes de assumir que o build vai passar.
- CSRF do Flask bloqueando toda escrita via Bearer (ver item 6 acima).
- CORS não cobrindo uma rota fora de `/api/*` (ver item 6 acima).
- Botão com `position: fixed` de um sistema migrado colidindo com o header do CRM (ver
  item 2 acima) — sempre portalizar controles de UI pro `#system-menu-slot`.
- Tabela do Supabase que o código espera mas nunca foi criada (`regras_classificacao` no
  ContAI) — isso não é bug da migração, é lacuna pré-existente no sistema original; só
  aparece porque agora a feature realmente é alcançável/testável dentro do CRM. Resolver
  com SQL de criação direto no Supabase do sistema, não é código nosso.
- Projeto Supabase "pausado" (plano free) causando erro de DNS (`Name or service not
  known`) — não é bug, é o Supabase precisando ser reativado no painel.

## Próximos sistemas (a fazer na próxima conversa)

1. **Consulta CNPJ** — ainda não investigado. Levantar: repo, stack, auth, se já está
   deployado, se tem slug cadastrado no CRM (perguntar/pedir SELECT antes de assumir).
2. **Taskflow** — ainda não investigado. **Tem Google OAuth** (mencionado pelo usuário) —
   bem provável que siga o padrão de SSO via Supabase (`signInWithIdToken` em
   `unifiedAuth.ts`, como Copilot/BIMG) se usar Supabase Auth, ou o padrão de Bearer JWT
   (como ContAI) se tiver backend próprio validando token do Google diretamente. Confirmar
   qual dos dois casos é, seguindo o mesmo processo de investigação do playbook acima antes
   de escrever qualquer código.

## Pastas de referência

- `frontend/src/systems/contai/` — melhor referência atual pro padrão completo (Bearer JWT,
  seletor de empresa, topbar portalizado, múltiplas páginas com roteamento).
- `frontend/src/lib/unifiedAuth.ts` — todos os blocos de SSO via Supabase num só lugar.
- `frontend/src/hooks/useNativeSystemBase.ts` — hook de navegação obrigatório pra qualquer
  sistema com rotas internas.
