"""Official runs: the only way a number becomes a result.

    parity official REG-0001            check, run, judge and append to the ledger
    parity official REG-0001 --dry-run  check and run, but do not touch the ledger

Normally started by .github/workflows/official-run.yml, so it runs on a clean
machine from a clean checkout, and the ledger commit, the GitHub release with the
data fingerprint and outputs, and the Supabase copy all happen in one place.
"""

from __future__ import annotations

import json
from pathlib import Path

from . import ledger, registration, report
from .backtest import BacktestConfig
from .data import store

OUT = ledger.ROOT / "engine" / "output" / "official"


def judge(run: dict, criteria: dict) -> dict:
    """Apply a registration's pass criteria to one strategy's gauntlet.

    Supported criteria (all optional, all must hold):
        beats_sp500: true           every A test passes
        required_tests: [ids]       each listed test passes
        min_real_tests: n           at least n of the B tests pass
    """
    g = run.get("gauntlet") or {}
    tests = {t["id"]: t["passed"] for t in g.get("tests", [])}
    checks = {}
    if criteria.get("beats_sp500"):
        checks["beats_sp500"] = bool(g.get("beats_sp500"))
    for tid in criteria.get("required_tests", []):
        checks[f"test {tid}"] = bool(tests.get(tid))
    if "min_real_tests" in criteria:
        real = sum(1 for t in g.get("tests", []) if t["group"] == "real" and t["passed"])
        checks[f"at least {criteria['min_real_tests']} reality tests"] = \
            real >= criteria["min_real_tests"]
    return {"passed": all(checks.values()) if checks else None, "checks": checks}


def run_official(reg_id: str, dry_run: bool = False) -> dict:
    reg = registration.load(reg_id)
    # Even a dry run needs the plan committed first, so seeing results cannot change it.
    issues = registration.problems(reg, require_committed=True, require_clean=not dry_run)
    if issues:
        raise SystemExit(f"{reg_id} cannot run officially:\n  - " + "\n  - ".join(issues))

    d = reg.data
    names = [s["name"] for s in d["strategies"]]
    prior = max(int(d["prior_trials"]), ledger.trials_so_far(names))
    cfg = BacktestConfig(**d["backtest"])
    doc = report.run_all(config=cfg, specs=d["strategies"], n_trials=prior + len(names),
                         kind="official")
    coverage = store.coverage()

    results, verdicts = {}, {}
    for run in doc["runs"]:
        if run["is_benchmark"]:
            continue
        g = run["gauntlet"] or {}
        outcome = judge(run, d["pass_criteria"])
        verdicts[run["strategy"]] = outcome
        results[run["strategy"]] = {
            "params": run["params"],
            "sharpe": run["metrics"]["sharpe"],
            "cagr": run["metrics"]["cagr"],
            "max_drawdown": run["metrics"]["max_drawdown"],
            "deflated_sharpe": run["metrics"]["deflated_sharpe"],
            "gauntlet": f"{g.get('passed')}/{g.get('total')}",
            "tests": {t["id"]: t["passed"] for t in g.get("tests", [])},
            "verdict": g.get("verdict"),
            "meets_registered_criteria": outcome["passed"],
            "trials": 1 + (g.get("sensitivity", {}) or {}).get("tried", 0) + 2,
        }

    git = ledger.git_state()
    record = {
        "kind": "official",
        "registration": reg_id,
        "registration_sha256": ledger.sha256(reg.path.read_bytes()),
        "git_sha": git["sha"],
        "data_snapshot": coverage.get("snapshot"),
        "data_fetched_at": coverage.get("fetched_at"),
        "trials_counted": prior + len(names),
        "results": results,
    }
    slim_runs = [{k: v for k, v in r.items() if k not in ("equity", "drawdown")}
                 for r in doc["runs"]]
    details = {
        "registration": d,
        "record": record,
        "verdicts": verdicts,
        "coverage": coverage,
        "report": {**{k: v for k, v in doc.items() if k not in ("runs", "series")},
                   "runs": slim_runs},
    }

    if dry_run:
        print(json.dumps(record, indent=1, default=str))
        return record

    entry = ledger.append(record, details)
    out = OUT / entry["run_id"]
    out.mkdir(parents=True, exist_ok=True)
    report.write({**doc, "run_id": entry["run_id"]}, out)
    (out / "coverage.json").write_text(json.dumps(coverage, indent=2))
    print(f"Recorded {entry['run_id']} (hash {entry['hash'][:12]})")
    for name, outcome in verdicts.items():
        word = {True: "meets", False: "does not meet", None: "has no"}[outcome["passed"]]
        print(f"  {name}: {word} its registered criteria")
    return entry


def official_dir(run_id: str) -> Path:
    return OUT / run_id
