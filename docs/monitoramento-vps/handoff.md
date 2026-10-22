# Handoff — Monitoramento da VPS Hostinger dentro do CRM

Contexto completo pra construir, numa conversa nova, uma "semiaplicação" nativa no CRM
(aba **Tecnologia (TI)**) que monitora a VPS da Hostinger onde o próprio CRM roda —
métricas, histórico, containers/deploys, disco, firewall, snapshots, insights e (fase
final) ações — sem precisar abrir o hPanel da Hostinger.

Leia isto inteiro antes de começar. Leia **também** `docs/migracoes/handoff.md` — ele tem
o playbook de "sistema nativo no CRM" (Dockerfile ARG/ENV, CSS escopado, Topbar
portalizado, `useNativeSystemPath`, registro no banco, o padrão de proxy server-to-server)
que este trabalho reaproveita quase inteiro.

---

## 1. O alvo

- VPS: **`srv1424388.hstgr.cloud`**, IPv4 **`72.60.14.4`**, plano **KVM 4**, **Ubuntu 24.04**.
- Roda **Coolify**, que orquestra todos os deploys (CRM frontend/backend/postgres + os
  satélites que estão no Coolify: ContAI, Ponto Admin, etc.).
- **O backend do CRM (`crmapi.mendoncagalvao.com.br`) roda NESTA MESMA VPS** — o endereço
  remoto das respostas é `72.60.14.4`. Isso é importante: o container do backend pode ler
  o Docker daemon local e métricas de host **sem SSH**.
- Estado atual visto no hPanel: CPU ~71%, RAM ~74%, disco **67 GB / 200 GB**, tráfego
  saída 23.8 MB, entrada 56.2 MB, 2 snapshots/backups, Monarx (malware) ativo.

## 2. Fontes de dados (pesquisadas, confirmadas)

### 2.1 Hostinger API — a fonte principal

- **Base:** `https://developers.hostinger.com/api/`
- **Auth:** `Authorization: Bearer <token>`. Token gerado no hPanel → **Dev Tools → API →
  Generate Token** (com data de expiração; some da tela após refresh). Herda as permissões
  do usuário.
- **Rate limit: 90 req/min por IP** (`X-RateLimit-Limit`/`-Remaining`/`Retry-After`). ⚠️
  **Obriga cache no backend** — o frontend NUNCA fala com a Hostinger direto nem faz o
  backend chamar a Hostinger a cada widget.
- Endpoints VPS (`/api/vps/v1/...`) relevantes — spec completa em
  `https://github.com/hostinger/api/blob/main/openapi.json`:

  | Endpoint | O que dá |
  |---|---|
  | `GET /virtual-machines` | lista → pega o `virtualMachineId` (guardar em env/config) |
  | `GET /virtual-machines/{id}` | `state` (running/stopped/error/…), `plan`, `cpus`, `memory` (MB), `disk` (MB), `bandwidth` (MB/mês), `hostname`, `ipv4`/`ipv6`, `firewall_group_id`, `data_center_id`, `actions_lock` (locked durante ação), `ns1`/`ns2` |
  | `GET /virtual-machines/{id}/metrics?date_from=&date_to=` | **série temporal** — `cpu_usage` (%), `ram_usage` (bytes), `disk_space` (bytes usados), `incoming_traffic`/`outgoing_traffic` (bytes), `uptime` (ms). Formato de cada um: `{ "unit": "...", "usage": { "<epoch>": valor, ... } }`. `date_from`/`date_to` são **obrigatórios** (ISO 8601). |
  | `GET /virtual-machines/{id}/actions` + `/{actionId}` | histórico e status de ações (trilha de auditoria da própria Hostinger — quem reiniciou, quando) |
  | `GET/POST/DELETE /virtual-machines/{id}/snapshot` | snapshot (só **1** permitido — criar substitui o anterior; DELETE apaga) |
  | `GET /virtual-machines/{id}/backups` + `POST .../backups/{backupId}/restore` | backups automáticos + restore |
  | `POST /virtual-machines/{id}/restart` \| `recreate` \| `recovery` (+ `DELETE .../recovery`) | ações de força (async) |
  | `GET /firewall` + `/{firewallId}` + rules CRUD + `activate`/`deactivate`/`sync/{vmId}` | firewall |
  | `GET /virtual-machines/{id}/monarx` | métricas do scan de malware (o "Detector de malware: Ativo") |
  | `GET /virtual-machines/{id}/docker` + `/docker/{projectName}/containers` \| `/logs` \| `restart`\|`start`\|`stop`\|`update` | visão da Hostinger dos projetos docker-compose na VPS (= as stacks do Coolify) |
  | `GET /virtual-machines/{id}/public-keys` | chaves SSH atreladas |

