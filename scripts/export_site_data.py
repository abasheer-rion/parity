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

Egress (REF-0028): a full copy is about 45 MB and the deploy runs hundreds of times a week,
which used up the free database plan's monthly transfer. So the script first asks the
database for one short fingerprint per run (a hash it works out itself), then downloads
only the runs whose fingerprint is not already in SITE_DATA_CACHE. The deploy job keeps
that folder between runs, so a deploy with no new research reads a few kilobytes.
Without SITE_DATA_CACHE every run is downloaded, as before.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
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


# One short hash per run, worked out inside the database, so nothing large is sent to
# find out what changed: the batch row and every strategy row of that batch.
FINGERPRINTS = (
    "select b.id, b.kind, b.generated_at, md5(md5(b::text) || coalesce(("
    "  select string_agg(md5(s::text), ',' order by s.id) from public.strategy_runs s"
    "  where s.batch_id = b.id), '')) as fp "
    "from public.research_batches b order by b.generated_at desc"
)


def kept_batches(batches: list[dict]) -> list[dict]:
    """Every official run and the newest KEEP_EXPLORATORY exploratory runs, newest first."""
    kept, exploratory = [], 0
    for b in batches:
        if b["kind"] == "official" or exploratory < KEEP_EXPLORATORY:
            kept.append(b)
            exploratory += b["kind"] != "official"
    return kept


def fetch_report(cur, batch_id) -> dict:
    """One run in the shape web/src/lib/types.ts expects, straight from the database."""
    cur.execute(
        "select id, generated_at, git_sha, schema_version, n_trials, config, coverage, kind, run_id, series "
        "from public.research_batches where id = %s", (batch_id,))
    b = cur.fetchone()
    cur.execute(f"select {RUN_COLS} from public.strategy_runs where batch_id = %s order by strategy", (batch_id,))
    coverage = b["coverage"] or {}
    return {
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


def cached(cache: Path, name: str, load):
    """The JSON stored under cache/name, or load() stored there first. Returns (doc, hit)."""
    f = cache / name
    if f.exists():
        try:
            return json.loads(f.read_text()), True
        except ValueError:
            pass
    doc = load()
    f.write_text(json.dumps(doc, separators=(",", ":")))
    return doc, False


def newest_snapshot(conn, cur, cache: Path, table: str, used: set[str]):
    """The newest doc in a snapshot table, read in full only when its id is new."""
    try:
        cur.execute(f"select id from public.{table} order by id desc limit 1")
        row = cur.fetchone()
    except psycopg.Error as exc:  # table not migrated yet: ship the site without it
        conn.rollback()
        print(f"no {table}: {exc}", file=sys.stderr)
        return None
    if not row:
        return None
    name = f"{table}.{row['id']}.json"
    used.add(name)

    def load():
        cur.execute(f"select doc from public.{table} where id = %s", (row["id"],))
        return cur.fetchone()["doc"]

    return cached(cache, name, load)[0]


def main(out: Path) -> int:
    dsn = os.environ.get("SITE_DATA_DB_URL")
    if not dsn:
        print("SITE_DATA_DB_URL is not set", file=sys.stderr)
        return 1
    keep = bool(os.environ.get("SITE_DATA_CACHE"))
    cache = Path(os.environ.get("SITE_DATA_CACHE") or tempfile.mkdtemp(prefix="site-data-"))
    cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    (out / "batch").mkdir(exist_ok=True)
    used: set[str] = set()
    fetched = 0
    with psycopg.connect(dsn, row_factory=dict_row) as conn, conn.cursor() as cur:
        cur.execute(FINGERPRINTS)
        batches = cur.fetchall()
        index = []
        for b in kept_batches(batches):
            name = f"batch.{b['id']}.{b['fp']}.json"
            used.add(name)
            report, hit = cached(cache, name, lambda bid=b["id"]: fetch_report(cur, bid))
            fetched += not hit
            bid = str(b["id"])
            write_run(out / "batch", bid, report)
            index.append({"id": bid, "generated_at": report["generated_at"], "git_sha": report["git_sha"], "kind": report["kind"], "run_id": report["run_id"]})
        (out / "batches.json").write_text(json.dumps(index))
        if index:
            for suffix in (".json", ".lite.json", ".sensitivity.json"):
                (out / f"latest{suffix}").write_text((out / "batch" / f"{index[0]['id']}{suffix}").read_text())
        # The team list is no longer exported: since sign-up is open (DEC-0012), every
        # signed-in person can read /data, and team emails are private.
        # The newest strategy search (DEC-0014), sims (DEC-0037) and feedback counts (DEC-0047).
        search = newest_snapshot(conn, cur, cache, "search_snapshots", used)
        sims = newest_snapshot(conn, cur, cache, "sim_snapshots", used)
        prof = newest_snapshot(conn, cur, cache, "profile_snapshots", used)
        for fname, doc in (("search.json", search), ("sims.json", sims), ("profiles.json", prof)):
            if doc is not None:
                (out / fname).write_text(json.dumps(doc, separators=(",", ":")))
        snap = {"doc": search} if search is not None else None
    for f in cache.glob("*.json"):  # drop runs and snapshots that are no longer shown
        if f.name not in used:
            f.unlink()
    if not keep:
        shutil.rmtree(cache, ignore_errors=True)
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
    print(f"exported {len(index)} runs ({len(batches)} published, {fetched} downloaded) to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1] if len(sys.argv) > 1 else "web/dist/data")))
