from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.integrations.dominio.schemas import PayrollEvent


# --- Integração / ativação ---------------------------------------------

class DominioIntegrationResponse(BaseModel):
    cliente_id: UUID
    accounting_office_name: Optional[str] = None
    client_name: Optional[str] = None
    client_document: Optional[str] = None
    hours_format: Optional[str] = None
    enabled: bool
    validated_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ValidateActivationKeyRequest(BaseModel):
    activation_key: str


class SetHoursFormatRequest(BaseModel):
    hours_format: str  # HoursFormat


# --- Rubricas -------------------------------------------------------------

class RubricMappingUpsert(BaseModel):
    internal_event_type: str  # PayrollEventType
    payslip_item_code: int
    unit: str  # PayslipItemUnit
    description: Optional[str] = None
    enabled: bool = True


class RubricMappingResponse(BaseModel):
    id: UUID
    internal_event_type: str
    payslip_item_code: int
    unit: str
    description: Optional[str] = None
    enabled: bool

    model_config = ConfigDict(from_attributes=True)


# --- Perfil do colaborador --------------------------------------------------

class EmployeeProfileUpsert(BaseModel):
    employee_id: str
    cpf: Optional[str] = None
    esocial_category_code: Optional[int] = None
    admission_date: Optional[date] = None
    esocial_code: Optional[str] = None


class EmployeeProfileResponse(BaseModel):
    employee_id: str
    cpf_masked: Optional[str] = None
    esocial_category_code: Optional[int] = None
    admission_date: Optional[date] = None
    esocial_code: Optional[str] = None
    enabled: bool

    model_config = ConfigDict(from_attributes=True)


# --- Exports ----------------------------------------------------------------

class CreateExportRequest(BaseModel):
    competence: date


class PreviewExportRequest(BaseModel):
    competence: date
    events: list[PayrollEvent]


class ExportItemResponse(BaseModel):
    id: UUID
    employee_id: str
    cpf_masked: Optional[str] = None
    internal_event_type: str
    payslip_item_code: int
    reference: Decimal
    operation_type: str
    status: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    attempt_count: int

    model_config = ConfigDict(from_attributes=True)


class ExportResponse(BaseModel):
    id: UUID
    cliente_id: UUID
    competence: date
    status: str
    total_items: int
    success_items: int
    failed_items: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    items: list[ExportItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
