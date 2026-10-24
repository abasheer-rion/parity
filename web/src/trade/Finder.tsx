// Parity Trade's search box: symbol search (opens when you type a letter) and the command
// palette (Ctrl+K), one list for both. Arrow keys move, Enter runs, Esc closes.
import { useEffect, useMemo, useRef, useState } from "react";
import { CLASS_LABEL, type Instrument } from "../lib/tradeData";

export interface Command { id: string; label: string; hint?: string; group: string; run: () => void; words?: string }

interface Hit { id: string; label: string; sub?: string; hint?: string; cls?: string; group: string; run: () => void; score: number }

function scoreSymbol(s: Instrument, q: string): number {
  const short = s.short.toLowerCase(), label = s.label.toLowerCase(), key = s.key.toLowerCase();
  if (short === q) return 100;
  if (short.startsWith(q)) return 80 - short.length / 100;
  if (label.startsWith(q)) return 60;
  if (short.includes(q)) return 50;
  if (label.split(/[\s,()/-]+/).some((w) => w.startsWith(q))) return 40;
  if (label.includes(q) || key.includes(q)) return 20;
  return 0;
}

export function Finder({ open, mode, initial, list, commands, onPick, onClose }: {
  open: boolean; mode: "symbols" | "all"; initial: string; list: Instrument[]; commands: Command[];
  onPick: (key: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState(initial);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLUListElement>(null);
  useEffect(() => { if (open) { setQ(initial); setSel(0); window.requestAnimationFrame(() => input.current?.focus()); } }, [open, initial]);

  const hits: Hit[] = useMemo(() => {
    const n = q.trim().toLowerCase();
    const out: Hit[] = [];
    const cmds = commands.filter((c) => (mode === "all" || c.group === "Timeframe") && (!n || `${c.label} ${c.words ?? ""}`.toLowerCase().includes(n)));
    // A timeframe typed as "1d", "1w" or "1m" goes first, the TradingView way.
    for (const c of cmds) out.push({ id: c.id, label: c.label, hint: c.hint, group: c.group, run: c.run, score: c.group === "Timeframe" && n && c.words?.split(" ").includes(n) ? 200 : mode === "all" ? 10 : -1 });
    if (n) {
      for (const s of list) {
        const sc = scoreSymbol(s, n);
        if (sc > 0) out.push({ id: `s:${s.key}`, label: s.short, sub: s.label, cls: CLASS_LABEL[s.class] ?? s.class, group: "Symbol", run: () => onPick(s.key), score: sc + 20 });
      }
    } else if (mode === "symbols") {
      for (const s of list.slice(0, 40)) out.push({ id: `s:${s.key}`, label: s.short, sub: s.label, cls: CLASS_LABEL[s.class] ?? s.class, group: "Symbol", run: () => onPick(s.key), score: 1 });
    }
    return out.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 60);
  }, [q, list, commands, mode, onPick]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { box.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  if (!open) return null;
  const run = (h: Hit | undefined) => { if (!h) return; onClose(); h.run(); };
  return (
    <div className="fd-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fd" role="dialog" aria-modal="true" aria-label={mode === "symbols" ? "Symbol search" : "Command palette"}>
        <input ref={input} className="fd-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === "symbols" ? "Symbol" : "Symbol or command"}
          aria-label={mode === "symbols" ? "Symbol" : "Symbol or command"} role="combobox" aria-expanded="true" aria-controls="fd-list"
          aria-activedescendant={hits[sel] ? `fd-${sel}` : undefined} autoComplete="off" spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(hits.length - 1, i + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); run(hits[sel]); }
          }} />
        <ul id="fd-list" ref={box} className="fd-list" role="listbox" aria-label="Results">
          {hits.map((h, i) => (
            <li key={h.id} id={`fd-${i}`} data-i={i} role="option" aria-selected={i === sel} className={i === sel ? "on" : ""}
              onMouseMove={() => setSel(i)} onClick={() => run(h)}>
              <span className="fd-group">{h.group}</span>
              <span className="fd-label">{h.label}</span>
              {h.sub && <span className="fd-sub">{h.sub}</span>}
              {h.hint && <kbd className="fd-hint">{h.hint}</kbd>}
              {h.cls && <span className="fd-cls">{h.cls}</span>}
            </li>
          ))}
          {!hits.length && <li className="fd-none" role="option" aria-selected="false" aria-disabled="true">No match</li>}
        </ul>
      </div>
    </div>
  );
}
