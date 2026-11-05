"""Sistema ICMS Saídas (proxy do CRM para o motor): permissão por rota, injeção da chave e do ator, erros, limites e uploads.

Sem banco: o usuário e as permissões entram por dependency_overrides e o motor é um httpx.MockTransport. O que depende de Postgres
(conceder/revogar e o fluxo ponta a ponta) está em test_icms_saidas_permissoes_db.py.
"""
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import get_current_user
from app.integrations.icms_saidas import cliente as cliente_mod
from app.integrations.icms_saidas import permissoes as perm
from app.integrations.icms_saidas import rota as rota_mod
from app.main import app
from app.models.user import Usuario

UUID = "3f1c2b7e-8a8b-4d1c-9c55-2b8f0e6d1a10"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
P = "/api/v1/icms-saidas"

# (método, caminho, permissão que a rota exige). É o CONTRATO de permissões: rota nova sem linha aqui reprova o teste de cobertura.
ROTAS = [
    ("GET", "/painel", perm.CONSULTAR),
    ("GET", "/empresas", perm.CONSULTAR),
    ("POST", "/empresas", perm.GERIR_EMPRESAS),
    ("POST", "/drive/preparar-pastas", perm.GERIR_EMPRESAS),
    ("GET", "/empresas/MM", perm.CONSULTAR),
    ("PATCH", "/empresas/MM", perm.GERIR_EMPRESAS),
    ("GET", "/regras", perm.CONSULTAR),
    ("GET", "/regras/versoes", perm.CONSULTAR),
    ("GET", "/regras/versoes/3", perm.CONSULTAR),
    ("GET", "/regras/historico", perm.CONSULTAR),
    ("GET", "/regras/rascunho", perm.CONSULTAR),
    ("PUT", "/regras/rascunho", perm.EDITAR_REGRAS),
    ("POST", "/regras/rascunho/descartar", perm.EDITAR_REGRAS),
    ("POST", "/regras/rascunho/publicar", perm.EDITAR_REGRAS),
    ("POST", "/empresas/MM/apuracoes", perm.OPERAR),
    ("POST", "/empresas/MM/apuracoes/parcial", perm.OPERAR),
    ("GET", "/empresas/MM/apuracoes", perm.CONSULTAR),
    ("GET", f"/empresas/MM/apuracoes/{UUID}", perm.CONSULTAR),
    ("GET", f"/empresas/MM/apuracoes/{UUID}/planilha", perm.CONSULTAR),
    ("POST", f"/empresas/MM/apuracoes/{UUID}/reprocessar", perm.OPERAR),
    ("GET", "/empresas/MM/pendencias", perm.CONSULTAR),
    ("GET", "/empresas/MM/pendencias/resumo-sugestoes", perm.CONSULTAR),
    ("POST", "/empresas/MM/pendencias/aceitar-identicas", perm.OPERAR),
    ("GET", "/empresas/MM/pendencias/exportar", perm.CONSULTAR),
    ("POST", "/empresas/MM/pendencias/resolver-lote", perm.OPERAR),
    ("POST", "/empresas/MM/pendencias/7/resolver", perm.OPERAR),
    ("POST", "/empresas/MM/pendencias/7/descartar", perm.OPERAR),
    ("GET", "/empresas/MM/memoria", perm.CONSULTAR),
    ("GET", "/empresas/MM/memoria/exportar", perm.CONSULTAR),
    ("POST", "/empresas/MM/memoria/lotes", perm.OPERAR),
    ("POST", "/empresas/MM/memoria/completar", perm.OPERAR),
    ("GET", "/empresas/MM/memoria/lotes", perm.CONSULTAR),
    ("GET", f"/empresas/MM/memoria/lotes/{UUID}", perm.CONSULTAR),
    ("GET", f"/empresas/MM/memoria/lotes/{UUID}/diferencas", perm.CONSULTAR),
    ("GET", f"/empresas/MM/memoria/lotes/{UUID}/relatorio.xlsx", perm.CONSULTAR),
    ("GET", f"/empresas/MM/memoria/lotes/{UUID}/problemas", perm.CONSULTAR),
    ("GET", f"/empresas/MM/memoria/lotes/{UUID}/problemas.xlsx", perm.CONSULTAR),
    ("PUT", f"/empresas/MM/memoria/lotes/{UUID}/correcoes", perm.OPERAR),
    ("POST", f"/empresas/MM/memoria/lotes/{UUID}/reavaliar", perm.OPERAR),
    ("POST", f"/empresas/MM/memoria/lotes/{UUID}/aprovar", perm.APROVAR_LOTES),
    ("POST", f"/empresas/MM/memoria/lotes/{UUID}/rejeitar", perm.APROVAR_LOTES),
]


