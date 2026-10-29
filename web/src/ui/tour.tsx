// One step of a product tour, drawn as a spotlight: the page behind is dimmed and blurred,
// the part of the page the step is about is cut out sharp with a ring round it, and the card
// (step count, title, text, Back, Next, Skip) sits in the middle of the screen.
//
//   <TourStep target="#search" title="Search" step={1} total={3} open onNext={next} onSkip={skip}>…</TourStep>
//
// The cut-out follows its target on scroll and resize and glides to the next target when
// the step changes (it jumps instead under reduced motion). If the card would cover the
// target, it moves up or down into the larger free space, still centred across. The tour
// itself (which steps, when to show, remembering it was seen) lives with the feature, here
// in guidedTour.tsx.
import { useCallback, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Button } from "./buttons";
import { Icon } from "./icons";
import { prefersReducedMotion, usePresence } from "./presence";
import { durationMs, RAW } from "./tokens";

export interface TourStepProps {
  /** A CSS selector or element for the part of the page this step is about. No target: no cut-out. */
  target?: string | HTMLElement | null;
  title: string;
  children: ReactNode;
  step: number;
  total: number;
  open: boolean;
  onNext: () => void;
  onBack?: () => void;
  onSkip: () => void;
  /** Ignored: the card is always centred. Kept so older callers still compile. */
  placement?: "top" | "bottom" | "left" | "right";
  /** Optional "Skip all tours" link, for a person who wants no tours at all. */
  onSkipAll?: () => void;
  /** True when the card keeps focus inside it (the guided tour), so screen readers stay in it too. */
  modal?: boolean;
}

/** A rectangle on screen, in viewport pixels. */
type Box = { x: number; y: number; w: number; h: number };

/** Room between the target and the edge of the cut-out. */
const PAD = 6;
/** Room kept between the card and the cut-out, and the card and the window edge. */
const GAP = 16;
const RADIUS = parseFloat(RAW["radius-md"]);

const n = (v: number) => Math.round(v * 10) / 10;

/** The shade's clip: the whole window, minus a rounded hole over the target. */
export function holeClip(vw: number, vh: number, b: Box | null): string {
  const outer = `M0 0H${n(vw)}V${n(vh)}H0Z`;
  if (!b) return `path(evenodd, "${outer}")`;
  const r = n(Math.max(0, Math.min(RADIUS, b.w / 2, b.h / 2)));
  const x = n(b.x), y = n(b.y), w = n(b.w), h = n(b.h);
  const inner = `M${n(x + r)} ${y}H${n(x + w - r)}A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)}`
    + `H${n(x + r)}A${r} ${r} 0 0 1 ${x} ${n(y + h - r)}V${n(y + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${y}Z`;
  return `path(evenodd, "${outer} ${inner}")`;
}

/** How far to move the centred card up or down so it does not cover the cut-out (0: stay put). */
export function cardShift(vw: number, vh: number, cw: number, ch: number, b: Box | null): number {
  if (!b) return 0;
  const top = (vh - ch) / 2, left = (vw - cw) / 2;
  const overlaps = b.x < left + cw + GAP && b.x + b.w > left - GAP && b.y < top + ch + GAP && b.y + b.h > top - GAP;
  if (!overlaps) return 0;
  const above = b.y - GAP - GAP;
  const below = vh - (b.y + b.h) - GAP - GAP;
  if (Math.max(above, below) < ch) return 0;
  const to = below >= above ? b.y + b.h + GAP + (below - ch) / 2 : GAP + (above - ch) / 2;
  return Math.round(to - top);
}

const ease = (k: number) => 1 - (1 - k) ** 3;
const mix = (a: Box, b: Box, k: number): Box => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });

