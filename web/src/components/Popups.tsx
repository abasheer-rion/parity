// Hover previews that stack, in the style of gwern.net: hover a term, a doc link or a
// citation and a small card opens; hover a link inside that card and another opens
// beside it. Cards close when the pointer leaves the chain, unless clicked (pinned).
// Selecting a word or phrase anywhere opens a card listing every doc that mentions it.
//
// Triggers are plain attributes, so any page can use them:
//   <a data-term="sharpe-ratio">  <a data-doc="DEC-0009" data-anchor="decision">  <a data-ref="fama1984">
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { termById, terms } from "../lib/glossary";
import { citeLabel, mentions, plainWords, sectionHtml, useDocs, type DocsData } from "../lib/docs";
import { Html } from "../ui/Html";
import { Segmented } from "../ui/inputs";
import { SkeletonText } from "../ui/skeleton";
import { getPrefs } from "../lib/prefs";

type Kind = "term" | "doc" | "ref" | "find";
interface Pop { key: string; kind: Kind; arg: string; anchor?: string; rect: DOMRect; level: number; pinned: boolean }

const OPEN_DELAY = 180;
const CLOSE_DELAY = 320;
const TRIGGER = "a[data-term], span[data-term], a[data-doc], a[data-ref]";

function levelOf(el: Element | null): number {
  const pop = el?.closest<HTMLElement>(".pop");
  return pop ? Number(pop.dataset.level) : -1;
}

function describe(a: HTMLElement): { kind: Kind; arg: string; anchor?: string } | null {
  if (a.dataset.term) return { kind: "term", arg: a.dataset.term };
  if (a.dataset.doc) return { kind: "doc", arg: a.dataset.doc, anchor: a.dataset.anchor || undefined };
  if (a.dataset.ref) return { kind: "ref", arg: a.dataset.ref };
  return null;
}

let seq = 0;

export function Popups() {
  const [stack, setStack] = useState<Pop[]>([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const openTimer = useRef(0);
  const closeTimer = useRef(0);
  const over = useRef(-1);

  const open = useCallback((p: Omit<Pop, "key" | "pinned"> & { pinned?: boolean }) => {
    setStack((s) => {
      const same = s[p.level];
      if (same && same.kind === p.kind && same.arg === p.arg && same.anchor === p.anchor) return s.slice(0, p.level + 1);
      return [...s.slice(0, p.level), { ...p, pinned: p.pinned ?? false, key: `pop-${++seq}` }];
    });
  }, []);

  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setStack((s) => {
        let keep = over.current + 1;
        for (let i = s.length - 1; i >= keep; i--) if (s[i].pinned) { keep = i + 1; break; }
        return keep >= s.length ? s : s.slice(0, keep);
      });
    }, CLOSE_DELAY);
  }, []);

  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const lvl = levelOf(target);
      over.current = lvl;
      const a = target.closest<HTMLElement>(TRIGGER);
      window.clearTimeout(openTimer.current);
      if (a && !a.closest(".pop-head")) {
        over.current = lvl + 1;
        const what = describe(a);
        if (what) openTimer.current = window.setTimeout(() => open({ ...what, rect: a.getBoundingClientRect(), level: lvl + 1 }), getPrefs().previewDelay ?? OPEN_DELAY);
      }
      scheduleClose();
    };
    // On touch screens the first tap previews; the "Open" link in the card navigates.
    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest<HTMLElement>(TRIGGER);
      const lvl = levelOf(target);
      if (a && (e as PointerEvent).pointerType === "touch" && !a.closest(".pop-head")) {
        const what = describe(a);
        const shown = stackRef.current[lvl + 1];
        if (what && !(shown && shown.arg === what.arg && shown.kind === what.kind)) {
          e.preventDefault();
          open({ ...what, rect: a.getBoundingClientRect(), level: lvl + 1 });
          return;
        }
      }
      if (lvl >= 0 && !a) {
        // Clicking inside a card pins it and the cards under it.
        setStack((s) => s.map((p, i) => (i <= lvl && !p.pinned ? { ...p, pinned: true } : p)));
        return;
      }
      if (lvl < 0 && !a && !window.getSelection()?.toString()) setStack((s) => (s.length ? [] : s));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStack((s) => s.slice(0, -1));
    };
    const onSelect = (e: MouseEvent) => {
      if (!getPrefs().findOnSelect) return;
      if (!(e.target instanceof Element) || e.target.closest("input, textarea, select, button, a, .palette")) return;
      const sel = window.getSelection();
      const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
      if (!sel || sel.rangeCount === 0 || text.length < 3 || text.length > 60) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const node = sel.anchorNode;
      const lvl = levelOf(node instanceof Element ? node : node?.parentElement ?? null);
      open({ kind: "find", arg: text, rect, level: lvl + 1, pinned: true });
    };
    const onScroll = (e: Event) => {
      if (e.target instanceof Element && e.target.closest(".pop")) return;
      setStack((s) => (s.some((p) => !p.pinned) ? s.filter((p) => p.pinned) : s));
    };
    const onHash = () => setStack([]);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mouseup", onSelect);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mouseup", onSelect);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", onHash);
    };
  }, [open, scheduleClose]);

  const data = useDocs();
  if (!stack.length) return null;
  return (
    <>
      {stack.map((p, i) => (
        <Card key={p.key} pop={p} data={data} onClose={() => setStack((s) => s.slice(0, i))} />
      ))}
    </>
  );
}

