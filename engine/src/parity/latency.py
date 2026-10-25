"""How old our data is at every hop, and a retry for sources that fell behind (DEC-0045).

Every row follows one item from its source to the site:

    source_at     the source's own as-of time: the last bar's date, the newest headline,
                  CoinGecko's last update, the latest filing
    fetched_at    when we last fetched it successfully
    published_at  when the site last published it (the deploy job sets this)

Each row also carries the cadence we expect and which of the three times that cadence
applies to (`basis`). A central bank feed can be quiet for weeks, so for news what must
be recent is our last look at it, not the newest headline.

A row is late (amber) once its age passes the cadence and stale (red) once it passes the
cadence times `STALE_FACTOR`. Nobody is paged: the rows are recorded and shown on the
latency page, and `retry_stale` fetches stale sources once more, with a pause, logging
what it did.

    parity latency freshness [--dist web/dist] [--publish] [--stage fetched|published]
    parity latency retry [--publish] [--no-news]
"""

from __future__ import annotations

import json
import os
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd

from .data import catalog, store

#: A row past its cadence is late; past cadence times this, it is stale.
STALE_FACTOR = 2.0

#: How old a healthy source's newest point can be, in hours, by provider and frequency.
#: Daily series cover a weekend plus the source's usual publication lag; the Fed's H.10
#: currencies post about a week late. Monthly and quarterly ones add their release lag.
DAY = 24.0
PRICE_CADENCE: dict[tuple[str, str], float] = {
    ("fred", "D"): 6 * DAY,  # oil, gas and the S&P 500 reach FRED two or three days late
    ("ecb", "D"): 4 * DAY,
    ("treasury", "D"): 4 * DAY,
    ("derived", "D"): 4 * DAY,
    ("yahoo", "D"): 4 * DAY,
    ("bis", "D"): 21 * DAY,
    ("french", "D"): 75 * DAY,
    ("cftc", "W"): 11 * DAY,
    ("eia", "W"): 11 * DAY,
}
#: A monthly value is dated the 1st, covers that month, and comes out a month or more
#: later, so just before the next release the newest one is over three months old.
FREQ_CADENCE = {"D": 4 * DAY, "W": 11 * DAY, "M": 120 * DAY, "Q": 200 * DAY}
#: FRED codes from the Fed's weekly H.10 release (currencies and the dollar indexes):
#: daily values, posted once a week on Monday for the week before.
H10_PREFIXES = ("DEX", "DTWEX")
H10_CADENCE = 11 * DAY

#: How often we mean to fetch, in hours. Prices come with the nightly research run on
#: weekdays, so a weekend leaves them three days old by design.
PRICE_FETCH_CADENCE = 3 * DAY + 2
NEWS_FETCH_CADENCE = 1.0 + 0.5  # hourly job, plus GitHub's usual start delay
SITE_CADENCE = 1.5  # the deploy after each hourly news run

#: Site files the deploy job writes, with the field holding their data's as-of time.
SITE_FILES = {
    "terminal/index.json": "data_through",
    "news/latest.json": "prices_through",
    "markets/crypto.json": "fetched_at",
    "markets/perps.json": "fetched_at",
    "latest.json": "generated_at",
    "search.json": "generated_at",
    "sims.json": "generated_at",
}

RETRY_STATE = "latency-retry.json"
RETRY_EVERY_HOURS = 6.0  # one retry per source per this many hours, never a loop


def now() -> datetime:
    return datetime.now(UTC)


def iso(t) -> str | None:
    """An ISO time in UTC, or None. Accepts dates, strings, pandas and datetimes."""
    if t is None or (not isinstance(t, (str, datetime)) and pd.isna(t)):
        return None
    ts = pd.Timestamp(t)
    if pd.isna(ts):
        return None
    ts = ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")
    return ts.isoformat(timespec="seconds").replace("+00:00", "Z")


