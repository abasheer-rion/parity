"""Add a small market strip to the front page's stats.json (DEC-0031).

The front page shows a terminal preview and a ticker of recent closes. Both read
/stats.json, which scripts/export_site_data.py writes with the research counts. This
script runs after `parity terminal export` and adds, from data/terminal/index.json:

  series_count   how many series Parity Terminal shows
  data_through   the newest date in the terminal data
  strip          up to 14 series: ticker, name, last close, one-day change, its date,
                 a short sparkline and its source

Only series the terminal already shows go in, so every licence rule in
engine/src/parity/terminal.py (TERMS) still applies. Prices only: no results, no
ledger. Standard library only.

Usage: python3 scripts/export_front_strip.py web/dist
       python3 scripts/export_front_strip.py --index engine/output/terminal/index.json
The second form prints the added fields as JSON (the dev server uses it).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# The order the strip prefers. Anything missing is skipped, and other daily series
# fill the rest. The yen is left out because the terminal quotes it in dollars per yen.
PREFERRED = [
    "fx.EUR", "fx.GBP", "fx.CHF", "fx.AUD", "fx.CAD",
    "bond.UST10Y", "rate.TBILL3M",
    "cmd.WTI", "cmd.BRENT", "cmd.HH_GAS",
    "risk.VIX", "eq.US_MKT",
    "crypto.BTC", "crypto.ETH",
]
SIZE = 14
SPARK = 26


def sig(v: float | None, digits: int = 5) -> float | None:
    return None if v is None else float(f"{v:.{digits}g}")


def entry(s: dict) -> dict:
    spark = [x for x in (s.get("spark") or []) if x is not None][-SPARK:]
    return {
        "k": s["short"], "n": s["label"], "v": sig(s.get("last")), "kind": s.get("kind", "price"),
        "d1": sig((s.get("chg") or {}).get("d1"), 3), "asof": s.get("asof"),
        "s": [sig(x, 4) for x in spark], "src": s.get("source", ""),
    }


def build(index: dict) -> dict:
    series = [s for s in index.get("series", []) if s.get("last") is not None and s.get("asof")]
    by_key = {s["key"]: s for s in series}
    picked = [by_key[k] for k in PREFERRED if k in by_key]
    for s in series:
        if len(picked) >= SIZE:
            break
        if s not in picked and s.get("freq") == "D" and not s["key"].startswith("fx.JPY"):
            picked.append(s)
    return {
        "series_count": len(index.get("series", [])),
        "data_through": index.get("data_through"),
        "strip": [entry(s) for s in picked[:SIZE]],
    }


def main(site: Path) -> int:
    index_file = site / "data" / "terminal" / "index.json"
    stats_file = site / "stats.json"
    if not index_file.exists():
        print(f"no terminal index at {index_file}, strip skipped")
        return 0
    stats = json.loads(stats_file.read_text()) if stats_file.exists() else {}
    stats.update(build(json.loads(index_file.read_text())))
    stats_file.write_text(json.dumps(stats, separators=(",", ":")))
    print(f"stats.json: {stats['series_count']} series, {len(stats['strip'])} in the strip, through {stats['data_through']}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--index":
        print(json.dumps(build(json.loads(Path(sys.argv[2]).read_text()))))
        sys.exit(0)
    sys.exit(main(Path(sys.argv[1] if len(sys.argv) > 1 else "web/dist")))
