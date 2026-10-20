from enum import Enum


class TipoMovimentacao(str, Enum):
    """Natureza de uma movimentação de sócio num extrato.

    Os valores são minúsculos de propósito: é exatamente o que o n8n manda no
    campo `tipo` do payload de ingestão (ver IngestExtratoPayload), então o
    schema de entrada valida direto contra este enum sem normalizar.
    """

    RETIRADA = "retirada"
    APORTE = "aporte"
