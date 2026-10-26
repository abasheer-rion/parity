"""Markets data: parsing saved responses, themes, storage policy, stats and export.
No network: every response is a trimmed real one saved under fixtures/markets."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd
import pytest

from parity.markets import export, sources, stats, store, themes

FIX = Path(__file__).parent / "fixtures" / "markets"
T0 = datetime(2026, 10, 22, 12, tzinfo=UTC)


def _json(name):
    return json.loads((FIX / name).read_text())


# ------------------------------------------------------------------ CoinGecko


def test_coingecko_markets_parse_prices_changes_and_ranks():
    df = sources.parse_coingecko_markets(_json("coingecko_markets.json"), T0)
    assert list(df["id"]) == ["bitcoin", "ethereum", "dogecoin"]
    btc = df.iloc[0]
    assert btc["symbol"] == "BTC" and btc["rank"] == 1
    assert btc["price_usd"] > 1000 and btc["market_cap_usd"] > btc["price_usd"]
    for col in ("change_24h_pct", "change_7d_pct", "change_30d_pct", "change_1y_pct"):
        assert pd.notna(btc[col])
    assert len(btc["ath_date"]) == 10 and btc["ath_change_pct"] <= 0


def test_coingecko_chart_keeps_one_price_per_day():
    df = sources.parse_coingecko_chart(_json("coingecko_chart_bitcoin.json"), "bitcoin")
    assert df["date"].is_unique and df["date"].is_monotonic_increasing
    assert (df["coin"] == "bitcoin").all() and (df["price_usd"] > 0).all()
    assert 9 <= len(df) <= 11


def test_coingecko_trending_reads_nested_price_and_money_strings():
    df = sources.parse_coingecko_trending(_json("coingecko_trending.json"), T0)
    assert list(df["position"]) == [1, 2, 3]
    first = df.iloc[0]
    assert first["symbol"] == "UHI" and first["market_cap_usd"] == 23099090
    assert first["price_usd"] == pytest.approx(0.0231, rel=0.01)


# ------------------------------------------------------------------ Hyperliquid


def test_hyperliquid_meta_turns_hourly_funding_into_a_yearly_cost():
    df = sources.parse_hyperliquid_meta(_json("hyperliquid_meta.json"), T0)
    assert list(df["coin"]) == ["BTC", "ETH", "ATOM", "MATIC"]
    btc = df.iloc[0]
    assert btc["funding_hourly"] == pytest.approx(0.0000125)
    assert btc["funding_annual_pct"] == pytest.approx(10.95)  # 0.00125% x 8,760 hours
    assert btc["open_interest_usd"] == pytest.approx(btc["open_interest_coins"] * btc["mark_px"])
    assert btc["max_leverage"] == 40
    assert df.set_index("coin").loc["MATIC", "delisted"]


def test_hyperliquid_funding_history_is_utc():
    df = sources.parse_hyperliquid_funding(_json("hyperliquid_funding_btc.json"))
    assert len(df) == 48 and str(df["time"].dt.tz) == "UTC"
    assert df["time"].is_monotonic_increasing and (df["coin"] == "BTC").all()


# ------------------------------------------------------------------ SEC


def test_sec_series_keeps_etf_share_classes_only():
    df = sources.parse_sec_series((FIX / "sec_series_class.csv").read_text(encoding="utf-8"))
    tickers = set(df["ticker"])
    assert {"VOO", "QQQ", "TQQQ", "SOXL", "JEPI"} <= tickers
    assert "VFIAX" not in tickers  # the mutual fund class of the same Vanguard fund
    voo = df.set_index("ticker").loc["VOO"]
    assert voo["name"] == "Vanguard 500 Index Fund ETF Shares"
    assert voo["series_number"] == 2839


def test_sec_exchange_keeps_listed_trusts_not_companies():
    df = sources.parse_sec_exchange(_json("sec_company_tickers_exchange.json"))
    tickers = set(df["ticker"])
    assert {"SPY", "IBIT", "GLD", "FBTC"} <= tickers
    assert not tickers & {"AAPL", "PHYS", "HSDT", "O"}


def test_fts_filings_parse_names_tickers_and_links_and_drop_companies():
    df = sources.parse_sec_fts(_json("sec_fts_s1.json"), T0)
    assert len(df) == 3
    etf = df.iloc[0]
    assert etf["name"] == "Winklevoss Zcash ETF" and etf["root_form"] == "S-1"
    assert etf["url"].startswith("https://www.sec.gov/Archives/edgar/data/2158471/")
    assert etf["url"].endswith("-index.htm")
    kept = sources.keep_fund_filings(df, set())
    assert "Ambitious Entertainment" not in " ".join(kept["name"])
    assert len(kept) == 2


def test_display_name_splits_tickers():
    assert sources._display_name("VS Trust  (SVIX, UVIX)  (CIK 0001793497)") == \
        ("VS Trust", ["SVIX", "UVIX"])
    assert sources._display_name("Sphere Trust  (CIK 0002090000)") == ("Sphere Trust", [])


def test_sec_sources_need_a_contact(monkeypatch):
    monkeypatch.delenv("PARITY_CONTACT", raising=False)
    with pytest.raises(sources.Skipped):
        sources.fetch(sources.BY_ID["sec-funds"])
    monkeypatch.setenv("PARITY_CONTACT", "team@example.org")
    assert sources.user_agent(sources.BY_ID["sec-funds"]).endswith("; team@example.org)")
    assert "example.org" not in sources.user_agent(sources.BY_ID["coingecko-markets"])


# ------------------------------------------------------------------ themes


@pytest.mark.parametrize("name,expect", [
    ("iShares Bitcoin Trust ETF", "crypto"),
    ("Direxion Daily Semiconductor Bull 3X ETF", "leveraged"),
    ("JPMorgan Equity Premium Income ETF", "income"),
    ("FT Vest Laddered Buffer ETF", "buffer"),
    ("Global X Uranium ETF", "energy-transition"),
    ("GraniteShares 2x Long NVDA Daily ETF", "single-stock"),
    ("Vanguard 500 Index Fund ETF Shares", "broad"),
])
def test_themes_match_by_name(name, expect):
    assert expect in themes.classify(name)


def test_every_theme_says_what_to_check():
    for t in themes.THEMES:
        assert t.check and t.what and t.label


# ------------------------------------------------------------------ store


def test_replace_policy_keeps_no_archive(tmp_path):
    a = sources.parse_coingecko_markets(_json("coingecko_markets.json"), T0)
    store.merge("crypto_markets", a, tmp_path)
    store.merge("crypto_markets", a.head(1), tmp_path)
    assert len(store.load("crypto_markets", tmp_path)) == 1


def test_append_policy_dedupes_and_ages_out(tmp_path):
    f = sources.parse_hyperliquid_funding(_json("hyperliquid_funding_btc.json"))
    now = f["time"].max().to_pydatetime()
    store.merge("perps_funding", f, tmp_path, today=now)
    out = store.merge("perps_funding", f.tail(10), tmp_path, today=now)
    assert len(out) == 48
    later = store.merge("perps_funding", f.head(0), tmp_path, today=now + timedelta(days=366))
    assert later.empty


def test_etfs_keep_the_first_date_seen(tmp_path):
    series = sources.parse_sec_series((FIX / "sec_series_class.csv").read_text(encoding="utf-8"))
    trusts = sources.parse_sec_exchange(_json("sec_company_tickers_exchange.json"))
    first = sources.combine_funds(series, trusts, T0)
    store.merge("etfs", first, tmp_path, today=T0)
    again = store.merge("etfs", first, tmp_path, today=T0 + timedelta(days=5))
    assert (again["first_seen"] == "2026-10-22").all()
    assert set(again["structure"]) == {"fund", "trust"}


def test_freshness(tmp_path):
    store.record("x", {"ok_at": T0.isoformat()}, tmp_path)
    assert store.is_fresh("x", 2, tmp_path, now=T0 + timedelta(hours=1))
    assert not store.is_fresh("x", 2, tmp_path, now=T0 + timedelta(hours=3))
    assert not store.is_fresh("never", 2, tmp_path)


# ------------------------------------------------------------------ stats


def test_price_stats_find_the_worst_fall():
    idx = [str(d.date()) for d in pd.date_range("2026-01-01", periods=6)]
    s = pd.Series([100, 110, 55, 60, 66, 99], index=idx, dtype=float)
    st = stats.price_stats(s)
    assert st["max_drawdown_pct"] == -50.0 and st["max_drawdown_date"] == idx[2]
    assert st["worst_day_pct"] == -50.0 and st["big_days"] == 4
    assert st["below_peak_pct"] == -10.0


def test_funding_stats_and_liquidation_move():
    f = sources.parse_hyperliquid_funding(_json("hyperliquid_funding_btc.json"))
    st = stats.funding_stats(f)
    assert st["hours"] == 48 and 0 <= st["positive_share_30d"] <= 1
    assert stats.liquidation_move_pct(40) == 1.25  # Hyperliquid's BTC maintenance margin
    assert stats.liquidation_move_pct(3) == pytest.approx(16.67)


# ------------------------------------------------------------------ export


def test_export_writes_four_files_with_sources(tmp_path):
    root = tmp_path / "data"
    store.merge("crypto_markets", sources.parse_coingecko_markets(
        _json("coingecko_markets.json"), T0), root)
    store.merge("crypto_daily", sources.parse_coingecko_chart(
        _json("coingecko_chart_bitcoin.json"), "bitcoin"), root)
    store.merge("perps_snapshots", sources.parse_hyperliquid_meta(
        _json("hyperliquid_meta.json"), T0), root, today=T0)
    store.merge("perps_funding", sources.parse_hyperliquid_funding(
        _json("hyperliquid_funding_btc.json")), root, today=T0)
    series = sources.parse_sec_series((FIX / "sec_series_class.csv").read_text(encoding="utf-8"))
    trusts = sources.parse_sec_exchange(_json("sec_company_tickers_exchange.json"))
    store.merge("etfs", sources.combine_funds(series, trusts, T0), root, today=T0)
    store.merge("fund_filings", sources.parse_sec_fts(_json("sec_fts_s1.json"), T0), root,
                today=T0)
    info = export.build(tmp_path / "out", root)
    assert info["coins"] == 3 and info["perps"] == 3  # the delisted perp is left out
    out = tmp_path / "out" / "markets"
    crypto = json.loads((out / "crypto.json").read_text())
    assert crypto["coins"][0]["id"] == "bitcoin" and "bitcoin" in crypto["history"]
    btc = crypto["history"]["bitcoin"]
    assert len(btc["volumes"]) == len(btc["prices"]) and btc["volumes"][0][1] > 0
    assert crypto["sources"][0]["attribution"] == "Data provided by CoinGecko"
    perps = json.loads((out / "perps.json").read_text())
    assert perps["perps"][0]["coin"] == "BTC" and perps["perps"][0]["funding"]["hours"] == 48
    etfs = json.loads((out / "etfs.json").read_text())
    assert etfs["count"] >= 8 and {t["id"] for t in etfs["themes"]} >= {"crypto", "buffer"}
    disc = json.loads((out / "discover.json").read_text())
    assert disc["filings"][0]["filed"] >= disc["filings"][-1]["filed"]  # newest first
    withheld = export.build(tmp_path / "out2", root, include_ask=False)
    assert withheld["perps"] == 0
