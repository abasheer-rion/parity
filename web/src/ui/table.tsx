// DataTable: Mercury's table (48px rows, quiet hairlines, right-aligned numbers,
// small grey headers) with click-to-sort columns, an optional pinned row, row links,
// rows that open in place to show details, and an empty state. Columns describe
// themselves; the table does the rest.
//
// For long tables, give it `maxHeight`: it scrolls in its own box with the header
// stuck to the top, and with `virtual` only the rows on screen are drawn (thousands
// of rows stay quick). Column widths are fixed in that mode, so nothing reflows while
// you scroll or sort. Short tables glide their rows to their new places on a sort.
import { PlainTerms } from "./plainTerms";
import { Fragment, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useSort } from "./filters";
import { Collapse } from "./disclosure";
import { Icon } from "./icons";
import { useFlip, usePresence } from "./presence";
import { useVirtual } from "./virtual";

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

export function DataTable<T>({ rows, columns, rowKey, initialSort, pin, href, empty = "Nothing to show.", caption, dense, expand, maxHeight, virtual, stickyFirst, onSortChange }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pin?: (row: T) => boolean;
  href?: (row: T) => string;
  empty?: ReactNode;
  caption?: string;
  dense?: boolean;
  /** Details shown under a row when it is clicked. The row opens in place. */
  expand?: (row: T) => ReactNode;
  /** Scroll inside a box this tall, with the header stuck to its top. */
  maxHeight?: number | string;
  /** Draw only the rows on screen. Needs `maxHeight`. Set column widths for a steady layout. */
  virtual?: boolean;
  /** Keep the first column in view while scrolling sideways. */
  stickyFirst?: boolean;
  onSortChange?: (sort: { key: string; dir: "asc" | "desc" }) => void;
}) {
  const getter = (row: T, key: string) => columns.find((c) => c.key === key)?.sort?.(row);
  const { sorted, sort, toggle } = useSort<T, string>(rows, getter, initialSort ?? { key: columns.find((c) => c.sort)?.key ?? columns[0].key, dir: "desc" }, pin);
  const [open, setOpen] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const isVirtual = !!virtual && maxHeight != null;
  const rowH = dense ? 38 : 48;
  const flipRef = useFlip<HTMLTableSectionElement>(`${sort.key}:${sort.dir}`, { max: isVirtual ? 0 : 60 });
  const v = useVirtual({ count: isVirtual ? sorted.length : 0, estimate: rowH, scrollRef: box as RefObject<HTMLElement | null>, getKey: (i) => rowKey(sorted[i]) });

  if (!rows.length) return <div className="ui-empty-inline">{empty}</div>;

  const cellClass = (c: Column<T>) => (c.align === "left" ? "left" : c.align === "center" ? "center" : "");
  const onRow = (k: string, link?: string) => (e: React.MouseEvent) => {
    if ((e.target as Element).closest("a, button, input, select")) return;
    if (link) window.location.hash = link;
    else if (expand) setOpen((o) => (o === k ? null : k));
  };
  const renderRow = (r: T) => {
    const k = rowKey(r);
    const link = href?.(r);
    const isOpen = open === k;
    return (
      <Fragment key={k}>
        <tr data-flip={k} className={`${link || expand ? "row-link" : ""} ${pin?.(r) ? "pinned" : ""} ${isOpen ? "open" : ""} ${expand ? "expandable" : ""}`}
          onClick={link || expand ? onRow(k, link) : undefined}>
          {columns.map((c, i) => {
            const t = c.tone?.(r);
            return (
              <td key={c.key} className={`${cellClass(c)} ${t == null ? "" : t >= 0 ? "good" : "bad"}`}>
                {/* The keyboard and screen readers open a row with this button; a click anywhere on the row does the same. */}
                {expand && i === 0 ? (
                  <span className="ui-cell-toggle">
                    <button type="button" className="ui-row-toggle" aria-expanded={isOpen} aria-label={isOpen ? "Hide details" : "Show details"}
                      onClick={() => setOpen((o) => (o === k ? null : k))}>
                      <Icon name="chevronRight" size={12} className="ui-row-chev" />
                    </button>
                    <span>{c.render(r)}</span>
                  </span>
                ) : c.render(r)}
              </td>
            );
          })}
        </tr>
        {expand && <DetailRow open={isOpen} cols={columns.length}>{expand(r)}</DetailRow>}
      </Fragment>
    );
  };

  const style: CSSProperties | undefined = maxHeight != null ? { maxHeight } : undefined;
  return (
    <div ref={box} className={`table-wrap ${maxHeight != null ? "ui-table-box" : ""} ${stickyFirst ? "sticky-first" : ""}`} style={style} data-lenis-prevent={maxHeight != null || undefined}>
      <table ref={isVirtual ? (v.listRef as RefObject<HTMLTableElement>) : undefined} className={`mtable ${dense ? "dense" : ""} ${isVirtual ? "fixed" : "ui-stagger-rows"}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {columns.some((c) => c.width) && <colgroup>{columns.map((c) => <col key={c.key} style={c.width ? { width: c.width } : undefined} />)}</colgroup>}
        <thead>
          <tr>
            {columns.map((c) => {
              const on = sort.key === c.key;
              return (
                <th key={c.key} className={`${cellClass(c)} ${c.sort ? "sortable" : ""} ${on ? "sorted" : ""}`}
                  aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sort ? (
                    <button className="ui-th-btn" onClick={() => { toggle(c.key); onSortChange?.({ key: c.key, dir: on && sort.dir === "desc" ? "asc" : "desc" }); }}>
                      <PlainTerms.Provider value>{c.header}</PlainTerms.Provider>
                      {/* The arrow's space is always kept, so a header never shifts when it becomes the sorted one. */}
                      <span className="ui-sort-arrow" aria-hidden data-on={on || undefined}>{on && sort.dir === "asc" ? "↑" : "↓"}</span>
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        {isVirtual ? (
          <>
            {v.padTop > 0 && <tbody aria-hidden><tr className="ui-spacer" style={{ height: v.padTop }} /></tbody>}
            {v.items.map((it) => <tbody key={rowKey(sorted[it.index])} ref={v.measure(it.index)}>{renderRow(sorted[it.index])}</tbody>)}
            {v.padBottom > 0 && <tbody aria-hidden><tr className="ui-spacer" style={{ height: v.padBottom }} /></tbody>}
          </>
        ) : (
          <tbody ref={flipRef}>{sorted.map(renderRow)}</tbody>
        )}
      </table>
    </div>
  );
}

/** The details under an opened row. Stays drawn while it closes, so it can animate shut. */
function DetailRow({ open, cols, children }: { open: boolean; cols: number; children: ReactNode }) {
  const p = usePresence(open, 260);
  if (!p.mounted) return null;
  return (
    <tr className="ui-detail-row" data-state={p.state}>
      <td colSpan={cols}>
        <Collapse open={p.state === "open"}><div className="ui-detail-body">{children}</div></Collapse>
      </td>
    </tr>
  );
}
