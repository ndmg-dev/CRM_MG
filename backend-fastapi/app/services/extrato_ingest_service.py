"""Ingestão idempotente de extratos de sócios (n8n -> CRM).

O n8n é a fonte da verdade; aqui só espelhamos o resultado. Cada chamada:

1. normaliza o CNPJ e resolve contra `clientes` (achou -> client_id +
   vinculado=True; não achou -> client_id=None + vinculado=False, nunca cria
   cliente);
2. faz upsert do ExtratoProcessado por `sha256` (ON CONFLICT DO UPDATE) —
   reenviar o mesmo PDF converge para o mesmo estado, nunca duplica;
3. substitui as movimentações do extrato (delete+insert por extrato_id);
4. recalcula o ConsolidadoSocioAno dos sócios afetados a partir das
   movimentações do ano (não confia no total pré-somado do payload);
5. grava uma linha no audit_log.
"""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.tipo_movimentacao import TipoMovimentacao
from app.models.audit_log import LogAuditoria
from app.models.client import Cliente
from app.models.consolidado_socio_ano import ConsolidadoSocioAno
from app.models.extrato_processado import ExtratoProcessado
from app.models.movimentacao_socio import MovimentacaoSocio
from app.models.vinculo_cnpj_extrato import VinculoCnpjExtrato
from app.schemas.extrato import IngestExtratoPayload


def _so_digitos(valor: str) -> str:
    return "".join(c for c in (valor or "") if c.isdigit())


