// POST /api/payments/webhook: Stripe's webhook endpoint (DEC-0045), test mode only.
// Answers 404 while PAYMENTS_ENABLED is not "on", which is every environment today. The
// signing secret and the service role key come from the Pages environment and are never
// committed. The logic and its tests are in src/lib/payments/webhook.ts.
import { DEFAULT_SUPABASE_URL, isWebhookSecret, json, notFound, serverFlag, type PaymentsEnv } from "../../../src/lib/payments/guard";
import { supabaseStore } from "../../../src/lib/payments/store";
import { handleStripeWebhook } from "../../../src/lib/payments/webhook";

interface Context { request: Request; env: PaymentsEnv }

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  if (!serverFlag(env)) return notFound();
  if (request.method !== "POST") return json(405, { error: "POST only" });
  if (!isWebhookSecret(env.STRIPE_WEBHOOK_SECRET) || !env.SUPABASE_SERVICE_ROLE_KEY) return json(503, { error: "payments are not configured" });
  const raw = await request.text();
  if (raw.length > 512 * 1024) return json(413, { error: "too large" });
  const store = supabaseStore(env.SUPABASE_URL || DEFAULT_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const r = await handleStripeWebhook(raw, request.headers.get("Stripe-Signature"), { secret: env.STRIPE_WEBHOOK_SECRET, store });
  if (r.status >= 400) console.warn("stripe webhook refused", r.status, r.body.error);
  return json(r.status, r.body);
};
