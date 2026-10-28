"""The always-on sims service (DEC-0037).

The strategy search already runs around the clock. Everything else that simulates used
to run only when someone typed a command. This module runs them on a loop instead:

    parity sims run --forever        # what the background service runs
    parity sims run                  # one cycle now
    parity sims status               # both services: alive, and how far along
    parity sims export               # engine/output/sims.json

One cycle:
  1. Bot Battle on fresh made-up paths with crashes (`parity bots run --synthetic`),
     with seeds that never repeat, added to running totals for every bot. Totals and
     histograms are kept, not the paths, so thousands of paths cost a few kilobytes.
  2. Sim World paths (`parity world paths`): fresh bootstrap paths of real weekly
     returns, added to running histograms of where each asset ended up.
  3. The site files the deploy job also builds: `world export`, `world stress` (Monte
     Carlo stress tests, DEC-0066), `scenario export`,
     `terminal export` and `bots export`, into engine/output, so a broken export shows
     up here within the hour instead of at the next deploy.
  4. The competitor feedback collector (`parity profiles collect`), at most once a day:
     public feedback from sources whose terms allow it, counted by theme (CMP docs).
  5. The data registry (DEC-0064): sync with the catalog, discovery at most once a day,
     the enrolment gate for a few candidates, and a send of every change to the site.

There is no command for forward paper-tests of strategies yet (paper trading lives in
the signed-in site), so a cycle has none. After each cycle the summary goes to the site
when PARITY_WRITER_DB_URL is set, and the service reports that it is alive. Then it
sleeps, so it never competes with the search for long.
"""

from __future__ import annotations

import json
import math
import os
import sqlite3
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parents[2] / "output"
DB = OUT / "sims.db"

FIRST_SEED = 1_000_000          # above every seed the export and the tests use
YEARS = 10                      # each made-up path, as on the Bot Battle page
WORLD_ASSETS = ["EUR", "JPY", "oil", "stocks"]
WORLD_WEEKS = 26
# Fixed bins, so totals from any number of cycles add up exactly.
FINAL_EDGES = np.linspace(-2.0, 1.5, 71)    # log10 of the end account over the start
DRAWDOWN_EDGES = np.linspace(-1.0, 0.0, 51)
WIN_RATE_EDGES = np.linspace(0.0, 1.0, 51)
WORLD_EDGES = np.linspace(-1.0, 1.0, 201)   # log return over the horizon
KEEP_CYCLES = 500

SCHEMA = """
CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bot_totals (
  bot TEXT PRIMARY KEY, paths INTEGER NOT NULL, blown INTEGER NOT NULL,
  ahead INTEGER NOT NULL, crash_paths INTEGER NOT NULL, blown_in_crash INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS world_totals (
  asset TEXT PRIMARY KEY, paths INTEGER NOT NULL, losses INTEGER NOT NULL,
  big_losses INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS hist (
  family TEXT NOT NULL, key TEXT NOT NULL, bin INTEGER NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY (family, key, bin));
CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT NOT NULL,
  steps TEXT NOT NULL)
"""


def connect(path: Path = DB) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    return con


def _state(con: sqlite3.Connection, key: str, default: int) -> int:
    row = con.execute("SELECT value FROM state WHERE key = ?", (key,)).fetchone()
    return int(row[0]) if row else default


def _set_state(con: sqlite3.Connection, key: str, value: int) -> None:
    con.execute("INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE "
                "SET value = excluded.value", (key, int(value)))


def _bins(values, edges: np.ndarray) -> np.ndarray:
    """Counts per bin; values past either end land in the end bins."""
    idx = np.clip(np.searchsorted(edges, np.asarray(values, float), side="right") - 1,
                  0, len(edges) - 2)
    return np.bincount(idx, minlength=len(edges) - 1)


def _add_hist(con: sqlite3.Connection, family: str, key: str, counts: np.ndarray) -> None:
    rows = [(family, key, int(i), int(c)) for i, c in enumerate(counts) if c]
    con.executemany("INSERT INTO hist (family, key, bin, count) VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(family, key, bin) DO UPDATE SET count = count + excluded.count",
                    rows)


