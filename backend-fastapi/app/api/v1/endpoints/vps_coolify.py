"""Monitoramento da VPS — Fase 2: Coolify API (somente leitura).

O Coolify orquestra todos os deploys da VPS (CRM + satélites). Aqui o backend
do CRM consulta, com token server-side, o que está em deploy agora e o
inventário de aplicações/serviços — é a camada que explica os picos de CPU
("que deploy está rodando") e casa com o painel de Containers.

Preferir o endereço interno (`http://coolify:8000/api/v1`, mesma VPS) pra
evitar allowlist de IP. Vazio (`COOLIFY_API_TOKEN`) → 503.

Escrita (redeploy, cancelar build) é Fase 4.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.core.security import require_setores
from app.models.user import Usuario

router = APIRouter()
logger = logging.getLogger(__name__)

_ti_user = Depends(require_setores(["TI"]))
_cache: TTLCache[str, Any] = TTLCache(maxsize=32, ttl=30)


def _require_configured() -> None:
    if not settings.COOLIFY_API_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Coolify não configurado (COOLIFY_API_TOKEN ausente).",
        )


async def _coolify_get(path: str, *, cache_key: str | None = None) -> Any:
    _require_configured()
    if cache_key and cache_key in _cache:
        return _cache[cache_key]
    url = f"{settings.COOLIFY_API_URL}{path}"
    headers = {
        "Authorization": f"Bearer {settings.COOLIFY_API_TOKEN}",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
    except httpx.HTTPError as e:
        logger.warning("vps-coolify: falha ao chamar %s: %s", path, e)
        raise HTTPException(status_code=502, detail="Não foi possível contatar o Coolify.")
    if resp.status_code in (401, 403):
        raise HTTPException(status_code=502, detail="Token do Coolify inválido ou sem permissão.")
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Recurso não encontrado no Coolify.")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Coolify respondeu {resp.status_code}.")
    try:
        data = resp.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Resposta inesperada do Coolify.")
    if cache_key:
        _cache[cache_key] = data
    return data


def _app_view(a: dict[str, Any]) -> dict[str, Any]:
    return {
        "uuid": a.get("uuid"),
        "name": a.get("name"),
        "status": (a.get("status") or "").split(":")[0] or None,  # "running:healthy" → "running"
        "fqdn": a.get("fqdn"),
        "gitRepository": a.get("git_repository"),
        "gitBranch": a.get("git_branch"),
        "lastOnlineAt": a.get("last_online_at"),
        "updatedAt": a.get("updated_at"),
    }


def _deployment_view(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "uuid": d.get("deployment_uuid") or d.get("uuid"),
        "application": d.get("application_name") or d.get("name"),
        "applicationUuid": d.get("application_uuid"),
        "status": d.get("status"),
        "commit": (d.get("commit") or "")[:8] or None,
        "commitMessage": d.get("commit_message"),
        "isWebhook": d.get("is_webhook"),
        "createdAt": d.get("created_at"),
        "finishedAt": d.get("finished_at"),
    }


@router.get("/deploys")
async def get_deploys(_: Usuario = _ti_user) -> Any:
    """Deploys em andamento + inventário de aplicações do time."""
    running, apps, services = await asyncio.gather(
        _coolify_get("/deployments", cache_key="deployments"),
        _coolify_get("/applications", cache_key="applications"),
        _coolify_get("/services", cache_key="services"),
        return_exceptions=True,
    )

    running_list = [_deployment_view(d) for d in running] if isinstance(running, list) else []
    apps_list = [_app_view(a) for a in apps] if isinstance(apps, list) else []
    services_list = (
        [{"uuid": s.get("uuid"), "name": s.get("name"), "status": (s.get("status") or "").split(":")[0] or None}
         for s in services]
        if isinstance(services, list) else []
    )

    def bad(status: str | None) -> bool:
        return bool(status) and status not in ("running", "exited:0")

    return {
        "running": running_list,
        "applications": apps_list,
        "services": services_list,
        "counts": {
            "deploying": len(running_list),
            "applications": len(apps_list),
            "appsDegraded": sum(1 for a in apps_list if bad(a["status"])),
            "servicesDegraded": sum(1 for s in services_list if bad(s["status"])),
        },
    }


@router.get("/deploys/{uuid}")
async def get_deploy(uuid: str, _: Usuario = _ti_user) -> Any:
    """Detalhe + logs de uma execução de deploy."""
    d = await _coolify_get(f"/deployments/{uuid}")
    view = _deployment_view(d if isinstance(d, dict) else {})
    logs = d.get("logs") if isinstance(d, dict) else None
    # `logs` costuma vir como string JSON de uma lista {output, type, timestamp}.
    view["logs"] = logs
    return view
