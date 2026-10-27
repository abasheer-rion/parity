"""The pairs research report (DEC-0070): `parity pairs report` writes
engine/output/pairs.json, which the research Pairs page and Workbench read.

What it holds, all derived statistics, never a price:
- a leaderboard of every pairs recipe with its Sharpe, deflated Sharpe (counting every
  variation tried: each recipe's settings grid and every pairs draw of the always-on
  search), the eleven gauntlet tests and a plain verdict;
- per linked pair: the spread's z-score, hedge ratio, cointegration p-value and half-life
  over time (each from the trailing year only), and the position held;
- wins and losses by year and by market mood (the VIX), stop-outs and time stops, cost
  and borrow sensitivity, and Sharpe by period (decay), back to 1970 for industries.

Single stocks join when their research-only data is on the machine (Alpaca key).
"""

from __future__ import annotations

import json
import math
import sqlite3
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .. import strategies
from ..backtest.engine import BacktestConfig, run
from ..data import catalog, store
from ..gauntlet import run_gauntlet
from ..metrics import performance
from ..strategies import _pairs as PB
from ..strategies.base import Strategy
from . import stats, universe

OUT = Path(__file__).resolve().parents[3] / "output" / "pairs.json"
START, LONG_START = "1999-01-04", "1970-01-02"
STOCK_START = "2016-06-01"
STEP = 10  # business days between chart points
PERIODS = (("1970 to 1984", "1970", "1984"), ("1985 to 1998", "1985", "1998"),
           ("1999 to 2008", "1999", "2008"), ("2009 to 2026", "2009", "2026"))
COSTS, BORROWS = (0, 5, 10, 20, 40), (0, 50, 200)
METHODS = [
    {"id": "distance", "name": "Closest prices",
     "plain": "Pairs whose prices moved closest last year; bet any gap closes."},
    {"id": "cointegration", "name": "Cointegration",
     "plain": "Pairs whose gap passed a statistical test for staying stable, and closes fast."},
    {"id": "kalman", "name": "Moving hedge",
     "plain": "Cointegrated pairs with a hedge ratio updated every day."},
    {"id": "pca", "name": "PCA leftovers",
     "plain": "Each asset against the market's main forces; bet the leftover snaps back."},
]


class Fixed(Strategy):
    """Weights already computed, so cost runs need not recompute them."""

    name = "fixed"
    summary = ""

    def __init__(self, w: pd.DataFrame, cost: float, borrow: float):
        self._w, self.min_cost_bps, self.borrow_bps = w, cost, borrow

    def instruments(self):
        return list(self._w.columns)

    def weights(self, panel):
        return self._w.reindex(panel.index).fillna(0.0)


def _r(v, n=4):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f, n) if math.isfinite(f) else None


def _sr(x: pd.Series) -> float:
    x = x.dropna()
    return float(x.mean() / x.std() * math.sqrt(252)) if len(x) > 30 and x.std() > 0 else 0.0


def _verdict(dsr: float | None, passed: int, sharpe: float) -> tuple[str, str]:
    if sharpe <= 0:
        return "fails", "Loses money after costs. Nothing to rely on."
    if dsr is not None and dsr >= 0.95 and passed >= 6:
        return "beats the market", "Passes the luck check. Check it again on new data."
    if passed >= 4:
        return "real but small", "Some signs of a real effect, too small to rely on."
    return "luck", "Makes a little, but no more than chance would after this many tries."


def _search_pairs() -> tuple[int, list[float]]:
    """Pairs variations the always-on search has backtested, and their daily Sharpes."""
    db = Path(__file__).resolve().parents[3] / "output" / "search.db"
    if not db.exists():
        return 0, []
    try:
        con = sqlite3.connect(db)
        rows = con.execute("SELECT sr_daily FROM trials WHERE spec LIKE "
                           "'%\"kind\": \"pairsbook\"%'").fetchall()
    except sqlite3.Error:
        return 0, []
    return len(rows), [r[0] for r in rows if r[0] is not None]


def _trade_returns(trades: list[dict], px: pd.DataFrame) -> list[dict]:
    out = []
    idx = px.index
    for t in trades:
        a, b = px[t["a"]].values, px[t["b"]].values
        o, c, h = t["open"], t["close"], t["hedge"]
        ra, rb = a[c] / a[o] - 1, b[c] / b[o] - 1
        ret = t["side"] / (1 + h) * (ra - h * rb)
        out.append({**t, "open_date": idx[o], "close_date": idx[c], "return": float(ret)})
    return out


