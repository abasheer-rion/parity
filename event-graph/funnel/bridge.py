#!/usr/bin/env python3
"""The bridge from the funnel to the engine: material stories -> engine events -> frozen calls.

  bridge.py baseline [--days 30]   fill conflict_day from GDELT's archive (one file an hour,
    scaled to the day)
  bridge.py run                    sort new material stories, hand escalations to eg, freeze
    the calls (funnel.py run does this every 10 minutes)
  bridge.py report [--days N]      what became a call, and why the rest could not
  bridge.py calls [--days N]       the frozen calls

The engine reads claims, not headlines, so a story becomes an engine event only when a mechanism
can read it from what the news says. Today one can: a conflict that is NEW. GDELT reports ongoing
wars every day, so a country pair counts as escalating only when its last 24 hours carry
ESCALATION_X times its median day over the 30 days before (and at least MIN_ARTICLES), and when
MIN_OUTLETS independent newsrooms or wires name both sides in a conflict headline (GDELT alone
miscodes: "Israel fights United States (Jerusalem)"). The event's kind is then 'conflict' and
impact()'s channel rules (oil, defense, gold, fear) fan out through the exposures.

Every other material story is recorded as waiting, with the reason, so the list says which
mechanism or link to build next. Calls live here, not in eg, because build.sh drops eg.
"""

import csv
import io
import re
import sys
import urllib.error
import zipfile
from datetime import UTC, datetime, timedelta

import psycopg2
import psycopg2.extras

from funnel import db, get

ESCALATION_X = 3.0  # last 24 hours vs the pair's median day
MIN_ARTICLES = 100  # articles in 24 hours: below this a spike is noise
MIN_BASELINE_DAYS = 20  # days of baseline needed before a pair can escalate
MIN_OUTLETS = 2  # non-GDELT outlets that must name both sides in a conflict headline
REARM_DAYS = 7  # one escalation per pair per week: the rest is the same story going on
CONFLICT_ROOTS = ("18", "19", "20")  # CAMEO: assault, fight, mass violence
EVENT_ID_BASE = 1_000_000  # bridge events sit above the case library's hand-numbered ids
# GDELT's regional codes (Europe, Africa, ...) are not countries: a pair needs two states.
EXCLUDE = set("EUR AFR ASA MEA WST NMR SAM CAS SAS SEA CRB BLK SCN".split()) | {""}

# How headlines name each side: the country, its people, its capital or leader, or the place the
# fighting is about. A country not listed here cannot be corroborated, so it cannot escalate.
NAMES = {
    "USA": ("United States", "U.S.", "US", "American", "Washington", "Pentagon", "Trump"),
    "CHN": ("China", "Chinese", "Beijing"),
    "TWN": ("Taiwan", "Taiwanese", "Taipei"),
    "RUS": ("Russia", "Russian", "Moscow", "Kremlin", "Putin"),
    "UKR": ("Ukraine", "Ukrainian", "Kyiv", "Zelensky"),
    "ISR": ("Israel", "Israeli", "IDF", "Netanyahu"),
    "PSE": ("Gaza", "Hamas", "Palestinian", "West Bank"),
    "LBN": ("Lebanon", "Lebanese", "Hezbollah", "Beirut"),
    "IRN": ("Iran", "Iranian", "Tehran"),
    "IRQ": ("Iraq", "Iraqi", "Baghdad"),
    "SYR": ("Syria", "Syrian", "Damascus"),
    "YEM": ("Yemen", "Houthi", "Houthis"),
    "SAU": ("Saudi", "Riyadh", "Aramco"),
    "ARE": ("UAE", "Emirati", "Abu Dhabi", "Dubai"),
    "QAT": ("Qatar", "Doha"),
    "JOR": ("Jordan", "Jordanian", "Amman"),
    "EGY": ("Egypt", "Egyptian", "Cairo"),
    "TUR": ("Turkey", "Turkish", "Ankara"),
    "IND": ("India", "Indian", "New Delhi"),
    "PAK": ("Pakistan", "Pakistani", "Islamabad"),
    "AFG": ("Afghanistan", "Afghan", "Taliban", "Kabul"),
    "PRK": ("North Korea", "North Korean", "Pyongyang"),
    "KOR": ("South Korea", "South Korean", "Seoul"),
    "JPN": ("Japan", "Japanese", "Tokyo"),
    "PHL": ("Philippines", "Philippine", "Manila"),
    "VNM": ("Vietnam", "Vietnamese"),
    "GBR": ("Britain", "British", "UK", "London"),
    "FRA": ("France", "French", "Paris"),
    "DEU": ("Germany", "German", "Berlin"),
    "POL": ("Poland", "Polish", "Warsaw"),
    "BLR": ("Belarus", "Belarusian", "Minsk"),
    "ARM": ("Armenia", "Armenian"),
    "AZE": ("Azerbaijan", "Azerbaijani"),
    "SDN": ("Sudan", "Sudanese", "Khartoum", "RSF"),
    "LBY": ("Libya", "Libyan"),
    "ETH": ("Ethiopia", "Ethiopian"),
    "SOM": ("Somalia", "Somali", "al-Shabaab"),
    "NGA": ("Nigeria", "Nigerian"),
    "COD": ("Congo", "Congolese", "M23"),
    "RWA": ("Rwanda", "Rwandan"),
    "VEN": ("Venezuela", "Venezuelan", "Caracas", "Maduro"),
    "MEX": ("Mexico", "Mexican"),
    "COL": ("Colombia", "Colombian"),
    "CUB": ("Cuba", "Cuban", "Havana"),
}

