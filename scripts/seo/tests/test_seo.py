"""Tests for the SEO scripts (DEC-0073).

    python3 -m unittest discover -s scripts/seo/tests
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import automation  # noqa: E402
import build_public as bp  # noqa: E402
import keywords  # noqa: E402
import meta_check  # noqa: E402
import search_console  # noqa: E402


class Titles(unittest.TestCase):
    def test_short_title_gets_the_brand(self):
        self.assertEqual(bp.seo_title("Carry trade"), "Carry trade | Parity")
        self.assertEqual(bp.seo_title("Front page words", "/"), "Front page words")

    def test_long_titles_fit_and_never_cut_a_word(self):
        long = "Time series momentum across futures markets (Moskowitz, Ooi and Pedersen 2012): how it works and the evidence"
        t = bp.seo_title(long)
        self.assertLessEqual(len(t), bp.TITLE_MAX)
        self.assertTrue(long.startswith(t.replace(" | Parity", "")) or t.endswith(" | Parity"))
        words = "word " * 30
        cut = bp.seo_title(words.strip())
        self.assertLessEqual(len(cut), bp.TITLE_MAX)
        self.assertTrue(cut.endswith("word"))

    def test_short_description_is_padded(self):
        d = bp.seo_description("A short line.", "learn")
        self.assertGreaterEqual(len(d), bp.DESC_MIN)
        self.assertIn("glossary", d)
        full = "x" * 80
        self.assertEqual(bp.seo_description(full, "learn"), full)
        self.assertGreaterEqual(len(bp.seo_description("", "other")), bp.DESC_MIN)


class Sitemaps(unittest.TestCase):
    def test_one_sitemap_per_section_and_an_index(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            urls = [("/", ""), ("/learn/", ""), ("/learn/beta/", "2026-10-01"), ("/blog/a/", "2026-10-20"),
                    ("/changelog/", "2026-10-26"), ("/status/", ""), ("/legal/", "")]
            paths = bp.write_sitemaps(out, urls)
            self.assertEqual(paths, ["/sitemaps/blog.xml", "/sitemaps/learn.xml", "/sitemaps/pages.xml", "/sitemaps/updates.xml"])
            index = (out / "sitemap.xml").read_text()
            self.assertIn("<sitemapindex", index)
            self.assertIn(f"<loc>{bp.SITE}/sitemaps/learn.xml</loc><lastmod>2026-10-01</lastmod>", index)
            updates = (out / "sitemaps/updates.xml").read_text()
            self.assertIn(f"{bp.SITE}/changelog/", updates)
            self.assertIn(f"{bp.SITE}/status/", updates)

    def test_robots_allows_public_and_names_the_sitemap(self):
        r = bp.robots_txt()
        self.assertIn("User-agent: *", r)
        self.assertIn("Disallow: /app/", r)
        self.assertIn(f"Sitemap: {bp.SITE}/sitemap.xml", r)
        self.assertNotIn("Disallow: /changelog/", r)


def fixture_site(root: Path, pages: dict[str, tuple[str, str]], origin: str = "https://example.test") -> None:
    rows = "".join(f"<url><loc>{origin}{p}</loc></url>" for p in pages)
    (root / "sitemaps").mkdir()
    (root / "sitemaps/pages.xml").write_text(f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{rows}</urlset>')
    (root / "sitemap.xml").write_text(f'<sitemapindex><sitemap><loc>{origin}/sitemaps/pages.xml</loc></sitemap></sitemapindex>')
    for path, (title, desc) in pages.items():
        f = root / "index.html" if path == "/" else root / path.strip("/") / "index.html"
        f.parent.mkdir(parents=True, exist_ok=True)
        ld = json.dumps({"@context": "https://schema.org", "@type": "WebPage", "name": title})
        links = "".join(f'<a href="{p}">x</a>' for p in pages if p != path)
        f.write_text(f'<html><head><title>{title}</title><meta name="description" content="{desc}">'
                     f'<link rel="canonical" href="{origin}{path}"><script type="application/ld+json">{ld}</script>'
                     f"</head><body>{links}</body></html>")


class MetaCheck(unittest.TestCase):
    DESC = "A description that is long enough to pass the fifty character floor."

    def run_check(self, pages):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(meta_check, "load_plan", return_value=[]):
            fixture_site(Path(d), pages)
            return meta_check.check(Path(d))

    def test_good_site_passes(self):
        r = self.run_check({"/": ("Parity front page", self.DESC), "/learn/": ("Learn | Parity", self.DESC + " Two.")})
        self.assertEqual(r["problems"], {})
        self.assertEqual(r["pages"], 2)

    def test_bad_titles_descriptions_and_duplicates_fail(self):
        r = self.run_check({"/": ("Short", "too short"), "/a/": ("Same title here", self.DESC), "/b/": ("Same title here", self.DESC)})
        text = json.dumps(r["problems"])
        self.assertIn("title is 5 characters", text)
        self.assertIn("description is 9 characters", text)
        self.assertIn("same title as /b/", text)
        self.assertIn("same description", text)

    def test_wrong_canonical_and_broken_json_ld_fail(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(meta_check, "load_plan", return_value=[]):
            fixture_site(Path(d), {"/": ("Parity front page", self.DESC)})
            f = Path(d) / "index.html"
            f.write_text(f.read_text().replace('href="https://example.test/"', 'href="https://other.test/"')
                         .replace('"@type": "WebPage"', '"@type": "Article"'))
            r = meta_check.check(Path(d))
        text = json.dumps(r["problems"])
        self.assertIn("canonical link points at https://other.test/", text)
        self.assertIn("Article has no headline", text)

    def test_keyword_plan_is_checked(self):
        plan = [{"path": "/", "keyword": "backtest", "cluster": "backtesting"}]
        with tempfile.TemporaryDirectory() as d, mock.patch.object(meta_check, "load_plan", return_value=plan):
            fixture_site(Path(d), {"/": ("Parity front page", self.DESC)})
            r = meta_check.check(Path(d))
        self.assertIn("keyword 'backtest'", json.dumps(r["problems"]))


class Keywords(unittest.TestCase):
    PLAN = [{"id": "backtesting", "label": "Backtesting", "seeds": ["backtest", "sharpe"], "page": [{"path": "/learn/backtest/", "keyword": "backtest"}]},
            {"id": "strategies", "label": "Strategies", "seeds": ["strategy", "momentum"], "page": []}]

    def test_queries_sort_into_clusters(self):
        self.assertEqual(keywords.cluster_of("How to backtest a strategy", self.PLAN), "backtesting")
        self.assertEqual(keywords.cluster_of("momentum strategies", self.PLAN), "strategies")
        self.assertIsNone(keywords.cluster_of("weather today", self.PLAN))

    def test_analyse_counts_and_suggests(self):
        gsc = {"queries": {"current": [{"query": "backtest python", "clicks": 3, "impressions": 40, "position": 12},
                                       {"query": "weather", "clicks": 1, "impressions": 5, "position": 3}],
                           "previous": [{"query": "backtest python", "clicks": 1, "impressions": 10, "position": 20}]}}
        r = keywords.analyse(gsc, self.PLAN)
        c = r["clusters"]["backtesting"]
        self.assertEqual((c["clicks"], c["impressions"], c["clicks_before"]), (3, 40, 1))
        self.assertEqual(c["suggested_keyword"], "backtest python")
        self.assertTrue(c["targeted"])
        self.assertEqual(len(c["almost_page_one"]), 1)
        self.assertEqual([u["query"] for u in r["unmatched"]], ["weather"])

    def test_real_plan_loads(self):
        plan = keywords.load_plan()
        self.assertGreaterEqual(len(plan), 1)
        self.assertTrue(all(c["seeds"] for c in plan))


class Automation(unittest.TestCase):
    def test_switches(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = Path(d) / "a.toml"
            cfg.write_text("[switches]\nall = true\nindexnow = false\n")
            self.assertEqual(automation.enabled("seo_report", cfg, {})[0], True)
            self.assertEqual(automation.enabled("indexnow", cfg, {})[0], False)
            self.assertEqual(automation.enabled("seo_report", cfg, {"SEO_AUTOMATION": "off"})[0], False)
            self.assertEqual(automation.enabled("seo_report", cfg, {"SEO_AUTOMATION": "indexnow, seo_report"})[0], False)
            self.assertEqual(automation.enabled("gsc_submit", cfg, {"SEO_AUTOMATION": "seo_report"})[0], True)
            cfg.write_text("[switches]\nall = false\n")
            ok, why = automation.enabled("seo_report", cfg, {})
            self.assertFalse(ok)
            self.assertIn("all = false", why)

    def test_real_config_has_every_job(self):
        sw = automation.config().get("switches", {})
        for job in ("indexnow", "gsc_submit", "seo_report", "status_probe"):
            self.assertIn(job, sw)


class SearchConsole(unittest.TestCase):
    def test_properties_follow_the_site_address(self):
        with mock.patch.object(search_console, "SITE", "https://paritytrading.app"), \
                mock.patch.dict("os.environ", {"GSC_SITE_URLS": "https://old.example/, https://paritytrading.app/"}):
            self.assertEqual(search_console.properties(),
                             ["https://paritytrading.app/", "sc-domain:paritytrading.app", "https://old.example/"])

    def test_inspect_sample_puts_fronts_first_and_respects_the_limit(self):
        urls = ["https://s.test/", "https://s.test/learn/"] + [f"https://s.test/learn/t{i}/" for i in range(30)]
        pick = search_console.inspect_sample(urls, 10)
        self.assertEqual(len(pick), 10)
        self.assertEqual(pick[:2], ["https://s.test/", "https://s.test/learn/"])
        self.assertEqual(len(set(pick)), 10)
        self.assertEqual(search_console.inspect_sample([], 5), [])
        self.assertTrue(all(re.match(r"https://s\.test/", u) for u in pick))


if __name__ == "__main__":
    unittest.main()
