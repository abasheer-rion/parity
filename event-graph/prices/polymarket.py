#!/usr/bin/env python3
"""Daily prediction-market odds -> price_daily, so an outcome's probability can be a driver like any price.

  polymarket.py TOKEN_ID TICKER "NAME"      (close = probability in points, 0-100)

Public Polymarket CLOB history (no key). A day's close is the last print before 00:00 UTC of the next day,
i.e. ~21:00 in Brasilia / 20:00 in New York: after that day's stock close, so the same date lines up with it.
"""

import json
import os
import sys
import urllib.request
from datetime import UTC, datetime, timedelta

import psycopg2


def main(token, ticker, name):
    url = f"https://clob.polymarket.com/prices-history?market={token}&interval=max&fidelity=1440"
    hist = json.loads(
        urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30
        ).read()
    )["history"]
    conn = psycopg2.connect(
        host=os.environ.get("PGHOST", os.path.expanduser("~/event-graph/.pgdata")),
        port=os.environ.get("PGPORT", "5499"),
        user=os.environ.get("PGUSER", "postgres"),
        dbname=os.environ.get("PGDATABASE", "eg"),
    )
    with conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM security WHERE ticker = %s AND exchange = 'Polymarket'", (ticker,)
        )
        row = cur.fetchone()
        if not row:
            cur.execute(
                "INSERT INTO entity (kind, name) VALUES ('instrument', %s) RETURNING id", (name,)
            )
            cur.execute(
                "INSERT INTO security (entity_id, ticker, exchange) VALUES (%s,%s,'Polymarket') RETURNING id",
                (cur.fetchone()[0], ticker),
            )
            row = cur.fetchone()
        for x in hist:
            d = (
                datetime.fromtimestamp(x["t"], UTC) - timedelta(hours=4)
            ).date()  # 00:00 UTC stamp -> prior day
            cur.execute(
                """INSERT INTO price_daily VALUES (%s,%s,%s,NULL)
                           ON CONFLICT (security_id, d) DO UPDATE SET close_adj = EXCLUDED.close_adj""",
                (row[0], d, round(100 * x["p"], 2)),
            )
    print(f"{ticker}: {len(hist)} days")


if __name__ == "__main__":
    main(*sys.argv[1:4])
