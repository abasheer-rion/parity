"""Daily database egress check (REF-0028).

Supabase's free plan allows 5 GB of egress a month, and in October 2026 the deploy job
alone used about 19 GB in five days. This reads the database host's own count of bytes
sent (the Management API's Prometheus metrics, node_network_transmit_bytes_total), keeps
one sample per run in a small local file, and works out the last day's bytes and a 30-day
projection. It reports them to the site's health table as service 'egress' with a warn
flag, which the site's health line shows, and prints one line to the log.

Environment (run.sh reads both from the vault; neither is ever printed):
  SUPABASE_ACCESS_TOKEN   personal access token, analytics read
  PARITY_WRITER_DB_URL    optional; without it nothing is sent to the site

Usage: python3 scripts/egress-check/check.py [--state FILE] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

REF = "ttqvpxvctnomfbeoqbbs"
METRICS = f"https://api.supabase.com/v1/projects/{REF}/analytics/endpoints/metrics"
LIMIT_BYTES = 5 * 10**9          # the free plan's monthly egress
WARN_SHARE = 0.8                 # warn when the 30-day projection passes 80% of it
DAY = 86400
STATE = Path.home() / "Library" / "Application Support" / "parity" / "egress-samples.jsonl"


def parse_metrics(text: str) -> dict:
    """Bytes sent by the database host and when it last booted, from Prometheus text."""
    tx, boot = 0.0, None
    for line in text.splitlines():
        if line.startswith("node_network_transmit_bytes_total{") and 'device="lo"' not in line:
            tx += float(line.rsplit(" ", 1)[1])
        elif line.startswith("node_boot_time_seconds{"):
            boot = float(line.rsplit(" ", 1)[1])
    if boot is None:
        raise ValueError("no node_boot_time_seconds in the metrics")
    return {"tx": tx, "boot": boot}


def fetch(token: str) -> dict:
    req = urllib.request.Request(METRICS, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return parse_metrics(r.read().decode())


def sent_between(a: dict, b: dict) -> float:
    """Bytes sent between two samples. A reboot resets the counter, so then only b's count."""
    if abs(a["boot"] - b["boot"]) < 60 and b["tx"] >= a["tx"]:
        return b["tx"] - a["tx"]
    return b["tx"]


def summarise(samples: list[dict], now: float) -> dict:
    """Bytes in the last day and a 30-day projection from up to 30 days of samples."""
    samples = sorted(samples, key=lambda s: s["t"])
    last = samples[-1]
    pairs = list(zip(samples, samples[1:]))
    day = sum(sent_between(a, b) for a, b in pairs if b["t"] > now - DAY)
    month = [(a, b) for a, b in pairs if b["t"] > now - 30 * DAY]
    if month:
        span = month[-1][1]["t"] - month[0][0]["t"]
        sent = sum(sent_between(a, b) for a, b in month)
    else:  # first run: the average since the host booted
        span, sent = now - last["boot"], last["tx"]
    rate = sent / span if span > 0 else 0.0
    projected = rate * 30 * DAY
    covered = any(a["t"] <= now - DAY for a, _ in pairs)
    return {
        "gb_last_day": round(day / 1e9, 3) if covered else round(rate * DAY / 1e9, 3),
        "gb_30d_projected": round(projected / 1e9, 2),
        "limit_gb": LIMIT_BYTES / 1e9,
        "warn": projected > WARN_SHARE * LIMIT_BYTES,
        "hours_of_history": round(span / 3600, 1),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", type=Path, default=STATE)
    ap.add_argument("--dry-run", action="store_true", help="do not report to the site")
    args = ap.parse_args(argv)
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        print("SUPABASE_ACCESS_TOKEN is not set", file=sys.stderr)
        return 1
    now = time.time()
    sample = {"t": now, **fetch(token)}
    args.state.parent.mkdir(parents=True, exist_ok=True)
    samples = []
    if args.state.exists():
        for line in args.state.read_text().splitlines():
            try:
                s = json.loads(line)
            except ValueError:
                continue
            if s.get("t", 0) > now - 31 * DAY:
                samples.append(s)
    samples.append(sample)
    args.state.write_text("".join(json.dumps(s) + "\n" for s in samples))
    summary = summarise(samples, now)
    print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)), json.dumps(summary))
    if summary["warn"]:
        print(f"WARNING: database egress is on course for {summary['gb_30d_projected']} GB in 30 days; "
              f"the free plan allows {summary['limit_gb']:.0f} GB (REF-0028)", file=sys.stderr)
    if not args.dry_run and os.environ.get("PARITY_WRITER_DB_URL"):
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine" / "src"))
        from parity.publish.supabase import heartbeat
        heartbeat("egress", summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
