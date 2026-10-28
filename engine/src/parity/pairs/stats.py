"""The statistics a pairs trade rests on (RES-0028, DEC-0070), in numpy only.

- Engle and Granger (1987) two-step cointegration: regress one log price on the other,
  then test the leftover (the spread) for a unit root. The p-value comes from a table we
  simulated (20,000 pairs of independent random walks per length, seed 20261026). Its 1%,
  5% and 10% points match MacKinnon (2010): about -3.90, -3.34 and -3.04 for long samples.
- Johansen (1991) trace test for two prices, with critical values from MacKinnon, Haug
  and Michelis (1999).
- Ornstein-Uhlenbeck half-life: fit spread(t) = a + b spread(t-1); half-life is
  ln 2 / -ln b days.
- A Kalman filter for a hedge ratio that drifts (as in Chan, 2013).

Every function sees only the data it is given, so a caller that passes data up to day t
gets an answer known at day t.
"""

from __future__ import annotations

import math

import numpy as np

#: Probabilities and the Engle-Granger t-statistic below which each falls, per sample
#: length (two variables, a constant in the first step, no lags). Simulated, see above.
EG_P = (0.001, 0.005, 0.01, 0.025, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70,
        0.80, 0.90, 0.95, 0.99)
EG_TABLE = {
    60: (-4.841, -4.331, -4.077, -3.734, -3.444, -3.117, -2.906, -2.738, -2.476, -2.263,
         -2.063, -1.866, -1.655, -1.404, -1.013, -0.65, 0.071),
    126: (-4.654, -4.204, -3.994, -3.666, -3.39, -3.078, -2.879, -2.721, -2.467, -2.25,
          -2.056, -1.863, -1.651, -1.401, -1.014, -0.647, 0.065),
    252: (-4.599, -4.171, -3.938, -3.622, -3.356, -3.064, -2.864, -2.707, -2.458, -2.245,
          -2.051, -1.86, -1.649, -1.395, -0.999, -0.638, 0.068),
    504: (-4.602, -4.144, -3.935, -3.617, -3.354, -3.058, -2.858, -2.699, -2.448, -2.241,
          -2.049, -1.857, -1.645, -1.393, -1.001, -0.642, 0.086),
    1008: (-4.563, -4.135, -3.921, -3.61, -3.349, -3.057, -2.864, -2.71, -2.464, -2.253,
           -2.06, -1.865, -1.657, -1.401, -1.012, -0.637, 0.1),
}
#: Johansen trace test, two variables, constant in the cointegrating relation and a trend
#: in the data (MacKinnon, Haug and Michelis 1999, case 3): 5% critical values.
JOHANSEN_5PCT = {0: 15.49, 1: 3.84}


def hedge_ratio(y: np.ndarray, x: np.ndarray) -> tuple[float, float]:
    """Least squares y = alpha + beta x. Returns (alpha, beta)."""
    xm, ym = x.mean(), y.mean()
    vx = ((x - xm) ** 2).sum()
    if vx <= 0:
        return float(ym), 0.0
    beta = float(((x - xm) * (y - ym)).sum() / vx)
    return float(ym - beta * xm), beta


def df_tstat(e: np.ndarray) -> float:
    """Dickey-Fuller t-statistic on a spread with mean near zero (no constant, no lags)."""
    de, lag = np.diff(e), e[:-1]
    ss = (lag * lag).sum()
    if len(de) < 10 or ss <= 0:
        return float("nan")
    g = (de * lag).sum() / ss
    u = de - g * lag
    s2 = (u * u).sum() / (len(de) - 1)
    return float(g / math.sqrt(s2 / ss)) if s2 > 0 else float("nan")


def eg_pvalue(tstat: float, n: int) -> float:
    """p-value of an Engle-Granger t-statistic for a sample of `n` days."""
    if not np.isfinite(tstat):
        return float("nan")
    length = min(EG_TABLE, key=lambda k: abs(math.log(k) - math.log(max(n, 2))))
    q = EG_TABLE[length]
    if tstat <= q[0]:
        return EG_P[0]
    if tstat >= q[-1]:
        return EG_P[-1]
    return float(np.interp(tstat, q, EG_P))


