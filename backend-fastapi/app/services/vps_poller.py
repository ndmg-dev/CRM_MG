"""Fase 3 do monitoramento da VPS — poller em background.

O backend do CRM não tem scheduler; este módulo roda como uma asyncio task
iniciada no lifespan do FastAPI (app/main.py). A cada `VPS_POLL_INTERVAL_SECONDS`:

  1. coleta o estado da VPS (métricas + insights) via vps_monitor.collect_state
  2. grava um VpsMetricSnapshot (histórico além da janela da Hostinger)
  3. reconcilia os insights com os VpsInsightEvent abertos:
       - insight novo        → cria evento (status "aberto")
       - insight que sumiu   → marca o evento como "resolvido"
       - severidade mudou    → atualiza o evento
  4. eventos novos com severidade em VPS_NOTIFY_SEVERITIES → cria uma
     Notificacao pra cada usuário do setor de TI (uma vez, via flag notificado)
  5. poda snapshots além de VPS_HISTORY_RETENTION_DAYS

No-op enquanto HOSTINGER_API_TOKEN estiver vazio.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import delete, select

from app.api.v1.endpoints.vps_monitor import collect_state
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.notification import Notificacao
from app.models.user import Usuario
from app.models.vps_monitor import VpsInsightEvent, VpsMetricSnapshot

logger = logging.getLogger(__name__)


async def run_poller() -> None:
    """Loop infinito — cancelado no shutdown do lifespan."""
    interval = max(settings.VPS_POLL_INTERVAL_SECONDS, 60)
    logger.info("vps-poller: iniciado (intervalo %ss)", interval)
    while True:
        try:
            await asyncio.sleep(interval)
            if not settings.HOSTINGER_API_TOKEN:
                continue
            async with AsyncSessionLocal() as db:
                await poll_once(db)
        except asyncio.CancelledError:
            logger.info("vps-poller: encerrado")
            raise
        except Exception:  # noqa: BLE001 — o loop nunca pode morrer
            logger.exception("vps-poller: ciclo falhou (segue no próximo)")


async def poll_once(db) -> None:
    state = await collect_state(hours=24 * 30)
    now = datetime.utcnow()

    _write_snapshot(db, state, now)
    new_events = await _reconcile_insights(db, state["insights"], now)
    await db.commit()

    if new_events:
        await _notify_ti(db, new_events)
        await db.commit()

    await _prune(db, now)
    await db.commit()


def _write_snapshot(db, state: dict, now: datetime) -> None:
    latest = state.get("latest") or {}
    db.add(
        VpsMetricSnapshot(
            coletado_em=now,
            fonte="hostinger",
            cpu_pct=latest.get("cpu"),
            ram_pct=latest.get("ramPct"),
            ram_bytes=latest.get("ram"),
            disk_pct=latest.get("diskPct"),
            disk_bytes=latest.get("disk"),
            net_in_bytes=latest.get("netIn"),
            net_out_bytes=latest.get("netOut"),
        )
    )


async def _reconcile_insights(db, insights: list[dict], now: datetime) -> list[VpsInsightEvent]:
    live = {i["id"]: i for i in insights}
    open_rows = (
        await db.execute(select(VpsInsightEvent).where(VpsInsightEvent.status != "resolvido"))
    ).scalars().all()
    open_by_key = {r.insight_key: r for r in open_rows}

    new_events: list[VpsInsightEvent] = []

    # Novos / atualizados.
    for key, i in live.items():
        ev = open_by_key.get(key)
        if ev is None:
            ev = VpsInsightEvent(
                insight_key=key,
                severity=i["severity"],
                titulo=i["title"],
                detalhe=i["detail"],
                valor=i.get("value"),
                status="aberto",
                aberto_em=now,
                atualizado_em=now,
            )
            db.add(ev)
            new_events.append(ev)
        else:
            ev.severity = i["severity"]
            ev.titulo = i["title"]
            ev.detalhe = i["detail"]
            ev.valor = i.get("value")
            ev.atualizado_em = now

    # Resolvidos (não aparecem mais).
    for key, ev in open_by_key.items():
        if key not in live:
            ev.status = "resolvido"
            ev.resolvido_em = now
            ev.atualizado_em = now

    return new_events


async def _notify_ti(db, events: list[VpsInsightEvent]) -> None:
    alvo = {s.lower() for s in settings.VPS_NOTIFY_SEVERITIES}
    to_notify = [e for e in events if e.severity.lower() in alvo and not e.notificado]
    if not to_notify:
        return

    ti_users = (
        await db.execute(
            select(Usuario.id).where(Usuario.ativo.is_(True), Usuario.setor == "TI")
        )
    ).scalars().all()
    if not ti_users:
        logger.warning("vps-poller: alerta crítico sem usuários de TI pra notificar")

    for ev in to_notify:
        for uid in ti_users:
            db.add(
                Notificacao(
                    usuario_id=uid,
                    titulo=f"[VPS] {ev.titulo}",
                    mensagem=ev.detalhe[:1000],
                )
            )
        ev.notificado = True
    logger.info("vps-poller: %d alerta(s) notificado(s) a %d usuário(s) de TI", len(to_notify), len(ti_users))


async def _prune(db, now: datetime) -> None:
    cutoff = now - timedelta(days=max(settings.VPS_HISTORY_RETENTION_DAYS, 7))
    await db.execute(delete(VpsMetricSnapshot).where(VpsMetricSnapshot.coletado_em < cutoff))
