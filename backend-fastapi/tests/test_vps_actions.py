"""Fase 4 — guardas das ações de escrita na VPS.

Cobre o que NÃO chega a tocar a Hostinger: gate de ADMIN, confirmação
digitada, ação desconhecida, backup_id obrigatório, e a gravação em
logs_auditoria quando a confirmação falha. Requer Postgres descartável.
"""
import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("JWT_SECRET", "test-only")

from app.core.security import create_access_token  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.audit_log import LogAuditoria  # noqa: E402
from app.models.user import Usuario  # noqa: E402

pytestmark = pytest.mark.asyncio


async def _mk_user(perfil: str, setor: str) -> uuid.UUID:
    async with AsyncSessionLocal() as s:
        u = Usuario(id=uuid.uuid4(), nome=perfil, email=f"{perfil}{setor}@x.com".lower(),
                    perfil=perfil, setor=setor, ativo=True)
        s.add(u)
        await s.commit()
        return u.id


@pytest_asyncio.fixture
async def api():
    await engine.dispose()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"Postgres de teste indisponível: {exc}")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t/api/v1") as c:
        yield c
    await engine.dispose()


def _auth(uid: uuid.UUID) -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=uid)}"}


async def test_non_admin_is_forbidden(api):
    ti = await _mk_user("ANALISTA", "TI")
    r = await api.post("/vps/actions/restart/run", json={"confirm": "REINICIAR"}, headers=_auth(ti))
    assert r.status_code == 403


async def test_unknown_action_404(api):
    adm = await _mk_user("ADMIN", "DIRETORIA")
    r = await api.post("/vps/actions/explodir/run", json={"confirm": "X"}, headers=_auth(adm))
    assert r.status_code == 404


async def test_wrong_confirm_word_is_rejected_and_audited(api):
    adm = await _mk_user("ADMIN", "DIRETORIA")
    r = await api.post("/vps/actions/restart/run", json={"confirm": "reiniciar agora"}, headers=_auth(adm))
    assert r.status_code == 400
    assert "REINICIAR" in r.json()["detail"]

    async with AsyncSessionLocal() as s:
        rows = (await s.execute(LogAuditoria.__table__.select())).all()
    assert len(rows) == 1 and rows[0].acao == "vps.restart"
    assert rows[0].detalhes.get("erro")


async def test_restore_backup_requires_backup_id(api):
    adm = await _mk_user("ADMIN", "DIRETORIA")
    r = await api.post("/vps/actions/restore-backup/run",
                       json={"confirm": "RESTAURAR BACKUP"}, headers=_auth(adm))
    assert r.status_code == 400
    assert "backup_id" in r.json()["detail"]


async def test_catalog_lists_confirm_words(api):
    adm = await _mk_user("ADMIN", "DIRETORIA")
    r = await api.get("/vps/action-catalog", headers=_auth(adm))
    assert r.status_code == 200
    by_key = {a["key"]: a for a in r.json()["actions"]}
    assert by_key["restart"]["confirm"] == "REINICIAR"
    assert by_key["restore-backup"]["needsBackupId"] is True
