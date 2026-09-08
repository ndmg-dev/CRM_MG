"""Parser de texto Prometheus dos coletores da VPS (vps_collectors.py).

Puro — não sobe cadvisor/node-exporter nem toca no banco.
"""
import os

os.environ.setdefault("JWT_SECRET", "test-only")

from app.api.v1.endpoints.vps_collectors import _one, _parse_prom, _select  # noqa: E402

SAMPLE = """\
# HELP container_cpu_usage_seconds_total Cumulative cpu time consumed
# TYPE container_cpu_usage_seconds_total counter
container_cpu_usage_seconds_total{image="img:1",name="crm-mg-backend"} 1234.56
container_memory_usage_bytes{name="crm-mg-backend"} 268435456
container_spec_memory_limit_bytes{name="crm-mg-backend"} 1610612736
node_load1 11.29
node_load15 18.11
node_memory_MemTotal_bytes 1.6e+10
node_memory_MemAvailable_bytes 4.0e+09
node_filesystem_size_bytes{device="/dev/sda1",fstype="ext4",mountpoint="/"} 214748364800
node_filesystem_avail_bytes{mountpoint="/"} 70000000000
node_filesystem_files{mountpoint="/"} 13107200
node_filesystem_files_free{mountpoint="/"} 12000000
node_cpu_seconds_total{cpu="0",mode="idle"} 100
node_cpu_seconds_total{cpu="1",mode="idle"} 100
node_cpu_seconds_total{cpu="2",mode="idle"} 100
node_cpu_seconds_total{cpu="3",mode="idle"} 100
garbage line that should be skipped
metric_without_value{x="y"}
"""


def test_parses_values_and_labels():
    s = _parse_prom(SAMPLE)
    assert _one(s, "node_load1") == 11.29
    assert _one(s, "node_load15") == 18.11
    assert _one(s, "node_memory_MemTotal_bytes") == 1.6e10
    assert _one(s, "container_cpu_usage_seconds_total", name="crm-mg-backend") == 1234.56


def test_label_filtering():
    s = _parse_prom(SAMPLE)
    assert _one(s, "node_filesystem_size_bytes", mountpoint="/") == 214748364800
    assert _one(s, "node_filesystem_size_bytes", mountpoint="/nope") is None
    assert len(_select(s, "node_cpu_seconds_total", mode="idle")) == 4  # = nº de vCPU


def test_skips_malformed_and_missing_metric():
    s = _parse_prom(SAMPLE)
    assert _one(s, "does_not_exist") is None
    assert not any(x.name == "garbage" for x in s)
    assert not any(x.name == "metric_without_value" for x in s)
