# Central de Suporte — Instalação

> Este sistema roda **embutido** no monorepo `frontend/` do crm-mg — não tem
> `npm install`/build próprios. Os passos abaixo cobrem só o que é
> específico deste sistema; a instalação geral do monorepo está em
> `docs/aplicacoes/crm-mg/INSTALACAO.md`.

## 1. Pré-requisitos
- Node.js — versão exata DESCONHECIDA (sem `.nvmrc`/`engines` encontrado no
  `frontend/package.json`); usar uma versão recente com suporte a Vite 8 e
  React 19.
- Acesso a um projeto Supabase próprio deste sistema (URL + chave anon) —
  peça ao time de TI, não há projeto de teste documentado.

## 2. Clonagem e instalação
```bash
git clone <repositorio>
cd frontend
npm install
```
(instala as dependências de **todo** o monorepo frontend, não só deste
sistema — não há `package.json` isolado para `central-suporte`.)

## 3. Configuração de `.env`
Não há `.env.example` específico deste sistema no repositório. As variáveis
usadas (ver seção 11 do README) precisam ser adicionadas ao `.env` do
`frontend/` (raiz do workspace Vite):

```
VITE_SUPORTE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPORTE_SUPABASE_PUBLISHABLE_KEY=<chave-anon-do-projeto>
```

Peça esses valores ao responsável pelo projeto Supabase — **nunca** commitar
um `.env` com valores reais.

## 4. Banco de dados
1. Criar (ou obter acesso a) um projeto Supabase.
2. Rodar manualmente, em ordem, todo o SQL em
   `frontend/src/systems/central-suporte/integrations/supabase/migrations/`
   pelo SQL Editor do Supabase — **não há runner automático** (ver
   `BANCO.md`).
3. Confirmar que as RLS policies citadas em `BANCO.md` existem antes de
   liberar o ambiente pra uso real.

## 5. Execução em desenvolvimento
```bash
cd frontend
npm run dev
```
Sobe o Vite dev server (porta padrão do Vite, 5173, salvo override). O
sistema fica acessível dentro do shell do CRM, na rota configurada pelo
registry (`central-de-suporte` / `central-suporte`, ver
`frontend/src/systems/registry.tsx`).

## 6. Build e execução em produção
```bash
cd frontend
npm run build   # roda build dos workspaces (@mg/ui, @mg/tokens) + tsc -b + vite build
npm run preview # opcional, serve o build local
```
O build gera o bundle de **todo** o monorepo frontend (todos os 25
sistemas), não só deste.

## 7. Deploy
Deploy é feito junto com o `crm-mg` shell inteiro via Coolify — ver
`docs/aplicacoes/crm-mg/INSTALACAO.md` seção 7. Não há deploy isolado deste
sistema.

## 8. Verificação pós-instalação
- [ ] Login via Google OAuth funciona e mostra o menu "Central de Suporte" na navbar
- [ ] Abrir um chamado de teste pelo fluxo conversacional (`/portal/new-ticket-ti`)
- [ ] Chamado aparece no Kanban (`/admin/kanban`)
- [ ] Comentar no chamado atualiza em tempo real (Realtime do Supabase) no chat flutuante
- [ ] Upload de anexo funciona (confirma que o bucket do Storage está criado)

## 9. Troubleshooting

- **Erro `new row violates row-level security policy for table 'tickets'`
  ao criar chamado** — já ocorreu em produção nesta sessão de
  desenvolvimento; causa raiz foi a policy de `INSERT` de `tickets` não
  cobrir o campo `opened_by_id` introduzido depois. Verificar
  `with_check` da policy de INSERT via `pg_policies`.
- **Lista de conversas do chat flutuante quebra com erro de função
  inexistente** — a função `get_recent_ticket_previews` (RPC) precisa ser
  criada manualmente via migration antes de usar a lista de conversas; sem
  ela, a query falha.
- **Chamado com anexo não mostra imagem** — checar se o bucket
  `ticket-attachments` existe no Storage do projeto Supabase e se a policy
  de leitura permite `createSignedUrl` pro usuário autenticado.
