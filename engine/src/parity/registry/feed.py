"""Enrolled Base pools go live in the on-chain feed by themselves (DEC-0078).

The gate (enrol.py) enrols a new Base pool when its licence allows a public feed and it is
deep enough. This step, run once a day by .github/workflows/pool-enrol.yml, reads those
enrolled pools from the site's database (public.data_series, readable by anyone), checks each
pool's depth again on a public Base node, and writes the ones that pass to
web/live/src/venues/onchain-enrolled.json. The fan-out worker joins that list to its pool
list at load (withEnrolled in web/live/src/venues/onchainRegistry.ts), so the next deploy
streams them.

Caps, so the feed never changes much in one day:
    depth        the registry's bar (minLiqUsd, 50k USD today), measured now, not at discovery
    per day      at most MAX_NEW_PER_DAY new pools in any 24 hours
    per asset    at most 8 pools and 3 per chain, the same caps proposePools keeps
    asset        a pool joins only an asset the feed already prices
A pool whose series is retired leaves the list. The viewers-per-feed cap is not touched.

Kill switch: POOL_AUTO_ENROL=off (a repo variable in the workflow) stops it; nothing is written.

Standard library only (psycopg when reading the database), no imports from this package, so
the workflow runs it as a plain script:

    python3 engine/src/parity/registry/feed.py [--dry-run] [--rows rows.json]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
REGISTRY = ROOT / "web/live/src/venues/onchain-registry.json"
ENROLLED = ROOT / "web/live/src/venues/onchain-enrolled.json"

BASE_RPC = "https://base-rpc.publicnode.com"
#: The deepest WETH/USDC pool on Base (Uniswap v3 0.05%), whose price turns WETH into dollars.
ETH_USDC_POOL = "0xd0b53d9277642d899df5c87a3966a349a798f224"
QUOTES = {"USDC": ("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 6),
          "WETH": ("0x4200000000000000000000000000000000000006", 18)}
SWAP_UNI = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
AERO_FEES = {1: 0.0001, 50: 0.0005, 100: 0.0005, 200: 0.003, 2000: 0.01}

MAX_NEW_PER_DAY = 3
MAX_POOLS = 8
MAX_PER_CHAIN = 3
#: The discoverer's own floor; the registry's minLiqUsd is higher today and wins.
MIN_USD = 40_000

#: The name discover.base_pools gives a pool: "CBBTC/WETH Uniswap v3 0.05% pool on Base, ...".
NAME_RE = re.compile(r"^([A-Z0-9]+)/(USDC|WETH) "
                     r"(Uniswap v3 [0-9.]+%|Aerodrome CL(\d+)) pool on Base")
POOL_RE = re.compile(r"^0x[0-9a-f]{40}$")


def fee_of(venue: str) -> float | None:
    m = re.match(r"Uniswap v3 ([0-9.]+)%$", venue)
    if m:
        return round(float(m.group(1)) / 100, 6)
    m = re.match(r"Aerodrome CL(\d+)$", venue)
    return AERO_FEES.get(int(m.group(1))) if m else None


def _name(label: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", label.upper())


def token_index(reg: dict) -> dict[str, tuple[str, str, int, str | None]]:
    """Base token name -> (asset key, address, decimals, via), from the feed's Base pools.
    Named the way discover.onchain_config names them: the wrapped form (CBBTC) or the ticker."""
    out: dict[str, tuple[str, str, int, str | None]] = {}
    for t in reg.get("tokens", []):
        for p in t.get("pools", []):
            if p.get("chain") != "base":
                continue
            label = p.get("via") or t["sym"].removesuffix("-USD")
            out.setdefault(_name(label), (t["key"], p["base"].lower(), int(p["decimals"]),
                                          p.get("via")))
    return out


def entry_for(row: dict, index: dict) -> tuple[dict | None, str]:
    """The enrolled-list entry for one database row, or None and why not."""
    pool = (row.get("code") or "").lower()
    if not POOL_RE.match(pool) or row.get("id") != f"onchain.{pool}":
        return None, "not a Base pool series"
    m = NAME_RE.match(row.get("name") or "")
    if not m:
        return None, "name does not say token, quote and venue"
    base, quote, venue = m.group(1), m.group(2), m.group(3)
    fee = fee_of(venue)
    if fee is None:
        return None, f"unknown venue {venue}"
    if base not in index:
        return None, f"{base} is not an asset the feed prices"
    key, addr, dec, via = index[base]
    e = {"token": key, "series": row["id"], "chain": "base", "pool": pool, "base": addr,
         "decimals": dec, "quote": quote, "dex": venue, "fee": fee, "liq": 0, "swaps": None,
         "topic": SWAP_UNI}
    if via:
        e["via"] = via
    return e, ""


def _pad(addr: str) -> str:
    return addr.lower().replace("0x", "").rjust(64, "0")


def _rpc(calls: list[tuple[str, str]]) -> list[str | None]:
    body = json.dumps([{"jsonrpc": "2.0", "id": i, "method": "eth_call",
                        "params": [{"to": to, "data": data}, "latest"]}
                       for i, (to, data) in enumerate(calls)]).encode()
    req = urllib.request.Request(BASE_RPC, body, {"Content-Type": "application/json",
                                                  "User-Agent": "parity-pool-enrol"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)
    by_id = {x.get("id"): x.get("result") for x in res} if isinstance(res, list) else {}
    return [by_id.get(i) for i in range(len(calls))]


def depth_usd(pool: str, quote: str, rpc: Callable = _rpc) -> float:
    """The pool's quote-side balance in USD, read now."""
    qa, qdec = QUOTES[quote]
    bal, slot = rpc([(qa, f"0x70a08231{_pad(pool)}"), (ETH_USDC_POOL, "0x3850c7bd")])
    q = int(bal or "0x0", 16) / 10 ** qdec
    if quote == "USDC":
        return q
    eth = (int(slot[:66], 16) / 2 ** 96) ** 2 * 1e12 if slot and len(slot) >= 66 else 0.0
    return q * eth


