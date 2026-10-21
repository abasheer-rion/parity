"""`parity analyse NAME`: a plain strengths and weaknesses report for one strategy.

`analyse` is pure: it takes one run from the report (see report.py) and the
benchmark's run, so it can be tested without any market data. `analyse_strategy`
does the data work (backtest, gauntlet, a few cost levels) and then calls it.
"""

from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from .compare import CRISES

COST_LEVELS = (0.0, 1.0, 5.0, 10.0)
LOW_CORRELATION = 0.3
HIGH_CORRELATION = 0.7

# What each failed gauntlet test means, in plain words.
FAILURE_MEANING = {
    "A1": "It earns less per unit of risk than just holding the S&P 500.",
    "A2": "Turned up to the market's level of risk, it would have made less money than the "
          "market.",
    "A3": "After allowing for how many ideas we tried, the result could easily be luck.",
    "A4": "If trading costs twice what we assume, it no longer beats the market.",
    "A5": "It does not beat the market in every era. The edge comes and goes.",
    "A6": "It has not beaten the market in the most recent years.",
    "B1": "We cannot be sure it makes money at all. A slightly different history could "
          "show a loss.",
    "B2": "Its timing adds little. The same bets placed on random dates do about as well.",
    "B3": "It depends on picking exactly the right settings.",
    "B4": "Most of its gains come from one lucky year.",
    "B5": "It loses money when stocks crash, so it does not protect you.",
}
PASS_MEANING = {
    "A1": "Earns more per unit of risk than the S&P 500.",
    "A2": "At the market's level of risk it made more money than the market.",
    "A3": "Still looks good after allowing for how many ideas we tried.",
    "A4": "Still beats the market if trading costs twice what we assume.",
    "A5": "Beats the market in every era we test.",
    "A6": "Beat the market in the most recent years.",
    "B1": "Clearly makes money, even on jumbled versions of history.",
    "B2": "Its timing matters. Random-date copies do clearly worse.",
    "B3": "Works across nearby settings, not just one lucky number.",
    "B4": "Still makes money without its best year.",
    "B5": "Does not lose money on average in the stock market's worst months.",
}


def _series(points: list) -> pd.Series:
    if not points:
        return pd.Series(dtype=float)
    idx = pd.to_datetime([p[0] for p in points])
    return pd.Series([float(p[1]) for p in points], index=idx).sort_index()


def _period_return(equity: pd.Series, start: str, end: str) -> float | None:
    """Return between two dates from a weekly equity curve, or None if not covered."""
    if equity.empty or equity.index.min() > pd.Timestamp(start) or \
            equity.index.max() < pd.Timestamp(end):
        return None
    before = equity.loc[:start]
    first = before.iloc[-1] if len(before) else equity.iloc[0]
    last = equity.loc[:end].iloc[-1]
    return float(last / first - 1) if first else None


def _r(v: float | None, digits: int = 4) -> float | None:
    return None if v is None or not math.isfinite(v) else round(float(v), digits)


def _pct(v: float | None) -> str:
    return "n/a" if v is None else f"{v * 100:.1f}%"


def _num(v: float | None) -> str:
    return "n/a" if v is None else f"{v:.2f}"


def crisis_table(run: dict, bench: dict, crises=CRISES) -> list[dict]:
    eq, beq = _series(run.get("equity", [])), _series(bench.get("equity", []))
    rows = []
    for name, start, end in crises:
        s, b = _period_return(eq, start, end), _period_return(beq, start, end)
        if s is None:
            continue
        rows.append({"name": name, "start": start, "end": end, "return": _r(s),
                     "market": _r(b), "beat_market": None if b is None else s > b})
    return rows


def year_table(run: dict, bench: dict, n: int = 3) -> tuple[list[dict], list[dict]]:
    years = {k: v for k, v in (run.get("yearly") or {}).items() if v is not None}
    market = bench.get("yearly") or {}
    rows = [{"year": int(y), "return": _r(v), "market": _r(market.get(y))}
            for y, v in years.items()]
    by = sorted(rows, key=lambda x: x["return"])
    return list(reversed(by[-n:])), by[:n]


