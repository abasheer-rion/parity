"""The edge families from the wider data (DEC-0025): publication lags, the FOMC
calendar, the cost floor, T-bill cash and policy-rate carry."""

from __future__ import annotations

import random

import numpy as np
import pandas as pd
from test_factory import CUTS, PANEL

from parity import search
from parity.backtest.engine import BacktestConfig, asset_returns, run
from parity.data import catalog, store
from parity.data.fomc import FOMC_DAYS
from parity.strategies import _signals as S
from parity.strategies import get


def test_cot_is_used_the_monday_after_its_friday_release(tmp_path):
    """Tuesday's positions reach the panel on Friday (catalog lag) and the signal on
    Monday (the CFTC releases after the noon fixing)."""
    spec = catalog.get("cot.EUR_PCT")
    path = store._path(spec, tmp_path)
    path.parent.mkdir(parents=True)
    tuesdays = pd.date_range("2020-01-07", periods=200, freq="W-TUE")
    vals = np.r_[np.zeros(190), np.full(10, 50.0)]  # one jump, on Tuesday 190
    pd.Series(vals, index=tuesdays, name="v").to_frame().to_parquet(path)
    panel = store.panel(["cot.EUR_PCT"], root=tmp_path)
    jump = tuesdays[190]
    assert panel["cot.EUR_PCT"].loc[jump + pd.offsets.BDay(2)] == 0.0  # Thursday: unknown
    assert panel["cot.EUR_PCT"].loc[jump + pd.offsets.BDay(3)] == 50.0  # Friday: released
    z = S.cot_z(panel, ["EUR"], 260)["EUR"]
    assert not z.loc[jump + pd.offsets.BDay(3)] > 0  # Friday: not acted on yet
    assert z.loc[jump + pd.offsets.BDay(4)] > 3  # Monday


def test_publication_lags_for_the_wider_macro_series():
    lags = {"risk.NFCI": 3, "risk.STLFSI": 4, "macro.CLAIMS": 4, "curve.EA_AAA_2Y": 1}
    for key, days in lags.items():
        assert catalog.get(key).lag_days == days, key
    for key in [k for k in catalog.CATALOG if k.startswith("cot.")]:
        assert catalog.get(key).lag_days == 3, key


def test_fomc_calendar_is_eight_scheduled_days_a_year():
    years = pd.Series(FOMC_DAYS.year).value_counts()
    assert set(years.loc[1994:2019]) == {8}
    assert years.loc[2020] == 7  # March 2020's meeting was cancelled, not counted
    assert FOMC_DAYS.is_monotonic_increasing and FOMC_DAYS.dayofweek.max() <= 4
    idx = pd.bdate_range("2015-01-01", "2015-12-31")
    held = idx[S.pre_fomc(idx).to_numpy()] + pd.offsets.BDay(1)
    assert set(held) == set(FOMC_DAYS[FOMC_DAYS.year == 2015])


def test_fomc_week_zero_starts_the_day_before():
    idx = pd.bdate_range("2024-01-24", "2024-02-09")
    week = S.fomc_week(idx)  # the week of the NEXT business day (2024-01-31 was FOMC)
    assert week.loc["2024-01-29"] == 0  # held on 30 Jan, the day before
    assert week.loc["2024-01-26"] == 6
    assert week.loc["2024-02-05"] == 1  # held on 6 Feb, four days after


def test_new_search_samplers_never_look_ahead():
    r = random.Random(7)
    specs = [search._positioning(r) for _ in range(6)] + [search._policy(r) for _ in range(6)]
    specs += [{"kind": "timing", "rule": rule, "param": p, "fallback": "cash",
               "leverage": 1.0, "rebalance": "W"} for rule, p in
              [("stress_below", 0.0), ("conditions_easing", 65), ("claims_calm", 0.2),
               ("spx_not_crowded", 1.0), ("fomc_week", 0)]]
    for spec in specs:
        strat = search.build(spec)
        assert search.describe(spec)["name"]
        cols = sorted(set(strat.required()) | {"rate.USD", "rate.TBILL3M", "eq.US_TOTAL"})
        full = strat.weights(PANEL[cols])
        part = strat.weights(PANEL.loc[:CUTS[1], cols])
        a = full.loc[:CUTS[1]].reindex(columns=part.columns)
        assert np.allclose(a.values, part.values, equal_nan=True, atol=1e-9), spec


def _panel(n=300):
    idx = pd.bdate_range("2010-01-01", periods=n)
    return pd.DataFrame({"rate.USD": 2.0, "rate.TBILL3M": 1.0, "policy.USD": 1.0,
                         "policy.TRY": 11.0, "xfx.TRY": 1.0, "eq.US_TOTAL": 100.0},
                        index=idx)


def test_xfx_positions_earn_the_policy_rate_gap():
    rets = asset_returns(_panel(), ["xfx.TRY"], include_carry=True)
    assert np.isclose(rets["xfx.TRY"].iloc[5], 0.10 / 252)


def test_tbill_cash_scores_zero_excess_and_the_cost_floor_holds():
    strat = get("stocks_pre_fomc")
    assert strat.cash_rate == "rate.TBILL3M"
    panel = _panel()
    res = run(strat, panel, BacktestConfig(start=None, cost_bps=0.0))
    ex = res.excess_returns
    cash_days = ~ex.index.isin(FOMC_DAYS)
    assert cash_days.sum() > 200
    assert np.allclose(ex[cash_days].to_numpy(), 0.0, atol=1e-12)  # cash is the T-bill
    wide = get("xfx_policy_carry_wide")
    assert wide.min_cost_bps == 5.0
