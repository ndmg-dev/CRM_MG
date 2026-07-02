FROM python:3.12-slim

WORKDIR /app

# Install uv for fast package management
RUN pip install uv

COPY pyproject.toml .
RUN uv pip install --system -e .

COPY alembic.ini .
COPY alembic alembic
COPY app app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
