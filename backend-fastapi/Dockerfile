FROM python:3.12-slim

WORKDIR /app

# Install uv for fast package management
RUN pip install uv

COPY pyproject.toml .
COPY alembic.ini .
COPY alembic alembic
COPY app app

RUN uv pip install --system -e .

# Primeira vez que o projeto roda Alembic de verdade (antes, o schema era
# criado só por Base.metadata.create_all no lifespan, sem suporte a ALTER
# TABLE). `alembic upgrade head` é idempotente — num banco sem a tabela
# alembic_version ainda, ele cria as tabelas desta primeira migration; num
# banco que já tem tudo (criado antes só por create_all), ele falha ao
# tentar recriar — por isso o `|| true`: cobre o primeiro deploy depois
# desta mudança, que já tem as tabelas por create_all. Deploys seguintes
# dependem só do Alembic.
CMD alembic upgrade head || true; uvicorn app.main:app --host 0.0.0.0 --port 8080
