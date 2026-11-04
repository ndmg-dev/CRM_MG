"""ICMS Saídas com banco real: o ADMIN concede/revoga permissões por usuário e o proxy passa a respeitá-las, com auditoria na trilha do CRM.

Mesmo padrão dos outros testes de banco do CRM (Postgres de teste; pula se indisponível). O motor continua simulado.
"""
import uuid

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal, engine
from app.integrations.icms_saidas import permissoes as perm
from app.main import app
from app.models import Base
from app.models.audit_log import LogAuditoria
from app.models.user import Usuario
from app.models.usuario_permissao import UsuarioPermissao

P = "/api/v1/icms-saidas"
UUID = "3f1c2b7e-8a8b-4d1c-9c55-2b8f0e6d1a10"


class MotorFalso:
    def __init__(self):
        self.chamadas: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.chamadas.append(request)
        request.read()
        return httpx.Response(200, json={"ok": True})


def _usuario(nome, email, perfil, ativo=True, setor="FISCAL"):
    return Usuario(id=uuid.uuid4(), nome=nome, email=email, perfil=perfil, setor=setor, ativo=ativo, visibilidade_sistemas="SETOR")


@pytest_asyncio.fixture
async def ambiente(monkeypatch):
    await engine.dispose()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except (OSError, SQLAlchemyError) as exc:  # pragma: no cover - ambiente sem banco
        pytest.skip(f"Postgres de teste indisponível: {exc}")

    admin = _usuario("Admin", "admin@mendoncagalvao.com.br", "ADMIN", setor="TI")
    coord = _usuario("Coordenadora Fiscal", "coord@mendoncagalvao.com.br", "COORDENADOR")
    ana = _usuario("Ana", "ana@mendoncagalvao.com.br", "ANALISTA")
    inativo = _usuario("Inativo", "inativo@mendoncagalvao.com.br", "ANALISTA", ativo=False)
    async with AsyncSessionLocal() as s:
        s.add_all([admin, coord, ana, inativo])
        await s.commit()

    motor = MotorFalso()
    monkeypatch.setattr(settings, "MOTOR_ICMS_URL", "http://motor.test")
    monkeypatch.setattr(settings, "MOTOR_ICMS_API_KEY", "chave-do-crm-0123456789")
    app.state.motor_icms = httpx.AsyncClient(transport=httpx.MockTransport(motor), base_url="http://motor.test", follow_redirects=False)

    def cliente(u: Usuario) -> AsyncClient:
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://t")
        c.headers.update({"Authorization": f"Bearer {create_access_token(subject=u.id)}"})
        return c

    class Amb:
        pass

    a = Amb()
    a.admin, a.coord, a.ana, a.inativo, a.motor, a.cliente = admin, coord, ana, inativo, motor, cliente
    yield a
    del app.state.motor_icms
    await engine.dispose()


async def _permissoes_no_banco(usuario_id) -> list[str]:
    async with AsyncSessionLocal() as s:
        return sorted((await s.execute(select(UsuarioPermissao.permissao).where(UsuarioPermissao.usuario_id == usuario_id))).scalars().all())


async def conceder(a, usuario, *codigos):
    async with a.cliente(a.admin) as c:
        r = await c.put(f"{P}/permissoes/usuarios/{usuario.id}", json={"permissoes": list(codigos)})
    assert r.status_code == 200, r.text
    return r.json()


async def test_eu_admin_tem_tudo_sem_linha_no_banco_e_quem_nao_recebeu_nada_nao_tem_nada(ambiente):
    async with ambiente.cliente(ambiente.admin) as c:
        r = (await c.get(f"{P}/eu")).json()
    assert r["admin"] is True and r["permissoes"] == sorted(perm.TODAS)
    assert await _permissoes_no_banco(ambiente.admin.id) == []  # ADMIN não precisa de concessão
    async with ambiente.cliente(ambiente.ana) as c:
        assert (await c.get(f"{P}/eu")).json() == {"admin": False, "permissoes": []}


async def test_conceder_libera_o_proxy_e_revogar_bloqueia_na_hora(ambiente):
    ana = ambiente.ana
    async with ambiente.cliente(ana) as c:
        r = await c.get(f"{P}/painel")
        assert r.status_code == 403 and r.json()["erro"]["codigo"] == "SEM_PERMISSAO"
        assert ambiente.motor.chamadas == []

    await conceder(ambiente, ana, perm.OPERAR)
    async with ambiente.cliente(ana) as c:
        assert (await c.get(f"{P}/painel")).status_code == 200  # operar implica consultar
        assert ambiente.motor.chamadas[-1].headers["x-actor"] == "ana@mendoncagalvao.com.br"
        assert (await c.post(f"{P}/empresas/MM/pendencias/7/resolver", json={"tributacao": "ST"})).status_code == 200
        assert (await c.post(f"{P}/empresas/MM/memoria/lotes/{UUID}/aprovar", json={})).status_code == 403  # aprovar ela não recebeu

    await conceder(ambiente, ana)  # revoga tudo
    async with ambiente.cliente(ana) as c:
        assert (await c.get(f"{P}/painel")).status_code == 403  # sem cache: vale na próxima chamada


