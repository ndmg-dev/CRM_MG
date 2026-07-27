from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import Usuario
from app.models.sector import Setor
from app.models.audit_log import LogAuditoria
from app.schemas.sector import SetorCreate, SetorUpdate, SetorResponse
from app.enums.visibilidade_sistemas import VisibilidadeSistemas

router = APIRouter()


async def _contagem_usuarios(db: AsyncSession) -> dict[str, int]:
    result = await db.execute(
        select(Usuario.setor, func.count(Usuario.id)).group_by(Usuario.setor)
    )
    return {codigo: total for codigo, total in result.all() if codigo}


def _to_response(setor: Setor, contagens: dict[str, int]) -> SetorResponse:
    return SetorResponse(
        id=setor.id,
        codigo=setor.codigo,
        nome=setor.nome,
        cor=setor.cor,
        ativo=setor.ativo,
        visibilidade_sistemas=setor.visibilidade_sistemas,
        setores_visiveis=setor.setores_visiveis or [],
        data_criacao=setor.data_criacao,
        total_usuarios=contagens.get(setor.codigo, 0),
    )


async def _validar_setores_visiveis(
    db: AsyncSession, codigos: list[str], proprio_codigo: str
) -> None:
    if proprio_codigo in codigos:
        raise HTTPException(
            status_code=400,
            detail="O próprio setor já é visível; não precisa constar na lista",
        )
    result = await db.execute(select(Setor.codigo).where(Setor.codigo.in_(codigos)))
    existentes = set(result.scalars())
    faltando = sorted(set(codigos) - existentes)
    if faltando:
        raise HTTPException(
            status_code=400, detail=f"Setores inexistentes: {', '.join(faltando)}"
        )


@router.get("", response_model=List[SetorResponse])
async def get_setores(
    incluir_inativos: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    query = select(Setor).order_by(Setor.nome)
    if not incluir_inativos:
        query = query.where(Setor.ativo == True)
    result = await db.execute(query)
    setores = result.scalars().all()
    contagens = await _contagem_usuarios(db)
    return [_to_response(s, contagens) for s in setores]


@router.post("", response_model=SetorResponse, status_code=status.HTTP_201_CREATED)
async def create_setor(
    setor_in: SetorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    existing = await db.scalar(select(Setor).where(Setor.codigo == setor_in.codigo))
    if existing:
        raise HTTPException(
            status_code=400, detail=f"Já existe um setor com o código {setor_in.codigo}"
        )

    if setor_in.setores_visiveis:
        await _validar_setores_visiveis(db, setor_in.setores_visiveis, setor_in.codigo)

    setor = Setor(
        codigo=setor_in.codigo,
        nome=setor_in.nome,
        cor=setor_in.cor,
        ativo=setor_in.ativo,
        visibilidade_sistemas=setor_in.visibilidade_sistemas.value,
        setores_visiveis=setor_in.setores_visiveis,
    )
    db.add(setor)
    db.add(
        LogAuditoria(
            usuario_id=current_user.id,
            acao="CREATE_SECTOR",
            alvo=f"Setor {setor.nome}",
            detalhes={
                "codigo": setor.codigo,
                "visibilidade_sistemas": setor.visibilidade_sistemas,
                "setores_visiveis": setor.setores_visiveis,
            },
        )
    )

    try:
        await db.commit()
    except IntegrityError:
        # Cadastro concorrente com o mesmo código
        await db.rollback()
        raise HTTPException(
            status_code=409, detail=f"Já existe um setor com o código {setor_in.codigo}"
        )

    await db.refresh(setor)
    return _to_response(setor, {})


@router.put("/{id}", response_model=SetorResponse)
async def update_setor(
    id: UUID,
    setor_in: SetorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    setor = await db.scalar(select(Setor).where(Setor.id == id))
    if not setor:
        raise HTTPException(status_code=404, detail="Setor não encontrado")

    update_data = setor_in.model_dump(exclude_unset=True)

    if "visibilidade_sistemas" in update_data:
        update_data["visibilidade_sistemas"] = update_data["visibilidade_sistemas"].value

    # Coerência entre o modo e a lista, considerando o que já está gravado.
    modo = update_data.get("visibilidade_sistemas", setor.visibilidade_sistemas)
    visiveis = update_data.get("setores_visiveis", setor.setores_visiveis or [])
    if modo == VisibilidadeSistemas.PERSONALIZADO.value:
        if not visiveis:
            raise HTTPException(
                status_code=400,
                detail="No modo PERSONALIZADO informe ao menos um setor visível",
            )
        await _validar_setores_visiveis(db, visiveis, setor.codigo)
        update_data["setores_visiveis"] = visiveis
    else:
        # Fora do PERSONALIZADO a lista é limpa, para não ficar configuração
        # morta sugerindo um acesso que não existe.
        update_data["setores_visiveis"] = []

    if update_data.get("ativo") is False:
        contagens = await _contagem_usuarios(db)
        em_uso = contagens.get(setor.codigo, 0)
        if em_uso:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Não é possível desativar: {em_uso} usuário(s) ainda estão "
                    f"vinculados a este setor"
                ),
            )

    for field, value in update_data.items():
        setattr(setor, field, value)

    db.add(
        LogAuditoria(
            usuario_id=current_user.id,
            acao="UPDATE_SECTOR",
            alvo=f"Setor {setor.nome}",
            detalhes={"codigo": setor.codigo, "mudancas": update_data},
        )
    )

    await db.commit()
    await db.refresh(setor)
    contagens = await _contagem_usuarios(db)
    return _to_response(setor, contagens)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setor(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["ADMIN"])),
):
    setor = await db.scalar(select(Setor).where(Setor.id == id))
    if not setor:
        raise HTTPException(status_code=404, detail="Setor não encontrado")

    contagens = await _contagem_usuarios(db)
    em_uso = contagens.get(setor.codigo, 0)
    if em_uso:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Não é possível excluir: {em_uso} usuário(s) ainda estão vinculados "
                f"a este setor. Reatribua-os antes de excluir."
            ),
        )

    # Outro setor pode enxergar os sistemas deste via modo PERSONALIZADO;
    # excluir sem avisar deixaria a configuração daquele setor apontando para
    # um código inexistente.
    result = await db.execute(
        select(Setor.nome).where(
            Setor.setores_visiveis.contains([setor.codigo]), Setor.id != setor.id
        )
    )
    referenciado_por = sorted(result.scalars())
    if referenciado_por:
        raise HTTPException(
            status_code=400,
            detail=(
                "Não é possível excluir: os setores "
                f"{', '.join(referenciado_por)} têm visibilidade sobre os sistemas "
                "deste setor. Ajuste a configuração deles antes de excluir."
            ),
        )

    db.add(
        LogAuditoria(
            usuario_id=current_user.id,
            acao="DELETE_SECTOR",
            alvo=f"Setor {setor.nome}",
            detalhes={"codigo": setor.codigo},
        )
    )

    await db.delete(setor)
    await db.commit()
    return None
