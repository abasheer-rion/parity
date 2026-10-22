"""Where the Markets pages get their data, what each source's terms allow, and how to
read each response.

Chosen on 2026-10-22 after reading each provider's current terms (the decision record
and the markets data reference doc have the quotes):

    coingecko     crypto prices, one year of daily history and trending coins. Display is
                  allowed with the words "Data provided by CoinGecko" linked to their site.
                  Their terms discourage storing data, so we refresh within 24 hours and
                  overwrite instead of keeping an archive. No key: one year of history only.
    hyperliquid   perpetual futures funding and open interest from its public info API.
                  No data clause in its terms; its app is closed to US persons. Display is
                  marked "ask" until the owner decides (see the decision record).
    sec           the US fund universe (series and class tickers) and new fund filings from
                  EDGAR full-text search. Public information; SEC asks for a contact in the
                  user agent and at most 10 requests a second.

Rejected because their terms forbid showing data to other people: Coinbase Exchange,
Kraken, Deribit, OKX, Binance and Nasdaq's symbol directory. Bybit and Binance's live API
also block US addresses.

Fetching and parsing are separate: `fetch_*` touches the network, `parse_*` turns a body
into a DataFrame and is what the tests exercise with saved fixtures.
"""

from __future__ import annotations

import io
import os
import re
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import pandas as pd
import requests

from . import themes

USER_AGENT = "parity-research/0.1 (private research project)"
TIMEOUT = 30


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    provider: str
    what: str
    terms_url: str
    licence: str
    display: str  # may the shared site show it: "yes", "ask" (owner to decide) or "no"
    attribution: str | None = None
    attribution_url: str | None = None
    needs_contact: bool = False
    max_age_hours: float = 24.0  # fetch skips a source refreshed more recently than this
    required: bool = False  # nothing here is required: the product works without any of it
    catalog: str = ""  # slug in catalog/datasets


CG_TERMS = "https://www.coingecko.com/en/api_terms"
SOURCES: list[Source] = [
    Source("coingecko-markets", "CoinGecko coin markets", "CoinGecko",
           "Price, market value, volume and changes for the 100 largest coins",
           CG_TERMS, "Free public API; display allowed with attribution; no resale; "
           "refresh cached data at least every 24 hours", "yes",
           "Data provided by CoinGecko", "https://www.coingecko.com", max_age_hours=6,
           catalog="coingecko"),
    Source("coingecko-history", "CoinGecko daily prices", "CoinGecko",
           "One year of daily prices for the major coins", CG_TERMS,
           "Free public API; one year of history without a key", "yes",
           "Data provided by CoinGecko", "https://www.coingecko.com", max_age_hours=20,
           catalog="coingecko"),
    Source("coingecko-trending", "CoinGecko trending searches", "CoinGecko",
           "The coins most searched on CoinGecko in the last 24 hours", CG_TERMS,
           "Free public API; display allowed with attribution", "yes",
           "Data provided by CoinGecko", "https://www.coingecko.com", max_age_hours=3,
           catalog="coingecko"),
    Source("hyperliquid-perps", "Hyperliquid perpetual futures", "Hyperliquid",
           "Funding rate, open interest, prices and maximum leverage for every perp",
           "https://app.hyperliquid.xyz/terms", "Public info API, no key; terms have no "
           "data clause; the app is not offered to US persons", "ask",
           "Perpetual futures data from Hyperliquid's public API", "https://hyperliquid.xyz",
           max_age_hours=1),
    Source("hyperliquid-funding", "Hyperliquid funding history", "Hyperliquid",
           "Hourly funding rates for the major perps over the last 30 days",
           "https://app.hyperliquid.xyz/terms", "Public info API, no key", "ask",
           "Perpetual futures data from Hyperliquid's public API", "https://hyperliquid.xyz",
           max_age_hours=6),
    Source("sec-funds", "SEC fund series and classes", "US Securities and Exchange Commission",
           "Every registered fund series and share class with a ticker, plus exchange-listed "
           "trusts such as spot bitcoin ETFs", "https://www.sec.gov/privacy#dissemination",
           "Public information; may be copied or distributed; cite the SEC", "yes",
           "Source: SEC EDGAR", "https://www.sec.gov/edgar", needs_contact=True,
           max_age_hours=24),
    Source("sec-filings", "SEC new fund filings", "US Securities and Exchange Commission",
           "New fund registrations (N-1A), new fund series (485APOS) and trust "
           "registrations such as spot crypto ETFs (S-1), last 60 days",
           "https://www.sec.gov/privacy#dissemination", "Public information; cite the SEC",
           "yes", "Source: SEC EDGAR", "https://www.sec.gov/edgar", needs_contact=True,
           max_age_hours=6),
]
BY_ID = {s.id: s for s in SOURCES}

