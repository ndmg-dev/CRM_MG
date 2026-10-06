"""Conversão de minutos -> reference e montagem do payload da Onvio API
(INTEGRACAO_DOMINIO_FOLHA_API.md §6 e §10). A base interna é sempre minutos
inteiros; a conversão pra HORAS_MINUTOS/DECIMAL só acontece aqui, na borda
de saída — nunca propagada pro resto do sistema."""

import hashlib
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from app.enums.dominio import HoursFormat, PayslipItemUnit
from app.integrations.dominio.schemas import DominioPayslipItemRequest, PayrollEvent


def minutes_to_reference(total_minutes: int, hours_format: str) -> Decimal:
    if hours_format == HoursFormat.HOURS_MINUTES.value:
        horas, minutos = divmod(total_minutes, 60)
        valor = Decimal(horas) + Decimal(minutos) / Decimal(100)
        return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if hours_format == HoursFormat.DECIMAL_HOURS.value:
        valor = Decimal(total_minutes) / Decimal(60)
        return valor.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    raise ValueError(f"hours_format desconhecido: {hours_format!r}")


def compute_reference(event: PayrollEvent, unit: str, hours_format: str | None) -> Decimal:
    if unit == PayslipItemUnit.HOURS.value:
        if event.amount_minutes is None:
            raise ValueError("evento sem amount_minutes para rubrica em HOURS")
        if not hours_format:
            raise ValueError("hours_format não configurado para esta empresa")
        return minutes_to_reference(event.amount_minutes, hours_format)
    if unit == PayslipItemUnit.DAYS.value:
        if event.amount_days is None:
            raise ValueError("evento sem amount_days para rubrica em DAYS")
        return event.amount_days
    if unit in (PayslipItemUnit.VALUE.value, PayslipItemUnit.PERCENTAGE.value):
        if event.amount_value is None:
            raise ValueError(f"evento sem amount_value para rubrica em {unit}")
        return event.amount_value
    raise ValueError(f"unidade de rubrica desconhecida: {unit!r}")


def build_payslip_item_request(
    *,
    cpf: str,
    esocial_category_code: int,
    admission_date: date,
    competence: date,
    payslip_item_code: int,
    reference: Decimal,
    operation_type: str = "INSERT",
    missed_days: list[date] | None = None,
    esocial_code: str | None = None,
) -> DominioPayslipItemRequest:
    return DominioPayslipItemRequest(
        cpf=cpf,
        esocialCategoryCode=esocial_category_code,
        admissionDate=admission_date,
        competence=competence,
        payslipItemCode=payslip_item_code,
        reference=reference,
        operationType=operation_type,
        missedDays=missed_days or None,
        esocialCode=esocial_code,
    )


def compute_fingerprint(
    *,
    cliente_id: str,
    cpf: str,
    admission_date: date,
    esocial_category_code: int,
    competence: date,
    payslip_item_code: int,
    reference: Decimal,
    operation_type: str,
) -> str:
    """SHA-256 de tudo que compõe o payload (§13) — usado pra decidir se um
    lançamento já foi enviado com sucesso antes e não deve ser reenviado
    automaticamente."""
    partes = [
        str(cliente_id),
        cpf,
        admission_date.isoformat(),
        str(esocial_category_code),
        competence.isoformat(),
        str(payslip_item_code),
        str(reference),
        operation_type,
    ]
    return hashlib.sha256("|".join(partes).encode()).hexdigest()
