from enum import Enum


class VisibilidadeSistemas(str, Enum):
    """Quanto do catálogo de sistemas os colaboradores de um setor enxergam."""

    #: Sistemas do próprio setor + os marcados como GERAL. Padrão.
    PROPRIO = "PROPRIO"
    #: Todo o catálogo, exceto os sistemas RESTRITO (só ADMIN).
    TOTAL = "TOTAL"
    #: Nada por padrão — apenas o que for concedido individualmente.
    RESTRITO = "RESTRITO"
    #: Próprio setor + GERAL + os setores listados em `setores_visiveis`.
    PERSONALIZADO = "PERSONALIZADO"
