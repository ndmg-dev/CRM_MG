"""Chamada ao motor com X-API-Key (segredo do servidor) e X-Actor (e-mail do usuário do CRM) + leitura segura de uploads.

Nada vindo do cliente compõe o host (MOTOR_ICMS_URL é configuração) e nenhum cabeçalho/cookie do cliente é repassado.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import PurePosixPath
from typing import Any

import httpx
from fastapi import Request
from fastapi.responses import Response, StreamingResponse
from starlette.background import BackgroundTask
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.formparsers import MultiPartException

from app.core.config import settings
from app.models.user import Usuario

from .auditoria import auditar
from .erros import ErroApi, resposta_erro
from .tipos import TETO_ARQUIVO, TIMEOUT_LEITURA, TIPOS_ARQUIVO, TIPOS_DOWNLOAD

log = logging.getLogger("icms_saidas")


def cliente_motor(request: Request) -> httpx.AsyncClient:
    """Cliente HTTP único do app (criado na primeira chamada). Sem URL/chave configuradas: 503, como os demais proxies do CRM."""
    cliente = getattr(request.app.state, "motor_icms", None)
    if cliente is None:
        if not settings.MOTOR_ICMS_URL or not settings.MOTOR_ICMS_API_KEY:
            raise ErroApi(503, "MOTOR_NAO_CONFIGURADO", "O sistema ICMS Saídas não está configurado (MOTOR_ICMS_URL/MOTOR_ICMS_API_KEY).")
        cliente = httpx.AsyncClient(base_url=settings.MOTOR_ICMS_URL.rstrip("/"), follow_redirects=False, trust_env=False, timeout=TIMEOUT_LEITURA)
        request.app.state.motor_icms = cliente
    return cliente


def _parametros(**valores: Any) -> dict[str, str]:
    """Só os parâmetros listados, sem os ausentes; booleanos no formato do motor."""
    saida = {}
    for nome, valor in valores.items():
        if valor is None:
            continue
        saida[nome] = ("true" if valor else "false") if isinstance(valor, bool) else str(valor)
    return saida


def _erro_motor(status: int, corpo: bytes) -> Response:
    try:
        dados = json.loads(corpo)
    except ValueError:
        dados = None
    if status in (401, 403):
        # A chave do CRM foi recusada: problema de configuração, não da sessão do usuário.
        log.error("Motor recusou a chave do CRM (HTTP %s). Confira MOTOR_ICMS_API_KEY e API_KEYS do motor.", status)
        return resposta_erro(
            502, "MOTOR_RECUSOU_CHAVE", "O motor recusou a credencial do CRM. Avise o administrador."
        )
    if isinstance(dados, dict) and isinstance(dados.get("erro"), dict):
        return Response(corpo, status_code=status, media_type="application/json")
    if status >= 500 or dados is None:
        return resposta_erro(502, "MOTOR_INDISPONIVEL", "O motor não respondeu corretamente. Tente novamente.")
    return resposta_erro(status, "ERRO_MOTOR", "O motor recusou a requisição.")


def _cabecalhos_download(resp: httpx.Response) -> dict[str, str]:
    tipo = resp.headers.get("content-type", "").split(";")[0].strip().lower()
    disposicao = resp.headers.get("content-disposition", "")
    cabecalhos = {
        "content-type": tipo if tipo in TIPOS_DOWNLOAD else "application/octet-stream",
        "content-disposition": disposicao if disposicao.lower().startswith("attachment") else "attachment",
    }
    tamanho = resp.headers.get("content-length", "")
    if tamanho.isdigit() and "content-encoding" not in resp.headers:
        cabecalhos["content-length"] = tamanho
    return cabecalhos


async def chamar_motor(
    request: Request,
    usuario: Usuario,
    metodo: str,
    caminho: str,
    *,
    empresa: str | None = None,
    params: dict[str, str] | None = None,
    corpo_json: dict | None = None,
    files: dict | list | None = None,
    data: dict[str, str] | None = None,
    timeout: httpx.Timeout = TIMEOUT_LEITURA,
    download: bool = False,
    cabecalhos_resposta: dict[str, str] | None = None,
) -> Response:
    """`cabecalhos_resposta`: {nome: regex} dos cabeçalhos do motor repassados ao cliente (só em 2xx, JSON ou download,
    e só se o valor casar com a regex)."""
    cliente = cliente_motor(request)
    # Cabeçalhos montados do zero: nada do cliente (Cookie, Authorization...) é repassado.
    cabecalhos = {
        "X-API-Key": settings.MOTOR_ICMS_API_KEY,
        "X-Actor": usuario.email,
        "Accept": "application/json",
    }
    requisicao = cliente.build_request(
        metodo, caminho, params=params, json=corpo_json, files=files, data=data, headers=cabecalhos, timeout=timeout
    )
    resposta: Response
    try:
        resp = await cliente.send(requisicao, stream=True)
    except httpx.HTTPError as exc:
        log.warning("Falha de rede ao chamar o motor (%s %s): %s", metodo, caminho, type(exc).__name__)
        resposta = resposta_erro(502, "MOTOR_INDISPONIVEL", "O motor está indisponível. Tente novamente.")
    else:
        if download and resp.status_code == 200:
            cabecalhos_dl = _cabecalhos_download(resp)
            for nome, padrao in (cabecalhos_resposta or {}).items():  # ex.: resumo da apuração parcial (X-Parcial-*)
                valor = resp.headers.get(nome)
                if valor is not None and re.fullmatch(padrao, valor):
                    cabecalhos_dl[nome] = valor
            resposta = StreamingResponse(
                resp.aiter_bytes(),
                status_code=200,
                headers=cabecalhos_dl,
                background=BackgroundTask(resp.aclose),
            )
        else:
            try:
                corpo = await resp.aread()
            except httpx.HTTPError as exc:
                log.warning("Falha ao ler resposta do motor (%s %s): %s", metodo, caminho, type(exc).__name__)
                corpo, falhou = b"", True
            else:
                falhou = False
            finally:
                await resp.aclose()
            if falhou:
                resposta = resposta_erro(502, "MOTOR_INDISPONIVEL", "O motor está indisponível. Tente novamente.")
            elif resp.status_code >= 400:
                resposta = _erro_motor(resp.status_code, corpo)
            elif resp.status_code == 204:
                resposta = Response(status_code=204)
            elif not resp.headers.get("content-type", "").startswith("application/json"):
                resposta = resposta_erro(502, "MOTOR_INDISPONIVEL", "Resposta inesperada do motor.")
            else:
                resposta = Response(corpo, status_code=resp.status_code, media_type="application/json")
                for nome, padrao in (cabecalhos_resposta or {}).items():
                    valor = resp.headers.get(nome)
                    if valor is not None and re.fullmatch(padrao, valor):
                        resposta.headers[nome] = valor

    if metodo != "GET":
        await auditar(usuario, metodo, caminho, empresa, resposta.status_code)
    return resposta


# --------------------------------------------------------------------------------------------------- uploads


def _nome_arquivo(nome: str | None) -> str:
    base = PurePosixPath((nome or "").replace("\\", "/")).name
    base = re.sub(r"[^\w.\- ()]", "_", base).strip()[:120]
    return base or "arquivo"


async def ler_upload(request: Request, extensoes: set[str], campos: set[str]):
    """Lê o multipart (só depois da autenticação) com teto de tamanho e devolve (form, arquivo, nome, tipo)."""
    if not request.headers.get("content-type", "").startswith("multipart/form-data"):
        raise ErroApi(422, "REQUISICAO_INVALIDA", "Envie o arquivo como multipart/form-data.")
    try:
        form = await request.form(max_files=1, max_fields=len(campos) + 2, max_part_size=4096)
    except (StarletteHTTPException, MultiPartException, ValueError):
        raise ErroApi(422, "REQUISICAO_INVALIDA", "Formulário inválido.") from None
    arquivo = form.get("arquivo")
    if not isinstance(arquivo, UploadFile):
        await form.close()
        raise ErroApi(422, "REQUISICAO_INVALIDA", "Envie o arquivo no campo 'arquivo'.")
    nome = _nome_arquivo(arquivo.filename)
    extensao = PurePosixPath(nome).suffix.lower()
    if extensao not in extensoes:
        await form.close()
        permitidas = ", ".join(sorted(extensoes))
        raise ErroApi(422, "EXTENSAO_INVALIDA", f"Extensão não aceita. Use: {permitidas}.")
    if arquivo.size is None or arquivo.size > TETO_ARQUIVO:
        await form.close()
        raise ErroApi(413, "ARQUIVO_GRANDE", "Arquivo maior que 25 MB.")
    if arquivo.size == 0:
        await form.close()
        raise ErroApi(422, "ARQUIVO_VAZIO", "O arquivo está vazio.")
    return form, arquivo, nome, TIPOS_ARQUIVO[extensao]


MAX_SAIDAS_COMPLETAR = 6


async def ler_uploads_completar(request: Request):
    """Multipart do "completar memória" (só após autenticar): `memoria` (.xlsx/.csv), 1 a 6 `saidas` (.xlsx), `modo`.
    Cada arquivo tem o teto de 25 MB. Devolve (form, memória, saídas, modo); cada arquivo é (nome, arquivo, tipo)."""
    if not request.headers.get("content-type", "").startswith("multipart/form-data"):
        raise ErroApi(422, "REQUISICAO_INVALIDA", "Envie os arquivos como multipart/form-data.")
    try:
        form = await request.form(max_files=1 + MAX_SAIDAS_COMPLETAR + 1, max_fields=4, max_part_size=4096)
    except (StarletteHTTPException, MultiPartException, ValueError):
        raise ErroApi(422, "REQUISICAO_INVALIDA", "Formulário inválido.") from None

    async def conferir(arquivo: object, extensoes: set[str], campo: str):
        if not isinstance(arquivo, UploadFile):
            await form.close()
            raise ErroApi(422, "REQUISICAO_INVALIDA", f"Envie o arquivo no campo '{campo}'.")
        nome = _nome_arquivo(arquivo.filename)
        extensao = PurePosixPath(nome).suffix.lower()
        if extensao not in extensoes:
            await form.close()
            raise ErroApi(422, "EXTENSAO_INVALIDA", f"Extensão não aceita. Use: {', '.join(sorted(extensoes))}.")
        if arquivo.size is None or arquivo.size > TETO_ARQUIVO:
            await form.close()
            raise ErroApi(413, "ARQUIVO_GRANDE", "Arquivo maior que 25 MB.")
        if arquivo.size == 0:
            await form.close()
            raise ErroApi(422, "ARQUIVO_VAZIO", "O arquivo está vazio.")
        return nome, arquivo, TIPOS_ARQUIVO[extensao]

    memoria = await conferir(form.get("memoria"), {".xlsx", ".csv"}, "memoria")
    brutas = form.getlist("saidas")
    if not 1 <= len(brutas) <= MAX_SAIDAS_COMPLETAR:
        await form.close()
        raise ErroApi(
            422, "REQUISICAO_INVALIDA", f"Envie de 1 a {MAX_SAIDAS_COMPLETAR} relatórios de saídas (campo 'saidas')."
        )
    saidas = [await conferir(b, {".xlsx"}, "saidas") for b in brutas]
    try:
        modo = _campo(form, "modo", r"^(ACRESCIMOS|COMPLETA)$") or "ACRESCIMOS"
    except ErroApi:
        await form.close()
        raise
    return form, memoria, saidas, modo


def _campo(form, nome: str, padrao: str) -> str | None:
    valor = form.get(nome)
    if valor is None or valor == "":
        return None
    if not isinstance(valor, str) or not re.fullmatch(padrao, valor):
        raise ErroApi(422, "REQUISICAO_INVALIDA", f"Campo '{nome}' inválido.")
    return valor
