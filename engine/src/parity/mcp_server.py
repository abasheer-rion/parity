"""Parity tools for AI assistants, over the Model Context Protocol (DEC-0025).

    parity mcp                      # a local MCP server on stdin and stdout

Each person signs in to their own AI tool (Claude Code, Cursor, VS Code, Gemini CLI,
Codex). This server only adds Parity tools: list and backtest strategies, evaluate a
search-style spec, read the search's leads, catalog data, scenarios, news impacts, the
glossary and the docs, and write a draft recipe for a human to review. Setup for each
tool: docs/guides/0006-*.

Safety rules, all enforced here:
- Read-only on the repo. The only writes are a log (output/mcp.log), drafts
  (output/mcp_drafts/) and a trial counter in output/search.db.
- Nothing here touches ledger/ or registrations/, or starts an official run.
- Every compute call has a timeout and a per-minute cap.
- Every spec or custom setting the assistant tries is a counted trial, so its own tries
  raise the bar of the luck check (deflated Sharpe) like the search's do.
- Every result says it is research only, not investment advice.

The tools live in `ParityTools`, plain methods that return dicts, so a hosted server
(phase 2, with Parity sign-in) can wrap the same class over HTTP.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import math
import os
import re
import sqlite3
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from . import search, strategies
from .backtest.engine import BacktestConfig, run
from .data import catalog, providers
from .data import store as data_store
from .metrics import performance

REPO = Path(__file__).resolve().parents[3]
DISCLAIMER = "Research only, not investment advice."
BENCH = "us_market_buy_hold"
BASE_KEYS = ("eq.US_TOTAL", "rate.USD", "rate.TBILL3M")
# Places this server must never write, whatever a tool is asked to do.
FORBIDDEN = ("ledger", "registrations")


class ToolError(Exception):
    """A problem the assistant can fix, such as a bad spec or an unknown name."""


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: data_store.DEFAULT_DIR)
    out_dir: Path = field(default_factory=lambda: Path(
        os.environ.get("PARITY_OUTPUT_DIR", REPO / "engine" / "output")))
    repo: Path = REPO
    #: Seconds before a backtest or spec gives up. Gauntlets get three times this.
    timeout: float = float(os.environ.get("PARITY_MCP_TIMEOUT", 90))
    #: Specs (evaluate_spec) allowed per rolling minute.
    specs_per_minute: int = int(os.environ.get("PARITY_MCP_SPECS_PER_MINUTE", 20))
    #: Backtests, gauntlets and fresh strategy lists allowed per rolling minute.
    runs_per_minute: int = int(os.environ.get("PARITY_MCP_RUNS_PER_MINUTE", 6))

    @property
    def search_db(self) -> Path:
        return Path(os.environ.get("PARITY_SEARCH_DB", self.out_dir / "search.db"))

    @property
    def drafts(self) -> Path:
        return self.out_dir / "mcp_drafts"

    @property
    def log(self) -> Path:
        return self.out_dir / "mcp.log"


# --- small helpers -----------------------------------------------------------------

def clean(v: Any, digits: int = 4) -> Any:
    """JSON-safe copy: rounded floats, None for NaN, plain ints, ISO dates."""
    if isinstance(v, dict):
        return {str(k): clean(x, digits) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [clean(x, digits) for x in v]
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    if isinstance(v, (int, np.integer)):
        return int(v)
    if isinstance(v, (float, np.floating)):
        f = float(v)
        return round(f, digits) if math.isfinite(f) else None
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.date().isoformat() if isinstance(v, pd.Timestamp) else v.isoformat()
    return v


def downsample(s: pd.Series, freq: str = "ME", max_points: int = 400) -> list[list]:
    """[[date, value], ...] at `freq`, thinned further to at most `max_points`."""
    s = s.dropna()
    if freq != "D":
        s = s.resample(freq).last().dropna()
    if len(s) > max_points:
        step = math.ceil(len(s) / max_points)
        s = pd.concat([s.iloc[::step], s.iloc[-1:]])
        s = s[~s.index.duplicated(keep="last")]
    return [[d.date().isoformat(), clean(v, 6)] for d, v in s.items()]


def _horizon(rebalance: str) -> str:
    return {"D": "daily", "W": "weekly", "M": "monthly"}.get(rebalance, "daily")


def _doc_meta(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    meta: dict = {}
    if text.startswith("---"):
        head, _, body = text[3:].partition("\n---")
        for line in head.strip().splitlines():
            key, _, val = line.partition(":")
            meta[key.strip()] = val.strip()
        text = body
    return meta, text


def _sections(text: str) -> dict[str, str]:
    """{heading: body} for each '## ' section of a markdown doc."""
    out, name, buf = {}, "", []
    for line in text.splitlines():
        if line.startswith("## "):
            if name:
                out[name] = "\n".join(buf).strip()
            name, buf = line[3:].strip(), []
        elif name:
            buf.append(line)
    if name:
        out[name] = "\n".join(buf).strip()
    return out


def _cap(text: str, n: int) -> str:
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + " ..."


# --- what a spec may contain ---------------------------------------------------------

SPEC_OPTIONS = {
    "about": "A spec is a small JSON object that fully describes one strategy, the same "
             "format the always-on search uses. The same spec always builds the same "
             "strategy. Pick a kind and fill its fields.",
    "universes": {k: v[0] for k, v in search.UNIVERSES.items()}
    | {"mkt": "US stocks (trend and chart only)", "bond": "10y Treasuries (trend only)",
       "oil": "Brent oil (trend only)"},
    "kinds": {
        "trend": {"fields": {"universe": "g10, fx21, ind, fac, mkt, bond or oil",
                             "lookback": "days, 2 to 756", "skip": "days to skip, 0 or 21",
                             "rebalance": "D, W or M", "long_only": "true or false"},
                  "example": {"kind": "trend", "universe": "g10", "lookback": 126, "skip": 0,
                              "rebalance": "M", "long_only": False}},
        "rank": {"fields": {"universe": "g10, fx21, ind or fac",
                            "rank_on": "momentum, reversal, low_vol, near_high; g10 also "
                                       "carry, carry_and_momentum, rate_change; ind also "
                                       "same_month",
                            "lookback": "days (years for same_month)", "skip": "0 or 21",
                            "k": "how many to hold on each side", "long_short": "true/false",
                            "rebalance": "W or M"},
                 "example": {"kind": "rank", "universe": "g10", "rank_on": "carry",
                             "lookback": 63, "skip": 0, "k": 3, "long_short": True,
                             "rebalance": "M"}},
        "timing": {"fields": {"rule": ", ".join(search.TIMING_RULES),
                              "param": "the rule's number, e.g. 200 for above_average",
                              "fallback": "cash or bond", "leverage": "1.0 to 2.0",
                              "rebalance": "D, W or M"},
                   "example": {"kind": "timing", "rule": "above_average", "param": 200,
                               "fallback": "cash", "leverage": 1.0, "rebalance": "M"}},
        "chart": {"fields": {"indicator": "macd, bollinger, ichimoku or breakout",
                             "universe": "g10, fx21, ind, fac or mkt",
                             "long_only": "true/false", "rebalance": "D or W",
                             "window": "bollinger only, days", "band": "bollinger only",
                             "entry": "breakout only, days", "exit": "breakout only, days"},
                  "example": {"kind": "chart", "indicator": "breakout", "universe": "g10",
                              "long_only": False, "rebalance": "D", "entry": 55, "exit": 20}},
        "pair": {"fields": {"a": "catalog key, e.g. fx.EUR or ind.Enrgy", "b": "catalog key",
                            "window": "days", "entry": "z-score to enter, e.g. 2.0",
                            "delay": "0 or 1 days before acting"},
                 "example": {"kind": "pair", "a": "fx.AUD", "b": "fx.NZD", "window": 120,
                             "entry": 2.0, "delay": 1}},
        "cot": {"fields": {"mode": "rank or extremes",
                           "lookback": "business days for the z-score, e.g. 780 (3 years)",
                           "follow": "false bets against speculators, true with them",
                           "k": "rank only: currencies on each side, 1 to 3",
                           "entry": "extremes only: z-score, 1.0 to 2.5",
                           "rebalance": "W or M"},
                "example": {"kind": "cot", "mode": "rank", "lookback": 780, "follow": False,
                            "k": 2, "rebalance": "W"}},
        "policy": {"fields": {"universe": "xg10 (9 currencies) or xwide (27, 5bp cost)",
                              "rank_on": "policy_gap (carry) or policy_change (hikes)",
                              "lookback": "policy_change only, days; 0 for policy_gap",
                              "k": "currencies on each side",
                              "stress_off": "null, or the St. Louis Fed stress level above "
                                            "which the book goes to cash",
                              "rebalance": "W or M"},
                   "example": {"kind": "policy", "universe": "xwide", "rank_on": "policy_gap",
                               "lookback": 0, "k": 5, "stress_off": None,
                               "rebalance": "M"}},
        "mix": {"fields": {"assets": "2 to 6 catalog keys from factors, industries, "
                                     "eq.US_TOTAL, bond.TR10, bond.TR2, cmd.BRENT",
                           "scale": "fixed or inverse_vol", "trend": "true/false",
                           "lookback": "126 or 252", "vol_target": "null or 0.05 to 0.2"},
                "example": {"kind": "mix", "assets": ["bond.TR10", "eq.US_TOTAL"],
                            "scale": "inverse_vol", "trend": False, "lookback": 252,
                            "vol_target": 0.1}},
    },
}
_REQUIRED = {
    "trend": {"universe", "lookback", "skip", "rebalance", "long_only"},
    "rank": {"universe", "rank_on", "lookback", "skip", "k", "long_short", "rebalance"},
    "timing": {"rule", "param", "fallback", "leverage", "rebalance"},
    "chart": {"indicator", "universe", "long_only", "rebalance"},
    "pair": {"a", "b", "window", "entry", "delay"},
    "mix": {"assets", "scale", "trend", "lookback", "vol_target"},
    "cot": {"mode", "lookback", "follow", "rebalance"},
    "policy": {"universe", "rank_on", "lookback", "k", "stress_off", "rebalance"},
}
_OPTIONAL = {"chart": {"window", "band", "entry", "exit"}, "cot": {"k", "entry"}}
_INTS = {"lookback": (2, 2520), "skip": (0, 252), "k": (1, 10), "window": (2, 1000),
         "entry": (1, 1000), "exit": (1, 1000), "delay": (0, 5)}
_PAIR_POOL = set(search.WIDE) | set(search.IND)
_MIX_POOL = set(search.FAC) | set(search.IND) | {"eq.US_TOTAL", "bond.TR10", "bond.TR2",
                                                  "cmd.BRENT"}


def validate_spec(spec: dict) -> dict:
    """A normalised copy of `spec`, or ToolError saying exactly what is wrong."""
    if not isinstance(spec, dict) or spec.get("kind") not in _REQUIRED:
        raise ToolError(f"spec needs 'kind', one of {sorted(_REQUIRED)}. "
                        "Call spec_options for fields and examples.")
    kind = spec["kind"]
    allowed = _REQUIRED[kind] | _OPTIONAL.get(kind, set()) | {"kind"}
    missing = _REQUIRED[kind] - set(spec)
    extra = set(spec) - allowed
    if missing or extra:
        raise ToolError(f"{kind} spec: missing {sorted(missing)}, unknown {sorted(extra)}. "
                        "Call spec_options for fields and examples.")
    out = dict(spec)
    for key, (lo, hi) in _INTS.items():
        if key in out and not (kind in ("pair", "cot") and key == "entry") \
                and not (kind == "policy" and key == "lookback" and out[key] == 0):
            if not isinstance(out[key], (int, float)) or int(out[key]) != out[key] \
                    or not lo <= out[key] <= hi:
                raise ToolError(f"{key} must be a whole number from {lo} to {hi}")
            out[key] = int(out[key])
    if "rebalance" in out and out["rebalance"] not in ("D", "W", "M"):
        raise ToolError("rebalance must be D, W or M")
    if kind in ("trend", "rank", "chart"):
        ok = {"trend": [*search.UNIVERSES, "mkt", "bond", "oil"], "rank": list(search.UNIVERSES),
              "chart": [*search.UNIVERSES, "mkt"]}[kind]
        if out["universe"] not in ok:
            raise ToolError(f"universe for {kind} must be one of {ok}")
    if kind == "rank":
        if out["rank_on"] not in search.SIGNAL_LABEL:
            raise ToolError(f"rank_on must be one of {sorted(search.SIGNAL_LABEL)}")
        n = len(search.UNIVERSES[out["universe"]][1])
        if out["k"] * (2 if out["long_short"] else 1) > n:
            raise ToolError(f"k={out['k']} is too many for {n} assets")
    if kind == "timing":
        if out["rule"] not in search.TIMING_RULES:
            raise ToolError(f"rule must be one of {search.TIMING_RULES}")
        if out["fallback"] not in ("cash", "bond"):
            raise ToolError("fallback must be cash or bond")
        if not 0.5 <= float(out["leverage"]) <= 2.0:
            raise ToolError("leverage must be from 0.5 to 2.0")
    if kind == "chart" and out["indicator"] not in ("macd", "bollinger", "ichimoku",
                                                     "breakout"):
        raise ToolError("indicator must be macd, bollinger, ichimoku or breakout")
    if kind == "pair":
        if out["a"] == out["b"] or not {out["a"], out["b"]} <= _PAIR_POOL:
            raise ToolError("a and b must be two different keys from the 21 currencies "
                            "(fx.EUR ...) or 12 industries (ind.Enrgy ...)")
        if not 0.25 <= float(out["entry"]) <= 5:
            raise ToolError("entry must be a z-score from 0.25 to 5")
    if kind == "cot":
        if out["mode"] not in ("rank", "extremes") or not isinstance(out["follow"], bool):
            raise ToolError("mode must be rank or extremes, and follow true or false")
        need = "k" if out["mode"] == "rank" else "entry"
        if need not in out or ({"k", "entry"} - {need}) & set(out):
            raise ToolError(f"a {out['mode']} cot spec needs {need} (and not the other)")
        if need == "k" and not 1 <= out["k"] <= 4:
            raise ToolError("k must be from 1 to 4 for the 10 currencies")
        if need == "entry" and not 0.5 <= float(out["entry"]) <= 4:
            raise ToolError("entry must be a z-score from 0.5 to 4")
    if kind == "policy":
        if out["universe"] not in ("xg10", "xwide"):
            raise ToolError("universe for policy must be xg10 or xwide")
        if out["rank_on"] not in ("policy_gap", "policy_change"):
            raise ToolError("rank_on must be policy_gap or policy_change")
        if out["k"] * 2 > (9 if out["universe"] == "xg10" else 27):
            raise ToolError(f"k={out['k']} is too many for that universe")
        if out["stress_off"] is not None and not -2 <= float(out["stress_off"]) <= 5:
            raise ToolError("stress_off must be null or from -2 to 5")
    if kind == "mix":
        assets = out["assets"]
        if not isinstance(assets, list) or not 2 <= len(set(assets)) <= 6 \
                or not set(assets) <= _MIX_POOL:
            raise ToolError(f"assets must be 2 to 6 of {sorted(_MIX_POOL)}")
        out["assets"] = sorted(set(assets))
        if out["scale"] not in ("fixed", "inverse_vol"):
            raise ToolError("scale must be fixed or inverse_vol")
        vt = out["vol_target"]
        if vt is not None and not 0.02 <= float(vt) <= 0.3:
            raise ToolError("vol_target must be null or from 0.02 to 0.3")
    try:
        search.describe(out)
        search.build(out)
    except (KeyError, TypeError, ValueError) as exc:
        raise ToolError(f"spec does not build: {exc}") from exc
    return out


# --- the look-ahead check -----------------------------------------------------------

def look_ahead_check(strat, panel: pd.DataFrame) -> dict:
    """Weights before a cut date must not change when the data after it is removed."""
    cols = sorted(set(strat.required()) | {c for c in BASE_KEYS if c in panel})
    cols = [c for c in cols if c in panel]
    p = panel[cols]
    full = strat.weights(p)
    month_ends = p.index.to_series().groupby(p.index.to_period("M")).max()
    fridays = month_ends[month_ends.dt.day_of_week == 4]
    if len(fridays) < 10:
        return {"passed": None, "note": "not enough data to cut"}
    cuts = [fridays.iloc[int(len(fridays) * f)] for f in (0.3, 0.55, 0.8)]
    for cut in cuts:
        part = strat.weights(p.loc[:cut])
        a = full.loc[:cut].reindex(columns=part.columns)
        if not np.allclose(a.values, part.values, equal_nan=True, atol=1e-9):
            return {"passed": False, "cut": cut.date().isoformat(),
                    "note": "weights before this date change when later data is removed, "
                            "so the strategy peeks at the future"}
    return {"passed": True, "cuts": [c.date().isoformat() for c in cuts],
            "note": "weights up to each cut are the same with or without later data"}


# --- the trial counter --------------------------------------------------------------

MCP_SCHEMA = """
CREATE TABLE IF NOT EXISTS mcp_trials (
  id TEXT PRIMARY KEY, source TEXT NOT NULL DEFAULT 'mcp', spec TEXT NOT NULL, name TEXT,
  family TEXT, asset TEXT, hypothesis TEXT, cost_bps REAL, start TEXT, years REAL,
  cagr REAL, vol REAL, sharpe REAL, max_dd REAL, turnover REAL, breakeven_bps REAL,
  corr REAL, beats_market INTEGER, sr_daily REAL, n_days INTEGER, skew REAL, kurt REAL,
  error TEXT, tries INTEGER NOT NULL DEFAULT 1, first_tried TEXT NOT NULL,
  last_tried TEXT NOT NULL)
