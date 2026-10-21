// The one Supabase client. Only imported from code that loads when AUTH_ENABLED is on.
import { createClient, type AuthError, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export const supabase: SupabaseClient | null = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Emails carry a token hash that the verify page exchanges itself, so the
        // client must not try to read tokens from the URL (the router uses the hash).
        detectSessionInUrl: false,
        flowType: "implicit",
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "parity.auth",
      },
    })
  : null;

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error("Sign-in is switched on but VITE_SUPABASE_ANON_KEY is not set.");
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
    case "email_exists": return "An account with that email already exists. Sign in instead.";
    case "weak_password": return "Pick a longer password with letters and numbers.";
    case "same_password": return "The new password must be different from the old one.";
    case "reauthentication_not_valid": return "That confirmation code is wrong or has expired.";
    case "signup_disabled": return "New sign-ups are closed.";
    case "otp_disabled": return "Sign-in by code is only for existing accounts.";
  }
  return error.message || "Something went wrong. Try again.";
}