def engle_granger(y: np.ndarray, x: np.ndarray) -> dict:
    """Two-step test that y and x (log prices) move together. Returns the hedge ratio,
    the spread's mean and spread, the t-statistic and its p-value."""
    alpha, beta = hedge_ratio(y, x)
    e = y - alpha - beta * x
    t = df_tstat(e - e.mean())
    return {"alpha": alpha, "beta": beta, "mean": float(e.mean()), "sd": float(e.std(ddof=1)),
            "t": t, "p": eg_pvalue(t, len(y)), "spread": e}


def half_life(spread: np.ndarray) -> float:
    """Days for a gap in the spread to halve, from an AR(1) fit. inf if it does not
    shrink."""
    s = np.asarray(spread, dtype=float)
    s = s[np.isfinite(s)]
    if len(s) < 20:
        return float("inf")
    x, y = s[:-1], s[1:]
    _, b = hedge_ratio(y, x)
    if not 0 < b < 1:
        return float("inf")
    return float(math.log(2) / -math.log(b))


def johansen_trace(y: np.ndarray, x: np.ndarray) -> dict:
    """Johansen trace statistics for two log prices, one lagged difference, a constant.

    Returns trace0 (no cointegration against at least one relation) and trace1, and the 5%
    critical values. trace0 above its critical value says the two prices are linked."""
    z = np.column_stack([y, x]).astype(float)
    dz = np.diff(z, axis=0)
    if len(dz) < 30:
        return {"trace0": float("nan"), "trace1": float("nan"), "crit0": JOHANSEN_5PCT[0],
                "crit1": JOHANSEN_5PCT[1]}
    d0 = dz[1:]          # change today
    d1 = dz[:-1]         # change yesterday
    lvl = z[1:-1]        # level yesterday
    reg = np.column_stack([np.ones(len(d1)), d1])

    def resid(a):
        coef, *_ = np.linalg.lstsq(reg, a, rcond=None)
        return a - reg @ coef

    r0, r1 = resid(d0), resid(lvl)
    n = len(r0)
    s00, s11, s01 = r0.T @ r0 / n, r1.T @ r1 / n, r0.T @ r1 / n
    try:
        m = np.linalg.solve(s11, s01.T) @ np.linalg.solve(s00, s01)
        eig = np.sort(np.real(np.linalg.eigvals(m)))[::-1]
    except np.linalg.LinAlgError:
        return {"trace0": float("nan"), "trace1": float("nan"), "crit0": JOHANSEN_5PCT[0],
                "crit1": JOHANSEN_5PCT[1]}
    eig = np.clip(eig, 0, 1 - 1e-12)
    trace = -n * np.cumsum(np.log(1 - eig)[::-1])[::-1]
    return {"trace0": float(trace[0]), "trace1": float(trace[1]), "crit0": JOHANSEN_5PCT[0],
            "crit1": JOHANSEN_5PCT[1]}


def kalman_hedge(y: np.ndarray, x: np.ndarray, delta: float = 1e-4, ve: float = 1e-3
                 ) -> dict:
    """A hedge ratio and intercept that drift as a random walk, filtered day by day.

    y = alpha + beta x + noise. At each day the forecast uses yesterday's estimate; the
    forecast error e and its variance q give a z-score e / sqrt(q). Then the estimate is
    updated with today's prices. Everything at day t uses data up to day t only.
    `delta` sets how fast beta may drift; `ve` the noise variance of y."""
    n = len(y)
    beta, alpha = np.full(n, np.nan), np.full(n, np.nan)
    err, q = np.full(n, np.nan), np.full(n, np.nan)
    theta = np.zeros(2)
    p = np.zeros((2, 2))
    vw = delta / (1 - delta) * np.eye(2)
    started = False
    for t in range(n):
        if not (np.isfinite(y[t]) and np.isfinite(x[t])):
            continue
        h = np.array([x[t], 1.0])
        if not started:
            theta = np.array([y[t] / x[t] if x[t] else 0.0, 0.0])
            p = np.eye(2)
            started = True
        r = p + vw
        yhat = h @ theta
        qt = float(h @ r @ h + ve)
        e = y[t] - yhat
        k = r @ h / qt
        theta = theta + k * e
        p = r - np.outer(k, h) @ r
        beta[t], alpha[t], err[t], q[t] = theta[0], theta[1], e, qt
    return {"beta": beta, "alpha": alpha, "e": err, "q": q}
