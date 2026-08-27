# Handoff — Migração de sistemas iframe → nativo no CRM

Contexto completo pra continuar o trabalho numa conversa nova. Leia isso antes de começar
qualquer coisa nova nessa frente.

## Onde as coisas estão

- **Branch fixa de trabalho**: `feat/migracoes-arthur` no `CRM_MG`, criada a partir de
  `origin/Features-Edu`. Continuamos commitando e dando push direto nela, abrindo um PR novo
  pra `main` a cada leva de commits prontos pra revisão (não ficamos numa branch por sistema).
- Repos satélite clonados localmente em `C:\Users\User\Projetos\`: `COPILOT_CONTABIL`,
  `BIBM-MG` (BIMG), `ContAI_PRO`, `GERADOR_DE_NOTAS`, `PROJETO-CARNE-LEAO`,
  `CONSULTA-SOCIETARIO`, `TASK_MANANGER`, `ANALYTICS-DP`, `CRONOS_MG`. **`TASK_MANANGER`
  está grafado assim mesmo** (com o typo) — é o nome real do repo em
  `github.com/ndmg-dev/TASK_MANANGER`, não um erro nosso; mantenha a grafia idêntica ao
  clonar/referenciar, "corrigir" pra `TASK_MANAGER` só quebraria o path do clone.

## ⚠️ Gotcha novo: PRs somem sozinhos entre uma ação e outra

Nesta branch, várias vezes um PR recém-aberto já aparecia **mesclado** minutos depois, antes
mesmo de eu confirmar a próxima ação (outra pessoa/processo mescla rápido). **Sempre confirme
com `gh pr view <n> --json state,mergedAt` antes de decidir se dá pra continuar commitando no
mesmo PR ou se precisa abrir um novo.** Se já foi mesclado, abra um PR novo pro commit
seguinte — não dá pra assumir que um PR aberto há alguns minutos ainda está aberto.

## ⚠️ Gotcha novo: sincronização de features pode colidir com trabalho paralelo

Ao sincronizar `ponto-admin` com features novas do `CRONOS_MG`, outra sessão (Eduardo Melo,
commit `717e8aa`) fez uma sincronização parecida em paralelo, com uma decisão de arquitetura
diferente da minha (ele criou uma página própria `/espelho`; a estrutura já existente no CRM
era aba dentro de Relatórios). Isso não apareceu como conflito de merge simples — foi preciso
`git revert`/`git revert` do revert pra reconciliar depois de entender a duplicação. Lição:
**antes de sincronizar features de um satélite já migrado, rode
`git log --oneline -- frontend/src/systems/<sistema>/` pra ver se alguém mexeu recentemente**,
e pergunte ao usuário antes de decidir qual versão prevalece se encontrar sobreposição.

## Sistemas já migrados (nativos, funcionando)

| Sistema | Slug | Repo satélite | Auth |
|---|---|---|---|
| Copilot Contábil | `copilot-contabil` | COPILOT_CONTABIL | Supabase próprio, SSO via `signInWithIdToken` |
| BIMG (Business Intelligence) | `bimg-business-intelligence` | BIBM-MG | Supabase próprio, SSO via `signInWithIdToken` |
| ContAI | `cont-ai` | ContAI_PRO | Sem Supabase — Bearer JWT do próprio CRM |
| Documentação Contábil (era "Gerador de Notas") | `documentacao-contabil` | GERADOR_DE_NOTAS | Sem auth nenhuma (decisão de projeto original, mantida) |
| Contábil Script (Carnê-Leão) | `contabil-script-estatico` | PROJETO-CARNE-LEAO | Sem auth. **Continua hospedado na Vercel** (`https://contabilscript.vercel.app/`), não no Coolify — ver nota abaixo |
| Consulta CNPJ (Consulta Societária) | `consulta-cnpj` | CONSULTA-SOCIETARIO | Sem auth nenhuma (igual ao Documentação Contábil) |
| TaskFlow (NDMG Task Manager) | `taskflow` | TASK_MANANGER | Supabase próprio, SSO via `signInWithIdToken` |
| Analytics DP | `analytics-dp` | ANALYTICS-DP | Gate de senha compartilhada, embutido no sistema, fora do SSO do CRM |
| Ponto Admin (Cronos) | `ponto-admin` | CRONOS_MG | Bearer próprio (`mg_token`), sem SSO — API do Cronos via `VITE_CRONOS_API_URL` |

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
   (Supabase próprio? Google OAuth direto? Sem auth? Senha compartilhada?), onde está
   deployado hoje (Coolify? Vercel? VPS própria?), se já está cadastrado em
   `sistemas_seed.sql`/no banco. **O `sistemas_seed.sql` do repo é só um seed inicial pra
   ambiente novo — nunca é atualizado depois que um sistema é cadastrado/editado direto no
   banco de produção, então diverge por design, não por falta de processo.** Não faz
   sentido manter os dois sincronizados automaticamente; o psql é a fonte de verdade,
   sempre. Delegar essa investigação pra um agente Explore em paralelo (um por sistema)
   economiza contexto.
