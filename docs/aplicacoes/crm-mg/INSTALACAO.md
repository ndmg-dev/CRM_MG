# CRM Mendonça Galvão (shell) — Instalação

> Este é o guia "mestre" — cobre o monorepo `frontend/` inteiro (shell +
> todos os sistemas embutidos) e, junto com
> [`../backend-fastapi/INSTALACAO.md`](../backend-fastapi/INSTALACAO.md),
> sobe o ambiente completo local do CRM.

## 1. Pré-requisitos
- Node.js — versão exata não fixada no repo (sem `.nvmrc`/`engines`); usar
  uma versão recente compatível com Vite 8 / React 19 (Node 20+ recomendado
  por precaução, não confirmado como requisito exato).
- Docker + Docker Compose (para o backend e o Postgres).
- Acesso aos projetos Supabase de cada sistema embutido que você for testar
  (não é preciso ter todos pra rodar o shell em si).

## 2. Clonagem e instalação
```bash
git clone <repositorio>
cd frontend
npm install
```
Isso instala as dependências de **todos** os 25 sistemas embutidos de uma
vez (é um único `package.json` na raiz do `frontend/`), mais os workspaces
locais `packages/@mg/ui` e `packages/@mg/tokens`.

## 3. Configuração de `.env`
```bash
cp .env.example .env   # na raiz do repositório
```
Ver [`../backend-fastapi/INSTALACAO.md`](../backend-fastapi/INSTALACAO.md)
seção 3 para as variáveis do backend. Para o frontend, adicionar em
`frontend/.env` as variáveis `VITE_*` de cada sistema embutido que for
testar (ex.: `VITE_SUPORTE_SUPABASE_URL` pro Central de Suporte) — ver a
ficha de cada sistema.

## 4. Subida do banco
```bash
docker compose up -d postgres pgadmin backend
cd backend-fastapi && alembic upgrade head
```

## 5. Execução em desenvolvimento
```bash
cd frontend
npm run dev
```
Sobe o Vite dev server (porta padrão 5173). O backend precisa estar rodando
à parte (`docker compose up -d backend` ou `uvicorn` local, ver ficha do
backend) — o frontend não sobe a API sozinho.

## 6. Build e execução em produção
```bash
cd frontend
npm run build
# = npm run build --workspaces --if-present && tsc -b && vite build
npm run preview
```

## 7. Deploy (Coolify)
- `docker-compose.yml` na raiz define 4 serviços: `postgres`, `pgadmin`
  (dev), `backend`, `frontend`.
- Coolify builda a partir desse compose; as env vars de build do frontend
  (todas as `VITE_*` de cada sistema embutido) precisam estar configuradas
  como *build args*, não só runtime — Vite embute env vars no bundle em
  build time.
- Deploy do frontend redeploya **todos os 25 sistemas de uma vez** (é um
  bundle único) — não há deploy incremental por sistema.
- Rollback: reverter pro build anterior no Coolify (não há healthcheck
  automático identificado para o serviço `frontend` no compose).

## 8. Verificação pós-instalação
- [ ] `http://localhost:${HOST_FRONTEND_PORT}` carrega a tela de login
- [ ] Login Google completa e mostra a navbar com os itens de menu
- [ ] Cada item de "Gestão"/"Abrir chamado" navega pro sistema esperado
- [ ] Um sistema com Supabase próprio (ex.: Central de Suporte) carrega dado real

## 9. Troubleshooting
- **Sistema embutido mostra tela em branco** — checar o console do
  navegador por erro de env var ausente (`VITE_*` daquele sistema
  específico não foi setada em build time).
- **Build falha em `tsc -b`** — geralmente um sistema embutido introduziu
  um erro de tipo; rodar `npx tsc -b` isolado pra localizar qual sistema.
- **Um sistema funciona local mas não em produção** — comum quando a env
  var `VITE_*` foi setada só no `.env` local e esquecida nos build args do
  Coolify (ver seção 7).
