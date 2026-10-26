// Server-side guards for the payments endpoints (DEC-0046). Imported by Pages Functions,
// so nothing here may read import.meta.env.

export interface PaymentsEnv {
  /** Only the exact string "on" enables the endpoints. Unset in every environment today. */
  PAYMENTS_ENABLED?: string;
  /** Stripe test secret key (sk_test_ or rk_test_). Set as a Pages secret, never committed. */
  STRIPE_SECRET_KEY?: string;
  /** The webhook endpoint's signing secret (whsec_). Set as a Pages secret, never committed. */
  STRIPE_WEBHOOK_SECRET?: string;
  /** Supabase service role key, used only by the webhook to write payment rows. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
}

export const DEFAULT_SUPABASE_URL = "https://ttqvpxvctnomfbeoqbbs.supabase.co";

export function serverFlag(env: PaymentsEnv): boolean {
  return env.PAYMENTS_ENABLED === "on";
}

/** Test-mode keys only. A live secret or restricted key is refused, so a live key pasted
 *  into the environment by mistake cannot create a real charge. */
export function isTestSecretKey(key: string | undefined): key is string {
  return typeof key === "string" && /^(sk|rk)_test_[A-Za-z0-9]+$/.test(key);
}

export function isWebhookSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && /^whsec_[A-Za-z0-9+/=]+$/.test(secret);
}

export const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** What every payments endpoint answers while the flag is off: as if it did not exist. */
export const notFound = (): Response => json(404, { error: "Not found" });