def market_link(run: dict, bench: dict) -> dict:
    """How closely it moves with the stock market."""
    m = run.get("metrics") or {}
    eq, beq = _series(run.get("equity", [])), _series(bench.get("equity", []))
    weekly = pd.DataFrame({"s": eq.pct_change(), "b": beq.pct_change()}).dropna()
    corr = m.get("correlation")
    if corr is None and len(weekly) > 10:
        corr = float(weekly["s"].corr(weekly["b"]))
    bad = weekly[weekly["b"] <= weekly["b"].quantile(0.1)] if len(weekly) > 20 else weekly[:0]
    return {"correlation": _r(corr, 3), "beta": _r(m.get("beta"), 3),
            "worst_market_weeks_avg": _r(float(bad["s"].mean())) if len(bad) else None,
            "market_worst_weeks_avg": _r(float(bad["b"].mean())) if len(bad) else None}


def cost_table(run: dict, cost_runs: list[dict] | None = None,
               levels=COST_LEVELS) -> dict:
    """Results at several trading costs. Uses real reruns when given, otherwise a
    simple estimate: each extra basis point costs turnover x 1bp a year."""
    m = run.get("metrics") or {}
    breakeven = m.get("breakeven_cost_bps")
    if cost_runs:
        rows = [{"cost_bps": c["cost_bps"], "cagr": _r(c.get("cagr")),
                 "sharpe": _r(c.get("sharpe"), 3)} for c in cost_runs]
        return {"levels": rows, "breakeven_cost_bps": _r(breakeven, 2), "estimated": False}
    base = (run.get("config") or {}).get("cost_bps", 1.0)
    turnover = m.get("turnover_per_year")
    rows = []
    for c in levels:
        cagr = None
        if turnover is not None and m.get("cagr") is not None:
            cagr = m["cagr"] - turnover * (c - base) / 1e4
        rows.append({"cost_bps": c, "cagr": _r(cagr), "sharpe": None})
    return {"levels": rows, "breakeven_cost_bps": _r(breakeven, 2), "estimated": True}


def gauntlet_summary(run: dict) -> dict:
    g = run.get("gauntlet")
    if not g:
        return {"ran": False, "passed": None, "total": None, "verdict": None, "failures": [],
                "passes": [], "untested": []}
    tests = g.get("tests", [])
    fails = [{"id": t["id"], "name": t["name"], "value": t["value"], "bar": t["bar"],
              "meaning": FAILURE_MEANING.get(t["id"], t.get("plain", ""))}
             for t in tests if t["passed"] is False]
    passes = [{"id": t["id"], "name": t["name"], "meaning": PASS_MEANING.get(t["id"], t["name"])}
              for t in tests if t["passed"] is True]
    untested = [{"id": t["id"], "name": t["name"]} for t in tests if t["passed"] is None]
    return {"ran": True, "passed": g.get("passed"), "total": g.get("total"),
            "verdict": g.get("verdict"), "beats_sp500": g.get("beats_sp500"),
            "failures": fails, "passes": passes, "untested": untested}


