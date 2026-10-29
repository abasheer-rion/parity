"""The "how it holds up" numbers (metrics/holdup.py) on synthetic data with known answers."""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
import pytest

from parity.metrics import holdup as H


@pytest.fixture
def market():
    rng = np.random.default_rng(11)
    idx = pd.bdate_range("1998-01-01", "2024-12-31")
    n = len(idx)
    stocks = pd.Series(rng.normal(0.0004, 0.011, n), idx)
    bonds = pd.Series(rng.normal(0.0001, 0.004, n), idx)
    strat = 0.6 * stocks + pd.Series(rng.normal(0.0003, 0.007, n), idx)
    rates = pd.Series(3 + np.cumsum(rng.normal(0, 0.03, n)), idx)
    return strat, stocks, bonds, rates


def test_shape_is_json_safe_and_complete(market):
    strat, stocks, bonds, rates = market
    h = H.holdup(strat, stocks, 4, stocks, bonds, rates, test_p_values={"placebo": 0.3},
                 breakeven_bps=10, cost_bps=2)
    json.dumps(h, allow_nan=False)
    assert set(h) == {"equity_vs_benchmark", "luck", "bootstrap", "p_values",
                      "rolling_correlation", "regimes", "worst_periods", "must_be_true",
                      "sources"}
    eq = h["equity_vs_benchmark"]
    assert len(eq["dates"]) <= 260 and len(eq["dates"]) == len(eq["benchmark"])
    assert eq["dates"][-1] == strat.index[-1].date().isoformat()
    assert h["sources"]["stocks"]["available"] and h["sources"]["crises"]["name"] == "built_in"


def test_deterministic_with_seed(market):
    strat, stocks, *_ = market
    a = H.holdup(strat, stocks, 1, seed=5)
    b = H.holdup(strat, stocks, 1, seed=5)
    assert a == b


def test_known_correlation_recovered(market):
    strat, stocks, bonds, _ = market
    corr = H.holdup(strat, stocks, 1, stocks, bonds)["rolling_correlation"]
    # strat = 0.6 * stocks + noise: rho = 0.6*0.011 / sqrt((0.6*0.011)^2 + 0.007^2)
    rho = 0.6 * 0.011 / math.hypot(0.6 * 0.011, 0.007)
    assert corr["full_period"]["stocks"] == pytest.approx(rho, abs=0.02)
    assert abs(corr["full_period"]["bonds"]) < 0.05
    assert len(corr["dates"]) == len(corr["series"]["stocks"]) > 200


def test_bootstrap_range_contains_true_sharpe():
    rng = np.random.default_rng(3)
    idx = pd.bdate_range("2000-01-01", periods=252 * 20)
    true_daily = 0.0004 / 0.01
    r = pd.Series(rng.normal(0.0004, 0.01, len(idx)), idx)
    b = H.holdup(r, None, 1)["bootstrap"]
    lo, hi = b["sharpe"]["ci95"]
    assert lo < true_daily * math.sqrt(252) < hi
    assert b["sharpe"]["ci80"][0] > lo and b["sharpe"]["ci80"][1] < hi
    assert sum(b["histogram"]["counts"]) == b["n"] == 1000
    assert len(b["histogram"]["edges"]) == len(b["histogram"]["counts"]) + 1


def test_multiple_testing_corrections_are_monotone(market):
    strat, *_ = market
    prev = None
    for n in (1, 2, 5, 20, 100):
        p = H.holdup(strat, None, n, n_boot=50)["p_values"]
        assert p["raw"] <= p["sidak"] <= p["bonferroni"] <= 1
        if prev:
            assert p["bonferroni"] >= prev["bonferroni"] and p["sidak"] >= prev["sidak"]
        prev = p


def test_holm_step_down():
    out = H.holm({"a": 0.01, "b": 0.04, "c": 0.03})
    adj = {x["name"]: x["adjusted"] for x in out}
    assert adj == {"a": 0.03, "c": 0.06, "b": 0.06}


def test_regimes_flag_where_it_wins():
    idx = pd.bdate_range("2005-01-03", "2014-12-31")
    n = len(idx)
    rng = np.random.default_rng(1)
    bench = pd.Series(rng.normal(0.0003, 0.01, n), idx)
    # Beats the benchmark during the 2008 crisis, loses by a little every other day.
    crisis = (idx >= "2007-10-09") & (idx <= "2009-03-09")
    strat = bench.copy()
    strat[crisis] += 0.002
    strat[~crisis] -= 0.0002
    h = H.holdup(strat, bench, 1, n_boot=50)
    fam = {f["family"]: f for f in h["regimes"]}
    gfc = next(i for i in fam["crises"]["items"] if i["key"] == "global_financial_crisis")
    assert gfc["wins"] is True
    assert {i["key"]: i["wins"] for i in fam["decades"]["items"]}["2010s"] is False
    assert not fam["rates"]["available"] and fam["rates"]["reason"] == "no_rate_series"
    assert fam["volatility"]["available"]
    keys = {m["key"]: m for m in h["must_be_true"]}
    assert keys["not_reliant_on_crises"]["holds"] is False


def test_drawdowns_and_worst_periods():
    idx = pd.bdate_range("2010-01-01", periods=600)
    r = pd.Series(0.001, idx)
    r.iloc[100:120] = -0.01  # first drawdown, recovers
    r.iloc[400:450] = -0.01  # deeper, recovers later or not
    w = H.worst_periods(r, None)
    dd = w["drawdowns"]
    assert dd[0]["depth"] == pytest.approx(0.99 ** 50 - 1, rel=1e-6)
    assert dd[0]["start"] == idx[399].date().isoformat()
    assert dd[1]["recovery"] is not None
    assert w["worst_12m"]["return"] < 0


def test_missing_series_are_named_not_invented(market):
    strat, *_ = market
    h = H.holdup(strat, None, 1, n_boot=50, reasons={"bonds": "no cached bond.TR10"})
    assert h["sources"]["bonds"] == {"name": None, "available": False,
                                     "reason": "no cached bond.TR10"}
    assert h["rolling_correlation"] is None
    assert h["equity_vs_benchmark"]["benchmark"] is None


def test_too_short_returns_none():
    idx = pd.bdate_range("2020-01-01", periods=10)
    assert H.holdup(pd.Series(0.001, idx)) is None


def test_fast_enough(market):
    import time
    strat, stocks, bonds, rates = market
    t = time.perf_counter()
    H.holdup(strat, stocks, 10, stocks, bonds, rates)
    assert time.perf_counter() - t < 2.0
