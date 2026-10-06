"""Orquestração da integração: ativação, de-para de rubricas, cadastro
complementar do colaborador, preview e envio de exports. É a única camada
que mistura banco + chamada externa — endpoints HTTP nunca falam direto
com DominioApiClient."""

import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret, encrypt_secret, mask_cpf
from app.enums.dominio import DominioExportItemStatus, DominioExportStatus
from app.integrations.dominio.client import DominioApiClient
from app.integrations.dominio.exceptions import DominioApiError
from app.integrations.dominio.mapper import build_payslip_item_request, compute_fingerprint, compute_reference
from app.integrations.dominio.schemas import PayrollEvent
from app.models.audit_log import LogAuditoria
from app.models.dominio_employee_profile import DominioEmployeeProfile
from app.models.dominio_export import DominioExport
from app.models.dominio_export_item import DominioExportItem
from app.models.dominio_integration import DominioIntegration
from app.models.dominio_rubric_mapping import DominioRubricMapping


class DominioValidationError(Exception):
    """Erro de validação de negócio (não de transporte HTTP) — vira 422 no
    endpoint, com `code` estável pra UI mostrar mensagem amigável."""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def _only_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


async def _get_integration(db: AsyncSession, cliente_id: UUID) -> DominioIntegration | None:
    return await db.scalar(select(DominioIntegration).where(DominioIntegration.cliente_id == cliente_id))


def _audit(db: AsyncSession, usuario_id, acao: str, alvo: str, detalhes: dict | None = None) -> None:
    db.add(LogAuditoria(usuario_id=usuario_id, acao=acao, alvo=alvo, detalhes=detalhes or {}))


async def validate_activation_key(db: AsyncSession, cliente_id: UUID, activation_key: str, usuario_id) -> DominioIntegration:
    client = DominioApiClient()
    info = await client.get_activation_info(activation_key)

    integration = await _get_integration(db, cliente_id)
    if integration is None:
        integration = DominioIntegration(cliente_id=cliente_id)
        db.add(integration)

    integration.activation_key_encrypted = encrypt_secret(activation_key)
    integration.accounting_office_name = info.get("accountingOfficeName")
    integration.client_name = info.get("clientName")
    integration.client_document = info.get("clientDocument")
    integration.validated_at = datetime.utcnow()

    _audit(db, usuario_id, "DOMINIO_VALIDAR_CHAVE", f"cliente:{cliente_id}", {"escritorio": info.get("accountingOfficeName")})
    await db.commit()
    await db.refresh(integration)
    return integration


async def enable_integration(db: AsyncSession, cliente_id: UUID, usuario_id) -> DominioIntegration:
    integration = await _get_integration(db, cliente_id)
    if integration is None or not integration.activation_key_encrypted:
        raise DominioValidationError("CHAVE_NAO_VALIDADA", "Valide a chave de ativação antes de ativar a integração.")

    activation_key = decrypt_secret(integration.activation_key_encrypted)
    client = DominioApiClient()
    result = await client.enable_activation(activation_key)
    integration_key = result.get("integrationKey")
    if not integration_key:
        raise DominioValidationError("ATIVACAO_SEM_CHAVE", "A ativação não devolveu uma Integration Key.")

    integration.integration_key_encrypted = encrypt_secret(integration_key)
    integration.activation_key_encrypted = None  # não precisa mais dela (§12)
    integration.enabled = True
    integration.activated_at = datetime.utcnow()

    _audit(db, usuario_id, "DOMINIO_ATIVAR_INTEGRACAO", f"cliente:{cliente_id}")
    await db.commit()
    await db.refresh(integration)
    return integration


async def disable_integration(db: AsyncSession, cliente_id: UUID, usuario_id) -> None:
    integration = await _get_integration(db, cliente_id)
    if integration is None:
        return
    await db.delete(integration)
    _audit(db, usuario_id, "DOMINIO_DESATIVAR_INTEGRACAO", f"cliente:{cliente_id}")
    await db.commit()


async def upsert_employee_profile(
    db: AsyncSession,
    cliente_id: UUID,
    employee_id: str,
    *,
    cpf: str | None,
    esocial_category_code: int | None,
    admission_date,
    esocial_code: str | None,
    usuario_id,
) -> DominioEmployeeProfile:
    profile = await db.scalar(
        select(DominioEmployeeProfile).where(
            DominioEmployeeProfile.cliente_id == cliente_id,
            DominioEmployeeProfile.employee_id == employee_id,
        )
    )
    if profile is None:
        profile = DominioEmployeeProfile(cliente_id=cliente_id, employee_id=employee_id)
        db.add(profile)

    if cpf is not None:
        digits = _only_digits(cpf)
        if len(digits) != 11:
            raise DominioValidationError("CPF_INVALIDO", "CPF precisa ter 11 dígitos.")
        profile.cpf_encrypted = encrypt_secret(digits)
        profile.cpf_masked = mask_cpf(digits)
    if esocial_category_code is not None:
        profile.esocial_category_code = esocial_category_code
    if admission_date is not None:
        profile.admission_date = admission_date
    if esocial_code is not None:
        profile.esocial_code = esocial_code

    _audit(db, usuario_id, "DOMINIO_ATUALIZAR_PERFIL_COLABORADOR", f"cliente:{cliente_id}/colaborador:{employee_id}")
    await db.commit()
    await db.refresh(profile)
    return profile