class MotorFalso:
    """Motor simulado (httpx.MockTransport): registra as chamadas e responde conforme `resposta`."""

    def __init__(self):
        self.chamadas: list[httpx.Request] = []
        self.corpos: list[bytes] = []
        self.resposta: httpx.Response | Exception | None = None

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.chamadas.append(request)
        self.corpos.append(request.read())
        if isinstance(self.resposta, Exception):
            raise self.resposta
        return self.resposta or httpx.Response(200, json={"ok": True})


def usuario(perfil="ANALISTA", email="ana@mendoncagalvao.com.br") -> Usuario:
    return Usuario(id=uuid.uuid4(), nome="Ana", email=email, perfil=perfil, setor="FISCAL", ativo=True, visibilidade_sistemas="SETOR")


@pytest.fixture
def motor(monkeypatch):
    falso = MotorFalso()
    monkeypatch.setattr(settings, "MOTOR_ICMS_URL", "http://motor.test")
    monkeypatch.setattr(settings, "MOTOR_ICMS_API_KEY", "chave-do-crm-0123456789")
    app.state.motor_icms = httpx.AsyncClient(transport=httpx.MockTransport(falso), base_url="http://motor.test", follow_redirects=False)
    yield falso
    if hasattr(app.state, "motor_icms"):  # um teste pode ter removido para simular "sem configuração"
        del app.state.motor_icms


@pytest.fixture
def auditorias(monkeypatch):
    registradas = []

    async def gravar(usuario_, metodo, caminho, empresa, status):
        registradas.append((usuario_.email, metodo, caminho, empresa, status))

    monkeypatch.setattr(cliente_mod, "auditar", gravar)
    return registradas


@pytest.fixture
def como(motor, auditorias):
    """Cliente HTTP logado como `perfil` com as permissões CONCEDIDAS dadas (as implicadas entram por perm.efetivas)."""
    clientes = []

    def fabricar(*concedidas, perfil="ANALISTA", email="ana@mendoncagalvao.com.br"):
        u = usuario(perfil, email)
        efetivas = perm.efetivas(perfil, concedidas)
        app.dependency_overrides[get_current_user] = lambda: u
        app.dependency_overrides[perm.obter_permissoes] = lambda: efetivas
        c = TestClient(app)
        clientes.append(c)
        return c

    yield fabricar
    app.dependency_overrides.clear()


def chamar(c, metodo, caminho, **kw):
    if metodo in ("POST", "PUT", "PATCH") and "json" not in kw and "files" not in kw and "content" not in kw:
        kw["json"] = {}
    return c.request(metodo, P + caminho, **kw)


# ----------------------------------------------------------------------------------------------------- permissões (regra pura)


def test_admin_tem_todas_e_os_outros_so_o_concedido_mais_o_implicado():
    assert perm.efetivas("ADMIN", []) == set(perm.TODAS)
    assert perm.efetivas("ANALISTA", []) == set()
    assert perm.efetivas("ANALISTA", [perm.OPERAR]) == {perm.OPERAR, perm.CONSULTAR}  # toda ação implica consultar
    assert perm.efetivas("COORDENADOR", [perm.APROVAR_LOTES, perm.EDITAR_REGRAS]) == {perm.APROVAR_LOTES, perm.EDITAR_REGRAS, perm.CONSULTAR}
    assert perm.efetivas("ANALISTA", ["icms_saidas.inventada", "outro_sistema.consultar"]) == set()  # código desconhecido não vale


def test_catalogo_descreve_todas_as_permissoes():
    assert [p["codigo"] for p in perm.CATALOGO] == list(perm.TODAS)
    assert all(p["nome"] and p["descricao"] for p in perm.CATALOGO)


# ----------------------------------------------------------------------------------------------------- contrato por rota


