"""Write the live counts from stats.json into the built front page (DEC-0039).

The front page (web/index.html) shows real numbers: tries in the strategy search,
strategies tested, how many beat the market, and series per market. They come from
dist/stats.json, which scripts/export_site_data.py and scripts/export_front_strip.py
write after the build. This puts the same numbers into dist/index.html, so the page
shows them before any script runs (and with none). The page's script still refreshes
them from /stats.json. Counts only. Standard library only.

Usage: python3 scripts/bake_front_stats.py web/dist
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def fmt(n: float) -> str:
    return f"{round(n):,}"


def bake(html: str, stats: dict) -> str:
    def stat(m: re.Match) -> str:
        key = m.group(2)
        v = stats.get(key)
        if not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0:
            return m.group(0)
        return f"{m.group(1)}{fmt(v)}{m.group(4)}"

    html = re.sub(r'(<[^>]*\bdata-stat="(\w+)"[^>]*>)([^<]*)(<)', stat, html)
    groups = stats.get("series_by_group")
    if isinstance(groups, dict):
        def group(m: re.Match) -> str:
            n = sum(int(groups.get(g, 0) or 0) for g in m.group(2).split(","))
            return f"{m.group(1)}{fmt(n)} series{m.group(4)}" if n > 0 else m.group(0)

        html = re.sub(r'(<[^>]*\bdata-groups="([\w,]+)"[^>]*>)([^<]*)(<)', group, html)
    return html


def main(site: Path) -> int:
    stats_file, page = site / "stats.json", site / "index.html"
    if not stats_file.exists() or not page.exists():
        print("no stats.json or index.html, nothing baked")
        return 0
    stats = json.loads(stats_file.read_text())
    page.write_text(bake(page.read_text(), stats))
    print(f"baked {', '.join(k for k, v in stats.items() if isinstance(v, (int, float)))} into {page}")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1] if len(sys.argv) > 1 else "web/dist")))
