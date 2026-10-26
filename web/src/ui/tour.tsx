// One step of a product tour (for the onboarding tours work): a small glass card pointing
// at a part of the page, with the step count, Back, Next and Skip. It anchors to the
// target the way Popover does and holds still for reduced motion. The tour itself (which
// steps, when to show, remembering it was seen) lives with the feature, not here.
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./buttons";
import { Icon } from "./icons";
import { usePresence } from "./presence";

export interface TourStepProps {
  /** A CSS selector or element for the part of the page this step is about. No target: centred. */
  target?: string | HTMLElement | null;
  title: string;
  children: ReactNode;
  step: number;
  total: number;
  open: boolean;
  onNext: () => void;
  onBack?: () => void;
  onSkip: () => void;
  placement?: "top" | "bottom" | "left" | "right";
  /** Optional "Skip all tours" link, for a person who wants no tours at all. */
  onSkipAll?: () => void;
}

export function TourStep({ target, title, children, step, total, open, onNext, onBack, onSkip, placement = "bottom", onSkipAll }: TourStepProps) {
  const p = usePresence(open, "dur-3");
  const card = useRef<HTMLDivElement>(null);
  // Screen readers hear the step count and the text when the card takes focus, not just its title.
  const id = useId();
  const [pos, setPos] = useState<CSSProperties>({});
  const [ring, setRing] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!p.mounted) return;
    const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target ?? null;
    const place = () => {
      const c = card.current;
      if (!c) return;
      const cw = c.offsetWidth, ch = c.offsetHeight, gap = 12, pad = 12;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (!el) { setPos({ left: (vw - cw) / 2, top: (vh - ch) / 2 }); setRing(null); return; }
      const r = el.getBoundingClientRect();
      setRing({ left: r.left - 4, top: r.top - 4, width: r.width + 8, height: r.height + 8 });
      let left = r.left + r.width / 2 - cw / 2, top = r.bottom + gap;
      if (placement === "top") top = r.top - ch - gap;
      if (placement === "left") { left = r.left - cw - gap; top = r.top + r.height / 2 - ch / 2; }
      if (placement === "right") { left = r.right + gap; top = r.top + r.height / 2 - ch / 2; }
      if (top + ch > vh - pad) top = Math.max(pad, r.top - ch - gap);
      if (top < pad) top = Math.min(vh - ch - pad, r.bottom + gap);
      setPos({ left: Math.max(pad, Math.min(vw - cw - pad, left)), top });
    };
    el?.scrollIntoView({ block: "nearest" });
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [p.mounted, target, placement, step]);

  useLayoutEffect(() => { if (open) card.current?.focus(); }, [open, step]);

  if (!p.mounted) return null;
  const last = step >= total;
  return (
    <>
      {ring && <div className="ui-tour-ring" style={ring} aria-hidden data-state={p.state} />}
      <div ref={card} className="ui-tour" style={pos} data-state={p.state} role="dialog" aria-labelledby={`${id}-t`} aria-describedby={`${id}-n ${id}-b`} tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Escape") onSkip(); if (e.key === "ArrowRight") onNext(); if (e.key === "ArrowLeft") onBack?.(); }}>
        <div className="ui-tour-head">
          <span id={`${id}-n`} className="ui-tour-count ui-num">{step} of {total}</span>
          <button type="button" className="ui-iconbtn ui-iconbtn-plain" aria-label="Skip the tour" onClick={onSkip}><Icon name="close" size={13} /></button>
        </div>
        <h3 id={`${id}-t`}>{title}</h3>
        <div id={`${id}-b`} className="ui-tour-body">{children}</div>
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
