// Quick search from anywhere: press / or Cmd+K, type, arrow keys, Enter.
import { useEffect, useRef, useState } from "react";
import { terms } from "../lib/glossary";
import { search, useDocs } from "../lib/docs";
import { dataFor, hrefFor } from "../pages/Reader";

export function Palette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const data = useDocs();

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
  const hits = data ? search(data, terms, q, 12) : [];
  const go = (i: number) => {
    const h = hits[i];
    if (!h) return;
    window.location.hash = hrefFor(h.kind, h.id);
    setOpen(false);
  };

  return (
    <div className="palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="palette" role="dialog" aria-label="Search">
        <input
          ref={input}
          value={q}
          placeholder={data ? "Search docs, terms and sources" : "Loading docs"}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            else if (e.key === "Enter") go(sel);
          }}
        />
        {q.trim().length >= 2 && (
          <ul>
            {hits.map((h, i) => (
              <li key={h.kind + h.id} className={i === sel ? "on" : ""} onMouseEnter={() => setSel(i)}>
                <a href={hrefFor(h.kind, h.id)} {...dataFor(h.kind, h.id)} onClick={() => setOpen(false)}>
                  <span className={`kind k-${h.kind}`}>{h.kind === "doc" ? "Doc" : h.kind === "term" ? "Term" : "Source"}</span>
                  <span className="title">{h.title}</span>
                  <span className="muted small">{h.sub}</span>
                </a>
              </li>
            ))}
            {!hits.length && <li className="muted empty">Nothing matches.</li>}
          </ul>
        )}
        <div className="palette-foot muted small">Enter to open · arrows to move · Esc to close · hover a result to preview</div>
      </div>
    </div>
  );
}
