"""Testes do parser e do processamento.

Os recibos são sintéticos. O layout real do Domínio é a única fonte de verdade
sobre o regex — rodar contra arquivos reais antes de ligar em produção.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.dominio import Entrega, MotivoRevisao
from app.parser import cnpj_valido, detecta_obrigacao, extrair_dados, normaliza_cnpj
from app.processamento import processar_recibo

OBRIG_DCTFWEB = "0b000003-0000-0000-0000-000000000003"
OBRIG_DAS = "0b000001-0000-0000-0000-000000000001"
TENANT = "11111111-1111-1111-1111-111111111111"
EMPRESA = "e0000001-0000-0000-0000-000000000001"

TERMOS = {
    "dctfweb": OBRIG_DCTFWEB,
    "declaração de débitos e créditos tributários federais": OBRIG_DCTFWEB,
    "das": OBRIG_DAS,
    "pgdas-d": "0b000002-0000-0000-0000-000000000002",
}

# CNPJ com DV válido (o do seed da Padaria Vila Nova).
CNPJ_OK = "12.345.678/0001-95"

RECIBO_XML = f"""<?xml version="1.0" encoding="UTF-8"?>
<recibo>
  <titulo>DCTFWeb - Recibo de Entrega</titulo>
  <cnpj>{CNPJ_OK}</cnpj>
  <competencia>07/2026</competencia>
  <protocolo>Protocolo: AB12-3456-7890</protocolo>
