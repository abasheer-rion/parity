// Pause live updates (WCAG 2.2.2). Prices, order books, trade lists, the markets board and the
// Terminal's ticker tape keep moving by themselves; a person can stop them with the Pause
// button (components/PauseLive.tsx) and start them again. While paused, updates are held,
// not lost: on Resume each listener gets what it missed (the newest book, every tick and
// trade up to a cap), so charts and tables catch up. Session only: a new visit starts live.
import { useSyncExternalStore } from "react";

let paused = false;
const listeners = new Set<() => void>();

export const livePaused = (): boolean => paused;

export function setLivePaused(on: boolean): void {
  if (paused === on) return;
  paused = on;
  for (const fn of [...listeners]) fn();
}

export function onLivePause(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** True while live updates are paused; re-renders when it changes. */
export function useLivePaused(): boolean {
  return useSyncExternalStore(onLivePause, livePaused, () => false);
}

/** How many held calls a listener keeps while paused before the oldest are dropped. */
export const HOLD_CAP = 20_000;

/**
 * Wraps a listener so it holds its calls while paused and replays them on Resume. "last"
 * keeps only the newest call (a full snapshot, such as an order book); "all" keeps every
 * call in order (ticks, trades, changed rows). Call `release` when unsubscribing.
 */
export function holdable<A extends unknown[]>(fn: (...args: A) => void, mode: "last" | "all"): { call: (...args: A) => void; release: () => void } {
  let held: A[] = [];
  const off = onLivePause(() => {
    if (paused || !held.length) return;
    const out = held;
    held = [];
    for (const args of out) fn(...args);
  });
  return {
    call: (...args: A) => {
      if (!paused) { fn(...args); return; }
      if (mode === "last") held = [args];
      else { held.push(args); if (held.length > HOLD_CAP) held.splice(0, held.length - HOLD_CAP); }
    },
    release: () => { off(); held = []; },
  };
}
