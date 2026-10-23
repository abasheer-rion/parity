// Things that float: tooltips, popovers, dropdown menus, dialogs, drawers and toasts.
// Each one is anchored to what opened it: a popover or menu sits against its trigger
// and follows it as the page scrolls, grows out of the side it is attached to, and a
// dialog grows out of the button that opened it. All of them animate in and out (short,
// eased, transforms only) and hold still for reduced motion. Positioning uses Floating
// UI, the same library the doc previews use.
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from "@floating-ui/dom";
import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { Icon } from "./icons";
import { usePresence } from "./presence";

/** Keeps a floating element against its anchor while open, following scroll and resize. */
function useAnchored(open: boolean, anchor: React.RefObject<HTMLElement | null>, float: React.RefObject<HTMLElement | null>, placement: Placement, gap = 6) {
  useLayoutEffect(() => {
    const a = anchor.current, el = float.current;
    if (!open || !a || !el) return;
    const update = () => computePosition(a, el, { strategy: "fixed", placement, middleware: [offset(gap), flip(), shift({ padding: 8 })] })
      .then(({ x, y, placement: p }) => {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.dataset.side = p.split("-")[0];
        el.style.visibility = "visible";
      });
    return autoUpdate(a, el, update);
  }, [open, anchor, float, placement, gap]);
}

/** Puts the open state on the trigger itself (a button), where screen readers look for it. */
function withAria(node: ReactNode, attrs: Record<string, string | boolean | undefined>): ReactNode {
  return isValidElement(node) ? cloneElement(node as ReactElement<Record<string, unknown>>, attrs) : node;
}

/** Closes on Escape and on a press outside the given elements. */
function useDismiss(open: boolean, close: () => void, inside: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    const down = (e: PointerEvent) => { if (!inside.some((r) => r.current?.contains(e.target as Node))) close(); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", down); };
    // `inside` is a fresh array each render; its refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close]);
}

// Tooltips: a short delay before the first one, then instant while you move along a row.
let lastTipClose = 0;

/** A dark tooltip on hover or focus. Plain text only; use a Popover or a preview card for anything richer. */
export function Tooltip({ text, children, placement = "top" }: { text: string; children: ReactNode; placement?: Placement }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const p = usePresence(open, 100);
  useAnchored(p.mounted, anchor, float, placement);
  const show = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(true), Date.now() - lastTipClose < 400 ? 0 : 350); };
  const hide = () => { window.clearTimeout(timer.current); if (open) lastTipClose = Date.now(); setOpen(false); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <span ref={anchor} className="ui-tip-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {p.mounted && <div ref={float} className="ui-tip ui-float" data-state={p.state} role="tooltip">{text}</div>}
    </span>
  );
}

/**
 * A card that opens against its trigger on click: filters, a date picker, a small form.
 * `trigger` gets the open state; Escape, a click outside or `close()` from inside shuts
 * it, and focus goes back to the trigger.
 */
export function Popover({ trigger, children, placement = "bottom-start", width, label, open: controlled, onOpenChange }:
  { trigger: (open: boolean) => ReactNode; children: ReactNode | ((close: () => void) => ReactNode); placement?: Placement; width?: number; label?: string;
    open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const set = useCallback((v: boolean) => { if (controlled == null) setOwn(v); onOpenChange?.(v); }, [controlled, onOpenChange]);
  const anchor = useRef<HTMLSpanElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const id = useId();
  const p = usePresence(open, 140);
  useAnchored(p.mounted, anchor, float, placement, 8);
  const close = useCallback(() => {
    set(false);
    anchor.current?.querySelector<HTMLElement>("button, a, [tabindex]")?.focus();
  }, [set]);
  useDismiss(open, close, [anchor, float]);
  // Move focus into the card when it opens, so the keyboard follows the eye.
  useEffect(() => {
    if (p.state !== "open") return;
    const el = float.current;
    (el?.querySelector<HTMLElement>("input, select, textarea, button, a[href], [tabindex]:not([tabindex='-1'])") ?? el)?.focus({ preventScroll: true });
  }, [p.state]);
  return (
    <span className="ui-pop-anchor" ref={anchor} onClick={() => set(!open)}>
      {withAria(trigger(open), { "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": open ? id : undefined })}
      {p.mounted && (
        <div ref={float} id={id} className="ui-popover ui-float" data-state={p.state} role="dialog" aria-label={label} tabIndex={-1}
          style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()} data-lenis-prevent>
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </span>
  );
}

export interface MenuItem { label: string; icon?: string; onSelect: () => void; danger?: boolean }

/** A dropdown menu under a trigger. Arrow keys move, Enter chooses; closes on choice, Escape or a click elsewhere. */
export function Menu({ trigger, items, placement = "bottom-end" }: { trigger: (open: boolean) => ReactNode; items: MenuItem[]; placement?: Placement }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const p = usePresence(open, 120);
  useAnchored(p.mounted, anchor, float, placement);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [anchor, float]);
  useEffect(() => { if (p.state === "open") float.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true }); }, [p.state]);
  const onKey = (e: React.KeyboardEvent) => {
    const list = Array.from(float.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = list.indexOf(document.activeElement as HTMLElement);
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step) { e.preventDefault(); list[(i + step + list.length) % list.length]?.focus(); }
    if (e.key === "Tab") setOpen(false);
  };
  return (
    <div className="ui-menu-anchor" ref={anchor}>
      <span onClick={() => setOpen((o) => !o)}>{withAria(trigger(open), { "aria-haspopup": "menu", "aria-expanded": open })}</span>
      {p.mounted && (
        <div ref={float} className="ui-menu ui-float" data-state={p.state} role="menu" onKeyDown={onKey}>
          {items.map((i) => (
            <button key={i.label} role="menuitem" tabIndex={-1} className={i.danger ? "danger" : ""} onClick={() => { setOpen(false); i.onSelect(); }}>
              {i.icon && <Icon name={i.icon} size={13} />} {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Modal surfaces: dialogs and drawers ----------

let locks = 0;
/** Stops the page behind a modal from scrolling. The scroll bar's space is kept (scrollbar-gutter), so nothing shifts. */
function useScrollLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    if (locks++ === 0) {
      document.documentElement.classList.add("ui-locked");
      window.dispatchEvent(new CustomEvent("ui:scroll-lock", { detail: true }));
    }
    return () => {
      if (--locks === 0) {
        document.documentElement.classList.remove("ui-locked");
        window.dispatchEvent(new CustomEvent("ui:scroll-lock", { detail: false }));
      }
    };
  }, [on]);
}

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Moves focus into a modal, keeps Tab inside it, and gives focus back to the opener on close. */
function useFocusTrap(on: boolean, box: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!on) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = box.current;
    const first = el?.querySelector<HTMLElement>(`.ui-modal-body ${FOCUSABLE}`) ?? el;
    first?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !el) return;
      const list = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!list.length) return;
      const a = list[0], z = list[list.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); opener?.focus?.({ preventScroll: true }); };
  }, [on, box]);
}

