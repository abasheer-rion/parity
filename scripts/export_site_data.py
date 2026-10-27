"""Copy published research runs from Supabase into static files for the dashboard.

The dashboard sits behind Cloudflare Access, so it no longer signs in to Supabase
itself: the deploy job runs this script and ships the results as files next to the
page. The browser then needs no database login at all.

Writes, under the output folder:
  batches.json          newest first: id, generated_at, git_sha, kind, run_id
  batch/<id>.json       one report per run, in the shape web/src/lib/types.ts expects
  latest.json           a copy of the newest run
  <run>.lite.json       the same run without each strategy's settings test, which is
                        about two thirds of the bytes and read only by Workbench
  <run>.sensitivity.json  those settings tests, by strategy (REF-0024)
  search.json           the newest strategy search snapshot (DEC-0014)
  sims.json             the newest always-on sims summary (DEC-0037)
  profiles.json         the newest competitor feedback counts (DEC-0047)

and, one folder up (the site root, public): stats.json, two counts for the front
page's counters, strategies tested in the newest run and variations searched.
Counts only, nothing else from the research.

Usage: SITE_DATA_DB_URL=postgres://... python3 scripts/export_site_data.py web/dist/data
Keeps every official run and the newest KEEP_EXPLORATORY exploratory runs.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

KEEP_EXPLORATORY = 8
RUN_COLS = "strategy, summary, reference, is_benchmark, params, config, metrics, yearly, equity, drawdown, ic_decay, exposure, gauntlet"


def iso(v) -> str | None:
    return v.isoformat() if v is not None else None


def lift_holdup(run: dict) -> dict:
    """The engine publishes the "how it holds up" numbers inside the gauntlet blob
    (strategy_runs has no column for them); put them back at run.holdup for the web."""
    g = run.get("gauntlet")
    if isinstance(g, dict) and "holdup" in g:
        g = dict(g)
        return {**run, "gauntlet": g, "holdup": g.pop("holdup")}
    return run


def split_run(report: dict) -> tuple[dict, dict]:
    """The run without the settings tests, and the settings tests by strategy."""
    runs, tests = [], {}
    for r in report.get("runs") or []:
        g = r.get("gauntlet")
        if isinstance(g, dict) and "sensitivity" in g:
            tests[r["strategy"]] = g["sensitivity"]
            r = {**r, "gauntlet": {k: v for k, v in g.items() if k != "sensitivity"}}
        runs.append(r)
    return {**report, "runs": runs}, tests


def write_run(out: Path, name: str, report: dict) -> None:
    """<name>.json (the whole run), <name>.lite.json and <name>.sensitivity.json."""
    (out / f"{name}.json").write_text(json.dumps(report, separators=(",", ":")))
    lite, tests = split_run(report)
    (out / f"{name}.lite.json").write_text(json.dumps(lite, separators=(",", ":")))
    (out / f"{name}.sensitivity.json").write_text(json.dumps(tests, separators=(",", ":")))


def main(out: Path) -> int:
    dsn = os.environ.get("SITE_DATA_DB_URL")
    if not dsn:
        print("SITE_DATA_DB_URL is not set", file=sys.stderr)
        return 1
    out.mkdir(parents=True, exist_ok=True)
    (out / "batch").mkdir(exist_ok=True)
    with psycopg.connect(dsn, row_factory=dict_row) as conn, conn.cursor() as cur:
        cur.execute(
            "select id, generated_at, git_sha, schema_version, n_trials, config, coverage, kind, run_id, series "
            "from public.research_batches order by generated_at desc"
        )
        batches = cur.fetchall()
        kept, exploratory = [], 0
        for b in batches:
            if b["kind"] == "official" or exploratory < KEEP_EXPLORATORY:
                kept.append(b)
                exploratory += b["kind"] != "official"
        index = []
        for b in kept:
            cur.execute(f"select {RUN_COLS} from public.strategy_runs where batch_id = %s order by strategy", (b["id"],))
            coverage = b["coverage"] or {}
            report = {
                "schema_version": b["schema_version"],
                "generated_at": iso(b["generated_at"]),
                "git_sha": b["git_sha"],
                "n_trials": b["n_trials"],
                "config": b["config"],
                "coverage": coverage,
                "kind": b["kind"],
                "run_id": b["run_id"],
                "series": b["series"],
                "comparison": coverage.get("comparison"),
                "source_checks": coverage.get("source_checks"),
                "runs": [lift_holdup(r) for r in cur.fetchall()],
            }
            bid = str(b["id"])
            write_run(out / "batch", bid, report)
            index.append({"id": bid, "generated_at": report["generated_at"], "git_sha": b["git_sha"], "kind": b["kind"], "run_id": b["run_id"]})
        (out / "batches.json").write_text(json.dumps(index))
        if index:
            for suffix in (".json", ".lite.json", ".sensitivity.json"):
                (out / f"latest{suffix}").write_text((out / "batch" / f"{index[0]['id']}{suffix}").read_text())
        # The team list is no longer exported: since sign-up is open (DEC-0012), every
        # signed-in person can read /data, and team emails are private.
        # The newest snapshot of the always-on strategy search (DEC-0014), if any.
        try:
            cur.execute("select doc from public.search_snapshots order by id desc limit 1")
            snap = cur.fetchone()
            if snap:
                (out / "search.json").write_text(json.dumps(snap["doc"], separators=(",", ":")))
        except psycopg.Error as exc:  # table not migrated yet: ship the site without it
            conn.rollback()
            snap = None
            print(f"no search snapshot: {exc}", file=sys.stderr)
        # The always-on sims' accumulated summary (DEC-0037), if any.
        try:
            cur.execute("select doc from public.sim_snapshots order by id desc limit 1")
            sims = cur.fetchone()
            if sims:
                (out / "sims.json").write_text(json.dumps(sims["doc"], separators=(",", ":")))
        except psycopg.Error as exc:  # table not migrated yet: ship the site without it
            conn.rollback()
            print(f"no sims snapshot: {exc}", file=sys.stderr)
        # The competitor feedback collector's counts (DEC-0047), if any.
        try:
            cur.execute("select doc from public.profile_snapshots order by id desc limit 1")
            prof = cur.fetchone()
            if prof:
                (out / "profiles.json").write_text(json.dumps(prof["doc"], separators=(",", ":")))
        except psycopg.Error as exc:  # table not migrated yet: ship the site without it
            conn.rollback()
            print(f"no profiles snapshot: {exc}", file=sys.stderr)
    # The front page's live counters (DEC-0017). Public, so counts only.
    stats: dict = {}
    if index:
        newest = json.loads((out / "latest.json").read_text())
        stats["generated_at"] = newest["generated_at"]
        tested = [r for r in newest["runs"] if not r.get("is_benchmark") and r.get("gauntlet")]
        stats["strategies_tested"] = len(tested)
        # How many beat simply holding the market after costs and the luck check (DEC-0039).
        stats["strategies_beat_market"] = sum(1 for r in tested if (r.get("gauntlet") or {}).get("beats_sp500") is True)
    if snap and isinstance(snap["doc"].get("trials"), int):
        stats["variations_searched"] = snap["doc"]["trials"]
        if isinstance(snap["doc"].get("passed_luck_check"), int):
            stats["search_passed_luck"] = snap["doc"]["passed_luck_check"]
    (out.parent / "stats.json").write_text(json.dumps(stats))
    print(f"exported {len(index)} runs ({len(batches)} published) to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1] if len(sys.argv) > 1 else "web/dist/data")))
