"""The daily egress check's arithmetic (REF-0028) and the site export's run cache."""

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


check = load("egress_check", "scripts/egress-check/check.py")

METRICS = """# HELP node_network_transmit_bytes_total x
node_network_transmit_bytes_total{service_type="db",device="ens5"} 1.5e+09
node_network_transmit_bytes_total{service_type="db",device="lo"} 9e+09
node_boot_time_seconds{service_type="db"} 1000
"""


def test_parse_metrics_ignores_loopback():
    assert check.parse_metrics(METRICS) == {"tx": 1.5e9, "boot": 1000.0}


def test_a_reboot_counts_only_the_new_counter():
    a = {"t": 0, "tx": 5e9, "boot": 0}
    assert check.sent_between(a, {"t": 1, "tx": 6e9, "boot": 0}) == 1e9
    assert check.sent_between(a, {"t": 1, "tx": 2e8, "boot": 500}) == 2e8


def test_projection_and_warning():
    day = check.DAY
    quiet = [{"t": i * day, "tx": i * 0.05e9, "boot": 0} for i in range(4)]
    s = check.summarise(quiet, 3 * day)
    assert s["gb_last_day"] == 0.05 and s["gb_30d_projected"] == 1.5 and not s["warn"]
    busy = [{"t": i * day, "tx": i * 1e9, "boot": 0} for i in range(4)]
    assert check.summarise(busy, 3 * day)["warn"]


def test_first_run_uses_the_average_since_boot():
    s = check.summarise([{"t": 2 * check.DAY, "tx": 2e9, "boot": 0}], 2 * check.DAY)
    assert s["gb_30d_projected"] == 30.0 and s["warn"]


def test_export_reuses_a_cached_run(tmp_path):
    exp = load("export_site_data", "scripts/export_site_data.py")
    calls = []
    doc, hit = exp.cached(tmp_path, "batch.a.f1.json", lambda: calls.append(1) or {"x": 1})
    assert (doc, hit, calls) == ({"x": 1}, False, [1])
    doc, hit = exp.cached(tmp_path, "batch.a.f1.json", lambda: calls.append(1) or {"x": 2})
    assert (doc, hit, calls) == ({"x": 1}, True, [1])
    assert json.loads((tmp_path / "batch.a.f1.json").read_text()) == {"x": 1}


def test_export_keeps_officials_and_newest_exploratory():
    exp = load("export_site_data", "scripts/export_site_data.py")
    rows = [{"kind": "exploratory"}] * 10 + [{"kind": "official"}]
    kept = exp.kept_batches(rows)
    assert len(kept) == exp.KEEP_EXPLORATORY + 1 and kept[-1]["kind"] == "official"
