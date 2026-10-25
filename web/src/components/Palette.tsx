// Quick search from anywhere: press / or Cmd+K, type, arrow keys, Enter.
// It finds pages, strategies, trading ideas, glossary words, docs and sources, and
// answers a few plain questions ("what is carry", "best strategy", "does anything
// beat the market") with a short answer card above the results.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { algorithms } from "../lib/catalog";
import { termById, terms } from "../lib/glossary";
import { search, useDocs } from "../lib/docs";
import { linkTo, searchPages } from "../lib/pages";
import { SPACE } from "../lib/space";
import { nameOf, verdictOf } from "../lib/strategyMeta";
import { num, pct } from "../lib/format";
import type { Report, StrategyRun } from "../lib/types";
import { dataFor, hrefFor } from "../pages/Reader";

interface Item { key: string; href: string; kind: string; title: string; sub: string; data?: Record<string, string>; score: number }
interface Answer { text: ReactNode; href: string; link: string }

const KIND_LABEL: Record<string, string> = { page: "Page", strategy: "Strategy", idea: "Idea", doc: "Doc", term: "Word", ref: "Source" };

function strategyItems(report: Report | null, q: string): Item[] {
  if (!report) return [];
  const out: Item[] = [];
  for (const r of report.runs) {
    const name = nameOf(r).toLowerCase();
    const id = r.strategy.toLowerCase();
    const score = name === q || id === q ? 90 : name.startsWith(q) ? 72 : name.includes(q) || id.includes(q) ? 52 : 0;
    if (score) out.push({ key: `s:${r.strategy}`, href: `#/strategy/${r.strategy}`, kind: "strategy", title: nameOf(r), sub: verdictOf(r).label, score });
  }
  return out;
}

function ideaItems(q: string): Item[] {
  const out: Item[] = [];
  for (const a of algorithms) {
    const name = a.name.toLowerCase();
    const score = name === q ? 85 : name.startsWith(q) ? 62 : name.includes(q) ? 42 : a.tags.some((t) => t === q) ? 25 : 0;
    if (score) out.push({ key: `a:${a.slug}`, href: `#/algo/${a.slug}`, kind: "idea", title: a.name, sub: `${a.family} · catalog`, score });
  }
  return out;
}

const tested = (report: Report | null) => (report?.runs ?? []).filter((r) => !r.is_benchmark);

function rankBest(runs: StrategyRun[]): StrategyRun | undefined {
  const order = { Passed: 3, Promising: 2, "Not proven": 1 } as Record<string, number>;
  return [...runs].sort((a, b) => (order[verdictOf(b).label] ?? 0) - (order[verdictOf(a).label] ?? 0) || (b.metrics.sharpe ?? -9) - (a.metrics.sharpe ?? -9))[0];
}