def analyse(run: dict, bench: dict, cost_runs: list[dict] | None = None,
            crises=CRISES) -> dict:
    """Strengths and weaknesses of one run against the benchmark run."""
    m, bm = run.get("metrics") or {}, bench.get("metrics") or {}
    crisis = crisis_table(run, bench, crises)
    best, worst = year_table(run, bench)
    link = market_link(run, bench)
    costs = cost_table(run, cost_runs)
    gaunt = gauntlet_summary(run)

    strengths, weaknesses = [], []
    s, bs = m.get("sharpe"), m.get("benchmark_sharpe", bm.get("sharpe"))
    if s is not None and bs is not None and not gaunt["ran"]:  # else A1 says it
        (strengths if s > bs else weaknesses).append(
            f"Return for the risk (Sharpe) of {_num(s)} against {_num(bs)} for the market.")
    dd, bdd = m.get("max_drawdown"), bm.get("max_drawdown")
    if dd is not None and bdd is not None:
        if dd > bdd:
            strengths.append(f"Smaller worst fall than the market: {_pct(dd)} against "
                             f"{_pct(bdd)}.")
        elif dd < bdd:
            weaknesses.append(f"Bigger worst fall than the market: {_pct(dd)} against "
                              f"{_pct(bdd)}.")
    for c in crisis:
        if c["market"] is not None and c["market"] < 0 and c["return"] >= 0:
            strengths.append(f"Made {_pct(c['return'])} in the {c['name']} while the market "
                             f"made {_pct(c['market'])}.")
        elif c["market"] is not None and c["return"] < min(c["market"], 0):
            weaknesses.append(f"Lost {_pct(c['return'])} in the {c['name']}, more than the "
                              f"market's {_pct(c['market'])}.")
    corr = link["correlation"]
    if corr is not None and abs(corr) < LOW_CORRELATION:
        strengths.append(f"Moves mostly on its own, not with the stock market (correlation "
                         f"{_num(corr)}).")
    elif corr is not None and corr > HIGH_CORRELATION:
        weaknesses.append(f"Moves closely with the stock market (correlation {_num(corr)}), "
                          "so it adds little variety.")
    be = costs["breakeven_cost_bps"]
    if be is not None:
        if be >= 10:
            strengths.append(f"Still earns money with trading costs up to {be:.0f} basis points "
                             "a trade.")
        elif be < 5:
            weaknesses.append(f"Trading costs above {be:.1f} basis points a trade wipe out "
                              "what it earns.")
    if worst and worst[0]["return"] is not None and worst[0]["return"] < -0.2:
        weaknesses.append(f"Lost {_pct(worst[0]['return'])} in {worst[0]['year']}.")
    strengths += [p["meaning"] for p in gaunt["passes"]]
    weaknesses += [f["meaning"] for f in gaunt["failures"]]

    return {
        "strategy": run.get("strategy"),
        "display_name": run.get("display_name") or run.get("strategy"),
        "description": run.get("description") or run.get("summary", ""),
        "tags": run.get("tags") or {},
        "period": {"start": m.get("start"), "end": m.get("end"), "years": m.get("years")},
        "headline": {"cagr": _r(m.get("cagr")), "sharpe": _r(s, 3),
                     "max_drawdown": _r(dd), "market_cagr": _r(bm.get("cagr")),
                     "market_sharpe": _r(bs, 3), "market_max_drawdown": _r(bdd)},
        "verdict": gaunt["verdict"],
        "crises": crisis,
        "best_years": best,
        "worst_years": worst,
        "costs": costs,
        "market": link,
        "gauntlet": gaunt,
        "strengths": strengths,
        "weaknesses": weaknesses,
    }