"""


class Trials:
    """The assistant's own tries, kept in search.db next to the search's trials in a
    table of their own, `mcp_trials`, so the search's code is untouched. Each distinct
    spec is one trial; trying the same spec again only bumps `tries`."""

    def __init__(self, path: Path):
        self.path = path

    def _con(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(self.path, timeout=30)
        con.execute("PRAGMA journal_mode=WAL")
        con.execute(search.SCHEMA)
        con.execute(MCP_SCHEMA)
        return con

    def record(self, sid: str, spec: dict, d: dict, row: dict, hypothesis: str,
               cost_bps: float) -> None:
        now = datetime.now(UTC).isoformat(timespec="seconds")
        cols = ["start", "years", "cagr", "vol", "sharpe", "max_dd", "turnover",
                "breakeven_bps", "corr", "beats_market", "sr_daily", "n_days", "skew",
                "kurt", "error"]
        vals = [search._clean(row.get(c)) for c in cols]
        with self._con() as con:
            hit = con.execute("SELECT tries FROM mcp_trials WHERE id=?", (sid,)).fetchone()
            if hit:
                con.execute("UPDATE mcp_trials SET tries=tries+1, last_tried=? WHERE id=?",
                            (now, sid))
                return
            con.execute(
                f"INSERT INTO mcp_trials (id, spec, name, family, asset, hypothesis, cost_bps, "
                f"{', '.join(cols)}, first_tried, last_tried) "
                f"VALUES ({', '.join('?' * (len(cols) + 9))})",
                [sid, json.dumps(spec, sort_keys=True), d.get("name"), d.get("family"),
                 d.get("asset"), hypothesis[:500], cost_bps, *vals, now, now])

    def frame(self) -> pd.DataFrame:
        """Every trial that ran, search and assistant together, one row per id, with
        `source` and a fresh deflated Sharpe over all of them."""
        cols = ("id, spec, name, family, asset, years, cagr, sharpe, max_dd, breakeven_bps, "
                "sr_daily, n_days, skew, kurt")
        with self._con() as con:
            s = pd.read_sql_query(f"SELECT {cols} FROM trials WHERE error IS NULL", con)
            m = pd.read_sql_query(f"SELECT {cols}, source FROM mcp_trials WHERE error IS NULL",
                                  con)
        s["source"] = "search"
        m = m[~m["id"].isin(s["id"])]
        both = pd.concat([s, m], ignore_index=True) if len(m) else s
        both["deflated"] = search.deflate(both) if len(both) else []
        return both

    def counts(self) -> dict:
        with self._con() as con:
            n_search = con.execute("SELECT COUNT(*) FROM trials").fetchone()[0]
            n_mcp, tries = con.execute(
                "SELECT COUNT(*), COALESCE(SUM(tries), 0) FROM mcp_trials").fetchone()
        return {"search_trials": n_search, "assistant_trials": n_mcp,
                "assistant_calls": tries}


# --- the tools ----------------------------------------------------------------------

class ParityTools:
    """Every tool as a plain method returning a JSON-safe dict."""

    def __init__(self, settings: Settings | None = None):
        self.s = settings or Settings()
        self.trials = Trials(self.s.search_db)
        self._panels: dict[tuple, pd.DataFrame] = {}
        self._cache: dict[str, Any] = {}

    # data ------------------------------------------------------------------------
    def _available(self, keys) -> list[str]:
        out = []
        for k in keys:
            spec = catalog.CATALOG.get(k)
            if spec and data_store._path(spec, self.s.data_dir).exists():
                out.append(k)
        return out

    def _panel(self, keys) -> pd.DataFrame:
        keys = tuple(sorted(set(keys)))
        if keys not in self._panels:
            missing = [k for k in keys if k not in self._available([k])]
            if missing:
                raise ToolError(f"No cached data for {', '.join(missing[:8])}. Run "
                                "`parity fetch` in the repo first.")
            if len(self._panels) > 16:
                self._panels.clear()
            self._panels[keys] = data_store.panel(list(keys), self.s.data_dir)
        return self._panels[keys]

    def _search_panel(self) -> pd.DataFrame:
        """The panel the always-on search uses, so a lead re-evaluated here gives the
        same numbers as in search.db. Series not cached locally are left out."""
        keys = sorted({*search.FX, *search.WIDE, *search.IND, *search.FAC, "eq.US_TOTAL",
                       "bond.TR10", "bond.TR2", "bond.UST10Y", "bond.UST2Y", "cmd.BRENT",
                       "cmd.COPPER", "risk.VIX", "rate.USD", "rate.TBILL3M",
                       *[f"rate.{c}" for c in catalog.G10]})
        return self._panel(self._available(keys))

    def _bench(self, panel: pd.DataFrame, cfg: BacktestConfig):
        bcfg = BacktestConfig(**{**cfg.to_dict(), "target_vol": None, "cost_bps": 0.0})
        return run(strategies.get(BENCH), panel, bcfg)

    def _latest(self) -> dict | None:
        path = self.s.out_dir / "latest.json"
        if not path.exists():
            return None
        mtime = path.stat().st_mtime
        hit = self._cache.get("latest")
        if not hit or hit[0] != mtime:
            self._cache["latest"] = (mtime, json.loads(path.read_text()))
        return self._cache["latest"][1]

    def _n_strategies(self) -> int:
        return sum(1 for c in strategies.available().values() if not c.is_benchmark)

    def _strategy(self, name: str, params: dict | None):
        registry = strategies.available()
        if name not in registry:
            close = [n for n in registry if name.lower() in n][:10]
            raise ToolError(f"No strategy named '{name}'. "
                            + (f"Close: {', '.join(close)}. " if close else "")
                            + "Call list_strategies for every name.")
        base = registry[name]()
        params = params or {}
        unknown = set(params) - set(base.params())
        if unknown:
            raise ToolError(f"{name} has no settings {sorted(unknown)}. "
                            f"Its settings: {clean(base.params())}")
        try:
            return registry[name](**{**base.params(), **params})
        except (TypeError, ValueError) as exc:
            raise ToolError(f"bad settings for {name}: {exc}") from exc

    # strategies ---------------------------------------------------------------------
    def list_strategies(self, family: str | None = None, asset: str | None = None,
                        fresh: bool = False) -> dict:
        registry = strategies.available()
        doc = self._latest()
        source = "latest report"
        if fresh or doc is None:
            from . import report
            doc = report.run_all(None, BacktestConfig(), data_dir=self.s.data_dir,
                                 gauntlet=False)
            source = "fresh quick run, no gauntlet"
        runs = {r["strategy"]: r for r in doc.get("runs", [])}
        rows = []
        for name, cls in registry.items():
            lab = cls.label()
            if family and lab["tags"]["family"] != family:
                continue
            if asset and lab["tags"]["asset"] != asset:
                continue
            r = runs.get(name) or {}
            m = r.get("metrics") or {}
            g = r.get("gauntlet") or {}
            rows.append({"name": name, "plain_name": lab["display_name"],
                         "family": lab["tags"]["family"], "asset": lab["tags"]["asset"],
                         "style": lab["tags"]["style"], "benchmark": cls.is_benchmark,
                         "sharpe": m.get("sharpe"), "cagr": m.get("cagr"),
                         "max_dd": m.get("max_drawdown"),
                         "deflated_sharpe": m.get("deflated_sharpe"),
                         "gauntlet": f"{g['passed']}/{g['total']}" if g else None,
                         "verdict": g.get("verdict")})
        rows.sort(key=lambda x: -(x["sharpe"] if x["sharpe"] is not None else -9))
        return {"source": source, "generated_at": doc.get("generated_at"),
                "count": len(rows), "strategies": rows,
                "how_to_read": "sharpe is on returns above the T-bill; deflated_sharpe of "
                               "0.95 or more passes the luck check; gauntlet is tests "
                               "passed out of 11."}

    def get_strategy(self, name: str) -> dict:
        strat = self._strategy(name, None)
        cls = type(strat)
        lab = cls.label()
        out = {"name": name, "plain_name": lab["display_name"],
               "description": lab["description"], "summary": cls.summary,
               "tags": lab["tags"], "benchmark": cls.is_benchmark, "funded": cls.funded,
               "params": strat.params(), "param_grid": cls.param_grid,
               "instruments": strat.instruments(), "reads": strat.required()}
        if cls.reference:
            path = self.s.repo / "docs" / cls.reference
            out["reference"] = f"docs/{cls.reference}"
            if path.exists():
                meta, body = _doc_meta(path)
                secs = _sections(body)
                first = secs.get("In plain words") or next(iter(secs.values()), "")
                out["reference_title"] = meta.get("title")
                out["reference_plain_words"] = _cap(first, 1500)
        latest = self._latest() or {}
        runs = {r["strategy"]: r for r in latest.get("runs", [])}
        r = runs.get(name)
        if r and r.get("gauntlet"):
            out["gauntlet"] = {
                "verdict": r["gauntlet"]["verdict"],
                "passed": f"{r['gauntlet']['passed']}/{r['gauntlet']['total']}",
                "tests": [{k: t[k] for k in ("id", "name", "plain", "passed", "value", "bar")}
                          for t in r["gauntlet"]["tests"]]}
            if BENCH in runs and not cls.is_benchmark:
                from .analysis import analyse
                a = analyse(r, runs[BENCH])
                out["strengths"], out["weaknesses"] = a["strengths"], a["weaknesses"]
        else:
            out["gauntlet"] = "not in the latest report; call run_gauntlet to test it"
        return out

    def run_backtest(self, name: str, params: dict | None = None, start: str | None = None,
                     end: str | None = None, cost_bps: float = 1.0) -> dict:
        strat = self._strategy(name, params)
        cfg = BacktestConfig(start=start or "1999-01-04", end=end, cost_bps=float(cost_bps))
        panel = self._panel(set(strat.required()) | set(BASE_KEYS))
        bench = self._bench(panel, cfg)
        res = run(strat, panel, cfg)
        n = self._n_strategies()
        m = performance.summary(res.returns, res.gross_returns, res.turnover, bench.returns,
                                n_trials=n, excess=res.excess_returns,
                                benchmark_excess=bench.excess_returns)
        if params:
            self._count(f"strategy:{name}", {"kind": "strategy", "name": name,
                                             "params": params}, res, bench, cfg, "")
        return {"strategy": name, "params": strat.params(), "config": cfg.to_dict(),
                "metrics": m, "trials_for_deflated_sharpe": n,
                "yearly": performance.yearly_returns(res.returns),
                "equity_monthly": downsample(res.equity, "ME", 400),
                "last_weights": {k: v for k, v in res.weights.iloc[-1].items() if abs(v) > 1e-4}
                if len(res.weights) else {}}

    def run_gauntlet(self, name: str, params: dict | None = None) -> dict:
        from .gauntlet import run_gauntlet
        strat = self._strategy(name, params)
        if strat.is_benchmark:
            raise ToolError("the benchmark is the bar itself; pick a strategy")
        cfg = BacktestConfig()
        panel = self._panel(set(strat.required()) | set(BASE_KEYS))
        bench = self._bench(panel, cfg)
        g = run_gauntlet(strat, panel, bench.returns, cfg, self._n_strategies(),
                         bench.excess_returns)
        if params:
            self._count(f"strategy:{name}", {"kind": "strategy", "name": name,
                                             "params": params}, run(strat, panel, cfg),
                        bench, cfg, "")
        sens = g["sensitivity"]
        return {"strategy": name, "params": strat.params(), "verdict": g["verdict"],
                "beats_sp500": g["beats_sp500"], "passed": f"{g['passed']}/{g['total']}",
                "tests": g["tests"], "bootstrap": g["bootstrap"], "placebo": g["placebo"],
                "sensitivity": {"tried": sens["tried"],
                                "share_positive": sens["share_positive"],
                                "variants": [{"params": v["params"], "sharpe": v["sharpe"]}
                                             for v in sens.get("variants", [])]},
                "trials_including_gauntlet": g["trials_including_gauntlet"]}

    # the refine loop -------------------------------------------------------------
    def _count(self, sid, spec, res, bench, cfg, hypothesis) -> dict:
        """Record one try in mcp_trials and return its row of numbers."""
        d = search.describe(spec) if spec.get("kind") in _REQUIRED else {
            "name": spec.get("name"), "family": None, "asset": None}
        row: dict = {}
        try:
            risky = res.weights.drop(columns=["cash.USD"], errors="ignore").abs().sum(axis=1)
            if (risky > 0.01).mean() < 0.05:
                # Same rule as the search: sitting in cash fakes a huge Sharpe.
                raise ValueError("almost never invested")
            ex = res.excess_returns.dropna()
            if len(ex) < 252 * 3 or ex.std() == 0:
                raise ValueError("less than three years of returns")
            m = performance.summary(res.returns, res.gross_returns, res.turnover,
                                    bench.returns, excess=res.excess_returns,
                                    benchmark_excess=bench.excess_returns)
            from scipy import stats
            row = {"start": m["start"], "years": m["years"], "cagr": m["cagr"],
                   "vol": m["ann_vol"], "sharpe": m["sharpe"], "max_dd": m["max_drawdown"],
                   "turnover": m.get("turnover_per_year"),
                   "breakeven_bps": m.get("breakeven_cost_bps"), "corr": m.get("correlation"),
                   "beats_market": int((m["sharpe"] or -9) > (m.get("benchmark_sharpe") or 9)),
                   "sr_daily": float(ex.mean() / ex.std()), "n_days": int(len(ex)),
                   "skew": float(stats.skew(ex)), "kurt": float(stats.kurtosis(ex, fisher=False))}
        except ValueError as exc:
            row = {"error": str(exc)}
        self.trials.record(sid, spec, d, row, hypothesis, cfg.cost_bps)
        return row

    def evaluate_spec(self, spec: dict, cost_bps: float = 1.0, start: str | None = None,
                      end: str | None = None, hypothesis: str = "") -> dict:
        spec = validate_spec(spec)
        sid = search.spec_id(spec)
        d = search.describe(spec)
        panel = self._search_panel()
        cfg = BacktestConfig(start=start or "1999-01-04", end=end, cost_bps=float(cost_bps))
        bench = self._bench(panel, cfg)
        strat = search.build(spec)
        missing = [k for k in strat.required() if k not in panel]
        if missing:
            raise ToolError(f"No cached data for {', '.join(missing)}. Run `parity fetch`.")
        res = run(strat, panel, cfg)
        row = self._count(sid, spec, res, bench, cfg, hypothesis)
        out = {"id": sid, "spec": spec, **d, "config": {"start": cfg.start, "end": cfg.end,
                                                        "cost_bps": cfg.cost_bps}}
        if row.get("error"):
            out["error"] = row["error"]
        else:
            risky = res.weights.drop(columns=["cash.USD"], errors="ignore").abs().sum(axis=1)
            invested = float((risky > 0.01).mean())
            cost2 = BacktestConfig(**{**cfg.to_dict(), "cost_bps": cfg.cost_bps * 2})
            s2 = performance.sharpe(run(strat, panel, cost2).excess_returns)
            out["metrics"] = {k: row[k] for k in ("start", "years", "cagr", "vol", "sharpe",
                                                  "max_dd", "turnover", "breakeven_bps",
                                                  "corr")}
            out["metrics"]["benchmark_sharpe"] = performance.sharpe(bench.excess_returns
                                                                    .loc[res.returns.index])
            out["metrics"]["sharpe_at_double_cost"] = s2
            out["metrics"]["share_of_days_invested"] = invested
            out["yearly"] = performance.yearly_returns(res.returns)
        out["look_ahead"] = look_ahead_check(strat, panel)
        out["luck_check"] = self._luck(sid)
        return out

    def _luck(self, sid: str) -> dict:
        df = self.trials.frame()
        counts = self.trials.counts()
        hit = df[df["id"] == sid]
        dsr = float(hit["deflated"].iloc[0]) if len(hit) else None
        return {"deflated_sharpe": dsr, "passes": None if dsr is None else dsr >= 0.95,
                "trials_counted": int(len(df)), **counts,
                "note": "Deflated Sharpe is the chance the result is not luck, given every "
                        "trial so far, the search's and yours. 0.95 or more passes. Each new "
                        "spec you try raises the bar for all of them."}

    def search_leads(self, top: int = 10, family: str | None = None,
                     asset: str | None = None, source: str | None = None) -> dict:
        df = good = self.trials.frame()
        if not len(df):
            return {"trials_counted": 0, "leads": [],
                    "note": "search.db is empty; run `parity search run` first"}
        total = int(len(df))
        if family:
            df = df[df["family"] == family]
        if asset:
            df = df[df["asset"] == asset]
        if source:
            df = df[df["source"] == source]
        df = df.sort_values(["deflated", "sharpe"], ascending=False).head(max(1, min(top, 50)))
        leads = []
        for _, r in df.iterrows():
            spec = json.loads(r["spec"])
            d = search.describe(spec) if spec.get("kind") in _REQUIRED else {}
            leads.append({"id": r["id"], "source": r["source"], "name": d.get("name", r["name"]),
                          "line": d.get("line"), "family": r["family"], "asset": r["asset"],
                          "sharpe": r["sharpe"], "cagr": r["cagr"], "max_dd": r["max_dd"],
                          "breakeven_bps": r["breakeven_bps"], "years": r["years"],
                          "deflated_sharpe": r["deflated"], "spec": spec})
        return {"trials_counted": total, **self.trials.counts(),
                "passed_luck_check": int((good["deflated"] >= 0.95).sum()),
                "leads": leads,
                "note": "Leads are candidates, not results. Nothing is a result until it is "
                        "registered and run officially by a human."}

    def spec_options(self) -> dict:
        return SPEC_OPTIONS

    # data -------------------------------------------------------------------------
    def _licence(self, source: str) -> dict:
        p = providers.BY_ID.get(source)
        return {"provider": p.name if p else source, "licence": p.licence if p else "unknown",
                "terms": p.terms_url if p else None}

    def list_series(self, query: str | None = None, limit: int = 50) -> dict:
        q = (query or "").lower().split()
        cov = {r["key"]: r for r in data_store.coverage(self.s.data_dir).get("series", [])
               if isinstance(r, dict) and "key" in r}
        rows = []
        for s in catalog.CATALOG.values():
            hay = f"{s.key} {s.description} {s.source}".lower()
            if q and not all(w in hay for w in q):
                continue
            c = cov.get(s.key, {})
            rows.append({"key": s.key, "description": s.description, "source": s.source,
                         "frequency": s.frequency,
                         "cached": bool(self._available([s.key])),
                         "first": c.get("first"), "last": c.get("last"),
                         "licence": self._licence(s.source)["licence"]})
        return {"count": len(rows), "series": rows[:max(1, min(limit, 200))],
                "note": "Keys go to get_series. Check each licence before sharing data "
                        "outside the team."}

    def get_series(self, key: str, start: str | None = None, end: str | None = None,
                   freq: str = "W") -> dict:
        if key not in catalog.CATALOG:
            raise ToolError(f"Unknown series '{key}'. Call list_series to search.")
        spec = catalog.CATALOG[key]
        try:
            s = data_store.load(key, self.s.data_dir)
        except FileNotFoundError as exc:
            raise ToolError(f"No cached data for {key}. Run `parity fetch {key}`.") from exc
        s = s[~s.index.duplicated(keep="last")].sort_index().loc[start:end].dropna()
        if s.empty:
            raise ToolError(f"{key} has no values between {start} and {end}")
        rule = {"D": "D", "W": "W-FRI", "M": "ME"}.get(freq.upper())
        if not rule:
            raise ToolError("freq must be D, W or M")
        year_ago = s.loc[:s.index[-1] - pd.DateOffset(years=1)]
        return {"key": key, "description": spec.description, "frequency": spec.frequency,
                **self._licence(spec.source),
                "first": s.index[0].date().isoformat(), "last": s.index[-1].date().isoformat(),
                "latest": s.iloc[-1], "min": s.min(), "max": s.max(),
                "change_1y": (s.iloc[-1] / year_ago.iloc[-1] - 1)
                if len(year_ago) and year_ago.iloc[-1] > 0 and s.iloc[-1] > 0 else None,
                "points": downsample(s, rule, 500)}

    # scenarios and news -----------------------------------------------------------
    def scenario_analogues(self, text: str = "", type: str | None = None,
                           regions: list[str] | None = None, actors: list[str] | None = None,
                           severity: int | None = None,
                           commodities: list[str] | None = None, limit: int = 8) -> dict:
        from . import scenarios as sc
        if "studied" not in self._cache:
            events = sc.load_events(self.s.repo / "catalog" / "events")
            self._cache["studied"] = sc.event_study(events, sc.load_prices(self.s.data_dir))
        studied = self._cache["studied"]
        words = set(re.findall(r"[a-z_]+", text.lower().replace("-", "_")))
        joined = text.lower().replace(" ", "_")
        known_actors = {a for ev in studied for a in ev["actors"]}
        spec = sc.Spec(
            type=type or next((t for t in sc.TYPES if t in joined), None),
            regions=regions or [r for r in sc.REGIONS if r in joined],
            actors=actors or sorted(words & known_actors),
            severity=severity,
            commodities=commodities or sorted(words & set(sc.COMMODITIES)))
        if not (spec.type or spec.regions or spec.actors or spec.commodities):
            raise ToolError(f"Could not read a scenario. Give type (one of {sc.TYPES}), "
                            f"regions ({sc.REGIONS}), actors or commodities.")
        picked = sc.match(studied, spec, limit=max(1, min(limit, 20)))
        agg = sc.aggregate([ev for _, ev in picked]) if picked else {}
        return {"read_as": {"type": spec.type, "regions": spec.regions, "actors": spec.actors,
                            "severity": spec.severity, "commodities": spec.commodities},
                "analogues": [{"score": s, "date": ev["date"], "name": ev["name"],
                               "type": ev["type"], "severity": ev["severity"]}
                              for s, ev in picked],
                "market_moves": agg,
                "note": "What markets did after similar past events: history, not a forecast. "
                        "Small samples, changing regimes and events priced in beforehand all "
                        "limit this."}

    def news_impact(self, currency: str | None = None, category: str | None = None,
                    query: str | None = None, limit: int = 10) -> dict:
        from .news import impact
        from .news import store as news_store
        arts = news_store.load(self.s.data_dir)
        if arts.empty:
            return {"items": [], "note": "No stored headlines. Run `parity news fetch`."}
        if currency:
            arts = arts[arts["currencies"].apply(lambda c: currency.upper() in c)]
        if category:
            arts = arts[arts["category"] == category]
        if query:
            arts = arts[arts["title"].str.lower().str.contains(query.lower(), regex=False)]
        path = news_store.impacts_path(self.s.data_dir)
        if path.exists():
            table = pd.read_parquet(path)
            table = table[table["article_id"].isin(arts["id"])]
        else:
            table = impact.impacts(arts.head(200), impact.load_panel(self.s.data_dir))
        day = table[(table["horizon"] == "1d") & table["z"].notna()]
        day = day.reindex(day["z"].abs().sort_values(ascending=False).index)
        day = day.head(max(1, min(limit, 50)))
        titles = arts.set_index("id")
        items = [{"title": titles.loc[r.article_id, "title"],
                  "published_at": str(titles.loc[r.article_id, "published_at"]),
                  "source": titles.loc[r.article_id, "source"], "series": r.series,
                  "move_1d": r.move, "unit": r.unit, "z": r.z}
                 for r in day.itertuples() if r.article_id in titles.index]
        return {"articles_matched": int(len(arts)), "items": items,
                "note": "z is the move divided by a normal daily move: 1 is ordinary, 3 is "
                        "rare. This is what happened after the headline, not what it caused."}

    # docs -------------------------------------------------------------------------
    def glossary(self, term: str) -> dict:
        g = json.loads((self.s.repo / "docs" / "_system" / "glossary.json").read_text())
        q = term.lower().strip()
        terms = g["terms"]
        exact = [t for t in terms if q in (t["id"], t["term"].lower())]
        partial = [t for t in terms if t not in exact and (q in t["term"].lower()
                                                            or q in t["id"])]
        loose = [t for t in terms if t not in exact and t not in partial
                 and q in t["simple"].lower()]
        hits = (exact + partial + loose)[:5]
        return {"matches": [{k: t.get(k) for k in ("term", "simple", "analogy", "precise",
                                                    "related")} for t in hits],
                "note": "" if hits else "No term found. Try search_docs."}

    def _docs(self) -> list[tuple[dict, str, Path]]:
        if "docs" not in self._cache:
            out = []
            for p in sorted((self.s.repo / "docs").rglob("*.md")):
                if "_system" in p.parts:
                    continue
                meta, body = _doc_meta(p)
                out.append((meta, body, p))
            self._cache["docs"] = out
        return self._cache["docs"]

    def search_docs(self, query: str, limit: int = 5) -> dict:
        words = [w for w in re.findall(r"\w+", query.lower()) if len(w) > 2]
        if not words:
            raise ToolError("query needs at least one word of three letters or more")
        scored = []
        for meta, body, p in self._docs():
            title = meta.get("title", p.stem).lower()
            low = body.lower()
            score = sum(3 * title.count(w) + min(low.count(w), 20) for w in words)
            if score and all(w in low or w in title for w in words[:3]):
                scored.append((score, meta, body, p))
        scored.sort(key=lambda t: -t[0])
        results = []
        for _, meta, body, p in scored[:max(1, min(limit, 10))]:
            secs = _sections(body)
            plain = secs.get("In plain words") or secs.get("Summary") or body[:800]
            results.append({"id": meta.get("id"), "title": meta.get("title"),
                            "path": str(p.relative_to(self.s.repo)),
                            "plain_words": _cap(plain, 900)})
        return {"results": results,
                "note": "read_doc returns a whole doc; resources parity://docs/<ID> too."}

    def read_doc(self, doc_id: str, max_chars: int = 12000) -> dict:
        key = doc_id.strip().upper()
        for meta, body, p in self._docs():
            if meta.get("id", "").upper() == key or p.stem == doc_id or \
                    str(p.relative_to(self.s.repo)) == doc_id:
                return {"id": meta.get("id"), "title": meta.get("title"),
                        "path": str(p.relative_to(self.s.repo)),
                        "text": _cap(body.strip(), max(1000, min(max_chars, 40000)))}
        raise ToolError(f"No doc '{doc_id}'. Use an ID such as DEC-0014 or search_docs.")

    # drafts -----------------------------------------------------------------------
    def draft_recipe(self, spec: dict, name: str, display_name: str,
                     description: str) -> dict:
        spec = validate_spec(spec)
        if not re.fullmatch(r"[a-z][a-z0-9_]{2,40}", name):
            raise ToolError("name must be snake_case: 3 to 41 lowercase letters, digits, _")
        if name in strategies.available():
            raise ToolError(f"a strategy named '{name}' already exists; pick another name")
        for text, what in ((display_name, "display_name"), (description, "description")):
            if not text.strip() or "—" in text or '"""' in text:
                raise ToolError(f"{what} must be plain text with no em dashes")
        code = recipe_code(spec, name, display_name.strip(), description.strip())
        path = self._safe_path(self.s.drafts / f"{name}.py")
        sid = search.spec_id(spec)
        luck = self._luck(sid)
        header = (f'"""Draft recipe from an AI assistant via the Parity MCP server.\n\n'
                  f"NOT registered and NOT a result. Spec id {sid}; deflated Sharpe at "
                  f"drafting: {luck['deflated_sharpe']} over {luck['trials_counted']} "
                  f"trials.\n\nTo promote it, a human:\n{PROMOTE}\n"
                  f'"""\n\n# fmt: off\nSPEC = {json.dumps(spec, sort_keys=True)}\n\n'
                  "# The recipe uses names factory.py already imports:\n"
                  f"# {RECIPE_IMPORTS}\n\n"
                  "# --- paste below this line into engine/src/parity/strategies/factory.py\n")
        path.write_text(header + code)
        return {"path": str(path), "spec_id": sid, "code": code, "how_to_promote": PROMOTE,
                "luck_check": luck}

    def _safe_path(self, path: Path) -> Path:
        """Refuse any write outside the drafts folder, and anything in ledger/ or
        registrations/, whatever the settings say."""
        path = path.resolve()
        drafts = self.s.drafts.resolve()
        if drafts not in path.parents:
            raise ToolError("drafts may only be written to output/mcp_drafts")
        repo = self.s.repo.resolve()
        for bad in FORBIDDEN:
            if (repo / bad) in path.parents or (repo / bad) == path:
                raise ToolError(f"writing to {bad}/ is never allowed")
        drafts.mkdir(parents=True, exist_ok=True)
        return path


