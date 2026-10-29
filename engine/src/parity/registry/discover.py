"""Discovery (DEC-0064): scheduled discoverers that propose candidates and never enrol.

Each discoverer reads one public list whose terms allow scripted reading, compares it with
what the registry already has, and returns candidates with their tags and labels. Lists
that only say "something new appeared" (dataflows, ETF tickers, venue listings) record a
baseline on their first run and propose only what is new after that, so the first day does
not flood the queue.

Runs at most once a day (`discover_if_due`), from the sims service's registry step.
Every discoverer has its own try: one that fails is recorded and the rest still run.
"""

from __future__ import annotations

import io
import json
import os
import re
import sqlite3
import time
from collections.abc import Callable
from pathlib import Path

import pandas as pd

from ..data import catalog, sources
from . import db, net, tags
from .model import Record

EVERY_HOURS = 24.0
ROOT = Path(__file__).resolve().parents[4]

# ------------------------------------------------------------------ context


class Context:
    """What a discoverer may know: every id and code already in the registry, and a small
    per-discoverer memory for baselines."""

    def __init__(self, con: sqlite3.Connection):
        self.con = con
        rows = db.all_series(con)
        self.ids = {r["id"] for r in rows}
        self.codes = {(r["source_id"], r["code"]) for r in rows}

    def known(self, sid: str, source: str = "", code: str = "") -> bool:
        return sid in self.ids or (source, code) in self.codes

    def seen(self, name: str) -> set[str] | None:
        raw = db.get_state(self.con, f"seen:{name}")
        items = set(json.loads(raw)) if raw else set()
        return items or None  # an empty memory is no baseline: the next run sets one

    def remember(self, name: str, items: set[str]) -> None:
        db.set_state(self.con, f"seen:{name}", json.dumps(sorted(items)))


def candidate(sid: str, source: str, code: str, name: str, frequency: str, by: str,
              use: str = "research", rights: str | None = None, tradable: bool = False,
              volume_usd: float | None = None, detail: dict | None = None,
              published_after: int | None = None, lag_days: int = 0) -> dict:
    lab = tags.label(sid, name, frequency, tradable, volume_usd)
    extra = ("tradable",) if tradable else ()
    return {"id": sid[:100], "source_id": source, "code": code[:200], "name": name[:400],
            "frequency": frequency, "intended_use": use, "rights": rights,
            "asset_class": lab["asset_class"], "region": lab.get("region", ""),
            "units": lab.get("units", ""), "symbol": sid.split(".", 1)[-1][:60],
            "tags": tags.tags_for(sid, lab, extra),
            "labels": {k: v for k, v in lab.items() if k not in ("asset_class", "region",
                                                                  "units") and v is not None},
            "discovered_by": by, "detail": detail or {},
            "published_after": published_after, "lag_days": lag_days}


# ------------------------------------------------------------------ official data


ECB_FLOWS = "https://data-api.ecb.europa.eu/service/dataflow/ECB"
BIS_FLOWS = "https://stats.bis.org/api/v2/structure/dataflow/BIS"


def ecb(ctx: Context) -> list[dict]:
    """Euro reference rates the catalog does not have, still published in the last 30 days;
    and new ECB dataflows after the first run."""
    text = net.get(f"{sources.ECB_API}/EXR/D..EUR.SP00.A",
                   {"lastNObservations": 1, "format": "csvdata", "detail": "dataonly"}).text
    df = pd.read_csv(io.StringIO(text), dtype=str)
    out = []
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=30)
    for _, r in df.iterrows():
        ccy = r["CURRENCY"]
        code = f"EXR/D.{ccy}.EUR.SP00.A"
        if pd.Timestamp(r["TIME_PERIOD"]) < cutoff or ctx.known(f"ecb.{ccy}", "ecb", code):
            continue
        out.append(candidate(f"ecb.{ccy}", "ecb", code, f"{ccy} per EUR, ECB euro reference "
                             "rate", "D", "ecb", tradable=False, lag_days=1,
                             detail={"last": r["TIME_PERIOD"]}))
    out += _new_flows(ctx, "ecb", ECB_FLOWS, {"detail": "allstubs"})
    return out