def _hist(con: sqlite3.Connection, family: str, key: str, n_bins: int) -> np.ndarray:
    out = np.zeros(n_bins, int)
    for b, c in con.execute("SELECT bin, count FROM hist WHERE family = ? AND key = ?",
                            (family, key)):
        out[b] = c
    return out


def quantiles(counts: np.ndarray, edges: np.ndarray, qs=(0.05, 0.25, 0.5, 0.75, 0.95)
              ) -> list[float] | None:
    """Quantiles read off a histogram, straight-line inside each bin."""
    total = counts.sum()
    if total == 0:
        return None
    cum = np.concatenate([[0], np.cumsum(counts)]) / total
    return [float(np.interp(q, cum, edges)) for q in qs]


# ------------------------------------------------------------------ the steps

def bot_paths(con: sqlite3.Connection, n: int, years: int = YEARS) -> dict:
    """Run every Bot Battle bot on `n` fresh made-up paths and add them to the totals."""
    from . import bots

    seed = _state(con, "next_bot_seed", FIRST_SEED)
    tot = {cls.id: [0, 0, 0, 0, 0] for cls in bots.BOTS}
    final = {cls.id: [] for cls in bots.BOTS}
    dd = {cls.id: [] for cls in bots.BOTS}
    wr = {cls.id: [] for cls in bots.BOTS}
    crash_paths = 0
    for k in range(n):
        path = bots.synthetic_path(seed + k, years)
        crashed = bool(path["crashes"])
        crash_paths += crashed
        for r, s in bots.battle(path["prices"]):
            t = tot[r.bot]
            t[0] += 1
            t[1] += bool(s["blown"])
            t[2] += s["pnl"] > 0
            t[3] += crashed
            t[4] += bool(s["blown"]) and crashed
            final[r.bot].append(math.log10(max(s["final"], 1e-9) / bots.START_CASH))
            dd[r.bot].append(s["max_drawdown"])
            if s["win_rate"] is not None:
                wr[r.bot].append(s["win_rate"])
    with con:
        for bot, (paths, blown, ahead, crashes, blown_crash) in tot.items():
            con.execute(
                "INSERT INTO bot_totals VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(bot) DO UPDATE SET "
                "paths = paths + excluded.paths, blown = blown + excluded.blown, "
                "ahead = ahead + excluded.ahead, crash_paths = crash_paths + excluded.crash_paths,"
                " blown_in_crash = blown_in_crash + excluded.blown_in_crash",
                (bot, paths, blown, ahead, crashes, blown_crash))
            _add_hist(con, "final", bot, _bins(final[bot], FINAL_EDGES))
            _add_hist(con, "drawdown", bot, _bins(dd[bot], DRAWDOWN_EDGES))
            _add_hist(con, "win_rate", bot, _bins(wr[bot], WIN_RATE_EDGES))
        _set_state(con, "next_bot_seed", seed + n)
    return {"paths": n, "with_crash": crash_paths, "seeds": [seed, seed + n - 1]}


def world_paths(con: sqlite3.Connection, n: int, weeks: int = WORLD_WEEKS) -> dict:
    """Fresh Sim World bootstrap paths (`parity world paths`), added to the histograms."""
    import pandas as pd

    from . import world

    levels = world.load_levels()
    assets = [a for a in WORLD_ASSETS if a in levels]
    if not assets:
        raise RuntimeError("no Sim World prices on this machine")
    weekly = pd.concat({a: levels[a].resample("W-FRI").last() for a in assets}, axis=1)
    seed = _state(con, "next_world_seed", FIRST_SEED)
    sim = world.bootstrap_paths(world.weekly_returns(weekly), weeks, n, 4, seed)
    finals = {a: sim["levels"][:, -1, i] for i, a in enumerate(assets)}
    finals["basket"] = sim["basket"][:, -1]
    with con:
        for a, f in finals.items():
            ret = f / 100.0 - 1.0
            con.execute(
                "INSERT INTO world_totals VALUES (?, ?, ?, ?) ON CONFLICT(asset) DO UPDATE SET "
                "paths = paths + excluded.paths, losses = losses + excluded.losses, "
                "big_losses = big_losses + excluded.big_losses",
                (a, len(f), int((ret < 0).sum()), int((ret < -0.10).sum())))
            _add_hist(con, "world", a, _bins(np.log(f / 100.0), WORLD_EDGES))
        _set_state(con, "next_world_seed", seed + 1)
    return {"paths": n, "assets": len(finals), "seed": seed}


