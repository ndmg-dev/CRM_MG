"""Cobre o cadastro de usuários e o CRUD de setores.

Requer um Postgres descartável — os modelos usam tipos do dialeto PostgreSQL
(UUID), então SQLite não serve. Aponte para um banco de teste com:

    POSTGRES_HOST/PORT/USER/PASSWORD/POSTGRES_DB

Se nenhum banco responder, os testes são pulados em vez de falharem.
"""
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from app.core.security import create_access_token
from app.db.seed import seed_setores
from app.db.session import AsyncSessionLocal, engine
from app.main import app
from app.models import Base
from app.models.user import Usuario

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def client():
    # O engine é global e o pool fica preso ao event loop do teste anterior;
    # descartá-lo antes e depois faz cada teste abrir conexões no seu loop.
    await engine.dispose()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:  # pragma: no cover - ambiente sem banco
        pytest.skip(f"Postgres de teste indisponível: {exc}")

    async with AsyncSessionLocal() as session:
        await seed_setores(session)
        admin = Usuario(
            id=uuid.uuid4(),
            nome="Admin",
            email="admin@mendoncagalvao.com.br",
            perfil="ADMIN",
            setor="DIRETORIA",
            ativo=True,
        )
        session.add(admin)
        await session.commit()
        admin_id = admin.id

    headers = {"Authorization": f"Bearer {create_access_token(subject=admin_id)}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t/api/v1") as c:
        c.headers.update(headers)
        c.admin_id = admin_id
        yield c

    await engine.dispose()


# ---------------------------------------------------------------------------
# Setores
# ---------------------------------------------------------------------------

async def test_seed_cria_setores_padrao(client):
    r = await client.get("/setores")
    assert r.status_code == 200
    codigos = {s["codigo"] for s in r.json()}
    assert {"FISCAL", "CONTABIL", "DP", "SOCIETARIO", "DIRETORIA", "TI", "GERAL"} <= codigos


async def test_seed_e_idempotente(client):
    async with AsyncSessionLocal() as session:
        await seed_setores(session)
    r = await client.get("/setores")
    assert len(r.json()) == 7


async def test_conta_usuarios_por_setor(client):
    r = await client.get("/setores")
    diretoria = next(s for s in r.json() if s["codigo"] == "DIRETORIA")
    assert diretoria["total_usuarios"] == 1


async def test_cria_setor_normalizando_codigo(client):
    r = await client.post("/setores", json={"codigo": " recursos humanos ", "nome": " RH "})
    assert r.status_code == 201
    assert r.json()["codigo"] == "RECURSOS_HUMANOS"
    assert r.json()["nome"] == "RH"


async def test_rejeita_codigo_duplicado(client):
    await client.post("/setores", json={"codigo": "RH", "nome": "RH"})
    r = await client.post("/setores", json={"codigo": "rh", "nome": "Outro"})
    assert r.status_code == 400


async def test_rejeita_codigo_invalido(client):
    r = await client.post("/setores", json={"codigo": "9X", "nome": "X"})
    assert r.status_code == 422


async def test_setor_nasce_com_visibilidade_propria(client):
    r = await client.post("/setores", json={"codigo": "RH", "nome": "RH"})
    assert r.json()["visibilidade_sistemas"] == "PROPRIO"
    assert r.json()["setores_visiveis"] == []


async def test_personalizado_exige_pelo_menos_um_setor(client):
    r = await client.post("/setores", json={
        "codigo": "RH", "nome": "RH",
        "visibilidade_sistemas": "PERSONALIZADO", "setores_visiveis": [],
    })
    assert r.status_code == 422


async def test_personalizado_rejeita_setor_inexistente(client):
    r = await client.post("/setores", json={
        "codigo": "RH", "nome": "RH",
        "visibilidade_sistemas": "PERSONALIZADO", "setores_visiveis": ["NAO_EXISTE"],
    })
    assert r.status_code == 400


def _payload_personalizado():
    return {
        "codigo": "RH", "nome": "RH",
        "visibilidade_sistemas": "PERSONALIZADO",
        "setores_visiveis": [" contabil ", "FISCAL", "fiscal"],
    }


