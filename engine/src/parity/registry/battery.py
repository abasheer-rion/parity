"""Backtest on arrival (DEC-0064): a short standard battery for each newly enrolled series,
run with the strategy search's own code and written into the search's table, so every run
is a trial and counts in the luck check like any other (DEC-0014).

    a daily price that can be held   trend on it, 12 months long or short and 3 months long
                                      or cash
    a rate with a matching currency  carry: hold the currency while its rate is above the
                                      US rate
    anything else                    US stocks held only while the series is above (or
                                      below) its 1-year average, or rising (or falling)
                                      over 3 months

Plus each series' correlation with the existing books (US stocks, 10-year Treasuries, oil,
a G10 currency basket), which is a statistic, not a trial. The summary is attached to the
series page.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime

import numpy as np
import pandas as pd

from .. import search
from ..backtest.engine import BacktestConfig, run
from ..data import catalog, store
from ..strategies import _blocks as B
from . import db

BOOKS = {"US stocks": B.MKT, "10y Treasuries": "bond.TR10", "Oil": "cmd.BRENT"}
G10_BASKET = [f"fx.{c}" for c in catalog.G10]
PER_CYCLE = 3


def specs_for(rec: dict) -> list[tuple[str, dict]]:
    """(test name, search spec) pairs for one series."""
    key = rec["id"]
    out: list[tuple[str, dict]] = []
    tradable = rec["frequency"] == "D" and "tradable" in rec.get("tags", [])
    if tradable:
        out.append(("trend 12m long or short", {
            "kind": "trend", "universe": "one", "asset": key, "lookback": 252, "skip": 0,
            "rebalance": "W", "long_only": False}))
        out.append(("trend 3m long or cash", {
            "kind": "trend", "universe": "one", "asset": key, "lookback": 63, "skip": 0,
            "rebalance": "W", "long_only": True}))
    ccy = _carry_currency(key)
    if ccy:
        out.append((f"carry: {ccy} while its rate is above the US rate", {
            "kind": "gated", "base": {"kind": "mix", "assets": [ccy], "scale": "fixed",
                                      "trend": False, "lookback": 252, "vol_target": None},
            "gate": {"series": key, "test": "above_other", "other": "policy.USD",
                     "window": 1, "level": 0.0}, "rebalance": "M"}))
    if not tradable:
        for name, test, window in (("stocks while above 1y average", "above_avg", 252),
                                   ("stocks while below 1y average", "below_avg", 252),
                                   ("stocks while rising over 3m", "rising", 63),
                                   ("stocks while falling over 3m", "falling", 63)):
            out.append((name, {"kind": "gated", "base": search.HOLD_STOCKS,
                               "gate": {"series": key, "test": test, "window": window},
                               "rebalance": "M"}))
    return out


def _carry_currency(key: str) -> str | None:
    """The tradable currency a policy rate belongs to, when one exists in the catalog."""
    if not key.startswith("policy."):
        return None
    area = key.split(".", 1)[1]
    by_area = {v: k for k, v in catalog.POLICY_AREAS.items()}
    ccy = by_area.get(area, area if len(area) == 3 else None)
    for cand in (f"xfx.{ccy}", f"fx.{ccy}"):
        if ccy and cand in catalog.CATALOG:
            return cand
    return None


def _keys(rec: dict, specs: list[tuple[str, dict]]) -> list[str]:
    need = {rec["id"], "rate.USD", "rate.TBILL3M", B.MKT, *BOOKS.values(), *G10_BASKET}
    for _, spec in specs:
        need |= set(search.build(spec).required())
    return sorted(need)


def correlations(panel: pd.DataFrame, key: str, price_like: bool) -> dict:
    """Correlation of the series' weekly changes with each book's weekly returns."""
    s = panel[key].resample("W-FRI").last()
    x = np.log(s).diff() if price_like and (s.dropna() > 0).all() else s.diff()
    out = {}
    for name, col in BOOKS.items():
        if col in panel:
            r = np.log(panel[col].resample("W-FRI").last()).diff()
            c = x.corr(r)
            out[name] = None if pd.isna(c) else round(float(c), 3)
    fx = [c for c in G10_BASKET if c in panel]
    if fx:
        basket = np.log(panel[fx].resample("W-FRI").last()).diff().mean(axis=1)
        c = x.corr(basket)
        out["G10 currencies"] = None if pd.isna(c) else round(float(c), 3)
    return out


def run_battery(con: sqlite3.Connection, rec: dict, search_con: sqlite3.Connection | None = None,
                root=None, panel: pd.DataFrame | None = None) -> dict:
    """Run the battery for one series. New specs become trials in the search's table."""
    specs = specs_for(rec)
    root = root or store.DEFAULT_DIR
    if panel is None:
        keys = [k for k in _keys(rec, specs) if store._path(catalog.get(k), root).exists()]
        panel = store.panel(keys, root)
    scon = search_con or search.connect()
    seen = {r[0] for r in scon.execute("SELECT id FROM trials")}
    cfg = BacktestConfig()
    bench = run(search._benchmark(), panel, BacktestConfig(cost_bps=0.0))
    snap = store.coverage(root).get("fetched_at") or "unknown"
    results, new = [], 0
    have = panel[rec["id"]].dropna()
    short = have.empty or (have.index.max() - have.index.min()).days < 365 * 3.2
    for name, spec in specs:
        sid = search.spec_id(spec)
        if short:  # the search needs three years of returns; not run, so not a trial
            results.append({"test": name, "id": sid, "name": search.describe(spec)["name"],
                            "sharpe": None, "cagr": None, "max_dd": None, "corr": None,
                            "years": None, "beats_market": None,
                            "error": "not run: under three years of history"})
            continue
        row = {"id": sid, "spec": json.dumps(spec, sort_keys=True),
               **{k: v for k, v in search.describe(spec).items()
                  if k in ("name", "line", "family", "style", "asset")},
               "snapshot": snap, "tried_at": datetime.now(UTC).isoformat(timespec="seconds")}
        try:
            row |= search.evaluate(spec, panel, bench.returns, bench.excess_returns, cfg)
        except Exception as exc:  # a failed test is still a trial, as in the search
            row["error"] = str(exc)[:200]
        if sid not in seen:
            cols = ", ".join(row)
            scon.execute(f"INSERT OR REPLACE INTO trials ({cols}) VALUES "
                         f"({', '.join('?' * len(row))})", [search._clean(v) for v in row.values()])
            new += 1
        results.append({"test": name, "id": sid, "name": row.get("name"),
                        **{k: _r(row.get(k)) for k in ("sharpe", "cagr", "max_dd", "corr",
                                                       "years")},
                        "beats_market": row.get("beats_market"), "error": row.get("error")})
    scon.commit()
    total = scon.execute("SELECT COUNT(*) FROM trials").fetchone()[0]
    from .checks import PRICE_LIKE
    battery = {"tests": results, "correlations": correlations(
        panel, rec["id"], rec["asset_class"] in PRICE_LIKE), "new_trials": new,
        "search_trials": int(total),
        "note": "Each test is a trial in the strategy search and counts in its luck check."}
    ran = db.now()
    con.execute("INSERT INTO backtests (series_id, ran_at, trials, battery, dirty) VALUES "
                "(?, ?, ?, ?, 1) ON CONFLICT(series_id) DO UPDATE SET ran_at = excluded.ran_at, "
                "trials = excluded.trials, battery = excluded.battery, dirty = 1",
                (rec["id"], ran, len(results), json.dumps(battery)))
    best = max((t["sharpe"] for t in results if t["sharpe"] is not None), default=None)
    db.add_event(con, "backtest", series_id=rec["id"], source_id=rec["source_id"],
                 detail={"tests": len(results), "new_trials": new, "best_sharpe": best})
    return battery


