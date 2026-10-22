#!/usr/bin/env python3
"""Builds the auth emails. Standard library only.

    python3 auth/build.py           write auth/dist/* and auth/preview.html
    python3 auth/build.py --check   fail if auth/dist or the preview is out of date

Each email in auth/emails/<key>.html is a short body made of partials. This script
puts the body inside auth/emails/_layout.html, expands every partial from
auth/emails/partials/, and writes one finished file per email to auth/dist/<key>.html.
The <key> is the template's name in Supabase (confirmation, magic_link, ...), so the
same word is used in the source, in dist, in supabase/config.toml and in the API.

Syntax, chosen so it never clashes with Supabase's Go templates ({{ .Token }}):

    [[> button url="..." label="..." ]]   include partials/button.html with arguments
    [[ label ]]                           an argument inside a partial
    [[ asset_base ]]                      where images are served from (ASSET_BASE below)

The first lines of each email are a comment with its subject and preheader:

    <!--
    subject: Confirm your email for Parity
    preheader: One step left.
    -->
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "emails"
PARTIALS = SRC / "partials"
DIST = HERE / "dist"
PREVIEW = HERE / "preview.html"

# Images in emails must be absolute URLs. The brand folder on the live site is public.
ASSET_BASE = "https://parity.endyland.com"

# The order emails appear in the preview and the README, with when each one is sent.
EMAILS = {
    "confirmation": "Someone signs up with email and password",
    "magic_link": "Someone asks for a sign-in code",
    "recovery": "Someone asks to reset their password",
    "email_change": "A signed-in person changes their email address",
    "invite": "The owner invites someone from the Supabase dashboard",
    "reauthentication": "A signed-in person changes their password and must prove it is them",
}

# Supabase variables each template may use. Anything else is a typo and fails the build.
COMMON_VARS = {"SiteURL", "Email", "Token", "TokenHash", "ConfirmationURL", "RedirectTo", "Data"}
EXTRA_VARS = {"email_change": {"NewEmail"}}

# Sample values for the preview only.
SAMPLE = {
    "SiteURL": "https://parity.endyland.com",
    "Email": "amanda@example.com",
    "NewEmail": "amanda.new@example.com",
    "Token": "482913",
    "TokenHash": "3f9a1c7e5b2d4f60a8e1c4b7",
    "ConfirmationURL": "https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1/verify?token=sample",
    "RedirectTo": "https://sim.endyland.com/sim/",
}

TEXT_FOOTER = (
    "\n--\nSent by Parity to {{ .Email }}. Research only, not investment advice.\n"
    "You are getting this because someone used this address on Parity ({{ .SiteURL }}).\n"
    "If that was not you, you can ignore this email.\n"
)

META_RE = re.compile(r"\A<!--\s*\n(.*?)\n-->\s*\n", re.S)
INCLUDE_RE = re.compile(r"\[\[>\s*([a-z_]+)((?:\s+[a-z_]+=\"[^\"]*\")*)\s*\]\]")
ARG_RE = re.compile(r"([a-z_]+)=\"([^\"]*)\"")
SLOT_RE = re.compile(r"\[\[\s*([a-z_]+)\s*\]\]")
GO_VAR_RE = re.compile(r"\{\{\s*\.([A-Za-z]+)[^}]*\}\}")


class BuildError(Exception):
    pass


def fill(text: str, values: dict[str, str], where: str) -> str:
    def slot(m: re.Match) -> str:
        if m.group(1) not in values:
            raise BuildError(f"{where}: no value for [[ {m.group(1)} ]]")
        return values[m.group(1)]
    return SLOT_RE.sub(slot, text)


def expand(text: str, where: str, depth: int = 0) -> str:
    if depth > 5:
        raise BuildError(f"{where}: partials nest too deep")

    def include(m: re.Match) -> str:
        name, raw_args = m.group(1), m.group(2)
        path = PARTIALS / f"{name}.html"
        if not path.exists():
            raise BuildError(f"{where}: unknown partial '{name}'")
        args = {"asset_base": ASSET_BASE, **dict(ARG_RE.findall(raw_args))}
        body = fill(path.read_text(encoding="utf-8").rstrip("\n"), args, f"partials/{name}.html")
        return expand(body, f"partials/{name}.html", depth + 1)

    return INCLUDE_RE.sub(include, text)


def parse_meta(text: str, where: str) -> tuple[dict[str, str], str]:
    m = META_RE.match(text)
    if not m:
        raise BuildError(f"{where}: must start with a <!-- subject: ... preheader: ... --> comment")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    for key in ("subject", "preheader"):
        if not meta.get(key):
            raise BuildError(f"{where}: missing '{key}'")
    return meta, text[m.end():]


def check_vars(key: str, text: str, where: str):
    allowed = COMMON_VARS | EXTRA_VARS.get(key, set())
    for var in GO_VAR_RE.findall(text):
        if var not in allowed:
            raise BuildError(f"{where}: {{{{ .{var} }}}} is not available in the {key} template")
    if text.count("{{") != text.count("}}"):
        raise BuildError(f"{where}: unbalanced {{{{ }}}}")
    if "[[" in text:
        raise BuildError(f"{where}: unexpanded [[ ... ]] left in the output")


def build() -> dict[Path, str]:
    """Return every output file and its content, without writing anything."""
    layout = (SRC / "_layout.html").read_text(encoding="utf-8")
    out: dict[Path, str] = {}
    subjects: dict[str, str] = {}
    sources = {p.stem for p in SRC.glob("*.html") if not p.name.startswith("_")}
    if sources != set(EMAILS):
        raise BuildError(f"emails/ has {sorted(sources)}, expected {sorted(EMAILS)}")
    for key in EMAILS:
        where = f"emails/{key}.html"
        meta, body = parse_meta((SRC / f"{key}.html").read_text(encoding="utf-8"), where)
        content = expand(body.strip("\n"), where)
        page = expand(layout, "_layout.html")
        page = fill(page, {"title": html.escape(meta["subject"]), "preheader": html.escape(meta["preheader"]),
                           "content": content}, "_layout.html")
        check_vars(key, page, f"dist/{key}.html")
        if len(page.encode()) > 100_000:
            raise BuildError(f"dist/{key}.html is over 100 kB; Gmail cuts emails off at 102 kB")
        txt_path = SRC / f"{key}.txt"
        if not txt_path.exists():
            raise BuildError(f"emails/{key}.txt is missing; every email has a plain-text version")
        text = txt_path.read_text(encoding="utf-8").rstrip("\n") + "\n" + TEXT_FOOTER
        check_vars(key, text, f"dist/{key}.txt")
        out[DIST / f"{key}.html"] = page
        out[DIST / f"{key}.txt"] = text
        subjects[key] = meta["subject"]
    out[DIST / "subjects.json"] = json.dumps(subjects, indent=2) + "\n"
    check_config(subjects)
    out[PREVIEW] = preview(out, subjects)
    return out


def check_config(subjects: dict[str, str]):
    """supabase/config.toml must point every template at auth/dist with the same subject."""
    import tomllib
    cfg = tomllib.loads((HERE.parent / "supabase" / "config.toml").read_text(encoding="utf-8"))
    templates = cfg.get("auth", {}).get("email", {}).get("template", {})
    for key, subject in subjects.items():
        t = templates.get(key)
        if not t:
            raise BuildError(f"supabase/config.toml has no [auth.email.template.{key}]")
        if t.get("content_path") != f"./auth/dist/{key}.html":
            raise BuildError(f"supabase/config.toml: {key} content_path must be ./auth/dist/{key}.html")
        if t.get("subject") != subject:
            raise BuildError(f"supabase/config.toml: {key} subject differs from emails/{key}.html")


def sample(text: str) -> str:
    # The preview shows the logo from this checkout, so it works before the site is deployed.
    text = text.replace(f"{ASSET_BASE}/brand/", "../web/public/brand/")
    return GO_VAR_RE.sub(lambda m: SAMPLE.get(m.group(1), m.group(0)), text)


def preview(out: dict[Path, str], subjects: dict[str, str]) -> str:
    cards = []
    for key, when in EMAILS.items():
        page = html.escape(sample(out[DIST / f"{key}.html"]), quote=True)
        text = html.escape(sample(out[DIST / f"{key}.txt"]))
        cards.append(f"""
