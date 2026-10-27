"""Send a research run to Supabase so the hosted dashboard can show it.

Connects straight to Postgres as `parity_writer`, a role that can only insert new
batches and runs (see supabase/migrations/20261020010000_writer_role.sql). That is
less power than the project's service key, which can do anything. Needs one
environment variable, which the scheduled workflow reads from a GitHub secret:

    PARITY_WRITER_DB_URL   postgresql://parity_writer.<ref>:<password>@<pooler-host>:5432/postgres

Install with `pip install -e ".[publish]"`.
"""

from __future__ import annotations

import json
import os


class NotConfigured(RuntimeError):
    pass


BATCH_SQL = """
insert into public.research_batches
  (generated_at, git_sha, schema_version, n_trials, config, coverage, kind, run_id, series)
values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
returning id
"""

RUN_FIELDS = ("strategy", "summary", "reference", "is_benchmark", "params", "config", "metrics",
              "yearly", "equity", "drawdown", "ic_decay", "exposure", "gauntlet")
JSON_FIELDS = {"params", "config", "metrics", "yearly", "equity", "drawdown", "ic_decay",
               "exposure", "gauntlet"}


def nest_holdup(run: dict) -> dict:
    """strategy_runs has no holdup column, so the "how it holds up" numbers travel inside
    the gauntlet blob and scripts/export_site_data.py lifts them back out. A run without a
    gauntlet (the benchmark) leaves them out rather than invent a gauntlet."""
    h, g = run.get("holdup"), run.get("gauntlet")
    if h is None or not isinstance(g, dict):
        return run
    return {**run, "gauntlet": {**g, "holdup": h}}


def publish(doc: dict) -> str:
    url = os.environ.get("PARITY_WRITER_DB_URL")
    if not url:
        raise NotConfigured("PARITY_WRITER_DB_URL is not set")
    import psycopg  # only needed when publishing

    with psycopg.connect(url, autocommit=False) as conn, conn.cursor() as cur:
        coverage = {**doc["coverage"], "source_checks": doc.get("source_checks", []),
                    "comparison": doc.get("comparison")}
        cur.execute(BATCH_SQL, (doc["generated_at"], doc.get("git_sha"), doc["schema_version"],
                                doc["n_trials"], json.dumps(doc["config"]),
                                json.dumps(coverage), doc.get("kind", "exploratory"),
                                doc.get("run_id"), json.dumps(doc.get("series"))))
        batch_id = str(cur.fetchone()[0])
        cols = ", ".join(("batch_id", *RUN_FIELDS))
        marks = ", ".join(["%s"] * (len(RUN_FIELDS) + 1))
        rows = [(batch_id, *[json.dumps(run.get(f)) if f in JSON_FIELDS else run[f]
                             for f in RUN_FIELDS]) for run in map(nest_holdup, doc["runs"])]
        cur.executemany(f"insert into public.strategy_runs ({cols}) values ({marks})", rows)
        conn.commit()
    return batch_id


def publish_search(doc: dict, top: int = 1000) -> None:
    """Send a compact strategy search snapshot (DEC-0014): the totals and the best
    `top` rows. The table keeps only the newest 20."""
    url = os.environ.get("PARITY_WRITER_DB_URL")
    if not url:
        raise NotConfigured("PARITY_WRITER_DB_URL is not set")
    import psycopg

    small = {**doc, "rows": doc["rows"][:top]}
    with psycopg.connect(url, connect_timeout=20) as conn:
        conn.execute("insert into public.search_snapshots (generated_at, trials, doc) "
                     "values (%s, %s, %s)", (doc["generated_at"], doc["trials"], json.dumps(small)))


def _writer_url() -> str:
    url = os.environ.get("PARITY_WRITER_DB_URL")
    if not url:
        raise NotConfigured("PARITY_WRITER_DB_URL is not set")
    return url


def publish_sims(doc: dict) -> None:
    """Send the always-on sims' accumulated summary (DEC-0037). Counts and percentiles
    only; the table keeps the newest 20 and the deploy job copies the newest to the site."""
    url = _writer_url()
    import psycopg

    with psycopg.connect(url, connect_timeout=20) as conn:
        conn.execute("insert into public.sim_snapshots (generated_at, cycles, doc) "
                     "values (%s, %s, %s)", (doc["generated_at"], doc["cycles"], json.dumps(doc)))


def heartbeat(service: str, summary: dict) -> None:
    """Report that a background service is alive (DEC-0037). The database stamps the
    time itself, so a wrong clock on this machine cannot make a dead service look alive.
    `summary` is a few public counts, never paths or keys."""
    url = _writer_url()
    import psycopg

    with psycopg.connect(url, connect_timeout=20) as conn:
        conn.execute("select public.report_heartbeat(%s, %s::jsonb)",
                     (service, json.dumps(summary)))


def publish_profiles(doc: dict) -> None:
    """Send the feedback collector's summary (competitor profiles): counts of praise and
    complaints by theme, trends and ratings, never review text. The table keeps the
    newest 20 and the deploy job copies the newest to the site."""
    url = _writer_url()
    import psycopg

    with psycopg.connect(url, connect_timeout=20) as conn:
        conn.execute("insert into public.profile_snapshots (generated_at, items, doc) "
                     "values (%s, %s, %s)", (doc["generated_at"], doc["items"], json.dumps(doc)))
