"""Write the daily price file Verify's card 4 checks fills against (REF-0016).

Runs after `parity terminal export` in the deploy and reads only what Parity Terminal
already shows (so every licence rule in engine/src/parity/terminal.py still applies):
major currency pairs, Bitcoin, Ether and the S&P 500 index. Our free sources publish one
price a day, not the day's high and low, so every symbol is written as kind "price".
Verify then runs its "far from the day's price" check for these symbols and says the
high and low checks cannot be checked. A source with real highs and lows can be added
later as kind "hl" rows: [date, low, high].

Writes <site>/data/verify/prices.json:
  {"generated_at": ..., "symbols": {"EURUSD": {"kind": "price", "source": ...,
                                              "rows": [[date, price], ...]}}}

Usage: python3 scripts/export_verify_prices.py web/dist
       python3 scripts/export_verify_prices.py --terminal engine/output/terminal \
           --out engine/output/verify/prices.json
Standard library only.
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

# Verify's symbol -> (terminal series key, invert). Terminal FX series are US dollars per
# unit of the foreign currency, so USD-first pairs are inverted.
SYMBOLS: dict[str, tuple[str, bool]] = {
    "EURUSD": ("fx.EUR", False), "GBPUSD": ("fx.GBP", False), "AUDUSD": ("fx.AUD", False),
    "NZDUSD": ("fx.NZD", False), "USDJPY": ("fx.JPY", True), "USDCAD": ("fx.CAD", True),
    "USDCHF": ("fx.CHF", True), "USDNOK": ("fx.NOK", True), "USDSEK": ("fx.SEK", True),
    "BTCUSD": ("crypto.BTC", False), "ETHUSD": ("crypto.ETH", False),
    "SPX": ("eq.SPX", False),
}
SINCE = "2016-01-01"  # the terminal export is daily from 2016 on


def sig(v: float, digits: int = 7) -> float:
    return float(f"{v:.{digits}g}")


def build(terminal: Path) -> dict:
    index = json.loads((terminal / "index.json").read_text())
    by_key = {s["key"]: s for s in index.get("series", [])}
    out: dict[str, dict] = {}
    for sym, (key, invert) in SYMBOLS.items():
        s = by_key.get(key)
        if not s or s.get("freq") != "D":
            continue
        path = terminal / s["file"]
        if not path.exists():
            continue
        pts = json.loads(path.read_text()).get("points", [])
        rows = []
        for d, v in pts:
            if v is None or d < SINCE or not v > 0:
                continue
            rows.append([d, sig(1 / v if invert else v)])
        if rows:
            out[sym] = {"kind": "price", "source": s.get("source", ""), "rows": rows}
    return {"generated_at": datetime.now(UTC).isoformat(timespec="seconds"), "symbols": out}


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "--terminal":
        terminal = Path(argv[1])
        out = Path(argv[argv.index("--out") + 1]) if "--out" in argv else Path("prices.json")
    elif len(argv) == 1:
        terminal = Path(argv[0]) / "data" / "terminal"
        out = Path(argv[0]) / "data" / "verify" / "prices.json"
    else:
        print(__doc__, file=sys.stderr)
        return 2
    if not (terminal / "index.json").exists():
        print(f"no terminal export at {terminal}, nothing to do", file=sys.stderr)
        return 0
    doc = build(terminal)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"export_verify_prices: {len(doc['symbols'])} symbols -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
