// One clock for every Sim World tab (DEC-0017): a position along a list of frames that
// plays at 1x, 4x or 16x, steps with the arrow keys, and jumps to the end at once when
// the person prefers reduced motion. The strategy race set the pattern; this is it,
// shared.
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../shared";

export const SPEEDS = ["1x", "4x", "16x"] as const;
export type Speed = (typeof SPEEDS)[number];
export type Rates = Record<Speed, number>;

/** Frames a second for weekly dates: a quarter, a year or four years each second, as the race. */
export const WEEKLY: Rates = { "1x": 13, "4x": 52, "16x": 208 };

/** Frames a second for a timeline whose frames are `days` calendar days apart. */
export function ratesForGap(days: number): Rates {
  const k = 7 / Math.max(1, days);
  return { "1x": WEEKLY["1x"] * k, "4x": WEEKLY["4x"] * k, "16x": WEEKLY["16x"] * k };
}

export interface Playback {
  /** Fractional position, 0 to end. */
  pos: number;
  /** Whole frame shown. */
  i: number;
  end: number;
  playing: boolean;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  play: () => void;
  goTo: (k: number) => void;
  /** Jump to frame a and play to frame b, then stop. */
  playRange: (a: number, b: number) => void;
  reduce: boolean;
}

export function usePlayback(n: number, rates: Rates, resetKey: unknown, startAtEnd = true): Playback {
  const reduce = usePrefersReducedMotion();
  const end = Math.max(0, n - 1);
  const [pos, setPos] = useState(startAtEnd ? end : 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("4x");
  const posRef = useRef(pos);
  posRef.current = pos;
  const stopAt = useRef<number | null>(null);
  const rateRef = useRef(rates);
  rateRef.current = rates;

  // A new timeline (another window, crisis or scenario) starts over.
  useEffect(() => {
    setPlaying(false);
    stopAt.current = null;
    setPos(startAtEnd ? end : 0);
  }, [resetKey, end, startAtEnd]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const target = stopAt.current ?? end;
      const next = Math.min(target, posRef.current + dt * rateRef.current[speed]);
      setPos(next);
      if (next >= target) { setPlaying(false); stopAt.current = null; return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, end]);

  const goTo = (k: number) => { setPlaying(false); stopAt.current = null; setPos(Math.max(0, Math.min(end, k))); };
  const play = () => {
    if (playing) { setPlaying(false); return; }
    stopAt.current = null;
    if (reduce) { setPos(end); return; }
    if (posRef.current >= end) setPos(0);
    setPlaying(true);
  };
  const playRange = (a: number, b: number) => {
    const lo = Math.max(0, Math.min(end, a)), hi = Math.max(lo, Math.min(end, b));
    if (reduce) { goTo(hi); return; }
    setPos(lo);
    stopAt.current = hi;
    setPlaying(true);
  };

  // Space plays or pauses, arrows step (Shift steps ten), Home and End jump.
  const keys = useRef({ play, goTo, end });
  keys.current = { play, goTo, end };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (el && /^(BUTTON|A)$/.test(el.tagName) && e.key === " ") return;
      if (document.querySelector(".ui-dialog, .palette")) return;
      const k = keys.current;
      const now = Math.round(posRef.current);
      if (e.key === "ArrowRight") { e.preventDefault(); k.goTo(now + (e.shiftKey ? 10 : 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); k.goTo(now - (e.shiftKey ? 10 : 1)); }
      else if (e.key === " ") { e.preventDefault(); k.play(); }
      else if (e.key === "Home") { e.preventDefault(); k.goTo(0); }
      else if (e.key === "End") { e.preventDefault(); k.goTo(k.end); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  return { pos: Math.min(pos, end), i: Math.min(end, Math.floor(Math.min(pos, end))), end, playing, speed, setSpeed, play, goTo, playRange, reduce };
}
