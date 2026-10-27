"""Shared pieces for the automatic posts (DEC-0073): paths, the draft object, front matter
writing, plain number formatting and the house text rules."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for _p in (ROOT / "scripts/newsroom", ROOT / "scripts/seo"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import automation  # noqa: E402  (scripts/seo/automation.py: switches, caps, log)
import model  # noqa: E402  (scripts/newsroom/model.py: the post rules)

CONTENT = model.CONTENT
JOBS = ("market_week", "news_commentary", "press_release")
DEFAULT_REPO = "abasheer-rion/parity"

MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December")

# Typography the newsroom refuses (REF-0017 rule 10), with what to put instead.
REPLACE = {"\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
           "\u2026": "...", "\u00a0": " "}


def clean(text: str) -> str:
    """Text with the banned characters replaced by plain ones."""
    for bad, good in REPLACE.items():
        text = text.replace(bad, good)
    return text


def site_origin() -> str:
    """The site's address, from web/src/lib/site.json (never hardcoded)."""
    return json.loads((ROOT / "web/src/lib/site.json").read_text())["origin"].rstrip("/")


def repo_slug() -> str:
    """owner/name of the GitHub repository, for pull request links."""
    env = os.environ.get("GITHUB_REPOSITORY")
    if env:
        return env
    try:
        url = subprocess.run(["git", "remote", "get-url", "origin"], cwd=ROOT, capture_output=True,
                             text=True, check=True).stdout.strip()
        m = re.search(r"github\.com[:/]([^/]+/[^/.]+)", url)
        if m:
            return m.group(1)
    except (OSError, subprocess.SubprocessError):
        pass
    return DEFAULT_REPO


def long_date(d: dt.date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def iso_week(d: dt.date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def fingerprint(obj) -> str:
    return hashlib.sha1(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()[:16]


def num(v: float, digits: int) -> str:
    """A number with a fixed count of decimals and thousands separators, no sign."""
    return f"{abs(v):,.{digits}f}"


def signed(v: float, digits: int) -> str:
    s = f"{abs(v):,.{digits}f}"
    if float(s.replace(",", "")) == 0:
        return s
    return ("+" if v > 0 else "-") + s


# ---------------------------------------------------------------- the draft

@dataclass
class Draft:
    """One proposed post, with what the checks need to verify it."""
    job: str
    meta: dict
    body: str
    files: dict[str, str] = field(default_factory=dict)  # path under content/newsroom/ -> text
    truth: list[float] = field(default_factory=list)  # every number the data allows in the text
    strip: list[str] = field(default_factory=list)  # quoted text whose digits are not ours (titles)
    urls: set[str] = field(default_factory=set)  # the only outside links the text may carry
    drafted_by: str = ""  # the model, when a language model wrote the body

    @property
    def slug(self) -> str:
        return self.meta["slug"]

    @property
    def filename(self) -> str:
        return f"{self.meta['date'].isoformat()}-{self.slug}.md"

    def text(self) -> str:
        return f"+++\n{dump_front_matter(self.meta)}+++\n\n{self.body.strip()}\n"


# ---------------------------------------------------------------- TOML front matter

def _value(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, dt.date):
        return v.isoformat()
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(_value(x) for x in v) + "]"
    # A TOML basic string. JSON escaping is a subset of TOML's for these characters.
    return json.dumps(str(v), ensure_ascii=False)


def dump_front_matter(meta: dict) -> str:
    """meta as TOML: plain keys first, then [tables], then [[arrays of tables]]."""
    plain, tables, arrays = [], [], []
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, dict):
            tables.append((k, v))
        elif isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
            arrays.append((k, v))
        else:
            plain.append(f"{k} = {_value(v)}")
    out = plain[:]
    for k, t in tables:
        out += ["", f"[{k}]"] + [f"{kk} = {_value(vv)}" for kk, vv in t.items() if vv is not None]
    for k, rows in arrays:
        for r in rows:
            out += ["", f"[[{k}]]"] + [f"{kk} = {_value(vv)}" for kk, vv in r.items() if vv is not None]
    return "\n".join(out) + "\n"


AUTO_NOTE = ("> [!note] Written automatically from Parity's own data and checked by machine before "
             "publishing: every number is compared with the data it came from. Corrections are logged "
             "on the post.")
