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
from .data import store
from .data.catalog import EM, G10, INDUSTRIES
from .metrics import performance
from .metrics.performance import EULER_GAMMA
from .strategies import _blocks as B

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
LOOKBACKS = [5, 10, 21, 42, 63, 126, 189, 252, 378, 504]


def _months(days: int) -> str:
    return f"{days}d" if days < 21 else f"{round(days / 21)}m"


def _every(rebalance: str) -> str:
    return {"D": "daily", "W": "weekly", "M": "monthly"}[rebalance]


# --- the space of ideas ----------------------------------------------------------
# Each sampler returns a spec: a plain dict that fully describes one strategy. The same
# spec always builds the same strategy, and its hash is its id.

def _trend(r: random.Random) -> dict:
    # Copper is a monthly average, not tradable, so it is a signal only, never held.
    u = r.choice(list(UNIVERSES) + ["mkt", "bond", "oil"])
    lookback = r.choice(LOOKBACKS[2:])
    return {"kind": "trend", "universe": u, "lookback": lookback,
            "skip": r.choice([0, 0, 21]) if lookback >= 126 else 0,
            "rebalance": r.choice(["W", "M"]),
            "long_only": u in ("ind", "mkt", "bond") or r.random() < 0.2}


def _rank(r: random.Random) -> dict:
    u = r.choice(list(UNIVERSES))
    signals = ["momentum", "reversal", "low_vol", "near_high"]
    if u == "g10":
        signals += ["carry", "carry", "carry_and_momentum", "rate_change"]
    if u == "ind":
        signals += ["same_month"]
    sig = r.choice(signals)
    lookback = r.choice([5, 8, 10, 12]) if sig == "same_month" else r.choice(LOOKBACKS)
    n = len(UNIVERSES[u][1])
    return {"kind": "rank", "universe": u, "rank_on": sig, "lookback": lookback,
            "skip": 0 if lookback < 126 or sig != "momentum" else r.choice([0, 21]),
            "k": r.choice([1, 2, 3, 4] if n >= 8 else [1, 2]),
            "long_short": u in ("g10", "fx21", "fac") or r.random() < 0.3,
            "rebalance": r.choice(["W", "M"])}


TIMING_RULES = ["above_average", "absolute_momentum", "vix_below_average", "vix_below",
                "curve_positive", "rates_falling", "copper_up", "oil_calm"]


def _timing(r: random.Random) -> dict:
    rule = r.choice(TIMING_RULES)
    p = {"above_average": r.choice([50, 100, 150, 200, 250]),
         "absolute_momentum": r.choice([63, 126, 252]),
         "vix_below_average": r.choice([21, 63, 126, 252]),
         "vix_below": r.choice([20, 25, 30, 35, 40]),
         "curve_positive": r.choice([-0.5, 0.0, 0.5, 1.0]),
         "rates_falling": r.choice([63, 126, 252]),
         "copper_up": r.choice([63, 126, 252]),
         "oil_calm": r.choice([0.3, 0.5, 0.8])}[rule]
    return {"kind": "timing", "rule": rule, "param": p, "fallback": r.choice(["cash", "bond"]),
            "leverage": r.choice([1.0, 1.0, 1.0, 1.25, 1.5]),
            "rebalance": r.choice(["D", "W", "M"])}


def _chart(r: random.Random) -> dict:
    u = r.choice(["g10", "ind", "mkt"])
    kind = r.choice(["macd", "bollinger", "ichimoku", "breakout"])
    spec = {"kind": "chart", "indicator": kind, "universe": u, "long_only": u != "g10",
            "rebalance": r.choice(["D", "W"])}
    if kind == "bollinger":
        spec |= {"window": r.choice([10, 20, 50]), "band": r.choice([1.5, 2.0, 2.5])}
    if kind == "breakout":
        spec |= {"entry": r.choice([20, 55, 100]), "exit": r.choice([10, 20])}
    return spec


