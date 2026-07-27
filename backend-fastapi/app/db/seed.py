"""Seed idempotente executado no startup.

Os setores deixaram de ser um enum fixo e passaram a viver na tabela `setores`.
Este seed garante que os códigos historicamente usados por `usuarios.setor`,
`tarefas.setor_origem` e `sistemas.setor` existam como registros — a partir daí
o admin cria e edita setores pela interface.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sector import Setor

SETORES_PADRAO: list[tuple[str, str, str]] = [
    ("FISCAL", "Fiscal", "#22d3ee"),
    ("CONTABIL", "Contábil", "#f87171"),
    ("DP", "Departamento Pessoal", "#f472b6"),
    ("SOCIETARIO", "Societário", "#a78bfa"),
    ("DIRETORIA", "Diretoria", "#fbbf24"),
    ("TI", "Tecnologia (TI)", "#facc15"),
    ("GERAL", "Geral", "#94a3b8"),
]


async def seed_setores(db: AsyncSession) -> None:
    result = await db.execute(select(Setor.codigo))
    existentes = set(result.scalars().all())

    novos = [
        Setor(codigo=codigo, nome=nome, cor=cor, ativo=True)
        for codigo, nome, cor in SETORES_PADRAO
        if codigo not in existentes
    ]
    if not novos:
        return

    db.add_all(novos)
    await db.commit()
