"""Erros da API do ICMS Saídas no mesmo formato do motor: {"erro": {"codigo", "mensagem", "detalhes"}}."""
from __future__ import annotations

from fastapi.responses import JSONResponse


class ErroApi(Exception):
    def __init__(self, status: int, codigo: str, mensagem: str, detalhes: list[str] | None = None) -> None:
        super().__init__(codigo)
        self.status = status
        self.codigo = codigo
        self.mensagem = mensagem
        self.detalhes = detalhes or []


def corpo_erro(codigo: str, mensagem: str, detalhes: list[str] | None = None) -> dict:
    return {"erro": {"codigo": codigo, "mensagem": mensagem, "detalhes": detalhes or []}}


def resposta_erro(status: int, codigo: str, mensagem: str, detalhes: list[str] | None = None) -> JSONResponse:
    return JSONResponse(corpo_erro(codigo, mensagem, detalhes), status_code=status)


def sem_permissao() -> ErroApi:
    return ErroApi(403, "SEM_PERMISSAO", "Você não tem permissão para esta ação. Peça ao administrador.")
