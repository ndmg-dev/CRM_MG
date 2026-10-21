"""Módulo Extratos de Sócios (setor Contábil).

- POST /integracoes/n8n/extratos  -> ingestão máquina-a-máquina (HMAC), espelho
  do resultado do fluxo n8n. Não usa JWT de usuário.
- GET  /dashboard/extratos         -> métricas consolidadas do ano.
- GET  /extratos/empresa/{client_id} -> consolidado por sócio + grade mês×sócio.
- GET  /extratos/nao-vinculados    -> extratos cujo CNPJ não casou com cliente.

Os GET são somente-leitura e exigem usuário autenticado (como o dashboard
existente). A visibilidade por setor CONTABIL é feita no card do sistema
(sistemas_seed.sql + visibility_service), sem regra de acesso nova aqui.
"""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, verify_n8n_signature
from app.db.session import get_db
from app.models.client import Cliente
from app.models.consolidado_socio_ano import ConsolidadoSocioAno
from app.models.extrato_processado import ExtratoProcessado
from app.models.movimentacao_socio import MovimentacaoSocio
from app.models.user import Usuario
from app.schemas.extrato import (
    DashboardExtratosResponse,
    EmpresaDetalheResponse,
    EmpresaResumo,
    IngestExtratoPayload,
    MesExtrato,
    NaoVinculadoItem,
    SocioConsolidado,
    VincularRequest,
    VincularResponse,
)
from app.services.extrato_ingest_service import ingest_extrato, reprocessar_nao_vinculados, vincular_cnpj

router = APIRouter()


# --- Ingestão (n8n -> CRM) ---------------------------------------------------

@router.post("/integracoes/n8n/extratos", dependencies=[Depends(verify_n8n_signature)])
async def ingest(
    payload: IngestExtratoPayload,
    db: AsyncSession = Depends(get_db),
):
    extrato = await ingest_extrato(db, payload)
    return {
        "status": "ok",
        "sha256": extrato.sha256,
        "vinculado": extrato.vinculado,
        "client_id": str(extrato.client_id) if extrato.client_id else None,
    }


# --- Leitura -----------------------------------------------------------------

