"""Tests for the changelog, announcements and status pages and the warning collector (DEC-0073).

    python3 -m unittest discover -s scripts/updates/tests
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import tempfile
import unittest
import xml.dom.minidom
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import build  # noqa: E402
import status  # noqa: E402

NOW = dt.datetime(2026, 10, 26, 15, 0, tzinfo=dt.timezone.utc)
SEP = "\x1f"
LOG = "\n".join([
    f"a1{SEP}2026-10-26{SEP}fix(event-graph): rate-driver price check, Brazil final (#143)",
    f"a2{SEP}2026-10-26{SEP}feat(sim): stress tests and a shock composer (#138)",
    f"a3{SEP}2026-10-20{SEP}perf(web): faster first paint (#120)",
    f"a4{SEP}2026-10-20{SEP}chore(deps): bump things (#119)",
    f"a5{SEP}2026-10-19{SEP}docs: a guide (#118)",
    f"a6{SEP}2026-10-19{SEP}feat(seo): work in progress without a pull request",
    f"a7{SEP}2026-10-18{SEP}feat!: a breaking change (#117)",
    "not a log line",
])
TAGS = f"desktop-v0.2.2{SEP}2026-10-25\ndesktop-v0.10.0{SEP}2026-10-25\nother-tag{SEP}2026-10-01\n"


class Parsing(unittest.TestCase):
    def test_merged_features_and_fixes_only(self):
        rows = build.parse_log(LOG)
        self.assertEqual([r["pr"] for r in rows], [143, 138, 120, 117])
        self.assertEqual(rows[0]["summary"], "Rate-driver price check, Brazil final")
        self.assertEqual(rows[0]["kind"], "fix")
        self.assertEqual(rows[2]["kind"], "fix")  # perf counts as a fix
        self.assertEqual(rows[1]["url"], f"{build.REPO}/pull/138")

    def test_desktop_tags(self):
        tags = build.parse_tags(TAGS)
        self.assertEqual([t["version"] for t in tags], ["0.10.0", "0.2.2"])
        self.assertTrue(tags[0]["url"].endswith("/releases/tag/desktop-v0.10.0"))

    def test_missing_git_does_not_crash(self):
        with tempfile.TemporaryDirectory() as d:
            log, tags, note = build.read_history(Path(d))
        self.assertEqual((log, tags), ("", ""))
        self.assertEqual(note, build.MISSING_NOTE)


class Pages(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.out = self.root / "dist"
        self.out.mkdir()
        (self.root / "ann").mkdir()
        (self.root / "ann" / "first.md").write_text(
            '+++\ntitle = "Hello"\ndate = 2026-10-26\nsummary = "A first note."\n+++\n\nSome **body**.\n')
        (self.root / "status.toml").write_text(
            '[[entry]]\nid = "old"\nlevel = "info"\ntitle = "Old trouble"\ndetail = "It was slow."\n'
            'start = 2026-10-01T00:00:00Z\nend = 2026-10-02T00:00:00Z\n\n'
            '[[entry]]\nid = "now"\nlevel = "warning"\ntitle = "Sign-in is slow"\ndetail = "Try again soon."\n'
            'start = 2026-10-26T00:00:00Z\n')
        (self.root / "auto.json").write_text(json.dumps({"generated": "2026-10-26T14:30:00Z", "warnings": [
            {"id": "live-feed-down", "level": "outage", "title": "Live prices are not updating", "detail": "d",
             "start": "2026-10-26T14:30:00Z", "link": "/status/", "source": "probe"}]}))

    def tearDown(self):
        self.tmp.cleanup()

    def run_build(self, history=(LOG, TAGS, "")):
        return build.build_into(self.out, now=NOW, history=history, announcements=self.root / "ann",
                                manual=self.root / "status.toml", auto=self.root / "auto.json")

    def test_pages_feeds_and_status_json(self):
        urls = self.run_build()
        self.assertEqual([u for u, _ in urls], ["/changelog/", "/announcements/", "/status/"])
        self.assertEqual(urls[0][1], "2026-10-26")
        titles = set()
        for path in ("changelog", "announcements", "status"):
            page = (self.out / path / "index.html").read_text()
            title = re.search(r"<title>([^<]+)</title>", page).group(1)
            desc = re.search(r'<meta name="description" content="([^"]+)"', page).group(1)
            self.assertLessEqual(len(title), 65)
            self.assertTrue(50 <= len(desc) <= 160, desc)
            self.assertIn(f'<link rel="canonical" href="{build.bp.SITE}/{path}/">', page)
            ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', page).group(1))
            self.assertIn("@context", ld)
            self.assertTrue('src="/status-banner.js"' in page)
            self.assertIn("/changelog/feed.xml", page)  # the footer links
            self.assertNotIn("\u2014", page)
            self.assertNotIn("\u2013", page)
            titles.add(title)
            xml.dom.minidom.parse(str(self.out / path / "feed.xml"))
        self.assertEqual(len(titles), 3)
        public = json.loads((self.out / "status.json").read_text())
        self.assertEqual([w["id"] for w in public["warnings"]], ["live-feed-down", "now"])
        self.assertEqual(set(public["warnings"][0]), {"id", "level", "title", "detail", "link", "start"})
        status_page = (self.out / "status" / "index.html").read_text()
        self.assertIn("Old trouble", status_page)  # the history

    def test_changelog_groups_by_week(self):
        self.run_build()
        page = (self.out / "changelog" / "index.html").read_text()
        self.assertIn("Week of 26 October 2026", page)
        self.assertIn("Week of 19 October 2026", page)
        self.assertIn("Desktop app 0.2.2", page)
        self.assertNotIn("bump things", page)
        self.assertNotIn("work in progress", page)

    def test_shallow_history_says_so(self):
        self.run_build(history=(LOG, "", build.SHALLOW_NOTE))
        self.assertIn("partial copy of the project history", (self.out / "changelog" / "index.html").read_text())

    def test_announcements_include_releases(self):
        self.run_build()
        page = (self.out / "announcements" / "index.html").read_text()
        self.assertIn("Hello", page)
        self.assertIn("<strong>body</strong>", page)
        self.assertIn("Parity desktop 0.10.0 is out", page)

    def test_broken_announcement_stops_the_build(self):
        (self.root / "ann" / "bad.md").write_text('+++\ntitle = "No date"\n+++\n')
        with self.assertRaises(build.UpdatesError):
            self.run_build()

    def test_real_content_builds(self):
        build.build_into(self.out, now=NOW, history=("", "", build.MISSING_NOTE), auto=self.root / "none.json")
        self.assertIn("a changelog, announcements and a status page", (self.out / "announcements" / "index.html").read_text())


class Status(unittest.TestCase):
    def rows(self, search_age_h=0.5, sims_age_h=0.5, degraded=0):
        def at(h):
            return (NOW - dt.timedelta(hours=h)).isoformat()
        return [{"service": "search", "reported_at": at(search_age_h), "summary": {"trials": 10}},
                {"service": "sims", "reported_at": at(sims_age_h), "summary": {"data": {"series": 320, "live": 300, "degraded": degraded}}}]

    def test_healthy_services_give_no_warnings(self):
        self.assertEqual(status.heartbeat_warnings(self.rows(), NOW), [])

    def test_stale_service_and_degraded_series(self):
        warns = status.heartbeat_warnings(self.rows(search_age_h=3, degraded=4), NOW)
        self.assertEqual([w["id"] for w in warns], ["stale-search", "data-degraded"])
        self.assertEqual(warns[0]["level"], "warning")
        self.assertIn("4 of 320", warns[1]["detail"])

    def test_missing_service_is_a_warning(self):
        warns = status.heartbeat_warnings(self.rows()[:1], NOW)
        self.assertEqual([w["id"] for w in warns], ["stale-sims"])

    def test_probe_result(self):
        ok = {"firstPriceMs": 300, "live": 40}
        self.assertEqual(status.probe_warnings(ok, NOW), [])
        self.assertEqual(status.probe_warnings(None, NOW), [])
        for bad in ({"firstPriceMs": None, "live": 0}, {"firstPriceMs": 9000, "live": 3}, {"firstPriceMs": 200, "live": 0}):
            w = status.probe_warnings(bad, NOW)
            self.assertEqual([(x["id"], x["level"]) for x in w], [("live-feed-down", "outage")])

    def test_collect_merges_manual_and_carries_probe(self):
        manual = [{"id": "m", "level": "info", "title": "t", "detail": "d", "start": "2026-10-26T00:00:00Z", "end": "",
                   "link": "", "source": "manual"},
                  {"id": "later", "level": "info", "title": "t", "detail": "d", "start": "2026-11-01T00:00:00Z", "end": "",
                   "link": "", "source": "manual"}]
        carry = status.probe_warnings({"firstPriceMs": None}, NOW)
        doc = status.collect(rows=None, probe=None, manual=manual, now=NOW, carry=carry)
        self.assertEqual([w["id"] for w in doc["warnings"]], ["live-feed-down", "m"])

    def test_carry_only_when_fresh(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "a.json"
            p.write_text(json.dumps({"generated": status.iso(NOW - dt.timedelta(minutes=20)),
                                     "warnings": status.probe_warnings({"live": 0}, NOW)}))
            self.assertEqual(len(status.carried(str(p), NOW)[0]), 1)
            self.assertEqual(status.carried(str(p), NOW + dt.timedelta(hours=3))[0], [])

    def test_load_probe_reads_the_json_line(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "probe.json"
            p.write_text('{"firstPriceMs": 120, "live": 9}\n')
            self.assertEqual(status.load_probe(str(p))["live"], 9)
            self.assertIsNone(status.load_probe(str(Path(d) / "missing.json")))

    def test_bad_manual_entry_is_named(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.toml"
            p.write_text('[[entry]]\nid = "x"\nlevel = "red"\ntitle = "t"\ndetail = "d"\nstart = 2026-10-26\n')
            with self.assertRaisesRegex(ValueError, "level"):
                status.load_manual(p)

    def test_kill_switch_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "out.json"
            old = {k: os.environ.get(k) for k in ("SEO_AUTOMATION", "AUTOMATION_LOG", "GITHUB_OUTPUT")}
            os.environ.update(SEO_AUTOMATION="status_probe", AUTOMATION_LOG=str(Path(d) / "log.jsonl"),
                              GITHUB_OUTPUT=str(Path(d) / "gh.txt"))
            try:
                self.assertEqual(status.main(["--out", str(out)]), 0)
            finally:
                for k, v in old.items():
                    os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
            self.assertFalse(out.exists())
            self.assertIn('"skipped"', (Path(d) / "log.jsonl").read_text())
            self.assertIn("changed=false", (Path(d) / "gh.txt").read_text())

    def test_run_without_database_logs_and_writes(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "out.json"
            probe = Path(d) / "probe.json"
            probe.write_text('{"firstPriceMs": null, "live": 0}')
            old = {k: os.environ.get(k) for k in ("SEO_AUTOMATION", "AUTOMATION_LOG", "SITE_DATA_DB_URL")}
            os.environ.update(SEO_AUTOMATION="", AUTOMATION_LOG=str(Path(d) / "log.jsonl"))
            os.environ.pop("SITE_DATA_DB_URL", None)
            try:
                self.assertEqual(status.main(["--probe", str(probe), "--out", str(out)]), 0)
            finally:
                for k, v in old.items():
                    os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
            doc = json.loads(out.read_text())
            self.assertIn("live-feed-down", [w["id"] for w in doc["warnings"]])
            self.assertIn("SITE_DATA_DB_URL is not set", doc["sources"]["health"])
            self.assertIn('"collected"', (Path(d) / "log.jsonl").read_text())


if __name__ == "__main__":
    unittest.main()
