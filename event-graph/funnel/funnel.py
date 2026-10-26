#!/usr/bin/env python3
"""The news funnel: poll allowed feeds -> dedupe -> stories tagged by rules -> eg.event_candidate.
     No AI model.

  funnel.py init                      create the `funnel` database and its feeds (re-run safely;
    keeps feed state)
  funnel.py poll [--feed ID] [--all]  poll every feed that is due (--all: ignore schedules), once,
    then exit
  funnel.py digest [--hours N] [--material]   one short line per story: what a person or a model
    would read
  funnel.py find WORDS [--hours N]    stories that mention a name, phrase, place or ticker, with
    their details
  funnel.py terms [--add PHRASE [--label L]]  list or add watch phrases (force majeure, sole
    supplier, ...)
  funnel.py refacts                   re-read stored items after changing facts.py or the watch
    phrases
  funnel.py stats                     what each feed cost (bytes, polls, 304s) and how much the
    dedupe saved
  funnel.py promote [--days N]        upsert material stories into eg.event_candidate (catalog
    'news'); safe after build.sh

Feeds (only sources whose robots.txt or terms allow automated reading; checked 2026-10-26):
  bw:*          Business Wire RSS. Press releases, often primary; "(NYSE: TEX)" tags give tickers
    for free.
  gdelt_doc:N   GDELT DOC 2.0 article search, the watched
    companies' names in OR batches. One request per 5 s (GDELT's rule).
  gdelt_events  GDELT's 15-minute event export (~100 KB): conflict, coercion and sanctions between
    countries and groups.
  alpaca_news   Alpaca news API (Benzinga), with tickers on every article. Off until ALPACA_KEY_ID
    and ALPACA_SECRET_KEY are set.
Not used: Yahoo Finance (feeds.finance.yahoo.com and query1 disallow all robots) and Google News
  RSS (/rss is disallowed).

Why it is cheap to read: a feed item is ~700 bytes and a digest line ~40 tokens, where a full
  article page is 100 KB+
(tens of thousands of tokens). Full text is never fetched; a later step can fetch one article when
a story is material.
Set FUNNEL_UA to identify the funnel with a contact (default "ParityResearch/0.1 (research)").
"""

import csv
import gzip
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime

import psycopg2
import psycopg2.extras

import facts as F

UA = os.environ.get("FUNNEL_UA", "ParityResearch/0.1 (research)")
HOST_GAP = {
    "api.gdeltproject.org": 5.5,
    "data.gdeltproject.org": 1.0,
    "feed.businesswire.com": 2.0,
    "data.alpaca.markets": 0.4,
}  # seconds between requests to one host
US_EXCHANGES = {
    "NYSE",
    "NASDAQ",
    "NYSEARCA",
    "NYSEAMERICAN",
    "AMEX",
    "BATS",
    "INDEX",
    "NYMEX",
    "COMEX",
    "CBOT",
    "US",
}
# First words too common to stand for a company on their own ("General" is not General Motors)
COMMON_FIRST = set(
    """general american united first national international global southern northern western eastern
applied advanced texas china japan korea india new royal standard central pacific atlantic digital
  energy power capital
bank banco grupo china taiwan hong euro asia""".split()
)
SUMMARY_MAX = 300
JOIN, JOIN_TICKER = (
    0.5,
    0.35,
)  # headline word overlap needed to join a story; lower when they share a ticker
WINDOW_H = 48  # a copy more than two days after the first is a new story

