"""Conversão de minutos -> reference e fingerprint de idempotência
(app/integrations/dominio/mapper.py). Funções puras, sem banco — rodam em
qualquer ambiente, igual tests/test_visibility.py.

Os casos de HOURS_MINUTES/DECIMAL_HOURS são exatamente os do §6/§24 de
docs/aplicacoes/processar-ponto/INTEGRACAO_DOMINIO_FOLHA_API.md.
"""
import os
from datetime import date
from decimal import Decimal

os.environ.setdefault("JWT_SECRET", "test-only")

import pytest  # noqa: E402

from app.enums.dominio import PayslipItemUnit  # noqa: E402
from app.integrations.dominio.mapper import (  # noqa: E402
    compute_fingerprint,
    compute_reference,
    minutes_to_reference,
)
from app.integrations.dominio.schemas import PayrollEvent  # noqa: E402


@pytest.mark.parametrize(
    "minutos,esperado",
    [(35, "0.35"), (95, "1.35"), (515, "8.35"), (599, "9.59"), (600, "10.00")],
)
def test_hours_minutes(minutos, esperado):
    assert str(minutes_to_reference(minutos, "HOURS_MINUTES")) == esperado


@pytest.mark.parametrize(
    "minutos,esperado",
    [(35, "0.5833"), (95, "1.5833"), (515, "8.5833"), (600, "10.0000")],
)
def test_decimal_hours(minutos, esperado):
    assert str(minutes_to_reference(minutos, "DECIMAL_HOURS")) == esperado


def test_hours_minutes_parte_decimal_nunca_passa_de_59_minutos():
    # 1439 min = 23h59 -> nunca "23.60" nem nada >= .60
    r = minutes_to_reference(23 * 60 + 59, "HOURS_MINUTES")
    assert str(r) == "23.59"


def test_formato_desconhecido_levanta_erro():
    with pytest.raises(ValueError):
        minutes_to_reference(60, "QUALQUER_COISA")


def _evento(**kwargs):
    base = dict(
        employee_id="32",
        employee_cpf="12345678901",
        competence=date(2026, 9, 1),
        event_type="OVERTIME_50",
        amount_minutes=515,
    )
    base.update(kwargs)
    return PayrollEvent(**base)


def test_compute_reference_hours_delega_pra_minutes_to_reference():
    evento = _evento(amount_minutes=515)
    assert str(compute_reference(evento, PayslipItemUnit.HOURS.value, "HOURS_MINUTES")) == "8.35"


def test_compute_reference_days_usa_amount_days_direto():
    evento = _evento(amount_minutes=None, amount_days=Decimal("1.5"))
    assert compute_reference(evento, PayslipItemUnit.DAYS.value, None) == Decimal("1.5")


def test_compute_reference_value_sem_amount_value_levanta_erro():
    evento = _evento(amount_minutes=None)
    with pytest.raises(ValueError):
        compute_reference(evento, PayslipItemUnit.VALUE.value, None)


def test_compute_reference_hours_sem_hours_format_levanta_erro():
    evento = _evento()
    with pytest.raises(ValueError):
        compute_reference(evento, PayslipItemUnit.HOURS.value, None)


# --- Idempotência (§13) ------------------------------------------------------

def _fingerprint(**overrides):
    base = dict(
        cliente_id="11111111-1111-1111-1111-111111111111",
        cpf="12345678901",
        admission_date=date(2024, 2, 1),
        esocial_category_code=101,
        competence=date(2026, 9, 1),
        payslip_item_code=150,
        reference=Decimal("8.35"),
        operation_type="INSERT",
    )
    base.update(overrides)
    return compute_fingerprint(**base)


def test_fingerprint_e_deterministico():
    assert _fingerprint() == _fingerprint()


def test_fingerprint_muda_com_qualquer_campo():
    base = _fingerprint()
    assert _fingerprint(reference=Decimal("8.36")) != base
    assert _fingerprint(operation_type="DELETE") != base
    assert _fingerprint(payslip_item_code=151) != base
    assert _fingerprint(competence=date(2026, 10, 1)) != base