def _rotas_registradas() -> set[tuple[str, str]]:
    caminhos = app.openapi()["paths"]
    saida = set()
    for caminho, ops in caminhos.items():
        if caminho.startswith(P) and not caminho.startswith(f"{P}/permissoes") and caminho != f"{P}/eu":
            for metodo in ops:
                saida.add((metodo.upper(), caminho[len(P):]))
    return saida


def test_a_tabela_de_permissoes_cobre_exatamente_as_rotas_do_motor():
    def normalizar(caminho: str) -> str:
        return caminho.replace(UUID, "{id}").replace("/MM", "/{codigo}").replace("/versoes/3", "/versoes/{numero}").replace("/7/", "/{pend}/")

    esperadas = {(m, normalizar(c)) for m, c, _ in ROTAS}
    registradas = {(m, c.replace("{id}", "{id}")) for m, c in _rotas_registradas()}
    assert registradas == esperadas, (registradas ^ esperadas)


@pytest.mark.parametrize(("metodo", "caminho", "exigida"), ROTAS)
def test_cada_rota_exige_a_permissao_certa(como, motor, metodo, caminho, exigida):
    # sem nenhuma permissão: recusa e o motor nem é chamado
    r = chamar(como(), metodo, caminho)
    assert r.status_code == 403 and r.json()["erro"]["codigo"] == "SEM_PERMISSAO"
    assert motor.chamadas == []
    # só com uma permissão DIFERENTE cujo efeito não inclui a exigida (toda ação implica consultar): recusa
    outras = [p for p in perm.TODAS if exigida not in perm.efetivas("ANALISTA", [p])]
    for outra in outras:
        assert chamar(como(outra), metodo, caminho).status_code == 403, (outra, metodo, caminho)
    assert motor.chamadas == []
    # com a permissão exigida: passa e chega ao motor (ou falha de validação do corpo, nunca 403)
    r = chamar(como(exigida), metodo, caminho)
    assert r.status_code != 403, r.text


def test_admin_passa_em_toda_rota_sem_precisar_de_concessao(como, motor):
    c = como(perfil="ADMIN")
    for metodo, caminho, _ in ROTAS:
        assert chamar(c, metodo, caminho).status_code != 403, (metodo, caminho)


def test_consultar_sozinho_le_tudo_mas_nao_altera_nada(como, motor):
    c = como(perm.CONSULTAR)
    leituras = [(m, p) for m, p, ex in ROTAS if ex == perm.CONSULTAR]
    assert leituras and all(chamar(c, m, p).status_code == 200 for m, p in leituras)
    escritas = [(m, p) for m, p, ex in ROTAS if ex != perm.CONSULTAR]
    assert all(chamar(c, m, p).status_code == 403 for m, p in escritas)
    assert all(ch.method == "GET" for ch in motor.chamadas)


# ----------------------------------------------------------------------------------------------------- injeção da chave e do ator


def test_injeta_chave_e_ator_e_nao_repassa_cabecalhos_do_cliente(como, motor):
    c = como(perm.CONSULTAR, email="maria@mendoncagalvao.com.br")
    r = c.get(f"{P}/painel", params={"competencia": "2026-08", "extra": "x"}, headers={"Authorization": "Bearer jwt-do-crm", "Cookie": "a=b", "X-API-Key": "forjada", "X-Actor": "forjado"})
    assert r.status_code == 200
    ch = motor.chamadas[-1]
    assert ch.url.path == "/v1/painel" and dict(ch.url.params) == {"competencia": "2026-08"}  # só o parâmetro conhecido
    assert ch.headers["x-api-key"] == "chave-do-crm-0123456789"  # a do servidor, nunca a do cliente
    assert ch.headers["x-actor"] == "maria@mendoncagalvao.com.br"
    assert "authorization" not in ch.headers and "cookie" not in ch.headers  # o JWT do CRM não vaza para o motor


def test_a_chave_do_motor_nunca_aparece_na_resposta(como, motor):
    c = como(perm.CONSULTAR)
    r = c.get(f"{P}/painel")
    assert "chave-do-crm" not in r.text and "chave-do-crm" not in str(dict(r.headers))


def test_sem_configuracao_responde_503_e_nao_chama_nada(como, monkeypatch, motor):
    del app.state.motor_icms
    monkeypatch.setattr(settings, "MOTOR_ICMS_URL", "")
    r = como(perm.CONSULTAR).get(f"{P}/painel")
    assert r.status_code == 503 and r.json()["erro"]["codigo"] == "MOTOR_NAO_CONFIGURADO"
    assert motor.chamadas == []


