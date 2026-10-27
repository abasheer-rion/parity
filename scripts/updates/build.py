#!/usr/bin/env python3
"""Builds the changelog, announcements and status pages into the site build (DEC-0073).

    python3 scripts/updates/build.py --out web/dist

scripts/seo/build_public.py calls build_into(out) during `npm run build` and adds the
addresses it returns to the sitemap. It writes, in the same page shell as the other public pages:

  /changelog/      new features (feat) and fixes (fix, perf) from merged pull requests, read
                   from `git log` of the checked-out history and grouped by week, plus desktop
                   versions from the desktop-v* tags. Titles and pull request numbers only.
  /announcements/  entries from content/updates/announcements/*.md (TOML front matter between
                   +++ lines: title, date, summary, optional link) and one per desktop version.
  /status/         warnings now and a history: manual entries from content/updates/status.toml
                   and the automatic checks written by scripts/updates/status.py.
  /changelog/feed.xml  /announcements/feed.xml  /status/feed.xml     RSS 2.0
  /status.json     the current warnings, small and public, read by the site banner.

A shallow or missing git history does not stop the build: the changelog says so. Standard
library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import subprocess
import sys
import tomllib
from email.utils import format_datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts/seo"))

import build_public as bp  # noqa: E402  the shared page shell, site address and names
import status as st  # noqa: E402  manual status entries and the automatic file

e = html.escape
REPO = os.environ.get("PARITY_REPO_URL", "https://github.com/abasheer-rion/parity").rstrip("/")
ANNOUNCEMENTS = ROOT / "content/updates/announcements"
KINDS = {"feat": "new", "fix": "fix", "perf": "fix"}  # chore, docs, ci, test, data, build and the rest are left out
SUBJECT = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]*)\))?(?P<bang>!)?:\s*(?P<summary>.+?)\s*\(#(?P<pr>\d+)\)\s*$")
TAG = re.compile(r"^desktop-v(?P<version>\d+(?:\.\d+)*(?:[-+][\w.-]+)?)$")
FEED_ITEMS = 40
LEVEL_WORDS = {"info": "Notice", "warning": "Warning", "outage": "Outage"}

CSS = """
.upd-feeds{font-size:14px;color:var(--faint);margin:0 0 28px}
.upd-note{border:1px dashed #e8c06a88;background:#e8c06a10;color:#f3dfae;border-radius:12px;padding:12px 16px;margin:0 0 24px;font-size:15px}
.upd-week{margin:0 0 34px}.upd-week h2{margin:0 0 6px}.upd-week h3{font-size:15px;color:var(--faint);margin:16px 0 6px;font-weight:600}
.upd-list{margin:0;padding-left:20px}.upd-list li{margin:0 0 6px;color:#dfe2ec;overflow-wrap:anywhere}.upd-list a{white-space:nowrap}
.upd-entry{border-top:1px solid var(--line);padding:22px 0}.upd-entry:first-of-type{border-top:0;padding-top:4px}
.upd-entry h2{margin:0 0 4px;font-size:20px;overflow-wrap:anywhere}.upd-entry time,.upd-when{font-size:14px;color:var(--faint)}
.upd-entry p{margin:8px 0 0}
.lvl{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;border:1px solid;margin-right:8px;vertical-align:2px}
.lvl-info{color:var(--blue-text);border-color:#85a8ff66}.lvl-warning{color:var(--warn);border-color:#e8c06a77}.lvl-outage{color:#ff9d9d;border-color:#f07a7a88;background:#f07a7a14}
.upd-ok{color:var(--good)}
"""

SHALLOW_NOTE = "This page was built from a partial copy of the project history, so older changes may be missing."
MISSING_NOTE = "The project history was not available when this page was built, so the list of changes is empty."


class UpdatesError(ValueError):
    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


# ---------------------------------------------------------------- git

def git(args: list[str], root: Path = ROOT) -> str | None:
    try:
        r = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 else None


def read_history(root: Path = ROOT) -> tuple[str, str, str]:
    """(log text, tag text, note). The note is empty unless the history is shallow or missing."""
    log = git(["log", "--first-parent", "--format=%H%x1f%cs%x1f%s", "HEAD"], root)
    if log is None:
        return "", "", MISSING_NOTE
    tags = git(["for-each-ref", "--format=%(refname:short)%1f%(creatordate:short)", "refs/tags/desktop-v*"], root) or ""
    shallow = (git(["rev-parse", "--is-shallow-repository"], root) or "").strip() == "true"
    return log, tags, SHALLOW_NOTE if shallow else ""


def parse_log(text: str) -> list[dict]:
    """Merged pull requests worth listing, newest first, from `git log --format=%H%x1f%cs%x1f%s`."""
    out, seen = [], set()
    for line in text.splitlines():
        parts = line.split("\x1f")
        if len(parts) != 3:
            continue
        sha, day, subject = parts
        m = SUBJECT.match(subject.strip())
        if not m or m["type"] not in KINDS or m["pr"] in seen:
            continue
        try:
            date = dt.date.fromisoformat(day)
        except ValueError:
            continue
        seen.add(m["pr"])
        summary = m["summary"].strip()
        out.append({"sha": sha, "date": date, "type": m["type"], "kind": KINDS[m["type"]],
                    "summary": summary[:1].upper() + summary[1:], "pr": int(m["pr"]), "url": f"{REPO}/pull/{m['pr']}"})
    out.sort(key=lambda c: (c["date"], c["pr"]), reverse=True)
    return out


def parse_tags(text: str) -> list[dict]:
    """Desktop versions, newest first, from `git for-each-ref --format=%(refname:short)%1f%(creatordate:short)`."""
    out = []
    for line in text.splitlines():
        parts = line.split("\x1f")
        if len(parts) != 2:
            continue
        m = TAG.match(parts[0].strip())
        try:
            date = dt.date.fromisoformat(parts[1].strip()[:10])
        except ValueError:
            continue
        if m:
            out.append({"tag": parts[0].strip(), "version": m["version"], "date": date,
                        "url": f"{REPO}/releases/tag/{parts[0].strip()}"})

    def key(r: dict):
        return (r["date"], [int(x) if x.isdigit() else 0 for x in re.split(r"[.+-]", r["version"])])
    out.sort(key=key, reverse=True)
    return out


def monday(d: dt.date) -> dt.date:
    return d - dt.timedelta(days=d.weekday())


def fmt_date(d: dt.date) -> str:
    return f"{d.day} {d.strftime('%B %Y')}"


def rfc822(d: dt.date | dt.datetime) -> str:
    t = d if isinstance(d, dt.datetime) else dt.datetime.combine(d, dt.time(12), dt.timezone.utc)
    return format_datetime(t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc))


# ---------------------------------------------------------------- shell and feeds

def shell(path: str, title: str, description: str, body: str, trail: list[tuple[str, str]], ld: list[dict], feed: str) -> str:
    """The public page shell from build_public, with this section's styles and its feed in <head>."""
    page = bp.page(path=path, title=title, description=description, body=body, section="updates", trail=trail,
                   ld=ld, og_type="website")
    alt = f'<link rel="alternate" type="application/rss+xml" title="Parity {e(trail[-1][0])} (RSS)" href="{feed}">'
    page = page.replace("/og/updates.png", "/og/default.png")  # no share card of its own yet
    return page.replace("</style>", CSS.strip() + "</style>\n" + alt, 1)


def rss(*, path: str, title: str, description: str, items: list[dict], fallback: dt.date) -> str:
    """RSS 2.0. Each item: title, link, guid, date, description."""
    last = max((i["date"] for i in items), default=fallback)
    rows = "".join(
        f'<item><title>{e(i["title"])}</title><link>{e(i["link"])}</link>'
        f'<guid isPermaLink="{"true" if i.get("permalink", True) else "false"}">{e(i["guid"])}</guid>'
        f'<pubDate>{rfc822(i["date"])}</pubDate><description>{e(i["description"])}</description></item>\n' for i in items)
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n'
            f"<title>{e(title)}</title><link>{bp.SITE}{path}</link><description>{e(description)}</description>"
            f"<language>en</language><lastBuildDate>{rfc822(last)}</lastBuildDate>"
            f'<atom:link href="{bp.SITE}{path}feed.xml" rel="self" type="application/rss+xml"/>\n{rows}</channel></rss>\n')


def feeds_line(path: str, what: str) -> str:
    return f'<p class="upd-feeds">Follow {what} with <a href="{path}feed.xml">RSS</a>.</p>'


def page_ld(path: str, name: str, description: str) -> dict:
    return {"@type": "CollectionPage", "@id": f"{bp.SITE}{path}#page", "name": name, "url": f"{bp.SITE}{path}",
            "description": description, "isPartOf": {"@id": f"{bp.SITE}/#site"}, "publisher": {"@id": f"{bp.SITE}/#org"}}


# ---------------------------------------------------------------- changelog

CHANGELOG_DESC = ("What changed in Parity each week: new features, fixes and speed-ups from every merged change, "
                  "and each new version of the desktop app.")


def build_changelog(changes: list[dict], releases: list[dict], note: str, today: dt.date) -> dict[str, str]:
    path = "/changelog/"
    weeks: dict[dt.date, dict[str, list]] = {}
    for c in changes:
        weeks.setdefault(monday(c["date"]), {"new": [], "fix": [], "desktop": []})[c["kind"]].append(c)
    for r in releases:
        weeks.setdefault(monday(r["date"]), {"new": [], "fix": [], "desktop": []})["desktop"].append(r)
    blocks = []
    for wk in sorted(weeks, reverse=True):
        g = weeks[wk]
        parts = [f'<section class="upd-week" aria-labelledby="w-{wk.isoformat()}"><h2 id="w-{wk.isoformat()}">Week of {fmt_date(wk)}</h2>']
        for key, label in (("new", "New features"), ("fix", "Fixes and speed-ups")):
            if g[key]:
                items = "".join(f'<li>{e(c["summary"])} <a href="{e(c["url"])}" rel="noopener">#{c["pr"]}</a></li>' for c in g[key])
                parts.append(f'<h3>{label}</h3><ul class="upd-list">{items}</ul>')
        if g["desktop"]:
            items = "".join(f'<li>Desktop app {e(r["version"])}, {fmt_date(r["date"])} <a href="{e(r["url"])}" rel="noopener">release notes</a></li>'
                            for r in g["desktop"])
            parts.append(f'<h3>Desktop app</h3><ul class="upd-list">{items}</ul>')
        blocks.append("".join(parts) + "</section>")
    note_html = f'<p class="upd-note">{e(note)}</p>' if note else ""
    empty = "" if blocks else "<p>No changes to show yet.</p>"
    body = (f'<h1>Changelog</h1><p class="lede">New features, fixes and speed-ups in Parity, week by week. Each line links to '
            f'the change itself on GitHub.</p>{feeds_line(path, "the changelog")}{note_html}{"".join(blocks)}{empty}'
            f'<p class="upd-feeds">See also <a href="/announcements/">announcements</a> and <a href="/status/">status</a>.</p>')
    html_page = shell(path, "Changelog: new features and fixes each week", CHANGELOG_DESC, body,
                      [("Home", "/"), ("Changelog", path)], [page_ld(path, "Parity changelog", CHANGELOG_DESC)], f"{path}feed.xml")
    items = [{"title": f'{"New" if c["kind"] == "new" else "Fix"}: {c["summary"]}', "link": c["url"], "guid": c["url"],
              "date": c["date"], "description": f'{c["summary"]} (pull request #{c["pr"]}).'} for c in changes]
    items += [{"title": f'Desktop app {r["version"]}', "link": r["url"], "guid": r["url"], "date": r["date"],
               "description": f'Version {r["version"]} of the Parity desktop app.'} for r in releases]
    items.sort(key=lambda i: i["date"], reverse=True)
    feed = rss(path=path, title="Parity changelog", description=CHANGELOG_DESC, items=items[:FEED_ITEMS], fallback=today)
    return {path: html_page, f"{path}feed.xml": feed}


# ---------------------------------------------------------------- announcements

ANNOUNCE_DESC = ("News from the Parity team about the site and the apps: new pages, new desktop versions and "
                 "changes worth knowing about, newest first.")


def load_announcements(folder: Path | None = None) -> list[dict]:
    base = folder or ANNOUNCEMENTS
    out, problems = [], []
    for f in sorted(base.glob("*.md")) if base.exists() else []:
        m = re.match(r"^\+\+\+\n(.*?)\n\+\+\+\n?", f.read_text(), re.S)
        if not m:
            problems.append(f"{f.name}: no front matter between +++ lines")
            continue
        try:
            meta = tomllib.loads(m.group(1))
        except tomllib.TOMLDecodeError as err:
            problems.append(f"{f.name}: {err}")
            continue
        missing = [k for k in ("title", "date", "summary") if not meta.get(k)]
        if missing:
            problems.append(f"{f.name}: missing {', '.join(missing)}")
            continue
        date = meta["date"]
        if isinstance(date, dt.datetime):
            date = date.date()
        if not isinstance(date, dt.date):
            try:
                date = dt.date.fromisoformat(str(date))
            except ValueError:
                problems.append(f"{f.name}: date must be a date such as 2026-10-26")
                continue
        out.append({"slug": f.stem, "title": str(meta["title"]), "date": date, "summary": str(meta["summary"]),
                    "link": str(meta.get("link", "")), "body": f.read_text()[m.end():].strip()})
    if problems:
        raise UpdatesError(problems)
    return out


def release_announcements(releases: list[dict]) -> list[dict]:
    return [{"slug": r["tag"], "title": f'Parity desktop {r["version"]} is out', "date": r["date"],
             "summary": f'Version {r["version"]} of the Parity desktop app is available. Installed copies offer the update on their own.',
             "link": r["url"], "body": ""} for r in releases]


def build_announcements(entries: list[dict], today: dt.date) -> dict[str, str]:
    path = "/announcements/"
    entries = sorted(entries, key=lambda a: (a["date"], a["slug"]), reverse=True)
    arts = []
    for a in entries:
        more = f'<p><a href="{e(a["link"])}">Read more</a></p>' if a["link"] else ""
        body = bp.markdown(a["body"], {}, {}) if a["body"] else ""
        arts.append(f'<article class="upd-entry" id="{e(a["slug"])}"><h2>{e(a["title"])}</h2>'
                    f'<time datetime="{a["date"].isoformat()}">{fmt_date(a["date"])}</time><p>{e(a["summary"])}</p>{body}{more}</article>')
    body = (f'<h1>Announcements</h1><p class="lede">News about Parity itself: new pages, new desktop versions and changes '
            f'worth knowing about.</p>{feeds_line(path, "announcements")}{"".join(arts) or "<p>No announcements yet.</p>"}'
            f'<p class="upd-feeds">Every change is in the <a href="/changelog/">changelog</a>. Problems show on the <a href="/status/">status page</a>.</p>')
    html_page = shell(path, "Announcements from the Parity team", ANNOUNCE_DESC, body, [("Home", "/"), ("Announcements", path)],
                      [page_ld(path, "Parity announcements", ANNOUNCE_DESC)], f"{path}feed.xml")

    def link(a: dict) -> str:
        return f"{bp.SITE}{path}#{a['slug']}"
    items = [{"title": a["title"], "link": a["link"] if a["link"].startswith("http") else link(a), "guid": link(a),
              "date": a["date"], "description": a["summary"]} for a in entries]
    feed = rss(path=path, title="Parity announcements", description=ANNOUNCE_DESC, items=items[:FEED_ITEMS], fallback=today)
    return {path: html_page, f"{path}feed.xml": feed}


# ---------------------------------------------------------------- status

STATUS_DESC = ("Whether Parity is working right now: live prices, the strategy search, the simulations and the data "
               "series, with a history of past problems.")


def load_auto(path: Path | None = None) -> dict | None:
    p = path or Path(os.environ.get("UPDATES_STATUS_JSON") or st.DEFAULT_OUT)
    try:
        doc = json.loads(p.read_text())
    except (OSError, ValueError):
        return None
    return doc if isinstance(doc, dict) else None


def current_warnings(auto: dict | None, manual: list[dict], now: dt.datetime) -> list[dict]:
    """Automatic warnings from status.py plus the manual entries active at build time."""
    warns = [w for w in (auto or {}).get("warnings", []) if w.get("source") != "manual" and w.get("level") in st.LEVELS]
    seen = {w["id"] for w in warns}
    warns += [m for m in manual if st.is_active(m, now) and m["id"] not in seen]
    order = {lvl: i for i, lvl in enumerate(reversed(st.LEVELS))}
    return sorted(warns, key=lambda w: (order.get(w["level"], 9), w["id"]))


def when(v: str) -> str:
    t = st.parse_time(v)
    return f"{fmt_date(t.date())}, {t.strftime('%H:%M')} UTC" if t else ""


def safe_link(href: str) -> str:
    return href if href.startswith(("/", "https://")) else ""


def warning_html(w: dict, tag: str = "h3") -> str:
    lvl = w["level"]
    link = safe_link(w.get("link", ""))
    more = f' <a href="{e(link)}">More</a>' if link and link != "/status/" else ""
    span = f'From {when(w["start"])}' + (f' to {when(w["end"])}' if w.get("end") else "")
    return (f'<article class="upd-entry" id="s-{e(w["id"])}"><{tag}><span class="lvl lvl-{lvl}">{LEVEL_WORDS[lvl]}</span>{e(w["title"])}</{tag}>'
            f'<p class="upd-when">{span}</p><p>{e(w["detail"])}{more}</p></article>')


def build_status(auto: dict | None, manual: list[dict], now: dt.datetime) -> tuple[dict[str, str], dict]:
    path = "/status/"
    warns = current_warnings(auto, manual, now)
    past = sorted((m for m in manual if not st.is_active(m, now)), key=lambda m: m["start"], reverse=True)
    checked = when(auto["generated"]) if auto and auto.get("generated") else ""
    if warns:
        now_html = "".join(warning_html(w) for w in warns)
    else:
        now_html = '<p class="upd-ok">Everything is working. There are no warnings right now.</p>'
    check_line = (f"Last automatic check: {checked}." if checked else
                  "The automatic checks did not run for this version of the page.")
    body = (f'<h1>Status</h1><p class="lede">Whether Parity is working right now. Every 30 minutes we check the live price '
            f'feed, the strategy search, the simulations and the data series.</p>{feeds_line(path, "status changes")}'
            f'<h2>Right now</h2><p class="upd-when">{e(check_line)}</p>{now_html}'
            f'<h2>History</h2>{"".join(warning_html(m, "h3") for m in past) or "<p>No past problems are recorded.</p>"}'
            f'<p class="upd-feeds">Automatic warnings show here while they last. Written entries stay in the history.</p>')
    html_page = shell(path, "Status: is Parity working right now?", STATUS_DESC, body, [("Home", "/"), ("Status", path)],
                      [page_ld(path, "Parity status", STATUS_DESC)], f"{path}feed.xml")
    items = [{"title": f'{LEVEL_WORDS[w["level"]]}: {w["title"]}', "link": f"{bp.SITE}{path}#s-{w['id']}",
              "guid": f'{w["id"]}@{w["start"]}', "permalink": False, "date": st.parse_time(w["start"]) or now,
              "description": w["detail"]} for w in {x["id"]: x for x in [*warns, *past]}.values()]
    items.sort(key=lambda i: i["date"], reverse=True)
    feed = rss(path=path, title="Parity status", description=STATUS_DESC, items=items[:FEED_ITEMS], fallback=now)
    public = st.public_doc({"generated": st.iso(now), "warnings": warns})
    return {path: html_page, f"{path}feed.xml": feed}, public


# ---------------------------------------------------------------- run

def build_into(out: Path, *, now: dt.datetime | None = None, history: tuple[str, str, str] | None = None,
               announcements: Path | None = None, manual: Path | None = None, auto: Path | None = None) -> list[tuple[str, str]]:
    """Writes the three pages, their feeds and /status.json into `out`. Returns (path, lastmod) for the sitemap."""
    now = now or st.now_utc()
    log, tags, note = history if history is not None else read_history()
    changes, releases = parse_log(log), parse_tags(tags)
    files: dict[str, str] = {}
    files.update(build_changelog(changes, releases, note, now.date()))
    entries = load_announcements(announcements) + release_announcements(releases)
    files.update(build_announcements(entries, now.date()))
    try:
        manual_entries = st.load_manual(manual)
    except (ValueError, tomllib.TOMLDecodeError) as err:
        raise UpdatesError([f"content/updates/status.toml: {err}"]) from err
    status_files, public = build_status(load_auto(auto), manual_entries, now)
    files.update(status_files)
    for path, text in files.items():
        dest = out / path.strip("/") / "index.html" if path.endswith("/") else out / path.lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text)
    (out / "status.json").write_text(json.dumps(public, separators=(",", ":")))
    newest_change = max([c["date"] for c in changes] + [r["date"] for r in releases], default=None)
    newest_entry = max((a["date"] for a in entries), default=None)
    print(f"updates: {len(changes)} changes, {len(releases)} desktop versions, {len(entries)} announcements, "
          f"{len(public['warnings'])} warnings{' (' + note + ')' if note else ''}")
    return [("/changelog/", newest_change.isoformat() if newest_change else ""),
            ("/announcements/", newest_entry.isoformat() if newest_entry else ""),
            ("/status/", "")]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "web/dist"))
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        build_into(out)
    except UpdatesError as err:
        print("updates: the build stopped. Fix these and run it again:", file=sys.stderr)
        for p in err.problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
