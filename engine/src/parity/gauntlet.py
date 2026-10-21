"""The gauntlet: a fixed set of harsh tests every strategy has to face.

The tests are split into two questions, because they have different answers more
often than you would think:

    A. Does it beat the S&P 500?   (the bar in docs/decisions/0006-...)
    B. Is there anything real here at all, or could it be luck?

A strategy can fail A and pass B (a real but small effect), which is still worth
knowing. A strategy that passes A but fails B is the dangerous case: it looks
good and probably is not.

Every test is defined once, here, with a plain-language explanation that the
dashboard and docs show next to the result. Thresholds are fixed in advance and
must not be changed after looking at results. If one has to change, write a
decision doc first. Test definitions: docs/reference/0006-the-gauntlet.md.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from .backtest import BacktestConfig, BacktestResult, run
from .metrics import performance
from .strategies.base import Strategy

SEED = 20261020
N_BOOTSTRAP = 1000
N_PLACEBO = 500
BLOCK_DAYS = 21
TARGET_VOL = 0.15
PERIODS = (("2000 to 2008", "2000-01-01", "2008-12-31"),
           ("2009 to 2019", "2009-01-01", "2019-12-31"),
           ("2020 on", "2020-01-01", None))
HOLDOUT_YEARS = 5
MAX_GRID = 12


@dataclass
class Test:
    id: str
    group: str  # "beat" or "real"
    name: str
    plain: str  # what the test asks, in words a child could follow
    passed: bool | None
    value: str
    bar: str

    def to_dict(self) -> dict:
        out = asdict(self)
        out["passed"] = None if self.passed is None else bool(self.passed)
        return out


def _sharpe(r) -> float:
    r = np.asarray(r, dtype=float)
    sd = r.std(ddof=1)
    return float(r.mean() / sd * math.sqrt(252)) if sd > 0 else float("nan")


def _block_indices(n: int, rng: np.random.Generator, n_boot: int, block: int) -> np.ndarray:
    """Moving block bootstrap: glue together random 21-day chunks so that calm and
    stormy stretches stay together, the way they happen in real markets."""
    n_blocks = math.ceil(n / block)
    starts = rng.integers(0, n - block + 1, size=(n_boot, n_blocks))
    idx = (starts[:, :, None] + np.arange(block)[None, None, :]).reshape(n_boot, -1)
    return idx[:, :n]


def bootstrap(strategy: pd.Series, bench: pd.Series, rng: np.random.Generator) -> dict:
    a, b = strategy.align(bench, join="inner")
    a, b = a.to_numpy(), b.to_numpy()
    idx = _block_indices(len(a), rng, N_BOOTSTRAP, BLOCK_DAYS)
    sa, sb = a[idx], b[idx]

    def sharpe_rows(m):
        sd = m.std(axis=1, ddof=1)
        return np.where(sd > 0, m.mean(axis=1) / sd * math.sqrt(252), np.nan)

    s_strat, s_bench = sharpe_rows(sa), sharpe_rows(sb)
    lo, hi = np.nanpercentile(s_strat, [2.5, 97.5])
    return {
        "sharpe_ci": [float(lo), float(hi)],
        "prob_sharpe_above_zero": float(np.nanmean(s_strat > 0)),
        "prob_beats_benchmark": float(np.nanmean(s_strat > s_bench)),
    }


def placebo(res: BacktestResult, cost_bps: float, rng: np.random.Generator) -> dict:
    """Keep the strategy's positions but slide them to random other dates. This
    keeps how much it trades and how big its bets are, and destroys its timing.
    If the real strategy is not clearly better than most of these, its timing
    adds nothing."""
    w = res.weights.to_numpy()
    r = res.asset_returns.to_numpy()
    cost = res.turnover.to_numpy() * cost_bps / 1e4
    n = len(w)
    actual = _sharpe(res.returns)
    shifts = rng.integers(252, max(n - 252, 253), size=N_PLACEBO)
    null = np.array([_sharpe((np.roll(w, k, axis=0) * r).sum(axis=1) - cost) for k in shifts])
    return {"actual": actual, "p_value": float(np.mean(null >= actual)),
            "null_median": float(np.nanmedian(null)), "null_p95": float(np.nanpercentile(null, 95))}


def sensitivity(strategy: Strategy, panel: pd.DataFrame, cfg: BacktestConfig) -> dict:
    grid = strategy.param_grid
    if not grid:
        return {"tried": 0, "share_positive": None, "sharpes": []}
    keys = list(grid)
    combos = list(itertools.product(*grid.values()))[:MAX_GRID]
    rows = []
    for values in combos:
        params = {**strategy.params(), **dict(zip(keys, values, strict=True))}
        variant = type(strategy)(**params)
        ret = run(variant, panel, cfg).returns
        eq = (1 + ret).cumprod().resample("W-FRI").last().dropna()
        rows.append({"params": dict(zip(keys, values, strict=True)),
                     "sharpe": _sharpe(ret),
                     "cagr": performance.cagr(ret),
                     "max_drawdown": performance.max_drawdown(ret),
                     "equity": [[d.date().isoformat(), round(float(v), 5)] for d, v in eq.items()]})
    sharpes = [x["sharpe"] for x in rows]
    return {"tried": len(rows), "share_positive": float(np.mean([s > 0 for s in sharpes])),
            "min": float(np.nanmin(sharpes)), "max": float(np.nanmax(sharpes)), "variants": rows}


def _fmt(v: float | None, kind: str = "num") -> str:
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        return "n/a"
    return f"{v * 100:.1f}%" if kind == "pct" else f"{v:.2f}"


def run_gauntlet(strategy: Strategy, panel: pd.DataFrame, bench: pd.Series,
                 cfg: BacktestConfig, n_trials: int) -> dict:
    rng = np.random.default_rng(SEED)
    res = run(strategy, panel, cfg)
    r = res.returns
    a, b = r.align(bench, join="inner")
    s, sb = _sharpe(a), _sharpe(b)
    tests: list[Test] = []

    # ---------- A. Does it beat the S&P 500?
    tests.append(Test("A1", "beat", "Better return for the risk",
                      "Does it earn more per unit of bumpiness than just holding the S&P 500?",
                      s > sb, f"{_fmt(s)} vs {_fmt(sb)}", "Sharpe above the S&P 500's"))

    vol_cfg = BacktestConfig(**{**cfg.to_dict(), "target_vol": TARGET_VOL})
    rv = run(strategy, panel, vol_cfg).returns
    av, bv = rv.align(bench, join="inner")
    c_s, c_b = performance.cagr(av), performance.cagr(bv)
    tests.append(Test("A2", "beat", "More money at the same risk",
                      "If we turn it up until it is as bumpy as stocks, does it make more money?",
                      c_s > c_b, f"{_fmt(c_s, 'pct')} vs {_fmt(c_b, 'pct')} a year",
                      f"Yearly return above the S&P 500 at {TARGET_VOL:.0%} volatility"))

    dsr = performance.deflated_sharpe(a, n_trials)
    tests.append(Test("A3", "beat", "Not just the best of many tries",
                      f"We tried {n_trials} ideas. Is this one good even after allowing for "
                      "the fact that one of them was bound to look good by luck?",
                      dsr >= 0.95, _fmt(dsr), "Deflated Sharpe of 0.95 or more"))

    cost2 = BacktestConfig(**{**cfg.to_dict(), "cost_bps": cfg.cost_bps * 2})
    s2 = _sharpe(run(strategy, panel, cost2).returns.align(bench, join="inner")[0])
    tests.append(Test("A4", "beat", "Survives double trading costs",
                      "If trading costs twice what we guessed, does it still beat the S&P 500?",
                      s2 > sb, f"{_fmt(s2)} vs {_fmt(sb)}",
                      "Sharpe above the S&P 500's at 2x costs"))

    period_rows, period_pass = [], True
    for label, start, end in PERIODS:
        pa = a.loc[start:end]
        pb = b.loc[start:end]
        if len(pa) < 252:
            continue
        ps, pbs = _sharpe(pa), _sharpe(pb)
        period_rows.append(f"{label}: {_fmt(ps)} vs {_fmt(pbs)}")
        period_pass &= ps > pbs
    tests.append(Test("A5", "beat", "Wins in every era",
                      "Does it beat the S&P 500 in each of three very different periods, not "
                      "just on average?", period_pass, "; ".join(period_rows),
                      "Sharpe above the S&P 500's in every period"))

    hold_start = a.index.max() - pd.DateOffset(years=HOLDOUT_YEARS)
    ha, hb = a.loc[hold_start:], b.loc[hold_start:]
    hs, hbs = _sharpe(ha), _sharpe(hb)
    tests.append(Test("A6", "beat", "Wins on the most recent years",
                      f"Markets change. Does it beat the S&P 500 over the last {HOLDOUT_YEARS} "
                      "years alone?", hs > hbs, f"{_fmt(hs)} vs {_fmt(hbs)}",
                      "Sharpe above the S&P 500's since " + hold_start.date().isoformat()))

    # ---------- B. Is there anything real here?
    boot = bootstrap(a, b, rng)
    lo, hi = boot["sharpe_ci"]
    tests.append(Test("B1", "real", "Clearly above zero",
                      "If history had been shuffled a little, would it still have made money? "
                      "We replay 1,000 jumbled versions of the past and look at the range.",
                      lo > 0, f"95% range {_fmt(lo)} to {_fmt(hi)}",
                      "The whole 95% range of Sharpe is above zero"))

    pl = placebo(res, cfg.cost_bps, rng)
    tests.append(Test("B2", "real", "Timing matters",
                      "If we keep the same bets but place them on random dates, does it do "
                      "much worse? If not, the signal is not telling us anything.",
                      pl["p_value"] < 0.05,
                      f"beaten by {pl['p_value']:.0%} of {N_PLACEBO} random-date copies",
                      "Beaten by fewer than 5% of random-date copies"))

    sens = sensitivity(strategy, panel, cfg)
    sp = sens["share_positive"]
    tests.append(Test("B3", "real", "Not one lucky setting",
                      "If we nudge its settings a bit, does it still make money? A real effect "
                      "should not depend on picking exactly the right number.",
                      None if sp is None else sp >= 0.75,
                      "n/a" if sp is None else f"{sp:.0%} of {sens['tried']} variants positive "
                      f"(Sharpe {_fmt(sens['min'])} to {_fmt(sens['max'])})",
                      "At least 75% of nearby settings have a positive Sharpe"))

    yearly = (1 + a).groupby(a.index.year).prod() - 1
    best_year = int(yearly.idxmax()) if len(yearly) else None
    rest = a[a.index.year != best_year] if best_year else a
    sr = _sharpe(rest)
    tests.append(Test("B4", "real", "Not one lucky year",
                      "If we delete its single best year, is it still positive?",
                      sr > 0, f"{_fmt(sr)} without {best_year}",
                      "Sharpe above zero without the best year"))

    monthly = pd.DataFrame({"s": a, "b": b}).resample("ME").apply(lambda x: (1 + x).prod() - 1)
    worst = monthly[monthly["b"] <= monthly["b"].quantile(0.05)]
    tail = float(worst["s"].mean()) if len(worst) else float("nan")
    tests.append(Test("B5", "real", "Does not crash with stocks",
                      "In the worst months for the stock market, does it lose money too?",
                      tail >= 0, f"{_fmt(tail, 'pct')} average in the S&P 500's worst 5% of months",
                      "Zero or positive on average in the S&P 500's worst months"))

    beat = [t for t in tests if t.group == "beat"]
    real = [t for t in tests if t.group == "real"]
    trials_used = n_trials + sens["tried"] + 3  # matched vol, double cost and the base run
    return {
        "verdict": verdict(beat, real),
        "beats_sp500": all(t.passed for t in beat),
        "passed": sum(1 for t in tests if t.passed),
        "total": len(tests),
        "tests": [t.to_dict() for t in tests],
        "bootstrap": boot,
        "placebo": pl,
        "sensitivity": sens,
        "trials_including_gauntlet": trials_used,
        "settings": {"seed": SEED, "bootstrap": N_BOOTSTRAP, "block_days": BLOCK_DAYS,
                     "placebo": N_PLACEBO, "target_vol": TARGET_VOL,
                     "holdout_years": HOLDOUT_YEARS},
    }


def verdict(beat: list[Test], real: list[Test]) -> str:
    beats = all(t.passed for t in beat)
    real_score = sum(1 for t in real if t.passed)
    if beats and real_score >= 4:
        return "Beats the S&P 500 and the effect looks real. Check it again on new data."
    if beats:
        return "Looks like it beats the S&P 500 but fails the reality checks. Probably luck."
    if real_score >= 4:
        return "A real effect, but too small to beat the S&P 500 on its own."
    if real_score >= 2:
        return "Some signs of a real effect, not enough to rely on."
    return "No evidence of a real effect. Most likely noise."
