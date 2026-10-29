#!/usr/bin/env python3
"""SEC EDGAR -> Parity event graph.

  edgar.py companies                  every SEC registrant with a ticker -> entity + security
  edgar.py facts TICKER [TICKER...]   balance-sheet facts (XBRL), point-in-time by filing date
  edgar.py holdings CIK [--figi]      latest 13F -> holds links (--figi resolves CUSIPs to issuers via OpenFIGI)
  edgar.py watch [--loop SECONDS]     live 8-K feed -> events + claims, with our latency

Everything EDGAR serves is public, and a company's own filing is a primary source about itself.
SEC rules: identify yourself (SEC_USER_AGENT="Company Name contact@domain") and stay under 10 requests/second.
Structured XBRL starts in 2009 and XML 13F tables in 2013; rebuilding 2008 needs the text filings (not done here).
"""

import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import UTC, datetime

import psycopg2
from psycopg2.extras import Json

UA = os.environ.get("SEC_USER_AGENT")
MIN_GAP = 0.11  # seconds between SEC requests: < 10/s
_last = 0.0

# 8-K items -> the change a claim records. These are the ones that move things; the rest land as 'other'.
ITEMS = {
    "1.01": "agreement_entered",
    "1.02": "agreement_terminated",
    "1.03": "bankruptcy",
    "1.05": "cyber_incident",
    "2.01": "acquisition_completed",
    "2.02": "earnings_release",
    "2.03": "debt_incurred",
    "2.04": "debt_acceleration",
    "2.05": "restructuring",
    "2.06": "impairment",
    "3.01": "delisting_notice",
    "4.01": "auditor_change",
    "4.02": "restatement",
    "5.01": "control_change",
    "5.02": "leadership_change",
}

# Balance-sheet tags the financial mechanism needs: size, cushion, and how much is funded overnight.
METRICS = [
    "Assets",
    "Liabilities",
    "StockholdersEquity",
    "CashAndCashEquivalentsAtCarryingValue",
    "SecuritiesSoldUnderAgreementsToRepurchase",
    "ShortTermBorrowings",
    "CommercialPaper",
    "LongTermDebt",
    "LongTermDebtNoncurrent",
    "Revenues",
    "NetIncomeLoss",
]


def get(url, data=None, headers=None):
    """Polite fetch: SEC user agent, rate limit, backoff on 429/5xx."""
    global _last
    if "sec.gov" in url and not UA:
        sys.exit('Set SEC_USER_AGENT="Your Company contact@yourdomain" (SEC requires it)')
    for attempt in range(5):
        wait = MIN_GAP - (time.time() - _last)
        if wait > 0:
            time.sleep(wait)
        _last = time.time()
        req = urllib.request.Request(
            url, data=data, headers={"User-Agent": UA or "parity", **(headers or {})}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(2**attempt)
                continue
            raise


def db():
    return psycopg2.connect(
        host=os.environ.get("PGHOST", os.path.expanduser("~/event-graph/.pgdata")),
        port=os.environ.get("PGPORT", "5499"),
        user=os.environ.get("PGUSER", "postgres"),
        dbname=os.environ.get("PGDATABASE", "eg"),
    )


def source(cur, name, kind="company", primary=True, domain="sec.gov"):
    cur.execute("SELECT id FROM source WHERE name = %s AND kind = %s", (name, kind))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO source (name, kind, domain, is_primary) VALUES (%s,%s,%s,%s) RETURNING id",
        (name, kind, domain, primary),
    )
    return cur.fetchone()[0]


def doc(cur, source_id, kind, url, title, published_at):
    """One source_doc per URL (sha256 of the URL is the dedupe key). Returns (id, is_new)."""
    key = hashlib.sha256(url.encode()).hexdigest()
    cur.execute("SELECT id FROM source_doc WHERE sha256 = %s", (key,))
    row = cur.fetchone()
    if row:
        return row[0], False
    cur.execute(
        """INSERT INTO source_doc (source_id, kind, url, title, published_at, sha256, acquired_via)
                   VALUES (%s,%s,%s,%s,%s,%s,'public') RETURNING id""",
        (source_id, kind, url, title, published_at, key),
    )
    return cur.fetchone()[0], True


