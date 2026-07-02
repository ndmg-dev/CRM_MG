from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.client import Cliente
from app.schemas.client import ClienteResponse, ClienteCreate, ClienteUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter()

@router.get("", response_model=PaginatedResponse[ClienteResponse])
async def get_clientes(
    page: int = 0,
    size: int = 20,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = select(Cliente)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Cliente.razao_social.ilike(search_term),
                Cliente.nome_fantasia.ilike(search_term),
                Cliente.cnpj.ilike(search_term)
            )
        )
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_elements = await db.scalar(count_query)
    
    # Pagination
    query = query.offset(page * size).limit(size)
    result = await db.execute(query)
    content = result.scalars().all()
    
    total_pages = (total_elements + size - 1) // size if total_elements > 0 else 0
    
    return PaginatedResponse(
        content=content,
        totalElements=total_elements,
        totalPages=total_pages,
        page=page,
        size=size
    )

@router.get("/{id}", response_model=ClienteResponse)
async def get_cliente(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    cliente = await db.scalar(select(Cliente).where(Cliente.id == id))
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente not found")
    return cliente

@router.post("", response_model=ClienteResponse)
async def create_cliente(
    cliente_in: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN", "COORDENADOR"]))
):
    cliente = Cliente(**cliente_in.model_dump())
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente

@router.put("/{id}", response_model=ClienteResponse)
async def update_cliente(
    id: UUID,
    cliente_in: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN", "COORDENADOR"]))
):
    cliente = await db.scalar(select(Cliente).where(Cliente.id == id))
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente not found")
    
    update_data = cliente_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cliente, field, value)
    
    await db.commit()
    await db.refresh(cliente)
    return cliente
