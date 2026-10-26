"""The competitor feedback collector: robots.txt, parsing, signals, the store and a pass,
all without touching the network."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest

from parity.profiles import collect, net, signals, sources, store

APPLE_ROBOTS = """
User-agent: *
Disallow: /WebObjects/*
Allow: /WebObjects/MZStore.woa/wa/viewMultiRoom?*
Disallow: /search*
Disallow: /*/rss/*
Disallow: /*/lookup?

User-agent: Googlebot
Disallow: /*/album/*/*?i=*
"""


def test_robots_wildcards_follow_the_crawler_rules():
    rules = net.parse_robots(APPLE_ROBOTS, "parity-research")
    assert not net.robots_allows(rules, "/us/rss/customerreviews/page=1/id=1/json")
    assert not net.robots_allows(rules, "/search?term=x")
    assert net.robots_allows(rules, "/lookup?id=1,2&country=us")
    assert not net.robots_allows(rules, "/us/lookup?id=1")
    assert net.robots_allows(rules, "/WebObjects/MZStore.woa/wa/viewMultiRoom?cc=us")
    assert not net.robots_allows(rules, "/WebObjects/other")


def test_robots_named_group_and_end_anchor():
    text = "User-agent: *\nDisallow: /\n\nUser-agent: parity-research\nDisallow: /private$\n"
    rules = net.parse_robots(text, "parity-research")
    assert net.robots_allows(rules, "/history.atom")
    assert not net.robots_allows(rules, "/private")
    assert net.robots_allows(rules, "/private/x")
    assert not net.robots_allows(net.parse_robots(text, "otherbot"), "/history.atom")


def test_crawl_delay_is_read_for_star_or_our_agent():
    text = "User-agent: *\nCrawl-delay: 10\nDisallow: /wp-admin/\n"
    assert net.crawl_delay(text, "parity-research") == 10.0
    assert net.crawl_delay("User-agent: Googlebot\nCrawl-delay: 5\n", "parity-research") == 0.0


def test_sentiment_uses_rating_then_words_with_negation():
    assert signals.sentiment("anything", 1)[1] == "negative"
    assert signals.sentiment("anything", 5)[1] == "positive"
    assert signals.sentiment("Great charts, fast and clean")[1] == "positive"
    assert signals.sentiment("The app crashes and support is useless")[1] == "negative"
    assert signals.sentiment("not good at all")[1] == "negative"
    assert signals.sentiment("I opened an account today")[1] == "neutral"


def test_themes_match_whole_words():
    t = signals.themes("Love the charts but withdrawals take a week and the UI is cluttered")
    assert {"charting", "funds", "design"} <= set(t)
    assert "automation" not in signals.themes("rapid growth")  # 'api' inside a word


def test_parse_hn_keeps_only_items_whose_own_text_names_the_product():
    doc = {"hits": [
        {"objectID": "1", "comment_text": "TradingView charts are great", "created_at":
         "2026-10-01T00:00:00Z", "story_title": "x"},
        {"objectID": "2", "comment_text": "unrelated", "story_title": "TradingView launch",
         "created_at": "2026-10-01T00:00:00Z"},
    ]}
    items = sources.parse_hn(doc, "tradingview", ["TradingView"])
    assert [i["url"] for i in items] == ["https://news.ycombinator.com/item?id=1"]
    assert items[0]["published_at"] == "2026-10-01T00:00:00+00:00"


def test_parse_appstore_reviews_and_lookup():
    doc = {"feed": {"entry": [{"id": {"label": "9"}, "title": {"label": "Bad"},
                               "content": {"label": "Crashes"}, "im:rating": {"label": "1"},
                               "updated": {"label": "2026-10-23T13:10:51-07:00"}}]}}
    items = sources.parse_appstore_reviews(doc, "tradingview", 1205990992)
    assert items[0]["rating"] == 1 and items[0]["published_at"] == "2026-10-23T20:10:51+00:00"
    got = sources.parse_appstore_lookup({"results": [
        {"trackId": 5, "averageUserRating": 4.5, "userRatingCount": 10}]})
    assert got[5]["rating"] == 4.5 and got[5]["count"] == 10


def test_parse_github_drops_pull_requests():
    rows = [{"number": 1, "title": "Chart freezes", "body": "x", "labels": [{"name": "bug"}],
             "created_at": "2026-10-01T00:00:00Z", "html_url": "u1"},
            {"number": 2, "title": "PR", "pull_request": {}, "created_at": "2026-10-01T00:00:00Z"}]
    items = sources.parse_github_issues(rows, "tradingview", "tradingview/lightweight-charts")
    assert len(items) == 1 and "bug" in items[0]["text"]


def test_parse_feed_reads_atom_and_rss_with_leading_space():
    atom = b"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><id>tag:x,2005:Incident/1</id><title>Delayed deposits</title>
      <updated>2026-10-24T16:03:59-07:00</updated><link href="https://s/1"/>
      <content>Resolved</content></entry></feed>"""
    rss = b"""\n\n<?xml version="1.0"?><rss><channel><item><title>v5 build 5000</title>
      <link>https://r/1</link><pubDate>Fri, 24 Oct 2026 10:00:00 GMT</pubDate></item>
      </channel></rss>"""
    a = sources.parse_feed(atom, "kraken", "status", "incident")
    r = sources.parse_feed(rss, "metatrader", "changelog", "release")
    assert a[0]["title"] == "Delayed deposits" and a[0]["kind"] == "incident"
    assert r[0]["published_at"] == "2026-10-24T10:00:00+00:00"


