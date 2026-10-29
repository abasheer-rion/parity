"""Press releases from merged release notes (DEC-0073).

Reads squash-merge titles on main (`feat(scope): summary (#N)`) since the last automatic press
release, or the last seven days, and new desktop-v* tags, and writes one weekly release that
lists what shipped in plain words, each item linked to its pull request. Fixes, docs and chores
are left out; they are on /changelog/. Skips when nothing user-facing shipped.
"""
from __future__ import annotations

import datetime as dt
import re
import subprocess

from .common import AUTO_NOTE, ROOT, Draft, clean, fingerprint, long_date, repo_slug

TITLE_RE = re.compile(r"^(?P<type>feat)(?:\((?P<scope>[^)]+)\))?!?:\s*(?P<summary>.+?)\s*\(#(?P<pr>\d+)\)\s*$")


def git_log(since: dt.date, ref: str = "origin/main") -> list[tuple[str, str]]:
    """(date, subject) for commits on ref since a date. Empty when git is not available."""
    for r in (ref, "HEAD"):
        try:
            out = subprocess.run(["git", "log", r, f"--since={since.isoformat()}", "--format=%cs%x09%s"],
                                 cwd=ROOT, capture_output=True, text=True, check=True).stdout
            return [tuple(line.split("\t", 1)) for line in out.splitlines() if "\t" in line]  # type: ignore[misc]
        except (OSError, subprocess.CalledProcessError):
            continue
    return []


def desktop_tags(since: dt.date) -> list[tuple[str, str]]:
    try:
        out = subprocess.run(["git", "for-each-ref", "refs/tags/desktop-v*", "--format=%(creatordate:short)%09%(refname:short)"],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return []
    rows = [tuple(line.split("\t", 1)) for line in out.splitlines() if "\t" in line]
    return [(d, t) for d, t in rows if d >= since.isoformat()]  # type: ignore[misc]


def features(log: list[tuple[str, str]]) -> list[dict]:
    out = []
    for date, subject in log:
        m = TITLE_RE.match(subject.strip())
        if m:
            summary = clean(m["summary"]).rstrip(".")
            out.append({"date": date, "scope": m["scope"] or "", "summary": summary[0].upper() + summary[1:], "pr": int(m["pr"])})
    return out


def build(log: list[tuple[str, str]], tags: list[tuple[str, str]], today: dt.date, since: dt.date) -> Draft | None:
    feats = features(log)
    if not feats and not tags:
        return None
    repo = repo_slug()
    urls, sources, truth = set(), [], []
    lines = [f"Parity Trading, Inc. today lists what it shipped between {long_date(since)} and {long_date(today)}: "
             f"{len(feats)} new features merged into the public repository"
             + (f" and {len(tags)} desktop release" + ("s" if len(tags) != 1 else "") if tags else "") + ".", ""]
    truth += [float(len(feats)), float(len(tags))]
    if tags:
        lines += ["## Desktop app", ""]
        for d, t in tags:
            version = t.removeprefix("desktop-v")
            url = f"https://github.com/{repo}/releases/tag/{t}"
            urls.add(url)
            sid = f"rel-{len(sources) + 1}"
            sources.append({"id": sid, "title": f"Parity desktop {version}", "url": url, "publisher": "GitHub"})
            lines.append(f"- Parity desktop [{version}]({url}), released {d}.[^{sid}]")
        lines.append("")
    if feats:
        lines += ["## What is new", ""]
        by_scope: dict[str, list[dict]] = {}
        for f in feats:
            by_scope.setdefault(f["scope"] or "general", []).append(f)
        for scope in sorted(by_scope):
            for f in by_scope[scope]:
                url = f"https://github.com/{repo}/pull/{f['pr']}"
                urls.add(url)
                sid = f"pr{f['pr']}"
                sources.append({"id": sid, "title": f["summary"], "url": url, "publisher": "GitHub"})
                lines.append(f"- {f['summary']} ([#{f['pr']}]({url}), {f['date']}).[^{sid}]")
        lines.append("")
    lines += ["## About Parity", "",
              "Parity is a research project that tests trading ideas in public and publishes the failures as well as "
              "the results. Every change is made in the open, in pull requests anyone can read.", "",
              "The full list, with fixes and smaller changes, is on the [changelog](/changelog/). "
              "Questions go to the address on the [contact page](/legal/).", "", AUTO_NOTE]
    meta = {
        "title": f"What Parity shipped in the week to {long_date(today)}",
        "dek": f"{len(feats)} new features" + (f" and {len(tags)} desktop release" + ("s" if len(tags) != 1 else "") if tags else "")
        + ", each linked to the change that made it.",
        "slug": f"parity-shipped-week-to-{today.isoformat()}", "date": today, "type": "Press release",
        "stance": "Fact-based reporting", "status": "published", "authors": ["parity-editorial"],
        "tags": ["company", "releases"], "auto": "press_release",
        "auto_data": fingerprint([f["pr"] for f in feats] + [t for _, t in tags]), "sources": sources,
    }
    strip = [f["summary"] for f in feats]
    return Draft(job="press_release", meta=meta, body="\n".join(lines), truth=truth, urls=urls, strip=strip)
