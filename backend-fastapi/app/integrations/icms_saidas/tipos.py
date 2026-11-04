"""Constantes e tipos de parâmetro do sistema ICMS Saídas (portados do BFF do painel)."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Path, Query
from pydantic import Field, StringConstraints

TIMEOUT_LEITURA = httpx.Timeout(20.0)
TIMEOUT_LONGO = httpx.Timeout(180.0, connect=10.0)

MB = 1024 * 1024
TETO_ARQUIVO = 25 * MB
TIPOS_ARQUIVO = {
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
}
TIPOS_DOWNLOAD = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "text/csv",
}

RE_COMPETENCIA = r"^\d{4}-(0[1-9]|1[0-2])$"
RE_INICIO_MES = r"^\d{4}-(0[1-9]|1[0-2])-01$"
RE_CNPJ = r"^(\d{14}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})$"
RE_MES = r"^\d{4}-(0[1-9]|1[0-2])(-01)?$"  # AAAA-MM ou AAAA-MM-01 (vigência das regras)
RE_TIPO_DIFERENCA = r"^(INCLUÍDO|REMOVIDO|TRIBUTAÇÃO ALTERADA)$"

Codigo = Annotated[str, Path(pattern=r"^[A-Z0-9_-]{2,20}$")]
Id = Annotated[UUID, Path()]
Pend = Annotated[int, Path(ge=1, le=2**53)]
Competencia = Annotated[str | None, Query(pattern=RE_COMPETENCIA)]
Limit = Annotated[int | None, Query(ge=1, le=500)]
Offset = Annotated[int | None, Query(ge=0, le=10_000_000)]
Status = Annotated[str | None, Query(pattern=r"^[A-Z_]{1,40}$")]

TABELAS_REGRAS = {"grupos", "categorias", "aliases", "cfops", "parametros"}

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
IdDiferenca = Annotated[int, Field(strict=True, ge=1, le=2**53)]
