"""A small read-only JSON API over the local data store.

    parity serve [--port 8765]

It listens on 127.0.0.1 only and the host is not configurable, so nothing outside
this machine can reach it. That is why there is no login: only programs already
running on this computer can call it. Do not put it behind a tunnel or proxy without
adding authentication first. Only GET is answered.

    GET /                         list of endpoints
    GET /currencies[?all=1]       ISO 4217 table; all=1 adds withdrawn currencies
    GET /market-size[?year=2025&currency=EUR&instrument=B]
                                  BIS Triennial FX turnover (instrument default A = total)
    GET /ticks/{pair}?date=YYYY-MM-DD[&limit=1000]
                                  stored ticks for one UTC day, ts_ns in nanoseconds

Uses only the Python standard library.
"""

from __future__ import annotations

import json
import math
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pandas as pd

from .data import currencies, market_size, store, ticks

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
MAX_TICKS = 100_000


def _records(df: pd.DataFrame) -> list[dict]:
    out = []
    for row in df.to_dict(orient="records"):
        clean = {}
        for k, v in row.items():
            if v is pd.NA or (isinstance(v, float) and math.isnan(v)):
                v = None
            elif hasattr(v, "item"):  # numpy scalars
                v = v.item()
            clean[k] = v
        out.append(clean)
    return out


def route(path: str, query: dict[str, list[str]], root: Path) -> tuple[int, dict]:
    """Pure request handling, so tests need no socket. Returns (status, body)."""
    q = {k: v[0] for k, v in query.items() if v}
    parts = [p for p in path.split("/") if p]
    try:
        if not parts:
            return 200, {"endpoints": ["/currencies", "/market-size", "/ticks/{pair}?date="]}
        if parts == ["currencies"]:
            table = currencies.load(root, include_withdrawn=q.get("all") in {"1", "true"})
            return 200, {"count": len(table), "source": "ISO 4217 via SIX Group",
                         "currencies": _records(table)}
        if parts == ["market-size"]:
            table = market_size.load(root)
            year = int(q["year"]) if "year" in q else None
            rows = market_size.query(table, year, q.get("currency"), q.get("instrument", "A"))
            return 200, {"source": "BIS Triennial Central Bank Survey (BIS, WS_DER_OTC_TOV)",
                         "unit": "USD millions per day, April average",
                         "rows": _records(rows)}
        if len(parts) == 2 and parts[0] == "ticks":
            if "date" not in q:
                return 400, {"error": "date=YYYY-MM-DD is required"}
            limit = min(int(q.get("limit", 1000)), MAX_TICKS)
            day = ticks.load(parts[1], q["date"], root)
            return 200, {"pair": ticks.normalise_pair(parts[1]), "date": q["date"],
                         "timestamp_unit": "ns since 1970-01-01 UTC",
                         "summary": ticks.summary(day), "ticks": _records(day.head(limit))}
    except FileNotFoundError as exc:
        return 404, {"error": str(exc)}
    except ValueError as exc:
        return 400, {"error": str(exc)}
    return 404, {"error": f"Unknown path {path}"}


def make_handler(root: Path):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 (name set by http.server)
            url = urlparse(self.path)
            status, body = route(url.path, parse_qs(url.query), root)
            data = json.dumps(body, default=str).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _refuse(self):
            self.send_response(405)
            self.send_header("Allow", "GET")
            self.end_headers()

        do_POST = do_PUT = do_DELETE = do_PATCH = _refuse  # noqa: N815

    return Handler


def make_server(port: int = DEFAULT_PORT, root: Path = store.DEFAULT_DIR) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((HOST, port), make_handler(root))


def serve(port: int = DEFAULT_PORT, root: Path = store.DEFAULT_DIR) -> None:
    server = make_server(port, root)
    print(f"Parity data API on http://{HOST}:{server.server_address[1]} (local only, Ctrl+C stops)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