# Headline rules -> kind. Order matters: the first match wins. Material kinds are the ones a
# mechanism can read.
KINDS = [
    (
        "capacity_loss",
        r"\b(fire|blaze|explosion|blast|outage|shut ?down|(halts?|cuts?|suspends?) (production|"
        r"output|operations)|plant closure"
        r"|recalls?|strike|walkout|earthquake|flood(ing)?|cyberattack|ransomware)\b",
    ),
    (
        "leader_change",
        r"\b(ceo|chief executive|chairman|cfo)\b.*\b(resign|steps? down|to step down|depart|ousted|"
        r"fired|retire"
        r"|appoint|named|hires|names|successor)|\b(resign|steps? down|appoint|names)\b.*\b(ceo|"
        r"chief executive)\b",
    ),
    (
        "guidance",
        r"\b(cuts?|raises?|lowers?|slashes|withdraws?|reaffirms?|boosts?) .{0,25}(guidance|"
        r"forecast|outlook)\b"
        r"|profit warning",
    ),
    (
        "financial_stress",
        r"\b(bankruptcy|chapter 11|default(s|ed)?|insolven|liquidity|bank run|deposit outflow|"
        r"downgrade[sd]?"
        r"|going concern|delist)",
    ),
    (
        "deal",
        r"\b(acquires?|acquisition|merger|to buy|takeover|buyout|bid for|agrees? to (buy|sell)|"
        r"divest)",
    ),
    (
        "policy",
        r"\b(tariffs?|sanctions?|export (controls?|ban|curbs?)|entity list|antitrust|probe|"
        r"investigation|lawsuit|sued"
        r"|fined?|penalty|subpoena|fda (approv|reject)|approval|ban(s|ned)?)\b",
    ),
    (
        "conflict",
        r"\b(war|missiles?|attack(s|ed)?|invasion|airstrikes?|drones?|troops|ceasefire|blockade)\b",
    ),
    ("earnings", r"\b(earnings|quarterly results|q[1-4] results|revenue|beats|misses|eps)\b"),
    (
        "capital",
        r"\b(offering|raises? \$|buyback|repurchase|dividend|notes due|private placement)\b",
    ),
]
MATERIAL = {
    "capacity_loss",
    "leader_change",
    "guidance",
    "financial_stress",
    "deal",
    "policy",
    "conflict",
    "sanction",
}
STOP = set(
    """a an the and or of to in on for with at by from as is are was be been it its this that new
         says say said
will would could may might after over into up down out amid vs via about than more most inc corp co
  ltd plc llc group
company companies report reports news update announces announced announce us u.s""".split()
)
EXCH_TAG = re.compile(
    r"\((?:NYSE American|NYSE|NASDAQ|Nasdaq|TSX|TSXV|LSE|AIM|OTCQX|OTCQB|OTC|"
    r"CBOE)\s*:\s*([A-Z][A-Z.\-]{0,6})\)"
)
CASHTAG = re.compile(r"(?<![\w$])\$([A-Z]{1,5})\b")
TRACKING = re.compile(
    r"^(utm_|\.tsrc|ocid|cmpid|guccounter|guce_|ref$|src$|oc$|feedtype|cid$|mc_)", re.I
)

CAMEO_ROOT = {
    "16": ("reduces relations with", "policy"),
    "17": ("coerces", "coercion"),
    "18": ("assaults", "conflict"),
    "19": ("fights", "conflict"),
    "20": ("uses mass violence against", "conflict"),
}


# ───────────── plumbing ─────────────


def db(name="funnel"):
    return psycopg2.connect(
        host=os.environ.get("PGHOST", os.path.expanduser("~/event-graph/.pgdata")),
        port=os.environ.get("PGPORT", "5499"),
        user=os.environ.get("PGUSER", "postgres"),
        dbname=name,
    )


_last_hit = {}


def get(url, headers=None, etag=None, last_modified=None):
    """GET politely: one request per host gap, gzip, conditional. Returns (status, body bytes,
    response headers).
    """
    host = urllib.parse.urlsplit(url).hostname
    wait = _last_hit.get(host, 0) + HOST_GAP.get(host, 1.0) - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    h = {"User-Agent": UA, "Accept-Encoding": "gzip", **(headers or {})}
    if etag:
        h["If-None-Match"] = etag
    if last_modified:
        h["If-Modified-Since"] = last_modified
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30) as r:
            body, status, rh = r.read(), r.status, r.headers
    except urllib.error.HTTPError as e:
        body, status, rh = (e.read() if e.code != 304 else b""), e.code, e.headers
    finally:
        _last_hit[host] = time.monotonic()
    if rh.get("Content-Encoding") == "gzip" and body:
        body = gzip.decompress(body)
    return status, body, rh


def canon(url):
    """The URL with tracking parameters and fragments stripped, so two links to one article
    dedupe.
    """
    p = urllib.parse.urlsplit(url.strip())
    q = sorted(
        (k, v)
        for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)
        if not TRACKING.match(k)
    )
    return urllib.parse.urlunsplit(
        (p.scheme.lower(), p.netloc.lower(), p.path.rstrip("/"), urllib.parse.urlencode(q), "")
    )


def words(title):
    t = re.sub(
        r"\s+[-|–—]\s+[^-|–—]{2,40}$", "", title
    )  # " - EE Times", " | Reuters": the publisher, not the story
    return {
        w
        for w in re.findall(r"[a-z0-9$%.]+", t.lower().replace("'s", ""))
        if len(w) > 2 and w not in STOP
    }


ENGLISH = set("the and of to in for with is on by from has its that as at".split())