# The names a drafted recipe uses, all of which factory.py already has in scope.
RECIPE_IMPORTS = ("from parity.strategies.factory import (BOND, CASH, MKT, BreakoutBook, "
                  "MixBook, OscillatorBook, PairBook, RankBook, TimingBook, TrendBook, make, "
                  "past_return, tbill_over); from parity.strategies.edges import (_CotRank, "
                  "_CotExtremes, _PolicyRank); from parity.strategies._signals import "
                  "(COT_FX, XG10, XWIDE, cot_z, fomc_week)")

PROMOTE = """1. Read the code and the idea. Is it a real, named idea, not a near-copy of one?
2. Paste the make(...) call into engine/src/parity/strategies/factory.py and add a
   reference doc link (an algorithm page in docs/algorithms) and a small param_grid
   (at most four combinations).
3. Run `make check` (lint, the look-ahead test for every strategy, docs).
4. Open a pull request. It counts toward the trial total; record it in an
   experiment doc. Only a registration and an official run make it a result."""


def recipe_code(spec: dict, name: str, display: str, description: str) -> str:
    """A factory `make(...)` call that builds the same strategy as search.build(spec)."""
    d = search.describe(spec)
    k = spec["kind"]
    horizon = "daily" if k == "pair" else _horizon(spec.get("rebalance", "D"))
    head = (f"make({{block}}, {name!r}, {display!r},\n     {description!r},\n"
            f"     {d['family']!r}, {d['asset']!r}, {d['style']!r}, {horizon!r}, \"\",\n     ")
    pre = ""

    def assets(u):
        return repr(search._assets(u))

    if k == "trend":
        block = "TrendBook"
        body = (f"universe={assets(spec['universe'])}, long_only={spec['long_only']}, "
                f"funded={spec['long_only']}, lookback={spec['lookback']}, "
                f"skip={spec['skip']}, rebalance={spec['rebalance']!r})")
    elif k == "rank":
        block = "RankBook"
        funded = not spec["long_short"] and spec["universe"] == "ind"
        body = (f"universe={assets(spec['universe'])}, rank_on={spec['rank_on']!r}, "
                f"long_short={spec['long_short']}, funded={funded}, "
                f"lookback={spec['lookback']}, skip={spec['skip']}, k={spec['k']}, "
                f"rebalance={spec['rebalance']!r})")
    elif k == "chart":
        block = "BreakoutBook" if spec["indicator"] == "breakout" else "OscillatorBook"
        params = "".join(f", {p}={spec[p]!r}" for p in ("window", "band", "entry", "exit")
                         if p in spec)
        body = (f"universe={assets(spec['universe'])}, long_only={spec['long_only']}, "
                f"funded={spec['long_only']}, kind={spec['indicator']!r}, "
                f"rebalance={spec['rebalance']!r}{params})")
    elif k == "pair":
        block = "PairBook"
        body = (f"a={spec['a']!r}, b={spec['b']!r}, window={spec['window']}, "
                f"entry={spec['entry']!r}, delay={spec['delay']})")
    elif k == "mix":
        block = "MixBook"
        mix = {a: 1 / len(spec["assets"]) for a in spec["assets"]}
        paid = any(not a.startswith(("fx.", "factor.")) for a in spec["assets"])
        body = (f"mix={mix!r}, scale={spec['scale']!r}, only_if_trending={spec['trend']}, "
                f"funded={paid}, max_gross=2.0, lookback={spec['lookback']}, "
                f"vol_target={spec['vol_target']!r})")
    elif k == "cot":
        block = "_CotRank" if spec["mode"] == "rank" else "_CotExtremes"
        size = f"k={spec['k']}" if spec["mode"] == "rank" else f"entry={spec['entry']!r}"
        body = (f"universe=[f'fx.{{c}}' for c in COT_FX], follow={spec['follow']}, "
                f"lookback={spec['lookback']}, {size}, rebalance={spec['rebalance']!r})")
    elif k == "policy":
        block = "_PolicyRank"
        uni = "XG10" if spec["universe"] == "xg10" else "XWIDE"
        cost = 5.0 if spec["universe"] == "xwide" else 0.0
        gate = spec["stress_off"]
        body = (f"universe={uni}, rank_on={spec['rank_on']!r}, lookback={spec['lookback']}, "
                f"k={spec['k']}, min_cost_bps={cost}, gate_level={gate!r}, "
                f"level={0.0 if gate is None else gate!r}, rebalance={spec['rebalance']!r})")
    else:
        block = f"_{''.join(w.title() for w in name.split('_'))}"
        rule, p = spec["rule"], spec["param"]
        expr = {
            "above_average": f"px > px.rolling({p}).mean()",
            "absolute_momentum": f"past_return(px, {p}) > tbill_over(panel, {p})",
            "vix_below_average": f"panel['risk.VIX'] < panel['risk.VIX'].rolling({p}).mean()",
            "vix_below": f"panel['risk.VIX'] < {p}",
            "curve_positive": f"(panel['bond.UST10Y'] - panel['bond.UST2Y']) > {p}",
            "rates_falling": f"panel['bond.UST10Y'] < panel['bond.UST10Y'].rolling({p}).mean()",
            "copper_up": f"past_return(panel['cmd.COPPER'], {p}) > 0",
            "oil_calm": f"past_return(panel['cmd.BRENT'], 63) < {p}",
            "stress_below": f"panel['risk.STLFSI'] < {p}",
            "conditions_easing": f"panel['risk.NFCI'] <= panel['risk.NFCI'].shift({p})",
            "claims_calm": "panel['macro.CLAIMS'].rolling(20, min_periods=15).mean() / "
                           "panel['macro.CLAIMS'].rolling(260, min_periods=200).min() - 1 < "
                           f"{p}",
            "spx_not_crowded": f"~(cot_z(panel, ['SPX_EMINI'], 780)['SPX_EMINI'] > {p})",
            "fomc_week": f"fomc_week(panel.index) % 2 == {p}",
        }[rule]
        pre = (f"class {block}(TimingBook):\n    def invested(self, panel):\n"
               f"        px = panel[MKT]  # noqa: F841\n        return {expr}\n\n\n")
        extra = {"absolute_momentum": ["rate.TBILL3M"], "vix_below_average": ["risk.VIX"],
                 "vix_below": ["risk.VIX"], "curve_positive": ["bond.UST10Y", "bond.UST2Y"],
                 "rates_falling": ["bond.UST10Y"], "copper_up": ["cmd.COPPER"],
                 "oil_calm": ["cmd.BRENT"], "stress_below": ["risk.STLFSI"],
                 "conditions_easing": ["risk.NFCI"], "claims_calm": ["macro.CLAIMS"],
                 "spx_not_crowded": ["cot.SPX_EMINI_PCT"]}.get(rule, [])
        cash = ""
        if rule in search.WIDER_RULES:  # cash earns the T-bill (DEC-0027)
            extra, cash = extra + ["rate.TBILL3M"], "cash_rate='rate.TBILL3M', "
        fallback = "BOND" if spec["fallback"] == "bond" else "CASH"
        body = (f"extra={extra!r}, fallback={fallback}, leverage={spec['leverage']!r}, "
                f"max_gross={spec['leverage']!r}, {cash}rebalance={spec['rebalance']!r})")
    return pre + head.format(block=block) + body + "\n"