# Why a waiting story waits, by kind: the claim the engine would need that news alone cannot give.
NEEDS = {
    "leader_change": "governance needs the leader's record (a leads link with tenure return)",
    "earnings": "earnings_surprise needs the consensus number",
    "guidance": "a guidance change needs the old and new range",
    "capacity_loss": "supply_loss needs the facility, what it makes and who buys it",
    "deal": "no mechanism reads deals yet",
    "policy": "policy reads export restrictions and sanctions on named companies only",
    "sanction": "a sanction needs the designated company in the graph",
    "financial_stress": "financial reads bank runs on banks with balance-sheet facts only",
    "halt": "no mechanism reads trading halts yet",
    "capital": "no mechanism reads offerings or buybacks yet",
}

# The conflict rows of GDELT's raw table: root events of CAMEO 18-20 between two different states.
CONFLICT_ROWS = """body->>25 = '1' AND body->>28 = ANY(%(roots)s) AND body->>7 <> body->>17
                   AND NOT (body->>7 = ANY(%(exclude)s)) AND NOT (body->>17 = ANY(%(exclude)s))"""
PAIR = "least(body->>7, body->>17) || '-' || greatest(body->>7, body->>17)"
ADDED = "to_timestamp(body->>59, 'YYYYMMDDHH24MISS')"  # the GDELT file a row came in


def sql_args():
    return {"roots": list(CONFLICT_ROOTS), "exclude": list(EXCLUDE)}


def pair_of(a, b):
    return "-".join(sorted((a, b)))


def rows_to_days(rows, days):
    """Add GDELT export rows to days[(pair, date)] = articles."""
    for r in rows:
        if len(r) < 61 or r[25] != "1" or r[28] not in CONFLICT_ROOTS:
            continue
        a, b = r[7], r[17]
        if a in EXCLUDE or b in EXCLUDE or a == b:
            continue
        k = (pair_of(a, b), datetime.strptime(r[59][:8], "%Y%m%d").date())
        days[k] = days.get(k, 0) + int(r[33] or 0)


