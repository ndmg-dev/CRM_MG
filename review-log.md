
## 2026-08-24 12:23:37 — `frontend/src/systems/ponto-admin/components/Modal.tsx`

Bugs / riscos:

- `document.querySelector('.pontoadmin-root')` roda só uma vez no mount (efeito com deps `[]`). Se o Modal for montado antes do elemento `.pontoadmin-root` existir no DOM (ex: renderizado condicionalmente em outra árvore, ou ordem de montagem diferente), `container` fica `null` para sempre e cai no fallback `document.body` sem re-tentar.
- Se existir mais de um `.pontoadmin-root` na página (ex: dois modais/instâncias do sistema simultâneas), `querySelector` sempre pega o primeiro do DOM, podendo montar o portal na instância errada.
- Sem fallback visível/log quando `container` continua `null` (elemento nunca existe) — cai silenciosamente pro `document.body` sem estilo, reproduzindo o bug original sem aviso.

Melhorias:

- Buscar o elemento de forma lazy no primeiro render (`useState(() => document.querySelector(...))`) evita o flash de um render com `container === null` antes do efeito rodar.
- Como alternativa mais robusta, considerar passar a ref do container via contexto/prop desde a raiz do `ponto-admin`, em vez de `querySelector` global — evita acoplamento a uma classe CSS específica e busca redundante em todo `Modal` renderizado.

## 2026-08-24 12:24:38 — `commit e4f5800 (Features-Edu)`

Bugs / riscos:

1. **Race entre `useEffect` e o `Dialog.Root` inicial**: no primeiro render `container` é `null`, então `Dialog.Portal` renderiza em `document.body` (fallback `undefined`) antes do efeito rodar. Se `open` já vier `true` no mount (ex.: modal controlado por estado que abre imediatamente), o conteúdo nasce fora de `.pontoadmin-root` sem estilo por um frame — o próprio bug que o commit tenta corrigir, só que mais raro.

2. **`querySelector` roda em todo mount do `Modal`**, não só quando `open` muda. Se o componente `Modal` for remontado (key change, etc.) toda vez que abre, tudo bem; mas se vários `Modal`s existem simultaneamente montados (mesmo fechados) e `.pontoadmin-root` ainda não existe no DOM nesse instante (ex. renderizado antes do root montar), `container` fica `null` permanentemente — o efeito não reexecuta porque as deps são vazias `[]`.

3. **`.querySelector('.pontoadmin-root')` assume elemento único** — se houver múltiplas instâncias da árvore `.pontoadmin-root` na página (improvável, mas nada impede), sempre pega a primeira.

Melhorias:

- Poderia usar `useRef` + checar `document.querySelector` de forma lazy no primeiro render (`useState(() => document.querySelector(...))`) em vez de `useEffect`, eliminando o frame sem container em SSR-free SPA.
- Comentário é longo pra uma explicação que poderia ser uma linha; mas está claro, sem problema real.

## 2026-08-24 12:28:25 — `frontend/src/systems/ponto-admin/components/dashboard/LocationCell.tsx`

Sem observações.

## 2026-08-24 12:28:35 — `frontend/src/systems/ponto-admin/components/dashboard/LocationCell.tsx`

Bugs / riscos:

1. **Race entre `useEffect` e o clique que abre o painel**: `portalRoot` só é preenchido no primeiro efeito (roda uma vez, no mount). Se `.pontoadmin-root` ainda não existir no DOM nesse momento (ex.: montagem condicional/lazy do container), `portalRoot` fica `null` para sempre e o painel nunca mais renderiza, mesmo depois que `.pontoadmin-root` aparecer.

2. **`querySelector` silencioso**: se `.pontoadmin-root` não existir (célula usada fora do contexto do ponto-admin, teste unitário, storybook, etc.), o portal simplesmente nunca abre e não há nenhum aviso/log — pode mascarar um bug de integração como "o clique não faz nada".

Sugestões de melhoria:

- Se o objetivo é só evitar portal sem estilo, considere fazer o lookup de forma lazy (dentro do handler que abre o painel, junto com `setPos`) em vez de só no mount, eliminando o problema de timing do item 1.
- Extrair a busca de `.pontoadmin-root` para um hook/util compartilhado, já que esse padrão (escopar portal ao container customizado) tende a se repetir em outros componentes com `createPortal` do mesmo sistema.

## 2026-08-24 12:28:42 — `PR #43 — fix(ponto-admin): modais sem estilo (portal escapa da .pontoadmin-root)`

Bugs/edge cases:

- `document.querySelector('.pontoadmin-root')` roda só uma vez no mount, sem args no array de deps (ok, `[]` é intencional), mas se `Modal` for montado antes da `.pontoadmin-root` existir no DOM (ex: renderizado condicionalmente cedo, ou em testes/storybook fora da árvore), `container` fica `null` para sempre e cai no fallback `undefined` (document.body) sem nunca recuperar. Não há re-tentativa nem observer.

- `container ?? undefined`: no primeiro render `container` é `null`, então o Portal monta em `document.body` primeiro e só depois de o efeito rodar remonta em `.pontoadmin-root`. Isso causa um flash sem estilo (exatamente o bug que o PR tenta corrigir) sempre que o modal já abre com `open=true` no mount, ou quando `open` vira `true` antes do efeito assíncrono resolver — como o `useEffect` roda depois do commit, pode haver um frame renderizado fora do container correto.

- Se existir mais de uma `.pontoadmin-root` na página (improvável, mas não garantido pelo código), `querySelector` pega só a primeira, podendo direcionar o portal para a instância errada.

Melhorias:

- Buscar o container de forma síncrona no lazy init do `useState` (`useState(() => document.querySelector<HTMLElement>('.pontoadmin-root'))`) evita o flash de primeiro render em vez de usar `useEffect` + `null` inicial.
- Poderia usar `useRef`/context para o root em vez de `querySelector` global toda vez que o Modal monta — mais barato e não depende de seletor de string espalhado pelo código.

## 2026-08-24 12:28:45 — `frontend/src/systems/ponto-admin/components/dashboard/LocationCell.tsx`

Bugs/riscos:

- Race de portal: `portalRoot` começa `null` e é setado em `useEffect` (após o primeiro render). Se `pos` já for verdadeiro no primeiro render em que o efeito ainda não rodou, o painel simplesmente não aparece nesse ciclo — geralmente inofensivo, mas é um frame perdido que pode causar flicker ou falha se `pos` for setado de forma síncrona antes do mount completar.
- Se `.pontoadmin-root` não existir no DOM (ex.: componente usado fora da árvore do ponto-admin, testes, ou storybook), `portalRoot` fica `null` para sempre e o painel de localização nunca renderiza, sem nenhum aviso/log — falha silenciosa.
- O `querySelector` roda só uma vez no mount; se o componente montar antes de `.pontoadmin-root` existir (ex. ordem de montagem diferente) e o root aparecer depois, nunca é reavaliado.

Melhorias:

- Considerar logar/avisar (dev only) quando `.pontoadmin-root` não é encontrado, para facilitar debug de "painel sumiu".
- Como esse padrão (buscar `.pontoadmin-root` como portal target) provavelmente se repete em outros componentes com portal (Modal.tsx é citado no comentário), extrair para um hook compartilhado tipo `usePontoAdminPortalRoot()` evitaria duplicação futura.

## 2026-08-25 15:52:13 — `PR #55 — feat: MG Prospect nativo + Ouvidoria Corporativa nativa + fix Kanban`

**Bugs / Riscos de segurança**

1. **Vazamento de cookies do CRM para domínio externo** (`mgprospect_proxy.py`): o proxy repassa *todos* os headers da requisição, exceto os hop-by-hop, para `prospect.nucleodigital.cloud`. Isso inclui `Cookie` (sessão do CRM) e qualquer outro header sensível do navegador. O comentário diz que só o `Authorization` do MG Prospect deveria ser repassado, mas o código não filtra isso — encaminha o cookie de sessão do CRM (e qualquer outro header) para um host de terceiros.

