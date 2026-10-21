"""The strengths and weaknesses report, on hand-made runs so no data is needed."""

from __future__ import annotations

import numpy as np
import pandas as pd

from parity.analysis import analyse, cost_table, to_markdown


def _equity(weekly_returns, start="1999-01-01"):
    idx = pd.date_range(start, periods=len(weekly_returns), freq="W-FRI")
    eq = np.cumprod(1 + np.asarray(weekly_returns))
    return [[d.date().isoformat(), float(v)] for d, v in zip(idx, eq, strict=True)]


def _runs():
    n = 1300  # about 25 years of weeks
    rng = np.random.default_rng(1)
    market = rng.normal(0.0015, 0.02, n)
    idx = pd.date_range("1999-01-01", periods=n, freq="W-FRI")
    crash = (idx >= "2008-01-01") & (idx <= "2009-03-01")
    market[crash] = -0.01  # the market falls steadily through the crisis
    strat = rng.normal(0.001, 0.01, n)
    strat[crash] = 0.004  # and the strategy makes money
    tests = [
        {"id": "A1", "group": "beat", "name": "Better return for the risk", "plain": "",
         "passed": True, "value": "0.6 vs 0.4", "bar": "Sharpe above"},
        {"id": "B4", "group": "real", "name": "Not one lucky year", "plain": "",
         "passed": False, "value": "-0.1 without 2008", "bar": "Sharpe above zero"},
        {"id": "B3", "group": "real", "name": "Not one lucky setting", "plain": "",
         "passed": None, "value": "n/a", "bar": ""},
    ]
    run = {"strategy": "toy", "display_name": "Toy", "description": "A toy.",
           "tags": {"family": "trend", "asset": "fx", "style": "momentum",
                    "horizon": "monthly"},
           "config": {"cost_bps": 1.0},
           "metrics": {"start": "1999-01-01", "end": "2023-12-29", "years": 25, "cagr": 0.05,
                       "sharpe": 0.6, "benchmark_sharpe": 0.4, "max_drawdown": -0.15,
                       "correlation": 0.05, "beta": 0.02, "turnover_per_year": 10.0,
                       "breakeven_cost_bps": 3.0},
           "yearly": {"2008": 0.12, "2009": -0.25, "2010": 0.04, "2011": 0.01},
           "equity": _equity(strat),
           "gauntlet": {"verdict": "Some signs.", "passed": 1, "total": 3,
                        "beats_sp500": False, "tests": tests}}
    bench = {"strategy": "us_market_buy_hold",
             "metrics": {"cagr": 0.07, "sharpe": 0.4, "max_drawdown": -0.5},
             "yearly": {"2008": -0.37, "2009": 0.28, "2010": 0.17, "2011": 0.01},
             "equity": _equity(market)}
    return run, bench


def test_analyse_finds_strengths_and_weaknesses():
    run, bench = _runs()
    a = analyse(run, bench)
    gfc = next(c for c in a["crises"] if c["name"] == "Global financial crisis")
    assert gfc["return"] > 0 > gfc["market"] and gfc["beat_market"]
    assert a["best_years"][0]["year"] == 2008 and a["best_years"][0]["market"] == -0.37
    assert a["worst_years"][0]["year"] == 2009
    joined_s, joined_w = " ".join(a["strengths"]), " ".join(a["weaknesses"])
    assert "Global financial crisis" in joined_s
    assert "on its own" in joined_s  # low correlation
    assert "Smaller worst fall" in joined_s
    assert "one lucky year" in joined_w  # B4 failure in plain words
    assert "wipe out" in joined_w  # breakeven of 3 bps
    assert "Lost -25.0% in 2009" in joined_w
    fails = a["gauntlet"]["failures"]
    assert [f["id"] for f in fails] == ["B4"] and fails[0]["meaning"]
    assert [u["id"] for u in a["gauntlet"]["untested"]] == ["B3"]
    assert a["tags"]["family"] == "trend" and a["display_name"] == "Toy"


def test_cost_table_estimates_without_reruns_and_uses_them_when_given():
    run, _ = _runs()
    est = cost_table(run)
    assert est["estimated"] and [x["cost_bps"] for x in est["levels"]] == [0, 1, 5, 10]
    at = {x["cost_bps"]: x["cagr"] for x in est["levels"]}
    assert at[1] == 0.05 and abs(at[10] - (0.05 - 10 * 9 / 1e4)) < 1e-9
    real = cost_table(run, [{"cost_bps": 0, "cagr": 0.06, "sharpe": 0.7}])
    assert not real["estimated"] and real["levels"][0]["sharpe"] == 0.7


def test_markdown_has_every_section_and_no_em_dash():
    run, bench = _runs()
    md = to_markdown(analyse(run, bench))
    for heading in ("## Strengths", "## Weaknesses", "## Gauntlet", "## In market crises",
                    "## Best and worst years", "## Trading costs", "## Link to the stock market"):
        assert heading in md
    assert "—" not in md


def test_analyse_without_gauntlet_or_equity():
    a = analyse({"strategy": "bare", "metrics": {}}, {"metrics": {}})
    assert a["crises"] == [] and not a["gauntlet"]["ran"] and a["strengths"] == []
    assert "not run" in to_markdown(a)
