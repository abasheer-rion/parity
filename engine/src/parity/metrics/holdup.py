"""How a strategy holds up: the numbers behind the "how it holds up" charts.

One function, `holdup`, turns a strategy's daily returns (and, when available, the
benchmark, a stock index, a bond index and an interest rate series) into a JSON-safe
dict. The web has a line-for-line port in web/src/lib/holdup.ts that builds the same
shape from uploaded returns; web/tests/holdup.test.ts checks the two agree on a fixture
written by scripts/holdup_fixture.py. Change both together.

Everything here is descriptive and fixed in advance: the windows, the bootstrap
settings and the crisis dates are constants, not tuned to any result.
"""

from __future__ import annotations

import math
from collections.abc import Iterable

import numpy as np
import pandas as pd
from scipy import stats

from . import performance

TRADING_DAYS = 252
SEED = 20261026
N_BOOTSTRAP = 1000
BLOCK_DAYS = 21
HIST_BINS = 30
MAX_POINTS = 260
CORR_WINDOW = 252
VOL_WINDOW = 63
RATE_LOOKBACK = 252
LUCK_LINE = 0.95
MIN_DAYS = 30

#: Named crisis windows (peak to trough of the S&P 500), the same list the strategy
#: comparison uses (compare.CRISES), so the two pages agree.
CRISES = (
    ("Dot-com crash", "2000-03-24", "2002-10-09"),
    ("Global financial crisis", "2007-10-09", "2009-03-09"),
    ("Euro debt crisis", "2011-04-29", "2011-10-03"),
    ("Covid crash", "2020-02-19", "2020-03-23"),
    ("2022 inflation bear market", "2022-01-03", "2022-10-12"),
)


# ------------------------------------------------------------------ small helpers

def _f(v, digits: int = 6) -> float | None:
    """A finite float rounded for JSON, or None."""
    if v is None:
        return None
    v = float(v)
    return round(v, digits) if math.isfinite(v) else None


def _iso(d) -> str:
    return pd.Timestamp(d).date().isoformat()


def _clean(s: pd.Series | None) -> pd.Series | None:
    if s is None:
        return None
    s = s.dropna().astype(float)
    s = s[~s.index.duplicated(keep="last")].sort_index()
    return s if len(s) else None


def _growth(r: np.ndarray) -> float:
    return float(np.prod(1 + r)) if len(r) else float("nan")


def _ann(r: np.ndarray) -> float:
    """Compound annual return of a set of days (they need not be contiguous)."""
    g = _growth(r)
    return g ** (TRADING_DAYS / len(r)) - 1 if len(r) and g > 0 else float("nan")


def _hit(r: np.ndarray) -> float:
    traded = r[r != 0]
    return float((traded > 0).mean()) if len(traded) else float("nan")


def _sharpe(r: np.ndarray) -> float:
    if len(r) < 2:
        return float("nan")
    sd = r.std(ddof=1)
    return float(r.mean() / sd * math.sqrt(TRADING_DAYS)) if sd > 0 else float("nan")


def _decimate(n: int, max_points: int = MAX_POINTS) -> list[int]:
    """Evenly spaced row numbers, always ending on the last row, at most max_points."""
    if n <= max_points:
        return list(range(n))
    step = math.ceil(n / (max_points - 1))
    idx = list(range(0, n, step))
    if idx[-1] != n - 1:
        idx.append(n - 1)
    return idx


def _asof(s: pd.Series, index: pd.DatetimeIndex) -> pd.Series:
    """The last known value of s on or before each date in index."""
    return s.reindex(index.union(s.index)).sort_index().ffill().reindex(index)


def _source(name: str | None, s: pd.Series | None, reason: str | None = None) -> dict:
    if s is None:
        return {"name": name, "available": False, "reason": reason or "not_provided"}
    return {"name": name, "available": True, "start": _iso(s.index[0]),
            "end": _iso(s.index[-1]), "n": int(len(s))}


# ------------------------------------------------------------------ the sections

def equity_vs_benchmark(r: pd.Series, bench: pd.Series | None) -> dict:
    if bench is not None:
        frame = pd.concat([r, bench], axis=1, join="inner")
        a, b = frame.iloc[:, 0], frame.iloc[:, 1]
    else:
        a, b = r, None
    idx = _decimate(len(a))
    eq_a = (1 + a.to_numpy()).cumprod()
    eq_b = (1 + b.to_numpy()).cumprod() if b is not None else None
    return {
        "dates": [_iso(a.index[i]) for i in idx],
        "strategy": [_f(eq_a[i], 5) for i in idx],
        "benchmark": [_f(eq_b[i], 5) for i in idx] if eq_b is not None else None,
    }