# --- the MCP server -----------------------------------------------------------------

class Limits:
    """A timeout per call and rolling one-minute caps. Compute runs on one worker
    thread, so calls queue rather than pile up."""

    def __init__(self, settings: Settings):
        self.s = settings
        self.pool = concurrent.futures.ThreadPoolExecutor(max_workers=1,
                                                          thread_name_prefix="parity-mcp")
        self.seen: dict[str, deque] = {"spec": deque(), "run": deque()}

    def check(self, bucket: str) -> None:
        cap = self.s.specs_per_minute if bucket == "spec" else self.s.runs_per_minute
        q, now = self.seen[bucket], time.monotonic()
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= cap:
            wait = int(60 - (now - q[0])) + 1
            what = "specs" if bucket == "spec" else "backtests or gauntlets"
            raise ToolError(f"limit of {cap} {what} a minute reached; wait {wait}s. Fewer, "
                            "better-reasoned tries also keep the luck check honest.")
        q.append(now)

    async def run(self, fn, timeout: float):
        fut = self.pool.submit(fn)
        try:
            return await asyncio.wait_for(asyncio.wrap_future(fut), timeout)
        except TimeoutError as exc:
            raise ToolError(f"stopped after {timeout:.0f}s; try a shorter date range or a "
                            "simpler spec. The server finishes the old call before the "
                            "next one.") from exc


