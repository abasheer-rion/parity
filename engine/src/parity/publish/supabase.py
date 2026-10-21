"""Send a research run to Supabase so the hosted dashboard can show it.

Uses the PostgREST API directly so we do not need another dependency. Needs two
environment variables, which the scheduled workflow reads from GitHub secrets:

    SUPABASE_URL                https://<project-ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY   server-side key; never ship this to the browser

Table layout is in supabase/migrations/.
"""

from __future__ import annotations

import os

import requests


class NotConfigured(RuntimeError):
    pass


def _client() -> tuple[str, dict]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise NotConfigured("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    return url.rstrip("/") + "/rest/v1", headers


def publish(doc: dict) -> str:
    base, headers = _client()
    batch = {
        "generated_at": doc["generated_at"],
        "git_sha": doc.get("git_sha"),
        "schema_version": doc["schema_version"],
        "config": doc["config"],
        "coverage": doc["coverage"],
        "n_trials": doc["n_trials"],
    }
    resp = requests.post(f"{base}/research_batches", json=batch, headers=headers, timeout=60)
    resp.raise_for_status()
    batch_id = resp.json()[0]["id"]

    fields = ("strategy", "summary", "reference", "is_benchmark", "params", "config", "metrics",
              "yearly", "equity", "drawdown", "ic_decay", "exposure", "gauntlet")
    rows = [{"batch_id": batch_id, **{k: run[k] for k in fields}} for run in doc["runs"]]
    resp = requests.post(f"{base}/strategy_runs", json=rows, headers=headers, timeout=120)
    resp.raise_for_status()
    return batch_id