def _row(source: str, series: str, label: str, kind: str, basis: str, cadence: float,
         source_at=None, fetched_at=None, published_at=None, ok: bool = True) -> dict:
    return {"source": source, "series": series, "label": label[:120], "kind": kind,
            "basis": basis, "cadence_hours": round(float(cadence), 2),
            "source_at": iso(source_at), "fetched_at": iso(fetched_at),
            "published_at": iso(published_at), "ok": bool(ok)}


# ------------------------------------------------------------------ the rows

def price_rows(root: Path = store.DEFAULT_DIR) -> list[dict]:
    """One row per catalog series from coverage.json, plus one for the fetch itself."""
    cov = store.coverage(root)
    fetched = cov.get("fetched_at")
    rows = []
    for r in cov.get("series", []):
        key = r["key"]
        spec = catalog.CATALOG.get(key)
        freq = r.get("frequency") or (spec.frequency if spec else "D")
        cadence = PRICE_CADENCE.get((r["source"], freq), FREQ_CADENCE.get(freq, 4 * DAY))
        if r["source"] == "fred" and str(r.get("code", "")).startswith(H10_PREFIXES):
            cadence = H10_CADENCE
        if spec is not None and spec.published_after:
            cadence += spec.published_after * DAY * 7 / 5
        if spec is not None and spec.lag_days:
            cadence += spec.lag_days * DAY * 7 / 5
        label = spec.description if spec else key
        rows.append(_row(r["source"], key, label, "prices", "source", cadence,
                         source_at=r.get("last"), fetched_at=fetched, ok=bool(r.get("ok"))))
    if fetched:
        rows.append(_row("prices", "fetch", "Every price series, fetched together", "prices",
                         "fetch", PRICE_FETCH_CADENCE, fetched_at=fetched))
    return rows


def _max(df: pd.DataFrame, col: str):
    if df.empty or col not in df:
        return None
    vals = pd.to_datetime(df[col], utc=True, errors="coerce").dropna()
    return vals.max() if len(vals) else None


def _quarter_end(q: str | None):
    """'2026Q2' to the last day of that quarter."""
    if not q:
        return None
    try:
        return pd.Period(str(q).replace(" ", ""), freq="Q").end_time.normalize()
    except ValueError:
        return None


def markets_rows(root: Path = store.DEFAULT_DIR) -> list[dict]:
    from .markets import sources as msrc
    from .markets import store as mstore

    st = mstore.state(root)
    obs = {
        "coingecko-markets": lambda: _max(mstore.load("crypto_markets", root), "last_updated"),
        "coingecko-history": lambda: _max(mstore.load("crypto_daily", root), "date"),
        "coingecko-trending": lambda: _max(mstore.load("crypto_trending", root), "fetched_at"),
        "hyperliquid-perps": lambda: _max(mstore.load("perps_snapshots", root), "fetched_at"),
        "hyperliquid-funding": lambda: _max(mstore.load("perps_funding", root), "time"),
        "sec-funds": lambda: _max(mstore.load("etfs", root), "fetched_at"),
        "sec-filings": lambda: _max(mstore.load("fund_filings", root), "filed"),
        "sec-formd": lambda: _quarter_end(mstore.load("formd", root)["quarter"].max()
                                          if not mstore.load("formd", root).empty else None),
        "sec-bdc": lambda: _max(mstore.load("bdc_nav", root), "filed"),
    }
    rows = []
    for src in msrc.SOURCES:
        e = st.get(src.id, {})
        if not e:
            continue
        try:
            seen = obs.get(src.id, lambda: None)()
        except Exception:  # a damaged table should not hide the others
            seen = None
        failed_last = bool(e.get("error_at") and (not e.get("ok_at")
                                                  or e["error_at"] > e["ok_at"]))
        rows.append(_row(src.id.split("-")[0], src.id, src.name,
                         "markets", "fetch", src.max_age_hours + NEWS_FETCH_CADENCE,
                         source_at=seen, fetched_at=e.get("ok_at"), ok=not failed_last))
    return rows