#: Coins with a year of daily history on the Crypto page. CoinGecko ids.
MAJORS = ["bitcoin", "ethereum", "solana", "ripple", "binancecoin", "dogecoin", "cardano",
          "tron", "chainlink", "avalanche-2", "sui", "hyperliquid"]
#: Perps with 30 days of hourly funding history (Hyperliquid coin names).
PERP_MAJORS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "HYPE", "BNB", "SUI"]
FTS_FORMS = {
    "N-1A": "New fund company registering its first funds",
    "485APOS": "Fund company adding a new fund or making a big change",
    "S-1": "Trust registering shares, the route for spot crypto and commodity ETFs",
}
FILINGS_DAYS = 60


class Skipped(Exception):
    """A source that cannot run here, for example because PARITY_CONTACT is not set."""


def contact() -> str | None:
    return os.environ.get("PARITY_CONTACT") or None


def user_agent(src: Source) -> str:
    c = contact()
    return f"{USER_AGENT[:-1]}; {c})" if c and src.needs_contact else USER_AGENT


def _request(src: Source, url: str, *, params: dict | None = None, json: dict | None = None,
             retries: int = 3, pause: float = 0.0) -> requests.Response:
    last: Exception | None = None
    for attempt in range(retries):
        if pause:
            time.sleep(pause)
        try:
            headers = {"User-Agent": user_agent(src), "Accept-Encoding": "gzip, deflate"}
            if json is not None:
                resp = requests.post(url, json=json, timeout=TIMEOUT, headers=headers)
            else:
                resp = requests.get(url, params=params, timeout=TIMEOUT, headers=headers)
            if resp.status_code == 429:  # free endpoints throttle; back off politely
                time.sleep(20 * (attempt + 1))
                last = RuntimeError("HTTP 429 (rate limited)")
                continue
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            last = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(f"{src.id}: {url} failed: {last}")


def now() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None


# ------------------------------------------------------------------ CoinGecko

CG = "https://api.coingecko.com/api/v3"


def parse_coingecko_markets(payload: list[dict], fetched_at: datetime) -> pd.DataFrame:
    rows = []
    for c in payload:
        rows.append({
            "fetched_at": fetched_at, "id": c["id"], "symbol": str(c.get("symbol", "")).upper(),
            "name": c.get("name", c["id"]), "rank": c.get("market_cap_rank"),
            "price_usd": _num(c.get("current_price")), "market_cap_usd": _num(c.get("market_cap")),
            "volume_24h_usd": _num(c.get("total_volume")),
            "change_24h_pct": _num(c.get("price_change_percentage_24h_in_currency",
                                         c.get("price_change_percentage_24h"))),
            "change_7d_pct": _num(c.get("price_change_percentage_7d_in_currency")),
            "change_30d_pct": _num(c.get("price_change_percentage_30d_in_currency")),
            "change_1y_pct": _num(c.get("price_change_percentage_1y_in_currency")),
            "ath_usd": _num(c.get("ath")), "ath_change_pct": _num(c.get("ath_change_percentage")),
            "ath_date": (c.get("ath_date") or "")[:10] or None,
            "circulating_supply": _num(c.get("circulating_supply")),
            "max_supply": _num(c.get("max_supply")),
            "last_updated": c.get("last_updated"),
        })
    df = pd.DataFrame(rows)
    if not df.empty:
        df["rank"] = pd.to_numeric(df["rank"], errors="coerce")
    return df


