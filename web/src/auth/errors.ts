// Plain-words messages for the sign-in errors people actually hit. Kept apart from the
// Supabase client so the tests can use it without one.
import type { AuthError } from "@supabase/supabase-js";

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
    case "mfa_challenge_expired": return "That took too long. Type a fresh code from your authenticator app.";
    case "insufficient_aal": return "Type the code from your authenticator app first.";
    case "reauthentication_needed":
    case "reauth_nonce_missing": return "For safety, confirm with the code we email you.";
    case "email_address_invalid": return "That email address cannot receive mail. Check it and try again.";
    case "email_address_not_authorized": return "We cannot send email to that address yet. Try another address, or ask the owner.";
    case "user_banned": return "This account is blocked. Contact us if you think this is a mistake.";
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
    case "refresh_token_already_used": return "Your session ended. Log in again.";
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier": return "That sign-in link was opened in a different browser or has expired. Start again here.";
    case "validation_failed": return "Something in the form is not valid. Check it and try again.";
    case "request_timeout": return "The sign-in service took too long. Try again.";
  }
  // Errors without a code are usually a dropped connection.
  if (error.name === "AuthRetryableFetchError" || /failed to fetch|network/i.test(error.message)) {
    return "We could not reach the sign-in service. Check your connection and try again.";
  }
  return error.message || "Something went wrong. Try again.";
}