def _pair(r: random.Random) -> dict:
    a, b = r.sample(G10, 2)
    return {"kind": "pair", "a": f"fx.{a}", "b": f"fx.{b}", "window": r.choice([60, 120, 250]),
            "entry": r.choice([1.5, 2.0, 2.5]), "delay": r.choice([0, 1])}


def _mix(r: random.Random) -> dict:
    pool = r.choice(["fac", "ind", "multi"])
    if pool == "multi":
        assets = r.sample([B.MKT, "bond.TR10", "bond.TR2", "cmd.BRENT"],
                          r.choice([2, 3]))
    else:
        assets = r.sample(UNIVERSES[pool][1], r.choice([2, 3, 4, 5]))
    return {"kind": "mix", "assets": sorted(assets), "scale": r.choice(["fixed", "inverse_vol"]),
            "trend": r.choice([False, True]), "lookback": r.choice([126, 252]),
            "vol_target": r.choice([None, None, 0.08, 0.12])}


SAMPLERS = [(_trend, 3), (_rank, 4), (_timing, 3), (_chart, 2), (_pair, 1), (_mix, 2)]


def sample(r: random.Random) -> dict:
    fns, weights = zip(*SAMPLERS, strict=True)
    return r.choices(fns, weights=weights)[0](r)


def spec_id(spec: dict) -> str:
    return hashlib.sha1(json.dumps(spec, sort_keys=True).encode()).hexdigest()[:12]


# --- turning a spec into a strategy, a short name and labels -----------------------

def _assets(u: str) -> list[str]:
    return {"mkt": [B.MKT], "bond": ["bond.TR10"], "oil": ["cmd.BRENT"]}.get(u) \
        or UNIVERSES[u][1]


def _ulabel(u: str) -> str:
    return {"mkt": "US stocks", "bond": "Treasuries", "oil": "Oil"}.get(u) or UNIVERSES[u][0]


RULE_LABEL = {"above_average": "above {p}d average",
              "absolute_momentum": "{p}-day gain beats cash",
              "vix_below_average": "VIX under its {p}d average", "vix_below": "VIX under {p}",
              "curve_positive": "curve above {p}", "rates_falling": "10y yield under {p}d average",
              "copper_up": "copper up over {p}d", "oil_calm": "oil up less than {p:.0%} in 3m"}
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
    elif k == "timing":
        rule = RULE_LABEL[spec["rule"]].format(p=spec["param"])
        lev = f" at {spec['leverage']}x" if spec["leverage"] > 1 else ""
        bonds = spec["fallback"] == "bond"
        name = f"Stocks{lev} if {rule}{' else bonds' if bonds else ''} {every}"
        line = f"Holds US stocks{lev} while {rule}, otherwise {'Treasuries' if bonds else 'cash'}."
        fam = "trend" if spec["rule"] in ("above_average", "absolute_momentum") else \
            "volatility" if spec["rule"].startswith("vix") else "mixed"
        tags = (fam, "timing")
    elif k == "chart":
        ind = {"macd": "MACD", "bollinger": "Bollinger fade", "ichimoku": "Ichimoku",
               "breakout": "breakout"}[spec["indicator"]]
        name = f"{_ulabel(spec['universe'])} {ind} {every}"
        line = f"Trades {_ulabel(spec['universe'])} on the {ind} chart signal."
        tags = ("value" if spec["indicator"] == "bollinger" else "trend", "chart indicator")
    elif k == "pair":
        a, b = spec["a"][3:], spec["b"][3:]
        late = " next day" if spec["delay"] else ""
        name = f"{a}/{b} pair {spec['window']}d at {spec['entry']}σ{late}"
        line = f"Bets the {a} to {b} ratio returns to its {spec['window']}-day average."
        tags = ("value", "pairs")
    else:
        short = [SHORT.get(x, x.split(".")[-1]) for x in spec["assets"]]
        name = f"Mix: {', '.join(short)}"
        weighting = " weighted by calm" if spec["scale"] == "inverse_vol" else " equally"
        trending = ", each only while trending" if spec["trend"] else ""
        target = f", scaled to {spec['vol_target']:.0%} risk" if spec["vol_target"] else ""
        line = f"Holds {', '.join(short)}{weighting}{trending}{target}."
        tags = ("mixed", "allocation")
    return {"name": name, "line": line, "family": tags[0], "style": tags[1],
            "asset": _asset_class(spec)}


