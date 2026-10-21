// DataTable: Mercury's table (48px rows, quiet hairlines, right-aligned numbers,
// small grey headers) with click-to-sort columns, an optional pinned row, row
// links and an empty state. Columns describe themselves; the table does the rest.
import type { ReactNode } from "react";
import { useSort } from "./filters";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** The value used for sorting. Leave out to make the column unsortable. */
  sort?: (row: T) => number | string | null | undefined;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
  /** Colour the cell by the sign of this value (adds .good or .bad). */
  tone?: (row: T) => number | null | undefined;
}

export function DataTable<T>({ rows, columns, rowKey, initialSort, pin, href, empty = "Nothing to show.", caption, dense }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pin?: (row: T) => boolean;
  href?: (row: T) => string;
  empty?: ReactNode;
  caption?: string;
  dense?: boolean;
}) {
  const getter = (row: T, key: string) => columns.find((c) => c.key === key)?.sort?.(row);
  const { sorted, sort, toggle } = useSort<T, string>(rows, getter, initialSort ?? { key: columns.find((c) => c.sort)?.key ?? columns[0].key, dir: "desc" }, pin);
  if (!rows.length) return <div className="ui-empty-inline">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className={`mtable ${dense ? "dense" : ""}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const on = sort.key === c.key;
              return (
                <th key={c.key} className={`${c.align === "left" ? "left" : c.align === "center" ? "center" : ""} ${c.sort ? "sortable" : ""} ${on ? "sorted" : ""}`}
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sort ? <button className="ui-th-btn" onClick={() => toggle(c.key)}>{c.header}{on && <span className="ui-sort-arrow">{sort.dir === "asc" ? "↑" : "↓"}</span>}</button> : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const link = href?.(r);
            return (
              <tr key={rowKey(r)} className={`${link ? "row-link" : ""} ${pin?.(r) ? "pinned" : ""}`}
                onClick={link ? (e) => { if (!(e.target as Element).closest("a, button")) window.location.hash = link; } : undefined}>
                {columns.map((c) => {
                  const t = c.tone?.(r);
                  return (
                    <td key={c.key} className={`${c.align === "left" ? "left" : c.align === "center" ? "center" : ""} ${t == null ? "" : t >= 0 ? "good" : "bad"}`}>
                      {c.render(r)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
