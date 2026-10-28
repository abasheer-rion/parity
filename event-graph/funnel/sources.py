"""Every source the funnel reads: how to cut a response into raw entries, and how to read one entry
as an item.

parse(adapter, body) -> raw entries {ext_key, url, title, published_at, body}. body is the entry
  uncut, exactly as the source gave it (XML as a dict, JSON as is), so later rules can re-read it.
to_item(adapter, entry body) -> the item the dedupe and digest read, or None when the entry is kept
  raw only (a GDELT event between two towns, a halt with no news behind it).
No rule here filters what lands raw; filters belong in to_item.
"""

import csv
import hashlib
import html
import io
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from datetime import UTC, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

SUMMARY_MAX = 300
TEXT_MAX = 4000  # how much of an entry's text the fact rules read
ET_TZ = timezone(timedelta(hours=-4))  # US Eastern (daylight); halts and OFAC post in ET

CAMEO_ROOT = {
    "16": ("reduces relations with", "policy"),
    "17": ("coerces", "coercion"),
    "18": ("assaults", "conflict"),
    "19": ("fights", "conflict"),
    "20": ("uses mass violence against", "conflict"),
}
# Nasdaq halt reasons that mean news is coming or the listing is in trouble; LUDP/LUDS/M are
# volatility pauses and stay raw only.
HALT_NEWS = {
    "T1": "news pending",
    "T2": "news released",
    "T5": "single stock pause",
    "T6": "extraordinary activity",
    "T8": "ETF halt",
    "T12": "information requested",
    "H4": "non-compliance",
    "H9": "not current in filings",
    "H10": "SEC trading suspension",
    "H11": "regulatory concern",
    "O1": "operations halt",
    "IPO1": "IPO not yet trading",
}
# 8-K items -> kind, for the ones a mechanism can read
SEC_ITEMS = {
    "1.01": "deal",
    "1.02": "deal",
    "1.03": "financial_stress",
    "1.05": "capacity_loss",
    "2.01": "deal",
    "2.02": "earnings",
    "2.04": "financial_stress",
    "2.05": "capacity_loss",
    "2.06": "financial_stress",
    "3.01": "financial_stress",
    "4.02": "financial_stress",
    "5.01": "deal",
    "5.02": "leader_change",
}
SEC_MATERIAL_FORMS = {"SC 13D", "SC 13D/A", "SC TO-T", "DEFM14A", "15-12B", "25-NSE", "NT 10-K"}


