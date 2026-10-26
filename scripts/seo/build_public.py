#!/usr/bin/env python3
"""Builds Parity's public, indexable pages into the site build (DEC-0023).

    python3 scripts/seo/build_public.py --out web/dist

Run by `npm run build` in web/ after both vite builds. Standard library only.

It writes static HTML (inline CSS, so pages paint at once) for the pages below. The only
script is the analytics boot file, /a/boot.js from the site build, loaded as a module so it
never blocks painting and records nothing until the person switches analytics on (DEC-0053).
The pages:
  /learn/  and /learn/<term>/   every glossary term (docs/_system/glossary.json)
  /ideas/  and /ideas/<slug>/   every trading idea in catalog/algorithms/*.json
  /notes/  and /notes/<id>/     the "In plain words" part of decisions, research and references
  /learn/edge-lab/              how to look for an edge without fooling yourself (docs/_system/edge-lab.json)
  /learn/academy/...            Parity Academy courses and lessons (academy/courses/*.json, DEC-0028), each
                                lesson with a still frame of its picture drawn by web/scripts/academy-frames.ts
  /learn/private-markets/       private markets in plain words (docs/_system/private-markets.json, DEC-0029)
  /blog/ and /news/             the newsroom, built by scripts/newsroom/build.py from content/newsroom/ (DEC-0057)
and then the files search engines read:
  sitemap.xml          every public URL (front page, legal pages and the pages above)
  seo-manifest.json    URL -> content hash, so the pipeline can tell IndexNow what changed
It also fills the search-engine verification marker in the built front page from the
GSC_VERIFICATION and BING_VERIFICATION environment variables (both optional).

Nothing here reads results, the ledger or /data/: those stay behind sign-in (DEC-0015).
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# The site's address and names live in one file, shared with the web build (DEC-0038).
SITE_JSON = json.loads((ROOT / "web/src/lib/site.json").read_text())
SITE = os.environ.get("SITE_URL", SITE_JSON["origin"]).rstrip("/")
ORG = SITE_JSON["legalName"]
CONTACT = SITE_JSON["email"]
LOGO = "/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg"
STAGES = ["catalogued", "sourced", "hypothesis", "implemented", "registered", "official", "reproduced", "forward", "verdict"]
NOTE_TYPES = {"decisions": "Decision", "research": "Research note", "reference": "Reference"}
LEGAL = [("/legal/privacy/", "Privacy"), ("/legal/terms/", "Terms"), ("/legal/cookies/", "Cookies"),
         ("/legal/accessibility/", "Accessibility"), ("/legal/risk/", "Risk"),
         ("/legal/regulatory/", "Regulatory")]
DISCLAIMER = ("Research and education only. Not investment advice. Results are backtests and simulations "
              "on past data.")

e = html.escape


# ---------------------------------------------------------------- content loading

def load_glossary() -> list[dict]:
    terms = json.loads((ROOT / "docs/_system/glossary.json").read_text())["terms"]
    return sorted(terms, key=lambda t: t["term"].lower())


def load_ideas() -> list[dict]:
    ideas = [json.loads(p.read_text()) for p in sorted((ROOT / "catalog/algorithms").glob("*.json"))]
    return sorted(ideas, key=lambda a: a["name"].lower())


def load_references() -> dict[str, dict]:
    refs = json.loads((ROOT / "docs/_system/references.json").read_text())["references"]
    return {r["key"]: r for r in refs}


def front_matter(text: str) -> tuple[dict, str]:
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    return meta, text[m.end():]


def plain_words(body: str) -> str:
    m = re.search(r"^## In plain words\n(.*?)(?=^## |\Z)", body, re.S | re.M)
    return m.group(1).strip() if m else ""


def load_notes() -> list[dict]:
    notes = []
    for folder, kind in NOTE_TYPES.items():
        for p in sorted((ROOT / "docs" / folder).glob("[0-9][0-9][0-9][0-9]-*.md")):
            meta, body = front_matter(p.read_text())
            summary = plain_words(body)
            if not meta.get("id") or not summary or meta.get("status") in ("draft", "superseded-draft"):
                continue
            notes.append({"id": meta["id"], "title": meta.get("title", meta["id"]), "kind": kind, "folder": folder,
                          "file": p.name, "created": meta.get("created", ""), "updated": meta.get("updated", ""),
                          "status": meta.get("status", ""), "summary": summary})
    return sorted(notes, key=lambda n: n["id"])


def load_edge_lab() -> dict:
    return json.loads((ROOT / "docs/_system/edge-lab.json").read_text())


def load_academy() -> list[dict]:
    courses = [json.loads(p.read_text()) for p in sorted((ROOT / "academy/courses").glob("*.json"))]
    return sorted(courses, key=lambda c: c["order"])


def academy_frames() -> dict[str, list[str]]:
    """Every lesson picture's step frames as SVG, drawn by the app's own code (needs Node 22.6+).

    Without Node the lesson pages still build, with the step captions but no picture."""
    try:
        out = subprocess.run(["node", "--experimental-strip-types", str(ROOT / "web/scripts/academy-frames.ts")],
                             capture_output=True, text=True, timeout=120, check=True).stdout
        return json.loads(out)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as err:
        print(f"build_public: no Academy pictures ({err.__class__.__name__}); pages keep their captions", file=sys.stderr)
        return {}
def load_private_markets() -> dict:
    return json.loads((ROOT / "docs/_system/private-markets.json").read_text())


# ---------------------------------------------------------------- tiny markdown

def inline(text: str, links: dict[str, str], refs: dict[str, dict]) -> str:
    """Escapes text, then renders **bold**, `code`, [text](url) and [@key] citations."""
    out, pos = [], 0
    pat = re.compile(r"\[@([\w:-]+)\]|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|`([^`]+)`")
    for m in pat.finditer(text):
        out.append(e(text[pos:m.start()]))
        if m.group(1):
            ref = refs.get(m.group(1))
            if ref:
                who = (ref.get("authors") or [""])[0].split(",")[0]
                label = f"{who} {ref.get('year') or ''}".strip() or ref["title"]
                url = ref.get("url") or (f"https://doi.org/{ref['doi']}" if ref.get("doi") else "")
                out.append(f'(<a href="{e(url)}" rel="nofollow noopener">{e(label)}</a>)' if url else f"({e(label)})")
        elif m.group(2):
            label, href = m.group(2), m.group(3)
            target = resolve_link(href, links)
            label_html = inline(label, links, refs)
            if target:
                rel = ' rel="nofollow noopener"' if target.startswith("http") else ""
                out.append(f'<a href="{e(target)}"{rel}>{label_html}</a>')
            else:
                out.append(label_html)
        elif m.group(4):
            out.append(f"<strong>{inline(m.group(4), links, refs)}</strong>")
        else:
            out.append(f"<code>{e(m.group(5))}</code>")
        pos = m.end()
    out.append(e(text[pos:]))
    return "".join(out)


def resolve_link(href: str, links: dict[str, str]) -> str | None:
    if href.startswith(("http://", "https://")):
        return href
    name = href.split("#")[0].rsplit("/", 1)[-1]
    return links.get(name)  # another public note, or None (keep the words, drop the link)


def markdown(md: str, links: dict[str, str], refs: dict[str, dict]) -> str:
    """Paragraphs and (one level of) bullet or numbered lists. Enough for "In plain words"."""
    html_out, para, items, list_tag = [], [], [], None

    def flush_para():
        if para:
            html_out.append(f"<p>{inline(' '.join(para), links, refs)}</p>")
            para.clear()

    def flush_list():
        nonlocal list_tag
        if items:
            html_out.append(f"<{list_tag}>" + "".join(f"<li>{inline(i, links, refs)}</li>" for i in items) + f"</{list_tag}>")
            items.clear()
        list_tag = None

    for raw in md.splitlines():
        line = raw.rstrip()
        bullet = re.match(r"^\s*(?:[-*]|(\d+)\.)\s+(.*)$", line)
        if not line.strip():
            flush_para()
            continue
        if line.lstrip().startswith(("|", "```", "<!--", "#")):
            continue  # tables, code and headings do not belong in a plain summary
        if bullet:
            flush_para()
            tag = "ol" if bullet.group(1) else "ul"
            if list_tag and tag != list_tag and not raw.startswith(" "):
                flush_list()
            list_tag = list_tag or tag
            items.append(bullet.group(2))
        elif items and raw.startswith(" "):
            items[-1] += " " + line.strip()
        else:
            flush_list()
            para.append(line.strip())
    flush_para()
    flush_list()
    return "\n".join(html_out)


def plain_text(md: str, limit: int = 158) -> str:
    """A meta description: the first sentences of the markdown, without markup."""
    t = re.sub(r"\[@[\w:-]+\]", "", md)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"[*`#>|]", "", t)
    t = re.sub(r"^\s*(?:-|\d+\.)\s+", "", t, flags=re.M)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(" ", 1)[0].rstrip(",;:")
    return cut + "..."


# ---------------------------------------------------------------- page shell

CSS = """
:root{color-scheme:dark;--bg:#07080d;--card:#0c0e15;--card-2:#11131c;--line:#a9b6ff14;--line-2:#a9b6ff24;
--text:#f1f3f9;--muted:#a3a8b9;--faint:#8a8fa2;--blue-text:#85a8ff;--good:#4cc98a;--bad:#f07a7a;--warn:#e8c06a;--wrap:880px}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text)}html{overflow-x:clip}
body{font:16px/1.65 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:clip}
a{color:var(--blue-text);text-underline-offset:3px}a:hover{color:#fff}
:focus-visible{outline:2px solid var(--blue-text);outline-offset:2px;border-radius:6px}
.wrap{width:100%;max-width:var(--wrap);margin:0 auto;padding:0 20px}
.skip{position:absolute;left:-999px;top:8px;background:#fff;color:#000;padding:8px 12px;border-radius:8px;z-index:9}.skip:focus{left:8px}
header{border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px 20px;min-height:68px;flex-wrap:wrap}
.brand img{display:block;height:36px;width:auto}
nav.site,nav.acct{display:flex;gap:4px 16px;align-items:center;font-size:15px}nav.site{margin-left:auto;flex-wrap:wrap}nav.site a,nav.acct a:not(.btn){color:var(--muted);text-decoration:none}nav.site a:hover,nav.acct a:not(.btn):hover,nav.site a[aria-current]{color:var(--text)}
/* On a phone: the logo with Log in and Sign up on one row, the sections on the next. */
@media (max-width:640px){header .wrap{row-gap:0;padding-top:10px}nav.acct{margin-left:auto}nav.site{order:3;width:100%;margin:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:10px 0;gap:18px}nav.acct .btn{height:34px;padding:0 14px}}
.btn{display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 18px;border-radius:999px;font-weight:500;text-decoration:none;border:1px solid var(--line-2);color:var(--text);white-space:nowrap}
.btn.primary{background:#2a5ff0;border-color:#2a5ff0;color:#fff}.btn.primary:hover{background:#2257d6;color:#fff}
main{padding:40px 0 64px}
.crumbs{font-size:14px;color:var(--faint);margin:0 0 18px}.crumbs a{color:var(--muted)}
h1{font-size:clamp(28px,5vw,40px);line-height:1.15;letter-spacing:-.01em;margin:0 0 12px;overflow-wrap:anywhere}
h2{font-size:20px;margin:36px 0 10px}h3{font-size:16px;margin:0 0 6px}
.lede{font-size:18px;color:var(--muted);margin:0 0 24px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px;padding:0;list-style:none}
.pill{font-size:13px;color:var(--muted);border:1px solid var(--line-2);border-radius:999px;padding:2px 10px}
.pill.warn{color:var(--warn);border-color:#e8c06a55}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:0 0 14px}
.card h2{margin-top:0;font-size:15px;color:var(--faint)}
.card p{margin:0}.card p+p{margin-top:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:0;list-style:none;margin:0}
.grid li a{display:block;height:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:var(--text)}
.grid li a:hover{border-color:var(--line-2);background:var(--card-2)}.grid small{display:block;color:var(--muted);font-size:14px;margin-top:4px}
.prose p,.prose li{color:#dfe2ec}.prose code,.card code{font-size:.9em;background:var(--card-2);padding:1px 5px;border-radius:5px;overflow-wrap:anywhere}
.related{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}.related a{display:inline-block;border:1px solid var(--line-2);border-radius:999px;padding:4px 12px;text-decoration:none;color:var(--text);font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--faint);font-weight:500}
.tablewrap{overflow-x:auto}
.fig{background:#0c0e15;border:1px solid var(--line);border-radius:14px;padding:10px;margin:0 0 14px}.fig svg{display:block;width:100%;height:auto}
.fig figcaption{padding:8px 6px 2px;font-size:14px;color:var(--muted)}.fig figcaption ol{margin:6px 0 0;padding-left:20px}
details{margin:6px 0 0}summary{cursor:pointer;color:var(--blue-text)}.q{margin:0 0 16px}.q ul{margin:6px 0;padding-left:20px;color:#dfe2ec}
.pager{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 0}
.cta{margin:48px 0 0;background:linear-gradient(135deg,#101633,#0c0e15);border:1px solid var(--line-2);border-radius:16px;padding:24px}
.cta p{margin:0 0 14px;color:var(--muted)}.cta strong{color:var(--text);display:block;font-size:18px;margin-bottom:4px}
footer{border-top:1px solid var(--line);padding:28px 0 40px;font-size:14px;color:var(--faint)}footer nav{display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:10px}footer a{color:var(--muted)}footer p{margin:6px 0}
"""


def jsonld(obj: dict) -> str:
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>"


def org_ld() -> dict:
    return {"@type": "Organization", "@id": f"{SITE}/#org", "name": ORG, "alternateName": "Parity", "url": f"{SITE}/",
            "logo": f"{SITE}/icon-512.png", "email": CONTACT}


def crumbs_ld(trail: list[tuple[str, str]]) -> dict:
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": name, "item": f"{SITE}{path}"} for i, (name, path) in enumerate(trail)]}


# The public sections, in the order the header lists them. Blog and News are built by
# scripts/newsroom/build.py (DEC-0057).
NAV = (("learn", "/learn/", "Learn"), ("ideas", "/ideas/", "Ideas"), ("notes", "/notes/", "Notes"),
       ("blog", "/blog/", "Blog"), ("news", "/news/", "News"))


def nav_html(section: str, path: str = "") -> str:
    """The header links; the current section is marked, as the page itself on a section's front page."""
    cur = ' aria-current="page"' if path in {h for _, h, _ in NAV} else ' aria-current="true"'
    return "".join(f'<a href="{href}"{cur if section == key else ""}>{label}</a>' for key, href, label in NAV)


def page(*, path: str, title: str, description: str, body: str, section: str, trail: list[tuple[str, str]],
         ld: list[dict], og_type: str = "article") -> str:
    url = f"{SITE}{path}"
    image = f"{SITE}/og/{section}.png"
    full_title = f"{title} | Parity" if path != "/" else title
    graph = {"@context": "https://schema.org", "@graph": [org_ld(), crumbs_ld(trail), *ld]}
    nav = nav_html(section, path)
    crumb_html = " / ".join(f'<a href="{p}">{e(n)}</a>' for n, p in trail[:-1]) + (" / " if len(trail) > 1 else "")
    legal = "".join(f'<a href="{h}">{n}</a>' for h, n in LEGAL)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(full_title)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="{SITE_JSON['themeColor']}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:site_name" content="Parity">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(description)}">
<meta name="twitter:image" content="{image}">
{jsonld(graph)}
<style>{CSS.strip()}</style>
<!--parity-analytics--><script type="module" src="/a/boot.js"></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header><div class="wrap">
<a class="brand" href="/"><img src="{LOGO}" width="154" height="36" alt="Parity home"></a>
<nav class="site" aria-label="Site">{nav}</nav>
<nav class="acct" aria-label="Account"><a href="/login/">Log in</a><a class="btn primary" href="/signup/">Sign up</a></nav>
</div></header>
<main id="main"><div class="wrap">
<p class="crumbs">{crumb_html}<span aria-current="page">{e(trail[-1][0])}</span></p>
{body}
<aside class="cta" aria-label="Sign up">
<strong>See Parity's test results</strong>
<p>Parity tests trading ideas against the S&amp;P 500. Members see every result, including the ones that failed. Accounts are free.</p>
<a class="btn primary" href="/signup/">Create a free account</a>
</aside>
</div></main>
<footer><div class="wrap">
<nav aria-label="Legal">{legal}</nav>
<p>{DISCLAIMER}</p>
<p>&copy; 2026 {ORG} &middot; <a href="mailto:{CONTACT}">{CONTACT}</a></p>
</div></footer>
</body>
</html>
"""


# ---------------------------------------------------------------- the three sections

def slug_ok(s: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9][a-z0-9-]*", s))


def build_learn(terms: list[dict], refs: dict) -> dict[str, str]:
    by_id = {t["id"]: t for t in terms}
    pages = {}
    for t in terms:
        if not slug_ok(t["id"]):
            continue
        path = f"/learn/{t['id']}/"
        risk = f'<section class="card"><h2>What can go wrong</h2><p>{inline(t["risk"], {}, refs)}</p></section>' if t.get("risk") else ""
        rel = [by_id[r] for r in t.get("related", []) if r in by_id]
        rel_html = ('<h2>Related terms</h2><ul class="related">' +
                    "".join(f'<li><a href="/learn/{r["id"]}/">{e(r["term"])}</a></li>' for r in rel) + "</ul>") if rel else ""
        body = f"""<h1>What is {e(t['term'])}?</h1>
<ul class="meta"><li class="pill">{e(t['category'])}</li></ul>
<section class="card"><h2>In simple words</h2><p>{inline(t['simple'], {}, refs)}</p></section>
<section class="card"><h2>Think of it like this</h2><p>{inline(t['analogy'], {}, refs)}</p></section>
<section class="card"><h2>The precise version</h2><p>{inline(t['precise'], {}, refs)}</p></section>
{risk}
{rel_html}"""
        ld = {"@type": "DefinedTerm", "@id": f"{SITE}{path}#term", "name": t["term"], "description": t["simple"],
              "url": f"{SITE}{path}", "inDefinedTermSet": {"@type": "DefinedTermSet", "@id": f"{SITE}/learn/#set",
                                                         "name": "Parity glossary", "url": f"{SITE}/learn/"}}
        pages[path] = page(path=path, title=f"{t['term']}: what it means", description=plain_text(t["simple"]),
                           body=body, section="learn", trail=[("Home", "/"), ("Learn", "/learn/"), (t["term"], path)], ld=[ld])
    cats: dict[str, list[dict]] = {}
    for t in terms:
        cats.setdefault(t["category"], []).append(t)
    groups = "".join(
        f'<h2 id="{re.sub(r"[^a-z0-9]+", "-", c.lower()).strip("-")}">{e(c)}</h2><ul class="grid">' +
        "".join(f'<li><a href="/learn/{t["id"]}/">{e(t["term"])}<small>{e(plain_text(t["simple"], 90))}</small></a></li>' for t in ts) +
        "</ul>" for c, ts in sorted(cats.items()))
    body = f"""<h1>Learn the words of trading and research</h1>
<p class="lede">{len(terms)} terms. Each has a simple explanation, an everyday comparison and a precise definition.</p>
<ul class="grid"><li><a href="/learn/academy/">Parity Academy<small>Short courses with step-by-step pictures: backtests, luck, how markets move, currencies, rates, crypto, private markets and news.</small></a></li><li><a href="/learn/edge-lab/">How to look for a trading edge without fooling yourself<small>Seven lessons on how backtests mislead, each with a mistake we found in our own research.</small></a></li>
<li><a href="/learn/private-markets/">Private markets, explained simply<small>Private equity, venture, private credit and property funds: how their returns are measured, why their reported prices move less than share prices, and what to check.</small></a></li></ul>
{groups}"""
    ld = {"@type": "DefinedTermSet", "@id": f"{SITE}/learn/#set", "name": "Parity glossary", "url": f"{SITE}/learn/",
          "hasDefinedTerm": [{"@id": f"{SITE}/learn/{t['id']}/#term"} for t in terms if slug_ok(t["id"])]}
    pages["/learn/"] = page(path="/learn/", title="Trading and research glossary, explained simply",
                            description=f"{len(terms)} trading, markets and statistics terms explained in simple words, with an analogy and a precise definition.",
                            body=body, section="learn", trail=[("Home", "/"), ("Learn", "/learn/")], ld=[ld], og_type="website")
    return pages


def verdict(a: dict) -> tuple[str, str]:
    r = a.get("research") or {}
    if r.get("verdict"):
        return f"Parity verdict: {r['verdict']}", ""
    stage = r.get("stage") or 0
    name = STAGES[stage] if 0 <= stage < len(STAGES) else "catalogued"
    return f"Not yet judged by Parity (research stage: {name})", "warn"


def fmt_num(v, pct=False) -> str:
    if v is None:
        return "not reported"
    return f"{v * 100:.1f}%" if pct else f"{v:.2f}"


def build_ideas(ideas: list[dict], refs: dict) -> dict[str, str]:
    pages = {}
    for a in ideas:
        if not slug_ok(a["slug"]):
            continue
        path = f"/ideas/{a['slug']}/"
        o = a.get("origin") or {}
        how = a.get("how_it_works") or {}
        src = o.get("source_title") or ""
        src_html = f'<a href="{e(o["source_url"])}" rel="nofollow noopener">{e(src)}</a>' if o.get("source_url") and src else e(src)
        origin = ", ".join(x for x in [e(o.get("authors") or ""), str(o.get("first_published") or "")] if x)
        rows = "".join(
            f"<tr><td>{e(r.get('source') or '')}</td><td>{e(r.get('market') or '')}</td><td>{e(r.get('period') or '')}</td>"
            f"<td>{fmt_num(r.get('sharpe'))}</td><td>{e((r.get('evidence_type') or '').replace('_', ' '))}</td></tr>"
            for r in a.get("reported_results") or [])
        evidence = (f'<h2>What others have reported</h2><p class="lede" style="font-size:15px">These are the sources\' own claims, '
                    f'not Parity results. Most are backtests, which tend to look better than live trading.</p>'
                    f'<div class="tablewrap"><table><thead><tr><th>Source</th><th>Market</th><th>Period</th><th>Sharpe</th>'
                    f'<th>Evidence</th></tr></thead><tbody>{rows}</tbody></table></div>') if rows else ""
        after = f'<section class="card"><h2>After it was published</h2><p>{inline(a["post_publication_evidence"], {}, refs)}</p></section>' \
            if a.get("post_publication_evidence") else ""
        label, cls = verdict(a)
        pills = "".join(f'<li class="pill">{e(x)}</li>' for x in [a.get("family", "").replace("-", " "), a.get("horizon", "")] + a.get("markets", []) if x)
        body = f"""<h1>{e(a['name'])}</h1>
<ul class="meta"><li class="pill {cls}">{e(label)}</li>{pills}</ul>
<section class="card"><h2>What it is</h2><p>{inline(how.get('simple', ''), {}, refs)}</p><p>{inline(how.get('analogy', ''), {}, refs)}</p></section>
<section class="card"><h2>Why it might work</h2><p>{inline(a.get('economic_rationale', ''), {}, refs)}</p></section>
<section class="card"><h2>Why it might fail</h2><p>{inline(a.get('why_it_might_fail', ''), {}, refs)}</p></section>
{after}
<section class="card"><h2>Where it came from</h2><p>{origin}{'. ' if origin and src_html else ''}{src_html}</p></section>
<section class="card"><h2>The precise version</h2><p>{inline(how.get('precise', ''), {}, refs)}</p></section>
{evidence}"""
        ld = {"@type": "Article", "@id": f"{SITE}{path}#article", "headline": a["name"][:110],
              "description": plain_text(how.get("simple", "")), "url": f"{SITE}{path}", "mainEntityOfPage": f"{SITE}{path}",
              "author": {"@id": f"{SITE}/#org"}, "publisher": {"@id": f"{SITE}/#org"}, "image": f"{SITE}/og/ideas.png",
              "about": a.get("family", "").replace("-", " ")}
        if a.get("last_reviewed"):
            ld["dateModified"] = a["last_reviewed"]
        pages[path] = page(path=path, title=f"{a['name']}: how it works and the evidence", description=plain_text(how.get("simple", "")),
                           body=body, section="ideas", trail=[("Home", "/"), ("Ideas", "/ideas/"), (a["name"], path)], ld=[ld])
    items = "".join(f'<li><a href="/ideas/{a["slug"]}/">{e(a["name"])}<small>{e(plain_text(a["how_it_works"]["simple"], 90))}</small></a></li>'
                    for a in ideas if slug_ok(a["slug"]))
    body = f"""<h1>Trading ideas, with the evidence and the risks</h1>
<p class="lede">{len(ideas)} published trading ideas. Each page says what the idea is, where it came from, what the evidence says and why it might fail.
Reported numbers are the sources' own claims. Parity's results are marked separately.</p>
<ul class="grid">{items}</ul>"""
    ld = {"@type": "CollectionPage", "@id": f"{SITE}/ideas/#page", "name": "Trading ideas", "url": f"{SITE}/ideas/",
          "publisher": {"@id": f"{SITE}/#org"}}
    pages["/ideas/"] = page(path="/ideas/", title="Trading ideas, with the evidence and the risks",
                            description=f"{len(ideas)} trading strategy ideas from research papers and practitioners, each with its reported evidence, its risks and Parity's verdict where we have tested it.",
                            body=body, section="ideas", trail=[("Home", "/"), ("Ideas", "/ideas/")], ld=[ld], og_type="website")
    return pages


def build_notes(notes: list[dict], refs: dict) -> dict[str, str]:
    links = {n["file"]: f"/notes/{n['id'].lower()}/" for n in notes}
    pages = {}
    for n in notes:
        path = f"/notes/{n['id'].lower()}/"
        body = f"""<h1>{e(n['title'])}</h1>
<ul class="meta"><li class="pill">{e(n['kind'])} {e(n['id'])}</li>{f'<li class="pill">Updated {e(n["updated"])}</li>' if n['updated'] else ''}</ul>
<div class="prose">{markdown(n['summary'], links, refs)}</div>
<p class="lede" style="font-size:14px;margin-top:24px">This is the plain-words summary. The full note, with its reasoning and sources, is on the research side for members.</p>"""
        ld = {"@type": "Article", "@id": f"{SITE}{path}#article", "headline": n["title"][:110], "description": plain_text(n["summary"]),
              "url": f"{SITE}{path}", "mainEntityOfPage": f"{SITE}{path}", "author": {"@id": f"{SITE}/#org"},
              "publisher": {"@id": f"{SITE}/#org"}, "image": f"{SITE}/og/notes.png", "articleSection": n["kind"]}
        if n["created"]:
            ld["datePublished"] = n["created"]
        if n["updated"]:
            ld["dateModified"] = n["updated"]
        pages[path] = page(path=path, title=n["title"], description=plain_text(n["summary"]), body=body, section="notes",
                           trail=[("Home", "/"), ("Notes", "/notes/"), (n["id"], path)], ld=[ld])
    groups = ""
    for kind in NOTE_TYPES.values():
        ns = [n for n in notes if n["kind"] == kind]
        if ns:
            groups += f"<h2>{e(kind)}s</h2><ul class=\"grid\">" + "".join(
                f'<li><a href="/notes/{n["id"].lower()}/">{e(n["title"])}<small>{e(n["id"])}</small></a></li>' for n in ns) + "</ul>"
    body = f"""<h1>Research notes in plain words</h1>
<p class="lede">How Parity decides what to build, what the research found and how the numbers are defined, each in a short plain summary.</p>
{groups}"""
    ld = {"@type": "CollectionPage", "@id": f"{SITE}/notes/#page", "name": "Research notes", "url": f"{SITE}/notes/",
          "publisher": {"@id": f"{SITE}/#org"}}
    pages["/notes/"] = page(path="/notes/", title="Research notes in plain words",
                            description="Parity's decisions, research findings and reference notes, each summarised in plain words.",
                            body=body, section="notes", trail=[("Home", "/"), ("Notes", "/notes/")], ld=[ld], og_type="website")
    return pages


EDGE_CHECKS = [
    ("What data does the signal use, and when was each value really public?", "look-ahead"),
    ("How many variations did you try before this one, counting every changed setting?", "multiple-testing"),
    ("Could you really trade at the prices in the backtest, or are they averages, index levels or spot prices?", "too-good"),
    ("Have you already looked at the test period, and is there data you have never seen?", "out-of-sample"),
    ("How often does it trade, and at what cost per trade does the gain fall to zero?", "costs"),
    ("Is the Sharpe ratio above 2, or is it in cash most of the time?", "too-good"),
    ("Is it from a published paper, and how did it do after publication?", "capacity"),
    ("Does it trade small or thinly traded markets where your own orders move the price?", "capacity"),
    ("Did you write the rule and the pass mark down before running it?", "register"),
]


def build_edge_lab(lab: dict, notes: list[dict], terms: list[dict], refs: dict) -> dict[str, str]:
    """One public page: the Edge Lab lessons and our real examples, with a static checklist."""
    note_ids = {n["id"] for n in notes}
    term_names = {t["id"]: t["term"] for t in terms}
    lessons = {l["id"]: l for l in lab["lessons"]}

    def doc_link(doc: str, label: str) -> str:
        # Only docs with a public summary get a link; the rest keep their words.
        return f'<a href="/notes/{doc.lower()}/">{e(label)}</a>' if doc in note_ids else e(label)

    def ref_link(key: str) -> str:
        r = refs.get(key)
        if not r:
            return ""
        who = (r.get("authors") or [""])[0].split(",")[0]
        label = f"{who} {r.get('year') or ''}".strip() or r["title"]
        url = r.get("url") or (f"https://doi.org/{r['doi']}" if r.get("doi") else "")
        return f'<a href="{e(url)}" rel="nofollow noopener">{e(label)}</a>' if url else e(label)

    def anchor(href: str, label: str) -> str:
        return f'<a href="{e(href)}">{e(label)}</a>'

    blocks = []
    for i, l in enumerate(lab["lessons"], 1):
        ex = [anchor(f"#ex-{x['id']}", x["title"]) for x in lab["examples"] if l["id"] in x["lessons"]]
        more = [doc_link(k["doc"], k["label"]) for k in l["links"] if k.get("doc")]
        more += [x for x in (ref_link(r) for r in l["refs"]) if x]
        words = [anchor(f"/learn/{t}/", term_names[t]) for t in l["terms"] if t in term_names]
        parts = [f'<section class="card" id="{e(l["id"])}"><h3>{i}. {e(l["title"])}</h3>',
                 f'<p>{e(l["text"])}</p><p><strong>What we do:</strong> {e(l["do"])}</p>']
        if ex:
            parts.append(f"<p>Our example: {', '.join(ex)}</p>")
        if more:
            parts.append(f"<p>Read more: {' &middot; '.join(more)}</p>")
        if words:
            parts.append(f"<p>Words: {', '.join(words)}</p>")
        blocks.append("".join(parts) + "</section>")
    examples = []
    for x in lab["examples"]:
        to = ", ".join(anchor(f"#{k}", lessons[k]["title"]) for k in x["lessons"] if k in lessons)
        examples.append(f'<section class="card" id="ex-{e(x["id"])}"><h3>{e(x["title"])}</h3><p>{e(x["text"])}</p>'
                        f'<p>Lesson: {to} &middot; {doc_link(x["doc"], x["doc"])}</p></section>')
    checks = "".join(f"<li>{e(q)} {anchor('#' + k, lessons[k]['title'])}</li>" for q, k in EDGE_CHECKS if k in lessons)
    reading = [doc_link(r["doc"], r["label"]) for r in lab["reading"] if r.get("doc") in note_ids]
    reading_html = ('<h2>Further reading</h2><ul class="related">' + "".join(f"<li>{x}</li>" for x in reading) + "</ul>") if reading else ""
    path = "/learn/edge-lab/"
    title = "How to look for a trading edge without fooling yourself"
    body = f"""<h1>{e(title)}</h1>
<p class="lede">{e(lab["intro"])}</p>
<h2>{len(lab["lessons"])} lessons</h2>
{"".join(blocks)}
<h2>Our own mistakes</h2>
<p>Each of these looked like an edge in our backtests until we found the flaw.</p>
{"".join(examples)}
<h2>Questions to ask about any idea</h2>
<div class="prose"><ol>{checks}</ol></div>
<p class="lede" style="font-size:14px">Members get an interactive version of this checklist that ranks the pitfalls for a specific idea.</p>
{reading_html}"""
    ld = {"@type": "Article", "@id": f"{SITE}{path}#article", "headline": title, "description": plain_text(lab["intro"]),
          "url": f"{SITE}{path}", "mainEntityOfPage": f"{SITE}{path}", "author": {"@id": f"{SITE}/#org"},
          "publisher": {"@id": f"{SITE}/#org"}, "image": f"{SITE}/og/learn.png", "articleSection": "Learn"}
    return {path: page(path=path, title=title, description=plain_text(lab["intro"]), body=body, section="learn",
                       trail=[("Home", "/"), ("Learn", "/learn/"), ("Edge Lab", path)], ld=[ld])}


# ---------------------------------------------------------------- Parity Academy (DEC-0028)

ACADEMY_NOTE = ("Pictures use made-up or example numbers unless they say otherwise. "
                "Members get the moving version of each picture and a quick check that saves their progress.")
# Parity Academy, the signed-in course player (DEC-0042). The path works on every address
# of the site; on endyland.com the app also answers at academy.endyland.com.
ACADEMY_APP = "/academy/"


def academy_app_link(path: str, label: str) -> str:
    """A link from a public Academy page into the same place in Parity Academy (sign-in)."""
    return f'<p><a class="btn" href="{ACADEMY_APP}#/{path}">{e(label)}</a></p>'


def academy_link(k: dict, term_ids: set[str]) -> str:
    """A lesson's "in Parity" link: the public page when there is one, else the app (sign-in)."""
    href = k["href"]
    m = re.match(r"#/learn/([a-z0-9-]+)$", href)
    if m and m.group(1) in term_ids:
        return f"/learn/{m.group(1)}/"
    if href.startswith("#/edges"):
        return "/learn/edge-lab/"
    m = re.match(r"#/academy/([a-z0-9-]+)(?:/([a-z0-9-]+))?$", href)
    if m:
        return f"/learn/academy/{m.group(1)}/" + (f"{m.group(2)}/" if m.group(2) else "")
    # Try settings, What if, Compare and Strategy search live in Parity Workbench (DEC-0043).
    m = re.match(r"#/(lab|scenarios|compare|search)(\?.*)?$", href)
    if m:
        view = {"lab": "try", "scenarios": "whatif", "compare": "compare", "search": "search"}[m.group(1)]
        keep = (m.group(2) or "") if view in ("whatif", "search") else ""
        return f"/lab/#/{view}{keep}"
    return ("/research/" if k["space"] == "research" else "/app/") + href


def build_academy(courses: list[dict], terms: list[dict], refs: dict) -> dict[str, str]:
    term_names = {t["id"]: t["term"] for t in terms}
    frames = academy_frames()
    pages = {}
    base = "/learn/academy/"
    for c in courses:
        if not slug_ok(c["id"]):
            continue
        cpath = f"{base}{c['id']}/"
        minutes = sum(l["minutes"] for l in c["lessons"])
        n = len(c["lessons"])
        for i, l in enumerate(c["lessons"]):
            if not slug_ok(l["id"]):
                continue
            path = f"{cpath}{l['id']}/"
            v = l["visual"]
            steps = "".join(f"<li>{e(s['caption'])}</li>" for s in v["steps"])
            shot = (frames.get(f"{c['id']}/{l['id']}") or [""])[-1]
            svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270" role="img" aria-label="{e(v["alt"])}">{shot}</svg>'
                   if shot else f'<p>{e(v["alt"])}</p>')
            fig = (f'<figure class="fig">{svg}<figcaption>The picture, step by step (the still above is the last step):'
                   f"<ol>{steps}</ol></figcaption></figure>")
            body_text = "".join(f"<p>{inline(p, {}, refs)}</p>" for p in l["body"])
            links = "".join(f'<li><a href="{e(academy_link(k, set(term_names)))}">{e(k["label"])}</a></li>' for k in l["inParity"])
            words = [f'<a href="/learn/{t}/">{e(term_names[t])}</a>' for t in l["terms"] if t in term_names]
            qs = []
            for j, q in enumerate(l["check"], 1):
                opts = "".join(f"<li>{e(o)}</li>" for o in q["options"])
                qs.append(f'<div class="q"><p><strong>{j}. {e(q["q"])}</strong></p><ul>{opts}</ul>'
                          f'<details><summary>Show the answer</summary><p>{e(q["options"][q["answer"]])}. {e(q["why"])}</p></details></div>')
            prev = c["lessons"][i - 1] if i > 0 else None
            nxt = c["lessons"][i + 1] if i + 1 < n else None
            back = (cpath + prev["id"] + "/", "Previous: " + prev["title"]) if prev else (cpath, "Course: " + c["title"])
            fwd = (cpath + nxt["id"] + "/", "Next: " + nxt["title"]) if nxt else (base, "All courses")
            pager = (f'<nav class="pager" aria-label="Lessons"><a href="{back[0]}">{e(back[1])}</a>'
                     f'<a href="{fwd[0]}">{e(fwd[1])}</a></nav>')
            body = f"""<h1>{e(l['title'])}</h1>
<ul class="meta"><li class="pill"><a href="{cpath}" style="color:inherit">{e(c['title'])}</a></li><li class="pill">Lesson {i + 1} of {n}</li><li class="pill">{l['minutes']} minutes</li></ul>
<div class="prose">{body_text}</div>
{fig}
<section class="card"><h2>In Parity</h2><ul class="related">{links}</ul></section>
{f'<p>Words: {", ".join(words)}</p>' if words else ''}
<section class="card"><h2>Quick check</h2>{''.join(qs)}</section>
{pager}
{academy_app_link(f"{c['id']}/{l['id']}", "Open this lesson in Parity Academy")}
<p class="lede" style="font-size:14px;margin-top:24px">{e(ACADEMY_NOTE)}</p>"""
            ld = {"@type": "LearningResource", "@id": f"{SITE}{path}#lesson", "name": l["title"], "url": f"{SITE}{path}",
                  "description": plain_text(l["body"][0]), "learningResourceType": "Lesson", "timeRequired": f"PT{l['minutes']}M",
                  "inLanguage": "en", "isAccessibleForFree": True, "provider": {"@id": f"{SITE}/#org"},
                  "isPartOf": {"@id": f"{SITE}{cpath}#course"}}
            pages[path] = page(path=path, title=f"{l['title']}: {c['title']}", description=plain_text(" ".join(l["body"])),
                               body=body, section="learn", ld=[ld],
                               trail=[("Home", "/"), ("Learn", "/learn/"), ("Academy", base), (c["title"], cpath), (l["title"], path)])
        rows = "".join(f'<li><a href="{cpath}{l["id"]}/">{e(l["title"])}<small>{l["minutes"]} minutes. {e(plain_text(l["body"][0], 110))}</small></a></li>'
                       for l in c["lessons"] if slug_ok(l["id"]))
        body = f"""<h1>{e(c['title'])}</h1>
<p class="lede">{e(c['summary'])}</p>
<ul class="meta"><li class="pill">{e(c['level'])}</li><li class="pill">{n} lessons</li><li class="pill">About {minutes} minutes</li></ul>
<ul class="grid">{rows}</ul>
{academy_app_link(c['id'], "Take this course in Parity Academy")}
<p class="lede" style="font-size:14px;margin-top:24px">{e(ACADEMY_NOTE)}</p>"""
        ld = {"@type": "Course", "@id": f"{SITE}{cpath}#course", "name": c["title"], "description": c["summary"], "url": f"{SITE}{cpath}",
              "provider": {"@id": f"{SITE}/#org"}, "inLanguage": "en", "isAccessibleForFree": True, "timeRequired": f"PT{minutes}M",
              "hasPart": [{"@id": f"{SITE}{cpath}{l['id']}/#lesson"} for l in c["lessons"] if slug_ok(l["id"])]}
        pages[cpath] = page(path=cpath, title=f"{c['title']}: a short course", description=plain_text(c["summary"]), body=body,
                            section="learn", ld=[ld], trail=[("Home", "/"), ("Learn", "/learn/"), ("Academy", base), (c["title"], cpath)])
    cards = "".join(
        f'<section class="card"><h3><a href="{base}{c["id"]}/">{e(c["title"])}</a></h3>'
        f'<p>{e(c["summary"])}</p><p>{e(c["level"])}, {len(c["lessons"])} lessons</p></section>' for c in courses if slug_ok(c["id"]))
    total = sum(len(c["lessons"]) for c in courses)
    body = f"""<h1>Parity Academy</h1>
<p class="lede">{len(courses)} short courses, {total} lessons of two or three minutes. Each lesson has a few plain paragraphs, a picture that explains the idea step by step, a link to the real page in Parity and a quick check.</p>
{cards}
{academy_app_link("", "Open Parity Academy")}
<p class="lede" style="font-size:14px;margin-top:24px">{e(ACADEMY_NOTE)}</p>"""
    ld = {"@type": "ItemList", "@id": f"{SITE}{base}#courses", "name": "Parity Academy courses",
          "itemListElement": [{"@type": "ListItem", "position": k + 1, "url": f"{SITE}{base}{c['id']}/"} for k, c in enumerate(courses)]}
    pages[base] = page(path=base, title="Parity Academy: short courses on markets and research",
                       description=f"{len(courses)} free short courses with step-by-step pictures: reading a backtest, luck vs skill, how markets move, currencies, rates, crypto, private markets and news.",
                       body=body, section="learn", ld=[ld], og_type="website", trail=[("Home", "/"), ("Learn", "/learn/"), ("Academy", base)])
    return pages


def build_private_markets(pm: dict, notes: list[dict], terms: list[dict]) -> dict[str, str]:
    """One public page: the Private markets guide, words only. No data from /data/ (DEC-0015)."""
    note_ids = {n["id"] for n in notes}
    term_names = {t["id"]: t["term"] for t in terms}

    def words(ids: list[str]) -> str:
        links = [f'<a href="/learn/{i}/">{e(term_names[i])}</a>' for i in ids if i in term_names]
        return f"<p>Words: {', '.join(links)}</p>" if links else ""

    def items(xs: list[str]) -> str:
        return "<ul>" + "".join(f"<li>{e(x)}</li>" for x in xs) + "</ul>"

    kinds = "".join(
        f'<section class="card" id="{e(c["id"])}"><h3>{e(c["name"])}</h3><p>{e(c["simple"])}</p>'
        f'<div class="prose"><p><strong>How it earns:</strong> {e(c["returns"])}</p>'
        f'<p><strong>Getting money out:</strong> {e(c["liquidity"])}</p><p><strong>Fees:</strong> {e(c["fees"])}</p>'
        f'<p><strong>What can go wrong:</strong></p>{items(c["risks"])}<p><strong>What to check:</strong></p>{items(c["check"])}</div>'
        f'{words(c["terms"])}</section>' for c in pm["classes"])
    measures = "".join(
        f'<section class="card" id="{e(m["id"])}"><h3>{e(m["name"])}</h3><p>{e(m["simple"])}</p>'
        f'<p><strong>Watch out:</strong> {e(m["pitfall"])}</p>{words([m["term"]])}</section>' for m in pm["measures"])
    routes = "".join(
        f'<section class="card" id="route-{e(r["id"])}"><h3>{e(r["name"])}</h3><p>{e(r["what"])}</p>'
        f'<div class="prose"><p><strong>Getting money out:</strong> {e(r["liquidity"])}</p><p><strong>Minimum:</strong> {e(r["minimum"])}</p>'
        f'<p><strong>What can go wrong:</strong></p>{items(r["risks"])}<p><strong>What to check:</strong></p>{items(r["check"])}</div>'
        f'{words([r["term"]])}</section>' for r in pm["routes"])
    free = {"yes": "free", "partly": "some free", "no": "paid"}
    providers = "".join(f"<li><strong>{e(x['name'])}</strong> ({free[x['free']]}): {e(x['what'])}. {e(x['note'])}</li>"
                        for x in pm["providers"])
    reading = [f'<li><a href="/notes/{r["doc"].lower()}/">{e(r["label"])}</a></li>' for r in pm["reading"] if r["doc"] in note_ids]
    reading_html = ('<h2>Further reading</h2><ul class="related">' + "".join(reading) + "</ul>") if reading else ""
    sm = pm["smoothing"]
    path = "/learn/private-markets/"
    title = "Private markets, explained simply"
    body = f"""<h1>{e(title)}</h1>
<p class="lede">{e(pm["intro"])}</p>
<h2>The kinds of private markets</h2>
{kinds}
<h2>How to read the numbers</h2>
{measures}
<section class="card"><h2>{e(sm["title"])}</h2><p>{e(sm["text"])}</p><div class="prose">{items(sm["points"])}</div></section>
<h2>Ways in for individuals</h2>
<p>Each of these gives something up: easy selling, low fees or a price set by a market.</p>
{routes}
<h2>Before you trust any private markets number</h2>
<div class="prose"><ol>{"".join(f"<li>{e(x)}</li>" for x in pm["checklist"])}</ol></div>
<h2>Who has the data</h2>
<div class="prose"><ul>{providers}</ul></div>
<p class="lede" style="font-size:14px">Members get a calculator for IRR, TVPI, DPI and PME, counts of private offerings filed with the SEC, and a study of how much smoothing hides.</p>
{reading_html}"""
    ld = {"@type": "Article", "@id": f"{SITE}{path}#article", "headline": title, "description": plain_text(pm["intro"]),
          "url": f"{SITE}{path}", "mainEntityOfPage": f"{SITE}{path}", "author": {"@id": f"{SITE}/#org"},
          "publisher": {"@id": f"{SITE}/#org"}, "image": f"{SITE}/og/learn.png", "articleSection": "Learn"}
    return {path: page(path=path, title=title, description=plain_text(pm["intro"]), body=body, section="learn",
                       trail=[("Home", "/"), ("Learn", "/learn/"), ("Private markets", path)], ld=[ld])}


# ---------------------------------------------------------------- output

STATIC_PUBLIC = ["/", "/legal/", "/legal/privacy/", "/legal/terms/", "/legal/cookies/", "/legal/accessibility/", "/legal/risk/", "/legal/regulatory/"]


def sitemap(urls: list[tuple[str, str]]) -> str:
    rows = "".join(f"<url><loc>{e(SITE + p)}</loc>{f'<lastmod>{m}</lastmod>' if m else ''}</url>\n" for p, m in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}</urlset>\n'


def fill_verification(out: Path) -> None:
    index = out / "index.html"
    if not index.exists():
        return
    text = index.read_text()
    tags = []
    for env, name in (("GSC_VERIFICATION", "google-site-verification"), ("BING_VERIFICATION", "msvalidate.01")):
        value = os.environ.get(env, "").strip()
        if re.fullmatch(r"[\w.-]{8,128}", value):
            tags.append(f'<meta name="{name}" content="{value}" />')
    index.write_text(text.replace("<!--seo:verify-->", "\n    ".join(tags)))


def write_academy_data(courses: list[dict], out: Path) -> None:
    """The courses as one JSON file for the hosted MCP server (DEC-0051), which cannot read
    academy/courses/ itself. Under /data/, so only signed-in people and the server read it."""
    keep = ("id", "title", "minutes", "body", "terms", "check")
    doc = [{"id": c["id"], "order": c["order"], "level": c["level"], "title": c["title"], "summary": c["summary"],
            "lessons": [{k: lesson[k] for k in keep if k in lesson} for lesson in c["lessons"]]} for c in courses]
    dest = out / "data" / "academy" / "courses.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(doc, ensure_ascii=False))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "web/dist"), help="the built site folder (default web/dist)")
    args = ap.parse_args()
    out = Path(args.out)
    if not out.is_dir():
        print(f"build_public: {out} does not exist; run the vite build first", file=sys.stderr)
        return 1
    refs = load_references()
    terms, ideas, notes = load_glossary(), load_ideas(), load_notes()
    pages = {**build_learn(terms, refs), **build_ideas(ideas, refs), **build_notes(notes, refs)}
    if "edge-lab" not in {t["id"] for t in terms}:  # a glossary term of that name would own the address
        pages.update(build_edge_lab(load_edge_lab(), notes, terms, refs))
    academy = load_academy()
    write_academy_data(academy, out)
    if "academy" not in {t["id"] for t in terms}:  # same rule for /learn/academy/
        pages.update(build_academy(academy, terms, refs))
    if "private-markets" not in {t["id"] for t in terms}:
        pages.update(build_private_markets(load_private_markets(), notes, terms))
    for path, text in pages.items():
        dest = out / path.strip("/") / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text)

    lastmod = {f"/ideas/{a['slug']}/": a.get("last_reviewed", "") for a in ideas}
    lastmod.update({f"/notes/{n['id'].lower()}/": n["updated"] for n in notes})
    urls = [(p, "") for p in STATIC_PUBLIC] + [(p, lastmod.get(p, "")) for p in sorted(pages)]

    # Blog and News (DEC-0057). They go in sitemap.xml but not in seo-manifest.json, so the
    # deploy never pushes them to IndexNow while the site is on its temporary address.
    sys.path.insert(0, str(ROOT / "scripts/newsroom"))
    from build import build_into  # noqa: PLC0415
    from model import ValidationError  # noqa: PLC0415
    try:
        newsroom_urls = build_into(out)
    except ValidationError as err:
        print("build_public: the blog and news pages did not build. Fix these:", file=sys.stderr)
        for p in err.problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    (out / "sitemap.xml").write_text(sitemap(urls + newsroom_urls))

    manifest = {}
    for p, _ in urls:
        f = out / p.strip("/") / "index.html" if p != "/" else out / "index.html"
        if f.exists():
            manifest[p] = hashlib.sha256(f.read_bytes()).hexdigest()[:16]
    (out / "seo-manifest.json").write_text(json.dumps({"site": SITE, "urls": manifest}, indent=0, sort_keys=True))
    fill_verification(out)
    lessons = sum(len(c["lessons"]) for c in academy)
    print(f"build_public: {len(terms)} terms, {len(ideas)} ideas, {len(notes)} notes, {len(academy)} courses ({lessons} lessons), "
          f"{len(urls)} URLs in sitemap.xml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