- **O que a Hostinger API NÃO dá** (precisa de coletor na própria VPS):
  - breakdown de disco por diretório (`du`), uso de inode, **`docker system df`** (imagens
    dangling / volumes órfãos / build cache — provável causa dos 67 GB, o Coolify acumula
    camadas de build);
  - load average, uso por core, breakdown por processo;
  - health de unidades systemd, erros no journald;
  - conexões de rede / portas ouvindo;
  - granularidade fina de tempo (o sampling da Hostinger é de minutos).

### 2.2 Docker local (coletor na VPS, sem SSH)

O container do backend do CRM roda na VPS. Montar **`/var/run/docker.sock:/var/run/docker.sock:ro`**
no serviço `backend` do `docker-compose.yml` e usar o SDK `docker` (pip) pra:
- `docker system df` (imagens/volumes/build-cache/containers com tamanho e "reclaimable");
- `docker ps` + `stats` (CPU/mem por container, health, restart count, uptime);
- mapear container → stack do Coolify (label `coolify.*`).

Risco: `docker.sock` mesmo `:ro` dá bastante poder. Decisão consciente — o backend já é
infra confiável e a leitura fica atrás de `get_current_user` + provável `require_roles`.
Alternativa mais fechada: um exporter dedicado (cAdvisor/node_exporter) num container
próprio e o backend só faz scrape HTTP dele.

### 2.3 Coolify API (opcional, fase 2)

- Base `http://<coolify>/api/v1`, `Authorization: Bearer <token>` (escopo = time; permissões
  read/write/deploy). Rate limit 200/min. Docs: `https://coolify.io/docs/api-reference`.
- Dá: lista de servidores, recursos (apps/DBs/services) + status, **histórico de deploys +
  falhas + logs**, deploy por uuid/tag, cancelar build, domínios.
- É a camada de "gestão" que responde "que deploy quebrou / o que está consumindo": casa
  com o painel de Containers/Deploys.

## 2.4 Decisões travadas com o usuário (Fase 0)

1. **Acesso:** todo o **setor de TI** (não só `admin`).
2. **Ações de escrita:** **já na v1** (restart de stack, redeploy, etc.).
   - ⚠️ **Recomendação registrada, decisão de produto do usuário:** ações de nível-VPS que
     derrubam o próprio CRM — `restart` / `recreate` / `recovery` / `restore` de snapshot da
     VPS — devem exigir **confirmação digitada** ("digite REINICIAR") e ficar **admin-only**
     mesmo com o resto liberado pro TI. O backend do CRM roda nesta VPS: um restart reinicia
     o CRM e os satélites por 1–2 min e o operador não vê o resultado até voltar. Levar isso
     de volta ao usuário na implementação da Fase 4 (ou v1, já que ações entram na v1).
3. **Coletor:** **híbrido** — leitura via exporters dedicados
   (`docker-socket-proxy` read-only + `cadvisor` + `node_exporter`), o backend do CRM faz
   scrape HTTP deles. **Nenhum processo tem escrita no `docker.sock`.** As ações de escrita
   vão pela **Hostinger API** e **Coolify API** (HTTP + token), não pelo socket. `docker
   prune` (única que quereria escrita) → via endpoints docker da Hostinger ou adiada.
   - Motivo de não montar o socket direto no backend: `:ro` no socket **não** deixa a API do
     Docker read-only (ainda dá `POST /containers/create`); uma RCE no backend do CRM viraria
     takeover do host inteiro. O proxy read-only fecha isso; exporters dão métrica muito mais
     rica de graça; e um bug no coletor não derruba o CRM.