def _cli(*argv: str) -> dict:
    """Run one of the site exports exactly as the command line does."""
    from .cli import main

    code = main(list(argv))
    if code:
        raise RuntimeError(f"parity {' '.join(argv)} exited {code}")
    return {}


EXPORTS = [("world export", ("world", "export")), ("world stress", ("world", "stress")),
           ("scenario export", ("scenario", "export")),
           ("terminal export", ("terminal", "export")), ("bots export", ("bots", "export"))]


def _profiles() -> dict:
    """The competitor feedback collector, at most once a day (it has its own clock)."""
    from .profiles import collect

    return collect.collect_if_due()


def _registry() -> dict:
    """The data registry's cycle (DEC-0064). Returns one short line for the log."""
    from .registry import cycle as rcycle

    out = rcycle.run()
    failed = [k for k, v in out["parts"].items() if not v["ok"]]
    if failed:
        raise RuntimeError(f"registry parts failed: {', '.join(failed)}; {rcycle.line(out)}")
    return {"registry": rcycle.line(out)}


def cycle(con: sqlite3.Connection, paths: int = 1000, world_n: int = 2000,
          exports: bool = True, profiles: bool = False, registry: bool = False) -> dict:
    """One pass over every sim. A step that fails is recorded and the rest still run.
    With `profiles`, the cycle ends with the feedback collector, which itself runs a
    pass only when the last one is a day old (the service turns this on)."""
    started = datetime.now(UTC).isoformat(timespec="seconds")
    steps = [("bot paths", lambda: bot_paths(con, paths)),
             ("world paths", lambda: world_paths(con, world_n))]
    if exports:
        steps += [(name, lambda a=argv: _cli(*a)) for name, argv in EXPORTS]
    if profiles:
        steps.append(("profiles", _profiles))
    if registry:
        steps.append(("data registry", _registry))
    done, timings = [], []
    for name, fn in steps:
        t = time.time()
        try:
            note = fn()
            done.append({"step": name, "ok": True, "seconds": round(time.time() - t, 1),
                         **(note or {})})
        except Exception as exc:  # one broken step never stops the cycle
            done.append({"step": name, "ok": False, "seconds": round(time.time() - t, 1),
                         "error": f"{type(exc).__name__}: {str(exc)[:160]}"})
        timings.append((name, t, time.time(), done[-1]["ok"]))
    finished = datetime.now(UTC).isoformat(timespec="seconds")
    with con:
        con.execute("INSERT INTO cycles (started_at, finished_at, steps) VALUES (?, ?, ?)",
                    (started, finished, json.dumps(done)))
        con.execute("DELETE FROM cycles WHERE id <= (SELECT MAX(id) FROM cycles) - ?",
                    (KEEP_CYCLES,))
        _set_state(con, "cycles", _state(con, "cycles", 0) + 1)
    return {"started_at": started, "finished_at": finished, "steps": done, "timings": timings}


def latency_steps(out: dict) -> list[dict]:
    """The cycle's steps as rows for the latency page (DEC-0045), plus the whole cycle."""
    from . import latency

    rows = [latency.step_row("service:sims", out["started_at"], name, t0, t1, ok)
            for name, t0, t1, ok in out.get("timings", [])]
    if out.get("timings"):
        first, last = out["timings"][0][1], out["timings"][-1][2]
        rows.append(latency.step_row("service:sims", out["started_at"], "_run", first, last,
                                     all(t[3] for t in out["timings"])))
    return rows