def _moments(x: np.ndarray) -> dict | None:
    t = len(x)
    sd = x.std(ddof=1) if t > 1 else 0.0
    if t < MIN_DAYS or not sd > 1e-12:
        return None
    return {"t": t, "sr": float(x.mean() / sd), "skew": float(stats.skew(x)),
            "kurt": float(stats.kurtosis(x, fisher=False))}


def _denom(m: dict) -> float:
    return math.sqrt(max(1 - m["skew"] * m["sr"] + (m["kurt"] - 1) / 4 * m["sr"] ** 2, 1e-12))


def _expected_max_z(n_trials: int) -> float:
    if n_trials <= 1:
        return 0.0
    z1 = stats.norm.ppf(1 - 1 / n_trials)
    z2 = stats.norm.ppf(1 - 1 / (n_trials * math.e))
    return float((1 - performance.EULER_GAMMA) * z1 + performance.EULER_GAMMA * z2)


def min_track_record(m: dict, n_trials: int) -> float:
    """Observations the same results would need for the luck check to reach 0.95 at
    n_trials tries (Bailey and Lopez de Prado, 2012). Same formula as minTrackRecord()
    in web/src/lib/verify/dsr.ts. Infinity when the Sharpe is zero or below."""
    if not m["sr"] > 0:
        return float("inf")
    z = stats.norm.ppf(LUCK_LINE)
    root = (z * _denom(m) + math.sqrt(1 + 0.5 * m["sr"] ** 2) * _expected_max_z(n_trials)) \
        / m["sr"]
    return 1 + max(0.0, root) ** 2


def luck(ex: pd.Series, n_trials: int) -> dict:
    p = performance.deflated_sharpe(ex, n_trials)
    p1 = performance.deflated_sharpe(ex, 1)
    if not math.isfinite(p):
        verdict = "not_enough_data"
    elif p >= LUCK_LINE:
        verdict = "unlikely_luck"
    elif p >= 0.80:
        verdict = "borderline"
    else:
        verdict = "could_be_luck"
    return {"sharpe": _f(_sharpe(ex.to_numpy()), 4), "n_trials": int(n_trials),
            "probability": _f(p, 4), "probability_one_try": _f(p1, 4), "line": LUCK_LINE,
            "verdict": verdict}


def _block_indices(n: int, rng: np.random.Generator, n_boot: int, block: int) -> np.ndarray:
    """Moving block bootstrap rows, as in gauntlet._block_indices."""
    n_blocks = math.ceil(n / block)
    starts = rng.integers(0, n - block + 1, size=(n_boot, n_blocks))
    idx = (starts[:, :, None] + np.arange(block)[None, None, :]).reshape(n_boot, -1)
    return idx[:, :n]


def _summary(x: np.ndarray, point: float, digits: int = 4) -> dict:
    x = x[np.isfinite(x)]
    if not len(x):
        return {"point": _f(point, digits), "median": None, "ci95": None, "ci80": None}
    q = np.percentile(x, [2.5, 10, 50, 90, 97.5])
    return {"point": _f(point, digits), "median": _f(q[2], digits),
            "ci95": [_f(q[0], digits), _f(q[4], digits)],
            "ci80": [_f(q[1], digits), _f(q[3], digits)]}


