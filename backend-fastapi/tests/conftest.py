"""Segredos obrigatórios para a suíte.

`Settings` exige JWT_SECRET, N8N_INGEST_SECRET, POSTGRES_PASSWORD e
EVOLUTION_API_KEY — todos sem default (falham no boot se ausentes). O pytest
importa este conftest antes de qualquer módulo de teste, então definimos aqui
valores descartáveis para que `from app.main import app` não quebre.
"""
import os

os.environ.setdefault("JWT_SECRET", "test-only")
os.environ.setdefault("N8N_INGEST_SECRET", "test-secret")
# Casa com o Postgres de teste padrão (docker/local); POSTGRES_HOST etc. mantêm
# os defaults de config.py.
os.environ.setdefault("POSTGRES_PASSWORD", "crm_dev_password_2024")
os.environ.setdefault("EVOLUTION_API_KEY", "test-evolution-key")