def _utc_naive(dt: datetime | None) -> datetime | None:
    """As colunas do projeto são TIMESTAMP WITHOUT TIME ZONE (padrão naive, como
    todo o backend que usa datetime.utcnow()). O n8n manda `processado_em` com
    timezone (ex. ...Z), então convertemos para UTC e tiramos o tzinfo."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def ingest_extrato(db: AsyncSession, payload: IngestExtratoPayload) -> ExtratoProcessado:
    cnpj = _so_digitos(payload.empresa.cnpj)
    sha256 = payload.sha256_hex

    # 1. Resolução de empresa por CNPJ — nunca cria cliente.
    client_id = await _resolver_client_id(db, cnpj)
    vinculado = client_id is not None

    # 2. Upsert do extrato por sha256 (idempotência garantida pelo unique).
    valores = {
        "client_id": client_id,
        "cnpj": cnpj,
        "ano": payload.periodo.ano,
        "mes": payload.periodo.mes,
        "sha256": sha256,
        "arquivo_origem": payload.extrato.arquivo_origem,
        "drive_file_id": payload.extrato.drive_file_id,
        "drive_url": payload.extrato.drive_url,
        "agencia": payload.conta.agencia,
        "conta": payload.conta.conta,
        "banco": payload.conta.banco,
        "processado_em": _utc_naive(payload.extrato.processado_em),
        "vinculado": vinculado,
    }
    stmt = (
        pg_insert(ExtratoProcessado)
        .values(**valores)
        .on_conflict_do_update(
            index_elements=["sha256"],
            set_={k: v for k, v in valores.items() if k != "sha256"},
        )
        .returning(ExtratoProcessado.id)
    )
    extrato_id = await db.scalar(stmt)

    # 3. Substitui as movimentações do extrato (delete+insert).
    await db.execute(delete(MovimentacaoSocio).where(MovimentacaoSocio.extrato_id == extrato_id))
    for m in payload.movimentacoes_socios:
        db.add(
            MovimentacaoSocio(
                extrato_id=extrato_id,
                client_id=client_id,
                socio=m.socio,
                cpf=_so_digitos(m.cpf) or None if m.cpf else None,
                data=m.data,
                tipo=m.tipo.value,
                valor=m.valor,
                descricao=m.descricao,
            )
        )
    await db.flush()

    # 4. Recalcula o consolidado anual dos sócios afetados (só quando vinculado:
    #    ConsolidadoSocioAno exige client_id). Soma todas as movimentações do
    #    ano do cliente, não só as deste extrato.
    if vinculado:
        await _recalcular_consolidado(db, client_id, payload.periodo.ano)

    # 5. Auditoria.
    db.add(
        LogAuditoria(
            usuario_id=None,  # máquina-a-máquina (n8n), não um usuário
            acao="INGEST_EXTRATO",
            alvo=sha256,
            detalhes={
                "cnpj": cnpj,
                "ano": payload.periodo.ano,
                "mes": payload.periodo.mes,
                "vinculado": vinculado,
                "client_id": str(client_id) if client_id else None,
                "movimentacoes": len(payload.movimentacoes_socios),
            },
        )
    )

    await db.commit()
    extrato = await db.get(ExtratoProcessado, extrato_id)
    return extrato


async def _resolver_client_id(db: AsyncSession, cnpj: str):
    """Resolve o cliente de um CNPJ. Ordem: (1) `clientes.cnpj` exato (dígitos);
    (2) `clientes.cnpj` normalizado por dígitos (tolera cadastro salvo com
    máscara); (3) tabela de vínculos manuais. None se continuar órfão."""
    client_id = await db.scalar(select(Cliente.id).where(Cliente.cnpj == cnpj))
    if client_id is not None:
        return client_id
    client_id = await db.scalar(
        select(Cliente.id).where(func.regexp_replace(Cliente.cnpj, r"[^0-9]", "", "g") == cnpj)
    )
    if client_id is not None:
        return client_id
    return await db.scalar(select(VinculoCnpjExtrato.client_id).where(VinculoCnpjExtrato.cnpj == cnpj))


async def reprocessar_nao_vinculados(db: AsyncSession, usuario_id=None) -> dict:
    """Re-resolve todos os extratos órfãos contra o cadastro atual de clientes
    (e os vínculos manuais). Pega o caso comum de o cliente ter sido cadastrado
    DEPOIS do extrato ter sido ingerido."""
    orfaos = (
        (await db.execute(select(ExtratoProcessado).where(ExtratoProcessado.client_id.is_(None))))
        .scalars()
        .all()
    )
    por_cliente: dict = {}
    n = 0
    for e in orfaos:
        cid = await _resolver_client_id(db, e.cnpj)
        if cid is None:
            continue
        e.client_id = cid
        e.vinculado = True
        n += 1
        await db.execute(
            update(MovimentacaoSocio).where(MovimentacaoSocio.extrato_id == e.id).values(client_id=cid)
        )
        por_cliente.setdefault(cid, set()).add(e.ano)

    await db.flush()
    for cid, anos in por_cliente.items():
        for ano in anos:
            await _recalcular_consolidado(db, cid, ano)

    if n:
        db.add(
            LogAuditoria(
                usuario_id=usuario_id,
                acao="REPROCESSAR_NAO_VINCULADOS",
                alvo=None,
                detalhes={"vinculados": n},
            )
        )
    await db.commit()
    return {"vinculados": n}


async def vincular_cnpj(db: AsyncSession, cnpj: str, client_id, usuario_id=None) -> dict:
    """Vincula manualmente um CNPJ órfão a um cliente existente.

    Grava o override (durável contra reenvios do n8n) e aplica aos extratos
    órfãos já existentes desse CNPJ: seta client_id/vinculado, propaga às
    movimentações e recalcula o consolidado dos anos afetados.
    """
    cnpj = _so_digitos(cnpj)

    # Upsert do vínculo (um CNPJ -> um cliente).
    await db.execute(
        pg_insert(VinculoCnpjExtrato)
        .values(cnpj=cnpj, client_id=client_id, created_by=usuario_id)
        .on_conflict_do_update(
            index_elements=["cnpj"],
            set_={"client_id": client_id, "created_by": usuario_id},
        )
    )

    # Aplica aos extratos órfãos já existentes desse CNPJ.
    extratos = (
        (
            await db.execute(
                select(ExtratoProcessado).where(
                    ExtratoProcessado.cnpj == cnpj,
                    ExtratoProcessado.client_id.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    anos = set()
    ids = []
    for e in extratos:
        e.client_id = client_id
        e.vinculado = True
        anos.add(e.ano)
        ids.append(e.id)

    if ids:
        await db.execute(
            update(MovimentacaoSocio).where(MovimentacaoSocio.extrato_id.in_(ids)).values(client_id=client_id)
        )
    await db.flush()

    for ano in anos:
        await _recalcular_consolidado(db, client_id, ano)

    db.add(
        LogAuditoria(
            usuario_id=usuario_id,
            acao="VINCULAR_EXTRATO_CNPJ",
            alvo=cnpj,
            detalhes={"client_id": str(client_id), "extratos": len(extratos), "anos": sorted(anos)},
        )
    )
    await db.commit()
    return {"vinculados": len(extratos), "anos": sorted(anos)}


async def _recalcular_consolidado(db: AsyncSession, client_id, ano: int) -> None:
    """Soma retiradas/aportes por sócio a partir de TODAS as movimentações do
    cliente no ano (via os extratos daquele ano) e faz upsert por sócio."""
    sums = await db.execute(
        select(
            MovimentacaoSocio.socio,
            MovimentacaoSocio.tipo,
            func.coalesce(func.sum(MovimentacaoSocio.valor), 0),
        )
        .join(ExtratoProcessado, ExtratoProcessado.id == MovimentacaoSocio.extrato_id)
        .where(ExtratoProcessado.client_id == client_id, ExtratoProcessado.ano == ano)
        .group_by(MovimentacaoSocio.socio, MovimentacaoSocio.tipo)
    )
    totais: dict[str, dict[str, Decimal]] = {}
    for socio, tipo, total in sums.all():
        slot = totais.setdefault(socio, {"retiradas": Decimal("0"), "aportes": Decimal("0")})
        if tipo == TipoMovimentacao.RETIRADA.value:
            slot["retiradas"] = Decimal(total)
        elif tipo == TipoMovimentacao.APORTE.value:
            slot["aportes"] = Decimal(total)

    agora = datetime.utcnow()
    for socio, slot in totais.items():
        await db.execute(
            pg_insert(ConsolidadoSocioAno)
            .values(
                client_id=client_id,
                socio=socio,
                ano=ano,
                total_retiradas=slot["retiradas"],
                total_aportes=slot["aportes"],
                atualizado_em=agora,
            )
            .on_conflict_do_update(
                constraint="uq_consolidado_cliente_socio_ano",
                set_={
                    "total_retiradas": slot["retiradas"],
                    "total_aportes": slot["aportes"],
                    "atualizado_em": agora,
                },
            )
        )
    await db.flush()