4. **Coolify API:** **sim.** Token gerado no Coolify (avatar → Keys & Tokens → API Tokens →
   Create, permissões **read** + **deploy**, escopo do time do CRM, copiar na hora).
   Habilitar a API em Settings → API. Domínio público: **`https://coolify.nucleodigital.cloud/`**
   (API em `https://coolify.nucleodigital.cloud/api/v1`). **Preferir chamar pelo endereço
   interno** (mesma VPS: `http://coolify:8000` / `localhost:8000`) pra evitar allowlist de IP
   e o domínio público — confirmar o nome/porta do container do Coolify na rede docker.
5. **Persistência de histórico:** só na **Fase 3** (v1 usa a janela de histórico da própria
   Hostinger API).

## 3. Arquitetura proposta (segue o playbook do CRM)

- **Frontend:** `frontend/src/systems/vps-monitor/` (slug **a confirmar** — sugestão
  `vps-monitor` ou `monitoramento-vps`). React nativo, montado em `/sistemas/:id/*`,
  **sem `<Router>` próprio** (`useNativeSystemPath`), **Topbar portalizado** pro
  `#system-menu-slot`, CSS escopado sob `.vps-monitor-root`, **recharts@2** (o do CRM — não
  subir versão), ícones **lucide-react**.
- **Backend:** módulo novo em `backend-fastapi/app/api/v1/endpoints/vps_monitor.py` (ou uma
  pasta `vps/`), incluído no `router.py` com prefixo `/vps`. Guarda `HOSTINGER_API_TOKEN`,
  `COOLIFY_API_TOKEN`, `COOLIFY_API_URL` (interno) e o `virtualMachineId`; faz **cache
  agressivo** (TTL 30–60s, `cachetools.TTLCache` em memória do processo basta pra 1 VM) de
  todas as chamadas Hostinger/Coolify; faz scrape dos exporters. Leitura atrás de
  `get_current_user` (qualquer usuário do setor TI); ações VPS-level atrás de
  `require_roles(['admin'])` + confirmação digitada (ver decisão 2).
- **Exporters (containers novos no `docker-compose.yml` da raiz):** `docker-socket-proxy`
  (env: só `CONTAINERS=1 IMAGES=1 INFO=1 ... POST=0`), `cadvisor`, `node_exporter` (com
  `--path.rootfs=/host` e mounts de `/`, `/proc`, `/sys` read-only). Rede interna, sem porta
  pública. O backend do CRM lê o texto Prometheus deles.
- **Cliente HTTP no frontend:** **NÃO repetir os bugs do `dre_proxy`** (ver `docs/migracoes/handoff.md`
  e o histórico de PRs abaixo). Construir certo desde o início:
  - base = `import.meta.env.VITE_API_BASE_URL` (URL **absoluta** do backend — o nginx do
    frontend NÃO roteia `/api`);
  - `cache: 'no-store'` no `fetch`;
  - o proxy do backend, se for proxy puro, tira `If-None-Match`/`If-Modified-Since` na ida e
    `ETag`/`Last-Modified` na volta, e manda `Accept-Encoding: identity` (ou instala
    `brotli`); mas aqui provavelmente o backend **transforma** os dados (agrega, calcula
    insights) em vez de repassar cru, então nem cai nesses problemas.
- **Persistência (fase 3):** tabela `vps_metrics_snapshot` no Postgres do CRM + um job
  periódico. O backend **não tem scheduler hoje** — adicionar APScheduler, ou um
  `asyncio` task no lifespan, ou um cron externo batendo num endpoint interno. Retém
  histórico além da janela da Hostinger e alimenta os gráficos de tendência e o motor de
  alertas.