2. **IDOR em `ouvidoria_proxy.py` (`/triage` e provavelmente `/ai-summary`)**: `get_current_user` só valida que o usuário está logado no CRM, sem checar se ele tem relação com o `complaint_id` informado. Como a escrita usa `service_role_key` (bypassa RLS), qualquer usuário autenticado no CRM pode acionar a triagem de IA / atualizar `ai_suggested_priority`/`ai_suggested_category` de uma manifestação de terceiros só sabendo/adivinhando o UUID.

3. **`chat_send` pode estourar 500 sem tratamento**: `data = resp.json()` não está dentro do `try/except` que cobre `TimeoutException`/`HTTPError`. Se o webhook n8n responder 200 com corpo não-JSON, `resp.json()` lança exceção não tratada e retorna 500 cru em vez de um erro amigável (padrão usado no resto do arquivo).

4. **`content-encoding` removido, mas `accept-encoding` do cliente é repassado ao upstream** (`mgprospect_proxy.py`): se o upstream comprimir a resposta, o `httpx` descomprime automaticamente (ok), mas isso depende de o upstream negociar corretamente; não é bug crítico, só um ponto frágil do design que vale documentar/testar.

**Melhorias**

- Validar/whitelist o `complaint_id` (formato UUID) antes de usar em `params={"id": f"eq.{body.complaint_id}"}` — hoje é interpolação direta de string de usuário na query do PostgREST.
- Em `mgprospect_proxy.py`, preferir uma lista de allow (ex.: só `Authorization`, `Content-Type`, `Accept`) em vez de uma lista de bloqueio para os headers repassados — mais seguro por padrão.
- `except Exception as exc` genérico em `chat_stream`/`triage_complaint` mascara erros de programação (ex.: `AttributeError`) junto com falhas de rede; considerar logar com `exc_info=True` para facilitar debug.

## 2026-08-25 16:15:25 — `frontend/vite.config.ts`

Bugs/riscos: nenhum real identificado — são apenas aliases de resolução de módulo (build-time), sem impacto em runtime ou segurança.

Melhorias:
- O comentário é longo (7 linhas) para um par de aliases; poderia ser condensado em 2-3 linhas mantendo a justificativa essencial (evitar colisão com `@mg/ui`/`@mg/tokens` reais).
- Nome dos diretórios (`@mg-tokens`, `@mg-ui`) usa hífen em vez de seguir o padrão de escopo npm (`@mg/tokens`) usado no restante do projeto — pode confundir na leitura, já que parecem pacotes distintos e não uma cópia vendorizada. Vale um comentário inline mais curto direto na linha do path, ou renomear a pasta para algo como `vendor/mg-ui` que deixa a natureza "vendorizada" mais explícita.

## 2026-08-25 16:17:33 — `commit d0215da (Features-Edu)`

Sem observacoes.

## 2026-08-25 16:17:48 — `frontend/src/systems/documentacao-contabil/components/NotasPreview.tsx`

Sem observacoes de bugs bloqueantes, mas há pontos a apontar:

**Bugs / riscos**
1. `definirEmCaminho` faz cast `atual as Record<string, unknown>` sem checar `null`/`undefined` — se algum caminho intermediário vier `null` (ex.: grupo opcional não preenchido), `{...null}` quebra em runtime.
2. `Number(chave)` em array sem validar `NaN` — se o caminho tiver uma chave não numérica onde deveria ser índice, insere `NaN` como chave silenciosamente.
3. `CampoValor` usa `defaultValue` (não controlado) + `onBlur`: se `dados` mudar externamente (troca de exercício, undo, etc.) o input não reflete o novo valor porque o campo não é remontado por chave — só funciona porque a troca de `indiceExercicio` desmonta a seção inteira; se no futuro o mesmo campo for reaproveitado (memoização/keys mudarem), o valor exibido pode ficar dessincronizado do estado real.
4. Em `renderizarGrupos`, campos numéricos que sejam `0` funcionam bem, mas não há tratamento para `NaN` vindo de `parsearValor` — se o usuário digitar algo não numérico, o valor pode virar `NaN` e propagar sem validação.

