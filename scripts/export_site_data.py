"""Copy published research runs from Supabase into static files for the dashboard.

The dashboard sits behind Cloudflare Access, so it no longer signs in to Supabase
itself: the deploy job runs this script and ships the results as files next to the
page. The browser then needs no database login at all.

Writes, under the output folder:
  batches.json          newest first: id, generated_at, git_sha, kind, run_id
  batch/<id>.json       one report per run, in the shape web/src/lib/types.ts expects
  latest.json           a copy of the newest run
  search.json           the newest strategy search snapshot (DEC-0014)

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
                "runs": cur.fetchall(),
            }
            bid = str(b["id"])
            (out / "batch" / f"{bid}.json").write_text(json.dumps(report, separators=(",", ":")))
            index.append({"id": bid, "generated_at": report["generated_at"], "git_sha": b["git_sha"], "kind": b["kind"], "run_id": b["run_id"]})
        (out / "batches.json").write_text(json.dumps(index))
        if index:
            (out / "latest.json").write_text((out / "batch" / f"{index[0]['id']}.json").read_text())
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
            print(f"no search snapshot: {exc}", file=sys.stderr)
    print(f"exported {len(index)} runs ({len(batches)} published) to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1] if len(sys.argv) > 1 else "web/dist/data")))
