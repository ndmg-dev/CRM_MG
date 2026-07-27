"""Política de visualização de sistemas por setor.

A regra é pura (não toca no banco), então estes testes rodam em qualquer
ambiente — diferente de tests/test_users_sectors.py.
"""
import uuid

import pytest

from app.enums.visibilidade_sistemas import VisibilidadeSistemas as V
from app.models.sector import Setor
from app.models.system import Sistema
from app.models.user import Usuario
from app.services.visibility_service import filtrar_sistemas, pode_ver_sistema


def sistema(setor_codigo):
    return Sistema(id=uuid.uuid4(), nome=f"Sis {setor_codigo}", slug=str(uuid.uuid4()),
                   categoria="MAIN", setor=setor_codigo, ativo=True)


def setor(codigo, modo=V.PROPRIO, visiveis=None):
    return Setor(id=uuid.uuid4(), codigo=codigo, nome=codigo,
                 visibilidade_sistemas=modo.value, setores_visiveis=visiveis or [])


def usuario(perfil="ANALISTA", setor_codigo="FISCAL"):
    return Usuario(id=uuid.uuid4(), nome="U", email="u@x.com", perfil=perfil,
                   setor=setor_codigo, ativo=True)


FISCAL = sistema("FISCAL")
CONTABIL = sistema("CONTABIL")
GERAL = sistema("GERAL")
SEM_SETOR = sistema(None)
RESTRITO = sistema("RESTRITO")
TODOS = [FISCAL, CONTABIL, GERAL, SEM_SETOR, RESTRITO]


def visiveis(user, s, acessos=None):
    return {x.nome for x in filtrar_sistemas(TODOS, user, s, acessos or set())}


# ---------------------------------------------------------------------------
# Modos
# ---------------------------------------------------------------------------

def test_proprio_ve_o_proprio_setor_e_geral():
    assert visiveis(usuario(), setor("FISCAL", V.PROPRIO)) == {
        "Sis FISCAL", "Sis GERAL", "Sis None",  # sistema sem setor conta como GERAL
    }


def test_total_ve_tudo_menos_restrito():
    assert visiveis(usuario(), setor("FISCAL", V.TOTAL)) == {
        "Sis FISCAL", "Sis CONTABIL", "Sis GERAL", "Sis None",
    }


def test_restrito_nao_ve_nem_geral():
    assert visiveis(usuario(), setor("FISCAL", V.RESTRITO)) == set()


def test_personalizado_soma_os_setores_escolhidos():
    s = setor("FISCAL", V.PERSONALIZADO, ["CONTABIL"])
    assert visiveis(usuario(), s) == {
        "Sis FISCAL", "Sis CONTABIL", "Sis GERAL", "Sis None",
    }


def test_personalizado_nao_alcanca_setor_fora_da_lista():
    s = setor("FISCAL", V.PERSONALIZADO, ["DP"])
    assert "Sis CONTABIL" not in visiveis(usuario(), s)


# ---------------------------------------------------------------------------
# Sistemas RESTRITO e perfis
# ---------------------------------------------------------------------------

def test_admin_ve_tudo_inclusive_restrito():
    assert visiveis(usuario("ADMIN"), setor("FISCAL", V.RESTRITO)) == {
        s.nome for s in TODOS
    }


@pytest.mark.parametrize("modo", list(V))
def test_restrito_nunca_aparece_para_nao_admin(modo):
    s = setor("FISCAL", modo, ["RESTRITO"] if modo == V.PERSONALIZADO else [])
    assert not pode_ver_sistema(RESTRITO, usuario(), s, set())


def test_coordenador_segue_a_politica_do_setor():
    """Antes o COORDENADOR via tudo; agora depende do setor dele."""
    assert visiveis(usuario("COORDENADOR"), setor("FISCAL", V.PROPRIO)) == {
        "Sis FISCAL", "Sis GERAL", "Sis None",
    }
    assert "Sis CONTABIL" in visiveis(usuario("COORDENADOR"), setor("FISCAL", V.TOTAL))


# ---------------------------------------------------------------------------
# Concessão individual
# ---------------------------------------------------------------------------

def test_acesso_individual_fura_o_modo_restrito():
    s = setor("FISCAL", V.RESTRITO)
    assert visiveis(usuario(), s, {CONTABIL.id}) == {"Sis CONTABIL"}


def test_acesso_individual_nao_libera_sistema_restrito():
    s = setor("FISCAL", V.TOTAL)
    assert not pode_ver_sistema(RESTRITO, usuario(), s, {RESTRITO.id})


def test_usuario_sem_setor_cai_no_modo_proprio():
    assert visiveis(usuario(setor_codigo=None), None) == {"Sis GERAL", "Sis None"}
