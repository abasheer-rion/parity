"""The always-on strategy search (DEC-0014).

It draws strategy variations at random from the factory's building blocks (which
idea, which assets, which settings), backtests each one, and keeps every result in a
local SQLite file, engine/output/search.db. It never stops on its own:

    parity search run --forever        # what the background service runs
    parity search status               # how many tried, best so far
    parity search export               # engine/output/search.json for the dashboard

Every variation tried is a trial, and all of them are counted. The "could this be
luck" score (deflated Sharpe) is recomputed at export time with the total count and
the real spread of results across trials, so searching more raises the bar instead of
lowering it. Nothing found here is a result until it is registered and run officially.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
import sqlite3
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

from .backtest.engine import BacktestConfig, run
from .data import catalog, store
from .data.catalog import EM, G10, INDUSTRIES
from .metrics import performance
from .metrics.performance import EULER_GAMMA
from .strategies import _blocks as B
from .strategies import _signals as S
from .strategies._util import hold_between_rebalances, rebalance_dates, zscore

OUT = Path(__file__).resolve().parents[2] / "output"
DB = OUT / "search.db"

FX = [f"fx.{c}" for c in G10]
WIDE = FX + [f"fx.{c}" for c in EM]
IND = [f"ind.{k}" for k in INDUSTRIES]
FAC = ["factor.SMB", "factor.HML", "factor.MOM", "factor.RMW", "factor.CMA", "factor.LTREV"]
UNIVERSES = {
    "g10": ("G10 currencies", FX), "fx21": ("21 currencies", WIDE),
    "ind": ("US industries", IND), "fac": ("Stock factors", FAC),
}
# Wider universes from the full catalog. New names only: an existing name must keep its
# assets, or old spec ids would point at different strategies. Every asset here is a
# daily, tradable price; monthly averages, spot gas and copper are never held.
MORE_UNIVERSES = {
    "xg10": ("G10 via ECB rates", S.XG10), "xwide": ("27 currencies", S.XWIDE),
    "bonds": ("Treasuries 2y 5y 10y", ["bond.TR2", "bond.TR5", "bond.TR10"]),
    "energy": ("Brent and WTI oil", ["cmd.BRENT", "cmd.WTI"]),
    "fac7": ("7 stock factors", FAC + ["factor.STREV"]),
    "macro": ("Stocks, bonds and oil", [B.MKT, "bond.TR10", "bond.TR2", "cmd.BRENT"]),
}
ALL_UNIVERSES = UNIVERSES | MORE_UNIVERSES
#: Universes where a long-only rank book holds assets that cost money, so it is funded.
#: The old universes keep their old rule, so an old id builds what it built.
FUNDED_RANK = ("ind", "bonds", "energy", "macro")
#: Everything a sampled spec may ever hold (DEC-0014): daily prices you can trade.
TRADABLE = {*FX, *WIDE, *IND, *FAC, "factor.STREV", *S.XWIDE, B.MKT, "bond.TR2", "bond.TR5",
            "bond.TR10", "cmd.BRENT", "cmd.WTI", B.CASH}
# A wide grid of lookbacks keeps the search finding new variations for a long time.
LOOKBACKS = [5, 8, 10, 15, 21, 30, 42, 52, 63, 84, 105, 126, 150, 189, 210, 252, 300, 378, 441, 504,
             630, 756]


def _months(days: int) -> str:
    return f"{days}d" if days < 21 else f"{round(days / 21)}m"


def _every(rebalance: str) -> str:
    return {"D": "daily", "W": "weekly", "M": "monthly"}[rebalance]


# --- the space of ideas ----------------------------------------------------------
# Each sampler returns a spec: a plain dict that fully describes one strategy. The same
# spec always builds the same strategy, and its hash is its id.

def _trend(r: random.Random) -> dict:
    # Copper is a monthly average, not tradable, so it is a signal only, never held.
    u = r.choice(list(UNIVERSES) + ["mkt", "bond", "oil"] + list(MORE_UNIVERSES))
    lookback = r.choice(LOOKBACKS[2:])
    return {"kind": "trend", "universe": u, "lookback": lookback,
            "skip": r.choice([0, 0, 21]) if lookback >= 126 else 0,
            "rebalance": r.choice(["W", "M"]),
            "long_only": u in ("ind", "mkt", "bond", "bonds", "macro") or r.random() < 0.2}


def _rank(r: random.Random) -> dict:
    u = r.choice(list(ALL_UNIVERSES))
    signals = ["momentum", "reversal", "low_vol", "near_high"]
    if u == "g10":
        signals += ["carry", "carry", "carry_and_momentum", "rate_change"]
    if u == "ind":
        signals += ["same_month"]
    sig = r.choice(signals)
    lookback = r.choice([5, 8, 10, 12]) if sig == "same_month" else r.choice(LOOKBACKS)
    n = len(ALL_UNIVERSES[u][1])
    ks = [1, 2, 3, 4, 5] if n >= 12 else [1, 2, 3, 4] if n >= 8 else [1, 2] if n >= 4 else [1]
    return {"kind": "rank", "universe": u, "rank_on": sig, "lookback": lookback,
            "skip": 0 if lookback < 126 or sig != "momentum" else r.choice([0, 21]),
            "k": r.choice(ks),
            "long_short": u in ("g10", "fx21", "fac", "xg10", "xwide", "fac7")
            or r.random() < 0.3,
            "rebalance": r.choice(["W", "M"])}


TIMING_RULES = ["above_average", "absolute_momentum", "vix_below_average", "vix_below",
                "curve_positive", "rates_falling", "copper_up", "oil_calm"]
# Rules on the wider data (DEC-0027). Their cash earns the T-bill, so cash scores zero.
WIDER_RULES = ["stress_below", "conditions_easing", "claims_calm", "spx_not_crowded",
               "fomc_week"]
TIMING_RULES += WIDER_RULES


def _timing(r: random.Random) -> dict:
    rule = r.choice(TIMING_RULES)
    p = {"above_average": r.choice([30, 50, 75, 100, 125, 150, 175, 200, 225, 250, 300]),
         "absolute_momentum": r.choice([21, 42, 63, 126, 189, 252, 378]),
         "vix_below_average": r.choice([10, 21, 42, 63, 126, 252]),
         "vix_below": r.choice([15, 18, 20, 22, 25, 28, 30, 35, 40, 45]),
         "curve_positive": r.choice([-1.0, -0.5, -0.25, 0.0, 0.25, 0.5, 1.0, 1.5]),
         "rates_falling": r.choice([21, 63, 126, 189, 252]),
         "copper_up": r.choice([63, 126, 189, 252]),
         "oil_calm": r.choice([0.2, 0.3, 0.4, 0.5, 0.65, 0.8]),
         "stress_below": r.choice([-0.5, 0.0, 0.5, 1.0, 1.5]),
         "conditions_easing": r.choice([21, 65, 130, 260]),
         "claims_calm": r.choice([0.1, 0.15, 0.2, 0.3, 0.4]),
         "spx_not_crowded": r.choice([0.5, 1.0, 1.5, 2.0]),
         # 0 holds even weeks of the Fed cycle, 1 the odd weeks: a built-in placebo.
         "fomc_week": r.choice([0, 1])}[rule]
    return {"kind": "timing", "rule": rule, "param": p, "fallback": r.choice(["cash", "bond"]),
            "leverage": r.choice([1.0, 1.0, 1.0, 1.25, 1.5]),
            "rebalance": r.choice(["D", "W", "M"])}


def _chart(r: random.Random) -> dict:
    u = r.choice(["g10", "fx21", "ind", "fac", "mkt"] + list(MORE_UNIVERSES))
    kind = r.choice(["macd", "bollinger", "ichimoku", "breakout"])
    spec = {"kind": "chart", "indicator": kind, "universe": u,
            "long_only": u in ("ind", "mkt", "bonds", "macro"),
            "rebalance": r.choice(["D", "W"])}
    if kind == "bollinger":
        spec |= {"window": r.choice([10, 15, 20, 30, 50, 100]),
                 "band": r.choice([1.0, 1.5, 2.0, 2.5, 3.0])}
    if kind == "breakout":
        spec |= {"entry": r.choice([10, 20, 40, 55, 100, 150]), "exit": r.choice([5, 10, 20, 40])}
    return spec


def _pair(r: random.Random) -> dict:
    pool = r.choice([WIDE, WIDE, IND])
    a, b = r.sample(pool, 2)
    return {"kind": "pair", "a": a, "b": b, "window": r.choice([20, 40, 60, 90, 120, 180, 250]),
            "entry": r.choice([1.0, 1.5, 2.0, 2.5, 3.0]), "delay": r.choice([0, 1])}


def _mix(r: random.Random) -> dict:
    pool = r.choice(["fac", "ind", "multi"])
    if pool == "multi":
        assets = r.sample([B.MKT, "bond.TR10", "bond.TR2", "cmd.BRENT"],
                          r.choice([2, 3]))
    else:
        assets = r.sample(UNIVERSES[pool][1], r.choice([2, 3, 4, 5, 6]))
    return {"kind": "mix", "assets": sorted(assets), "scale": r.choice(["fixed", "inverse_vol"]),
            "trend": r.choice([False, True]), "lookback": r.choice([126, 252]),
            "vol_target": r.choice([None, None, 0.06, 0.08, 0.10, 0.12, 0.15])}


def _positioning(r: random.Random) -> dict:
    """Currencies against (or with) speculators' futures positions, CFTC (DEC-0027)."""
    mode = r.choice(["rank", "extremes"])
    spec = {"kind": "cot", "mode": mode, "lookback": r.choice([130, 260, 520, 780, 1040]),
            "rebalance": r.choice(["W", "M"]), "follow": r.random() < 0.25}
    if mode == "rank":
        spec["k"] = r.choice([1, 2, 3])
    else:
        spec["entry"] = r.choice([1.0, 1.5, 2.0, 2.5])
    return spec


