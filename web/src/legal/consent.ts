// Cookie and storage consent, the one place that decides what may run.
//
// Today Parity uses only what it needs to work: the sign-in cookie, and a few settings
// kept in this browser (see /legal/cookies/). There is no analytics, advertising or
// tracking. This API exists so that adding any later is safe by default:
//
//   import { whenAllowed } from "../legal/consent";
//   whenAllowed("analytics", () => loadAnalytics());   // runs only after an opt-in
//
// Before analytics can run, three things must change together: set ANALYTICS_AVAILABLE to
// true, name the tool in the cookie policy, and ask again (bump VERSION so everyone sees
// the notice). Until then, allowed("analytics") is always false, whatever is stored.

export type Category = "essential" | "analytics";

export interface Consent {
  /** Which notice the person answered. A higher VERSION asks everyone again. */
  version: number;
  essential: true;
  analytics: boolean;
  /** When they chose, as an ISO date. */
  decidedAt: string;
}

/** Bump when the categories or the tools in them change, so people are asked again. */
export const VERSION = 1;

/** No analytics tool exists yet, so it cannot be switched on. */
export const ANALYTICS_AVAILABLE = false;

export const STORAGE_KEY = "parity.consent.v1";

const listeners = new Set<(c: Consent | null) => void>();
let memory: Consent | null = null;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The stored choice, or null when the person has not chosen (or chose on an older notice). */
export function getConsent(): Consent | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Consent>;
      if (parsed && parsed.version === VERSION && typeof parsed.decidedAt === "string") {
        return { version: VERSION, essential: true, analytics: parsed.analytics === true, decidedAt: parsed.decidedAt };
      }
      return null;
    }
  } catch {
    // Storage blocked or the value is damaged: fall back to this page's memory.
  }
  return memory;
}

/** True once the person has answered the current notice. */
export function hasDecided(): boolean {
  return getConsent() !== null;
}

/** Whether a category may run now. Essential always may; nothing else does without opt-in. */
export function allowed(category: Category): boolean {
  if (category === "essential") return true;
  if (category === "analytics") return ANALYTICS_AVAILABLE && getConsent()?.analytics === true;
  return false;
}

/** Records a choice. Analytics stays off while no analytics tool exists. */
export function setConsent(choice: { analytics?: boolean } = {}): Consent {
  const consent: Consent = {
    version: VERSION,
    essential: true,
    analytics: ANALYTICS_AVAILABLE && choice.analytics === true,
    decidedAt: new Date().toISOString(),
  };
  memory = consent;
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch { /* storage blocked: keep it for this page */ }
  listeners.forEach((fn) => fn(consent));
  return consent;
}

/** Forgets the choice, so the notice shows again. */
export function resetConsent(): void {
  memory = null;
  try { storage()?.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn(null));
}

/** Calls `fn` whenever the choice changes. Returns a function that stops listening. */
export function onConsentChange(fn: (c: Consent | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Runs `fn` once the category is allowed: now, or after the person opts in. Use this to
 * load anything that is not essential. Returns a function that cancels the wait.
 */
export function whenAllowed(category: Category, fn: () => void): () => void {
  if (allowed(category)) { fn(); return () => {}; }
  const stop = onConsentChange(() => {
    if (allowed(category)) { stop(); fn(); }
  });
  return stop;
}
