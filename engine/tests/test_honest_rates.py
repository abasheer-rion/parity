"""Cash earns the rate it is scored against, monthly rates reach signals only once
published, and Commodity trend trades oil only (EXP-0005, DEC-0014, DEC-0027)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from parity.backtest.engine import BacktestConfig, asset_returns, risk_free, run
from parity.data import catalog, store
from parity.strategies import get
from parity.strategies.base import Strategy


class _CashOnly(Strategy):
    name = "_cash_only_tbill"
    summary = "negative control: hold cash"
    funded = True

    def instruments(self):
        return ["cash.USD"]

    def required(self):
        return ["rate.USD"]

    def weights(self, panel):
        return pd.DataFrame(1.0, index=panel.index, columns=["cash.USD"])


def _panel(n=60, tbill=1.0, usd=3.0):
    idx = pd.bdate_range("2010-01-01", periods=n)
    return pd.DataFrame({"rate.USD": usd, "rate.TBILL3M": tbill, "eq.US_TOTAL": 100.0},
                        index=idx)


def test_cash_earns_the_t_bill_not_the_interbank_rate():
    """The interbank rate sits above the T-bill. Cash used to earn it while being
    scored against the T-bill, a free excess return. Now it earns the T-bill."""
    panel = _panel()
    rets = asset_returns(panel, ["cash.USD"], include_carry=True)
    assert np.isclose(rets["cash.USD"].iloc[5], 0.01 / 252)
    res = run(_CashOnly(), panel, BacktestConfig(start=None, cost_bps=0))
    assert np.allclose(res.excess_returns.to_numpy(), 0.0, atol=1e-15)


def test_cash_falls_back_to_the_interbank_rate_only_where_the_t_bill_is_missing():
    panel = _panel()
    panel.loc[panel.index[20:40], "rate.TBILL3M"] = np.nan
    rets = asset_returns(panel, ["cash.USD"], include_carry=True)
    assert np.isclose(rets["cash.USD"].iloc[10], 0.01 / 252)
    assert np.isclose(rets["cash.USD"].iloc[30], 0.03 / 252)
    assert np.isclose(rets["cash.USD"].iloc[50], 0.01 / 252)
    rf = risk_free(panel, panel.index)
    assert np.allclose(rf.to_numpy(), rets["cash.USD"].to_numpy())  # cash scores zero


def test_older_strategies_hold_t_bill_cash_too():
    """An older long-only trend strategy sits in cash part of the time. Those days must
    score zero, not the interbank premium."""
    strat = get("stocks_trend_10m")
    idx = pd.bdate_range("2000-01-03", periods=900)
    px = np.r_[np.linspace(100, 200, 450), np.linspace(200, 60, 450)]
    panel = pd.DataFrame({"eq.US_TOTAL": px, "rate.USD": 3.0, "rate.TBILL3M": 1.0},
                         index=idx)
    res = run(strat, panel, BacktestConfig(start=None, cost_bps=0))
    assert "cash.USD" in res.weights
    in_cash = (res.weights["cash.USD"] > 0.999) & (res.turnover == 0)
    assert in_cash.sum() > 50
    assert np.allclose(res.excess_returns[in_cash].to_numpy(), 0.0, atol=1e-12)


def _write(root, key, values, dates):
    path = store._path(catalog.get(key), root)
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.Series(values, index=dates, name="v").to_frame().to_parquet(path)


def test_monthly_rates_reach_signals_after_the_month_ends(tmp_path):
    """February's average rate is dated 1 February but only known in March. Signals see
    it from a week after the month ends; carry accrues on the realised rate."""
    months = pd.date_range("2020-01-01", periods=6, freq="MS")
    _write(tmp_path, "rate.EUR", [1.0, 2.0, 3.0, 4.0, 5.0, 6.0], months)
    _write(tmp_path, "rate.USD", [0.0] * 6, months)
    assert catalog.get("rate.EUR").published_after == 5
    panel = store.panel(["rate.EUR", "rate.USD"], root=tmp_path)
    assert panel.loc["2020-03-05", "rate.EUR"] == 1.0  # February not yet published
    assert panel.loc["2020-03-16", "rate.EUR"] == 2.0  # February, published 6 March
    assert panel.loc["2020-03-16", store.REALISED + "rate.EUR"] == 3.0  # March itself
    rets = asset_returns(panel.assign(**{"fx.EUR": 1.0}), ["fx.EUR"], include_carry=True)
    assert np.isclose(rets.loc["2020-03-16", "fx.EUR"], 0.03 / 252)


def test_carry_signals_use_only_published_rates(tmp_path):
    """A rate change dated 1 June must not move currency carry's signal before July."""
    months = pd.date_range("2020-01-01", periods=8, freq="MS")
    for c in ["USD", *catalog.G10]:
        _write(tmp_path, f"rate.{c}", [1.0] * 8, months)
    _write(tmp_path, "rate.NZD", [1.0] * 5 + [9.0] * 3, months)  # jumps in June
    panel = store.panel([f"rate.{c}" for c in ["USD", *catalog.G10]], root=tmp_path)
    for c in catalog.G10:
        panel[f"fx.{c}"] = 1.0
    sig = get("fx_carry").signal(panel)
    assert sig.loc["2020-06-15", "fx.NZD"] == 0.0
    assert sig.loc["2020-07-15", "fx.NZD"] > 0.0


def test_commodity_trend_trades_oil_only():
    """Spot gas jumps as much as 85% in a day, which no one can trade."""
    assert get("commodity_tsmom").instruments() == ["cmd.BRENT", "cmd.WTI"]