function Card({ pop, data, onClose }: { pop: Pop; data: DocsData | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reference = { getBoundingClientRect: () => pop.rect };
    computePosition(reference, el, {
      strategy: "fixed",
      placement: pop.level === 0 || pop.kind === "find" ? "bottom-start" : "right-start",
      middleware: [offset(6), flip({ fallbackPlacements: ["bottom-start", "top-start", "left-start"] }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.visibility = "visible";
    });
  }, [pop.rect, pop.level, pop.kind, data]);

  return (
    <div ref={ref} className={`pop ${pop.pinned ? "pinned" : ""}`} data-level={pop.level} role="dialog" style={{ zIndex: 50 + pop.level }}>
      {pop.pinned && <button className="pop-close" aria-label="Close" onClick={onClose}>×</button>}
      {pop.kind === "term" && <TermCard id={pop.arg} data={data} />}
      {pop.kind === "doc" && <DocCard id={pop.arg} anchor={pop.anchor} data={data} />}
      {pop.kind === "ref" && <RefCard id={pop.arg} data={data} />}
      {pop.kind === "find" && <FindCard phrase={pop.arg} data={data} />}
    </div>
  );
}

type View = "simple" | "analogy" | "precise";

function TermCard({ id, data }: { id: string; data: DocsData | null }) {
  const t = termById[id];
  const [view, setView] = useState<View>("simple");
  if (!t) return <p className="muted">Unknown term.</p>;
  const docs = data?.termDocs[id] ?? [];
  return (
    <>
      <div className="pop-head">
        <span className="pop-kind">Term</span>
        <strong>{t.term}</strong>
        <a className="pop-open" href={`#/learn/${id}`}>Open</a>
      </div>
      <div className="small-tabs"><Segmented size="sm" label={`Explain ${t.term} as`} value={view} onChange={setView} options={[["simple", "Simple"], ["analogy", "Analogy"], ["precise", "Precise"]]} /></div>
      <p>{t[view]}</p>
      {t.related && t.related.length > 0 && (
        <p className="pop-meta">Related: {t.related.filter((r) => termById[r]).map((r, i) => (
          <span key={r}>{i > 0 && ", "}<a className="term-link" href={`#/learn/${r}`} data-term={r}>{termById[r].term}</a></span>
        ))}</p>
      )}
      {docs.length > 0 && <DocList title={`Mentioned in ${docs.length} docs`} ids={docs} data={data} />}
    </>
  );
}

function DocCard({ id, anchor, data }: { id: string; anchor?: string; data: DocsData | null }) {
  if (!data) return <SkeletonText lines={3} lineHeight={22} />;
  const d = data.byId[id];
  if (!d) return <p className="muted">No doc {id}.</p>;
  const section = anchor ? sectionHtml(d, anchor) : null;
  const back = data.backlinks[id] ?? [];
  return (
    <>
      <div className="pop-head">
        <span className="pop-kind">{d.id}</span>
        <strong>{d.title}</strong>
        <a className="pop-open" href={`#/doc/${id}${anchor ? "/" + anchor : ""}`}>Open</a>
      </div>
      <Html className="pop-body prose" html={section ?? plainWords(d)} />
      <p className="pop-meta">
        <span className={`status s-${d.status}`}>{d.status}</span> · updated {d.updated}
        {d.tags.length > 0 && <> · {d.tags.map((t) => <a key={t} className="tag" href={`#/docs/tag/${t}`}>{t}</a>)}</>}
      </p>
      {back.length > 0 && <DocList title={`${back.length} docs link here`} ids={back} data={data} />}
    </>
  );
}

function RefCard({ id, data }: { id: string; data: DocsData | null }) {
  if (!data) return <SkeletonText lines={3} lineHeight={22} />;
  const r = data.refs[id];
  if (!r) return <p className="muted">No source {id}.</p>;
  const used = data.refDocs[id] ?? [];
  return (
    <>
      <div className="pop-head">
        <span className="pop-kind">Source</span>
        <strong>{citeLabel(r)}</strong>
        <a className="pop-open" href={`#/refs/${id}`}>Open</a>
      </div>
      {r.title && <p className="ref-title">{r.title}</p>}
      {r.venue && <p className="pop-meta">{r.venue}</p>}
      <p className="pop-meta">
        {r.type} · link check: <span className={r.verification === "ok" ? "good" : "muted"}>{r.verification ?? "not checked"}</span>
        {r.url && <> · <a href={r.url} target="_blank" rel="noreferrer">open source</a></>}
      </p>
      {used.length > 0 && <DocList title={`Cited in ${used.length} docs`} ids={used} data={data} />}
    </>
  );
}

function FindCard({ phrase, data }: { phrase: string; data: DocsData | null }) {
  if (!data) return <SkeletonText lines={3} lineHeight={22} />;
  const found = mentions(data, phrase);
  const q = phrase.toLowerCase();
  const term = terms.find((t) => {
    const n = t.term.toLowerCase();
    return n === q || n === q.replace(/s$/, "") || n.startsWith(q + " ") || n.replace(/\s*\(.*\)$/, "") === q;
  });
  const total = found.reduce((n, f) => n + f.count, 0);
  return (
    <>
      <div className="pop-head">
        <span className="pop-kind">Find</span>
        <strong>“{phrase}”</strong>
        <a className="pop-open" href={`#/docs?q=${encodeURIComponent(phrase)}`}>Search</a>
      </div>
      {term && <p>Glossary: <a className="term-link" href={`#/learn/${term.id}`} data-term={term.id}>{term.term}</a>. {term.simple}</p>}
      <p className="pop-meta">{total ? `${total} mentions in ${found.length} docs` : "Not mentioned in any doc."}</p>
      <ul className="pop-list">
        {found.slice(0, 12).map((f) => (
          <li key={f.id}>
            <a href={`#/doc/${f.id}`} data-doc={f.id}>{data.byId[f.id]?.title ?? f.id}</a> <span className="muted">×{f.count}</span>
            <div className="snip">{f.snippet}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

function DocList({ title, ids, data }: { title: string; ids: string[]; data: DocsData | null }) {
  const [all, setAll] = useState(false);
  const shown = all ? ids : ids.slice(0, 6);
  return (
    <div className="pop-section">
      <div className="pop-meta">{title}</div>
      <ul className="pop-list compact">
        {shown.map((d) => (
          <li key={d}><a href={`#/doc/${d}`} data-doc={d}>{data?.byId[d]?.title ?? d}</a> <span className="muted">{d}</span></li>
        ))}
      </ul>
      {ids.length > shown.length && <button className="linkish" onClick={() => setAll(true)}>Show all {ids.length}</button>}
    </div>
  );
}
