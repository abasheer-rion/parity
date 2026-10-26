// A guided tour built on the library's TourStep card (tour.tsx): it decides which steps can be
// shown, moves between them, and adds what a whole tour needs around the card.
//
//   <Tour open steps={[{ id: "search", target: ".side-search", title: "Search", body: "..." }]}
//         label="Home tour" onEnd={(reason) => ...} />
//
// Behaviour:
//   - A step whose target is missing or hidden (a phone layout, a closed panel) is skipped,
//     and the count only counts the steps that can be shown.
//   - A veil takes clicks, so the page cannot be used half way through. It and the card are
//     fixed layers, so the page never moves. The card's ring dims everything but the target.
//   - Keyboard: Escape skips the tour, Left and Right move, Tab stays inside the card, and no
//     other key reaches the page while the tour is open (so app hotkeys do not fire).
//   - "Skip all tours" ends with "skip-all"; the caller turns every tour off.
//   - A target can be a spot on the top edge of the window, for controls outside the page
//     such as the desktop app's title bar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TourStep } from "./tour";
import "./guidedTour.css";

/** A CSS selector, a function that finds the element, or a spot on the top edge of the window. */
export type TourTarget = string | (() => Element | null) | { edge: "top-left" | "top-right"; inset?: number };

export interface GuidedStep {
  id: string;
  target: TourTarget;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
}

/** How a tour ended: finished, skipped, every tour turned off, or nothing on the page to show. */
export type TourEnd = "done" | "skip" | "skip-all" | "none";

/** True when the element is on the page, takes up space and is not off to the side. */
export function isShown(el: Element | null | undefined): el is Element {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  // Off to the side (a phone's slide-in sidebar while it is closed): not reachable by scrolling.
  if (r.right <= 0 || r.left >= window.innerWidth) return false;
  const style = window.getComputedStyle(el);
  // Opacity is not checked: a card still fading in on scroll is there, just not drawn yet.
  return style.visibility !== "hidden" && style.display !== "none";
}

function found(t: TourTarget): boolean {
  if (typeof t === "object") return true;
  return isShown(typeof t === "string" ? document.querySelector(t) : t());
}

/** The indexes of the steps that can be shown right now, in order. */
export function availableSteps(steps: GuidedStep[], find: (t: TourTarget) => boolean = found): number[] {
  return steps.flatMap((s, i) => (find(s.target) ? [i] : []));
}

const cardOf = () => document.querySelector<HTMLElement>(".ui-tour[role='dialog']");

export function Tour({ steps, open, label, onEnd, onStep }: {
  steps: GuidedStep[];
  open: boolean;
  /** The tour's name, for example "Trade tour". */
  label: string;
  onEnd: (reason: TourEnd, step: number) => void;
  onStep?: (index: number, step: GuidedStep) => void;
}) {
  const [index, setIndex] = useState(-1);
  // Bumped on resize, so the list of steps that can be shown is worked out again.
  const [tick, setTick] = useState(0);
  const avail = useMemo(() => (open ? availableSteps(steps) : []), [open, steps, tick, index]);
  const edge = useRef<HTMLSpanElement>(null);
  const [edgeEl, setEdgeEl] = useState<HTMLElement | null>(null);
  const ended = useRef(false);

  const end = useCallback((reason: TourEnd, at: number) => {
    if (ended.current) return;
    ended.current = true;
    onEnd(reason, at);
  }, [onEnd]);

  // When the tour ends, focus goes back where it was, or to the page's main area, never
  // to nowhere (WCAG 2.4.3).
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    return () => {
      window.requestAnimationFrame(() => {
        if (document.activeElement && document.activeElement !== document.body) return;
        const back = before?.isConnected ? before : document.querySelector<HTMLElement>("main, [role=main]");
        if (back && !back.matches("a[href], button, input, select, textarea, [tabindex]")) back.setAttribute("tabindex", "-1");
        back?.focus({ preventScroll: true });
      });
    };
  }, [open]);

  // Start at the first step that can be shown, or end at once when there is none.
  useEffect(() => {
    if (!open) { setIndex(-1); ended.current = false; return; }
    const first = availableSteps(steps)[0];
    if (first == null) { end("none", 0); return; }
    setIndex(first);
  }, [open, steps, end]);

  useEffect(() => {
    if (!open) return;
    let t = 0;
    const on = () => { window.clearTimeout(t); t = window.setTimeout(() => setTick((n) => n + 1), 120); };
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("resize", on); window.clearTimeout(t); };
  }, [open]);

  // When the current target goes away (the window got narrower), move on to the next one.
  useEffect(() => {
    if (!open || index < 0 || avail.includes(index)) return;
    const next = avail.find((i) => i > index) ?? avail.at(-1);
    if (next == null) end("none", index);
    else setIndex(next);
  }, [open, index, avail, end]);

  const pos = avail.indexOf(index);
  const step = index >= 0 ? steps[index] : undefined;

  const go = useCallback((dir: 1 | -1) => {
    const list = availableSteps(steps);
    const to = list[list.indexOf(index) + dir];
    if (to == null) { if (dir === 1) end("done", index); return; }
    setIndex(to);
  }, [steps, index, end]);

  useEffect(() => { if (step) onStep?.(index, step); }, [index, step, onStep]);

  // A spot on the window's top edge is a small fixed anchor the card can point at.
  useEffect(() => { setEdgeEl(edge.current); }, [step]);

  // Keys: handled before the page sees them, so app hotkeys stay quiet during a tour.
  useEffect(() => {
    if (!open || index < 0) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); end("skip", index); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); return; }
      const card = cardOf();
      if (e.key === "Tab") {
        const items = Array.from(card?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
        if (!items.length) return;
        e.preventDefault();
        const at = items.indexOf(document.activeElement as HTMLElement);
        const to = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at + 1) % items.length;
        items[to].focus();
        return;
      }
      // Enter and Space press the focused button (the browser's default). Everything else
      // is swallowed unless focus is in the card.
      if (!card?.contains(document.activeElement)) e.preventDefault();
    };
    // Focus that escapes the card (a click on the page, a screen reader jump) comes back.
    const onFocus = (e: FocusEvent) => { const card = cardOf(); if (card && !card.contains(e.target as Node)) card.focus({ preventScroll: true }); };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => { window.removeEventListener("keydown", onKey, true); document.removeEventListener("focusin", onFocus); };
  }, [open, index, go, end]);

  if (!open || !step || pos < 0) return null;
  const t = step.target;
  const edgeStyle = typeof t === "object" ? (t.edge === "top-left" ? { left: t.inset ?? 16 } : { right: t.inset ?? 16 }) : undefined;
  const target = typeof t === "object" ? edgeEl : typeof t === "string" ? t : (t() as HTMLElement | null);
  return createPortal(
    <div className="ui-gtour" aria-label={label}>
      <div className="ui-gtour-veil" aria-hidden onPointerDown={(e) => e.preventDefault()} />
      {edgeStyle && <span ref={edge} className="ui-gtour-edge" style={edgeStyle} aria-hidden />}
      <TourStep key={step.id} open modal target={target} title={step.title} step={pos + 1} total={avail.length}
        placement={step.placement ?? "bottom"} onNext={() => go(1)} onBack={() => go(-1)} onSkip={() => end("skip", index)} onSkipAll={() => end("skip-all", index)}>
        {step.body}
      </TourStep>
    </div>,
    document.body,
  );
}
