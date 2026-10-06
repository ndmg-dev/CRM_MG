"""Fluxo completo da integração Domínio (ativação -> rubrica -> perfil do
colaborador -> preview -> envio), em modo mock — nunca toca a rede real.

Requer um Postgres descartável, igual tests/test_users_sectors.py. Se
nenhum banco responder, os testes são pulados em vez de falharem.
"""
import os
import uuid
from decimal import Decimal

from cryptography.fernet import Fernet

os.environ.setdefault("JWT_SECRET", "test-only")
# Gerada em runtime de propósito — nunca um literal no código-fonte, mesmo
# sendo só uma chave descartável de teste (o GitGuardian não distingue).
os.environ.setdefault("DOMINIO_ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ["DOMINIO_API_MOCK"] = "true"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.client import Cliente  # noqa: E402
from app.models.user import Usuario  # noqa: E402

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def client():
    await engine.dispose()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:  # pragma: no cover - ambiente sem banco
        pytest.skip(f"Postgres de teste indisponível: {exc}")

    cliente_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    async with AsyncSessionLocal() as session:
        session.add(Cliente(id=cliente_id, razao_social="Empresa Teste LTDA", cnpj="00000000000100"))
        session.add(Usuario(id=admin_id, nome="Admin", email="admin@mendoncagalvao.com.br", perfil="ADMIN", setor="DIRETORIA", ativo=True))
        await session.commit()

    headers = {"Authorization": f"Bearer {create_access_token(subject=admin_id)}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t/api/v1/dominio") as c:
        c.headers.update(headers)
        c.cliente_id = cliente_id
        yield c

    await engine.dispose()


async def test_ativacao_completa_em_modo_mock(client):
    r = await client.post(f"/clientes/{client.cliente_id}/integracao/validar-chave", json={"activation_key": "chave-do-contador"})
    assert r.status_code == 200
    assert r.json()["client_name"] == "EMPRESA TESTE LTDA"

    r = await client.post(f"/clientes/{client.cliente_id}/integracao/ativar")
    assert r.status_code == 200
    assert r.json()["enabled"] is True


async def test_ativar_sem_validar_chave_e_bloqueado(client):
    r = await client.post(f"/clientes/{client.cliente_id}/integracao/ativar")
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "CHAVE_NAO_VALIDADA"


async def test_fluxo_completo_preview_e_envio(client):
    cid = client.cliente_id

    await client.post(f"/clientes/{cid}/integracao/validar-chave", json={"activation_key": "chave"})
    await client.post(f"/clientes/{cid}/integracao/ativar")
    await client.put(f"/clientes/{cid}/integracao/formato-horas", json={"hours_format": "HOURS_MINUTES"})

    r = await client.put(f"/clientes/{cid}/rubricas", json={
        "internal_event_type": "OVERTIME_50", "payslip_item_code": 150, "unit": "HOURS", "enabled": True,
    })
    assert r.status_code == 200

    r = await client.put(f"/clientes/{cid}/colaboradores", json={
        "employee_id": "32", "cpf": "12345678901", "esocial_category_code": 101,
        "admission_date": "2024-02-01",
    })
    assert r.status_code == 200
    assert r.json()["cpf_masked"] == "***.456.789-**"

    r = await client.post(f"/clientes/{cid}/exports", json={"competence": "2026-09-01"})
    assert r.status_code == 200
    export_id = r.json()["id"]
    assert r.json()["status"] == "DRAFT"

    evento = {
        "employee_id": "32", "employee_cpf": "12345678901", "competence": "2026-09-01",
        "event_type": "OVERTIME_50", "amount_minutes": 515,
    }
    r = await client.post(f"/exports/{export_id}/preview", json={"competence": "2026-09-01", "events": [evento]})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "READY"
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["status"] == "PENDING"
    assert Decimal(item["reference"]) == Decimal("8.35")

    r = await client.post(f"/exports/{export_id}/enviar")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "SUCCESS"
    assert body["success_items"] == 1
    assert body["failed_items"] == 0
    assert body["items"][0]["status"] == "SUCCESS"


async def test_preview_marca_evento_sem_rubrica_mapeada(client):
    cid = client.cliente_id
    r = await client.post(f"/clientes/{cid}/exports", json={"competence": "2026-09-01"})
    export_id = r.json()["id"]

    evento = {
        "employee_id": "99", "employee_cpf": "98765432100", "competence": "2026-09-01",
        "event_type": "NIGHT_ADDITIONAL", "amount_minutes": 60,
    }
    r = await client.post(f"/exports/{export_id}/preview", json={"competence": "2026-09-01", "events": [evento]})
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert item["status"] == "FAILED"
    assert item["error_code"] == "RUBRICA_SEM_MAPA"
    # export sem nenhum item pronto -> continua DRAFT, não READY
    assert r.json()["status"] == "DRAFT"


async def test_preview_marca_colaborador_sem_cadastro_complementar(client):
    cid = client.cliente_id
    await client.put(f"/clientes/{cid}/rubricas", json={
        "internal_event_type": "OVERTIME_50", "payslip_item_code": 150, "unit": "HOURS", "enabled": True,
    })
    r = await client.post(f"/clientes/{cid}/exports", json={"competence": "2026-09-01"})
    export_id = r.json()["id"]

    evento = {
        "employee_id": "sem-cadastro", "employee_cpf": "11122233344", "competence": "2026-09-01",
        "event_type": "OVERTIME_50", "amount_minutes": 60,
    }
    r = await client.post(f"/exports/{export_id}/preview", json={"competence": "2026-09-01", "events": [evento]})
    item = r.json()["items"][0]
    assert item["status"] == "FAILED"
    assert item["error_code"] == "DADOS_COLABORADOR_INCOMPLETOS"


async def test_nao_permite_dois_exports_ativos_na_mesma_competencia(client):
    cid = client.cliente_id
    r1 = await client.post(f"/clientes/{cid}/exports", json={"competence": "2026-09-01"})
    assert r1.status_code == 200
    r2 = await client.post(f"/clientes/{cid}/exports", json={"competence": "2026-09-01"})
    assert r2.status_code == 409
    assert r2.json()["detail"]["code"] == "ENVIO_JA_EXISTE"


async def test_idempotencia_segundo_envio_identico_e_bloqueado(client):
    cid = client.cliente_id
    await client.post(f"/clientes/{cid}/integracao/validar-chave", json={"activation_key": "chave"})
    await client.post(f"/clientes/{cid}/integracao/ativar")
    await client.put(f"/clientes/{cid}/integracao/formato-horas", json={"hours_format": "HOURS_MINUTES"})
    await client.put(f"/clientes/{cid}/rubricas", json={
        "internal_event_type": "OVERTIME_50", "payslip_item_code": 150, "unit": "HOURS", "enabled": True,
    })
    await client.put(f"/clientes/{cid}/colaboradores", json={
        "employee_id": "32", "cpf": "12345678901", "esocial_category_code": 101,
        "admission_date": "2024-02-01",
    })

    evento = {
        "employee_id": "32", "employee_cpf": "12345678901", "competence": "2026-09-01",
        "event_type": "OVERTIME_50", "amount_minutes": 515,
    }

    r = await client.post(f"/clientes/{cid}/exports", json={"competence": "2026-09-01"})
    export_1 = r.json()["id"]
    await client.post(f"/exports/{export_1}/preview", json={"competence": "2026-09-01", "events": [evento]})
    r = await client.post(f"/exports/{export_1}/enviar")
    assert r.json()["status"] == "SUCCESS"

    # competência já tem um export SUCCESS -> um export NOVO pra mesma
    # competência é bloqueado (§7.1-equivalente simplificado: constraint de
    # export ativo). Usamos outra competência só pra isolar o teste do
    # fingerprint em si, reenviando o MESMO evento dentro de um novo export
    # criado manualmente após cancelar isso não se aplica aqui — testamos
    # direto a marcação JA_ENVIADO simulando um 2º preview pro mesmo export.
    r = await client.post(f"/exports/{export_1}/preview", json={"competence": "2026-09-01", "events": [evento]})
    item = r.json()["items"][0]
    assert item["status"] == "FAILED"
    assert item["error_code"] == "JA_ENVIADO"
