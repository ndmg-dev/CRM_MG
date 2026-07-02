from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi.responses import FileResponse
from uuid import UUID
import os

from app.db.session import get_db
from app.models.document import Documento
from app.models.client import Cliente
from app.models.client_token import ClientToken
from app.schemas.document import DocumentoResponse, NotifyRequest, AIValidationResponse
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.services.whatsapp import send_whatsapp_message
from app.services.ai_service import validate_documents

router = APIRouter()

@router.get("/clientes/{cliente_id}/documentos", response_model=list[DocumentoResponse])
async def get_client_documents(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    stmt = select(Documento).where(Documento.cliente_id == cliente_id).order_by(Documento.data_envio.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/documentos/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN", "COORDENADOR", "ANALISTA", "ASSISTENTE"]))
):
    stmt = select(Documento).where(Documento.id == document_id)
    result = await db.execute(stmt)
    documento = result.scalar_one_or_none()

    if not documento:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    if not os.path.exists(documento.caminho_storage):
        raise HTTPException(status_code=404, detail="Arquivo físico não encontrado")

    return FileResponse(
        path=documento.caminho_storage, 
        filename=documento.nome_arquivo, 
        media_type=documento.tipo_mime
    )

@router.post("/clientes/{cliente_id}/notificar-pendencias")
async def notify_pending_documents(
    cliente_id: UUID,
    background_tasks: BackgroundTasks,
    request_data: NotifyRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # 1. Obter Cliente
    stmt = select(Cliente).where(Cliente.id == cliente_id)
    result = await db.execute(stmt)
    cliente = result.scalar_one_or_none()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    if not cliente.telefone_whatsapp:
        raise HTTPException(status_code=400, detail="Cliente não possui WhatsApp cadastrado.")

    # 2. Gerar ou reutilizar token ativo
    token_stmt = select(ClientToken).where(
        ClientToken.cliente_id == cliente_id,
        ClientToken.ativo == True
    )
    token_res = await db.execute(token_stmt)
    token = token_res.scalar_one_or_none()

    if not token:
        token = ClientToken(cliente_id=cliente_id)
        db.add(token)
        await db.commit()
        await db.refresh(token)

    # 3. Montar a URL do Portal do Cliente
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    portal_url = f"{frontend_url}/portal/{token.token}"

    # 4. Enviar mensagem WhatsApp via Background Task
    mensagem = f"Olá, equipe da *{cliente.razao_social}*!\n\n"
    mensagem += "Notamos que ainda faltam alguns documentos pendentes deste mês.\n"
    
    if request_data and request_data.faltantes:
        mensagem += "\n*Itens Faltantes:*\n"
        for item in request_data.faltantes:
            mensagem += f"❌ {item}\n"
        mensagem += "\n"
        
    mensagem += "Acesse seu portal pelo link abaixo para enviar de forma rápida e segura:\n\n"
    mensagem += f"👉 {portal_url}\n\n"
    mensagem += "Atenciosamente,\nEquipe Mendonça Galvão CRM Contábil"

    background_tasks.add_task(send_whatsapp_message, cliente.telefone_whatsapp, mensagem)

    return {"message": "Notificação enviada com sucesso", "portal_url": portal_url}

@router.post("/clientes/{cliente_id}/validar-competencia", response_model=AIValidationResponse)
async def validate_competencia_ai(
    cliente_id: UUID,
    competencia: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # 1. Obter Cliente e regras
    stmt = select(Cliente).where(Cliente.id == cliente_id)
    result = await db.execute(stmt)
    cliente = result.scalar_one_or_none()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
        
    if not cliente.documentos_exigidos:
        raise HTTPException(status_code=400, detail="Este cliente não possui 'Documentos Exigidos' configurados em seu cadastro.")

    # 2. Obter Documentos da Competência
    doc_stmt = select(Documento).where(
        Documento.cliente_id == cliente_id,
        Documento.competencia == competencia
    )
    doc_result = await db.execute(doc_stmt)
    documentos = doc_result.scalars().all()
    
    if not documentos:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado para esta competência.")
        
    arquivos_nomes = [doc.nome_arquivo for doc in documentos]
    
    # 3. Chamar a IA
    try:
        resultado = await validate_documents(cliente.documentos_exigidos, arquivos_nomes)
        return AIValidationResponse(
            validados=resultado.get("validados", []),
            faltantes=resultado.get("faltantes", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/clientes/{cliente_id}/portal-link")
async def get_portal_link(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # 1. Obter Cliente
    stmt = select(Cliente).where(Cliente.id == cliente_id)
    result = await db.execute(stmt)
    cliente = result.scalar_one_or_none()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    # 2. Gerar ou reutilizar token ativo
    token_stmt = select(ClientToken).where(
        ClientToken.cliente_id == cliente_id,
        ClientToken.ativo == True
    )
    token_res = await db.execute(token_stmt)
    token = token_res.scalar_one_or_none()

    if not token:
        token = ClientToken(cliente_id=cliente_id)
        db.add(token)
        await db.commit()
        await db.refresh(token)

    # 3. Montar a URL do Portal do Cliente
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    portal_url = f"{frontend_url}/portal/{token.token}"

    return {"portal_url": portal_url}