def _recipes(stocks: bool) -> list[tuple[str, type, dict]]:
    """(name, class, labels) for every pairs recipe; stock ones only with their data."""
    out = [(n, c, {"universe": "49 US industries", "rights": "public"})
           for n, c in strategies.available().items() if n.startswith("pairs_")]
    if stocks:
        from ..strategies.pairs import make_pairs
        linked = [(p.a, p.b) for p in universe.STOCK_PAIRS]
        grouped = [(p.a, p.b) for p in universe.stock_candidates()]
        tickers = [f"stk.{t}" for v in universe.STOCK_SECTORS.values() for t in v]
        lab = {"universe": "US stocks and ETFs (research only)", "rights": "research"}
        cheap = {"min_cost_bps": 5.0, "borrow_bps": 30.0, "register": False}
        specs = [
            ("pairs_distance_stocks", "Stock pairs, closest prices", PB.PairsBook,
             {"method": "distance", "candidates": grouped, "exit": 0.0,
              "grid": {"entry": [1.5, 2.0, 2.5]}}),
            ("pairs_coint_linked_stocks", "Named stock pairs, cointegrated", PB.PairsBook,
             {"method": "cointegration", "candidates": linked,
              "grid": {"entry": [1.5, 2.0, 2.5]}}),
            ("pairs_coint_stocks", "Stock pairs, cointegrated", PB.PairsBook,
             {"method": "cointegration", "candidates": grouped,
              "grid": {"pmax": [0.01, 0.05], "entry": [1.5, 2.0]}}),
            ("pairs_kalman_linked_stocks", "Named stock pairs, moving hedge", PB.PairsBook,
             {"method": "kalman", "candidates": linked,
              "grid": {"delta": [1e-7, 1e-6, 1e-5]}}),
            ("pairs_pca_stocks", "Stock leftovers (PCA)", PB.PCABook,
             {"universe": tickers, "factors": 5,
              "grid": {"factors": [3, 5, 8], "entry": [1.0, 1.25, 1.5]}}),
        ]
        for name, disp, block, attrs in specs:
            cls = make_pairs(block, name, disp, disp + ".", "", **attrs, **cheap)
            out.append((name, cls, lab))
    return out


def _grid(cls) -> list[dict]:
    keys = list(cls.param_grid)
    combos = [{}]
    for k in keys:
        combos = [{**c, k: v} for c in combos for v in cls.param_grid[k]]
    return combos


def _pair_series(pair: universe.Pair, panel: pd.DataFrame, start: str, rights: str) -> dict:
    """One linked pair's statistics over time, each from the trailing year only."""
    lp = np.log(panel[[pair.a, pair.b]].where(panel[[pair.a, pair.b]] > 0)).dropna()
    lp = lp[lp.index >= pd.Timestamp(start) - pd.Timedelta(days=400)]
    from ..strategies.pairs import make_pairs
    cls = make_pairs(PB.PairsBook, "one", "one", "one", "", register=False,
                     method="cointegration", candidates=[(pair.a, pair.b)], top=1)
    book = cls()
    res = book.run_book(panel[[pair.a, pair.b]].dropna())
    pos = np.sign(res["weights"][pair.a]).reindex(lp.index).fillna(0.0)
    bt = run(Fixed(res["weights"], book.min_cost_bps, book.borrow_bps),
             panel.loc[res["weights"].index], BacktestConfig(start=start))
    trades = [t for t in _trade_returns(res["trades"], panel[[pair.a, pair.b]].dropna())
              if t["close_date"] >= pd.Timestamp(start)]
    dates, z, hedge, pv, hl, held = [], [], [], [], [], []
    ya, yb = lp[pair.a].values, lp[pair.b].values
    for i in range(252, len(lp), STEP):
        if lp.index[i] < pd.Timestamp(start):
            continue
        eg = stats.engle_granger(ya[i - 251: i + 1], yb[i - 251: i + 1])
        dates.append(lp.index[i].strftime("%Y-%m-%d"))
        z.append(_r((eg["spread"][-1] - eg["mean"]) / eg["sd"], 3) if eg["sd"] > 0 else None)
        hedge.append(_r(eg["beta"], 3))
        pv.append(_r(eg["p"], 3))
        h = stats.half_life(eg["spread"])
        hl.append(_r(h, 1) if math.isfinite(h) else None)
        held.append(int(pos.iloc[i]))
    j = stats.johansen_trace(ya[-504:], yb[-504:])
    corr = float(np.corrcoef(np.diff(ya[-504:]), np.diff(yb[-504:]))[0, 1])
    wins = sum(t["return"] > 0 for t in trades)
    return {"id": pair.id, "a": pair.a, "b": pair.b, "label_a": universe.label(pair.a),
            "label_b": universe.label(pair.b), "group": pair.group, "why": pair.why,
            "caveat": pair.caveat, "rights": rights, "recipe": "pairs_coint_linked",
            "entry": book.entry, "exit": book.exit, "stop": book.stop,
            "series": {"dates": dates, "z": z, "hedge": hedge, "pvalue": pv, "halflife": hl,
                       "position": held},
            "stats": {"pvalue_now": pv[-1] if pv else None,
                      "halflife_now": hl[-1] if hl else None,
                      "hedge_now": hedge[-1] if hedge else None,
                      "johansen_trace": _r(j["trace0"], 2), "johansen_5pct": j["crit0"],
                      "correlation": _r(corr, 3)},
            "results": {"sharpe": _r(_sr(bt.excess_returns), 3),
                        "total_return": _r(float(bt.equity.iloc[-1] - 1), 4)
                        if len(bt.equity) else None,
                        "trades": len(trades), "wins": int(wins),
                        "losses": len(trades) - int(wins)}}