- **Alertas/Insights:** regras determinísticas no backend (disco > 80%, RAM > 90%
  sustentada, projeção de tráfego vs. franquia mensal, container em loop de restart, deploy
  falhado, snapshot mais velho que N dias, VPS fora de `running`, achados do Monarx).
  Exibir no dashboard; críticos podem ir pro sistema de **notificações** do CRM (já existe
  `app/models/notification.py`).
- **Auditoria:** toda ação (restart, snapshot, prune, redeploy) grava em `audit_log` (já
  existe `app/models/audit_log.py`) e passa por modal de confirmação.
- **Registro no banco:** INSERT em `public.sistemas`, `setor` = valor real do setor de TI
  (o menu mostra "TECNOLOGIA (TI)" — **confirmar via psql**, provavelmente `TECNOLOGIA`),
  `url = '#'`, `allowed_origin = NULL`, `icone` tipo `activity`/`cpu`/`server`/`gauge`,
  `ativo = true`. O slug tem que bater com a chave no `frontend/src/systems/registry.tsx`.
  **Nunca rodar o INSERT sem o usuário confirmar** (ver playbook, item 10).

## 4. Telas (proposta)

1. **Visão Geral** — estado da VPS (badge running/…), plano, uptime; gauges CPU / RAM /
   disco (usado vs. provisionado) com sparkline de 24h; tráfego do mês vs. franquia;
   contadores de containers rodando / com problema; nº de alertas abertos.
2. **Histórico** — CPU, RAM, disco, tráfego in/out em gráficos de linha com seletor
   24h / 7d / 30d (Hostinger `metrics`; depois da fase 3, janelas maiores da nossa tabela).
3. **Containers & Deploys** — tabela de containers (stack do Coolify, CPU/mem, health,
   restarts, uptime); últimos deploys e falhas (Coolify API); ação de redeploy/restart
   por stack (gated).
4. **Disco** — `docker system df` (imagens/volumes/build-cache com "reclaimable"),
   breakdown por diretório, sugestões de limpeza ("X GB em imagens dangling",
   "build cache: Y GB") + botão de prune específico (gated).
5. **Rede & Firewall** — regras do firewall (Hostinger), portas ouvindo, tráfego;
   edição de regra (gated, fase 4).
6. **Snapshots & Backups** — snapshot atual + idade + botão criar/restaurar (com aviso
   grande: **só 1 snapshot, criar substitui**); lista de backups automáticos + restore.
7. **Ações & Auditoria** — histórico de ações (Hostinger `/actions` + nosso `audit_log`);
   botões de restart/recovery da VPS (gated, confirmação dupla).
8. **Insights** — lista priorizada de alertas/recomendações com severidade.

## 5. Faseamento

- **Fase 0 — Prep (decisões de produto já travadas, ver §2.4):**
  - **PENDENTE do usuário:** gerar `HOSTINGER_API_TOKEN` (hPanel → Dev Tools → API);
    gerar `COOLIFY_API_TOKEN` (read + deploy); informar `COOLIFY_API_URL` (domínio ou
    `http://coolify:8000` interno).
  - confirmar `setor` real de TI e slug livre via psql; rodar `GET /virtual-machines` uma
    vez pra pegar o `virtualMachineId`.
  - levar ao usuário, na implementação, o detalhe da confirmação digitada + admin-only pras
    ações VPS-level (decisão 2 do §2.4).
- **Fase 1 — Leitura, só Hostinger API (risco zero):** backend com cache + endpoints pra
  `virtual-machines/{id}`, `/metrics`, `/snapshot`, `/backups`, `/actions`, `/firewall`,
  `/monarx`. Frontend: telas 1, 2, 5 (read-only), 6 (read-only), 7 (só histórico).
  Registrar o sistema no banco. **Entregável: dashboard funcional read-only.**
- **Fase 2 — Docker/Coolify:** montar `docker.sock:ro`, SDK docker → tela 3 e 4; opcional
  Coolify API pra histórico de deploy.
- **Fase 3 — Persistência & alertas:** tabela + poller + motor de insights (tela 8) +
  integração com notificações do CRM.
