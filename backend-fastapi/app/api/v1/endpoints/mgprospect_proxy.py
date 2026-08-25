import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.security import get_current_user
from app.models.user import Usuario

router = APIRouter()

MGPROSPECT_BASE_URL = "https://prospect.nucleodigital.cloud/api/v1"

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


# Proxy servidor-a-servidor para o MG Prospect AI (FastAPI/React, repo
# monteiro-lab/MG-Prospect-AI). O front nativo em src/systems/mg-prospect
# chama só este endpoint — nunca o domínio externo direto — porque a API lá
# só libera CORS pro FRONTEND_URL original (o site público), e mudar isso
# exigiria alterar e reimplantar o repo externo. A autenticação de negócio
# continua sendo a própria do MG Prospect (login/senha da tabela users dele,
# JWT assinado com o SECRET_KEY dele) — este proxy não injeta nenhum
# segredo, só repassa o Authorization como veio do navegador. O
# get_current_user aqui só garante que quem acessa já está logado no CRM,
# pra este proxy não virar um proxy aberto pra qualquer um na internet.
@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_mgprospect(
    path: str,
    request: Request,
    current_user: Usuario = Depends(get_current_user),
):
    url = f"{MGPROSPECT_BASE_URL}/{path}"
    body = await request.body()
    headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _HOP_BY_HOP
    }

    try:
        async with httpx.AsyncClient() as client:
            upstream = await client.request(
                request.method,
                url,
                params=request.query_params,
                content=body or None,
                headers=headers,
                timeout=30.0,
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível contatar o MG Prospect AI.",
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