2. **Portar o frontend** pra `frontend/src/systems/<slug>/`:
   - Entrypoint `<Nome>App.tsx`.
   - Sem `<Router>`/`<BrowserRouter>` aninhado — o sistema é montado em `/sistemas/:id/*`
     dentro do Router do CRM. Usar `useNativeSystemBase`/`useNativeSystemPath`
     (`frontend/src/hooks/useNativeSystemBase.ts`) pra qualquer navegação interna.
     `useNativeSystemPath()('.')` é a rota índice — **nunca** `useNativeSystemPath()('')`
     (isso gera um path com barra sobrando).
   - Nav/topbar do sistema original vira um componente `Topbar.tsx` portalizado pro
     `#system-menu-slot` do header do CRM via `createPortal` (ver
     `frontend/src/systems/contai/components/Topbar.tsx` ou
     `frontend/src/systems/documentacao-contabil/components/Topbar.tsx` como referência),
     não um `<header>`/`<aside>` próprio fixo — senão colide visualmente com os controles do
     CRM (bug real que já aconteceu com o Abertura de Empresa: um botão com
     `position: fixed; top; right` ficava por cima do sino/chat/avatar do CRM). Sistemas com
     sidebar vertical própria (ex: TaskFlow, Analytics DP, Ponto Admin) viram nav horizontal
     no Topbar, sem duplicar avatar/logout/branding que o CRM já mostra.
   - CSS original escopado sob uma classe raiz (`.{sistema}-root`) pra não vazar reset/tema
     pro resto do CRM. **Preferir sempre a ferramenta automatizada em vez de prefixar
     seletor por seletor à mão**: `postcss-prefix-selector` já é devDependency do projeto
     (usada pela primeira vez no Ponto Admin) — escrever um script Node de poucas linhas
     que lê o CSS original, roda o transform, escreve o resultado, e apagar o script depois.
     Isso evita erro humano em seletores compostos/aninhados/media queries que uma edição
     manual (ou regex) facilmente erra. Só recorra à edição manual seletor-a-seletor (como
     foi feito no Consulta CNPJ, antes de estabelecer esse padrão) se o CSS for pequeno o
     bastante pra revisar cada linha com segurança — para qualquer coisa acima de ~100
     linhas, use o script. Prefixar também `@keyframes` (ex: `<sistema>-spin`) pra não
     colidir globalmente entre sistemas — o script de prefixação de seletores não cobre
     isso sozinho, precisa de um passo à parte (rename manual do nome do keyframe + dos
     `animation-name` que o referenciam).
     **Atenção**: se algum elemento for portalizado pra fora dessa árvore (como o Topbar),
     CSS vars definidas só em `.{sistema}-root` não chegam nele — usar valores diretos
     (hex/rgba) nesses casos, não `var(--x)`.
3. **Aliases**: adicionar em `frontend/vite.config.ts` (`resolve.alias`) e
   `frontend/tsconfig.app.json` (`compilerOptions.paths`).
4. **Registry**: `frontend/src/systems/registry.tsx` — `'<slug>': lazy(() => import('@alias/App'))`.
5. **Dockerfile/docker-compose — BUG QUE JÁ ACONTECEU VÁRIAS VEZES**: toda env var `VITE_*`
   nova precisa de `ARG`+`ENV` no `frontend/Dockerfile` **e** de uma entrada em `args:` do
   serviço `frontend` no `docker-compose.yml`. Sem isso, o Coolify até aceita a variável
   configurada no painel, mas ela nunca chega no `npm run build` (Vite só vê env vars que
   existem de verdade no processo do build) — quebra silenciosamente, sem erro óbvio.
