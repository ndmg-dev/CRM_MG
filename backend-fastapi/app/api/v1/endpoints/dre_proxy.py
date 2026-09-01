import base64

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import Usuario

router = APIRouter()

DRE_BASE_URL = "https://dash-razao.vercel.app"

# Cabeçalhos hop-by-hop e específicos de host que não fazem sentido repassar
# entre os dois backends (nem na ida, nem na volta). content-encoding entra
# aqui também: o httpx já descomprime o corpo (upstream.content vem sempre
# plano), então repassar o header original faria o navegador tentar
# descomprimir bytes que já não estão comprimidos.
_HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
    "content-encoding",
}


def _basic_auth_header() -> str:
    token = base64.b64encode(f"contador:{settings.DASHBOARD_DRE_SENHA}".encode()).decode()
    return f"Basic {token}"


# Proxy servidor-a-servidor para o Dashboard DRE (Next.js/Vercel, repo
# ndmg-dev/DASH_RAZAO). O front nativo em src/systems/dashboard-dre chama só
# este endpoint — nunca o Vercel direto — porque a senha do dashboard
# (DASHBOARD_DRE_SENHA) protege dado financeiro real de cliente e não pode
# vazar pro navegador. A autenticação de quem pode usar este proxy é a do
# próprio CRM (get_current_user); a senha do DRE é injetada aqui, server-side.
@router.api_route("/{path:path}", methods=["GET", "POST", "PUT"])
async def proxy_dre(
    path: str,
    request: Request,
    current_user: Usuario = Depends(get_current_user),
):
    if not settings.DASHBOARD_DRE_SENHA:
        raise HTTPException(
            status_code=503,
            detail="Dashboard DRE não configurado (DASHBOARD_DRE_SENHA ausente).",
        )

    url = f"{DRE_BASE_URL}/{path}"
    body = await request.body()
    headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _HOP_BY_HOP
    }
    headers["authorization"] = _basic_auth_header()

    try:
        async with httpx.AsyncClient() as client:
            upstream = await client.request(
                request.method,
                url,
                params=request.query_params,
                content=body or None,
                headers=headers,
                # 60s: o Assistente de IA (/api/assistente) faz um loop de até 6
                # rodadas de tool-calling na OpenAI antes de responder — o
                # dataset.json e as anotações respondem em <1s, mas essa rota
                # chega perto do timeout antigo de 30s.
                timeout=60.0,
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível contatar o Dashboard DRE.",
        )

    response_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in _HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
