// Sign-in settings for the browser. Every value here is public.
// See auth/README.md (how sign-in works) and auth/PROVIDERS.md (Google, GitHub, passkeys).

/** Supabase project URL. */
export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://ttqvpxvctnomfbeoqbbs.supabase.co";

/**
 * The project's publishable key. It is meant to be in the browser: it only identifies
 * the project, and row level security decides what anyone can read.
 */
export const SUPABASE_PUBLISHABLE_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "sb_publishable_12CQmnbBgVYpkflKhwHD-A_2Xby8b-x";

/** Public pages. Every email link lands on /verify/. */
export const ROUTES = {
  home: "/",
  app: "/app/",
  login: "/login/",
  signup: "/signup/",
  reset: "/reset/",
  verify: "/verify/",
} as const;

/** Must match minimum_password_length in supabase/config.toml and push_templates.sh. */
export const PASSWORD_MIN = 10;

export type ProviderId = "google" | "github" | "apple" | "azure";

/**
 * Sign-in providers the buttons can show. A button appears only when its id is listed
 * in VITE_AUTH_PROVIDERS (comma separated, e.g. "google,github"), which the deploy
 * reads from the GitHub variable AUTH_PROVIDERS. Turn a provider on in Supabase first
 * (auth/PROVIDERS.md), then list it here.
 */
export const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "apple", label: "Apple" },
  { id: "azure", label: "Microsoft" },
];

const listed = ((import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const ENABLED_PROVIDERS = PROVIDERS.filter((p) => listed.includes(p.id));

/** Passkeys (Face ID, Touch ID, Windows Hello). Experimental in Supabase; off unless "on". */
export const PASSKEYS_ENABLED = import.meta.env.VITE_AUTH_PASSKEYS === "on";

/** Where to go after signing in: the ?next= path if it points into the app, else /app/. */
export function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return next.startsWith("/app/") && !next.startsWith("//") ? next : ROUTES.app;
}
