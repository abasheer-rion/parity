"""The wider official data (REF-0015): ECB, BIS, US Treasury, CFTC and EIA parsers, keyed
sources that skip cleanly, and the provider list. Saved fixtures only, never the network."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest
import requests

from parity import cli, report
from parity.data import catalog, providers, sources, store

FIX = Path(__file__).parent / "fixtures" / "data"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def refuse(*_a, **_k):
        raise AssertionError("tests must not touch the network")

    monkeypatch.setattr("parity.data.sources._get", refuse)
    monkeypatch.setattr("parity.data.sources._curl", refuse)


# ------------------------------------------------------------------ catalog


def test_every_new_series_is_optional_and_has_a_fetcher():
    for s in catalog._WIDER:
        assert not s.required, f"{s.key} must be optional so official runs never fail on it"
    for s in catalog.CATALOG.values():
        assert s.source in sources.FETCHERS or s.source == "derived", s.key
        assert s.source in providers.BY_ID, f"{s.source} needs a row in providers.py"


def test_no_key_is_defined_twice():
    groups = [catalog._FX, catalog._RATES, catalog._OTHER, catalog._REER, catalog._FX_WIDE,
              catalog._YIELDS, catalog._FACTORS, catalog._INDUSTRIES, catalog._BOND_TR,
              catalog._WIDER]
    assert sum(len(g) for g in groups) == len(catalog.CATALOG)


def test_left_out_series_stay_left_out():
    """Third-party copyright on FRED (REF-0015): never add these by accident."""
    codes = {s.code for s in catalog._WIDER}
    for banned in ("BAMLH0A0HYM2", "BAMLC0A0CM", "DAAA", "DBAA", "DGASNYH", "DHOILNYH"):
        assert banned not in codes


# ------------------------------------------------------------------ SDMX (ECB, BIS)


def test_merged_key_joins_each_dimension():
    assert sources.merged_key(["D.USD.EUR.SP00.A", "D.JPY.EUR.SP00.A"]) == "D.USD+JPY.EUR.SP00.A"
    assert sources.merged_key(["D.US", "D.XM", "D.US"]) == "D.US+XM"
    with pytest.raises(ValueError):
        sources.merged_key(["D.US", "D.USD.EUR"])


def test_ecb_reference_rates():
    table = sources.split_sdmx_csv((FIX / "ecb_exr.csv").read_text())
    usd = sources.sdmx_series(table, catalog.get("ecb.USD"))
    assert usd.name == "ecb.USD"
    assert usd.index[0] == pd.Timestamp("2026-10-15") and usd.iloc[-1] == pytest.approx(1.1205)
    assert usd.index.is_monotonic_increasing and len(usd) == 6
    assert sources.sdmx_series(table, catalog.get("ecb.JPY")).iloc[0] == pytest.approx(177.06)
    with pytest.raises(ValueError):
        sources.sdmx_series(table, catalog.get("ecb.GBP"))  # not in the file


def test_bis_policy_rates_drop_missing_values():
    table = sources.split_sdmx_csv((FIX / "bis_cbpol.csv").read_text())
    us = sources.sdmx_series(table, catalog.get("policy.USD"))
    assert len(us) == 7 and (us == 4.375).all()
    hr = catalog.Series("policy.HRK", "bis", "WS_CBPOL/D.HR", "test")
    with pytest.raises(ValueError):  # every value is NaN after the euro changeover
        sources.sdmx_series(table, hr)


# ------------------------------------------------------------------ US Treasury


def test_treasury_years_with_different_tenors_line_up():
    curve = pd.concat([sources.parse_treasury_csv((FIX / name).read_text())
                       for name in ("treasury_2026.csv", "treasury_2001.csv")]).sort_index()
    ten = sources.curve_column(curve, catalog.get("curve.UST_10Y"))
    assert ten.index.is_monotonic_increasing
    assert ten.loc["2001-12-31"] == pytest.approx(5.07)
    assert ten.loc["2026-10-21"] == pytest.approx(5.13)
    four = sources.curve_column(curve, catalog.get("curve.UST_4M"))  # no 4-month in 2001
    assert four.index.min() == pd.Timestamp("2026-10-19")


# ------------------------------------------------------------------ CFTC


def test_cot_net_position_and_percent_of_open_interest():
    rows = json.loads((FIX / "cot_eur.json").read_text())
    net = sources.parse_cot_json(rows, catalog.get("cot.EUR"))
    assert net.iloc[-1] == 222929 - 360502
    assert net.index[-1] == pd.Timestamp("2026-10-13")  # dated the Tuesday; lag in panel
    pct = sources.parse_cot_json(rows, catalog.get("cot.EUR_PCT"))
    assert pct.iloc[-1] == pytest.approx(100 * (222929 - 360502) / 874541)


def test_cot_is_used_three_business_days_late(tmp_path):
    spec = catalog.get("cot.EUR_PCT")
    rows = json.loads((FIX / "cot_eur.json").read_text())
    data = sources.parse_cot_json(rows, spec)
    path = store._path(spec, tmp_path)
    path.parent.mkdir(parents=True)
    data.to_frame().to_parquet(path)
    p = store.panel([spec.key], tmp_path)[spec.key]
    assert p.first_valid_index() == pd.Timestamp("2026-10-02")  # Tuesday 29 Sep + 3
    assert p.loc["2026-10-13"] == pytest.approx(data.loc["2026-10-06"])  # a week later
    assert not p.loc["2026-10-02":].isna().any()  # weekly values fill the gaps


# ------------------------------------------------------------------ EIA and keys


def test_eia_parser_sorts_and_drops_blanks():
    s = sources.parse_eia_json(json.loads((FIX / "eia_crude.json").read_text()),
                               catalog.get("eia.CRUDE_STOCKS"))
    assert list(s.index) == [pd.Timestamp("2026-10-02"), pd.Timestamp("2026-10-09")]
    assert s.iloc[-1] == 421337


def test_keyed_source_skips_without_its_key(monkeypatch, tmp_path):
    monkeypatch.delenv("EIA_API_KEY", raising=False)
    with pytest.raises(sources.MissingKey, match="EIA_API_KEY"):
        sources.fetch(catalog.get("eia.CRUDE_STOCKS"))
    rows = store.refresh(["eia.CRUDE_STOCKS"], root=tmp_path)
    assert rows[0]["skipped"] and not rows[0]["ok"]
    cov = json.loads((tmp_path / "coverage.json").read_text())
    assert all(r["key"] != "eia.CRUDE_STOCKS" for r in cov["series"])


def test_fetch_prints_skip_and_does_not_fail_strict(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv("EIA_API_KEY", raising=False)
    monkeypatch.setattr(store, "DEFAULT_DIR", tmp_path)
    monkeypatch.setattr(store.refresh, "__defaults__", (None, tmp_path))
    assert cli.main(["fetch", "eia.GAS_STORAGE", "--strict"]) == 0
    assert "skip" in capsys.readouterr().out


def test_errors_never_show_a_key(monkeypatch):
    monkeypatch.undo()  # use the real _get, with the network call itself faked
    secret = "s3cr3t-key-value"

    def boom(url, params=None, **_k):
        raise requests.HTTPError(f"403 for url: {url}?api_key={params['api_key']}&x=1")

    monkeypatch.setattr(requests, "get", boom)
    monkeypatch.setattr(sources.time, "sleep", lambda _s: None)
    with pytest.raises(RuntimeError) as exc:
        sources._get("https://api.example.invalid/v2", {"api_key": secret})
    assert secret not in str(exc.value) and "api_key=***" in str(exc.value)


def test_data_sources_listing_never_prints_a_key(monkeypatch, capsys):
    monkeypatch.setenv("EIA_API_KEY", "do-not-print-me")
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    assert cli.main(["data", "sources"]) == 0
    out = capsys.readouterr().out
    assert "do-not-print-me" not in out
    assert "EIA_API_KEY (set)" in out and "FRED_API_KEY (not set, optional)" in out
    rows = {r["id"]: r for r in providers.rows()}
    assert rows["eia"]["status"] == "on" and rows["alphavantage"]["status"] == "planned"
    monkeypatch.delenv("EIA_API_KEY")
    assert {r["id"]: r for r in providers.rows()}["eia"]["status"] == "off (no key)"


def test_data_series_lists_one_source(capsys):
    assert cli.main(["data", "series", "--source", "treasury"]) == 0
    out = capsys.readouterr().out
    assert "curve.UST_10Y" in out and "fx.EUR" not in out and "13 series" in out


# ------------------------------------------------------------------ the site export


def test_site_export_skips_bulk_series(tmp_path):
    for key in ("cot.EUR", "cot.EUR_PCT"):
        spec = catalog.get(key)
        path = store._path(spec, tmp_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        pd.Series([1.0, 2.0], index=pd.to_datetime(["2020-01-07", "2020-01-14"]),
                  name=key).to_frame().to_parquet(path)
    out = report.market_series(tmp_path)
    assert "cot.EUR_PCT" in out and "cot.EUR" not in out
