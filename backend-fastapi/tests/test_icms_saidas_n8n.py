"""Pastas do Drive via n8n: agrupamento dos disparos, segredo só no servidor e falha do n8n que nunca derruba o cadastro."""
import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import get_current_user
from app.integrations.icms_saidas import n8n
from app.integrations.icms_saidas import permissoes as perm
from app.main import app

from .test_icms_saidas import MotorFalso, P, auditorias, motor, usuario  # noqa: F401  (fixtures reutilizadas)

TOKEN = "token-n8n-secreto-0123456789"
URL = "http://n8n.test/webhook/preparar-pastas"


class N8nFalso(MotorFalso):
    pass


@pytest.fixture
def configurado(monkeypatch):
    monkeypatch.setattr(settings, "ICMS_N8N_URL_PASTAS", URL)
    monkeypatch.setattr(settings, "ICMS_N8N_TOKEN", TOKEN)


@pytest.fixture
def n8n_falso(configurado):
    falso = N8nFalso()
    falso.resposta = httpx.Response(200, json={"ok": True})
    relogio = {"t": 1000.0}
    esperas: list[float] = []

    async def dormir(segundos):
        esperas.append(segundos)
        relogio["t"] += segundos

    disp = n8n.Disparador(httpx.AsyncClient(transport=httpx.MockTransport(falso)), relogio=lambda: relogio["t"], dormir=dormir)
    app.state.icms_n8n = disp
    disp.relogio_falso = relogio
    disp.esperas = esperas
    yield falso, disp
    del app.state.icms_n8n


def logado(*concedidas, perfil="ANALISTA"):
    u = usuario(perfil)
    efetivas = perm.efetivas(perfil, concedidas)
    app.dependency_overrides[get_current_user] = lambda: u
    app.dependency_overrides[perm.obter_permissoes] = lambda: efetivas
    return TestClient(app)


@pytest.fixture(autouse=True)
def _limpar():
    yield
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------------------------------------------- disparador


def test_primeiro_pedido_dispara_e_manda_o_token_so_no_cabecalho(n8n_falso):
    falso, disp = n8n_falso
    situacao, ok = asyncio.run(disp.solicitar("ana@x.com", "botao"))
    assert (situacao, ok) == ("disparado", True)
    req = falso.chamadas[0]
    assert str(req.url) == URL
    assert req.headers["X-Painel-Token"] == TOKEN
    assert TOKEN.encode() not in falso.corpos[0]
    assert b"ana@x.com" in falso.corpos[0]


def test_pedidos_dentro_da_janela_viram_um_so_disparo_no_fim_dela(n8n_falso):
    falso, disp = n8n_falso

    async def cenario():
        r1 = await disp.solicitar("ana", "botao")
        disp.relogio_falso["t"] += 10  # 10 s depois: dentro da janela de 60 s
        r2 = await disp.solicitar("ana", "botao")
        r3 = await disp.solicitar("beto", "empresa criada")  # já há um agendado: não cria outro
        await disp._agendado
        return r1, r2, r3

    r1, r2, r3 = asyncio.run(cenario())
    assert r1 == ("disparado", True) and r2 == ("agendado", True) and r3 == ("agendado", True)
    assert len(falso.chamadas) == 2  # o imediato + UM no fim da janela
    assert disp.esperas == [pytest.approx(50.0)]


def test_depois_da_janela_dispara_de_novo_na_hora(n8n_falso):
    falso, disp = n8n_falso

    async def cenario():
        await disp.solicitar("ana", "botao")
        disp.relogio_falso["t"] += n8n.INTERVALO + 1
        return await disp.solicitar("ana", "botao")

    assert asyncio.run(cenario()) == ("disparado", True)
    assert len(falso.chamadas) == 2 and disp.esperas == []


def test_n8n_fora_do_ar_ou_recusando_nao_estoura(n8n_falso):
    falso, disp = n8n_falso
    falso.resposta = httpx.ConnectError("caiu")
    assert asyncio.run(disp.solicitar("ana", "botao")) == ("disparado", False)
    disp._ultimo = None
    falso.resposta = httpx.Response(500)
    assert asyncio.run(disp.solicitar("ana", "botao")) == ("disparado", False)