def test_sem_token_do_crm_nao_chega_ao_motor(motor):
    app.dependency_overrides.clear()
    r = TestClient(app).get(f"{P}/painel")
    assert r.status_code in (401, 403) and motor.chamadas == []


# ----------------------------------------------------------------------------------------------------- erros do motor


def test_erro_de_negocio_do_motor_passa_como_veio(como, motor):
    motor.resposta = httpx.Response(409, json={"erro": {"codigo": "CONFIRMACAO_NECESSARIA", "mensagem": "m", "detalhes": []}})
    r = como(perm.APROVAR_LOTES).post(f"{P}/empresas/MM/memoria/lotes/{UUID}/aprovar", json={})
    assert r.status_code == 409 and r.json()["erro"]["codigo"] == "CONFIRMACAO_NECESSARIA"  # o front decide pelo código estável


def test_motor_recusou_a_chave_vira_502_sem_vazar_o_status(como, motor):
    for status in (401, 403):
        motor.resposta = httpx.Response(status, json={"erro": {"codigo": "NAO_AUTENTICADO", "mensagem": "x", "detalhes": []}})
        r = como(perm.CONSULTAR).get(f"{P}/painel")
        assert r.status_code == 502 and r.json()["erro"]["codigo"] == "MOTOR_RECUSOU_CHAVE"


def test_motor_fora_do_ar_ou_resposta_estranha_vira_502(como, motor):
    c = como(perm.CONSULTAR)
    motor.resposta = httpx.ConnectError("recusou")
    assert c.get(f"{P}/painel").json()["erro"]["codigo"] == "MOTOR_INDISPONIVEL"
    motor.resposta = httpx.Response(500, content=b"<html>erro</html>", headers={"content-type": "text/html"})
    assert c.get(f"{P}/painel").status_code == 502
    motor.resposta = httpx.Response(200, content=b"<html>ok?</html>", headers={"content-type": "text/html"})
    assert c.get(f"{P}/painel").json()["erro"]["codigo"] == "MOTOR_INDISPONIVEL"


def test_total_da_listagem_so_passa_se_for_numero(como, motor):
    c = como(perm.CONSULTAR)
    motor.resposta = httpx.Response(200, json=[], headers={"X-Total-Count": "533", "X-Outro": "nao"})
    r = c.get(f"{P}/empresas/MM/pendencias", params={"status": "ABERTA", "sugestoes": "true", "limit": 100})
    assert r.headers["x-total-count"] == "533" and "x-outro" not in r.headers
    assert dict(motor.chamadas[-1].url.params) == {"status": "ABERTA", "sugestoes": "true", "limit": "100"}
    motor.resposta = httpx.Response(200, json=[], headers={"X-Total-Count": "5; <script>"})
    assert "x-total-count" not in c.get(f"{P}/empresas/MM/pendencias").headers


def test_download_chega_como_anexo(como, motor):
    motor.resposta = httpx.Response(200, content=b"PK\x03\x04xlsx", headers={"content-type": XLSX, "content-disposition": 'attachment; filename="P.xlsx"'})
    r = como(perm.CONSULTAR).get(f"{P}/empresas/MM/pendencias/exportar")
    assert r.status_code == 200 and r.content == b"PK\x03\x04xlsx" and r.headers["content-disposition"].startswith("attachment")


# ----------------------------------------------------------------------------------------------------- validação antes do motor


def test_corpo_invalido_vira_erro_no_formato_do_motor_sem_ecoar_o_valor_e_sem_chamar_o_motor(como, motor):
    c = como(perm.GERIR_EMPRESAS)
    r = c.post(f"{P}/empresas", json={"razao_social": "Nova Ltda", "cnpj": "senha-secreta-123", "codigo": "XX"})
    assert r.status_code == 422 and r.json()["erro"]["codigo"] == "REQUISICAO_INVALIDA"
    assert "senha-secreta-123" not in r.text
    assert motor.chamadas == []


