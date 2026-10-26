// The Motion setting (REF-0023), without React, so the plain-script front page can use it
// too. Three choices, kept in this browser under `parity.motion`:
//   "system"   follow the device (the default): full motion, or reduced if the device asks
//   "full"     full motion even when the device asks for less
//   "reduced"  reduced motion even when the device does not ask for it
// The choice is written to <html data-motion> so CSS can override the media query, and
// "reduced" means less, not none: short fades and crossfades stay, movement goes
// (no slides, rises, scales or counting numbers). The React hooks are in motionPref.ts.
export type MotionPref = "system" | "full" | "reduced";
export type MotionLevel = "full" | "reduced";

export const MOTION_KEY = "parity.motion";
export const MOTION_PREFS: readonly MotionPref[] = ["system", "full", "reduced"];
export const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
/** Fired on window when the choice changes on this page. */
export const MOTION_EVENT = "parity:motion";

const isPref = (v: unknown): v is MotionPref => typeof v === "string" && (MOTION_PREFS as readonly string[]).includes(v);

/** The stored choice, or "system" when nothing (or something unreadable) is stored. */
export function readMotionPref(): MotionPref {
  try {
    const v = window.localStorage.getItem(MOTION_KEY);
    return isPref(v) ? v : "system";
  } catch {
    return "system";
  }
}

/** Does the device ask for reduced motion? */
export function deviceWantsReduced(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCE_QUERY).matches;
  } catch {
    return false;
  }
}

/** What actually plays: the choice wins, "system" follows the device. */
export function resolveMotion(pref: MotionPref, deviceReduced: boolean): MotionLevel {
  if (pref === "full") return "full";
  if (pref === "reduced") return "reduced";
  return deviceReduced ? "reduced" : "full";
}

/** The choice in force on this page: what is on <html data-motion>, else what is stored. */
export function currentMotionPref(): MotionPref {
  const v = typeof document !== "undefined" ? document.documentElement.dataset.motion : undefined;
  return isPref(v) ? v : readMotionPref();
}

/** The level right now, for code outside React. */
export function motionLevel(): MotionLevel {
  return resolveMotion(currentMotionPref(), deviceWantsReduced());
}

/** Puts the choice on <html data-motion>, where the stylesheet reads it. */
export function applyMotionPref(pref: MotionPref = readMotionPref()) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = pref;
}

/** Saves the choice, applies it and tells every hook on the page. */
export function writeMotionPref(pref: MotionPref) {
  try {
    if (pref === "system") window.localStorage.removeItem(MOTION_KEY);
    else window.localStorage.setItem(MOTION_KEY, pref);
  } catch {
    /* storage blocked: the choice still applies to this page */
  }
  applyMotionPref(pref);
  window.dispatchEvent(new Event(MOTION_EVENT));
}

// Applied as soon as this loads, so every app that uses it starts right.
if (typeof document !== "undefined") applyMotionPref();