6. **Auth — três estratégias, dependendo do sistema original**:
   - **Sistema com Supabase Auth próprio** (Copilot, BIMG, TaskFlow): adicionar um bloco em
     `frontend/src/lib/unifiedAuth.ts` (`establishUnifiedSession`/`endUnifiedSession`) que
     chama `supabase.auth.signInWithIdToken({provider:'google', token: googleIdToken})` com
     o mesmo idToken do Google já validado no login do CRM. Fail-soft (try/catch,
     `console.warn`, nunca bloqueia o login do CRM). **Pendência externa**: o Supabase desse
     sistema precisa ter o Client ID do Google do CRM liberado em Authentication → Providers
     → Google → Authorized Client IDs, senão dá "Unacceptable audience in id_token" (Client
     ID do CRM: ver `GOOGLE_CLIENT_ID` no `.env` da raiz do repo, injetado como
     `VITE_GOOGLE_CLIENT_ID` — é público por natureza, seguro de compartilhar).
   - **Sistema sem Supabase, com backend próprio** (ContAI): backend passa a aceitar
     `Authorization: Bearer <jwt-do-crm>` além do método de auth original, validando o JWT
     com o MESMO `JWT_SECRET` do backend-fastapi do CRM (variável nova no sistema satélite:
     `CRM_JWT_SECRET`, precisa ser **exatamente igual**). O JWT do CRM precisou ganhar um
     claim `email` extra (`backend-fastapi/app/core/security.py`,
     `create_access_token(..., extra_claims={"email": user.email})`) pra o backend satélite
     conseguir validar domínio sem consultar o Postgres do CRM. Isso é SSO automático e mais
     simples que o Supabase (não depende de nenhuma config externa) — **preferir essa
     abordagem quando o sistema não tiver Supabase Auth já embutido**.
   - **Sistema com auth própria "fraca" que não vale a pena trocar** (Analytics DP: gate de
     senha compartilhada; Ponto Admin/Cronos: Bearer próprio `mg_token`): manter a
     autenticação exatamente como está, embutida dentro do sistema nativo (tela de
     login/senha própria continua sendo a primeira coisa renderizada dentro do
     `<Sistema>App.tsx`), **sem integrar com o SSO do CRM nem com `unifiedAuth.ts`**. Não é
     uma migração incompleta — é a decisão certa quando o sistema original já tem um esquema
     de auth "self-contained" que funciona e não expõe token do CRM. **Isso não é o mesmo
     risco que "sem auth nenhuma"** (item abaixo): aqui existe uma barreira de acesso real
     (senha ou token), só que mais fraca que SSO/JWT — decisão consciente, confirmada com o
     usuário via AskUserQuestion antes de portar (não é algo pra "corrigir" sozinho depois;
     se achar que o nível de segurança de algum desses sistemas ficou baixo demais pro dado
     que ele expõe, isso é uma decisão de produto pra levar ao usuário, não um bug de
     migração).
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
     `resources` do `CORS()`. Sistemas com `allow_origins=["*"]` (Consulta CNPJ, Analytics
     DP) já cobrem isso de cara, sem mudança nenhuma.
   - **Sistema sem nenhuma auth** (Documentação Contábil, Contábil Script, Consulta CNPJ):
     não inventar auth nova — só confirmar que o CORS do backend original libera a origem do
     CRM (`https://crmmg.mendoncagalvao.com.br`). Esses três não lidam com dado sensível
     de pessoa física/financeiro protegido — é decisão de projeto original (não nossa),
     mantida por fidelidade ao sistema fonte. **Se algum sistema futuro sem auth lidar com
     dado sensível, isso é motivo pra parar e perguntar ao usuário antes de portar** em vez
     de replicar a ausência de auth automaticamente só porque "é assim que já era".
7. **Padrão de seletor de "empresa ativa"** (multi-tenant por sessão): sistemas que
   dependiam de `session['active_empresa']` (Flask) quebram numa API stateless via Bearer —
   cada chamada precisa do `empresa_id` explícito (query param). Solução: endpoint
   `GET /empresas/lista` já costuma existir (só protegido por `login_required`, então já
   funciona com Bearer sem mudança de backend); o frontend guarda a escolha em
   `localStorage` (chave escopada tipo `<sistema>_empresa_id`) e passa `empresa_id` em toda
   chamada subsequente. Seletor visual: pill dourada no topbar portalizado (ver
   `frontend/src/systems/contai/components/Topbar.tsx` + `context/EmpresaContext.tsx`).
   Não confundir com um filtro local simples de "empresa" numa página só (ex: Analytics DP,
   `CompanySelect.tsx`) — esse é estado de componente React comum, não precisa desse
   padrão.