def entity_by_cik(cur, cik, name, kind="company"):
    cik = str(int(cik))
    cur.execute("SELECT id FROM entity WHERE attrs->>'cik' = %s", (cik,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO entity (kind, name, country, attrs) VALUES (%s,%s,'US',%s) RETURNING id",
        (kind, name, Json({"cik": cik})),
    )
    return cur.fetchone()[0]


def manual_doc(cur, url, title):
    return doc(
        cur,
        source(cur, "SEC EDGAR", "government", False),
        "dataset",
        url,
        title,
        datetime.now(UTC),
    )[0]


# ───────────── companies ─────────────


def cmd_companies():
    url = "https://www.sec.gov/files/company_tickers_exchange.json"
    d = json.loads(get(url))
    fields = d["fields"]
    with db() as conn, conn.cursor() as cur:
        n = 0
        for row in d["data"]:
            r = dict(zip(fields, row, strict=False))
            eid = entity_by_cik(cur, r["cik"], r["name"])
            cur.execute(
                """INSERT INTO security (entity_id, ticker, exchange) VALUES (%s,%s,%s)
                           ON CONFLICT (ticker, exchange) DO NOTHING""",
                (eid, r["ticker"], r["exchange"] or "UNKNOWN"),
            )
            n += 1
    print(f"{n} listed securities loaded")


# ───────────── facts ─────────────


def cik_for(cur, ticker):
    cur.execute(
        """SELECT e.id, e.attrs->>'cik', e.name FROM security s JOIN entity e ON e.id = s.entity_id
                   WHERE upper(s.ticker) = upper(%s) AND e.attrs ? 'cik' LIMIT 1""",
        (ticker,),
    )
    row = cur.fetchone()
    if not row:
        sys.exit(f"{ticker}: not found; run `edgar.py companies` first")
    return row


def cmd_facts(tickers):
    with db() as conn, conn.cursor() as cur:
        for t in tickers:
            eid, cik, name = cik_for(cur, t)
            facts = json.loads(
                get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(cik):010d}.json")
            )
            gaap = facts.get("facts", {}).get("us-gaap", {})
            src = source(cur, name)
            n = 0
            for m in METRICS:
                for unit, vals in gaap.get(m, {}).get("units", {}).items():
                    for v in vals:
                        if not v.get("form", "").startswith(("10-K", "10-Q")):
                            continue
                        acc = v["accn"]
                        url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/"
                        # Known at the END of the filing day (ET): never earlier than the market could have seen it.
                        known = f"{v['filed']} 23:59-05"
                        did, _ = doc(cur, src, "filing", url, f"{v['form']} {acc}", known)
                        cur.execute(
                            """INSERT INTO entity_fact VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                                       ON CONFLICT DO NOTHING""",
                            (eid, m, v["end"], v["val"], unit, v["form"], acc, known, did),
                        )
                        n += cur.rowcount
            print(f"{t}: {n} new facts")
            cur.execute(
                """
                WITH latest AS (
                  SELECT DISTINCT ON (metric) metric, value, period_end FROM entity_fact
                  WHERE entity_id = %s ORDER BY metric, period_end DESC, known_at DESC)
                SELECT max(period_end),
                       round(max(value) FILTER (WHERE metric='Assets') /
                             nullif(max(value) FILTER (WHERE metric='StockholdersEquity'), 0), 1),
                       round(max(value) FILTER (WHERE metric='SecuritiesSoldUnderAgreementsToRepurchase') /
                             nullif(max(value) FILTER (WHERE metric='StockholdersEquity'), 0), 2)
                FROM latest""",
                (eid,),
            )
            end, lev, repo = cur.fetchone()
            print(f"   as of {end}: assets/equity {lev}x, repo funding/equity {repo}x")


