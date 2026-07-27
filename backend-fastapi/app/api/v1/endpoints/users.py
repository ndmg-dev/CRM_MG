from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.sector import Setor
from app.models.audit_log import LogAuditoria
from app.schemas.user import UsuarioResponse, UsuarioUpdate, UsuarioCreate

router = APIRouter()


async def _validar_setor(db: AsyncSession, codigo: Optional[str]) -> Optional[str]:
    """Confere que o código informado corresponde a um setor ativo."""
    if not codigo:
        return None
    codigo = codigo.strip().upper()
    setor = await db.scalar(select(Setor).where(Setor.codigo == codigo))
    if not setor:
        raise HTTPException(status_code=400, detail=f"Setor '{codigo}' não existe")
    if not setor.ativo:
        raise HTTPException(status_code=400, detail=f"Setor '{setor.nome}' está inativo")
    return setor.codigo


async def _buscar_por_email(db: AsyncSession, email: str) -> Optional[Usuario]:
    """Busca case-insensitive — evita duplicar 'Joao@x' e 'joao@x'."""
    return await db.scalar(
        select(Usuario).where(func.lower(Usuario.email) == email.strip().lower())
    )


@router.get("", response_model=List[UsuarioResponse])
async def get_usuarios(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    result = await db.execute(select(Usuario).order_by(Usuario.nome))
    return result.scalars().all()

@router.get("/{id}", response_model=UsuarioResponse)
async def get_usuario(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    user = await db.scalar(select(Usuario).where(Usuario.id == id))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario not found")
    return user

@router.put("/{id}", response_model=UsuarioResponse)
async def update_usuario(
    id: UUID,
    user_in: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"]))
):
    user = await db.scalar(select(Usuario).where(Usuario.id == id))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario not found")

    update_data = user_in.model_dump(exclude_unset=True)

    if "setor" in update_data:
        update_data["setor"] = await _validar_setor(db, update_data["setor"])

    if "email" in update_data and update_data["email"] != user.email:
        conflito = await _buscar_por_email(db, update_data["email"])
        if conflito and conflito.id != user.id:
            raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    # Um ADMIN não pode remover o próprio acesso e ficar sem quem administre.
    if user.id == current_user.id:
        if update_data.get("ativo") is False:
            raise HTTPException(
                status_code=400, detail="Não é possível desativar o próprio usuário"
            )
        if "perfil" in update_data and update_data["perfil"] != "ADMIN":
            raise HTTPException(
                status_code=400, detail="Não é possível remover o próprio perfil de ADMIN"
            )

    for field, value in update_data.items():
        setattr(user, field, value)

    audit = LogAuditoria(
        usuario_id=current_user.id,
        acao="UPDATE_USER",
        alvo=f"Usuário {user.nome}",
        detalhes={"mudancas": update_data}
    )
    db.add(audit)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    await db.refresh(user)
    return user

@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def create_usuario(
    user_in: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"]))
):
    setor = await _validar_setor(db, user_in.setor)

    # Um usuário pode já ter sido criado automaticamente pelo login Google
    # (perfil VISUALIZADOR, sem setor). Nesse caso completamos o cadastro em
    # vez de devolver "e-mail já cadastrado".
    existing = await _buscar_por_email(db, user_in.email)
    if existing:
        # Um pré-registro é reconhecido por não ter setor e estar no perfil
        # padrão atribuído pelo login; qualquer outro caso é conflito real.
        pre_registro = existing.setor is None and existing.perfil == "VISUALIZADOR"
        if not pre_registro:
            raise HTTPException(status_code=400, detail="E-mail já cadastrado")
        existing.nome = user_in.nome
        existing.perfil = user_in.perfil
        existing.setor = setor
        existing.ativo = user_in.ativo
        db.add(
            LogAuditoria(
                usuario_id=current_user.id,
                acao="CREATE_USER",
                alvo=f"Usuário {existing.nome}",
                detalhes={
                    "user_email": existing.email,
                    "obs": "cadastro completado sobre pré-registro automático de login",
                },
            )
        )
        await db.commit()
        await db.refresh(existing)
        return existing

    user = Usuario(
        nome=user_in.nome,
        email=user_in.email,
        perfil=user_in.perfil,
        setor=setor,
        ativo=user_in.ativo,
        foto_perfil=user_in.foto_perfil,
    )
    db.add(user)

    audit = LogAuditoria(
        usuario_id=current_user.id,
        acao="CREATE_USER",
        alvo=f"Usuário {user.nome}",
        detalhes={"user_email": user.email}
    )
    db.add(audit)

    try:
        await db.commit()
    except IntegrityError:
        # Cadastro concorrente (ou login Google) criou o mesmo e-mail
        await db.rollback()
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    await db.refresh(user)
    return user

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_usuario(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"]))
):
    user = await db.scalar(select(Usuario).where(Usuario.id == id))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível excluir o próprio usuário")

    audit = LogAuditoria(
        usuario_id=current_user.id,
        acao="DELETE_USER",
        alvo=f"Usuário {user.nome}",
        detalhes={"user_email": user.email}
    )
    db.add(audit)

    await db.delete(user)
    await db.commit()
    return None
