"""Transformações puras do monitoramento da VPS (vps_monitor.py).

Regras/conversões, sem tocar na Hostinger nem no banco — rodam em qualquer
ambiente, igual tests/test_visibility.py.
"""
import os
from datetime import datetime, timezone

# vps_monitor importa app.core.config (Settings exige JWT_SECRET). Estes
# testes não usam auth nem banco — só um valor qualquer pra o import passar.
os.environ.setdefault("JWT_SECRET", "test-only")

from app.api.v1.endpoints.vps_monitor import (  # noqa: E402
    _compute_insights,
    _downsample,
    _mb_to_bytes,
    _newest_backup,
    _series_to_recharts,
    _snapshot_view,
)

NOW = datetime(2026, 9, 8, 12, 0, tzinfo=timezone.utc)
GIB = 1024 ** 3


def test_mb_to_bytes_handles_zero_and_none():
    assert _mb_to_bytes(None) is None
    assert _mb_to_bytes(0) == 0  # plano ilimitado != "sem dado"
    assert _mb_to_bytes(16384) == 16384 * 1024 * 1024


def test_series_alignment_and_missing_metrics():
    raw = {
        "cpu_usage": {"unit": "%", "usage": {"100": 50.0, "200": 90.0}},
        "ram_usage": {"usage": {"100": 8e9}},          # falta o ts 200
        "disk_space": {"usage": {"200": 1e11}},        # falta o ts 100
    }
    pts = _series_to_recharts(raw, 16 * GIB, 200 * GIB)
    assert [p["t"] for p in pts] == [100_000, 200_000]
    assert pts[0]["cpu"] == 50.0 and pts[1]["cpu"] == 90.0
    assert pts[0]["ramPct"] is not None and pts[1]["ramPct"] is None
    assert pts[0]["diskPct"] is None and pts[1]["diskPct"] is not None


def test_series_empty_input():
    assert _series_to_recharts({}, None, None) == []
    assert _series_to_recharts({"cpu_usage": {}}, 1, 1) == []


def test_downsample_keeps_endpoints_and_target_size():
    pts = [{"t": i, "v": i} for i in range(500)]
    out = _downsample(pts, 50)
    assert 50 <= len(out) <= 51
    assert out[0]["t"] == 0 and out[-1]["t"] == 499
    assert _downsample(pts[:10], 50) == pts[:10]  # já menor que o alvo


def test_snapshot_view_normalizes_empty():
    assert _snapshot_view({"id": 0, "created_at": "x", "expires_at": "x"}) == {"exists": False}
    assert _snapshot_view(None) == {"exists": False}
    v = _snapshot_view({"id": 42, "created_at": "2026-09-01T00:00:00Z", "restore_time": 8000})
    assert v["exists"] and v["id"] == 42 and v["restoreTime"] == 8000


def test_newest_backup_picks_by_date_not_order():
    backups = {"data": [
        {"id": 1, "created_at": "2026-08-20T06:00:00Z"},
        {"id": 2, "created_at": "2026-08-27T05:00:00Z"},
        {"id": 3, "created_at": "2026-08-13T05:00:00Z"},
    ]}
    assert _newest_backup(backups)["id"] == 2
    assert _newest_backup({"data": []}) is None
    assert _newest_backup(None) is None


def _insights(**over):
    base = dict(
        vm={"state": "running", "actions_lock": "unlocked"},
        points=[], snapshot={"exists": True, "createdAt": NOW.isoformat()},
        backups={"data": [{"created_at": NOW.isoformat()}]},
        monarx={"malicious": 0, "compromised": 0, "scanned_files": 10},
        mem_bytes=16 * GIB, disk_bytes=200 * GIB, bandwidth_bytes=None, now=NOW,
    )
    base.update(over)
    return {i["id"]: i for i in _compute_insights(**base)}


def test_insights_healthy_box_is_quiet():
    assert _insights() == {}


def test_insights_vm_not_running_is_critical_and_first():
    got = _compute_insights(
        vm={"state": "stopped"}, points=[], snapshot={"exists": False},
        backups={"data": []}, monarx=None, mem_bytes=None, disk_bytes=None,
        bandwidth_bytes=None, now=NOW,
    )
    assert got[0]["id"] == "vm-state" and got[0]["severity"] == "critical"


def test_insights_disk_thresholds():
    def pt(pct):
        return {"t": NOW.timestamp() * 1000, "cpu": 1, "ramPct": 1, "diskPct": pct,
                "ram": 1, "disk": 1, "netIn": 0, "netOut": 0, "uptime": 1}

    assert _insights(points=[pt(82)])["disk"]["severity"] == "warning"
    assert _insights(points=[pt(93)])["disk"]["severity"] == "critical"
    assert "disk" not in _insights(points=[pt(50)])


def test_insights_malware_is_critical():
    got = _insights(monarx={"malicious": 3, "compromised": 0})
    assert got["monarx-malicious"]["severity"] == "critical"


def test_insights_bandwidth_projection_over_quota():
    # ~10 GiB/h desde o começo do mês, franquia pequena → projeção estoura.
    pts = [
        {"t": (NOW.timestamp() - h * 3600) * 1000, "cpu": 5, "ramPct": 5, "diskPct": 5,
         "ram": 1, "disk": 1, "netIn": 5 * GIB, "netOut": 5 * GIB, "uptime": 1}
        for h in range(24 * 7)
    ]
    got = _insights(points=pts, bandwidth_bytes=200 * GIB)
    assert got["bandwidth"]["severity"] == "critical"
