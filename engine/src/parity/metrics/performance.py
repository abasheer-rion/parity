"""Performance and robustness numbers. Definitions live in docs/reference/0002-kpis.md; keep the two
in step when either changes.

Sharpe and Sortino here use a zero risk-free rate. That flatters nothing when we
compare against the S&P 500 computed the same way, but the absolute values are a
little higher than a textbook Sharpe would be.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy import stats

TRADING_DAYS = 252
EULER_GAMMA = 0.5772156649


def cagr(returns: pd.Series) -> float:
    if returns.empty:
        return float("nan")
    growth = float((1 + returns).prod())
    years = len(returns) / TRADING_DAYS
    return growth ** (1 / years) - 1 if growth > 0 and years > 0 else float("nan")


def ann_vol(returns: pd.Series) -> float:
    return float(returns.std() * math.sqrt(TRADING_DAYS))


def sharpe(returns: pd.Series) -> float:
    sd = returns.std()
    return float(returns.mean() / sd * math.sqrt(TRADING_DAYS)) if sd > 0 else float("nan")


def sortino(returns: pd.Series) -> float:
    downside = np.sqrt((returns.clip(upper=0) ** 2).mean())
    return float(returns.mean() / downside * math.sqrt(TRADING_DAYS)) if downside > 0 else float(
        "nan")


def drawdown(returns: pd.Series) -> pd.Series:
    equity = (1 + returns).cumprod()
    return equity / equity.cummax() - 1


def max_drawdown(returns: pd.Series) -> float:
    return float(drawdown(returns).min()) if len(returns) else float("nan")


def calmar(returns: pd.Series) -> float:
    mdd = max_drawdown(returns)
    return cagr(returns) / abs(mdd) if mdd < 0 else float("nan")


def hit_rate(returns: pd.Series) -> float:
    traded = returns[returns != 0]
    return float((traded > 0).mean()) if len(traded) else float("nan")


def deflated_sharpe(returns: pd.Series, n_trials: int = 1, sr_variance: float | None = None
                    ) -> float:
    """Probability that the true Sharpe is above zero after accounting for how many
    variants we tried, skew and fat tails (Bailey and Lopez de Prado, 2014).

    Works on daily, not annualised, Sharpe. If the variance of Sharpe ratios across
    trials is unknown we use the sampling variance of a single estimate, which is
    a rough stand-in. Values near 1 are good; below 0.95 means "could be luck".
    """
    r = returns.dropna()
    t = len(r)
    if t < 30 or r.std() == 0:
        return float("nan")
    sr = r.mean() / r.std()
    skew = float(stats.skew(r))
    kurt = float(stats.kurtosis(r, fisher=False))
    if n_trials > 1:
        var = sr_variance if sr_variance is not None else (1 + 0.5 * sr**2) / (t - 1)
        z1 = stats.norm.ppf(1 - 1 / n_trials)
        z2 = stats.norm.ppf(1 - 1 / (n_trials * math.e))
        sr0 = math.sqrt(var) * ((1 - EULER_GAMMA) * z1 + EULER_GAMMA * z2)
    else:
        sr0 = 0.0
    denom = math.sqrt(max(1 - skew * sr + (kurt - 1) / 4 * sr**2, 1e-12))
    return float(stats.norm.cdf((sr - sr0) * math.sqrt(t - 1) / denom))


def relative(returns: pd.Series, benchmark: pd.Series) -> dict:
    """How the strategy behaves next to the benchmark over their common dates."""
    a, b = returns.align(benchmark, join="inner")
    if len(a) < 30:
        return {}
    active = a - b
    te = active.std() * math.sqrt(TRADING_DAYS)
    beta = float(np.cov(a, b)[0, 1] / b.var()) if b.var() > 0 else float("nan")
    return {
        "excess_cagr": cagr(a) - cagr(b),
        "information_ratio": float(active.mean() * TRADING_DAYS / te) if te > 0 else float("nan"),
        "beta": beta,
        "correlation": float(a.corr(b)),
        "benchmark_cagr": cagr(b),
        "benchmark_sharpe": sharpe(b),
    }


def summary(returns: pd.Series, gross: pd.Series | None = None, turnover: pd.Series | None = None,
            benchmark: pd.Series | None = None, n_trials: int = 1) -> dict:
    out = {
        "start": returns.index.min().date().isoformat() if len(returns) else None,
        "end": returns.index.max().date().isoformat() if len(returns) else None,
        "years": round(len(returns) / TRADING_DAYS, 2),
        "cagr": cagr(returns),
        "ann_vol": ann_vol(returns),
        "sharpe": sharpe(returns),
        "sortino": sortino(returns),
        "max_drawdown": max_drawdown(returns),
        "calmar": calmar(returns),
        "hit_rate": hit_rate(returns),
        "deflated_sharpe": deflated_sharpe(returns, n_trials),
    }
    if turnover is not None and len(turnover):
        out["turnover_per_year"] = float(turnover.mean() * TRADING_DAYS)
        if gross is not None and turnover.mean() > 0:
            # Cost per unit traded, in bps, at which the strategy would earn nothing.
            out["breakeven_cost_bps"] = float(gross.mean() / turnover.mean() * 1e4)
    if benchmark is not None:
        out.update(relative(returns, benchmark))
    return {k: (None if isinstance(v, float) and not math.isfinite(v) else v)
            for k, v in out.items()}


def yearly_returns(returns: pd.Series) -> dict[str, float]:
    by_year = (1 + returns).groupby(returns.index.year).prod() - 1
    return {str(y): float(v) for y, v in by_year.items()}