# ───────────── 13F holdings ─────────────


def figi_tickers(cusips):
    """CUSIP -> US ticker via OpenFIGI (free tier: 10 ids per call, 25 calls/min)."""
    out = {}
    for i in range(0, len(cusips), 10):
        batch = cusips[i : i + 10]
        body = json.dumps(
            [{"idType": "ID_CUSIP", "idValue": c, "exchCode": "US"} for c in batch]
        ).encode()
        res = json.loads(
            get("https://api.openfigi.com/v3/mapping", body, {"Content-Type": "application/json"})
        )
        for c, r in zip(batch, res, strict=False):
            if r.get("data"):
                out[c] = r["data"][0]["ticker"]
        time.sleep(2.5)
    return out


def cmd_holdings(cik, use_figi):
    sub = json.loads(get(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json"))
    r = sub["filings"]["recent"]
    i = next((k for k, f in enumerate(r["form"]) if f == "13F-HR"), None)
    if i is None:
        sys.exit(f"CIK {cik}: no 13F-HR filed")
    acc, accepted, period = r["accessionNumber"][i], r["acceptanceDateTime"][i], r["reportDate"][i]
    base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/"
    items = json.loads(get(base + "index.json"))["directory"]["item"]
    table = next(
        x["name"] for x in items if x["name"].endswith(".xml") and x["name"] != "primary_doc.xml"
    )
    root = ET.fromstring(get(base + table))

    pos = {}  # one position per CUSIP: 13F splits them by manager
    for t in root.iter():
        if not t.tag.endswith("infoTable"):
            continue
        f = {c.tag.split("}")[1]: c for c in t.iter() if "}" in c.tag}
        c = f["cusip"].text.strip()
        p = pos.setdefault(
            c,
            {
                "issuer": f["nameOfIssuer"].text.strip(),
                "class": f["titleOfClass"].text.strip(),
                "value_usd": 0,
                "shares": 0,
            },
        )
        p["value_usd"] += int(f["value"].text)  # dollars since 2023 (thousands before)
        p["shares"] += int(f["sshPrnamt"].text)
    total = sum(p["value_usd"] for p in pos.values())
    tickers = figi_tickers(list(pos)) if use_figi else {}

    with db() as conn, conn.cursor() as cur:
        holder = entity_by_cik(cur, cik, sub["name"])
        did, _ = doc(
            cur, source(cur, sub["name"]), "filing", base, f"13F-HR {acc} for {period}", accepted
        )
        for c, p in pos.items():
            cur.execute("SELECT id FROM entity WHERE attrs->>'cusip' = %s", (c,))
            row = cur.fetchone()
            if row:
                inst = row[0]
            else:
                cur.execute(
                    "INSERT INTO entity (kind, name, attrs) VALUES ('instrument', %s, %s) RETURNING id",
                    (f"{p['issuer']} {p['class']}", Json({"cusip": c, "issuer_name": p["issuer"]})),
                )
                inst = cur.fetchone()[0]
            if c in tickers:  # issuer -> instrument, when we can resolve who issued it
                cur.execute(
                    """SELECT entity_id FROM security WHERE ticker = %s
                               AND exchange IN ('NYSE','Nasdaq','CBOE','NYSE American') LIMIT 1""",
                    (tickers[c],),
                )
                iss = cur.fetchone()
                if iss:
                    cur.execute(
                        """INSERT INTO link (src_id, dst_id, rel, attrs, evidence, confidence, source_id, known_at)
                                   SELECT %s, %s, 'issued', '{}', 'disclosed', 0.9, %s, %s
                                   WHERE NOT EXISTS (SELECT 1 FROM link WHERE src_id=%s AND dst_id=%s AND rel='issued')""",
                        (iss[0], inst, did, accepted, iss[0], inst),
                    )
            cur.execute(
                """INSERT INTO link (src_id, dst_id, rel, attrs, evidence, confidence, source_id,
                                             valid_from, known_at)
                           VALUES (%s,%s,'holds',%s,'disclosed',0.95,%s,%s,%s)""",
                (
                    holder,
                    inst,
                    Json(
                        {
                            "value_usd": p["value_usd"],
                            "shares": p["shares"],
                            "pct_of_portfolio": round(100 * p["value_usd"] / total, 2),
                        }
                    ),
                    did,
                    period,
                    accepted,
                ),
            )
    top = sorted(pos.items(), key=lambda kv: -kv[1]["value_usd"])[:5]
    print(
        f"{sub['name']}: {len(pos)} positions, ${total / 1e9:.1f}B, period {period}, public {accepted}"
    )
    for c, p in top:
        print(f"   {p['issuer']:<28} {100 * p['value_usd'] / total:5.1f}%  {tickers.get(c, '')}")


# ───────────── live 8-K watch ─────────────

ENTRY = re.compile(r"<entry>(.*?)</entry>", re.S)


def cmd_watch(loop):
    url = (
        "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&count=100&output=atom"
    )
    while True:
        feed = get(url).decode("latin-1")
        new = 0
        with db() as conn, conn.cursor() as cur:
            for e in reversed(ENTRY.findall(feed)):  # oldest first
                title = html.unescape(re.search(r"<title>(.*?)</title>", e).group(1))
                m = re.match(r"(\S+) - (.*) \((\d{10})\) \((\w+)\)", title)
                if not m or m.group(4) != "Filer":
                    continue
                form, name, cik = m.group(1), m.group(2), m.group(3)
                link = re.search(r'href="([^"]+)"', e).group(1)
                accepted = re.search(r"<updated>(.*?)</updated>", e).group(1)
                items = re.findall(
                    r"Item (\d\.\d\d): ([^<&]+)",
                    html.unescape(re.search(r"<summary[^>]*>(.*?)</summary>", e, re.S).group(1)),
                )

                src = source(cur, name)
                did, is_new = doc(cur, src, "filing", link, f"{form} {name}", accepted)
                if not is_new:
                    continue
                new += 1
                subject = entity_by_cik(cur, cik, name)
                cur.execute(
                    """INSERT INTO event (kind, description, occurred_at, first_seen_at)
                               VALUES (%s, %s, %s, now()) RETURNING id, first_seen_at - occurred_at""",
                    (
                        "filing_" + form.lower(),
                        f"{name}: " + "; ".join(f"{n} {t.strip()}" for n, t in items),
                        accepted,
                    ),
                )
                ev, lag = cur.fetchone()
                for num, text in items:
                    cur.execute(
                        """INSERT INTO claim (event_id, subject_id, change, statement, first_seen_at)
                                   VALUES (%s,%s,%s,%s, now()) RETURNING id""",
                        (ev, subject, ITEMS.get(num, "other"), f"Item {num}: {text.strip()}"),
                    )
                    cur.execute(
                        "INSERT INTO claim_evidence VALUES (%s,%s,'supports','primary')",
                        (cur.fetchone()[0], did),
                    )
                flagged = [ITEMS[n] for n, _ in items if n in ITEMS]
                print(
                    f"{accepted[11:19]} +{str(lag).split('.')[0]:>8}  {name[:40]:<40} {', '.join(flagged) or 'other'}"
                )
        print(f"-- {new} new filings")
        if not loop:
            break
        time.sleep(loop)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "companies":
        cmd_companies()
    elif a[0] == "facts":
        cmd_facts(a[1:])
    elif a[0] == "holdings":
        cmd_holdings(a[1], "--figi" in a)
    elif a[0] == "watch":
        cmd_watch(int(a[a.index("--loop") + 1]) if "--loop" in a else 0)
    else:
        sys.exit(__doc__)
