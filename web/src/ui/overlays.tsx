// Things that float: tooltips, dropdown menus, dialogs and toasts. Positioning
// uses Floating UI, the same library the doc previews use.
import { computePosition, flip, offset, shift, type Placement } from "@floating-ui/dom";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "./icons";

function usePosition(open: boolean, anchor: React.RefObject<HTMLElement | null>, placement: Placement) {
  const float = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current || !float.current) return;
    const el = float.current;
    computePosition(anchor.current, el, { strategy: "fixed", placement, middleware: [offset(6), flip(), shift({ padding: 8 })] })
      .then(({ x, y }) => { el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.visibility = "visible"; });
  }, [open, anchor, placement]);
  return float;
}

/** A dark tooltip on hover or focus. Plain text only; use a preview card for anything richer. */
export function Tooltip({ text, children, placement = "top" }: { text: string; children: ReactNode; placement?: Placement }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const float = usePosition(open, anchor, placement);
  return (
    <span ref={anchor} className="ui-tip-anchor" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      {open && <div ref={float} className="ui-tip" role="tooltip">{text}</div>}
    </span>
  );
}

export interface MenuItem { label: string; icon?: string; onSelect: () => void; danger?: boolean }

/** A dropdown menu under a trigger. Closes on choice, Escape or a click elsewhere. */
export function Menu({ trigger, items, placement = "bottom-end" }: { trigger: (open: boolean) => ReactNode; items: MenuItem[]; placement?: Placement }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const float = usePosition(open, anchor, placement);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !anchor.current?.contains(e.target as Node) && !float.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open, float]);
  return (
    <div className="ui-menu-anchor" ref={anchor}>
      <span onClick={() => setOpen((o) => !o)}>{trigger(open)}</span>
      {open && (
        <div ref={float} className="ui-menu anim-pop" role="menu">
          {items.map((i) => (
            <button key={i.label} role="menuitem" className={i.danger ? "danger" : ""} onClick={() => { setOpen(false); i.onSelect(); }}>
              {i.icon && <Icon name={i.icon} size={13} />} {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A modal dialog over a dimmed page. Escape or the scrim closes it. */
export function Dialog({ open, onClose, title, children, footer, width = 560 }:
  { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ui-scrim anim-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ui-dialog anim-rise" role="dialog" aria-modal aria-label={typeof title === "string" ? title : undefined} style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
        <div className="ui-dialog-head">
          <h2>{title}</h2>
          <button className="ui-iconbtn ui-iconbtn-plain" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="ui-dialog-body">{children}</div>
        {footer && <div className="ui-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Toasts: call toast("Saved") from anywhere; <Toaster /> (mounted once) shows them.
interface ToastItem { id: number; text: string; tone: "default" | "good" | "bad"; action?: { label: string; run: () => void } }
let toasts: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function toast(text: string, opts: { tone?: ToastItem["tone"]; action?: ToastItem["action"]; ms?: number } = {}) {
  const t: ToastItem = { id: ++seq, text, tone: opts.tone ?? "default", action: opts.action };
  toasts = [...toasts, t];
  emit();
  window.setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); }, opts.ms ?? 4000);
}

export function Toaster() {
  const list = useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => toasts);
  return (
    <div className="ui-toaster" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`ui-toast anim-rise ${t.tone}`}>
          {t.tone === "good" && <Icon name="checkCircle" size={15} />}
          <span>{t.text}</span>
          {t.action && <button onClick={() => { t.action!.run(); toasts = toasts.filter((x) => x.id !== t.id); emit(); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}