def bis(ctx: Context) -> list[dict]:
    """Central bank policy rates for areas we do not have; new BIS dataflows."""
    text = net.get(f"{sources.BIS_API}/WS_CBPOL/1.0/D.",
                   {"lastNObservations": 1, "format": "csv", "detail": "dataonly"}).text
    df = pd.read_csv(io.StringIO(text), dtype=str)
    have = set(catalog.POLICY_AREAS.values())
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=120)
    out = []
    for _, r in df.iterrows():
        area = r["REF_AREA"]
        code = f"WS_CBPOL/D.{area}"
        if area in have or pd.Timestamp(r["TIME_PERIOD"]) < cutoff \
                or ctx.known(f"policy.{area}", "bis", code):
            continue
        out.append(candidate(f"policy.{area}", "bis", code, f"{area} central bank policy "
                             "rate, percent (BIS)", "D", "bis", lag_days=1,
                             detail={"last": r["TIME_PERIOD"]}))
    out += _new_flows(ctx, "bis", BIS_FLOWS, {})
    return out


def _new_flows(ctx: Context, name: str, url: str, params: dict) -> list[dict]:
    """New SDMX dataflows since the last run. A dataflow is a data set, not a series, so its
    candidate waits for someone to pick a series key."""
    flows = parse_flows(net.get(url, params).text)
    seen = ctx.seen(f"{name}-flows")
    ctx.remember(f"{name}-flows", set(flows) | (seen or set()))
    if seen is None:
        return []
    src = "ecb" if name == "ecb" else "bis"
    return [candidate(f"{name}flow.{fid}", src, f"{fid}/", f"New {name.upper()} data set: "
                      f"{title.strip()}", "M", name, detail={"dataflow": fid})
            for fid, title in flows.items() if fid not in seen]


def parse_flows(text: str) -> dict[str, str]:
    """Dataflow ids and names from an SDMX structure message, XML (ECB) or JSON (BIS)."""
    if text.lstrip().startswith("{"):
        doc = json.loads(text)
        return {f["id"]: f.get("name") or f["id"] for f in
                doc.get("data", {}).get("dataflows", [])}
    return dict(re.findall(r'<(?:str|structure):Dataflow[^>]*\bid="([^"]+)"[^>]*>.*?'
                           r'<com:Name[^>]*>([^<]+)</com:Name>', text, flags=re.S))


def treasury(ctx: Context) -> list[dict]:
    """New columns in the Treasury's daily par yield curve file."""
    year = pd.Timestamp.now().year
    text = net.get(sources.TREASURY_CSV.format(year=year), {
        "type": "daily_treasury_yield_curve", "field_tdr_date_value": year, "page": "",
        "_format": "csv"}, pause=1.0).text
    cols = [c.strip().strip('"') for c in text.splitlines()[0].split(",")[1:]]
    have = set(catalog.UST_TENORS.values())
    out = []
    for col in cols:
        tenor = re.sub(r"\s+", "", col.replace("Month", "M").replace("Mo", "M")
                       .replace("Yr", "Y").replace("Wk", "W")).replace(".", "_")
        sid = f"curve.UST_{tenor}"
        if col in have or ctx.known(sid, "treasury", col):
            continue
        out.append(candidate(sid, "treasury", col, f"US Treasury {col} par yield, percent "
                             "(Treasury daily par yield curve)", "D", "treasury", lag_days=1))
    return out


COT_API = sources.COT_API


def cftc(ctx: Context, top: int = 40) -> list[dict]:
    """The largest futures markets by open interest that we do not track (legacy report)."""
    latest = net.get(COT_API, {"$select": "max(report_date_as_yyyy_mm_dd) as d"}).json()[0]["d"]
    rows = net.get(COT_API, {
        "$select": "cftc_contract_market_code,market_and_exchange_names,open_interest_all",
        "$where": f"report_date_as_yyyy_mm_dd='{latest}'",
        "$order": "open_interest_all DESC", "$limit": top}).json()
    have = {code for code, _ in catalog.COT_CONTRACTS.values()}
    out = []
    for r in rows:
        code = r["cftc_contract_market_code"].strip()
        if code in have or not re.fullmatch(r"[0-9A-Z]{6}", code):
            continue
        sid = f"cot.C{code}_PCT"
        if ctx.known(sid, "cftc", f"{code}#pct"):
            continue
        what = r["market_and_exchange_names"].title()
        out.append(candidate(sid, "cftc", f"{code}#pct", f"{what}: speculators' net position, "
                             "percent of open interest (CFTC COT, weekly)", "W", "cftc",
                             lag_days=3, detail={"open_interest": int(float(
                                 r["open_interest_all"]))}))
    return out