8. **Dependências diferentes entre sistemas são normais** — cada sistema satélite pode trazer
   sua própria lib de gráfico (Recharts na maioria, ECharts no Analytics DP), grid/planilha
   (`exceljs`/`file-saver` no Analytics DP), etc. Não force todos os sistemas a usar a mesma
   lib, EXCETO quando já existe uma lib equivalente estabelecida no CRM pro mesmo propósito
   (ex: drag-and-drop — o CRM já usa `@hello-pangea/dnd`, então o TaskFlow foi **reescrito**
   de `@dnd-kit/*` pra `@hello-pangea/dnd` em vez de adicionar uma segunda lib de D&D;
   ícones — o CRM usa `lucide-react`, não `react-icons`, então todo sistema que vier com
   `react-icons` precisa ter os ícones trocados um a um pro equivalente mais próximo em
   lucide). Essa é uma decisão de arquitetura pra confirmar com o usuário antes de portar
   (pergunta feita via AskUserQuestion nas migrações do TaskFlow).
9. **Validar antes de commitar**: `cd frontend && npx tsc --noEmit -p tsconfig.app.json` e
   `npm run build` (com as `VITE_*` novas — e as de TODOS os outros sistemas nativos já
   existentes — setadas como env temporária pra não falhar por variável ausente; a lista
   cresce a cada sistema, ver os comandos usados nas migrações recentes como referência de
   quais setar). **Sempre revalidar com tsc/build de novo depois de qualquer
   merge/revert/cherry-pick** — um merge "limpo" (sem conflitos reportados pelo git) ainda
   pode gerar erros de tipo/duplicação que só aparecem no tsc (ver gotcha do
   `MonthlyReportTab.tsx` abaixo).
10. **Nunca inventar/inserir sistema novo no banco sem confirmar com o usuário** — sempre
    perguntar antes de rodar INSERT. Pra descobrir o slug real de um sistema que já existe
    (o `sistemas_seed.sql` do repo fica desatualizado), pedir pro usuário rodar no terminal
    do container Postgres do Coolify (**atenção**: é só a linha do `psql`, sem `echo`/`cat`
    na frente — já aconteceu do usuário colar o wrapper inteiro por engano):
    ```sh
    psql -U crm_admin -d crm_mendonca_galvao -c "SELECT id, nome, slug, url, setor FROM public.sistemas WHERE nome ILIKE '%termo%';"
    ```
11. **Hotfix em produção**: quando algo quebra o build/deploy já mesclado na `main`
    (ex: dependência faltante, env var não propagada), preferir cherry-pick direto pra
    `main` (branch temporária `main-hotfix`, cherry-pick do commit, push, delete branch) em
    vez de esperar um PR normal — só quando for realmente urgente (produção quebrada).
12. **Delegar pra agentes em background quando o escopo for grande e bem especificado**:
    depois de investigar (stack/auth/deploy) e travar as decisões de arquitetura com o
    usuário, a implementação mecânica (portar páginas/componentes, adaptar navegação,
    escopar CSS) pode ser delegada a um agente `Agent` em background com um prompt bem
    detalhado (citando arquivos de referência exatos, decisões já tomadas, padrões a
    seguir). Sempre **revalidar você mesmo** com tsc/build independentemente do que o agente
    reportar, e ler os arquivos mais sensíveis (auth, entrypoint, api client) antes de
    considerar pronto — o agente pode reportar sucesso mas ainda ter cometido pequenos
    desvios do padrão esperado.

## Sincronizar features de um sistema já migrado (não é migração nova)

Quando o satélite avança (novas features, fixes) depois que o sistema já foi portado pro
CRM, é preciso reaplicar só o delta:
1. Descobrir o commit do satélite que era HEAD no momento da migração original (procurar no
   corpo do commit de migração no CRM — geralmente cita o repo e às vezes a data; cruzar com
   `git log --before=<data> -1 <branch>` no repo satélite).
2. `git diff <baseline>..origin/main --stat -- <pasta-do-frontend-no-satélite>` pra ver o
   escopo exato do que mudou.
