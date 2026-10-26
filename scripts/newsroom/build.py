#!/usr/bin/env python3
"""Builds the Parity blog and news pages into the site build (DEC-0057).

    python3 scripts/newsroom/build.py --out web/dist            # what the site build does
    python3 scripts/newsroom/build.py --out DIR --preview       # drafts too, for a local look

scripts/seo/build_public.py calls build_into() at the end of `npm run build`, so this
normally runs by itself. It writes static HTML in the dark style of the other public pages:

  /blog/  /blog/page/<n>/  /blog/category/<type>/  /blog/<slug>/      research, analysis, opinion, explainers
  /news/  /news/page/<n>/  /news/category/<type>/  /news/<slug>/      company news and press releases
  /authors/  /authors/<id>/   /tags/  /tags/<tag>/
  /blog/feed.xml /blog/atom.xml /news/feed.xml /news/atom.xml        RSS 2.0 and Atom
  /blog/index.json /news/index.json                                  what the search box reads
  /og/newsroom/<slug>.png   a share card per post     /newsroom/...   charts and image sizes

Only posts with `status = "published"` build. Every post is checked first (scripts/newsroom/model.py)
and the build stops on any problem. The preview builds drafts and posts in review as well,
each with a banner, and marks every page noindex.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import shutil
import subprocess
import sys
from email.utils import format_datetime
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "seo"))

import build_public as bp  # noqa: E402  the shared page style, site address and names
import charts  # noqa: E402
import model  # noqa: E402
from model import BLOG_TYPES, NEWS_TYPES, STANCE_NOTES, Post  # noqa: E402
from render import Renderer, plain  # noqa: E402

ROOT = model.ROOT
e = html.escape
PAGE_SIZE = 12
SECTIONS = {
    "blog": {"title": "Blog", "types": BLOG_TYPES,
             "lede": "Research write-ups, analysis, explainers and opinion from the Parity team. "
                     "Every post carries a label: fact-based reporting, analysis or opinion."},
    "news": {"title": "News", "types": NEWS_TYPES,
             "lede": "Company updates and press releases from Parity. Market news lives in the app."},
}
PLURALS = {"Explainer": "Explainers", "News": "News", "Company update": "Company updates", "Press release": "Press releases"}
LICENCE_URLS = {
    "Unsplash License": "https://unsplash.com/license",
    "Pexels License": "https://www.pexels.com/license/",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
}
LD_TYPES = {"Research": "Article", "Explainer": "Article", "Analysis": "AnalysisNewsArticle",
            "Opinion": "OpinionNewsArticle", "News": "NewsArticle", "Company update": "NewsArticle",
            "Press release": "NewsArticle"}

CSS = """
.wrap.wide{max-width:1120px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.progress{position:fixed;top:0;left:0;right:0;height:3px;background:var(--blue-text);transform:scaleX(0);transform-origin:0 50%;z-index:10;pointer-events:none}
.nr-top h1{margin:0}.nr-top .lede{margin:6px 0 20px;max-width:640px}
.nr-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.nr-filters a{display:inline-block;border:1px solid var(--line-2);border-radius:999px;padding:5px 14px;color:var(--muted);text-decoration:none;font-size:14px}
.nr-filters a[aria-current]{background:var(--text);color:var(--bg);border-color:var(--text)}
.nr-search{margin:0 0 28px}.nr-search input{width:100%;max-width:420px;height:42px;border-radius:10px;border:1px solid var(--line-2);background:var(--card);color:var(--text);padding:0 14px;font:inherit}
.nr-feature{display:grid;grid-template-columns:1.35fr 1fr;gap:28px;align-items:center;margin:0 0 40px;text-decoration:none;color:var(--text)}
.nr-feature h2{font-size:clamp(24px,3.4vw,34px);line-height:1.18;margin:0 0 10px;letter-spacing:-.01em}.nr-feature p{color:var(--muted);margin:0 0 12px;font-size:17px}
.nr-feature:hover h2{color:#fff;text-decoration:underline;text-underline-offset:4px}
.nr-thumb{display:block;aspect-ratio:16/9;overflow:hidden;border-radius:12px;background:var(--card-2);border:1px solid var(--line)}
.nr-thumb img{display:block;width:100%;height:100%;object-fit:cover;background-size:cover;background-position:center}
.nr-thumb.blank{display:flex;align-items:flex-end;padding:14px;color:var(--faint);font-size:14px;background:linear-gradient(135deg,#101633,#0c0e15)}
.nr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:30px 22px;list-style:none;padding:0;margin:0}
.nr-card a{display:block;text-decoration:none;color:var(--text)}.nr-card h3{font-size:19px;line-height:1.3;margin:14px 0 6px}
.nr-card a:hover h3{text-decoration:underline;text-underline-offset:3px}.nr-card p{margin:0 0 10px;color:var(--muted);font-size:15px}
.nr-meta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-size:13px;color:var(--faint)}
.stance{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;border:1px solid}
.s-fact{color:var(--good);border-color:#4cc98a55}.s-analysis{color:var(--blue-text);border-color:#85a8ff55}.s-opinion{color:var(--warn);border-color:#e8c06a77;background:#e8c06a14}
.sample{display:inline-block;font-size:12px;color:var(--warn);border:1px dashed #e8c06a88;border-radius:999px;padding:1px 8px}
.banner{border:1px dashed #e8c06a88;background:#e8c06a10;color:#f3dfae;border-radius:12px;padding:12px 16px;margin:0 auto 20px;font-size:15px;max-width:720px}
.nr-feeds{margin:28px 0 0;font-size:14px;color:var(--faint)}
.nr-article{max-width:1040px;margin:0 auto}
.nr-head{max-width:720px;margin:0 auto 26px}.nr-head h1{font-size:clamp(30px,5.4vw,48px);line-height:1.1;margin:0 0 14px}
.dek{font-size:20px;line-height:1.5;color:var(--muted);margin:0 0 18px}
.nr-label{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:0 0 14px;font-size:14px;color:var(--muted)}
.nr-label a{color:var(--muted)}
.nr-byline{font-size:15px;color:var(--faint);margin:0}.nr-byline a{color:var(--text)}
.nr-hero{margin:0 0 30px}.nr-hero .frame{aspect-ratio:16/9;overflow:hidden;border-radius:14px;border:1px solid var(--line);background:var(--card-2)}
.nr-hero img{display:block;width:100%;height:100%;object-fit:cover;background-size:cover;background-position:center}
.nr-hero figcaption,.nr-fig figcaption{font-size:14px;color:var(--faint);padding:10px 2px 0}.credit{color:var(--faint)}
.nr-body{max-width:720px;margin:0 auto;font-size:18px;line-height:1.7}
.nr-body h2{font-size:26px;margin:40px 0 12px;line-height:1.25}.nr-body h3{font-size:20px;margin:28px 0 8px}
.nr-body p,.nr-body li{color:#dfe2ec}.nr-body li{margin:0 0 6px}
.nr-body blockquote{margin:24px 0;padding:2px 0 2px 20px;border-left:3px solid var(--line-2);color:var(--muted)}
.pull{margin:34px 0;padding:0}.nr-body .pull blockquote{margin:0;border:0;border-top:1px solid var(--line-2);border-bottom:1px solid var(--line-2);padding:22px 0}
.pull p{font-size:clamp(22px,3vw,28px);line-height:1.35;color:var(--text);margin:0;letter-spacing:-.01em}
.note{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin:22px 0}.note p{margin:0;font-size:16px}
.nr-fig{margin:28px 0}.nr-fig img{display:block;width:100%;height:auto;border-radius:12px;border:1px solid var(--line);background-size:cover}
.cite{font-size:.7em;line-height:0}.cite a{text-decoration:none;padding:0 1px}
pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;overflow-x:auto;font-size:14px}
.nr-end{max-width:720px;margin:36px auto 0}
.nr-end h2{font-size:17px;margin:30px 0 10px;color:var(--faint);font-weight:600}
.sources{padding-left:22px;font-size:15px;color:var(--muted)}.sources li{margin:0 0 8px;overflow-wrap:anywhere}.sources li:target{color:var(--text)}
.corrections{list-style:none;padding:0;font-size:15px;color:var(--muted)}.corrections li{margin:0 0 8px}
.disclosure{font-size:14px;color:var(--faint);border-top:1px solid var(--line);padding-top:16px;margin-top:30px}
.share{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:18px 0 0}.share span{font-size:14px;color:var(--faint);margin-right:4px}
.share a,.share button{display:inline-flex;align-items:center;height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--line-2);background:none;color:var(--text);font:inherit;font-size:14px;text-decoration:none;cursor:pointer}
.share button{min-width:116px;justify-content:center}
.nr-related{max-width:1040px;margin:56px auto 0}
.nr-person{display:flex;gap:20px;align-items:center;margin:0 0 18px}.nr-person h1{margin:0 0 8px}.nr-person .meta{margin:0}
.nr-avatar{display:inline-block;flex:none;border-radius:50%;background:var(--card-2);border:1px solid var(--line-2);padding:6px}
.nr-avatar.initials{display:inline-flex;align-items:center;justify-content:center;padding:0;font-weight:600;color:var(--text);background:linear-gradient(135deg,#1b2a6b,#11131c)}
.grid li a.nr-author{display:flex;gap:12px;align-items:center}
@media (max-width:760px){.nr-feature{grid-template-columns:1fr;gap:14px}.nr-body{font-size:17px}.dek{font-size:18px}}
@media (prefers-reduced-motion:reduce){.progress{display:none}}
"""

# Progressive enhancement only: every page reads and links without it. Search results are
# built with DOM calls and textContent, so post text is never parsed as HTML.
SCRIPT = """(()=>{const b=document.querySelector('.progress'),a=document.querySelector('article');
if(b&&a){const f=()=>{const r=a.getBoundingClientRect(),t=r.height-innerHeight;b.style.transform='scaleX('+(t>0?Math.min(1,Math.max(0,-r.top/t)):1)+')'};addEventListener('scroll',f,{passive:true});addEventListener('resize',f);f()}
document.querySelectorAll('[data-copy]').forEach(x=>x.addEventListener('click',async()=>{let ok=true;try{await navigator.clipboard.writeText(x.dataset.copy)}catch{ok=false}x.textContent=ok?'Link copied':'Press Ctrl+C';setTimeout(()=>{x.textContent='Copy link'},2000)}));
const q=document.querySelector('[data-search]');if(!q)return;let all=null;const out=document.querySelector('[data-results]'),list=document.querySelector('[data-list]');
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n};
q.addEventListener('input',async()=>{const v=q.value.trim().toLowerCase();if(!v){out.hidden=true;list.hidden=false;return}
if(!all){try{all=await(await fetch(q.dataset.search)).json()}catch{all=[]}}
const hits=all.filter(p=>(p.title+' '+p.dek+' '+p.type+' '+p.tags.join(' ')+' '+p.authors.join(' ')).toLowerCase().includes(v));
out.replaceChildren();if(!hits.length){out.append(el('p','','No posts match that search.'))}else{const ul=el('ul','nr-grid');
for(const p of hits){const li=el('li','nr-card'),l=el('a');l.href=p.url;l.append(el('h3','',p.title),el('p','',p.dek),el('span','nr-meta',p.type+', '+p.date));li.append(l);ul.append(li)}out.append(ul)}
out.hidden=false;list.hidden=true})})();"""


def fmt_date(d: dt.date) -> str:
    return f"{d.day} {d:%b %Y}"


def stance_class(stance: str) -> str:
    return {"Fact-based reporting": "s-fact", "Analysis": "s-analysis", "Opinion": "s-opinion"}[stance]


def type_slug(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def count(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


def stamp(d: dt.date) -> str:
    return f"{d.isoformat()}T12:00:00Z"


# ---------------------------------------------------------------- share cards (1200 x 630)

def _text_w(s: str, size: float, bold: bool = False) -> float:
    w = 0.0
    for c in s:
        w += (0.25 if c == " " or c in "iljI!.,:;'|" else 0.34 if c in "frt()[]" else 0.82 if c in "mwMW"
              else 0.58 if c.isdigit() else 0.66 if c.isupper() else 0.52 if c.islower() else 0.6)
    return w * size * (1.05 if bold else 1)


def _wrap(text: str, size: float, width: float, most: int, bold: bool = False) -> list[str]:
    out, line = [], ""
    for word in text.split():
        nxt = f"{line} {word}" if line else word
        if not line or _text_w(nxt, size, bold) <= width:
            line = nxt
        else:
            out.append(line)
            line = word
    if line:
        out.append(line)
    if len(out) > most:
        out = out[:most]
        last = out[-1]
        while " " in last and _text_w(last + "...", size, bold) > width:
            last = last.rsplit(" ", 1)[0]
        out[-1] = last + "..."
    return out


def og_card_svg(kicker: str, title: str, sub: str) -> str:
    """The same layout as the site's /og/ cards (web/src/lib/og/card.ts), for one post."""
    W, H, PAD = 1200, 630, 80
    logo_svg = (ROOT / "web/public" / bp.LOGO.lstrip("/")).read_text()
    m = re.search(r"<svg\b[^>]*>", logo_svg)
    box = re.search(r'viewBox="([^"]+)"', m.group(0)).group(1) if m else "0 0 317 74"
    bw, bh = (float(x) for x in box.split()[2:4])
    inner = re.sub(r"<title>.*?</title>", "", logo_svg[m.end():] if m else "", flags=re.S)
    inner = re.sub(r"</svg>\s*$", "", inner)
    logo = f'<svg x="{PAD}" y="64" width="{round(60 * bw / bh)}" height="60" viewBox="{box}">{inner}</svg>'
    t = _wrap(title, 62, W - PAD * 2, 3, True)
    s = _wrap(sub, 28, W - PAD * 2 - 40, 1 if len(t) > 2 else 2)
    height = 82 + (len(t) - 1) * 74 + 56 + (len(s) - 1) * 40
    top = round(188 + max(0, 334 - height) / 2)
    tt = top + 82
    st = tt + (len(t) - 1) * 74 + 56
    grid = "".join(f"M{x} 0V{H}" for x in range(60, W, 60)) + "".join(f"M0 {y}H{W}" for y in range(60, H, 60))
    lines_t = "".join(f'<text x="{PAD}" y="{tt + i * 74}" font-size="62" font-weight="600" letter-spacing="-1">{e(x)}</text>' for i, x in enumerate(t))
    lines_s = "".join(f'<text x="{PAD}" y="{st + i * 40}" font-size="28" fill="#a3a8b9">{e(x)}</text>' for i, x in enumerate(s))
    host = re.sub(r"^https?://", "", bp.SITE)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs><radialGradient id="glow" cx="85%" cy="8%" r="75%"><stop offset="0" stop-color="#1b2a6b"/><stop offset=".62" stop-color="#07080d" stop-opacity="0"/></radialGradient></defs>
<rect width="{W}" height="{H}" fill="#07080d"/><rect width="{W}" height="{H}" fill="url(#glow)"/>
<path d="{grid}" stroke="#85a8ff" stroke-opacity=".05" stroke-width="1"/>{logo}
<g font-family="Inter" fill="#f1f3f9"><text x="{PAD}" y="{top}" font-size="24" font-weight="600" fill="#85a8ff">{e(kicker)}</text>
{lines_t}{lines_s}<text x="{PAD}" y="{H - 64}" font-size="24" font-weight="600" fill="#85a8ff">{e(host)}</text></g></svg>"""


# ---------------------------------------------------------------- images

def _image_size(p: Path) -> dict:
    """Width and height of a PNG or JPEG without any image library."""
    b = p.read_bytes()
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return {"width": int.from_bytes(b[16:20], "big"), "height": int.from_bytes(b[20:24], "big")}
    i = 2
    while b[:2] == b"\xff\xd8" and i < len(b) - 9:
        if b[i] == 0xFF and b[i + 1] in (0xC0, 0xC1, 0xC2):
            return {"height": int.from_bytes(b[i + 5:i + 7], "big"), "width": int.from_bytes(b[i + 7:i + 9], "big")}
        i += 2 + int.from_bytes(b[i + 2:i + 4], "big")
    return {"width": 1600, "height": 900}


class Media:
    """Collects the image work for one build, runs it once, and renders <picture> tags."""

    def __init__(self, out: Path, content: Path):
        self.out, self.content = out, content
        self.jobs: dict[str, dict] = {}
        self.og: list[dict] = []
        self.info: dict[str, dict] = {}
        self.og_done: set[str] = set()

    def key(self, src: str) -> str:
        return str((self.content / src).resolve())

    def want(self, src: str, slug: str, name: str) -> None:
        self.jobs[self.key(src)] = {"src": self.key(src), "outDir": str(self.out / "newsroom/img" / slug), "name": name,
                                    "widths": [480, 960, 1600], "_url": f"/newsroom/img/{slug}/"}

    def run(self) -> None:
        job = {"og": self.og, "images": [{k: v for k, v in j.items() if not k.startswith("_")} for j in self.jobs.values()]}
        data: dict = {"images": {}, "og": []}
        if (job["og"] or job["images"]) and not os.environ.get("NEWSROOM_NO_MEDIA"):  # the tests skip Node
            try:
                res = subprocess.run(["node", str(ROOT / "web/scripts/newsroom-media.mjs")], input=json.dumps(job),
                                     capture_output=True, text=True, timeout=300, check=True)
                data = json.loads(res.stdout)
            except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as err:
                print(f"newsroom: no image sizes or share cards ({err.__class__.__name__}); pages use the original files",
                      file=sys.stderr)
        self.og_done = set(data.get("og", []))
        for path, j in self.jobs.items():
            got = data.get("images", {}).get(path) or {"error": "not processed"}
            if "error" in got:  # the original file, still with its size so the page does not jump
                dest = Path(j["outDir"]) / Path(path).name
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, dest)
                got = {"fallback": j["_url"] + Path(path).name, **_image_size(Path(path))}
            got["url"] = j["_url"]
            self.info[path] = got

    def picture(self, src: str, alt: str, sizes: str, eager: bool = False) -> str:
        info = self.info.get(self.key(src), {})
        w, h = info.get("width", 1600), info.get("height", 900)
        load = 'fetchpriority="high" decoding="async"' if eager else 'loading="lazy" decoding="async"'
        if "variants" not in info:
            return f'<img src="{e(info.get("fallback", ""))}" alt="{e(alt)}" width="{w}" height="{h}" {load}>'
        v, base = info["variants"], info["url"]

        def srcset(fmt: str) -> str:
            return ", ".join(f"{base}{f} {wd}w" for wd, f in v[fmt])
        mid = v["jpg"][min(1, len(v["jpg"]) - 1)][1]
        return (f'<picture><source type="image/avif" srcset="{srcset("avif")}" sizes="{sizes}">'
                f'<source type="image/webp" srcset="{srcset("webp")}" sizes="{sizes}">'
                f'<img src="{base}{mid}" srcset="{srcset("jpg")}" sizes="{sizes}" alt="{e(alt)}" width="{w}" height="{h}" '
                f'style="background-image:url({info["blur"]})" {load}></picture>')


# ---------------------------------------------------------------- the builder

class Newsroom:
    def __init__(self, out: Path, preview: bool = False, content: Path | None = None):
        self.out = out
        self.preview = preview
        self.content = content or model.CONTENT
        self.authors = model.load_authors(self.content / "authors.toml")
        self.all_posts = model.load_posts(self.content)
        self.refs = model.load_references()
        self.media = Media(out, self.content)
        self.pages: dict[str, str] = {}
        self.files: dict[str, str] = {}
        self.chart_cache: dict[str, charts.Chart] = {}
        self.posts: list[Post] = []
        self.by_slug: dict[str, Post] = {}

    # ------------------------------------------------------------ checks
    def check(self) -> None:
        probs = model.validate(self.all_posts, self.authors, self.refs, self.content)
        if self.preview:  # a preview shows unfinished drafts rather than refusing them
            mine = {model.rel(p.file) for p in self.all_posts if p.status != "published"}
            probs = [x for x in probs if x.split(":")[0].split(" ")[0] not in mine]
        if probs:
            raise model.ValidationError(probs)
        self.posts = model.public_posts(self.all_posts, include_unpublished=self.preview)
        self.by_slug = {p.slug: p for p in self.posts}

    # ------------------------------------------------------------ pieces
    def chart(self, name: str) -> charts.Chart:
        if name not in self.chart_cache:
            self.chart_cache[name] = charts.draw(name)
            self.files[f"/newsroom/charts/{name}.svg"] = self.chart_cache[name].svg
        return self.chart_cache[name]

    def plan_media(self) -> None:
        for p in self.posts:
            h = p.hero
            if h and h.get("kind") in ("stock", "own"):
                self.media.want(h["src"], p.slug, "hero")
            for i, img in enumerate(p.images):
                if img.get("kind") != "chart":
                    self.media.want(img["src"], p.slug, f"img{i + 1}")
            self.media.og.append({"svg": og_card_svg(f"Parity {p.type.lower()}", p.title, p.dek),
                                  "out": str(self.out / "og/newsroom" / f"{p.slug}.png")})
        self.media.run()

    def og_image(self, p: Post) -> str:
        made = str(self.out / "og/newsroom" / f"{p.slug}.png") in self.media.og_done
        return f"{bp.SITE}/og/newsroom/{p.slug}.png" if made else f"{bp.SITE}/og/{p.section}.png"

    def hero_html(self, p: Post, sizes: str, eager: bool = False, thumb: bool = False) -> str:
        h = p.hero
        if not h:
            return f'<span class="nr-thumb blank">{e(p.type)}</span>' if thumb else ""
        if h.get("kind") == "chart":
            self.chart(h["chart"])
            load = 'fetchpriority="high"' if eager else 'loading="lazy"'
            img = (f'<img src="/newsroom/charts/{e(h["chart"])}.svg" alt="{e(h["alt"])}" width="1600" height="900" '
                   f'decoding="async" {load}>')
        else:
            img = self.media.picture(h["src"], h["alt"], sizes, eager)
        return f'<span class="nr-thumb">{img}</span>' if thumb else img

    def credit_html(self, img: dict) -> str:
        if img.get("kind") == "chart":
            return f'<span class="credit">Chart: Parity, from {e(self.chart(img["chart"]).source)}.</span>'
        lic = img.get("licence", "Parity own work")
        credit = e(img.get("credit", "Parity"))
        if img.get("source_url"):
            credit = f'<a href="{e(img["source_url"])}" rel="noopener">{credit}</a>'
        lic_html = f'<a href="{LICENCE_URLS[lic]}" rel="noopener">{e(lic)}</a>' if lic in LICENCE_URLS else e(lic)
        return f'<span class="credit">Image: {credit}, {lic_html}.</span>'

    def byline(self, p: Post, links: bool = True) -> str:
        names = [f'<a href="/authors/{a}/">{e(self.authors[a].name)}</a>' if links else e(self.authors[a].name)
                 for a in p.authors]
        return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]

    def avatar(self, a: model.Author, size: int) -> str:
        """Initials for a person (no photo until they supply one), the Parity mark for a house byline."""
        if a.kind == "house":
            return f'<img class="nr-avatar" src="/favicon.svg" width="{size}" height="{size}" alt="">'
        initials = "".join(w[0] for w in a.name.split()[:2]).upper()
        return (f'<span class="nr-avatar initials" style="width:{size}px;height:{size}px;font-size:{round(size * .38)}px" '
                f'aria-hidden="true">{e(initials)}</span>')

    def stance_pill(self, p: Post) -> str:
        return f'<span class="stance {stance_class(p.stance)}">{e(p.stance)}</span>'

    def meta_line(self, p: Post) -> str:
        flags = ' <span class="sample">Sample</span>' if p.sample else ""
        if p.status != "published":
            flags += f' <span class="sample">{e(p.status.capitalize())}</span>'
        kind = f"<span>{e(p.type)}</span>" if p.type != p.stance else ""
        return (f'<span class="nr-meta">{self.stance_pill(p)}{kind}<span>{self.byline(p, links=False)}</span>'
                f'<time datetime="{p.date.isoformat()}">{fmt_date(p.date)}</time><span>{p.read_minutes()} min read</span>{flags}</span>')

    def card(self, p: Post) -> str:
        return (f'<li class="nr-card"><a href="{p.path}">{self.hero_html(p, "(max-width: 760px) 100vw, 360px", thumb=True)}'
                f'<h3>{e(p.title)}</h3><p>{e(p.dek)}</p>{self.meta_line(p)}</a></li>')

    # ------------------------------------------------------------ the page shell
    def shell(self, *, path: str, title: str, description: str, body: str, section: str,
              trail: list[tuple[str, str]], ld: list[dict], og_type: str = "website", image: str | None = None,
              robots: str = "", head: str = "") -> str:
        url = f"{bp.SITE}{path}"
        image = image or f"{bp.SITE}/og/{section}.png"
        if self.preview:
            robots = "noindex, nofollow"
        graph = {"@context": "https://schema.org", "@graph": [bp.org_ld(), bp.crumbs_ld(trail), *ld]}
        crumbs = " / ".join(f'<a href="{p}">{e(n)}</a>' for n, p in trail[:-1]) + (" / " if len(trail) > 1 else "")
        feeds = "".join(f'<link rel="alternate" type="application/{k}+xml" title="Parity {SECTIONS[s]["title"]} ({n})" href="/{s}/{f}">'
                        for s in ("blog", "news") for k, n, f in (("rss", "RSS", "feed.xml"), ("atom", "Atom", "atom.xml")))
        legal = "".join(f'<a href="{h}">{n}</a>' for h, n in bp.LEGAL)
        robots_tag = f'<meta name="robots" content="{robots}">\n' if robots else ""
        # The same opt-in analytics boot file as every other public page (DEC-0053). The local
        # preview has no site build to load it from, so it leaves it out.
        analytics = "" if self.preview else '<!--parity-analytics--><script type="module" src="/a/boot.js"></script>\n'
        return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | Parity</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{url}">
{robots_tag}<meta name="theme-color" content="{bp.SITE_JSON['themeColor']}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
{feeds}
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
{head}
{bp.jsonld(graph)}
<style>{bp.CSS.strip()}{CSS.strip()}</style>
{analytics}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header><div class="wrap wide">
<a class="brand" href="/"><img src="{bp.LOGO}" width="154" height="36" alt="Parity home"></a>
<nav class="site" aria-label="Site">{bp.nav_html(section)}</nav>
<nav class="acct" aria-label="Account"><a href="/login/">Log in</a><a class="btn primary" href="/signup/">Sign up</a></nav>
</div></header>
<main id="main"><div class="wrap wide">
<p class="crumbs">{crumbs}<span aria-current="page">{e(trail[-1][0])}</span></p>
{body}
</div></main>
<footer><div class="wrap wide">
<nav aria-label="Legal">{legal}</nav>
<p>&copy; 2026 {bp.ORG} &middot; <a href="mailto:{bp.CONTACT}">{bp.CONTACT}</a></p>
</div></footer>
<script>{SCRIPT}</script>
</body>
</html>
"""

    # ------------------------------------------------------------ article
    def article(self, p: Post) -> str:
        sources = [model.resolve_source(s, self.refs) for s in p.sources]
        numbers = {s["id"]: i for i, s in enumerate(sources, 1)}
        images = {img["src"]: img for img in p.images}

        def figure(alt: str, src: str, caption: str) -> str:
            img = images[src]
            if img.get("kind") == "chart":
                self.chart(img["chart"])
                pic = (f'<img src="/newsroom/charts/{e(img["chart"])}.svg" alt="{e(alt)}" width="1600" height="900" '
                       f'loading="lazy" decoding="async">')
            else:
                pic = self.media.picture(src, alt, "(max-width: 760px) 100vw, 720px")
            cap = f"{r.inline(caption)} " if caption else ""
            return f'<figure class="nr-fig">{pic}<figcaption>{cap}{self.credit_html(img)}</figcaption></figure>'

        r = Renderer(lambda cid: numbers.get(cid, 0), figure)
        body = r.render(p.body)
        sec = SECTIONS[p.section]
        banners = ""
        if p.sample:
            banners += ('<p class="banner"><strong>Sample post.</strong> It shows the layout of a Parity article. '
                        "It is kept for reference and is not part of our published research.</p>")
        if p.status != "published":
            banners += (f'<p class="banner"><strong>{e(p.status.capitalize())}, not public.</strong> This is a local preview. '
                        "The post builds on the site only once its status is published.</p>")
        hero = ""
        if p.hero:
            cap = e(p.hero.get("caption", ""))
            hero = (f'<figure class="nr-hero"><div class="frame">{self.hero_html(p, "(max-width: 1080px) 100vw, 1040px", eager=True)}</div>'
                    f'<figcaption>{cap + " " if cap else ""}{self.credit_html(p.hero)}</figcaption></figure>')
        updated = (f' &middot; Updated <time datetime="{p.updated.isoformat()}">{fmt_date(p.updated)}</time>'
                   if p.updated and p.updated != p.date else "")
        src_html = ""
        if sources:
            items = []
            for i, s in enumerate(sources, 1):
                bits = [str(x) for x in (s.get("authors"), s.get("year"), s.get("publisher")) if x]
                items.append(f'<li id="source-{i}"><a href="{e(s["url"])}" rel="noopener">{e(s["title"])}</a>'
                             f'{". " + e(", ".join(bits)) if bits else ""}.{" " + e(s["note"]) if s.get("note") else ""}</li>')
            src_html = f'<h2 id="sources">Sources</h2><ol class="sources">{"".join(items)}</ol>'
        corr = ""
        if p.corrections:
            corr = ('<h2 id="corrections">Corrections</h2><ul class="corrections">' +
                    "".join(f'<li><time datetime="{c["date"].isoformat()}">{fmt_date(c["date"])}</time>: {r.inline(c["text"])}</li>'
                            for c in sorted(p.corrections, key=lambda c: c["date"])) + "</ul>")
        tags = ""
        if p.tags or p.markets:
            tags = ('<ul class="related" aria-label="Tags and markets">' +
                    "".join(f'<li><a href="/tags/{t}/">{e(t.replace("-", " "))}</a></li>' for t in p.tags) +
                    "".join(f'<li><span class="pill">{e(m)}</span></li>' for m in p.markets) + "</ul>")
        url = f"{bp.SITE}{p.path}"
        share = (f'<div class="share"><span>Share</span>'
                 f'<a href="https://x.com/intent/post?url={quote(url)}&amp;text={quote(p.title)}" rel="noopener" target="_blank">X</a>'
                 f'<a href="https://www.linkedin.com/sharing/share-offsite/?url={quote(url)}" rel="noopener" target="_blank">LinkedIn</a>'
                 f'<a href="mailto:?subject={quote(p.title)}&amp;body={quote(url)}">Email</a>'
                 f'<button type="button" data-copy="{e(url)}">Copy link</button></div>')
        type_link = (f'<a href="/{p.section}/category/{type_slug(p.type)}/">{e(p.type)}</a>' if p.type != p.stance else
                     f'<a href="/{p.section}/category/{type_slug(p.type)}/">More {e(PLURALS.get(p.type, p.type).lower())}</a>')
        related = self.related(p)
        rel_html = (f'<section class="nr-related" aria-labelledby="more"><h2 id="more">Related posts</h2>'
                    f'<ul class="nr-grid">{"".join(self.card(x) for x in related)}</ul></section>') if related else ""
        out = f"""<div class="progress" aria-hidden="true"></div>
<article class="nr-article">
{banners}
<header class="nr-head">
<h1>{e(p.title)}</h1>
<p class="dek">{e(p.dek)}</p>
<p class="nr-label">{self.stance_pill(p)}{type_link}<span>{e(STANCE_NOTES[p.stance])}</span></p>
<p class="nr-byline">By {self.byline(p)} &middot; <time datetime="{p.date.isoformat()}">{fmt_date(p.date)}</time>{updated} &middot; {p.read_minutes()} min read</p>
</header>
{hero}
<div class="prose nr-body">
{body}
</div>
<footer class="nr-end">
{src_html}
{corr}
<p class="disclosure">{e(p.disclosure)}</p>
{tags}
{share}
</footer>
</article>
{rel_html}"""
        authors_ld = [({"@type": "Person", "name": self.authors[a].name, "url": f"{bp.SITE}/authors/{a}/"}
                       if self.authors[a].kind == "team" else
                       {"@type": "Organization", "name": self.authors[a].name, "url": f"{bp.SITE}/authors/{a}/",
                        "parentOrganization": {"@id": f"{bp.SITE}/#org"}}) for a in p.authors]
        image = self.og_image(p)
        ld = {"@type": LD_TYPES[p.type], "@id": f"{url}#article", "headline": p.title[:110], "description": p.dek,
              "url": url, "mainEntityOfPage": url, "datePublished": p.date.isoformat(),
              "dateModified": (p.updated or p.date).isoformat(), "author": authors_ld, "publisher": {"@id": f"{bp.SITE}/#org"},
              "image": [image], "articleSection": p.type, "keywords": p.tags, "inLanguage": "en", "isAccessibleForFree": True,
              "wordCount": p.words()}
        if sources:
            ld["citation"] = [{"@type": "CreativeWork", "name": s["title"], "url": s["url"]} for s in sources]
        head = (f'<meta property="article:published_time" content="{p.date.isoformat()}">\n'
                f'<meta property="article:modified_time" content="{(p.updated or p.date).isoformat()}">\n'
                f'<meta property="article:section" content="{e(p.type)}">' +
                "".join(f'\n<meta property="article:tag" content="{e(t)}">' for t in p.tags))
        return self.shell(path=p.path, title=p.title, description=plain(p.dek), body=out, section=p.section,
                          trail=[("Home", "/"), (sec["title"], f"/{p.section}/"), (p.title, p.path)], ld=[ld],
                          og_type="article", image=image, robots="noindex" if p.sample else "", head=head)

    def related(self, p: Post, n: int = 3) -> list[Post]:
        picked = [self.by_slug[s] for s in p.meta.get("related") or [] if s in self.by_slug and s != p.slug]
        rest = sorted((x for x in self.posts if x is not p and x not in picked),
                      key=lambda x: (len(set(x.tags) & set(p.tags)), x.section == p.section, x.date), reverse=True)
        return (picked + rest)[:n]

    # ------------------------------------------------------------ lists
    def listing(self, section: str, posts: list[Post], base: str, title: str, lede: str, trail: list[tuple[str, str]],
                current: str, featured: bool) -> None:
        sec = SECTIONS[section]
        feature = next((x for x in posts if x.meta.get("featured")), posts[0]) if featured and posts else None
        rest = [x for x in posts if x is not feature]
        pages = [rest[i:i + PAGE_SIZE] for i in range(0, len(rest), PAGE_SIZE)] or [[]]
        chips = [("all", f"/{section}/", "All")] + [(type_slug(t), f"/{section}/category/{type_slug(t)}/", PLURALS.get(t, t))
                                                    for t in sec["types"]]
        filters = "".join(f'<a href="{href}"' + (' aria-current="page"' if key == current else "") + f">{e(label)}</a>"
                          for key, href, label in chips)
        for n, chunk in enumerate(pages, 1):
            path = base if n == 1 else f"{base}page/{n}/"
            feat_html = ""
            if feature and n == 1:
                f = feature
                feat_html = (f'<a class="nr-feature" href="{f.path}">{self.hero_html(f, "(max-width: 760px) 100vw, 640px", eager=True, thumb=True)}'
                             f'<span><h2>{e(f.title)}</h2><p>{e(f.dek)}</p>{self.meta_line(f)}</span></a>')
            grid = (f'<ul class="nr-grid">{"".join(self.card(x) for x in chunk)}</ul>' if chunk
                    else ("" if feat_html else "<p>No posts here yet.</p>"))
            pager = ""
            if len(pages) > 1:
                prev = (base if n == 2 else f"{base}page/{n - 1}/") if n > 1 else ""
                nxt = f"{base}page/{n + 1}/" if n < len(pages) else ""
                pager = ('<nav class="pager" aria-label="Pages">' + (f'<a href="{prev}">Newer posts</a>' if prev else "<span></span>") +
                         f"<span>Page {n} of {len(pages)}</span>" + (f'<a href="{nxt}">Older posts</a>' if nxt else "<span></span>") + "</nav>")
            extra = ""
            if section == "news" and current == "all" and n == 1:
                extra = ('<section class="card"><h2>Market news</h2><p>Headlines, how markets moved after them and the archive '
                         'are in the Parity app, with a free account: <a href="/app/#/news">latest</a>, '
                         '<a href="/app/#/news/impact">impact</a>, <a href="/app/#/news/archive">archive</a>.</p></section>')
            label = sec["title"].lower()
            body = f"""<div class="nr-top"><h1>{e(title)}</h1><p class="lede">{e(lede)}</p></div>
<nav class="nr-filters" aria-label="{e(sec['title'])} categories">{filters}</nav>
<form class="nr-search" role="search" action="#" onsubmit="return false"><label class="sr" for="q">Search the {label}</label>
<input id="q" type="search" placeholder="Search the {label}" autocomplete="off" data-search="/{section}/index.json"></form>
<div data-results hidden></div>
<div data-list>
{extra}
{feat_html}
{grid}
{pager}
</div>
<p class="nr-feeds">Follow the {label}: <a href="/{section}/feed.xml">RSS</a> &middot; <a href="/{section}/atom.xml">Atom</a></p>"""
            page_title = title if n == 1 else f"{title}, page {n}"
            shown = ([feature] if feature and n == 1 else []) + chunk
            ld = {"@type": "CollectionPage", "@id": f"{bp.SITE}{path}#page", "name": page_title, "url": f"{bp.SITE}{path}",
                  "publisher": {"@id": f"{bp.SITE}/#org"},
                  "mainEntity": {"@type": "ItemList", "itemListElement": [
                      {"@type": "ListItem", "position": i + 1, "url": f"{bp.SITE}{x.path}"} for i, x in enumerate(shown)]}}
            t = trail if n == 1 else trail + [(f"Page {n}", path)]
            self.pages[path] = self.shell(path=path, title=page_title, description=lede, body=body, section=section,
                                          trail=t, ld=[ld], robots="" if n == 1 else "noindex, follow")

    def section_pages(self, section: str) -> None:
        sec = SECTIONS[section]
        posts = [p for p in self.posts if p.section == section]
        self.listing(section, posts, f"/{section}/", sec["title"], sec["lede"],
                     [("Home", "/"), (sec["title"], f"/{section}/")], "all", featured=True)
        for t in sec["types"]:
            ts, plural = type_slug(t), PLURALS.get(t, t)
            self.listing(section, [p for p in posts if p.type == t], f"/{section}/category/{ts}/", plural,
                         f"{sec['title']} posts of the type {t}.",
                         [("Home", "/"), (sec["title"], f"/{section}/"), (plural, f"/{section}/category/{ts}/")], ts, featured=False)
        listed = [{"title": p.title, "dek": p.dek, "url": p.path, "type": p.type, "stance": p.stance, "tags": p.tags,
                   "authors": [self.authors[a].name for a in p.authors], "date": fmt_date(p.date), "sample": p.sample}
                  for p in posts]
        self.files[f"/{section}/index.json"] = json.dumps(listed, ensure_ascii=False)
        feed_posts = [p for p in posts if not p.sample and p.status == "published"][:20]
        self.files[f"/{section}/feed.xml"] = self.rss(section, feed_posts)
        self.files[f"/{section}/atom.xml"] = self.atom(section, feed_posts)

    def author_pages(self) -> None:
        cards = []
        for a in self.authors.values():
            mine = [p for p in self.posts if a.id in p.authors]
            kind = a.role or ("Parity team" if a.kind == "team" else "House byline")
            path = f"/authors/{a.id}/"
            about = f'<p class="lede">{e(a.about)}</p>' if a.about else ""
            bio = f'<p class="lede">{e(a.bio)}</p>' if a.bio else ""
            posts = (f'<h2>Posts</h2><ul class="nr-grid">{"".join(self.card(p) for p in mine)}</ul>' if mine
                     else "<p>No posts yet.</p>")
            body = (f'<div class="nr-person">{self.avatar(a, 88)}<div><h1>{e(a.name)}</h1>'
                    f'<ul class="meta"><li class="pill">{e(kind)}</li><li class="pill">{count(len(mine), "post")}</li></ul></div></div>'
                    f"{about}{bio}{posts}")
            who = ({"@type": "Person", "name": a.name, "url": f"{bp.SITE}{path}", "worksFor": {"@id": f"{bp.SITE}/#org"},
                    **({"jobTitle": a.role.split(",")[0]} if a.role else {}), **({"description": a.bio} if a.bio else {})}
                   if a.kind == "team" else
                   {"@type": "Organization", "name": a.name, "url": f"{bp.SITE}{path}", "parentOrganization": {"@id": f"{bp.SITE}/#org"}})
            self.pages[path] = self.shell(path=path, title=a.name, description=a.about or f"Posts by {a.name} on the Parity blog and news pages.",
                                          body=body, section="blog", trail=[("Home", "/"), ("Authors", "/authors/"), (a.name, path)],
                                          ld=[{"@type": "ProfilePage", "mainEntity": who}], robots="" if mine else "noindex, follow")
            cards.append(f'<li><a class="nr-author" href="{path}">{self.avatar(a, 44)}<span>{e(a.name)}'
                         f'<small>{e(kind)}. {count(len(mine), "post")}.</small></span></a></li>')
        body = ('<h1>Authors</h1><p class="lede">Posts are written by people on the Parity team, or under a house byline '
                "when the work is the team's together. House bylines are named for Parity and are never presented as a person.</p>"
                f'<ul class="grid">{"".join(cards)}</ul>')
        self.pages["/authors/"] = self.shell(path="/authors/", title="Authors", description="Who writes the Parity blog and news posts.",
                                             body=body, section="blog", trail=[("Home", "/"), ("Authors", "/authors/")], ld=[])

    def tag_pages(self) -> None:
        tags: dict[str, list[Post]] = {}
        for p in self.posts:
            for t in p.tags:
                tags.setdefault(t, []).append(p)
        for t, ps in tags.items():
            path, label = f"/tags/{t}/", t.replace("-", " ")
            body = f'<h1>Posts tagged {e(label)}</h1><ul class="nr-grid">{"".join(self.card(p) for p in ps)}</ul>'
            self.pages[path] = self.shell(path=path, title=f"Posts tagged {label}", description=f"Parity blog and news posts tagged {label}.",
                                          body=body, section="blog", trail=[("Home", "/"), ("Tags", "/tags/"), (label, path)], ld=[])
        items = "".join(f'<li><a href="/tags/{t}/">{e(t.replace("-", " "))} ({len(ps)})</a></li>' for t, ps in sorted(tags.items()))
        body = f'<h1>Tags</h1><ul class="related">{items}</ul>' if items else "<h1>Tags</h1><p>No tags yet.</p>"
        self.pages["/tags/"] = self.shell(path="/tags/", title="Tags", description="Every tag used on the Parity blog and news pages.",
                                          body=body, section="blog", trail=[("Home", "/"), ("Tags", "/tags/")], ld=[])

    # ------------------------------------------------------------ feeds
    def rss(self, section: str, posts: list[Post]) -> str:
        sec = SECTIONS[section]

        def when(d: dt.date) -> str:
            return format_datetime(dt.datetime.combine(d, dt.time(12), dt.timezone.utc))
        last = when(max(((p.updated or p.date) for p in posts), default=dt.date(2026, 10, 25)))
        items = "".join(
            f'<item><title>{e(p.title)}</title><link>{bp.SITE}{p.path}</link><guid isPermaLink="true">{bp.SITE}{p.path}</guid>'
            f"<pubDate>{when(p.date)}</pubDate><description>{e(p.dek)}</description><category>{e(p.type)}</category>"
            f"<dc:creator>{e(', '.join(self.authors[a].name for a in p.authors))}</dc:creator></item>\n" for p in posts)
        return (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" '
                f'xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>\n<title>Parity {sec["title"]}</title><link>{bp.SITE}/{section}/</link>'
                f'<description>{e(sec["lede"])}</description><language>en</language><lastBuildDate>{last}</lastBuildDate>'
                f'<atom:link href="{bp.SITE}/{section}/feed.xml" rel="self" type="application/rss+xml"/>\n{items}</channel></rss>\n')

    def atom(self, section: str, posts: list[Post]) -> str:
        sec = SECTIONS[section]
        updated = stamp(max(((p.updated or p.date) for p in posts), default=dt.date(2026, 10, 25)))
        entries = "".join(
            f'<entry><title>{e(p.title)}</title><link href="{bp.SITE}{p.path}"/><id>{bp.SITE}{p.path}</id>'
            f"<published>{stamp(p.date)}</published><updated>{stamp(p.updated or p.date)}</updated>"
            + "".join(f"<author><name>{e(self.authors[a].name)}</name></author>" for a in p.authors) +
            f'<summary>{e(p.dek)}</summary><category term="{e(p.type)}"/></entry>\n' for p in posts)
        return (f'<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n'
                f'<title>Parity {sec["title"]}</title><subtitle>{e(sec["lede"])}</subtitle>'
                f'<link href="{bp.SITE}/{section}/"/><link rel="self" href="{bp.SITE}/{section}/atom.xml"/>'
                f"<id>{bp.SITE}/{section}/</id><updated>{updated}</updated><author><name>{e(bp.ORG)}</name></author>\n{entries}</feed>\n")

    # ------------------------------------------------------------ run
    def build(self) -> None:
        self.check()
        self.plan_media()
        for p in self.posts:
            self.pages[p.path] = self.article(p)
        self.section_pages("blog")
        self.section_pages("news")
        self.author_pages()
        self.tag_pages()
        # Each finished page must show its post's stance label. An Opinion page without the
        # Opinion label fails here even if the template changes later.
        for p in self.posts:
            if f'class="stance {stance_class(p.stance)}">{e(p.stance)}</span>' not in self.pages[p.path]:
                raise model.ValidationError([f"{model.rel(p.file)}: the built page does not show its stance label {p.stance!r}"])

    def write(self) -> None:
        for path, text in self.pages.items():
            dest = self.out / path.strip("/") / "index.html"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(text)
        for path, text in self.files.items():
            dest = self.out / path.lstrip("/")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(text)

    def sitemap(self) -> list[tuple[str, str]]:
        """Addresses for sitemap.xml. Sample posts, later pages and empty lists are left out."""
        real = [p for p in self.posts if not p.sample and p.status == "published"]
        urls = [("/blog/", ""), ("/news/", ""), ("/authors/", "")]
        urls += [(p.path, (p.updated or p.date).isoformat()) for p in real]
        urls += [(f"/authors/{a}/", "") for a in sorted({a for p in real for a in p.authors})]
        urls += [(f"/tags/{t}/", "") for t in sorted({t for p in real for t in p.tags})]
        return urls


def build_into(out: Path, preview: bool = False) -> list[tuple[str, str]]:
    """Builds every newsroom page into `out` and returns the addresses for the sitemap."""
    nr = Newsroom(out, preview=preview)
    nr.build()
    nr.write()
    real = sum(1 for p in nr.posts if not p.sample)
    print(f"newsroom: {len(nr.posts)} posts built ({real} not samples), {len(nr.pages)} pages")
    return nr.sitemap()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "web/dist"))
    ap.add_argument("--preview", action="store_true", help="also build drafts and posts in review, all noindex")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        build_into(out, preview=args.preview)
    except model.ValidationError as err:
        print("newsroom: the build stopped. Fix these and run it again:", file=sys.stderr)
        for p in err.problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
