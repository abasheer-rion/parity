"""The data registry (DEC-0064): the seed matches the catalog and providers, a sync is
idempotent and retires what the code dropped, the event log is append-only, the engine reads
enrolled series through catalog.get, display rights are enforced where values are served,
and publishing sends every row once, in order, in pieces."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

import pytest

from parity.data import catalog, providers
from parity.registry import db, publish, rights, seed, sync, tags
from parity.registry.model import DISPLAY_RIGHTS, STATUSES, Record

ROOT = Path(__file__).resolve().parents[2]
EMPTY = {"series": []}


def test_every_catalog_series_is_in_the_seed_with_the_same_rules():
    recs = {r.id: r for r in seed.catalog_records(EMPTY)}
    assert set(recs) == set(catalog.CATALOG)
    for key, s in catalog.CATALOG.items():
        r = recs[key]
        assert (r.source_id, r.code, r.frequency) == (s.source, s.code, s.frequency)
        assert (r.published_after, r.lag_days, r.required) == (s.published_after, s.lag_days,
                                                                 s.required)
        assert r.display_rights in DISPLAY_RIGHTS and r.status in STATUSES


def test_every_provider_is_a_source_and_keys_are_names_only():
    srcs = {s.id: s for s in seed.sources()}
    for p in providers.PROVIDERS:
        assert p.id in srcs, p.id
        assert srcs[p.id].key_name == p.key_env
        if p.terms_url:
            assert srcs[p.id].terms_read_on, p.id
    used = {s.source for s in catalog.CATALOG.values()}
    assert used <= set(srcs)
    for s in srcs.values():
        assert s.display_rights in DISPLAY_RIGHTS
        assert not s.key_name or re.fullmatch(r"[A-Z0-9_]+", s.key_name)


def test_rights_follow_the_terms():
    recs = {r.id: r for r in seed.catalog_records(EMPTY)}
    assert recs["fx.EUR"].display_rights == "public"
    assert recs["cmd.NICKEL"].display_rights == "research"  # IMF asks before commercial reuse
    assert recs["eq.SPX"].display_rights == "research"      # S&P forbids redistribution
    assert recs["eq.SPY"].display_rights == "none"          # Yahoo: cross-check only
    srcs = {s.id: s for s in seed.sources()}
    for r in recs.values():  # a series never has wider rights than its source
        assert rights.RANK[r.display_rights] <= rights.RANK[srcs[r.source_id].display_rights]


def test_live_feeds_agree_with_the_site():
    text = (ROOT / "web/src/lib/live/sources.ts").read_text()
    site = dict(re.findall(r'\{ id: "([a-z0-9-]+)",.*?licence: "([a-z]+)"', text))
    for src, source_id, _, _ in seed.LIVE_FEEDS:
        want = {"display": "public", "internal": "internal"}[site[src]]
        assert seed.SOURCE_RIGHTS[source_id] == want, src


def test_may_show_and_may_use():
    assert rights.may_show("public", "public") and rights.may_show("public", "team")
    assert not rights.may_show("internal", "public") and rights.may_show("internal", "team")
    assert not rights.may_show("research", "team") and rights.may_show("research", "research")
    assert not rights.may_show("none", "research")
    assert rights.may_use("research", "research") and not rights.may_use("research", "display")
    assert rights.may_use("internal", "feed") and not rights.may_use("none", "research")


def test_sync_is_idempotent_and_retires_what_the_code_dropped(tmp_path, monkeypatch):
    con = db.connect(tmp_path / "r.db")
    first = sync.sync(con, EMPTY)
    assert first["added"] == len(catalog.CATALOG) + len(seed.LIVE_FEEDS)
    assert sync.sync(con, EMPTY) == {"sources": 0, "added": 0, "updated": 0, "retired": 0,
                                     "lineage": False}
    # A learned field survives a sync.
    db.set_status(con, "fx.EUR", "live", health="ok")
    sync.sync(con, EMPTY)
    assert db.get(con, "fx.EUR")["status"] == "live"
    # A series removed from the catalog is retired, with an event.
    gone = dict(catalog.CATALOG)
    gone.pop("fx.SEK")
    monkeypatch.setattr(catalog, "CATALOG", gone)
    out = sync.sync(con, EMPTY)
    assert out["retired"] == 1 and db.get(con, "fx.SEK")["status"] == "retired"
    assert db.events(con, "fx.SEK", 1)[0]["kind"] == "retired"


def test_the_event_log_is_append_only(tmp_path):
    con = db.connect(tmp_path / "r.db")
    db.add_event(con, "status", series_id="x", to_state="live")
    with pytest.raises(sqlite3.DatabaseError):
        con.execute("UPDATE events SET kind = 'health'")
    with pytest.raises(sqlite3.DatabaseError):
        con.execute("DELETE FROM events")


def test_catalog_get_reads_enrolled_registry_series(tmp_path, monkeypatch):
    path = tmp_path / "r.db"
    con = db.connect(path)
    base = dict(id="fred.NEWCODE", source_id="fred", name="A new FRED series", frequency="M",
                display_rights="public", code="NEWCODE", origin="discovered",
                published_after=22)
    db.put(con, Record(status="candidate", **base))
    con.commit()
    monkeypatch.setattr(db, "DB", path)
    with pytest.raises(KeyError):
        catalog.get("fred.NEWCODE")  # a candidate is not readable
    db.set_status(con, "fred.NEWCODE", "enrolled")
    con.commit()
    s = catalog.get("fred.NEWCODE")
    assert (s.source, s.code, s.published_after, s.required) == ("fred", "NEWCODE", 22, False)
    assert catalog.get("fx.EUR") is catalog.CATALOG["fx.EUR"]  # curated always wins


def test_publish_sends_everything_once_in_order(tmp_path):
    con = db.connect(tmp_path / "r.db")
    sync.sync(con, EMPTY)
    for sid in ("fx.EUR", "cmd.NICKEL"):
        con.execute("INSERT INTO previews (series_id, points) VALUES (?, ?)",
                    (sid, '[["2026-01-01", 1]]'))
    con.commit()
    calls = []
    sent = publish.publish(con, send=lambda doc: calls.append(doc) or {})
    kinds = [next(iter(c)) for c in calls]
    assert kinds.index("sources") < kinds.index("series") < kinds.index("lineage")
    assert all(len(next(iter(c.values()))) <= publish.CHUNK for c in calls)
    assert sent["series"] == len(catalog.CATALOG) + len(seed.LIVE_FEEDS)
    # Research-only data never leaves as values.
    previews = [p["series_id"] for c in calls for p in c.get("previews", [])]
    assert previews == ["fx.EUR"]
    # A lineage piece never splits one series' list.
    pieces = [c["lineage"] for c in calls if "lineage" in c]
    for a, b in zip(pieces, pieces[1:], strict=False):
        assert a[-1]["series_id"] != b[0]["series_id"]
    assert not any(publish.pending(con).values())
    calls.clear()
    publish.publish(con, send=lambda doc: calls.append(doc) or {})
    assert calls == []


def test_classifier_places_names_the_rules_cannot():
    a, t = tags.classifier()
    assert a.predict("Chinese Yuan Renminbi to U.S. Dollar Spot Exchange Rate")[0] == "fx"
    lab = tags.label("fred.XYZ", "Market Yield on U.S. Treasury Securities at 7-Year Constant "
                     "Maturity")
    assert lab["by"] == "classifier" and lab["asset_class"] == "rates"
    assert tags.label("fred.UNRATE", "Unemployment Rate")["asset_class"] in ("macro", "other")
    assert tags.label("fx.EUR", "USD per EUR")["by"] == "rule"


def test_the_site_export_never_shows_what_the_registry_keeps_private():
    from parity import terminal

    for s in catalog.CATALOG.values():
        if terminal.allowed(s)[0]:
            assert rights.catalog_rights(s) == "public", s.key


def test_event_detail_is_clipped_by_value_and_never_quotes_a_key(tmp_path):
    import json

    con = db.connect(tmp_path / "r.db")
    db.add_event(con, "health", series_id="x", detail={
        "error": "Failed to fetch https://api.example.com/x?api_key=SECRET123&a=1 " + "y" * 900,
        "many": list(range(50)), "deep": {"a": {"b": {"c": {"d": 1}}}}})
    raw = con.execute("SELECT detail FROM events").fetchone()[0]
    d = json.loads(raw)
    assert "SECRET123" not in raw and len(d["error"]) <= 200 and len(d["many"]) == 10
    assert len(raw.encode()) < 1500