async def upsert_rubric_mapping(
    db: AsyncSession,
    cliente_id: UUID,
    internal_event_type: str,
    *,
    payslip_item_code: int,
    unit: str,
    description: str | None,
    enabled: bool,
    usuario_id,
) -> DominioRubricMapping:
    mapping = await db.scalar(
        select(DominioRubricMapping).where(
            DominioRubricMapping.cliente_id == cliente_id,
            DominioRubricMapping.internal_event_type == internal_event_type,
        )
    )
    if mapping is None:
        mapping = DominioRubricMapping(cliente_id=cliente_id, internal_event_type=internal_event_type)
        db.add(mapping)

    mapping.payslip_item_code = payslip_item_code
    mapping.unit = unit
    mapping.description = description
    mapping.enabled = enabled

    _audit(db, usuario_id, "DOMINIO_CONFIGURAR_RUBRICA", f"cliente:{cliente_id}/{internal_event_type}")
    await db.commit()
    await db.refresh(mapping)
    return mapping


async def create_export(db: AsyncSession, cliente_id: UUID, competence, usuario_id) -> DominioExport:
    existente = await db.scalar(
        select(DominioExport).where(
            DominioExport.cliente_id == cliente_id,
            DominioExport.competence == competence,
            DominioExport.status.notin_([DominioExportStatus.CANCELLED.value, DominioExportStatus.FAILED.value]),
        )
    )
    if existente is not None:
        raise DominioValidationError(
            "ENVIO_JA_EXISTE",
            f"Já existe um export {existente.status} para esta competência (id={existente.id}).",
        )

    export = DominioExport(cliente_id=cliente_id, competence=competence, created_by=usuario_id, status=DominioExportStatus.DRAFT.value)
    db.add(export)
    _audit(db, usuario_id, "DOMINIO_CRIAR_EXPORT", f"cliente:{cliente_id}", {"competencia": str(competence)})
    await db.commit()
    await db.refresh(export)
    return export


async def build_preview(db: AsyncSession, export: DominioExport, events: list[PayrollEvent]) -> list[DominioExportItem]:
    """Gera (ou regenera) os itens de um export a partir dos eventos
    consolidados do Processar Ponto. Eventos sem rubrica mapeada ou sem
    dado obrigatório do colaborador viram item FAILED com o motivo — nunca
    são descartados silenciosamente, porque a prévia (§17) precisa mostrar
    "Sem rubrica" exatamente como o documento especifica."""

    mappings = {
        m.internal_event_type: m
        for m in (
            await db.scalars(
                select(DominioRubricMapping).where(
                    DominioRubricMapping.cliente_id == export.cliente_id,
                    DominioRubricMapping.enabled.is_(True),
                )
            )
        ).all()
    }
    integration = await _get_integration(db, export.cliente_id)
    hours_format = integration.hours_format if integration else None

    itens: list[DominioExportItem] = []
    for event in events:
        if event.amount_minutes == 0 and event.amount_days in (None, Decimal(0)) and event.amount_value in (None, Decimal(0)):
            continue  # valores zero não são enviados (§5.1)

        profile = await db.scalar(
            select(DominioEmployeeProfile).where(
                DominioEmployeeProfile.cliente_id == export.cliente_id,
                DominioEmployeeProfile.employee_id == event.employee_id,
            )
        )
        item = DominioExportItem(
            export_id=export.id,
            employee_id=event.employee_id,
            internal_event_type=event.event_type,
            cpf_masked=mask_cpf(event.employee_cpf) if event.employee_cpf else None,
            payslip_item_code=0,
            reference=Decimal(0),
            status=DominioExportItemStatus.PENDING.value,
        )

        mapping = mappings.get(event.event_type)
        if mapping is None:
            item.status = DominioExportItemStatus.FAILED.value
            item.error_code = "RUBRICA_SEM_MAPA"
            item.error_message = f"Nenhuma rubrica mapeada para {event.event_type} nesta empresa."
            itens.append(item)
            continue

        if profile is None or not profile.cpf_encrypted or not profile.esocial_category_code or not profile.admission_date:
            item.status = DominioExportItemStatus.FAILED.value
            item.error_code = "DADOS_COLABORADOR_INCOMPLETOS"
            item.error_message = "CPF, categoria eSocial ou admissão ausentes para este colaborador."
            itens.append(item)
            continue

        try:
            reference = compute_reference(event, mapping.unit, hours_format)
        except ValueError as exc:
            item.status = DominioExportItemStatus.FAILED.value
            item.error_code = "CONVERSAO_INVALIDA"
            item.error_message = str(exc)
            itens.append(item)
            continue

        cpf = decrypt_secret(profile.cpf_encrypted)
        fingerprint = compute_fingerprint(
            cliente_id=str(export.cliente_id),
            cpf=cpf,
            admission_date=profile.admission_date,
            esocial_category_code=profile.esocial_category_code,
            competence=event.competence,
            payslip_item_code=mapping.payslip_item_code,
            reference=reference,
            operation_type="INSERT",
        )
        ja_enviado = await db.scalar(
            select(DominioExportItem).where(
                DominioExportItem.request_fingerprint == fingerprint,
                DominioExportItem.status == DominioExportItemStatus.SUCCESS.value,
            )
        )

        item.payslip_item_code = mapping.payslip_item_code
        item.reference = reference
        item.request_fingerprint = fingerprint
        item.missed_days = event.missed_days or None
        if ja_enviado is not None:
            item.status = DominioExportItemStatus.FAILED.value
            item.error_code = "JA_ENVIADO"
            item.error_message = "Já enviado ao Domínio."
        itens.append(item)

    for item in itens:
        db.add(item)
    export.total_items = len(itens)
    export.status = DominioExportStatus.READY.value if any(
        i.status == DominioExportItemStatus.PENDING.value for i in itens
    ) else DominioExportStatus.DRAFT.value

    await db.commit()
    for item in itens:
        await db.refresh(item)
    return itens