def news_rows(root: Path = store.DEFAULT_DIR) -> list[dict]:
    from .news import sources as nsrc
    from .news import store as nstore

    st = news_state(root)
    df = nstore.load(root)
    newest = df.groupby("source")["published_at"].max().to_dict() if not df.empty else {}
    rows = []
    for src in nsrc.SOURCES:
        if src.kind == "backfill":
            continue
        e = st.get(src.id, {})
        if not e and src.id not in newest:
            continue  # a keyed source this machine never fetched
        failed_last = bool(e.get("error_at") and (not e.get("ok_at")
                                                  or e["error_at"] > e["ok_at"]))
        rows.append(_row("news", src.id, src.name, "news", "fetch", NEWS_FETCH_CADENCE,
                         source_at=newest.get(src.id), fetched_at=e.get("ok_at"),
                         ok=not failed_last))
    return rows


def site_rows(dist: Path, published_at: datetime | None = None) -> list[dict]:
    """The files the deploy job copies into the site: their data's as-of time, when they
    were written and, after a deploy, when the site published them."""
    rows = []
    data = dist / "data"
    for name, field in SITE_FILES.items():
        p = data / name
        if not p.exists():
            continue
        try:
            doc = json.loads(p.read_text())
        except (OSError, ValueError):
            continue
        written = doc.get("generated_at") if isinstance(doc, dict) else None
        seen = doc.get(field) if isinstance(doc, dict) else None
        if written is None:
            written = datetime.fromtimestamp(p.stat().st_mtime, UTC)
        rows.append(_row("site", name, f"Site file {name}", "site", "publish", SITE_CADENCE,
                         source_at=seen, fetched_at=written, published_at=published_at))
    return rows


def freshness(root: Path = store.DEFAULT_DIR, dist: Path | None = None,
              published_at: datetime | None = None) -> list[dict]:
    rows = price_rows(root) + markets_rows(root) + news_rows(root)
    if dist is not None:
        rows += site_rows(dist, published_at)
        if published_at is not None:
            for r in rows:
                if r["kind"] != "site":
                    r["published_at"] = iso(published_at)
    return rows


# ------------------------------------------------------------------ judging a row

def age_hours(row: dict, at: datetime | None = None) -> float | None:
    """Hours since the time the row's cadence applies to."""
    at = at or now()
    t = row.get({"source": "source_at", "fetch": "fetched_at",
                 "publish": "published_at"}[row.get("basis", "source")])
    if row.get("basis") == "publish" and not t:
        t = row.get("fetched_at")
    if not t:
        return None
    return (at - pd.Timestamp(t).to_pydatetime()).total_seconds() / 3600


def status(row: dict, at: datetime | None = None) -> str:
    """'ok', 'late' (past its cadence), 'stale' (past cadence x STALE_FACTOR) or
    'unknown' (never fetched). A failed last fetch counts as stale."""
    age = age_hours(row, at)
    if age is None:
        return "unknown"
    if not row.get("ok", True) or age > row["cadence_hours"] * STALE_FACTOR:
        return "stale"
    return "late" if age > row["cadence_hours"] else "ok"


def summary(rows: list[dict], at: datetime | None = None) -> dict:
    out: dict[str, dict] = {}
    for r in rows:
        s = out.setdefault(r["source"], {"rows": 0, "ok": 0, "late": 0, "stale": 0,
                                         "unknown": 0, "worst_age_hours": None})
        st = status(r, at)
        s["rows"] += 1
        s[st] += 1
        a = age_hours(r, at)
        if a is not None and (s["worst_age_hours"] is None or a > s["worst_age_hours"]):
            s["worst_age_hours"] = round(a, 1)
    return out


# ------------------------------------------------------------------ hops

def _hours(a, b) -> float | None:
    if not a or not b:
        return None
    return (pd.Timestamp(b) - pd.Timestamp(a)).total_seconds() / 3600


