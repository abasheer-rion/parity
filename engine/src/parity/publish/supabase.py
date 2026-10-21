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
  (generated_at, git_sha, schema_version, n_trials, config, coverage)
values (%s, %s, %s, %s, %s, %s)
returning id
"""

RUN_FIELDS = ("strategy", "summary", "reference", "is_benchmark", "params", "config", "metrics",
              "yearly", "equity", "drawdown", "ic_decay", "exposure", "gauntlet")
JSON_FIELDS = {"params", "config", "metrics", "yearly", "equity", "drawdown", "ic_decay",
               "exposure", "gauntlet"}


def publish(doc: dict) -> str:
    url = os.environ.get("PARITY_WRITER_DB_URL")
    if not url:
        raise NotConfigured("PARITY_WRITER_DB_URL is not set")
    import psycopg  # only needed when publishing

    with psycopg.connect(url, autocommit=False) as conn, conn.cursor() as cur:
        cur.execute(BATCH_SQL, (doc["generated_at"], doc.get("git_sha"), doc["schema_version"],
                                doc["n_trials"], json.dumps(doc["config"]),
                                json.dumps(doc["coverage"])))
        batch_id = str(cur.fetchone()[0])
        cols = ", ".join(("batch_id", *RUN_FIELDS))
        marks = ", ".join(["%s"] * (len(RUN_FIELDS) + 1))
        rows = [(batch_id, *[json.dumps(run.get(f)) if f in JSON_FIELDS else run[f]
                             for f in RUN_FIELDS]) for run in doc["runs"]]
        cur.executemany(f"insert into public.strategy_runs ({cols}) values ({marks})", rows)
        conn.commit()
    return batch_id
