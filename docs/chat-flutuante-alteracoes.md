# Chat flutuante da Central de Suporte — alterações

Resumo de tudo que mudou no widget de chat rápido (ícone flutuante no
canto inferior direito do CRM) e nos pontos relacionados (Relatórios do
Ponto Admin, notificações do Header, clients Supabase). Cobre a sequência
de pedidos feita na branch `Features-Edu`, do dropdown de Relatórios até as
abas por status do chat.

## 1. Relatórios (Ponto Admin) — dropdown de colaborador atrás dos cards

**Arquivo:** `frontend/src/systems/ponto-admin/components/reports/ReportFilters.tsx`

O card com o dropdown "Buscar colaborador" ficava atrás dos cards de KPI
(Horas esperadas / trabalhadas / Saldo / Presença) ao abrir. Causa: os dois
são irmãos diretos de `.dashboard-page`, e `dashboard-dark.css` força
`.grid-kpi` para `z-index: 5`, batendo o `z-index: 2` que o card de filtros
usava. Corrigido subindo o card de filtros pra `z-index: 6`.

## 2. Anexo de imagem duplicado como texto

**Arquivo:** `frontend/src/components/layout/chat/ConversationView.tsx`

Ao enviar uma imagem sem digitar nada, o comentário era criado com
`content: "📎 nome-do-arquivo.png"` — a miniatura da imagem aparecia **e**
esse texto virava uma bolha de mensagem separada, duplicando a exibição.
Agora `content` só carrega o texto que a pessoa realmente escreveu; a
miniatura (já clicável, abre o arquivo em nova aba) é a única coisa exibida
quando não há texto.

## 3. Notificação nativa do navegador cobrindo o chat

**Arquivo:** `frontend/src/components/layout/Header.tsx`

A notificação nativa do SO/navegador disparava pra **toda** mensagem nova,
inclusive com a conversa já aberta na tela — cobria o widget e obrigava a
fechar a notificação antes de responder de novo.

Duas iterações:
1. Primeiro só suprimimos a notificação quando a mesma conversa já estava
   aberta e em foco.
2. Depois, a pedido explícito, a notificação nativa parou de disparar pra
   **qualquer** mensagem nova — o aviso de mensagem passou a ser só som +
   badge no ícone flutuante. A notificação nativa continua existindo só
   para eventos de chamado (aberto/encerrado).

## 4. Chat não abria mais sozinho — badge no ícone

**Arquivos:** `Header.tsx`, `stores/chatWidgetStore.ts`,
`components/layout/chat/FloatingTicketChat.tsx`

Antes, receber uma mensagem abria a conversa automaticamente na tela,
mesmo com o chat fechado. Agora uma mensagem nova só invalida as queries e
soma na badge vermelha do ícone flutuante (`FloatingTicketChat.tsx`, via
`useUnreadComments`). Clicar no ícone sempre abre a **lista** de conversas
(nunca retoma a conversa anterior direto); o usuário escolhe qual abrir.

## 5. Linhas maiores na lista de conversas

**Arquivo:** `frontend/src/components/layout/chat/ConversationList.tsx`

Avatar, padding e fontes do título/prévia aumentados, pra reduzir quantas
conversas cabem na tela sem scroll (facilita ler cada uma).

## 6. Tick de leitura (✓ / ✓✓) não atualizava

**Arquivo:** `ConversationView.tsx`

A lógica do front está correta: quando alguém abre a conversa, marca como
lidas as mensagens de quem não é o autor (`UPDATE comments SET
read_at=...`), e quem enviou a mensagem escuta essa mudança via Realtime
pra virar `✓✓`. O suspeito mais provável de o tick nunca mudar é a
**política de RLS de `comments`**: se ela só permite `UPDATE` pelo próprio
autor, esse update falha silenciosamente (0 linhas, sem erro) pra quem
está marcando como lido — e o tick nunca vira duplo.

Não dá pra confirmar/corrigir a RLS pelo repositório (não está
versionada aqui). Foi adicionado logging (`console.error` /
`console.warn`) no update de `read_at` pra facilitar o diagnóstico: se
aparecer no console "Só X de Y comentários foram marcados como lidos",
confirma que é a RLS e ela precisa liberar `UPDATE` de `read_at` em
`comments` pra qualquer participante do chamado, não só o autor.

