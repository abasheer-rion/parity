"""Sim World's map file and simulated paths, on synthetic prices (DEC-0016)."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from parity import scenarios as sc
from parity import world


def _event(eid, date):
    return {"id": eid, "name": eid, "date": date, "type": "military_strike",
            "regions": ["middle_east"], "actors": ["iran"], "severity": 4,
            "commodities": ["oil"], "description": "t",
            "sources": [{"title": "t", "publisher": "p", "url": "https://example.org"}]}


@pytest.fixture
def levels() -> dict[str, pd.Series]:
    rng = np.random.default_rng(3)
    idx = pd.bdate_range("2018-01-01", "2021-12-31")
    walk = lambda vol: pd.Series(np.exp(np.cumsum(rng.normal(0, vol, len(idx)))), index=idx)  # noqa: E731
    out = {"USD": walk(0.003), "EUR": walk(0.005), "JPY": walk(0.005), "oil": 60 * walk(0.02),
           "gas": 3 * walk(0.03), "stocks": 100 * walk(0.01)}
    # A currency that jumps 10% on 2020-03-02 and stays there.
    jump = pd.Series(1.0, index=idx)
    jump[jump.index >= "2020-03-02"] = 1.1
    out["CAD"] = jump
    return out


@pytest.fixture
def rates() -> dict[str, pd.Series]:
    idx = pd.date_range("2018-01-01", "2021-12-01", freq="MS")
    return {"USD": pd.Series(1.5, index=idx), "EUR": pd.Series(-0.3, index=idx)}


def test_daily_grid_keeps_holidays_empty(levels):
    s = levels["EUR"].drop(pd.Timestamp("2020-12-25"))
    grid = world.daily_grid({"EUR": s}, ["EUR", "missing"], start="2020-12-21")
    assert "missing" not in grid["series"]
    i = grid["dates"].index("2020-12-25")
    assert grid["series"]["EUR"][i] is None          # not forward filled
    assert grid["series"]["EUR"][i - 1] == pytest.approx(s["2020-12-24"], rel=1e-5)


def test_weekly_grid_uses_friday_close(levels):
    grid = world.weekly_grid(levels, ["EUR"], start="2019-01-01")
    d = grid["dates"][0]
    assert pd.Timestamp(d).day_of_week == 4
    assert grid["series"]["EUR"][0] == pytest.approx(levels["EUR"][:d].iloc[-1], rel=1e-5)


def test_event_reactions_match_the_scenario_study(levels):
    ev = [_event("jump", "2020-03-02")]
    out = world.event_reactions(ev, levels, ["CAD", "EUR", "NOPE"])[0]
    assert out["reactions"]["CAD"]["1d"] == pytest.approx(10.0)
    ref = sc.event_reaction(levels["EUR"], "2020-03-02", "pct")
    assert out["reactions"]["EUR"]["1m"] == ref["horizons"]["1m"]["change"]
    # every 3rd trading day of the 64-point path: 0, 3, ..., 63
    assert len(out["paths"]["CAD"]) == 22 and out["paths"]["CAD"][0] == 0.0
    assert "NOPE" not in out["reactions"]


def test_export_is_json_and_marks_rates(levels, rates):
    doc = world.export(levels, rates, [_event("jump", "2020-03-02")])
    json.dumps(doc)  # plain JSON, no numpy or NaN surprises
    assets = {a["key"]: a for a in doc["assets"]}
    assert assets["EUR"]["rate"] and not assets["JPY"]["rate"]
    assert doc["data_through"] == "2021-12-31"
    assert set(doc["daily"]["series"]) >= {"USD", "EUR", "oil"}
    assert "stocks" in doc["weekly"]["series"] and "stocks" not in doc["daily"]["series"]
    assert doc["rates"]["EUR"][0] == ["2018-01-01", -0.3]
    assert doc["events"][0]["reactions"]["CAD"]["1d"] == pytest.approx(10.0)


def test_weekly_returns_drop_incomplete_weeks():
    idx = pd.date_range("2020-01-03", periods=6, freq="W-FRI")
    df = pd.DataFrame({"a": [100, 110, 121, np.nan, 133.1, 146.41], "b": 1.0}, index=idx)
    r = world.weekly_returns(df)
    assert len(r) == 3  # weeks 2 and 3, then week 6; week 4 missing and week 5 has no prior
    assert r["a"].iloc[0] == pytest.approx(np.log(1.1))


def test_bootstrap_shapes_start_and_reproducibility(levels):
    weekly = pd.concat({k: levels[k].resample("W-FRI").last() for k in ["EUR", "oil"]}, axis=1)
    r = world.weekly_returns(weekly)
    a = world.bootstrap_paths(r, weeks=10, n=50, block=4, seed=1)
    b = world.bootstrap_paths(r, weeks=10, n=50, block=4, seed=1)
    assert a["levels"].shape == (50, 11, 2) and a["basket"].shape == (50, 11)
    assert np.allclose(a["levels"][:, 0], 100) and np.allclose(a["basket"][:, 0], 100)
    assert np.array_equal(a["levels"], b["levels"])
    c = world.bootstrap_paths(r, weeks=10, n=50, block=4, seed=2)
    assert not np.array_equal(a["levels"], c["levels"])


def test_bootstrap_draws_real_consecutive_weeks():
    # Returns that encode their own row number, so each drawn block can be read back.
    idx = pd.date_range("2000-01-07", periods=200, freq="W-FRI")
    r = pd.DataFrame({"x": np.arange(200) * 1e-6}, index=idx)
    sim = world.bootstrap_paths(r, weeks=12, n=20, block=4, seed=5)
    steps = np.round(np.diff(np.log(sim["levels"][:, :, 0]), axis=1) / 1e-6).astype(int)
    for path in steps:
        for blk in path.reshape(3, 4):
            assert list(np.diff(blk)) == [1, 1, 1]  # four back-to-back weeks


def test_bootstrap_never_crosses_a_gap():
    idx = pd.DatetimeIndex(list(pd.date_range("2000-01-07", periods=3, freq="W-FRI"))
                           + list(pd.date_range("2001-01-05", periods=3, freq="W-FRI")))
    starts = world.block_starts(idx, np.ones(6, bool), 3)
    assert list(starts) == [0, 3]


def test_analogue_pool_only_uses_weeks_after_events():
    idx = pd.date_range("2000-01-07", periods=300, freq="W-FRI")
    r = pd.DataFrame({"x": np.arange(300) * 1e-6}, index=idx)
    mask = world.analogue_mask(idx, ["2002-01-01"], weeks=8)
    allowed = set(np.flatnonzero(mask))
    assert len(allowed) == 8 and min(idx[mask]) > pd.Timestamp("2002-01-01")
    sim = world.bootstrap_paths(r, weeks=6, n=30, block=4, seed=0, pool=mask)
    rows = np.round(np.diff(np.log(sim["levels"][:, :, 0]), axis=1) / 1e-6).astype(int)
    assert set(rows.ravel()) <= allowed


def test_block_shrinks_when_pool_is_short():
    idx = pd.date_range("2000-01-07", periods=50, freq="W-FRI")
    r = pd.DataFrame({"x": np.zeros(50)}, index=idx)
    mask = np.zeros(50, bool)
    mask[[10, 11, 30, 31]] = True  # two runs of two weeks
    sim = world.bootstrap_paths(r, weeks=8, n=5, block=6, seed=0, pool=mask)
    assert sim["block"] == 2 and sim["pool_weeks"] == 4


def test_empty_pool_is_an_error():
    idx = pd.date_range("2000-01-07", periods=10, freq="W-FRI")
    r = pd.DataFrame({"x": np.zeros(10)}, index=idx)
    with pytest.raises(ValueError):
        world.bootstrap_paths(r, weeks=4, n=5, pool=np.zeros(10, bool))


def test_basket_is_equal_weight_rebalanced():
    idx = pd.date_range("2000-01-07", periods=20, freq="W-FRI")
    r = pd.DataFrame({"up": np.log(1.10), "down": np.log(0.90)}, index=idx)
    sim = world.bootstrap_paths(r, weeks=3, n=2, block=1, seed=0)
    assert np.allclose(sim["basket"][:, -1], 100.0)  # +10% and -10% each week, half in each


def test_risk_numbers():
    final = np.array([80.0] * 10 + [100.0] * 30 + [120.0] * 60)
    r = world.risk(final, loss_at=10)
    assert r["p_loss_gt"] == pytest.approx(0.10)
    assert r["p_loss"] == pytest.approx(0.10)
    assert r["median"] == pytest.approx(0.20)
    assert r["worst5"] == pytest.approx(-0.20)
    assert r["tail5"] == pytest.approx(-0.20)


def test_paths_csv_layout():
    idx = pd.date_range("2000-01-07", periods=30, freq="W-FRI")
    r = pd.DataFrame({"EUR": 0.001, "oil": -0.002}, index=idx)
    sim = world.bootstrap_paths(r, weeks=2, n=3, block=1, seed=0)
    lines = world.paths_csv(sim, ["EUR", "oil"]).strip().split("\n")
    assert lines[0] == "path,week,EUR,oil,basket"
    assert len(lines) == 1 + 3 * 3
    assert lines[1].startswith("1,0,100.0000,100.0000,100.0000")
