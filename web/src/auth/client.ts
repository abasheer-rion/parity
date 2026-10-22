// The one Supabase client for the browser. It keeps the session in a cookie (not only
// in local storage) so the site's middleware (web/functions/_middleware.ts) can check
// it before serving /app/ and /data/.
import { createBrowserClient } from "@supabase/ssr";
import type { AuthError } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  cookieOptions: {
    path: "/",
    // On endyland.com the session is shared by parity.endyland.com and sim.endyland.com,
    // so opening Sim World in its own tab needs no second sign-in. Elsewhere (pages.dev,
    // localhost) the cookie stays on the one host.
    ...(window.location.hostname.endsWith(".endyland.com") ? { domain: ".endyland.com" } : {}),
    sameSite: "lax",
    secure: window.location.protocol === "https:",
    maxAge: 60 * 60 * 24 * 30,
  },
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

/** Kept for the pages written before the client was always present. */
export function requireClient() {
  return supabase;
}

/** Plain-words messages for the errors people actually hit. */
export function explain(error: AuthError | Error | null | undefined): string | null {
  if (!error) return null;
  const code = "code" in error ? (error.code as string | undefined) : undefined;
  switch (code) {
    case "invalid_credentials": return "That email and password do not match.";
    case "email_not_confirmed": return "Confirm your email first. We sent you a link and a code.";
    case "otp_expired": return "That code or link has expired or was already used. Ask for a new one.";
    case "over_email_send_rate_limit": return "Too many emails were sent. Wait a minute and try again.";
    case "over_request_rate_limit": return "Too many tries. Wait a few minutes and try again.";
    case "user_already_exists":
    case "email_exists": return "An account with that email already exists. Log in instead.";
    case "weak_password": return "Pick a longer password with letters and numbers.";
    case "same_password": return "The new password must be different from the old one.";
    case "reauthentication_not_valid": return "That confirmation code is wrong or has expired.";
    case "signup_disabled": return "New sign-ups are closed.";
    case "otp_disabled": return "Sign-in by code is only for existing accounts.";
    case "mfa_verification_failed": return "That code is wrong. Check your authenticator app and try again.";
    case "provider_disabled": return "That sign-in option is not switched on yet.";
  }
  return error.message || "Something went wrong. Try again.";
}