@router.get("/dashboard/extratos", response_model=DashboardExtratosResponse)
async def dashboard_extratos(
    ano: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    hoje = datetime.utcnow()
    ano = ano or hoje.year

    extratos = (
        (
            await db.execute(
                select(ExtratoProcessado).where(ExtratoProcessado.ano == ano)
            )
        )
        .scalars()
        .all()
    )

    # Meses processados por empresa (só vinculadas entram no painel por empresa).
    por_empresa: dict[UUID, set[int]] = {}
    extratos_no_mes = 0
    pendencias = 0
    for e in extratos:
        if e.processado_em and e.processado_em.month == hoje.month and e.processado_em.year == hoje.year:
            extratos_no_mes += 1
        if e.vinculado and e.client_id:
            por_empresa.setdefault(e.client_id, set()).add(e.mes)
        else:
            pendencias += 1

    total_retiradas = await db.scalar(
        select(func.coalesce(func.sum(ConsolidadoSocioAno.total_retiradas), 0)).where(
            ConsolidadoSocioAno.ano == ano
        )
    )
    total_aportes = await db.scalar(
        select(func.coalesce(func.sum(ConsolidadoSocioAno.total_aportes), 0)).where(
            ConsolidadoSocioAno.ano == ano
        )
    )

    empresas: list[EmpresaResumo] = []
    if por_empresa:
        clientes = (
            (
                await db.execute(
                    select(Cliente).where(Cliente.id.in_(list(por_empresa.keys())))
                )
            )
            .scalars()
            .all()
        )
        for c in sorted(clientes, key=lambda x: (x.razao_social or "").lower()):
            empresas.append(
                EmpresaResumo(
                    clientId=c.id,
                    razaoSocial=c.razao_social,
                    cnpj=c.cnpj,
                    mesesProcessados=sorted(por_empresa[c.id]),
                )
            )

    return DashboardExtratosResponse(
        ano=ano,
        empresasComExtrato=len(por_empresa),
        totalRetiradasAno=Decimal(total_retiradas or 0),
        totalAportesAno=Decimal(total_aportes or 0),
        extratosNoMes=extratos_no_mes,
        pendencias=pendencias,
        empresas=empresas,
    )


@router.get("/extratos/empresa/{client_id}", response_model=EmpresaDetalheResponse)
async def extratos_empresa(
    client_id: UUID,
    ano: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cliente = await db.get(Cliente, client_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    ano = ano or datetime.utcnow().year

    extratos = (
        (
            await db.execute(
                select(ExtratoProcessado).where(
                    ExtratoProcessado.client_id == client_id,
                    ExtratoProcessado.ano == ano,
                )
            )
        )
        .scalars()
        .all()
    )
    meses = [
        MesExtrato(mes=e.mes, driveUrl=e.drive_url, driveFileId=e.drive_file_id, sha256=e.sha256)
        for e in sorted(extratos, key=lambda x: x.mes)
    ]

    # Em quais meses cada sócio aparece (para o heatmap mês×sócio).
    meses_por_socio: dict[str, set[int]] = {}
    if extratos:
        rows = await db.execute(
            select(MovimentacaoSocio.socio, ExtratoProcessado.mes)
            .join(ExtratoProcessado, ExtratoProcessado.id == MovimentacaoSocio.extrato_id)
            .where(ExtratoProcessado.client_id == client_id, ExtratoProcessado.ano == ano)
            .distinct()
        )
        for socio, mes in rows.all():
            meses_por_socio.setdefault(socio, set()).add(mes)

    consolidados = (
        (
            await db.execute(
                select(ConsolidadoSocioAno).where(
                    ConsolidadoSocioAno.client_id == client_id,
                    ConsolidadoSocioAno.ano == ano,
                )
            )
        )
        .scalars()
        .all()
    )
    socios = [
        SocioConsolidado(
            socio=c.socio,
            totalRetiradas=c.total_retiradas,
            totalAportes=c.total_aportes,
            meses=sorted(meses_por_socio.get(c.socio, set())),
        )
        for c in sorted(consolidados, key=lambda x: x.socio.lower())
    ]

    return EmpresaDetalheResponse(
        clientId=cliente.id,
        razaoSocial=cliente.razao_social,
        cnpj=cliente.cnpj,
        ano=ano,
        socios=socios,
        meses=meses,
    )


@router.post("/extratos/vincular", response_model=VincularResponse)
async def vincular_extrato(
    body: VincularRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Vincula manualmente um CNPJ órfão a um cliente. Grava um override durável
    (sobrevive a reenvios do n8n) e reprocessa os extratos órfãos desse CNPJ."""
    cliente = await db.get(Cliente, body.client_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return await vincular_cnpj(db, body.cnpj, body.client_id, usuario_id=current_user.id)


@router.post("/extratos/nao-vinculados/reprocessar", response_model=VincularResponse)
async def reprocessar_extratos(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Re-resolve os extratos órfãos contra o cadastro atual de clientes — pega
    os casos em que o cliente foi cadastrado depois do extrato ter chegado."""
    res = await reprocessar_nao_vinculados(db, usuario_id=current_user.id)
    return VincularResponse(vinculados=res["vinculados"], anos=[])


@router.get("/extratos/nao-vinculados", response_model=list[NaoVinculadoItem])
async def extratos_nao_vinculados(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    extratos = (
        (
            await db.execute(
                select(ExtratoProcessado)
                .where(ExtratoProcessado.vinculado == False)  # noqa: E712
                .order_by(ExtratoProcessado.ano.desc(), ExtratoProcessado.mes.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        NaoVinculadoItem(
            id=e.id,
            cnpj=e.cnpj,
            ano=e.ano,
            mes=e.mes,
            arquivoOrigem=e.arquivo_origem,
            driveUrl=e.drive_url,
            processadoEm=e.processado_em,
        )
        for e in extratos
    ]