def test_sem_configuracao_o_disparo_silencioso_nao_faz_nada(monkeypatch):
    monkeypatch.setattr(settings, "ICMS_N8N_URL_PASTAS", "")
    monkeypatch.setattr(settings, "ICMS_N8N_TOKEN", TOKEN)  # só um dos dois: continua desligado
    chamadas = []
    disp = n8n.Disparador(httpx.AsyncClient(transport=httpx.MockTransport(lambda r: chamadas.append(r) or httpx.Response(200))))
    asyncio.run(disp.solicitar_sem_falhar("ana", "empresa criada"))
    assert chamadas == []


# ---------------------------------------------------------------------------------------------------------------- endpoint


def test_botao_exige_gerir_empresas(n8n_falso, motor):  # noqa: F811
    falso, _ = n8n_falso
    r = logado(perm.OPERAR).post(f"{P}/drive/preparar-pastas")
    assert r.status_code == 403 and r.json()["erro"]["codigo"] == "SEM_PERMISSAO"
    assert falso.chamadas == []


def test_botao_dispara_e_responde_202_sem_vazar_token(n8n_falso, motor):  # noqa: F811
    falso, _ = n8n_falso
    r = logado(perm.GERIR_EMPRESAS).post(f"{P}/drive/preparar-pastas")
    assert r.status_code == 202
    assert r.json()["situacao"] == "disparado"
    assert TOKEN not in r.text and URL not in r.text
    assert len(falso.chamadas) == 1


def test_botao_sem_configuracao_responde_503(monkeypatch, motor):  # noqa: F811
    monkeypatch.setattr(settings, "ICMS_N8N_URL_PASTAS", "")
    monkeypatch.setattr(settings, "ICMS_N8N_TOKEN", "")
    r = logado(perm.GERIR_EMPRESAS).post(f"{P}/drive/preparar-pastas")
    assert r.status_code == 503 and r.json()["erro"]["codigo"] == "INTEGRACAO_DESATIVADA"


def test_botao_com_n8n_indisponivel_responde_502(n8n_falso, motor):  # noqa: F811
    falso, _ = n8n_falso
    falso.resposta = httpx.ConnectError("caiu")
    r = logado(perm.GERIR_EMPRESAS).post(f"{P}/drive/preparar-pastas")
    assert r.status_code == 502 and r.json()["erro"]["codigo"] == "N8N_INDISPONIVEL"


def test_cadastro_de_empresa_pede_as_pastas_depois_de_responder(n8n_falso, motor, auditorias):  # noqa: F811
    falso, _ = n8n_falso
    motor.resposta = httpx.Response(201, json={"codigo": "0001", "razao_social": "ACME"})
    r = logado(perm.GERIR_EMPRESAS).post(f"{P}/empresas", json={"razao_social": "acme", "cnpj": None})
    assert r.status_code == 201
    assert len(falso.chamadas) == 1 and b"empresa criada" in falso.corpos[0]


def test_cadastro_recusado_pelo_motor_nao_pede_pastas(n8n_falso, motor, auditorias):  # noqa: F811
    falso, _ = n8n_falso
    motor.resposta = httpx.Response(409, json={"erro": {"codigo": "EMPRESA_DUPLICADA", "mensagem": "x", "detalhes": []}})
    r = logado(perm.GERIR_EMPRESAS).post(f"{P}/empresas", json={"razao_social": "acme", "cnpj": None})
    assert r.status_code == 409
    assert falso.chamadas == []


def test_n8n_fora_do_ar_nao_derruba_o_cadastro(n8n_falso, motor, auditorias):  # noqa: F811
    falso, _ = n8n_falso
    falso.resposta = httpx.ConnectError("caiu")
    motor.resposta = httpx.Response(201, json={"codigo": "0001", "razao_social": "ACME"})
    r = logado(perm.GERIR_EMPRESAS).post(f"{P}/empresas", json={"razao_social": "acme", "cnpj": None})
    assert r.status_code == 201 and r.json()["codigo"] == "0001"


def test_disparo_em_segundo_plano_engole_falha_inesperada(configurado, monkeypatch):
    disp = n8n.Disparador(httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200))))

    async def quebra(*_a, **_k):
        raise OSError("disco")

    monkeypatch.setattr(disp, "solicitar", quebra)
    asyncio.run(disp.solicitar_sem_falhar("ana", "empresa criada"))  # não levanta
