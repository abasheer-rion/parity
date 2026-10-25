// Turns docs/**/*.md, the glossary and the bibliography into one data module
// (`virtual:parity-docs`) for the reader. Everything is rendered at build time, so
// the browser only looks things up: no markdown parsing on page load.
//
// What the build adds to the rendered HTML:
//   - links between docs become in-app links carrying data-doc (and data-anchor)
//   - glossary terms are linked the first time they appear in each section (data-term)
//   - [@key] citations and links to a bibliography URL carry data-ref
// The popup layer in src/components/Popups.tsx reads those attributes.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import MarkdownIt, { type Token } from "markdown-it";
import type { Plugin } from "vite";

const VIRTUAL = "virtual:parity-docs";
const VIRTUAL_INDEX = "virtual:parity-docs-index";
const RESOLVED_INDEX = "\0virtual:parity-docs-index";
const RESOLVED = "\0" + VIRTUAL;
const REPO_BLOB = "https://github.com/abasheer-rion/parity/blob/main/";

// Generated pages that are better served by their own app views.
const SKIP_FILES = new Set(["REFERENCES.md", "TAGS.md", "README.md"]);
// Docs where automatic term links would only add noise.
const NO_TERM_LINKS = new Set(["REF-0004"]);
// Glossary names that do not appear in prose as written. An empty list means never auto-link.
const TERM_ALIASES: Record<string, string[]> = {
  "WTI and Brent": ["WTI", "Brent"],
  "Long and short": ["long and short", "short selling", "short position"],
  "Spread (bid and ask)": ["bid and ask spread", "bid-ask spread"],
  "Total return (dividends reinvested)": ["total return"],
  "Basis point (bp)": ["basis point"],
  "Data snooping (multiple testing)": ["data snooping", "multiple testing"],
  "Out of sample (holdout)": ["out of sample", "out-of-sample", "holdout"],
  "Return": [],
  "Sharpe ratio": ["Sharpe ratio", "Sharpe"],
};

interface RefEntry {
  key: string;
  type: string;
  authors: string[];
  year: number | null;
  title: string | null;
  venue: string | null;
  url: string | null;
  doi: string | null;
  verification: string | null;
  note: string | null;
}

interface Term { id: string; term: string }
type Meta = Record<string, string | string[]>;

function frontMatter(text: string): [Meta, string] {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return [{}, text];
  const meta: Meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    meta[kv[1]] = v.startsWith("[")
      ? v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)
      : v.replace(/^["']|["']$/g, "");
  }
  return [meta, text.slice(m[0].length)];
}

