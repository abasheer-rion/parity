#!/usr/bin/env python3
"""Pull official event catalogs into event_candidate, the triage queue in front of event/claim.

  catalog.py fetch [--since YYYY-MM-DD]      every catalog below
  catalog.py list [--material] [--days N]   what came in

Catalogs (all public, no key):
  fedreg     Federal Register documents from agencies that move markets (BIS, OFAC, USTR, Commerce, FDA, Fed, SEC, Energy)
  fedreg_pi  Federal Register public inspection: documents filed before publication; known_at = filed_at
  ofac       OFAC recent actions (designations land here days before the Federal Register notice)
  fed_press  Federal Reserve press releases (rate decisions, emergency facilities, enforcement)
  fema       FEMA disaster declarations
  usgs       USGS earthquakes, magnitude 6+
"""

import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import UTC, date, datetime, timedelta, timezone

import psycopg2

AGENCIES = [
    "industry-and-security-bureau",
    "foreign-assets-control-office",
    "trade-representative-office-of-united-states",
    "international-trade-administration",
    "food-and-drug-administration",
    "federal-reserve-system",
    "securities-and-exchange-commission",
    "energy-department",
    "federal-energy-regulatory-commission",
    "executive-office-of-the-president",
]

# Title patterns -> kind. A candidate is material when its kind can move prices; routine paperwork is kept but not flagged.
KINDS = [
    ("sanction", r"sanctions action|specially designated|blocking property|sanctions regulations"),
    (
        "export_control",
        r"entity list|export administration regulations|foreign direct product|advanced computing",
    ),
    ("tariff", r"tariff|section 301|section 232|antidumping|countervailing|duties"),
    (
        "rate_decision",
        r"fomc|federal open market committee|discount rate|interest rate|emergency|lending facility",
    ),
    (
        "approval",
        r"approval of|approves|biologics license|new drug application|priority review voucher",
    ),
    ("energy", r"strategic petroleum reserve|crude oil|lng export|pipeline"),
]
ROUTINE = (
    r"information collection|sunshine act|meetings?;|privacy act|paperwork reduction|termination of enforcement|charter renewal"
    r"|administrative review|continuation of the national emergency|sunset review|scope ruling|opportunity to request"
    r"|postponement of|correction|blanket authorization|notice of request|affiliate committed|initiation of"
    r"|emergency use|web general license|continuation of antidumping"
)
# Federal Register lags the act itself (OFAC posts designations days before the FR notice), so OFAC is read at source.


def classify(title):
    t = title.lower()
    for kind, pat in KINDS:
        if re.search(pat, t):
            return kind, not re.search(ROUTINE, t)
    return "other", False


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Parity research)"})
    return urllib.request.urlopen(req, timeout=60).read()


def db():
    return psycopg2.connect(
        host=os.environ.get("PGHOST", os.path.expanduser("~/event-graph/.pgdata")),
        port=os.environ.get("PGPORT", "5499"),
        user=os.environ.get("PGUSER", "postgres"),
        dbname=os.environ.get("PGDATABASE", "eg"),
    )


def put(
    cur,
    catalog,
    ext_id,
    title,
    url,
    known_at,
    agency=None,
    kind=None,
    material=None,
    occurred_at=None,
    published_at=None,
    attrs=None,
):
    if kind is None:
        kind, material = classify(title)
    cur.execute(
        """INSERT INTO event_candidate (catalog, ext_id, agency, kind, title, url, occurred_at, known_at,
                                                published_at, material, attrs)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (catalog, ext_id) DO UPDATE SET title = EXCLUDED.title,
                     known_at = LEAST(event_candidate.known_at, EXCLUDED.known_at), published_at = EXCLUDED.published_at
                   RETURNING (xmax = 0)""",
        (
            catalog,
            ext_id,
            agency,
            kind,
            title.strip(),
            url,
            occurred_at,
            known_at,
            published_at,
            bool(material),
            json.dumps(attrs or {}),
        ),
    )
    return cur.fetchone()[0]


def fedreg(cur, since):
    new = 0
    fields = "".join(
        f"&fields%5B%5D={f}"
        for f in [
            "document_number",
            "title",
            "type",
            "publication_date",
            "html_url",
            "agencies",
            "public_inspection_pdf_url",
            "abstract",
        ]
    )
    for ag in AGENCIES:
        page = 1
        while page <= 20:
            q = (
                f"https://www.federalregister.gov/api/v1/documents.json?per_page=100&page={page}&order=newest"
                f"&conditions%5Bagencies%5D%5B%5D={ag}&conditions%5Bpublication_date%5D%5Bgte%5D={since}{fields}"
            )
            d = json.loads(get(q))
            for r in d.get("results", []):
                pub = datetime.fromisoformat(
                    r["publication_date"] + "T06:00:00-04:00"
                )  # FR goes live ~6am ET
                new += put(
                    cur,
                    "fedreg",
                    r["document_number"],
                    r["title"],
                    r["html_url"],
                    pub,
                    agency=ag,
                    published_at=pub,
                    attrs={"type": r["type"], "abstract": (r.get("abstract") or "")[:500]},
                )
            if not d.get("next_page_url"):
                break
            page += 1
    return new