async def test_personalizado_normaliza_e_deduplica(client):
    r = await client.post("/setores", json=_payload_personalizado())
    assert r.status_code == 201
    assert r.json()["setores_visiveis"] == ["CONTABIL", "FISCAL"]


async def test_trocar_de_modo_limpa_a_lista(client):
    r = await client.post("/setores", json=_payload_personalizado())
    setor_id = r.json()["id"]
    r = await client.put(f"/setores/{setor_id}", json={"visibilidade_sistemas": "TOTAL"})
    assert r.status_code == 200
    assert r.json()["setores_visiveis"] == []


async def test_nao_exclui_setor_que_outro_enxerga(client):
    await client.post("/setores", json={
        "codigo": "RH", "nome": "RH",
        "visibilidade_sistemas": "PERSONALIZADO", "setores_visiveis": ["CONTABIL"],
    })
    r = await client.get("/setores")
    contabil = next(s for s in r.json() if s["codigo"] == "CONTABIL")
    r = await client.delete(f"/setores/{contabil['id']}")
    assert r.status_code == 400
    assert "RH" in r.json()["detail"]


async def test_setor_nao_pode_listar_a_si_mesmo(client):
    r = await client.post("/setores", json={
        "codigo": "RH", "nome": "RH",
        "visibilidade_sistemas": "PERSONALIZADO", "setores_visiveis": ["RH"],
    })
    assert r.status_code == 400


async def test_nao_remove_setor_em_uso(client):
    r = await client.post("/setores", json={"codigo": "RH", "nome": "RH"})
    setor_id = r.json()["id"]
    await client.post("/usuarios", json={
        "nome": "Ana", "email": "ana@mendoncagalvao.com.br",
        "perfil": "ANALISTA", "setor": "RH",
    })

    assert (await client.delete(f"/setores/{setor_id}")).status_code == 400
    assert (await client.put(f"/setores/{setor_id}", json={"ativo": False})).status_code == 400


async def test_remove_setor_sem_usuarios(client):
    r = await client.post("/setores", json={"codigo": "RH", "nome": "RH"})
    assert (await client.delete(f"/setores/{r.json()['id']}")).status_code == 204


# ---------------------------------------------------------------------------
# Cadastro de usuários
# ---------------------------------------------------------------------------

async def test_normaliza_nome_e_email(client):
    r = await client.post("/usuarios", json={
        "nome": " Ana Silva ", "email": " Ana.Silva@MendoncaGalvao.com.br ",
        "perfil": "ANALISTA", "setor": "FISCAL",
    })
    assert r.status_code == 201
    assert r.json()["email"] == "ana.silva@mendoncagalvao.com.br"
    assert r.json()["nome"] == "Ana Silva"


async def test_bloqueia_duplicidade_ignorando_maiusculas(client):
    await client.post("/usuarios", json={
        "nome": "Ana", "email": "ana@mendoncagalvao.com.br", "perfil": "ANALISTA",
        "setor": "FISCAL",
    })
    r = await client.post("/usuarios", json={
        "nome": "Ana 2", "email": "ANA@mendoncagalvao.com.br", "perfil": "ANALISTA",
        "setor": "FISCAL",
    })
    assert r.status_code == 400


async def test_rejeita_setor_inexistente(client):
    r = await client.post("/usuarios", json={
        "nome": "Bruno", "email": "bruno@mendoncagalvao.com.br",
        "perfil": "ANALISTA", "setor": "NAO_EXISTE",
    })
    assert r.status_code == 400


async def test_completa_pre_registro_do_login_em_vez_de_conflitar(client):
    """Usuário auto-criado pelo login Google não deve bloquear o cadastro."""
    async with AsyncSessionLocal() as session:
        session.add(Usuario(
            id=uuid.uuid4(), nome="carlos", email="carlos@mendoncagalvao.com.br",
            perfil="VISUALIZADOR", setor=None, ativo=True,
        ))
        await session.commit()

    r = await client.post("/usuarios", json={
        "nome": "Carlos Pereira", "email": "Carlos@mendoncagalvao.com.br",
        "perfil": "COORDENADOR", "setor": "FISCAL",
    })
    assert r.status_code == 201
    assert r.json()["perfil"] == "COORDENADOR"
    assert r.json()["nome"] == "Carlos Pereira"

    async with AsyncSessionLocal() as session:
        total = await session.scalar(
            select(func.count()).select_from(Usuario).where(
                func.lower(Usuario.email) == "carlos@mendoncagalvao.com.br"
            )
        )
    assert total == 1


