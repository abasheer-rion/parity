"""Runs every registered strategy and writes one JSON file the dashboard can read.

The same document is what `parity publish` sends to Supabase, so the local
dashboard and the hosted one always show the same shape of data.
"""

from __future__ import annotations

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from . import holdout, strategies
from .backtest import BacktestConfig, run
from .compare import SOURCE_PAIRS, source_checks, strategy_comparison
from .data import catalog, store
from .gauntlet import run_gauntlet
from .metrics import holdup as holdup_mod
from .metrics import performance, signal

SCHEMA_VERSION = 1


def _git_sha() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True,
                                       stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def _weekly(series: pd.Series, digits: int = 5) -> list[list]:
    """Downsample to weekly points so the payload stays small."""
    s = series.resample("W-FRI").last().dropna()
    return [[d.date().isoformat(), round(float(v), digits)] for d, v in s.items()]


def holdup_series(panel: pd.DataFrame, data_dir: Path) -> tuple[dict, dict, dict]:
    """The comparison series for the "how it holds up" numbers: stocks (the benchmark's
    total return index), bonds (the 10-year Treasury total return index, built from the
    yield when no cached copy exists) and rates (the 10-year Treasury yield). Anything
    missing is reported by name and reason, never filled in."""
    series, names, reasons = {}, {}, {}
    if "eq.US_TOTAL" in panel:
        series["stocks"] = panel["eq.US_TOTAL"].pct_change(fill_method=None)
        names["stocks"] = "eq.US_TOTAL"
    else:
        reasons["stocks"] = "eq.US_TOTAL not loaded"
    try:
        tr = store.load("bond.TR10", data_dir)
        names["bonds"] = "bond.TR10"
    except FileNotFoundError:
        try:
            tr = store.bond_total_return(store.load("bond.UST10Y", data_dir),
                                         catalog.BOND_DURATION["bond.TR10"])
            names["bonds"] = "bond.TR10 (built from bond.UST10Y)"
        except FileNotFoundError:
            tr = None
            reasons["bonds"] = "no cached bond.TR10 or bond.UST10Y"
    if tr is not None:
        series["bonds"] = tr.pct_change(fill_method=None)
    try:
        series["rates"] = store.load("bond.UST10Y", data_dir)
        names["rates"] = "bond.UST10Y"
    except FileNotFoundError:
        reasons["rates"] = "no cached bond.UST10Y"
    return series, names, reasons


def _holdup(res, bench: pd.Series | None, n_trials: int, extra: tuple[dict, dict, dict],
            metrics: dict, cfg: BacktestConfig, gauntlet: dict | None, name: str) -> dict | None:
    series, names, reasons = extra
    tests = None
    if gauntlet:
        tests = {"placebo_timing": gauntlet.get("placebo", {}).get("p_value")}
        prob = gauntlet.get("bootstrap", {}).get("prob_sharpe_above_zero")
        if prob is not None:
            tests["bootstrap_sharpe_above_zero"] = 1 - prob
    return holdup_mod.holdup(
        res.returns, bench, n_trials, stocks=series.get("stocks"), bonds=series.get("bonds"),
        rates=series.get("rates"), excess=res.excess_returns, test_p_values=tests,
        breakeven_bps=metrics.get("breakeven_cost_bps"), cost_bps=cfg.cost_bps,
        names={**names, "strategy": name, "benchmark": "us_market_buy_hold"},
        reasons={**reasons, "benchmark": "is_benchmark"} if bench is None else reasons)