def fedreg_pi(cur, since):
    new = 0
    d = json.loads(
        get("https://www.federalregister.gov/api/v1/public-inspection-documents/current.json")
    )
    for r in d.get("results", []):
        if not r.get("filed_at"):  # scheduled but not yet on file: nothing public to know yet
            continue
        filed = datetime.fromisoformat(r["filed_at"])
        pub = datetime.fromisoformat(r["publication_date"] + "T06:00:00-04:00")
        new += put(
            cur,
            "fedreg_pi",
            r["document_number"],
            r["title"],
            r["html_url"],
            filed,
            agency=", ".join(r.get("agency_names") or []),
            published_at=pub,
            attrs={
                "lead_hours": round((pub - filed).total_seconds() / 3600, 1),
                "filing_type": r.get("filing_type"),
            },
        )
        # The same document's later publication must not move its known_at forward
        cur.execute(
            "UPDATE event_candidate SET known_at = LEAST(known_at, %s) WHERE catalog = 'fedreg' AND ext_id = %s",
            (filed, r["document_number"]),
        )
    return new


def ofac(cur, since):
    new = 0
    for page in range(0, 30):
        html = get(f"https://ofac.treasury.gov/recent-actions?page={page}").decode(
            "utf-8", "replace"
        )
        rows = re.findall(r'href="/recent-actions/(\d{8})(_\d+)?"[^>]*>([^<]+)<', html)
        if not rows:
            break
        for ymd, suffix, title in rows:
            d = date(int(ymd[:4]), int(ymd[4:6]), int(ymd[6:]))
            if d < since:
                return new
            title = title.replace("&#039;", "'").replace("&amp;", "&")
            material = bool(re.search(r"designations(?! removal)|sanctions", title, re.I))
            new += put(
                cur,
                "ofac",
                ymd + (suffix or ""),
                title,
                f"https://ofac.treasury.gov/recent-actions/{ymd}{suffix or ''}",
                datetime(
                    d.year, d.month, d.day, 10, tzinfo=timezone(timedelta(hours=-4))
                ),  # date only; posted in ET business hours
                agency="OFAC",
                kind="sanction",
                material=material,
                attrs={"programs": re.findall(r"([A-Z][\w-]+)-related", title)},
            )
    return new


def fed_press(cur, since):
    new = 0
    root = ET.fromstring(get("https://www.federalreserve.gov/feeds/press_all.xml"))
    for it in root.iter("item"):
        t = datetime.strptime(it.findtext("pubDate").strip(), "%a, %d %b %Y %H:%M:%S %Z").replace(
            tzinfo=UTC
        )
        if t.date() < since:
            continue
        title, link = it.findtext("title"), it.findtext("link").strip()
        kind, material = (
            ("rate_decision", True) if re.search(r"monetary\d", link) else classify(title)
        )
        new += put(
            cur,
            "fed_press",
            link,
            title,
            link,
            t,
            agency="Federal Reserve",
            kind=kind,
            material=material,
        )
    return new


def fema(cur, since):
    new = 0
    q = (
        "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=1000&$orderby=declarationDate%20desc"
        f"&$filter=declarationDate%20ge%20'{since}'"
    )
    seen = set()
    for r in json.loads(get(q.replace(" ", "%20")))["DisasterDeclarationsSummaries"]:
        key = r["femaDeclarationString"]
        if key in seen:  # one row per county; one candidate per declaration
            continue
        seen.add(key)
        title = f"{r['declarationTitle'].title()} ({r['incidentType']}, {r['state']}) - {r['declarationType']} declaration"
        new += put(
            cur,
            "fema",
            key,
            title,
            f"https://www.fema.gov/disaster/{r['disasterNumber']}",
            datetime.fromisoformat(r["declarationDate"].replace("Z", "+00:00")),
            agency="FEMA",
            kind="disaster",
            material=r["declarationType"] == "DR",
            occurred_at=datetime.fromisoformat(r["incidentBeginDate"].replace("Z", "+00:00")),
            attrs={"state": r["state"], "incident": r["incidentType"]},
        )
    return new


def usgs(cur, since):
    new = 0
    d = json.loads(
        get(
            f"https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime={since}&minmagnitude=6"
        )
    )
    for f in d["features"]:
        p = f["properties"]
        t = datetime.fromtimestamp(p["time"] / 1000, UTC)
        lon, lat = f["geometry"]["coordinates"][:2]
        new += put(
            cur,
            "usgs",
            f["id"],
            f"M{p['mag']} earthquake, {p['place']}",
            p["url"],
            t,
            agency="USGS",
            kind="quake",
            material=p["mag"] >= 7 or (p.get("alert") in ("orange", "red")),
            occurred_at=t,
            attrs={
                "mag": p["mag"],
                "lat": lat,
                "lon": lon,
                "alert": p.get("alert"),
                "tsunami": p.get("tsunami"),
            },
        )
    return new


def cmd_fetch(since):
    conn = db()
    for name, fn in [
        ("fedreg", fedreg),
        ("fedreg_pi", fedreg_pi),
        ("ofac", ofac),
        ("fed_press", fed_press),
        ("fema", fema),
        ("usgs", usgs),
    ]:
        try:
            with conn, conn.cursor() as cur:
                print(f"{name}: {fn(cur, since)} new")
        except Exception as e:  # one catalog down must not stop the rest
            print(f"{name}: FAILED ({e})")


def cmd_list(material, days):
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT known_at::date, catalog, kind, left(title, 100), attrs->>'lead_hours' FROM event_candidate
                       WHERE known_at > now() - make_interval(days => %s) AND (material OR NOT %s)
                       ORDER BY known_at DESC""",
            (days, material),
        )
        for r in cur.fetchall():
            print(*[x for x in r if x is not None], sep="  ")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["fetch"]:
        cmd_fetch(
            date.fromisoformat(a[a.index("--since") + 1])
            if "--since" in a
            else date.today() - timedelta(days=30)
        )
    elif a[:1] == ["list"]:
        cmd_list("--material" in a, int(a[a.index("--days") + 1]) if "--days" in a else 30)
    else:
        print(__doc__)
