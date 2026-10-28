"""The checks every automatic post passes before it is written (DEC-0073).

    facts(draft)       every number in the text matches a number from the data, every outside
                       link is one of the cited sources
    caps(job, date)    the weekly volume caps in content/seo/automation.toml still allow a post
    newsroom(draft)    the newsroom's own rules (scripts/newsroom/model.py, DEC-0057)
    duplicate(draft)   the same data was not already posted

Each returns a list of problems as sentences; empty means it passed.
"""
from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

from .common import CONTENT, Draft, automation, iso_week, model

# Dates, ISO weeks and times are not measurements, so they are not checked as numbers.
DATE_RES = [re.compile(r"\b\d{4}-\d{2}-\d{2}\b"), re.compile(r"\b\d{4}-W\d{2}\b"),
            re.compile(r"\b\d{1,2} (January|February|March|April|May|June|July|August|September|October|"
                       r"November|December) \d{4}\b"),
            re.compile(r"\b(January|February|March|April|May|June|July|August|September|October|November|"
                       r"December) \d{4}\b")]
LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)\s]+)\)")
URL_RE = re.compile(r"https?://[^\s)\]>\"]+")
NUM_RE = re.compile(r"(?<![\w.])[+-]?\d[\d,]*(?:\.\d+)?")
CITE_RE = re.compile(r"\[\^[^\]]+\]")


def numbers_in(text: str) -> list[str]:
    """Number tokens in prose: link texts (headlines), URLs, citations and dates removed."""
    text = LINK_RE.sub(" ", text)
    text = URL_RE.sub(" ", text)
    text = CITE_RE.sub(" ", text)
    for r in DATE_RES:
        text = r.sub(" ", text)
    text = re.sub(r"#\d+", " ", text)  # pull request numbers are links, checked as links
    return NUM_RE.findall(text)


def _matches(token: str, truth: list[float]) -> bool:
    raw = token.replace(",", "").lstrip("+")
    value = abs(float(raw))
    decimals = len(raw.split(".")[1]) if "." in raw else 0
    tol = 0.5 * 10 ** -decimals + 1e-9
    return any(abs(abs(t) - value) <= tol for t in truth)


def facts(d: Draft, ignore: tuple[str, ...] = ()) -> list[str]:
    """Numbers and links in the body against what the data allows."""
    probs = []
    body = d.body
    for s in d.strip:
        body = body.replace(s, " ")
    truth = list(d.truth) + [float(i) for i in range(0, 11)]  # small counts like "three" written as 3
    for tok in numbers_in(body):
        if tok in ignore:
            continue
        if not _matches(tok, truth):
            probs.append(f"{d.job}: the number {tok} is not in the data this post was built from")
    allowed = set(d.urls)
    site = re.compile(r"^/")
    for _, url in LINK_RE.findall(d.body):
        if site.match(url) or url.startswith("#"):
            continue
        if url not in allowed:
            probs.append(f"{d.job}: the link {url} is not one of the cited sources")
    for url in URL_RE.findall(LINK_RE.sub(" ", d.body)):
        if url not in allowed:
            probs.append(f"{d.job}: the bare link {url} is not one of the cited sources")
    for s in d.meta.get("sources") or []:
        u = s.get("url", "")
        if u.startswith("http") and u not in allowed:
            probs.append(f"{d.job}: source {u} was not in the data")
    return probs


def auto_posts(content: Path | None = None) -> list[tuple[str, dt.date, str]]:
    """(job, date, fingerprint) for every automatic post already in the newsroom."""
    out = []
    for p in model.load_posts(content or CONTENT):
        job = p.meta.get("auto")
        if job and isinstance(p.meta.get("date"), dt.date):
            out.append((job, p.meta["date"], str(p.meta.get("auto_data", ""))))
    return out


def caps(job: str, day: dt.date, content: Path | None = None, extra: list[tuple[str, dt.date]] | None = None) -> list[str]:
    c = automation.caps()
    week = iso_week(day)
    posts = [(j, d) for j, d, _ in auto_posts(content)] + list(extra or [])
    same_week = [j for j, d in posts if iso_week(d) == week]
    probs = []
    per_job = c.get(f"{job}_per_week")
    if per_job is not None and same_week.count(job) >= per_job:
        probs.append(f"{job}: the cap of {per_job} a week is reached for {week}")
    total = c.get("auto_posts_per_week")
    if total is not None and len(same_week) >= total:
        probs.append(f"{job}: the cap of {total} automatic posts a week is reached for {week}")
    return probs


def duplicate(d: Draft, content: Path | None = None) -> list[str]:
    fp = d.meta.get("auto_data")
    if not fp:
        return []
    for job, _, other in auto_posts(content):
        if job == d.job and other == fp:
            return [f"{d.job}: a post from exactly this data already exists"]
    return []


def length(d: Draft) -> list[str]:
    need = int(automation.caps().get("min_words", 0))
    words = len(re.findall(r"[A-Za-z0-9']+", re.sub(r"\|", " ", d.body)))
    return [f"{d.job}: {words} words is under the minimum of {need}"] if words < need else []


def newsroom(d: Draft, content: Path | None = None) -> list[str]:
    """Writes the post to a scratch copy of the newsroom and runs the newsroom's validator on it."""
    import shutil
    import tempfile
    base = content or CONTENT
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for sub in ("posts", "drafts", "images", "data"):
            src = base / sub
            if src.is_dir():
                shutil.copytree(src, root / sub)
            else:
                (root / sub).mkdir()
        shutil.copy(base / "authors.toml", root / "authors.toml")
        for rel, text in d.files.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text)
        import charts  # noqa: PLC0415  (scripts/newsroom/charts.py)
        for rel in d.files:
            if rel.startswith("data/") and rel.endswith(".json"):
                charts.CHARTS[Path(rel).stem] = lambda f=root / rel: charts.data_chart(f)
        folder = "posts" if d.meta.get("status") == "published" else "drafts"
        f = root / folder / d.filename
        f.write_text(d.text())
        post = model.load_post(f)
        posts = model.load_posts(root)
        slugs = {p.slug: p for p in posts if p.file != f}
        slugs[post.slug] = post
        authors = model.load_authors(root / "authors.toml")
        return model.validate_post(post, authors, slugs, model.load_references(), content=root)


def all_checks(d: Draft, day: dt.date, content: Path | None = None) -> list[str]:
    return caps(d.job, day, content) + duplicate(d, content) + length(d) + facts(d) + newsroom(d, content)