export function TourStep({ target, title, children, step, total, open, onNext, onBack, onSkip, onSkipAll, modal = false }: TourStepProps) {
  const p = usePresence(open, "dur-3");
  const card = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  // Screen readers hear the step count and the text when the card takes focus, not just its title.
  const id = useId();
  // What is drawn now, where it is heading, and the running glide.
  const drawn = useRef<Box | null>(null);
  const goal = useRef<Box | null>(null);
  const glide = useRef(0);

  const draw = useCallback((b: Box | null) => {
    drawn.current = b;
    if (shade.current) shade.current.style.clipPath = holeClip(window.innerWidth, window.innerHeight, b);
    const rg = ring.current;
    if (!rg) return;
    rg.style.display = b ? "" : "none";
    if (b) Object.assign(rg.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
  }, []);

  const place = useCallback((b: Box | null) => {
    const c = card.current;
    if (!c) return;
    c.style.setProperty("--ui-tour-shift", `${cardShift(window.innerWidth, window.innerHeight, c.offsetWidth, c.offsetHeight, b)}px`);
  }, []);

  useLayoutEffect(() => {
    if (!p.mounted) return;
    const find = () => (typeof target === "string" ? document.querySelector<HTMLElement>(target) : target ?? null);
    const measure = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) return null;
      return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
    };
    const el = find();
    el?.scrollIntoView?.({ block: "nearest" });
    const to = measure(el);
    goal.current = to;
    place(to);
    window.cancelAnimationFrame(glide.current);
    glide.current = 0;
    const from = drawn.current;
    const ms = prefersReducedMotion() ? 0 : durationMs("dur-3");
    if (!from || !to || ms <= 0) draw(to);
    else {
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const g = goal.current;
        draw(g ? mix(from, g, ease(k)) : null);
        glide.current = k < 1 && g ? window.requestAnimationFrame(tick) : 0;
      };
      glide.current = window.requestAnimationFrame(tick);
    }
    // Scrolling, resizing or the page moving under the target: the cut-out follows. A glide
    // in progress just heads for the new spot.
    const follow = () => {
      const b = measure(find());
      goal.current = b;
      place(b);
      if (!glide.current) draw(b);
    };
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(follow) : null;
    if (el) ro?.observe(el);
    if (card.current) ro?.observe(card.current);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
      ro?.disconnect();
      window.cancelAnimationFrame(glide.current);
      glide.current = 0;
    };
  }, [p.mounted, target, step, draw, place]);

  // The shade takes clicks and stops them there (native listeners, so page-wide "click
  // outside" handlers on the document never hear them either).
  useLayoutEffect(() => {
    const el = shade.current;
    if (!p.mounted || !el) return;
    const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    const kinds = ["pointerdown", "mousedown", "click", "touchstart"] as const;
    kinds.forEach((k) => el.addEventListener(k, stop));
    return () => kinds.forEach((k) => el.removeEventListener(k, stop));
  }, [p.mounted]);

  // Closed: the next opening starts fresh, without gliding in from where the last one ended.
  useLayoutEffect(() => { if (!p.mounted) drawn.current = null; }, [p.mounted]);

  useLayoutEffect(() => { if (open) card.current?.focus({ preventScroll: true }); }, [open, step]);

  if (!p.mounted) return null;
  const last = step >= total;
  return (
    <>
      <div ref={shade} className="ui-tour-shade" aria-hidden data-state={p.state} />
      <div ref={ring} className="ui-tour-ring" aria-hidden data-state={p.state} />
      <div ref={card} className="ui-tour" data-state={p.state} role="dialog" aria-labelledby={`${id}-t`} aria-describedby={`${id}-n ${id}-b`} aria-modal={modal || undefined} tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Escape") onSkip(); if (e.key === "ArrowRight") onNext(); if (e.key === "ArrowLeft") onBack?.(); }}>
        <div className="ui-tour-head">
          <span id={`${id}-n`} className="ui-tour-count ui-num">{step} of {total}</span>
          <button type="button" className="ui-iconbtn ui-iconbtn-plain" aria-label="Skip the tour" onClick={onSkip}><Icon name="close" size={13} /></button>
        </div>
        <div key={step} className="ui-tour-step">
          <h3 id={`${id}-t`}>{title}</h3>
          <div id={`${id}-b`} className="ui-tour-body">{children}</div>
        </div>
        <div className="ui-tour-foot">
          {onSkipAll ? <button type="button" className="ui-tour-skipall" onClick={onSkipAll}>Skip all tours</button> : null}
          <span className="ui-tour-gap" />
          {onBack && step > 1 ? <Button size="sm" variant="ghost" onClick={onBack}>Back</Button> : null}
          <Button size="sm" variant="primary" onClick={onNext}>{last ? "Done" : "Next"}</Button>
        </div>
      </div>
    </>
  );
}
