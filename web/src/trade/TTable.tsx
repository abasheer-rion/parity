// A dense, sortable table for Parity Trade: fixed row height, tabular numbers, a header
// that stays put while the body scrolls. Rows can be clicked (load a symbol, say).
import { useMemo, useState, type ReactNode } from "react";

export interface TCol<T> {
  key: string;
  head: ReactNode;
  /** Right-aligned numbers by default; text columns set "left". */
  align?: "left" | "right";
  width?: number | string;
  sort?: (r: T) => number | string | null | undefined;
  cell: (r: T) => ReactNode;
  tone?: (r: T) => number | null | undefined;
  /** Hidden on phones. */
  wide?: boolean;
}

export function TTable<T>({ rows, cols, rowKey, empty, onRow, initial, label, active }: {
  rows: T[]; cols: TCol<T>[]; rowKey: (r: T) => string; empty?: ReactNode; onRow?: (r: T) => void;
  initial?: { key: string; dir: "asc" | "desc" }; label: string; active?: (r: T) => boolean;
}) {
  const [sort, setSort] = useState(initial ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, cols, sort]);
  const click = (c: TCol<T>) => {
    if (!c.sort) return;
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: c.align === "left" ? "asc" : "desc" }));
  };
  return (
    <div className="tt-wrap">
      <table className="tt ui-stagger-rows" aria-label={label}>
        <colgroup>{cols.map((c) => <col key={c.key} className={c.wide ? "nph" : undefined} style={c.width != null ? { width: c.width } : undefined} />)}</colgroup>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} scope="col" className={`${c.align === "left" ? "l" : ""} ${c.wide ? "nph" : ""}`} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                {c.sort ? <button type="button" onClick={() => click(c)}>{c.head}{sort?.key === c.key ? <span aria-hidden>{sort.dir === "asc" ? " ▲" : " ▼"}</span> : null}</button> : c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} className={`${onRow ? "click" : ""} ${active?.(r) ? "on" : ""}`} onClick={onRow ? () => onRow(r) : undefined}
              tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onRow(r); } : undefined}>
              {cols.map((c) => {
                const t = c.tone?.(r);
                return <td key={c.key} className={`${c.align === "left" ? "l" : ""} ${c.wide ? "nph" : ""} ${t == null || Math.abs(t) < 1e-12 ? "" : t > 0 ? "good" : "bad"}`}>{c.cell(r)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="tt-empty">{empty ?? "None"}</div>}
    </div>
  );
}
