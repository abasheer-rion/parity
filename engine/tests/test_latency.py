"""Latency tracking (DEC-0045): data age per row, late and stale against each cadence, the
hop percentiles, one logged retry per stale source, GitHub run timings and the watchdog
that starts a skipped news refresh."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pandas as pd

from parity import latency, sims

NOW = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)


def _coverage(root, series, fetched="2026-10-25T00:00:00+00:00"):
    root.mkdir(parents=True, exist_ok=True)
    (root / "coverage.json").write_text(json.dumps({"fetched_at": fetched, "series": series}))


def test_iso_handles_dates_strings_and_missing():
    assert latency.iso("2026-10-23") == "2026-10-23T00:00:00Z"
    assert latency.iso(pd.Timestamp("2026-10-23 05:00", tz="US/Eastern")) == \
        "2026-10-23T09:00:00Z"
    assert latency.iso(None) is None
    assert latency.iso(pd.NaT) is None


def test_price_rows_use_the_cadence_of_each_source(tmp_path):
    _coverage(tmp_path, [
        {"key": "fx.EUR", "source": "fred", "code": "DEXUSEU", "frequency": "D",
         "last": "2026-10-16", "ok": True},
        {"key": "risk.VIX", "source": "fred", "code": "VIXCLS", "frequency": "D",
         "last": "2026-10-16", "ok": True},
        {"key": "rate.EUR", "source": "fred", "code": "IR3TIB01EZM156N", "frequency": "M",
         "last": "2026-01-01", "ok": True},
    ])
    rows = {r["series"]: r for r in latency.price_rows(tmp_path)}
    # H.10 currencies post a week late, so nine days is fine; the VIX is not.
    assert latency.status(rows["fx.EUR"], NOW) == "ok"
    assert latency.status(rows["risk.VIX"], NOW) == "late"
    assert latency.status(rows["rate.EUR"], NOW) == "stale"
    fetch = [r for r in latency.price_rows(tmp_path) if r["series"] == "fetch"][0]
    assert fetch["basis"] == "fetch" and latency.status(fetch, NOW) == "ok"


def test_a_failed_fetch_counts_as_stale_and_unknown_when_never_fetched():
    row = latency._row("fred", "x", "x", "prices", "source", 24, source_at=NOW, ok=False)
    assert latency.status(row, NOW) == "stale"
    never = latency._row("news", "fed", "Fed", "news", "fetch", 1.5)
    assert latency.status(never, NOW) == "unknown"


def test_news_is_judged_on_our_last_look_not_the_newest_headline():
    quiet_feed = latency._row("news", "fed", "Fed", "news", "fetch", 1.5,
                              source_at=NOW - timedelta(days=9),
                              fetched_at=NOW - timedelta(minutes=40))
    assert latency.status(quiet_feed, NOW) == "ok"
    missed = {**quiet_feed, "fetched_at": latency.iso(NOW - timedelta(hours=4))}
    assert latency.status(missed, NOW) == "stale"


def test_hops_measure_each_leg():
    rows = [latency._row("fred", f"s{i}", "", "prices", "source", 96,
                         source_at=NOW - timedelta(hours=30 + i),
                         fetched_at=NOW - timedelta(hours=6),
                         published_at=NOW - timedelta(hours=5)) for i in range(5)]
    h = latency.hops(rows, NOW)
    assert h["source_to_fetch"]["n"] == 5
    assert h["source_to_fetch"]["p50"] == 26.0
    assert h["fetch_to_publish"]["p50"] == 1.0
    assert h["age_now"]["p95"] > h["age_now"]["p50"]


def test_site_rows_read_each_files_as_of_time(tmp_path):
    (tmp_path / "data" / "terminal").mkdir(parents=True)
    (tmp_path / "data" / "terminal" / "index.json").write_text(json.dumps(
        {"generated_at": "2026-10-25T10:00:00+00:00", "data_through": "2026-10-23"}))
    rows = latency.site_rows(tmp_path, published_at=NOW)
    assert rows == [latency._row("site", "terminal/index.json", "Site file terminal/index.json",
                                 "site", "publish", latency.SITE_CADENCE,
                                 source_at="2026-10-23", fetched_at="2026-10-25T10:00:00Z",
                                 published_at=NOW)]


def test_news_fetch_state_records_quiet_and_failing_feeds(tmp_path):
    latency.record_news("fed", True, 0, root=tmp_path)
    latency.record_news("gdelt", False, error="HTTP 429", root=tmp_path)
    st = latency.news_state(tmp_path)
    assert st["fed"]["items"] == 0 and st["fed"]["ok_at"]
    assert st["gdelt"]["error"] == "HTTP 429"
    rows = {r["series"]: r for r in latency.news_rows(tmp_path)}
    assert rows["fed"]["ok"] and not rows["gdelt"]["ok"]


def test_retry_targets_only_what_a_fetch_can_fix():
    behind_at_source = latency._row("fred", "rate.EUR", "", "prices", "source", 24,
                                    source_at=NOW - timedelta(days=300), fetched_at=NOW)
    our_fetch_old = latency._row("prices", "fetch", "", "prices", "fetch", 74,
                                 fetched_at=NOW - timedelta(days=9))
    failed = latency._row("fred", "fx.EUR", "", "prices", "source", 96,
                          source_at=NOW, fetched_at=NOW, ok=False)
    t = latency.stale_targets([behind_at_source, our_fetch_old, failed], NOW)
    assert t["prices"] == ["fetch", "fx.EUR"]


def test_retry_runs_once_with_a_pause_and_logs_it(tmp_path, monkeypatch):
    _coverage(tmp_path, [{"key": "fx.EUR", "source": "fred", "code": "DEXUSEU",
                          "frequency": "D", "last": "2026-10-23", "ok": False}],
              fetched="2026-10-25T11:00:00+00:00")
    slept, calls = [], []
    monkeypatch.setattr(latency.time, "sleep", lambda s: slept.append(s))

    def fix(keys):
        calls.append(keys)
        _coverage(tmp_path, [{"key": "fx.EUR", "source": "fred", "code": "DEXUSEU",
                              "frequency": "D", "last": "2026-10-24", "ok": True}],
                  fetched=NOW.isoformat())

    steps = latency.retry_stale(tmp_path, backoff=7, at=NOW,
                                fetchers={"prices": fix, "markets": None, "news": None})
    assert calls == [["fx.EUR"]] and slept == [7]
    assert steps[0]["step"] == "retry prices" and steps[0]["ok"]
    assert steps[0]["detail"]["fixed"] == ["fx.EUR"]
    # Within six hours it does not try again, however stale.
    _coverage(tmp_path, [{"key": "fx.EUR", "source": "fred", "code": "DEXUSEU",
                          "frequency": "D", "last": "2026-10-23", "ok": False}])
    again = latency.retry_stale(tmp_path, backoff=7, at=NOW + timedelta(hours=1),
                                fetchers={"prices": fix})
    assert again == [] and len(calls) == 1


def test_cron_ticks_match_github():
    assert latency.cron_matches("17 * * * *", datetime(2026, 10, 25, 3, 17, tzinfo=UTC))
    assert not latency.cron_matches("30 23 * * 1-5", datetime(2026, 10, 25, 23, 30, tzinfo=UTC))
    assert latency.cron_matches("30 23 * * 1-5", datetime(2026, 10, 26, 23, 30, tzinfo=UTC))
    tick = latency.last_tick(["17 * * * *"], datetime(2026, 10, 25, 1, 16, 21, tzinfo=UTC))
    assert tick == datetime(2026, 10, 25, 0, 17, tzinfo=UTC)


def test_run_rows_cover_queue_gap_chain_and_steps():
    run = {"id": 9, "run_attempt": 1, "event": "schedule", "conclusion": "success",
           "created_at": "2026-10-25T01:16:21Z", "run_started_at": "2026-10-25T01:16:21Z",
           "updated_at": "2026-10-25T01:18:19Z", "head_branch": "main"}
    jobs = [{"name": "fetch", "conclusion": "success", "started_at": "2026-10-25T01:16:30Z",
             "completed_at": "2026-10-25T01:18:10Z", "steps": [
                 {"name": "Set up job", "conclusion": "success",
                  "started_at": "2026-10-25T01:16:30Z", "completed_at": "2026-10-25T01:16:35Z"},
                 {"name": "Fetch news", "conclusion": "success",
                  "started_at": "2026-10-25T01:16:40Z", "completed_at": "2026-10-25T01:17:40Z"},
                 {"name": "Tiny", "conclusion": "success",
                  "started_at": "2026-10-25T01:17:40Z", "completed_at": "2026-10-25T01:17:40Z"}]}]
    prev = {"created_at": "2026-10-24T22:33:27Z"}
    rows = {r["step"]: r for r in latency.run_rows(run, jobs, "gha:news", ["17 * * * *"], prev)}
    assert set(rows) == {"_run", "_queue", "_gap", "job:fetch", "Fetch news"}
    assert rows["_run"]["seconds"] == 118
    assert round(rows["_queue"]["seconds"] / 60) == 59
    assert round(rows["_gap"]["seconds"] / 60) == 163
    deploy = {**run, "id": 10, "event": "workflow_run", "updated_at": "2026-10-25T01:25:49Z"}
    chain = [r for r in latency.run_rows(deploy, [], "gha:deploy", [], None,
                                         {"id": 9, "name": "News", **run}) if r["step"] == "_chain"]
    assert round(chain[0]["seconds"] / 60, 1) == 9.5


def test_watchdog_starts_a_skipped_refresh_once(tmp_path):
    calls = []

    def gh(*args):
        calls.append(args)
        if args[0] == "run":
            return SimpleNamespace(returncode=0, stdout=json.dumps(
                [{"createdAt": "2026-10-25T07:00:00Z", "status": "completed"}]), stderr="")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    rows = latency.refresh_watchdog(root=tmp_path, at=NOW, runner=gh)
    assert calls[-1][:2] == ("workflow", "run") and rows[0]["step"] == "start news refresh"
    assert rows[0]["detail"]["last_run_age_h"] == 5.0
    calls.clear()
    assert latency.refresh_watchdog(root=tmp_path, at=NOW + timedelta(hours=1), runner=gh) == []
    assert calls == []


def test_watchdog_leaves_a_recent_refresh_alone(tmp_path):
    def gh(*args):
        assert args[0] == "run", "must not start a workflow"
        return SimpleNamespace(returncode=0, stdout=json.dumps(
            [{"createdAt": "2026-10-25T11:20:00Z", "status": "completed"}]), stderr="")

    assert latency.refresh_watchdog(root=tmp_path, at=NOW, runner=gh) == []


def test_sims_cycle_steps_become_rows(tmp_path):
    out = {"started_at": "2026-10-25T12:00:00+00:00",
           "timings": [("bot paths", 100.0, 103.5, True), ("terminal export", 103.5, 104.0, False)]}
    rows = {r["step"]: r for r in sims.latency_steps(out)}
    assert rows["bot paths"]["seconds"] == 3.5 and rows["bot paths"]["pipeline"] == "service:sims"
    assert not rows["terminal export"]["ok"] and not rows["_run"]["ok"]
    assert rows["_run"]["seconds"] == 4.0