def fred(ctx: Context) -> list[dict]:
    """Popular series in the FRED categories we track. Needs FRED_API_KEY; FRED's terms
    prefer the API for scripted use, so without a key this discoverer does not run. Series
    FRED tags as needing pre-approval, or with a copyright note, are left out."""
    key = os.environ.get("FRED_API_KEY", "").strip()
    if not key:
        raise sources.MissingKey("FRED_API_KEY is not set, so FRED discovery was skipped")
    categories = {94: "exchange rates", 22: "interest rates", 32217: "commodities",
                  33060: "money markets", 32991: "financial indicators"}
    have = {s.code for s in catalog.CATALOG.values() if s.source == "fred"}
    out = []
    for cat in categories:
        rows = net.get("https://api.stlouisfed.org/fred/category/series", {
            "category_id": cat, "api_key": key, "file_type": "json", "order_by": "popularity",
            "sort_order": "desc", "limit": 40}, pause=1.0).json().get("seriess", [])
        for r in rows:
            code, freq = r["id"], (r.get("frequency_short") or "D")[0]
            if code in have or freq not in "DWMQ" or int(r.get("popularity") or 0) < 30:
                continue
            notes = (r.get("notes") or "").lower()
            if "copyright" in notes and "public domain" not in notes:
                continue
            sid = f"fred.{code}"
            if ctx.known(sid, "fred", code):
                continue
            out.append(candidate(sid, "fred", code, r["title"], freq, "fred",
                                 detail={"popularity": r.get("popularity")}))
    return out


def eia(ctx: Context) -> list[dict]:
    """New EIA data routes after the first run. Needs EIA_API_KEY; skipped without it."""
    key = os.environ.get("EIA_API_KEY", "").strip()
    if not key:
        raise sources.MissingKey("EIA_API_KEY is not set, so EIA discovery was skipped")
    routes = net.get("https://api.eia.gov/v2/", {"api_key": key}).json() \
        .get("response", {}).get("routes", [])
    ids = {r["id"]: r.get("name", r["id"]) for r in routes}
    seen = ctx.seen("eia-routes")
    ctx.remember("eia-routes", set(ids) | (seen or set()))
    if seen is None:
        return []
    return [candidate(f"eiaroute.{rid}", "eia", f"{rid}/", f"New EIA data set: {name}", "W",
                      "eia") for rid, name in ids.items() if rid not in seen]


# ------------------------------------------------------------------ listings


def sec_etfs(ctx: Context) -> list[dict]:
    """New ETFs in the SEC's yearly fund list (and exchange-listed trusts), after the first
    run. No price source with a recorded licence covers them yet, so they wait."""
    from ..markets import sources as ms

    year = pd.Timestamp.now().year
    text = net.get(ms.SERIES_URL.format(y=year), pause=0.2).text
    series = ms.parse_sec_series(text)
    trusts = ms.parse_sec_exchange(net.get(ms.EXCHANGE_URL, pause=0.2).json())
    df = pd.concat([series[["ticker", "name"]], trusts[["ticker", "name"]]], ignore_index=True)
    df = df.dropna(subset=["ticker"]).drop_duplicates("ticker")
    tickers = set(df["ticker"])
    seen = ctx.seen("sec-etfs")
    ctx.remember("sec-etfs", tickers | (seen or set()))
    if seen is None:
        return []
    out = []
    for _, r in df[~df["ticker"].isin(seen)].head(60).iterrows():
        sid = f"etf.{r['ticker']}"
        if not ctx.known(sid):
            out.append(candidate(sid, "sec", r["ticker"], f"{r['name']} (ETF)", "D", "sec",
                                 tradable=True))
    return out


KRAKEN_PAIRS = "https://api.kraken.com/0/public/AssetPairs"
KRAKEN_TICKER = "https://api.kraken.com/0/public/Ticker"
#: Kraken pairs worth a candidate: at least this much traded in 24 hours, in US dollars.
KRAKEN_MIN_USD = 5e6


