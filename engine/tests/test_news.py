"""News: parsing saved responses, tagging, storage and market impact. No network."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from parity.news import export, history, impact, sources, store
from parity.news.schema import SUMMARY_MAX, Article, short_summary
from parity.news.tagging import tag

FIX = Path(__file__).parent / "fixtures" / "news"


def _src(i):
    return sources.BY_ID[i]


# ------------------------------------------------------------------ parsing


@pytest.mark.parametrize("name", ["fed", "ecb", "boj"])
def test_rss_fixtures_parse_to_utc_articles(name):
    arts = sources.parse_rss((FIX / f"{name}.xml").read_bytes(), _src(name))
    assert len(arts) == 2
    for a in arts:
        assert a.title and a.url.startswith("http")
        assert a.published_at.tzinfo is not None and a.published_at.utcoffset().total_seconds() == 0
        assert a.source == name and len(a.id) == 16
        assert len(a.summary) <= SUMMARY_MAX + 3


def test_fed_feed_starts_with_a_byte_order_mark_and_still_parses():
    raw = (FIX / "fed.xml").read_bytes()
    assert raw.startswith(b"\xef\xbb\xbf")
    assert sources.parse_rss(raw, _src("fed"))[0].currencies[0] == "USD"


def test_source_tags_are_added():
    a = sources.parse_rss((FIX / "ecb.xml").read_bytes(), _src("ecb"))[0]
    assert "EUR" in a.currencies and "Euro area" in a.regions


def test_gdelt_keeps_headline_and_link_only_and_drops_bad_rows():
    arts = sources.parse_gdelt(json.loads((FIX / "gdelt.json").read_text()), _src("gdelt"))
    assert len(arts) == 2
    assert all(a.summary == "" for a in arts)
    assert arts[0].publisher == "example.com"
    assert str(arts[0].published_at) == "2026-10-21 18:15:00+00:00"
    kept = sources.relevant(arts)
    assert [a.title for a in kept] == ["Oil Flat on Mideast Developments"]


def test_keyed_apis_store_no_summary_and_are_not_shown_on_the_site():
    av = sources.parse_alphavantage(json.loads((FIX / "alphavantage.json").read_text()),
                                    _src("alphavantage"))
    fh = sources.parse_finnhub(json.loads((FIX / "finnhub.json").read_text()), _src("finnhub"))
    mx = sources.parse_marketaux(json.loads((FIX / "marketaux.json").read_text()),
                                 _src("marketaux"))
    assert av and fh and mx
    assert all(a.summary == "" for a in av + fh + mx)
    assert "JPY" in fh[0].currencies and "EUR" in mx[0].currencies
    for s in ("alphavantage", "finnhub", "marketaux"):
        assert _src(s).display == "no"


def test_missing_key_skips_without_network(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    with pytest.raises(sources.Skipped):
        sources.fetch(_src("finnhub"))


def test_contact_sources_skip_without_contact_and_ua_stays_honest(monkeypatch):
    monkeypatch.delenv("PARITY_CONTACT", raising=False)
    with pytest.raises(sources.Skipped):
        sources.fetch(_src("sec"))
    monkeypatch.setenv("PARITY_CONTACT", "team@example.com")
    ua = sources.user_agent(_src("sec"))
    assert ua.startswith("parity-research/0.1") and "team@example.com" in ua
    assert "Mozilla" not in ua
    assert "example.com" not in sources.user_agent(_src("ecb"))


def test_no_forbidden_sources():
    hosts = " ".join(s.url for s in sources.SOURCES)
    for banned in ("robinhood", "wsj.com", "dowjones", "bloomberg", "yahoo"):
        assert banned not in hosts


# ------------------------------------------------------------------ schema and tags


def test_summary_is_short_and_html_free():
    text = "<p>" + "word " * 200 + "</p>"
    s = short_summary(text)
    assert len(s) <= SUMMARY_MAX + 3 and s.endswith("...") and "<" not in s


def test_tagging_examples():
    t = tag("Canadian dollar slips as crude drops; Bank of Canada holds rates")
    assert t["currencies"] == ["CAD"] and t["commodities"] == ["oil"]
    assert t["category"] == "central-bank"
    assert tag("let us talk")["regions"] == []  # lower case "us" is not the US
    assert tag("SEC charges adviser")["category"] == "regulation"
    assert tag("Yen falls")["currencies"] == ["JPY"]


def test_store_merge_dedupes(tmp_path):
    a = Article("fed", pd.Timestamp("2026-10-20 18:00", tz="UTC"), "A", "https://x/a")
    b = Article("fed", pd.Timestamp("2026-10-21 18:00", tz="UTC"), "B", "https://x/b")
    df, added = store.merge([a], tmp_path)
    df, added = store.merge([a, b], tmp_path)
    assert added == 1 and len(df) == 2 and df.iloc[0]["title"] == "B"
    assert store.load(tmp_path).iloc[0]["currencies"] == []


# ------------------------------------------------------------------ impact


@pytest.fixture
def prices() -> pd.DataFrame:
    rng = np.random.default_rng(3)
    idx = pd.bdate_range("2015-01-01", "2016-12-30")
    n = len(idx)
    eq = 100 * np.exp(np.cumsum(rng.normal(0, 0.01, n)))
    jump = idx.get_loc(pd.Timestamp("2016-06-24"))
    eq[jump:] *= 0.95  # a 5 percent drop on 24 June 2016
    df = pd.DataFrame({"eq.US_TOTAL": eq,
                       "bond.UST10Y": 2 + np.cumsum(rng.normal(0, 0.05, n)),
                       "cmd.WTI": 50 * np.exp(np.cumsum(rng.normal(0, 0.02, n)))}, index=idx)
    for c in impact.G10:
        df[f"fx.{c}"] = np.exp(np.cumsum(rng.normal(0, 0.005, n)))
    return impact.add_usd_basket(df)


def test_event_day_uses_the_us_close():
    idx = pd.bdate_range("2016-06-20", "2016-06-30")
    before = impact.event_day(idx, pd.Timestamp("2016-06-23 15:00", tz="America/New_York"))
    after = impact.event_day(idx, pd.Timestamp("2016-06-23 17:00", tz="America/New_York"))
    weekend = impact.event_day(idx, pd.Timestamp("2016-06-25 12:00", tz="UTC"))
    assert idx[before] == pd.Timestamp("2016-06-23")
    assert idx[after] == pd.Timestamp("2016-06-24")
    assert idx[weekend] == pd.Timestamp("2016-06-27")


def test_measure_finds_the_jump_and_scores_it(prices):
    m = impact.measure(prices, "eq.US_TOTAL", pd.Timestamp("2016-06-23 22:00", tz="UTC"))
    assert m["base_date"] == "2016-06-23"
    assert m["1d"]["move"] < -3 and m["1d"]["z"] < -3
    assert m["1h"] is None  # no intraday data
    assert set(m) >= {"1d", "1w", "1m"}


def test_volatility_uses_only_data_before_the_event(prices):
    when = pd.Timestamp("2016-06-23 22:00", tz="UTC")
    a = impact.measure(prices, "eq.US_TOTAL", when)["sigma_daily"]
    later = prices.copy()
    later.loc["2016-07-01":, "eq.US_TOTAL"] *= np.linspace(1, 3, len(later.loc["2016-07-01":]))
    assert impact.measure(later, "eq.US_TOTAL", when)["sigma_daily"] == a


def test_rates_move_in_points_and_future_horizons_are_empty(prices):
    m = impact.measure(prices, "bond.UST10Y", pd.Timestamp("2016-12-29 12:00", tz="UTC"))
    assert m["unit"] == "pp" and m["1m"] is None


def test_negative_prices_have_no_percent_move():
    assert np.isnan(impact.change(18.27, -37.63, "pct"))
    assert impact.change(2.0, 2.25, "pp") == 0.25


def test_targets_follow_tags():
    assert impact.targets_for(["USD", "JPY"], ["oil"], "central-bank") == [
        "usd.BASKET", "fx.JPY", "cmd.WTI", "bond.UST10Y", "eq.US_TOTAL"]
    assert impact.targets_for([], ["gold"]) == ["eq.US_TOTAL"]  # no free daily gold series


def test_records_are_biggest_first(prices):
    r = impact.records(prices, "eq.US_TOTAL", since="2015-06-01", n=5)
    assert r.iloc[0]["date"] == pd.Timestamp("2016-06-24") and list(r["rank"]) == [1, 2, 3, 4, 5]
    assert r["move"].abs().is_monotonic_decreasing


def test_explain_says_when_no_source_covers_a_day(prices):
    recs = impact.records(prices, "eq.US_TOTAL", since="2015-06-01", n=1)
    out = history.explain(recs, store.load(Path("/nonexistent")), pd.DataFrame())
    assert out[0]["news"] == [] and "allowed" in out[0]["note"]


def test_gdelt_lookups_stop_when_told_to_slow_down(tmp_path):
    recs = pd.DataFrame({"date": pd.to_datetime(["2020-03-16", "2020-03-12", "2008-10-13"]),
                         "series": "eq.US_TOTAL", "move": [-12, -9, 11], "z": [-8, -8, 6],
                         "unit": "pct", "rank": [1, 2, 3]})
    calls = []

    def fake(day, query, n):
        calls.append(day)
        if len(calls) == 2:
            raise RuntimeError("gdelt: HTTP 429, skipped")
        return [Article("gdelt", pd.Timestamp(day, tz="UTC"), "Stocks plunge", "https://e/x")]

    n = history.explain_with_gdelt(recs, tmp_path, fetch=fake, pause=0, log=lambda *_: None)
    assert n == 1 and calls == ["2020-03-16", "2020-03-12"]  # 2008 is before GDELT's search
    ex = history.load_explanations(tmp_path)
    assert list(ex["title"]) == ["Stocks plunge"]


def test_export_writes_site_json_without_personal_use_sources(tmp_path, prices):
    arts = [Article("fed", pd.Timestamp("2016-06-23 20:00", tz="UTC"), "FOMC statement",
                    "https://x/fomc", currencies=["USD"], category="central-bank"),
            Article("finnhub", pd.Timestamp("2016-06-23 20:00", tz="UTC"), "Licensed item",
                    "https://x/f")]
    store.merge(arts, tmp_path)
    info = export.build(tmp_path / "out", tmp_path, panel=prices)
    doc = json.loads((tmp_path / "out" / "news" / "articles.json").read_text())
    assert info["articles"] == 1 and doc["articles"][0]["source"] == "fed"
    a = doc["articles"][0]
    assert a["primary"] == "usd.BASKET" and a["impacts"]["eq.US_TOTAL"]["1d"]["move"] < -3
    assert a["path"] and a["path"][0][0] < "2016-06-23"
    recs = json.loads((tmp_path / "out" / "news" / "records.json").read_text())
    assert recs["records"] and recs["series"]


def test_a_missing_price_is_pending_not_a_zero_move(prices):
    p = prices.copy()
    p.loc["2016-12-30", "fx.EUR"] = np.nan  # FX published later than stocks
    when = pd.Timestamp("2016-12-29 22:00", tz="UTC")  # after the US close
    m = impact.measure(p, "fx.EUR", when)
    assert m["base_date"] == "2016-12-29" and m["1d"] is None
    assert impact.measure(p, "eq.US_TOTAL", when)["1d"]["end_date"] == "2016-12-30"
