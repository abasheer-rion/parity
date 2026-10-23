"""Tradable return series built from futures prices and volatility indices.

The EIA publishes NYMEX settlement prices by position on the curve: contract 1 is
whichever contract expires next, so on the day after an expiry contract 1 jumps to a
different contract. Chaining contract 1 prices therefore mixes contracts and is not a
return anyone earned (the reason EXP-0004 flagged commodity_tsmom).

`rolled_index` instead holds contract 2. When the front contract expires (by the
exchange's rule, counted on the data's own trading days), the held contract becomes
contract 1, and at that day's close the position rolls into the new contract 2. Every
daily return compares the same contract on two days, and the position is never in a
contract during its last month, so the negative WTI settlement of 20 April 2020 (the
expiring May contract) never enters the index.

`variance_swap_index` marks a short 30-day variance swap struck at the square of a VIX-style
index, as an approximation of selling commodity volatility (docs/research/0013).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

TRADING_DAYS = 252

# How each NYMEX contract's last trading day is set, relative to the month before delivery.
EXPIRY_RULES = {"CL": "cl", "HO": "last_bday", "RB": "last_bday", "NG": "ng"}

# Where the rules above do not describe the data. Before 1996 gas contracts in the EIA data
# expire three trading days earlier than today's rule, and in 1996 and 1997 neither rule
# fits the prices consistently (checked with roll_fit on 2026-10-21), so the gas index
# starts in 1998. The registered tests start in 1999 and need one year of history.
INDEX_START = {"NG": "1998-01-01"}


def roll_days(trading_days: pd.DatetimeIndex, rule: str) -> pd.DatetimeIndex:
    """The trading day after each contract's last trading day: the day contract 1 becomes
    the contract that was contract 2.

    The calendar is the data's own trading days. The EIA leaves exchange holidays blank,
    so counting on its dates counts NYMEX business days, holidays included.

    cl:        3 trading days before the 25th, or before the last trading day before the
               25th when the 25th is not a trading day (WTI crude)
    ng:        the third last trading day of the month (Henry Hub gas)
    last_bday: the last trading day of the month (heating oil, RBOB gasoline)
    """
    days = pd.DatetimeIndex(trading_days).sort_values().unique()
    # The data's last month may stop before its expiry; then that expiry is unknown.
    last = days[-1]
    month_done = last >= last + pd.offsets.BMonthEnd(0)
    complete_until = last if month_done else last.to_period("M").start_time - pd.Timedelta(days=1)
    out = []
    for _, month in pd.Series(days, index=days).groupby(days.to_period("M")):
        month = pd.DatetimeIndex(month.values)
        if rule == "cl":
            d25 = month[0].replace(day=25)
            if d25 > days[-1]:
                continue
            before = month[month <= d25]
            if len(before) == 0:
                continue
            anchor = before[-1]
            pos = days.get_loc(anchor) - 3
            if pos < 0:
                continue
            expiry = days[pos]
        elif month[-1] > complete_until:
            continue
        elif rule == "ng":
            if len(month) < 3:
                continue
            expiry = month[-3]
        elif rule == "last_bday":
            expiry = month[-1]
        else:
            raise ValueError(f"Unknown expiry rule {rule}")
        nxt = days.searchsorted(expiry, side="right")
        if nxt < len(days):
            out.append(days[nxt])
    return pd.DatetimeIndex(out)


def roll_fit(c1: pd.Series, c2: pd.Series, c3: pd.Series, rolls: pd.DatetimeIndex) -> float:
    """Share of roll days on which prices agree that the curve moved up one contract.

    "Today's contract 1 is yesterday's contract 2" is compared with "nothing rolled", using
    only contracts 2 and 3 on the earlier day (never the expiring contract). A healthy
    calendar scores well above one half; when the curve is flat both fit about equally, so
    this is a check on the calendar, not a way to find roll days.
    """
    df = pd.concat({"c1": c1, "c2": c2, "c3": c3}, axis=1).dropna()
    lg = np.log(df.where(df > 0))
    prev = lg.shift(1)
    rolled = (lg["c1"] - prev["c2"]).abs() + (lg["c2"] - prev["c3"]).abs()
    stayed = (lg["c2"] - prev["c2"]).abs() + (lg["c3"] - prev["c3"]).abs()
    days = pd.DatetimeIndex(rolls).intersection(df.index[1:])
    if len(days) == 0:
        return float("nan")
    return float((rolled.loc[days] < stayed.loc[days]).mean())


def rolled_index(c1: pd.Series, c2: pd.Series, rule: str = "cl",
                 roll_cost_bps: float = 2.0) -> pd.Series:
    """Excess return index (starts at 1) of holding contract 2 and rolling on roll days.

    `roll_cost_bps` is charged once per roll for selling one contract and buying the next.
    The index earns futures price changes only; collateral interest is added by the
    backtester, as for currencies.
    """
    df = pd.concat({"c1": c1, "c2": c2}, axis=1).dropna()
    # A day with any price is a trading day: single contracts have gaps (heating oil
    # contract 1 misses whole weeks in 2003) that would move the counted expiry.
    rolls = roll_days(c1.dropna().index.union(c2.dropna().index), rule)
    # A roll on a day without both prices shows up on the next day that has them.
    pos = df.index.searchsorted(rolls)
    on_roll = np.zeros(len(df), dtype=bool)
    on_roll[pos[(pos > 0) & (pos < len(df))]] = True
    prev_c2 = df["c2"].shift(1).where(lambda x: x > 0)
    # Yesterday we held contract 2. On a roll day that same contract is quoted as contract 1.
    today = df["c1"].where(on_roll, df["c2"])
    ret = today / prev_c2 - 1
    ret = ret - np.where(on_roll, roll_cost_bps / 1e4, 0.0)
    ret.iloc[0] = 0.0
    return (1 + ret.fillna(0.0)).cumprod()


def curve_carry(c2: pd.Series, c3: pd.Series) -> pd.Series:
    """Annualised slope between contracts 2 and 3: 12 * ln(C2 / C3). Positive when nearer
    delivery costs more (backwardation), which pays a long position as it rolls."""
    df = pd.concat({"c2": c2, "c3": c3}, axis=1).dropna()
    return 12 * np.log(df["c2"].where(df["c2"] > 0) / df["c3"].where(df["c3"] > 0))


def variance_swap_index(implied_vol: pd.Series, futures_index: pd.Series,
                        vega: float = 0.002) -> pd.Series:
    """Index (starts at 1) of selling a variance swap each month and marking it daily.

    At each month's last trading day the position is re-struck at K = implied_vol ** 2
    (vol in percent, as quoted). On day n of an N-day month its value is

        V_n = N_var * (K - 252 / N * sum of squared daily log returns so far * 10000
                       - (N - n) / N * implied_vol_n ** 2)

    with N_var = vega / (2 * implied_vol at strike), so a one point move in volatility at
    the strike costs about `vega` of capital. This is the textbook replication of a
    variance swap with the remaining part priced at today's implied volatility. It has no
    bid and ask, so results are upper bounds.
    """
    df = pd.concat({"iv": implied_vol, "px": futures_index}, axis=1).dropna()
    df["r2"] = np.log(df["px"]).diff() ** 2
    period = df.index.to_period("M")
    # A swap struck at the close of month m-1 runs over the trading days of month m.
    strikes = df["iv"].groupby(period).last().shift(1)
    out = pd.Series(np.nan, index=df.index)
    level = 1.0
    for m, days in df.groupby(period).groups.items():
        k_vol = strikes.get(m)
        if k_vol is None or not np.isfinite(k_vol) or k_vol <= 0:
            continue
        block = df.loc[days]
        n_days = len(block)
        n_var = vega / (2 * k_vol)
        sumsq = block["r2"].cumsum() * 1e4
        remaining = (n_days - np.arange(1, n_days + 1)) / n_days
        value = n_var * (k_vol ** 2 - TRADING_DAYS / n_days * sumsq
                         - remaining * block["iv"] ** 2)
        # A loss beyond the capital ends the strategy: the index stays at zero.
        out.loc[days] = level * np.maximum(1 + value.values, 0.0)
        level = float(out.loc[days].iloc[-1])
        if level <= 0:
            out.loc[out.index > days[-1]] = 0.0
            break
    return out.dropna()
