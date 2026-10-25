// Way-finding parts: breadcrumbs, pagination, avatars and removable tags. Read tokens only.
import type { ReactNode } from "react";
import { Icon } from "./icons";

/** Where this page sits. The last item is the current page and is not a link. */
export function Breadcrumb({ items }: { items: { label: ReactNode; href?: string }[] }) {
  return (
    <nav className="ui-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i}>
              {last || !it.href ? <span aria-current={last ? "page" : undefined}>{it.label}</span> : <a href={it.href}>{it.label}</a>}
              {!last && <Icon name="chevronRight" size={12} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The page numbers to show: always the first, last and two either side of the current one. */
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  const out: (number | "gap")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  }
  return out;
}

/** Pages of a long list. Previous and Next keep their place so the row never shifts. */
export function Pagination({ page, pages, onChange, label = "Pages" }: { page: number; pages: number; onChange: (p: number) => void; label?: string }) {
  if (pages <= 1) return null;
  return (
    <nav className="ui-pages" aria-label={label}>
      <button type="button" className="ui-page-step" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><Icon name="chevronLeft" size={13} /></button>
      {pageWindow(page, pages).map((p, i) => p === "gap"
        ? <span key={`g${i}`} className="ui-page-gap" aria-hidden>...</span>
        : <button key={p} type="button" className={`ui-page ${p === page ? "on" : ""}`} aria-current={p === page ? "page" : undefined} onClick={() => onChange(p)}>{p}</button>)}
      <button type="button" className="ui-page-step" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page"><Icon name="chevronRight" size={13} /></button>
    </nav>
  );
}

/** A person: their picture, or their initials on a tinted circle. */
export function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <span className={`ui-avatar ui-avatar-${size}`} role="img" aria-label={name}>
      {src ? <img src={src} alt="" /> : <span aria-hidden>{initials}</span>}
    </span>
  );
}

/** A label that can be removed, such as an applied filter or a chosen symbol. */
export function Tag({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className="ui-tag">
      <span>{children}</span>
      {onRemove && <button type="button" onClick={onRemove} aria-label={removeLabel ?? `Remove ${typeof children === "string" ? children : ""}`.trim()}><Icon name="close" size={10} /></button>}
    </span>
  );
}