def _policy(r: random.Random) -> dict:
    """Currencies priced from ECB rates, ranked on BIS policy rates (DEC-0027)."""
    u = r.choice(["xg10", "xwide"])
    sig = r.choice(["policy_gap", "policy_gap", "policy_change"])
    return {"kind": "policy", "universe": u, "rank_on": sig,
            "lookback": r.choice([21, 63, 126, 252]) if sig == "policy_change" else 0,
            "k": r.choice([1, 2, 3] if u == "xg10" else [2, 3, 5, 7]),
            "stress_off": r.choice([None, None, 0.0, 1.0]),
            "rebalance": r.choice(["W", "M"])}


BASE_SAMPLERS = [(_trend, 3), (_rank, 4), (_timing, 3), (_chart, 2), (_pair, 1), (_mix, 2),
                 (_positioning, 1), (_policy, 2)]


# --- combinators (the wider search, DEC-0014) --------------------------------------
# Four ways to make a new variation out of existing ones. Each wraps whole specs, so a
# plain spec keeps its old id: a regime filter, a risk target, a shifted rebalance day,
# or a blend of two or three.

def _gate_series() -> list[str]:
    """Series a regime filter may read: everything in the catalog the panel can time
    correctly, with weekly, monthly and quarterly data moved to the day they come out.
    Left out: real exchange rates (monthly averages with no publication lag set), the
    Yahoo cross-check, the lagged French market file, raw ECB crosses (the same
    information as xfx.*) and futures positions in contracts (the percent is kept)."""
    skip = ("reer.", "ecb.", "xfx.", "eq.SPY", "eq.US_MKT")
    keys = []
    for key in catalog.CATALOG:
        if key.startswith(skip) or (key.startswith("cot.") and not key.endswith("_PCT")):
            continue
        if key.startswith("rate.") and key not in ("rate.USD", "rate.TBILL3M"):
            continue
        keys.append(key)
    return keys


GATE_SERIES = _gate_series()
GATE_TESTS = ["above_avg", "below_avg", "rising", "falling", "z_above", "z_below"]
GATE_WINDOWS = [10, 21, 42, 63, 126, 252, 504]
GATE_LEVELS = [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5]
WRAPPERS = ("gated", "voltarget", "offset", "ensemble")
MAX_DEPTH = 3


class Context:
    """What the sampler may know: the series on disk on this machine (None means all of
    them), and specs already tried, to wrap and blend."""

    def __init__(self, have: set[str] | None = None, pool: list[dict] | None = None):
        self.have = have
        self.pool = pool or []

    def series(self) -> list[str]:
        return [k for k in GATE_SERIES if self.have is None or k in self.have]


def _depth(spec: dict) -> int:
    if spec["kind"] == "ensemble":
        return 1 + max(_depth(p) for p in spec["parts"])
    if spec["kind"] in WRAPPERS:
        return 1 + _depth(spec["base"])
    return 0


