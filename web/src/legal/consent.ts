// Cookie and storage consent, the one place that decides what may run.
//
// Essential: the sign-in cookie and a few settings kept in this browser (see /legal/cookies/).
// Analytics: Parity's own product analytics (DEC-0053, src/lib/analytics/), off until the
// person switches it on, and never on in a browser that sends Do Not Track or Global Privacy
// Control. There is no advertising and no third-party tracking.
//
//   import { whenAllowed } from "../legal/consent";
//   whenAllowed("analytics", () => loadAnalytics());   // runs only after an opt-in
//
// Adding a category or a tool means three changes together: the code here, the cookie
// policy, and a new VERSION so everyone is asked again.

export type Category = "essential" | "analytics";

export interface Consent {
  /** Which notice the person answered. A higher VERSION asks everyone again. */
  version: number;
  essential: true;
  analytics: boolean;
  /** When they chose, as an ISO date. */
  decidedAt: string;
}

/**
 * Bump when the categories or the tools in them change, so people are asked again.
 * 2: Parity's own analytics became available (DEC-0053).
 */
export const VERSION = 2;

/** Parity's own analytics exists (DEC-0053). Set false to switch it off for everyone. */
export const ANALYTICS_AVAILABLE = true;

/**
 * True when the browser asks sites not to track it: Do Not Track or Global Privacy Control.
 * Analytics then stays off whatever is stored, and the preferences dialog says why.
 */
export function privacySignal(): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
    const win = (typeof window !== "undefined" ? window : {}) as { doNotTrack?: string };
    return nav.globalPrivacyControl === true || nav.doNotTrack === "1" || nav.doNotTrack === "yes" || win.doNotTrack === "1" || nav.msDoNotTrack === "1";
  } catch {
    return false;
  }
}

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
  if (category === "analytics") return ANALYTICS_AVAILABLE && !privacySignal() && getConsent()?.analytics === true;
  return false;
}

/** Records a choice. Analytics stays off when it is unavailable or the browser asks not to be tracked. */
export function setConsent(choice: { analytics?: boolean } = {}): Consent {
  const consent: Consent = {
    version: VERSION,
    essential: true,
    analytics: ANALYTICS_AVAILABLE && !privacySignal() && choice.analytics === true,
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