def parse_coingecko_chart(payload: dict, coin: str) -> pd.DataFrame:
    """Daily points. The last point is often 'now' rather than midnight, so one value per
    UTC date is kept: the latest seen for that date."""
    def col(name):
        return {int(t): _num(v) for t, v in payload.get(name, [])}
    prices, caps, vols = col("prices"), col("market_caps"), col("total_volumes")
    rows = [{"date": datetime.fromtimestamp(t / 1000, UTC).date(), "coin": coin,
             "price_usd": p, "market_cap_usd": caps.get(t), "volume_usd": vols.get(t)}
            for t, p in sorted(prices.items()) if p is not None]
    df = pd.DataFrame(rows, columns=["date", "coin", "price_usd", "market_cap_usd", "volume_usd"])
    return df.drop_duplicates("date", keep="last").reset_index(drop=True)


def parse_coingecko_trending(payload: dict, fetched_at: datetime) -> pd.DataFrame:
    rows = []
    for i, entry in enumerate(payload.get("coins", []), 1):
        c = entry.get("item", entry)
        data = c.get("data") or {}
        change = (data.get("price_change_percentage_24h") or {}).get("usd")
        rows.append({
            "fetched_at": fetched_at, "position": i, "id": c.get("id"),
            "symbol": str(c.get("symbol", "")).upper(), "name": c.get("name"),
            "market_cap_rank": c.get("market_cap_rank"), "price_usd": _num(data.get("price")),
            "change_24h_pct": _num(change),
            "market_cap_usd": _num(str(data.get("market_cap", "")).replace("$", "")
                                   .replace(",", "")),
            "volume_24h_usd": _num(str(data.get("total_volume", "")).replace("$", "")
                                   .replace(",", "")),
        })
    return pd.DataFrame(rows)


def fetch_coingecko_markets(src: Source) -> dict[str, pd.DataFrame]:
    params = {"vs_currency": "usd", "order": "market_cap_desc", "per_page": 100, "page": 1,
              "price_change_percentage": "24h,7d,30d,1y"}
    body = _request(src, f"{CG}/coins/markets", params=params).json()
    return {"crypto_markets": parse_coingecko_markets(body, now())}


def fetch_coingecko_history(src: Source, coins: list[str] | None = None) -> dict:
    frames = []
    for i, coin in enumerate(coins or MAJORS):
        body = _request(src, f"{CG}/coins/{coin}/market_chart", pause=3.0 if i else 0.0,
                        params={"vs_currency": "usd", "days": 365, "interval": "daily"}).json()
        frames.append(parse_coingecko_chart(body, coin))
    return {"crypto_daily": pd.concat(frames, ignore_index=True)}


def fetch_coingecko_trending(src: Source) -> dict[str, pd.DataFrame]:
    return {"crypto_trending": parse_coingecko_trending(
        _request(src, f"{CG}/search/trending").json(), now())}


# ------------------------------------------------------------------ Hyperliquid

HL = "https://api.hyperliquid.xyz/info"
HOURS_PER_YEAR = 24 * 365


def parse_hyperliquid_meta(payload: list, fetched_at: datetime) -> pd.DataFrame:
    """metaAndAssetCtxs: [meta with the coin list, one context per coin in the same order]."""
    meta, ctxs = payload[0], payload[1]
    rows = []
    for coin, ctx in zip(meta["universe"], ctxs, strict=False):
        mark = _num(ctx.get("markPx"))
        oi = _num(ctx.get("openInterest"))
        prev = _num(ctx.get("prevDayPx"))
        funding = _num(ctx.get("funding"))
        rows.append({
            "fetched_at": fetched_at, "venue": "hyperliquid", "coin": coin["name"],
            "max_leverage": coin.get("maxLeverage"), "delisted": bool(coin.get("isDelisted")),
            "funding_hourly": funding,
            "funding_annual_pct": funding * HOURS_PER_YEAR * 100 if funding is not None else None,
            "open_interest_coins": oi, "mark_px": mark, "oracle_px": _num(ctx.get("oraclePx")),
            "premium": _num(ctx.get("premium")), "day_volume_usd": _num(ctx.get("dayNtlVlm")),
            "prev_day_px": prev,
            "open_interest_usd": oi * mark if oi is not None and mark is not None else None,
            "change_24h_pct": (mark / prev - 1) * 100 if mark and prev else None,
        })
    return pd.DataFrame(rows)


