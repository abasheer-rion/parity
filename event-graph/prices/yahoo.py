#!/usr/bin/env python3
"""Daily adjusted closes -> price_daily, for scoring cases (abnormal returns).

  yahoo.py FROM TO TICKER:EXCHANGE [TICKER:EXCHANGE ...]     dates as YYYY-MM-DD

Research use only: Yahoo's public chart endpoint. Production should load licensed prices (e.g. FactSet) into the
same table. A ticker not yet in `security` is created with its own entity, so benchmarks like SPY can be loaded.
"""

import json
import os
import sys
import time
import urllib.request
from datetime import UTC, datetime

import psycopg2

YAHOO_SUFFIX = {
    "TSE": ".T",
    "XETRA": ".DE",
    "HKEX": ".HK",
    "SZSE": ".SZ",
    "SSE": ".SS",
    "KRX": ".KS",
    "TWSE": ".TW",
    "TPEX": ".TWO",
    "TSX": ".TO",
    "ASX": ".AX",
    "AMS": ".AS",
    "SIX": ".SW",
    "HEL": ".HE",
    "STO": ".ST",
    "LSE": ".L",
    "EPA": ".PA",
    "OSL": ".OL",
    "MOEX": ".ME",
    "B3": ".SA",
    "KOSDAQ": ".KQ",
    "NSE": ".NS",
}  # how Yahoo spells non-US listings


def fetch(symbol, start, end):
    p1 = int(datetime.fromisoformat(start).replace(tzinfo=UTC).timestamp())
    p2 = int(datetime.fromisoformat(end).replace(tzinfo=UTC).timestamp()) + 86400
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={p1}&period2={p2}&interval=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    d = json.loads(urllib.request.urlopen(req, timeout=30).read())["chart"]["result"][0]
    closes = d["indicators"]["adjclose"][0]["adjclose"]
    vols = d["indicators"]["quote"][0]["volume"]
    off = d["meta"].get("gmtoffset", 0)  # exchange-local trading date, not UTC
    return [
        (datetime.fromtimestamp(t + off, UTC).date(), c, v)
        for t, c, v in zip(d["timestamp"], closes, vols, strict=False)
        if c is not None
    ]


def main(start, end, specs):
    conn = psycopg2.connect(
        host=os.environ.get("PGHOST", os.path.expanduser("~/event-graph/.pgdata")),
        port=os.environ.get("PGPORT", "5499"),
        user=os.environ.get("PGUSER", "postgres"),
        dbname=os.environ.get("PGDATABASE", "eg"),
    )
    with conn, conn.cursor() as cur:
        for spec in specs:
            ticker, exchange = spec.split(":")
            cur.execute(
                "SELECT id FROM security WHERE ticker = %s AND exchange = %s", (ticker, exchange)
            )
            row = cur.fetchone()
            if row:
                sid = row[0]
            else:
                cur.execute(
                    "INSERT INTO entity (kind, name) VALUES ('company', %s) RETURNING id", (ticker,)
                )
                cur.execute(
                    "INSERT INTO security (entity_id, ticker, exchange) VALUES (%s,%s,%s) RETURNING id",
                    (cur.fetchone()[0], ticker, exchange),
                )
                sid = cur.fetchone()[0]
            try:
                rows = fetch(ticker + YAHOO_SUFFIX.get(exchange, ""), start, end)
            except Exception as e:  # one bad or delisted ticker must not sink the batch
                print(f"{spec}: FAILED ({e})")
                continue
            for d, c, v in rows:
                cur.execute(
                    """INSERT INTO price_daily VALUES (%s,%s,%s,%s)
                               ON CONFLICT (security_id, d) DO UPDATE SET close_adj = EXCLUDED.close_adj""",
                    (sid, d, c, v),
                )
            print(f"{spec}: {len(rows)} days")
            time.sleep(0.5)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
