"""Schemas do módulo Extratos de Sócios.

- IngestExtratoPayload: o envelope que o n8n envia por extrato processado
  (entrada de `POST /integracoes/n8n/extratos`).
- Schemas de leitura (camelCase, como o resto do dashboard do CRM) para as
  três telas: dashboard geral, detalhe por empresa e não vinculados.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums.tipo_movimentacao import TipoMovimentacao


# --- Ingestão (n8n -> CRM) ---------------------------------------------------

class EmpresaIn(BaseModel):
    cnpj: str
    razao_social: Optional[str] = None


class ContaIn(BaseModel):
    agencia: Optional[str] = None
    conta: Optional[str] = None
    banco: Optional[str] = None


class PeriodoIn(BaseModel):
    ano: int = Field(ge=2000, le=2100)
    mes: int = Field(ge=1, le=12)


class ExtratoIn(BaseModel):
    arquivo_origem: Optional[str] = None
    drive_file_id: Optional[str] = None
    drive_url: Optional[str] = None
    processado_em: Optional[datetime] = None


class MovimentacaoIn(BaseModel):
    socio: str
    cpf: Optional[str] = None
    data: Optional[date] = None
    tipo: TipoMovimentacao
    valor: Decimal
    descricao: Optional[str] = None
    # Opcionais de análise (colunas do relatório "Transações Identificadas").
    nome_extrato: Optional[str] = None
    contraparte: Optional[str] = None
    papel: Optional[str] = None
    documento: Optional[str] = None
    historico: Optional[str] = None


class ConsolidadoIn(BaseModel):
    """Totais que o n8n já traz. Aceitos no payload mas NÃO confiados: o
    ConsolidadoSocioAno é recalculado no backend a partir das movimentações."""
    socio: str
    ano: int
    total_retiradas: Decimal = Decimal("0")
    total_aportes: Decimal = Decimal("0")


class IngestExtratoPayload(BaseModel):
    empresa: EmpresaIn
    conta: ContaIn = ContaIn()
    periodo: PeriodoIn
    extrato: ExtratoIn = ExtratoIn()
    movimentacoes_socios: List[MovimentacaoIn] = Field(default_factory=list)
    consolidado_ano: List[ConsolidadoIn] = Field(default_factory=list)
    # SHA-256 do PDF calculado pelo n8n. Aceita tanto "sha256:<hex>" quanto o
    # hex puro; normalizado para 64 chars hex em `sha256_hex`.
    idempotency_key: str

    @field_validator("idempotency_key")
    @classmethod
    def _valida_idempotency_key(cls, v: str) -> str:
        hexpart = v.split(":", 1)[1] if ":" in v else v
        hexpart = hexpart.strip().lower()
        if len(hexpart) != 64 or any(c not in "0123456789abcdef" for c in hexpart):
            raise ValueError("idempotency_key deve ser um SHA-256 (64 chars hex), com ou sem prefixo 'sha256:'")
        return v

    @property
    def sha256_hex(self) -> str:
        v = self.idempotency_key
        return (v.split(":", 1)[1] if ":" in v else v).strip().lower()


# --- Leitura (CRM -> frontend) ----------------------------------------------

class EmpresaResumo(BaseModel):
    clientId: UUID
    razaoSocial: Optional[str] = None
    cnpj: str
    mesesProcessados: List[int]  # meses do ano com extrato (1..12)


class DashboardExtratosResponse(BaseModel):
    ano: int
    empresasComExtrato: int
    totalRetiradasAno: Decimal
    totalAportesAno: Decimal
    extratosNoMes: int
    pendencias: int  # extratos não vinculados (CNPJ sem cliente)
    empresas: List[EmpresaResumo]


class SocioConsolidado(BaseModel):
    socio: str
    totalRetiradas: Decimal
    totalAportes: Decimal
    totalMovimentado: Decimal  # retiradas - aportes (líquido no ano)
    excedente: Decimal  # quanto o total movimentado passou do limite anual (0 se não passou)
    meses: List[int]  # meses do ano em que o sócio tem movimentação


class MesExtrato(BaseModel):
    mes: int
    driveUrl: Optional[str] = None
    driveFileId: Optional[str] = None
    sha256: str


class MovimentacaoItem(BaseModel):
    data: Optional[date] = None
    mes: int
    socio: str
    cpf: Optional[str] = None
    tipo: TipoMovimentacao
    valor: Decimal
    descricao: Optional[str] = None
    nomeExtrato: Optional[str] = None
    contraparte: Optional[str] = None
    papel: Optional[str] = None
    documento: Optional[str] = None
    historico: Optional[str] = None
    driveUrl: Optional[str] = None  # PDF do extrato do mês


class EmpresaDetalheResponse(BaseModel):
    clientId: UUID
    razaoSocial: Optional[str] = None
    cnpj: Optional[str] = None
    ano: int
    limiteAnual: Decimal  # limite operacional por sócio no ano
    socios: List[SocioConsolidado]
    meses: List[MesExtrato]  # linha dos 12 meses: só os presentes vêm preenchidos
    movimentacoes: List[MovimentacaoItem]  # transações identificadas (grid de análise)


class VincularRequest(BaseModel):
    cnpj: str
    client_id: UUID


class VincularResponse(BaseModel):
    vinculados: int  # extratos órfãos que passaram a apontar para o cliente
    anos: List[int]


class NaoVinculadoItem(BaseModel):
    id: UUID
    cnpj: str
    ano: int
    mes: int
    arquivoOrigem: Optional[str] = None
    driveUrl: Optional[str] = None
    processadoEm: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
