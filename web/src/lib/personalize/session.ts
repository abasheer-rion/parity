// Per-session state for personalization, kept in ONE sessionStorage item, `parity.p.session`,
// the one the cookie policy lists: whether this session's home page use was already counted,
// and the experiment variants already fetched. Nothing goes to localStorage. Cleared when the
// tab closes. Storage blocked: a page-memory copy is used instead.
export const SESSION_KEY = "parity.p.session";

export interface SessionState {
  /** widget_seen already sent this session. */
  counted?: boolean;
  /** Experiment key to variant, as experiment_assign returned it. */
  variants?: Record<string, { variant: string; exposed: boolean }>;
}

let memory: SessionState = {};

export function readSession(): SessionState {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const v = JSON.parse(raw) as SessionState;
      if (v && typeof v === "object") return v;
    }
  } catch { /* blocked or damaged: fall back to memory */ }
  return memory;
}

export function writeSession(patch: Partial<SessionState>): void {
  const next = { ...readSession(), ...patch };
  memory = next;
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* memory copy is enough */ }
}

/** Forgets this session's state (after a reset or switching personalization off). */
export function clearSession(): void {
  memory = {};
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch { /* nothing stored */ }
}
