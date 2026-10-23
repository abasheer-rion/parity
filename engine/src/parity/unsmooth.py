"""Unsmoothing appraisal-based and stale-priced return series (DEC-0029, RES-0012).

A price index built from appraisals, or from a lagged mix of recent sales, moves slowly:
each quarter's number is partly last quarter's. That makes the series look calmer than
the asset really is, and makes it look unrelated to stocks when it is not. Two standard
fixes, both on quarterly simple returns:

    geltner   Geltner (1993): treat the observed return as a weighted average of today's
              true return and yesterday's observed return, r_o[t] = (1 - phi) r[t] +
              phi r_o[t-1], estimate phi as the first-order autocorrelation and invert:
              r[t] = (r_o[t] - phi r_o[t-1]) / (1 - phi).
    glm       Getmansky, Lo and Makarov (2004): the observed return is a moving average of
              the true returns of this and the two previous quarters, with weights
              theta0 + theta1 + theta2 = 1, all between 0 and 1. The weights are chosen so
              the model's first two autocorrelations match the data. The true volatility
              is the observed one divided by sqrt(theta0^2 + theta1^2 + theta2^2).

Neither recovers the truth. Both assume the true returns are not themselves predictable,
and both widen the error bands, not narrow them. They answer one question: how much
calmer does smoothing make this series look than it is?

Also here: the "summed beta" of Dimson (1979) and Asness, Krail and Liew (2001). Regress
the series on stock returns this quarter and the two before; the sum of the three slopes
is the exposure that smoothing hides from a same-quarter regression.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize

PER_YEAR = 4  # quarterly returns
#: The MA(2) is inverted only when every root of its polynomial lies this far outside the
#: unit circle. Closer than that, the recursion amplifies noise without bound.
INVERT_MARGIN = 1.05


def quarterly_returns(index: pd.Series) -> pd.Series:
    """Simple returns between quarter ends. Accepts daily, monthly or quarterly levels."""
    s = index.dropna().sort_index()
    s = s[~s.index.duplicated(keep="last")]
    q = s.resample("QE").last().dropna()
    return q.pct_change().dropna()


def deseason(r: pd.Series) -> pd.Series:
    """Remove each calendar quarter's average excess over the overall mean.

    House prices rise every spring, so a series not seasonally adjusted (FHFA's all
    transactions index) shows a pattern that is not smoothing. This keeps the overall mean
    and removes the repeating part, so the autocorrelations measure smoothing."""
    r = r.dropna()
    by_q = r.groupby(r.index.quarter).transform("mean")
    return (r - by_q + r.mean()).rename(r.name)


def ac(r: pd.Series, lag: int = 1) -> float:
    """Sample autocorrelation at a lag (0 when undefined)."""
    x = r.dropna().to_numpy(dtype=float)
    if len(x) <= lag + 2:
        return 0.0
    x = x - x.mean()
    den = float((x * x).sum())
    return float((x[lag:] * x[:-lag]).sum() / den) if den else 0.0


def geltner(r: pd.Series, phi: float | None = None) -> tuple[pd.Series, float]:
    """Geltner's first-order unsmoothing. Returns (unsmoothed returns, phi).

    phi is clipped to [0, 0.95]: a negative autocorrelation means no smoothing to undo, and
    phi near 1 would divide by almost zero."""
    r = r.dropna()
    phi = ac(r, 1) if phi is None else phi
    phi = min(max(phi, 0.0), 0.95)
    out = (r - phi * r.shift(1)) / (1 - phi)
    return out.dropna().rename(r.name), phi


def _glm_moments(theta: np.ndarray) -> tuple[float, float, float]:
    t0, t1, t2 = theta
    xi = t0 * t0 + t1 * t1 + t2 * t2
    return (t0 * t1 + t1 * t2) / xi, (t0 * t2) / xi, xi


def glm_theta(r: pd.Series) -> tuple[list[float], float]:
    """Getmansky-Lo-Makarov MA(2) weights by matching the first two autocorrelations.

    Returns ([theta0, theta1, theta2], xi), xi = sum of squared weights, the "smoothing
    index": 1 means no smoothing, smaller means smoother."""
    rho1, rho2 = ac(r, 1), ac(r, 2)
    if rho1 <= 0 and rho2 <= 0:
        return [1.0, 0.0, 0.0], 1.0

    def loss(x: np.ndarray) -> float:
        t1, t2 = x
        theta = np.array([1 - t1 - t2, t1, t2])
        m1, m2, _ = _glm_moments(theta)
        return (m1 - rho1) ** 2 + (m2 - rho2) ** 2

    best = None
    for start in ([0.2, 0.05], [0.4, 0.2], [0.3, 0.3], [0.1, 0.4]):
        res = minimize(loss, np.array(start), method="SLSQP", bounds=[(0, 1), (0, 1)],
                       constraints=[{"type": "ineq", "fun": lambda x: 1 - x[0] - x[1]}])
        if best is None or res.fun < best.fun:
            best = res
    t1, t2 = (float(v) for v in best.x)
    theta = [1 - t1 - t2, t1, t2]
    return [round(t, 6) for t in theta], round(_glm_moments(np.array(theta))[2], 6)


def glm_fit_error(r: pd.Series, theta: list[float]) -> float:
    """Largest gap between the model's first two autocorrelations and the data's.

    An MA(2) with weights between 0 and 1 cannot produce a first autocorrelation much above
    0.7. A heavily smoothed appraisal index can exceed that, and then the fit is poor and
    the implied volatility is only a lower bound."""
    m1, m2, _ = _glm_moments(np.array(theta, dtype=float))
    return round(max(abs(m1 - ac(r, 1)), abs(m2 - ac(r, 2))), 4)