def hops(rows: list[dict], at: datetime | None = None) -> dict[str, dict]:
    """p50 and p95, in hours, of each hop over every row that has both ends:
    source to fetch, fetch to publish, and source to now (the age a reader sees)."""
    at = at or now()
    sets = {"source_to_fetch": [], "fetch_to_publish": [], "age_now": []}
    for r in rows:
        if r["kind"] == "site":
            continue
        v = _hours(r.get("source_at"), r.get("fetched_at"))
        if v is not None:
            sets["source_to_fetch"].append(max(v, 0.0))
        v = _hours(r.get("fetched_at"), r.get("published_at"))
        if v is not None:
            sets["fetch_to_publish"].append(max(v, 0.0))
        v = _hours(r.get("source_at"), iso(at))
        if v is not None:
            sets["age_now"].append(max(v, 0.0))
    out = {}
    for k, vals in sets.items():
        s = pd.Series(vals, dtype=float)
        out[k] = {"n": int(s.size),
                  "p50": round(float(s.quantile(0.5)), 2) if s.size else None,
                  "p95": round(float(s.quantile(0.95)), 2) if s.size else None}
    return out


# ------------------------------------------------------------------ news fetch state

def news_state_path(root: Path = store.DEFAULT_DIR) -> Path:
    return root / "news" / "state.json"


def news_state(root: Path = store.DEFAULT_DIR) -> dict:
    p = news_state_path(root)
    try:
        return json.loads(p.read_text()) if p.exists() else {}
    except ValueError:
        return {}


def record_news(source_id: str, ok: bool, items: int = 0, error: str | None = None,
                root: Path = store.DEFAULT_DIR) -> None:
    """Called by `parity news fetch` for every source, so a quiet feed still shows that
    we looked at it."""
    doc = news_state(root)
    stamp = now().isoformat(timespec="seconds")
    e = doc.get(source_id, {})
    if ok:
        e.update(ok_at=stamp, items=items, error=None)
    else:
        e.update(error_at=stamp, error=(error or "")[:200])
    doc[source_id] = e
    p = news_state_path(root)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(doc, indent=2))


# ------------------------------------------------------------------ one retry, logged

def _retry_state(root: Path) -> dict:
    p = root / RETRY_STATE
    try:
        return json.loads(p.read_text()) if p.exists() else {}
    except ValueError:
        return {}


def stale_targets(rows: list[dict], at: datetime | None = None) -> dict[str, list[str]]:
    """What a fetch could fix: rows judged on our own fetch time (or a failed last fetch)
    that are stale. A source that is simply behind on its own side is left alone, since
    asking again cannot make it publish sooner."""
    out: dict[str, list[str]] = {"prices": [], "markets": [], "news": []}
    for r in rows:
        if r["kind"] not in out or status(r, at) != "stale":
            continue
        if r["basis"] == "fetch" or not r.get("ok", True):
            out[r["kind"]].append(r["series"])
    return out


def retry_stale(root: Path = store.DEFAULT_DIR, pipeline: str = "retry",
                backoff: float = 30.0, include_news: bool = True,
                at: datetime | None = None, fetchers: dict | None = None) -> list[dict]:
    """Fetch each group of stale sources once more, after a pause of `backoff` seconds,
    at most once per RETRY_EVERY_HOURS. Returns pipeline step rows saying what was tried
    and whether it worked; the caller logs or publishes them."""
    at = at or now()
    rows = freshness(root)
    targets = stale_targets(rows, at)
    if not include_news:
        targets["news"] = []
    state = _retry_state(root)
    fetchers = fetchers or _fetchers(root)
    steps = []
    for group, keys in targets.items():
        if not keys:
            continue
        last = state.get(group)
        if last and at - datetime.fromisoformat(last) < timedelta(hours=RETRY_EVERY_HOURS):
            continue
        state[group] = at.isoformat(timespec="seconds")
        (root / RETRY_STATE).write_text(json.dumps(state, indent=2))
        time.sleep(backoff)
        t0 = now()
        try:
            fetchers[group](keys)
            ok, err = True, None
        except Exception as exc:  # one more failure is recorded, not raised
            ok, err = False, f"{type(exc).__name__}: {exc}"[:200]
        t1 = now()
        after = {r["series"]: status(r, t1) for r in freshness(root) if r["kind"] == group}
        fixed = [k for k in keys if after.get(k) in ("ok", "late")]
        steps.append({"pipeline": pipeline, "run_key": t0.isoformat(timespec="seconds"),
                      "step": f"retry {group}", "started_at": iso(t0), "finished_at": iso(t1),
                      "seconds": round((t1 - t0).total_seconds(), 1), "ok": ok and bool(fixed),
                      "detail": {"stale": keys[:10], "n_stale": len(keys), "fixed": fixed[:10],
                                 "n_fixed": len(fixed), "backoff_s": backoff,
                                 **({"error": err[:120]} if err else {})}})
    return steps