def _base(r: random.Random, ctx: Context | None, from_pool: float = 0.5) -> dict:
    """A spec to wrap: some of the time one already tried, otherwise a fresh plain one."""
    if ctx and ctx.pool and r.random() < from_pool:
        spec = r.choice(ctx.pool)
        if _depth(spec) < MAX_DEPTH:
            return spec
    fns, weights = zip(*BASE_SAMPLERS, strict=True)
    return r.choices(fns, weights=weights)[0](r)


def _gate(r: random.Random, ctx: Context | None) -> dict:
    test = r.choice(GATE_TESTS)
    g = {"series": r.choice((ctx or Context()).series()), "test": test,
         "window": r.choice(GATE_WINDOWS)}
    if test.startswith("z_"):
        g["level"] = r.choice(GATE_LEVELS)
    return g


def _gated(r: random.Random, ctx: Context | None = None) -> dict:
    """A strategy that trades only while a second signal says the regime is right."""
    return {"kind": "gated", "base": _base(r, ctx), "gate": _gate(r, ctx),
            "rebalance": r.choice(["D", "W", "M"])}


def _voltarget(r: random.Random, ctx: Context | None = None) -> dict:
    """Any strategy, scaled to a steady level of risk."""
    return {"kind": "voltarget", "base": _base(r, ctx),
            "target": r.choice([0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.20]),
            "window": r.choice([21, 42, 63, 126, 252]), "cap": r.choice([1.0, 1.5, 2.0, 3.0]),
            "rebalance": r.choice(["D", "W", "M"])}


#: Plain spec kinds whose rebalance day can move.
OFFSETTABLE = ("trend", "rank", "timing", "chart", "cot", "policy")


def _offset(r: random.Random, ctx: Context | None = None) -> dict:
    """The same strategy, rebalanced a few business days after its usual day."""
    for _ in range(30):
        base = _base(r, ctx)
        if base["kind"] in OFFSETTABLE and base.get("rebalance") in ("W", "M"):
            break
    else:
        base = _trend(r) | {"rebalance": "M"}
    days = r.choice([1, 2, 3, 4] if base["rebalance"] == "W" else [1, 2, 3, 5, 7, 10, 15])
    return {"kind": "offset", "base": base, "days": days}


def _ensemble(r: random.Random, ctx: Context | None = None) -> dict:
    """An equal blend of two or three strategies, mostly ones already tried."""
    n = r.choice([2, 2, 3])
    parts: dict[str, dict] = {}
    for _ in range(n * 5):
        if len(parts) == n:
            break
        p = _base(r, ctx, from_pool=0.9)
        if _depth(p) < MAX_DEPTH:
            parts[spec_id(p)] = p
    # Sorted by id, so the same blend in any order is the same spec.
    return {"kind": "ensemble", "parts": [parts[k] for k in sorted(parts)]}


SAMPLERS = BASE_SAMPLERS + [(_gated, 6), (_voltarget, 3), (_offset, 2), (_ensemble, 3)]
WRAPPER_SAMPLERS = (_gated, _voltarget, _offset, _ensemble)


def sample(r: random.Random, ctx: Context | None = None,
           weights: list[float] | None = None) -> dict:
    """One spec. `weights` overrides the sampler weights (see `run_batch`)."""
    fns, base_w = zip(*SAMPLERS, strict=True)
    return _draw(r.choices(fns, weights=weights or base_w)[0], r, ctx)


def _draw(fn, r: random.Random, ctx: Context | None) -> dict:
    return fn(r, ctx) if fn in WRAPPER_SAMPLERS else fn(r)


def spec_id(spec: dict) -> str:
    return hashlib.sha1(json.dumps(spec, sort_keys=True).encode()).hexdigest()[:12]


# --- turning a spec into a strategy, a short name and labels -----------------------

def _assets(u: str) -> list[str]:
    return {"mkt": [B.MKT], "bond": ["bond.TR10"], "oil": ["cmd.BRENT"]}.get(u) \
        or ALL_UNIVERSES[u][1]


def _ulabel(u: str) -> str:
    return {"mkt": "US stocks", "bond": "Treasuries", "oil": "Oil"}.get(u) \
        or ALL_UNIVERSES[u][0]


RULE_LABEL = {"above_average": "above {p}d average",
              "absolute_momentum": "{p}-day gain beats cash",
              "vix_below_average": "VIX under its {p}d average", "vix_below": "VIX under {p}",
              "curve_positive": "curve above {p}", "rates_falling": "10y yield under {p}d average",
              "copper_up": "copper up over {p}d", "oil_calm": "oil up less than {p:.0%} in 3m",
              "stress_below": "stress index under {p}",
              "conditions_easing": "conditions easier than {p}d ago",
              "claims_calm": "claims under {p:.0%} above 1y low",
              "spx_not_crowded": "S&P futures not crowded ({p}σ)",
              "fomc_week": "Fed cycle week is {p}"}
SIGNAL_LABEL = {"momentum": "winners", "reversal": "losers bounce", "low_vol": "calmest",
                "near_high": "near high", "carry": "carry", "carry_and_momentum": "carry and trend",
                "rate_change": "rising rates", "same_month": "same month seasonality"}


SHORT = {B.MKT: "US stocks", "bond.TR10": "10y Treasuries", "bond.TR2": "2y Treasuries",
         "cmd.BRENT": "Oil", "factor.SMB": "Size", "factor.HML": "Value",
         "factor.MOM": "Momentum", "factor.RMW": "Profitability", "factor.CMA": "Investment",
         "factor.LTREV": "Long-term losers", "ind.NoDur": "Staples", "ind.Durbl": "Durables",
         "ind.Manuf": "Manufacturing", "ind.Enrgy": "Energy", "ind.Chems": "Chemicals",
         "ind.BusEq": "Tech", "ind.Telcm": "Telecom", "ind.Utils": "Utilities",
         "ind.Shops": "Retail", "ind.Hlth": "Health", "ind.Money": "Finance",
         "ind.Other": "Other industries"}


