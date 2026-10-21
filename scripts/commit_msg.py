#!/usr/bin/env python3
"""Checks a commit message or pull request title. Used by .githooks/commit-msg and CI.

Format: <type>(<optional scope>): <summary in plain words>
Example: research(hyp-0003): measure oil to CAD lead-lag
"""

from __future__ import annotations

import re
import sys

TYPES = ("feat", "fix", "docs", "data", "research", "exp", "test", "refactor", "ci", "chore")
PATTERN = re.compile(rf"^({'|'.join(TYPES)})(\([a-z0-9-]+\))?: [^\s].{{0,70}}$")
BANNED = ("—", "–")


def check(line: str) -> str | None:
    if line.startswith(("Merge ", "Revert ")):
        return None
    if not PATTERN.match(line):
        return (f"'{line}' should look like 'type(scope): summary' with type one of "
                f"{', '.join(TYPES)} and at most 72 characters")
    if any(ch in line for ch in BANNED):
        return "use plain punctuation instead of dashes"
    return None


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        with open(arg, encoding="utf-8") as fh:
            first = fh.readline().strip()
    except OSError:
        first = arg.strip()  # a title passed directly, as CI does for PR titles
    problem = check(first)
    if problem:
        print(f"commit message: {problem}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
