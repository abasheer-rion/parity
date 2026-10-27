#!/usr/bin/env python3
"""The kill switch and the log shared by every automated SEO and content job (DEC-0073).

    from automation import enabled, log, caps
    ok, why = enabled("indexnow")
    if not ok:
        log("indexnow", "skipped", why); return 0

    python3 scripts/seo/automation.py check indexnow   # exits 0 when on, 3 when off (for shell steps)
    python3 scripts/seo/automation.py log indexnow sent "12 URLs"

A job is off when content/seo/automation.toml says `all = false` or `<name> = false`, or when
the repository variable SEO_AUTOMATION (passed in the environment) is "off" or names the job.
Each log line is JSON: time, job, action, detail. Lines go to stdout, to the file named by
AUTOMATION_LOG (default automation-log/<job>.jsonl, uploaded as the run's artifact) and, in
GitHub Actions, to the job summary. Standard library only.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "content/seo/automation.toml"


def config(path: Path | None = None) -> dict:
    p = path or CONFIG
    return tomllib.loads(p.read_text()) if p.exists() else {}


def caps(path: Path | None = None) -> dict:
    return config(path).get("caps", {})


def enabled(job: str, path: Path | None = None, env: dict | None = None) -> tuple[bool, str]:
    """(on, reason). The reason says which switch stopped the job."""
    env = os.environ if env is None else env
    var = env.get("SEO_AUTOMATION", "").strip().lower()
    if var in ("off", "false", "0", "stop"):
        return False, "the SEO_AUTOMATION variable is off"
    if job in {v.strip() for v in var.split(",") if v.strip()}:
        return False, f"the SEO_AUTOMATION variable names {job}"
    sw = config(path).get("switches", {})
    if sw.get("all") is False:
        return False, "content/seo/automation.toml has all = false"
    if sw.get(job) is False:
        return False, f"content/seo/automation.toml has {job} = false"
    return True, "on"


def log(job: str, action: str, detail: str = "", **extra) -> dict:
    row = {"time": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "job": job,
           "action": action, "detail": detail, **extra}
    line = json.dumps(row, sort_keys=True)
    print(line)
    path = Path(os.environ.get("AUTOMATION_LOG") or f"automation-log/{job}.jsonl")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a") as f:
            f.write(line + "\n")
    except OSError:
        pass
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"- **{job}**: {action}{f', {detail}' if detail else ''}\n")
    return row


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "check":
        ok, why = enabled(argv[1])
        if not ok:
            log(argv[1], "skipped", why)
        return 0 if ok else 3
    if len(argv) >= 3 and argv[0] == "log":
        log(argv[1], argv[2], " ".join(argv[3:]))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
