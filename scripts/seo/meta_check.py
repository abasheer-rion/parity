#!/usr/bin/env python3
"""Checks every public page's title, description, canonical link and JSON-LD in the built site (DEC-0073).

    python3 scripts/seo/meta_check.py --site-dir web/dist [--json out.json] [--allow-unbuilt]

Reads sitemap.xml (and the section sitemaps it lists) for the public URLs, opens each built
page and fails when:
  - the title is missing, shorter than 10 or longer than 65 characters (the " | Parity" ending counts)
  - the description is missing, shorter than 50 or longer than 160 characters
  - two pages share a title or a description
  - the canonical link is missing or does not point at the page's own address
  - a JSON-LD block does not parse, or has no @context or @type
  - an Article, NewsArticle or BlogPosting has no headline, datePublished or author
  - a page in the keyword plan (content/seo/keywords.toml) has its keyword in neither its
    title nor its description
It also prints internal link suggestions: public pages that no other public page links to,
each with a page that could link to it (the section's front page when there is one).
--allow-unbuilt is for a build without the vite apps (the weekly report builds only the public
pages): pages the vite build makes, such as the front page and /legal/, are then listed as
not built instead of failing. The deploy never passes it.
Standard library only. Exits 1 on any failure.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TITLE = (10, 65)
DESC = (50, 160)
ARTICLE_TYPES = {"Article", "NewsArticle", "BlogPosting", "TechArticle", "Report"}


class Head(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title, self.desc, self.canonical, self.robots = "", None, None, ""
        self.ld: list[str] = []
        self.links: set[str] = set()
        self._in_title = self._in_ld = False
        self._svg = 0  # <title> inside an inline SVG labels the drawing, not the page
        self._title_done = False
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "svg":
            self._svg += 1
        elif tag == "title" and not self._svg and not self._title_done:
            self._in_title = True
        elif tag == "meta" and a.get("name") == "description":
            self.desc = a.get("content") or ""
        elif tag == "meta" and a.get("name") == "robots":
            self.robots = a.get("content") or ""
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        elif tag == "script" and a.get("type") == "application/ld+json":
            self._in_ld, self._buf = True, []
        elif tag == "a" and a.get("href"):
            self.links.add(a["href"])

    def handle_endtag(self, tag):
        if tag == "svg" and self._svg:
            self._svg -= 1
        elif tag == "title" and self._in_title:
            self._in_title, self._title_done = False, True
        elif tag == "script" and self._in_ld:
            self._in_ld = False
            self.ld.append("".join(self._buf))

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif self._in_ld:
            self._buf.append(data)


def sitemap_paths(site_dir: Path) -> tuple[str, list[str]]:
    """The site origin and every public path listed in sitemap.xml and its section sitemaps."""
    main = (site_dir / "sitemap.xml").read_text()
    locs = re.findall(r"<loc>([^<]+)</loc>", main)
    if "<sitemapindex" in main:
        inner = []
        for loc in locs:
            path = re.sub(r"^https?://[^/]+", "", loc)
            inner += re.findall(r"<loc>([^<]+)</loc>", (site_dir / path.lstrip("/")).read_text())
        locs = inner
    origin = re.match(r"https?://[^/]+", locs[0]).group(0) if locs else ""
    return origin, [re.sub(r"^https?://[^/]+", "", u) for u in locs]


def page_file(site_dir: Path, path: str) -> Path:
    return site_dir / "index.html" if path == "/" else site_dir / path.strip("/") / "index.html"


def ld_problems(raw: str) -> list[str]:
    try:
        doc = json.loads(raw)
    except json.JSONDecodeError as err:
        return [f"JSON-LD does not parse ({err.msg})"]
    out = []
    items = doc.get("@graph", [doc]) if isinstance(doc, dict) else doc
    if isinstance(doc, dict) and "@context" not in doc:
        out.append("JSON-LD has no @context")
    for item in items:
        if not isinstance(item, dict) or "@type" not in item:
            out.append("a JSON-LD item has no @type")
            continue
        types = item["@type"] if isinstance(item["@type"], list) else [item["@type"]]
        if ARTICLE_TYPES & set(types):
            for field in ("headline", "datePublished", "author"):
                if not item.get(field):
                    out.append(f"{types[0]} has no {field}")
    return out


def load_plan() -> list[dict]:
    path = ROOT / "content/seo/keywords.toml"
    if not path.exists():
        return []
    plan = tomllib.loads(path.read_text())
    return [{**p, "cluster": c["id"]} for c in plan.get("cluster", []) for p in c.get("page", [])]


def link_from(path: str, built: set[str]) -> str:
    """The nearest built page above `path` (its section's front page), else the front page."""
    parts = path.strip("/").split("/")
    for i in range(len(parts) - 1, 0, -1):
        parent = "/" + "/".join(parts[:i]) + "/"
        if parent in built:
            return parent
    return "/"


def check(site_dir: Path, allow_unbuilt: bool = False) -> dict:
    origin, paths = sitemap_paths(site_dir)
    problems: dict[str, list[str]] = defaultdict(list)
    unbuilt: list[str] = []
    titles: dict[str, list[str]] = defaultdict(list)
    descs: dict[str, list[str]] = defaultdict(list)
    inbound: dict[str, int] = {p: 0 for p in paths}
    heads: dict[str, Head] = {}
    for path in paths:
        f = page_file(site_dir, path)
        if not f.exists():
            if allow_unbuilt:
                unbuilt.append(path)
            else:
                problems[path].append("listed in the sitemap but not built")
            continue
        h = Head()
        h.feed(f.read_text(errors="replace"))
        heads[path] = h
        title, desc = h.title.strip(), (h.desc or "").strip()
        if "noindex" in h.robots:
            problems[path].append("listed in the sitemap but marked noindex")
        if not title:
            problems[path].append("no title")
        elif not TITLE[0] <= len(title) <= TITLE[1]:
            problems[path].append(f"title is {len(title)} characters (keep {TITLE[0]} to {TITLE[1]}): {title!r}")
        if not desc:
            problems[path].append("no description")
        elif not DESC[0] <= len(desc) <= DESC[1]:
            problems[path].append(f"description is {len(desc)} characters (keep {DESC[0]} to {DESC[1]})")
        titles[title].append(path)
        descs[desc].append(path)
        if not h.canonical:
            problems[path].append("no canonical link")
        elif h.canonical != origin + path:
            problems[path].append(f"canonical link points at {h.canonical}, not {origin + path}")
        for raw in h.ld:
            problems[path] += ld_problems(raw)
        for href in h.links:
            target = re.sub(r"^" + re.escape(origin), "", href).split("#")[0].split("?")[0]
            if target in inbound and target != path:
                inbound[target] += 1
    for kind, seen in (("title", titles), ("description", descs)):
        for text, where in seen.items():
            if text and len(where) > 1:
                for p in where:
                    problems[p].append(f"same {kind} as {', '.join(x for x in where if x != p)[:200]}")
    for item in load_plan():
        h = heads.get(item["path"])
        kw = item["keyword"].lower()
        if h is None and item["path"] in unbuilt:
            continue
        if h is None:
            problems[item["path"]].append(f"in the keyword plan ({item['cluster']}) but not in the sitemap")
        elif kw not in h.title.lower() and kw not in (h.desc or "").lower():
            problems[item["path"]].append(f"keyword {item['keyword']!r} ({item['cluster']}) is in neither the title nor the description")
    orphans = sorted(p for p, n in inbound.items() if n == 0 and p != "/" and p in heads)
    suggestions = [{"page": p, "link_from": link_from(p, set(heads))} for p in orphans]
    return {"pages": len(paths), "problems": {k: v for k, v in problems.items() if v}, "orphans": orphans, "link_suggestions": suggestions,
            "unbuilt": unbuilt}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site-dir", default=str(ROOT / "web/dist"))
    ap.add_argument("--json")
    ap.add_argument("--allow-unbuilt", action="store_true", help="list pages the vite build makes instead of failing on them")
    args = ap.parse_args()
    report = check(Path(args.site_dir), allow_unbuilt=args.allow_unbuilt)
    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json).write_text(json.dumps(report, indent=2))
    bad = report["problems"]
    for path, items in sorted(bad.items()):
        for item in items:
            print(f"meta_check: {path}: {item}")
    if report["orphans"]:
        print(f"meta_check: {len(report['orphans'])} public page(s) no other public page links to. Link to them from a related page:")
        for s in report["link_suggestions"][:20]:
            print(f"  {s['page']} (from {s['link_from']})")
    if report["unbuilt"]:
        print(f"meta_check: {len(report['unbuilt'])} page(s) not built here (the vite build makes them), not checked")
    print(f"meta_check: {report['pages']} public pages, {sum(len(v) for v in bad.values())} problem(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