def _log(settings: Settings, tool: str, args: dict, ok: bool, seconds: float,
         error: str = "") -> None:
    try:
        settings.log.parent.mkdir(parents=True, exist_ok=True)
        line = {"at": datetime.now(UTC).isoformat(timespec="seconds"), "tool": tool,
                "args": _cap(json.dumps(clean(args), default=str), 600), "ok": ok,
                "seconds": round(seconds, 2)}
        if error:
            line["error"] = error[:300]
        with settings.log.open("a") as f:
            f.write(json.dumps(line) + "\n")
    except OSError:
        pass  # logging must never break a tool call


INSTRUCTIONS = """Parity tests trading strategies against the S&P 500, honestly. Tools here
read Parity's strategies, data, search results and docs, and let you evaluate new strategy
specs. Every spec you try is counted as a trial, which raises the bar of the luck check
(deflated Sharpe) for all results, so think before you try. Use the refine-strategy
prompt for a disciplined loop. Nothing here is a result until a human registers it and
runs it officially. Research only, not investment advice."""

KEY_DOCS = {"DEC-0014": "The strategy factory and the always-on search",
            "DEC-0009": "How returns are scored: excess returns, financing, frozen code",
            "DEC-0006": "How we define beating the S&P 500",
            "REF-0006": "The gauntlet: every test a strategy faces",
            "REF-0007": "Ways to build new algorithms",
            "DEC-0025": "This MCP server: what it does and its safety rules"}

