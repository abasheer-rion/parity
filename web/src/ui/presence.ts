// Hooks behind the library's motion: keep something on screen while it animates out,
// follow the reduced-motion setting, and glide items to new places when a list reorders.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { durationMs, tokenValue } from "./tokens";

const REDUCE = "(prefers-reduced-motion: reduce)";

/** True when the person asked their system for less motion. Updates if they change it. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (on) => {
      const mq = window.matchMedia(REDUCE);
      mq.addEventListener("change", on);
      return () => mq.removeEventListener("change", on);
    },
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia(REDUCE).matches;

export type PresenceState = "enter" | "open" | "exit";

/**
 * Keeps an element mounted while it animates out. `state` is "enter" for the first
 * frame (so CSS can transition from it), "open" while shown and "exit" while leaving.
 * Style the three with [data-state] and the element fades and moves both ways.
 */
export function usePresence(open: boolean, exitMs = 160): { mounted: boolean; state: PresenceState } {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<PresenceState>(open ? "open" : "exit");
  useEffect(() => {
    if (open) {
      setMounted(true);
      setState("enter");
      // Two frames: one to paint the starting state, one to move to the open state.
      let r2 = 0;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setState("open")); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setState("exit");
    const t = window.setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);
  return { mounted, state };
}

/**
 * FLIP: when the children of `ref` reorder (a sort, a filter), each child keyed by
 * `data-flip` glides from where it was to where it is now, using transforms only.
 * Pass something that changes when the order changes as `dep`. Skips long lists.
 */
export function useFlip<T extends HTMLElement>(dep: unknown, { max = 80, ms = durationMs("dur-3") }: { max?: number; ms?: number } = {}) {
  const ref = useRef<T>(null);
  // Each item's top, measured from the top of the list (so scrolling does not matter), after the last change.
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const base = root.getBoundingClientRect().top;
    const items = Array.from(root.querySelectorAll<HTMLElement>(":scope > [data-flip]"));
    const next = new Map<string, number>();
    for (const el of items) next.set(el.dataset.flip!, el.getBoundingClientRect().top - base);
    if (!prefersReducedMotion() && items.length <= max && last.current.size) {
      for (const el of items) {
        const before = last.current.get(el.dataset.flip!);
        const now = next.get(el.dataset.flip!)!;
        if (before == null || Math.abs(before - now) < 1) continue;
        el.animate([{ transform: `translateY(${before - now}px)` }, { transform: "none" }], { duration: ms, easing: tokenValue("ease-spring") });
      }
    }
    last.current = next;
  }, [dep, max, ms]);
  return ref;
}