3. Mapear caminho por caminho (`<satélite>/frontend/X` → `frontend/src/systems/<slug>/X`) e
   aplicar a MUDANÇA DE COMPORTAMENTO em cada arquivo — nunca um `git apply`/patch direto,
   porque o arquivo do CRM já diverge do satélite nas adaptações de navegação/CSS/auth.
4. CSS novo/alterado precisa passar pelo mesmo tratamento de prefixação que o resto do
   sistema (script Node temporário com `postcss-prefix-selector`, apagar depois de gerar).
5. **Antes de sincronizar, confirme que ninguém mais mexeu nesse sistema recentemente** —
   rode `git log --oneline -10 -- frontend/src/systems/<slug>/` no CRM_MG. Se aparecer um
   commit recente (últimas horas) de outra pessoa tocando o mesmo sistema, **leia a mensagem
   do commit dela antes de começar**, não só depois de esbarrar num conflito:
   - Se o escopo dela é claramente diferente do seu (arquivos/páginas diferentes), pode
     seguir normalmente — só vai ficar de olho num merge futuro.
   - Se o escopo se sobrepõe (mesma feature, mesmo arquivo grande), **pare e pergunte ao
     usuário antes de investir tempo portando** — foi exatamente essa checagem que faltou
     na sincronização do Ponto Admin (ver caso real no gotcha do topo: duas sincronizações
     do mesmo satélite, decisões de arquitetura diferentes, só descoberto na hora do PR já
     ter conflito). O sinal de que virou conflito de arquitetura (não só textual) é quando
     `git diff`/`git merge` não reporta conflito nenhum mas o resultado tem duas
     implementações da mesma coisa (dois componentes, duas rotas, dois imports pro mesmo
     conceito) — nesse caso, resolva perguntando ao usuário qual versão deve prevalecer
     (`AskUserQuestion` com as duas opções descritas objetivamente), não decida sozinho qual
     "parece melhor". Depois de decidido, `git revert` do commit descartado (nunca
     `reset --hard`/force-push numa branch compartilhada) é o jeito seguro de desfazer sem
     perder histórico, e dá pra "desfazer o revert" (`git revert` de novo em cima do próprio
     revert) se a decisão mudar de lado depois.
6. Depois de terminar, **cheque se o satélite avançou mais um commit enquanto você
   trabalhava** — já aconteceu (Ponto Admin: um fix upstream removendo cards/filtros
   redundantes chegou minutos depois do meu snapshot) — reabra o diff contra o HEAD atual do
   satélite antes de dar como concluído.

## Erros reais que já aconteceram (não repetir)

- Build quebrou por falta de `ARG`/`ENV` no Dockerfile pra uma env var nova (aconteceu
  várias vezes, com sistemas diferentes).
- `katex`/`rehype-katex`/`remark-gfm`/`remark-math` faltando no `package.json` do CRM
  (o Copilot usa mas o CRM não tinha) — checar sempre se todas as deps do sistema original
  existem no `frontend/package.json` do CRM antes de assumir que o build vai passar. Mesma
  checagem precisou ser feita pra `echarts`/`echarts-for-react`/`exceljs`/`file-saver`/`zod`/
  `@hookform/resolvers` (Analytics DP).
- CSRF do Flask bloqueando toda escrita via Bearer (ver item 6 do playbook acima).
- CORS não cobrindo uma rota fora de `/api/*` (ver item 6 do playbook acima).
- Botão com `position: fixed` de um sistema migrado colidindo com o header do CRM (ver
  item 2 do playbook) — sempre portalizar controles de UI pro `#system-menu-slot`.
- Tabela do Supabase que o código espera mas nunca foi criada (`regras_classificacao` no
  ContAI) — isso não é bug da migração, é lacuna pré-existente no sistema original; só
  aparece porque agora a feature realmente é alcançável/testável dentro do CRM. Resolver
  com SQL de criação direto no Supabase do sistema, não é código nosso.
- Projeto Supabase "pausado" (plano free) causando erro de DNS (`Name or service not
  known`) — não é bug, é o Supabase precisando ser reativado no painel.
- `useNativeSystemPath()('')` gera path com barra sobrando — usar `'.'` pra rota índice.
- `npm install` sem `--legacy-peer-deps` falha depois de um merge que trouxe dependências
  novas de outro sistema, por conflito de peer-deps (`@vanilla-extract/vite-plugin` vs
  Vite 8) — sempre usar `--legacy-peer-deps`, mesma flag do Dockerfile.
