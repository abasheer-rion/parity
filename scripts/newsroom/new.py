#!/usr/bin/env python3
"""Starts a new newsroom post as a draft (DEC-0053).

    npm run newsroom:new -- --type Analysis --title "What carry paid in 2026" [--author parity-research]

Writes content/newsroom/drafts/<date>-<slug>.md from content/newsroom/templates/post.md with
status = "draft". Drafts never build on the site. Move the file to content/newsroom/posts/
and set status to "review", then "published", when it is ready.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import model  # noqa: E402


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:70].rstrip("-")


def scaffold(title: str, type_: str, author: str, slug: str = "", today: dt.date | None = None,
             content: Path | None = None) -> Path:
    base = content or model.CONTENT
    if type_ not in model.TYPES:
        raise SystemExit(f"--type must be one of: {', '.join(model.TYPES)}")
    authors = model.load_authors(base / "authors.toml")
    if author not in authors:
        raise SystemExit(f"--author must be one of: {', '.join(authors)}")
    slug = slug or slugify(title)
    if not model.SLUG_RE.fullmatch(slug) or slug in model.RESERVED_SLUGS:
        raise SystemExit(f"cannot make a slug from {title!r}; pass --slug")
    taken = {p.slug for p in model.load_posts(base)}
    if slug in taken:
        raise SystemExit(f"slug {slug!r} is already used; pass --slug")
    today = today or dt.date.today()
    text = (base / "templates/post.md").read_text().format(
        title=title.replace('"', "'"), slug=slug, date=today.isoformat(), type=type_,
        stance=model.ALLOWED_STANCES[type_][0], author=author)
    dest = base / "drafts" / f"{today.isoformat()}-{slug}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text)
    return dest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--title", required=True)
    ap.add_argument("--type", required=True, help=", ".join(model.TYPES))
    ap.add_argument("--author", default="parity-editorial", help="an id from content/newsroom/authors.toml")
    ap.add_argument("--slug", default="")
    a = ap.parse_args()
    dest = scaffold(a.title, a.type, a.author, a.slug)
    print(f"newsroom: started {model.rel(dest)} (status draft). Preview it with `npm run newsroom:preview`.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