async def test_conflito_real_continua_rejeitado(client):
    await client.post("/usuarios", json={
        "nome": "Carlos", "email": "carlos@mendoncagalvao.com.br",
        "perfil": "COORDENADOR", "setor": "FISCAL",
    })
    r = await client.post("/usuarios", json={
        "nome": "Outro", "email": "carlos@mendoncagalvao.com.br", "perfil": "ANALISTA",
    })
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Visibilidade aplicada de ponta a ponta
# ---------------------------------------------------------------------------

async def _cenario_sistemas(client, modo, visiveis=None):
    """Cria sistemas em 3 setores e devolve um cliente logado como analista fiscal."""
    from app.models.system import Sistema

    async with AsyncSessionLocal() as session:
        for codigo in ("FISCAL", "CONTABIL", "GERAL", "RESTRITO"):
            session.add(Sistema(
                id=uuid.uuid4(), nome=f"Sistema {codigo}", slug=codigo.lower(),
                categoria="MAIN", setor=codigo, ativo=True,
            ))
        analista = Usuario(
            id=uuid.uuid4(), nome="Analista", email="analista@mendoncagalvao.com.br",
            perfil="ANALISTA", setor="FISCAL", ativo=True,
        )
        session.add(analista)
        await session.commit()
        analista_id = analista.id

    r = await client.get("/setores")
    fiscal_id = next(s["id"] for s in r.json() if s["codigo"] == "FISCAL")
    payload = {"visibilidade_sistemas": modo}
    if visiveis is not None:
        payload["setores_visiveis"] = visiveis
    r = await client.put(f"/setores/{fiscal_id}", json=payload)
    assert r.status_code == 200, r.text

    client.headers["Authorization"] = f"Bearer {create_access_token(subject=analista_id)}"
    return client


async def test_listagem_de_sistemas_respeita_modo_proprio(client):
    c = await _cenario_sistemas(client, "PROPRIO")
    nomes = {s["nome"] for s in (await c.get("/sistemas")).json()}
    assert nomes == {"Sistema FISCAL", "Sistema GERAL"}


async def test_listagem_de_sistemas_respeita_modo_total(client):
    c = await _cenario_sistemas(client, "TOTAL")
    nomes = {s["nome"] for s in (await c.get("/sistemas")).json()}
    assert nomes == {"Sistema FISCAL", "Sistema CONTABIL", "Sistema GERAL"}


async def test_listagem_de_sistemas_respeita_modo_personalizado(client):
    c = await _cenario_sistemas(client, "PERSONALIZADO", ["CONTABIL"])
    nomes = {s["nome"] for s in (await c.get("/sistemas")).json()}
    assert nomes == {"Sistema FISCAL", "Sistema CONTABIL", "Sistema GERAL"}


async def test_listagem_de_sistemas_respeita_modo_restrito(client):
    c = await _cenario_sistemas(client, "RESTRITO")
    assert (await c.get("/sistemas")).json() == []


async def test_busca_usa_a_mesma_politica_da_listagem(client):
    """Antes a busca e a listagem divergiam quanto a sistemas RESTRITO."""
    c = await _cenario_sistemas(client, "TOTAL")
    listagem = {s["nome"] for s in (await c.get("/sistemas")).json()}
    busca = {
        r["title"] for r in (await c.get("/search", params={"q": "Sistema"})).json()["results"]
        if r["type"] == "sistema"
    }
    assert "Sistema RESTRITO" not in listagem
    assert "Sistema RESTRITO" not in busca
    assert busca <= listagem


async def test_admin_nao_remove_o_proprio_acesso(client):
    assert (await client.put(
        f"/usuarios/{client.admin_id}", json={"ativo": False}
    )).status_code == 400
    assert (await client.put(
        f"/usuarios/{client.admin_id}", json={"perfil": "ANALISTA"}
    )).status_code == 400