def report(out: Path = OUT, gauntlet: bool = True) -> dict:
    stock_keys = [k for k in catalog.CATALOG if k.startswith("stk.")]
    root = store.DEFAULT_DIR
    have_stocks = all(store._path(catalog.get(k), root).exists() for k in stock_keys)
    recipes = _recipes(have_stocks)
    need = {k for _, c, _ in recipes for k in c().required()}
    panel = store.panel(sorted(need | {"eq.US_TOTAL", "rate.USD", "rate.TBILL3M",
                                       "risk.VIX"}))
    bench_res = run(strategies.get("us_market_buy_hold"), panel,
                    BacktestConfig(start=START, cost_bps=0.0))

    # Every variation counts: each recipe's whole grid and every pairs search draw.
    grid_srs, n_grid = [], 0
    weights_by = {}
    for name, cls, _ in recipes:
        start = STOCK_START if "stocks" in name else START
        for params in _grid(cls):
            n_grid += 1
            s = cls(**params)
            res = run(s, panel, BacktestConfig(start=start))
            ex = res.excess_returns.dropna()
            if len(ex) > 30 and ex.std() > 0:
                grid_srs.append(float(ex.mean() / ex.std()))
        weights_by[name] = cls().weights(panel)
    n_search, search_srs = _search_pairs()
    n_trials = n_grid + n_search
    sr_var = float(np.var(grid_srs + search_srs, ddof=1)) if len(grid_srs + search_srs) > 2 \
        else None

    board, by_year, by_regime, breakdowns, costs, decay = [], [], [], [], [], []
    vix = panel["risk.VIX"].ffill()
    mood = pd.cut(vix.shift(1), [0, 20, 30, 1e9], labels=["calm", "nervous", "stressed"])
    for name, cls, lab in recipes:
        s = cls()
        start = STOCK_START if "stocks" in name else START
        w = weights_by[name]
        res = run(Fixed(w, s.min_cost_bps, s.borrow_bps), panel, BacktestConfig(start=start))
        ex = res.excess_returns
        sharpe = _sr(ex)
        dsr = performance.deflated_sharpe(ex, max(n_trials, 2), sr_var)
        passed = total = None
        if gauntlet:
            g = run_gauntlet(s, panel, bench_res.returns, BacktestConfig(start=start),
                             max(n_trials, 2), bench_res.excess_returns)
            passed = sum(t["passed"] is True for t in g["tests"])
            total = len(g["tests"])
        trades = []
        if isinstance(s, PB.PairsBook):
            px = panel[s.instruments()]
            trades = [t for t in _trade_returns(s.run_book(panel)["trades"], px)
                      if t["close_date"] >= pd.Timestamp(start)]
        wins = sum(t["return"] > 0 for t in trades)
        held_days = [t["close"] - t["open"] for t in trades]
        tag, plain = _verdict(dsr, passed or 0, sharpe)
        board.append({
            "id": name, "name": cls.display_name, "method": getattr(cls, "method", "pca"),
            "universe": lab["universe"], "rights": lab["rights"],
            "description": cls.description, "sharpe": _r(sharpe, 3),
            "deflated_sharpe": _r(dsr, 4), "cagr": _r(performance.cagr(res.returns)),
            "max_drawdown": _r(performance.max_drawdown(res.returns)),
            "trades": len(trades) if trades else None,
            "win_rate": _r(wins / len(trades), 3) if trades else None,
            "avg_hold_days": _r(np.mean(held_days), 1) if held_days else None,
            "cost_bps": s.min_cost_bps, "borrow_bps": s.borrow_bps,
            "trials": len(_grid(cls)), "tests_passed": passed, "tests_total": total,
            "verdict": tag, "verdict_plain": plain})
        yearly = res.returns.groupby(res.returns.index.year).apply(lambda x: (1 + x).prod() - 1)
        for y, v in yearly.items():
            yt = [t for t in trades if t["close_date"].year == y]
            by_year.append({"recipe": name, "year": int(y), "return": _r(v),
                            "wins": sum(t["return"] > 0 for t in yt),
                            "losses": sum(t["return"] <= 0 for t in yt)})
        m = mood.reindex(ex.index)
        for reg in ("calm", "nervous", "stressed"):
            part = ex[m == reg]
            rt = [t for t in trades if mood.get(t["close_date"]) == reg]
            by_regime.append({"recipe": name, "regime": reg,
                              "return": _r(part.mean() * 252) if len(part) else None,
                              "sharpe": _r(_sr(part), 3), "wins": sum(t["return"] > 0 for t in rt),
                              "losses": sum(t["return"] <= 0 for t in rt)})
        for t in [t for t in trades if t["kind"] in ("stop-out", "time stop")][-25:]:
            breakdowns.append({"recipe": name, "pair": f"{t['a']}~{t['b']}",
                               "date": t["close_date"].strftime("%Y-%m-%d"), "kind": t["kind"],
                               "z_at_exit": _r(t["z"], 2), "return": _r(t["return"])})
        for c in COSTS:
            for b in BORROWS:
                rc = run(Fixed(w, c, b), panel, BacktestConfig(start=start, cost_bps=0.0))
                costs.append({"recipe": name, "cost_bps": c, "borrow_bps": b,
                              "sharpe": _r(_sr(rc.excess_returns), 3)})
        if "stocks" not in name:
            long = run(Fixed(w, s.min_cost_bps, s.borrow_bps), panel,
                       BacktestConfig(start=LONG_START))
            for label, a, b in PERIODS:
                decay.append({"recipe": name, "period": label,
                              "sharpe": _r(_sr(long.excess_returns.loc[a:b]), 3),
                              "gross_sharpe": _r(_sr(long.gross_returns.loc[a:b]), 3)})

    pairs = [_pair_series(p, panel, START, "public") for p in universe.INDUSTRY_PAIRS]
    if have_stocks:
        pairs += [_pair_series(p, panel, STOCK_START, "research")
                  for p in universe.STOCK_PAIRS]
    for p in pairs:
        p["recipe"] = "pairs_coint_linked_ind49" if p["rights"] == "public" else \
            "pairs_coint_linked_stocks"
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True,
                             text=True, check=False).stdout.strip()
    except OSError:
        sha = ""
    sources = [{"id": "french", "name": "Kenneth French data library, 49 industries",
                "rights": "public", "licence": "Free for research and teaching, with credit",
                "terms_url": "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/"
                "data_library.html", "shown": "derived only"},
               {"id": "alpaca", "name": "Alpaca Market Data, US stocks and ETFs",
                "rights": "research", "licence": "Account holder's own use; no "
                "redistribution. Only derived statistics are shown.",
                "terms_url": "https://alpaca.markets/data",
                "shown": "derived only" if have_stocks else "not fetched: needs the team key"}]
    doc = {"version": 1, "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
           "git_sha": sha,
           "data": {"start": START, "end": panel.index[-1].strftime("%Y-%m-%d"),
                    "sources": sources},
           "trials": {"total": n_trials, "recipes": len(recipes), "search": n_search},
           "methods": METHODS, "leaderboard": sorted(board, key=lambda r: -(r["sharpe"] or 0)),
           "pairs": pairs, "by_year": by_year, "by_regime": by_regime,
           "breakdowns": breakdowns, "cost_sensitivity": costs, "decay": decay}
    _no_prices(doc)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, separators=(",", ":")))
    return doc


BANNED = ("price", "close", "level", "open_price", "adj_close")


def _no_prices(obj, path="") -> None:
    """Refuse to write any field that would carry a raw price (display rights, DEC-0064)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if any(k.lower() == b or k.lower().endswith("_" + b) for b in BANNED):
                raise ValueError(f"pairs.json must not carry prices: {path}.{k}")
            _no_prices(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for v in obj:
            _no_prices(v, path)
