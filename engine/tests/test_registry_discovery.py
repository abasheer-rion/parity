"""Discovery and the enrolment gate (DEC-0064): discoverers propose and never enrol, lists
of listings set a baseline first, the gate accepts only series whose licence, schema,
history, lag and sanity checks pass, and values are kept only where the rights allow."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from parity.data import catalog, store
from parity.registry import checks, cycle, db, discover, enrol, fetch, sync

EMPTY = {"series": []}


class FakeResponse:
    def __init__(self, body):
        self._body = body
        self.text = body if isinstance(body, str) else json.dumps(body)
        self.status_code = 200

    def json(self):
        return self._body if not isinstance(self._body, str) else json.loads(self._body)


@pytest.fixture
def reg(tmp_path, monkeypatch):
    con = db.connect(tmp_path / "r.db")
    sync.sync(con, EMPTY)
    monkeypatch.setattr(db, "DB", tmp_path / "r.db")
    monkeypatch.setattr(store, "DEFAULT_DIR", tmp_path / "data")
    return con


def route(monkeypatch, table: dict):
    """Answer each URL that contains a key of `table` with its value; anything else fails."""
    calls = []

    def fake(url, params=None, json=None, pause=0.5, retries=3):
        calls.append(url)
        for k, v in table.items():
            if k in url:
                return FakeResponse(v(params) if callable(v) else v)
        raise RuntimeError(f"unexpected request to {url}")
    monkeypatch.setattr("parity.registry.net.request", fake)
    return calls


def walk(n=900, start="2022-01-03", freq="B", seed=1, level=100.0):
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start, periods=n, freq=freq)
    return pd.Series(level * np.exp(np.cumsum(rng.normal(0, 0.01, n))), index=idx)


# ------------------------------------------------------------------ checks

def test_sanity_passes_clean_data_and_names_what_fails():
    today = pd.Timestamp("2025-06-10")
    good = walk(900, "2022-01-03")
    good = good[good.index <= today]
    assert checks.sanity(good, "D", "fx", today=today).ok
    neg = good.copy()
    neg.iloc[10] = -1
    assert "negative" in checks.sanity(neg, "D", "fx", today=today).reason
    assert checks.sanity(neg, "D", "rates", today=today).ok  # rates may go below zero
    short = good.tail(100)
    assert checks.sanity(short, "D", "fx", today=today).reason.startswith("history")
    future = pd.concat([good, pd.Series([1.0], index=[today + pd.Timedelta(days=30)])])
    assert "future" in checks.sanity(future, "D", "fx", today=today).reason
    weekends = walk(900, "2022-01-03", freq="D")
    weekends = weekends[weekends.index <= today]
    assert "weekends" in checks.sanity(weekends, "D", "fx", today=today).reason
    end = weekends.index.max() + pd.Timedelta(days=1)
    assert checks.sanity(weekends, "D", "crypto", crypto=True, today=end).ok
    stale = checks.sanity(good, "D", "fx", today=today + pd.Timedelta(days=120))
    assert not stale.ok and "no value for" in stale.reason


def test_default_lag_is_conservative():
    assert checks.default_lag("D")["lag_days"] == 1
    assert checks.default_lag("M")["published_after"] == 22
    assert checks.default_lag("Q")["published_after"] == 65


# ------------------------------------------------------------------ discovery

ECB_CSV = ("KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE\n"
           "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,{today},1.1\n"
           "EXR.D.ARS.EUR.SP00.A,D,ARS,EUR,SP00,A,2020-10-30,91.6\n"
           "EXR.D.QQQ.EUR.SP00.A,D,QQQ,EUR,SP00,A,{today},5.0\n")
ECB_FLOWS = ('<str:Dataflow id="EXR" agencyID="ECB"><com:Name xml:lang="en">Exchange Rates'
             '</com:Name></str:Dataflow>')


def test_discovery_proposes_new_series_and_never_enrols(reg, monkeypatch):
    today = pd.Timestamp.now().date().isoformat()
    route(monkeypatch, {"service/data/EXR": ECB_CSV.format(today=today),
                        "dataflow/ECB": ECB_FLOWS})
    report = discover.run(reg, ["ecb"])
    assert report["ecb"]["added"] == 1  # QQQ is new and current; USD is known, ARS is dead
    rec = db.get(reg, "ecb.QQQ")
    assert rec["status"] == "candidate" and rec["origin"] == "discovered"
    assert rec["display_rights"] == "public" and rec["asset_class"] == "fx"
    assert db.events(reg, "ecb.QQQ")[0]["kind"] == "discovered"
    # A second run adds nothing, and new dataflows appear only after the baseline.
    route(monkeypatch, {"service/data/EXR": ECB_CSV.format(today=today),
                        "dataflow/ECB": ECB_FLOWS + ECB_FLOWS.replace("EXR", "NEW1")})
    assert discover.run(reg, ["ecb"])["ecb"]["added"] == 1
    assert db.get(reg, "ecbflow.NEW1")["code"] == "NEW1/"


def test_listings_set_a_baseline_first(reg, monkeypatch):
    route(monkeypatch, {"api.gemini.com": ["btcusd", "ethusd"]})
    assert discover.run(reg, ["gemini"])["gemini"]["added"] == 0
    route(monkeypatch, {"api.gemini.com": ["btcusd", "ethusd", "newusd"]})
    assert discover.run(reg, ["gemini"])["gemini"]["added"] == 1
    rec = db.get(reg, "gemini.NEWUSD")
    assert rec["display_rights"] == "internal"  # team only, like the venue's live feed


def test_a_discoverer_that_needs_a_key_is_skipped_not_failed(reg, monkeypatch):
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    r = discover.run(reg, ["fred"])["fred"]
    assert r["ok"] and "FRED_API_KEY" in r["skipped"]


def test_kraken_needs_volume_or_a_new_listing(reg, monkeypatch):
    pairs = {"XXBTZUSD": {"altname": "XBTUSD", "wsname": "XBT/USD", "quote": "ZUSD"},
             "THINUSD": {"altname": "THINUSD", "wsname": "THIN/USD", "quote": "ZUSD"},
             "XETHZEUR": {"altname": "ETHEUR", "wsname": "ETH/EUR", "quote": "ZEUR"}}
    ticker = {"XXBTZUSD": {"v": ["1", "1000"], "p": ["1", "60000"]},
              "THINUSD": {"v": ["1", "10"], "p": ["1", "1"]}}
    route(monkeypatch, {"AssetPairs": {"result": pairs}, "Ticker": {"result": ticker}})
    discover.run(reg, ["kraken"])
    assert db.get(reg, "kraken.XBTUSD") and db.get(reg, "kraken.THINUSD") is None
    assert db.get(reg, "kraken.ETHEUR") is None
    assert db.get(reg, "kraken.XBTUSD")["labels"]["liquidity_tier"] == 1


def test_base_pools_are_read_from_the_live_feed_source():
    tokens, pools = discover.onchain_config()
    assert {"WETH", "USDC", "CBBTC"} <= set(tokens)
    assert "0xd0b53d9277642d899df5c87a3966a349a798f224" in pools


# ------------------------------------------------------------------ the gate

def _cand(reg, cid, source, code, freq="D", use="research", rights=None):
    c = discover.candidate(cid, source, code, f"Test {cid}", freq, "test", use=use,
                           rights=rights, volume_usd=1e7 if use == "feed" else None)
    discover.add(reg, c)
    reg.commit()
    return db.get(reg, cid)


def test_the_gate_checks_licence_schema_history_and_sanity(reg, monkeypatch):
    today = pd.Timestamp("2025-06-10", tz="UTC")
    data = walk(900, "2022-01-03")
    data = data[data.index <= today.tz_convert(None)]
    monkeypatch.setitem(fetch.FETCHERS, "ecb", lambda rec: data.rename(rec["id"]))
    # No rights at all: the licence check stops it before any fetch.
    r = _cand(reg, "request.level-2", "competitors", "level-2")
    assert enrol.gate(reg, r, today)["reason"].startswith("licence")
    # A data set, not a series.
    r = _cand(reg, "ecbflow.NEW1", "ecb", "NEW1/", "M")
    assert enrol.gate(reg, r, today)["reason"].startswith("schema")
    # A good series is enrolled, its lag set, its history saved where the store reads it.
    r = _cand(reg, "ecb.QQQ", "ecb", "EXR/D.QQQ.EUR.SP00.A")
    out = enrol.gate(reg, r, today)
    reg.commit()
    assert out["enrolled"], out
    rec = db.get(reg, "ecb.QQQ")
    assert rec["status"] == "enrolled" and rec["lag_days"] == 1 and rec["quality"] >= 0.6
    assert catalog.get("ecb.QQQ").lag_days == 1
    assert len(store.load("ecb.QQQ", store.DEFAULT_DIR)) == len(data)
    assert reg.execute("SELECT count(*) FROM previews WHERE series_id = 'ecb.QQQ'"
                       ).fetchone()[0] == 1
    assert db.events(reg, "ecb.QQQ", 1)[0]["kind"] == "enrolled"


def test_a_failing_candidate_keeps_its_reason_and_logs_it_once(reg, monkeypatch):
    today = pd.Timestamp("2025-06-10", tz="UTC")
    short = walk(100, "2025-01-01")
    monkeypatch.setitem(fetch.FETCHERS, "ecb", lambda rec: short.rename(rec["id"]))
    r = _cand(reg, "ecb.SHORT", "ecb", "EXR/D.SHORT.EUR.SP00.A")
    enrol.gate(reg, r, today)
    enrol.gate(reg, db.get(reg, "ecb.SHORT"), today + pd.Timedelta(days=2))
    rec = db.get(reg, "ecb.SHORT")
    assert rec["status"] == "candidate" and rec["reason"].startswith("history")
    kinds = [e["kind"] for e in db.events(reg, "ecb.SHORT")]
    assert kinds.count("rejected") == 1


def test_research_only_data_is_enrolled_without_a_preview(reg, monkeypatch):
    today = pd.Timestamp("2025-06-10", tz="UTC")
    data = walk(900, "2022-01-03")
    data = data[data.index <= today.tz_convert(None)]
    monkeypatch.setitem(fetch.FETCHERS, "fred", lambda rec: data.rename(rec["id"]))
    r = _cand(reg, "fred.IMFTHING", "fred", "IMFTHING", rights="research")
    assert enrol.gate(reg, r, today)["enrolled"]
    assert reg.execute("SELECT count(*) FROM previews WHERE series_id = 'fred.IMFTHING'"
                       ).fetchone()[0] == 0


def test_feed_candidates_pass_without_history(reg):
    r = _cand(reg, "onchain.0xabc", "onchain", "0xabc", "T", use="feed", rights="public")
    out = enrol.gate(reg, r)
    assert out["enrolled"]
    assert "pool list" in db.get(reg, "onchain.0xabc")["reason"]


def test_run_tries_each_candidate_at_most_once_a_day(reg, monkeypatch):
    calls = []
    monkeypatch.setitem(fetch.FETCHERS, "ecb", lambda rec: calls.append(1) or walk(10))
    _cand(reg, "ecb.AAA", "ecb", "EXR/D.AAA.EUR.SP00.A")
    enrol.run(reg)
    enrol.run(reg)
    assert len(calls) == 1


def test_a_cycle_reports_counts(reg, monkeypatch):
    out = cycle.run(reg, discovery=False, send=False)
    assert all(p["ok"] for p in out["parts"].values())
    assert out["summary"]["series"] == len(catalog.CATALOG) + 8
    assert "registry:" in cycle.line(out)