**Melhorias**
1. `linhasDeGrupo`, `renderizarGrupos` e os blocos de DRE têm bastante repetição de padrão `atualizar([...base, ...], novo)` — poderia extrair um hook `useCampo(caminho)` que retorna `{valor, onChange}`.
2. `rotular` faz fallback com `replace(/_/g, ' ')` sem capitalizar — pode gerar rótulos inconsistentes com os demais (ex.: "outros creditos" vs "Outros créditos").
3. `ROTULOS_MOVIMENTO` e `ROTULOS_NATUREZA` são declarados mas não usados neste trecho (podem estar em uso mais adiante no arquivo truncado — vale confirmar, senão são dead code).
4. `definirEmCaminho` é recursivo e cria cópias em cada nível — para objetos grandes com edição frequente (onBlur) pode gerar bastante alocação; aceitável para este volume de dados, mas vale nota se `dados` crescer muito.

## 2026-08-25 16:17:58 — `frontend/src/systems/documentacao-contabil/api/client.ts`

Bugs / riscos:

- **Nenhuma autenticação/isolamento** — o comentário diz que é intencional, mas isso expõe uma API pública sem Bearer nem CSRF para um domínio de produção real; vale confirmar que o backend também não expõe dados sensíveis sem auth (não é possível verificar aqui).
- `timeout: 120_000` (2 min) é bem alto para requisições de UI; se for só para upload/geração de notas pesada, ok, mas sem `AbortController`/cancelamento o usuário fica preso numa call travada sem forma de cancelar.
- `mensagemDeErro`: se `erro.response?.status === 429` mas também existir `detalhe`, o detalhe já é retornado antes — ok, mas se não houver `response` (erro de rede/timeout), cai em `erro.message`, que normalmente é algo genérico tipo "Network Error" sem indicar timeout explicitamente — pode confundir usuário.

Melhorias:

- Falta fallback para `VITE_DOCCONTABIL_API_URL` mal formada (sem `https://`, barra dupla etc.) — um `new URL(...)` com try/catch daria erro mais cedo e claro do que falha silenciosa em runtime.
- Poderia tratar `ECONNABORTED`/timeout explicitamente em `mensagemDeErro` para dar mensagem mais amigável ("A requisição demorou demais").

## 2026-08-25 16:18:08 — `frontend/src/systems/documentacao-contabil/components/EmpresaForm.tsx`

**Bugs / riscos:**

1. `socios[].participacao` está tipada como string mas não valida formato (pode aceitar texto arbitrário onde provavelmente se espera percentual numérico).
2. CPF de sócio e CNPJ da empresa não têm validação de dígito verificador — apenas regex de formato no CNPJ, e nenhuma no CPF do sócio/contador. Se o backend não revalida, dados inválidos passam.
3. Campos `socios.*` não têm `required`, permitindo submeter sócio com todos os campos vazios.
4. `valoresIniciais` não é memoizada — como é chamada em `useForm({ defaultValues: valoresIniciais(empresa) })`, isso é OK só no mount (react-hook-form usa apenas o valor inicial), mas se `empresa` mudar (ex.: trocar de "editar" para outra empresa reaproveitando o mesmo componente montado), o formulário não é resetado — bug real de UX/dado desatualizado.

**Melhorias:**

- Extrair o bloco de inputs de sócios (nome/cpf/participação/cargo) para um subcomponente, reduz duplicação e facilita testes.
- Adicionar `useEffect` com `reset(valoresIniciais(empresa))` quando `empresa` mudar, para cobrir o caso de reuso do componente.
- Máscara de input para CNPJ/CPF melhoraria UX em vez de só validar no submit.

## 2026-08-25 16:18:19 — `frontend/src/systems/documentacao-contabil/components/HistoricoTable.tsx`

Bugs / casos de borda:

