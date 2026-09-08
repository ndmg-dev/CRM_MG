"""Reconciliação de insights do poller da VPS (Fase 3).

Requer um Postgres descartável (modelos usam UUID do dialeto PG). Sem banco,
os testes são pulados — igual tests/test_users_sectors.py.
"""
import os
import uuid
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

os.environ.setdefault("JWT_SECRET", "test-only")

from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.notification import Notificacao  # noqa: E402
from app.models.user import Usuario  # noqa: E402
from app.models.vps_monitor import VpsInsightEvent  # noqa: E402
from app.services import vps_poller  # noqa: E402

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def db():
    await engine.dispose()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"Postgres de teste indisponível: {exc}")
    async with AsyncSessionLocal() as session:
        yield session
    await engine.dispose()


def _insight(key, sev="critical"):
    return {"id": key, "severity": sev, "title": f"T {key}", "detail": "d", "value": "9"}


async def test_new_insight_creates_open_event(db):
    now = datetime.utcnow()
    new = await vps_poller._reconcile_insights(db, [_insight("disk")], now)
    await db.commit()
    assert len(new) == 1 and new[0].insight_key == "disk" and new[0].status == "aberto"


async def test_disappeared_insight_is_resolved(db):
    now = datetime.utcnow()
    await vps_poller._reconcile_insights(db, [_insight("ram")], now)
    await db.commit()
    await vps_poller._reconcile_insights(db, [], now + timedelta(minutes=5))
    await db.commit()
    ev = (await db.execute(VpsInsightEvent.__table__.select())).first()
    assert ev.status == "resolvido" and ev.resolvido_em is not None


async def test_reopen_not_duplicated_while_open(db):
    now = datetime.utcnow()
    await vps_poller._reconcile_insights(db, [_insight("cpu", "warning")], now)
    await db.commit()
    new = await vps_poller._reconcile_insights(db, [_insight("cpu", "critical")], now + timedelta(minutes=5))
    await db.commit()
    rows = (await db.execute(VpsInsightEvent.__table__.select())).all()
    assert len(rows) == 1 and rows[0].severity == "critical" and new == []


async def test_notify_ti_creates_one_notification_per_ti_user(db):
    ti = Usuario(id=uuid.uuid4(), nome="TI", email="ti@x.com", perfil="ANALISTA", setor="TI", ativo=True)
    other = Usuario(id=uuid.uuid4(), nome="X", email="x@x.com", perfil="ANALISTA", setor="FISCAL", ativo=True)
    db.add_all([ti, other])
    await db.commit()

    now = datetime.utcnow()
    new = await vps_poller._reconcile_insights(db, [_insight("disk")], now)
    await db.commit()
    await vps_poller._notify_ti(db, new)
    await db.commit()

    notifs = (await db.execute(Notificacao.__table__.select())).all()
    assert len(notifs) == 1 and notifs[0].usuario_id == ti.id
    assert notifs[0].titulo.startswith("[VPS]")
    # idempotente — não notifica de novo
    await vps_poller._notify_ti(db, new)
    await db.commit()
    assert len((await db.execute(Notificacao.__table__.select())).all()) == 1