def describe(spec: dict) -> dict:
    """Short name, one-line description and tags for a spec."""
    k = spec["kind"]
    if k in WRAPPERS:
        return _describe_wrapper(spec)
    every = _every(spec.get("rebalance", "D"))
    if k == "trend":
        lo = "long or cash" if spec["long_only"] else "long or short"
        span = _months(spec["lookback"])
        ls = "" if spec["long_only"] else " L/S"
        name = f"{_ulabel(spec['universe'])} trend {span}{ls} {every}"
        line = f"Follows each asset's {span} trend, {lo}, rebalanced {every}."
        tags = ("trend", "momentum")
    elif k == "rank":
        sig = SIGNAL_LABEL[spec["rank_on"]]
        ls = " L/S" if spec["long_short"] else ""
        vs = f" vs bottom {spec['k']}" if spec["long_short"] else ""
        span = f"{spec['lookback']}y" if spec["rank_on"] == "same_month" \
            else _months(spec["lookback"])
        name = f"{_ulabel(spec['universe'])} {sig} {span} top {spec['k']}{ls} {every}"
        line = f"Ranks {_ulabel(spec['universe'])} on {sig}, holds top {spec['k']}{vs}."
        fam = {"carry": "carry", "carry_and_momentum": "mixed", "reversal": "value",
               "low_vol": "volatility", "same_month": "calendar"}.get(spec["rank_on"], "trend")
        tags = (fam, sig)
    elif k == "cot":
        side = "with" if spec["follow"] else "against"
        how = f"top {spec['k']}" if spec["mode"] == "rank" else f"beyond {spec['entry']}σ"
        name = f"Currencies {side} speculators {_months(spec['lookback'])} {how} {every}"
        line = (f"Trades currencies {side} speculators' futures positions (CFTC), "
                f"{'ranked' if spec['mode'] == 'rank' else 'only at extremes'}.")
        tags = ("trend" if spec["follow"] else "value", "positioning")
    elif k == "policy":
        ul = "G10" if spec["universe"] == "xg10" else "27 currencies"
        sig = "policy carry" if spec["rank_on"] == "policy_gap" else \
            f"policy hikes {_months(spec['lookback'])}"
        calm = f", off above stress {spec['stress_off']}" if spec["stress_off"] is not None \
            else ""
        name = f"{ul} {sig} top {spec['k']} L/S{calm} {every}"
        line = f"Ranks {ul} on central bank {sig}, long the top {spec['k']}, short the bottom."
        tags = ("carry" if spec["rank_on"] == "policy_gap" else "trend", "policy rates")
    elif k == "timing":
        p = {0: "even", 1: "odd"}[spec["param"]] if spec["rule"] == "fomc_week" \
            else spec["param"]
        rule = RULE_LABEL[spec["rule"]].format(p=p)
        lev = f" at {spec['leverage']}x" if spec["leverage"] > 1 else ""
        bonds = spec["fallback"] == "bond"
        name = f"Stocks{lev} if {rule}{' else bonds' if bonds else ''} {every}"
        line = f"Holds US stocks{lev} while {rule}, otherwise {'Treasuries' if bonds else 'cash'}."
        fam = "trend" if spec["rule"] in ("above_average", "absolute_momentum") else \
            "volatility" if spec["rule"].startswith(("vix", "stress", "conditions")) else \
            "calendar" if spec["rule"] == "fomc_week" else "mixed"
        tags = (fam, "timing")
    elif k == "chart":
        ind = {"macd": "MACD", "bollinger": "Bollinger fade", "ichimoku": "Ichimoku",
               "breakout": "breakout"}[spec["indicator"]]
        name = f"{_ulabel(spec['universe'])} {ind} {every}"
        line = f"Trades {_ulabel(spec['universe'])} on the {ind} chart signal."
        tags = ("value" if spec["indicator"] == "bollinger" else "trend", "chart indicator")
    elif k == "pair":
        a, b = (SHORT.get(x, x.split(".", 1)[1]) for x in (spec["a"], spec["b"]))
        late = " next day" if spec["delay"] else ""
        name = f"{a}/{b} pair {spec['window']}d at {spec['entry']}σ{late}"
        line = f"Bets the {a} to {b} ratio returns to its {spec['window']}-day average."
        tags = ("value", "pairs")
    else:
        short = [SHORT.get(x, x.split(".")[-1]) for x in spec["assets"]]
        name = f"Mix: {', '.join(short)}" if len(short) <= 4 else \
            f"Mix of {len(short)}: {', '.join(short[:3])} and {len(short) - 3} more"
        weighting = " weighted by calm" if spec["scale"] == "inverse_vol" else " equally"
        trending = ", each only while trending" if spec["trend"] else ""
        target = f", scaled to {spec['vol_target']:.0%} risk" if spec["vol_target"] else ""
        line = f"Holds {', '.join(short)}{weighting}{trending}{target}."
        tags = ("mixed", "allocation")
    return {"name": name, "line": line, "family": tags[0], "style": tags[1],
            "asset": _asset_class(spec)}


def _asset_class(spec: dict) -> str:
    u = spec.get("universe")
    if spec["kind"] in WRAPPERS:
        return _wrapper_asset(spec)
    if spec["kind"] in ("pair", "cot", "policy") or u in ("g10", "fx21", "xg10", "xwide"):
        return "fx"
    if spec["kind"] == "timing" or u in ("ind", "fac", "mkt", "fac7"):
        return "stocks"
    if u in ("oil", "energy"):
        return "commodities"
    return "mixed"


def build(spec: dict) -> B.Block:
    """The strategy object for a spec."""
    k = spec["kind"]
    if k in WRAPPERS:
        return _build_wrapper(spec)
    from .strategies.edges import WIDE_COST
    floor = {"min_cost_bps": WIDE_COST} if spec.get("universe") == "xwide" else {}
    if k == "trend":
        cls = type("SearchTrend", (B.TrendBook,), {"name": "search", "summary": "",
                   "universe": _assets(spec["universe"]), "long_only": spec["long_only"],
                   "funded": spec["long_only"], **floor})
        return cls(lookback=spec["lookback"], skip=spec["skip"], rebalance=spec["rebalance"])
    if k == "rank":
        cls = type("SearchRank", (B.RankBook,), {"name": "search", "summary": "",
                   "universe": _assets(spec["universe"]), "rank_on": spec["rank_on"],
                   "long_short": spec["long_short"],
                   "funded": not spec["long_short"] and spec["universe"] in FUNDED_RANK,
                   **floor})
        return cls(lookback=spec["lookback"], skip=spec["skip"], k=spec["k"],
                   rebalance=spec["rebalance"])
    if k == "timing":
        return _timing_strategy(spec)
    if k == "cot":
        return _cot_strategy(spec)
    if k == "policy":
        return _policy_strategy(spec)
    if k == "chart":
        base = B.BreakoutBook if spec["indicator"] == "breakout" else B.OscillatorBook
        attrs = {"name": "search", "summary": "", "universe": _assets(spec["universe"]),
                 "long_only": spec["long_only"], "funded": spec["long_only"],
                 "kind": spec["indicator"], **floor}
        params = {key: spec[key] for key in ("window", "band", "entry", "exit") if key in spec}
        return type("SearchChart", (base,), attrs)(rebalance=spec["rebalance"], **params)
    if k == "pair":
        cls = type("SearchPair", (B.PairBook,), {"name": "search", "summary": "",
                   "a": spec["a"], "b": spec["b"]})
        return cls(window=spec["window"], entry=spec["entry"], delay=spec["delay"])
    paid = [a for a in spec["assets"] if not a.startswith(B.ZERO_COST)]
    cls = type("SearchMix", (B.MixBook,), {"name": "search", "summary": "",
               "mix": {a: 1 / len(spec["assets"]) for a in spec["assets"]},
               "scale": spec["scale"], "only_if_trending": spec["trend"],
               "funded": bool(paid), "max_gross": 2.0})
    return cls(lookback=spec["lookback"], vol_target=spec["vol_target"])