function useEscape(on: boolean, onClose: () => void) {
  useEffect(() => {
    if (!on) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [on, onClose]);
}

/**
 * A modal dialog over a dimmed page. It grows out of the button that opened it and
 * shrinks back into it. Escape or the scrim closes it; focus stays inside while open.
 */
export function Dialog({ open, onClose, title, children, footer, width = 560 }:
  { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  const p = usePresence(open, 180);
  const box = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<string | undefined>();
  // Where the opener sits, relative to the dialog's centre, becomes the transform origin.
  useLayoutEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = box.current;
    if (!opener || !el || opener === document.body) { setOrigin(undefined); return; }
    const a = opener.getBoundingClientRect(), d = el.getBoundingClientRect();
    setOrigin(`${a.left + a.width / 2 - d.left}px ${a.top + a.height / 2 - d.top}px`);
  }, [open, p.mounted]);
  useEscape(open, onClose);
  useScrollLock(p.mounted);
  useFocusTrap(open && p.mounted, box);
  if (!p.mounted) return null;
  return (
    <div className="ui-scrim" data-state={p.state} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="ui-dialog" data-state={p.state} role="dialog" aria-modal aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}
        style={{ width: `min(${width}px, calc(100vw - 32px))`, transformOrigin: origin } as CSSProperties}>
        <div className="ui-dialog-head">
          <h2>{title}</h2>
          <button className="ui-iconbtn ui-iconbtn-plain" aria-label="Close" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div className="ui-dialog-body ui-modal-body" data-lenis-prevent>{children}</div>
        {footer && <div className="ui-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * A panel that slides in from an edge over a dimmed page: details for a row, an article,
 * settings. Right by default; on phones a right or left drawer becomes a sheet from the
 * bottom. Escape or the scrim closes it, and it slides back out.
 */
export function Drawer({ open, onClose, title, children, width = 520, side = "right", footer }:
  { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number; side?: "right" | "left" | "bottom"; footer?: ReactNode }) {
  const p = usePresence(open, 220);
  const box = useRef<HTMLElement>(null);
  useEscape(open, onClose);
  useScrollLock(p.mounted);
  useFocusTrap(open && p.mounted, box);
  if (!p.mounted) return null;
  return (
    <div className={`ui-scrim ui-drawer-scrim side-${side}`} data-state={p.state} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={box} className={`ui-drawer side-${side}`} data-state={p.state} role="dialog" aria-modal aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}
        style={{ "--drawer-w": `${width}px` } as CSSProperties} data-lenis-prevent>
        <div className="ui-dialog-head">
          <h2>{title}</h2>
          <button className="ui-iconbtn ui-iconbtn-plain" aria-label="Close" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div className="ui-drawer-body ui-modal-body">{children}</div>
        {footer && <div className="ui-dialog-foot">{footer}</div>}
      </aside>
    </div>
  );
}

// ---------- Toasts ----------
// Call toast("Saved") from anywhere; <Toaster /> (mounted once) shows them. A toast
// confirms something that already happened, at once, so a click feels instant.

interface ToastItem { id: number; text: string; tone: "default" | "good" | "bad"; action?: { label: string; run: () => void }; leaving?: boolean }
let toasts: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
const MAX_TOASTS = 3;

/** Starts a toast leaving; it is removed once its exit animation has played. */
export function dismissToast(id: number) {
  if (!toasts.some((t) => t.id === id && !t.leaving)) return;
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  window.setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, 180);
}

/** Shows a short message at the bottom of the screen. Returns its id, for dismissToast. */
export function toast(text: string, opts: { tone?: ToastItem["tone"]; action?: ToastItem["action"]; ms?: number } = {}): number {
  const t: ToastItem = { id: ++seq, text, tone: opts.tone ?? "default", action: opts.action };
  toasts = [...toasts, t];
  // Only the newest few stay; older ones leave first.
  toasts.filter((x) => !x.leaving).slice(0, -MAX_TOASTS).forEach((x) => dismissToast(x.id));
  emit();
  window.setTimeout(() => dismissToast(t.id), opts.ms ?? 4000);
  return t.id;
}

export function Toaster() {
  const list = useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => toasts);
  return (
    <div className="ui-toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`ui-toast ${t.tone}`} data-state={t.leaving ? "exit" : "open"}>
          {t.tone === "good" && <Icon name="checkCircle" size={15} />}
          <span>{t.text}</span>
          {t.action && <button onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}