/** GitHub's anchor rule, the same one scripts/docs.py checks links against. */
function slugify(heading: string): string {
  let h = heading.trim().toLowerCase().replace(/[`*_~]|<[^>]+>/g, "");
  h = h.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  h = h.replace(/[^\p{L}\p{N}_\- ]/gu, "");
  return h.replace(/ /g, "-");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name.startsWith("_") ? [] : walk(p);
    return name.endsWith(".md") ? [p] : [];
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One regex per name; abbreviations match case-sensitively, names do not. Longest first. */
function termMatchers(terms: Term[]): { id: string; re: RegExp }[] {
  const out: { id: string; re: RegExp; len: number }[] = [];
  for (const t of terms) {
    let names = TERM_ALIASES[t.term];
    if (!names) {
      const paren = t.term.match(/^(.*?)\s*\(([^)]+)\)$/);
      names = paren ? [paren[1], paren[2]] : [t.term];
    }
    for (const name of names) {
      const abbrev = /^[A-Z0-9&]{2,}$/.test(name);
      const body = escapeRe(name).replace(/ /g, "[\\s-]");
      const re = abbrev
        ? new RegExp(`(?<![\\w&])${body}(?![\\w&])`, "g")
        : new RegExp(`(?<![\\w-])${body}(?:s|es)?(?![\\w-])`, "gi");
      out.push({ id: t.id, re, len: name.length });
    }
  }
  return out.sort((a, b) => b.len - a.len);
}

function citeLabel(r: RefEntry | undefined, key: string): string {
  if (!r) return key;
  const a = r.authors;
  const who = a.length > 2 ? `${a[0]} et al.` : a.length === 2 ? `${a[0]} and ${a[1]}` : a[0] ?? key;
  return `${who} ${r.year ?? ""}`.trim();
}

export function buildDocs(root: string) {
  const docsDir = join(root, "docs");
  const glossary = JSON.parse(readFileSync(join(docsDir, "_system/glossary.json"), "utf8"));
  const terms: Term[] = glossary.terms;
  const refsRaw = JSON.parse(readFileSync(join(docsDir, "_system/references.json"), "utf8")).references as (RefEntry & { used_in?: string[] })[];
  const refs: Record<string, RefEntry> = {};
  const refByUrl: Record<string, string> = {};
  for (const r of refsRaw) {
    refs[r.key] = {
      key: r.key, type: r.type, authors: r.authors ?? [], year: r.year ?? null, title: r.title ?? null,
      venue: r.venue ?? null, url: r.url ?? null, doi: r.doi ?? null, verification: r.verification ?? null,
      note: r.note ?? null,
    };
    if (r.url) refByUrl[r.url.replace(/\/$/, "")] = r.key;
  }
  const matchers = termMatchers(terms);

  // First pass: map file paths to ids so links can be resolved.
  const byPath: Record<string, string> = {};
  const sources: { rel: string; meta: Meta; body: string }[] = [];
  for (const file of walk(docsDir)) {
    if (SKIP_FILES.has(relative(docsDir, file))) continue;
    const rel = relative(root, file).split("\\").join("/");
    const [meta, body] = frontMatter(readFileSync(file, "utf8"));
    if (!meta.id && rel === "docs/RESULTS.md") Object.assign(meta, { id: "RESULTS", title: "Results register", type: "register", status: "generated" });
    if (!meta.id) continue;
    byPath[rel] = meta.id as string;
    sources.push({ rel, meta, body });
  }

  const md = new MarkdownIt({ html: true });
  const TokenCtor = md.parse("x", {})[0].constructor as unknown as new (type: string, tag: string, nesting: number) => Token;
  const docs = [];
  const links: Record<string, Set<string>> = {};

  for (const src of sources) {
    const id = src.meta.id as string;
    const out = new Set<string>();
    const used = new Set<string>();
    // The reader shows backlinks itself, so drop the generated block.
    const body = src.body.replace(/<!-- backlinks:start[\s\S]*?<!-- backlinks:end -->/g, "");
    const tokens = md.parse(body, {});
    const seen: Record<string, number> = {};
    const headings: { id: string; text: string; level: number }[] = [];
    let linked = new Set<string>();
    let first = true;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type === "heading_open") {
        const text = tokens[i + 1].content;
        const base = slugify(text);
        const n = seen[base] ?? 0;
        seen[base] = n + 1;
        const hid = n === 0 ? base : `${base}-${n}`;
        tok.attrSet("id", hid);
        const level = Number(tok.tag.slice(1));
        if (level === 1 && first) tok.attrSet("class", "doc-title");
        else headings.push({ id: hid, text, level });
        if (level <= 2) linked = new Set();
        first = false;
        continue;
      }
      if (tok.type !== "inline" || !tok.children) continue;
      const inHeading = tokens[i - 1]?.type === "heading_open";
      const children: Token[] = [];
      let depth = 0;
      for (const child of tok.children) {
        if (child.type === "link_open") { depth++; rewriteLink(child, src.rel, id, out); children.push(child); continue; }
        if (child.type === "link_close") { depth--; children.push(child); continue; }
        if (child.type !== "text" || depth > 0 || inHeading) { children.push(child); continue; }
        children.push(...splitText(child, NO_TERM_LINKS.has(id) ? null : linked, used));
      }
      tok.children = children;
    }

    const html = md.renderer.render(tokens, md.options, {});
    const plain = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
    // "Mentioned in" counts every mention, not only the linked first ones.
    for (const m of matchers) if (plain.match(m.re)) used.add(m.id);
    links[id] = out;
    docs.push({
      id,
      title: (src.meta.title as string) ?? id,
      type: (src.meta.type as string) ?? "",
      status: (src.meta.status as string) ?? "",
      created: (src.meta.created as string) ?? "",
      updated: (src.meta.updated as string) ?? "",
      tags: (src.meta.tags as string[]) ?? [],
      related: (src.meta.related as string[]) ?? [],
      path: src.rel,
      html,
      headings,
      terms: [...used].sort(),
    });
  }

  const backlinks: Record<string, string[]> = {};
  const addBack = (to: string, from: string) => {
    if (to === from) return;
    const list = (backlinks[to] ??= []);
    if (!list.includes(from)) list.push(from);
  };
  for (const [from, tos] of Object.entries(links)) for (const to of tos) addBack(to, from);
  for (const d of docs) for (const r of d.related) addBack(r, d.id);
  const termDocs: Record<string, string[]> = {};
  for (const d of docs) for (const t of d.terms) (termDocs[t] ??= []).push(d.id);
  const refDocs: Record<string, string[]> = {};
  for (const r of refsRaw) {
    const ids = [...new Set((r.used_in ?? []).map((p) => byPath[p]).filter(Boolean))];
    if (ids.length) refDocs[r.key] = ids;
  }
  docs.sort((a, b) => a.id.localeCompare(b.id));
  return { docs, backlinks, termDocs, refs, refDocs };

  function rewriteLink(tok: Token, fromRel: string, fromId: string, out: Set<string>) {
    const href = String(tok.attrGet("href") ?? "");
    if (/^https?:/.test(href)) {
      tok.attrSet("target", "_blank");
      tok.attrSet("rel", "noreferrer");
      const key = refByUrl[href.replace(/\/$/, "")];
      if (key) tok.attrSet("data-ref", key);
      return;
    }
    if (href.startsWith("mailto:")) return;
    const [pathPart, anchor = ""] = href.split("#");
    const id = pathPart ? byPath[posix.normalize(posix.join(posix.dirname(fromRel), pathPart))] : fromId;
    if (id) {
      if (id !== fromId) out.add(id);
      tok.attrSet("href", `#/doc/${id}${anchor ? "/" + anchor : ""}`);
      tok.attrSet("data-doc", id);
      if (anchor) tok.attrSet("data-anchor", anchor);
    } else {
      const target = posix.normalize(posix.join(posix.dirname(fromRel), pathPart));
      tok.attrSet("href", REPO_BLOB + target + (anchor ? "#" + anchor : ""));
      tok.attrSet("target", "_blank");
      tok.attrSet("rel", "noreferrer");
    }
  }

  function splitText(tok: Token, linked: Set<string> | null, used: Set<string>): Token[] {
    const text = tok.content;
    const hits: { start: number; end: number; html: string }[] = [];
    for (const m of text.matchAll(/\[@([a-z0-9-]+(?:\s*;\s*@[a-z0-9-]+)*)\]/g)) {
      const keys = m[1].split(";").map((k) => k.trim().replace(/^@/, ""));
      const inner = keys.map((k) => `<a class="cite-link" href="#/refs/${k}" data-ref="${escapeHtml(k)}">${escapeHtml(citeLabel(refs[k], k))}</a>`);
      hits.push({ start: m.index!, end: m.index! + m[0].length, html: `<span class="cite">(${inner.join("; ")})</span>` });
    }
    if (linked) {
      for (const { id, re } of matchers) {
        if (linked.has(id)) continue;
        for (const m of text.matchAll(re)) {
          const s = m.index!, e = s + m[0].length;
          if (hits.some((h) => s < h.end && e > h.start)) continue;
          hits.push({ start: s, end: e, html: `<a class="term-link" href="#/learn/${id}" data-term="${id}">${escapeHtml(m[0])}</a>` });
          linked.add(id);
          used.add(id);
          break;
        }
      }
    }
    if (!hits.length) return [tok];
    hits.sort((a, b) => a.start - b.start);
    const result: Token[] = [];
    const push = (type: string, content: string) => { const t = new TokenCtor(type, "", 0); t.content = content; result.push(t); };
    let pos = 0;
    for (const h of hits) {
      if (h.start > pos) push("text", text.slice(pos, h.start));
      push("html_inline", h.html);
      pos = h.end;
    }
    if (pos < text.length) push("text", text.slice(pos));
    return result;
  }
}

