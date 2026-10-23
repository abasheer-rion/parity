// The command bar: type a function code (MON, CMP EUR JPY) or a series (EUR, BRENT),
// Enter runs it in the focused panel, Shift+Enter in a new panel. Suggestions cover
// functions, every series in the index and every strategy in the report; Up walks the
// history, which is kept in the browser.
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { nameOf } from "../lib/strategyMeta";
import { useTerm } from "./context";
import { fmtChg, fmtLast, tone } from "./fmt";
import { FN_BY_CODE, FUNCTIONS } from "./functions";

const HIST_KEY = "parity.term.v1.history";
function readHist(): string[] {
  try { const v = JSON.parse(window.localStorage.getItem(HIST_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 50) : []; } catch { return []; }
}
function writeHist(h: string[]) {
  try { window.localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 50))); } catch { /* storage blocked */ }
}

interface Sugg { kind: "fn" | "series" | "strategy" | "recent"; label: string; detail: string; line: string; right?: string; tone?: string }

export interface CommandBarHandle { focus: () => void }

export const CommandBar = forwardRef<CommandBarHandle, { onLeave: () => void }>(function CommandBar({ onLeave }, ref) {
  const t = useTerm();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  const [hist, setHist] = useState<string[]>(readHist);
  const [hpos, setHpos] = useState(-1);
  useImperativeHandle(ref, () => ({ focus: () => { input.current?.focus(); input.current?.select(); } }), []);

  const series = t.index.status === "ok" ? t.index.data.series : [];
  const runs = t.report.status === "ok" ? t.report.data.runs : [];

  const suggs = useMemo((): Sugg[] => {
    const raw = q.trimStart();
    const toks = raw.split(/\s+/);
    const first = (toks[0] ?? "").toUpperCase();
    const seriesSugg = (needle: string, prefix: string): Sugg[] => {
      const n = needle.toLowerCase();
      if (!n) return [];
      const scored = series.map((s) => {
        const sh = s.short.toLowerCase();
        const score = sh === n ? 0 : sh.startsWith(n) ? 1 : s.key.toLowerCase() === n ? 1 : s.label.toLowerCase().startsWith(n) ? 2 : s.label.toLowerCase().includes(n) || s.key.toLowerCase().includes(n) ? 3 : -1;
        return { s, score };
      }).filter((x) => x.score >= 0).sort((a, b) => a.score - b.score || a.s.short.localeCompare(b.s.short));
      return scored.slice(0, 8).map(({ s }) => ({
        kind: "series", label: s.short, detail: s.label, line: `${prefix}${s.short}`,
        right: `${fmtLast(s.last)}  ${fmtChg(s.chg?.d1, s.kind)}`, tone: tone(s.chg?.d1),
      }));
    };
    if (!raw) {
      const recent: Sugg[] = hist.slice(0, 6).map((h) => ({ kind: "recent", label: h, detail: "recent", line: h }));
      return [...recent, ...FUNCTIONS.filter((f) => !["CMDY", "EQTY"].includes(f.code)).map((f): Sugg => ({ kind: "fn", label: f.code, detail: f.title, line: f.code, right: f.args }))];
    }
    // Arguments of a function: complete the last word with a series.
    if (toks.length > 1 && FN_BY_CODE[first]) {
      const last = toks[toks.length - 1];
      const prefix = toks.slice(0, -1).join(" ") + " ";
      const strat = runs.filter((r) => last && (nameOf(r).toLowerCase().includes(last.toLowerCase()) || r.strategy.includes(last.toLowerCase()))).slice(0, 4)
        .map((r): Sugg => ({ kind: "strategy", label: r.strategy, detail: nameOf(r), line: `${prefix}${r.strategy}` }));
      return [...seriesSugg(last, prefix), ...(first === "CMP" ? strat : [])];
    }
    const lower = raw.toLowerCase();
    const fns = FUNCTIONS.map((f) => ({ f, score: f.code === first ? 0 : f.code.startsWith(first) ? 1 : f.title.toLowerCase().includes(lower) ? 3 : -1 }))
      .filter((x) => x.score >= 0).sort((a, b) => a.score - b.score)
      .map(({ f }): Sugg => ({ kind: "fn", label: f.code, detail: f.title, line: f.code, right: f.args }));
    const strat = runs.filter((r) => lower.length > 1 && (nameOf(r).toLowerCase().includes(lower) || r.strategy.toLowerCase().includes(lower))).slice(0, 5)
      .map((r): Sugg => ({ kind: "strategy", label: nameOf(r), detail: "strategy", line: r.strategy }));
    const ss = seriesSugg(raw, "");
    // An exact series code beats a function that merely starts with the same letters.
    const exactSeries = ss.length && ss[0].label.toLowerCase() === lower;
    const exactFn = fns.length && fns[0].label === first;
    const list = exactFn ? [...fns.slice(0, 1), ...ss, ...fns.slice(1), ...strat] : exactSeries ? [...ss, ...fns, ...strat] : [...fns, ...ss, ...strat];
    return list.slice(0, 14);
  }, [q, series, runs, hist]);

  const submit = (line: string, newPanel: boolean) => {
    const clean = line.trim();
    if (!clean) return;
    if (t.run(clean, { newPanel })) {
      const next = [clean, ...hist.filter((h) => h !== clean)];
      setHist(next); writeHist(next);
      setQ(""); setOpen(false); setSel(-1); setHpos(-1);
      onLeave();
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setSel((s) => Math.min(suggs.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open && sel > 0) setSel((s) => s - 1);
      else if (open && sel === 0) setSel(-1);
      else if (hist.length) {
        const p = Math.min(hist.length - 1, hpos + 1);
        setHpos(p); setQ(hist[p]); setOpen(false); setSel(-1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = open && sel >= 0 ? suggs[sel] : null;
      submit(s ? s.line : q, e.shiftKey);
    } else if (e.key === "Tab" && open && suggs.length && q.trim()) {
      e.preventDefault();
      const s = suggs[Math.max(0, sel)];
      setQ(s.line + (FN_BY_CODE[s.line]?.args ? " " : ""));
      setSel(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (open && (q || sel >= 0)) { setOpen(false); setSel(-1); }
      else { setQ(""); setOpen(false); input.current?.blur(); onLeave(); }
    }
  };

  const listId = "term-cmd-list";
  return (
    <div className="term-cmd" role="search">
      <span className="term-cmd-prompt" aria-hidden>&gt;</span>
      <input
        ref={input}
        className="term-cmd-input"
        value={q}
        placeholder="Type a function or a series: MON, EUR, CMP EUR JPY, SCEN, HELP"
        aria-label="Command"
        role="combobox"
        aria-expanded={open && suggs.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && sel >= 0 ? `term-sugg-${sel}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(e.target.value.trim() ? 0 : -1); setHpos(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
      />
      <span className="term-cmd-keys" aria-hidden><kbd>/</kbd> <kbd>Ctrl K</kbd></span>
      {open && suggs.length > 0 && (
        <ul className="term-sugg" id={listId} role="listbox" aria-label="Suggestions">
          {suggs.map((s, i) => (
            <li key={`${s.kind}-${s.line}-${i}`} id={`term-sugg-${i}`} role="option" aria-selected={i === sel}
              className={i === sel ? "on" : ""}
              onMouseDown={(e) => { e.preventDefault(); submit(s.line, e.shiftKey); }}
              onMouseEnter={() => setSel(i)}>
              <span className={`term-sugg-kind k-${s.kind}`}>{s.kind === "fn" ? "FN" : s.kind === "series" ? "SER" : s.kind === "strategy" ? "STR" : "HIS"}</span>
              <span className="term-sugg-label">{s.label}</span>
              <span className="term-sugg-detail">{s.detail}</span>
              {s.right && <span className={`term-sugg-right ${s.tone ?? ""}`}>{s.right}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
