"""One backtester for every strategy.

Timing: weights decided at the close of day t are held over day t+1. Costs are
charged on every change in position. For currencies we also credit or debit the
interest rate gap (the carry), because a real forward or spot-next position earns
or pays it. Leaving it out would make carry look like it loses money.

Volatility targeting, when on, rescales the whole portfolio using only past
returns so a currency book can be compared with the S&P 500 at the same risk.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd

from ..data import store
from ..strategies.base import Strategy

TRADING_DAYS = 252
BORROW_SPREAD = 0.005  # 50 bp a year over the T-bill on borrowed money

# Research factors are paper portfolios: their published returns ignore the cost of
# trading the stocks inside them. Holding one is charged this much a year per unit
# held. Rough figures in line with the size of costs in Novy-Marx and Velikov (2016),
# "A Taxonomy of Anomalies and Their Trading Costs": low for slow factors, high for
# momentum and very high for short-term reversal. An assumption, see DEC-0014.
FACTOR_COST = {"factor.SMB": 0.005, "factor.HML": 0.007, "factor.RMW": 0.007,
               "factor.CMA": 0.007, "factor.LTREV": 0.01, "factor.MOM": 0.03,
               "factor.STREV": 0.10}


@dataclass
class BacktestConfig:
    start: str | None = "1999-01-04"  # first trading day of the euro
    end: str | None = None
    cost_bps: float = 1.0  # one-way cost per unit of notional traded, in basis points
    include_carry: bool = True
    target_vol: float | None = None  # annualised, e.g. 0.15 to match the S&P 500
    vol_lookback: int = 60
    max_leverage: float = 4.0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class BacktestResult:
    strategy: str
    config: BacktestConfig
    returns: pd.Series  # daily total returns, net of costs and financing (for CAGR, drawdown)
    excess_returns: pd.Series  # returns above the T-bill (for Sharpe and every test)
    gross_returns: pd.Series  # before costs
    weights: pd.DataFrame  # weights actually held each day, after vol scaling
    turnover: pd.Series  # sum of absolute weight changes each day
    asset_returns: pd.DataFrame = field(repr=False)

    @property
    def equity(self) -> pd.Series:
        return (1 + self.returns).cumprod()


def realised(panel: pd.DataFrame, key: str) -> pd.Series | None:
    """The rate a position actually earned on each day.

    Monthly rates are moved to the day they were published so signals cannot see
    them early (`published_after` in the catalog). Money earned on a position is a
    different question: a forward held in March earns March's rates, which the
    market knew at the time even though the monthly average came out in April. The
    data store keeps that undelayed copy under ``realised.<key>``; synthetic panels
    without it fall back to the delayed column."""
    col = store.REALISED + key
    if col in panel:
        return panel[col]
    return panel[key] if key in panel else None


def cash_yield(panel: pd.DataFrame) -> pd.Series | None:
    """What cash earns each day, percent per year: the 3-month T-bill, the same rate
    excess returns are measured against, so a day in cash scores exactly zero. The
    US 3-month interbank rate fills only the days the T-bill is missing."""
    tbill = panel["rate.TBILL3M"] if "rate.TBILL3M" in panel else None
    usd = realised(panel, "rate.USD")
    if tbill is None:
        return usd
    return tbill if usd is None else tbill.fillna(usd)


def asset_returns(panel: pd.DataFrame, instruments: list[str], include_carry: bool
                  ) -> pd.DataFrame:
    """Daily returns per instrument. `cash.USD` earns the T-bill (see `cash_yield`), so
    strategies that step out of the market are neither penalised nor flattered."""
    priced = [c for c in instruments if c != "cash.USD"]
    px = panel[priced]
    rets = px.pct_change(fill_method=None)
    # A percent change through zero means nothing: WTI spot closed at -$37 on 20 April
    # 2020. Days where either price is at or below zero earn nothing instead.
    rets = rets.where((px > 0) & (px.shift(1) > 0))
    if "cash.USD" in instruments:
        rets["cash.USD"] = _daily(cash_yield(panel), panel.index)
        rets = rets[instruments]
    # Carry accrues at the rates of the days the position is held, not the delayed
    # copies signals see (see `realised`).
    if include_carry and "rate.USD" in panel:
        usd = realised(panel, "rate.USD")
        for col in instruments:
            if col.startswith("fx."):
                rate_col = "rate." + col.split(".", 1)[1]
                if rate_col in panel:
                    gap = (realised(panel, rate_col) - usd) / 100 / TRADING_DAYS
                    rets[col] = rets[col] + gap.fillna(0.0)
    # Currencies priced from ECB reference rates (xfx.*) carry the central bank policy
    # rate gap (BIS), the only rate we have for all of them. A proxy: forward points
    # follow money market rates, which sit near but not at the policy rate (DEC-0027).
    if include_carry and "policy.USD" in panel:
        for col in instruments:
            if col.startswith("xfx."):
                rate_col = "policy." + col.split(".", 1)[1]
                if rate_col in panel:
                    gap = (panel[rate_col] - panel["policy.USD"]) / 100 / TRADING_DAYS
                    rets[col] = rets[col] + gap.fillna(0.0)
    return rets.fillna(0.0)


def run(strategy: Strategy, panel: pd.DataFrame, config: BacktestConfig | None = None
        ) -> BacktestResult:
    config = config or BacktestConfig()
    instruments = strategy.instruments()
    target = strategy.weights(panel).reindex(columns=instruments).fillna(0.0)

    rets = asset_returns(panel, instruments, config.include_carry)
    held = target.shift(1).fillna(0.0)
    # A strategy may set a higher cost floor than the run's, for wide or thin markets.
    cost_bps = max(config.cost_bps, getattr(strategy, "min_cost_bps", 0.0))

    if config.target_vol:
        raw = (held * rets).sum(axis=1)
        realised = raw.rolling(config.vol_lookback).std() * np.sqrt(TRADING_DAYS)
        scale = (config.target_vol / realised.replace(0.0, np.nan)).shift(1)
        scale = scale.clip(upper=config.max_leverage).fillna(0.0)
        held = held.mul(scale, axis=0)

    window = slice(config.start, config.end)
    held, rets = held.loc[window], rets.loc[window]

    turnover = held.diff().abs().sum(axis=1)
    if len(turnover):
        turnover.iloc[0] = held.iloc[0].abs().sum()
    gross = (held * rets).sum(axis=1)
    rf = risk_free(panel, held.index)
    # Funded strategies pay the T-bill plus a spread on anything borrowed (long funded
    # exposure above 100%). Self-financing currency books earn the T-bill on collateral.
    # Currency positions and research factors are zero-cost long-short books: they need
    # margin, not borrowed money.
    funded_cols = [c for c in held.columns if not c.startswith(("fx.", "xfx.", "factor."))]
    borrowed = (held[funded_cols].clip(lower=0).sum(axis=1) - 1).clip(lower=0) \
        if funded_cols else 0.0
    financing = borrowed * (rf + BORROW_SPREAD / TRADING_DAYS)
    drag = [c for c in held.columns if c in FACTOR_COST]
    inside = sum(held[c].abs() * FACTOR_COST[c] / TRADING_DAYS for c in drag) if drag else 0.0
    # Short legs of stock pairs pay a borrow fee, a year's rate charged daily on the short
    # value (DEC-0075). Currencies and research factors have no stock to borrow.
    fee = getattr(strategy, "borrow_bps", 0.0) / 1e4
    short_cols = [c for c in held.columns if not c.startswith(("fx.", "xfx.", "factor."))]
    borrow = (held[short_cols].clip(upper=0).abs().sum(axis=1) * fee / TRADING_DAYS
              if fee and short_cols else 0.0)
    net = gross - turnover * cost_bps / 1e4 - financing - inside - borrow
    if not getattr(strategy, "funded", False):
        net = net + rf

    # Drop the warm-up period before the strategy first holds anything.
    active = held.abs().sum(axis=1) > 0
    if active.any():
        first = active.idxmax()
        net, gross, held, turnover, rets, rf = (x.loc[first:] for x in (
            net, gross, held, turnover, rets, rf))

    return BacktestResult(strategy.name, config, net.rename(strategy.name),
                          (net - rf).rename(strategy.name), gross, held, turnover, rets)


def _daily(rate: pd.Series | None, index: pd.DatetimeIndex) -> pd.Series:
    """A percent-per-year rate as a daily return, known at the start of each day."""
    if rate is None:
        return pd.Series(0.0, index=index)
    return (rate.shift(1) / 100 / TRADING_DAYS).reindex(index).ffill().fillna(0.0)


def risk_free(panel: pd.DataFrame, index: pd.DatetimeIndex) -> pd.Series:
    """Daily T-bill return, known at the start of each day. Identical to what
    `cash.USD` earns, so holding cash is worth exactly zero excess return."""
    return _daily(cash_yield(panel), index)