def cmd_baseline(n_days):
    con = db()
    end = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    start = (end - timedelta(days=n_days)).replace(hour=0)
    files, t = {}, start
    with con.cursor() as cur:
        cur.execute("SELECT day, max(files) FROM conflict_day GROUP BY 1")
        have = dict(cur.fetchall())
    while t < end:  # one file an hour; a day done before is not fetched again
        if have.get(t.date(), 0) < 24:
            files.setdefault(t.date(), []).append(t)
        t += timedelta(hours=1)
    for day, hours in sorted(files.items()):
        counts, got = {}, 0
        for h in hours:
            url = f"http://data.gdeltproject.org/gdeltv2/{h:%Y%m%d%H%M%S}.export.CSV.zip"
            try:
                status, body, _ = get(url)
            except (urllib.error.URLError, TimeoutError):
                continue
            if status != 200:
                continue
            with zipfile.ZipFile(io.BytesIO(body)) as z:
                text = z.read(z.namelist()[0]).decode("utf-8", "replace")
            # DATEADDED, not the hour asked for, decides the day; keep only this day's rows
            rows = [
                r
                for r in csv.reader(io.StringIO(text), delimiter="\t")
                if r[59:60] and r[59][:8] == f"{day:%Y%m%d}"
            ]
            rows_to_days(rows, counts)
            got += 1
        with con, con.cursor() as cur:
            for (pair, d), n in counts.items():
                cur.execute(
                    """INSERT INTO conflict_day (pair, day, articles, files)
                       VALUES (%s,%s,%s,%s) ON CONFLICT (pair, day) DO UPDATE
                       SET articles = EXCLUDED.articles, files = EXCLUDED.files""",
                    (pair, d, n, got),
                )
        print(f"{day}: {got} files, {len(counts)} pairs")


def refresh_live_days(cur):
    """Days the funnel saw in full (raw GDELT rows) replace the hourly samples for those days."""
    cur.execute(
        f"""WITH g AS (SELECT body, left(body->>59, 8) AS ymd FROM raw
                      WHERE feed_id = 'gdelt_events' AND seen_at > now() - interval '3 days'),
                 f AS (SELECT ymd, count(DISTINCT body->>59) AS files FROM g GROUP BY 1)
            INSERT INTO conflict_day (pair, day, articles, files)
            SELECT {PAIR}, to_date(g.ymd, 'YYYYMMDD'), sum((body->>33)::int), max(f.files)
            FROM g JOIN f USING (ymd) WHERE {CONFLICT_ROWS}
            GROUP BY 1, 2
            ON CONFLICT (pair, day) DO UPDATE SET articles = EXCLUDED.articles,
              files = EXCLUDED.files WHERE EXCLUDED.files >= conflict_day.files""",
        sql_args(),
    )


def escalations(cur):
    """Pairs whose last 24 hours (raw rows, scaled to a full day) beat their own baseline."""
    cur = cur.connection.cursor()  # plain rows: the caller's cursor returns dicts
    cur.execute(
        f"""WITH last AS (
              SELECT {PAIR} AS pair, sum((body->>33)::int) AS n FROM raw
              WHERE feed_id = 'gdelt_events' AND {CONFLICT_ROWS}
                AND {ADDED} > now() - interval '24 hours'
              GROUP BY 1),
            cover AS (SELECT count(DISTINCT body->>59) AS files FROM raw
                      WHERE feed_id = 'gdelt_events' AND {ADDED} > now() - interval '24 hours'),
            base AS (                 -- a day the pair did not appear counts as zero articles
              SELECT p.pair, percentile_cont(0.5) WITHIN GROUP (
                       ORDER BY coalesce(c.articles * 96.0 / greatest(c.files, 1), 0)) AS median
              FROM (SELECT DISTINCT pair FROM conflict_day) p
              CROSS JOIN generate_series(current_date - 31, current_date - 2, interval '1 day') d
              LEFT JOIN conflict_day c ON c.pair = p.pair AND c.day = d::date
              GROUP BY 1)
            SELECT l.pair, round(l.n * 96.0 / greatest(c.files, 1))::int, coalesce(b.median, 0),
                   c.files
            FROM last l CROSS JOIN cover c LEFT JOIN base b USING (pair)""",
        sql_args(),
    )
    rows = cur.fetchall()
    cur.execute("SELECT count(DISTINCT day) FROM conflict_day WHERE day >= current_date - 31")
    baseline_days = cur.fetchone()[0]
    if baseline_days < MIN_BASELINE_DAYS:
        return []
    out = []
    for pair, per_day, median, files in rows:
        if files < 48:  # under half a day of files: the funnel was down, the rate is a guess
            continue
        if per_day >= MIN_ARTICLES and per_day >= ESCALATION_X * max(float(median), 1):
            out.append((pair, per_day, float(median)))
    return out


