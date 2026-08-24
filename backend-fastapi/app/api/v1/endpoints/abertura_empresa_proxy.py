import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.security import get_current_user
from app.models.user import Usuario

router = APIRouter()

# Repassa a submissão do wizard nativo (src/systems/abertura-empresa) pro
# backend original (ndmg-dev/ABRIR_EMPRESA), sem alterar nada lá — o site
# público original continua no ar do jeito que está, pro link que a equipe
# manda direto pro cliente preencher. Isso aqui é só pra quando um
# funcionário preenche pelo próprio CRM: exige login do CRM (diferente do
# formulário público, que não tem auth nenhuma).
ABERTURA_EMPRESA_BASE_URL = "https://abrirempresa.mendoncagalvao.com.br"


@router.post("/submit")
async def proxy_submit(
    request: Request,
    current_user: Usuario = Depends(get_current_user),
):
    body = await request.body()
    content_type = request.headers.get("content-type", "")

    try:
        async with httpx.AsyncClient() as client:
            upstream = await client.post(
                f"{ABERTURA_EMPRESA_BASE_URL}/submit",
                content=body,
                headers={"content-type": content_type},
                timeout=60.0,
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível contatar o serviço de Abertura de Empresa.",
        )

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )
