"""Sim World's world map and simulated paths (DEC-0016).

Two jobs, both honest about being history rather than forecasts:

* ``export`` writes the static file the world map reads: every currency we hold as its
  value in US dollars (daily for recent years, weekly back to 1986), the 3-month
  interest rates behind carry, the oil, gas and copper prices, and how each currency
  moved after each catalog event. For the replay tabs (DEC-0017) it also carries the
  12 US industries, the research factors, the Treasury curve and the VIX, weekly, with
  yields and the VIX marked as levels, not prices. The event reactions reuse the
  scenario simulator's own event study (``scenarios.event_reaction``), so the map and
  the Scenarios page measure a reaction the same way.
* ``bootstrap_paths`` draws simulated paths for a basket by stitching together blocks
  of real weekly returns, from all of history or only from the weeks after past events
  like a scenario. The paths show a range of outcomes and their risks under the
  assumption that the future reshuffles the past. They are not predictions.

The web page repeats the bootstrap in the browser (web/src/lib/paths.ts) with its own
random numbers, so its paths differ from these draw by draw but follow the same rules.
"""

from __future__ import annotations

import csv
import io
import math
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from . import scenarios as sc
from .data import catalog, store

DAILY_START = "2020-01-01"   # daily steps for the map: recent years only, to keep the file small
WEEKLY_START = "1986-01-03"  # weekly steps and the bootstrap: from the first oil price
EVENT_PATH_STEP = 3          # event paths are kept every 3rd trading day (0, 3, ..., 63)
ANALOGUE_WEEKS = 13          # the "weeks after an event" a bootstrap may draw from


@dataclass(frozen=True)
class Currency:
    code: str
    name: str
    key: str  # catalog key; "basket" for the US dollar index


CURRENCIES = [
    Currency("USD", "US dollar", "basket"),
    Currency("EUR", "Euro", "fx.EUR"),
    Currency("GBP", "British pound", "fx.GBP"),
    Currency("JPY", "Japanese yen", "fx.JPY"),
    Currency("CHF", "Swiss franc", "fx.CHF"),
    Currency("CAD", "Canadian dollar", "fx.CAD"),
    Currency("AUD", "Australian dollar", "fx.AUD"),
    Currency("NZD", "New Zealand dollar", "fx.NZD"),
    Currency("NOK", "Norwegian krone", "fx.NOK"),
    Currency("SEK", "Swedish krona", "fx.SEK"),
    Currency("DKK", "Danish krone", "fx.DKK"),
    Currency("MXN", "Mexican peso", "fx.MXN"),
    Currency("BRL", "Brazilian real", "fx.BRL"),
    Currency("KRW", "South Korean won", "fx.KRW"),
    Currency("INR", "Indian rupee", "fx.INR"),
    Currency("ZAR", "South African rand", "fx.ZAR"),
    Currency("SGD", "Singapore dollar", "fx.SGD"),
    Currency("CNY", "Chinese yuan", "fx.CNY"),
    Currency("HKD", "Hong Kong dollar", "fx.HKD"),
    Currency("THB", "Thai baht", "fx.THB"),
    Currency("TWD", "Taiwan dollar", "fx.TWD"),
    Currency("MYR", "Malaysian ringgit", "fx.MYR"),
]

COMMODITIES = [("oil", "Oil (WTI)", "cmd.WTI"), ("brent", "Oil (Brent)", "cmd.BRENT"),
               ("gas", "US natural gas", "cmd.HH_GAS")]
MONTHLY = [("copper", "Copper", "cmd.COPPER")]

# Extra assets the bootstrap can use beside the currencies and commodities. Each is a
# price or total return index, so a weekly change is a return someone could have had.
PATH_EXTRAS = [("stocks", "US stocks", "eq.US_TOTAL"),
               ("bonds10", "US 10-year Treasuries", "bond.TR10"),
               ("bonds2", "US 2-year Treasuries", "bond.TR2")]

# Series the replay tabs add (DEC-0017): US industries and research factors (Kenneth
# French, total return or long-short indexes), the Treasury curve and the VIX. Yields and
# the VIX are levels, not prices, so the page never turns them into returns.
INDUSTRY_NAMES = {"NoDur": "Consumer staples", "Durbl": "Consumer durables",
                  "Manuf": "Manufacturing", "Enrgy": "Energy", "Chems": "Chemicals",
                  "BusEq": "Business equipment (tech)", "Telcm": "Telecoms",
                  "Utils": "Utilities", "Shops": "Retail", "Hlth": "Health care",
                  "Money": "Finance", "Other": "Other industries"}
FACTOR_NAMES = {"SMB": "Size (small minus big)", "HML": "Value (cheap minus dear)",
                "MOM": "Momentum (winners minus losers)", "RMW": "Profitability",
                "CMA": "Investment (careful minus aggressive)", "STREV": "Short-term reversal",
                "LTREV": "Long-term reversal"}
PLAY_EXTRAS = (
    [(f"ind.{k}", v, f"ind.{k}", "industries", "price") for k, v in INDUSTRY_NAMES.items()]
    + [(f"factor.{k}", v, f"factor.{k}", "factors", "price") for k, v in FACTOR_NAMES.items()]
    + [("bond.UST2Y", "US 2-year yield", "bond.UST2Y", "yields", "level"),
       ("bond.UST10Y", "US 10-year yield", "bond.UST10Y", "yields", "level"),
       ("bond.UST30Y", "US 30-year yield", "bond.UST30Y", "yields", "level"),
       ("rate.TBILL3M", "US 3-month bill", "rate.TBILL3M", "yields", "level"),
       ("risk.VIX", "VIX (fear gauge)", "risk.VIX", "risk", "level")]
)
COPPER_LAG_DAYS = 5  # business days after the month ends, as the backtests read it


def _sig(v: float, digits: int = 6) -> float | None:
    return None if v is None or not math.isfinite(v) else float(f"{v:.{digits}g}")


def _dedup(s: pd.Series) -> pd.Series:
    return s[~s.index.duplicated(keep="last")].sort_index().dropna()


def load_levels(root: Path = store.DEFAULT_DIR) -> dict[str, pd.Series]:
    """Every series the world file uses, by its short key, as real closes.

    Currencies use their code (EUR), the rest their short name (oil, stocks). Missing
    cache files are skipped, so a partial fetch still exports what it has.
    """
    out: dict[str, pd.Series] = {}
    for c in CURRENCIES:
        try:
            if c.key == "basket":
                fx = pd.concat([_dedup(store.load(k, root)) for k in sc.BASKET], axis=1)
                out[c.code] = _dedup(sc.dollar_basket(fx))
            else:
                out[c.code] = _dedup(store.load(c.key, root))
        except FileNotFoundError:
            continue
    for short, _, key in COMMODITIES + MONTHLY + PATH_EXTRAS:
        try:
            out[short] = _dedup(store.load(key, root))
        except FileNotFoundError:
            continue
    for short, _, key, _, _ in PLAY_EXTRAS:
        try:
            out[short] = _dedup(store.load(key, root))
        except FileNotFoundError:
            continue
    return out


def load_rates(root: Path = store.DEFAULT_DIR) -> dict[str, pd.Series]:
    """3-month interbank rates (OECD, monthly, percent a year) by currency code."""
    out = {}
    for code in catalog._RATE_CODES:
        try:
            out[code] = _dedup(store.load(f"rate.{code}", root))
        except FileNotFoundError:
            continue
    return out


# ---------------------------------------------------------------- grids

def daily_grid(levels: dict[str, pd.Series], keys: list[str], start: str = DAILY_START) -> dict:
    """Shared business-day dates and each series' close on them (null where none).

    No forward fill: a holiday stays empty, and the page uses the last close on or
    before a date, as a person reading the paper would.
    """
    present = [k for k in keys if k in levels]
    if not present:
        return {"dates": [], "series": {}}
    end = max(levels[k].index.max() for k in present)
    idx = pd.bdate_range(start, end)
    series = {}
    for k in present:
        s = levels[k].reindex(idx)
        series[k] = [_sig(v) for v in s.to_numpy(float)]
    return {"dates": [d.date().isoformat() for d in idx], "series": series}


def weekly_grid(levels: dict[str, pd.Series], keys: list[str], start: str = WEEKLY_START,
                digits: int = 6) -> dict:
    """Friday closes (the last close of each week) from `start`, null before a series begins."""
    present = [k for k in keys if k in levels]
    if not present:
        return {"dates": [], "series": {}}
    frame = pd.concat({k: levels[k].resample("W-FRI").last() for k in present}, axis=1)
    frame = frame[frame.index >= pd.Timestamp(start)]
    # A week with no close at all (a series that paused) stays empty, never copied.
    return {"dates": [d.date().isoformat() for d in frame.index],
            "series": {k: [_sig(v, digits) for v in frame[k].to_numpy(float)] for k in present}}


def monthly_points(s: pd.Series, start: str = WEEKLY_START, lag: int | None = None) -> list[list]:
    """[date, value] pairs. With `lag`, a monthly average dated the 1st moves to the day
    it could first be read: the month's end plus `lag` business days."""
    if lag is not None:
        s = s.copy()
        s.index = s.index + pd.offsets.MonthEnd(0) + pd.offsets.BDay(lag)
    s = s[s.index >= pd.Timestamp(start)]
    return [[d.date().isoformat(), _sig(v, 5)] for d, v in s.items()]


# ---------------------------------------------------------------- events

def event_reactions(events: list[dict], levels: dict[str, pd.Series],
                    codes: list[str]) -> list[dict]:
    """How each currency (and oil and gas) moved after each catalog event.

    Uses the scenario simulator's event study: base is the last close before the
    event, changes are percent, and the path is kept every `EVENT_PATH_STEP` days.
    """
    out = []
    for ev in events:
        reactions, paths = {}, {}
        for code in codes:
            if code not in levels:
                continue
            r = sc.event_reaction(levels[code], ev["date"], "pct")
            if not r or not r["horizons"]:
                continue
            reactions[code] = {h: v["change"] for h, v in r["horizons"].items()}
            paths[code] = [round(v, 2) for v in r["path"][::EVENT_PATH_STEP]]
        out.append({"id": ev["id"], "reactions": reactions, "paths": paths})
    return out


# ---------------------------------------------------------------- export

def export(levels: dict[str, pd.Series], rates: dict[str, pd.Series],
           events: list[dict]) -> dict:
    """The static document the world map reads (see web/src/lib/world.ts)."""
    codes = [c.code for c in CURRENCIES if c.code in levels]
    commodity_keys = [k for k, _, _ in COMMODITIES]
    extras = [k for k, _, _ in PATH_EXTRAS]
    lasts = [s.index.max() for s in levels.values()]
    play = [k for k, *_ in PLAY_EXTRAS if k in levels]
    labels = {**{c.code: c.name for c in CURRENCIES},
              **{k: label for k, label, _ in COMMODITIES + MONTHLY + PATH_EXTRAS},
              **{k: label for k, label, *_ in PLAY_EXTRAS}}
    groups = {**{c.code: "currencies" for c in CURRENCIES},
              **{k: "commodities" for k, _, _ in COMMODITIES + MONTHLY},
              "stocks": "stocks", "bonds10": "bonds", "bonds2": "bonds",
              **{k: g for k, _, _, g, _ in PLAY_EXTRAS}}
    kinds = {k: kind for k, _, _, _, kind in PLAY_EXTRAS}
    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "data_through": max(lasts).date().isoformat() if lasts else None,
        "assets": [{"key": k, "label": labels[k], "group": groups[k],
                    "first": levels[k].index.min().date().isoformat(),
                    "rate": k in rates, "kind": kinds.get(k, "price")}
                   for k in [*codes, *commodity_keys, "copper", *extras, *play] if k in levels],
        "daily": daily_grid(levels, [*codes, *commodity_keys]),
        "weekly": weekly_grid(levels, [*codes, *commodity_keys, *extras, *play], digits=5),
        "monthly": {k: monthly_points(levels[k], lag=COPPER_LAG_DAYS) for k, _, _ in MONTHLY
                    if k in levels},
        "rates": {code: monthly_points(s) for code, s in rates.items()},
        "event_path_step": EVENT_PATH_STEP,
        "analogue_weeks": ANALOGUE_WEEKS,
        "events": event_reactions(events, levels, [*codes, *commodity_keys]),
    }


# ---------------------------------------------------------------- simulated paths

def weekly_returns(levels: pd.DataFrame) -> pd.DataFrame:
    """Weekly log returns, keeping only weeks where every column has one."""
    return np.log(levels).diff().dropna(how="any")


