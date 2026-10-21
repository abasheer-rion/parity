"""Currencies, market size, ticks and the local API. Fixtures only, never the network."""

from __future__ import annotations

import json
import threading
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd
import pytest

from parity import api, cli
from parity.data import currencies, market_size, ticks

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def refuse(*_a, **_k):
        raise AssertionError("tests must not touch the network")

    monkeypatch.setattr("parity.data.sources._get", refuse)


@pytest.fixture
def root(tmp_path) -> Path:
    """A data folder with both reference tables built from the fixtures."""
    ref = tmp_path / "reference"
    ref.mkdir()
    currencies.build_table((FIX / "iso4217-list-one.xml").read_bytes(),
                           (FIX / "iso4217-list-three.xml").read_bytes()
                           ).to_parquet(ref / "iso4217.parquet", index=False)
    market_size.parse_bis_csv((FIX / "bis_fx_turnover.csv").read_text()
                              ).to_parquet(ref / "bis_fx_turnover.parquet", index=False)
    return tmp_path


# ------------------------------------------------------------------ currencies


def test_current_list_groups_countries_and_flags_funds():
    t = currencies.parse_list_one((FIX / "iso4217-list-one.xml").read_bytes())
    assert list(t.columns) == currencies.COLUMNS
    assert t["code"].is_unique  # one row per code even though many countries use EUR
    eur = t.set_index("code").loc["EUR"]
    assert eur["numeric"] == "978" and eur["minor_units"] == 2
    assert "GERMANY" in eur["countries"] and "; " in eur["countries"]
    assert bool(t.set_index("code").loc["CHE", "is_fund"])
    assert pd.isna(t.set_index("code").loc["XAU", "minor_units"])  # gold has no minor unit
    assert "" not in set(t["code"])  # Antarctica's "No universal currency" is dropped
    assert (t["list_published"] == "2026-09-17").all()


def test_withdrawn_list_keeps_each_withdrawal():
    t = currencies.parse_list_three((FIX / "iso4217-list-three.xml").read_bytes())
    vef = t[t["code"] == "VEF"]
    assert sorted(vef["withdrawn"]) == ["2011-12", "2016-02", "2018-08"]
    assert (t["status"] == "withdrawn").all()


def test_load_reads_cache_and_filters_withdrawn(root):
    current = currencies.load(root)
    everything = currencies.load(root, include_withdrawn=True)
    assert set(current["status"]) == {"current"}
    assert {"DEM", "VEF"} <= set(everything["code"]) and len(everything) > len(current)


# ------------------------------------------------------------------ market size


def test_bis_turnover_matches_published_headline():
    t = market_size.parse_bis_csv((FIX / "bis_fx_turnover.csv").read_text())
    total = market_size.query(t, 2022, "TO1")["turnover_usd_mn"].iloc[0]
    assert 7.4e6 < total < 7.6e6  # BIS headline: about 7.5 trillion USD a day in April 2022
    latest = market_size.query(t)
    assert latest["year"].unique().tolist() == [2025]
    usd = latest.set_index("currency").loc["USD", "share_pct"]
    assert 85 < usd < 92  # the dollar is on one side of about 89% of trades
    assert latest["currency"].iloc[0] == "TO1"  # sorted biggest first


def test_market_size_filters_by_instrument(root):
    spot = market_size.query(market_size.load(root), 2025, instrument="B")
    assert set(spot["instrument_name"]) == {"Spot"}


# ------------------------------------------------------------------ ticks

HISTDATA = "20120201 000003660,1.306600,1.306770,0\n20120201 000004123,1.306610,1.306780,0\n"
TRUEFX = ("EUR/USD,20240102 00:00:00.123,1.10432,1.10441\n"
          "EUR/USD,20240102 23:59:59.999,1.10500,1.10510\n"
          "EUR/USD,20240103 00:00:00.001,1.10501,1.10511\n")


def test_histdata_est_converts_to_utc_nanoseconds():
    t = ticks.parse_histdata(HISTDATA)
    assert list(t.columns) == ticks.TICK_COLUMNS and t["ts_ns"].dtype == "int64"
    first = pd.Timestamp("2012-02-01 05:00:03.660", tz="UTC").value  # EST is UTC-5 all year
    assert t["ts_ns"].iloc[0] == first
    assert (t["ts_ns"] % ticks.NS_PER_MS == 0).all()  # millisecond source, ns field


