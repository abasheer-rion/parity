// In-app sign-in is off unless the site is built with VITE_APP_AUTH=on. While it is off
// the site relies on the Cloudflare login only, and none of this module is downloaded.
// See auth/README.md at the repo root.
export const AUTH_ENABLED = import.meta.env.VITE_APP_AUTH === "on";

/** Supabase project URL. Not a secret; the default is the Parity project. */
export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://ttqvpxvctnomfbeoqbbs.supabase.co";

/** The public (anon or publishable) key. Safe in the browser; RLS does the checking. */
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Where the email links land. Every email links to #/auth/verify on this origin. */
export const ROUTES = {
  signIn: "#/auth/sign-in",
  signUp: "#/auth/sign-up",
  forgot: "#/auth/forgot",
  reset: "#/auth/reset",
  verify: "#/auth/verify",
} as const;

/** Must match minimum_password_length in supabase/config.toml and push_templates.sh. */
export const PASSWORD_MIN = 10;
