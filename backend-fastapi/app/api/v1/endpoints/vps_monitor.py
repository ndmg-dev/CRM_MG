"""Monitoramento da VPS Hostinger — Fase 1 (leitura, risco zero).

O backend do CRM roda NESTA MESMA VPS (`srv1424388.hstgr.cloud`). Esta camada
expõe, pra aba Tecnologia (TI), um dashboard read-only da própria infra:
estado da VM, séries históricas (CPU/RAM/disco/tráfego), snapshot, backups,
firewall, histórico de ações, scan de malware (Monarx) e insights derivados.

Regras de ouro:
- O frontend NUNCA fala com a Hostinger direto. Só com estes endpoints.
- O `HOSTINGER_API_TOKEN` é injetado aqui, server-side, e nunca vai pro browser.
- Rate limit da Hostinger é 90 req/min por IP → TODA chamada passa por um
  cache TTL curto (45s). Erros também são cacheados por ~10s (negative
  caching) pra não martelar a Hostinger durante uma queda dela.
- Acesso restrito ao setor de TI (+ ADMIN) — `require_setores(["TI"])`.
- A série da Hostinger vem como `{unit, usage: {<epoch>: valor}}`; convertemos
  pro formato que o recharts consome (`[{t, cpu, ramPct, ...}]`) aqui.

Fase 1 é 100% leitura — nenhum endpoint de escrita. Ações (restart/snapshot/
redeploy) entram na Fase 4, atrás de `require_roles(['ADMIN'])` + confirmação
digitada + `audit_log`.
"""

from __future__ import annotations

import asyncio
import calendar
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import require_setores
from app.db.session import get_db
from app.models.user import Usuario

router = APIRouter()
logger = logging.getLogger(__name__)

# Só o setor de TI (e ADMIN) enxerga o monitoramento da VPS.
_ti_user = Depends(require_setores(["TI"]))

# TTL curto: protege o rate limit da Hostinger (90/min por IP) sem deixar o
# dashboard obviamente defasado. maxsize folgado — são ~9 chaves distintas.
_cache: TTLCache[str, Any] = TTLCache(maxsize=64, ttl=45)
# Negative cache: uma falha da Hostinger fica "grudada" 10s, então um painel
# com auto-refresh não re-tenta a cada request enquanto a Hostinger está fora.
_error_cache: TTLCache[str, HTTPException] = TTLCache(maxsize=64, ttl=10)
# Um lock POR CHAVE: chaves distintas resolvem em paralelo (o asyncio.gather
# do /overview realmente concorre); a mesma chave é deduplicada (o 2º a
# chegar espera e pega o cache quente). O lock NUNCA envolve o I/O de chaves
# diferentes — era esse o gargalo da 1ª versão. TTLCache pra não vazar locks:
# um lock ocioso >2min é descartado (nenhum fetch dura tanto — o timeout é 15s).
_key_locks: TTLCache[str, asyncio.Lock] = TTLCache(maxsize=256, ttl=120)


def _lock_for(key: str) -> asyncio.Lock:
    lock = _key_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _key_locks[key] = lock
    return lock

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


def _cache_key(path: str, params: dict[str, Any] | None) -> str:
    return path + "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))