def parse_hyperliquid_funding(payload: list[dict]) -> pd.DataFrame:
    rows = [{"time": pd.Timestamp(int(r["time"]), unit="ms", tz="UTC"), "coin": r["coin"],
             "funding_rate": _num(r.get("fundingRate")), "premium": _num(r.get("premium"))}
            for r in payload]
    return pd.DataFrame(rows, columns=["time", "coin", "funding_rate", "premium"])


def fetch_hyperliquid_perps(src: Source) -> dict[str, pd.DataFrame]:
    body = _request(src, HL, json={"type": "metaAndAssetCtxs"}).json()
    return {"perps_snapshots": parse_hyperliquid_meta(body, now())}


def fetch_hyperliquid_funding(src: Source, coins: list[str] | None = None,
                              days: int = 30) -> dict[str, pd.DataFrame]:
    frames = []
    start = int((now() - timedelta(days=days)).timestamp() * 1000)
    for coin in coins or PERP_MAJORS:
        t = start
        for _ in range(4):  # the API returns at most 500 rows per call; 30 days is 720
            rows = _request(src, HL, json={"type": "fundingHistory", "coin": coin,
                                           "startTime": t}, pause=0.3).json()
            if not rows:
                break
            frames.append(parse_hyperliquid_funding(rows))
            t = int(rows[-1]["time"]) + 1
            if len(rows) < 500:
                break
    df = pd.concat(frames, ignore_index=True) if frames else parse_hyperliquid_funding([])
    return {"perps_funding": df.drop_duplicates(["coin", "time"]).reset_index(drop=True)}


# ------------------------------------------------------------------ SEC EDGAR

SERIES_URL = ("https://www.sec.gov/files/investment/data/other/"
              "investment-company-series-class-information/investment-company-series-class-{y}.csv")
EXCHANGE_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
FTS_URL = "https://efts.sec.gov/LATEST/search-index"
SEC_PAUSE = 0.15  # stays well under the SEC's 10 requests a second

# Exchange-listed trusts (not 1940 Act funds) appear only in the company ticker file.
_TRUST_ETF = re.compile(r"\bETF\b|EXCHANGE[- ]TRADED|BITCOIN|ETHER(EUM)?\b|SOLANA|\bXRP\b|"
                        r"SPDR GOLD|ISHARES (GOLD|SILVER)|GRAYSCALE", re.I)
_NOT_ETF = re.compile(r"PHYSICAL|REALTY|REIT|BANCORP|FINANCIAL CORP|MINING|MINERS? INC|"
                      r"TECHNOLOGIES|HOLDINGS|\bINC\b|\bCORP\b|\bCO\b|\bLTD\b|\bPLC\b", re.I)


def is_etf_name(*names: str | None) -> bool:
    """1940 Act funds: we call a share class an ETF when its series, class or company name
    says so. Most ETFs do; a few older ones (for example some ProShares and Invesco QQQ)
    are caught by sponsor name. This is a name rule, not an official flag."""
    text = " ".join(n for n in names if isinstance(n, str)).upper()
    return bool(re.search(r"\bETF\b|\bETFS\b|EXCHANGE[- ]TRADED|PROSHARES TRUST|"
                          r"INVESCO QQQ TRUST|SELECT SECTOR SPDR|SPDR .*TRUST", text))