def english(text):
    w = re.findall(r"[a-z]+", text.lower())
    return len(w) < 8 or sum(x in ENGLISH for x in w) >= 2


def kind_of(text):
    low = text.lower()
    for kind, rx in KINDS:
        if re.search(rx, low):
            return kind
    return None


def clip(s, n=SUMMARY_MAX):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def ts(s):
    if not s:
        return None
    try:
        return parsedate_to_datetime(s)
    except (TypeError, ValueError):
        pass
    for fmt in ("%Y%m%dT%H%M%SZ", "%Y%m%d%H%M%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            d = datetime.strptime(s.replace("UT", "+0000") if fmt.endswith("%z") else s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=UTC)
        except ValueError:
            continue
    return None


# ───────────── names -> tickers, from the graph ─────────────


def tag(ticker, exchange):
    return ticker if exchange.upper() in US_EXCHANGES else f"{ticker}:{exchange}"


def clean_name(n):
    n = re.sub(
        r",?\s+(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|holdings?|group|"
        r"sa|ag|nv|se|"
        r"co\.,? ltd)\.?$",
        "",
        n.strip(),
        flags=re.I,
    )
    return n.strip(" ,.")


def load_names():
    """Company names and aliases that have a security in eg -> their ticker tag. Empty if eg is
    mid-rebuild.
    """
    try:
        con = db("eg")
    except psycopg2.Error:
        return {}, set()
    with con, con.cursor() as cur:
        cur.execute("""SELECT n, s.ticker, s.exchange FROM security s JOIN entity e ON e.id =
                         s.entity_id,
                       LATERAL (SELECT e.name UNION SELECT alias FROM entity_alias a WHERE
                       a.entity_id = e.id) x(n)
                       WHERE s.is_primary AND e.kind = 'company'""")
        rows = cur.fetchall()
    con.close()
    names, known = {}, set()
    for n, t, x in rows:
        known.add(tag(t, x))
        short = clean_name(n)
        first = short.split()[0] if len(short.split()) > 1 else ""
        for v in {n, short} | (
            {first} if len(first) >= 5 and first.lower() not in COMMON_FIRST else set()
        ):
            if len(v) >= 3:
                names.setdefault(
                    v, tag(t, x)
                )  # the full name wins over a first word another company shares
    return names, known


class Matcher:
    def __init__(self):
        self.names, self.known = load_names()
        alts = sorted(self.names, key=len, reverse=True)
        self.rx = (
            re.compile(r"(?<![\w&])(" + "|".join(map(re.escape, alts)) + r")(?![\w&])")
            if alts
            else None
        )

    def tickers(self, text, given=()):
        found = set(given)
        found |= set(EXCH_TAG.findall(text)) | set(CASHTAG.findall(text))
        if self.rx:
            found |= {self.names[m] for m in self.rx.findall(text)}
        return sorted(found)


# ───────────── adapters: each returns (items, new cursor) ─────────────


def rss(feed, body):
    root = ET.fromstring(body)
    out = []
    for it in root.iter("item"):
        t = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        if not t or not link:
            continue
        out.append(
            {
                "url": link,
                "title": t,
                "summary": clip(it.findtext("description")),
                "text": clip(it.findtext("description"), 2000),
                "publisher": urllib.parse.urlsplit(link).hostname,
                "published_at": ts(it.findtext("pubDate")),
            }
        )
    return out


def gdelt_doc(feed, body):
    if body.lstrip()[:1] != b"{":
        raise RuntimeError(
            clip(body.decode("utf-8", "replace"), 160)
        )  # GDELT answers errors in plain text
    out = []
    for a in json.loads(body).get("articles", []):
        if a.get("language") not in (None, "English"):
            continue
        out.append(
            {
                "url": a["url"],
                "title": a["title"].strip(),
                "summary": None,
                "publisher": a.get("domain"),
                "published_at": ts(a.get("seendate")),
                "attrs": {"country": a.get("sourcecountry")},
            }
        )
    return out


def gdelt_events_rows(body):
    """The 15-minute export (61 tab-separated columns). Keeps root events of conflict, coercion
    and sanctions.
    """
    with zipfile.ZipFile(io.BytesIO(body)) as z:
        text = z.read(z.namelist()[0]).decode("utf-8", "replace")
    out = []
    for r in csv.reader(io.StringIO(text), delimiter="\t"):
        if len(r) < 61 or r[25] != "1" or r[28] not in CAMEO_ROOT:
            continue
        verb, kind = CAMEO_ROOT[r[28]]
        if r[27] == "163":
            verb, kind = "imposes sanctions or an embargo on", "sanction"
        n_articles, goldstein = int(r[33] or 0), float(r[30] or 0)
        # Between two countries, or a government, military or rebel group on one side:
        # local crime is not a market event.
        intl = bool(r[7] and r[17] and r[7] != r[17])
        state = bool(
            {"GOV", "MIL", "REB", "SPY"} & {r[12], r[13], r[22], r[23]} and (r[7] or r[17])
        )
        if not (intl or state or kind == "sanction"):
            continue
        if n_articles < 3 and kind != "sanction":
            continue
        a1, a2 = r[6] or r[7], r[16] or r[17]
        where = r[52].split(",")[0] if r[52] else ""
        out.append(
            {
                "url": r[60],
                "title": f"{a1.title()} {verb} {(a2 or 'unnamed party').title()}"
                + (f" ({where})" if where else ""),
                "summary": None,
                "publisher": urllib.parse.urlsplit(r[60]).hostname,
                "published_at": ts(r[59]),
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
        )
    return out


def watch_terms(cur):
    cur.execute("SELECT term, label FROM watch_term")
    return cur.fetchall()


def poll_feed(cur, f, matcher):
    """Fetch one feed, store new items. Returns (status, bytes, items seen, items new)."""
    hdr, url, cursor = {}, f["arg"], f["cursor"]
    if f["adapter"] == "gdelt_doc":
        mins = (
            60
            if not f["last_ok"]
            else max(
                15,
                min(1440, int((datetime.now(UTC) - f["last_ok"]).total_seconds() / 60) + 5),
            )
        )
        url = "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode(
            {
                "query": f["arg"] + " sourcelang:english",
                "mode": "artlist",
                "maxrecords": 250,
                "format": "json",
                "sort": "datedesc",
                "timespan": f"{mins}min",
            }
        )
    elif f["adapter"] == "gdelt_events":
        status, body, _ = get("http://data.gdeltproject.org/gdeltv2/lastupdate.txt")
        if status != 200:
            return status, len(body), 0, 0
        url = body.decode().split("\n")[0].split()[-1]
        if url == cursor:
            return 304, len(body), 0, 0
        cursor = url
    elif f["adapter"] == "alpaca_news":
        key, sec = os.environ.get("ALPACA_KEY_ID"), os.environ.get("ALPACA_SECRET_KEY")
        if not (key and sec):
            return 0, 0, 0, 0
        hdr = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": sec}
        start = cursor or (datetime.now(UTC) - timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
        url = "https://data.alpaca.markets/v1beta1/news?" + urllib.parse.urlencode(
            {"start": start, "limit": 50, "sort": "asc", "include_content": "false"}
        )

    fixed = f["adapter"] == "rss"  # conditional GET only where the URL stays the same between polls
    status, body, rh = get(
        url, hdr, f["etag"] if fixed else None, f["last_modified"] if fixed else None
    )
    if status == 304:
        return 304, 0, 0, 0
    if status != 200:
        raise RuntimeError(f"HTTP {status}: {clip(body.decode('utf-8', 'replace'), 160)}")
    if f["adapter"] == "rss":
        items = rss(f, body)
    elif f["adapter"] == "gdelt_doc":
        items = gdelt_doc(f, body)
    elif f["adapter"] == "gdelt_events":
        items = gdelt_events_rows(body)
    else:
        news = json.loads(body).get("news", [])
        items = [
            {
                "url": n["url"],
                "title": n["headline"],
                "summary": clip(n.get("summary")),
                "text": clip(n.get("summary"), 2000),
                "publisher": n.get("source"),
                "published_at": ts(n["created_at"]),
                "tickers": n.get("symbols", []),
            }
            for n in news
            if n.get("url")
        ]
        if news:
            cursor = max(n["created_at"] for n in news)
    new, watch = 0, watch_terms(cur)
    for it in items:
        # The feed's whole description is read for names and details, then dropped; only
        # 300 characters are kept.
        full = f"{it['title']}. {it.get('text') or it.get('summary') or ''}"
        if not english(full):
            continue  # wires post translated copies of the same release
        tickers = matcher.tickers(full, it.get("tickers") or [])
        attrs = {
            **it.get("attrs", {}),
            **({"kind": it["kind"], "material": it["material"]} if "kind" in it else {}),
        }
        cur.execute(
            """INSERT INTO item (url_key, url, feed_id, publisher, title, summary, published_at,
                 tickers, attrs, facts)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (url_key) DO NOTHING""",
            (
                hashlib.sha256(canon(it["url"]).encode()).hexdigest(),
                it["url"],
                f["id"],
                it.get("publisher"),
                it["title"][:400],
                it.get("summary"),
                it.get("published_at"),
                tickers,
                json.dumps(attrs),
                json.dumps(F.extract(full, watch)),
            ),
        )
        new += cur.rowcount
    cur.execute(
        "UPDATE feed SET etag = %s, last_modified = %s, cursor = %s WHERE id = %s",
        (rh.get("ETag"), rh.get("Last-Modified"), cursor, f["id"]),
    )
    return 200, len(body), len(items), new


# ───────────── dedupe: items -> stories ─────────────


def cluster(cur):
    """Attach every unassigned item to a story from the last 48 hours with a similar headline, or
    start one.
    """
    cur.execute(
        "SELECT id, tokens, tickers, first_seen FROM story WHERE first_seen > now() - "
        "make_interval(hours => %s)",
        (WINDOW_H,),
    )
    stories = {sid: (set(tok), set(tk)) for sid, tok, tk, _ in cur.fetchall()}
    index = {}
    for sid, (tok, _) in stories.items():
        for w in tok:
            index.setdefault(w, set()).add(sid)
    cur.execute(
        "SELECT id, title, summary, publisher, published_at, tickers, attrs, facts FROM item WHERE "
        "story_id IS NULL ORDER BY id"
    )
    joined = started = 0
    for iid, title, summary, pub, published, tickers, attrs, ifacts in cur.fetchall():
        tok, tk = words(title), set(tickers)
        best, score = None, 0.0
        for sid in {s for w in tok for s in index.get(w, ())}:
            stok, stk = stories[sid]
            j = len(tok & stok) / len(tok | stok) if tok else 0
            if j > score and len(tok & stok) >= 2 and j >= (JOIN_TICKER if tk & stk else JOIN):
                best, score = sid, j
        kind = attrs.get("kind") or kind_of(f"{title} {summary or ''}")
        material = attrs.get("material", kind in MATERIAL)
        countries = attrs.get("countries") or []
        if best:
            cur.execute(
                """UPDATE story SET n_items = n_items + 1, updated_at = now(),
                             tickers = ARRAY(SELECT DISTINCT unnest(tickers || %s)),
                             countries = ARRAY(SELECT DISTINCT unnest(countries || %s)),
                             publishers = ARRAY(SELECT DISTINCT unnest(publishers || %s)),
                             first_published = LEAST(first_published, %s),
                             kind = COALESCE(kind, %s), material = material OR %s
                           WHERE id = %s RETURNING facts""",
                (tickers, countries, [pub] if pub else [], published, kind, material, best),
            )
            cur.execute(
                "UPDATE story SET facts = %s WHERE id = %s",
                (json.dumps(F.merge(cur.fetchone()[0], ifacts)), best),
            )
            stories[best][1].update(tk)
            joined += 1
        else:
            cur.execute(
                """INSERT INTO story (title, kind, material, tickers, countries, publishers,
                     n_items, tokens, first_published, facts)
                           VALUES (%s,%s,%s,%s,%s,%s,1,%s,%s,%s) RETURNING id""",
                (
                    title,
                    kind,
                    material,
                    tickers,
                    countries,
                    [pub] if pub else [],
                    sorted(tok),
                    published,
                    json.dumps(ifacts),
                ),
            )
            best = cur.fetchone()[0]
            stories[best] = (tok, tk)
            for w in tok:
                index.setdefault(w, set()).add(best)
            started += 1
        cur.execute("UPDATE item SET story_id = %s WHERE id = %s", (best, iid))
    return joined, started


# ───────────── commands ─────────────


def cmd_init():
    con = db("postgres")
    con.autocommit = True
    with con.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'funnel'")
        if not cur.fetchone():
            cur.execute("CREATE DATABASE funnel")
    con.close()
    con = db()
    with con, con.cursor() as cur:
        cur.execute(open(os.path.join(os.path.dirname(__file__), "funnel.sql")).read())
        feeds = [
            (
                "bw:home",
                "rss",
                "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFtRWA==",
                300,
                "Business Wire public RSS; robots.txt allows",
            ),
            (
                "gdelt_events",
                "gdelt_events",
                None,
                900,
                "GDELT open data, free for any use with attribution",
            ),
            (
                "alpaca_news",
                "alpaca_news",
                None,
                120,
                "Alpaca market data terms (Benzinga news); needs an account key",
            ),
        ]
        names = sorted(
            {clean_name(n) for n in load_names()[0] if len(clean_name(n)) >= 4}, key=str.lower
        )
        for i in range(
            0, len(names), 8
        ):  # GDELT takes OR'd phrases; 8 names keeps the query well under its length limit
            q = "(" + " OR ".join(f'"{n}"' for n in names[i : i + 8]) + ")"
            feeds.append(
                (
                    f"gdelt_doc:{i // 8}",
                    "gdelt_doc",
                    q,
                    1800,
                    "GDELT DOC API, free; one request per 5 seconds",
                )
            )
        for fid, adapter, arg, every, lic in feeds:
            cur.execute(
                """INSERT INTO feed (id, adapter, arg, every_s, license) VALUES (%s,%s,%s,%s,%s)
                           ON CONFLICT (id) DO UPDATE SET adapter = EXCLUDED.adapter, arg =
                           EXCLUDED.arg,
                             every_s = EXCLUDED.every_s, license = EXCLUDED.license""",
                (fid, adapter, arg, every, lic),
            )
        cur.execute(
            "DELETE FROM feed f WHERE id LIKE 'gdelt_doc:%%' AND NOT (id = ANY(%s)) AND NOT EXISTS "
            "(SELECT 1 FROM item WHERE feed_id = f.id)",
            ([f[0] for f in feeds],),
        )
        cur.execute("SELECT count(*) FROM feed")
        print(
            f"funnel ready: {cur.fetchone()[0]} feeds ({len(names)} company names in "
            f"{-(-len(names) // 8)} GDELT batches)"
        )


def cmd_poll(only=None, every=False):
    matcher = Matcher()
    con = db()
    con.autocommit = True
    cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT * FROM feed WHERE enabled AND (%s OR next_at <= now()) AND (%s::text IS NULL OR id "
        "= %s) ORDER BY next_at",
        (every or bool(only), only, only),
    )
    throttled = (
        set()
    )  # adapters that answered 429 this run: their other feeds wait for the next run
    for f in cur.fetchall():
        if f["adapter"] in throttled:
            with con.cursor() as c2:
                c2.execute(
                    "UPDATE feed SET next_at = now() + make_interval(secs => every_s) "
                    "WHERE id = %s",
                    (f["id"],),
                )
            continue
        try:
            with con.cursor() as c2:
                c2.execute("BEGIN")
                status, nbytes, seen, new = poll_feed(c2, f, matcher)
                c2.execute(
                    """UPDATE feed SET polls = polls + 1, not_modified = not_modified + (%s =
                         304)::int,
                                bytes_in = bytes_in + %s, items_in = items_in + %s, items_new =
                                items_new + %s,
                                fails = 0, last_error = NULL, last_ok = CASE WHEN %s IN (200, 304)
                                THEN now() ELSE last_ok END,
                                next_at = now() + make_interval(secs => every_s) WHERE id = %s""",
                    (status, nbytes, seen, new, status, f["id"]),
                )
                c2.execute("COMMIT")
            print(
                f"{f['id']:<14} {'off (no key)' if status == 0 else status} {nbytes / 1024:7.1f} "
                f"KB {seen:4} items {new:4} new"
            )
        except Exception as e:  # noqa: BLE001 - one bad feed must not stop the others
            if "HTTP 429" in str(e):
                throttled.add(f["adapter"])
            with con.cursor() as c2:
                c2.execute("ROLLBACK")
                c2.execute(
                    """UPDATE feed SET fails = fails + 1, last_error = %s, polls = polls + 1,
                                next_at = now() + make_interval(
                                  secs => LEAST(every_s * 2 ^ (fails + 1), 21600))
                              WHERE id = %s""",
                    (clip(str(e), 300), f["id"]),
                )
            print(f"{f['id']:<14} FAILED {clip(str(e), 120)}")
    with con.cursor() as c2:
        joined, started = cluster(c2)
    print(f"dedupe: {started} new stories, {joined} copies joined to existing ones")
    con.close()


def line(r):
    tk = ",".join(r["tickers"][:5]) or ",".join(r["countries"][:3]) or "-"
    head = (
        f"{r['first_seen']:%m-%d %H:%M} {(r['kind'] or '-')[:16]:<16} {tk[:22]:<22} "
        f"{r['title'][:120]}"
        f" [{r['n_items']}x/{len(r['publishers'])}p]"
    )
    detail = F.line(r.get("facts") or {})
    return head + (f"\n{'':12}> {detail}" if detail else "")


def cmd_digest(hours, material):
    con = db()
    with con, con.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT * FROM story WHERE first_seen > now() - make_interval(hours => %s) AND
                 (material OR NOT %s)
                       ORDER BY material DESC, n_items DESC, first_seen DESC""",
            (hours, material),
        )
        rows = cur.fetchall()
    text = "\n".join(line(r) for r in rows)
    print(text)
    print(f"-- {len(rows)} stories, ~{len(text) // 4} tokens", file=sys.stderr)


def cmd_find(text, hours):
    """Stories whose headline, summary or details mention the words: a name, a phrase, a place, a
    number.
    """
    con = db()
    with con, con.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT s.* FROM story s WHERE s.first_seen > now() - make_interval(hours => %s) AND (
                         s.title ILIKE %s OR s.facts::text ILIKE %s OR %s ILIKE ANY (s.tickers)
                         OR EXISTS (SELECT 1 FROM item i WHERE i.story_id = s.id AND i.summary
                         ILIKE %s))
                       ORDER BY s.first_seen DESC""",
            (hours, f"%{text}%", f"%{text}%", text, f"%{text}%"),
        )
        rows = cur.fetchall()
    text_out = "\n".join(line(r) for r in rows)
    print(text_out or f"nothing mentions {text!r} in the last {hours} hours")
    print(f"-- {len(rows)} stories, ~{len(text_out) // 4} tokens", file=sys.stderr)


def cmd_terms(add=None, label=None):
    con = db()
    with con, con.cursor() as cur:
        if add:
            cur.execute(
                "INSERT INTO watch_term (term, label) VALUES (%s, %s) ON CONFLICT (term) DO UPDATE "
                "SET label = EXCLUDED.label",
                (add.lower(), label or add.lower()),
            )
            print(f"watching {add!r}; run `funnel.py refacts` to tag stories already stored")
        cur.execute("SELECT term, label FROM watch_term ORDER BY label, term")
        if not add:
            print(", ".join(t if t == lb else f"{t} ({lb})" for t, lb in cur.fetchall()))


def cmd_refacts():
    """Re-read every stored headline and summary with the current rules and watch terms (after
    editing either).
    """
    con = db()
    with con, con.cursor() as cur:
        watch = watch_terms(cur)
        cur.execute("SELECT id, title, summary FROM item")
        for iid, title, summary in cur.fetchall():
            cur.execute(
                "UPDATE item SET facts = %s WHERE id = %s",
                (json.dumps(F.extract(f"{title}. {summary or ''}", watch)), iid),
            )
        cur.execute(
            "SELECT story_id, array_agg(facts ORDER BY id) FROM item WHERE story_id IS NOT NULL "
            "GROUP BY 1"
        )
        rows = cur.fetchall()
        for sid, fs in rows:
            merged = {}
            for f in fs:
                merged = F.merge(merged, f)
            cur.execute("UPDATE story SET facts = %s WHERE id = %s", (json.dumps(merged), sid))
    print(
        f"re-read {len(rows)} stories (from the stored 300-character summaries; new items read the "
        f"full description)"
    )


def cmd_stats():
    con = db()
    with con, con.cursor() as cur:
        cur.execute("""SELECT split_part(id, ':', 1) AS src, count(*), sum(polls),
                         sum(not_modified), sum(bytes_in), sum(items_in),
                              sum(items_new), sum(fails), max(last_error)
                       FROM feed GROUP BY 1 ORDER BY 1""")
        print(
            f"{'source':<14}{'feeds':>6}{'polls':>7}{'304s':>6}{'MB in':>8}"
            f"{'items':>8}{'new':>7}{'fails':>6}"
        )
        for src, n, polls, nm, b, seen, new, fails, err in cur.fetchall():
            print(
                f"{src:<14}{n:>6}{polls:>7}{nm:>6}{float(b) / 1e6:>8.2f}"
                f"{seen:>8}{new:>7}{fails:>6}  {clip(err or '', 70)}"
            )
        cur.execute(
            "SELECT count(*), coalesce(sum(length(title) + coalesce(length(summary), 0)), 0) FROM "
            "item"
        )
        n_items, chars = cur.fetchone()
        cur.execute(
            "SELECT count(*), count(*) FILTER (WHERE material), coalesce(sum(length(title) + 60), "
            "0) FROM story"
        )
        n_stories, n_material, line_chars = cur.fetchone()
        cur.execute("SELECT coalesce(sum(bytes_in), 0) FROM feed")
        raw = cur.fetchone()[0]
    print(f"\n{n_items} items -> {n_stories} stories ({n_material} material).")
    print(
        f"Tokens to read it all (~4 characters a token): raw feeds ~{raw // 4:,}, stored items "
        f"~{chars // 4:,}, "
        f"story digest ~{line_chars // 4:,}."
    )


def claim_hint(f):
    """The details in the shape of a claim (magnitude, unit, duration_days, object), for whoever
    writes the claim.
    """
    h = {}
    for p in f.get("pct", []):
        m = re.match(r"([+-]?\d+(?:\.\d+)?)% ?(.*)", p)
        if m and m.group(2) in (
            "output",
            "production",
            "capacity",
            "supply",
            "exports",
            "deliveries",
            "shipments",
        ):
            h.update(magnitude=abs(float(m.group(1))), unit="pct_capacity")
            break
        if m and "magnitude" not in h:
            h.update(magnitude=float(m.group(1)), unit="pct", of=m.group(2) or None)
    if "magnitude" not in h and f.get("money"):
        v = f["money"][0]
        mult = {"T": 1e12, "B": 1e9, "M": 1e6, "K": 1e3}.get(v[-1], 1)
        h.update(
            magnitude=float(v.strip("-$TBMK")) * mult * (-1 if v.startswith("-") else 1), unit="usd"
        )
    if f.get("days"):
        h["duration_days"] = f["days"]
    if f.get("people"):
        h["people"] = f["people"]
    if f.get("places"):
        h["places"] = f["places"]
    return h


def cmd_promote(days):
    con, eg = db(), db("eg")
    with (
        con,
        con.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur,
        eg,
        eg.cursor() as ec,
    ):
        cur.execute(
            """SELECT s.*, (SELECT array_agg(url ORDER BY published_at NULLS LAST) FROM
                         (SELECT url, published_at FROM item WHERE story_id = s.id ORDER BY
                         published_at NULLS LAST LIMIT 5) u) AS urls,
                         (SELECT array_agg(DISTINCT f.license) FROM item i JOIN feed f ON f.id =
                         i.feed_id WHERE i.story_id = s.id) AS licenses
                       FROM story s
                       WHERE material AND first_seen > now() - make_interval(days => %s)""",
            (days,),
        )
        n = 0
        for s in cur.fetchall():
            known = min(t for t in (s["first_published"], s["first_seen"]) if t)
            ec.execute(
                """INSERT INTO event_candidate (catalog, ext_id, kind, title, url, known_at,
                     published_at, material, attrs)
                          VALUES ('news', %s, %s, %s, %s, %s, %s, true, %s)
                          ON CONFLICT (catalog, ext_id) DO UPDATE SET attrs = EXCLUDED.attrs, kind
                          = EXCLUDED.kind,
                            known_at = LEAST(event_candidate.known_at, EXCLUDED.known_at)""",
                (
                    f"story:{s['id']}",
                    s["kind"],
                    s["title"],
                    (s["urls"] or [None])[0],
                    known,
                    s["first_published"],
                    json.dumps(
                        {
                            "facts": s["facts"],
                            "claim_hint": claim_hint(s["facts"]),
                            "tickers": s["tickers"],
                            "countries": s["countries"],
                            "publishers": s["publishers"],
                            "n_items": s["n_items"],
                            "urls": s["urls"],
                            "first_seen": s["first_seen"].isoformat(),
                            "licenses": s["licenses"],
                        }
                    ),
                ),
            )
            n += 1
        cur.execute(
            "UPDATE story SET promoted_at = now() WHERE material AND first_seen > now() - "
            "make_interval(days => %s)",
            (days,),
        )
    print(f"{n} material stories upserted into eg.event_candidate (catalog 'news')")


def arg(flag, default=None, cast=str):
    return cast(sys.argv[sys.argv.index(flag) + 1]) if flag in sys.argv else default


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "init":
        cmd_init()
    elif cmd == "poll":
        cmd_poll(arg("--feed"), "--all" in sys.argv)
    elif cmd == "digest":
        cmd_digest(arg("--hours", 24, int), "--material" in sys.argv)
    elif cmd == "find":
        cmd_find(sys.argv[2], arg("--hours", 24 * 30, int))
    elif cmd == "terms":
        cmd_terms(arg("--add"), arg("--label"))
    elif cmd == "refacts":
        cmd_refacts()
    elif cmd == "stats":
        cmd_stats()
    elif cmd == "promote":
        cmd_promote(arg("--days", 30, int))
    else:
        sys.exit(__doc__)