COT_UNIVERSE = [f"fx.{c}" for c in S.COT_FX]


def _cot_strategy(spec: dict) -> B.Block:
    from .strategies import edges
    base = edges._CotRank if spec["mode"] == "rank" else edges._CotExtremes
    cls = type("SearchCot", (base,), {"name": "search", "summary": "",
               "universe": COT_UNIVERSE, "follow": spec["follow"]})
    size = {"k": spec["k"]} if spec["mode"] == "rank" else {"entry": spec["entry"]}
    return cls(lookback=spec["lookback"], rebalance=spec["rebalance"], **size)


def _policy_strategy(spec: dict) -> B.Block:
    from .strategies import edges
    gate_at = spec["stress_off"]
    cls = type("SearchPolicy", (edges._PolicyRank,), {
        "name": "search", "summary": "", "rank_on": spec["rank_on"], "gate_level": gate_at,
        "universe": S.XG10 if spec["universe"] == "xg10" else S.XWIDE,
        "min_cost_bps": edges.WIDE_COST if spec["universe"] == "xwide" else 0.0})
    return cls(k=spec["k"], rebalance=spec["rebalance"], lookback=spec["lookback"],
               level=0.0 if gate_at is None else gate_at)


def _timing_strategy(spec: dict) -> B.TimingBook:
    rule, p = spec["rule"], spec["param"]

    def invested(self, panel):
        px = panel[B.MKT]
        if rule == "above_average":
            return px > px.rolling(p).mean()
        if rule == "absolute_momentum":
            return B.past_return(px, p) > B.tbill_over(panel, p)
        if rule == "vix_below_average":
            return panel["risk.VIX"] < panel["risk.VIX"].rolling(p).mean()
        if rule == "vix_below":
            return panel["risk.VIX"] < p
        if rule == "curve_positive":
            return (panel["bond.UST10Y"] - panel["bond.UST2Y"]) > p
        if rule == "rates_falling":
            return panel["bond.UST10Y"] < panel["bond.UST10Y"].rolling(p).mean()
        if rule == "copper_up":
            return B.past_return(panel["cmd.COPPER"], p) > 0
        if rule == "stress_below":
            return panel["risk.STLFSI"] < p
        if rule == "conditions_easing":
            return panel["risk.NFCI"] <= panel["risk.NFCI"].shift(p)
        if rule == "claims_calm":
            c = panel["macro.CLAIMS"]
            avg, low = c.rolling(20, min_periods=15).mean(), c.rolling(260, min_periods=200).min()
            return avg / low - 1 < p
        if rule == "spx_not_crowded":
            return ~(S.cot_z(panel, ["SPX_EMINI"], 780)["SPX_EMINI"] > p)
        if rule == "fomc_week":
            return S.fomc_week(panel.index) % 2 == p
        return B.past_return(panel["cmd.BRENT"], 63) < p

    extra = {"absolute_momentum": ["rate.TBILL3M"], "vix_below_average": ["risk.VIX"],
             "vix_below": ["risk.VIX"], "curve_positive": ["bond.UST10Y", "bond.UST2Y"],
             "rates_falling": ["bond.UST10Y"], "copper_up": ["cmd.COPPER"],
             "oil_calm": ["cmd.BRENT"], "stress_below": ["risk.STLFSI"],
             "conditions_easing": ["risk.NFCI"], "claims_calm": ["macro.CLAIMS"],
             "spx_not_crowded": ["cot.SPX_EMINI_PCT"]}.get(rule, [])
    wider = rule in WIDER_RULES
    if wider:
        extra = extra + [S.TBILL]
    cls = type("SearchTiming", (B.TimingBook,), {
        "name": "search", "summary": "", "invested": invested, "extra": extra,
        "fallback": "bond.TR10" if spec["fallback"] == "bond" else B.CASH,
        "leverage": spec["leverage"], "max_gross": spec["leverage"]})
    return cls(rebalance=spec["rebalance"])


# --- building and naming the combinators -------------------------------------------