def test_detect_format_and_pair_names():
    assert ticks.detect_format(HISTDATA) == "histdata"
    assert ticks.detect_format(TRUEFX) == "truefx"
    assert ticks.detect_format("ts_ns,bid,ask\n1,1.0,1.1\n") == "csv"
    assert ticks.normalise_pair("eur/usd") == "EURUSD"
    with pytest.raises(ValueError):
        ticks.normalise_pair("../etc")


def test_import_splits_by_utc_day_and_is_idempotent(tmp_path):
    src = tmp_path / "truefx.zip"
    with zipfile.ZipFile(src, "w") as z:
        z.writestr("EURUSD-2024-01.csv", TRUEFX)
    report = ticks.import_file(src, "EUR/USD", root=tmp_path)
    assert [(r["date"], r["rows"]) for r in report] == [("2024-01-02", 2), ("2024-01-03", 1)]
    ticks.import_file(src, "EURUSD", root=tmp_path)  # second import adds nothing
    day = ticks.load("EURUSD", "2024-01-02", tmp_path)
    assert len(day) == 2 and day["ts_ns"].is_monotonic_increasing
    assert ticks.summary(day)["first"].startswith("2024-01-02T00:00:00.123")


def test_nanosecond_csv_keeps_full_precision(tmp_path):
    f = tmp_path / "ns.csv"
    f.write_text("ts_ns,bid,ask\n1704153600000000001,1.1,1.2\n")
    ticks.import_file(f, "EURUSD", root=tmp_path)
    assert ticks.load("EURUSD", "2024-01-02", tmp_path)["ts_ns"].iloc[0] == 1704153600000000001


def test_missing_day_explains_how_to_import(tmp_path):
    with pytest.raises(FileNotFoundError, match="--import"):
        ticks.load("EURUSD", "2024-01-02", tmp_path)


def test_a_licensed_source_plugs_in(tmp_path):
    class Fake:
        name, resolution_ns = "fake", 1

        def fetch(self, pair, date):
            return ticks.parse_csv("ts_ns,bid,ask\n1704153600000000007,1.1,1.2\n")

    day = ticks.load("GBPUSD", "2024-01-02", tmp_path, source=Fake())
    assert day["ts_ns"].iloc[0] == 1704153600000000007
    assert (tmp_path / "ticks" / "GBPUSD" / "2024-01-02.parquet").exists()


# ------------------------------------------------------------------ API and CLI


def test_routes_return_json_ready_bodies(root):
    status, body = api.route("/currencies", {"all": ["1"]}, root)
    assert status == 200 and body["count"] == len(body["currencies"])
    json.dumps(body)  # NaN and numpy values must already be plain JSON
    status, body = api.route("/market-size", {"currency": ["eur"]}, root)
    assert status == 200 and body["rows"][0]["currency"] == "EUR"
    assert api.route("/ticks/EURUSD", {}, root)[0] == 400
    assert api.route("/ticks/EURUSD", {"date": ["2024-01-02"]}, root)[0] == 404
    assert api.route("/nope", {}, root)[0] == 404


def test_server_binds_localhost_only(root):
    server = api.make_server(0, root)
    assert server.server_address[0] == "127.0.0.1"
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        port = server.server_address[1]
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/market-size") as resp:
            body = json.loads(resp.read())
        assert body["rows"][0]["year"] == 2025
    finally:
        server.shutdown()
        server.server_close()


def test_cli_ticks_import_and_show(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(ticks.load, "__defaults__", (tmp_path, None))
    monkeypatch.setattr(ticks.import_file, "__defaults__", ("auto", tmp_path))
    f = tmp_path / "h.csv"
    f.write_text(HISTDATA)
    assert cli.main(["ticks", "EURUSD", "--import", str(f)]) == 0
    assert cli.main(["ticks", "EURUSD", "--date", "2012-02-01"]) == 0
    assert '"rows": 2' in capsys.readouterr().out
