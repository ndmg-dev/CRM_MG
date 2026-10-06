"""Modelo interno neutro (independente da Thomson Reuters) e o schema
externo que o Onvio API exige, conforme INTEGRACAO_DOMINIO_FOLHA_API.md
§5 e §10. Nada daqui depende de SQLAlchemy — isto é só contrato de dados."""

from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class PayrollEvent(BaseModel):
    """Um evento consolidado do Processar Ponto para um colaborador numa
    competência — nunca uma batida bruta. `amount_minutes`/`amount_days`/
    `amount_value` são mutuamente exclusivos; qual deles é usado depende da
    unidade configurada pra rubrica (ver DominioRubricMapping.unit)."""

    employee_id: str
    employee_cpf: str  # só dígitos; nunca logar
    competence: date
    event_type: str  # PayrollEventType
    amount_minutes: Optional[int] = None
    amount_days: Optional[Decimal] = None
    amount_value: Optional[Decimal] = None
    missed_days: list[date] = Field(default_factory=list)


class DominioPayslipItemRequest(BaseModel):
    """Leiaute JSON oficial da Onvio API (§5). Nomes de campo em camelCase
    de propósito — é o contrato exato que a API espera no corpo HTTP."""

    cpf: str
    esocialCategoryCode: int = Field(ge=1, le=999)
    admissionDate: date
    competence: date
    payslipItemCode: int
    reference: Decimal = Field(ge=Decimal("0.0001"), le=Decimal("9999.9999"))
    operationType: Literal["INSERT", "DELETE"]
    missedDays: Optional[list[date]] = None
    esocialCode: Optional[str] = Field(default=None, max_length=30)

    def to_payload(self) -> dict:
        data = self.model_dump(mode="json", exclude_none=True)
        return data