def analogue_mask(index: pd.DatetimeIndex, event_dates: list[str],
                  weeks: int = ANALOGUE_WEEKS) -> np.ndarray:
    """True for weeks ending after an event and within `weeks` weeks of it."""
    mask = np.zeros(len(index), bool)
    for d in event_dates:
        t = pd.Timestamp(d)
        mask |= (index > t) & (index <= t + pd.Timedelta(weeks=weeks))
    return mask


def block_starts(index: pd.DatetimeIndex, pool: np.ndarray, block: int) -> np.ndarray:
    """Row positions where a run of `block` pooled, back-to-back weeks begins."""
    if len(index) < block:
        return np.array([], int)
    gaps = np.diff(index.to_numpy()).astype("timedelta64[D]").astype(int)
    starts = []
    for i in range(len(index) - block + 1):
        if pool[i:i + block].all() and (block == 1 or (gaps[i:i + block - 1] <= 8).all()):
            starts.append(i)
    return np.array(starts, int)


def bootstrap_paths(returns: pd.DataFrame, weeks: int, n: int, block: int = 4,
                    seed: int | None = None, pool: np.ndarray | None = None) -> dict:
    """Simulated paths built from blocks of real weekly returns.

    Each path strings together randomly chosen runs of `block` consecutive weeks
    (all assets share the same weeks, so their links to each other survive) until it
    is `weeks` long. Returns {"levels": array (n, weeks + 1, assets) starting at 100,
    "basket": array (n, weeks + 1), "block": the block length used, "pool_weeks": the
    number of weeks drawn from}. The basket holds equal amounts, rebalanced weekly.

    When the pool has no run as long as `block` (a short analogue window), the block
    shrinks until one fits.
    """
    if weeks < 1 or n < 1:
        raise ValueError("weeks and n must be at least 1")
    r = returns.to_numpy(float)
    pool = np.ones(len(returns), bool) if pool is None else np.asarray(pool, bool)
    if pool.sum() == 0:
        raise ValueError("no weeks to draw from")
    size = max(1, min(block, weeks))
    starts = block_starts(returns.index, pool, size)
    while starts.size == 0 and size > 1:
        size -= 1
        starts = block_starts(returns.index, pool, size)
    rng = np.random.default_rng(seed)
    blocks_per_path = math.ceil(weeks / size)
    picks = rng.choice(starts, size=(n, blocks_per_path))
    rows = (picks[:, :, None] + np.arange(size)[None, None, :]).reshape(n, -1)[:, :weeks]
    drawn = r[rows]                                   # (n, weeks, assets)
    levels = 100 * np.exp(np.concatenate([np.zeros((n, 1, r.shape[1])),
                                          np.cumsum(drawn, axis=1)], axis=1))
    basket_r = np.log(np.exp(drawn).mean(axis=2))     # equal weight, rebalanced weekly
    basket = 100 * np.exp(np.concatenate([np.zeros((n, 1)), np.cumsum(basket_r, axis=1)],
                                         axis=1))
    return {"levels": levels, "basket": basket, "block": size, "pool_weeks": int(pool.sum())}


def risk(final: np.ndarray, loss_at: float = 10.0) -> dict:
    """Risk of a set of end values that started at 100.

    `worst5` is the 5th percentile return; `tail5` the average return of the worst 5%
    of paths (expected shortfall); `p_loss_gt` the share losing more than `loss_at`%.
    """
    ret = final / 100.0 - 1.0
    q5, q25, q50, q75, q95 = np.quantile(ret, [0.05, 0.25, 0.5, 0.75, 0.95])
    tail = ret[ret <= q5]
    return {"median": float(q50), "q25": float(q25), "q75": float(q75), "worst5": float(q5),
            "best5": float(q95), "tail5": float(tail.mean()) if tail.size else float(q5),
            "p_loss": float((ret < 0).mean()), "p_loss_gt": float((ret < -loss_at / 100).mean()),
            "loss_at": loss_at}


def paths_csv(sim: dict, assets: list[str]) -> str:
    """Wide CSV: one row per path and week, a column per asset and the basket."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["path", "week", *assets, "basket"])
    levels, basket = sim["levels"], sim["basket"]
    for p in range(levels.shape[0]):
        for t in range(levels.shape[1]):
            w.writerow([p + 1, t, *(f"{v:.4f}" for v in levels[p, t]), f"{basket[p, t]:.4f}"])
    return buf.getvalue()
