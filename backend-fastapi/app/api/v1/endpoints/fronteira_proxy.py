import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import Usuario

router = APIRouter()

# Proxy servidor-a-servidor pro backend do Sistema Fronteira v8
# (tnunes8/sistema-fronteira-v8 — NÃO tocar em nada desse repo, é o
# combinado com o dono do sistema: só migração, zero alteração no
# original). O front nativo em src/systems/fronteira chama só este
# endpoint, nunca o domínio do v8 direto.
#
# Motivo de existir (bem diferente dos outros proxies deste arquivo): a
# sessão do v8 é 100% por cookies httpOnly (access/refresh/csrf/mfa,
# prefixo "fronteira_") configurados hoje só pra same-origin
# (cookie_samesite="lax", sem Domain= em nenhum set_cookie() —
# ver backend/app/api/routes/auth.py do repo original). Não tem como o
# navegador do CRM (outro domínio) enviar/receber esses cookies direto do
# v8 sem o v8 setar um Domain compartilhado — e isso exigiria editar o
# código original, que foi pedido pra não mexer.
#
# Solução: este proxy REESCREVE os cookies em trânsito. Da perspectiva do
# navegador, ele só fala com o próprio CRM (mesmo domínio) — os cookies
# "fronteira_*" acabam pertencendo ao domínio do CRM, nunca ao do v8. O
# proxy repassa Cookie na ida e Set-Cookie (reescrito) na volta, sem guardar
# nenhum estado — cada request é tratado isoladamente, os cookies vivem só
# no navegador, como o v8 original já espera.
FRONTEIRA_BASE_URL = settings.FRONTEIRA_V8_API_URL

FRONTEIRA_COOKIE_PREFIX = "fronteira_"

# O cookie de refresh e o de desafio MFA do original são escopados a
# path="/api/auth" (só viajam pra rotas de login/refresh/logout, nunca pro
# resto da API — reduz superfície de um token de vida mais longa vazando).
# Preserva essa mesma restrição, só que relativa ao novo prefixo do proxy.
_ORIGINAL_AUTH_COOKIE_PATH = "/api/auth"
_PROXY_AUTH_COOKIE_PATH = "/api/v1/fronteira-proxy/auth"

_SET_COOKIE_DOMAIN_RE = re.compile(r";\s*Domain=[^;]*", re.IGNORECASE)
_SET_COOKIE_AUTH_PATH_RE = re.compile(
    r"(;\s*Path=)" + re.escape(_ORIGINAL_AUTH_COOKIE_PATH) + r"(?=;|$)", re.IGNORECASE
)

_HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
    "content-encoding", "cookie", "set-cookie",
}


def _rewrite_set_cookie(raw: str) -> str:
    """Remove Domain= (cookie passa a pertencer ao host que respondeu — o
    próprio CRM, da perspectiva do navegador) e realinha o Path restrito de
    /api/auth pro novo prefixo do proxy."""
    rewritten = _SET_COOKIE_DOMAIN_RE.sub("", raw)
    rewritten = _SET_COOKIE_AUTH_PATH_RE.sub(r"\1" + _PROXY_AUTH_COOKIE_PATH, rewritten)
    return rewritten


def _forward_cookie_header(request: Request) -> str | None:
    """Só repassa cookies fronteira_* pro v8 — nunca cookies/sessão do
    próprio CRM, que não fazem sentido (e não deveriam vazar) pro backend
    de outro sistema."""
    relevant = [
        f"{name}={value}"
        for name, value in request.cookies.items()
        if name.startswith(FRONTEIRA_COOKIE_PREFIX)
    ]
    return "; ".join(relevant) if relevant else None


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_fronteira(
    path: str,
    request: Request,
    current_user: Usuario = Depends(get_current_user),
):
    if not FRONTEIRA_BASE_URL:
        raise HTTPException(
            status_code=503,
            detail="Sistema Fronteira v8 não configurado (FRONTEIRA_V8_API_URL ausente) — v8 ainda não tem ambiente publicado.",
        )

    url = f"{FRONTEIRA_BASE_URL}/api/{path}"
    body = await request.body()

    headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _HOP_BY_HOP
    }
    forwarded_cookie = _forward_cookie_header(request)
    if forwarded_cookie:
        headers["cookie"] = forwarded_cookie

    try:
        async with httpx.AsyncClient() as client:
            upstream = await client.request(
                request.method,
                url,
                params=request.query_params,
                content=body or None,
                headers=headers,
                timeout=60.0,
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível contatar o Sistema Fronteira v8.",
        )

    response_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in _HOP_BY_HOP
    }
    response = Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )

    for raw_cookie in upstream.headers.get_list("set-cookie"):
        response.headers.append("set-cookie", _rewrite_set_cookie(raw_cookie))

    return response