- `job.error_message` só é exibido quando `job.status === 'error'` implicitamente pela presença do campo, mas não há checagem de `status`; se a API mandar `error_message` residual em outro status ele aparece incorretamente.
- `formatarDataHora(job.finished_at)` não trata `null`/`undefined` explicitamente aqui — depende de `formatarDataHora` lidar com isso; se não lidar, jobs `pending`/`processing` (sem `finished_at`) vão quebrar ou mostrar texto inválido (ex: "Invalid Date").
- Botão "Baixar" não tem `aria-label`/texto para leitores de tela além do ícone+texto (ok, tem texto "Baixar", isso está bem).
- `key={coluna}` no map de cabeçalhos usa a string do rótulo como key — funciona mas é frágil se rótulos duplicarem futuramente (menor).

Melhorias:

- Extrair o array de colunas do cabeçalho para fora do componente (constante), evitando recriar o array a cada render.
- `StatusBadge` está sendo exportado deste arquivo de tabela — considerar mover para um arquivo próprio (`StatusBadge.tsx`) se for reutilizado em outros componentes, para evitar import cruzado estranho.
- Sem `key` de fallback se `job.id` for undefined/duplicado — garantir que a API sempre retorna id único.

## 2026-08-25 16:18:37 — `frontend/src/systems/documentacao-contabil/api/notas.ts`

Bugs / riscos:

1. **`extrairNomeArquivo` pode lançar exceção não tratada.** `decodeURIComponent(match[1])` quebra com `URIError` se o header vier com um `%` mal formado (nome de arquivo malicioso ou corrompido do servidor). Isso derruba `baixarDocumento` inteiro, mesmo já tendo o blob em mãos. Vale um try/catch retornando o nome bruto ou `padrao`.

2. **`params.ano || undefined` trata `ano === 0` como ausente.** Não é um cenário real (ano fiscal nunca é 0), mas é o padrão clássico de bug de coerção — mais seguro usar `params.ano ?? undefined`. O mesmo vale para `empresaId` se algum dia for um valor "falsy" válido (não é o caso de string vazia, então ok).

3. **`gerarDocumento` envia JSON (`dados_editados`) enquanto `processarNotas` envia `FormData` para o mesmo módulo de API.** Confirme que `api` (axios) não está com `Content-Type: multipart/form-data` fixo nos defaults — se estiver, o POST de `gerarDocumento` vai serializar errado. Vale checar `client.ts`.

Melhorias:

- `extrairNomeArquivo`: o regex `([^";]+)"?` pode capturar espaços/aspas residuais em headers malformados; um `.trim()` no resultado antes do `decodeURIComponent` deixaria mais robusto.
- `anteriores?: [ExercicioAnterior, ExercicioAnterior]` como tupla fixa mas o `forEach` usa `indice + 1` genericamente — se um dia precisar de mais de 2 exercícios anteriores, o tipo vai brigar com a lógica. Não é bug agora, só acoplamento a observar.
- Repetição do padrão `const { data } = await api.xxx(...); return data` em quase todas as funções é aceitável (não vale abstrair, seria over-engineering para 6 chamadas).

## 2026-08-25 16:18:48 — `commit 2be7830 (Features-Edu)`

Bugs/riscos:
- `frontend/src/systems/registry.tsx`: `carne-leao` e `documentacao-contabil` foram registrados no `systemRegistry`, mas os próprios comentários dizem que os slugs ainda não existem em `sistemas_seed.sql`. Se o `systemRegistry` for indexado por slug vindo do banco, essas entradas ficam mortas até o cadastro — não é bug funcional, mas é código morto/incompleto mergeado em `main` via merge commit, o que pode confundir quem ler o registry achando que já está ativo.

Melhorias:
- Duplicação de padrão repetida 4x (docker-compose, Dockerfile, tsconfig, vite.config) para cada novo sistema — aceitável dado a arquitetura existente, nada a mudar aqui além do que já é convenção do repo.
- Comentário em `carne-leao` referencia branch externa (`feat/google-drive-integration`) e documento (`PROJETO-CARNE-LEAO`) que não existem neste repo — útil como contexto mas vale confirmar se não ficará obsoleto rapidamente.

