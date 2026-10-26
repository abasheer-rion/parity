#!/usr/bin/env python3
"""Lets an automated job, such as the SEO pipeline (DEC-0023), propose a newsroom post.

    python3 scripts/newsroom/hook.py --from proposal.json --by seo-pipeline

The proposal is JSON with title, dek, type, body (Markdown) and optionally tags, markets and
sources (the same fields as a post's [[sources]]). The hook only ever writes a draft:

  * the file goes in content/newsroom/drafts/, never posts/
  * status is always "draft", whatever the proposal says
  * the byline is a house byline, and [review] generated_by names the job

A generated post can only be published after a team member sets status = "published" and
review.approved_by and review.approved_on; the build refuses it otherwise (model.py). Nothing
here publishes, commits or deploys.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import model  # noqa: E402
from new import slugify  # noqa: E402

HOUSE_FOR = {"Research": "parity-research", "Analysis": "parity-research", "Explainer": "parity-research",
             "News": "parity-markets-desk", "Opinion": "parity-editorial", "Company update": "parity-editorial",
             "Press release": "parity-editorial"}


def toml_str(s: str) -> str:
    return json.dumps(str(s), ensure_ascii=False)  # a JSON string is a valid TOML basic string


def propose(proposal: dict, generated_by: str, today: dt.date | None = None, content: Path | None = None) -> Path:
    base = content or model.CONTENT
    t = proposal.get("type")
    if t not in model.TYPES:
        raise ValueError(f"type must be one of {', '.join(model.TYPES)}")
    if not proposal.get("title") or not proposal.get("body"):
        raise ValueError("a proposal needs a title and a body")
    today = today or dt.date.today()
    slug = slugify(proposal.get("slug") or proposal["title"])
    taken = {p.slug for p in model.load_posts(base)}
    n, final = 2, slug
    while final in taken or final in model.RESERVED_SLUGS:
        final, n = f"{slug}-{n}", n + 1
    lines = ["+++",
             f"title = {toml_str(proposal['title'])}",
             f"dek = {toml_str(proposal.get('dek', ''))}",
             f"slug = {toml_str(final)}",
             f"date = {today.isoformat()}",
             f"type = {toml_str(t)}",
             f"stance = {toml_str(model.ALLOWED_STANCES[t][0])}",
             'status = "draft"',
             f"authors = [{toml_str(HOUSE_FOR[t])}]",
             "tags = [" + ", ".join(toml_str(x) for x in proposal.get("tags", [])) + "]",
             "markets = [" + ", ".join(toml_str(x) for x in proposal.get("markets", [])) + "]",
             "", "[review]", f"generated_by = {toml_str(generated_by)}", f"generated_on = {today.isoformat()}",
             "# approved_by = \"\"   # a team member's id from authors.toml, set by that person",
             "# approved_on = YYYY-MM-DD"]
    for s in proposal.get("sources", []):
        lines += ["", "[[sources]]"] + [f"{k} = {toml_str(v)}" for k, v in s.items() if k in ("id", "ref", "title", "url", "publisher", "note")]
    lines += ["+++", "", proposal["body"].strip(), ""]
    dest = base / "drafts" / f"{today.isoformat()}-{final}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(lines))
    return dest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from", dest="src", required=True, help="a JSON proposal file, or - for stdin")
    ap.add_argument("--by", required=True, help="the job proposing it, for example seo-pipeline")
    a = ap.parse_args()
    raw = sys.stdin.read() if a.src == "-" else Path(a.src).read_text()
    dest = propose(json.loads(raw), a.by)
    print(f"newsroom: proposed {model.rel(dest)} as a draft. A person must review and publish it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
