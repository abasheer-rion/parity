// Filtering and sorting, Mercury's toolbar pattern: a row of chips above the data.
// An idle chip is quiet; an applied filter turns accent-tinted and gains a remove
// button; "Reset" appears once anything is applied. The hooks hold the state.
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "./icons";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> { key: K; dir: SortDir }

/** Sort rows by a key. Clicking the same key flips direction; a new key starts descending (biggest first). */
export function useSort<T, K extends string>(rows: T[], get: (row: T, key: K) => number | string | null | undefined, initial: SortState<K>, pin?: (row: T) => boolean) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const sorted = useMemo(() => {
    const out = [...rows].sort((a, b) => {
      if (pin) { const pa = pin(a), pb = pin(b); if (pa !== pb) return pa ? -1 : 1; }
      const x = get(a, sort.key), y = get(b, sort.key);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number);
      return sort.dir === "asc" ? c : -c;
    });
    return out;
  }, [rows, sort, get, pin]);
  const toggle = (key: K) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  return { sorted, sort, toggle, setSort };
}

export interface FilterDef<T> { id: string; label: string; test: (row: T) => boolean }

/** A set of on/off filters plus a text search. */
export function useFilters<T>(rows: T[], defs: FilterDef<T>[], text?: (row: T) => string) {
  const [active, setActive] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => active.every((id) => defs.find((d) => d.id === id)?.test(r) ?? true) && (!q || !text || text(r).toLowerCase().includes(q)));
  }, [rows, active, defs, query, text]);
  const toggle = (id: string) => setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const reset = () => { setActive([]); setQuery(""); };
  return { filtered, active, toggle, reset, query, setQuery, count: active.length + (query ? 1 : 0) };
}

export function FilterBar({ children, right, onReset, count = 0 }: { children: ReactNode; right?: ReactNode; onReset?: () => void; count?: number }) {
  return (
    <div className="ui-filterbar">
      <div className="ui-filterbar-l">
        {children}
        {count > 0 && onReset && <button className="ui-linkbtn" onClick={onReset}>Reset</button>}
      </div>
      {right && <div className="ui-filterbar-r">{right}</div>}
    </div>
  );
}

/** A chip. `active` tints it and shows a remove button; `menu` shows a chevron. */
export function FilterChip({ label, active, onClick, onRemove, icon, menu }:
  { label: ReactNode; active?: boolean; onClick?: () => void; onRemove?: () => void; icon?: string; menu?: boolean }) {
  return (
    <span className={`ui-chip ${active ? "on" : ""}`}>
      <button className="ui-chip-main" onClick={onClick} aria-pressed={active}>
        {icon && <Icon name={icon} size={13} />}
        <span>{label}</span>
        {menu && !active && <Icon name="chevronDown" size={12} />}
      </button>
      {active && onRemove && <button className="ui-chip-x" aria-label="Remove filter" onClick={onRemove}>×</button>}
    </span>
  );
}

export function Separator() {
  return <span className="ui-vsep" aria-hidden />;
}
