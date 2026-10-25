// The research docs, rendered at build time by plugins/docs.ts from files in this
// repo. Loaded as its own chunk after the first paint, so the dashboard opens fast
// and the reader is instant afterwards.
import { useEffect, useState } from "react";

export interface DocEntry {
  id: string;
  title: string;
  type: string;
  status: string;
  created: string;
  updated: string;
  tags: string[];
  related: string[];
  path: string;
  html: string;
  plain: string;
  headings: { id: string; text: string; level: number }[];
  terms: string[];
}

export interface RefEntry {
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

export interface DocsData {
  docs: DocEntry[];
  byId: Record<string, DocEntry>;
  backlinks: Record<string, string[]>;
  termDocs: Record<string, string[]>;
  refs: Record<string, RefEntry>;
  refDocs: Record<string, string[]>;
}

export const TYPE_LABELS: Record<string, string> = {
  intent: "Intent",
  decision: "Decisions",
  hypothesis: "Hypotheses",
  experiment: "Experiments",
  research: "Research",
  algorithm: "Algorithms",
  dataset: "Datasets",
  guide: "Guides",
  reference: "Reference",
  competitor: "Competitors",
  log: "Logs",
  register: "Registers",
};
export const TYPE_ORDER = Object.keys(TYPE_LABELS);

/** What each kind of doc is, in one line, for people who do not know the system. */
export const TYPE_HELP: Record<string, string> = {
  intent: "What the project is trying to do, and what it is not.",
  decision: "A choice we made, the options we weighed and why.",
  hypothesis: "An idea written down before testing, with what would prove it wrong.",
  experiment: "A test we ran and what came out of it.",
  research: "Reading notes: what papers and evidence say on a topic.",
  algorithm: "How one trading strategy works and where it came from.",
  dataset: "One data source: what is in it, how it is cleaned, its limits.",
  guide: "How to do something step by step.",
  reference: "Facts to look up: methods, sources, definitions.",
  competitor: "One trading product we study: what users praise and complain about, and what we take from it.",
  log: "A dated diary of what was asked and what happened.",
  register: "A running list, such as open problems or results.",
};

let cache: DocsData | null = null;
let pending: Promise<DocsData> | null = null;

export function loadDocs(): Promise<DocsData> {
  if (cache) return Promise.resolve(cache);
  pending ??= import("virtual:parity-docs").then((m) => {
    const raw = m.default as Omit<DocsData, "docs" | "byId"> & { docs: Omit<DocEntry, "plain">[] };
    // Plain text for search is derived here rather than shipped, which halves the download.
    const docs = raw.docs.map((d) => ({ ...d, plain: toPlain(d.html) }));
    cache = { ...raw, docs, byId: Object.fromEntries(docs.map((d) => [d.id, d])) };
    return cache;
  });
  return pending;
}

function toPlain(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
}

/** One doc without its text: what a list of titles needs. */
export type DocMeta = Pick<DocEntry, "id" | "title" | "type" | "status" | "created" | "updated" | "tags">;

let index: DocMeta[] | null = null;
let indexPending: Promise<DocMeta[]> | null = null;
export function loadDocIndex(): Promise<DocMeta[]> {
  if (index) return Promise.resolve(index);
  if (cache) return Promise.resolve(cache.docs);
  indexPending ??= import("virtual:parity-docs-index").then((m) => (index = m.default as DocMeta[]));
  return indexPending;
}

/** The list of docs (titles, types, dates) without loading their text. */
export function useDocIndex(): { docs: DocMeta[] } | null {
  const [data, setData] = useState<DocMeta[] | null>(index ?? cache?.docs ?? null);
  useEffect(() => { if (!data) loadDocIndex().then(setData); }, [data]);
  return data ? { docs: data } : null;
}

export function useDocs(enabled = true): DocsData | null {
  const [data, setData] = useState<DocsData | null>(cache);
  useEffect(() => {
    // The docs are the largest file Parity has (about 0.9 MB), so they load only when shown.
    if (!data && enabled) loadDocs().then(setData);
  }, [data, enabled]);
  return data;
}

/** The HTML of one section: the heading and everything up to the next heading at the same or a higher level. */
export function sectionHtml(doc: DocEntry, anchor: string): string | null {
  // DOMParser builds an inert document: nothing in it runs.
  const parsed = new DOMParser().parseFromString(doc.html, "text/html");
  const head = parsed.getElementById(anchor);
  if (!head || !/^H[1-6]$/.test(head.tagName)) return null;
  const level = Number(head.tagName[1]);
  const parts = [head.outerHTML];
  for (let n = head.nextElementSibling; n; n = n.nextElementSibling) {
    if (/^H[1-6]$/.test(n.tagName) && Number(n.tagName[1]) <= level) break;
    parts.push(n.outerHTML);
  }
  return parts.join("\n");
}

/** The "In plain words" section without its heading, or the first paragraph. */
export function plainWords(doc: DocEntry): string {
  const s = sectionHtml(doc, "in-plain-words");
  if (s) return s.replace(/^<h2[^>]*>[\s\S]*?<\/h2>/, "");
  const p = doc.html.match(/<p>[\s\S]*?<\/p>/);
  return p ? p[0] : "";
}

export function citeLabel(r: RefEntry): string {
  const a = r.authors;
  const who = a.length > 2 ? `${a[0]} et al.` : a.length === 2 ? `${a[0]} and ${a[1]}` : a[0] ?? r.key;
  return `${who} ${r.year ?? ""}`.trim();
}

export interface Hit { kind: "doc" | "term" | "ref"; id: string; title: string; sub: string; snippet?: string; score: number }

/** Plain substring search, ranked: title hits first, then tags, then body. Fast enough for a few hundred docs. */
export function search(data: DocsData, terms: { id: string; term: string; simple: string }[], query: string, limit = 30): Hit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: Hit[] = [];
  for (const t of terms) {
    const name = t.term.toLowerCase();
    const score = name === q ? 100 : name.startsWith(q) ? 80 : name.includes(q) ? 60 : t.simple.toLowerCase().includes(q) ? 15 : 0;
    if (score) hits.push({ kind: "term", id: t.id, title: t.term, sub: "Glossary", snippet: t.simple, score });
  }
  for (const d of data.docs) {
    const title = d.title.toLowerCase();
    let score = d.id.toLowerCase() === q ? 100 : title.includes(q) ? (title.startsWith(q) ? 70 : 50) : 0;
    if (!score && d.tags.some((t) => t.includes(q))) score = 30;
    const at = d.plain.toLowerCase().indexOf(q);
    if (!score && at >= 0) score = 10;
    if (score) hits.push({ kind: "doc", id: d.id, title: d.title, sub: `${d.id} · ${d.type}`, snippet: at >= 0 ? snippet(d.plain, at, q.length) : undefined, score });
  }
  for (const r of Object.values(data.refs)) {
    const hay = `${r.authors.join(" ")} ${r.year ?? ""} ${r.title ?? ""} ${r.venue ?? ""}`.toLowerCase();
    if (hay.includes(q)) hits.push({ kind: "ref", id: r.key, title: r.title ?? r.venue ?? r.key, sub: citeLabel(r), score: 5 });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

export function snippet(text: string, at: number, len: number, pad = 70): string {
  const s = Math.max(0, at - pad);
  const e = Math.min(text.length, at + len + pad);
  return (s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : "");
}

/** Every place a phrase appears, one entry per doc with a count and the first snippet. */
export function mentions(data: DocsData, phrase: string): { id: string; count: number; snippet: string }[] {
  const q = phrase.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: { id: string; count: number; snippet: string }[] = [];
  for (const d of data.docs) {
    const hay = d.plain.toLowerCase();
    let at = hay.indexOf(q);
    if (at < 0) continue;
    const first = at;
    let count = 0;
    while (at >= 0) { count++; at = hay.indexOf(q, at + q.length); }
    out.push({ id: d.id, count, snippet: snippet(d.plain, first, q.length, 50) });
  }
  return out.sort((a, b) => b.count - a.count);
}
