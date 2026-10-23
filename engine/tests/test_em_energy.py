"""Emerging market currencies, rolled energy futures and the oil variance index:
parsers, roll detection, index arithmetic and the strategies built on them."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from parity import strategies
from parity.backtest import BacktestConfig, run
from parity.data import catalog, futures, sources
from parity.strategies.base import Strategy

# ---------------------------------------------------------------- parsers

EIA_HTML = """<table>
<tr> <td class='B6'>&nbsp;&nbsp;2020 Apr-20 to Apr-24</td> <td class='B3'>-37.63</td>
<td class='B3'>10.01</td> <td class='B3'>13.78</td> <td class='B3'>16.50</td>
<td class='B3'>16.94</td> </tr>
<tr> <td height='3'></td> <td></td> <td></td> <td></td> <td></td> <td></td> </tr>
<tr> <td class='B6'>&nbsp;&nbsp;2020 Dec-28 to Jan- 1</td> <td class='B3'>47.62</td>
<td class='B3'>48.00</td> <td class='B3'>48.40</td> <td class='B3'>48.52</td>
<td class='B3'></td> </tr>
</table>"""


def test_eia_rows_become_daily_prices_and_skip_holidays():
    s = sources.parse_eia_html(EIA_HTML, catalog.get("curve.CL1"))
    assert s.loc["2020-04-20"] == -37.63
    assert s.loc["2020-04-24"] == 16.94
    # A week that crosses the new year keeps counting days from its Monday.
    assert s.loc["2020-12-31"] == 48.52
    assert pd.Timestamp("2021-01-01") not in s.index  # blank cell: exchange holiday
    assert len(s) == 9


def test_eia_page_without_prices_is_an_error():
    with pytest.raises(ValueError):
        sources.parse_eia_html("<html>moved</html>", catalog.get("curve.CL1"))


def test_ecb_rates_are_turned_into_usd_per_unit():
    text = ("CURRENCY,TIME_PERIOD,OBS_VALUE\n"
            "USD,2024-01-02,1.10\nTRY,2024-01-02,5.50\n"
            "USD,2024-01-03,1.20\nTRY,2024-01-03,6.00\nTRY,2024-01-04,6.10\n")
    s = sources.parse_ecb_csv(text, catalog.get("fx.TRY"))
    assert s.loc["2024-01-02"] == pytest.approx(1.10 / 5.50)
    assert s.loc["2024-01-03"] == pytest.approx(0.20)
    assert pd.Timestamp("2024-01-04") not in s.index  # no USD rate that day


def test_oecd_monthly_averages_are_used_a_week_after_the_month_ends():
    text = "TIME_PERIOD,OBS_VALUE\n2024-01,11.2\n2024-02,11.1\n"
    s = sources.parse_oecd_csv(text, catalog.get("rate.MXN"))
    assert list(s.index) == [pd.Timestamp("2024-01-01"), pd.Timestamp("2024-02-01")]
    assert s.iloc[0] == 11.2
    # Same delay as the G10 copies of this OECD data (EXP-0005 on main).
    assert catalog.get("rate.MXN").published_after == catalog.get("rate.EUR").published_after == 5


def test_em_policy_rates_reuse_the_bis_series_fetched_for_policy():
    rate, policy = catalog.get("rate.TRY"), catalog.get("policy.TRY")
    assert (rate.source, rate.code) == (policy.source, policy.code)
    assert rate.frequency == "M"  # held until the next decision, not dropped after five days


# ---------------------------------------------------------------- futures


# NYMEX holidays in the windows tested below; the EIA leaves these days blank.
HOLIDAYS = ["2016-03-25", "2019-11-28", "2019-12-25", "2020-01-01", "2020-04-10"]


def _trading_days(start, end):
    days = pd.bdate_range(start, end)
    return days[~days.isin(pd.to_datetime(HOLIDAYS))]


@pytest.mark.parametrize("rule,expired", [
    ("cl", "2020-04-21"),  # May 2020 WTI, the contract that settled at -37.63 the day before
    ("cl", "2019-12-19"),  # 25 December a holiday: 3 days before Tuesday 24th
    ("cl", "2016-03-21"),  # 25 March was Good Friday: 3 days before Thursday 24th
    ("ng", "2020-01-29"),  # February 2020 gas: third last trading day of January
    ("ng", "2019-11-26"),  # Thanksgiving 28 November: 26, 27, 29 are the last three days
    ("last_bday", "2020-01-31"),
])
def test_roll_days_match_real_nymex_expiries(rule, expired):
    days = _trading_days("2016-01-01", "2020-05-29")
    rolls = futures.roll_days(days, rule)
    nxt = days[days.searchsorted(pd.Timestamp(expired), side="right")]
    assert nxt in rolls
    assert ((rolls > pd.Timestamp(expired) - pd.Timedelta(days=20))
            & (rolls <= nxt)).sum() == 1  # exactly one roll for that contract


def test_no_roll_is_invented_for_a_month_the_data_does_not_finish():
    days = _trading_days("2024-01-01", "2024-04-05")  # the EIA's last day
    for rule in ("cl", "ng", "last_bday"):
        # 1 April is March's roll (last_bday); nothing may come from April's own expiry.
        assert (futures.roll_days(days, rule) > "2024-04-01").sum() == 0


def _synthetic_curve(seed: int = 1):
    """Monthly contracts with their own price paths, expiring by the WTI rule on a
    calendar with holidays; contract n is the n-th contract not yet expired."""
    rng = np.random.default_rng(seed)
    days = _trading_days("2019-01-01", "2020-12-31")
    expiries = [days[days.get_loc(r) - 1] for r in futures.roll_days(days, "cl")]
    expiries.append(pd.Timestamp("2021-12-31"))
    n_contracts = len(expiries) + 3
    base = np.exp(np.cumsum(rng.normal(0, 0.01, len(days))))
    contracts = [pd.Series(base * (1 + 0.03 * i) * np.exp(rng.normal(0, 0.002, len(days))),
                           index=days) for i in range(n_contracts)]
    expiry_of = expiries + [pd.Timestamp("2099-01-01")] * 3
    live = [[i for i in range(n_contracts) if expiry_of[i] >= d] for d in days]
    curve = {n: pd.Series([contracts[lv[n - 1]][d]
                           for d, lv in zip(days, live, strict=True)], index=days)
             for n in (1, 2, 3)}
    # The expiring contract misbehaves on its last day, as WTI did in April 2020.
    for e in expiries:
        if e in days:
            curve[1].loc[e] = -37.63
    held = []  # the true return: contract 2 as of yesterday, priced today
    for i in range(1, len(days)):
        c = live[i - 1][1]
        held.append(contracts[c].iloc[i] / contracts[c].iloc[i - 1] - 1)
    truth = (1 + pd.Series([0.0] + held, index=days)).cumprod()
    rolls = pd.DatetimeIndex([days[i] for i in range(1, len(days))
                              if live[i][0] != live[i - 1][0]])
    return curve, truth, rolls


def test_prices_agree_with_the_calendar_on_roll_days():
    curve, _, true_rolls = _synthetic_curve()
    found = futures.roll_days(curve[1].index, "cl")
    assert list(found) == list(true_rolls)
    assert futures.roll_fit(curve[1], curve[2], curve[3], found) > 0.8
    # A calendar that is off by two days fits the prices much worse.
    shifted = pd.DatetimeIndex([curve[1].index[curve[1].index.get_loc(d) + 2] for d in found
                                if curve[1].index.get_loc(d) + 2 < len(curve[1])])
    assert futures.roll_fit(curve[1], curve[2], curve[3], shifted) < 0.5


def test_rolled_index_earns_the_held_contracts_return_and_never_the_expiring_one():
    curve, truth, _ = _synthetic_curve()
    idx = futures.rolled_index(curve[1], curve[2], "cl", roll_cost_bps=0.0)
    daily = idx.pct_change().dropna()
    assert daily.abs().max() < 0.06  # the -37.63 prints never enter
    np.testing.assert_allclose(idx.values, truth.loc[idx.index].values, rtol=1e-9)


def test_a_roll_on_a_day_without_both_prices_is_taken_on_the_next_priced_day():
    curve, _, true_rolls = _synthetic_curve()
    gap = true_rolls[5]
    c1 = curve[1].drop(gap)  # contract 1 has no price on the roll day, as in the EIA data
    idx = futures.rolled_index(c1, curve[2], "cl", roll_cost_bps=0.0)
    before, after = c1.index[c1.index < gap][-1], c1.index[c1.index > gap][0]
    # The held contract is quoted as contract 1 by then; contract 2 is already the next one.
    assert idx[after] / idx[before] - 1 == pytest.approx(c1[after] / curve[2][before] - 1)
    assert abs(idx.pct_change().dropna()).max() < 0.06


def test_roll_cost_is_charged_once_per_roll():
    curve, _, true_rolls = _synthetic_curve()
    free = futures.rolled_index(curve[1], curve[2], "cl", roll_cost_bps=0.0)
    paid = futures.rolled_index(curve[1], curve[2], "cl", roll_cost_bps=10.0)
    gap = (free.pct_change() - paid.pct_change()).dropna()
    charged = gap[gap > 1e-12]
    assert list(charged.index) == list(true_rolls)
    assert charged.round(10).unique().tolist() == [0.001]


def test_curve_carry_is_positive_in_backwardation():
    c2 = pd.Series([50.0, 50.0], index=pd.bdate_range("2024-01-01", periods=2))
    assert futures.curve_carry(c2, c2 * 0.99).gt(0).all()
    assert futures.curve_carry(c2, c2 * 1.01).lt(0).all()


def test_short_variance_keeps_the_premium_when_nothing_moves():
    days = pd.bdate_range("2024-01-01", "2024-03-29")
    iv = pd.Series(30.0, index=days)
    flat = pd.Series(100.0, index=days)
    idx = futures.variance_swap_index(iv, flat, vega=0.002)
    month_ends = idx.groupby(idx.index.to_period("M")).last()
    # January has no strike yet; February and March each earn N_var * K = 0.002 / 60 * 900.
    assert month_ends.round(10).tolist() == [1.03, round(1.03 ** 2, 10)]


def test_short_variance_loses_when_realised_beats_implied_and_stops_at_zero():
    days = pd.bdate_range("2024-01-01", "2024-04-30")
    iv = pd.Series(20.0, index=days)
    wild = pd.Series(np.where(np.arange(len(days)) % 2, 150.0, 50.0), index=days)
    idx = futures.variance_swap_index(iv, wild, vega=0.002)
    assert idx.loc["2024-02"].iloc[0] < 1.0
    assert (idx >= 0).all()
    assert idx.iloc[-1] == 0.0  # once the losses exceed the capital, the index stays at zero


# ---------------------------------------------------------------- strategies


def test_em_carry_holds_the_highest_rates_and_drops_unquoted_currencies(panel):
    w = strategies.get("em_fx_carry").weights(panel)
    day = w.index[-1]
    held = w.loc[day][w.loc[day] > 0]
    # conftest gives later currencies in catalog.EM_RATED higher rates; RUB is no longer quoted.
    expected = [f"fx.{c}" for c in catalog.EM_RATED if c != "RUB"][-6:]
    assert sorted(held.index) == sorted(expected)
    assert held.sum() == pytest.approx(1.0)
    assert w.loc[day, "fx.RUB"] == 0.0


def test_em_carry_skips_currencies_below_min_carry(panel):
    p = panel.copy()
    for c in catalog.EM_RATED:
        p[f"rate.{c}"] = p["rate.USD"] + 0.5  # every gap below the 1 point floor
    assert strategies.get("em_fx_carry").weights(p).abs().sum().sum() == 0.0


def test_em_basket_is_equal_weight_over_quoted_currencies(panel):
    w = strategies.get("em_fx_basket").weights(panel)
    last = w.iloc[-1]
    assert last.sum() == pytest.approx(1.0)
    assert last[last > 0].nunique() == 1
    assert last["fx.RUB"] == 0.0


def test_em_momentum_is_dollar_neutral(panel):
    w = strategies.get("em_fx_momentum").weights(panel)
    active = w[w.abs().sum(axis=1) > 0]
    assert len(active) > 100
    np.testing.assert_allclose(active.sum(axis=1), 0.0, atol=1e-12)
    np.testing.assert_allclose(active.abs().sum(axis=1), 1.0)


def test_energy_carry_is_long_backwardation_and_short_contango(panel):
    p = panel.copy()
    for sym, c in zip(catalog.ENERGY, [0.3, 0.1, -0.1, -0.3], strict=True):
        p[f"carry.{sym}"] = c
    last = strategies.get("energy_carry").weights(p).iloc[-1]
    assert last["fut.CL"] > 0 and last["fut.HO"] > 0
    assert last["fut.RB"] < 0 and last["fut.NG"] < 0


def test_oil_variance_stands_aside_when_volatility_is_high(panel):
    p = panel.copy()
    p["risk.OVX"] = 90.0
    capped = strategies.get("oil_variance_short", max_ovx=60.0).weights(p)
    assert capped.abs().sum().sum() == 0.0
    always = strategies.get("oil_variance_short").weights(p)  # the registered default
    assert always.iloc[-1, 0] == 1.0


def test_commodity_fx_signal_points_energy_the_same_way(panel):
    p = panel.copy()
    for c in ["AUD", "CAD", "NZD", "ZAR"]:
        p[f"fx.{c}"] = np.linspace(1.0, 2.0, len(p))  # commodity currencies rising
    last = strategies.get("commodity_fx_leads_energy").weights(p).iloc[-1]
    assert (last > 0).all()


NEW = ["em_fx_carry", "em_fx_basket", "em_fx_momentum", "energy_tsmom", "energy_carry",
       "oil_variance_short", "commodity_fx_leads_energy"]


def _variants():
    """Defaults plus every single setting the gauntlet's sensitivity test will try."""
    for name in NEW:
        yield name, {}
        for key, values in strategies.available()[name].param_grid.items():
            for v in values:
                yield name, {key: v}


