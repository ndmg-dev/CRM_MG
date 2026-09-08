"""Monitoramento da VPS — Fase 2: coletores read-only na própria VPS.

O backend do CRM roda NESTA VPS. Aqui ele raspa três serviços internos
(containers novos no docker-compose.yml da raiz, sem porta pública):

  - cadvisor            → CPU/mem por container (via cgroups, barato)
  - node-exporter       → load, memória, disco e inodes do host
  - docker-socket-proxy → `docker system df`, lista de containers com labels
                          do Coolify. Modo LEITURA (POST=0) — nenhum processo
                          do CRM toca o docker.sock direto.

Nada disto existe na Hostinger API (ver vps_monitor.py) — e o endpoint
`/docker` da Hostinger não funciona neste template de OS.

Tudo atrás de `require_setores(["TI"])`. Fase 2 é leitura; ações (prune,
restart de stack) são Fase 4.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any, Iterable

import httpx
from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.core.security import require_setores
from app.models.user import Usuario

router = APIRouter()
logger = logging.getLogger(__name__)

_ti_user = Depends(require_setores(["TI"]))

# Scrape é mais caro que a Hostinger (texto Prometheus grande) — cache um
# pouco maior. O dashboard atualiza a cada 60s.
_cache: TTLCache[str, Any] = TTLCache(maxsize=16, ttl=20)

# CPU do cadvisor é counter (segundos acumulados). Guardamos a leitura
# anterior por container pra derivar a taxa (igual `rate()` do PromQL).
_cpu_prev: dict[str, tuple[float, float]] = {}  # id -> (cpu_seconds_total, epoch)

_PROM_LINE = re.compile(r'^(?P<name>[a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(?P<labels>.*)\})?\s+(?P<value>[^\s]+)')
_PROM_LABEL = re.compile(r'([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"')


# --------------------------------------------------------------------------- #
# Infra: scrape + parser Prometheus                                           #
# --------------------------------------------------------------------------- #
def _require_enabled() -> None:
    if not settings.VPS_COLLECTORS_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Coletores da VPS desativados (VPS_COLLECTORS_ENABLED=false). "
            "Habilitar após subir cadvisor/node-exporter/docker-socket-proxy no Coolify.",
        )


async def _get(url: str, *, as_json: bool = False, cache_key: str | None = None) -> Any:
    if cache_key and cache_key in _cache:
        return _cache[cache_key]
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers={"Accept": "application/json"} if as_json else None)
    except httpx.HTTPError as e:
        logger.warning("vps-collectors: falha ao raspar %s: %s", url, e)
        raise HTTPException(status_code=502, detail=f"Coletor indisponível ({url.split('//')[-1].split('/')[0]}).")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Coletor respondeu {resp.status_code}.")
    out = resp.json() if as_json else resp.text
    if cache_key:
        _cache[cache_key] = out
    return out


class Sample:
    __slots__ = ("name", "labels", "value")

    def __init__(self, name: str, labels: dict[str, str], value: float) -> None:
        self.name = name
        self.labels = labels
        self.value = value


def _parse_prom(text: str) -> list[Sample]:
    out: list[Sample] = []
    for line in text.splitlines():
        if not line or line[0] == "#":
            continue
        m = _PROM_LINE.match(line)
        if not m:
            continue
        try:
            value = float(m.group("value"))
        except ValueError:
            continue
        labels = {k: v for k, v in _PROM_LABEL.findall(m.group("labels") or "")}
        out.append(Sample(m.group("name"), labels, value))
    return out


def _select(samples: Iterable[Sample], metric: str, **eq: str) -> list[Sample]:
    return [s for s in samples if s.name == metric and all(s.labels.get(k) == v for k, v in eq.items())]


def _one(samples: Iterable[Sample], metric: str, **eq: str) -> float | None:
    hits = _select(samples, metric, **eq)
    return hits[0].value if hits else None


# --------------------------------------------------------------------------- #
# Host (node-exporter)                                                        #
# --------------------------------------------------------------------------- #
@router.get("/host")
async def get_host(_: Usuario = _ti_user) -> Any:
    _require_enabled()
    text = await _get(f"{settings.VPS_NODE_EXPORTER_URL}/metrics", cache_key="node")
    s = _parse_prom(text)

    mem_total = _one(s, "node_memory_MemTotal_bytes")
    mem_avail = _one(s, "node_memory_MemAvailable_bytes")

    # Filesystem raiz (mountpoint "/").
    fs_size = _one(s, "node_filesystem_size_bytes", mountpoint="/")
    fs_avail = _one(s, "node_filesystem_avail_bytes", mountpoint="/")
    inodes = _one(s, "node_filesystem_files", mountpoint="/")
    inodes_free = _one(s, "node_filesystem_files_free", mountpoint="/")

    boot = _one(s, "node_boot_time_seconds")
    now = _one(s, "node_time_seconds") or time.time()
    ncpu = len(_select(s, "node_cpu_seconds_total", mode="idle")) or None

    def pct(used: float | None, total: float | None) -> float | None:
        if used is None or not total:
            return None
        return round(used / total * 100, 1)

    return {
        "loadAvg": {
            "1m": _one(s, "node_load1"),
            "5m": _one(s, "node_load5"),
            "15m": _one(s, "node_load15"),
        },
        "cpuCount": ncpu,
        "memory": {
            "totalBytes": mem_total,
            "usedBytes": (mem_total - mem_avail) if (mem_total and mem_avail is not None) else None,
            "pct": pct((mem_total - mem_avail) if (mem_total and mem_avail is not None) else None, mem_total),
        },
        "disk": {
            "totalBytes": fs_size,
            "usedBytes": (fs_size - fs_avail) if (fs_size and fs_avail is not None) else None,
            "pct": pct((fs_size - fs_avail) if (fs_size and fs_avail is not None) else None, fs_size),
            "inodesPct": pct((inodes - inodes_free) if (inodes and inodes_free is not None) else None, inodes),
        },
        "uptimeSeconds": (now - boot) if boot else None,
    }


# --------------------------------------------------------------------------- #
# Containers (cadvisor + docker-socket-proxy)                                  #
# --------------------------------------------------------------------------- #
def _coolify_meta(labels: dict[str, str]) -> dict[str, str | None]:
    return {
        "project": labels.get("coolify.projectName") or labels.get("coolify.name"),
        "service": labels.get("coolify.serviceName") or labels.get("coolify.serviceSubType"),
        "resource": labels.get("coolify.resourceName"),
    }


@router.get("/containers")
async def get_containers(_: Usuario = _ti_user) -> Any:
    _require_enabled()
    cadvisor_text, docker_list = await _gather_containers()
    samples = _parse_prom(cadvisor_text)
    now = time.time()

    # Índice cadvisor por nome de container (label nativo `name`).
    by_name: dict[str, list[Sample]] = {}
    for s in samples:
        n = s.labels.get("name")
        if n:
            by_name.setdefault(n, []).append(s)

    rows: list[dict[str, Any]] = []
    for c in docker_list:
        name = (c.get("Names") or ["?"])[0].lstrip("/")
        cs = by_name.get(name, [])
        labels = c.get("Labels") or {}

        cpu_total = _one(cs, "container_cpu_usage_seconds_total")
        cpu_pct = None
        if cpu_total is not None:
            prev = _cpu_prev.get(name)
            if prev and now > prev[1] and cpu_total >= prev[0]:
                cpu_pct = round((cpu_total - prev[0]) / (now - prev[1]) * 100, 1)
            _cpu_prev[name] = (cpu_total, now)

        mem = _one(cs, "container_memory_usage_bytes")
        mem_limit = _one(cs, "container_spec_memory_limit_bytes")
        # cadvisor usa 0 ou o total da máquina como "sem limite".
        if mem_limit and mem_limit > 1 << 50:
            mem_limit = None

        rows.append(
            {
                "name": name,
                "image": c.get("Image"),
                "state": c.get("State"),
                "status": c.get("Status"),
                "createdEpoch": c.get("Created"),
                "cpuPct": cpu_pct,
                "memBytes": mem,
                "memLimitBytes": mem_limit,
                "memPct": round(mem / mem_limit * 100, 1) if (mem and mem_limit) else None,
                **_coolify_meta(labels),
            }
        )

    # Limpa entradas de containers que sumiram.
    live = {r["name"] for r in rows}
    for gone in [k for k in _cpu_prev if k not in live]:
        _cpu_prev.pop(gone, None)

    rows.sort(key=lambda r: r["cpuPct"] or -1, reverse=True)
    running = sum(1 for r in rows if r["state"] == "running")
    return {
        "generatedAt": now,
        "hasCpuRates": any(r["cpuPct"] is not None for r in rows),
        "counts": {
            "total": len(rows),
            "running": running,
            "stopped": len(rows) - running,
            "unhealthy": sum(1 for r in rows if r["status"] and "unhealthy" in r["status"]),
        },
        "containers": rows,
    }


async def _gather_containers() -> tuple[str, list[dict[str, Any]]]:
    return await asyncio.gather(
        _get(f"{settings.VPS_CADVISOR_URL}/metrics", cache_key="cadvisor"),
        _get(f"{settings.VPS_DOCKER_PROXY_URL}/containers/json?all=true", as_json=True, cache_key="docker-ps"),
    )


# --------------------------------------------------------------------------- #
# Disco (docker system df + node-exporter)                                    #
# --------------------------------------------------------------------------- #
@router.get("/disk")
async def get_disk(_: Usuario = _ti_user) -> Any:
    _require_enabled()
    df, node_text = await asyncio.gather(
        _get(f"{settings.VPS_DOCKER_PROXY_URL}/system/df", as_json=True, cache_key="docker-df"),
        _get(f"{settings.VPS_NODE_EXPORTER_URL}/metrics", cache_key="node"),
    )
    s = _parse_prom(node_text)

    images = df.get("Images") or []
    containers = df.get("Containers") or []
    volumes = df.get("Volumes") or []
    build_cache = df.get("BuildCache") or []

    def total_size(items: list[dict], key: str = "Size") -> int:
        return sum(int(i.get(key) or 0) for i in items)

    # "Reclaimable": imagens não usadas por nenhum container, volumes órfãos,
    # todo o build cache.
    img_reclaimable = sum(int(i.get("Size") or 0) for i in images if not i.get("Containers"))
    vol_reclaimable = sum(int(v.get("UsageData", {}).get("Size") or 0) for v in volumes if (v.get("UsageData") or {}).get("RefCount", 0) == 0)
    bc_total = total_size(build_cache)

    fs_size = _one(s, "node_filesystem_size_bytes", mountpoint="/")
    fs_avail = _one(s, "node_filesystem_avail_bytes", mountpoint="/")

    docker_total = total_size(images, "Size") + total_size(containers, "SizeRw") + sum(
        int((v.get("UsageData") or {}).get("Size") or 0) for v in volumes
    ) + bc_total
    reclaimable_total = img_reclaimable + vol_reclaimable + bc_total

    return {
        "filesystem": {
            "totalBytes": fs_size,
            "usedBytes": (fs_size - fs_avail) if (fs_size and fs_avail is not None) else None,
            "availBytes": fs_avail,
            "pct": round((fs_size - fs_avail) / fs_size * 100, 1) if (fs_size and fs_avail is not None) else None,
        },
        "docker": {
            "totalBytes": docker_total,
            "reclaimableBytes": reclaimable_total,
            "images": {"count": len(images), "sizeBytes": total_size(images, "Size"), "reclaimableBytes": img_reclaimable,
                       "dangling": sum(1 for i in images if (i.get("RepoTags") in ([], ["<none>:<none>"], None))) },
            "containers": {"count": len(containers), "sizeBytes": total_size(containers, "SizeRw")},
            "volumes": {"count": len(volumes),
                        "sizeBytes": sum(int((v.get("UsageData") or {}).get("Size") or 0) for v in volumes),
                        "reclaimableBytes": vol_reclaimable},
            "buildCache": {"count": len(build_cache), "sizeBytes": bc_total},
        },
    }
