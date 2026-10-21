"""Every strategy carries a human name, a short description and tags, and the
report passes them through to the dashboard."""

from __future__ import annotations

import pytest

from parity import report, strategies
from parity.backtest import BacktestConfig
from parity.data import catalog
from parity.strategies.base import ASSETS, FAMILIES, TAG_KEYS


@pytest.mark.parametrize("name", list(strategies.available()))
def test_every_strategy_has_a_name_description_and_tags(name):
    cls = strategies.available()[name]
    assert cls.display_name.strip() and cls.display_name != name
    assert cls.description.strip()
    assert "—" not in cls.display_name + cls.description, "no em dashes"
    assert set(cls.tags) == set(TAG_KEYS)
    assert all(isinstance(v, str) and v.strip() for v in cls.tags.values())
    assert cls.tags["family"] in FAMILIES
    assert cls.tags["asset"] in ASSETS
    assert (cls.tags["family"] == "benchmark") == cls.is_benchmark


def test_display_names_are_unique():
    names = [c.display_name for c in strategies.available().values()]
    assert len(names) == len(set(names))


def _write_cache(panel, root):
    panel = panel.assign(**{"rate.TBILL3M": panel["rate.USD"]})
    for key in panel.columns:
        s = catalog.get(key)
        path = root / "raw" / s.source / f"{s.code}.parquet"
        path.parent.mkdir(parents=True, exist_ok=True)
        panel[key].rename(key).to_frame().to_parquet(path)


def test_report_carries_labels(panel, tmp_path):
    _write_cache(panel, tmp_path)
    doc = report.run_all(["us_market_buy_hold", "fx_carry"], BacktestConfig(start=None),
                         data_dir=tmp_path, gauntlet=False)
    for run in doc["runs"]:
        cls = strategies.available()[run["strategy"]]
        assert run["display_name"] == cls.display_name
        assert run["description"] == cls.description
        assert run["tags"] == cls.tags
        assert set(run["tags"]) == set(TAG_KEYS)
        assert run["summary"] == cls.summary  # old keys stay