async def send_export(db: AsyncSession, export: DominioExport, usuario_id) -> DominioExport:
    if export.status != DominioExportStatus.READY.value:
        raise DominioValidationError("EXPORT_NAO_PRONTO", f"Export está {export.status}, não READY.")

    integration = await _get_integration(db, export.cliente_id)
    if integration is None or not integration.enabled or not integration.integration_key_encrypted:
        raise DominioValidationError("INTEGRACAO_DESATIVADA", "Integração com o Domínio não está ativa para esta empresa.")

    integration_key = decrypt_secret(integration.integration_key_encrypted)
    client = DominioApiClient(integration_key=integration_key)

    itens_pendentes = (
        await db.scalars(
            select(DominioExportItem).where(
                DominioExportItem.export_id == export.id,
                DominioExportItem.status == DominioExportItemStatus.PENDING.value,
            )
        )
    ).all()

    export.status = DominioExportStatus.SENDING.value
    export.started_at = datetime.utcnow()
    await db.commit()

    sucesso = 0
    falha = 0
    for item in itens_pendentes:
        profile = await db.scalar(
            select(DominioEmployeeProfile).where(
                DominioEmployeeProfile.cliente_id == export.cliente_id,
                DominioEmployeeProfile.employee_id == item.employee_id,
            )
        )
        cpf = decrypt_secret(profile.cpf_encrypted)
        payload = build_payslip_item_request(
            cpf=cpf,
            esocial_category_code=profile.esocial_category_code,
            admission_date=profile.admission_date,
            competence=export.competence,
            payslip_item_code=item.payslip_item_code,
            reference=item.reference,
            operation_type=item.operation_type,
            missed_days=item.missed_days,
            esocial_code=profile.esocial_code,
        )
        item.attempt_count += 1
        item.status = DominioExportItemStatus.SENDING.value
        try:
            await client.send_payslip_item(payload)
            item.status = DominioExportItemStatus.SUCCESS.value
            item.http_status = 200
            item.sent_at = datetime.utcnow()
            sucesso += 1
        except DominioApiError as exc:
            item.status = DominioExportItemStatus.FAILED.value
            item.http_status = exc.status_code
            item.error_code = str(exc.status_code)
            item.error_message = exc.body[:500]
            falha += 1

    export.success_items = sucesso
    export.failed_items = falha
    export.finished_at = datetime.utcnow()
    if falha == 0:
        export.status = DominioExportStatus.SUCCESS.value
    elif sucesso == 0:
        export.status = DominioExportStatus.FAILED.value
    else:
        export.status = DominioExportStatus.PARTIAL.value

    _audit(
        db, usuario_id, "DOMINIO_ENVIAR_EXPORT", f"export:{export.id}",
        {"sucesso": sucesso, "falha": falha, "status": export.status},
    )
    await db.commit()
    await db.refresh(export)
    return export
