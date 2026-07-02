from enum import Enum

class Perfil(str, Enum):
    ADMIN = "ADMIN"
    COORDENADOR = "COORDENADOR"
    ANALISTA = "ANALISTA"
    ASSISTENTE = "ASSISTENTE"
    VISUALIZADOR = "VISUALIZADOR"
