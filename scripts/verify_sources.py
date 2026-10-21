#!/usr/bin/env python3
"""Checks every external source and every reported number in the catalog and research docs.

    python scripts/verify_sources.py [--refresh] [--cache-dir DIR] [--workers N] [--date YYYY-MM-DD]

Standard library only. Pages are fetched with the system curl, PDFs are read with the
system pdftotext (poppler). Results go to catalog/verification/:

  sources.json    one record per URL (or repo path): HTTP status, final URL, content type, class
  numbers.json    one record per reported number (catalog reported_results, plus numbers
                  written next to links in docs/research), with found / not-found / page-unreadable
  crossrefs.json  DOIs, arXiv ids, NBER and SSRN ids cited in more than one place, with the
                  first author and year each place gives, and registry metadata (Crossref, arXiv)
  SUMMARY.md      plain-language summary. If catalog/verification/manual_checks.md exists it is
                  appended as the "Manual checks" section, so a rerun keeps the manual notes.

Fetched pages are cached (default: $TMPDIR/parity-verify-cache) so a rerun is fast;
--refresh ignores the cache. Requests are rate limited to about one per second per domain.
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures as cf
import datetime as dt
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "catalog" / "verification"
UA = "parity-research-verifier/0.1"
NUM_FIELDS = ["sharpe", "annual_return", "volatility", "max_drawdown"]
PCT_FIELDS = {"annual_return", "volatility", "max_drawdown"}

BOT_MARKERS = [
    "just a moment...", "cf-browser-verification", "cf-chl-", "challenge-platform",
    "attention required! | cloudflare", "captcha", "are you a robot", "access denied",
    "please enable javascript", "enable javascript and cookies", "request unsuccessful. incapsula",
    "verify you are human", "bot detection", "unusual traffic", "perimeterx", "px-captcha",
    "ddos-guard", "too many requests",
]
# Pages that are normally only a landing or abstract page, not the full text.
LANDING_PATTERNS = [
    r"papers\.ssrn\.com", r"(^|\.)ssrn\.com/abstract", r"nber\.org/papers/", r"(^|//)doi\.org/",
    r"sciencedirect\.com", r"onlinelibrary\.wiley\.com", r"academic\.oup\.com",
    r"tandfonline\.com", r"link\.springer\.com", r"jstor\.org", r"ideas\.repec\.org",
    r"econpapers\.repec\.org", r"semanticscholar\.org", r"researchgate\.net",
    r"arxiv\.org/abs/", r"journals\.uchicago\.edu", r"aeaweb\.org/articles",
    r"pm-research\.com", r"cambridge\.org/core", r"mdpi\.com", r"emerald\.com",
    r"pubsonline\.informs\.org", r"risk\.net", r"cfainstitute\.org",
]

# ----------------------------------------------------------------------------- utils


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def strip_url(u: str) -> str:
    u = u.strip()
    while True:
        old = u
        u = u.rstrip(".,;:!?*'\"`")
        while u.endswith(")") and u.count("(") < u.count(")"):
            u = u[:-1]
        while u.endswith("]") and u.count("[") < u.count("]"):
            u = u[:-1]
        if u == old:
            return u


URL_RE = re.compile(r"https?://[^\s<>\"'`|\\]+")


def find_urls(text: str) -> list[tuple[int, str]]:
    out = []
    for m in URL_RE.finditer(text):
        u = strip_url(m.group(0))
        if len(u) > 10:
            out.append((m.start(), u))
    return out


def domain(u: str) -> str:
    try:
        return urllib.parse.urlsplit(u).netloc.lower()
    except ValueError:
        return ""


def ascii_fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def norm_text(t: str) -> str:
    t = t.replace("−", "-").replace("–", "-").replace("—", "-").replace("‒", "-")
    t = t.replace(" ", " ").replace(" ", " ").replace(" ", " ").replace("ﬁ", "fi").replace("ﬂ", "fl")
    t = t.replace("·", ".")  # some old journals typeset the decimal point as a middle dot
    return re.sub(r"[ \t\r\f\v]+", " ", t)


# ----------------------------------------------------------------------------- fetching


class Fetcher:
    def __init__(self, cache_dir: Path, refresh: bool):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.refresh = refresh
        self.locks: dict[str, threading.Lock] = collections.defaultdict(threading.Lock)
        self.last: dict[str, float] = {}
        self.glock = threading.Lock()
        self.count = 0

    def _key(self, url: str, mode: str) -> Path:
        return self.cache_dir / hashlib.sha1(f"{mode}|{url}".encode()).hexdigest()

    def _wait(self, dom: str) -> threading.Lock:
        with self.glock:
            lock = self.locks[dom]
        lock.acquire()
        gap = time.time() - self.last.get(dom, 0)
        if gap < 1.05:
            time.sleep(1.05 - gap)
        return lock

    def fetch(self, url: str, big_ok: bool = False, max_time: int = 30) -> dict:
        """GET a URL with curl. Returns meta dict with 'body_path' (may be None)."""
        mode = "big" if big_ok else "cap"
        key = self._key(url, mode)
        meta_p = key.with_suffix(".json")
        if not self.refresh and meta_p.exists():
            meta = json.loads(meta_p.read_text())
            if meta.get("curl_exit") not in (28, 35, 56, 52, 7, 6, 92, 16, 3) or meta.get("retried"):
                return meta
        body_p = key.with_suffix(".body")
        dom = domain(url)
        meta = {}
        http1 = False
        for attempt, mt in enumerate([max_time, 90]):
            lock = self._wait(dom)
            try:
                cmd = ["curl", "-sSL", "-g", "--compressed", "--max-time", str(mt), "-A", UA,
                       "--max-redirs", "10", "-o", str(body_p), "-b", "/dev/null",
                       "-w", "%{http_code}\t%{url_effective}\t%{content_type}\t%{num_redirects}"]
                if http1:  # server dropped our agent string: probe once with curl's default agent
                    cmd[cmd.index("-A") + 1] = "curl/8"
                    cmd[cmd.index("--max-time") + 1] = "20"
                if not big_ok:
                    cmd += ["--max-filesize", "40000000"]
                cmd.append(url)
                t0 = time.time()
                p = subprocess.run(cmd, capture_output=True, text=True, timeout=mt + 15)
                self.last[dom] = time.time()
            except subprocess.TimeoutExpired:
                p = None
                self.last[dom] = time.time()
            finally:
                lock.release()
            with self.glock:
                self.count += 1
            if p is None:
                meta = {"url": url, "curl_exit": 28, "error": "timeout"}
            else:
                parts = (p.stdout or "").split("\t")
                code = int(parts[0]) if parts and parts[0].isdigit() else 0
                meta = {
                    "url": url, "curl_exit": p.returncode, "http_code": code,
                    "final_url": parts[1] if len(parts) > 1 else url,
                    "content_type": parts[2] if len(parts) > 2 else "",
                    "redirects": int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 0,
                    "error": (p.stderr or "").strip()[:300], "elapsed": round(time.time() - t0, 1),
                }
            meta["fetched_at"] = now_iso()
            meta["body_path"] = str(body_p) if body_p.exists() else None
            meta["bytes"] = body_p.stat().st_size if body_p.exists() else 0
            if http1:
                meta["probe_default_agent"] = {"http_code": meta.get("http_code"), "curl_exit": meta.get("curl_exit")}
                meta["curl_exit"], meta["http_code"] = 92, 0
                meta["error"] = "server resets the connection for our user agent"
            if meta.get("curl_exit") in (28, 92, 16) and attempt == 0:
                meta["retried"] = True
                http1 = meta.get("curl_exit") in (92, 16)
                continue
            break
        meta_p.write_text(json.dumps(meta))
        return meta

    def get_json(self, url: str):
        m = self.fetch(url)
        if m.get("http_code") != 200 or not m.get("body_path"):
            return None, m
        try:
            return json.loads(Path(m["body_path"]).read_text(errors="replace")), m
        except Exception:
            return None, m


def read_body(meta: dict) -> bytes:
    p = meta.get("body_path")
    if not p or not os.path.exists(p):
        return b""
    return Path(p).read_bytes()


def is_pdf(meta: dict, body: bytes) -> bool:
    return body[:5] == b"%PDF-" or "pdf" in (meta.get("content_type") or "").lower() and body[:5] == b"%PDF-"


def html_to_text(s: str) -> str:
    s = re.sub(r"(?is)<(script|style|noscript|svg|head)\b.*?</\1>", " ", s)
    s = re.sub(r"(?is)<!--.*?-->", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d|td|th)>", "\n", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    return s


def html_title(s: str) -> str:
    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", s)
    return re.sub(r"\s+", " ", html.unescape(m.group(1))).strip()[:200] if m else ""


def pdf_to_text(path: str) -> str:
    try:
        p = subprocess.run(["pdftotext", "-q", "-layout", path, "-"], capture_output=True, timeout=120)
        return p.stdout.decode("utf-8", errors="replace")
    except Exception:
        return ""


def classify(meta: dict, body: bytes, kind_hint: str = "") -> tuple[str, str]:
    """Return (class, reason) for a fetched URL."""
    code = meta.get("http_code") or 0
    ex = meta.get("curl_exit")
    if ex in (92, 16) and (meta.get("probe_default_agent") or {}).get("http_code") == 200:
        return "blocked", "server drops our user agent; page exists (HTTP 200 with a plain curl agent)"
    if ex == 47:
        return "blocked", "endless redirect loop (site wants cookies or a real browser)"
    if ex == 63:  # file larger than --max-filesize: it exists
        return "ok", "file exists, larger than 40 MB so not downloaded"
    if code in (404, 410):
        return "not-found", f"HTTP {code}"
    if code in (401, 403, 429, 999) or code == 503 and body and any(b in body[:20000].decode("utf-8", "replace").lower() for b in BOT_MARKERS):
        return "blocked", f"HTTP {code}"
    if ex not in (0, None) and not (code and 200 <= code < 300):
        return "error", f"curl exit {ex}: {meta.get('error','')[:120]}"
    if code >= 500:
        return "error", f"HTTP {code}"
    if code == 0:
        return "error", meta.get("error") or "no response"
    if 200 <= code < 300:
        if body[:5] != b"%PDF-":
            full = body.decode("utf-8", "replace")
            head = full[:60000].lower()
            title = html_title(head).lower()
            words = len(html_to_text(full).split()) if body[:2] != b"PK" else 10**6
            if any(b in title for b in BOT_MARKERS) or (any(b in head for b in BOT_MARKERS) and words < 300):
                return "blocked", "bot or captcha page"
            if re.search(r"\b(404|page not found|not found|no longer available|does not exist)\b", title) and "github" not in domain(meta.get("final_url", "")):
                return "not-found", f"soft 404 (title: {title[:80]})"
        same = meta.get("final_url", "").rstrip("/") == meta.get("url", "").rstrip("/")
        if meta.get("redirects", 0) == 0 or same:
            return "ok", f"HTTP {code}"
        return "redirect-ok", f"HTTP {code} after {meta.get('redirects')} redirect(s)"
    if 300 <= code < 400:
        return "error", f"HTTP {code} (redirect not followed)"
    if 400 <= code < 500:
        return "error", f"HTTP {code}"
    return "error", f"HTTP {code}"


# ----------------------------------------------------------------------------- collection


def walk_strings(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def collect():
    """Returns (urls: {url: [locations]}, paths: {path: [locations]}, catalog: {slug: data}, docs: {rel: text})."""
    urls: dict[str, list] = collections.defaultdict(list)
    paths: dict[str, list] = collections.defaultdict(list)
    catalog = {}
    url_fields_alg = re.compile(r"^(origin\.source_url|reported_results\[\d+\]\.source_url|implementations\[\d+\]\.url)$")
    url_fields_ds = re.compile(r"^(url|api_docs_url|sources\[\d+\])$")
    for f in sorted((ROOT / "catalog" / "algorithms").glob("*.json")):
        d = json.loads(f.read_text())
        rel = str(f.relative_to(ROOT))
        catalog[d.get("slug", f.stem)] = (rel, d)
        for path, s in walk_strings(d):
            if url_fields_alg.match(path):
                if not s:
                    continue
                if re.match(r"https?://", s):
                    urls[s.strip()].append({"file": rel, "where": path})
                else:
                    paths[s.strip()].append({"file": rel, "where": path})
            else:
                for _, u in find_urls(s):
                    urls[u].append({"file": rel, "where": path})
    for f in sorted((ROOT / "catalog" / "events").glob("*.json")):
        d = json.loads(f.read_text())
        rel = str(f.relative_to(ROOT))
        for i, src in enumerate(d.get("sources", [])):
            if re.match(r"https?://", src.get("url", "")):
                urls[src["url"].strip()].append({"file": rel, "where": f"sources[{i}].url"})
    for f in sorted((ROOT / "catalog" / "datasets").glob("*.json")):
        d = json.loads(f.read_text())
        rel = str(f.relative_to(ROOT))
        for path, s in walk_strings(d):
            if url_fields_ds.match(path):
                if not s:
                    continue
                if re.match(r"https?://", s):
                    urls[s.strip()].append({"file": rel, "where": path})
                else:
                    paths[s.strip()].append({"file": rel, "where": path})
            else:
                for _, u in find_urls(s):
                    urls[u].append({"file": rel, "where": path})
    docs = {}
    for sub in ("research", "reference"):
        for f in sorted((ROOT / "docs" / sub).glob("*.md")):
            rel = str(f.relative_to(ROOT))
            text = f.read_text()
            docs[rel] = text
            for i, line in enumerate(text.splitlines(), 1):
                for _, u in find_urls(line):
                    urls[u].append({"file": rel, "where": f"line {i}"})
    return urls, paths, catalog, docs


# ----------------------------------------------------------------------------- full text


def fulltext_alternates(url: str, final_url: str, raw_html: str) -> list[str]:
    alts = []
    for u in (url, final_url):
        m = re.search(r"arxiv\.org/abs/([\w.\-/]+?)(v\d+)?/?$", u or "")
        if m:
            alts.append(f"https://arxiv.org/pdf/{m.group(1)}{m.group(2) or ''}")
        m = re.search(r"nber\.org/papers/(w\d+)", u or "")
        if m:
            alts.append(f"https://www.nber.org/system/files/working_papers/{m.group(1)}/{m.group(1)}.pdf")
    for m in re.finditer(r'(?is)<meta[^>]+name=["\']citation_pdf_url["\'][^>]+content=["\']([^"\']+)', raw_html or ""):
        alts.append(html.unescape(m.group(1)))
    for m in re.finditer(r'(?is)<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']citation_pdf_url', raw_html or ""):
        alts.append(html.unescape(m.group(1)))
    seen, out = set(), []
    for a in alts:
        a = urllib.parse.urljoin(final_url or url, a)
        if a not in seen and a != url:
            seen.add(a)
            out.append(a)
    return out


def page_text(fetcher: Fetcher, url: str, source_cache: dict) -> dict:
    """Fetch url and return {'readable': bool, 'reason', 'text', 'text_source', 'kind', 'alts'}."""
    meta = source_cache.get(url) or fetcher.fetch(url, big_ok=True)
    body = read_body(meta)
    cls, why = classify(meta, body)
    res = {"url": url, "page_class": cls, "readable": False, "reason": why, "text": "", "text_source": url,
           "kind": "", "landing": False, "alts": []}
    if cls not in ("ok", "redirect-ok"):
        return res
    if body[:5] == b"%PDF-":
        t = pdf_to_text(meta["body_path"])
        res["kind"] = "pdf"
        if len(t.strip()) < 500:
            res["reason"] = "PDF text extraction failed or PDF is scanned images"
            return res
        reason = "PDF text extracted"
        if len(re.findall(r"\b\d+:\d{1,2}\b", t)) > 30:
            # some TeX fonts extract the decimal point as a colon (8:15 for 8.15)
            t = re.sub(r"(?<=\d):(?=\d)", ".", t)
            reason = "PDF text extracted, decimal points came out as colons and were corrected"
        res.update(readable=True, reason=reason, text=norm_text(t))
        return res
    ctype = (meta.get("content_type") or "").lower()
    if body[:2] == b"PK" or body[:4] == b"\xd0\xcf\x11\xe0" or any(x in ctype for x in ("zip", "spreadsheet", "excel", "octet-stream", "csv")):
        res["kind"] = "data"
        res["reason"] = "source is a data file (spreadsheet, zip or CSV); the number is a calculation, not printed text"
        return res
    raw = body.decode("utf-8", errors="replace")
    t = norm_text(html_to_text(raw))
    words = len(t.split())
    res["kind"] = "html"
    res["alts"] = fulltext_alternates(url, meta.get("final_url", ""), raw)
    final = meta.get("final_url", "") or url
    if any(re.search(p, final) or re.search(p, url) for p in LANDING_PATTERNS) and words < 4000:
        res["landing"] = True
    if words < 80:
        res["reason"] = f"page has almost no text ({words} words), probably needs JavaScript"
        return res
    res.update(readable=True, reason=f"HTML, {words} words", text=t)
    return res


# ----------------------------------------------------------------------------- number matching


def decimals_of(v: float) -> int:
    s = repr(float(v))
    if "e" in s:
        s = f"{v:.10f}".rstrip("0")
    return len(s.split(".")[1].rstrip("0")) if "." in s else 0


def fmt(x: float, d: int) -> str:
    return f"{x:.{d}f}"


def number_forms(field: str, v: float) -> list[tuple[str, str, bool]]:
    """(string, strength, needs_percent_sign). strength: 'exact' or 'rounded'."""
    a = abs(v)
    forms: list[tuple[str, str, bool]] = []
    if field not in PCT_FIELDS:
        d = max(decimals_of(a), 1)
        exact = fmt(a, d)
        forms.append((exact, "exact", False))
        if d == 1:
            forms.append((fmt(a, 2), "exact", False))
        if d > 2:
            forms.append((fmt(a, 2), "rounded", False))
        if exact.startswith("0."):
            forms.append((exact[1:], "exact", False))
        return dedupe(forms)
    d = decimals_of(a)
    exact_frac = fmt(a, max(d, 2))
    forms.append((exact_frac, "exact", False))
    if exact_frac.startswith("0."):
        forms.append((exact_frac[1:], "exact", False))
    pct = a * 100
    pd = max(d - 2, 0)
    p_exact = fmt(pct, pd)
    if pd == 0:
        forms.append((p_exact, "exact", True))
        forms.append((fmt(pct, 1), "exact", False))
        forms.append((fmt(pct, 2), "exact", False))
    else:
        forms.append((p_exact, "exact", False))
        if pd == 1:
            forms.append((fmt(pct, 2), "exact", False))
        if pd >= 2:
            forms.append((fmt(pct, 1), "rounded", False))
        if pd >= 3:
            forms.append((fmt(pct, 2), "rounded", False))
    return dedupe(forms)


def dedupe(forms):
    seen, out = set(), []
    for f in forms:
        if f[0] not in seen:
            seen.add(f[0])
            out.append(f)
    return out


PCT_AFTER = re.compile(r"\s?(%|percent|per cent|pct\b)", re.I)


def search_forms(text: str, forms, field: str | None = None) -> dict | None:
    best = None
    hit = _search(text, forms, field)
    if hit:
        return hit
    # the page may print one more digit than the catalog (0.744 for a catalog 0.74)
    for s, strength, need_pct in forms:
        if "." not in s or need_pct or s.startswith("."):
            continue
        d = len(s.split(".")[1])
        pat = re.compile(r"(?<![\d.])" + re.escape(s[:-1]) + r"\d\d(?![\d])(?!\.\d)")
        for m in pat.finditer(text):
            val = Decimal(m.group(0))
            q = Decimal(1).scaleb(-d)
            if str(val.quantize(q, ROUND_HALF_UP)) == s or str(val.quantize(q, ROUND_HALF_EVEN)) == s:
                snip = text[max(0, m.start() - 40): m.end() + 40]
                return {"form": m.group(0), "strength": "rounded", "snippet": re.sub(r"\s+", " ", snip).strip(),
                        "near_keyword": None}
    return best


FIELD_WORDS = {
    "sharpe": r"sharpe|\bSR\b|information ratio|risk-adjusted",
    "annual_return": r"return|mean|average|excess|p\.a\.|per annum|annual|cagr|profit|yield",
    "volatility": r"volatil|std|standard dev|s\.d\.|\bsd\b|sigma|risk",
    "max_drawdown": r"drawdown|draw-down|\bmdd\b|\bdd\b|peak|loss|decline|crash",
}


def _search(text: str, forms, field: str | None = None) -> dict | None:
    """First exact hit that has a word for its field nearby, else the first exact hit, else a rounded one."""
    kw = re.compile(FIELD_WORDS[field], re.I) if field in FIELD_WORDS else None
    fallback = None
    for want in ("exact", "rounded"):
        for s, strength, need_pct in forms:
            if strength != want:
                continue
            lead = r"(?<=[\s(\[=-])" if s.startswith(".") else r"(?<![\d.])"
            pat = re.compile(lead + re.escape(s) + r"(?![\d])(?!\.\d)")
            for m in pat.finditer(text):
                if need_pct and not PCT_AFTER.match(text, m.end()):
                    continue
                snip = text[max(0, m.start() - 40): m.end() + 40]
                near = bool(kw and kw.search(text, max(0, m.start() - 400), m.end() + 400))
                hit = {"form": s, "strength": strength, "snippet": re.sub(r"\s+", " ", snip).strip(), "near_keyword": near}
                if near or kw is None:
                    return hit
                if fallback is None:
                    fallback = hit
        if fallback:
            return fallback
    return fallback


# ----------------------------------------------------------------------------- doc claims


DOC_ID_JUNK = re.compile(
    r"\b(?:arXiv:?\s*)?\d{4}\.\d{4,5}(?:v\d+)?\b|\b10\.\d{4,9}/\S+|\bw\d{4,5}\b|#\d+|\b[A-Z]{2,4}-\d{3,6}\b|\bH\d\b|\b\d+\.\d+\.\d+\b"
)
DOC_NUM = re.compile(r"(?<![\w.])(-?\d+(?:,\d{3})*(?:\.\d+)?)(\s?%)?")


def doc_blocks(text: str):
    """Split a markdown doc into blocks (list items, table rows, paragraphs) with their links."""
    lines = text.splitlines()
    blocks = []
    cur = None
    in_code = False
    for i, line in enumerate(lines, 1):
        if line.strip().startswith("```"):
            in_code = not in_code
            cur = None
            continue
        if in_code or line.startswith("---") or re.match(r"^\w+:\s", line) and i < 15:
            continue
        if not line.strip():
            cur = None
            continue
        m = re.match(r"^(\s*)(?:[-*+]|\d+\.)\s", line)
        if m or line.lstrip().startswith("|") or cur is None or line.startswith("#"):
            indent = len(m.group(1)) if m else len(line) - len(line.lstrip())
            cur = {"start": i, "end": i, "indent": indent, "text": line, "is_item": bool(m)}
            blocks.append(cur)
        else:
            cur["text"] += "\n" + line
            cur["end"] = i
    for b in blocks:
        b["links"] = [u for _, u in find_urls(b["text"])]
    # nested bullets with no link inherit the links of their parent item
    for k, b in enumerate(blocks):
        if not b["links"] and b["is_item"] and b["indent"] > 0:
            for j in range(k - 1, -1, -1):
                p = blocks[j]
                if p["is_item"] and p["indent"] < b["indent"]:
                    b["links"] = p["links"]
                    b["inherited"] = True
                    break
                if not p["is_item"]:
                    break
    return blocks


def doc_numbers(block_text: str):
    t = re.sub(r"\]\((https?://[^)\s]+(?:\([^)]*\))?[^)\s]*)\)", "]", block_text)
    t = URL_RE.sub(" ", t)
    t = DOC_ID_JUNK.sub(" ", t)
    t = re.sub(r"\b(19|20)\d\d-(19|20)?\d\d\b", " ", t)  # year ranges
    t = re.sub(r"\b(19|20)\d\d-\d\d(-\d\d)?\b", " ", t)  # dates
    t = re.sub(r"\[[^\]]*\]", lambda m: " " if re.search(r"\d", m.group(0)) and len(m.group(0)) < 40 else m.group(0), t)
    out = []
    for m in DOC_NUM.finditer(t):
        raw, pct = m.group(1), bool(m.group(2))
        if "," in raw:
            continue
        if m.start() > 1 and t[m.start() - 1] == "-" and t[m.start() - 2].isalpha():
            continue  # GPL-3.0 and the like
        if raw.startswith("-") and m.start() > 0 and t[m.start() - 1].isalnum():
            continue
        before = t[max(0, m.start() - 30): m.start()].lower()
        if "." in raw or pct:
            out.append((raw, pct, t[max(0, m.start() - 50): m.end() + 30]))
        elif re.search(r"sharpe(?: ratio)?(?: of| was| near| above| below| around| about)?\s*$", before) and not re.match(r"(19|20)\d\d$", raw.lstrip("-")):
            out.append((raw, pct, t[max(0, m.start() - 50): m.end() + 30]))
    return out


def doc_forms(raw: str, pct: bool):
    s = raw.lstrip("-")
    forms = [(s, "exact", pct and "." not in s)]
    if "." in s:
        ip, dp = s.split(".")
        if dp.endswith("0"):
            t = s.rstrip("0").rstrip(".")
            forms.append((t, "exact", pct and "." not in t))
        else:
            forms.append((s + "0", "exact", False))
        if s.startswith("0."):
            forms.append((s[1:], "exact", False))
    else:
        forms.append((s + ".0", "exact", False))
        forms.append((s + ".00", "exact", False))
    if pct:
        v = float(s) / 100
        d = (len(s.split(".")[1]) if "." in s else 0) + 2
        forms.append((fmt(v, d), "exact", False))
    return dedupe(forms)


# ----------------------------------------------------------------------------- cross references


ID_PATTERNS = [
    ("doi", re.compile(r"\b(10\.\d{4,9}/[^\s\"<>|\]]+)", re.I)),
    ("arxiv", re.compile(r"arxiv\.org/(?:abs|pdf|html)/(\d{4}\.\d{4,5})", re.I)),
    ("arxiv", re.compile(r"\barXiv[:\s]+(\d{4}\.\d{4,5})", re.I)),
    ("nber", re.compile(r"nber\.org/(?:papers|system/files/working_papers)/(w\d{3,6})", re.I)),
    ("nber", re.compile(r"\bNBER (?:WP |w|working paper |Working Paper )?(?:No\.? )?(w?\d{4,5})\b")),
    ("ssrn", re.compile(r"abstract_id=(\d{5,8})", re.I)),
    ("ssrn", re.compile(r"ssrn\.com/abstract=(\d{5,8})", re.I)),
    ("ssrn", re.compile(r"10\.2139/ssrn\.(\d{5,8})", re.I)),
]

NAME_STOP = {"The", "In", "See", "A", "An", "From", "By", "As", "And", "Of", "Also", "This", "Their", "Our",
             "Unlike", "Following", "Table", "Figure", "Journal", "Review", "NBER", "WP", "SSRN", "Working",
             "Paper", "Papers", "Quarterly", "American", "Economic", "Financial", "Finance", "Economics",
             "Management", "Science", "Studies", "Critical", "International", "Money", "Monetary",
             "Portfolio", "Analysts", "It", "Its", "On", "For", "With", "But", "Then", "When", "Since",
             "Note", "Notes", "Source", "Sources", "Paper", "Book", "Open", "Copy", "Sharpe", "Updated",
             "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
             "November", "December", "Cambridge", "Wiley", "Press", "University", "Communication", "Methods",
             "Measures", "Retail", "Platforms", "Macroeconomics", "Annual", "Preprint", "Library", "Blog",
             "Later", "Original", "Independent", "Replication", "Relevance", "Both", "Same", "Here", "There"}
NAME_PARTICLES = {"de", "van", "der", "von", "da", "del", "della", "di", "le", "la", "den", "dos", "du", "ten"}


def norm_id(kind: str, v: str) -> str:
    v = strip_url(v)
    if kind == "doi":
        v = urllib.parse.unquote(v).lower()
        v = re.sub(r"(\.pdf|/abstract|/full|/pdf)$", "", v)
        return v
    if kind == "nber":
        return "w" + v.lstrip("wW")
    return v.lower()


def find_ids(s: str):
    out = []
    for kind, pat in ID_PATTERNS:
        for m in pat.finditer(s):
            v = m.group(1)
            if kind == "doi":
                # keep balanced parentheses inside DOIs such as 10.1016/S0022-1996(02)00072-7
                v = strip_url(v)
                if v.lower().startswith("10.2139/ssrn."):
                    continue
                if v.lower().startswith("10.48550/arxiv."):
                    out.append((m.start(), "arxiv", v.split(".", 2)[-1].lower()))
                    continue
            out.append((m.start(), kind, norm_id(kind, v)))
    # dedupe by (pos window, kind, id)
    seen, res = set(), []
    for pos, k, v in sorted(out):
        if (k, v) in seen and any(abs(pos - p) < 80 for p, kk, vv in res if (kk, vv) == (k, v)):
            continue
        seen.add((k, v))
        res.append((pos, k, v))
    return res


TOKEN_RE = re.compile(r"[A-Za-zÀ-ſ][A-Za-zÀ-ſ'\-]*|\d{4}[a-z]?|[^\sA-Za-z\d]")


def parse_citation(window: str):
    """Find the last 'Author ... (Year)' citation in window. Returns (first_author, year) or (None, None)."""
    years = list(re.finditer(r"(?<!\d)((?:19|20)\d\d)[a-z]?(?!\d)", window))
    for ym in reversed(years):
        pre = window[: ym.start()]
        toks = TOKEN_RE.findall(pre[-220:])
        names = []
        j = len(toks) - 1
        while j >= 0 and toks[j] in ("(", ",", "["):
            j -= 1
        state_ok = False
        while j >= 0:
            t = toks[j]
            if t in (",", "&", ".", "and", "et", "al", "*") or t.lower() in NAME_PARTICLES:
                j -= 1
                continue
            if re.match(r"^[A-ZÀ-Þ][\wÀ-ſ'\-]*$", t) and t not in NAME_STOP and len(t) > 1:
                names.append((j, t))
                state_ok = True
                j -= 1
                continue
            break
        if state_ok:
            first = names[-1][1]
            # include particles directly after, e.g. "Lopez de Prado"
            return first, int(ym.group(1))
    return None, None


def first_surname(authors: str) -> str | None:
    if not authors:
        return None
    a = re.split(r",|\band\b|&|;", authors)[0].strip()
    a = re.sub(r"\bet al\.?", "", a).strip()
    toks = a.split()
    if not toks:
        return None
    # "Lopez de Prado" -> "Lopez"; "J. Smith" -> "Smith"
    toks = [t for t in toks if not re.match(r"^[A-Z]\.$", t)]
    if not toks or toks[0] in NAME_STOP or not toks[0][:1].isupper():
        return None
    if len(toks) > 1 and not any(t.lower() in NAME_PARTICLES for t in toks) and all(t[:1].isupper() for t in toks):
        return toks[-1]  # "Yuke Zhang" -> "Zhang"
    return toks[0]


def same_author(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return True
    fa, fb = ascii_fold(a).lower(), ascii_fold(b).lower()
    ta, tb = set(re.findall(r"[a-z]+", fa)), set(re.findall(r"[a-z]+", fb))
    return fa == fb or bool(ta & tb - NAME_PARTICLES)


def gather_citations(catalog, docs):
    places = collections.defaultdict(list)  # (kind, id) -> list
    for slug, (rel, d) in catalog.items():
        for path, s in walk_strings(d):
            ids = find_ids(s)
            if not ids:
                continue
            for pos, kind, v in ids:
                author = year = None
                ctx = s[max(0, pos - 160): pos + 60]
                if path == "origin.source_url":
                    author = first_surname(d["origin"].get("authors") or "")
                    year = d["origin"].get("first_published")
                    ctx = f"origin: {d['origin'].get('authors')} ({year}), {d['origin'].get('source_title','')}"
                elif re.match(r"reported_results\[\d+\]\.source_url$", path):
                    i = int(re.search(r"\[(\d+)\]", path).group(1))
                    src = d["reported_results"][i].get("source", "")
                    author, year = parse_citation(src)
                    if author is None:
                        author = first_surname(src)
                    ctx = f"reported_results source: {src}"
                elif path.startswith("implementations"):
                    continue
                else:
                    prev = [p for p, _, _ in ids if p < pos]
                    start = max(prev[-1] + 10 if prev else 0, pos - 300)
                    author, year = parse_citation(s[start:pos])
                places[(kind, v)].append({"file": rel, "where": path, "slug": slug, "cited_first_author": author,
                                          "cited_year": year, "context": re.sub(r"\s+", " ", ctx)[:260]})
    for rel, text in docs.items():
        for b in doc_blocks(text):
            bt = b["text"]
            ids = find_ids(bt)
            for pos, kind, v in ids:
                prev = [p for p, _, _ in ids if p < pos]
                start = max(prev[-1] + 10 if prev else 0, pos - 400)
                author, year = parse_citation(bt[start:pos])
                line = b["start"] + bt[:pos].count("\n")
                places[(kind, v)].append({"file": rel, "where": f"line {line}", "cited_first_author": author,
                                          "cited_year": year,
                                          "context": re.sub(r"\s+", " ", bt[max(0, pos - 160): pos + 40])[:260]})
    return places


def registry_metadata(fetcher: Fetcher, places):
    meta = {}
    arx = sorted({v for (k, v) in places if k == "arxiv"})
    for i in range(0, len(arx), 20):
        chunk = arx[i: i + 20]
        m = fetcher.fetch("http://export.arxiv.org/api/query?max_results=50&id_list=" + ",".join(chunk))
        body = read_body(m)
        try:
            root = ET.fromstring(body)
            ns = {"a": "http://www.w3.org/2005/Atom"}
            for e in root.findall("a:entry", ns):
                eid = (e.findtext("a:id", "", ns) or "").rsplit("/", 1)[-1]
                eid = re.sub(r"v\d+$", "", eid)
                auths = [a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)]
                pub = e.findtext("a:published", "", ns)
                meta[("arxiv", eid)] = {"registry": "arXiv", "title": re.sub(r"\s+", " ", e.findtext("a:title", "", ns)).strip(),
                                        "first_author": (auths[0].split()[-1] if auths else None),
                                        "year": int(pub[:4]) if pub[:4].isdigit() else None, "authors": auths[:6]}
        except ET.ParseError:
            pass
    for (k, v) in sorted(places):
        if k != "doi":
            continue
        j, m = fetcher.get_json("https://api.crossref.org/works/" + urllib.parse.quote(v, safe="/()"))
        if j and isinstance(j.get("message"), dict):
            msg = j["message"]
            auths = msg.get("author") or []
            fam = auths[0].get("family") if auths else None
            yr = None
            for key in ("published-print", "issued", "published-online", "published"):
                dp = (msg.get(key) or {}).get("date-parts") or []
                if dp and dp[0] and dp[0][0]:
                    yr = dp[0][0]
                    break
            online = None
            dp = (msg.get("published-online") or {}).get("date-parts") or []
            if dp and dp[0] and dp[0][0]:
                online = dp[0][0]
            meta[(k, v)] = {"registry": "Crossref", "title": (msg.get("title") or [""])[0], "first_author": fam,
                            "year": yr, "year_online": online,
                            "container": (msg.get("container-title") or [""])[0],
                            "authors": [a.get("family") for a in auths[:6]]}
        else:
            meta[(k, v)] = {"registry": "Crossref", "error": f"no record (HTTP {m.get('http_code')})"}
    return meta


def doi_handle(fetcher: Fetcher, doi: str) -> str:
    j, m = fetcher.get_json("https://doi.org/api/handles/" + urllib.parse.quote(doi, safe="/()"))
    if j is None:
        if m.get("http_code") == 404:
            return "not-registered"
        return f"unknown (HTTP {m.get('http_code')})"
    rc = j.get("responseCode")
    return "registered" if rc == 1 else ("not-registered" if rc == 100 else f"responseCode {rc}")


# ----------------------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--cache-dir", default=os.path.join(tempfile.gettempdir(), "parity-verify-cache"))
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--date", default=dt.date.today().isoformat())
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    fetcher = Fetcher(Path(args.cache_dir), args.refresh)
    t_start = time.time()

    urls, paths, catalog, docs = collect()
    number_urls = set()
    for slug, (rel, d) in catalog.items():
        for r in d.get("reported_results", []):
            if any(isinstance(r.get(k), (int, float)) for k in NUM_FIELDS) and r.get("source_url", "").startswith("http"):
                number_urls.add(r["source_url"])
    print(f"collected {len(urls)} URLs, {len(paths)} repo paths, {len(number_urls)} number source pages", flush=True)

    # ---- 1. fetch every URL (spread across domains)
    order = sorted(urls, key=lambda u: (domain(u), u))
    metas: dict[str, dict] = {}
    done = 0

    def job(u):
        return u, fetcher.fetch(u, big_ok=u in number_urls)

    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for u, m in ex.map(job, order):
            metas[u] = m
            done += 1
            if done % 50 == 0:
                print(f"  fetched {done}/{len(order)} ({time.time()-t_start:.0f}s)", flush=True)

    # ---- 2. classify, DOI handles
    sources = []
    doi_status = {}
    dois = set()
    for u in urls:
        m = re.search(r"doi\.org/(10\.\d{4,9}/.+)$", u)
        if m:
            dois.add(urllib.parse.unquote(m.group(1)))
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        for d_, st in zip(sorted(dois), ex.map(lambda d: doi_handle(fetcher, d), sorted(dois))):
            doi_status[d_] = st
    for u in sorted(urls):
        m = metas[u]
        body = read_body(m)
        cls, why = classify(m, body)
        title = ""
        if body and body[:5] != b"%PDF-":
            title = html_title(body[:60000].decode("utf-8", "replace"))
        rec = {"url": u, "kind": "url", "status": cls, "reason": why, "http_code": m.get("http_code"),
               "final_url": m.get("final_url"), "content_type": m.get("content_type"),
               "redirects": m.get("redirects"), "bytes": m.get("bytes"), "title": title,
               "locations": urls[u], "checked_at": m.get("fetched_at")}
        dm = re.search(r"doi\.org/(10\.\d{4,9}/.+)$", u)
        if dm:
            d_ = urllib.parse.unquote(dm.group(1))
            rec["doi"] = d_
            rec["doi_handle"] = doi_status.get(d_)
            if rec["doi_handle"] == "not-registered":
                rec["status"], rec["reason"] = "not-found", "DOI is not registered (doi.org handle API)"
        sources.append(rec)
    for p in sorted(paths):
        exists = (ROOT / p).exists()
        sources.append({"url": p, "kind": "repo-path", "status": "ok" if exists else "not-found",
                        "reason": "file exists in repo" if exists else "file missing in repo", "locations": paths[p]})
    by_url = {s["url"]: s for s in sources}

    # ---- 3. reported numbers in the catalog
    texts: dict[str, dict] = {}

    def get_text(u):
        if u not in texts:
            texts[u] = page_text(fetcher, u, metas)
        return texts[u]

    def alt_texts(u):
        """Full-text alternates (arXiv PDF, NBER PDF, citation_pdf_url) for landing pages."""
        base = get_text(u)
        out = []
        for a in base.get("alts", [])[:2]:
            t = get_text(a)
            if t["readable"]:
                out.append(t)
        return out

    numbers = []
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        list(ex.map(get_text, sorted(number_urls)))
    for slug, (rel, d) in sorted(catalog.items()):
        for i, r in enumerate(d.get("reported_results", [])):
            u = r.get("source_url") or ""
            for f in NUM_FIELDS:
                v = r.get(f)
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    continue
                rec = {"kind": "catalog", "slug": slug, "file": rel, "result_index": i, "source": r.get("source"),
                       "period": r.get("period"), "field": f, "value": v, "source_url": u,
                       "verified_on_page": r.get("verified_on_page"), "evidence_type": r.get("evidence_type"),
                       "family": d.get("family"), "markets": d.get("markets")}
                if not u.startswith("http"):
                    rec.update(status="page-unreadable", reason="source_url is not a web link")
                    numbers.append(rec)
                    continue
                forms = number_forms(f, v)
                rec["forms_searched"] = [x[0] + ("%" if x[2] else "") for x in forms]
                pt = get_text(u)
                hit = search_forms(pt["text"], forms, f) if pt["readable"] else None
                tried = [pt]
                if not hit:
                    for at in alt_texts(u):
                        tried.append(at)
                        hit = search_forms(at["text"], forms, f)
                        if hit:
                            pt = at
                            break
                if hit:
                    rec.update(status="found", match=hit["form"], match_strength=hit["strength"], snippet=hit["snippet"],
                               near_field_word=hit.get("near_keyword"), text_source=pt["text_source"])
                else:
                    full = [t for t in tried if t["readable"] and not t["landing"]]
                    if full:
                        rec.update(status="not-found", reason=f"page readable ({full[0]['reason']}) but the number is not on it",
                                   text_source=full[0]["text_source"])
                    elif any(t["readable"] for t in tried):
                        rec.update(status="page-unreadable",
                                   reason="only an abstract or landing page could be read, no full text",
                                   text_source=u)
                    else:
                        rec.update(status="page-unreadable", reason=f"{pt['page_class']}: {pt['reason']}", text_source=u)
                rec["own_calculation"] = bool(re.match(r"\s*(our|own|parity)\b.*\b(calculation|computed|calc)", (r.get("source") or ""), re.I))
                numbers.append(rec)

    # ---- 3a. are the found numbers of one reported result close together on the page (same table row)?
    by_result = collections.defaultdict(list)
    for rec in numbers:
        by_result[(rec["slug"], rec["result_index"])].append(rec)
    for key, recs in by_result.items():
        found = [x for x in recs if x["status"] == "found"]
        if len(found) < 2:
            for x in found:
                x["colocated"] = None
            continue
        src = found[0]["text_source"]
        if any(x["text_source"] != src for x in found):
            for x in found:
                x["colocated"] = False
                x["colocation_note"] = "numbers found in different documents"
            continue
        text = get_text(src)["text"]
        pos_lists = []
        for x in found:
            forms = [f for f in number_forms(x["field"], x["value"])]
            ps = []
            for s_, strength, need_pct in forms + [(x["match"], "m", False)]:
                lead = r"(?<=[\s(\[=-])" if s_.startswith(".") else r"(?<![\d.])"
                for m in re.finditer(lead + re.escape(s_) + r"(?![\d])(?!\.\d)", text):
                    if need_pct and not PCT_AFTER.match(text, m.end()):
                        continue
                    ps.append(m.start())
            pos_lists.append(sorted(set(ps)))
        events = sorted((p, i) for i, ps in enumerate(pos_lists) for p in ps)
        need, have, best, lo = len(pos_lists), collections.Counter(), None, 0
        for hi in range(len(events)):
            have[events[hi][1]] += 1
            while len(have) == need:
                w = events[hi][0] - events[lo][0]
                best = w if best is None or w < best else best
                have[events[lo][1]] -= 1
                if have[events[lo][1]] == 0:
                    del have[events[lo][1]]
                lo += 1
        for x in found:
            x["colocated"] = best is not None and best <= 1500
            x["colocation_window_chars"] = best
            x["occurrences_on_page"] = len(pos_lists[found.index(x)])

    # ---- 3b. numbers written next to links in the research docs
    doc_nums = []
    for rel, text in docs.items():
        if "/research/" not in rel:
            continue
        for b in doc_blocks(text):
            if not b["links"]:
                continue
            nums = doc_numbers(b["text"])
            if not nums:
                continue
            for raw, pct, ctx in nums:
                forms = doc_forms(raw, pct)
                rec = {"kind": "doc", "slug": f"{rel}:{b['start']}", "file": rel, "line": b["start"],
                       "field": "doc-number", "value": raw + ("%" if pct else ""), "source_url": " ".join(b["links"]),
                       "links_inherited": bool(b.get("inherited")),
                       "context": re.sub(r"\s+", " ", ctx).strip(),
                       "unverified_tag": "unverified" in b["text"].lower()}
                hit, readable_full, readable_any, reasons = None, [], False, []
                for u in b["links"]:
                    if not u.startswith("http"):
                        continue
                    pt = get_text(u)
                    cands = [pt] + (alt_texts(u) if pt["readable"] or pt["alts"] else [])
                    for t in cands:
                        if t["readable"]:
                            readable_any = True
                            if not t["landing"]:
                                readable_full.append(t["text_source"])
                            h = search_forms(t["text"], forms)
                            if h:
                                hit = dict(h, text_source=t["text_source"])
                                break
                        else:
                            reasons.append(f"{t['page_class']}: {t['reason']}")
                    if hit:
                        break
                if hit:
                    rec.update(status="found", match=hit["form"], match_strength=hit["strength"], snippet=hit["snippet"],
                               text_source=hit["text_source"])
                elif readable_full:
                    rec.update(status="not-found", reason="linked page readable but the number is not on it",
                               text_source=readable_full[0])
                elif readable_any:
                    rec.update(status="page-unreadable", reason="only an abstract or landing page could be read")
                else:
                    rec.update(status="page-unreadable", reason="; ".join(sorted(set(reasons)))[:200] or "no readable link")
                doc_nums.append(rec)

    # ---- 4. cross references
    places = gather_citations(catalog, docs)
    reg = registry_metadata(fetcher, places)
    crossrefs = []
    for (k, v), pl in sorted(places.items()):
        meta = reg.get((k, v))
        multi = len(pl) > 1
        years = sorted({p["cited_year"] for p in pl if p["cited_year"]})
        authors = [p["cited_first_author"] for p in pl if p["cited_first_author"]]
        dis = []
        if multi and len(years) > 1:
            dis.append({"type": "year", "detail": f"places cite different years: {', '.join(map(str, years))}"})
        if multi and authors:
            groups = []
            for a in authors:
                for g in groups:
                    if same_author(a, g[0]):
                        g.append(a)
                        break
                else:
                    groups.append([a])
            if len(groups) > 1:
                dis.append({"type": "first-author", "detail": "places name different first authors: " + ", ".join(sorted({g[0] for g in groups}))})
        vs_reg = []
        if meta and not meta.get("error"):
            for p in pl:
                if p["cited_year"] and meta.get("year") and p["cited_year"] not in (meta.get("year"), meta.get("year_online")):
                    vs_reg.append({"place": f"{p['file']} {p['where']}", "type": "year",
                                   "detail": f"cites {p['cited_year']}, {meta['registry']} says {meta.get('year')}"
                                             + (f" (online {meta['year_online']})" if meta.get("year_online") and meta.get("year_online") != meta.get("year") else "")})
                if p["cited_first_author"] and meta.get("first_author") and not same_author(p["cited_first_author"], meta["first_author"]):
                    vs_reg.append({"place": f"{p['file']} {p['where']}", "type": "first-author",
                                   "detail": f"names {p['cited_first_author']}, {meta['registry']} says {meta['first_author']}"})
        origin_only = False
        if dis:
            np_ = [p for p in pl if p["where"] != "origin.source_url"]
            ys = {p["cited_year"] for p in np_ if p["cited_year"]}
            au = [p["cited_first_author"] for p in np_ if p["cited_first_author"]]
            origin_only = len(ys) <= 1 and all(same_author(a, au[0]) for a in au)
        crossrefs.append({"id": v, "type": k, "places_count": len(pl), "in_multiple_places": multi,
                          "disagreement_only_with_origin_field": origin_only,
                          "registry": meta, "places": pl, "disagreements": dis, "registry_mismatches": vs_reg})

    # ---- 5. write outputs
    (OUT / "sources.json").write_text(json.dumps({"run_date": args.date, "records": sources}, indent=1) + "\n")
    (OUT / "numbers.json").write_text(json.dumps({"run_date": args.date, "records": numbers + doc_nums}, indent=1) + "\n")
    (OUT / "crossrefs.json").write_text(json.dumps({"run_date": args.date, "records": crossrefs}, indent=1) + "\n")
    write_summary(args.date, sources, numbers, doc_nums, crossrefs, time.time() - t_start, fetcher.count)
    print(f"done in {time.time()-t_start:.0f}s, {fetcher.count} network requests", flush=True)


# ----------------------------------------------------------------------------- summary


def md_cell(s) -> str:
    s = "" if s is None else str(s)
    s = s.replace("|", "/").replace("\n", " ")
    s = s.replace("—", "-").replace("–", "-").replace("‘", "'").replace("’", "'")
    s = s.replace("“", '"').replace("”", '"').replace("−", "-")
    s = ascii_fold(s) if any(ord(c) > 127 for c in s) else s
    return s


def fmt_val(f, v):
    if f in PCT_FIELDS and isinstance(v, (int, float)):
        return f"{v} ({v*100:.4g}%)"
    return str(v)


def write_summary(date, sources, numbers, doc_nums, crossrefs, secs, nreq):
    L = []
    c_src = collections.Counter(s["status"] for s in sources)
    c_num = collections.Counter(n["status"] for n in numbers)
    c_doc = collections.Counter(n["status"] for n in doc_nums)
    weak = sum(1 for n in numbers if n["status"] == "found" and n.get("match_strength") == "rounded")
    contra = [n for n in numbers if n["status"] == "not-found" and n.get("verified_on_page") is True and not n.get("own_calculation")]
    contra_entries = sorted({(n["slug"], n["result_index"]) for n in contra})
    multi = [c for c in crossrefs if c["in_multiple_places"]]
    dis = [c for c in multi if c["disagreements"]]
    regm = [c for c in crossrefs if c["registry_mismatches"]]
    L.append("# Source and number verification")
    L.append("")
    L.append(f"Run date: {date}. Made by `scripts/verify_sources.py` in {secs/60:.0f} minutes with {nreq} web requests.")
    L.append("Raw results: `sources.json`, `numbers.json`, `crossrefs.json` in this folder.")
    L.append("")
    L.append("## In plain words")
    L.append("")
    L.append("Every link in the catalog and the research docs was opened, and every reported Sharpe ratio, return,")
    L.append("volatility and drawdown in the catalog was searched for on the page it cites. A number counts as found")
    L.append("only if it appears on the page in a form it would normally be written in. Not found does not always mean")
    L.append("wrong: the paper may print it differently, or the catalog may have computed it. But it does mean nobody")
    L.append("can check it by opening the link.")
    L.append("")
    L.append("## Counts")
    L.append("")
    L.append(f"Links and repo paths checked: {len(sources)}")
    L.append("")
    L.append("| Link status | Count |")
    L.append("|---|---|")
    for k in ["ok", "redirect-ok", "blocked", "not-found", "error"]:
        L.append(f"| {k} | {c_src.get(k, 0)} |")
    L.append("")
    L.append(f"Catalog numbers checked: {len(numbers)} (from {len({(n['slug'], n['result_index']) for n in numbers})} reported results)")
    L.append("")
    L.append("| Number status | Count |")
    L.append("|---|---|")
    for k in ["found", "not-found", "page-unreadable"]:
        L.append(f"| {k} | {c_num.get(k, 0)} |")
    L.append("")
    own_nf = sum(1 for n in numbers if n["status"] == "not-found" and n.get("own_calculation"))
    own_un = sum(1 for n in numbers if n["status"] == "page-unreadable" and n.get("own_calculation"))
    L.append(f"{own_nf} of the not-found and {own_un} of the unreadable numbers are the catalog's own calculations from data files (see below), not claims about a page.")
    L.append(f"Of the found numbers, {weak} matched only after rounding (for example 7.23 percent found as 7.2).")
    unread_landing = sum(1 for n in numbers if n["status"] == "page-unreadable" and "abstract" in n.get("reason", ""))
    L.append(f"Of the unreadable ones, {unread_landing} cite only an abstract or landing page, and the rest are blocked, broken or failed to extract.")
    L.append("")
    L.append(f"Numbers written next to links in docs/research: {len(doc_nums)} checked, "
             f"{c_doc.get('found',0)} found, {c_doc.get('not-found',0)} not found, {c_doc.get('page-unreadable',0)} unreadable.")
    L.append("")
    L.append(f"Reported results marked verified_on_page=true but with a number missing from a readable page: {len(contra_entries)} results ({len(contra)} numbers).")
    L.append("")
    L.append(f"Papers (DOI, arXiv, NBER or SSRN id) cited in more than one place: {len(multi)}. With a year or first-author disagreement between places: {len(dis)}.")
    L.append("")

    # suspicious numbers
    L.append("## Catalog numbers not found on a readable page")
    L.append("")
    L.append("These are the suspicious ones. The page opened and had text, but the number was not on it.")
    L.append("")
    L.append("| Entry | Result | Field | Value | Claimed verified | Source | Page read |")
    L.append("|---|---|---|---|---|---|---|")
    for n in sorted([n for n in numbers if n["status"] == "not-found" and not n.get("own_calculation")], key=lambda n: (n["slug"], n["result_index"], NUM_FIELDS.index(n["field"]))):
        L.append(f"| {n['slug']} | {n['result_index']} | {n['field']} | {fmt_val(n['field'], n['value'])} | "
                 f"{'yes' if n.get('verified_on_page') else 'no'} | {md_cell(n.get('source'))[:90]} | {md_cell(n.get('text_source'))} |")
    L.append("")
    own = [n for n in numbers if n.get("own_calculation")]
    L.append("## Numbers the catalog says it calculated itself")
    L.append("")
    L.append(f"{len(own)} numbers in {len({(n['slug'], n['result_index']) for n in own})} reported results say \"our calculation\" from a public dataset. They cannot be")
    L.append("checked by reading a page. They need to be recomputed from the data file. Entries: "
             + ", ".join(sorted({n['slug'] for n in own})) + ".")
    L.append("")
    scat = sorted({(n["slug"], n["result_index"]) for n in numbers if n.get("colocated") is False})
    L.append("## Found, but scattered across the page")
    L.append("")
    L.append("All numbers of these results were found, but not close together (more than 1,500 characters apart at best), so")
    L.append("they may be matching unrelated places in the paper rather than one table row. Worth a look.")
    L.append("")
    L.append("| Entry | Result | Closest window (characters) | Source |")
    L.append("|---|---|---|---|")
    for slug, i in scat:
        ns = [n for n in numbers if n["slug"] == slug and n["result_index"] == i and n.get("colocated") is False]
        L.append(f"| {slug} | {i} | {ns[0].get('colocation_window_chars') or ns[0].get('colocation_note','')} | {md_cell(ns[0].get('source'))[:100]} |")
    L.append("")
    weak_single = []
    for key in sorted({(n["slug"], n["result_index"]) for n in numbers}):
        rs = [n for n in numbers if (n["slug"], n["result_index"]) == key]
        fnd = [n for n in rs if n["status"] == "found"]
        if len(fnd) == 1 and not fnd[0].get("own_calculation") and (fnd[0].get("near_field_word") is False or fnd[0].get("match_strength") == "rounded"):
            weak_single.append(fnd[0])
    L.append("## Found, but only weakly")
    L.append("")
    L.append("The only number of the result that was found, and either no matching word (Sharpe, return, volatility, drawdown) is nearby or it")
    L.append("matched only after rounding. The match may be a coincidence.")
    L.append("")
    L.append("| Entry | Result | Field | Value | Snippet |")
    L.append("|---|---|---|---|---|")
    for n in weak_single:
        L.append(f"| {n['slug']} | {n['result_index']} | {n['field']} | {n['value']} | {md_cell(n.get('snippet'))} |")
    L.append("")
    L.append("## verified_on_page claims that the page contradicts")
    L.append("")
    L.append("Each of these reported results says it was checked on the page, but at least one of its numbers is not on the readable page.")
    L.append("")
    L.append("| Entry | Result | Missing fields | Source |")
    L.append("|---|---|---|---|")
    for slug, i in contra_entries:
        ns = [n for n in contra if n["slug"] == slug and n["result_index"] == i]
        found = [n for n in numbers if n["slug"] == slug and n["result_index"] == i and n["status"] == "found"]
        miss = ", ".join(f"{n['field']}={n['value']}" for n in ns)
        L.append(f"| {slug} | {i} | {miss}{' (others found: ' + ', '.join(n['field'] for n in found) + ')' if found else ''} | {md_cell(ns[0].get('source'))[:100]} |")
    L.append("")
    L.append("## Catalog numbers whose page could not be read")
    L.append("")
    reasons = collections.Counter()
    for n in numbers:
        if n["status"] == "page-unreadable":
            reasons[re.sub(r"HTTP \d+", lambda m: m.group(0), n.get("reason", ""))[:90]] += 1
    L.append("| Reason | Numbers |")
    L.append("|---|---|")
    for r, c in reasons.most_common():
        L.append(f"| {md_cell(r)} | {c} |")
    L.append("")
    unread_urls = collections.Counter(n["source_url"] for n in numbers if n["status"] == "page-unreadable")
    L.append("Pages behind the unreadable numbers:")
    L.append("")
    for u, c in unread_urls.most_common():
        st = next((n.get("reason") for n in numbers if n["source_url"] == u and n["status"] == "page-unreadable"), "")
        L.append(f"- {u} ({c} numbers; {md_cell(st)})")
    L.append("")

    # broken links
    L.append("## Links that are broken")
    L.append("")
    L.append("| Link | Status | Why | Cited in |")
    L.append("|---|---|---|---|")
    for s in sources:
        if s["status"] in ("not-found", "error"):
            locs = sorted({l["file"] for l in s["locations"]})
            L.append(f"| {s['url']} | {s['status']} | {md_cell(s['reason'])[:80]} | {', '.join(locs)[:150]} |")
    L.append("")
    L.append("## Links that block automated readers")
    L.append("")
    L.append("These may work in a normal browser. They cannot be checked by script.")
    nd = [s for s in sources if s.get("doi")]
    L.append(f"Of these, {sum(1 for s in nd if s['status']=='blocked')} are DOI links that reach a publisher which blocks scripts. "
             f"All {sum(1 for s in nd if s.get('doi_handle')=='registered')} of {len(nd)} DOI links are registered DOIs (checked with the doi.org handle API).")
    L.append("")
    bd = collections.Counter(domain(s["url"]) for s in sources if s["status"] == "blocked")
    L.append(", ".join(f"{d} ({c})" for d, c in bd.most_common()))
    L.append("")

    # cross refs
    L.append("## Cross-reference disagreements")
    L.append("")
    L.append("The same paper (same DOI, arXiv, NBER or SSRN id) cited with a different year or first author in different places.")
    L.append("Year gaps of a few years are often a working paper year against a journal year, which is a style issue, not an error.")
    L.append("")
    L.append("Real disagreements between citations of the same paper:")
    L.append("")
    L.append("| Paper id | Problem | Places |")
    L.append("|---|---|---|")
    for c in [c for c in dis if not c.get("disagreement_only_with_origin_field")]:
        pl = "; ".join(f"{p['file'].split('/')[-1]} {p['where']}: {p['cited_first_author']} {p['cited_year']}" for p in c["places"] if p["cited_first_author"] or p["cited_year"])
        L.append(f"| {c['type']}:{c['id']} | {md_cell('; '.join(d['detail'] for d in c['disagreements']))} | {md_cell(pl)[:400]} |")
    L.append("")
    L.append("Disagreements that involve only an entry's origin field. Either the origin names who first had the idea (for example")
    L.append("Appel for MACD, 1979) while origin.source_url links a later paper by someone else, or the origin year is the working")
    L.append("paper year while other places give the journal year. Not citation errors, but the origin link does not always point")
    L.append("to the originator:")
    L.append("")
    L.append("| Paper id | Problem | Places |")
    L.append("|---|---|---|")
    for c in [c for c in dis if c.get("disagreement_only_with_origin_field")]:
        pl = "; ".join(f"{p['file'].split('/')[-1]} {p['where']}: {p['cited_first_author']} {p['cited_year']}" for p in c["places"] if p["cited_first_author"] or p["cited_year"])
        L.append(f"| {c['type']}:{c['id']} | {md_cell('; '.join(d['detail'] for d in c['disagreements']))} | {md_cell(pl)[:400]} |")
    L.append("")
    L.append("## Citations that disagree with the registry")
    L.append("")
    L.append("Year or first author given in the repo against Crossref or arXiv metadata. Only first-author mismatches and year gaps")
    L.append("of more than 3 years are listed here, since smaller gaps are usually working paper against journal year. All are in crossrefs.json.")
    L.append("")
    L.append("| Paper id | Registry title | Problem |")
    L.append("|---|---|---|")
    for c in regm:
        rows = []
        for m in c["registry_mismatches"]:
            if m["type"] == "first-author":
                rows.append(m)
            else:
                ys = re.findall(r"\d{4}", m["detail"])
                if len(ys) >= 2 and abs(int(ys[0]) - int(ys[1])) > 3:
                    rows.append(m)
        if rows:
            det = "; ".join(f"{m['place'].split('/')[-1]}: {m['detail']}" for m in rows)
            L.append(f"| {c['type']}:{c['id']} | {md_cell((c['registry'] or {}).get('title'))[:70]} | {md_cell(det)[:400]} |")
    L.append("")

    # doc numbers
    L.append("## Numbers in docs/research not found on the linked page")
    L.append("")
    L.append("Found by a looser scan: every decimal or percent in a list item or table row that has a link. Some are the doc's")
    L.append("own numbers rather than claims about the link, so treat this as a list to look at, not a list of errors.")
    L.append("")
    L.append("| Doc line | Number | Context | Page read |")
    L.append("|---|---|---|---|")
    for n in sorted([n for n in doc_nums if n["status"] == "not-found"], key=lambda n: (n["file"], n["line"])):
        L.append(f"| {n['file'].split('/')[-1]}:{n['line']} | {n['value']} | {md_cell(n['context'])[:110]} | {md_cell(n.get('text_source'))[:90]} |")
    L.append("")
    manual = OUT / "manual_checks.md"
    if manual.exists():
        L.append(manual.read_text().rstrip())
        L.append("")
    # say so when a table came out empty
    out = []
    for i, line in enumerate(L):
        out.append(line)
        if re.match(r"^\|(---\|)+$", line) and (i + 1 >= len(L) or not L[i + 1].startswith("|")):
            out.append("| (none) |" + " |" * (line.count("|") - 2))
    L = out
    text = "\n".join(L)
    for bad, good in (("—", "-"), ("–", "-"), ("‘", "'"), ("’", "'"), ("“", '"'), ("”", '"')):
        text = text.replace(bad, good)
    (OUT / "SUMMARY.md").write_text(text)


if __name__ == "__main__":
    sys.exit(main())