def _r(v):
    return None if v is None or (isinstance(v, float) and not np.isfinite(v)) else \
        round(float(v), 4) if isinstance(v, (int, float, np.floating)) else v


def due(con: sqlite3.Connection) -> list[dict]:
    """Enrolled series discovery added that have no battery yet."""
    done = {r[0] for r in con.execute("SELECT series_id FROM backtests")}
    return [r for r in db.all_series(con, status=("enrolled", "live", "degraded"),
                                     origin="discovered")
            if r["id"] not in done and r["intended_use"] == "research"
            and r["frequency"] in ("D", "W", "M", "Q") and r["display_rights"] != "none"]


def run_due(con: sqlite3.Connection, limit: int = PER_CYCLE) -> list[dict]:
    out = []
    for rec in due(con)[:limit]:
        try:
            with con:
                b = run_battery(con, rec)
            out.append({"id": rec["id"], "tests": len(b["tests"]), "new_trials": b["new_trials"]})
        except Exception as exc:  # recorded; the next one still runs
            out.append({"id": rec["id"], "error": type(exc).__name__})
            with con:
                con.execute("INSERT INTO backtests (series_id, ran_at, trials, battery, dirty) "
                            "VALUES (?, ?, 0, ?, 1) ON CONFLICT(series_id) DO NOTHING",
                            (rec["id"], db.now(), json.dumps({"error": type(exc).__name__})))
    return out
