"""Optional language model redrafting for news commentary (DEC-0073).

Used only with a key Parity owns, passed as PARITY_ANTHROPIC_API_KEY or PARITY_OPENAI_API_KEY
(vault names parity-anthropic-api-key and parity-openai-api-key). Without one, posts stay as
their templates. The model is asked to rewrite the template's prose in plain words without
adding, removing or changing any number or link; the caller then runs the same fact checks on
the result and publishes only when they pass. The key is read from the environment only and
never printed or written. Standard library only.
"""
from __future__ import annotations

import json
import os
import urllib.request

PROMPT = """Rewrite the Markdown post below in plain, short sentences for a general reader.
Rules: keep every number, link, heading, table, citation marker like [^h1] and the final note exactly as they are.
Do not add facts, numbers, links, predictions or advice. Do not quote the linked articles.
Use no em dashes, en dashes, curly quotes or ellipsis characters. Reply with the Markdown only.

"""


def available() -> str:
    if os.environ.get("PARITY_ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.environ.get("PARITY_OPENAI_API_KEY"):
        return "openai"
    return ""


def redraft(body: str, timeout: int = 90) -> tuple[str, str]:
    """(new body, model name). Raises on any failure; the caller keeps the template."""
    which = available()
    if which == "anthropic":
        model = os.environ.get("PARITY_ANTHROPIC_MODEL", "claude-sonnet-4-5")
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps({"model": model, "max_tokens": 4000,
                             "messages": [{"role": "user", "content": PROMPT + body}]}).encode(),
            headers={"x-api-key": os.environ["PARITY_ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
                     "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            doc = json.load(r)
        return "".join(b.get("text", "") for b in doc.get("content", []) if b.get("type") == "text"), model
    if which == "openai":
        model = os.environ.get("PARITY_OPENAI_MODEL", "gpt-4.1-mini")
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps({"model": model, "messages": [{"role": "user", "content": PROMPT + body}]}).encode(),
            headers={"authorization": f"Bearer {os.environ['PARITY_OPENAI_API_KEY']}", "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            doc = json.load(r)
        return doc["choices"][0]["message"]["content"], model
    raise RuntimeError("no Parity language model key is set")
