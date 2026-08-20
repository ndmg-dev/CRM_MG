"""Política única de visualização do catálogo de sistemas.

Antes esta regra existia duplicada — e divergente — em `endpoints/systems.py`
e `endpoints/search.py`: a listagem deixava COORDENADOR ver sistemas RESTRITO,
a busca não. Toda decisão de visibilidade passa por aqui.
"""
from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.visibilidade_sistemas import VisibilidadeSistemas
from app.enums.visibilidade_usuario import VisibilidadeUsuario
from app.models.sector import Setor
from app.models.system import Sistema
from app.models.user import Usuario
from app.models.user_system_access import UsuarioSistemaAcesso

#: Setor de sistema que nunca aparece para quem não é ADMIN, qualquer que seja
#: a política do setor do usuário.
SETOR_SISTEMA_RESTRITO = "RESTRITO"
#: Setor de sistema visível a todos (salvo política RESTRITO do setor).
SETOR_SISTEMA_GERAL = "GERAL"


async def carregar_contexto_visibilidade(
    db: AsyncSession, usuario: Usuario
) -> tuple[Optional[Setor], set[UUID]]:
    """Devolve o setor do usuário e os sistemas concedidos individualmente."""
    setor = None
    if usuario.setor:
        setor = await db.scalar(select(Setor).where(Setor.codigo == usuario.setor))

    result = await db.execute(
        select(UsuarioSistemaAcesso.sistema_id).where(
            UsuarioSistemaAcesso.usuario_id == usuario.id
        )
    )
    return setor, set(result.scalars())


def pode_ver_sistema(
    sistema: Sistema,
    usuario: Usuario,
    setor: Optional[Setor],
    acessos_individuais: set[UUID],
) -> bool:
    # ADMIN enxerga o catálogo inteiro, inclusive RESTRITO.
    if usuario.perfil == "ADMIN":
        return True

    # Concessão individual é a decisão mais específica que existe e vence
    # qualquer política, inclusive para sistemas RESTRITO. Só um ADMIN concede,
    # um sistema por vez, e cada concessão fica registrada em auditoria
    # (GRANT_ACCESS) — o padrão continua sendo RESTRITO invisível, porque sem
    # concessão nenhuma o fluxo abaixo o barra.
    if sistema.id in acessos_individuais:
        return True

    # Lista exata: o usuário não herda nada do setor, só o concedido acima.
    if usuario.visibilidade_sistemas == VisibilidadeUsuario.INDIVIDUAL.value:
        return False

    setor_sistema = sistema.setor or SETOR_SISTEMA_GERAL
    if setor_sistema == SETOR_SISTEMA_RESTRITO:
        return False

    modo = (
        setor.visibilidade_sistemas
        if setor
        else VisibilidadeSistemas.PROPRIO.value
    )

    if modo == VisibilidadeSistemas.TOTAL.value:
        return True
    if modo == VisibilidadeSistemas.RESTRITO.value:
        # Só o que foi concedido individualmente, já tratado acima.
        return False

    if setor_sistema == SETOR_SISTEMA_GERAL:
        return True
    if setor and setor_sistema == setor.codigo:
        return True
    if modo == VisibilidadeSistemas.PERSONALIZADO.value and setor:
        return setor_sistema in (setor.setores_visiveis or [])
    return False


def filtrar_sistemas(
    sistemas: Iterable[Sistema],
    usuario: Usuario,
    setor: Optional[Setor],
    acessos_individuais: set[UUID],
) -> list[Sistema]:
    return [
        s for s in sistemas if pode_ver_sistema(s, usuario, setor, acessos_individuais)
    ]