export function parityDocs(): Plugin {
  const root = resolve(import.meta.dirname, "../..");
  const docsDir = join(root, "docs");
  return {
    name: "parity-docs",
    resolveId(id) { return id === VIRTUAL ? RESOLVED : id === VIRTUAL_INDEX ? RESOLVED_INDEX : null; },
    load(id) {
      // The list of docs without their text, for pages that only show titles (a few kB).
      if (id === RESOLVED_INDEX) {
        for (const f of walk(docsDir)) this.addWatchFile(f);
        const { docs } = buildDocs(root) as { docs: Record<string, unknown>[] };
        return `export default ${JSON.stringify(docs.map(({ id, title, type, status, created, updated, tags }) => ({ id, title, type, status, created, updated, tags })))};`;
      }
      if (id !== RESOLVED) return null;
      for (const f of walk(docsDir)) this.addWatchFile(f);
      this.addWatchFile(join(docsDir, "_system/glossary.json"));
      this.addWatchFile(join(docsDir, "_system/references.json"));
      return `export default ${JSON.stringify(buildDocs(root))};`;
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(docsDir)) return;
      for (const id of [RESOLVED, RESOLVED_INDEX]) {
        const mod = server.moduleGraph.getModuleById(id);
        if (mod) server.moduleGraph.invalidateModule(mod);
      }
    },
  };
}
