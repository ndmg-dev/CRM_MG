"""Monitoramento da VPS Hostinger — Fase 1 (leitura, risco zero).

O backend do CRM roda NESTA MESMA VPS (`srv1424388.hstgr.cloud`). Esta camada
expõe, pra aba Tecnologia (TI), um dashboard read-only da própria infra:
estado da VM, séries históricas (CPU/RAM/disco/tráfego), snapshot, backups,
firewall, histórico de ações e o scan de malware (Monarx).

Regras de ouro:
- O frontend NUNCA fala com a Hostinger direto. Só com estes endpoints.
- O `HOSTINGER_API_TOKEN` é injetado aqui, server-side, e nunca vai pro browser.
- Rate limit da Hostinger é 90 req/min por IP → TODA chamada passa por um
  cache TTL curto (45s) em memória do processo. Uma VM só, um dashboard com
  auto-refresh: 45s cobre sem chegar perto do teto.
- A série da Hostinger vem como `{unit, usage: {<epoch>: valor}}`; convertemos
  pro formato que o recharts consome (`[{t, cpu, ramPct, ...}]`) aqui, pra o
  frontend não recalcular nem lidar com bytes/epoch.

Fase 1 é 100% leitura — nenhum endpoint de escrita. Ações (restart/snapshot/
redeploy) entram na Fase 4, atrás de `require_roles(['admin'])` + confirmação
digitada + `audit_log`.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import Usuario

router = APIRouter()

# TTL curto: protege o rate limit da Hostinger (90/min por IP) sem deixar o
# dashboard obviamente defasado. maxsize folgado — são ~8 chaves distintas.
_cache: TTLCache[str, Any] = TTLCache(maxsize=64, ttl=45)
_cache_lock = asyncio.Lock()

_RANGES = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


def _require_configured() -> None:
    if not settings.HOSTINGER_API_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Monitoramento da VPS não configurado (HOSTINGER_API_TOKEN ausente).",
        )


async def _hostinger_get(path: str, params: dict[str, Any] | None = None) -> Any:
    """GET na Hostinger API com cache TTL compartilhado e token server-side."""
    _require_configured()
    key = path + "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))

    async with _cache_lock:
        if key in _cache:
            return _cache[key]

        url = f"{settings.HOSTINGER_API_URL}{path}"
        headers = {
            "Authorization": f"Bearer {settings.HOSTINGER_API_TOKEN}",
            "Accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=params, headers=headers)
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Não foi possível contatar a API da Hostinger.")

        if resp.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Rate limit da Hostinger atingido. Tente novamente em instantes.",
                headers={"Retry-After": resp.headers.get("Retry-After", "60")},
            )
        if resp.status_code == 401:
            raise HTTPException(status_code=502, detail="Token da Hostinger inválido ou expirado.")
        if resp.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Hostinger respondeu {resp.status_code}.")

        data = resp.json()
        _cache[key] = data
        return data


def _vm_path(suffix: str = "") -> str:
    return f"/virtual-machines/{settings.HOSTINGER_VPS_ID}{suffix}"


# --------------------------------------------------------------------------- #
# Transformações                                                              #
# --------------------------------------------------------------------------- #
def _mb_to_bytes(mb: float | int | None) -> int | None:
    return int(mb) * 1024 * 1024 if mb else None


def _series_to_recharts(metrics: dict[str, Any], mem_bytes: int | None, disk_bytes: int | None) -> list[dict[str, Any]]:
    """`{metric: {unit, usage: {epoch: v}}}` → `[{t, iso, cpu, ram, ramPct, ...}]`.

    Os timestamps das métricas vêm alinhados; usamos os de `cpu_usage` como
    eixo e buscamos os demais por chave, tolerando ausência.
    """
    def usage(name: str) -> dict[str, float]:
        return (metrics.get(name) or {}).get("usage") or {}

    cpu = usage("cpu_usage")
    ram = usage("ram_usage")
    disk = usage("disk_space")
    net_in = usage("incoming_traffic")
    net_out = usage("outgoing_traffic")
    uptime = usage("uptime")

    epochs = sorted(cpu.keys() or ram.keys() or disk.keys(), key=lambda e: int(e))
    out: list[dict[str, Any]] = []
    for e in epochs:
        ram_b = ram.get(e)
        disk_b = disk.get(e)
        out.append(
            {
                "t": int(e) * 1000,
                "iso": datetime.fromtimestamp(int(e), tz=timezone.utc).isoformat(),
                "cpu": round(cpu[e], 1) if e in cpu else None,
                "ram": ram_b,
                "ramPct": round(ram_b / mem_bytes * 100, 1) if ram_b and mem_bytes else None,
                "disk": disk_b,
                "diskPct": round(disk_b / disk_bytes * 100, 1) if disk_b and disk_bytes else None,
                "netIn": net_in.get(e),
                "netOut": net_out.get(e),
                "uptime": uptime.get(e),
            }
        )
    return out


def _snapshot_view(raw: dict[str, Any]) -> dict[str, Any]:
    # A Hostinger devolve `{id: 0, created_at == expires_at}` quando não há
    # snapshot manual — normalizamos pra um shape explícito.
    if not raw or not raw.get("id"):
        return {"exists": False}
    return {
        "exists": True,
        "id": raw.get("id"),
        "createdAt": raw.get("created_at"),
        "expiresAt": raw.get("expires_at"),
        "restoreTime": raw.get("restore_time"),
    }


# --------------------------------------------------------------------------- #
# Endpoints                                                                   #
# --------------------------------------------------------------------------- #
@router.get("/vm")
async def get_vm(_: Usuario = Depends(get_current_user)) -> Any:
    """Detalhes da VM: state, plano, specs, IPs, firewall_group_id, actions_lock."""
    vms = await _hostinger_get("/virtual-machines")
    vm = next((v for v in vms if v.get("id") == settings.HOSTINGER_VPS_ID), None)
    if not vm:
        raise HTTPException(status_code=404, detail="VPS não encontrada na conta Hostinger.")
    return vm


@router.get("/metrics")
async def get_metrics(
    range: str = Query("24h", pattern="^(24h|7d|30d)$"),
    _: Usuario = Depends(get_current_user),
) -> Any:
    """Série temporal já no formato do recharts, para a janela pedida."""
    delta = _RANGES[range]
    now = datetime.now(tz=timezone.utc)
    params = {
        "date_from": (now - delta).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "date_to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    raw_metrics, vms = await asyncio.gather(
        _hostinger_get(_vm_path("/metrics"), params),
        _hostinger_get("/virtual-machines"),
    )
    vm = next((v for v in vms if v.get("id") == settings.HOSTINGER_VPS_ID), {})
    mem_bytes = _mb_to_bytes(vm.get("memory"))
    disk_bytes = _mb_to_bytes(vm.get("disk"))
    return {
        "range": range,
        "memBytes": mem_bytes,
        "diskBytes": disk_bytes,
        "bandwidthBytes": _mb_to_bytes(vm.get("bandwidth")),
        "points": _series_to_recharts(raw_metrics, mem_bytes, disk_bytes),
    }


@router.get("/snapshot")
async def get_snapshot(_: Usuario = Depends(get_current_user)) -> Any:
    try:
        raw = await _hostinger_get(_vm_path("/snapshot"))
    except HTTPException as exc:
        if exc.status_code == 502:
            return {"exists": False}
        raise
    return _snapshot_view(raw)


@router.get("/backups")
async def get_backups(_: Usuario = Depends(get_current_user)) -> Any:
    data = await _hostinger_get(_vm_path("/backups"))
    return data


@router.get("/actions")
async def get_actions(
    page: int = Query(1, ge=1),
    _: Usuario = Depends(get_current_user),
) -> Any:
    """Histórico de ações da própria Hostinger (trilha de auditoria)."""
    return await _hostinger_get(_vm_path("/actions"), {"page": page})


@router.get("/firewall")
async def get_firewall(_: Usuario = Depends(get_current_user)) -> Any:
    return await _hostinger_get("/firewall")


@router.get("/monarx")
async def get_monarx(_: Usuario = Depends(get_current_user)) -> Any:
    """Scan de malware (o "Detector de malware: Ativo" do hPanel)."""
    return await _hostinger_get(_vm_path("/monarx"))


@router.get("/overview")
async def get_overview(_: Usuario = Depends(get_current_user)) -> Any:
    """Agregado da tela Visão Geral — uma chamada, várias fontes.

    Falhas parciais não derrubam o painel inteiro: cada bloco vira `None` e o
    frontend degrada graciosamente.
    """
    now = datetime.now(tz=timezone.utc)
    metrics_params = {
        "date_from": (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "date_to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    results = await asyncio.gather(
        _hostinger_get("/virtual-machines"),
        _hostinger_get(_vm_path("/metrics"), metrics_params),
        _hostinger_get(_vm_path("/snapshot")),
        _hostinger_get(_vm_path("/backups")),
        _hostinger_get(_vm_path("/monarx")),
        return_exceptions=True,
    )
    vms, raw_metrics, snapshot, backups, monarx = results

    vm = None
    if isinstance(vms, list):
        vm = next((v for v in vms if v.get("id") == settings.HOSTINGER_VPS_ID), None)

    mem_bytes = _mb_to_bytes(vm.get("memory")) if vm else None
    disk_bytes = _mb_to_bytes(vm.get("disk")) if vm else None

    points: list[dict[str, Any]] = []
    if isinstance(raw_metrics, dict):
        points = _series_to_recharts(raw_metrics, mem_bytes, disk_bytes)
    latest = points[-1] if points else None

    backups_list = backups.get("data", []) if isinstance(backups, dict) else []

    return {
        "generatedAt": now.isoformat(),
        "vm": vm,
        "memBytes": mem_bytes,
        "diskBytes": disk_bytes,
        "bandwidthBytes": _mb_to_bytes(vm.get("bandwidth")) if vm else None,
        "latest": latest,
        "spark24h": points,
        "snapshot": _snapshot_view(snapshot) if isinstance(snapshot, dict) else {"exists": False},
        "backupsCount": len(backups_list),
        "lastBackupAt": backups_list[0]["created_at"] if backups_list else None,
        "monarx": monarx if isinstance(monarx, dict) else None,
    }


@router.get("/_meta")
async def get_meta(_: Usuario = Depends(get_current_user)) -> Any:
    """Diagnóstico leve do próprio proxy (não bate na Hostinger)."""
    return {
        "configured": bool(settings.HOSTINGER_API_TOKEN),
        "vpsId": settings.HOSTINGER_VPS_ID,
        "cacheTtlSeconds": _cache.ttl,
        "cachedKeys": len(_cache),
        "now": time.time(),
    }