def clip(s, n=SUMMARY_MAX):
    s = re.sub(r"<[^>]+>", " ", html.unescape(s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def ts(s):
    if not s:
        return None
    if isinstance(s, (int, float)):
        return datetime.fromtimestamp(s / 1000 if s > 1e11 else s, UTC)
    try:
        return parsedate_to_datetime(s)
    except (TypeError, ValueError):
        pass
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=UTC)
    except ValueError:
        pass
    for fmt in ("%Y%m%dT%H%M%SZ", "%Y%m%d%H%M%S", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            d = datetime.strptime(s.replace("UT", "+0000") if fmt.endswith("%z") else s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=UTC)
        except ValueError:
            continue
    return None


def iso(d):
    return d.isoformat() if d else None


# ───────────── XML -> dict, keeping every field ─────────────


def local(tag):
    return tag.rsplit("}", 1)[-1]


def xml_dict(el):
    d = {f"@{local(k)}": v for k, v in el.attrib.items()}
    for c in el:
        v = xml_dict(c) if (len(c) or c.attrib) else (c.text or "").strip()
        k = local(c.tag)
        if k in d:
            d[k] = (d[k] if isinstance(d[k], list) else [d[k]]) + [v]
        else:
            d[k] = v
    if (len(el) or el.attrib) and el.text and el.text.strip():
        d["#text"] = el.text.strip()
    return d


def text(v):
    """A field's text, whether the dict made it a string, a {#text} dict or a list of them."""
    if isinstance(v, list):
        v = v[0] if v else ""
    if isinstance(v, dict):
        return v.get("#text") or v.get("@href") or ""
    return v or ""


def link_of(d):
    links = d.get("link")
    if isinstance(links, list):
        alt = [
            x for x in links if isinstance(x, dict) and x.get("@rel", "alternate") == "alternate"
        ]
        return text(alt[0] if alt else links[0]).strip()
    return text(links).strip()


def feed_entries(body):
    """RSS items or Atom entries, every child kept."""
    root = ET.fromstring(body)
    els = [e for e in root.iter() if local(e.tag) in ("item", "entry")]
    out = []
    for e in els:
        d = xml_dict(e)
        title = clip(text(d.get("title")), 400)
        url = link_of(d)
        published = ts(
            text(d.get("pubDate") or d.get("published") or d.get("updated") or d.get("date"))
        )
        key = text(d.get("guid") or d.get("id")) or url or f"{title}|{published}"
        if not (title or url):
            continue
        out.append(
            {
                "ext_key": key.strip(),
                "url": url,
                "title": title,
                "published_at": published,
                "body": d,
            }
        )
    return out


# ───────────── parse: response body -> raw entries ─────────────


def parse_halts(body):
    out = []
    for e in feed_entries(body):
        d = e["body"]
        sym, date_, time_ = d.get("IssueSymbol", ""), d.get("HaltDate", ""), d.get("HaltTime", "")
        try:
            at = datetime.strptime(f"{date_.strip()} {time_[:8]}", "%m/%d/%Y %H:%M:%S").replace(
                tzinfo=ET_TZ
            )
        except ValueError:
            at = e["published_at"]
        e.update(
            ext_key=f"{sym}|{date_.strip()}|{time_}",
            url=f"https://www.nasdaqtrader.com/trader.aspx?id=TradeHalts#{sym}",
            published_at=at,
        )
        out.append(e)
    return out


def parse_gdelt_doc(body):
    if body.lstrip()[:1] != b"{":
        raise RuntimeError(clip(body.decode("utf-8", "replace"), 160))  # errors come as plain text
    return [
        {
            "ext_key": a["url"],
            "url": a["url"],
            "title": a.get("title", "").strip(),
            "published_at": ts(a.get("seendate")),
            "body": a,
        }
        for a in json.loads(body).get("articles", [])
    ]


def parse_gdelt_events(body):
    """Every row of the 15-minute export (61 columns), kept as the list GDELT gives."""
    with zipfile.ZipFile(io.BytesIO(body)) as z:
        rows = z.read(z.namelist()[0]).decode("utf-8", "replace")
    return [
        {
            "ext_key": r[0],
            "url": r[60],
            "title": None,
            "published_at": ts(r[59]),
            "body": r,
        }
        for r in csv.reader(io.StringIO(rows), delimiter="\t")
        if len(r) >= 61
    ]


def parse_alpaca(body):
    return [
        {
            "ext_key": str(n["id"]),
            "url": n["url"],
            "title": n["headline"],
            "published_at": ts(n["created_at"]),
            "body": n,
        }
        for n in json.loads(body).get("news", [])
        if n.get("url")
    ]


def parse_usgs(body):
    out = []
    for f in json.loads(body)["features"]:
        p = f["properties"]
        out.append(
            {
                "ext_key": f["id"],
                "url": p.get("url"),
                "title": p.get("title"),
                "published_at": ts(p["time"]),
                "body": f,
            }
        )
    return out


def parse_fedreg_pi(body):
    return [
        {
            "ext_key": r["document_number"],
            "url": r.get("html_url"),
            "title": r.get("title"),
            "published_at": ts(r.get("filed_at")),  # filed = public, days before publication
            "body": r,
        }
        for r in json.loads(body).get("results", [])
        if r.get("filed_at")
    ]


def parse_ofac(body):
    page = body.decode("utf-8", "replace")
    out = []
    for ymd, suffix, title in re.findall(
        r'href="/recent-actions/(\d{8})(_\d+)?"[^>]*>([^<]+)<', page
    ):
        key = ymd + (suffix or "")
        out.append(
            {
                "ext_key": key,
                "url": f"https://ofac.treasury.gov/recent-actions/{key}",
                "title": html.unescape(title).strip(),
                "published_at": datetime(int(ymd[:4]), int(ymd[4:6]), int(ymd[6:]), tzinfo=ET_TZ),
                "body": {"date": ymd, "title": html.unescape(title).strip()},
            }
        )
    return out


def parse_nyt(body):
    """NYT Times Newswire: every article the moment nytimes.com publishes it."""
    return [
        {
            "ext_key": a.get("uri") or a["url"],
            "url": a["url"],
            "title": a.get("title"),
            "published_at": ts(a.get("first_published_date") or a.get("published_date")),
            "body": a,
        }
        for a in json.loads(body).get("results") or []
        if a.get("url")
    ]


def parse_guardian(body):
    return [
        {
            "ext_key": a["id"],
            "url": a["webUrl"],
            "title": a.get("webTitle"),
            "published_at": ts(a.get("webPublicationDate")),
            "body": a,
        }
        for a in json.loads(body)["response"].get("results", [])
    ]


PARSE = {
    "rss": feed_entries,
    "gdacs": feed_entries,
    "sec_atom": feed_entries,
    "halts": parse_halts,
    "gdelt_doc": parse_gdelt_doc,
    "gdelt_events": parse_gdelt_events,
    "alpaca_news": parse_alpaca,
    "nyt": parse_nyt,
    "guardian": parse_guardian,
    "usgs": parse_usgs,
    "fedreg_pi": parse_fedreg_pi,
    "ofac": parse_ofac,
}


# Fields that change on every poll without the entry changing; left out of the version hash so
# they do not land a new copy each time (they are still stored with the copy that does land).
VOLATILE = {"fedreg_pi": {"page_views"}, "rss": {"post-id"}}  # post-id: Al Jazeera rotates it


def parse(adapter, body):
    out = PARSE[adapter](body)
    skip = VOLATILE.get(adapter, set())
    for e in out:
        b = {k: v for k, v in e["body"].items() if k not in skip} if skip else e["body"]
        e["version"] = hashlib.sha256(
            json.dumps(b, sort_keys=True, default=str).encode()
        ).hexdigest()
    return out


# ───────────── to_item: one raw entry -> what the dedupe reads ─────────────


def item_rss(d, url):
    desc = text(d.get("description") or d.get("summary") or d.get("content") or "")
    return {
        "title": clip(text(d.get("title")), 400),
        "summary": clip(desc),
        "text": clip(desc, TEXT_MAX),
        "publisher": text(d.get("source")) or urllib.parse.urlsplit(url or "").hostname,
    }


def item_gdacs(d, url):
    """GDACS colours its alerts green, orange or red; green is routine."""
    it = item_rss(d, url)
    level = text(d.get("alertlevel")) or it["title"].split(" ", 1)[0]
    it.update(
        kind="capacity_loss",
        material=level.lower() in ("orange", "red"),
        attrs={"alert": level, "event": text(d.get("eventtype"))},
    )
    return it


def item_halt(d, url):
    code = (d.get("ReasonCode") or "").strip()
    if code not in HALT_NEWS:
        return None
    sym, name = d.get("IssueSymbol", ""), d.get("IssueName", "")
    resumed = (d.get("ResumptionTradeTime") or "").strip()
    return {
        "title": f"{name} ({sym}) halted on {d.get('Market', 'Nasdaq')}: {HALT_NEWS[code]}",
        "summary": f"Halt code {code}"
        + (f", resumed {resumed} ET" if resumed else ", not resumed"),
        "publisher": "nasdaqtrader.com",
        "tickers": [sym],
        "kind": "halt",
        "material": code in ("T1", "T2", "T12", "H4", "H9", "H10", "H11", "O1"),
        "attrs": {"halt_code": code},
    }


def item_sec(d, url):
    m = re.match(r"(\S+(?: \S+)?) - (.*) \((\d{10})\) \((\w+)\)", text(d.get("title")))
    if not m or m.group(4) not in ("Filer", "Subject"):
        return None  # a Form 4's "Reporting" copy: the issuer's copy carries the same filing
    form, name, cik = m.groups()[:3]
    summ = html.unescape(text(d.get("summary")))
    items = re.findall(r"Item (\d\.\d\d): ([^<&\n]+)", summ)
    kinds = [SEC_ITEMS[n] for n, _ in items if n in SEC_ITEMS]
    lead = "; ".join(f"{n} {t.strip()}" for n, t in items)
    return {
        "title": f"{form} {name}" + (f": {lead}" if lead else ""),
        "summary": clip(lead or summ),
        "text": clip(summ, TEXT_MAX),
        "publisher": "sec.gov",
        "kind": kinds[0] if kinds else "filing",
        "material": bool(kinds) or form in SEC_MATERIAL_FORMS,
        "attrs": {"form": form, "cik": cik, "items": [n for n, _ in items]},
    }


def item_gdelt_event(r, url):
    """Keeps root events of conflict, coercion and sanctions between countries or with a state
    side: local crime is not a market event.
    """
    if r[25] != "1" or r[28] not in CAMEO_ROOT:
        return None
    verb, kind = CAMEO_ROOT[r[28]]
    if r[27] == "163":
        verb, kind = "imposes sanctions or an embargo on", "sanction"
    n_articles, goldstein = int(r[33] or 0), float(r[30] or 0)
    intl = bool(r[7] and r[17] and r[7] != r[17])
    state = bool({"GOV", "MIL", "REB", "SPY"} & {r[12], r[13], r[22], r[23]} and (r[7] or r[17]))
    if not (intl or state or kind == "sanction") or (n_articles < 3 and kind != "sanction"):
        return None
    a1, a2 = r[6] or r[7], r[16] or r[17]
    where = r[52].split(",")[0] if r[52] else ""
    return {
        "title": f"{a1.title()} {verb} {(a2 or 'unnamed party').title()}"
        + (f" ({where})" if where else ""),
        "publisher": urllib.parse.urlsplit(url).hostname,
        "kind": kind,
        "material": kind == "sanction"
        or (kind == "conflict" and intl and (r[28] in ("19", "20") or goldstein <= -9)),
        "attrs": {
            "cameo": r[26],
            "goldstein": goldstein,
            "articles": n_articles,
            "countries": sorted({c for c in (r[7], r[17]) if c}),
        },
    }


def item_gdelt_doc(a, url):
    if a.get("language") not in (None, "English"):
        return None
    return {
        "title": a.get("title", "").strip(),
        "publisher": a.get("domain"),
        "attrs": {"country": a.get("sourcecountry")},
    }


def item_alpaca(n, url):
    return {
        "title": n["headline"],
        "summary": clip(n.get("summary")),
        "text": clip(n.get("summary"), TEXT_MAX),
        "publisher": n.get("source"),
        "tickers": n.get("symbols", []),
    }


def item_usgs(f, url):
    p = f["properties"]
    mag = p.get("mag") or 0
    if mag < 6 and p.get("alert") not in ("yellow", "orange", "red"):
        return None
    return {
        "title": f"M{mag} earthquake, {p.get('place')}",
        "summary": f"alert {p.get('alert') or 'none'}, tsunami flag {p.get('tsunami')}",
        "publisher": "usgs.gov",
        "kind": "capacity_loss",
        "material": mag >= 7 or p.get("alert") in ("orange", "red"),
        "attrs": {"mag": mag, "alert": p.get("alert")},
    }


def item_fedreg_pi(r, url):
    return {
        "title": r.get("title") or "",
        "summary": clip(", ".join(r.get("agency_names") or [])),
        "publisher": "federalregister.gov",
        "attrs": {"agencies": r.get("agency_names"), "type": r.get("type")},
    }


def item_ofac(d, url):
    return {
        "title": f"OFAC: {d['title']}",
        "publisher": "ofac.treasury.gov",
        "kind": "sanction",
        "material": bool(re.search(r"designations(?! removal)|sanctions", d["title"], re.I)),
    }


def item_nyt(a, url):
    return {
        "title": a.get("title") or "",
        "summary": clip(a.get("abstract")),
        "text": clip(a.get("abstract"), TEXT_MAX),
        "publisher": "nytimes.com",
        "attrs": {"section": a.get("section"), "orgs": a.get("org_facet") or []},
    }


def item_guardian(a, url):
    f = a.get("fields") or {}
    return {
        "title": a.get("webTitle") or "",
        "summary": clip(f.get("trailText")),
        "text": clip(f.get("trailText"), TEXT_MAX),
        "publisher": "theguardian.com",
        "attrs": {"section": a.get("sectionId")},
    }


TO_ITEM = {
    "rss": item_rss,
    "gdacs": item_gdacs,
    "sec_atom": item_sec,
    "halts": item_halt,
    "gdelt_doc": item_gdelt_doc,
    "gdelt_events": item_gdelt_event,
    "alpaca_news": item_alpaca,
    "nyt": item_nyt,
    "guardian": item_guardian,
    "usgs": item_usgs,
    "fedreg_pi": item_fedreg_pi,
    "ofac": item_ofac,
}


def to_item(adapter, body, url):
    return TO_ITEM[adapter](body, url)


# Feeds whose key goes on the URL: (query parameter, env var). Added at poll time, never stored.
KEY_PARAM = {"nyt": ("api-key", "NYT_API_KEY"), "guardian": ("api-key", "GUARDIAN_API_KEY")}

# ───────────── the feeds ─────────────
# (id, adapter, url, seconds between polls, license, env vars it needs). Checked against robots.txt
# on 2026-10-26. Publisher RSS is read for the headline, link and summary only; check a
# publisher's terms before showing its text to paying users.

RSS_OK = "public RSS; robots.txt allows (checked 2026-10-26)"
NEWS_RSS = "publisher RSS, robots.txt allows; headline + link + summary only (checked 2026-10-26)"
FEEDS = [
    # company press releases: the company's own words, usually first
    (
        "bw:home",
        "rss",
        "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFtRWA==",
        60,
        RSS_OK,
        None,
    ),
    ("prn:all", "rss", "https://www.prnewswire.com/rss/news-releases-list.rss", 60, RSS_OK, None),
    # exchanges and filings
    (
        "halts:nasdaq",
        "halts",
        "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts",
        30,
        RSS_OK,
        None,
    ),
    (
        "sec:current",
        "sec_atom",
        "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&count=100&output=atom",
        30,
        "SEC EDGAR fair access: declared user agent, under 10 requests a second",
        "SEC_USER_AGENT",
    ),
    # governments, regulators, central banks
    ("fed:press", "rss", "https://www.federalreserve.gov/feeds/press_all.xml", 60, RSS_OK, None),
    (
        "fedreg:pi",
        "fedreg_pi",
        "https://www.federalregister.gov/api/v1/public-inspection-documents/current.json",
        300,
        "Federal Register API, public domain",
        None,
    ),
    ("ofac:recent", "ofac", "https://ofac.treasury.gov/recent-actions", 120, RSS_OK, None),
    (
        "wh:actions",
        "rss",
        "https://www.whitehouse.gov/presidential-actions/feed/",
        120,
        RSS_OK,
        None,
    ),
    (
        "fda:press",
        "rss",
        "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml",
        120,
        RSS_OK,
        None,
    ),
    (
        "doj:press",
        "rss",
        "https://www.justice.gov/news/rss?type=press_release&m=1",
        120,
        RSS_OK,
        None,
    ),
    ("cftc:press", "rss", "https://www.cftc.gov/RSS/RSSGP/rssgp.xml", 600, RSS_OK, None),
    ("eia:today", "rss", "https://www.eia.gov/rss/todayinenergy.xml", 900, RSS_OK, None),
    ("ecb:press", "rss", "https://www.ecb.europa.eu/rss/press.html", 120, RSS_OK, None),
    ("boe:news", "rss", "https://www.bankofengland.co.uk/rss/news", 120, RSS_OK, None),
    ("boj:new", "rss", "https://www.boj.or.jp/en/rss/whatsnew.xml", 300, RSS_OK, None),
    (
        "ec:press",
        "rss",
        "https://ec.europa.eu/commission/presscorner/api/rss?language=en",
        300,
        RSS_OK,
        None,
    ),
    # disasters
    (
        "usgs:quakes",
        "usgs",
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_hour.geojson",
        60,
        "USGS, public domain",
        None,
    ),
    ("gdacs:alerts", "gdacs", "https://www.gdacs.org/xml/rss.xml", 600, RSS_OK, None),
    ("nhc:atlantic", "rss", "https://www.nhc.noaa.gov/index-at.xml", 600, RSS_OK, None),
    ("who:news", "rss", "https://www.who.int/rss-feeds/news-english.xml", 1800, RSS_OK, None),
    # newsrooms
    (
        "news:cnbc",
        "rss",
        "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        120,
        NEWS_RSS,
        None,
    ),
    (
        "news:bbc_business",
        "rss",
        "https://feeds.bbci.co.uk/news/business/rss.xml",
        120,
        NEWS_RSS,
        None,
    ),
    ("news:ft", "rss", "https://www.ft.com/rss/home", 120, NEWS_RSS, None),
    (
        "news:guardian_business",
        "rss",
        "https://www.theguardian.com/business/rss",
        300,
        NEWS_RSS,
        None,
    ),
    ("news:aljazeera", "rss", "https://www.aljazeera.com/xml/rss/all.xml", 120, NEWS_RSS, None),
    ("news:sa_currents", "rss", "https://seekingalpha.com/market_currents.xml", 60, NEWS_RSS, None),
    ("news:investing", "rss", "https://www.investing.com/rss/news.rss", 120, NEWS_RSS, None),
    (
        "news:nasdaq_markets",
        "rss",
        "https://www.nasdaq.com/feed/rssoutbound?category=Markets",
        120,
        NEWS_RSS,
        None,
    ),
    # aggregates
    (
        "gdelt_events",
        "gdelt_events",
        None,
        60,
        "GDELT open data, free for any use with attribution",
        None,
    ),
    (
        "nyt:newswire",
        "nyt",
        "https://api.nytimes.com/svc/news/v3/content/all/all.json?limit=50",
        180,  # free key: 500 requests a day, 5 a minute
        "NYT Developer API terms (free key; check commercial use)",
        "NYT_API_KEY",
    ),
    (
        "guardian:all",
        "guardian",
        "https://content.guardianapis.com/search?order-by=newest&page-size=50"
        "&show-fields=trailText,byline",
        180,  # developer key: 500 requests a day; commercial use needs a paid key
        "Guardian Open Platform (developer key is non-commercial)",
        "GUARDIAN_API_KEY",
    ),
    (
        "alpaca_news",
        "alpaca_news",
        None,
        30,
        "Alpaca market data terms (Benzinga news); needs an account key",
        "ALPACA_KEY_ID ALPACA_SECRET_KEY",
    ),
]