def _fetchers(root: Path) -> dict:
    def prices(keys: list[str]) -> None:
        wanted = [k for k in keys if k in catalog.CATALOG]
        store.refresh(wanted or None, root=root)

    def markets(keys: list[str]) -> None:
        from .markets import cli as mcli

        class A:  # the same path as `parity markets fetch --source X --force`
            source = keys
            force = True
            strict = False
        mcli._fetch(A)

    def news(keys: list[str]) -> None:
        from .news import cli as ncli

        class A:
            source = keys
            strict = False
        ncli._fetch(A)

    return {"prices": prices, "markets": markets, "news": news}


# ------------------------------------------------------------------ publishing

def publish_freshness(rows: list[dict]) -> int:
    import psycopg

    from .publish.supabase import _writer_url

    total = 0
    with psycopg.connect(_writer_url(), connect_timeout=20) as conn:
        for i in range(0, len(rows), 400):
            total += conn.execute("select public.report_freshness(%s::jsonb)",
                                  (json.dumps(rows[i:i + 400]),)).fetchone()[0]
    return total


def publish_steps(rows: list[dict]) -> int:
    if not rows:
        return 0
    import psycopg

    from .publish.supabase import _writer_url

    total = 0
    with psycopg.connect(_writer_url(), connect_timeout=20) as conn:
        for i in range(0, len(rows), 400):
            total += conn.execute("select public.report_pipeline_steps(%s::jsonb)",
                                  (json.dumps(rows[i:i + 400]),)).fetchone()[0]
    return total


def try_publish_steps(rows: list[dict]) -> bool:
    """Publish step rows if a writer URL is set. Returns False on failure, printing only
    the error's type, since database errors can quote the connection string."""
    if not rows or not os.environ.get("PARITY_WRITER_DB_URL"):
        return True
    try:
        publish_steps(rows)
        return True
    except Exception as exc:
        print(f"latency publish failed: {type(exc).__name__}", flush=True)
        return False


def step_row(pipeline: str, run_key: str, step: str, started: float, finished: float,
             ok: bool, **detail) -> dict:
    """A step row from two time.time() stamps."""
    t0 = datetime.fromtimestamp(started, UTC)
    t1 = datetime.fromtimestamp(finished, UTC)
    return {"pipeline": pipeline, "run_key": run_key, "step": step[:80], "started_at": iso(t0),
            "finished_at": iso(t1), "seconds": round(max(finished - started, 0.0), 2),
            "ok": bool(ok), "detail": {k: v for k, v in detail.items() if v is not None}}


# ------------------------------------------------------------------ GitHub Actions

#: Workflows whose timings we keep, by file, with a short pipeline name.
WORKFLOWS = {"news.yml": "gha:news", "deploy-web.yml": "gha:deploy",
             "research.yml": "gha:research", "official-run.yml": "gha:official",
             "db-migrate.yml": "gha:migrate", "ci.yml": "gha:ci"}
SKIP_STEPS = ("Set up job", "Complete job", "Post ")


def _cron_field(field: str, value: int, low: int) -> bool:
    for part in field.split(","):
        step = 1
        if "/" in part:
            part, step_s = part.split("/", 1)
            step = int(step_s)
        if part == "*":
            if (value - low) % step == 0:
                return True
            continue
        a, _, b = part.partition("-")
        lo, hi = int(a), int(b or a)
        if lo <= value <= hi and (value - lo) % step == 0:
            return True
    return False


