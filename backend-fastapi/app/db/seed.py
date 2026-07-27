"""Seed idempotente executado no startup.

Os setores deixaram de ser um enum fixo e passaram a viver na tabela `setores`.
Este seed garante que os códigos historicamente usados por `usuarios.setor`,
`tarefas.setor_origem` e `sistemas.setor` existam como registros — a partir daí
o admin cria e edita setores pela interface.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.visibilidade_sistemas import VisibilidadeSistemas
from app.models.sector import Setor

#: (codigo, nome, cor, visibilidade). DIRETORIA e TI nascem com visão TOTAL
#: porque antes dependiam do perfil COORDENADOR para enxergar o catálogo
#: inteiro — agora a permissão é do setor, e não do perfil.
SETORES_PADRAO: list[tuple[str, str, str, VisibilidadeSistemas]] = [
    ("FISCAL", "Fiscal", "#22d3ee", VisibilidadeSistemas.PROPRIO),
    ("CONTABIL", "Contábil", "#f87171", VisibilidadeSistemas.PROPRIO),
    ("DP", "Departamento Pessoal", "#f472b6", VisibilidadeSistemas.PROPRIO),
    ("SOCIETARIO", "Societário", "#a78bfa", VisibilidadeSistemas.PROPRIO),
    ("DIRETORIA", "Diretoria", "#fbbf24", VisibilidadeSistemas.TOTAL),
    ("TI", "Tecnologia (TI)", "#facc15", VisibilidadeSistemas.TOTAL),
    ("GERAL", "Geral", "#94a3b8", VisibilidadeSistemas.PROPRIO),
]


async def seed_setores(db: AsyncSession) -> None:
    result = await db.execute(select(Setor.codigo))
    existentes = set(result.scalars().all())

    novos = [
        Setor(
            codigo=codigo,
            nome=nome,
            cor=cor,
            ativo=True,
            visibilidade_sistemas=visibilidade.value,
            setores_visiveis=[],
        )
        for codigo, nome, cor, visibilidade in SETORES_PADRAO
        if codigo not in existentes
    ]
    if not novos:
        return

    db.add_all(novos)
    await db.commit()