def bootstrap(r: pd.Series, ex: pd.Series, seed: int = SEED, n_boot: int = N_BOOTSTRAP,
              block: int = BLOCK_DAYS) -> dict | None:
    """Block-bootstrap ranges for the yearly return (from total returns) and Sharpe
    (from returns above cash), resampling the same days for both."""
    frame = pd.concat([r, ex], axis=1, join="inner")
    n = len(frame)
    if n < max(MIN_DAYS, 2 * block):
        return None
    a, e = frame.iloc[:, 0].to_numpy(), frame.iloc[:, 1].to_numpy()
    rng = np.random.default_rng(seed)
    cagr = np.empty(n_boot)
    shp = np.empty(n_boot)
    chunk = 200  # keeps memory flat on long histories
    for lo in range(0, n_boot, chunk):
        k = min(chunk, n_boot - lo)
        idx = _block_indices(n, rng, k, block)
        sa, se = a[idx], e[idx]
        with np.errstate(invalid="ignore", divide="ignore"):
            logg = np.log1p(sa).sum(axis=1)
            cagr[lo:lo + k] = np.expm1(logg * TRADING_DAYS / n)
            sd = se.std(axis=1, ddof=1)
            shp[lo:lo + k] = np.where(sd > 0, se.mean(axis=1) / sd * math.sqrt(TRADING_DAYS),
                                      np.nan)
    finite = shp[np.isfinite(shp)]
    if len(finite):
        lo_e, hi_e = float(finite.min()), float(finite.max())
        if hi_e <= lo_e:
            hi_e = lo_e + 1e-9
        counts, edges = np.histogram(finite, bins=HIST_BINS, range=(lo_e, hi_e))
        hist = {"edges": [_f(v, 4) for v in edges], "counts": [int(c) for c in counts]}
    else:
        hist = {"edges": [], "counts": []}
    return {
        "n": int(n_boot), "block_days": int(block), "seed": int(seed), "days": int(n),
        "sharpe": _summary(shp, _sharpe(e)),
        "cagr": _summary(cagr, _ann(a), 5),
        "prob_sharpe_above_zero": _f(float(np.mean(finite > 0)) if len(finite) else None, 4),
        "histogram": hist,
    }


def holm(p_values: dict[str, float]) -> list[dict]:
    """Holm's step-down correction across a family of tests, in the input order."""
    items = [(k, float(v)) for k, v in p_values.items() if v is not None and math.isfinite(v)]
    m = len(items)
    order = sorted(range(m), key=lambda i: items[i][1])
    adjusted = [0.0] * m
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (m - rank) * items[i][1]))
        adjusted[i] = running
    return [{"name": k, "raw": _f(p, 6), "adjusted": _f(adj, 6)}
            for (k, p), adj in zip(items, adjusted, strict=True)]


def p_values(ex: pd.Series, n_trials: int, tests: dict[str, float] | None = None) -> dict:
    """One-sided p-value that the true Sharpe is above zero, from the Sharpe's t-statistic
    with the skew and fat-tail adjustment of the probabilistic Sharpe ratio, then corrected
    for the number of strategies tried."""
    m = _moments(ex.to_numpy())
    n = max(int(n_trials), 1)
    if m is None:
        raw = t = float("nan")
    else:
        t = m["sr"] * math.sqrt(m["t"] - 1) / _denom(m)
        raw = float(stats.norm.sf(t))
    bonf = min(1.0, raw * n) if math.isfinite(raw) else float("nan")
    sidak = -math.expm1(n * math.log1p(-raw)) if math.isfinite(raw) and raw < 1 else (
        1.0 if math.isfinite(raw) else float("nan"))
    family = None
    if tests:
        family = holm({"sharpe_above_zero": raw, **tests})
    return {
        "method": "psr_t",  # t-statistic of Sharpe with skew and kurtosis adjustment
        "t_stat": _f(t, 4), "raw": _f(raw, 6), "n_trials": n,
        "bonferroni": _f(bonf, 6), "sidak": _f(sidak, 6), "holm": family,
        "significant": {"raw": bool(raw < 0.05) if math.isfinite(raw) else None,
                        "bonferroni": bool(bonf < 0.05) if math.isfinite(bonf) else None,
                        "sidak": bool(sidak < 0.05) if math.isfinite(sidak) else None},
    }


def rolling_correlation(r: pd.Series, others: dict[str, pd.Series]) -> dict | None:
    """252-day rolling correlation of daily returns, sampled at each month's last day."""
    if not others:
        return None
    frame = pd.concat([r.rename("strategy"), *[s.rename(k) for k, s in others.items()]],
                      axis=1, join="inner")
    if len(frame) < CORR_WINDOW + 1:
        return {"window_days": CORR_WINDOW, "dates": [], "series": {k: [] for k in others},
                "full_period": {k: _f(frame["strategy"].corr(frame[k]), 3) if len(frame) > 2
                                else None for k in others},
                "latest": {k: None for k in others}}
    roll = {k: frame["strategy"].rolling(CORR_WINDOW).corr(frame[k]) for k in others}
    months = frame.index.to_period("M")
    last_rows = pd.Series(np.arange(len(frame)), index=frame.index).groupby(months).max()
    rows = [int(i) for i in last_rows.to_numpy() if i >= CORR_WINDOW - 1]
    return {
        "window_days": CORR_WINDOW,
        "dates": [_iso(frame.index[i]) for i in rows],
        "series": {k: [_f(roll[k].iloc[i], 3) for i in rows] for k in others},
        "full_period": {k: _f(frame["strategy"].corr(frame[k]), 3) for k in others},
        "latest": {k: _f(roll[k].iloc[-1], 3) for k in others},
    }