REFINE_PROMPT = """You are helping refine a trading strategy in Parity. Be a careful
researcher, not a curve fitter. Idea to work on: {idea}

Follow this loop and show your reasoning briefly at each step:

1. Hypothesis. Say in one or two plain sentences why this should earn money: who is on
   the other side, and why the effect would last. Without a reason, stop.
2. Look first. Call search_leads (with a family or asset filter) and list_strategies to
   see what has already been tried. Do not re-test a near-copy of an existing idea.
3. Spec. Call spec_options, then write ONE spec that tests the hypothesis directly. Pick
   settings from the reason, not from what looks best.
4. Evaluate. Call evaluate_spec with your hypothesis. Read, in this order:
   - look_ahead: must pass. If it fails, the result is meaningless.
   - luck_check.deflated_sharpe: 0.95 or more passes. Expect most ideas to fail.
   - costs: breakeven_bps should be well above the 1 bp we charge, and
     sharpe_at_double_cost should still be positive.
   - share_of_days_invested, max_dd, years, and the yearly returns for one lucky year.
5. Change at most one thing per try, and only for a stated reason. Every try is a trial
   and makes the luck check stricter. Stop after about five tries on one idea.
6. Report. Say plainly whether the idea survived, what failed, and how many tries you
   used. If it survived, call draft_recipe so a human can review it. Never call a
   backtest a result: only a registered, official run is.

Research only, not investment advice."""


