"""Markdown for newsroom articles, to HTML. Standard library only.

Supports what an article needs and nothing else:
  ## and ### headings (with anchors), paragraphs, bullet and numbered lists, tables, fenced code,
  > quotes, > [!pull] pull quotes, > [!note] notes, ![alt](src "caption") images,
  **bold**, *italic*, `code`, [links](url) and [^id] citations, numbered in order of first use.
Raw HTML is escaped, never passed through.
"""
from __future__ import annotations

import html
import re
from typing import Callable

e = html.escape


def anchor_id(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "section"


class Renderer:
    def __init__(self, cite_number: Callable[[str], int], figure: Callable[[str, str, str], str]):
        self.cite_number = cite_number  # id -> its number in the sources list
        self.figure = figure  # (alt, src, caption) -> HTML
        self.headings: list[tuple[int, str, str]] = []

    # ------------------------------------------------------------ inline
    def inline(self, text: str) -> str:
        out, pos = [], 0
        pat = re.compile(r"\[\^([A-Za-z0-9_:-]+)\]|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`")
        for m in pat.finditer(text):
            out.append(e(text[pos:m.start()]))
            if m.group(1):
                n = self.cite_number(m.group(1))
                out.append(f'<sup class="cite"><a href="#source-{n}" id="cite-{e(m.group(1))}-{n}" '
                           f'aria-label="Source {n}">[{n}]</a></sup>')
            elif m.group(2):
                href = m.group(3)
                if not re.match(r"^(https?://|/|#|mailto:)", href):
                    out.append(self.inline(m.group(2)))  # unknown scheme: keep the words, drop the link
                else:
                    ext = ' rel="noopener"' if href.startswith("http") else ""
                    out.append(f'<a href="{e(href)}"{ext}>{self.inline(m.group(2))}</a>')
            elif m.group(4):
                out.append(f"<strong>{self.inline(m.group(4))}</strong>")
            elif m.group(5):
                out.append(f"<em>{self.inline(m.group(5))}</em>")
            else:
                out.append(f"<code>{e(m.group(6))}</code>")
            pos = m.end()
        out.append(e(text[pos:]))
        return "".join(out)

    # ------------------------------------------------------------ blocks
    def render(self, md: str) -> str:
        lines = md.replace("\r\n", "\n").split("\n")
        out: list[str] = []
        i = 0
        while i < len(lines):
            line = lines[i]
            s = line.strip()
            if not s:
                i += 1
                continue
            if s.startswith("```"):
                j = i + 1
                code = []
                while j < len(lines) and not lines[j].strip().startswith("```"):
                    code.append(lines[j])
                    j += 1
                out.append(f"<pre><code>{e(chr(10).join(code))}</code></pre>")
                i = j + 1
                continue
            h = re.match(r"^(#{2,3})\s+(.*)$", s)
            if h:
                level = len(h.group(1))
                text = h.group(2).strip()
                hid = anchor_id(text)
                n = sum(1 for x in self.headings if x[1] == hid)
                hid = hid if n == 0 else f"{hid}-{n + 1}"
                self.headings.append((level, hid, text))
                out.append(f'<h{level} id="{hid}">{self.inline(text)}</h{level}>')
                i += 1
                continue
            img = re.fullmatch(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)", s)
            if img:
                out.append(self.figure(img.group(1), img.group(2), img.group(3) or ""))
                i += 1
                continue
            if s.startswith(">"):
                block = []
                while i < len(lines) and lines[i].strip().startswith(">"):
                    block.append(re.sub(r"^\s*>\s?", "", lines[i]))
                    i += 1
                out.append(self.quote(block))
                continue
            if s.startswith("|"):
                rows = []
                while i < len(lines) and lines[i].strip().startswith("|"):
                    rows.append(lines[i].strip())
                    i += 1
                out.append(self.table(rows))
                continue
            if re.match(r"^\s*(?:[-*]|\d+\.)\s+", line):
                items, tag = [], "ol" if re.match(r"^\s*\d+\.", line) else "ul"
                while i < len(lines) and lines[i].strip():
                    m = re.match(r"^\s*(?:[-*]|\d+\.)\s+(.*)$", lines[i])
                    if m:
                        items.append(m.group(1))
                    elif items:
                        items[-1] += " " + lines[i].strip()
                    i += 1
                out.append(f"<{tag}>" + "".join(f"<li>{self.inline(x)}</li>" for x in items) + f"</{tag}>")
                continue
            para = []
            while i < len(lines) and lines[i].strip() and not re.match(r"^\s*(#{2,3}\s|>|\||```|!\[|(?:[-*]|\d+\.)\s)", lines[i]):
                para.append(lines[i].strip())
                i += 1
            if para:
                out.append(f"<p>{self.inline(' '.join(para))}</p>")
            else:  # a line no rule took (a lone "#" heading, say): show it as text
                out.append(f"<p>{self.inline(s)}</p>")
                i += 1
        return "\n".join(out)

    def quote(self, block: list[str]) -> str:
        first = block[0].strip() if block else ""
        kind = re.match(r"^\[!(pull|note)\]\s*(.*)$", first, re.I)
        if kind:
            rest = [kind.group(2)] + block[1:]
            text = " ".join(x.strip() for x in rest if x.strip())
            if kind.group(1).lower() == "pull":
                return f'<figure class="pull"><blockquote><p>{self.inline(text)}</p></blockquote></figure>'
            return f'<aside class="note"><p>{self.inline(text)}</p></aside>'
        paras = " ".join(x.strip() for x in block)
        return f"<blockquote><p>{self.inline(paras)}</p></blockquote>"

    def table(self, rows: list[str]) -> str:
        cells = [[c.strip() for c in r.strip("|").split("|")] for r in rows]
        if len(cells) > 1 and all(re.fullmatch(r":?-{3,}:?", c) for c in cells[1]):
            head, body = cells[0], cells[2:]
        else:
            head, body = None, cells
        thead = ("<thead><tr>" + "".join(f'<th scope="col">{self.inline(c)}</th>' for c in head) + "</tr></thead>") if head else ""
        tbody = "<tbody>" + "".join("<tr>" + "".join(f"<td>{self.inline(c)}</td>" for c in r) + "</tr>" for r in body) + "</tbody>"
        return f'<div class="tablewrap"><table>{thead}{tbody}</table></div>'


def plain(md: str, limit: int = 158) -> str:
    """Text without markup, cut at a word for a description."""
    t = re.sub(r"\[\^[^\]]+\]", "", md)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"[*`#>|]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) <= limit:
        return t
    return t[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "..."
