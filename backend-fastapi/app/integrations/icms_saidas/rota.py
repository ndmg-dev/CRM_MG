"""Classe de rota do ICMS Saídas: erros no formato do motor e tetos de corpo ANTES de ler a requisição.

O CRM não tem um middleware de limite de corpo; aqui o teto é conferido pelo Content-Length (obrigatório em requisição com corpo)
antes de qualquer parse. JSON: 64 KB. Upload: 25 MB + margem (100 MB em "completar", que leva até 7 arquivos).
"""
from __future__ import annotations

from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute

from .erros import ErroApi, resposta_erro
from .tipos import TETO_ARQUIVO

TETO_CORPO_JSON = 64 * 1024
TETO_CORPO_UPLOAD = TETO_ARQUIVO + 256 * 1024
TETO_CORPO_COMPLETAR = 100 * 1024 * 1024


def _conferir_tamanho(request: Request) -> None:
    if request.method not in ("POST", "PUT", "PATCH"):
        return
    tipo = request.headers.get("content-type", "")
    tamanho = request.headers.get("content-length")
    if tamanho is None and not tipo:
        return  # POST sem corpo (ex.: reavaliar)
    if tamanho is None or not tamanho.isdigit():
        raise ErroApi(411, "REQUISICAO_INVALIDA", "A requisição precisa informar o tamanho do corpo (Content-Length).")
    if tipo.startswith("multipart/form-data"):
        teto = TETO_CORPO_COMPLETAR if request.url.path.endswith("/memoria/completar") else TETO_CORPO_UPLOAD
    else:
        teto = TETO_CORPO_JSON
    if int(tamanho) > teto:
        raise ErroApi(413, "REQUISICAO_GRANDE", "Requisição maior que o permitido.")


class RotaIcms(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        original = super().get_route_handler()

        async def tratar(request: Request) -> Response:
            try:
                _conferir_tamanho(request)
                return await original(request)
            except ErroApi as exc:
                return resposta_erro(exc.status, exc.codigo, exc.mensagem, exc.detalhes)
            except RequestValidationError as exc:
                # Nunca ecoa o valor recebido.
                detalhes = [f"{'.'.join(str(p) for p in e.get('loc', ()) if p != 'body')}: {e.get('msg', 'inválido')}" for e in exc.errors()]
                return resposta_erro(422, "REQUISICAO_INVALIDA", "Dados inválidos na requisição.", detalhes)

        return tratar
