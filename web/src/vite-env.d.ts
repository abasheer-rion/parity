// Build-time settings read by the app. All are public; none is a secret.
interface ImportMetaEnv {
  /** Supabase project URL. Defaults to the Parity project. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key. Defaults to the Parity project's key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Sign-in providers to show, comma separated: google,github,apple,azure. */
  readonly VITE_AUTH_PROVIDERS?: string;
  /** "on" shows passkey sign-in (turn passkeys on in Supabase first). */
  readonly VITE_AUTH_PASSKEYS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