def parse_sec_series(text: str) -> pd.DataFrame:
    """The SEC's yearly list of every fund series and share class. One row per class with
    a ticker that our name rule calls an ETF."""
    df = pd.read_csv(io.StringIO(text.lstrip("\ufeff")), dtype=str)
    df = df[df["Class Ticker"].notna() & (df["Class Ticker"].str.strip() != "")]
    mask = [is_etf_name(s, c, e) for s, c, e in
            zip(df["Series Name"], df["Class Name"], df["Entity Name"], strict=True)]
    df = df[mask]

    def label(series: str, cls: str) -> str:
        cls = cls if isinstance(cls, str) else ""
        if not cls or cls.strip().lower() == series.strip().lower():
            return series
        return f"{series} {cls}" if "ETF" in cls.upper() and "ETF" not in series.upper() \
            else series
    out = pd.DataFrame({
        "ticker": df["Class Ticker"].str.strip().str.upper(),
        "name": [label(s, c) for s, c in zip(df["Series Name"], df["Class Name"], strict=True)],
        "issuer": df["Entity Name"].str.strip(),
        "cik": df["CIK Number"].str.lstrip("0"),
        "series_id": df["Series ID"],
        "series_number": pd.to_numeric(df["Series ID"].str[1:], errors="coerce"),
        "structure": "fund",
    })
    return out.drop_duplicates("ticker").reset_index(drop=True)


def parse_sec_exchange(payload: dict) -> pd.DataFrame:
    fields = payload["fields"]
    df = pd.DataFrame(payload["data"], columns=fields)
    keep = [bool(_TRUST_ETF.search(n or "")) and not _NOT_ETF.search(
        re.sub(r"\bETF\b", "", n or "")) for n in df["name"]]
    df = df[pd.Series(keep, index=df.index) & df["exchange"].isin(["NYSE", "Nasdaq", "CBOE"])]
    return pd.DataFrame({"ticker": df["ticker"].str.upper(), "name": df["name"],
                         "issuer": df["name"], "cik": df["cik"].astype(str),
                         "series_id": None, "series_number": None, "exchange": df["exchange"],
                         "structure": "trust"}).drop_duplicates("ticker").reset_index(drop=True)


def combine_funds(series: pd.DataFrame, trusts: pd.DataFrame, fetched_at: datetime,
                  previous_year: pd.DataFrame | None = None) -> pd.DataFrame:
    """One table of US-listed ETFs with themes. new_this_year marks series in this year's
    SEC list but not last year's, a rough sign of a recent launch or registration."""
    trusts = trusts[~trusts["ticker"].isin(series["ticker"])]
    df = pd.concat([series, trusts], ignore_index=True)
    df["exchange"] = df.get("exchange")
    df["themes"] = [themes.classify(n) for n in df["name"]]
    df["fetched_at"] = fetched_at
    df["new_this_year"] = False
    if previous_year is not None and not previous_year.empty:
        df["new_this_year"] = df["series_id"].notna() & \
            ~df["series_id"].isin(set(previous_year["series_id"]))
    return df.sort_values("ticker").reset_index(drop=True)


def _display_name(s: str) -> tuple[str, list[str]]:
    """'VS Trust  (SVIX, UVIX)  (CIK 0001793497)' -> ('VS Trust', ['SVIX', 'UVIX'])."""
    s = re.sub(r"\s*\(CIK \d+\)\s*$", "", s or "").strip()
    m = re.search(r"\(([A-Z0-9., -]+)\)\s*$", s)
    tickers = [t.strip() for t in m.group(1).split(",") if t.strip()] if m else []
    name = re.sub(r"\s+", " ", s[:m.start()] if m else s).strip()
    return name, tickers


