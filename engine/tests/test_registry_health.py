"""Health around the clock (DEC-0064): freshness against the latency page's cadence, live
feeds from the fan-out or a probe, status moves with an event each, retries with a growing
wait, backups named, discovered series retired after 14 days dead and curated ones never,
and uptime counted per series and per source."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from parity.data import store
from parity.registry import db, fetch, health, sync
from parity.registry.model import Record

NOW = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


@pytest.fixture
def reg(tmp_path, monkeypatch):
    con = db.connect(tmp_path / "r.db")
    sync.sync(con, {"series": []})
    root = tmp_path / "data"
    root.mkdir()
    monkeypatch.setattr(store, "DEFAULT_DIR", root)
    return con, root


def coverage(root, rows):
    (root / "coverage.json").write_text(json.dumps({"fetched_at": NOW.isoformat(),
                                                    "series": rows}))


def no_live():
    return {"sources": []}


def run(con, root, now=NOW):
    return health.run(con, now=now, status_get=no_live, probe_fn=lambda s: (True, 50.0),
                      root=root)


def test_judge_uses_the_cadence():
    assert health.judge(10, 24, True) == "ok"
    assert health.judge(30, 24, True) == "late"
    assert health.judge(60, 24, True) == "stale"
    assert health.judge(200, 24, True) == "dead"
    assert health.judge(30, 24, False) == "stale"   # past cadence and the fetch failed
    assert health.judge(None, 24, True) == "unknown"


def test_live_feeds_use_the_fan_out_or_a_probe():
    rec = {"code": "kraken"}
    now_ms = NOW.timestamp() * 1000
    up = {"kraken": {"src": "kraken", "viewers": 3, "upstream": "up", "upstreamMsgs": 600,
                     "started": now_ms - 600_000, "lastUpstreamMsgAgoMs": 800,
                     "feedLagMs": {"p50": 90, "p95": 300}}}
    out = health.check_feed(rec, up, now_ms)
    assert out["health"] == "ok" and out["health_detail"]["msgs_per_min"] == 60.0
    up["kraken"]["lastUpstreamMsgAgoMs"] = 600_000
    assert health.check_feed(rec, up, now_ms)["health"] == "stale"
    idle = {"kraken": {"src": "kraken", "viewers": 0, "upstream": "down"}}
    assert health.check_feed(rec, idle, now_ms, lambda s: (True, 40.0))["health"] == "idle"
    assert health.check_feed(rec, idle, now_ms, lambda s: (False, None))["health"] == "stale"
    assert health.check_feed({"code": "alpaca"}, {}, now_ms)["health"] == "idle"


def test_status_follows_health_with_an_event_each_way(reg):
    con, root = reg
    fresh = (NOW - timedelta(days=1)).date().isoformat()
    coverage(root, [{"key": "fx.EUR", "source": "fred", "code": "DEXUSEU", "ok": True,
                     "last": fresh, "frequency": "D"}])
    run(con, root)
    assert db.get(con, "fx.EUR")["status"] == "live"
    old = (NOW - timedelta(days=30)).date().isoformat()
    coverage(root, [{"key": "fx.EUR", "source": "fred", "code": "DEXUSEU", "ok": True,
                     "last": old, "frequency": "D"}])
    run(con, root, NOW + timedelta(hours=1))
    rec = db.get(con, "fx.EUR")
    assert rec["status"] == "degraded" and rec["health"] == "stale"
    # The ECB cross is its backup; it is named on the series.
    assert rec["health_detail"]["backup"]["id"] == "xfx.EUR"
    coverage(root, [{"key": "fx.EUR", "source": "fred", "code": "DEXUSEU", "ok": True,
                     "last": fresh, "frequency": "D"}])
    run(con, root, NOW + timedelta(hours=2))
    assert db.get(con, "fx.EUR")["status"] == "live"
    kinds = [(e["kind"], e["to_state"]) for e in db.events(con, "fx.EUR")]
    assert ("status", "degraded") in kinds and ("status", "live") in kinds


def test_curated_series_are_never_retired_but_discovered_ones_are(reg):
    con, root = reg
    ancient = (NOW - timedelta(days=400)).date().isoformat()
    coverage(root, [{"key": "fx.SEK", "source": "fred", "code": "DEXSDUS", "ok": True,
                     "last": ancient, "frequency": "D"}])
    db.put(con, Record(id="ecb.QQQ", source_id="ecb", name="Test", frequency="D",
                       status="live", display_rights="public", code="X", origin="discovered",
                       last_obs=ancient))
    for day in range(16):
        run(con, root, NOW + timedelta(days=day))
    assert db.get(con, "fx.SEK")["status"] == "degraded"
    assert db.get(con, "ecb.QQQ")["status"] == "retired"
    assert db.events(con, "ecb.QQQ", 1)[0]["kind"] == "retired"


def test_a_stale_discovered_series_is_fetched_again_with_a_growing_wait(reg, monkeypatch):
    con, root = reg
    coverage(root, [])
    calls = []

    def broken(rec):
        calls.append(1)
        raise RuntimeError("down")
    monkeypatch.setitem(fetch.FETCHERS, "ecb", broken)
    db.put(con, Record(id="ecb.QQQ", source_id="ecb", name="Test", frequency="D",
                       status="live", display_rights="public", code="X", origin="discovered",
                       last_obs=(NOW - timedelta(days=40)).date().isoformat()))
    run(con, root)
    run(con, root, NOW + timedelta(hours=1))   # inside the 6 hour wait: no new try
    run(con, root, NOW + timedelta(hours=7))   # past it
    run(con, root, NOW + timedelta(hours=10))  # the wait doubled after two failures
    assert len(calls) == 2
    assert [e["kind"] for e in db.events(con, "ecb.QQQ")].count("retry") == 2


def test_uptime_is_counted_per_series_and_source(reg):
    con, root = reg
    fresh = (NOW - timedelta(days=1)).date().isoformat()
    coverage(root, [{"key": "fx.EUR", "source": "fred", "code": "DEXUSEU", "ok": True,
                     "last": fresh, "frequency": "D"}])
    run(con, root)
    run(con, root, NOW + timedelta(minutes=20))
    day = NOW.date().isoformat()
    checks, ok = con.execute("SELECT checks, ok FROM uptime WHERE scope = 'series' AND "
                             "id = 'fx.EUR' AND day = ?", (day,)).fetchone()
    assert (checks, ok) == (2, 2)
    assert con.execute("SELECT checks FROM uptime WHERE scope = 'source' AND id = 'fred' AND "
                       "day = ?", (day,)).fetchone()[0] == 2


def test_a_quiet_cycle_does_not_resend_every_row(reg):
    con, root = reg
    coverage(root, [])
    run(con, root)
    con.execute("UPDATE series SET dirty = 0")
    con.commit()
    run(con, root, NOW + timedelta(minutes=20))
    assert con.execute("SELECT count(*) FROM series WHERE dirty = 1").fetchone()[0] == 0


def test_a_jump_in_level_is_schema_drift(reg):
    con, root = reg
    idx = pd.bdate_range(end=NOW.date(), periods=400)
    vals = np.r_[np.full(380, 1.1), np.full(20, 110.0)]
    rec = Record(id="ecb.QQQ", source_id="ecb", name="Test", frequency="D", status="live",
                 display_rights="public", code="EXR/D.QQQ.EUR.SP00.A", origin="discovered",
                 asset_class="fx", last_obs=idx[-1].date().isoformat())
    db.put(con, rec)
    path = store._path(fetch.as_series(rec.row()), root)
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.Series(vals, index=idx).to_frame("v").to_parquet(path)
    coverage(root, [])
    run(con, root)
    r = db.get(con, "ecb.QQQ")
    assert r["health_detail"]["error_kind"] == "schema" and r["health_detail"]["level_jump"] >= 50
    assert "schema" in [e["kind"] for e in db.events(con, "ecb.QQQ")]


def test_source_state_follows_most_of_its_series():
    assert health.source_state(["ok"] * 10) == "ok"
    assert health.source_state(["ok"] * 9 + ["late"]) == "late"
    assert health.source_state(["ok"] * 8 + ["stale"] * 2) == "stale"
    assert health.source_state(["dead"] * 5 + ["ok"] * 5) == "dead"
    assert health.source_state(["unknown"]) == "unknown"
