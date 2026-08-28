# CRM MG Backend — Instalação

## 1. Pré-requisitos
- Python `>=3.11` (Dockerfile de produção usa `python:3.12-slim`)
- [`uv`](https://github.com/astral-sh/uv) para instalar dependências (usado no Dockerfile: `pip install uv && uv pip install --system -e .`)
- Docker + Docker Compose (para rodar `postgres` localmente via `docker-compose.yml` da raiz)

## 2. Clonagem e instalação
```bash
git clone <repositorio>
cd backend-fastapi
pip install uv
uv pip install --system -e .
# ou, para desenvolvimento com testes/lint:
uv pip install --system -e ".[dev]"
```

## 3. Configuração de `.env`
Copiar o `.env.example` da **raiz do repositório** (não há um específico do
backend):
```bash
cp .env.example .env
```
Preencher pelo menos:

| Variável | Onde obter |
|---|---|
| `JWT_SECRET` | gerar com `openssl rand -base64 48` — nunca reaproveitar entre ambientes |
| `GOOGLE_CLIENT_ID` | Google Cloud Console, projeto OAuth do CRM |
| `POSTGRES_PASSWORD` | definir uma senha forte — **não usar o default hardcoded no código** (ver `docs/PENDENCIAS.md`) |
| `OPENAI_API_KEY` | painel da OpenAI, se for usar features de IA |

Segredos (`JWT_SECRET`, `POSTGRES_PASSWORD`, `OPENAI_API_KEY`,
`EVOLUTION_API_KEY`, `OUVIDORIA_SUPABASE_SERVICE_ROLE_KEY`) devem vir de um
cofre de segredos em produção (Coolify tem gestão de env vars própria) —
nunca do repositório.

## 4. Subida do banco
Via `docker-compose.yml` da raiz:
```bash
docker compose up -d postgres pgadmin
```
Depois, aplicar as migrations:
```bash
cd backend-fastapi
alembic upgrade head
```
Não há seed automático de dados de exemplo além dos scripts soltos na raiz
do repo (`sistemas_seed.sql`, `cadastro_dashboard_dre.sql`, etc.) — rodar
manualmente se precisar de dado de exemplo.

## 5. Execução em desenvolvimento
```bash
cd backend-fastapi
uvicorn app.main:app --reload --port 8080
```
Ou via Docker Compose (usa o mesmo `Dockerfile`):
```bash
docker compose up -d backend
```
Porta padrão: `8080` dentro do container; publicada no host via
`HOST_BACKEND_PORT` (default `8089` no `.env.example`).

## 6. Build e execução em produção
```bash
docker build -t crm-mg-backend ./backend-fastapi
docker run -p 8080:8080 --env-file .env crm-mg-backend
```
O `CMD` do Dockerfile já sobe com `uvicorn app.main:app --host 0.0.0.0 --port 8080`.

## 7. Deploy (Coolify)
1. Coolify builda a partir do `docker-compose.yml` da raiz (serviço `backend`).
2. Configurar as env vars de produção no painel do Coolify (nunca no repo).
3. Aplicar migrations pendentes (`alembic upgrade head`) antes ou logo após
   o deploy — não há passo automático de migration no Dockerfile.
4. Sem healthcheck explícito identificado para o serviço `backend` no
   `docker-compose.yml` (o `postgres` tem; o `backend` não) — considerar
   adicionar um antes de depender de rollback automático por healthcheck.

## 8. Verificação pós-instalação
- [ ] `GET /api/v1/...` (algum endpoint de health/status — não identificado
      explicitamente; confirmar se existe `/health` ou usar
      `/docs` do FastAPI pra checar que a API subiu)
- [ ] Login via Google OAuth completa e retorna um JWT válido
- [ ] `alembic current` mostra a revisão esperada (sem migrations pendentes)
- [ ] Frontend consegue chamar `/api/v1/sistemas` e listar os sistemas cadastrados

## 9. Troubleshooting
- **Backend sobe mas todo endpoint autenticado falha** — checar se
  `JWT_SECRET` do backend é o **mesmo** configurado no frontend/outros
  serviços que validam o token.
- **Erro de conexão com Postgres** — lembrar que `POSTGRES_HOST`/`PORT` são
  sobrescritos automaticamente para `postgres:5432` quando rodando via
  Docker Compose; ao rodar o backend fora do compose (ex.: `pytest` direto
  no host), apontar para `localhost:${HOST_POSTGRES_PORT}` (ver comentário
  no `.env.example`).
- **Login Google falha silenciosamente para e-mail correto** — checar
  `GOOGLE_ALLOWED_DOMAIN`/`GOOGLE_ALLOWED_EMAILS`: por padrão só e-mails
  `@mendoncagalvao.com.br` são aceitos.