def kraken(ctx: Context) -> list[dict]:
    """Kraken US dollar pairs with real volume, and any new USD listing after the first run.
    Kraken has a daily history endpoint, so these can pass the gate (team only)."""
    pairs = net.get(KRAKEN_PAIRS, pause=1.0).json()["result"]
    ticker = net.get(KRAKEN_TICKER, pause=1.0).json()["result"]
    usd = {k: p for k, p in pairs.items() if p.get("quote") in ("ZUSD", "USD")
           and p.get("status", "online") == "online" and ".d" not in k}
    seen = ctx.seen("kraken-pairs")
    ctx.remember("kraken-pairs", set(usd) | (seen or set()))
    out = []
    for k, p in usd.items():
        t = ticker.get(k) or {}
        try:
            vol = float(t["v"][1]) * float(t["p"][1])
        except (KeyError, IndexError, ValueError):
            vol = 0.0
        new = seen is not None and k not in seen
        if vol < KRAKEN_MIN_USD and not (new and vol >= 1e6):
            continue
        alt = p["altname"]
        sid = f"kraken.{alt}"
        if ctx.known(sid, "kraken", alt):
            continue
        base = p.get("wsname", alt).split("/")[0]
        out.append(candidate(sid, "kraken", alt, f"{base} in US dollars on Kraken, daily close",
                             "D", "kraken", rights="internal", tradable=True, volume_usd=vol,
                             detail={"volume_24h_usd": round(vol), "new_listing": new}))
    return out


def _listing(ctx: Context, name: str, symbols: set[str], source: str,
             label: Callable[[str], str]) -> list[dict]:
    seen = ctx.seen(f"{name}-listings")
    ctx.remember(f"{name}-listings", symbols | (seen or set()))
    if seen is None:
        return []
    out = []
    for sym in sorted(symbols - seen)[:30]:
        sid = f"{name}.{re.sub(r'[^A-Za-z0-9_.-]', '_', sym)}"
        if not ctx.known(sid, source, sym):
            out.append(candidate(sid, source, sym, label(sym), "D", name, rights="internal",
                                 tradable=True, detail={"new_listing": True}))
    return out


def coinbase(ctx: Context) -> list[dict]:
    rows = net.get("https://api.exchange.coinbase.com/products").json()
    syms = {r["id"] for r in rows if r.get("quote_currency") == "USD"
            and r.get("status") == "online"}
    return _listing(ctx, "coinbase", syms, "coinbase",
                    lambda s: f"{s.split('-')[0]} in US dollars on Coinbase Exchange")


def gemini(ctx: Context) -> list[dict]:
    syms = {s.upper() for s in net.get("https://api.gemini.com/v1/symbols").json()
            if s.endswith("usd")}
    return _listing(ctx, "gemini", syms, "gemini",
                    lambda s: f"{s[:-3]} in US dollars on Gemini")


def binanceus(ctx: Context) -> list[dict]:
    info = net.get("https://api.binance.us/api/v3/exchangeInfo").json()
    syms = {s["symbol"] for s in info.get("symbols", []) if s.get("status") == "TRADING"
            and s.get("quoteAsset") in ("USD", "USDT")}
    return _listing(ctx, "binanceus", syms, "binanceus",
                    lambda s: f"{s} on Binance.US")


def hyperliquid(ctx: Context) -> list[dict]:
    meta = net.post("https://api.hyperliquid.xyz/info", {"type": "meta"}).json()
    syms = {u["name"] for u in meta.get("universe", []) if not u.get("isDelisted")}
    return _listing(ctx, "hyperliquid", syms, "hyperliquid",
                    lambda s: f"{s} perpetual on Hyperliquid")


# ------------------------------------------------------------------ Base pools

