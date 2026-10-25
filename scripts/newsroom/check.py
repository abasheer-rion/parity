#!/usr/bin/env python3
"""Checks every newsroom post and byline against the rules in model.py (DEC-0057).

    python3 scripts/newsroom/check.py        # or: npm run newsroom:check

Run in CI and by the site build. Exits 1 and lists every problem if anything fails.
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import model  # noqa: E402


def main() -> int:
    posts = model.load_posts()
    probs = model.validate(posts, model.load_authors())
    if probs:
        print("newsroom check: problems")
        for p in probs:
            print(f"  - {p}")
        return 1
    by = Counter(p.status for p in posts)
    print(f"newsroom check: {len(posts)} posts ({by['published']} published, {by['review']} in review, "
          f"{by['draft']} drafts), 0 problems")
    return 0


if __name__ == "__main__":
    sys.exit(main())
