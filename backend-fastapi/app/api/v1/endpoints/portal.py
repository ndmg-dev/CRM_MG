from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
import os
import aiofiles
from datetime import datetime

from app.db.session import get_db
from app.models.client_token import ClientToken
from app.models.client import Cliente
from app.models.document import Documento
from app.schemas.document import DocumentoResponse

router = APIRouter()

STORAGE_DIR = "/app/storage/clientes"

@router.get("/{token}/info")
async def get_portal_info(token: str, db: AsyncSession = Depends(get_db)):
    """Validates the token and returns client basic information."""
    stmt = select(ClientToken).where(
        ClientToken.token == token,
        ClientToken.ativo == True,
        ClientToken.data_expiracao > datetime.utcnow()
    )
    result = await db.execute(stmt)
    client_token = result.scalar_one_or_none()

    if not client_token:
        raise HTTPException(status_code=403, detail="Token inválido ou expirado")

    client_stmt = select(Cliente).where(Cliente.id == client_token.cliente_id)
    client_res = await db.execute(client_stmt)
    cliente = client_res.scalar_one_or_none()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    return {
        "cliente_id": cliente.id,
        "razao_social": cliente.razao_social,
        "nome_fantasia": cliente.nome_fantasia,
        "cnpj": cliente.cnpj,
    }

@router.post("/{token}/upload", response_model=DocumentoResponse)
async def upload_document(
    token: str,
    file: UploadFile = File(...),
    competencia: str | None = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Uploads a file using the magic link token."""
    # 1. Validate token
    stmt = select(ClientToken).where(
        ClientToken.token == token,
        ClientToken.ativo == True,
        ClientToken.data_expiracao > datetime.utcnow()
    )
    result = await db.execute(stmt)
    client_token = result.scalar_one_or_none()

    if not client_token:
        raise HTTPException(status_code=403, detail="Token inválido ou expirado")

    # 2. Ensure storage dir exists
    client_dir = os.path.join(STORAGE_DIR, str(client_token.cliente_id))
    os.makedirs(client_dir, exist_ok=True)

    # 3. Save the file locally
    safe_filename = os.path.basename(file.filename).replace(" ", "_")
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    final_filename = f"{timestamp}_{safe_filename}"
    file_path = os.path.join(client_dir, final_filename)

    file_size = 0
    async with aiofiles.open(file_path, 'wb') as out_file:
        while content := await file.read(1024 * 1024):  # 1MB chunks
            await out_file.write(content)
            file_size += len(content)

    # 4. Save metadata to DB
    novo_doc = Documento(
        cliente_id=client_token.cliente_id,
        nome_arquivo=file.filename,
        tamanho_bytes=file_size,
        tipo_mime=file.content_type,
        caminho_storage=file_path,
        enviado_por="CLIENTE",
        status="RECEBIDO",
        competencia=competencia
    )

    db.add(novo_doc)
    await db.commit()
    await db.refresh(novo_doc)

    return novo_doc
