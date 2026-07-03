from enum import Enum

class SetorSistema(str, Enum):
    DP = "DP"
    CONTABIL = "CONTABIL"
    FISCAL = "FISCAL"
    SOCIETARIO = "SOCIETARIO"
    TI = "TI"
    GERAL = "GERAL"
    RESTRITO = "RESTRITO"

