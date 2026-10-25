// The sign-in panel's forms and their addresses (DEC-0042). No browser globals at import
// time, so the tests can run it directly.
import { ROUTES } from "./config";
import { withNext } from "./redirect";

export type View = "login" | "signup" | "reset" | "verify";

/** State a form hands to the next one: the address to confirm, an invite, a second step. */
export interface Carry {
  /** Sign up: show "check your email" for this address. */
  check?: string | null;
  /** Reset: the person came from an invite, so they choose their first password. */
  invite?: boolean;
  /** Log in: ask for the authenticator code. */
  mfa?: boolean;
}

export const TITLES: Record<View, string> = {
  login: "Log in · Parity",
  signup: "Sign up · Parity",
  reset: "Reset password · Parity",
  verify: "Confirm · Parity",
};

/** Which form a sign-in page's path shows. */
export function viewFromPath(pathname: string): View {
  const path = pathname.replace(/\/?$/, "/");
  if (path === ROUTES.signup) return "signup";
  if (path === ROUTES.reset) return "reset";
  if (path === ROUTES.verify) return "verify";
  return "login";
}

/** What a sign-in page's query string carries into its form. */
export function carryFromQuery(search: string): Carry {
  const q = new URLSearchParams(search);
  return { check: q.get("check"), invite: q.get("from") === "invite", mfa: q.get("mfa") === "1" };
}

/** The stand-alone address of a form, keeping where the person is going afterwards. */
export function authUrl(view: View, next: string, carry: Carry = {}): string {
  switch (view) {
    case "login": return withNext(carry.mfa ? `${ROUTES.login}?mfa=1` : ROUTES.login, next);
    case "signup": return withNext(carry.check ? `${ROUTES.signup}?check=${encodeURIComponent(carry.check)}` : ROUTES.signup, next);
    case "reset": return withNext(carry.invite ? `${ROUTES.reset}?from=invite` : ROUTES.reset, next);
    case "verify": return ROUTES.verify;
  }
}
