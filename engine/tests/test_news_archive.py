"""News archive, backfill parsers and the impact engine. No network: saved fixtures and
made-up prices only."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from parity.news import archive, backfill, export, study, tagging
from parity.news.schema import Article

FIX = Path(__file__).parent / "fixtures" / "news"


# ------------------------------------------------------------------ backfill parsers


def test_fed_archive_json_parses_eastern_times_to_utc():
    arts = backfill.parse_fed((FIX / "fed-press-archive.json").read_bytes())
    assert len(arts) == 9  # the trailing {"updateDate": ...} row is skipped
    a = arts[0]
    assert a.source == "fed" and a.url.startswith("https://www.federalreserve.gov/newsevents/")
    assert a.published_at.tzinfo is not None
    assert "&#39;" not in "".join(x.title for x in arts)  # entities decoded
    # 2:00 PM in Washington is 19:00 UTC in winter
    jan = [x for x in arts if x.title.startswith("Minutes of the Federal Open Market Committee, "
                                                 "December 15-16, 2015")]
    assert jan and jan[0].published_at.hour == 19


def test_ecb_year_page_parses_dates_titles_and_links():
    arts = backfill.parse_ecb_year((FIX / "ecb-press-2015.html").read_text())
    assert len(arts) == 4
    assert all(a.source == "ecb" and a.url.startswith("https://www.ecb.europa.eu/")
               for a in arts)
    assert arts[1].title == "Monetary policy decisions"
    assert arts[0].published_at.date().isoformat() == "2015-12-07"
    assert "EUR" in arts[0].currencies


def test_boj_year_page_parses_odd_month_names_and_strips_pdf_note():
    arts = backfill.parse_boj_year((FIX / "boj-mpm-2016.html").read_text())
    assert len(arts) == 10
    sept = [a for a in arts if "Yield Curve Control" in a.title][0]
    assert sept.published_at.date().isoformat() == "2016-09-21"  # "Sept." is September
    assert "[PDF" not in sept.title and sept.url.endswith(".pdf")
    neg = [a for a in arts if "Negative Interest Rate" in a.title][0]
    assert "rate-cut" in tagging.topics(neg.title)


def test_event_catalog_becomes_archive_items():
    arts = backfill.parse_events()
    assert len(arts) >= 70
    abq = [a for a in arts if "Abqaiq" in a.title][0]
    assert abq.source == "events" and "oil" in abq.commodities
    assert abq.published_at.date().isoformat() == "2019-09-14"


def test_sec_8k_items_become_headlines():
    payload = {"name": "SVB FINANCIAL GROUP", "filings": {"recent": {
        "form": ["8-K", "10-Q", "8-K"], "items": ["8.01,9.01", "", "7.01,9.01"],
        "accessionNumber": ["0000719739-23-000010", "x", "0000719739-23-000005"],
        "filingDate": ["2023-03-08", "2023-02-01", "2023-01-19"],
        "acceptanceDateTime": ["2023-03-08T16:25:31.000Z", "", "2023-01-19T21:05:00.000Z"],
        "primaryDocument": ["sivb-20230308.htm", "q.htm", "sivb-20230119.htm"]}}}
    arts = backfill.parse_sec_8k(payload, 719739)
    assert len(arts) == 2
    assert arts[0].title == "SVB Financial 8-K: item 8.01 other events"  # 9.01 dropped
    assert "item 7.01 Regulation FD disclosure" in arts[1].title  # only routine: keep all
    assert arts[0].tickers == ["SIVB"] and "/719739/000071973923000010/" in arts[0].url


def test_backfill_sources_never_run_in_the_hourly_fetch():
    from parity.news import sources
    for sid in ("events", "sec8k"):
        with pytest.raises(sources.Skipped):
            sources.fetch(sources.BY_ID[sid])


# ------------------------------------------------------------------ topics and archive


@pytest.mark.parametrize("text,topic", [
    ("OPEC+ agrees surprise output cut", "opec"),
    ("Federal Reserve raises interest rates by half a point", "rate-hike"),
    ("Fed announces emergency cut to interest rates", "rate-cut"),
    ("Russia invades Ukraine", "war"),
    ("Consumer prices rise faster than expected", "inflation"),
    ("Silicon Valley Bank collapse triggers bank run fears", "bank-failure"),
])
def test_topics(text, topic):
    assert topic in tagging.topics(text)


def test_topics_do_not_fire_on_unrelated_text():
    assert tagging.topics("Board announces approval of a merger application") == []


def _art(day: str, title: str, source: str = "fed", hour: int = 15) -> Article:
    return Article(source=source, published_at=pd.Timestamp(f"{day} {hour}:00", tz="UTC"),
                   title=title, url=f"https://example.gov/{day}/{abs(hash(title))}",
                   category="central-bank", currencies=["USD"])


def test_archive_shards_by_year_dedupes_and_searches(tmp_path):
    arts = [_art("2015-03-04", "Fed raises rates"), _art("2016-07-01", "OPEC agrees cut"),
            _art("2016-07-02", "Unrelated board notice")]
    assert archive.add(arts, tmp_path) == 3
    assert archive.add(arts[:1], tmp_path) == 0  # same id twice is kept once
    assert archive.years(tmp_path) == [2015, 2016]
    assert (tmp_path / "news" / "archive" / "2016.parquet").exists()
    hits = archive.search(topic="OPEC", root=tmp_path)
    assert list(hits["title"]) == ["OPEC agrees cut"]
    assert "cmd.BRENT" in hits.iloc[0]["assets"]  # from the topic, not only the tags
    assert len(archive.search(start="2016", end="2016", root=tmp_path)) == 2
    assert len(archive.search(text="raises", start="2015", end="2015", root=tmp_path)) == 1
    assert archive.search(text='"agrees cut"', root=tmp_path)["title"].tolist() == \
        ["OPEC agrees cut"]
    assert archive.search(asset="usd.BASKET", root=tmp_path).shape[0] == 3


def test_store_merge_also_archives(tmp_path):
    from parity.news import store
    store.merge([_art("2020-01-02", "Fed statement")], tmp_path)
    assert archive.years(tmp_path) == [2020]


# ------------------------------------------------------------------ impact engine


def _series(n: int = 1500, seed: int = 1, jumps: dict[int, float] | None = None) -> pd.Series:
    rng = np.random.default_rng(seed)
    r = rng.normal(0, 0.01, n)
    for i, j in (jumps or {}).items():
        r[i] += j
    idx = pd.bdate_range("2010-01-01", periods=n)
    return pd.Series(100 * np.exp(np.cumsum(r)), index=idx)


def _items(dates, title="OPEC agrees cut") -> pd.DataFrame:
    rows = [_art(d.date().isoformat(), title, hour=12) for d in dates]
    df = archive.enrich(pd.DataFrame([a.row() for a in rows]))
    df["published_at"] = pd.to_datetime(df["published_at"], utc=True)
    return df


def test_base_is_last_close_before_and_after_close_counts_next_day():
    p = study.prepare("cmd.BRENT", _series())
    d = p.dates[400]
    noon = study.base_positions(p, [pd.Timestamp(f"{d.date()} 16:00", tz="UTC")])  # noon NY
    late = study.base_positions(p, [pd.Timestamp(f"{d.date()} 22:00", tz="UTC")])  # 6pm NY
    assert noon[0] == 399 and late[0] == 400


def test_volatility_uses_no_future_data():
    s = _series()
    p1 = study.prepare("cmd.BRENT", s)
    s2 = s.copy()
    s2.iloc[901:] *= np.linspace(1, 3, len(s2) - 901)  # wild future
    p2 = study.prepare("cmd.BRENT", s2)
    assert p1.sigma[900] == pytest.approx(p2.sigma[900])


def test_event_study_finds_a_planted_effect_and_beats_random_days():
    pos = list(range(300, 1400, 37))  # 30 events, 37 days apart: no overlap
    jumps = {i: 0.03 for i in pos}  # +3% on each event day, 3 normal moves
    s = _series(jumps=jumps)
    p = study.prepare("cmd.BRENT", s)
    items = _items([s.index[i] for i in pos])
    res = study.event_study("cmd.BRENT", items, p=p, draws=200)
    assert res["n_events"] == 30 and res["n_overlapping"] == 0
    h = res["horizons"]["1d"]
    assert h["mean_z"] > 2 and h["hit_rate"] > 0.9 and h["p_random"] < 0.01
    assert abs(h["random_mean_z"]) < 0.5
    assert res["path"]["k"][0] == -study.PRE and len(res["path"]["mean_z"]) == \
        study.PRE + study.POST + 1
    assert res["path"]["mean_z"][study.PRE] == 0  # day 0 is the base
    assert any("not a prediction" in w for w in res["warnings"])


def test_no_effect_gives_no_evidence_and_few_events_warn():
    s = _series(seed=3)
    p = study.prepare("cmd.BRENT", s)
    items = _items([s.index[i] for i in range(300, 1400, 100)])  # 11 events
    res = study.event_study("cmd.BRENT", items, p=p, draws=200)
    assert res["horizons"]["5d"]["p_random"] > 0.05
    assert any("Too few" in w for w in res["warnings"])


def test_overlapping_events_are_marked():
    s = _series()
    p = study.prepare("cmd.BRENT", s)
    items = _items([s.index[i] for i in (400, 405, 410, 600)])
    res = study.event_study("cmd.BRENT", items, p=p, draws=100)
    assert res["n_overlapping"] == 2 and res["n_non_overlapping"] == 2
    assert any("overlap" in w for w in res["warnings"])


def test_same_day_headlines_are_one_event():
    s = _series()
    p = study.prepare("cmd.BRENT", s)
    d = s.index[500]
    items = pd.concat([_items([d], "OPEC agrees cut"), _items([d], "OPEC cut: details")])
    res = study.event_study("cmd.BRENT", items, p=p, draws=100)
    assert res["n_headlines"] == 2 and res["n_events"] == 1


def test_bh_q_values():
    q = study.bh([0.01, 0.04, 0.03, 0.5, np.nan])
    assert np.isnan(q[4])
    assert q[0] == pytest.approx(0.04) and q[3] == pytest.approx(0.5)
    assert q[1] == pytest.approx(0.04 * 4 / 3, rel=1e-6) or q[1] <= 0.0534


def test_top_moves_ranks_days_and_warns_about_chance():
    jumps = {800: 0.08}
    s = _series(jumps=jumps)
    p = study.prepare("cmd.BRENT", s)
    items = _items([s.index[i] for i in (300, 500, 800, 1000)])
    res = study.top_moves("cmd.BRENT", items, p=p)
    assert res["days"][0]["base_date"] == s.index[799].date().isoformat()
    assert res["days"][0]["z_1d"] > 4
    assert any("by chance" in w for w in res["warnings"])


def test_rankings_report_q_and_put_evidence_first(tmp_path):
    pos = list(range(300, 1400, 37))
    s_hit = _series(jumps={i: 0.03 for i in pos})
    s_flat = _series(seed=9)
    items = _items([s_hit.index[i] for i in pos])
    prepared = {"cmd.BRENT": study.prepare("cmd.BRENT", s_hit),
                "cmd.WTI": study.prepare("cmd.WTI", s_flat)}
    res = study.rank_assets("OPEC", items, assets=list(prepared), horizon="1d",
                            prepared=prepared, draws=200)
    assert res["rows"][0]["asset"] == "cmd.BRENT" and res["rows"][0]["q"] < 0.05
    assert res["tried"] == 2 and any("Benjamini" in w for w in res["warnings"])


def test_export_writes_archive_and_impact_without_personal_sources(tmp_path, monkeypatch):
    pos = list(range(300, 1400, 37))
    s = _series(jumps={i: 0.03 for i in pos})
    archive.add([_art(s.index[i].date().isoformat(), "OPEC agrees cut", hour=12) for i in pos]
                + [_art("2014-05-05", "Personal feed item", source="finnhub")], tmp_path)
    monkeypatch.setattr(study, "load_series", lambda key, root=None: s)
    out = tmp_path / "site"
    export.build_archive(out, tmp_path, "now")
    idx = json.loads((out / "archive" / "index.json").read_text())
    assert idx["total"] == len(pos)  # the finnhub row is not shown
    n = export.build_impact(out, tmp_path, "now", assets=["cmd.BRENT"], topics=["opec", "war"],
                            draws=100)
    doc = json.loads((out / "impact.json").read_text())
    assert n == 2 and doc["studies"]["opec"]["cmd.BRENT"]["n_events"] == len(pos)
    assert doc["by_topic"]["opec"]["rows"][0]["asset"] == "cmd.BRENT"
    assert doc["moves"]["cmd.BRENT"]["days"]