def _regime_item(key: str, label: str, mask: np.ndarray, a: np.ndarray,
                 b: np.ndarray | None, total: int, **extra) -> dict | None:
    days = int(mask.sum())
    if days == 0:
        return None
    ra = a[mask]
    rb = b[mask] if b is not None else None
    sa = _growth(ra) - 1
    sb = _growth(rb) - 1 if rb is not None else float("nan")
    return {"key": key, "label": label, **extra, "days": days, "share": _f(days / total, 4),
            "strategy_total": _f(sa), "benchmark_total": _f(sb),
            "strategy_ann": _f(_ann(ra)), "benchmark_ann": _f(_ann(rb)) if rb is not None
            else None,
            "strategy_hit": _f(_hit(ra), 4), "benchmark_hit": _f(_hit(rb), 4)
            if rb is not None else None,
            "wins": bool(sa > sb) if rb is not None and math.isfinite(sa) and math.isfinite(sb)
            else None}


def _slug(s: str) -> str:
    out = "".join(c.lower() if c.isalnum() else "_" for c in s)
    while "__" in out:
        out = out.replace("__", "_")
    return out.strip("_")


def regimes(r: pd.Series, bench: pd.Series | None, rates: pd.Series | None,
            crises: Iterable, vol_source: str | None) -> list[dict]:
    if bench is not None:
        frame = pd.concat([r, bench], axis=1, join="inner")
        a, b = frame.iloc[:, 0].to_numpy(), frame.iloc[:, 1].to_numpy()
        idx = frame.index
    else:
        a, b, idx = r.to_numpy(), None, r.index
    total = len(a)
    out = []

    # Rates rising or falling: 12-month change in the rate series, as known on each day.
    if rates is None:
        out.append({"family": "rates", "available": False, "reason": "no_rate_series",
                    "items": []})
    else:
        lvl = _asof(rates, idx).to_numpy()
        chg = np.full(total, np.nan)
        if total > RATE_LOOKBACK:
            chg[RATE_LOOKBACK:] = lvl[RATE_LOOKBACK:] - lvl[:-RATE_LOOKBACK]
        ok = np.isfinite(chg)
        if ok.sum() < VOL_WINDOW:
            out.append({"family": "rates", "available": False, "reason": "too_short",
                        "items": []})
        else:
            items = [_regime_item("rising", "Rates rising", ok & (chg > 0), a, b, total),
                     _regime_item("falling", "Rates falling", ok & (chg <= 0), a, b, total)]
            out.append({"family": "rates", "available": True, "reason": None,
                        "lookback_days": RATE_LOOKBACK,
                        "items": [i for i in items if i]})

    # Volatility high or low: benchmark's 63-day realised volatility against its median.
    if b is None:
        out.append({"family": "volatility", "available": False, "reason": "no_benchmark",
                    "items": []})
    else:
        vol = pd.Series(b).rolling(VOL_WINDOW).std().to_numpy() * math.sqrt(TRADING_DAYS)
        ok = np.isfinite(vol)
        if ok.sum() < VOL_WINDOW:
            out.append({"family": "volatility", "available": False, "reason": "too_short",
                        "items": []})
        else:
            med = float(np.median(vol[ok]))
            items = [_regime_item("high", "Volatile markets", ok & (vol > med), a, b, total),
                     _regime_item("low", "Calm markets", ok & (vol <= med), a, b, total)]
            out.append({"family": "volatility", "available": True, "reason": None,
                        "window_days": VOL_WINDOW, "median_vol": _f(med, 4),
                        "source": vol_source, "items": [i for i in items if i]})

    # Named crises.
    items = []
    for c in crises:
        name, start, end = (c["name"], c["start"], c["end"]) if isinstance(c, dict) else c
        mask = (idx >= pd.Timestamp(start)) & (idx <= pd.Timestamp(end))
        if mask.sum() < 5:
            continue
        it = _regime_item(_slug(name), name, np.asarray(mask), a, b, total,
                          start=str(start)[:10], end=str(end)[:10])
        if it:
            items.append(it)
    out.append({"family": "crises", "available": bool(items),
                "reason": None if items else "no_overlap", "items": items})

    # Decades.
    decade = (idx.year // 10 * 10).to_numpy()
    items = []
    for d in sorted(set(decade.tolist())):
        mask = decade == d
        if mask.sum() < VOL_WINDOW:
            continue
        it = _regime_item(f"{d}s", f"{d}s", mask, a, b, total)
        if it:
            items.append(it)
    out.append({"family": "decades", "available": bool(items),
                "reason": None if items else "too_short", "items": items})
    return out


def drawdowns(r: pd.Series, top: int = 5) -> list[dict]:
    """The deepest separate drawdowns: peak, trough, recovery (None if not yet back)."""
    eq = (1 + r.to_numpy()).cumprod()
    dates = r.index
    episodes = []
    peak_i, trough_i, in_dd = 0, 0, False
    for i in range(1, len(eq)):
        if eq[i] >= eq[peak_i]:
            if in_dd:
                episodes.append((peak_i, trough_i, i))
                in_dd = False
            peak_i = trough_i = i
        else:
            if not in_dd:
                in_dd, trough_i = True, i
            if eq[i] < eq[trough_i]:
                trough_i = i
    if in_dd:
        episodes.append((peak_i, trough_i, None))
    rows = []
    for p, t, rec in episodes:
        end = dates[rec] if rec is not None else dates[-1]
        rows.append({"start": _iso(dates[p]), "trough": _iso(dates[t]),
                     "recovery": _iso(dates[rec]) if rec is not None else None,
                     "depth": _f(eq[t] / eq[p] - 1),
                     "days": int((end - dates[p]).days),
                     "days_to_trough": int((dates[t] - dates[p]).days)})
    rows.sort(key=lambda x: (x["depth"], x["start"]))
    return rows[:top]


def worst_periods(r: pd.Series, bench: pd.Series | None) -> dict:
    years = (1 + r).groupby(r.index.year).prod() - 1
    worst_year = None
    if len(years):
        y = int(years.idxmin())
        by = None
        if bench is not None:
            bb = bench[bench.index.year == y]
            by = _f(float((1 + bb).prod() - 1)) if len(bb) else None
        worst_year = {"year": y, "return": _f(years.loc[y]), "benchmark": by}
    worst_12m = None
    if len(r) >= TRADING_DAYS:
        logs = np.log1p(r.to_numpy())
        csum = np.concatenate([[0.0], np.cumsum(logs)])
        win = csum[TRADING_DAYS:] - csum[:-TRADING_DAYS]
        j = int(np.argmin(win))  # window covers rows j .. j + 251
        worst_12m = {"start": _iso(r.index[j]), "end": _iso(r.index[j + TRADING_DAYS - 1]),
                     "return": _f(math.expm1(win[j]))}
    return {"drawdowns": drawdowns(r), "worst_year": worst_year, "worst_12m": worst_12m}


def must_be_true(r: pd.Series, ex: pd.Series, n_trials: int, corr: dict | None,
                 crises: Iterable, luck_block: dict, breakeven_bps: float | None,
                 cost_bps: float | None) -> list[dict]:
    """What has to stay true for the result to hold, as machine keys and numbers. The
    web turns each into one plain sentence."""
    out = []
    if breakeven_bps is not None and math.isfinite(breakeven_bps):
        holds = None if cost_bps is None else bool(breakeven_bps > cost_bps)
        out.append({"key": "costs_below_breakeven", "holds": holds,
                    "values": {"breakeven_bps": _f(breakeven_bps, 2),
                               "assumed_bps": _f(cost_bps, 2)}})
    if corr and corr.get("series"):
        for k, vals in corr["series"].items():
            v = [x for x in vals if x is not None]
            if not v:
                continue
            full = corr["full_period"].get(k)
            out.append({"key": f"correlation_to_{k}_persists",
                        "holds": None,
                        "values": {"full_period": full, "latest": corr["latest"].get(k),
                                   "min": _f(min(v), 3), "max": _f(max(v), 3)}})
    logs = np.log1p(r.to_numpy())
    total_log = float(logs.sum())
    in_crisis = np.zeros(len(r), dtype=bool)
    for c in crises:
        _, start, end = (c["name"], c["start"], c["end"]) if isinstance(c, dict) else c
        in_crisis |= np.asarray((r.index >= pd.Timestamp(start)) & (r.index <= pd.Timestamp(end)))
    if in_crisis.any() and total_log > 0:
        share = float(logs[in_crisis].sum()) / total_log
        out.append({"key": "not_reliant_on_crises", "holds": bool(share <= 0.5),
                    "values": {"crisis_return_share": _f(share, 4),
                               "crisis_day_share": _f(in_crisis.mean(), 4)}})
    years = (1 + r).groupby(r.index.year).prod() - 1
    if len(years) >= 3:
        best = int(years.idxmax())
        rest = ex[ex.index.year != best].to_numpy()
        s = _sharpe(rest)
        out.append({"key": "not_one_lucky_year", "holds": bool(s > 0) if math.isfinite(s)
                    else None, "values": {"best_year": best,
                                          "best_year_return": _f(years.loc[best]),
                                          "sharpe_without": _f(s, 4)}})
    m = _moments(ex.to_numpy())
    if m is not None:
        need = min_track_record(m, n_trials)
        years_have = m["t"] / TRADING_DAYS
        years_need = need / TRADING_DAYS if math.isfinite(need) else None
        out.append({"key": "enough_history", "holds": bool(years_need is not None
                                                           and years_have >= years_need),
                    "values": {"years": _f(years_have, 2), "observations": m["t"],
                               "years_needed": _f(years_need, 2), "n_trials": int(n_trials)}})
    if luck_block.get("probability") is not None:
        out.append({"key": "survives_trial_count",
                    "holds": bool(luck_block["probability"] >= LUCK_LINE),
                    "values": {"probability": luck_block["probability"],
                               "n_trials": int(n_trials), "line": LUCK_LINE}})
    return out


# ------------------------------------------------------------------ the entry point

def holdup(returns: pd.Series, benchmark: pd.Series | None = None, n_trials: int = 1,
           stocks: pd.Series | None = None, bonds: pd.Series | None = None,
           rates: pd.Series | None = None, crises: list | None = None,
           excess: pd.Series | None = None, seed: int = SEED,
           test_p_values: dict[str, float] | None = None,
           breakeven_bps: float | None = None, cost_bps: float | None = None,
           names: dict[str, str] | None = None, reasons: dict[str, str] | None = None,
           n_boot: int = N_BOOTSTRAP) -> dict | None:
    """All the "how it holds up" numbers for one strategy.

    returns    daily total returns (yearly return, drawdowns, regimes, equity)
    excess     daily returns above cash; drives Sharpe, luck and p-values (defaults to returns)
    benchmark  daily total returns of the benchmark
    stocks, bonds  daily returns of a stock index and a bond index, for correlations
    rates      an interest rate level in percent (for rates rising or falling)
    crises     [(name, start, end)] or [{"name", "start", "end"}]; defaults to CRISES
    test_p_values  other p-values for the same strategy, corrected together by Holm
    """
    names = names or {}
    reasons = reasons or {}
    r = _clean(returns)
    if r is None or len(r) < MIN_DAYS:
        return None
    ex = _clean(excess) if excess is not None else r
    if ex is None:
        ex = r
    bench, stk, bnd, rt = _clean(benchmark), _clean(stocks), _clean(bonds), _clean(rates)
    crisis_list = list(crises) if crises else list(CRISES)

    lk = luck(ex, n_trials)
    others = {k: s for k, s in (("stocks", stk), ("bonds", bnd)) if s is not None}
    corr = rolling_correlation(r, others)
    doc = {
        "equity_vs_benchmark": equity_vs_benchmark(r, bench),
        "luck": lk,
        "bootstrap": bootstrap(r, ex, seed=seed, n_boot=n_boot),
        "p_values": p_values(ex, n_trials, test_p_values),
        "rolling_correlation": corr,
        "regimes": regimes(r, bench, rt, crisis_list,
                           names.get("benchmark", "benchmark") if bench is not None else None),
        "worst_periods": worst_periods(r, bench),
        "must_be_true": must_be_true(r, ex, n_trials, corr, crisis_list, lk, breakeven_bps,
                                     cost_bps),
        "sources": {
            "strategy": _source(names.get("strategy", "strategy"), r),
            "benchmark": _source(names.get("benchmark"), bench, reasons.get("benchmark")),
            "stocks": _source(names.get("stocks"), stk, reasons.get("stocks")),
            "bonds": _source(names.get("bonds"), bnd, reasons.get("bonds")),
            "rates": _source(names.get("rates"), rt, reasons.get("rates")),
            "crises": {"name": "given" if crises else "built_in", "n": len(crisis_list)},
        },
    }
    return doc