def cron_matches(expr: str, t: datetime) -> bool:
    """Minute, hour, day of month, month and day of week, as GitHub reads them (UTC)."""
    mi, ho, dom, mon, dow = expr.split()
    return (_cron_field(mi, t.minute, 0) and _cron_field(ho, t.hour, 0)
            and _cron_field(dom, t.day, 1) and _cron_field(mon, t.month, 1)
            and _cron_field(dow, (t.weekday() + 1) % 7, 0))


def last_tick(crons: list[str], t: datetime, within_hours: float = 48) -> datetime | None:
    """The latest scheduled time at or before t."""
    m = t.replace(second=0, microsecond=0)
    for _ in range(int(within_hours * 60)):
        if any(cron_matches(c, m) for c in crons):
            return m
        m -= timedelta(minutes=1)
    return None


def workflow_crons(path: Path) -> list[str]:
    import re

    if not path.exists():
        return []
    return re.findall(r'cron:\s*"([^"]+)"', path.read_text())


def gh_token() -> str:
    """GITHUB_TOKEN, or the signed-in GitHub command line's token. Never printed."""
    import shutil
    import subprocess

    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        return token
    gh = shutil.which("gh") or "/opt/homebrew/bin/gh"
    if not Path(gh).exists():
        raise RuntimeError("no GitHub token")
    res = subprocess.run([gh, "auth", "token"], capture_output=True, text=True, timeout=20)
    if res.returncode != 0 or not res.stdout.strip():
        raise RuntimeError("no GitHub token")
    return res.stdout.strip()


def _gh(url: str, token: str) -> dict:
    import urllib.request

    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}",
                                               "Accept": "application/vnd.github+json",
                                               "User-Agent": "parity-latency"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def _t(s: str | None) -> datetime | None:
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def run_rows(run: dict, jobs: list[dict], pipeline: str, crons: list[str],
             previous: dict | None = None, upstream: dict | None = None) -> list[dict]:
    """Step rows for one finished workflow run: the whole run, each job and step, how late
    a scheduled run started (`_queue`), the gap since the run before (`_gap`), and for a
    deploy started by another workflow, the time from that workflow's start to the end of
    the deploy (`_chain`)."""
    key = f"{run['id']}.{run.get('run_attempt', 1)}"
    ok = run.get("conclusion") == "success"
    created, started, ended = _t(run["created_at"]), _t(run.get("run_started_at")), \
        _t(run["updated_at"])
    started = started or created
    detail = {"event": run.get("event"), "conclusion": run.get("conclusion")}
    out = [_span(pipeline, key, "_run", started, ended, ok, **detail)]
    if run.get("event") == "schedule" and crons:
        tick = last_tick(crons, created)
        if tick:
            out.append(_span(pipeline, key, "_queue", tick, created, True))
    if previous is not None:
        out.append(_span(pipeline, key, "_gap", _t(previous["created_at"]), created, True))
    if upstream is not None:
        out.append(_span(pipeline, key, "_chain", _t(upstream["created_at"]), ended, ok,
                         upstream=upstream.get("name"), upstream_id=upstream.get("id")))
    for job in jobs:
        j0, j1 = _t(job.get("started_at")), _t(job.get("completed_at"))
        if not j0 or not j1:
            continue
        out.append(_span(pipeline, key, f"job:{job['name']}"[:80], j0, j1,
                         job.get("conclusion") == "success"))
        if pipeline == "gha:ci":
            continue  # CI runs on every push; its jobs are enough
        for st in job.get("steps", []):
            s0, s1 = _t(st.get("started_at")), _t(st.get("completed_at"))
            if not s0 or not s1 or st["name"].startswith(SKIP_STEPS):
                continue
            secs = (s1 - s0).total_seconds()
            failed = st.get("conclusion") not in ("success", "skipped")
            if secs < 1 and not failed:
                continue
            name = st["name"] if len(jobs) == 1 else f"{job['name']}: {st['name']}"
            out.append(_span(pipeline, key, name[:80], s0, s1, not failed))
    return out


