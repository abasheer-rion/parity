// React hooks for the Motion setting (REF-0023). The setting itself (storage, the
// <html data-motion> attribute, resolving it against the device) is in motionCore.ts.
import { useSyncExternalStore } from "react";
import { applyMotionPref, currentMotionPref, MOTION_EVENT, MOTION_KEY, motionLevel, readMotionPref, REDUCE_QUERY, type MotionLevel, type MotionPref } from "./motionCore";

export * from "./motionCore";

function subscribe(on: () => void) {
  const mq = typeof window.matchMedia === "function" ? window.matchMedia(REDUCE_QUERY) : null;
  // Another tab changed it: apply it here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== MOTION_KEY && e.key !== null) return;
    applyMotionPref(readMotionPref());
    on();
  };
  mq?.addEventListener?.("change", on);
  window.addEventListener(MOTION_EVENT, on);
  window.addEventListener("storage", onStorage);
  return () => {
    mq?.removeEventListener?.("change", on);
    window.removeEventListener(MOTION_EVENT, on);
    window.removeEventListener("storage", onStorage);
  };
}

/** The choice in force, live. */
export function useMotionPref(): MotionPref {
  return useSyncExternalStore(subscribe, currentMotionPref, () => "system");
}

/** What plays now ("full" or "reduced"), live: follows the setting and the device. */
export function useMotionLevel(): MotionLevel {
  return useSyncExternalStore(subscribe, motionLevel, () => "full");
}
