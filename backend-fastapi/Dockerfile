FROM python:3.12-slim

WORKDIR /app

# Install uv for fast package management
RUN pip install uv

COPY pyproject.toml .
COPY alembic.ini .
COPY alembic alembic
COPY app app

RUN uv pip install --system -e .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