def _asset_class(spec: dict) -> str:
    u = spec.get("universe")
    if spec["kind"] == "pair" or u in ("g10", "fx21"):
        return "fx"
    if spec["kind"] == "timing" or u in ("ind", "fac", "mkt"):
        return "stocks"
    if u == "oil":
        return "commodities"
    return "mixed"


def build(spec: dict) -> B.Block:
    """The strategy object for a spec."""
    k = spec["kind"]
    if k == "trend":
        cls = type("SearchTrend", (B.TrendBook,), {"name": "search", "summary": "",
                   "universe": _assets(spec["universe"]), "long_only": spec["long_only"],
                   "funded": spec["long_only"]})
        return cls(lookback=spec["lookback"], skip=spec["skip"], rebalance=spec["rebalance"])
    if k == "rank":
        cls = type("SearchRank", (B.RankBook,), {"name": "search", "summary": "",
                   "universe": _assets(spec["universe"]), "rank_on": spec["rank_on"],
                   "long_short": spec["long_short"],
                   "funded": not spec["long_short"] and spec["universe"] == "ind"})
        return cls(lookback=spec["lookback"], skip=spec["skip"], k=spec["k"],
                   rebalance=spec["rebalance"])
    if k == "timing":
        return _timing_strategy(spec)
    if k == "chart":
        base = B.BreakoutBook if spec["indicator"] == "breakout" else B.OscillatorBook
        attrs = {"name": "search", "summary": "", "universe": _assets(spec["universe"]),
                 "long_only": spec["long_only"], "funded": spec["long_only"],
                 "kind": spec["indicator"]}
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
        return B.past_return(panel["cmd.BRENT"], 63) < p

    extra = {"absolute_momentum": ["rate.TBILL3M"], "vix_below_average": ["risk.VIX"],
             "vix_below": ["risk.VIX"], "curve_positive": ["bond.UST10Y", "bond.UST2Y"],
             "rates_falling": ["bond.UST10Y"], "copper_up": ["cmd.COPPER"],
             "oil_calm": ["cmd.BRENT"]}.get(rule, [])
    cls = type("SearchTiming", (B.TimingBook,), {
        "name": "search", "summary": "", "invested": invested, "extra": extra,
        "fallback": "bond.TR10" if spec["fallback"] == "bond" else B.CASH,
        "leverage": spec["leverage"], "max_gross": spec["leverage"]})
    return cls(rebalance=spec["rebalance"])


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


def _panel() -> tuple[pd.DataFrame, str]:
    keys = sorted({*FX, *WIDE, *IND, *FAC, B.MKT, "bond.TR10", "bond.TR2", "bond.UST10Y",
                   "bond.UST2Y", "cmd.BRENT", "cmd.COPPER", "risk.VIX", "rate.USD",
                   "rate.TBILL3M", *[f"rate.{c}" for c in G10]})
    snap = store.coverage().get("fetched_at") or "unknown"
    return store.panel(keys), snap


def run_batch(n: int, seed: int | None = None, con: sqlite3.Connection | None = None) -> dict:
    """Try `n` new variations. Ones already tried are skipped, not re-counted."""
    con = con or connect()
    r = random.Random(seed)
    panel, snap = _panel()
    cfg = BacktestConfig()
    bench_res = run(_benchmark(), panel, BacktestConfig(cost_bps=0.0))
    seen = {row[0] for row in con.execute("SELECT id FROM trials")}
    done = failed = 0
    for _ in range(n * 5):
        if done + failed >= n:
            break
        spec = sample(r)
        sid = spec_id(spec)
        if sid in seen:
            continue
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
    return {"tried": done, "failed": failed}


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
              f"({out['failed']} failed), {total} tried in all", flush=True)
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
