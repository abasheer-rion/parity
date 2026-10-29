"""Tests for the automatic posts (DEC-0073). Standard library only, no network.

    python3 -m unittest discover -s scripts/autopost/tests -t .
"""
from __future__ import annotations

import datetime as dt
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("AUTOMATION_LOG", str(Path(tempfile.gettempdir()) / "autopost-test.jsonl"))

from scripts.autopost import checks, market_week, news_commentary, press_release  # noqa: E402
from scripts.autopost.__main__ import run_job  # noqa: E402
from scripts.autopost.common import Draft, model  # noqa: E402

TODAY = dt.date(2026, 10, 31)


def series(key, label, group, kind, unit, w1, z, last=100.0, licence="Public domain, US government data"):
    return {"key": key, "label": label, "short": key.split(".")[-1], "group": group, "kind": kind, "unit": unit,
            "freq": "D", "asof": "2026-10-30", "last": last, "chg": {"w1": w1}, "z": z, "licence": licence,
            "source": "FRED (Federal Reserve)"}


INDEX = {"series": [
    series("eq.WIL", "Wilshire 5000", "us_equities", "price", "index", -1.234, -1.1, 5123.4),
    series("bond.UST2Y", "US 2-year Treasury yield", "ust_curve", "level", "%", 0.12, 2.4, 3.91),
    series("bond.UST10Y", "US 10-year Treasury yield", "ust_curve", "level", "%", 0.05, 0.9, 4.25),
    series("usd.BROAD", "US dollar, broad index (Fed)", "fx_index", "price", "index", 0.4, 0.3, 121.5),
    series("fx.EUR", "Euro", "fx_g10", "price", "USD", -0.5, -0.6, 1.08),
    series("fx.JPY", "Japanese yen", "fx_g10", "price", "per USD", 1.1, 1.3, 151.2),
    series("cmd.WTI", "Oil, WTI", "commodities", "price", "USD per barrel", 6.2, 2.8, 79.3),
    series("cg.BTC", "Bitcoin", "crypto", "price", "USD", 3.3, 0.7, 68000.0, licence="Data provided by CoinGecko"),
    series("eq.SECRET", "Paid index", "us_equities", "price", "index", 9.0, 5.0, licence="All rights reserved"),
]}

IMPACT = {"assets": [{"key": "oil", "label": "Oil (WTI)", "unit": "%"}],
          "moves": {"oil": {"days": [
              {"event_date": "2026-10-28", "z_1d": 3.4, "move_1d": 5.678, "share_of_days_as_big": 0.0042,
               "items": [["Oil jumps after 2026 supply talks fail", "https://example.com/a", "Reuters"]]},
              {"event_date": "2026-09-01", "z_1d": 5.0, "move_1d": 9.0, "items": [["Old news", "https://example.com/old", "AP"]]},
          ]}}}

LOG = [("2026-10-30", "feat(web): a changelog page (#200)"), ("2026-10-30", "fix(web): a typo (#201)"),
       ("2026-10-29", "chore: tidy (#202)"), ("2026-10-28", "feat: status banner on every page (#203)")]


class TempNewsroom(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.content = self.tmp / "content/newsroom"
        (self.content / "posts").mkdir(parents=True)
        (self.content / "drafts").mkdir()
        shutil.copy(model.CONTENT / "authors.toml", self.content / "authors.toml")

    def tearDown(self):
        shutil.rmtree(self.tmp)


class FactChecks(unittest.TestCase):
    def draft(self, body, urls=()):
        return Draft(job="t", meta={"slug": "x", "date": TODAY}, body=body, truth=[1.23, 45.0], urls=set(urls))

    def test_numbers_from_the_data_pass(self):
        self.assertEqual(checks.facts(self.draft("It moved +1.23% to 45 on 2026-10-30.")), [])

    def test_a_wrong_number_fails(self):
        self.assertTrue(any("1.24" in p for p in checks.facts(self.draft("It moved 1.24%."))))

    def test_a_foreign_link_fails(self):
        probs = checks.facts(self.draft("See [this](https://evil.example/x).", urls=["https://ok.example/"]))
        self.assertTrue(any("evil.example" in p for p in probs))

    def test_headline_digits_are_not_ours(self):
        d = self.draft("- [Oil 2026 talks fail](https://ok.example/) moved 1.23")
        d.urls = {"https://ok.example/"}
        self.assertEqual(checks.facts(d), [])


class Jobs(TempNewsroom):
    def test_market_week_drops_unlicensed_series_and_passes_checks(self):
        d = market_week.build(INDEX, TODAY)
        self.assertNotIn("Paid index", d.body)
        self.assertIn("+12 bp", d.body)
        self.assertEqual(checks.facts(d), [])
        self.assertEqual(checks.newsroom(d, self.content), [])

    def test_news_commentary_cites_title_and_link_only(self):
        d = news_commentary.build(IMPACT, TODAY)
        self.assertIn("[Oil jumps after 2026 supply talks fail](https://example.com/a)", d.body)
        self.assertNotIn("Old news", d.body)
        self.assertIn("+5.68%", d.body)
        self.assertEqual(checks.facts(d), [])
        self.assertEqual(checks.newsroom(d, self.content), [])

    def test_press_release_lists_features_only(self):
        d = press_release.build(LOG, [], TODAY, TODAY - dt.timedelta(days=7))
        self.assertIn("#200", d.body)
        self.assertIn("#203", d.body)
        self.assertNotIn("#201", d.body)
        self.assertEqual(checks.facts(d), [])
        self.assertEqual(checks.newsroom(d, self.content), [])

    def test_nothing_shipped_means_no_post(self):
        self.assertIsNone(press_release.build(LOG[1:3], [], TODAY, TODAY))


class Caps(TempNewsroom):
    def add(self, job, day, n):
        for i in range(n):
            (self.content / "posts" / f"{day}-{job}-{i}.md").write_text(
                f'+++\ntitle = "t"\nslug = "{job}-{i}"\ndate = {day}\ntype = "News"\nstance = "Fact-based reporting"\n'
                f'status = "published"\nauthors = ["parity-markets-desk"]\nauto = "{job}"\n+++\nbody\n')

    def test_per_job_cap(self):
        self.add("news_commentary", TODAY, 2)
        self.assertTrue(checks.caps("news_commentary", TODAY, self.content))
        self.assertFalse(checks.caps("press_release", TODAY, self.content))

    def test_the_fifth_post_in_a_week_is_blocked(self):
        self.add("market_week", TODAY, 1)
        self.add("news_commentary", TODAY, 2)
        self.add("press_release", TODAY, 1)
        self.assertTrue(any("automatic posts" in p for p in checks.caps("press_release", TODAY + dt.timedelta(days=1), self.content)))


class KillSwitch(TempNewsroom):
    def test_switch_off_skips(self):
        os.environ["SEO_AUTOMATION"] = "press_release"
        try:
            self.assertEqual(run_job("press_release", self.tmp, TODAY, dry=True, content=self.content), "skipped")
        finally:
            del os.environ["SEO_AUTOMATION"]


if __name__ == "__main__":
    unittest.main()
