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

from ..strategies.base import Strategy

TRADING_DAYS = 252
BORROW_SPREAD = 0.005  # 50 bp a year over the T-bill on borrowed money


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


def asset_returns(panel: pd.DataFrame, instruments: list[str], include_carry: bool) -> pd.DataFrame:
    """Daily returns per instrument. `cash.USD` earns the US 3-month rate, so strategies
    that step out of the market are not penalised for holding cash."""
    priced = [c for c in instruments if c != "cash.USD"]
    rets = panel[priced].pct_change(fill_method=None)
    if "cash.USD" in instruments:
        rets["cash.USD"] = panel["rate.USD"].shift(1) / 100 / TRADING_DAYS
        rets = rets[instruments]
    if include_carry and "rate.USD" in panel:
        for col in instruments:
            if col.startswith("fx."):
                rate_col = "rate." + col.split(".", 1)[1]
                if rate_col in panel:
                    gap = (panel[rate_col] - panel["rate.USD"]) / 100 / TRADING_DAYS
                    rets[col] = rets[col] + gap.fillna(0.0)
    return rets.fillna(0.0)


def run(strategy: Strategy, panel: pd.DataFrame, config: BacktestConfig | None = None
        ) -> BacktestResult:
    config = config or BacktestConfig()
    instruments = strategy.instruments()
    target = strategy.weights(panel).reindex(columns=instruments).fillna(0.0)

    rets = asset_returns(panel, instruments, config.include_carry)
    held = target.shift(1).fillna(0.0)

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
    funded_cols = [c for c in held.columns if not c.startswith("fx.")]
    borrowed = (held[funded_cols].clip(lower=0).sum(axis=1) - 1).clip(lower=0) \
        if funded_cols else 0.0
    financing = borrowed * (rf + BORROW_SPREAD / TRADING_DAYS)
    net = gross - turnover * config.cost_bps / 1e4 - financing
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


def risk_free(panel: pd.DataFrame, index: pd.DatetimeIndex) -> pd.Series:
    """Daily T-bill return, known at the start of each day."""
    col = "rate.TBILL3M" if "rate.TBILL3M" in panel else "rate.USD"
    if col not in panel:
        return pd.Series(0.0, index=index)
    return (panel[col].shift(1) / 100 / TRADING_DAYS).reindex(index).ffill().fillna(0.0)
