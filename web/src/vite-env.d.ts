// Build-time settings read by the app. All are public; none is a secret.
interface ImportMetaEnv {
  /** "on" switches in-app sign-in on (auth/README.md). Anything else leaves it off. */
  readonly VITE_APP_AUTH?: string;
  /** Supabase project URL. Defaults to the Parity project. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase public (anon or publishable) key. Needed only when VITE_APP_AUTH is on. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
