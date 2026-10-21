"""`parity new-strategy` writes into a temporary root, never the repo."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from parity import cli
from parity.scaffold import ScaffoldError, make_id, scaffold

REPO = Path(__file__).resolve().parents[2]


@pytest.fixture
def root(tmp_path):
    shutil.copytree(REPO / "scripts", tmp_path / "scripts")
    shutil.copytree(REPO / "docs" / "_system", tmp_path / "docs" / "_system")
    shutil.copytree(REPO / "catalog" / "algorithms", tmp_path / "catalog" / "algorithms")
    return tmp_path


def test_scaffold_creates_every_file(root):
    out = scaffold("Zz scaffold test drift", "calendar", "fx", horizon="weekly", root=root,
                   today="2026-10-21")
    sid = out["id"]
    assert sid == "zz_scaffold_test_drift"
    src = (root / f"engine/src/parity/strategies/{sid}.py").read_text()
    assert '@register' in src and 'name = "zz_scaffold_test_drift"' in src
    assert 'display_name = "Zz scaffold test drift"' in src and "TODO" in src
    assert (root / f"engine/tests/test_strategy_{sid}.py").exists()
    entry = json.loads((root / "catalog/algorithms/zz-scaffold-test-drift.json").read_text())
    assert entry["family"] == "seasonality-calendar" and entry["horizon"] == "weekly"
    assert entry["research"]["strategy"] == sid and entry["research"]["stage"] == 1
    assert out["doc"] == "built"
    doc = root / "docs" / f"algorithms/{entry['id'][-4:]}-zz-scaffold-test-drift.md"
    assert doc.exists() and f"reference = \"algorithms/{doc.name}\"" in src
    assert len(out["next_steps"]) >= 4


def test_scaffolded_strategy_compiles_and_runs(root, panel):
    out = scaffold("Zz scaffold test calm", "volatility", "commodities", root=root,
                   build_docs=False)
    path = root / f"engine/src/parity/strategies/{out['id']}.py"
    subprocess.run([sys.executable, "-m", "py_compile", str(path)], check=True)
    src = path.read_text().replace("from . import register", "from parity.strategies import "
                                   "register").replace("from ._util", "from parity.strategies"
                                   "._util").replace("from .base", "from parity.strategies.base")
    ns: dict = {}
    from parity.strategies import _REGISTRY
    exec(compile(src, str(path), "exec"), ns)
    try:
        cls = _REGISTRY[out["id"]]
        w = cls().weights(panel)
        assert (w == 0).all().all() and list(w.columns) == cls().instruments()
    finally:
        _REGISTRY.pop(out["id"], None)


def test_dry_run_writes_nothing(root):
    before = sorted(p for p in root.rglob("*"))
    out = scaffold("Zz scaffold test dry", "trend", "stocks", root=root, dry_run=True)
    assert out["dry_run"] and sorted(p for p in root.rglob("*")) == before


def test_refuses_existing_ids(root):
    with pytest.raises(ScaffoldError):
        scaffold("Anything", "carry", "fx", sid="fx_carry", root=root)
    scaffold("Zz scaffold test twice", "carry", "fx", root=root, build_docs=False)
    with pytest.raises(ScaffoldError):
        scaffold("Zz scaffold test twice", "carry", "fx", root=root, build_docs=False)
    with pytest.raises(ScaffoldError):
        scaffold("Bad family", "astrology", "fx", root=root)


def test_cli_prints_next_steps(root, capsys):
    rc = cli.main(["new-strategy", "Zz scaffold test gas", "--family", "calendar", "--asset",
                   "commodities", "--root", str(root), "--dry-run"])
    text = capsys.readouterr().out
    assert rc == 0 and "Next steps" in text and "parity analyse zz_scaffold_test_gas" in text
    assert cli.main(["new-strategy", "X", "--family", "carry", "--asset", "fx",
                     "--id", "fx_carry", "--root", str(root)]) == 1


def test_make_id():
    assert make_id("Stock trend, 10-month") == "stock_trend_10_month"
    assert make_id("3 day thing") == "s_3_day_thing"