def to_markdown(a: dict) -> str:
    h = a["headline"]
    t = a.get("tags") or {}
    out = [f"# {a['display_name']} (`{a['strategy']}`)", "", a["description"], ""]
    if t:
        out += [" / ".join(f"{k}: {v}" for k, v in t.items()), ""]
    p = a["period"]
    out += [f"Tested {p['start']} to {p['end']} ({p['years']} years).", ""]
    if a["verdict"]:
        out += [f"**Verdict:** {a['verdict']}", ""]
    out += ["| | This strategy | US stock market |", "| --- | --- | --- |",
            f"| Return a year | {_pct(h['cagr'])} | {_pct(h['market_cagr'])} |",
            f"| Sharpe | {_num(h['sharpe'])} | {_num(h['market_sharpe'])} |",
            f"| Worst fall | {_pct(h['max_drawdown'])} | {_pct(h['market_max_drawdown'])} |", ""]
    out += ["## Strengths", ""] + ([f"- {x}" for x in a["strengths"]] or ["- None found."])
    out += ["", "## Weaknesses", ""] + ([f"- {x}" for x in a["weaknesses"]] or ["- None found."])
    g = a["gauntlet"]
    out += ["", "## Gauntlet", ""]
    if not g["ran"]:
        out.append("The gauntlet was not run.")
    else:
        out.append(f"Passed {g['passed']} of {g['total']} tests.")
        if g["failures"]:
            out += ["", "| Test | Result | Bar | What it means |", "| --- | --- | --- | --- |"]
            out += [f"| {f['id']} {f['name']} | {f['value']} | {f['bar']} | {f['meaning']} |"
                    for f in g["failures"]]
        if g["untested"]:
            out += ["", "Could not be tested: " +
                    ", ".join(f"{u['id']} {u['name']}" for u in g["untested"]) + "."]
    out += ["", "## In market crises", ""]
    if a["crises"]:
        out += ["| Crisis | Dates | This strategy | Market |", "| --- | --- | --- | --- |"]
        out += [f"| {c['name']} | {c['start']} to {c['end']} | {_pct(c['return'])} | "
                f"{_pct(c['market'])} |" for c in a["crises"]]
    else:
        out.append("No crisis falls inside the tested period.")
    out += ["", "## Best and worst years", "", "| Year | This strategy | Market |",
            "| --- | --- | --- |"]
    out += [f"| {y['year']} (best) | {_pct(y['return'])} | {_pct(y['market'])} |"
            for y in a["best_years"]]
    out += [f"| {y['year']} (worst) | {_pct(y['return'])} | {_pct(y['market'])} |"
            for y in a["worst_years"]]
    c = a["costs"]
    out += ["", "## Trading costs", ""]
    if c["estimated"]:
        out += ["Estimated from turnover, not rerun.", ""]
    out += ["| Cost a trade (bps) | Return a year | Sharpe |", "| --- | --- | --- |"]
    out += [f"| {x['cost_bps']:g} | {_pct(x['cagr'])} | {_num(x['sharpe'])} |"
            for x in c["levels"]]
    if c["breakeven_cost_bps"] is not None:
        out += ["", f"It earns nothing above about {c['breakeven_cost_bps']:.1f} bps a trade."]
    mk = a["market"]
    out += ["", "## Link to the stock market", "",
            f"- Correlation: {_num(mk['correlation'])}",
            f"- Beta: {_num(mk['beta'])}",
            f"- In the market's worst 10% of weeks: {_pct(mk['worst_market_weeks_avg'])} a week "
            f"on average, against {_pct(mk['market_worst_weeks_avg'])} for the market."]
    return "\n".join(out) + "\n"


def analyse_strategy(name: str, config, data_dir: Path, n_trials: int | None = None,
                     cost_levels=COST_LEVELS) -> dict:
    """Backtest and gauntlet one strategy, rerun it at a few costs, then analyse."""
    from . import report, strategies
    from .backtest import BacktestConfig, run
    from .data import store
    from .metrics import performance

    registry = strategies.available()
    if name not in registry:
        raise KeyError(f"No strategy named '{name}'. Known: {', '.join(registry)}")
    if n_trials is None:
        n_trials = sum(1 for c in registry.values() if not c.is_benchmark)
    doc = report.run_all(["us_market_buy_hold", name], config, data_dir=data_dir,
                         gauntlet=True, n_trials=n_trials)
    runs = {r["strategy"]: r for r in doc["runs"]}
    target, bench = runs[name], runs["us_market_buy_hold"]
    cost_runs = None
    if not target["is_benchmark"]:
        strat = strategies.get(name)
        keys = sorted(set(strat.required()) | {"rate.USD", "rate.TBILL3M"})
        panel = store.panel(keys, data_dir)
        cost_runs = []
        for c in cost_levels:
            res = run(strat, panel, BacktestConfig(**{**config.to_dict(), "cost_bps": c}))
            cost_runs.append({"cost_bps": c, "cagr": performance.cagr(res.returns),
                              "sharpe": performance.sharpe(res.excess_returns)})
    return analyse(target, bench, cost_runs)