<section class="email" id="{key}">
  <header>
    <h2>{html.escape(subjects[key])}</h2>
    <p><code>{key}</code> &middot; {html.escape(when)} &middot; <a href="dist/{key}.html">dist/{key}.html</a></p>
  </header>
  <div class="frames">
    <figure><figcaption>Light</figcaption><iframe title="{key}, light" style="color-scheme: light" srcdoc="{page}"></iframe></figure>
    <figure><figcaption>Dark (Apple Mail)</figcaption><iframe title="{key}, dark" style="color-scheme: dark" srcdoc="{page}"></iframe></figure>
    <figure><figcaption>Plain text</figcaption><pre>{text}</pre></figure>
  </div>
</section>""")
    nav = " ".join(f'<a href="#{k}">{k}</a>' for k in EMAILS)
    return f"""<!DOCTYPE html>
<!-- Generated by auth/build.py. Do not edit by hand. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Parity emails</title>
<style>
  :root {{ color-scheme: light dark; --bg: #f6f7fa; --fg: #16171f; --muted: #5d6070; --line: #e4e5ee; --panel: #ffffff; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --bg: #0b0b12; --fg: #ececf4; --muted: #9b9db2; --line: #26263a; --panel: #141420; }} }}
  body {{ margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
  main {{ max-width: 1440px; margin: 0 auto; padding: 24px 16px 64px; }}
  h1 {{ font-size: 22px; margin: 0 0 4px; }}
  nav a {{ margin-right: 12px; color: #2f6bff; }}
  .email {{ margin-top: 32px; border-top: 1px solid var(--line); padding-top: 20px; }}
  .email h2 {{ font-size: 17px; margin: 0; }}
  .email p, figcaption {{ color: var(--muted); margin: 2px 0 12px; }}
  .frames {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }}
  figure {{ margin: 0; min-width: 0; }}
  iframe {{ width: 100%; height: 780px; border: 1px solid var(--line); border-radius: 10px; background: transparent; }}
  pre {{ margin: 0; height: 780px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 12px; }}
</style>
</head>
<body>
<main>
  <h1>Parity emails</h1>
  <p style="color: var(--muted); margin: 0 0 8px;">Every auth email with sample values in place of the Supabase variables. Rebuild with <code>python3 auth/build.py</code>.</p>
  <nav>{nav}</nav>
  {"".join(cards)}
</main>
</body>
</html>
"""


def main() -> int:
    try:
        files = build()
    except BuildError as e:
        print(f"error {e}")
        return 1
    stale = [p for p, text in files.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
    extra = [p for p in DIST.glob("*") if p not in files] if DIST.exists() else []
    if "--check" in sys.argv:
        for p in stale + extra:
            print(f"error {p.relative_to(HERE.parent)} is out of date (run `python3 auth/build.py`)")
        return 1 if stale or extra else 0
    DIST.mkdir(exist_ok=True)
    for p in extra:
        p.unlink()
    for p in stale:
        p.write_text(files[p], encoding="utf-8")
    print(f"built {len(EMAILS)} emails into auth/dist ({len(stale)} files changed) and auth/preview.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