def watch(cycle_out: dict) -> list[dict]:
    """What the sims service does for the latency page after each cycle (DEC-0045): its own
    step timings, one retry of stale data on this machine, GitHub job timings, and a start
    of the news refresh when GitHub has skipped it for hours. Never raises."""
    from . import latency

    rows = latency_steps(cycle_out)
    for name, fn in (("retry", lambda: latency.retry_stale(include_news=False, backoff=30.0)),
                     ("watchdog", latency.refresh_watchdog),
                     ("actions", lambda: latency.actions_rows(
                         "abasheer-rion/parity", latency.gh_token(), since_hours=2.0))):
        t = time.time()
        try:
            got = fn()
            rows += got
            if name == "actions":
                rows.append(latency.step_row("service:sims", cycle_out["started_at"],
                                             "github timings", t, time.time(), True,
                                             rows=len(got)))
        except Exception as exc:  # the type only: a message could quote a token
            rows.append(latency.step_row("service:sims", cycle_out["started_at"],
                                         f"latency {name}", t, time.time(), False,
                                         error=type(exc).__name__))
    return rows


# ------------------------------------------------------------------ reading it back

def _r(v, d: int = 4):
    return None if v is None or not math.isfinite(v) else round(float(v), d)


def summary(con: sqlite3.Connection) -> dict:
    """Everything the site shows: per bot, out of how many paths and how many with a
    crash it was stopped out, and where its account ended; per Sim World asset, where
    it ended after the horizon. Counts and percentiles only."""
    from . import bots

    by_bot = {}
    for bot, paths, blown, ahead, crash_paths, blown_crash in con.execute(
            "SELECT bot, paths, blown, ahead, crash_paths, blown_in_crash FROM bot_totals"):
        cls = bots.BOT_BY_ID.get(bot)
        fq = quantiles(_hist(con, "final", bot, len(FINAL_EDGES) - 1), FINAL_EDGES)
        dq = quantiles(_hist(con, "drawdown", bot, len(DRAWDOWN_EDGES) - 1), DRAWDOWN_EDGES,
                       (0.5,))
        wq = quantiles(_hist(con, "win_rate", bot, len(WIN_RATE_EDGES) - 1), WIN_RATE_EDGES,
                       (0.5,))
        by_bot[bot] = {
            "name": cls.name if cls else bot, "paths": paths, "blown": blown, "ahead": ahead,
            "crash_paths": crash_paths, "blown_in_crash": blown_crash,
            "blown_share": _r(blown / paths if paths else None),
            "blown_in_crash_share": _r(blown_crash / crash_paths if crash_paths else None),
            # End account in dollars at the 5th, 25th, 50th, 75th and 95th percentile.
            "final": None if fq is None else [_r(bots.START_CASH * 10 ** q, 0) for q in fq],
            "median_max_drawdown": None if dq is None else _r(dq[0]),
            "median_win_rate": None if wq is None else _r(wq[0]),
        }
    world_ = {}
    for asset, paths, losses, big in con.execute(
            "SELECT asset, paths, losses, big_losses FROM world_totals"):
        q = quantiles(_hist(con, "world", asset, len(WORLD_EDGES) - 1), WORLD_EDGES)
        world_[asset] = {"paths": paths, "p_loss": _r(losses / paths),
                         "p_loss_gt_10": _r(big / paths),
                         # Return over the horizon at the 5th..95th percentile.
                         "returns": None if q is None else [_r(math.exp(v) - 1) for v in q]}
    last = con.execute("SELECT finished_at, steps FROM cycles ORDER BY id DESC LIMIT 1"
                       ).fetchone()
    total_cycles = _state(con, "cycles", 0)
    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "cycles": total_cycles,
        "last_cycle_at": last[0] if last else None,
        "last_steps": json.loads(last[1]) if last else [],
        "bots": {"years": YEARS, "start_cash": bots.START_CASH,
                 "paths": max((b["paths"] for b in by_bot.values()), default=0),
                 "crash_paths": max((b["crash_paths"] for b in by_bot.values()), default=0),
                 "by_bot": by_bot},
        "world": {"weeks": WORLD_WEEKS, "assets": world_},
        "disclaimer": "Simulated, not a forecast. Hypothetical and educational.",
    }


def export(con: sqlite3.Connection | None = None, path: Path | None = None) -> dict:
    con = con or connect()
    doc = summary(con)
    path = path or OUT / "sims.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, separators=(",", ":")))
    return doc


def _ago(iso: str | None) -> str:
    if not iso:
        return "never"
    mins = (datetime.now(UTC) - datetime.fromisoformat(iso)).total_seconds() / 60
    return f"{mins:.0f} min ago" if mins < 120 else f"{mins / 60:.1f} hours ago"


