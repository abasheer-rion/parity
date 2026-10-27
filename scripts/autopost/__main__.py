"""Run the automatic newsroom jobs (DEC-0073).

    python3 -m scripts.autopost run --jobs market_week,news_commentary,press_release --data <dir> [--dry-run] [--date YYYY-MM-DD]

<dir> holds the exports (<dir>/terminal/index.json, <dir>/news/impact.json). For each job:
check its switch, build the post from data, run every check (caps, duplicates, length, facts,
the newsroom rules), then write it to content/newsroom/posts/ (published) or, for a model draft
that failed a check, content/newsroom/drafts/ (status review). Every outcome is logged.
Exits 0 unless a check itself crashed, so a quiet week never fails the job.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

from . import checks, llm, market_week, news_commentary, press_release
from .common import CONTENT, JOBS, Draft, automation


def build(job: str, data: Path, today: dt.date) -> tuple[Draft | None, str]:
    if job == "market_week":
        index = market_week.load(data)
        if index is None:
            return None, f"no terminal export at {data}/terminal/index.json"
        return market_week.build(index, today), "fewer than 6 markets with a week of data"
    if job == "news_commentary":
        impact = news_commentary.load(data)
        if impact is None:
            return None, f"no impact data at {data}/news/impact.json"
        return news_commentary.build(impact, today), "no day in the last week moved more than twice its usual day"
    if job == "press_release":
        last = [d for j, d, _ in checks.auto_posts() if j == "press_release"]
        since = max(last) + dt.timedelta(days=1) if last else today - dt.timedelta(days=7)
        return press_release.build(press_release.git_log(since), press_release.desktop_tags(since), today, since), \
            "nothing user-facing shipped since the last press release"
    raise ValueError(job)


def write(d: Draft, content: Path) -> Path:
    for rel, text in d.files.items():
        f = content / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text)
    folder = "posts" if d.meta.get("status") == "published" else "drafts"
    out = content / folder / d.filename
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(d.text())
    return out


def run_job(job: str, data: Path, today: dt.date, dry: bool, content: Path = CONTENT) -> str:
    ok, why = automation.enabled(job)
    if not ok:
        automation.log(job, "skipped", why)
        return "skipped"
    d, empty = build(job, data, today)
    if d is None:
        automation.log(job, "nothing to post", empty)
        return "empty"
    if job == "news_commentary" and llm.available():
        template = d.body
        try:
            d.body, d.drafted_by = llm.redraft(template)
            d.meta["drafted_by"] = d.drafted_by
        except Exception as err:  # noqa: BLE001  the template stands
            d.body = template
            automation.log(job, "model redraft failed, template kept", type(err).__name__)
    probs = checks.all_checks(d, today, content)
    if probs and d.drafted_by:
        d.meta["status"] = "review"
        automation.log(job, "model draft failed the checks, saved for review", "; ".join(probs)[:500])
        if not dry:
            write(d, content)
        return "review"
    if probs:
        automation.log(job, "not published", "; ".join(probs)[:500])
        return "blocked"
    if dry:
        automation.log(job, "would publish", d.slug)
        return "dry"
    path = write(d, content)
    automation.log(job, "published", d.slug, file=str(path.relative_to(content.parent.parent)))
    return "published"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python3 -m scripts.autopost")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--jobs", default=",".join(JOBS))
    r.add_argument("--data", default="site-data")
    r.add_argument("--date", help="run as if today were this date (YYYY-MM-DD)")
    r.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    today = dt.date.fromisoformat(args.date) if args.date else dt.date.today()
    for job in [j.strip() for j in args.jobs.split(",") if j.strip()]:
        if job not in JOBS:
            print(f"unknown job {job!r}; jobs: {', '.join(JOBS)}", file=sys.stderr)
            return 2
        run_job(job, Path(args.data), today, args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
