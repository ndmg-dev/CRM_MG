"""Segredos obrigatórios para a suíte.

`Settings` exige JWT_SECRET e, a partir do módulo Extratos de Sócios,
N8N_INGEST_SECRET — ambos sem default (falham no boot se ausentes). O pytest
importa este conftest antes de qualquer módulo de teste, então definimos aqui
valores descartáveis para que `from app.main import app` não quebre.
"""
import os

os.environ.setdefault("JWT_SECRET", "test-only")
os.environ.setdefault("N8N_INGEST_SECRET", "test-secret")