def gate_on(panel: pd.DataFrame, gate: dict) -> pd.Series:
    """1 while the regime filter is on, else 0. It reads the series a business day
    late: weekly and monthly data already sit on their release day in the panel, and
    the extra day covers releases that land after the prices we trade at."""
    x = panel[gate["series"]].shift(1)
    n, test = gate["window"], gate["test"]
    if test in ("above_avg", "below_avg"):
        avg = x.rolling(n, min_periods=n // 2).mean()
        on = x > avg if test == "above_avg" else x < avg
    elif test in ("rising", "falling"):
        on = x > x.shift(n) if test == "rising" else x < x.shift(n)
    else:
        z = zscore(x, n)
        on = z > gate["level"] if test == "z_above" else z < gate["level"]
    return on.astype(float)


def _rescale(w: pd.DataFrame, factor: pd.Series, funded: bool) -> pd.DataFrame:
    """Scale every position by `factor`. A funded book puts what is left in cash."""
    risky = w.drop(columns=[B.CASH], errors="ignore").mul(factor.reindex(w.index), axis=0)
    risky = risky.fillna(0.0)
    if funded:
        paid = [c for c in risky.columns if not c.startswith(B.ZERO_COST)]
        held = risky[paid].clip(lower=0).sum(axis=1) if paid else 0.0
        risky[B.CASH] = (1 - held).clip(lower=0.0)
    return risky


class _Combo(B.Block):
    """A strategy built from other search strategies."""

    name = "search"
    summary = ""

    def __init__(self, parts: list[B.Block], extra: list[str] | None = None):
        self._parts = parts
        self._extra = extra or []
        self.funded = any(getattr(p, "funded", False) for p in parts)
        self.min_cost_bps = max(getattr(p, "min_cost_bps", 0.0) for p in parts)
        self.max_gross = max(p.max_gross for p in parts)

    def instruments(self):
        ins = [c for p in self._parts for c in p.instruments()]
        return list(dict.fromkeys(ins + ([B.CASH] if self.funded else [])))

    def required(self):
        need = [c for p in self._parts for c in p.required()] + self._extra
        return list(dict.fromkeys(need + (["rate.USD"] if self.funded else [])))

    def _out(self, w: pd.DataFrame) -> pd.DataFrame:
        return w.reindex(columns=self.instruments()).fillna(0.0)


class _Gated(_Combo):
    def __init__(self, spec: dict):
        super().__init__([build(spec["base"])], [spec["gate"]["series"]])
        self._gate, self.rebalance = spec["gate"], spec["rebalance"]

    def weights(self, panel):
        on = hold_between_rebalances(gate_on(panel, self._gate).to_frame("on"),
                                     self.rebalance)["on"]
        return self._out(_rescale(self._parts[0].weights(panel), on, self.funded))


class _VolTarget(_Combo):
    def __init__(self, spec: dict):
        super().__init__([build(spec["base"])])
        self.target, self.window, self.cap = spec["target"], spec["window"], spec["cap"]
        self.rebalance = spec["rebalance"]
        self.max_gross = self.max_gross * self.cap

    def weights(self, panel):
        w = self._parts[0].weights(panel)
        risky = w.drop(columns=[B.CASH], errors="ignore")
        px = panel[list(risky.columns)]
        rets = px.pct_change(fill_method=None).where((px > 0) & (px.shift(1) > 0))
        # The book's own returns up to today, from yesterday's positions.
        port = (risky.shift(1) * rets.fillna(0.0)).sum(axis=1)
        vol = port.rolling(self.window, min_periods=max(10, self.window // 2)).std() \
            * np.sqrt(252)
        scale = (self.target / vol.replace(0.0, np.nan)).clip(upper=self.cap).fillna(0.0)
        scale = hold_between_rebalances(scale.to_frame("s"), self.rebalance)["s"]
        return self._out(_rescale(w, scale, self.funded))


class _Offset(_Combo):
    def __init__(self, spec: dict):
        base = spec["base"]
        super().__init__([build(base | {"rebalance": "D"})])
        self.freq, self.days = base["rebalance"], spec["days"]

    def weights(self, panel):
        w = self._parts[0].weights(panel)
        # The usual rebalance day, moved `days` business days later. Whether a day ended
        # its week or month is known the next day, so this never looks ahead.
        mask = rebalance_dates(w.index, self.freq).shift(self.days, fill_value=False)
        w = w.copy()
        w.loc[~mask.to_numpy()] = np.nan
        return self._out(w.ffill().fillna(0.0))


class _Ensemble(_Combo):
    def __init__(self, spec: dict):
        super().__init__([build(p) for p in spec["parts"]])

    def weights(self, panel):
        n = len(self._parts)
        total = pd.DataFrame(0.0, index=panel.index, columns=self.instruments())
        for p in self._parts:
            w = p.weights(panel).reindex(index=panel.index).fillna(0.0) / n
            if self.funded and not getattr(p, "funded", False):
                # A self-financing part earns the T-bill on its slice of capital.
                w[B.CASH] = w.get(B.CASH, 0.0) + 1 / n
            total = total.add(w, fill_value=0.0)
        return self._out(total)


def _build_wrapper(spec: dict) -> B.Block:
    return {"gated": _Gated, "voltarget": _VolTarget, "offset": _Offset,
            "ensemble": _Ensemble}[spec["kind"]](spec)


def _series_label(key: str) -> str:
    head, tail = key.split(".", 1)
    if head == "cot":
        return f"{tail.removesuffix('_PCT')} positioning"
    if head == "policy":
        return f"{tail} policy rate"
    if head == "curve":
        return f"{tail.replace('UST_', 'US ').replace('EA_AAA_', 'euro ')} yield"
    return SERIES_LABEL.get(key) or SHORT.get(key) or tail.replace("_", " ")


SERIES_LABEL = {"infl.BE5Y": "5y breakeven", "infl.BE10Y": "10y breakeven",
                "infl.FWD5Y5Y": "5y5y inflation", "usd.BROAD": "dollar index",
                "usd.AFE": "dollar vs rich", "usd.EME": "dollar vs EM",
                "macro.WEI": "economy index", "macro.CLAIMS": "jobless claims",
                "risk.STLFSI": "stress index", "risk.NFCI": "financial conditions",
                "money.EFFR": "fed funds", "money.ESTR": "euro overnight rate",
                "money.CP3M_FIN": "finance paper rate", "money.CP3M_NONFIN": "company paper rate",
                "bond.TIPS5Y": "5y real yield", "bond.TIPS10Y": "10y real yield",
                "bond.UST10Y": "10y yield", "bond.UST2Y": "2y yield", "bond.UST30Y": "30y yield",
                "credit.HQM10Y": "corporate yield", "spread.UST_2S10S": "2s10s curve",
                "spread.UST_3M10Y": "3m10y curve", "rate.TBILL3M": "T-bill",
                "rate.USD": "US 3m rate", "cmd.HH_GAS": "gas price",
                "eq.SPX": "S&P 500", "pm.LOANS_NDFI": "bank loans to private credit",
                "pm.LOANS_CRE": "property loans", "pm.LOANS_CI": "business loans",
                "pm.SLOOS_CI": "loan tightening", "pm.SLOOS_CRE": "property loan tightening",
                "pm.DELINQ_CRE": "property loan arrears", "pm.CRE_PRICE": "property prices",
                "pm.CRE_PRICE_YOY": "property price growth", "pm.HOUSE_FHFA": "house prices"}


def _gate_label(g: dict) -> tuple[str, str]:
    """A short form for names and a plain sentence for the one-line description."""
    s, n, t = _series_label(g["series"]), g["window"], g["test"]
    lv = g.get("level")
    short = {"above_avg": f"{s} over {n}d avg", "below_avg": f"{s} under {n}d avg",
             "rising": f"{s} up {n}d", "falling": f"{s} down {n}d",
             "z_above": f"{s} z>{lv} {n}d", "z_below": f"{s} z<{lv} {n}d"}[t]
    long = {"above_avg": f"{s} is above its {n}-day average",
            "below_avg": f"{s} is below its {n}-day average",
            "rising": f"{s} is higher than {n} days ago",
            "falling": f"{s} is lower than {n} days ago",
            "z_above": f"{s} is over {lv} standard deviations from its {n}-day norm",
            "z_below": f"{s} is under {lv} standard deviations from its {n}-day norm"}[t]
    return short, long


def _fit(head: str, tail: str, limit: int = 70) -> str:
    if len(head) + len(tail) <= limit:
        return head + tail
    return head[:max(limit - len(tail) - 3, 8)].rstrip() + "..." + tail


def _describe_wrapper(spec: dict) -> dict:
    k = spec["kind"]
    if k == "ensemble":
        ds = [describe(p) for p in spec["parts"]]
        names = " + ".join(d["name"] for d in ds)
        fams = {d["family"] for d in ds}
        return {"name": _fit(f"Blend: {names}", ""),
                "line": f"An equal blend of {len(ds)}: " + "; ".join(
                    d["line"].rstrip(".") for d in ds) + ".",
                "family": fams.pop() if len(fams) == 1 else "mixed", "style": "blend",
                "asset": _wrapper_asset(spec)}
    d = describe(spec["base"])
    line = d["line"].rstrip(".")
    if k == "gated":
        short, long = _gate_label(spec["gate"])
        name, line = _fit(d["name"], f" if {short}"), f"{line}, only while {long}."
        style = "regime filter"
    elif k == "voltarget":
        t = f"{spec['target']:.0%}"
        name = _fit(d["name"], f" at {t} risk")
        line = f"{line}, scaled to {t} yearly risk, at most {spec['cap']}x."
        style = "risk target"
    else:
        name = _fit(d["name"], f" +{spec['days']}d")
        line = f"{line}, rebalanced {spec['days']} business days after the usual day."
        style = "shifted rebalance"
    return {"name": name, "line": line, "family": d["family"], "style": style,
            "asset": d["asset"]}


def _wrapper_asset(spec: dict) -> str:
    if spec["kind"] == "ensemble":
        kinds = {_asset_class(p) for p in spec["parts"]}
        return kinds.pop() if len(kinds) == 1 else "mixed"
    return _asset_class(spec["base"])


# --- storage --------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY, spec TEXT NOT NULL, name TEXT, line TEXT, family TEXT, style TEXT,
  asset TEXT, start TEXT, years REAL, cagr REAL, vol REAL, sharpe REAL, max_dd REAL,
  turnover REAL, breakeven_bps REAL, corr REAL, beats_market INTEGER,
  sr_daily REAL, n_days INTEGER, skew REAL, kurt REAL, snapshot TEXT, error TEXT,
  tried_at TEXT NOT NULL)
"""


def connect(path: Path = DB) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute(SCHEMA)
    return con


def evaluate(spec: dict, panel: pd.DataFrame, bench: pd.Series, bench_ex: pd.Series,
             cfg: BacktestConfig) -> dict:
    res = run(build(spec), panel, cfg)
    risky = res.weights.drop(columns=[B.CASH], errors="ignore").abs().sum(axis=1)
    if (risky > 0.01).mean() < 0.05:
        # Sitting in cash earns the T-bill almost exactly, which fakes a huge Sharpe.
        raise ValueError("almost never invested")
    ex = res.excess_returns.dropna()
    if len(ex) < 252 * 3 or ex.std() == 0:
        raise ValueError("less than three years of returns")
    m = performance.summary(res.returns, res.gross_returns, res.turnover, bench,
                            excess=res.excess_returns, benchmark_excess=bench_ex)
    return {"start": m["start"], "years": m["years"], "cagr": m["cagr"], "vol": m["ann_vol"],
            "sharpe": m["sharpe"], "max_dd": m["max_drawdown"],
            "turnover": m.get("turnover_per_year"), "breakeven_bps": m.get("breakeven_cost_bps"),
            "corr": m.get("correlation"),
            "beats_market": int((m["sharpe"] or -9) > (m.get("benchmark_sharpe") or 9)),
            "sr_daily": float(ex.mean() / ex.std()), "n_days": int(len(ex)),
            "skew": float(stats.skew(ex)), "kurt": float(stats.kurtosis(ex, fisher=False))}


def _panel() -> tuple[pd.DataFrame, str, set[str]]:
    keys = sorted({*FX, *WIDE, *IND, *FAC, B.MKT, "bond.TR10", "bond.TR2", "bond.UST10Y",
                   "bond.UST2Y", "cmd.BRENT", "cmd.COPPER", "risk.VIX", "rate.USD",
                   "rate.TBILL3M", *[f"rate.{c}" for c in G10]})
    # The wider data (DEC-0027) and the rest of the catalog are optional: a series not
    # yet fetched on this machine is left out, the sampler does not draw it as a filter,
    # and variations that still need it are recorded as failed.
    wider = sorted({*COT_UNIVERSE, *S.cot_keys([*S.COT_FX, "SPX_EMINI"]), *S.XWIDE,
                    *S.policy_keys(S.XWIDE), "risk.STLFSI", "risk.NFCI", "macro.CLAIMS",
                    *TRADABLE - {B.CASH}, *GATE_SERIES})
    root = store.DEFAULT_DIR
    keys += [k for k in wider if k not in keys and store._path(catalog.get(k), root).exists()]
    snap = store.coverage().get("fetched_at") or "unknown"
    return store.panel(keys), snap, set(keys)


def _pool(con: sqlite3.Connection) -> list[dict]:
    """Specs already tried that ran and made money, for wrapping and blending."""
    rows = con.execute("SELECT spec FROM trials WHERE error IS NULL AND sharpe > 0")
    return [json.loads(r[0]) for r in rows]


def novelty(r: random.Random, seen: set[str], ctx: Context | None = None,
            probes: int = 40) -> list[tuple[int, int]]:
    """For each sampler, (new, drawn) over a few trial draws. A sampler whose draws are
    mostly repeats has worked through its region, so it is drawn less (`run_batch`)."""
    out = []
    for fn, _ in SAMPLERS:
        new = sum(spec_id(_draw(fn, r, ctx)) not in seen for _ in range(probes))
        out.append((new, probes))
    return out


def run_batch(n: int, seed: int | None = None, con: sqlite3.Connection | None = None) -> dict:
    """Try `n` new variations. Repeats are rejected before any backtest and are never
    counted as trials; every variation backtested is a trial, failed ones included.

    Each sampler is drawn in proportion to its weight times the share of its recent
    draws that were new, so saturated regions fade and fresh ones take over."""
    con = con or connect()
    r = random.Random(seed)
    panel, snap, have = _panel()
    cfg = BacktestConfig()
    bench_res = run(_benchmark(), panel, BacktestConfig(cost_bps=0.0))
    seen = {row[0] for row in con.execute("SELECT id FROM trials")}
    ctx = Context(have=have, pool=_pool(con))
    stats_ = novelty(r, seen, ctx)
    base_w = [w for _, w in SAMPLERS]
    done = failed = repeats = 0
    for _ in range(n * 50):
        if done + failed >= n:
            break
        weights = [w * (new + 1) / (drawn + 2) for w, (new, drawn) in zip(base_w, stats_,
                                                                           strict=True)]
        i = r.choices(range(len(SAMPLERS)), weights=weights)[0]
        spec = _draw(SAMPLERS[i][0], r, ctx)
        sid = spec_id(spec)
        new, drawn = stats_[i]
        if sid in seen:
            stats_[i] = (new, drawn + 1)
            repeats += 1
            continue
        stats_[i] = (new + 1, drawn + 1)
        seen.add(sid)
        d = describe(spec)
        row = {"id": sid, "spec": json.dumps(spec, sort_keys=True), **{k: d[k] for k in
               ("name", "line", "family", "style", "asset")}, "snapshot": snap,
               "tried_at": datetime.now(UTC).isoformat(timespec="seconds")}
        try:
            row |= evaluate(spec, panel, bench_res.returns, bench_res.excess_returns, cfg)
            done += 1
        except Exception as exc:  # a bad variation is recorded, never fatal
            row["error"] = str(exc)[:200]
            failed += 1
        cols = ", ".join(row)
        con.execute(f"INSERT OR REPLACE INTO trials ({cols}) VALUES ({', '.join('?' * len(row))})",
                    [_clean(v) for v in row.values()])
        con.commit()
    return {"tried": done, "failed": failed, "repeats": repeats}


def _clean(v):
    return None if isinstance(v, float) and not math.isfinite(v) else v


def _benchmark():
    from .strategies import get
    return get("us_market_buy_hold")


def run_forever(batch: int = 50, pause: float = 5.0, refresh_hours: float = 24.0,
                publish_hours: float = 6.0, max_hours: float | None = None) -> None:
    """The background service: batches forever, a data refresh once a day, an export
    after every batch, and a snapshot to the hosted site every few hours when
    PARITY_WRITER_DB_URL is set. Stop it with launchctl or Ctrl-C."""
    con = connect()
    last_fetch = last_publish = 0.0
    started = time.time()
    # With max_hours set it exits cleanly after that long; the service manager restarts
    # it, which is when it picks up new code.
    while max_hours is None or time.time() - started < max_hours * 3600:
        if time.time() - last_publish > publish_hours * 3600:
            last_publish = time.time()
            try:
                from .publish.supabase import NotConfigured, publish_search
                publish_search(export(con=con))
                print("published a snapshot to the site", flush=True)
            except NotConfigured:
                pass
            except Exception as exc:  # the site can wait; the search keeps going
                # Only the error's type: database errors can quote the connection
                # string, password included, and this goes to a log file.
                print(f"publish failed: {type(exc).__name__}", flush=True)
        if time.time() - last_fetch > refresh_hours * 3600:
            try:
                store.refresh()
            except Exception as exc:  # keep searching on yesterday's data
                print(f"data refresh failed: {exc}", flush=True)
            last_fetch = time.time()
        out = run_batch(batch, con=con)
        export(con=con)
        total = con.execute("SELECT COUNT(*) FROM trials").fetchone()[0]
        print(f"{datetime.now(UTC).isoformat(timespec='seconds')} +{out['tried']} "
              f"({out['failed']} failed, {out['repeats']} repeats skipped), "
              f"{total} tried in all", flush=True)
        time.sleep(pause)


# --- reading the results honestly ------------------------------------------------

def deflate(df: pd.DataFrame) -> pd.Series:
    """Deflated Sharpe for every trial, using the total number of trials and the real
    spread of daily Sharpe ratios across them (Bailey and Lopez de Prado, 2014)."""
    ok = df["sr_daily"].notna()
    n = int(len(df))
    if n < 2 or ok.sum() < 2:
        return pd.Series(np.nan, index=df.index)
    var = float(df.loc[ok, "sr_daily"].var())
    z1 = stats.norm.ppf(1 - 1 / n)
    z2 = stats.norm.ppf(1 - 1 / (n * math.e))
    sr0 = math.sqrt(var) * ((1 - EULER_GAMMA) * z1 + EULER_GAMMA * z2)
    sr, t = df["sr_daily"], df["n_days"]
    denom = np.sqrt(np.maximum(1 - df["skew"] * sr + (df["kurt"] - 1) / 4 * sr**2, 1e-12))
    return pd.Series(stats.norm.cdf((sr - sr0) * np.sqrt(t - 1) / denom), index=df.index)


def load(con: sqlite3.Connection | None = None) -> pd.DataFrame:
    con = con or connect()
    return pd.read_sql_query("SELECT * FROM trials", con)


def export(path: Path | None = None, top: int = 3000, con: sqlite3.Connection | None = None
           ) -> dict:
    """Write a compact file for the dashboard: totals, and the best `top` trials by
    deflated Sharpe, each with its short name, one line and key numbers."""
    df = load(con)
    total = int(len(df))
    good = df[df["error"].isna()].copy()
    good["deflated"] = deflate(good) if len(good) else []
    good = good.sort_values(["deflated", "sharpe"], ascending=False)
    cols = ["id", "name", "line", "family", "style", "asset", "start", "years", "cagr", "vol",
            "sharpe", "max_dd", "turnover", "breakeven_bps", "corr", "beats_market",
            "deflated"]
    rows = []
    for _, r in good.head(top).iterrows():
        spec = json.loads(r["spec"])
        # Names come from the spec at export time, so better wording reaches old rows too.
        rows.append({k: _round(r[k]) for k in cols} | describe(spec) | {"spec": spec})
    doc = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "trials": total,
        "failed": int(df["error"].notna().sum()),
        "beat_market": int(good["beats_market"].fillna(0).sum()),
        "passed_luck_check": int((good["deflated"] >= 0.95).sum()),
        "by_family": good.groupby("family").size().to_dict(),
        "by_asset": good.groupby("asset").size().to_dict(),
        "rows": rows,
    }
    path = path or OUT / "search.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, separators=(",", ":")))
    return doc


def _round(v):
    if isinstance(v, (float, np.floating)):
        return None if not math.isfinite(v) else round(float(v), 4)
    if isinstance(v, np.integer):
        return int(v)
    return v