def run_all(names: list[str] | None = None, config: BacktestConfig | None = None,
            data_dir: Path = store.DEFAULT_DIR, gauntlet: bool = True,
            specs: list[dict] | None = None, n_trials: int | None = None,
            kind: str = "exploratory") -> dict:
    """Run strategies and their gauntlets. `specs` ([{"name", "params"}]) pins exact
    parameters, as official runs do; otherwise every registered strategy runs with
    its defaults. `n_trials` overrides the trial count used for deflated Sharpe."""
    config = holdout.clamp_config(config or BacktestConfig())
    registry = strategies.available()
    if specs:
        instances = {s["name"]: strategies.get(s["name"], **s.get("params", {})) for s in specs}
        if "us_market_buy_hold" not in instances:
            instances = {"us_market_buy_hold": strategies.get("us_market_buy_hold"), **instances}
    else:
        names = names or list(registry)
        instances = {n: strategies.get(n) for n in names}

    needed = {k for s in instances.values() for k in s.required()}
    keys = sorted(needed | {"eq.US_TOTAL", "rate.USD", "rate.TBILL3M"})
    panel = store.panel(keys, data_dir)

    bench_cfg = BacktestConfig(**{**config.to_dict(), "target_vol": None, "cost_bps": 0.0})
    bench_res = run(strategies.get("us_market_buy_hold"), panel, bench_cfg)
    bench, bench_ex = bench_res.returns, bench_res.excess_returns
    if n_trials is None:
        n_trials = sum(1 for s in instances.values() if not s.is_benchmark)

    extra = holdup_series(panel, data_dir)
    runs, all_returns = [], {}
    for name, strat in instances.items():
        cfg = bench_cfg if strat.is_benchmark else config
        res = run(strat, panel, cfg)
        metrics = performance.summary(res.returns, res.gross_returns,
                                      None if strat.is_benchmark else res.turnover,
                                      None if strat.is_benchmark else bench,
                                      n_trials=1 if strat.is_benchmark else n_trials,
                                      excess=res.excess_returns,
                                      benchmark_excess=None if strat.is_benchmark else bench_ex)
        all_returns[name] = res.excess_returns
        sig = strat.signal(panel)
        gaunt = run_gauntlet(strat, panel, bench, cfg, n_trials, bench_ex) \
            if gauntlet and not strat.is_benchmark else None
        runs.append({
            "strategy": name,
            **type(strat).label(),
            "summary": strat.summary,
            "reference": strat.reference,
            "is_benchmark": strat.is_benchmark,
            "params": strat.params(),
            "config": cfg.to_dict(),
            "metrics": metrics,
            "yearly": performance.yearly_returns(res.returns),
            "equity": _weekly(res.equity),
            "drawdown": _weekly(performance.drawdown(res.returns), 4),
            "ic_decay": signal.ic_decay(sig, panel[[c for c in sig.columns if c in panel]])
            if sig is not None else [],
            "exposure": {k: round(float(v), 4) for k, v in res.weights.iloc[-1].items()}
            if len(res.weights) else {},
            "gauntlet": gaunt,
            "holdup": _holdup(res, None if strat.is_benchmark else bench,
                              1 if strat.is_benchmark else n_trials, extra, metrics, cfg,
                              gaunt, name),
        })

    check_keys = sorted({k for a, b, _ in SOURCE_PAIRS
                         for k in (a, b)})
    try:
        checks = source_checks(store.panel(check_keys, data_dir))
    except FileNotFoundError:
        checks = []
    return {
        "comparison": strategy_comparison(all_returns),
        "source_checks": checks,
        "series": market_series(data_dir),
        "schema_version": SCHEMA_VERSION,
        "kind": kind,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "git_sha": _git_sha(),
        "n_trials": n_trials,
        "config": config.to_dict(),
        "coverage": store.coverage(data_dir),
        "runs": runs,
    }


def market_series(data_dir: Path = store.DEFAULT_DIR, start: str = "2000-01-01") -> dict:
    """Weekly levels of every cached series, for the dashboard's data explorer."""
    from .data import catalog

    out = {}
    for key, spec in catalog.CATALOG.items():
        if not spec.site:  # bulk optional series stay off the site to keep the file small
            continue
        try:
            s = store.load(key, data_dir)
        except FileNotFoundError:
            continue
        s = s[s.index >= start].resample("W-FRI").last().dropna()
        out[key] = {"description": spec.description, "source": spec.source, "code": spec.code,
                    "frequency": spec.frequency,
                    "points": [[d.date().isoformat(), float(f"{v:.6g}")] for d, v in s.items()]}
    return out


def write(doc: dict, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "latest.json"
    path.write_text(json.dumps(doc, separators=(",", ":"), default=str))
    return path