/** A short answer for the few questions people ask most. Null when the query is not one. */
function answer(raw: string, report: Report | null): Answer | null {
  const q = raw.trim().toLowerCase().replace(/[?!.]+$/, "");
  const define = q.match(/^(?:what is|what's|whats|what are|define|meaning of|explain)\s+(?:an?\s+|the\s+)?(.+)$/);
  if (define) {
    const w = define[1].trim();
    const t = terms.find((x) => x.term.toLowerCase() === w || x.id === w.replace(/\s+/g, "-"))
      ?? terms.find((x) => x.term.toLowerCase().startsWith(w));
    if (t) return { text: <><strong>{t.term}</strong>: {t.simple}</>, href: `#/learn/${t.id}`, link: "Open in the glossary" };
  }
  const runs = tested(report);
  if (!runs.length) return null;
  if (/\b(best|top|strongest|winner|which works?|what works)\b/.test(q)) {
    const b = rankBest(runs);
    if (b) {
      const v = verdictOf(b);
      return { text: <>The strongest in this run is <strong>{nameOf(b)}</strong> ({v.label.toLowerCase()}, Sharpe {num(b.metrics.sharpe)}, {pct(b.metrics.cagr)} a year). {v.plain}</>, href: `#/strategy/${b.strategy}`, link: "Open the strategy" };
    }
  }
  if (/\b(beat|beats|outperform)\b/.test(q) && /\b(market|s&p|sp500|s and p|stocks|index)\b/.test(q)) {
    const n = runs.filter((r) => r.gauntlet?.beats_sp500).length;
    const g = runs.filter((r) => r.gauntlet).length;
    return { text: <><strong>{n} of {g}</strong> tested strategies beat the S&P 500 after costs and after counting every idea tried, in this {report?.kind === "official" ? "official" : "exploratory"} run.</>, href: "#/strategies", link: "See all strategies" };
  }
  if (/\bhow many\b.*\bstrateg/.test(q)) {
    return { text: <>This run has <strong>{runs.length}</strong> strategies plus the US market benchmark, and the catalog lists <strong>{algorithms.length}</strong> trading ideas.</>, href: "#/strategies", link: "See all strategies" };
  }
  return null;
}

export function Palette({ report = null }: { report?: Report | null }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const data = useDocs(open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing = t instanceof Element && t.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    // /app/?search (the 404 page's Search link, DEC-0055) opens search once, then drops the flag.
    const q = new URLSearchParams(window.location.search);
    if (q.has("search")) {
      setOpen(true);
      q.delete("search");
      const rest = q.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("parity:search", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("parity:search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); window.setTimeout(() => input.current?.focus(), 0); }
  }, [open]);

  if (!open) return null;
  const query = q.trim().toLowerCase();
  const ans = query.length >= 3 ? answer(q, report) : null;
  // For a question, search on its subject so "what is carry" also lists carry results.
  const subject = query.replace(/^(?:what is|what's|whats|what are|define|meaning of|explain)\s+(?:an?\s+|the\s+)?/, "");
  const items: Item[] = subject.length < 2 ? [] : [
    ...searchPages(subject).map(({ page, score }) => ({
      key: `p:${page.space}:${page.href}`, href: linkTo(page), kind: "page", title: page.title, score,
      sub: page.space !== "both" && page.space !== SPACE ? `${page.space === "research" ? "Research" : "Product"} · ${page.what}` : page.what,
    })),
    ...strategyItems(report, subject),
    ...ideaItems(subject),
    ...(data ? search(data, terms, subject, 12) : []).map((h) => ({
      key: `${h.kind}:${h.id}`, href: hrefFor(h.kind, h.id), kind: h.kind, title: h.title,
      sub: h.kind === "term" ? termById[h.id]?.simple ?? h.sub : h.sub, data: dataFor(h.kind, h.id), score: h.score,
    })),
  ].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 14);

  const go = (i: number) => {
    const href = ans ? (i === 0 ? ans.href : items[i - 1]?.href) : items[i]?.href;
    if (!href) return;
    if (href.startsWith("#")) window.location.hash = href;
    else window.location.href = href;
    setOpen(false);
  };
  const total = items.length + (ans ? 1 : 0);

  return (
    <div className="palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="palette" role="dialog" aria-label="Search">
        <input
          ref={input}
          value={q}
          placeholder="Search pages, strategies, words, docs, or ask a question"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, total - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            else if (e.key === "Enter") go(sel);
          }}
        />
        {query.length < 2 && (
          <div className="palette-tips muted small">
            Try <button onClick={() => setQ("what is carry")}>what is carry</button>
            <button onClick={() => setQ("best strategy")}>best strategy</button>
            <button onClick={() => setQ("does anything beat the market")}>does anything beat the market</button>
            <button onClick={() => setQ("scenarios")}>scenarios</button>
          </div>
        )}
        {query.length >= 2 && (
          <ul>
            {ans && (
              <li className={`answer ${sel === 0 ? "on" : ""}`} onMouseEnter={() => setSel(0)}>
                <a href={ans.href} onClick={() => setOpen(false)}>
                  <span className="kind">Answer</span>
                  <span className="answer-body">{ans.text} <span className="answer-link">{ans.link} →</span></span>
                </a>
              </li>
            )}
            {items.map((h, i) => {
              const idx = i + (ans ? 1 : 0);
              return (
                <li key={h.key} className={idx === sel ? "on" : ""} onMouseEnter={() => setSel(idx)}>
                  <a href={h.href} {...(h.data ?? {})} onClick={() => setOpen(false)}>
                    <span className={`kind k-${h.kind}`}>{KIND_LABEL[h.kind] ?? h.kind}</span>
                    <span className="title">{h.title}</span>
                    <span className="muted small sub">{h.sub}</span>
                  </a>
                </li>
              );
            })}
            {!total && <li className="muted empty">Nothing matches. Try a simpler word, or open <a href="#/start" onClick={() => setOpen(false)}>Start here</a>.</li>}
          </ul>
        )}
        <div className="palette-foot muted small">Enter to open · arrows to move · Esc to close · hover a word or doc to preview</div>
      </div>
    </div>
  );
}