</recibo>
"""


# --------------------------------------------------------------------- CNPJ


def test_cnpj_valido_aceita_dv_correto():
    assert cnpj_valido("12345678000195")
    assert cnpj_valido("11.222.333/0001-81")


def test_cnpj_valido_recusa_dv_errado_e_repetido():
    # É o clássico CNPJ fictício — e é inválido.
    assert not cnpj_valido("12345678000190")
    assert not cnpj_valido("00000000000000")
    assert not cnpj_valido("123")


def test_normaliza_cnpj_devolve_so_digitos():
    assert normaliza_cnpj("12.345.678/0001-95") == "12345678000195"


# ------------------------------------------------------------------ de-para


def test_detecta_obrigacao_prefere_a_chave_mais_longa():
    # 'das' está contido em 'pgdas-d': sem ordenar por tamanho, o recibo de
    # PGDAS-D seria baixado como DAS.
    assert detecta_obrigacao("Recibo PGDAS-D 07/2026", TERMOS) != OBRIG_DAS


def test_detecta_obrigacao_devolve_none_fora_do_de_para():
    assert detecta_obrigacao("Recibo de algo que ninguém cadastrou", TERMOS) is None


@pytest.mark.parametrize(
    "texto",
    ["ninguém cadastrou", "todas as guias", "medidas provisórias", "as saídas do mês"],
)
def test_termo_curto_nao_casa_dentro_de_outra_palavra(texto):
    # 'das' aparece em 'cadastrou', 'todas', 'medidas', 'saídas'. Busca por
    # substring simples baixaria esses recibos como DAS — baixa errada, que é
    # justamente o que este módulo não pode fazer.
    assert detecta_obrigacao(texto, TERMOS) is None


def test_termo_ainda_casa_como_palavra_isolada():
    assert detecta_obrigacao("Recibo do DAS 07/2026", TERMOS) == OBRIG_DAS
    assert detecta_obrigacao("recibo do das, competência", TERMOS) == OBRIG_DAS


# ------------------------------------------------------------------- parser


def test_extrai_dados_de_xml():
    dados, _ = extrair_dados(RECIBO_XML.encode(), "recibo.xml", TERMOS)
    assert dados is not None
    assert dados.cnpj == "12345678000195"
    assert dados.obrigacao_id == OBRIG_DCTFWEB
    assert dados.competencia == date(2026, 7, 1)
    assert dados.protocolo == "AB12-3456-7890"


def test_xml_com_xxe_nao_le_arquivo_do_servidor():
    # defusedxml deve recusar a entidade externa em vez de resolvê-la.
    malicioso = b"""<?xml version="1.0"?>
    <!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
    <r>&xxe;</r>"""
    dados, parcial = extrair_dados(malicioso, "ataque.xml", TERMOS)
    assert dados is None
    assert parcial["cnpj"] is None


def test_dados_incompletos_devolvem_parcial_para_a_tela():
    # Sem competência: vai para revisão, mas o humano vê o que foi lido.
    texto = f"<r><t>DCTFWeb</t><c>{CNPJ_OK}</c></r>".encode()
    dados, parcial = extrair_dados(texto, "r.xml", TERMOS)
    assert dados is None
    assert parcial["cnpj"] == "12345678000195"
    assert parcial["codigo_obrigacao"] == OBRIG_DCTFWEB
    assert parcial["competencia"] is None


def test_cnpj_com_dv_invalido_e_ignorado():
    # Número que casa o formato mas não é CNPJ (ex.: nº de guia no recibo).
    texto = b"<r><t>DCTFWeb</t><c>12.345.678/0001-90</c><p>07/2026</p></r>"
    dados, parcial = extrair_dados(texto, "r.xml", TERMOS)
    assert dados is None
    assert parcial["cnpj"] is None


# ------------------------------------------------------------- dublês


class RepoFalso:
    def __init__(self, entregas=None, empresa_id=EMPRESA, termos=None):
        self.entregas = entregas if entregas is not None else []
        self.empresa_id = empresa_id
        self.termos = TERMOS if termos is None else termos
        self.processados: dict[str, str] = {}
        self.revisoes: list[tuple[MotivoRevisao, str | None]] = []
        self.baixadas: list[str] = []

    async def recibo_ja_processado(self, tenant_id, hash_arq):
        return hash_arq in self.processados

    async def registrar_processamento(self, tenant_id, hash_arq, resultado, entrega_id):
        self.processados[hash_arq] = resultado

    async def termos_do_tenant(self, tenant_id):
        return self.termos

    async def buscar_empresa_id_por_cnpj(self, tenant_id, cnpj):
        return self.empresa_id

    async def buscar_entregas(self, tenant_id, empresa_id, obrigacao_id, competencia):
        return self.entregas

    async def marcar_entregue(self, **kwargs):
        self.baixadas.append(kwargs["entrega_id"])

    async def enfileirar_revisao(
        self, tenant_id, hash_arq, storage_path, motivo, cnpj_lido,
        codigo_obrigacao_lido, competencia_lida,
    ):
        self.revisoes.append((motivo, cnpj_lido))

    async def pastas_monitoradas(self):
        return []


class StorageFalso:
    def __init__(self):
        self.salvos: list[str] = []

    async def salvar(self, tenant_id, empresa_id, conteudo, hash_arq, nome_arquivo, mime):
        caminho = f"{tenant_id}/{empresa_id or '_sem_empresa'}/{hash_arq[:8]}-{nome_arquivo}"
        self.salvos.append(caminho)
        return caminho


def entrega(status="PENDENTE"):
    return Entrega(
        id="ent-1", empresa_id=EMPRESA, obrigacao_id=OBRIG_DCTFWEB,
        competencia=date(2026, 7, 1), status=status,
    )


# ------------------------------------------------------------ processamento


async def test_baixa_quando_casa_exatamente_uma_entrega():
    repo, storage = RepoFalso(entregas=[entrega()]), StorageFalso()
    r = await processar_recibo(RECIBO_XML.encode(), "r.xml", TENANT, repo, storage)
    assert r == "baixado"
    assert repo.baixadas == ["ent-1"]
    assert not repo.revisoes


async def test_mesmo_recibo_duas_vezes_nao_baixa_duas_vezes():
    repo, storage = RepoFalso(entregas=[entrega()]), StorageFalso()
    await processar_recibo(RECIBO_XML.encode(), "r.xml", TENANT, repo, storage)
    r = await processar_recibo(RECIBO_XML.encode(), "r.xml", TENANT, repo, storage)
    assert r == "duplicado"
    assert repo.baixadas == ["ent-1"]


async def test_entrega_ja_entregue_nao_e_baixada_de_novo():
    # O esboço comparava status com "entregue" minúsculo e o enum é 'ENTREGUE':
    # a condição nunca casava e a entrega era rebaixada a cada reprocessamento.
    repo, storage = RepoFalso(entregas=[entrega(status="ENTREGUE")]), StorageFalso()
    r = await processar_recibo(RECIBO_XML.encode(), "r.xml", TENANT, repo, storage)
    assert r == "ja_entregue"
    assert repo.baixadas == []


async def test_ambiguidade_vai_para_revisao_e_nao_baixa():
    repo = RepoFalso(entregas=[entrega(), entrega()])
    r = await processar_recibo(RECIBO_XML.encode(), "r.xml", TENANT, repo, StorageFalso())
    assert r == "revisao_ambigua"
    assert repo.baixadas == []
    assert repo.revisoes[0][0] is MotivoRevisao.MULTIPLAS_ENTREGAS


async def test_empresa_desconhecida_vai_para_revisao():
    repo = RepoFalso(empresa_id=None)
    r = await processar_recibo(RECIBO_XML.encode(), "r.xml", TENANT, repo, StorageFalso())
    assert r == "revisao_empresa"
    assert repo.revisoes[0][0] is MotivoRevisao.EMPRESA_NAO_ENCONTRADA
    # O CNPJ lido acompanha o item, para o humano decidir.
    assert repo.revisoes[0][1] == "12345678000195"


async def test_sem_entrega_parametrizada_vai_para_revisao():
    repo = RepoFalso(entregas=[])
    r = await processar_recibo(RECIBO_XML.encode(), "r.xml", TENANT, repo, StorageFalso())
    assert r == "revisao_sem_entrega"
    assert repo.revisoes[0][0] is MotivoRevisao.ENTREGA_NAO_PARAMETRIZADA


async def test_arquivo_ilegivel_e_guardado_e_vai_para_revisao():
    repo, storage = RepoFalso(), StorageFalso()
    r = await processar_recibo(b"\x00\x01lixo binario", "r.pdf", TENANT, repo, storage)
    assert r == "revisao_ilegivel"
    # Nunca se descarta o arquivo: sem ele o humano não tem o que revisar.
    assert len(storage.salvos) == 1


async def test_tenant_sem_de_para_nao_processa():
    repo = RepoFalso(termos={})
    r = await processar_recibo(RECIBO_XML.encode(), "r.xml", TENANT, repo, StorageFalso())
    assert r == "sem_de_para"
    assert not repo.revisoes


async def test_recibo_de_obrigacao_fora_do_de_para_vai_para_revisao():
    # Enquanto só a DCTFWeb está no de-para, o resto cai em revisão — que é o
    # comportamento correto na ausência de certeza.
    repo = RepoFalso(termos={"dctfweb": OBRIG_DCTFWEB}, entregas=[entrega()])
    xml = RECIBO_XML.replace("DCTFWeb - Recibo de Entrega", "eSocial - Recibo")
    r = await processar_recibo(xml.encode(), "r.xml", TENANT, repo, StorageFalso())
    assert r == "revisao_ilegivel"
    assert repo.baixadas == []
