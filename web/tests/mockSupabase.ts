// A fake Supabase client for the flow tests. Every auth call is a vi.fn() with a
// harmless default; each test overrides what it needs.
import { vi } from "vitest";

export type Listener = (event: string, session: unknown) => void;

export function makeSupabase() {
  const listeners = new Set<Listener>();
  let current: unknown = null;
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });

  const auth = {
    getSession: vi.fn(() => ok({ session: current })),
    onAuthStateChange: vi.fn((fn: Listener) => {
      listeners.add(fn);
      return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } };
    }),
    signInWithPassword: vi.fn(() => ok({ session: null, user: null })),
    signInWithOtp: vi.fn(() => ok({})),
    signInWithOAuth: vi.fn(() => ok({})),
    signInWithPasskey: vi.fn(() => ok({})),
    signUp: vi.fn(() => ok({ session: null, user: { id: "u1" } })),
    verifyOtp: vi.fn(() => ok({ session: null, user: null })),
    resend: vi.fn(() => ok({})),
    resetPasswordForEmail: vi.fn(() => ok({})),
    updateUser: vi.fn(() => ok({ user: {} })),
    reauthenticate: vi.fn(() => ok({})),
    signOut: vi.fn(() => ok({})),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn(() => ok({ currentLevel: "aal1", nextLevel: "aal1" })),
      listFactors: vi.fn(() => ok({ all: [], totp: [] })),
      challengeAndVerify: vi.fn(() => ok({})),
      enroll: vi.fn(() => ok({ id: "f1", totp: { qr_code: "data:image/svg+xml,", secret: "SECRET" } })),
      unenroll: vi.fn(() => ok({})),
    },
  };

  return {
    auth,
    from: vi.fn(() => ({
      select: () => ({ limit: () => ok([]), eq: () => ({ maybeSingle: () => ok(null) }) }),
      insert: () => ok(null),
    })),
    /** Sets the session the client reports, and tells listeners, like a real sign-in. */
    setSession(session: unknown) {
      current = session;
      listeners.forEach((fn) => fn(session ? "SIGNED_IN" : "SIGNED_OUT", session));
    },
  };
}

export const fakeSession = (email = "amanda@example.com") => ({
  access_token: "t",
  refresh_token: "r",
  user: { id: "u1", email },
});

/** An auth error shaped like Supabase's. */
export const authError = (code: string, message = code) => Object.assign(new Error(message), { code, name: "AuthApiError", status: 400 });
