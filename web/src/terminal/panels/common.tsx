// Pieces several panels share: the guard that waits for the index, and picking a series
// (which updates the linked selection every following panel reads).
import type { ReactNode } from "react";
import { useTerm } from "../context";
import type { TermIndex, TermSeries } from "../data";
import { Empty, Loading } from "../tui";

export function WithIndex({ children }: { children: (ix: TermIndex) => ReactNode }) {
  const t = useTerm();
  if (t.index.status === "loading") return <Loading what="Loading the market index" />;
  if (t.index.status !== "ok") {
    return (
      <Empty title={t.index.status === "missing" ? "No terminal data yet" : "Could not load the terminal data"}>
        {t.index.message} The simulations (WMAP, CRIS, SCEN, PATH, STRS, RACE) and KPI still work.
      </Empty>
    );
  }
  return <>{children(t.index.data)}</>;
}

/** Select a series everywhere: the linked series, and its currency for fx. */
export function usePick() {
  const t = useTerm();
  return (s: TermSeries) => t.setLink({ series: s.key, ...(s.class === "fx" ? { ccy: s.short } : {}) });
}

export function groupLabel(ix: TermIndex) {
  const m = new Map(ix.groups.map((g) => [g.id, g.label]));
  return (id: string) => m.get(id) ?? id;
}

/** Series in the order of the index's groups (the monitor's order). */
export function ordered(ix: TermIndex): TermSeries[] {
  const rank = new Map(ix.groups.map((g, i) => [g.id, i]));
  return ix.series.map((s, i) => ({ s, i })).sort((a, b) => (rank.get(a.s.group) ?? 999) - (rank.get(b.s.group) ?? 999) || a.i - b.i).map((x) => x.s);
}

export const CLASS_LABEL: Record<string, string> = {
  fx: "FX", rates: "Rates", commodities: "Commodities", equities: "Equities", crypto: "Crypto", positioning: "Positioning", macro: "Macro",
};

/** Filter options: every class, then every group. Values are "all", "class:<c>" or "group:<id>". */
export function filterOptions(ix: TermIndex): [string, string][] {
  const classes = [...new Set(ix.series.map((s) => s.class))];
  return [
    ["all", "All series"],
    ...classes.map((c): [string, string] => [`class:${c}`, CLASS_LABEL[c] ?? c]),
    ...ix.groups.filter((g) => ix.series.some((s) => s.group === g.id)).map((g): [string, string] => [`group:${g.id}`, `· ${g.label}`]),
  ];
}

export function applyFilter(list: TermSeries[], f: string): TermSeries[] {
  if (f.startsWith("class:")) return list.filter((s) => s.class === f.slice(6));
  if (f.startsWith("group:")) return list.filter((s) => s.group === f.slice(6));
  return list;
}

export function Select({ value, options, onChange, label }: { value: string; options: [string, string][]; onChange: (v: string) => void; label: string }) {
  return (
    <label className="term-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