def _metrics_params(delta: timedelta, now: datetime) -> dict[str, str]:
    """Janela date_from/date_to pra /metrics.

    `now` é truncado ao minuto: sem isso, cada request gera um date_to
    diferente (precisão de segundo) → a chave de cache muda toda vez e o
    TTLCache NUNCA acerta pra /metrics e /overview. A amostragem da Hostinger
    é de minutos, então perder até 59s de recência não custa nada.
    """
    now = now.replace(second=0, microsecond=0)
    return {
        "date_from": (now - delta).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "date_to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


async def _hostinger_get(path: str, params: dict[str, Any] | None = None) -> Any:
    """GET na Hostinger API com cache TTL (positivo e negativo) e token server-side.

    Levanta HTTPException com status já mapeado:
      - 404 → propaga 404 (o recurso não existe; ex.: VM sem snapshot)
      - 401/403 da Hostinger → 502 "token inválido / sem permissão"
      - 429 → 429 com Retry-After
      - resto → 502
    """
    _require_configured()
    key = _cache_key(path, params)

    if key in _cache:
        return _cache[key]

    async with _lock_for(key):
        # Re-checa dentro do lock: outra corrotina pode ter preenchido.
        if key in _cache:
            return _cache[key]
        if key in _error_cache:
            raise _error_cache[key]

        try:
            return await _fetch(path, params, key)
        except HTTPException as e:
            _error_cache[key] = e
            raise


async def _fetch(path: str, params: dict[str, Any] | None, key: str) -> Any:
    url = f"{settings.HOSTINGER_API_URL}{path}"
    headers = {
        "Authorization": f"Bearer {settings.HOSTINGER_API_TOKEN}",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params, headers=headers)
    except httpx.HTTPError as e:
        logger.warning("vps-monitor: falha de rede ao chamar Hostinger %s: %s", path, e)
        raise HTTPException(status_code=502, detail="Não foi possível contatar a API da Hostinger.")

    remaining = resp.headers.get("X-RateLimit-Remaining")
    if remaining is not None and remaining.isdigit() and int(remaining) < 20:
        logger.warning("vps-monitor: rate limit da Hostinger baixo (restam %s)", remaining)

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Recurso não encontrado na Hostinger.")
    if resp.status_code == 429:
        logger.warning("vps-monitor: rate limit da Hostinger atingido (%s)", path)
        raise HTTPException(
            status_code=429,
            detail="Rate limit da Hostinger atingido. Tente novamente em instantes.",
            headers={"Retry-After": resp.headers.get("Retry-After", "60")},
        )
    if resp.status_code in (401, 403):
        logger.error("vps-monitor: Hostinger recusou o token (%s) em %s", resp.status_code, path)
        raise HTTPException(status_code=502, detail="Token da Hostinger inválido ou sem permissão.")
    if resp.status_code >= 400:
        logger.warning("vps-monitor: Hostinger respondeu %s em %s", resp.status_code, path)
        raise HTTPException(status_code=502, detail=f"Hostinger respondeu {resp.status_code}.")

    try:
        data = resp.json()
    except ValueError:
        logger.warning("vps-monitor: resposta não-JSON da Hostinger em %s", path)
        raise HTTPException(status_code=502, detail="Resposta inesperada da Hostinger.")

    _cache[key] = data
    return data


async def hostinger_write(method: str, path: str, json: dict[str, Any] | None = None) -> Any:
    """Chamada de ESCRITA na Hostinger (Fase 4). Sem cache; o mesmo mapeamento
    de erro do GET. Depois de uma escrita, o cache de leitura fica obsoleto —
    quem chama deve invocar bust_cache()."""
    _require_configured()
    url = f"{settings.HOSTINGER_API_URL}{path}"
    headers = {
        "Authorization": f"Bearer {settings.HOSTINGER_API_TOKEN}",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.request(method, url, headers=headers, json=json)
    except httpx.HTTPError as e:
        logger.warning("vps-monitor: falha de rede em %s %s: %s", method, path, e)
        raise HTTPException(status_code=502, detail="Não foi possível contatar a API da Hostinger.")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Recurso não encontrado na Hostinger.")
    if resp.status_code == 409:
        raise HTTPException(status_code=409, detail="A VPS já tem uma ação em andamento (actions_lock).")
    if resp.status_code == 422:
        raise HTTPException(status_code=422, detail=_first_error(resp) or "Parâmetros inválidos para a Hostinger.")
    if resp.status_code in (401, 403):
        logger.error("vps-monitor: Hostinger recusou a escrita (%s) em %s", resp.status_code, path)
        raise HTTPException(status_code=502, detail="Token da Hostinger sem permissão para esta ação.")
    if resp.status_code >= 400:
        logger.warning("vps-monitor: Hostinger respondeu %s em %s %s", resp.status_code, method, path)
        raise HTTPException(status_code=502, detail=f"Hostinger respondeu {resp.status_code}.")

    try:
        return resp.json() if resp.content else {}
    except ValueError:
        return {}


def _first_error(resp: httpx.Response) -> str | None:
    try:
        body = resp.json()
    except ValueError:
        return None
    if isinstance(body, dict):
        return body.get("message") or body.get("detail")
    return None


def bust_cache() -> None:
    _cache.clear()
    _error_cache.clear()


def _vm_path(suffix: str = "") -> str:
    return f"/virtual-machines/{settings.HOSTINGER_VPS_ID}{suffix}"


async def _get_vm() -> dict[str, Any] | None:
    vms = await _hostinger_get("/virtual-machines")
    if not isinstance(vms, list):
        return None
    return next((v for v in vms if v.get("id") == settings.HOSTINGER_VPS_ID), None)


# --------------------------------------------------------------------------- #
# Transformações                                                              #
# --------------------------------------------------------------------------- #
def _mb_to_bytes(mb: float | int | None) -> int | None:
    return int(mb) * 1024 * 1024 if mb is not None else None


def _series_to_recharts(
    metrics: dict[str, Any], mem_bytes: int | None, disk_bytes: int | None
) -> list[dict[str, Any]]:
    """`{metric: {unit, usage: {epoch: v}}}` → `[{t, iso, cpu, ram, ramPct, ...}]`."""
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


def _downsample(points: list[dict[str, Any]], target: int) -> list[dict[str, Any]]:
    """Reduz a série pra ~`target` pontos (sparkline não precisa de 45+)."""
    if len(points) <= target:
        return points
    step = len(points) / target
    picked = [points[int(i * step)] for i in range(target)]
    if picked[-1] is not points[-1]:
        picked.append(points[-1])
    return picked


def _snapshot_view(raw: Any) -> dict[str, Any]:
    # A Hostinger devolve `{id: 0, created_at == expires_at}` quando não há
    # snapshot manual — normalizamos pra um shape explícito.
    if not isinstance(raw, dict) or not raw.get("id"):
        return {"exists": False}
    return {
        "exists": True,
        "id": raw.get("id"),
        "createdAt": raw.get("created_at"),
        "expiresAt": raw.get("expires_at"),
        "restoreTime": raw.get("restore_time"),
    }


def _newest_backup(backups: Any) -> dict[str, Any] | None:
    data = backups.get("data", []) if isinstance(backups, dict) else []
    data = [b for b in data if isinstance(b, dict)]
    if not data:
        return None
    return max(data, key=lambda b: b.get("created_at") or "")


# --------------------------------------------------------------------------- #
# Insights (regras determinísticas — sem persistência, tela 8)                #
# --------------------------------------------------------------------------- #
def _age_days(iso: str | None, now: datetime) -> float | None:
    if not iso:
        return None
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return (now - d).total_seconds() / 86400


def _compute_insights(
    *,
    vm: dict[str, Any] | None,
    points: list[dict[str, Any]],
    snapshot: dict[str, Any],
    backups: Any,
    monarx: dict[str, Any] | None,
    mem_bytes: int | None,
    disk_bytes: int | None,
    bandwidth_bytes: int | None,
    now: datetime,
) -> list[dict[str, Any]]:
    """Recebe os MESMOS dados que /overview já busca (points = janela de 30d)."""
    out: list[dict[str, Any]] = []

    def add(severity: str, key: str, title: str, detail: str, value: str | None = None) -> None:
        out.append({"id": key, "severity": severity, "title": title, "detail": detail, "value": value})

    day_ms = 86_400_000
    last24 = [p for p in points if p["t"] >= (now.timestamp() * 1000 - day_ms)]

    # --- Estado da VM ---------------------------------------------------------
    state = (vm or {}).get("state")
    if state and state != "running":
        add("critical", "vm-state", f"VPS não está em execução (estado: {state})",
            "O serviço pode estar indisponível. Verifique no hPanel da Hostinger.")
    if (vm or {}).get("actions_lock") == "locked":
        add("info", "vm-lock", "Ação em andamento na VPS",
            "A Hostinger está processando uma ação; algumas operações ficam bloqueadas até concluir.")

    # --- Disco --------------------------------------------------------------
    disk_pcts = [p["diskPct"] for p in last24 if p["diskPct"] is not None]
    disk_now = disk_pcts[-1] if disk_pcts else None
    if disk_now is not None:
        if disk_now >= 90:
            add("critical", "disk", f"Disco em {disk_now:.0f}%",
                "Espaço crítico. Cache de build do Coolify e imagens dangling costumam ser a causa — rodar prune.", f"{disk_now:.0f}%")
        elif disk_now >= 80:
            add("warning", "disk", f"Disco em {disk_now:.0f}%",
                "Acima de 80%. Acompanhar e considerar limpeza de imagens/volumes órfãos.", f"{disk_now:.0f}%")

    # --- RAM --------------------------------------------------------------
    ram_pcts = [p["ramPct"] for p in last24 if p["ramPct"] is not None]
    if ram_pcts:
        ram_now = ram_pcts[-1]
        high_frac = sum(1 for v in ram_pcts if v >= 90) / len(ram_pcts)
        if ram_now >= 90 and high_frac >= 0.5:
            add("critical", "ram", f"RAM em {ram_now:.0f}%, sustentada",
                f"Acima de 90% em {high_frac*100:.0f}% das últimas 24h. Risco de OOM kill.", f"{ram_now:.0f}%")
        elif ram_now >= 90:
            add("warning", "ram", f"RAM em {ram_now:.0f}%", "Momentaneamente alta.", f"{ram_now:.0f}%")
        elif max(ram_pcts) >= 95:
            add("warning", "ram-spikes", f"RAM teve picos de {max(ram_pcts):.0f}% nas últimas 24h",
                "Investigar o que consumiu memória nesses momentos.", f"{max(ram_pcts):.0f}%")

    # --- CPU sustentada -----------------------------------------------------
    cpu_vals = [p["cpu"] for p in last24 if p["cpu"] is not None]
    if cpu_vals:
        mean_cpu = sum(cpu_vals) / len(cpu_vals)
        if mean_cpu >= 95:
            add("critical", "cpu", f"CPU média de {mean_cpu:.0f}% nas últimas 24h",
                "Saturação sustentada. Ver quebra por container (Fase 2) ou deploys em loop.", f"{mean_cpu:.0f}%")
        elif mean_cpu >= 85:
            add("warning", "cpu", f"CPU média de {mean_cpu:.0f}% nas últimas 24h",
                "Carga alta e constante. Pouca folga pra picos e builds.", f"{mean_cpu:.0f}%")

    # --- Projeção de tráfego do mês vs. franquia ---------------------------
    if bandwidth_bytes:
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_start_ms = month_start.timestamp() * 1000
        mtd = [p for p in points if p["t"] >= month_start_ms]
        used = sum((p.get("netIn") or 0) + (p.get("netOut") or 0) for p in mtd)
        days_elapsed = max((now - month_start).total_seconds() / 86400, 0.5)
        days_in_month = calendar.monthrange(now.year, now.month)[1]
        projected = used / days_elapsed * days_in_month
        pct = projected / bandwidth_bytes * 100
        if pct >= 100:
            add("critical", "bandwidth", f"Tráfego projetado do mês: {pct:.0f}% da franquia",
                f"No ritmo atual ({_fmt_gb(used)} em {days_elapsed:.0f} dias) a franquia estoura antes do fim do mês.", f"{pct:.0f}%")
        elif pct >= 80:
            add("warning", "bandwidth", f"Tráfego projetado do mês: {pct:.0f}% da franquia",
                f"{_fmt_gb(used)} usados até agora. Acompanhar.", f"{pct:.0f}%")

    # --- Snapshot ---------------------------------------------------------
    if not snapshot.get("exists"):
        add("info", "snapshot", "Sem snapshot manual",
            "Não há um ponto de restauração manual. Backups automáticos continuam independentes.")
    else:
        age = _age_days(snapshot.get("createdAt"), now)
        if age is not None and age > 7:
            add("warning", "snapshot-old", f"Snapshot manual tem {age:.0f} dias",
                "Um snapshot antigo restaura um estado defasado. Recriar se for usado como rede de segurança.")

    # --- Backups --------------------------------------------------------
    newest = _newest_backup(backups)
    if newest is None:
        add("critical", "backups", "Nenhum backup automático disponível",
            "Confirmar que o plano de backup da Hostinger está ativo.")
    else:
        age = _age_days(newest.get("created_at"), now)
        if age is not None and age > 3:
            add("warning", "backups-old", f"Backup mais recente tem {age:.0f} dias",
                "Backups automáticos costumam ser diários/semanais — verificar o agendamento.")

    # --- Monarx (malware) ------------------------------------------------
    if isinstance(monarx, dict):
        if monarx.get("malicious", 0) > 0:
            add("critical", "monarx-malicious", f"Monarx detectou {monarx['malicious']} arquivo(s) malicioso(s)",
                "Investigar imediatamente no hPanel / Monarx.")
        if monarx.get("compromised", 0) > 0:
            add("critical", "monarx-compromised", f"Monarx sinalizou {monarx['compromised']} item(ns) comprometido(s)",
                "Investigar imediatamente.")

    order = {"critical": 0, "warning": 1, "info": 2}
    out.sort(key=lambda i: order.get(i["severity"], 9))
    return out


def _fmt_gb(n: float) -> str:
    return f"{n / 1024 ** 3:.1f} GB"


# --------------------------------------------------------------------------- #
# Endpoints                                                                   #
# --------------------------------------------------------------------------- #
@router.get("/vm")
async def get_vm(_: Usuario = _ti_user) -> Any:
    """Detalhes da VM: state, plano, specs, IPs, firewall_group_id, actions_lock."""
    vm = await _get_vm()
    if not vm:
        raise HTTPException(status_code=404, detail="VPS não encontrada na conta Hostinger.")
    return vm


@router.get("/metrics")
async def get_metrics(
    range: str = Query("24h", pattern="^(24h|7d|30d)$"),
    _: Usuario = _ti_user,
) -> Any:
    """Série temporal já no formato do recharts, para a janela pedida."""
    params = _metrics_params(_RANGES[range], datetime.now(tz=timezone.utc))
    raw_metrics, vm = await asyncio.gather(
        _hostinger_get(_vm_path("/metrics"), params),
        _get_vm(),
    )
    vm = vm or {}
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
async def get_snapshot(_: Usuario = _ti_user) -> Any:
    try:
        raw = await _hostinger_get(_vm_path("/snapshot"))
    except HTTPException as exc:
        if exc.status_code == 404:
            return {"exists": False}
        raise
    return _snapshot_view(raw)


@router.get("/backups")
async def get_backups(_: Usuario = _ti_user) -> Any:
    return await _hostinger_get(_vm_path("/backups"))


@router.get("/actions")
async def get_actions(page: int = Query(1, ge=1), _: Usuario = _ti_user) -> Any:
    """Histórico de ações da própria Hostinger (trilha de auditoria)."""
    return await _hostinger_get(_vm_path("/actions"), {"page": page})


@router.get("/actions/{action_id}")
async def get_action(action_id: int, _: Usuario = _ti_user) -> Any:
    """Detalhe/estado de uma ação (usado na Fase 4 pra poll de ação assíncrona)."""
    return await _hostinger_get(_vm_path(f"/actions/{action_id}"))


@router.get("/firewall")
async def get_firewall(_: Usuario = _ti_user) -> Any:
    return await _hostinger_get("/firewall")


@router.get("/monarx")
async def get_monarx(_: Usuario = _ti_user) -> Any:
    """Scan de malware (o "Detector de malware: Ativo" do hPanel)."""
    return await _hostinger_get(_vm_path("/monarx"))


async def _overview_sources(hours: int) -> tuple[Any, ...]:
    params = _metrics_params(timedelta(hours=hours), datetime.now(tz=timezone.utc))
    return await asyncio.gather(
        _hostinger_get("/virtual-machines"),
        _hostinger_get(_vm_path("/metrics"), params),
        _hostinger_get(_vm_path("/snapshot")),
        _hostinger_get(_vm_path("/backups")),
        _hostinger_get(_vm_path("/monarx")),
        return_exceptions=True,
    )


async def collect_state(hours: int = 24 * 30) -> dict[str, Any]:
    """Estado consolidado da VPS (métricas + insights). Usado pelo endpoint
    /insights E pelo poller da Fase 3 (app/services/vps_poller.py) — o poller
    não passa por rota HTTP, então a lógica mora aqui, não no handler."""
    now = datetime.now(tz=timezone.utc)
    vms, raw_metrics, snapshot, backups, monarx = await _overview_sources(hours)

    vm = None
    if isinstance(vms, list):
        vm = next((v for v in vms if v.get("id") == settings.HOSTINGER_VPS_ID), None)
    mem_bytes = _mb_to_bytes(vm.get("memory")) if vm else None
    disk_bytes = _mb_to_bytes(vm.get("disk")) if vm else None
    bandwidth_bytes = _mb_to_bytes(vm.get("bandwidth")) if vm else None
    points = _series_to_recharts(raw_metrics, mem_bytes, disk_bytes) if isinstance(raw_metrics, dict) else []
    snap_view = _snapshot_view(snapshot)

    insights = _compute_insights(
        vm=vm, points=points, snapshot=snap_view, backups=backups,
        monarx=monarx if isinstance(monarx, dict) else None,
        mem_bytes=mem_bytes, disk_bytes=disk_bytes, bandwidth_bytes=bandwidth_bytes, now=now,
    )
    return {
        "now": now,
        "vm": vm,
        "points": points,
        "latest": points[-1] if points else None,
        "snapshot": snap_view,
        "backups": backups,
        "monarx": monarx if isinstance(monarx, dict) else None,
        "memBytes": mem_bytes,
        "diskBytes": disk_bytes,
        "bandwidthBytes": bandwidth_bytes,
        "insights": insights,
    }


@router.get("/overview")
async def get_overview(_: Usuario = _ti_user) -> Any:
    """Agregado da tela Visão Geral. Falha parcial não derruba o painel inteiro."""
    now = datetime.now(tz=timezone.utc)
    vms, raw_metrics, snapshot, backups, monarx = await _overview_sources(24)

    vm = None
    if isinstance(vms, list):
        vm = next((v for v in vms if v.get("id") == settings.HOSTINGER_VPS_ID), None)

    mem_bytes = _mb_to_bytes(vm.get("memory")) if vm else None
    disk_bytes = _mb_to_bytes(vm.get("disk")) if vm else None

    points = _series_to_recharts(raw_metrics, mem_bytes, disk_bytes) if isinstance(raw_metrics, dict) else []
    latest = points[-1] if points else None
    newest = _newest_backup(backups)
    snap_view = _snapshot_view(snapshot)

    insights = _compute_insights(
        vm=vm, points=points, snapshot=snap_view, backups=backups,
        monarx=monarx if isinstance(monarx, dict) else None,
        mem_bytes=mem_bytes, disk_bytes=disk_bytes,
        bandwidth_bytes=_mb_to_bytes(vm.get("bandwidth")) if vm else None, now=now,
    )
    counts = {sev: sum(1 for i in insights if i["severity"] == sev) for sev in ("critical", "warning", "info")}

    return {
        "generatedAt": now.isoformat(),
        "vm": vm,
        "memBytes": mem_bytes,
        "diskBytes": disk_bytes,
        "bandwidthBytes": _mb_to_bytes(vm.get("bandwidth")) if vm else None,
        "latest": latest,
        "spark24h": _downsample(points, 48),
        "snapshot": snap_view,
        "backupsCount": len(backups.get("data", [])) if isinstance(backups, dict) else 0,
        "lastBackupAt": newest.get("created_at") if newest else None,
        "monarx": monarx if isinstance(monarx, dict) else None,
        "insightCounts": counts,
    }


@router.get("/insights")
async def get_insights(db: AsyncSession = Depends(get_db), _: Usuario = _ti_user) -> Any:
    """Lista priorizada de alertas/recomendações (tela 8).

    Os insights são recalculados ao vivo (funciona sem o poller). Se o poller
    da Fase 3 estiver rodando, cada um é anotado com o estado persistido
    (status, desde quando, quem reconheceu)."""
    state = await collect_state(hours=24 * 30)
    insights: list[dict[str, Any]] = state["insights"]

    # Anota com o VpsInsightEvent aberto correspondente, se houver.
    events = await _open_events_by_key(db)
    for i in insights:
        ev = events.get(i["id"])
        if ev:
            i["status"] = ev.status
            i["since"] = ev.aberto_em.isoformat()
            i["acknowledgedBy"] = str(ev.reconhecido_por) if ev.reconhecido_por else None

    return {
        "generatedAt": state["now"].isoformat(),
        "insights": insights,
        "counts": {sev: sum(1 for i in insights if i["severity"] == sev) for sev in ("critical", "warning", "info")},
    }


async def _open_events_by_key(db: AsyncSession) -> dict[str, Any]:
    from app.models.vps_monitor import VpsInsightEvent

    rows = (await db.execute(
        select(VpsInsightEvent).where(VpsInsightEvent.status != "resolvido")
    )).scalars().all()
    return {r.insight_key: r for r in rows}


@router.post("/insights/{insight_key}/ack")
async def ack_insight(
    insight_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = _ti_user,
) -> Any:
    """Marca um alerta como reconhecido (não é ação na VPS — é estado no CRM)."""
    from app.models.vps_monitor import VpsInsightEvent

    ev = await db.scalar(
        select(VpsInsightEvent).where(
            VpsInsightEvent.insight_key == insight_key,
            VpsInsightEvent.status == "aberto",
        )
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Nenhum alerta aberto com essa chave.")
    ev.status = "reconhecido"
    ev.reconhecido_por = current_user.id
    ev.reconhecido_em = datetime.utcnow()
    ev.atualizado_em = datetime.utcnow()
    await db.commit()
    return {"status": ev.status}


_HISTORY_RANGES = {
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
    "1y": timedelta(days=365),
}


@router.get("/history")
async def get_history(
    range: str = Query("90d", pattern="^(7d|30d|90d|1y)$"),
    db: AsyncSession = Depends(get_db),
    _: Usuario = _ti_user,
) -> Any:
    """Série de longo prazo da nossa tabela (Fase 3) — além da janela da
    Hostinger. Vazio até o poller acumular dados."""
    from app.models.vps_monitor import VpsMetricSnapshot

    since = datetime.utcnow() - _HISTORY_RANGES[range]
    rows = (await db.execute(
        select(VpsMetricSnapshot)
        .where(VpsMetricSnapshot.coletado_em >= since)
        .order_by(VpsMetricSnapshot.coletado_em)
    )).scalars().all()

    points = [
        {
            "t": int(r.coletado_em.replace(tzinfo=timezone.utc).timestamp() * 1000),
            "cpu": r.cpu_pct,
            "ramPct": r.ram_pct,
            "diskPct": r.disk_pct,
            "netIn": r.net_in_bytes,
            "netOut": r.net_out_bytes,
        }
        for r in rows
    ]
    return {"range": range, "points": _downsample(points, 240), "sampleCount": len(rows)}


@router.get("/_meta")
async def get_meta(db: AsyncSession = Depends(get_db), _: Usuario = _ti_user) -> Any:
    """Diagnóstico leve: config, cache e estado do poller da Fase 3."""
    from app.models.vps_monitor import VpsInsightEvent, VpsMetricSnapshot

    snap_count = await db.scalar(select(func.count()).select_from(VpsMetricSnapshot))
    last_snap = await db.scalar(select(func.max(VpsMetricSnapshot.coletado_em)))
    open_events = await db.scalar(
        select(func.count()).select_from(VpsInsightEvent).where(VpsInsightEvent.status != "resolvido")
    )
    return {
        "configured": bool(settings.HOSTINGER_API_TOKEN),
        "vpsId": settings.HOSTINGER_VPS_ID,
        "cacheTtlSeconds": _cache.ttl,
        "cachedKeys": len(_cache),
        "erroredKeys": len(_error_cache),
        "collectorsEnabled": settings.VPS_COLLECTORS_ENABLED,
        "coolifyConfigured": bool(settings.COOLIFY_API_TOKEN),
        "poller": {
            "enabled": settings.VPS_POLLER_ENABLED,
            "intervalSeconds": settings.VPS_POLL_INTERVAL_SECONDS,
            "snapshotCount": snap_count or 0,
            "lastSnapshotAt": last_snap.isoformat() if last_snap else None,
            "openEvents": open_events or 0,
        },
    }
