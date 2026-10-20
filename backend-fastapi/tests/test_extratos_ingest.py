"""Ingestão n8n -> CRM do módulo Extratos de Sócios.

Cobre o DoD da Etapa 2: 401 sem assinatura válida, 422 fora do schema,
idempotência por sha256, CNPJ sem cliente (vinculado=False) e auditoria.

Requer um Postgres descartável, igual tests/test_dominio_integration.py. Se
nenhum banco responder, os testes são pulados.
"""
import hashlib
import hmac
import json
import os
import uuid

os.environ.setdefault("JWT_SECRET", "test-only")
os.environ.setdefault("N8N_INGEST_SECRET", "test-secret")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.audit_log import LogAuditoria  # noqa: E402
from app.models.client import Cliente  # noqa: E402
from app.models.extrato_processado import ExtratoProcessado  # noqa: E402
from app.models.movimentacao_socio import MovimentacaoSocio  # noqa: E402
from app.models.user import Usuario  # noqa: E402

pytestmark = pytest.mark.asyncio

SECRET = b"test-secret"
CNPJ_COM_CLIENTE = "12345678000190"
CNPJ_SEM_CLIENTE = "99999999000199"
INGEST_PATH = "/api/v1/integracoes/n8n/extratos"


def _assinar(body: bytes) -> str:
    return hmac.new(SECRET, body, hashlib.sha256).hexdigest()


def _payload(cnpj: str, sha: str, movimentacoes=None):
    return {
        "idempotency_key": f"sha256:{sha}",
        "empresa": {"cnpj": cnpj, "razao_social": "ACME LTDA"},
        "conta": {"agencia": "1234", "conta": "56789-0", "banco": "Banco X"},
        "periodo": {"ano": 2026, "mes": 9},
        "extrato": {
            "arquivo_origem": "extrato_set2026.pdf",
            "drive_file_id": "1a2b3c",
            "drive_url": "https://drive.google.com/file/d/1a2b3c",
            "processado_em": "2026-10-20T14:30:00Z",
        },
        "movimentacoes_socios": movimentacoes if movimentacoes is not None else [
            {"socio": "FULANO", "cpf": "11111111111", "data": "2026-09-05", "tipo": "retirada", "valor": 5000.00, "descricao": "pró-labore"},
            {"socio": "FULANO", "cpf": "11111111111", "data": "2026-09-20", "tipo": "aporte", "valor": 1000.00, "descricao": "aporte"},
        ],
        "consolidado_ano": [
            {"socio": "FULANO", "ano": 2026, "total_retiradas": 5000.00, "total_aportes": 1000.00}
        ],
    }


async def _post_assinado(client: AsyncClient, payload: dict):
    body = json.dumps(payload).encode()
    return await client.post(
        INGEST_PATH,
        content=body,
        headers={"Content-Type": "application/json", "X-Signature": _assinar(body)},
    )


@pytest_asyncio.fixture
async def client():
    await engine.dispose()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:  # pragma: no cover - ambiente sem banco
        pytest.skip(f"Postgres de teste indisponível: {exc}")

    admin_id = uuid.uuid4()
    async with AsyncSessionLocal() as session:
        session.add(Cliente(id=uuid.uuid4(), razao_social="ACME LTDA", cnpj=CNPJ_COM_CLIENTE))
        session.add(Usuario(id=admin_id, nome="Admin", email="admin@mendoncagalvao.com.br", perfil="ADMIN", setor="CONTABIL", ativo=True))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        c.headers.update({"Authorization": f"Bearer {create_access_token(subject=admin_id)}"})
        yield c

    await engine.dispose()


async def test_401_sem_assinatura(client):
    body = json.dumps(_payload(CNPJ_COM_CLIENTE, "a" * 64)).encode()
    # Sem header X-Signature.
    r = await client.post(INGEST_PATH, content=body, headers={"Content-Type": "application/json"})
    assert r.status_code == 401

    # Com assinatura errada.
    r = await client.post(INGEST_PATH, content=body, headers={"Content-Type": "application/json", "X-Signature": "deadbeef"})
    assert r.status_code == 401


async def test_422_fora_do_schema(client):
    # Corpo válido para assinar, mas inválido para o schema (faltam campos).
    corpo = {"idempotency_key": "sha256:" + "a" * 64, "empresa": {}}
    r = await _post_assinado(client, corpo)
    assert r.status_code == 422


async def test_ingest_vinculado_e_idempotente(client):
    sha = "b" * 64
    r = await _post_assinado(client, _payload(CNPJ_COM_CLIENTE, sha))
    assert r.status_code == 200
    assert r.json()["vinculado"] is True
    assert r.json()["client_id"] is not None

    # Reenvio do mesmo sha256 não duplica.
    r = await _post_assinado(client, _payload(CNPJ_COM_CLIENTE, sha))
    assert r.status_code == 200

    async with AsyncSessionLocal() as s:
        extratos = await s.scalar(select(func.count()).select_from(ExtratoProcessado).where(ExtratoProcessado.sha256 == sha))
        assert extratos == 1
        movs = await s.scalar(select(func.count()).select_from(MovimentacaoSocio))
        assert movs == 2  # substituídas, não acumuladas


async def test_cnpj_sem_cliente_grava_nao_vinculado(client):
    r = await _post_assinado(client, _payload(CNPJ_SEM_CLIENTE, "c" * 64))
    assert r.status_code == 200
    assert r.json()["vinculado"] is False
    assert r.json()["client_id"] is None

    r2 = await client.get("/api/v1/extratos/nao-vinculados")
    assert r2.status_code == 200
    assert any(item["cnpj"] == CNPJ_SEM_CLIENTE for item in r2.json())


async def test_cada_ingest_gera_audit_log(client):
    await _post_assinado(client, _payload(CNPJ_COM_CLIENTE, "d" * 64))
    async with AsyncSessionLocal() as s:
        logs = await s.scalar(
            select(func.count()).select_from(LogAuditoria).where(LogAuditoria.acao == "INGEST_EXTRATO")
        )
        assert logs == 1


async def test_dashboard_e_detalhe_empresa(client):
    await _post_assinado(client, _payload(CNPJ_COM_CLIENTE, "e" * 64))

    r = await client.get("/api/v1/dashboard/extratos?ano=2026")
    assert r.status_code == 200
    data = r.json()
    assert data["empresasComExtrato"] == 1
    assert float(data["totalRetiradasAno"]) == 5000.00
    assert data["empresas"][0]["mesesProcessados"] == [9]

    client_id = data["empresas"][0]["clientId"]
    r2 = await client.get(f"/api/v1/extratos/empresa/{client_id}?ano=2026")
    assert r2.status_code == 200
    det = r2.json()
    assert det["socios"][0]["socio"] == "FULANO"
    assert float(det["socios"][0]["totalRetiradas"]) == 5000.00
    assert det["socios"][0]["meses"] == [9]
    assert det["meses"][0]["mes"] == 9
    assert det["meses"][0]["driveUrl"].startswith("https://drive.google.com")
