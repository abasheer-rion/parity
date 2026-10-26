"""Monte Carlo stress tests for a mix of assets (DEC-0066).

Each simulated path strings together random 13-week blocks of real weekly returns (all
assets share the same weeks, so their links survive), optionally with a real crash
stretch spliced in at a chosen week. A mix is rebalanced to its weights every week. Per
mix the summary gives the spread of end values, the worst falls and how long a fall took
to make back. History reshuffled, not a forecast.

    parity world stress         writes output/stress.json (the sims service runs it every
                                cycle, so the Terminal's MC panel can show a large check
                                beside the paths it draws in the browser)

The browser repeats the same rules (web/src/lib/stress.ts) with its own random numbers.
"""

from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pandas as pd

PRESETS = [
    ("sixty_forty", "60/40 stocks and bonds", {"stocks": 60, "bonds10": 40}),
    ("all_stocks", "All US stocks", {"stocks": 100}),
    ("bonds_heavy", "30/70 stocks and bonds", {"stocks": 30, "bonds10": 70}),
    ("real_assets", "Stocks, bonds and oil", {"stocks": 50, "bonds10": 30, "oil": 20}),
    ("defensive", "Defensive industries", {"ind.Utils": 34, "ind.Hlth": 33, "ind.NoDur": 33}),
    ("havens", "Stocks with yen and franc", {"stocks": 60, "JPY": 20, "CHF": 20}),
]
# Real stretches of weeks to splice in, first and last Friday.
CRASHES = [
    ("crash1987", "1987 crash", "1987-10-02", "1987-12-04"),
    ("dotcom", "Dot-com crash", "2000-03-24", "2002-10-11"),
    ("gfc", "2008 crisis", "2007-10-12", "2009-03-13"),
    ("covid", "Covid crash", "2020-02-21", "2020-03-27"),
    ("inflation", "2022 inflation", "2022-01-07", "2022-10-14"),
]
HORIZONS = [52, 156, 260, 520]  # weeks: 1, 3, 5 and 10 years
BLOCK = 13
N_PATHS = 5000
SEED = 7
QS = (0.05, 0.25, 0.5, 0.75, 0.95)


def weekly_simple(levels: dict[str, pd.Series], keys: list[str]) -> pd.DataFrame:
    """Simple weekly returns on Fridays, only weeks where every key has one."""
    frame = pd.concat({k: levels[k].resample("W-FRI").last() for k in keys}, axis=1)
    return frame.pct_change(fill_method=None).dropna(how="any")


def block_starts(index: pd.DatetimeIndex, block: int) -> np.ndarray:
    """Row positions where `block` back-to-back weeks (no gap over 8 days) begin."""
    gaps = np.diff(index.values).astype("timedelta64[D]").astype(int) > 8
    ok = []
    for i in range(len(index) - block + 1):
        if not gaps[i:i + block - 1].any():
            ok.append(i)
    return np.array(ok, int)


def simulate(rets: pd.DataFrame, weights: dict[str, float], weeks: int, n: int,
             seed: int, crash: tuple[str, str] | None = None, crash_at: int = 0,
             block: int = BLOCK) -> np.ndarray:
    """Values of the mix, shape (n, weeks + 1), starting at 1."""
    keys = list(weights)
    w = np.array([weights[k] for k in keys], float)
    w = w / w.sum()
    r = rets[keys].to_numpy(float) @ w
    starts = block_starts(rets.index, min(block, weeks))
    rng = np.random.default_rng(seed)
    nb = -(-weeks // block)
    picks = rng.choice(starts, size=(n, nb))
    idx = (picks[:, :, None] + np.arange(block)[None, None, :]).reshape(n, -1)[:, :weeks]
    path = r[idx]
    if crash is not None:
        mask = (rets.index >= pd.Timestamp(crash[0])) & (rets.index <= pd.Timestamp(crash[1]))
        cr = r[mask][: max(0, weeks - crash_at)]
        path[:, crash_at:crash_at + len(cr)] = cr
    values = np.concatenate([np.ones((n, 1)), np.cumprod(1 + path, axis=1)], axis=1)
    return values


def drawdown_stats(values: np.ndarray) -> dict:
    """Worst fall per path and the weeks from its peak until that peak was made back."""
    peak = np.maximum.accumulate(values, axis=1)
    dd = values / peak - 1
    trough = dd.argmin(axis=1)
    worst = dd.min(axis=1)
    n, t = values.shape
    rows = np.arange(n)
    col = np.arange(t)[None, :]
    peak_at = np.where(col <= trough[:, None], values, -np.inf).argmax(axis=1)
    peak_val = values[rows, peak_at]
    back = (values >= peak_val[:, None]) & (col > trough[:, None])
    first = back.argmax(axis=1)
    recover = np.where(back.any(axis=1), first - peak_at, -1)
    recover = np.where(worst == 0, 0, recover)
    return {"worst": worst, "recover": recover}


def summarise(values: np.ndarray) -> dict:
    """Counts and percentiles of one stress run, as the MC panel shows them."""
    final = values[:, -1]
    dd = drawdown_stats(values)
    rec = dd["recover"]
    hit = rec > 0
    weeks = values.shape[1] - 1
    step = max(1, weeks // 52)
    cols = list(range(0, weeks + 1, step))
    if cols[-1] != weeks:
        cols.append(weeks)
    bands = np.quantile(values[:, cols], QS, axis=0)
    r4 = lambda v: round(float(v), 4)  # noqa: E731
    return {
        "n": int(values.shape[0]),
        "final": [r4(q) for q in np.quantile(final, QS)],
        "worst1": r4(np.quantile(final, 0.01)),
        "p_loss": r4((final < 1).mean()),
        "max_dd": [r4(q) for q in np.quantile(dd["worst"], (0.05, 0.5))],
        "fell": r4((dd["worst"] < 0).mean()),
        "recover_weeks": None if not hit.any() else
        [int(q) for q in np.quantile(rec[hit], (0.5, 0.9))],
        "unrecovered": r4((rec < 0).mean()),
        "bands": {"weeks": cols, "q": [[r4(v) for v in row] for row in bands]},
    }


def export(levels: dict[str, pd.Series], n: int = N_PATHS, seed: int = SEED) -> dict:
    """Every preset mix at every horizon, plain and with each crash spliced in at week 0."""
    keys = sorted({k for _, _, w in PRESETS for k in w if k in levels})
    rets = weekly_simple(levels, keys)
    mixes = []
    for pid, label, weights in PRESETS:
        if any(k not in rets for k in weights):
            continue
        runs = {}
        for h in HORIZONS:
            runs[str(h)] = {"none": summarise(simulate(rets, weights, h, n, seed))}
            for cid, _, a, b in CRASHES:
                runs[str(h)][cid] = summarise(simulate(rets, weights, h, n, seed, (a, b)))
        mixes.append({"id": pid, "label": label, "weights": weights, "runs": runs})
    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "data_from": rets.index.min().date().isoformat(),
        "data_through": rets.index.max().date().isoformat(),
        "weeks_of_history": int(len(rets)),
        "block": BLOCK, "paths": n, "seed": seed, "horizons": HORIZONS,
        "crashes": [{"id": c, "label": label, "from": a, "to": b} for c, label, a, b in CRASHES],
        "mixes": mixes,
        "note": "Reshuffled history, not a forecast. Rebalanced weekly, no trading costs.",
    }
