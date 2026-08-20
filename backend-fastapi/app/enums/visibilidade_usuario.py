from enum import Enum


class VisibilidadeUsuario(str, Enum):
    """De onde sai a lista de sistemas de um usuário.

    A política de `Setor.visibilidade_sistemas` é coletiva: restringir uma
    pessoa mexendo nela atingiria todos os colegas do mesmo setor. Este campo
    existe para os cargos que não se encaixam no padrão do setor.
    """

    #: Política do setor, somada às concessões individuais. Padrão.
    SETOR = "SETOR"
    #: Exatamente os sistemas concedidos individualmente — nada vem do setor.
    INDIVIDUAL = "INDIVIDUAL"
