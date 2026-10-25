"""The newsroom content model: loading posts and authors, and the rules every post must pass.

Posts are Markdown files with TOML front matter between two `+++` lines, under
content/newsroom/posts/ (ready or published) and content/newsroom/drafts/ (work in progress).
Authors are in content/newsroom/authors.toml. See GDE-0006 for how to write one and DEC-0053
for why the rules are what they are. Standard library only (tomllib needs Python 3.11+).
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
CONTENT = ROOT / "content/newsroom"

# ---------------------------------------------------------------- the fixed lists

BLOG_TYPES = ("Research", "Analysis", "Opinion", "Explainer")
NEWS_TYPES = ("News", "Company update", "Press release")
TYPES = BLOG_TYPES + NEWS_TYPES
STANCES = ("Fact-based reporting", "Analysis", "Opinion")
STATUSES = ("draft", "review", "published")

# Which stance labels each type may carry. Opinion is only ever labelled Opinion, and nothing
# else may be labelled Opinion, so a view can never be presented as reporting or the reverse.
ALLOWED_STANCES = {
    "Research": ("Fact-based reporting", "Analysis"),
    "Analysis": ("Analysis",),
    "Opinion": ("Opinion",),
    "Explainer": ("Fact-based reporting", "Analysis"),
    "News": ("Fact-based reporting",),
    "Company update": ("Fact-based reporting",),
    "Press release": ("Fact-based reporting",),
}
NEEDS_SOURCES = ("Research", "Analysis", "News")

STANCE_NOTES = {
    "Fact-based reporting": "Reports what happened or what we found. Every claim is sourced or comes from our own data.",
    "Analysis": "Interprets sourced facts and data. The reasoning is shown and the sources are listed below.",
    "Opinion": "The writer's view, argued from the sources below. It is not a Parity research finding.",
}

DISCLOSURE = "Research and education only. Not investment advice."

# Image licences we accept. Stock is only from sites whose licence allows free commercial reuse.
LICENCES = {
    "Unsplash License": ("unsplash.com",),
    "Pexels License": ("pexels.com",),
    "CC0 1.0": None,
    "CC BY 4.0": None,
    "Public domain": None,
    "Parity own work": (),
}
HERO_KINDS = ("chart", "stock", "own")

# Paths under /blog/ and /news/ that are not posts.
RESERVED_SLUGS = {"page", "category", "feed", "feed.xml", "atom.xml", "index.json", "authors", "tags", "drafts"}

BANNED_CHARS = {"\u2014": "em dash", "\u2013": "en dash", "\u2018": "curly quote", "\u2019": "curly quote",
                "\u201c": "curly quote", "\u201d": "curly quote", "\u2026": "ellipsis character"}

SLUG_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,79}")
TAG_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")
CITE_RE = re.compile(r"\[\^([A-Za-z0-9_:-]+)\]")
IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)")


class ValidationError(Exception):
    def __init__(self, problems: list[str]):
        super().__init__("\n".join(problems))
        self.problems = problems


@dataclass
class Author:
    id: str
    name: str
    kind: str  # "team" (a real person on the team) or "house" (a desk byline)
    about: str = ""
    bio: str = ""
    photo: str = ""


@dataclass
class Post:
    file: Path
    meta: dict
    body: str
    problems: list[str] = field(default_factory=list)

    # Convenience accessors. Validation guarantees these for review and published posts.
    @property
    def slug(self) -> str: return self.meta.get("slug", "")
    @property
    def title(self) -> str: return self.meta.get("title", "")
    @property
    def dek(self) -> str: return self.meta.get("dek", "")
    @property
    def type(self) -> str: return self.meta.get("type", "")
    @property
    def stance(self) -> str: return self.meta.get("stance", "")
    @property
    def status(self) -> str: return self.meta.get("status", "")
    @property
    def sample(self) -> bool: return bool(self.meta.get("sample"))
    @property
    def date(self) -> dt.date: return self.meta.get("date")
    @property
    def updated(self) -> dt.date | None: return self.meta.get("updated")
    @property
    def section(self) -> str: return "news" if self.type in NEWS_TYPES else "blog"
    @property
    def path(self) -> str: return f"/{self.section}/{self.slug}/"
    @property
    def authors(self) -> list[str]: return list(self.meta.get("authors") or [])
    @property
    def tags(self) -> list[str]: return list(self.meta.get("tags") or [])
    @property
    def markets(self) -> list[str]: return list(self.meta.get("markets") or [])
    @property
    def sources(self) -> list[dict]: return list(self.meta.get("sources") or [])
    @property
    def corrections(self) -> list[dict]: return list(self.meta.get("corrections") or [])
    @property
    def images(self) -> list[dict]: return list(self.meta.get("images") or [])
    @property
    def hero(self) -> dict | None: return self.meta.get("hero")
    @property
    def disclosure(self) -> str: return self.meta.get("disclosure") or DISCLOSURE

    def words(self) -> int:
        text = re.sub(r"```.*?```", " ", self.body, flags=re.S)
        return len(re.findall(r"[A-Za-z0-9']+", text))

    def read_minutes(self) -> int:
        return max(1, round(self.words() / 230))


# ---------------------------------------------------------------- loading

def split_front_matter(text: str) -> tuple[str, str]:
    m = re.match(r"^\+\+\+\n(.*?)\n\+\+\+\n?", text, re.S)
    if not m:
        raise ValueError("no front matter: the file must start with a +++ line, TOML fields, and another +++ line")
    return m.group(1), text[m.end():]


def load_authors(path: Path | None = None) -> dict[str, Author]:
    raw = tomllib.loads((path or CONTENT / "authors.toml").read_text())
    out = {}
    for key, a in raw.items():
        out[key] = Author(id=key, name=a.get("name", ""), kind=a.get("kind", ""), about=a.get("about", ""),
                          bio=a.get("bio", ""), photo=a.get("photo", ""))
        out[key].supplied = bool(a.get("supplied_by_author"))  # type: ignore[attr-defined]
    return out


def load_post(path: Path) -> Post:
    text = path.read_text()
    try:
        fm, body = split_front_matter(text)
        meta = tomllib.loads(fm)
    except (ValueError, tomllib.TOMLDecodeError) as err:
        return Post(file=path, meta={}, body="", problems=[f"{rel(path)}: {err}"])
    return Post(file=path, meta=meta, body=body)


def load_posts(content: Path | None = None) -> list[Post]:
    base = content or CONTENT
    files = sorted((base / "posts").glob("*.md")) + sorted((base / "drafts").glob("*.md"))
    return [load_post(p) for p in files]


def load_references() -> dict[str, dict]:
    refs = json.loads((ROOT / "docs/_system/references.json").read_text())["references"]
    return {r["key"]: r for r in refs}


def resolve_source(src: dict, refs: dict[str, dict]) -> dict:
    """A source as written, filled in from docs/_system/references.json when it names a `ref`."""
    out = dict(src)
    r = refs.get(src.get("ref", "")) if src.get("ref") else None
    if r:
        out.setdefault("title", r.get("title") or "")
        out.setdefault("url", r.get("url") or (f"https://doi.org/{r['doi']}" if r.get("doi") else ""))
        out.setdefault("publisher", r.get("venue") or "")
        out.setdefault("year", r.get("year"))
        names = [a.split(",")[0].strip() for a in (r.get("authors") or [])]
        if names:
            out.setdefault("authors", names[0] if len(names) == 1 else
                           (" and ".join(names) if len(names) == 2 else f"{names[0]} and others"))
        out.setdefault("id", src["ref"])
    return out


def rel(p: Path) -> str:
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


# ---------------------------------------------------------------- the rules

def _check_image(where: str, img: dict, need_src: bool, content: Path) -> list[str]:
    probs = []
    if not str(img.get("alt", "")).strip():
        probs.append(f"{where}: the image needs alt text (`alt`), a sentence describing what it shows")
    lic = img.get("licence", "")
    if img.get("kind") == "chart":
        from charts import CHARTS  # noqa: PLC0415  (charts reads the catalog; only load it when needed)
        if img.get("chart") not in CHARTS:
            probs.append(f"{where}: `chart` must name a chart in scripts/newsroom/charts.py ({', '.join(sorted(CHARTS))})")
        if not img.get("credit"):
            img["credit"] = "Parity, drawn from our own data"
        img.setdefault("licence", "Parity own work")
        return probs
    if not str(img.get("credit", "")).strip():
        probs.append(f"{where}: the image needs a `credit` (the photographer or owner)")
    if lic not in LICENCES:
        probs.append(f"{where}: `licence` must be one of {', '.join(LICENCES)}; images whose licence "
                     "does not allow reuse cannot be used")
    else:
        hosts = LICENCES[lic]
        url = str(img.get("source_url", ""))
        if hosts:  # stock: the source page must be on that site
            host = re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
            if not url.startswith("https://") or not any(host == h or host.endswith("." + h) for h in hosts):
                probs.append(f"{where}: a {lic} image needs `source_url`, the photo's page on {hosts[0]}")
        elif hosts is None and not url.startswith("https://"):
            probs.append(f"{where}: a {lic} image needs `source_url`, the page it came from")
    if need_src:
        src = str(img.get("src", ""))
        if not src:
            probs.append(f"{where}: the image needs `src`, a file under content/newsroom/images/")
        elif not (content / src).is_file():
            probs.append(f"{where}: {src} does not exist under content/newsroom/")
    return probs


def validate_post(post: Post, authors: dict[str, Author], slugs: dict[str, Post], refs: dict[str, dict],
                  content: Path | None = None) -> list[str]:
    """Every problem with one post, as sentences. Drafts get the light checks; review and
    published posts get all of them."""
    base = content or CONTENT
    where = rel(post.file)
    probs = list(post.problems)
    if probs:
        return probs
    m = post.meta
    for ch, name in BANNED_CHARS.items():
        if ch in post.file.read_text():
            probs.append(f"{where}: contains an {name} ({ch!r}); REF-0017 rule 10 keeps them out")
    status = m.get("status")
    if status not in STATUSES:
        probs.append(f"{where}: `status` must be one of {', '.join(STATUSES)}")
        return probs
    if post.file.parent.name == "drafts" and status == "published":
        probs.append(f"{where}: a published post belongs in content/newsroom/posts/, not drafts/")
    if m.get("type") not in TYPES:
        probs.append(f"{where}: `type` must be one of {', '.join(TYPES)}")
    if m.get("stance") not in STANCES:
        probs.append(f"{where}: `stance` is required and must be one of {', '.join(STANCES)}")
    elif m.get("type") in TYPES and m["stance"] not in ALLOWED_STANCES[m["type"]]:
        need = " or ".join(ALLOWED_STANCES[m["type"]])
        probs.append(f"{where}: a {m['type']} post must carry the stance label {need}, not {m['stance']}")
    if status == "draft":
        return probs

    # ---- full checks for review and published posts
    for key in ("title", "dek", "slug", "date", "authors"):
        if not m.get(key):
            probs.append(f"{where}: `{key}` is required")
    slug = m.get("slug", "")
    if slug and (not SLUG_RE.fullmatch(slug) or slug in RESERVED_SLUGS):
        probs.append(f"{where}: `slug` must be lower case letters, digits and hyphens, and not one of {sorted(RESERVED_SLUGS)}")
    if slug in slugs and slugs[slug] is not post:
        probs.append(f"{where}: slug {slug!r} is also used by {rel(slugs[slug].file)}")
    for key in ("date", "updated"):
        if key in m and not isinstance(m[key], dt.date):
            probs.append(f"{where}: `{key}` must be a date such as 2026-10-25, without quotes")
    if isinstance(m.get("date"), dt.date) and isinstance(m.get("updated"), dt.date) and m["updated"] < m["date"]:
        probs.append(f"{where}: `updated` is before `date`")
    for a in m.get("authors") or []:
        if a not in authors:
            probs.append(f"{where}: author {a!r} is not in content/newsroom/authors.toml")
    for t in m.get("tags") or []:
        if not TAG_RE.fullmatch(t):
            probs.append(f"{where}: tag {t!r} must be lower case letters, digits and hyphens")
    disclosure = m.get("disclosure")
    if disclosure is not None and DISCLOSURE not in disclosure:
        probs.append(f"{where}: `disclosure` must include {DISCLOSURE!r}")

    # Sources and citations.
    sources = [resolve_source(s, refs) for s in m.get("sources") or []]
    ids = set()
    for i, s in enumerate(sources, 1):
        if s.get("ref") and s["ref"] not in refs:
            probs.append(f"{where}: source {i} names ref {s['ref']!r}, which is not in docs/_system/references.json")
        if not s.get("id"):
            probs.append(f"{where}: source {i} needs an `id` (used to cite it as [^id]) or a `ref`")
        if not s.get("title"):
            probs.append(f"{where}: source {i} needs a `title`")
        if not str(s.get("url", "")).startswith(("https://", "http://")) and not str(s.get("url", "")).startswith("/"):
            probs.append(f"{where}: source {i} needs a `url`")
        ids.add(s.get("id"))
    if m.get("type") in NEEDS_SOURCES and not sources:
        probs.append(f"{where}: a {m['type']} post must list its sources ([[sources]] with a title and a URL)")
    for cid in CITE_RE.findall(post.body):
        if cid not in ids:
            probs.append(f"{where}: the text cites [^{cid}], which is not in the sources list")

    # Images: the hero and every image in the text.
    hero = m.get("hero")
    if hero is not None:
        kind = hero.get("kind")
        if kind not in HERO_KINDS:
            probs.append(f"{where}: hero `kind` must be one of {', '.join(HERO_KINDS)}")
        probs += _check_image(f"{where} hero", hero, need_src=kind in ("stock", "own"), content=base)
        if kind == "stock" and hero.get("licence") == "Parity own work":
            probs.append(f"{where} hero: a stock image cannot be licensed as Parity own work")
    declared = {}
    for i, img in enumerate(m.get("images") or [], 1):
        declared[img.get("src", "")] = img
        if str(img.get("src", "")).startswith("chart:"):
            img.setdefault("kind", "chart")
            img.setdefault("chart", img["src"][6:])
        probs += _check_image(f"{where} image {i}", img, need_src=img.get("kind") != "chart", content=base)
    for alt, src, _cap in IMAGE_RE.findall(post.body):
        if src not in declared:
            probs.append(f"{where}: the image {src} in the text needs an [[images]] entry with its credit and licence")
        if not alt.strip():
            probs.append(f"{where}: the image {src} in the text needs alt text: ![what it shows]({src})")

    # Corrections log.
    for i, c in enumerate(m.get("corrections") or [], 1):
        if not isinstance(c.get("date"), dt.date) or not c.get("text"):
            probs.append(f"{where}: correction {i} needs a `date` and a `text`")

    # Machine-written drafts (the SEO pipeline, DEC-0023) need a named person's approval to publish.
    review = m.get("review") or {}
    if status == "published" and review.get("generated_by"):
        who = review.get("approved_by")
        if who not in authors or authors[who].kind != "team":
            probs.append(f"{where}: written by {review['generated_by']}, so it needs `review.approved_by`, "
                         "a team member in authors.toml, before it can be published")
        if not isinstance(review.get("approved_on"), dt.date):
            probs.append(f"{where}: a generated post needs `review.approved_on`, the date it was approved")
    return probs


def validate_authors(authors: dict[str, Author]) -> list[str]:
    """Bylines must be real team members or labelled house desks. No invented people."""
    probs = []
    for a in authors.values():
        where = f"content/newsroom/authors.toml [{a.id}]"
        if not SLUG_RE.fullmatch(a.id):
            probs.append(f"{where}: the id must be lower case letters, digits and hyphens")
        if not a.name:
            probs.append(f"{where}: `name` is required")
        if a.kind not in ("team", "house"):
            probs.append(f"{where}: `kind` must be team (a real person) or house (a desk byline such as Parity Research)")
        if a.kind == "house" and a.photo:
            probs.append(f"{where}: a house byline cannot have a photo of a person")
        if a.kind == "house" and not a.name.startswith("Parity "):
            probs.append(f"{where}: a house byline is named for Parity, such as 'Parity Research'")
        if a.kind == "team" and (a.bio or a.photo) and not getattr(a, "supplied", False):
            probs.append(f"{where}: a team member's bio or photo is added only when they supply it "
                         "(set supplied_by_author = true)")
    return probs


def validate(posts: list[Post], authors: dict[str, Author], refs: dict[str, dict] | None = None,
             content: Path | None = None) -> list[str]:
    refs = load_references() if refs is None else refs
    probs = validate_authors(authors)
    slugs: dict[str, Post] = {}
    for p in posts:
        if p.slug and p.slug not in slugs:
            slugs[p.slug] = p
    for p in posts:
        probs += validate_post(p, authors, slugs, refs, content)
    published = {p.slug for p in posts if p.status == "published"}
    for p in posts:
        if p.status == "published":
            for r in p.meta.get("related") or []:
                if r not in published:
                    probs.append(f"{rel(p.file)}: related post {r!r} is not a published post")
    return probs


def public_posts(posts: list[Post], include_unpublished: bool = False) -> list[Post]:
    """The posts that build: only `published`, unless this is a local preview."""
    keep = [p for p in posts if p.status == "published" or (include_unpublished and p.status in ("review", "draft")
                                                              and p.slug and p.type in TYPES and isinstance(p.date, dt.date))]
    return sorted(keep, key=lambda p: (p.date, p.slug), reverse=True)
