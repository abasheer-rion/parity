#!/usr/bin/env python3
"""Builds Parity's public, indexable pages into the site build (DEC-0023).

    python3 scripts/seo/build_public.py --out web/dist

Run by `npm run build` in web/ after both vite builds. Standard library only.

It writes static HTML (no script, inline CSS, so pages paint at once) for:
  /learn/  and /learn/<term>/   every glossary term (docs/_system/glossary.json)
  /ideas/  and /ideas/<slug>/   every trading idea in catalog/algorithms/*.json
  /notes/  and /notes/<id>/     the "In plain words" part of decisions, research and references
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
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = os.environ.get("SITE_URL", "https://parity.endyland.com").rstrip("/")
ORG = "Parity Trading, Inc."
CONTACT = "contact@paritytrading.ai"
LOGO = "/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg"
STAGES = ["catalogued", "sourced", "hypothesis", "implemented", "registered", "official", "reproduced", "forward", "verdict"]
NOTE_TYPES = {"decisions": "Decision", "research": "Research note", "reference": "Reference"}
LEGAL = [("/legal/privacy/", "Privacy"), ("/legal/terms/", "Terms"), ("/legal/cookies/", "Cookies"),
         ("/legal/accessibility/", "Accessibility"), ("/legal/risk/", "Risk")]
DISCLAIMER = ("Research and education only. Not investment advice. Results are backtests and simulations, "
              "and the past does not promise the future.")

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
header{border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:68px;flex-wrap:wrap}
.brand img{display:block;height:36px;width:auto}
nav.site{display:flex;gap:4px 16px;flex-wrap:wrap;align-items:center;font-size:15px}nav.site a{color:var(--muted);text-decoration:none}nav.site a:hover,nav.site a[aria-current]{color:var(--text)}
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
.card h2{margin-top:0;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint)}
.card p{margin:0}.card p+p{margin-top:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:0;list-style:none;margin:0}
.grid li a{display:block;height:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:var(--text)}
.grid li a:hover{border-color:var(--line-2);background:var(--card-2)}.grid small{display:block;color:var(--muted);font-size:14px;margin-top:4px}
.prose p,.prose li{color:#dfe2ec}.prose code,.card code{font-size:.9em;background:var(--card-2);padding:1px 5px;border-radius:5px;overflow-wrap:anywhere}
.related{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}.related a{display:inline-block;border:1px solid var(--line-2);border-radius:999px;padding:4px 12px;text-decoration:none;color:var(--text);font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--faint);font-weight:500}
.tablewrap{overflow-x:auto}
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


def page(*, path: str, title: str, description: str, body: str, section: str, trail: list[tuple[str, str]],
         ld: list[dict], og_type: str = "article") -> str:
    url = f"{SITE}{path}"
    image = f"{SITE}/og/{section}.png"
    full_title = f"{title} | Parity" if path != "/" else title
    graph = {"@context": "https://schema.org", "@graph": [org_ld(), crumbs_ld(trail), *ld]}
    cur = ' aria-current="page"'
    nav = "".join(f'<a href="{href}"{cur if section == key else ""}>{label}</a>'
                  for key, href, label in (("learn", "/learn/", "Learn"), ("ideas", "/ideas/", "Ideas"), ("notes", "/notes/", "Notes")))
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
<meta name="theme-color" content="#07080d">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
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
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header><div class="wrap">
<a class="brand" href="/"><img src="{LOGO}" width="154" height="36" alt="Parity home"></a>
<nav class="site" aria-label="Site">{nav}<a href="/login/">Log in</a><a class="btn primary" href="/signup/">Sign up</a></nav>
</div></header>
<main id="main"><div class="wrap">
<p class="crumbs">{crumb_html}<span aria-current="page">{e(trail[-1][0])}</span></p>
{body}
<aside class="cta" aria-label="Sign up">
<strong>See the tests behind every idea</strong>
<p>Parity tests trading ideas against the S&amp;P 500 and shows every result, including the failures. Free to join.</p>
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
<p class="lede">{len(terms)} terms, each explained three ways: in simple words, with an everyday comparison, and precisely.</p>
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
{evidence}
<p class="lede" style="font-size:14px;margin-top:24px">This page describes an idea. It is not a recommendation to buy, sell or hold anything.</p>"""
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
<p class="lede">{len(ideas)} published trading ideas: what each one is, where it came from, what the evidence says and why it might fail.
Reported numbers are the sources' claims until Parity's own tests say otherwise.</p>
<ul class="grid">{items}</ul>"""
    ld = {"@type": "CollectionPage", "@id": f"{SITE}/ideas/#page", "name": "Trading ideas", "url": f"{SITE}/ideas/",
          "publisher": {"@id": f"{SITE}/#org"}}
    pages["/ideas/"] = page(path="/ideas/", title="Trading ideas, with the evidence and the risks",
                            description=f"{len(ideas)} trading strategy ideas from research papers and practitioners, each with its evidence, its risks and an honest verdict.",
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
<p class="lede" style="font-size:14px;margin-top:24px">This is the plain-words summary. The full note, with its reasoning and sources, is in the research side for members.</p>"""
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


# ---------------------------------------------------------------- output

STATIC_PUBLIC = ["/", "/legal/", "/legal/privacy/", "/legal/terms/", "/legal/cookies/", "/legal/accessibility/", "/legal/risk/"]


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
    for path, text in pages.items():
        dest = out / path.strip("/") / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text)

    lastmod = {f"/ideas/{a['slug']}/": a.get("last_reviewed", "") for a in ideas}
    lastmod.update({f"/notes/{n['id'].lower()}/": n["updated"] for n in notes})
    urls = [(p, "") for p in STATIC_PUBLIC] + [(p, lastmod.get(p, "")) for p in sorted(pages)]
    (out / "sitemap.xml").write_text(sitemap(urls))

    manifest = {}
    for p, _ in urls:
        f = out / p.strip("/") / "index.html" if p != "/" else out / "index.html"
        if f.exists():
            manifest[p] = hashlib.sha256(f.read_bytes()).hexdigest()[:16]
    (out / "seo-manifest.json").write_text(json.dumps({"site": SITE, "urls": manifest}, indent=0, sort_keys=True))
    fill_verification(out)
    print(f"build_public: {len(terms)} terms, {len(ideas)} ideas, {len(notes)} notes, {len(urls)} URLs in sitemap.xml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