- **Fase 4 — Ações gated:** restart/recovery/recreate da VPS, criar/restaurar snapshot,
  prune docker específico, redeploy Coolify — cada uma com `require_roles(['admin'])`,
  modal de confirmação e `audit_log`. Ações Hostinger são **assíncronas** → dar poll em
  `/actions/{actionId}` até concluir; respeitar `actions_lock`.

## 6. Gotchas a lembrar

- **Rate limit Hostinger 90/min** — cache no backend, sempre. Uma VM só, então TTL de 30–60s
  cobre um dashboard com auto-refresh sem estourar.
- **`metrics` exige `date_from`/`date_to`** e devolve `{unit, usage:{epoch:val}}` — precisa
  transformar pro formato do recharts (`[{t, v}]`), e converter bytes→GB / ms→dias no
  backend pra o frontend não recalcular.
- **`disk` (detalhes) ≠ `disk_space` (métrica)**: um é provisionado (MB), o outro é uso real
  (bytes). O hPanel mostra 200 GB de disco — confirmar os números reais pela API.
- **Snapshot: só 1.** Botão de "criar snapshot" tem que avisar que substitui o existente.
- **Ações são assíncronas** e travam a VM (`actions_lock: locked`) — a UI precisa refletir
  isso e não deixar disparar duas.
- **O backend do CRM roda na VPS** — `docker.sock` é local, `localhost` é a própria VPS.
  Isso é o que torna o coletor viável sem SSH; também significa que um bug no coletor pode
  impactar o host — manter leitura, read-only, com timeout curto.
- **Não copiar os bugs do `dre_proxy`** (ver seção 3 e o histórico abaixo): URL absoluta,
  `no-store`, sem ETag passthrough, `Accept-Encoding` controlado.
- **Backend sem scheduler hoje** — a fase 3 introduz um; escolher a abordagem menos
  invasiva (asyncio task no lifespan do FastAPI é o mais simples).
- **INSERT no banco só com confirmação do usuário** (playbook item 10). A tabela
  `public.sistemas` exige `created_at`/`updated_at` NOT NULL sem default — passar `now()`.

## 7. Onde as coisas estão / padrões de referência

- `docs/migracoes/handoff.md` — playbook completo de sistema nativo + todos os gotchas.
- `backend-fastapi/app/api/v1/endpoints/dre_proxy.py` — referência de proxy server-to-server
  com token injetado server-side + `get_current_user`. **Referência do padrão, não do
  código** — ele passou por 4 PRs de bug fix nesta leva (ver abaixo).
- `frontend/src/systems/dashboard-dre/lib/api.ts` — como montar a base de API certa
  (`VITE_API_BASE_URL` absoluto + `cache: no-store`).
- `frontend/src/systems/analytics-dp/` e `frontend/src/systems/contai/` — telas nativas com
  Topbar portalizado, múltiplas rotas, seletor no topo, gráficos.
- `backend-fastapi/app/core/security.py` — `get_current_user`, `require_roles`.
- `backend-fastapi/app/models/{audit_log,notification}.py` — auditoria e notificações.
- `frontend/src/systems/registry.tsx`, `frontend/vite.config.ts`, `frontend/tsconfig.app.json`,
  `frontend/Dockerfile`, `docker-compose.yml` (raiz) — a fiação de todo sistema nativo.

---

## 8. Estado da conversa que gerou este handoff (o que já foi feito no CRM nesta leva)

Branch de trabalho das migrações: **`feat/migracoes-arthur`** (mas os fixes recentes saíram
em branches próprias a partir da `main`, porque a `main` não tem branch protection e PRs são
mesclados minutos depois de abertos — **sempre `gh pr view <n> --json state,mergedAt` antes
de continuar num PR**).

### 8.1 Dash RH — iframe → nativo (concluído, mesclado)
- CRM PR **#85** (mesclado). Sistema `frontend/src/systems/dash-rh/` (React 19 + Vite,
  **mantido em `.jsx`** — o satélite HR-DASH-MG é 100% JS sem TS, decisão travada).