def test_store_dedupes_and_blanks_old_text(tmp_path):
    con = store.connect(tmp_path / "p.db")
    old = (datetime.now(UTC) - timedelta(days=store.RETAIN_TEXT_DAYS + 5)).isoformat()
    it = sources._item("tradingview", "hn", "1", "feedback", None, "t", "great charts", old)
    assert store.merge(con, [it]) == 1
    assert store.merge(con, [it]) == 0
    assert store.prune(con)["blanked"] == 1
    assert con.execute("SELECT text, sentiment FROM items").fetchone() == (None, "positive")


class FakeSession(net.Session):
    """Answers from a dict of URL prefixes; robots.txt allows everything but Apple's RSS."""

    def __init__(self, answers):
        super().__init__(min_gap=0)
        self.answers = answers

    def allowed(self, url):
        return "/rss/" not in url

    def get(self, url, *, params=None, headers=None, check_robots=True):
        if check_robots and not self.allowed(url):
            raise net.Blocked("robots.txt disallows it")
        self.requests += 1
        for prefix, body in self.answers.items():
            if url.startswith(prefix):
                return _Resp(body)
        raise RuntimeError(f"no fake answer for {url}")


class _Resp:
    def __init__(self, body):
        self.body = body
        self.headers = {"X-RateLimit-Remaining": "50"}

    def json(self):
        return self.body

    @property
    def content(self):
        return self.body if isinstance(self.body, bytes) else json.dumps(self.body).encode()


def test_a_pass_records_every_source_and_the_summary_has_counts_only(tmp_path, monkeypatch):
    monkeypatch.delenv("REDDIT_CLIENT_ID", raising=False)
    monkeypatch.setattr(collect, "products", lambda only=None: [
        {"id": "tradingview", "name": "TradingView", "doc": "CMP-0006", "group": "broker",
         "queries": ["TradingView"], "appstore": [1205990992], "github": [], "status": None}])
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    fake = FakeSession({
        "https://itunes.apple.com/lookup": {"results": [
            {"trackId": 1205990992, "averageUserRating": 4.8, "userRatingCount": 420000}]},
        "https://hn.algolia.com/": {"nbPages": 1, "hits": [
            {"objectID": "7", "comment_text": "TradingView charts are fast and great",
             "created_at": now, "created_at_i": 1}]},
        "https://api.stackexchange.com/": {"items": [], "quota_remaining": 290},
    })
    con = store.connect(tmp_path / "p.db")
    out = collect.run_pass(con, session=fake)
    st = {k: v["status"] for k, v in out["sources"].items()}
    assert st["appstore-reviews"] == "skipped" and st["googleplay"] == "off"
    assert st["reddit"] == "needs key" and st["hn"] == "ok" and st["appstore-ratings"] == "ok"
    assert out["added"] == 1
    doc = collect.summary(con)
    tv = doc["products"]["tradingview"]
    assert tv["feedback"] == 1 and tv["positive"] == 1
    assert tv["praised"][0]["theme"] in ("charting", "speed")
    assert tv["apps"][0]["rating"] == 4.8
    assert "text" not in json.dumps(doc["products"])  # no review text leaves the machine
    assert collect.due(con, hours=20) is False


def test_registry_products_each_have_a_doc_and_queries():
    ps = collect.registry()["products"]
    assert len({p["id"] for p in ps}) == len(ps)
    for p in ps:
        assert p["doc"].startswith("CMP-") and p["queries"]
        assert p["group"] in collect.registry()["groups"]


@pytest.mark.parametrize("src", sources.SOURCES, ids=lambda s: s.id)
def test_every_source_declares_its_terms(src):
    assert src.terms and src.terms_url.startswith("https://")
    assert src.off or src.id in sources.FETCHERS or src.id == "appstore-ratings"