def build_server(settings: Settings | None = None):
    """The MCP server, with every tool, the key docs as resources and the
    refine-strategy prompt."""
    from mcp.server.fastmcp import FastMCP
    from mcp.types import ToolAnnotations

    settings = settings or Settings()
    tools = ParityTools(settings)
    limits = Limits(settings)
    mcp = FastMCP("parity", instructions=INSTRUCTIONS, log_level="WARNING")
    read_only = ToolAnnotations(readOnlyHint=True, openWorldHint=False)
    counted = ToolAnnotations(readOnlyHint=False, destructiveHint=False,
                              idempotentHint=True, openWorldHint=False)

    async def call(tool: str, args: dict, fn, bucket: str | None = None,
                   timeout: float | None = None) -> dict:
        t0 = time.monotonic()
        try:
            if bucket:
                limits.check(bucket)
                out = await limits.run(fn, timeout or settings.timeout)
            else:
                out = fn()
            _log(settings, tool, args, True, time.monotonic() - t0)
            return clean({**out, "disclaimer": DISCLAIMER})
        except ToolError as exc:
            _log(settings, tool, args, False, time.monotonic() - t0, str(exc))
            return {"error": str(exc), "disclaimer": DISCLAIMER}
        except Exception as exc:  # report, never crash the server
            _log(settings, tool, args, False, time.monotonic() - t0, repr(exc))
            return {"error": f"{type(exc).__name__}: {_cap(str(exc), 300)}",
                    "disclaimer": DISCLAIMER}

    @mcp.tool(annotations=read_only)
    async def list_strategies(family: str | None = None, asset: str | None = None,
                              fresh: bool = False) -> dict:
        """Every registered strategy: name, plain name, family, asset, Sharpe, yearly
        growth (cagr), worst fall (max_dd), luck check (deflated_sharpe), gauntlet score
        and verdict. Numbers come from the latest report (engine/output/latest.json); set
        fresh=true, or have no report, for a quick run without the gauntlet (slow, about
        a minute). family: carry, trend, value, calendar, volatility, mixed, benchmark.
        asset: fx, stocks, commodities, mixed."""
        args = {"family": family, "asset": asset, "fresh": fresh}
        heavy = fresh or tools._latest() is None
        return await call("list_strategies", args,
                          lambda: tools.list_strategies(family, asset, fresh),
                          "run" if heavy else None, settings.timeout * 3)

    @mcp.tool(annotations=read_only)
    async def get_strategy(name: str) -> dict:
        """One strategy in depth: plain description, settings (params) and the nearby
        settings the gauntlet tries (param_grid), the assets it holds, its reference doc
        in plain words, each gauntlet test in plain words with pass or fail, and its
        strengths and weaknesses against the S&P 500 (when the latest report has it)."""
        return await call("get_strategy", {"name": name}, lambda: tools.get_strategy(name))

    @mcp.tool(annotations=counted)
    async def run_backtest(name: str, params: dict | None = None, start: str | None = None,
                           end: str | None = None, cost_bps: float = 1.0) -> dict:
        """Backtest one registered strategy, without the gauntlet. params overrides its
        settings (see get_strategy); custom params count as a trial. start and end are
        YYYY-MM-DD (default 1999-01-04 to the latest data). cost_bps is the one-way
        trading cost in basis points (default 1). Returns metrics (Sharpe on returns
        above the T-bill, cagr, max_drawdown, deflated_sharpe, breakeven_cost_bps,
        correlation with stocks), yearly returns and a monthly equity curve."""
        args = {"name": name, "params": params, "start": start, "end": end,
                "cost_bps": cost_bps}
        return await call("run_backtest", args,
                          lambda: tools.run_backtest(name, params, start, end, cost_bps), "run")

    @mcp.tool(annotations=counted)
    async def run_gauntlet(name: str, params: dict | None = None) -> dict:
        """Run the full gauntlet on one strategy: 11 fixed tests in two groups, A (does it
        beat the S&P 500?) and B (is the effect real, or luck?), with a plain verdict.
        Slow: up to a few minutes. Custom params count as a trial."""
        return await call("run_gauntlet", {"name": name, "params": params},
                          lambda: tools.run_gauntlet(name, params), "run",
                          settings.timeout * 3)

    @mcp.tool(annotations=read_only)
    async def spec_options() -> dict:
        """The spec format for evaluate_spec and draft_recipe: each kind (trend, rank,
        timing, chart, pair, mix), its fields, allowed values and an example."""
        return await call("spec_options", {}, tools.spec_options)

    @mcp.tool(annotations=counted)
    async def evaluate_spec(spec: dict, hypothesis: str = "", cost_bps: float = 1.0,
                            start: str | None = None, end: str | None = None) -> dict:
        """The main loop for refining an idea. Build any search-style spec (see
        spec_options), backtest it and return: metrics (Sharpe, cagr, worst fall,
        turnover, breakeven cost, Sharpe at double cost, share of days invested), yearly
        returns, the look-ahead check (must pass) and the luck check (deflated Sharpe over
        every trial so far, the search's and yours; 0.95 passes). Every distinct spec is
        counted as a trial and raises the bar for all results, so state your hypothesis
        and try few, well-reasoned specs. Capped per minute."""
        args = {"spec": spec, "hypothesis": hypothesis, "cost_bps": cost_bps,
                "start": start, "end": end}
        return await call("evaluate_spec", args,
                          lambda: tools.evaluate_spec(spec, cost_bps, start, end, hypothesis),
                          "spec")

    @mcp.tool(annotations=read_only)
    async def search_leads(top: int = 10, family: str | None = None,
                           asset: str | None = None, source: str | None = None) -> dict:
        """The best variations found so far by the always-on search (and by assistants'
        evaluate_spec calls), ranked by the luck check recomputed over every trial.
        Each lead has its spec, so you can evaluate_spec a change to it. family: trend,
        carry, value, volatility, calendar, mixed. asset: fx, stocks, commodities, mixed.
        source: search or mcp. top: up to 50."""
        args = {"top": top, "family": family, "asset": asset, "source": source}
        return await call("search_leads", args,
                          lambda: tools.search_leads(top, family, asset, source))

    @mcp.tool(annotations=read_only)
    async def list_series(query: str | None = None, limit: int = 50) -> dict:
        """Search the data catalog (currencies, rates, commodities, stocks, factors,
        yields, positioning and more). Every word of query must match the key, the
        description or the source. Returns key, description, source, whether it is
        cached locally, first and last date, and the provider's licence."""
        return await call("list_series", {"query": query, "limit": limit},
                          lambda: tools.list_series(query, limit))

    @mcp.tool(annotations=read_only)
    async def get_series(key: str, start: str | None = None, end: str | None = None,
                         freq: str = "W") -> dict:
        """One catalog series (key from list_series), downsampled to freq D, W or M and at
        most 500 points, with its latest value, range, one-year change, provider and
        licence. start and end are YYYY-MM-DD."""
        args = {"key": key, "start": start, "end": end, "freq": freq}
        return await call("get_series", args, lambda: tools.get_series(key, start, end, freq))

    @mcp.tool(annotations=read_only)
    async def scenario_analogues(text: str = "", type: str | None = None,
                                 regions: list[str] | None = None,
                                 actors: list[str] | None = None, severity: int | None = None,
                                 commodities: list[str] | None = None, limit: int = 8) -> dict:
        """Past events like a made-up scenario, and how oil, the dollar, the yen, the
        franc, US stocks, the VIX and Treasury yields moved after them. Give free text
        (for example "military strike in the middle east, oil") or tags: type such as
        war, military_strike, oil_supply_shock, sanctions; regions such as middle_east,
        europe, east_asia; actors such as iran or russia; severity 1 to 5; commodities
        oil, gas, metals, grains. History, not a forecast."""
        args = {"text": text, "type": type, "regions": regions, "actors": actors,
                "severity": severity, "commodities": commodities, "limit": limit}
        return await call("scenario_analogues", args, lambda: tools.scenario_analogues(
            text, type, regions, actors, severity, commodities, limit))

    @mcp.tool(annotations=read_only)
    async def news_impact(currency: str | None = None, category: str | None = None,
                          query: str | None = None, limit: int = 10) -> dict:
        """Stored news headlines with the biggest next-day market moves after them, as a
        z-score against a normal day. Filter by currency (EUR, JPY, ...), category, or a
        word in the title. What happened after, not what the news caused."""
        args = {"currency": currency, "category": category, "query": query, "limit": limit}
        return await call("news_impact", args,
                          lambda: tools.news_impact(currency, category, query, limit))

    @mcp.tool(annotations=read_only)
    async def glossary(term: str) -> dict:
        """A Parity glossary term in three views: simple (for a ten year old), an
        everyday analogy, and the precise definition, plus related terms."""
        return await call("glossary", {"term": term}, lambda: tools.glossary(term))

    @mcp.tool(annotations=read_only)
    async def search_docs(query: str, limit: int = 5) -> dict:
        """Search Parity's docs (decisions, guides, reference, hypotheses, experiments,
        algorithms). Returns each match's ID, title, path and its In plain words
        section."""
        return await call("search_docs", {"query": query, "limit": limit},
                          lambda: tools.search_docs(query, limit))

    @mcp.tool(annotations=read_only)
    async def read_doc(doc_id: str, max_chars: int = 12000) -> dict:
        """The text of one doc by ID (for example DEC-0014, REF-0006) or repo path."""
        return await call("read_doc", {"doc_id": doc_id},
                          lambda: tools.read_doc(doc_id, max_chars))

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False,
                                          openWorldHint=False))
    async def draft_recipe(spec: dict, name: str, display_name: str, description: str) -> dict:
        """Write a proposed factory recipe for a spec you have evaluated to
        engine/output/mcp_drafts/<name>.py, never into the strategies folder. A human
        reviews and promotes it; the result says how. name is snake_case; display_name
        and description are plain words, and the description should say what could make
        it fail."""
        args = {"spec": spec, "name": name, "display_name": display_name}
        return await call("draft_recipe", args,
                          lambda: tools.draft_recipe(spec, name, display_name, description))

    def _doc_resource(doc_id: str):
        def read() -> str:
            d = tools.read_doc(doc_id, 40000)
            return f"# {d['title']}\n\n{d['text']}\n\n{DISCLAIMER}\n"
        return read

    for doc_id, about in KEY_DOCS.items():
        mcp.resource(f"parity://docs/{doc_id}", name=doc_id, description=about,
                     mime_type="text/markdown")(_doc_resource(doc_id))

    @mcp.resource("parity://doc/{doc_id}", mime_type="text/markdown")
    def any_doc(doc_id: str) -> str:
        """Any Parity doc by ID, for example HYP-0001 or GDE-0001."""
        return _doc_resource(doc_id)()

    @mcp.resource("parity://spec-options", mime_type="application/json")
    def spec_resource() -> str:
        """The spec format for evaluate_spec."""
        return json.dumps(SPEC_OPTIONS)

    @mcp.prompt(name="refine-strategy", description="A disciplined loop for refining a "
                "strategy idea without fooling yourself.")
    def refine_strategy(idea: str = "the idea the user describes") -> str:
        return REFINE_PROMPT.format(idea=idea)

    mcp._parity_tools = tools  # for tests
    return mcp


def main() -> None:
    build_server().run("stdio")
