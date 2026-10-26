"""Backtest on arrival (DEC-0064): the battery picks tests that fit the series, every test
is a trial in the search's own table (so the luck check counts it), the results are kept
for the series page, and the search draws enrolled series as signals and assets."""

from __future__ import annotations

import random

import numpy as np
import pytest

from parity import search
from parity.registry import battery, db, sync
from parity.registry.model import Record


@pytest.fixture
def reg(tmp_path):
    con = db.connect(tmp_path / "r.db")
    sync.sync(con, {"series": []})
    return con


def _rec(con, sid, freq="D", tags=(), asset="other"):
    r = Record(id=sid, source_id="ecb", name=f"Test {sid}", frequency=freq, status="enrolled",
               display_rights="public", code="X", origin="discovered", asset_class=asset,
               tags=list(tags), start_date="2010-01-01", end_date="2016-12-30")
    db.put(con, r)
    return db.get(con, sid)


def test_the_battery_fits_the_series(reg):
    price = _rec(reg, "ecb.QQQ", tags=("tradable",), asset="fx")
    assert [n for n, _ in battery.specs_for(price)] == ["trend 12m long or short",
                                                        "trend 3m long or cash"]
    signal = _rec(reg, "cot.CXYZ_PCT", freq="W", asset="positioning")
    assert len(battery.specs_for(signal)) == 4
    rate = _rec(reg, "policy.NO", asset="rates")
    names = [n for n, _ in battery.specs_for(rate)]
    assert names[0].startswith("carry: xfx.NOK") and len(names) == 5


def test_every_battery_spec_builds_and_never_looks_ahead(reg, panel):
    rng = np.random.default_rng(3)
    p = panel.copy()
    p["ecb.QQQ"] = np.exp(np.cumsum(rng.normal(0, 0.01, len(p))))
    p["policy.NO"] = 2 + np.cumsum(rng.normal(0, 0.02, len(p)))
    for sid, tags, asset in (("ecb.QQQ", ("tradable",), "fx"), ("policy.NO", (), "rates")):
        for name, spec in battery.specs_for(_rec(reg, sid, tags=tags, asset=asset)):
            strat = search.build(spec)
            assert search.describe(spec)["name"], name
            cols = sorted(set(strat.required()) | {"rate.USD", "rate.TBILL3M", "eq.US_TOTAL"})
            full = strat.weights(p[cols])
            cut = p.index[len(p) // 2]
            part = strat.weights(p.loc[:cut, cols])
            a = full.loc[:cut].reindex(columns=part.columns)
            assert np.allclose(a.values, part.values, equal_nan=True, atol=1e-9), name


def test_each_test_is_a_trial_and_the_result_is_kept(reg, panel, tmp_path):
    rng = np.random.default_rng(4)
    p = panel.copy()
    p["cot.CXYZ_PCT"] = np.cumsum(rng.normal(0, 1, len(p)))
    rec = _rec(reg, "cot.CXYZ_PCT", freq="W", asset="positioning")
    scon = search.connect(tmp_path / "s.db")
    b = battery.run_battery(reg, rec, scon, panel=p)
    assert b["new_trials"] == 4 and b["search_trials"] == 4
    assert set(b["correlations"]) >= {"US stocks", "G10 currencies"}
    assert scon.execute("SELECT COUNT(*) FROM trials").fetchone()[0] == 4
    # Run again: the same specs are not new trials.
    assert battery.run_battery(reg, rec, scon, panel=p)["new_trials"] == 0
    assert reg.execute("SELECT trials FROM backtests WHERE series_id = 'cot.CXYZ_PCT'"
                       ).fetchone()[0] == 4
    assert db.events(reg, "cot.CXYZ_PCT", 1)[0]["kind"] == "backtest"
    # The luck check counts them like any other trial.
    doc = search.export(path=tmp_path / "s.json", con=scon)
    assert doc["trials"] == 4


def test_the_search_draws_enrolled_series_as_signals_and_assets():
    ctx = search.Context(arrivals=["policy.NO"], arrival_assets=["ecb.QQQ"])
    assert "policy.NO" in ctx.series()
    r = random.Random(5)
    kinds = set()
    for _ in range(60):
        spec = search._arrival(r, ctx)
        kinds.add(spec["kind"])
        search.build(spec)
        assert search.describe(spec)["name"]
    assert kinds == {"trend", "gated"}
    # With nothing enrolled, the sampler list is unchanged.
    assert search._arrival not in [fn for fn, _ in search.SAMPLERS]


def test_short_histories_are_not_run_and_not_counted(reg, panel, tmp_path):
    p = panel.copy()
    p["kraken.XBTUSD"] = np.nan
    p.loc[p.index[-500:], "kraken.XBTUSD"] = np.linspace(100, 200, 500)
    rec = _rec(reg, "kraken.XBTUSD", tags=("tradable",), asset="crypto")
    scon = search.connect(tmp_path / "s.db")
    b = battery.run_battery(reg, rec, scon, panel=p)
    assert b["new_trials"] == 0 and all(t["error"].startswith("not run") for t in b["tests"])