- Auth: **SSO via Bearer JWT do CRM** (padrão ContAI). Backend do satélite mudou
  (`ndmg-dev/HR-DASH-MG` PR **#1**): `app/auth.py`, dependency global em `/api/*`, Área
  Restrita com allowlist de e-mail (`HR_CONFIDENTIAL_ALLOWLIST`) no lugar da senha em texto
  puro.
- CRM PR **#86** (mesclado): fix dos gráficos de barra — `BarChart.jsx` envolvia `<XAxis>`/
  `<YAxis>` num `React.Fragment`, que o recharts@2 (do CRM) não enxerga (o satélite usava
  recharts@3). Eixos agora são filhos diretos.
- Pendências de infra (Coolify): `VITE_DASHRH_API_URL`; `HR_CRM_JWT_SECRET` (= `JWT_SECRET`
  do backend-fastapi); `HR_CONFIDENTIAL_ALLOWLIST`. Já aplicadas pelo usuário (o SSO está
  funcionando).
- Detalhes no `docs/migracoes/handoff.md` (foi atualizado com a linha do Dash RH).

### 8.2 TaskFlow — fix do Kanban (mesclado)
- CRM PR **#91** (mesclado). `.kanban-card` tinha fundo translúcido + `backdrop-filter`
  próprio aninhado no `backdrop-filter` da coluna → compositor rasgava no drag do
  `@hello-pangea/dnd` ("colapsando/travando") e o texto vazava. Fix só CSS em
  `frontend/src/systems/taskflow/styles/global.css`: fundo opaco `#14141f`, sem
  `backdrop-filter` no card, `min-width:0` + `overflow:hidden`, keyframe `flip-to-green`
  com estados opacos. Bug pré-existente, não relacionado a migração.

### 8.3 Menu da conta no avatar + limpeza da sidebar (mesclado)
- CRM PR **#118** (mesclado). `Header.tsx`: avatar (canto sup. dir.) virou botão com menu
  (nome/e-mail + Sair). `Sidebar.tsx`: removidos os 3 botões do rodapé — "Alterar senha" e
  "Tema escuro" eram mockups sem handler (e login é Google OAuth); "Sair" foi pro menu do
  avatar. Rodapé da sidebar mantém só o e-mail.

### 8.4 Zero-downtime deploy — TENTADO E REVERTIDO ⚠️
- CRM PR **#99** (mesclado) adicionou `healthcheck` no `backend` e `frontend` do
  `docker-compose.yml` + `GET /healthz` no `nginx.conf` + `frontend/src/lib/handleChunkError.ts`
  (reload de chunk órfão pós-deploy).
- **Quebrou produção**: o Coolify/Traefik marcou os containers como `unhealthy` e parou de
  rotear → **503 em produção**. **Hotfix PR #101** (mesclado) removeu os dois `healthcheck`.
- **Ficaram de pé** (inofensivos): `GET /healthz` no nginx e o `handleChunkError.ts`.
- **Pendência:** reintroduzir zero-downtime com segurança exige testar o comando de
  healthcheck **dentro do container** e entender como o Coolify trata `unhealthy`/`starting`
  no roteamento (provavelmente precisa de config de health check própria do Coolify, não só
  a do compose). NÃO mexer nisso de novo sem produção estável e um plano de teste.
- O `handleChunkError.ts` (reload em `vite:preloadError`) está ativo e é útil pra qualquer
  deploy de frontend.

### 8.5 Dashboard DRE (DASH_RAZAO) — fase 2 + saga do proxy
- Migração **continuada** da fase 1 do Eduardo (commit `bdab121`: só a tela "Visão Geral").
- CRM PR **#120** (mesclado): portadas as 4 telas restantes (Comparativo, Composição,
  Drilldown, Insights) + Assistente de IA + Anotações, cópia quase verbatim do
  `ndmg-dev/DASH_RAZAO` (Next.js) — só `@/lib` → `../lib` e `fetch` → `dreFetch`.
  Navegação = `tela` do zustand (`lib/store.ts`, já portado). Proxy timeout 30s→60s.