def test_parametros_de_caminho_invalidos_nao_chegam_ao_motor(como, motor):
    c = como(perm.CONSULTAR)
    for caminho in ("/empresas/m", "/empresas/MM/apuracoes/nao-e-uuid", "/empresas/MM/pendencias?limit=9999", "/empresas/MM/pendencias?status=xx"):
        assert c.get(P + caminho).status_code in (404, 422), caminho
    assert como(perm.OPERAR).post(f"{P}/empresas/MM/pendencias/0/resolver", json={"tributacao": "ST"}).status_code == 422  # id de pendência >= 1
    assert motor.chamadas == []


def test_empresa_nova_leva_razao_social_em_maiusculas_e_sem_codigo(como, motor):
    r = como(perm.GERIR_EMPRESAS).post(f"{P}/empresas", json={"razao_social": " nova   ltda ", "cnpj": "12.345.678/0001-95"})
    assert r.status_code == 200
    assert motor.chamadas[-1].url.path == "/v1/empresas" and motor.corpos[-1] == b'{"razao_social":"NOVA LTDA","cnpj":"12.345.678/0001-95"}'


def test_aprovacao_item_a_item_valida_a_selecao(como, motor):
    c = como(perm.APROVAR_LOTES)
    url = f"{P}/empresas/MM/memoria/lotes/{UUID}/aprovar"
    assert c.post(url, json={"diferencas": [3, 7]}).status_code == 200
    feitas = len(motor.chamadas)
    for ruim in ({"diferencas": [1], "excluir": [2]}, {"diferencas": [1, 1]}, {"diferencas": [0]}, {"diferencas": ["1"]}, {"selecionadas": [1]}):
        assert c.post(url, json=ruim).status_code == 422, ruim
    assert len(motor.chamadas) == feitas


def test_resolucoes_e_correcoes_respeitam_o_teto(como, motor):
    c = como(perm.OPERAR)
    ok = {"resolucoes": [{"pendencia_id": n, "tributacao": "ST"} for n in range(1, 501)]}
    assert c.post(f"{P}/empresas/MM/pendencias/resolver-lote", json=ok).status_code == 200
    assert c.post(f"{P}/empresas/MM/pendencias/resolver-lote", json={"resolucoes": ok["resolucoes"] + [{"pendencia_id": 999, "tributacao": "ST"}]}).status_code == 422
    assert c.put(f"{P}/empresas/MM/memoria/lotes/{UUID}/correcoes", json={"correcoes": [{"tipo": "IGNORAR_LINHA", "linha": n} for n in range(2, 503)]}).status_code == 422


# ----------------------------------------------------------------------------------------------------- limites de corpo e uploads


def test_corpo_json_acima_de_64kb_e_recusado_antes_de_ler(como, motor):
    grande = {"razao_social": "X" * 200, "cnpj": None, "lixo": "y" * (70 * 1024)}
    r = como(perm.GERIR_EMPRESAS).post(f"{P}/empresas", json=grande)
    assert r.status_code == 413 and r.json()["erro"]["codigo"] == "REQUISICAO_GRANDE" and motor.chamadas == []


def test_corpo_sem_tamanho_e_recusado(como, motor):
    def pedacos():
        yield b'{"razao_social": "ABC"}'

    r = como(perm.GERIR_EMPRESAS).post(f"{P}/empresas", content=pedacos(), headers={"Content-Type": "application/json"})
    assert r.status_code == 411 and motor.chamadas == []


def _arquivo(nome="SAIDAS_08_2026.xlsx", conteudo=b"PK\x03\x04conteudo"):
    return {"arquivo": (nome, conteudo, XLSX)}


def test_upload_de_apuracao_repassa_arquivo_e_forca_origem_portal(como, motor):
    motor.resposta = httpx.Response(201, json={"id": UUID})
    r = como(perm.OPERAR).post(f"{P}/empresas/MM/apuracoes", files=_arquivo(), data={"competencia": "2026-08", "origem": "API"})
    assert r.status_code == 201, r.text
    corpo = motor.corpos[-1]
    assert b'name="origem"\r\n\r\nPORTAL\r\n' in corpo and b"API" not in corpo  # o cliente não escolhe a origem
    assert b'filename="SAIDAS_08_2026.xlsx"' in corpo