def corroboration(cur, pair):
    """Distinct non-GDELT outlets whose conflict headlines in the last 24 hours name both sides."""
    a, b = pair.split("-")
    if a not in NAMES or b not in NAMES:
        return 0

    def rx(code):
        return r"\m(" + "|".join(re.escape(n) for n in NAMES[code]) + r")\M"

    cur.execute(
        """SELECT count(DISTINCT coalesce(i.publisher, i.feed_id))
           FROM item i JOIN story s ON s.id = i.story_id
           WHERE i.feed_id NOT LIKE 'gdelt%%' AND i.seen_at > now() - interval '24 hours'
             AND s.kind IN ('conflict', 'coercion', 'sanction')
             AND (i.title || ' ' || coalesce(i.summary, '')) ~ %s
             AND (i.title || ' ' || coalesce(i.summary, '')) ~ %s""",
        (rx(a), rx(b)),
    )
    return cur.fetchone()[0]


def eg_event(ec, esc_id, pair, per_day, median, detected_at):
    """The escalation as an eg event of kind 'conflict'. Same id after every rebuild of eg."""
    eid = EVENT_ID_BASE + esc_id
    ec.execute("SELECT 1 FROM event WHERE id = %s", (eid,))
    if ec.fetchone():
        return eid
    ec.execute(
        """INSERT INTO event (id, kind, description, occurred_at, first_seen_at)
           VALUES (%s, 'conflict', %s, %s, %s)""",
        (
            eid,
            f"Escalation {pair}: {per_day} conflict articles in 24 hours vs a median "
            f"{median:.0f} a day (GDELT, confirmed by {MIN_OUTLETS}+ outlets)",
            detected_at,
            detected_at,
        ),
    )
    return eid


