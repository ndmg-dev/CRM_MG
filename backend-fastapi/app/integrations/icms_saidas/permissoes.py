"""Permissões por ação do sistema ICMS Saídas. Configuráveis por usuário; o perfil ADMIN do CRM tem todas.

Quem opera a apuração (setor Fiscal) recebe `consultar` + `operar`; o coordenador do Fiscal recebe, além disso, `aprovar_lotes`,
`gerir_empresas` e `editar_regras`. O ADMIN concede e revoga em /icms-saidas/permissoes. Qualquer permissão de ação implica `consultar`.
"""
from __future__ import annotations

from collections.abc import Iterable
from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import Usuario
from app.models.usuario_permissao import UsuarioPermissao

from .erros import sem_permissao

SISTEMA = "icms_saidas"
CONSULTAR = f"{SISTEMA}.consultar"
OPERAR = f"{SISTEMA}.operar"
APROVAR_LOTES = f"{SISTEMA}.aprovar_lotes"
GERIR_EMPRESAS = f"{SISTEMA}.gerir_empresas"
EDITAR_REGRAS = f"{SISTEMA}.editar_regras"

TODAS = (CONSULTAR, OPERAR, APROVAR_LOTES, GERIR_EMPRESAS, EDITAR_REGRAS)

CATALOGO = [
    {"codigo": CONSULTAR, "nome": "Consultar", "descricao": "Ver painel, empresas, apurações, memória, lotes, pendências e regras fiscais."},
    {"codigo": OPERAR, "nome": "Operar",
     "descricao": "Apurar e reprocessar, enviar/corrigir/completar a memória, resolver e descartar pendências, baixar planilhas."},
    {"codigo": APROVAR_LOTES, "nome": "Aprovar lotes", "descricao": "Aprovar (item a item) ou rejeitar lotes de atualização da memória."},
    {"codigo": GERIR_EMPRESAS, "nome": "Gerir empresas", "descricao": "Cadastrar empresa, editar razão social/CNPJ e ativar ou desativar."},
    {"codigo": EDITAR_REGRAS, "nome": "Editar regras fiscais", "descricao": "Editar o rascunho, publicar e descartar as regras fiscais."},
]

# Toda permissão de ação inclui consultar (não adianta aprovar o que não se pode ver).
IMPLICA: dict[str, set[str]] = {p: {CONSULTAR} for p in (OPERAR, APROVAR_LOTES, GERIR_EMPRESAS, EDITAR_REGRAS)}


def efetivas(perfil: str | None, concedidas: Iterable[str]) -> set[str]:
    """Permissões em vigor: ADMIN tem todas; os demais, as concedidas (só códigos conhecidos) mais o que elas implicam."""
    if perfil == "ADMIN":
        return set(TODAS)
    saida = {p for p in concedidas if p in TODAS}
    for p in list(saida):
        saida |= IMPLICA.get(p, set())
    return saida


async def obter_permissoes(usuario: Annotated[Usuario, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> set[str]:
    if usuario.perfil == "ADMIN":
        return set(TODAS)
    linhas = (await db.execute(select(UsuarioPermissao.permissao).where(UsuarioPermissao.usuario_id == usuario.id))).scalars().all()
    return efetivas(usuario.perfil, linhas)


def exigir(permissao: str):
    """Dependência: devolve o usuário se ele tem a permissão; senão 403 SEM_PERMISSAO (no formato do motor)."""
    async def verificar(
        usuario: Annotated[Usuario, Depends(get_current_user)],
        permissoes: Annotated[set[str], Depends(obter_permissoes)],
    ) -> Usuario:
        if permissao not in permissoes:
            raise sem_permissao()
        return usuario

    return verificar


async def exigir_admin(usuario: Annotated[Usuario, Depends(get_current_user)]) -> Usuario:
    """Só o perfil ADMIN do CRM concede/revoga permissões (e vê a lista de usuários)."""
    if usuario.perfil != "ADMIN":
        raise sem_permissao()
    return usuario