def test_upload_valida_extensao_vazio_e_tamanho(como, motor, monkeypatch):
    c = como(perm.OPERAR)
    url = f"{P}/empresas/MM/apuracoes"
    assert c.post(url, files=_arquivo("planilha.csv")).json()["erro"]["codigo"] == "EXTENSAO_INVALIDA"
    assert c.post(url, files=_arquivo(conteudo=b"")).json()["erro"]["codigo"] == "ARQUIVO_VAZIO"
    assert c.post(url, data={"competencia": "2026-08"}).status_code == 422
    assert c.post(url, files=_arquivo(), data={"competencia": "agosto"}).status_code == 422
    from app.integrations.icms_saidas import tipos

    monkeypatch.setattr(cliente_mod, "TETO_ARQUIVO", 10)
    monkeypatch.setattr(tipos, "TETO_ARQUIVO", 10)
    r = c.post(url, files=_arquivo(conteudo=b"x" * 11))
    assert r.status_code == 413 and r.json()["erro"]["codigo"] == "ARQUIVO_GRANDE"
    assert motor.chamadas == []


def test_lote_de_memoria_aceita_csv_e_forca_tipo_valido(como, motor):
    c = como(perm.OPERAR)
    url = f"{P}/empresas/MM/memoria/lotes"
    csv = {"arquivo": ("m.csv", b"DESCRICAO;NCM;ICMS\n", "text/csv")}
    assert c.post(url, files=csv, data={"tipo": "COMPLETA"}).status_code == 200
    assert b'name="vigencia_inicio"' not in motor.corpos[-1]  # sem vigência = correção de cadastro
    assert c.post(url, files=csv, data={"tipo": "COMPLETA", "vigencia_inicio": "2026-10-01"}).status_code == 200
    assert b'name="vigencia_inicio"\r\n\r\n2026-10-01\r\n' in motor.corpos[-1]
    for ruim in ({"tipo": "QUALQUER"}, {"tipo": "COMPLETA", "vigencia_inicio": "2026-10-15"}, {}):
        assert c.post(url, files=csv, data=ruim).status_code == 422, ruim


def test_completar_memoria_repassa_todos_os_arquivos_e_so_aceita_modo_conhecido(como, motor):
    c = como(perm.OPERAR)
    url = f"{P}/empresas/MM/memoria/completar"
    arquivos = [("memoria", ("memoria.xlsx", b"PK\x03\x04m", XLSX)), ("saidas", ("s1.xlsx", b"PK\x03\x04a", XLSX)), ("saidas", ("s2.xlsx", b"PK\x03\x04b", XLSX))]
    assert c.post(url, files=arquivos).status_code == 200
    corpo = motor.corpos[-1]
    assert corpo.count(b'name="saidas"') == 2 and b'name="modo"\r\n\r\nACRESCIMOS\r\n' in corpo  # padrão seguro: só acrescenta
    feitas = len(motor.chamadas)
    assert c.post(url, files=arquivos, data={"modo": "QUALQUER"}).status_code == 422
    assert c.post(url, files=[arquivos[0]]).status_code == 422  # nenhum relatório
    assert c.post(url, files=[arquivos[0]] + [("saidas", (f"s{i}.xlsx", b"PK\x03\x04", XLSX)) for i in range(7)]).status_code == 422  # 7 relatórios
    assert len(motor.chamadas) == feitas


def test_completar_tem_teto_de_corpo_proprio_maior_mas_finito(como, motor):
    assert rota_mod.TETO_CORPO_UPLOAD < rota_mod.TETO_CORPO_COMPLETAR <= 150 * 1024 * 1024  # cabem 1 memória + 6 relatórios, e é finito
    c = como(perm.OPERAR)
    vinte = b"PK\x03\x04" + b"x" * (20 * 1024 * 1024)
    dois = [("memoria", ("m.xlsx", b"PK\x03\x04m", XLSX)), ("saidas", ("a.xlsx", vinte, XLSX)), ("saidas", ("b.xlsx", vinte, XLSX))]  # ~40 MB
    assert c.post(f"{P}/empresas/MM/memoria/completar", files=dois).status_code == 200
    # os outros uploads continuam no teto de ~25 MB
    r = c.post(f"{P}/empresas/MM/memoria/lotes", files={"arquivo": ("a.xlsx", vinte + vinte, XLSX)}, data={"tipo": "COMPLETA"})
    assert r.status_code == 413


# ----------------------------------------------------------------------------------------------------- auditoria