## 7. Erro "cannot add `postgres_changes` callbacks... after `subscribe()`"

**Arquivo:** `frontend/src/systems/central-suporte/hooks/useUnreadComments.ts`

O hook `useUnreadComments` usava um nome de canal Realtime **fixo**
(`"unread-comments-realtime"`), mas roda em mais de um componente ao mesmo
tempo (ícone flutuante + lista de conversas). O Supabase client reaproveita
o canal já existente com esse nome; quando a segunda instância chamava
`.on()` depois que a primeira já tinha dado `.subscribe()`, o SDK lançava
esse erro e derrubava a tela (`Algo deu errado`). Corrigido dando um nome
de canal único por instância (`unread-comments-realtime-${useId()}`).

## 8. "Multiple GoTrueClient instances detected"

**Arquivos:** clients Supabase de `ouvidoria`, `bimg`, `copilot-contabil`,
`central-suporte`, `obrigacoes`, `agendamento-ferias`

Quando um sistema não tem `.env` configurado, o client cai num fallback
`https://placeholder.supabase.co` — e como **vários** sistemas usavam o
mesmo fallback, os `GoTrueClient` derivavam a mesma `storageKey` e
colidiam entre si. Corrigido dando a cada client uma `storageKey` própria
(`sb-ouvidoria-auth-token`, `sb-bimg-auth-token`, etc.), configurada e não
dependente de estarem ou não configurados.

## 9. Badge "Encerrado" (substituída pelas abas — ver item 10)

Numa primeira passada, chamados encerrados (`resolved`/`closed`/
`canceled`) ganharam uma badge vermelha "Encerrado" na lista e na conversa,
e o input de mensagem passou a ser bloqueado nesse estado (com fallback
seguro: se por algum caminho a mutação de envio for chamada mesmo assim,
ela lança erro em vez de "ter sucesso" silenciosamente e limpar o texto
digitado à toa).

Essa badge foi **removida** na iteração seguinte (item 10) — as abas por
status já deixam isso óbvio sem precisar de selo extra. O bloqueio de
envio continua ativo.

## 10. Abas por status na lista de conversas

**Arquivos:** `ConversationList.tsx`,
`frontend/src/systems/central-suporte/utils/ticketStatus.ts` (novo)

A lista de conversas ganhou navegação por abas em vez de uma lista única
misturando tudo:

- **A fazer** — status `new` / `pending` (chamado ainda não tratado).
- **Em Andamento** — status `open`.
- **Outros** (dropdown) — agrupa três sub-opções que não precisam de aba
  fixa: **Encerrados** (`resolved`/`closed`/`canceled`), **Em teste**
  (`testing`) e **Parados** (`parado`). Escolher uma opção no dropdown já
  filtra a lista e vira a aba ativa, com contador.

A categorização mora em `ticketStatus.ts` (`ticketCategory()`), usada
tanto na lista quanto na conversa — uma única fonte de verdade para "em
que grupo esse status cai".

**⚠️ Mapeamento provisório — pendente de migração.** O enum
`ticket_status` não tem um valor dedicado a "em andamento": pro negócio,
`new`, `open` e `pending` são todos "chamado novo". Até rodar uma migração
adicionando um status `in_progress` de verdade, o chat empresta `open`
pra representar "Em Andamento" (e agrupa `new`+`pending` em "A Fazer").
Isso diverge do `TicketDetailDialog.tsx`, que ainda trata `open` como "A
Fazer" — esse arquivo (junto com `KanbanBoard.tsx`, `Reports.tsx`,
`PortalHome.tsx` e o trigger `track_ticket_tm_metrics`) precisa ser
corrigido na mesma migração, pra não conviver com dois mapeamentos
diferentes de `open` no app. Busca por `PROVISÓRIO` em `ticketStatus.ts`
e `ConversationView.tsx` pra achar os pontos a trocar quando isso
acontecer.

## 11. TI move o chamado direto pelo chat

**Arquivo:** `ConversationView.tsx`