@pytest.mark.parametrize("name,params", list(_variants()))
def test_new_strategies_do_not_look_ahead(panel, name, params):
    """Changing every input after a date must not change any weight up to that date."""
    strat = strategies.get(name, **params)
    # Three days after a month end, so a rule peeking a few days ahead would move that
    # month end's weights, which are the ones held.
    month_ends = panel.index[panel.index.to_series().dt.is_month_end]
    cut = panel.index[panel.index.get_loc(month_ends[month_ends > panel.index[1000]][0]) + 3]
    changed = panel.copy()
    later = changed.index > cut
    # A different change per column, so rankings across instruments change too.
    k = np.arange(changed.shape[1])
    changed.loc[later] = changed.loc[later] * (1 + 0.3 * (k % 7)) + 0.05 * (k % 3)
    before = strat.weights(panel).loc[:cut]
    after = strat.weights(changed).loc[:cut]
    pd.testing.assert_frame_equal(before, after)


class _LongFutures(Strategy):
    name = "_long_futures"
    summary = "test helper"
    max_gross = 2.0

    def instruments(self):
        return ["fut.CL"]

    def weights(self, panel):
        return pd.DataFrame(2.0, index=panel.index, columns=["fut.CL"])


def test_futures_above_100_percent_are_not_charged_as_borrowing(panel):
    res = run(_LongFutures(), panel, BacktestConfig(start=None, cost_bps=0))
    day = res.returns.index[10]
    rf = panel["rate.TBILL3M"].shift(1) / 100 / 252 if "rate.TBILL3M" in panel \
        else panel["rate.USD"].shift(1) / 100 / 252
    expected = 2 * panel["fut.CL"].pct_change()[day] + rf[day]
    assert res.returns[day] == pytest.approx(expected)