def freeze_calls(cur, ec, esc_id, eid, at):
    ec.execute(
        "SELECT ticker, name, mechanism, direction, impact, conf, path FROM impact(%s, %s)",
        (eid, at),
    )
    calls = ec.fetchall()
    for c in calls:
        cur.execute(
            """INSERT INTO live_call (escalation_id, ticker, name, mechanism, direction, impact,
                 conf, path) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (esc_id, *c),
        )
    return len(calls)


def why_waiting(s, known, escalated):
    kind = s["kind"]
    if kind in ("conflict", "coercion"):
        cs = [c for c in s["countries"] if c not in EXCLUDE]
        if len(cs) < 2:
            return "waiting", "conflict: no two countries named", None
        p = pair_of(cs[0], cs[1])
        if p in escalated:
            return "event", f"conflict: {p} escalated", escalated[p]
        return "waiting", f"conflict: {p} not an escalation", None
    if not s["tickers"]:
        return "waiting", "no company named", None
    if not known & set(s["tickers"]):
        return "waiting", "company not in the graph", None
    return "waiting", NEEDS.get(kind, f"no mechanism reads {kind}"), None


unconfirmed_said = set()  # spikes no outlet confirmed, logged once per process


def cmd_run(say=print):
    con, eg = db(), db("eg")
    made = 0
    with (
        con,
        con.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur,
        eg,
        eg.cursor() as ec,
    ):
        refresh_live_days(cur)
        cur.execute(
            "SELECT pair, id FROM escalation WHERE detected_at > now() - make_interval(days => %s)",
            (REARM_DAYS,),
        )
        live = {r["pair"]: r["id"] for r in cur.fetchall()}
        for pair, per_day, median in escalations(cur):
            if pair in live:
                continue
            outlets = corroboration(con.cursor(), pair)
            if outlets < MIN_OUTLETS:
                if pair not in unconfirmed_said:
                    unconfirmed_said.add(pair)
                    say(
                        f"bridge: {pair} spiked ({per_day}/day vs median {median:.0f}), "
                        f"{outlets} outlet(s) confirm it: not an event"
                    )
                continue
            cur.execute(
                """INSERT INTO escalation (pair, articles_24h, baseline) VALUES (%s,%s,%s)
                   RETURNING id, detected_at""",
                (pair, per_day, median),
            )
            r = cur.fetchone()
            eid = eg_event(ec, r["id"], pair, per_day, median, r["detected_at"])
            cur.execute("UPDATE escalation SET eg_event_id = %s WHERE id = %s", (eid, r["id"]))
            n = freeze_calls(cur, ec, r["id"], eid, r["detected_at"])
            live[pair] = r["id"]
            made += n
            say(f"bridge: escalation {pair} ({per_day}/day vs median {median:.0f}): {n} calls")
        # after a rebuild of eg, put the events back (their calls stay as they were frozen)
        cur.execute("SELECT id, pair, articles_24h, baseline, detected_at FROM escalation")
        for r in cur.fetchall():
            eg_event(
                ec, r["id"], r["pair"], r["articles_24h"], float(r["baseline"]), r["detected_at"]
            )
        ec.execute("SELECT ticker FROM security WHERE is_primary")
        known = {t for (t,) in ec.fetchall()}
        cur.execute(
            """SELECT s.* FROM story s LEFT JOIN bridge b ON b.story_id = s.id
               WHERE s.material AND (b.story_id IS NULL
                 OR (b.status = 'waiting' AND s.updated_at > b.decided_at))"""
        )
        n_sorted = 0
        for s in cur.fetchall():
            status, reason, esc = why_waiting(s, known, live)
            cur.execute(
                """INSERT INTO bridge (story_id, status, reason, escalation) VALUES (%s,%s,%s,%s)
                   ON CONFLICT (story_id) DO UPDATE SET status = EXCLUDED.status,
                     reason = EXCLUDED.reason, escalation = EXCLUDED.escalation,
                     decided_at = now()""",
                (s["id"], status, reason, esc),
            )
            n_sorted += 1
    if n_sorted or made:
        say(f"bridge: sorted {n_sorted} material stories, froze {made} calls")


def cmd_report(days):
    con = db()
    with con, con.cursor() as cur:
        cur.execute(
            """SELECT b.status,
                 CASE WHEN b.reason LIKE '%%not an escalation' THEN 'conflict: not an escalation'
                      ELSE b.reason END AS why,
                 count(*), (array_agg(s.title ORDER BY s.n_items DESC))[1]
               FROM bridge b JOIN story s ON s.id = b.story_id
               WHERE s.first_seen > now() - make_interval(days => %s)
               GROUP BY 1, 2 ORDER BY 1, 3 DESC""",
            (days,),
        )
        rows = cur.fetchall()
        print(f"Material stories, last {days} days: {sum(r[2] for r in rows)}")
        for status, reason, n, example in rows:
            print(f"{n:5}  {status:<8} {reason[:66]:<66}  e.g. {example[:60]}")
        cur.execute(
            """SELECT pair, detected_at, articles_24h, baseline,
                 (SELECT count(*) FROM live_call c WHERE c.escalation_id = e.id)
               FROM escalation e WHERE detected_at > now() - make_interval(days => %s)
               ORDER BY detected_at""",
            (days,),
        )
        esc = cur.fetchall()
    print(f"\nEscalations handed to the engine: {len(esc)}")
    for pair, at, n, base, calls in esc:
        print(f"  {at:%m-%d %H:%M} {pair:<8} {n}/day vs median {float(base):.0f}: {calls} calls")


def cmd_calls(days):
    con = db()
    with con, con.cursor() as cur:
        cur.execute(
            """SELECT e.pair, c.made_at, c.ticker, c.direction * abs(c.impact), c.conf, c.path
               FROM live_call c JOIN escalation e ON e.id = c.escalation_id
               WHERE c.made_at > now() - make_interval(days => %s)
               ORDER BY c.made_at, abs(c.impact * c.conf) DESC""",
            (days,),
        )
        for pair, at, t, signed, conf, path in cur.fetchall():
            print(
                f"{at:%m-%d %H:%M} {pair:<8} {t or '-':<8} {float(signed):+6.1f}% "
                f"conf {float(conf):.2f}  {path[:90]}"
            )


if __name__ == "__main__":
    a = sys.argv[1:]

    def opt(flag, default):
        return int(a[a.index(flag) + 1]) if flag in a else default

    if not a:
        sys.exit(__doc__)
    if a[0] == "baseline":
        cmd_baseline(opt("--days", 30))
    elif a[0] == "run":
        cmd_run()
    elif a[0] == "report":
        cmd_report(opt("--days", 7))
    elif a[0] == "calls":
        cmd_calls(opt("--days", 7))
    else:
        sys.exit(__doc__)