- **Auto-move para "Em Andamento"**: toda resposta da TI num chamado que
  não está em `open` move o status pra `open` automaticamente, logo após o
  envio da mensagem — sem precisar sair do chat pra isso.
- **Barra de botões acima do input** (só aparece com o chamado ainda
  aberto): botões "Em andamento", "Em teste" e "Parado" — o botão do
  status atual fica desabilitado/destacado — e, separado à direita,
  **"Encerrar Chat"** (vermelho, com confirmação antes de agir).
- **Encerrar Chat**: muda o status pra `closed` **e** insere uma mensagem
  "Este chat foi encerrado." no histórico da conversa — reconhecida pelo
  mesmo padrão das notas de sistema (transferência, mudança de status
  etc.), então renderiza como separador central em vez de bolha de
  mensagem, visível pro solicitante.

## 12. Correção do mapeamento A Fazer / Em Andamento (com um vaivém)

**Arquivos:** `ticketStatus.ts`, `ConversationView.tsx`

Depois do item 11, veio a correção: o resto do app (`TicketDetailDialog.tsx`)
trata `open` como "A Fazer" e `pending` como "Em Andamento" — o chat tinha
isso invertido (`open` = in_progress). Nessa primeira correção, achou-se
(por engano) que `open` também era "chamado novo" pro negócio e usou-se
`open` como "Em Andamento" provisório.

**Isso estava errado — corrigido de volta.** Conferindo o Kanban de
verdade (`KanbanBoard.tsx`, a fonte real: a coluna "Em Andamento" ali
filtra por `status === 'pending'`, e "A Fazer" filtra `new`/`open`), ficou
confirmado que o mapeamento original já estava certo:

- **A Fazer** = `new` + `open`.
- **Em Andamento** = `pending`.

Kanban e `TicketDetailDialog` concordam entre si nisso — não há
inconsistência nem necessidade de migração alguma para o chat funcionar
certo. `ticketCategory()` tem um comentário avisando pra não reintroduzir
a troca sem reconferir o Kanban.

Também três ajustes de UX no fechamento pedidos depois de usar a
funcionalidade:

- **Modal próprio em vez de `confirm()` do navegador** — o clique em
  "Encerrar Chat" abre um modal no estilo do resto do widget, não mais o
  alert nativo do Chrome.
- **Chat não some mais da tela na hora** (primeira versão) — encerrar
  passou a só postar o aviso e bloquear o input, adiando o `status:
  closed` de verdade pra quando a TI saísse da conversa (via `useEffect`
  de cleanup no unmount). Revisado no item 13 — ver abaixo.
- **Quem encerrou** — a mensagem de encerramento agora inclui o nome de
  quem encerrou ("Este chat foi encerrado por Fulano."), não só um aviso
  genérico.

## 13. Encerrar chat: status imediato, sem aviso de "vai sumir" + detecção de reabertura

**Arquivo:** `ConversationView.tsx`

Revisão do item 12: em vez de adiar a gravação do `status: closed` até o
unmount (via `useEffect` de cleanup), agora **"Encerrar Chat" grava o
status na hora** — mais simples, sem a complexidade do timing de unmount.
O que muda é o que a **tela atual** mostra: um estado local (`justClosed`)
mantém o input e os botões de status funcionando normalmente nesta mesma
instância da conversa até a TI sair dela — sem nenhum aviso de "isso vai
sumir da aba". Na próxima vez que a conversa for aberta (remount), o
`status` já é `closed` de verdade e a tela mostra o bloqueio normal.

Também: detecção automática de reabertura. Se o chamado voltar de
`closed`/`resolved`/`canceled` pra qualquer outro status — pelos botões do
próprio chat, ou por fora (dropdown do `TicketDetailDialog`, Kanban etc.)
— o chat detecta a transição (comparando o status anterior com o atual via
`useEffect`) e insere sozinho um "Este chat foi reaberto." no histórico,
sem precisar que a reabertura tenha passado pelo chat.

## Verificação

- `npx tsc -b` — sem erros.
- `npm run build` — build completo sem erros (só avisos pré-existentes de
  chunk grande, não relacionados a essa mudança).
