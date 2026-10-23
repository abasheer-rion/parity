// Things that open in place: a Collapse (the bare animated region), a Disclosure (a
// row you click to show more under it) and an Accordion (a list of them, one open at a
// time if you like). They grow from their own top edge, so the page below moves down
// smoothly instead of jumping, and the content fades in as it arrives (DEC-0017).
import { useId, useState, type ReactNode } from "react";
import { Icon } from "./icons";

/**
 * Animates its children open and shut by height, without measuring: a one-row grid
 * whose row goes from 0fr to 1fr. Closed content is `inert`, so it cannot be tabbed
 * into or read out. Content stays mounted by default, so state inside it survives.
 */
export function Collapse({ open, children, id, lazy = false, className = "" }:
  { open: boolean; children: ReactNode; id?: string; /** Mount the children only once first opened. */ lazy?: boolean; className?: string }) {
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  return (
    <div id={id} className={`ui-collapse ${className}`} data-open={open || undefined} inert={!open || undefined}>
      <div className="ui-collapse-inner">{lazy && !seen ? null : children}</div>
    </div>
  );
}

/** Open state for a Disclosure you control yourself. */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  return { open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}

/**
 * A summary row with a chevron; clicking it opens the details underneath in place.
 * Controlled with `open` and `onOpenChange`, or left to keep its own state.
 */
export function Disclosure({ summary, children, open: controlled, onOpenChange, defaultOpen = false, meta, className = "", lazy }:
  { summary: ReactNode; children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; defaultOpen?: boolean;
    /** Something on the right of the summary row: a count, a badge. */ meta?: ReactNode; className?: string; lazy?: boolean }) {
  const [own, setOwn] = useState(defaultOpen);
  const open = controlled ?? own;
  const id = useId();
  const set = (v: boolean) => { if (controlled == null) setOwn(v); onOpenChange?.(v); };
  return (
    <div className={`ui-disclosure ${className}`} data-open={open || undefined}>
      <button type="button" className="ui-disclosure-row" aria-expanded={open} aria-controls={id} onClick={() => set(!open)}>
        <Icon name="chevronRight" size={13} className="ui-disclosure-chev" />
        <span className="ui-disclosure-summary">{summary}</span>
        {meta != null && <span className="ui-disclosure-meta">{meta}</span>}
      </button>
      <Collapse open={open} id={id} lazy={lazy}><div className="ui-disclosure-body">{children}</div></Collapse>
    </div>
  );
}

/** A list of Disclosures. With `single`, opening one closes the others. */
export function Accordion({ items, single = false, defaultOpen = [] }:
  { items: { id: string; summary: ReactNode; meta?: ReactNode; content: ReactNode }[]; single?: boolean; defaultOpen?: string[] }) {
  const [open, setOpen] = useState<string[]>(defaultOpen);
  return (
    <div className="ui-accordion">
      {items.map((it) => (
        <Disclosure key={it.id} summary={it.summary} meta={it.meta} open={open.includes(it.id)}
          onOpenChange={(v) => setOpen((o) => (v ? (single ? [it.id] : [...o, it.id]) : o.filter((x) => x !== it.id)))}>
          {it.content}
        </Disclosure>
      ))}
    </div>
  );
}