async def test_so_admin_concede_e_a_lista_de_codigos_e_conferida(ambiente):
    async with ambiente.cliente(ambiente.coord) as c:
        r = await c.put(f"{P}/permissoes/usuarios/{ambiente.ana.id}", json={"permissoes": [perm.OPERAR]})
        assert r.status_code == 403 and r.json()["erro"]["codigo"] == "SEM_PERMISSAO"  # nem o coordenador sem ser ADMIN
        assert (await c.get(f"{P}/permissoes/usuarios")).status_code == 403
        assert (await c.get(f"{P}/permissoes/catalogo")).status_code == 403
    async with ambiente.cliente(ambiente.admin) as c:
        r = await c.put(f"{P}/permissoes/usuarios/{ambiente.ana.id}", json={"permissoes": ["icms_saidas.inventada"]})
        assert r.status_code == 422 and r.json()["erro"]["codigo"] == "PERMISSAO_INVALIDA"
        assert (await c.put(f"{P}/permissoes/usuarios/{uuid.uuid4()}", json={"permissoes": []})).status_code == 404
        assert (await c.put(f"{P}/permissoes/usuarios/{ambiente.ana.id}", json={"permissoes": [perm.OPERAR], "x": 1})).status_code == 422
        cat = (await c.get(f"{P}/permissoes/catalogo")).json()
    assert [p["codigo"] for p in cat] == list(perm.TODAS)
    assert await _permissoes_no_banco(ambiente.ana.id) == []  # nada foi gravado pelas recusas


async def test_conjunto_substitui_o_anterior_e_nao_mexe_em_permissoes_de_outros_sistemas(ambiente):
    ana = ambiente.ana
    async with AsyncSessionLocal() as s:
        s.add(UsuarioPermissao(usuario_id=ana.id, permissao="outro_sistema.consultar"))
        await s.commit()
    await conceder(ambiente, ana, perm.OPERAR, perm.APROVAR_LOTES)
    assert await _permissoes_no_banco(ana.id) == sorted([perm.OPERAR, perm.APROVAR_LOTES, "outro_sistema.consultar"])
    r = await conceder(ambiente, ana, perm.CONSULTAR, perm.CONSULTAR)  # repetido vale uma vez
    assert r["permissoes"] == [perm.CONSULTAR]
    assert await _permissoes_no_banco(ana.id) == sorted([perm.CONSULTAR, "outro_sistema.consultar"])  # a de outro sistema ficou
    await conceder(ambiente, ana)
    assert await _permissoes_no_banco(ana.id) == ["outro_sistema.consultar"]


async def test_coordenadora_do_fiscal_aprova_lotes_e_edita_regras_quando_o_admin_concede(ambiente):
    await conceder(ambiente, ambiente.coord, perm.APROVAR_LOTES, perm.EDITAR_REGRAS, perm.GERIR_EMPRESAS)
    async with ambiente.cliente(ambiente.coord) as c:
        assert (await c.post(f"{P}/empresas/MM/memoria/lotes/{UUID}/aprovar", json={})).status_code == 200
        assert (await c.post(f"{P}/regras/rascunho/descartar", json={"motivo": "teste"})).status_code in (200, 422)
        assert (await c.post(f"{P}/empresas", json={"razao_social": "Nova Ltda"})).status_code == 200
        assert (await c.get(f"{P}/painel")).status_code == 200  # consultar veio implícito
        assert (await c.post(f"{P}/empresas/MM/apuracoes", files={"arquivo": ("s.xlsx", b"PK\x03\x04x", "application/octet-stream")})).status_code == 403  # operar não foi concedido


async def test_lista_de_usuarios_so_ativos_com_o_concedido_e_filtro(ambiente):
    await conceder(ambiente, ambiente.ana, perm.OPERAR)
    async with ambiente.cliente(ambiente.admin) as c:
        todos = (await c.get(f"{P}/permissoes/usuarios")).json()
        por_nome = (await c.get(f"{P}/permissoes/usuarios", params={"q": "coordenadora"})).json()
    emails = {u["email"] for u in todos}
    assert "inativo@mendoncagalvao.com.br" not in emails and {"admin@mendoncagalvao.com.br", "ana@mendoncagalvao.com.br"} <= emails
    ana = next(u for u in todos if u["email"].startswith("ana@"))
    assert ana["permissoes"] == [perm.OPERAR] and ana["admin"] is False
    assert next(u for u in todos if u["email"].startswith("admin@"))["admin"] is True
    assert [u["email"] for u in por_nome] == ["coord@mendoncagalvao.com.br"]


async def test_auditoria_no_crm_para_concessao_e_para_chamada_que_altera_o_motor(ambiente):
    await conceder(ambiente, ambiente.ana, perm.OPERAR)
    async with ambiente.cliente(ambiente.ana) as c:
        await c.get(f"{P}/painel")  # leitura: sem auditoria
        await c.post(f"{P}/empresas/MM/pendencias/7/resolver", json={"tributacao": "ST"})
    async with AsyncSessionLocal() as s:
        linhas = (await s.execute(select(LogAuditoria).order_by(LogAuditoria.id))).scalars().all()
    por_acao = {}
    for ln in linhas:
        por_acao.setdefault(ln.acao, []).append(ln)
    conc = por_acao["ICMS_SAIDAS_PERMISSOES"][0]
    assert conc.usuario_id == ambiente.admin.id and conc.detalhes == {"usuario_alvo": str(ambiente.ana.id), "permissoes": [perm.OPERAR]}
    chamadas = por_acao["ICMS_SAIDAS"]
    assert len(chamadas) == 1  # só o POST
    assert chamadas[0].usuario_id == ambiente.ana.id and chamadas[0].alvo == "POST /v1/empresas/MM/pendencias/7/resolver"
    assert chamadas[0].detalhes == {"empresa": "MM", "status": 200}


async def test_apagar_o_usuario_apaga_as_permissoes(ambiente):
    await conceder(ambiente, ambiente.ana, perm.OPERAR)
    async with AsyncSessionLocal() as s:
        await s.execute(delete(Usuario).where(Usuario.id == ambiente.ana.id))
        await s.commit()
    assert await _permissoes_no_banco(ambiente.ana.id) == []