def _span(pipeline, key, step, t0: datetime, t1: datetime, ok: bool, **detail) -> dict:
    return {"pipeline": pipeline, "run_key": key, "step": step, "started_at": iso(t0),
            "finished_at": iso(t1), "seconds": round(max((t1 - t0).total_seconds(), 0.0), 1),
            "ok": bool(ok), "detail": {k: v for k, v in detail.items() if v is not None}}


def actions_rows(repo: str, token: str, since_hours: float = 6.0,
                 workflows_dir: Path | None = None) -> list[dict]:
    """Rows for every finished run of the workflows in WORKFLOWS from the last few hours."""
    base = f"https://api.github.com/repos/{repo}/actions"
    since = (now() - timedelta(hours=since_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    wdir = workflows_dir or Path(__file__).resolve().parents[3] / ".github" / "workflows"
    rows: list[dict] = []
    upstream_runs: list[dict] = []
    for file in ("news.yml", "research.yml", "official-run.yml"):
        doc = _gh(f"{base}/workflows/{file}/runs?per_page=50&created=>={since}", token)
        upstream_runs += doc.get("workflow_runs", [])
    for file, pipeline in WORKFLOWS.items():
        doc = _gh(f"{base}/workflows/{file}/runs?per_page=50&created=>={since}", token)
        runs = [r for r in doc.get("workflow_runs", []) if r.get("status") == "completed"]
        runs.sort(key=lambda r: r["created_at"])
        crons = workflow_crons(wdir / file)
        prev_sched = None
        for run in runs:
            jobs = _gh(f"{base}/runs/{run['id']}/jobs?per_page=50", token).get("jobs", [])
            previous = prev_sched if run.get("event") == "schedule" else None
            upstream = None
            if run.get("event") == "workflow_run":
                done = [u for u in upstream_runs if u.get("status") == "completed"
                        and u["updated_at"] <= run["created_at"]]
                upstream = max(done, key=lambda u: u["updated_at"]) if done else None
            rows += run_rows(run, jobs, pipeline, crons, previous, upstream)
            if run.get("event") == "schedule":
                prev_sched = run
    return rows


# ------------------------------------------------------------------ the box as watchdog

NEWS_WORKFLOW = "news.yml"
DISPATCH_STATE = "latency-dispatch.json"
DISPATCH_AFTER_HOURS = 3.0  # the hourly refresh is this late: start it once ourselves


def refresh_watchdog(repo: str = "abasheer-rion/parity", root: Path = store.DEFAULT_DIR,
                     at: datetime | None = None, runner=None) -> list[dict]:
    """GitHub skips scheduled runs when it is busy, so the hourly news and markets refresh
    can go hours without running. Run by the always-on sims service: if the last News run
    started more than DISPATCH_AFTER_HOURS ago, start one (once per that many hours) and
    log a step. Needs the GitHub command line, signed in; without it, does nothing."""
    import shutil
    import subprocess

    at = at or now()
    gh = shutil.which("gh") or ("/opt/homebrew/bin/gh" if Path("/opt/homebrew/bin/gh").exists()
                                else None)
    run = runner or (lambda *a: subprocess.run([gh, *a], capture_output=True, text=True,
                                               timeout=60))
    if gh is None and runner is None:
        return []
    p = root / DISPATCH_STATE
    try:
        state = json.loads(p.read_text()) if p.exists() else {}
    except ValueError:
        state = {}
    last_try = state.get("at")
    if last_try and at - datetime.fromisoformat(last_try) < timedelta(hours=DISPATCH_AFTER_HOURS):
        return []
    t0 = time.time()
    res = run("run", "list", "-R", repo, "--workflow", NEWS_WORKFLOW, "--limit", "1",
              "--json", "createdAt,status")
    if res.returncode != 0:
        return []
    try:
        latest = json.loads(res.stdout or "[]")
    except ValueError:
        return []
    if latest:
        age = (at - _t(latest[0]["createdAt"])).total_seconds() / 3600
        if age < DISPATCH_AFTER_HOURS or latest[0].get("status") in ("queued", "in_progress"):
            return []
    else:
        age = None
    state["at"] = at.isoformat(timespec="seconds")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state))
    out = run("workflow", "run", NEWS_WORKFLOW, "-R", repo)
    return [step_row("retry", at.isoformat(timespec="seconds"), "start news refresh", t0,
                     time.time(), out.returncode == 0,
                     last_run_age_h=None if age is None else round(age, 2),
                     error=(out.stderr or "")[:150] if out.returncode else None)]


