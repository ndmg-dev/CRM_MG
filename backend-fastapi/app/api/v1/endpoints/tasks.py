from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.task import Tarefa
from app.schemas.task import TarefaResponse, TarefaCreate, TarefaUpdate, TarefaStatusUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter()


def _pode_gerenciar_tarefa(user: Usuario, tarefa: Tarefa) -> bool:
    """Mesmo corte de visibilidade que já vale pra listagem (get_tarefas) —
    faltava aplicar em update_tarefa/update_tarefa_status (achado na
    varredura de segurança: qualquer usuário autenticado, de qualquer
    setor/perfil, conseguia mudar o status de QUALQUER tarefa só sabendo o
    id, e um COORDENADOR conseguia editar tarefa de outro setor)."""
    if user.perfil == "ADMIN":
        return True
    if user.perfil == "COORDENADOR":
        return tarefa.setor_origem == user.setor or tarefa.responsavel_id == user.id
    return tarefa.responsavel_id == user.id

@router.get("", response_model=PaginatedResponse[TarefaResponse])
async def get_tarefas(
    status: Optional[str] = None,
    setor: Optional[str] = None,
    responsavel_id: Optional[UUID] = None,
    cliente_id: Optional[UUID] = None,
    prioridade: Optional[str] = None,
    page: int = 0,
    size: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # Eagerly load the related User and Client to populate xxxNome fields
    # But since we map them manually or via ORM, we can do joins or manual selects.
    # To keep it simple, we query the Tarefa.
    query = select(Tarefa)
    
    if current_user.perfil == "ADMIN":
        pass
    elif current_user.perfil == "COORDENADOR":
        from sqlalchemy import or_
        query = query.where(or_(Tarefa.setor_origem == current_user.setor, Tarefa.responsavel_id == current_user.id))
    else:
        query = query.where(Tarefa.responsavel_id == current_user.id)

    
    if status:
        query = query.where(Tarefa.status == status)
    if setor:
        query = query.where(Tarefa.setor_origem == setor)
    if responsavel_id:
        query = query.where(Tarefa.responsavel_id == responsavel_id)
    if cliente_id:
        query = query.where(Tarefa.cliente_id == cliente_id)
    if prioridade:
        query = query.where(Tarefa.prioridade == prioridade)
        
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_elements = await db.scalar(count_query)
    
    # Pagination
    query = query.offset(page * size).limit(size)
    result = await db.execute(query)
    tarefas = result.scalars().all()
    
    # We need to map `clienteNome` and `responsavelNome`
    # Normally we'd use relationship() on the model and mapped it via Pydantic.
    # Let's enrich them manually for this prototype or let frontend handle it (frontend usually fetches list).
    
    # To properly fill TarefaResponse, we just return what we have (null names if not joined)
    # The frontend mock implies `clienteNome` is present.
    
    total_pages = (total_elements + size - 1) // size if total_elements > 0 else 0
    
    return PaginatedResponse(
        content=tarefas,
        totalElements=total_elements,
        totalPages=total_pages,
        page=page,
        size=size
    )

@router.post("", response_model=TarefaResponse)
async def create_tarefa(
    tarefa_in: TarefaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN", "COORDENADOR"]))
):
    tarefa = Tarefa(
        **tarefa_in.model_dump(exclude_unset=True)
    )
    db.add(tarefa)
    
    if tarefa.responsavel_id and tarefa.responsavel_id != current_user.id:
        from app.models.notification import Notificacao
        notif = Notificacao(
            usuario_id=tarefa.responsavel_id,
            titulo="Nova tarefa atribuída",
            mensagem=f"Você foi definido como responsável pela tarefa: {tarefa.titulo}"
        )
        db.add(notif)
        
    await db.commit()
    await db.refresh(tarefa)
    return tarefa

@router.put("/{id}", response_model=TarefaResponse)
async def update_tarefa(
    id: UUID,
    tarefa_in: TarefaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN", "COORDENADOR"]))
):
    tarefa = await db.scalar(select(Tarefa).where(Tarefa.id == id))
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa not found")
    if not _pode_gerenciar_tarefa(current_user, tarefa):
        raise HTTPException(status_code=403, detail="Você não tem acesso a esta tarefa")

    old_responsavel = tarefa.responsavel_id
        
    for field, value in tarefa_in.model_dump(exclude_unset=True).items():
        setattr(tarefa, field, value)
        
    if tarefa.responsavel_id != old_responsavel and tarefa.responsavel_id and tarefa.responsavel_id != current_user.id:
        from app.models.notification import Notificacao
        notif = Notificacao(
            usuario_id=tarefa.responsavel_id,
            titulo="Nova tarefa atribuída",
            mensagem=f"Você foi definido como responsável pela tarefa: {tarefa.titulo}"
        )
        db.add(notif)
        
    await db.commit()
    await db.refresh(tarefa)
    return tarefa

@router.patch("/{id}/status", response_model=TarefaResponse)
async def update_tarefa_status(
    id: UUID,
    status_update: TarefaStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    tarefa = await db.scalar(select(Tarefa).where(Tarefa.id == id))
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa not found")
    if not _pode_gerenciar_tarefa(current_user, tarefa):
        raise HTTPException(status_code=403, detail="Você não tem acesso a esta tarefa")

    tarefa.status = status_update.novo_status
    await db.commit()
    await db.refresh(tarefa)
    return tarefa
