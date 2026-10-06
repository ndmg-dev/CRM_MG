"""Integração Processar Ponto -> Domínio Folha (Onvio API). Toda
comunicação com a Thomson Reuters acontece aqui no backend — o frontend
nunca vê client_secret, access token, nem as chaves de integração
(INTEGRACAO_DOMINIO_FOLHA_API.md, regra 7)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user, require_setores
from app.db.session import get_db
from app.integrations.dominio import service
from app.integrations.dominio.exceptions import DominioApiError
from app.models.dominio_employee_profile import DominioEmployeeProfile
from app.models.dominio_export import DominioExport
from app.models.dominio_export_item import DominioExportItem
from app.models.dominio_integration import DominioIntegration
from app.models.dominio_rubric_mapping import DominioRubricMapping
from app.models.user import Usuario
from app.schemas.dominio import (
    CreateExportRequest,
    DominioIntegrationResponse,
    EmployeeProfileResponse,
    EmployeeProfileUpsert,
    ExportResponse,
    PreviewExportRequest,
    RubricMappingResponse,
    RubricMappingUpsert,
    SetHoursFormatRequest,
    ValidateActivationKeyRequest,
)

router = APIRouter()

# Papel exigido para tudo que toca configuração/envio de folha. Analista de
# DP ou ADMIN (allow_admin=True por padrão em require_setores).
_require_dp = require_setores(["DP"])


def _require_feature_enabled():
    if not settings.DOMINIO_API_ENABLED and not settings.DOMINIO_API_MOCK:
        raise HTTPException(
            status_code=503,
            detail="Integração com o Domínio desativada (DOMINIO_API_ENABLED=false).",
        )


async def _get_or_404(db: AsyncSession, cliente_id: UUID) -> DominioIntegration:
    integration = await db.scalar(select(DominioIntegration).where(DominioIntegration.cliente_id == cliente_id))
    if integration is None:
        raise HTTPException(status_code=404, detail="Integração não configurada para esta empresa.")
    return integration


# --- Integração -------------------------------------------------------------

@router.get("/clientes/{cliente_id}/integracao", response_model=DominioIntegrationResponse)
async def get_integration(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return await _get_or_404(db, cliente_id)


@router.post("/clientes/{cliente_id}/integracao/validar-chave", response_model=DominioIntegrationResponse)
async def validate_activation_key(
    cliente_id: UUID,
    body: ValidateActivationKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(_require_dp),
):
    _require_feature_enabled()
    try:
        return await service.validate_activation_key(db, cliente_id, body.activation_key, current_user.id)
    except DominioApiError as exc:
        raise HTTPException(status_code=422, detail={"code": "ONVIO_API_ERRO", "message": exc.body[:300]})


@router.post("/clientes/{cliente_id}/integracao/ativar", response_model=DominioIntegrationResponse)
async def enable_integration(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(_require_dp),
):
    _require_feature_enabled()
    try:
        return await service.enable_integration(db, cliente_id, current_user.id)
    except service.DominioValidationError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message})
    except DominioApiError as exc:
        raise HTTPException(status_code=422, detail={"code": "ONVIO_API_ERRO", "message": exc.body[:300]})


@router.delete("/clientes/{cliente_id}/integracao")
async def delete_integration(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_setores(["DP"], allow_admin=True)),
):
    await service.disable_integration(db, cliente_id, current_user.id)
    return {"status": "ok"}


@router.put("/clientes/{cliente_id}/integracao/formato-horas", response_model=DominioIntegrationResponse)
async def set_hours_format(
    cliente_id: UUID,
    body: SetHoursFormatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(_require_dp),
):
    integration = await _get_or_404(db, cliente_id)
    integration.hours_format = body.hours_format
    await db.commit()
    await db.refresh(integration)
    return integration


# --- Rubricas -----------------------------------------------------------

@router.get("/clientes/{cliente_id}/rubricas", response_model=list[RubricMappingResponse])
async def list_rubrics(
    cliente_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    rows = await db.scalars(select(DominioRubricMapping).where(DominioRubricMapping.cliente_id == cliente_id))
    return rows.all()


@router.put("/clientes/{cliente_id}/rubricas", response_model=RubricMappingResponse)
async def upsert_rubric(
    cliente_id: UUID,
    body: RubricMappingUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(_require_dp),
):
    return await service.upsert_rubric_mapping(
        db,
        cliente_id,
        body.internal_event_type,
        payslip_item_code=body.payslip_item_code,
        unit=body.unit,
        description=body.description,
        enabled=body.enabled,
        usuario_id=current_user.id,
    )


# --- Perfil do colaborador --------------------------------------------------

@router.get("/clientes/{cliente_id}/colaboradores/{employee_id}", response_model=EmployeeProfileResponse)
async def get_employee_profile(
    cliente_id: UUID,
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    profile = await db.scalar(
        select(DominioEmployeeProfile).where(
            DominioEmployeeProfile.cliente_id == cliente_id,
            DominioEmployeeProfile.employee_id == employee_id,
        )
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Colaborador sem cadastro complementar para o Domínio.")
    return profile


@router.put("/clientes/{cliente_id}/colaboradores", response_model=EmployeeProfileResponse)
async def upsert_employee_profile(
    cliente_id: UUID,
    body: EmployeeProfileUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(_require_dp),
):
    try:
        return await service.upsert_employee_profile(
            db,
            cliente_id,
            body.employee_id,
            cpf=body.cpf,
            esocial_category_code=body.esocial_category_code,
            admission_date=body.admission_date,
            esocial_code=body.esocial_code,
            usuario_id=current_user.id,
        )
    except service.DominioValidationError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message})


# --- Exports ---------------------------------------------------------------

@router.post("/clientes/{cliente_id}/exports", response_model=ExportResponse)
async def create_export(
    cliente_id: UUID,
    body: CreateExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(_require_dp),
):
    try:
        export = await service.create_export(db, cliente_id, body.competence, current_user.id)
    except service.DominioValidationError as exc:
        raise HTTPException(status_code=409, detail={"code": exc.code, "message": exc.message})
    export.items = []
    return export


@router.post("/exports/{export_id}/preview", response_model=ExportResponse)
async def preview_export(
    export_id: UUID,
    body: PreviewExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(_require_dp),
):
    export = await db.get(DominioExport, export_id)
    if export is None:
        raise HTTPException(status_code=404, detail="Export não encontrado.")
    items = await service.build_preview(db, export, body.events)
    export.items = items
    return export


@router.get("/exports/{export_id}", response_model=ExportResponse)
async def get_export(
    export_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    export = await db.get(DominioExport, export_id)
    if export is None:
        raise HTTPException(status_code=404, detail="Export não encontrado.")
    items = (await db.scalars(select(DominioExportItem).where(DominioExportItem.export_id == export_id))).all()
    export.items = items
    return export


@router.post("/exports/{export_id}/enviar", response_model=ExportResponse)
async def send_export(
    export_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_setores(["DP"], allow_admin=True)),
):
    _require_feature_enabled()
    export = await db.get(DominioExport, export_id)
    if export is None:
        raise HTTPException(status_code=404, detail="Export não encontrado.")
    try:
        export = await service.send_export(db, export, current_user.id)
    except service.DominioValidationError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message})
    items = (await db.scalars(select(DominioExportItem).where(DominioExportItem.export_id == export_id))).all()
    export.items = items
    return export