- **Cadastrado no banco** (o usuário rodou o INSERT): slug `dashboard-dre`, `setor` =
  `CONTABIL`, `categoria` = `AUTOMATION` (copiada de um peer), `icone` = `bar-chart-3`,
  `url` = `#`, `ativo` = true. Aparece no grupo CONTÁBIL.
- **Saga de bugs do proxy** (`dre_proxy.py` + `dashboard-dre/lib/api.ts`) — o dataset não
  carregava:
  - **PR #122** (mesclado): `dreFetch` montava caminho **relativo** `/api/v1/dre-proxy/...`
    → caía no nginx do frontend (que **não roteia `/api`**) → voltava o `index.html` do CRM.
    Fix: usar `import.meta.env.VITE_API_BASE_URL` (URL absoluta do backend), igual
    `src/lib/api.ts`.
  - **PR #123** (mesclado): proxy passou a mandar `Accept-Encoding: identity` ao Vercel (o
    Vercel serve `br`/`zstd`, o httpx não descomprime esses sem lib, e o proxy tira o header
    `content-encoding` → navegador recebia bytes comprimidos como texto).
  - **PR #124** (aberto/pode estar mesclado): adiciona `brotli>=1.1.0` nas deps do
    `backend-fastapi/pyproject.toml` (defesa extra caso o Vercel ignore o `identity`).
  - **PR #125** (aberto/pode estar mesclado): o dataset volta com `ETag`/`Last-Modified`; o
    navegador mandava `If-None-Match` e recebia **`304` de corpo vazio** que o `r.json()`
    não parseia. Fix: `cache: 'no-store'` no `dreFetch` + o proxy tira condicionais
    (`If-None-Match` etc.) na ida e `ETag`/`Last-Modified` na volta.
- **Estado ao encerrar a conversa:** #122 e #123 mesclados e no ar; a chamada já chega no
  backend (`crmapi.mendoncagalvao.com.br/api/v1/dre-proxy/...`, CORS ok). Faltava **mesclar
  #124 + #125 e redeployar frontend + backend**, e o usuário **limpar o cache do
  navegador** uma vez (a resposta quebrada ficou cacheada com ETag). Confirmar nos PRs
  (`gh pr view 124 125 --json state,mergedAt`) e no dashboard antes de assumir que está OK.
- **Pendências de infra do Assistente/Anotações** (não bloqueiam as telas): `DASHBOARD_SENHA`
  no Vercel do DASH_RAZAO = `DASHBOARD_DRE_SENHA` no backend do CRM (os dois **juntos**);
  `OPENAI_API_KEY` e `POSTGRES_URL` no Vercel. Sem eles: botão do assistente some, Insights
  ficam read-only.
- **Coordenação:** o Eduardo é dono da migração do DRE; o usuário ficou de alinhar a
  divisão com ele.

### 8.6 Repos satélite clonados nesta máquina (novos nesta leva)
`C:\Users\User\Projetos\HR-DASH-MG` (branch `feat/crm-sso-nativo`),
`C:\Users\User\Projetos\DASH_RAZAO` (HEAD `dd83e4c`, Aug/11 — não avançou desde a fase 1).

---

## 9. Primeiros passos concretos pra próxima conversa

1. Ler este arquivo + `docs/migracoes/handoff.md`.
2. Confirmar estado dos PRs #124/#125 (DRE) e se o dashboard DRE está carregando — fechar
   essa pendência antes de abrir frente nova, se ainda estiver aberta.
3. `AskUserQuestion` da Fase 0 (acesso, ações de escrita, docker.sock vs exporter, Coolify
   API, persistência).
4. Pedir o `HOSTINGER_API_TOKEN` e rodar `GET /api/vps/v1/virtual-machines` pra pegar o
   `virtualMachineId`.
5. `psql` pra confirmar o `setor` real de TI e que o slug escolhido está livre.
6. Implementar a Fase 1 (backend com cache + telas read-only), validar `tsc --noEmit -p
   tsconfig.app.json` + `npm run build` (com **todas** as `VITE_*` — ver checklist no
   playbook), e só então commitar/abrir PR.