- Auto-merge do Git (via `git revert`/`git merge`) pode gerar **duplicação silenciosa** de
  código em vez de conflito explícito — aconteceu com `MonthlyReportTab.tsx` (duas cópias de
  funções/estado no mesmo arquivo, sem marcador de conflito, só descoberto pelo `tsc`
  reclamando de "Duplicate function implementation"/"Cannot redeclare block-scoped
  variable"). Sempre rodar `tsc` depois de qualquer merge/revert antes de confiar que "sem
  conflito reportado" = "arquivo correto".
- Duas sincronizações paralelas do mesmo satélite por pessoas diferentes podem convergir
  pra soluções estruturalmente diferentes (aba vs. página própria) — ver gotcha no topo.
- PR mesclado poucos minutos depois de aberto, antes da próxima ação — ver gotcha no topo.
- Usuário colou um comando `psql` prefixado com o `echo`/`cat` que eu tinha usado só pra
  *mostrar* o comando — sempre deixar claríssimo "cole só esta linha" quando o comando psql
  for pra rodar de verdade.

## Próximos sistemas / pendências em aberto

- Nenhum sistema novo identificado no momento — os últimos quatro (Consulta CNPJ, TaskFlow,
  Analytics DP, sync do Ponto Admin) foram concluídos e mesclados nesta leva.
- Pendências externas (não são código, são configuração/infra que o usuário precisa aplicar):
  - TaskFlow: confirmar que `CORS_ORIGINS` no Coolify do TaskFlow inclui
    `https://crmmg.mendoncagalvao.com.br` (default no código é só localhost).
  - TaskFlow: Client ID do Google do CRM liberado no Supabase do TaskFlow (Authentication →
    Providers → Google → Authorized Client IDs) — client ID:
    `832182018740-ru8c14qeek4p2qk7ga8otu1c2o3b6tsm.apps.googleusercontent.com`.
  - Configurar no Coolify (build args do frontend): `VITE_CNPJ_API_URL`,
    `VITE_TASKFLOW_SUPABASE_URL`, `VITE_TASKFLOW_SUPABASE_ANON_KEY`, `VITE_TASKFLOW_API_URL`,
    `VITE_ANALYTICS_DP_API_URL` (já preparadas no Dockerfile/docker-compose, só falta
    preencher os valores no painel).
- Melhoria de UI feita nesta leva, sem relação com migração de sistemas: o menu lateral do
  CRM (`frontend/src/components/layout/Sidebar.tsx`) ganhou de volta um toggle pra
  expandir/recolher o rail (tinha sido removido no redesign em cascata, commit `324b120`).
  Estado em `useUIStore` (`sidebarExpanded`, persistido em localStorage). O menu de
  "Sistemas" agora é o mesmo componente (`SystemsMenu.tsx`, flyout com busca e cascata) nos
  dois estados — antes o expandido usava um acordeão simples diferente do flyout do
  recolhido.

## Pastas de referência

- `frontend/src/systems/contai/` — melhor referência atual pro padrão completo (Bearer JWT,
  seletor de empresa, topbar portalizado, múltiplas páginas com roteamento).
- `frontend/src/systems/documentacao-contabil/` e `frontend/src/systems/consulta-cnpj/` —
  melhor referência pra sistema sem nenhuma auth, com CSS próprio escopado manualmente.
- `frontend/src/systems/taskflow/` — referência de SSO via Supabase + reescrita de
  drag-and-drop pra `@hello-pangea/dnd` + troca de ícones `react-icons`→`lucide-react`.
- `frontend/src/systems/analytics-dp/` — referência de auth "self-contained" (gate de senha
  própria) mantida fora do SSO do CRM, e de biblioteca de gráfico diferente (ECharts).
- `frontend/src/systems/ponto-admin/` — referência de CSS prefixado via
  `postcss-prefix-selector` (script Node temporário) em vez de prefixação manual, útil
  quando o CSS original é grande/complexo demais pra regex.
- `frontend/src/lib/unifiedAuth.ts` — todos os blocos de SSO via Supabase num só lugar.
- `frontend/src/hooks/useNativeSystemBase.ts` — hook de navegação obrigatório pra qualquer
  sistema com rotas internas.
- `frontend/src/components/layout/Sidebar.tsx` — menu lateral do CRM (rail recolhido/
  expandido), `SystemsMenu.tsx` — flyout de sistemas em cascata (busca + categorias).