BASE_RPC = "https://base-rpc.publicnode.com"
UNISWAP_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"
AERODROME_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A"
UNI_FEES = (100, 500, 3000, 10000)
AERO_SPACINGS = (1, 50, 100, 200, 2000)
#: A pool is deep enough when its quote side holds at least this many US dollars (the same
#: bar as web/scripts/onchain-discover.ts uses, 50,000).
POOL_MIN_USD = 40_000
ONCHAIN_REGISTRY = ROOT / "web/live/src/venues/onchain-registry.json"
#: Pools the gate enrolled since the last refresh, joined to the feed at load (DEC-0078).
ONCHAIN_ENROLLED = ROOT / "web/live/src/venues/onchain-enrolled.json"
#: Base quote tokens the live feed prices against (web/live/src/venues/onchainRegistry.ts).
BASE_QUOTES = {"USDC": ("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 6),
               "WETH": ("0x4200000000000000000000000000000000000006", 18)}
#: The deepest WETH/USDC pool (Uniswap v3 0.05%), whose price turns WETH depth into dollars.
ETH_USDC_POOL = "0xd0b53d9277642d899df5c87a3966a349a798f224"


def onchain_config(path: Path = ONCHAIN_REGISTRY) -> tuple[dict[str, tuple[str, int]], set[str]]:
    """The Base tokens the live on-chain feed (the Parity price, DEC-0065) prices, and every pool
    it reads on any chain, from its registry file. A token is named by the wrapped form its
    pools trade (CBBTC for BTC on Base) or by its ticker."""
    reg = json.loads(path.read_text())
    tokens: dict[str, tuple[str, int]] = dict(BASE_QUOTES)
    pools: set[str] = set()
    for t in reg.get("tokens", []):
        for p in t.get("pools", []):
            pools.add(p["pool"].lower())
            if p.get("chain") == "base":
                label = p.get("via") or t["sym"].removesuffix("-USD")
                name = re.sub(r"[^A-Z0-9]", "", label.upper())
                tokens.setdefault(name, (p["base"].lower(), int(p["decimals"])))
    enrolled = path.with_name(ONCHAIN_ENROLLED.name)
    if enrolled.exists():
        for p in json.loads(enrolled.read_text()).get("pools", []):
            pools.add(p["pool"].lower())
    return tokens, pools


def _pad(addr: str) -> str:
    return addr.lower().replace("0x", "").rjust(64, "0")


def _rpc(calls: list[tuple[str, str]]) -> list[str | None]:
    body = [{"jsonrpc": "2.0", "id": i, "method": "eth_call",
             "params": [{"to": to, "data": data}, "latest"]} for i, (to, data) in enumerate(calls)]
    res = net.post(BASE_RPC, body, pause=0.3).json()
    by_id = {r.get("id"): r.get("result") for r in res} if isinstance(res, list) else {}
    return [by_id.get(i) for i in range(len(calls))]


def base_pools(ctx: Context) -> list[dict]:
    """Deep Uniswap v3 and Aerodrome pools for our on-chain tokens that the feed does not use."""
    tokens, have = onchain_config()
    if "WETH" not in tokens or "USDC" not in tokens:
        return []
    # ETH in USDC from the deepest WETH/USDC pool, for pools priced in WETH.
    slot = _rpc([(ETH_USDC_POOL, "0x3850c7bd")])[0]
    eth = (int(slot[:66], 16) / 2 ** 96) ** 2 * 1e12 if slot and len(slot) >= 66 else 0.0
    out = []
    for base, (addr, _) in tokens.items():
        for quote in ("USDC", "WETH"):
            if base in (quote, "USDC"):
                continue
            qa, qdec = tokens[quote]
            calls, meta = [], []
            for fee in UNI_FEES:
                calls.append((UNISWAP_FACTORY, f"0x1698ee82{_pad(addr)}{_pad(qa)}{fee:064x}"))
                meta.append(f"Uniswap v3 {fee / 10000:g}%")
            for ts in AERO_SPACINGS:
                calls.append((AERODROME_FACTORY, f"0x28af8d0b{_pad(addr)}{_pad(qa)}{ts:064x}"))
                meta.append(f"Aerodrome CL{ts}")
            found = [(f"0x{r[26:66]}", m) for r, m in zip(_rpc(calls), meta, strict=True)
                     if r and len(r) >= 66 and int(r, 16) != 0]
            if not found:
                continue
            bal = _rpc([(qa, f"0x70a08231{_pad(a)}") for a, _ in found])
            for (pool, venue), b in zip(found, bal, strict=True):
                q = int(b or "0x0", 16) / 10 ** qdec
                usd = q * eth if quote == "WETH" else q
                if usd < POOL_MIN_USD or pool.lower() in have:
                    continue
                sid = f"onchain.{pool.lower()}"
                if ctx.known(sid):
                    continue
                out.append(candidate(sid, "onchain", pool.lower(), f"{base}/{quote} {venue} pool "
                                     f"on Base, {usd / 1000:,.0f}k USD deep", "T", "base",
                                     use="feed", rights="public", volume_usd=usd,
                                     detail={"depth_usd": round(usd), "base": base,
                                             "quote": quote, "venue": venue}))
        time.sleep(0.2)
    return out


# ------------------------------------------------------------------ competitor mentions

#: Data people ask other products for, as phrases in posts the collector already keeps.
REQUESTS = {
    "level-2": ("level 2", "level ii", "market depth"), "order-book": ("order book",),
    "options-data": ("options chain", "options data", "option chain", "greeks"),
    "fundamentals": ("fundamentals", "earnings data", "financial statements"),
    "tick-data": ("tick data", "tick-by-tick"), "historical-data": ("historical data",),
    "futures-data": ("futures data",), "short-interest": ("short interest",),
    "economic-calendar": ("economic calendar",), "insider-trades": ("insider trading data",
                                                                    "insider buying"),
}
REQUEST_MIN_POSTS = 5


def competitors(ctx: Context, days: int = 180) -> list[dict]:
    """Data people ask other products for, counted from the competitor collector's posts."""
    from ..profiles import store as pstore

    if not pstore.DB.exists():
        return []
    con = sqlite3.connect(pstore.DB, timeout=30)
    try:
        since = (pd.Timestamp.now() - pd.Timedelta(days=days)).isoformat()
        rows = con.execute("SELECT lower(coalesce(title, '') || ' ' || coalesce(text, '')) "
                           "FROM items WHERE fetched_at >= ?", (since,)).fetchall()
    finally:
        con.close()
    out = []
    for slug, phrases in REQUESTS.items():
        n = sum(any(p in t for p in phrases) for (t,) in rows)
        sid = f"request.{slug}"
        if n >= REQUEST_MIN_POSTS and not ctx.known(sid):
            out.append(candidate(sid, "competitors", slug, f"Asked for in {n} public posts about "
                                 f"other products: {phrases[0]}", "D", "competitors",
                                 detail={"posts": n, "days": days}))
    return out


DISCOVERERS: dict[str, Callable[[Context], list[dict]]] = {
    "ecb": ecb, "bis": bis, "treasury": treasury, "cftc": cftc, "fred": fred, "eia": eia,
    "sec": sec_etfs, "kraken": kraken, "coinbase": coinbase, "gemini": gemini,
    "binanceus": binanceus, "hyperliquid": hyperliquid, "base": base_pools,
    "competitors": competitors,
}


def add(con: sqlite3.Connection, cand: dict) -> bool:
    """Record one candidate with a discovered event. Never enrols."""
    if db.get(con, cand["id"]) is not None:
        return False
    src = next((s for s in db.sources(con) if s["id"] == cand["source_id"]), None)
    rights = cand.get("rights") or (src["display_rights"] if src else "none")
    if src is not None:
        from .rights import narrowest
        rights = narrowest(rights, src["display_rights"])
    rec = Record(id=cand["id"], source_id=cand["source_id"], name=cand["name"],
                 frequency=cand["frequency"], status="candidate", display_rights=rights,
                 code=cand["code"], symbol=cand["symbol"], asset_class=cand["asset_class"],
                 region=cand["region"], units=cand["units"], tags=cand["tags"],
                 labels=cand["labels"], origin="discovered", intended_use=cand["intended_use"],
                 reason="waiting for the enrolment checks", discovered_by=cand["discovered_by"],
                 discovered_at=db.now(), published_after=cand.get("published_after"),
                 lag_days=int(cand.get("lag_days") or 0))
    db.put(con, rec)
    db.add_event(con, "discovered", series_id=rec.id, source_id=rec.source_id,
                 to_state="candidate", detail={"by": rec.discovered_by, **cand["detail"]})
    return True


def run(con: sqlite3.Connection, only: list[str] | None = None) -> dict:
    """Every discoverer once. Returns per discoverer: candidates added, or why it skipped."""
    report = {}
    for name, fn in DISCOVERERS.items():
        if only and name not in only:
            continue
        t0 = time.time()
        ctx = Context(con)
        try:
            found = fn(ctx)
            with con:
                added = sum(add(con, c) for c in found)
            report[name] = {"ok": True, "found": len(found), "added": added,
                            "seconds": round(time.time() - t0, 1)}
        except sources.MissingKey as exc:
            report[name] = {"ok": True, "skipped": str(exc)[:120]}
        except Exception as exc:  # one broken list never stops the others
            report[name] = {"ok": False, "error": f"{type(exc).__name__}: "
                            f"{sources.redact(str(exc))}"[:160]}
        con.commit()
    return report


def discover_if_due(con: sqlite3.Connection, hours: float = EVERY_HOURS) -> dict | None:
    """Run discovery when the last run is older than `hours`. Returns its report or None."""
    last = db.get_state(con, "discovery_at")
    if last and pd.Timestamp.now(tz="UTC") - pd.Timestamp(last) < pd.Timedelta(hours=hours):
        return None
    report = run(con)
    db.set_state(con, "discovery_at", db.now())
    db.set_state(con, "discovery_report", json.dumps(report))
    con.commit()
    return report