def health(search_db: Path | None = None, sims_db: Path = DB) -> list[str]:
    """The same health line the site shows, read from the files on this machine."""
    from . import search

    lines = []
    sdb = search_db or search.DB
    if sdb.exists():
        con = sqlite3.connect(sdb, timeout=30)
        total = con.execute("SELECT COUNT(*) FROM trials").fetchone()[0]
        try:
            last = con.execute("SELECT MAX(at) FROM batches").fetchone()[0]
        except sqlite3.OperationalError:  # a search.db from before batches were kept
            last = con.execute("SELECT MAX(tried_at) FROM trials").fetchone()[0]
        lines.append(f"search: {total:,} tries, last batch {_ago(last)}")
    else:
        lines.append("search: no results on this machine")
    if sims_db.exists():
        con = connect(sims_db)
        doc = summary(con)
        lines.append(f"sims: {doc['cycles']:,} cycles, {doc['bots']['paths']:,} bot paths, "
                     f"last cycle {_ago(doc['last_cycle_at'])}")
    else:
        lines.append("sims: not run on this machine yet")
    from .profiles import collect

    lines.append(collect.health())
    return lines


def _registry_counts() -> dict:
    """Public counts from the data registry for the health line (DEC-0064)."""
    from .registry import cycle as rcycle
    from .registry import db as rdb

    if not rdb.DB.exists():
        return {}
    try:
        s = rcycle.summary(rdb.connect())
    except Exception:  # the heartbeat goes out without it
        return {}
    return {"data": {k: s.get(k, 0) for k in ("series", "live", "enrolled", "candidate",
                                               "degraded", "retired", "health_bad")}}


def _profile_counts() -> dict:
    """Two public counts from the feedback collector for the health line."""
    from .profiles import store

    if not store.DB.exists():
        return {}
    con = store.connect()
    last = store.last_pass(con)
    return {"profile_items": con.execute("SELECT COUNT(*) FROM items").fetchone()[0],
            "profiles_last_pass_at": last[0] if last else None}


def _publish(doc: dict, failed_before: bool) -> bool:
    try:
        from .publish.supabase import NotConfigured, heartbeat, publish_sims
        publish_sims(doc)
        heartbeat("sims", {"cycles": doc["cycles"], "last_cycle_at": doc["last_cycle_at"],
                           "bot_paths": doc["bots"]["paths"], **_profile_counts(),
                           **_registry_counts()})
        return False
    except NotConfigured:
        return False
    except Exception as exc:  # only the type: errors can quote the connection string
        if not failed_before:
            print(f"publish failed: {type(exc).__name__}", flush=True)
        return True


def run_forever(paths: int = 1000, world_n: int = 2000, sleep_minutes: float = 20.0,
                max_hours: float | None = None) -> None:
    """The background service: a cycle, a report to the site, a sleep, again. With
    `max_hours` it exits after that long so the service manager restarts it on new code."""
    con = connect()
    started = time.time()
    failed = False

    def time_left() -> bool:
        return max_hours is None or time.time() - started < max_hours * 3600

    while time_left():
        out = cycle(con, paths, world_n, profiles=True, registry=True)
        doc = export(con)
        failed = _publish(doc, failed)
        if os.environ.get("PARITY_WRITER_DB_URL"):
            from . import latency
            latency.try_publish_steps(watch(out))
        ok = sum(s["ok"] for s in out["steps"])
        bad = [s["step"] for s in out["steps"] if not s["ok"]]
        secs = sum(s["seconds"] for s in out["steps"])
        print(f"{out['finished_at']} cycle {doc['cycles']}: {ok}/{len(out['steps'])} steps ok "
              f"in {secs:.0f}s, {doc['bots']['paths']:,} bot paths in all"
              + (f"; failed: {', '.join(bad)}" if bad else ""), flush=True)
        reg = next((s for s in out["steps"] if s["step"] == "data registry"), None)
        if reg:
            print(f"  {reg.get('registry') or reg.get('error')}", flush=True)
        wake = time.time() + sleep_minutes * 60
        while time.time() < wake and time_left():
            time.sleep(min(30.0, max(wake - time.time(), 0.0)))
