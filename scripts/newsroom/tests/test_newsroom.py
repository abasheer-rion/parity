"""Tests for the newsroom rules and builder (DEC-0053).

    python3 -m unittest discover -s scripts/newsroom/tests

Each rule the owner asked for has a test that breaks it and expects the check to say so.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
os.environ["NEWSROOM_NO_MEDIA"] = "1"

import build  # noqa: E402
import hook  # noqa: E402
import model  # noqa: E402

AUTHORS = """
[ayan]
name = "Ayan"
kind = "team"
[parity-research]
name = "Parity Research"
kind = "house"
[parity-editorial]
name = "Parity Editorial"
kind = "house"
"""


def post(**over) -> str:
    """A valid published Analysis post as text, with fields replaced or removed (value None)."""
    fields = {
        "title": '"A title"', "dek": '"A dek."', "slug": '"a-title"', "date": "2026-10-25",
        "type": '"Analysis"', "stance": '"Analysis"', "status": '"published"', "authors": '["parity-research"]',
    }
    tables = over.pop("tables", '\n[[sources]]\nid = "s1"\ntitle = "A source"\nurl = "https://example.org/a"\n')
    body = over.pop("body", "Some text that cites a source[^s1].\n")
    for k, v in over.items():
        if v is None:
            fields.pop(k, None)
        else:
            fields[k] = v
    fm = "\n".join(f"{k} = {v}" for k, v in fields.items())
    return f"+++\n{fm}\n{tables}+++\n\n{body}"


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        (self.dir / "posts").mkdir()
        (self.dir / "drafts").mkdir()
        (self.dir / "authors.toml").write_text(AUTHORS)
        self.refs = model.load_references()

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def write(self, name: str, text: str, folder: str = "posts") -> Path:
        p = self.dir / folder / name
        p.write_text(text)
        return p

    def problems(self, authors_text: str | None = None) -> list[str]:
        if authors_text is not None:
            (self.dir / "authors.toml").write_text(authors_text)
        return model.validate(model.load_posts(self.dir), model.load_authors(self.dir / "authors.toml"), self.refs, self.dir)

    def assertProblem(self, needle: str):
        probs = self.problems()
        self.assertTrue(any(needle in p for p in probs), f"expected a problem containing {needle!r}, got {probs}")


class RepoContent(unittest.TestCase):
    def test_the_posts_in_the_repo_pass(self):
        probs = model.validate(model.load_posts(), model.load_authors())
        self.assertEqual(probs, [])

    def test_sample_posts_are_marked(self):
        published = [p for p in model.load_posts() if p.status == "published"]
        self.assertGreaterEqual(len(published), 2)
        for p in published:
            if "2026-10-25" in p.file.name:
                self.assertTrue(p.sample, f"{p.file.name} should be marked sample = true")


class Rules(Base):
    def test_a_valid_post_passes(self):
        self.write("a.md", post())
        self.assertEqual(self.problems(), [])

    def test_opinion_without_the_opinion_label_fails(self):
        self.write("a.md", post(type='"Opinion"', stance='"Analysis"', tables="", body="x\n"))
        self.assertProblem("must carry the stance label Opinion")

    def test_a_missing_stance_fails(self):
        self.write("a.md", post(stance=None))
        self.assertProblem("`stance` is required")

    def test_news_cannot_be_labelled_opinion(self):
        self.write("a.md", post(type='"News"', stance='"Opinion"'))
        self.assertProblem("must carry the stance label Fact-based reporting")

    def test_research_analysis_and_news_need_sources(self):
        for t, s in (("Research", "Analysis"), ("Analysis", "Analysis"), ("News", "Fact-based reporting")):
            with self.subTest(type=t):
                self.write("a.md", post(type=f'"{t}"', stance=f'"{s}"', tables="", body="No citations.\n"))
                self.assertProblem(f"a {t} post must list its sources")

    def test_a_company_update_does_not_need_sources(self):
        self.write("a.md", post(type='"Company update"', stance='"Fact-based reporting"', tables="", body="x\n"))
        self.assertEqual(self.problems(), [])

    def test_a_citation_must_be_in_the_sources(self):
        self.write("a.md", post(body="Cites a thing[^missing].\n"))
        self.assertProblem("cites [^missing]")

    def test_a_ref_fills_in_from_the_references_registry(self):
        self.write("a.md", post(tables='\n[[sources]]\nref = "mclean2016"\n', body="See[^mclean2016].\n"))
        self.assertEqual(self.problems(), [])

    def test_an_image_without_alt_text_fails(self):
        self.write("a.md", post(tables='\n[hero]\nkind = "chart"\nchart = "catalog-evidence"\n\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        self.assertProblem("needs alt text")

    def test_a_stock_image_without_a_licence_fails(self):
        (self.dir / "images").mkdir()
        (self.dir / "images/x.jpg").write_bytes(b"\xff\xd8")
        hero = '\n[hero]\nkind = "stock"\nsrc = "images/x.jpg"\nalt = "A desk."\ncredit = "Someone"\n'
        self.write("a.md", post(tables=hero + '\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        self.assertProblem("`licence` must be one of")

    def test_a_stock_image_without_a_credit_fails(self):
        (self.dir / "images").mkdir()
        (self.dir / "images/x.jpg").write_bytes(b"\xff\xd8")
        hero = ('\n[hero]\nkind = "stock"\nsrc = "images/x.jpg"\nalt = "A desk."\nlicence = "Unsplash License"\n'
                'source_url = "https://unsplash.com/photos/abc"\n')
        self.write("a.md", post(tables=hero + '\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        self.assertProblem("needs a `credit`")

    def test_stock_must_come_from_the_licensed_site(self):
        (self.dir / "images").mkdir()
        (self.dir / "images/x.jpg").write_bytes(b"\xff\xd8")
        hero = ('\n[hero]\nkind = "stock"\nsrc = "images/x.jpg"\nalt = "A desk."\ncredit = "Someone"\n'
                'licence = "Unsplash License"\nsource_url = "https://news-site.example/photo.jpg"\n')
        self.write("a.md", post(tables=hero + '\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        self.assertProblem("the photo's page on unsplash.com")

    def test_an_image_in_the_text_needs_a_credit_entry(self):
        self.write("a.md", post(body="Text[^s1].\n\n![A chart](images/y.png)\n"))
        self.assertProblem("needs an [[images]] entry")

    def test_an_unknown_chart_fails(self):
        self.write("a.md", post(tables='\n[hero]\nkind = "chart"\nchart = "made-up"\nalt = "x"\n\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        self.assertProblem("`chart` must name a chart")

    def test_em_dashes_fail(self):
        self.write("a.md", post(body="A dash \u2014 here[^s1].\n"))
        self.assertProblem("em dash")

    def test_drafts_get_light_checks_only(self):
        self.write("d.md", '+++\ntype = "Analysis"\nstance = "Analysis"\nstatus = "draft"\n+++\n\nNot done.\n', "drafts")
        self.assertEqual(self.problems(), [])

    def test_a_published_post_cannot_sit_in_drafts(self):
        self.write("d.md", post(), "drafts")
        self.assertProblem("belongs in content/newsroom/posts/")

    def test_duplicate_slugs_fail(self):
        self.write("a.md", post())
        self.write("b.md", post())
        self.assertProblem("is also used by")


class Bylines(Base):
    def test_unknown_author_fails(self):
        self.write("a.md", post(authors='["jane-doe"]'))
        self.assertProblem("author 'jane-doe' is not in")

    def test_house_bylines_cannot_have_a_photo(self):
        self.write("a.md", post())
        probs = self.problems(AUTHORS + '\n[parity-desk]\nname = "Parity Desk"\nkind = "house"\nphoto = "face.jpg"\n')
        self.assertTrue(any("cannot have a photo" in p for p in probs), probs)

    def test_house_bylines_are_named_for_parity(self):
        probs = self.problems(AUTHORS + '\n[jane]\nname = "Jane Smith"\nkind = "house"\n')
        self.assertTrue(any("named for Parity" in p for p in probs), probs)

    def test_a_team_bio_needs_a_review_status(self):
        probs = self.problems(AUTHORS.replace('kind = "team"', 'kind = "team"\nbio = "Works on research."', 1))
        self.assertTrue(any("needs `bio_status`" in p for p in probs), probs)

    def test_a_team_photo_needs_the_persons_say_so(self):
        probs = self.problems(AUTHORS.replace('kind = "team"', 'kind = "team"\nphoto = "face.jpg"', 1))
        self.assertTrue(any("only when they supply it" in p for p in probs), probs)

    def test_the_cofounders_have_profiles_without_photos(self):
        authors = model.load_authors()
        for key, name in (("amanda", "Amanda Sourivong"), ("abanish", "Abanish Khadka")):
            self.assertEqual(authors[key].name, name)
            self.assertEqual(authors[key].role, "Co-founder, Parity")
            self.assertEqual(authors[key].photo, "")
        self.assertEqual(authors["amanda"].bio_status, "pending author review")
        self.assertEqual(authors["abanish"].bio, "")


class MachineDrafts(Base):
    def test_a_generated_post_needs_a_named_approver_to_publish(self):
        self.write("a.md", post(tables='\n[review]\ngenerated_by = "seo-pipeline"\n\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        self.assertProblem("needs `review.approved_by`")

    def test_a_house_byline_cannot_approve(self):
        self.write("a.md", post(tables='\n[review]\ngenerated_by = "seo-pipeline"\napproved_by = "parity-research"\napproved_on = 2026-10-25\n'
                                       '\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        self.assertProblem("needs `review.approved_by`")

    def test_a_team_member_can_approve(self):
        self.write("a.md", post(tables='\n[review]\ngenerated_by = "seo-pipeline"\napproved_by = "ayan"\napproved_on = 2026-10-25\n'
                                       '\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        self.assertEqual(self.problems(), [])

    def test_the_hook_only_ever_writes_a_draft(self):
        dest = hook.propose({"title": "Carry in 2026", "dek": "d", "type": "Analysis", "status": "published",
                             "body": "Text.", "sources": [{"ref": "mclean2016"}]}, "seo-pipeline",
                            today=dt.date(2026, 10, 25), content=self.dir)
        self.assertEqual(dest.parent.name, "drafts")
        p = model.load_post(dest)
        self.assertEqual(p.status, "draft")
        self.assertEqual(p.meta["review"]["generated_by"], "seo-pipeline")
        self.assertEqual(self.problems(), [])
        self.assertEqual(model.public_posts(model.load_posts(self.dir)), [])


class Building(Base):
    def build(self, preview: bool = False) -> tuple[build.Newsroom, Path]:
        out = self.dir / "out"
        nr = build.Newsroom(out, preview=preview, content=self.dir)
        nr.build()
        nr.write()
        return nr, out

    def test_only_published_posts_build(self):
        self.write("a.md", post())
        self.write("b.md", post(slug='"in-review"', status='"review"'))
        self.write("c.md", '+++\ntitle = "x"\nslug = "a-draft"\ndate = 2026-10-25\ntype = "Analysis"\nstance = "Analysis"\n'
                           'status = "draft"\nauthors = ["ayan"]\n+++\n\nx\n', "drafts")
        _, out = self.build()
        self.assertTrue((out / "blog/a-title/index.html").exists())
        self.assertFalse((out / "blog/in-review/index.html").exists())
        self.assertFalse((out / "blog/a-draft/index.html").exists())
        self.assertNotIn("in-review", (out / "blog/index.json").read_text())

    def test_the_preview_shows_drafts_with_a_banner_and_noindex(self):
        self.write("b.md", post(slug='"in-review"', status='"review"'))
        _, out = self.build(preview=True)
        page = (out / "blog/in-review/index.html").read_text()
        self.assertIn("Review, not public", page)
        self.assertIn('name="robots" content="noindex, nofollow"', page)

    def test_an_opinion_page_shows_the_opinion_label(self):
        self.write("a.md", post(type='"Opinion"', stance='"Opinion"', slug='"a-view"'))
        _, out = self.build()
        page = (out / "blog/a-view/index.html").read_text()
        self.assertIn('class="stance s-opinion">Opinion</span>', page)
        self.assertIn('"OpinionNewsArticle"', page)

    def test_article_anatomy(self):
        self.write("a.md", post(updated="2026-10-26", tables='\n[[sources]]\nid = "s1"\ntitle = "A source"\nurl = "https://example.org/a"\n'
                                '\n[[corrections]]\ndate = 2026-10-26\ntext = "Fixed a number."\n',
                                body="Intro[^s1].\n\n> [!pull] A pulled line.\n"))
        _, out = self.build()
        page = (out / "blog/a-title/index.html").read_text()
        for needle in ('<p class="dek">', "By <a href=\"/authors/parity-research/\">Parity Research</a>", "min read",
                       '<li id="source-1">', '<a href="#source-1"', "Corrections", "Fixed a number.", 'class="pull"',
                       model.DISCLOSURE, "data-copy=", "linkedin.com/sharing", 'class="progress"',
                       '"AnalysisNewsArticle"', 'property="article:published_time"', "Updated"):
            self.assertIn(needle, page)
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', page, re.S).group(1))
        art = [x for x in ld["@graph"] if x.get("@type") == "AnalysisNewsArticle"][0]
        self.assertEqual(art["author"][0]["@type"], "Organization")
        self.assertEqual(art["dateModified"], "2026-10-26")

    def test_samples_are_noindex_and_left_out_of_the_sitemap_and_feeds(self):
        self.write("a.md", post(tables='sample = true\n\n[[sources]]\nid = "s1"\ntitle = "t"\nurl = "https://e.org"\n'))
        nr, out = self.build()
        page = (out / "blog/a-title/index.html").read_text()
        self.assertIn('name="robots" content="noindex"', page)
        self.assertNotIn("/blog/a-title/", [u for u, _ in nr.sitemap()])
        self.assertNotIn("a-title", (out / "blog/feed.xml").read_text())

    def test_feeds_and_pages_exist(self):
        self.write("a.md", post())
        nr, out = self.build()
        for f in ("blog/feed.xml", "blog/atom.xml", "news/feed.xml", "news/atom.xml", "blog/index.html",
                  "news/index.html", "blog/category/analysis/index.html", "authors/parity-research/index.html",
                  "tags/index.html"):
            self.assertTrue((out / f).exists(), f)
        self.assertIn("<item><title>A title</title>", (out / "blog/feed.xml").read_text())
        self.assertIn("/blog/a-title/", [u for u, _ in nr.sitemap()])

    def test_pagination(self):
        for i in range(build.PAGE_SIZE + 3):
            self.write(f"p{i}.md", post(slug=f'"post-{i}"', date=f"2026-10-{(i % 25) + 1:02d}"))
        _, out = self.build()
        self.assertTrue((out / "blog/page/2/index.html").exists())
        self.assertIn("Older posts", (out / "blog/index.html").read_text())


if __name__ == "__main__":
    unittest.main()