def parse_sec_fts(payload: dict, fetched_at: datetime) -> pd.DataFrame:
    rows = []
    for hit in payload.get("hits", {}).get("hits", []):
        s = hit.get("_source", {})
        adsh = s.get("adsh") or hit.get("_id", "").split(":")[0]
        ciks = s.get("ciks") or [""]
        cik = str(ciks[0]).lstrip("0")
        name, tickers = _display_name((s.get("display_names") or [""])[0])
        root = (s.get("root_forms") or [s.get("form", "")])[0]
        rows.append({
            "fetched_at": fetched_at, "adsh": adsh, "form": s.get("form"), "root_form": root,
            "filed": s.get("file_date"), "cik": cik, "name": name, "tickers": tickers,
            "sic": (s.get("sics") or [None])[0], "description": s.get("file_description"),
            "url": f"https://www.sec.gov/Archives/edgar/data/{cik}/{adsh.replace('-', '')}/"
                   f"{adsh}-index.htm" if cik and adsh else None,
        })
    df = pd.DataFrame(rows, columns=["fetched_at", "adsh", "form", "root_form", "filed", "cik",
                                     "name", "tickers", "sic", "description", "url"])
    return df.drop_duplicates("adsh").reset_index(drop=True)


def keep_fund_filings(df: pd.DataFrame, fund_ciks: set[str]) -> pd.DataFrame:
    """S-1 is also how ordinary companies go public, so only trusts are kept: a known ETF
    company, or a name that says ETF, Trust or Fund and not Inc, Corp or Co."""
    if df.empty:
        return df
    name = df["name"].fillna("")
    fundlike = name.str.contains(r"\bETF\b|\bTrust\b|\bFund\b", case=False, regex=True) & \
        ~name.str.contains(r"\b(?:Inc|Corp|Corporation|Co|Ltd|plc)\b", case=False, regex=True)
    s1_ok = df["cik"].isin(fund_ciks) | fundlike
    return df[(df["root_form"] != "S-1") | s1_ok].reset_index(drop=True)


def fetch_sec_funds(src: Source) -> dict[str, pd.DataFrame]:
    year = date.today().year
    text = _request(src, SERIES_URL.format(y=year), pause=SEC_PAUSE).text
    series = parse_sec_series(text)
    try:
        prev = parse_sec_series(_request(src, SERIES_URL.format(y=year - 1),
                                         pause=SEC_PAUSE).text)
    except RuntimeError:
        prev = None
    trusts = parse_sec_exchange(_request(src, EXCHANGE_URL, pause=SEC_PAUSE).json())
    return {"etfs": combine_funds(series, trusts, now(), prev)}


def fetch_sec_filings(src: Source, days: int = FILINGS_DAYS, fund_ciks: set[str] | None = None,
                      max_pages: int = 5) -> dict[str, pd.DataFrame]:
    end = date.today()
    start = end - timedelta(days=days)
    frames = []
    for form in FTS_FORMS:
        for page in range(max_pages):
            params = {"forms": form, "dateRange": "custom", "startdt": start.isoformat(),
                      "enddt": end.isoformat(), "from": page * 100}
            body = _request(src, FTS_URL, params=params, pause=SEC_PAUSE).json()
            df = parse_sec_fts(body, now())
            frames.append(df)
            total = body.get("hits", {}).get("total", {}).get("value", 0)
            if (page + 1) * 100 >= total or df.empty:
                break
    df = pd.concat(frames, ignore_index=True).drop_duplicates("adsh")
    return {"fund_filings": keep_fund_filings(df, fund_ciks or set())}


FETCHERS = {
    "coingecko-markets": fetch_coingecko_markets,
    "coingecko-history": fetch_coingecko_history,
    "coingecko-trending": fetch_coingecko_trending,
    "hyperliquid-perps": fetch_hyperliquid_perps,
    "hyperliquid-funding": fetch_hyperliquid_funding,
    "sec-funds": fetch_sec_funds,
    "sec-filings": fetch_sec_filings,
}


def fetch(src: Source, **kwargs) -> dict[str, pd.DataFrame]:
    if src.needs_contact and not contact():
        raise Skipped("PARITY_CONTACT is not set (the SEC asks callers to give a contact)")
    return FETCHERS[src.id](src, **kwargs)