# ------------------------------------------------------------------ command line

def add_parser(sub):
    p = sub.add_parser("latency", help="data age at every hop, and one retry for stale "
                       "sources (DEC-0045)")
    p.add_argument("action", choices=["freshness", "retry", "actions"])
    p.add_argument("--dist", default=None, help="freshness: the built site, for site files")
    p.add_argument("--stage", choices=["fetched", "published"], default="fetched",
                   help="freshness: 'published' stamps every row as published now")
    p.add_argument("--publish", action="store_true", help="send rows to Supabase")
    p.add_argument("--json", default=None, help="also write the rows to this file")
    p.add_argument("--pipeline", default="retry", help="retry: name for the step rows")
    p.add_argument("--backoff", type=float, default=30.0, help="retry: seconds to wait first")
    p.add_argument("--no-news", action="store_true", help="retry: leave news feeds alone")
    p.add_argument("--hours", type=float, default=6.0, help="actions: how far back to look")
    p.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY", "abasheer-rion/parity"))
    return p


def run(args) -> int:
    if args.action == "actions":
        try:
            token = gh_token()
        except RuntimeError:
            print("set GITHUB_TOKEN or sign in with the GitHub command line")
            return 1
        rows = actions_rows(args.repo, token, args.hours)
        runs = {(r["pipeline"], r["run_key"]) for r in rows}
        print(f"{len(rows)} step rows from {len(runs)} runs")
        for r in rows:
            if r["step"] in ("_queue", "_gap", "_chain"):
                print(f"  {r['pipeline']:<12} {r['step']:<7} {r['seconds'] / 60:7.1f} min")
        if args.json:
            Path(args.json).write_text(json.dumps(rows, indent=1))
        if args.publish:
            try:
                print(f"published {publish_steps(rows)} step rows")
            except Exception as exc:
                print(f"steps publish failed: {type(exc).__name__}")
        return 0
    if args.action == "retry":
        steps = retry_stale(pipeline=args.pipeline, backoff=args.backoff,
                            include_news=not args.no_news)
        for s in steps:
            d = s["detail"]
            print(f"{s['step']:<16} {'fixed' if s['ok'] else 'still stale'}  "
                  f"{len(d['fixed'])}/{len(d['stale'])} in {s['seconds']:.0f}s")
        if not steps:
            print("nothing stale that a fetch could fix")
        if args.publish and not try_publish_steps(steps):
            return 0  # a failed report must not fail the data job
        return 0
    published = now() if args.stage == "published" else None
    rows = freshness(dist=Path(args.dist) if args.dist else None, published_at=published)
    for src, s in sorted(summary(rows).items()):
        print(f"{src:<12} {s['rows']:>4} rows  ok {s['ok']:>3}  late {s['late']:>3}  "
              f"stale {s['stale']:>3}  worst {s['worst_age_hours']} h")
    for k, h in hops(rows).items():
        print(f"{k:<17} n {h['n']:>4}  p50 {h['p50']} h  p95 {h['p95']} h")
    if args.json:
        Path(args.json).write_text(json.dumps(rows, indent=1))
    if args.publish:
        try:
            n = publish_freshness(rows)
            print(f"published {n} freshness rows")
        except Exception as exc:  # the type only: errors can quote the connection string
            print(f"freshness publish failed: {type(exc).__name__}")
    return 0