def glm_unsmooth(r: pd.Series, theta: list[float]) -> pd.Series | None:
    """Invert the MA(2): r[t] = (r_o[t] - theta1 r[t-1] - theta2 r[t-2]) / theta0.

    Returns None when the moving average cannot be inverted (a root of
    theta0 + theta1 z + theta2 z^2 inside the unit circle), because the recursion would
    then blow up."""
    t0, t1, t2 = theta
    roots = np.roots([t2, t1, t0]) if t2 else (np.array([-t0 / t1]) if t1 else np.array([]))
    if t0 <= 0 or any(abs(z) <= INVERT_MARGIN for z in roots):
        return None
    obs = r.dropna().to_numpy(dtype=float)
    out = np.zeros_like(obs)
    for i, v in enumerate(obs):
        prev1 = out[i - 1] if i >= 1 else v
        prev2 = out[i - 2] if i >= 2 else v
        out[i] = (v - t1 * prev1 - t2 * prev2) / t0
    return pd.Series(out, index=r.dropna().index, name=r.name)


def index_from(r: pd.Series, start: float = 100.0) -> pd.Series:
    return start * (1 + r).cumprod()


def max_drawdown(r: pd.Series) -> float:
    level = (1 + r).cumprod()
    peak = level.cummax().clip(lower=1.0)
    return float((level / peak - 1).min()) if len(level) else 0.0


@dataclass
class Stats:
    vol: float  # annualised standard deviation, as a fraction
    ac1: float
    max_drawdown: float
    worst_quarter: float
    worst_quarter_date: str | None
    growth: float  # compound annual growth rate

    def as_dict(self) -> dict:
        return {k: (round(v, 6) if isinstance(v, float) else v) for k, v in self.__dict__.items()}


def stats(r: pd.Series) -> Stats:
    r = r.dropna()
    years = len(r) / PER_YEAR
    total = float((1 + r).prod())
    worst = r.idxmin() if len(r) else None
    return Stats(
        vol=float(r.std(ddof=1) * math.sqrt(PER_YEAR)) if len(r) > 2 else 0.0,
        ac1=ac(r, 1),
        max_drawdown=max_drawdown(r),
        worst_quarter=float(r.min()) if len(r) else 0.0,
        worst_quarter_date=worst.date().isoformat() if worst is not None else None,
        growth=total ** (1 / years) - 1 if years > 0 and total > 0 else 0.0,
    )


def summed_beta(r: pd.Series, market: pd.Series, lags: int = 2) -> dict:
    """Same-quarter beta and the summed beta over this and `lags` earlier quarters."""
    df = pd.concat({"y": r, "m": market}, axis=1, join="inner").dropna()
    for k in range(1, lags + 1):
        df[f"m{k}"] = df["m"].shift(k)
    df = df.dropna()
    if len(df) < 12:
        return {"same_quarter": None, "summed": None, "quarters": len(df)}
    y = df["y"].to_numpy()
    x0 = np.column_stack([np.ones(len(df)), df["m"].to_numpy()])
    b0 = np.linalg.lstsq(x0, y, rcond=None)[0][1]
    cols = ["m"] + [f"m{k}" for k in range(1, lags + 1)]
    xs = np.column_stack([np.ones(len(df))] + [df[c].to_numpy() for c in cols])
    bs = np.linalg.lstsq(xs, y, rcond=None)[0][1:]
    return {"same_quarter": round(float(b0), 4), "summed": round(float(bs.sum()), 4),
            "by_lag": [round(float(b), 4) for b in bs], "quarters": int(len(df))}


def corr(a: pd.Series, b: pd.Series) -> float | None:
    df = pd.concat([a, b], axis=1, join="inner").dropna()
    return round(float(df.corr().iloc[0, 1]), 4) if len(df) > 8 else None


def study(index: pd.Series, market: pd.Series | None = None, start: str | None = None,
          end: str | None = None, seasonal: bool = False) -> dict:
    """Everything the research page shows for one smoothed index.

    `index` is a price level (any frequency, resampled to quarter ends). `market` is a
    stock total return index for the comparison and the betas. `start` and `end` trim
    both. `seasonal` removes a repeating calendar-quarter pattern first (see deseason)."""
    raw = quarterly_returns(index)
    if start:
        raw = raw[raw.index >= pd.Timestamp(start)]
    if end:
        raw = raw[raw.index <= pd.Timestamp(end)]
    if seasonal:
        raw = deseason(raw)
    g, phi = geltner(raw)
    theta, xi = glm_theta(raw)
    glm_r = glm_unsmooth(raw, theta)
    raw_stats = stats(raw)
    out: dict = {
        "start": raw.index[0].date().isoformat(), "end": raw.index[-1].date().isoformat(),
        "quarters": int(len(raw)),
        "raw": raw_stats.as_dict(),
        "geltner": {"phi": round(phi, 6), **stats(g).as_dict()},
        "glm": {"theta": theta, "smoothing_index": xi, "fit_error": glm_fit_error(raw, theta),
                "vol_implied": round(raw_stats.vol / math.sqrt(xi), 6) if xi > 0 else None,
                "invertible": glm_r is not None,
                **(stats(glm_r).as_dict() if glm_r is not None else {})},
        "autocorrelation": {"lag1": round(ac(raw, 1), 4), "lag2": round(ac(raw, 2), 4)},
    }
    if market is not None:
        m = quarterly_returns(market)
        m = m[(m.index >= raw.index[0]) & (m.index <= raw.index[-1])]
        out["stocks"] = stats(m).as_dict()
        out["beta_raw"] = summed_beta(raw, m)
        out["beta_geltner"] = summed_beta(g, m)
        out["corr_with_stocks"] = {"raw": corr(raw, m), "geltner": corr(g, m)}
    out["series"] = {"raw": raw, "geltner": g, "glm": glm_r}
    return out