def test_so_chamadas_que_alteram_sao_auditadas_com_empresa_e_status(como, motor, auditorias):
    c = como(perm.OPERAR, email="ana@mendoncagalvao.com.br")
    c.get(f"{P}/empresas/MM/pendencias")
    assert auditorias == []  # leitura não audita
    motor.resposta = httpx.Response(409, json={"erro": {"codigo": "PENDENCIA_JA_TRATADA", "mensagem": "m", "detalhes": []}})
    c.post(f"{P}/empresas/MM/pendencias/7/resolver", json={"tributacao": "ST"})
    assert auditorias == [("ana@mendoncagalvao.com.br", "POST", "/v1/empresas/MM/pendencias/7/resolver", "MM", 409)]  # também a que o motor recusou


def test_recusa_por_permissao_nao_chama_o_motor_nem_audita(como, motor, auditorias):
    como(perm.CONSULTAR).post(f"{P}/empresas/MM/pendencias/7/resolver", json={"tributacao": "ST"})
    assert motor.chamadas == [] and auditorias == []


# ----------------------------------------------------------------------------------------------------- apuração parcial


def _resposta_parcial(**cab):
    base = {
        "Content-Type": XLSX,
        "Content-Disposition": 'attachment; filename="APURACAO_PARCIAL_08_2026_MM.xlsx"',
        "X-Parcial-Competencia": "2026-08", "X-Parcial-Itens": "120", "X-Parcial-Itens-Sem-Memoria": "7", "X-Parcial-Produtos-Sem-Memoria": "3",
        "X-Parcial-OD": "1234.50", "X-Parcial-ED": "10.00", "X-Parcial-Saldo": "1224.50",
    }
    base.update(cab)
    return httpx.Response(200, content=b"PK\x03\x04parcial", headers=base)


def test_apuracao_parcial_repassa_o_arquivo_devolve_a_planilha_e_o_resumo_e_nao_forca_origem(como, motor):
    motor.resposta = _resposta_parcial()
    r = como(perm.OPERAR).post(f"{P}/empresas/MM/apuracoes/parcial", files=_arquivo(), data={"competencia": "2026-08", "origem": "API"})
    assert r.status_code == 200 and r.content == b"PK\x03\x04parcial"
    assert r.headers["content-type"] == XLSX and "APURACAO_PARCIAL_08_2026_MM.xlsx" in r.headers["content-disposition"]
    assert (r.headers["x-parcial-itens"], r.headers["x-parcial-itens-sem-memoria"], r.headers["x-parcial-od"]) == ("120", "7", "1234.50")
    req = motor.chamadas[0]
    assert req.url.path == "/v1/empresas/MM/apuracoes/parcial" and req.headers["x-api-key"] == settings.MOTOR_ICMS_API_KEY
    assert b"2026-08" in motor.corpos[0] and b"origem" not in motor.corpos[0]  # só arquivo e competência seguem


def test_apuracao_parcial_so_repassa_cabecalhos_no_formato_esperado(como, motor):
    motor.resposta = _resposta_parcial(**{"X-Parcial-OD": "<script>", "X-Parcial-Itens": "12a", "X-Segredo": "x"})
    r = como(perm.OPERAR).post(f"{P}/empresas/MM/apuracoes/parcial", files=_arquivo())
    assert r.status_code == 200
    assert "x-parcial-od" not in r.headers and "x-parcial-itens" not in r.headers and "x-segredo" not in r.headers
    assert r.headers["x-parcial-saldo"] == "1224.50"


def test_apuracao_parcial_erro_do_motor_passa_como_veio_e_valida_o_upload(como, motor):
    motor.resposta = httpx.Response(409, json={"erro": {"codigo": "MEMORIA_VAZIA", "mensagem": "Sem memória.", "detalhes": []}})
    c = como(perm.OPERAR)
    r = c.post(f"{P}/empresas/MM/apuracoes/parcial", files=_arquivo())
    assert r.status_code == 409 and r.json()["erro"]["codigo"] == "MEMORIA_VAZIA"
    assert c.post(f"{P}/empresas/MM/apuracoes/parcial", files=_arquivo("planilha.csv")).json()["erro"]["codigo"] == "EXTENSAO_INVALIDA"
    assert c.post(f"{P}/empresas/MM/apuracoes/parcial", files=_arquivo(), data={"competencia": "agosto"}).status_code == 422