def promote(rows: list[dict], reg: dict, enrolled: dict, now: datetime,
            depth: Callable[[str, str], float] = depth_usd,
            max_new: int = MAX_NEW_PER_DAY) -> tuple[dict, list[dict]]:
    """The next enrolled list and one report line per row looked at. Pure apart from depth()."""
    bar = max(float(reg.get("minLiqUsd") or 0), MIN_USD)
    retired = {r["id"] for r in rows if r.get("status") == "retired"}
    kept = [p for p in enrolled.get("pools", []) if p["series"] not in retired]
    report = [{"id": p["series"], "action": "removed", "why": "series retired"}
              for p in enrolled.get("pools", []) if p["series"] in retired]
    listed = {(p["chain"], p["pool"].lower()) for t in reg.get("tokens", []) for p in t["pools"]}
    listed |= {(p["chain"], p["pool"].lower()) for p in kept}
    pools_of: dict[str, list[tuple[str, str]]] = {}
    for t in reg.get("tokens", []):
        pools_of[t["key"]] = [(p["chain"], p["pool"].lower()) for p in t["pools"]]
    for p in kept:
        pools_of.setdefault(p["token"], []).append((p["chain"], p["pool"].lower()))
    since = now - timedelta(hours=24)
    recent = sum(datetime.fromisoformat(p["enrolledAt"].replace("Z", "+00:00")) >= since
                 for p in kept)
    index = token_index(reg)
    added = []
    for row in sorted(rows, key=lambda r: r["id"]):
        if row.get("status") not in ("enrolled", "live") or row.get("intended_use") != "feed":
            continue
        e, why = entry_for(row, index)
        if e is None:
            report.append({"id": row.get("id"), "action": "skipped", "why": why})
            continue
        if ("base", e["pool"]) in listed:
            continue
        have = pools_of.get(e["token"], [])
        if len(have) >= MAX_POOLS or sum(c == "base" for c, _ in have) >= MAX_PER_CHAIN:
            report.append({"id": row["id"], "action": "skipped", "why": "asset has its pools"})
            continue
        if recent + len(added) >= max_new:
            report.append({"id": row["id"], "action": "waits", "why": "daily cap reached"})
            continue
        try:
            usd = depth(e["pool"], e["quote"])
        except Exception as exc:  # a node error leaves it for tomorrow
            report.append({"id": row["id"], "action": "waits",
                           "why": f"depth read failed ({type(exc).__name__})"})
            continue
        if usd < bar:
            report.append({"id": row["id"], "action": "skipped",
                           "why": f"{usd / 1000:,.0f}k USD deep, under the {bar / 1000:,.0f}k bar"})
            continue
        e["liq"] = round(usd)
        e["enrolledAt"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        added.append(e)
        have.append(("base", e["pool"]))
        listed.add(("base", e["pool"]))
        report.append({"id": row["id"], "action": "added", "token": e["token"], "liq": e["liq"]})
    if not added and len(kept) == len(enrolled.get("pools", [])):
        return enrolled, report
    out = {"at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "pools": kept + added}
    return out, report


def read_rows(url: str) -> list[dict]:
    import psycopg

    cols = ("id", "code", "name", "status", "intended_use")
    with psycopg.connect(url, connect_timeout=20) as conn:
        cur = conn.execute(
            "select id, code, name, status, intended_use from public.data_series "
            "where source_id = 'onchain' and origin = 'discovered' and intended_use = 'feed' "
            "and status in ('enrolled', 'live', 'retired')")
        return [dict(zip(cols, r, strict=True)) for r in cur.fetchall()]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--rows", help="a JSON file of rows instead of the database (tests)")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    a = ap.parse_args(argv)
    if os.environ.get("POOL_AUTO_ENROL", "").strip().lower() == "off":
        print(json.dumps({"skipped": "POOL_AUTO_ENROL is off"}))
        return 0
    if a.rows:
        rows = json.loads(Path(a.rows).read_text())
    else:
        url = os.environ.get("SITE_DATA_DB_URL", "")
        if not url.startswith("postgres"):
            print(json.dumps({"skipped": "SITE_DATA_DB_URL is not set"}))
            return 0
        rows = read_rows(url)
    reg = json.loads(REGISTRY.read_text())
    enrolled = json.loads(ENROLLED.read_text()) if ENROLLED.exists() else {"at": None, "pools": []}
    out, report = promote(rows, reg, enrolled, datetime.now(UTC))
    changed = out is not enrolled
    if changed and not a.dry_run:
        ENROLLED.write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps({"rows": len(rows), "changed": changed, "pools": len(out["pools"]),
                      "report": report}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