Sem outras observações.

## 2026-08-25 16:25:56 — `frontend/src/systems/registry.tsx`

Bugs reais:

- Conflito de merge não resolvido: os marcadores `<<<<<<< HEAD`, `=======`, `>>>>>>> origin/main` continuam no arquivo. Isso quebra a compilação (erro de sintaxe TS/JSX) — o arquivo nem vai buildar.
- Como consequência do conflito, a entrada `'contabil-script-estatico': lazy(() => import('@carneleao/CarneLeaoApp'))` só existirá se o merge for resolvido escolhendo levar ambos os lados; do jeito que está, nada é válido.
- Comentário da branch `origin/main` diz que `'documentacao-contabil'` "já está cadastrado no banco (setor CONTABIL)", mas o comentário da branch local (HEAD, removido do trecho visível) dizia que o slug "ainda não existe" e precisa ser cadastrado — são informações conflitantes sobre o mesmo slug que precisam ser conciliadas antes de decidir qual comentário manter.

Sugestão objetiva:

- Resolver o conflito removendo os marcadores, mantendo as duas entradas (`cont-ai`/outras do HEAD + `contabil-script-estatico` + `documentacao-contabil`), e revisar qual comentário sobre `documentacao-contabil` reflete o estado real do banco antes de commitar.

## 2026-08-25 16:26:06 — `frontend/src/systems/registry.tsx`

Sem observações.

## 2026-08-25 16:26:12 — `commit 549e642 (Features-Edu)`

Sem observações.

## 2026-08-25 16:38:49 — `frontend/src/stores/chatWidgetStore.ts`

Bugs / casos de borda:

- `openConversation` não valida `ticketId` vazio/inválido — se chamado com string vazia, entra em estado `'conversation'` sem ticket real utilizável.
- Não há transição para lidar com "mensagem nova chegou enquanto uma conversa diferente está aberta" — o comentário menciona esse caso ("mensagem nova e abriu direto nela") mas não existe nenhuma action que trate notificação de nova mensagem substituindo a conversa ativa; isso provavelmente é responsabilidade de outro lugar, mas vale confirmar que não ficou órfão da migração da API antiga (`openChat`).
- Renomear as actions (`openChat`→`openConversation`, `closeChat`→`close`, etc.) é breaking change de API do store — todos os componentes que consomem `useChatWidgetStore` precisam ser atualizados. Vale confirmar que não sobrou nenhum uso do nome antigo (`isMinimized`, `openChatTicketId`, `restoreChat`, `minimizeChat`) no restante do código, o que quebraria em runtime silenciosamente (undefined não é erro de TS se não tipado corretamente em algum ponto).

Sugestões:

- `close()` e `minimize()` ambos resultam em `panelState: 'closed'`, mas só `close()` limpa `activeTicketId`. Isso é intencional (minimizar preserva o ticket para retomar depois?), mas o comentário do topo diz "clicar no ícone de novo sempre abre a LISTA (nunca retoma a conversa anterior direto)" — então por que `minimize` preserva `activeTicketId` se nunca é usado para retomar? Se não há consumidor que leia `activeTicketId` no estado `closed`, é dado morto; considerar limpar também em `minimize()` para evitar inconsistência de estado.

## 2026-08-25 16:38:57 — `frontend/src/components/layout/Header.tsx`

Bugs:
- **Header.tsx:219 e :414** ainda chamam `openChat(...)`, que não existe mais (a store só expõe `openConversation`). Isso quebra em runtime (`ReferenceError: openChat is not defined`) ao clicar em notificações/mensagens com `ticket_id`. Precisa trocar ambas as chamadas para `openConversation(...)`.

## 2026-08-25 16:39:13 — `frontend/src/components/layout/Header.tsx`

Sem observações.

## 2026-08-25 16:41:23 — `frontend/src/components/layout/MainLayout.tsx`

Sem observacoes.
