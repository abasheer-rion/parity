// POST /api/payments/checkout {"lookupKey": "pro_monthly"}: starts a Stripe Checkout session
// for the signed-in person (DEC-0045), test mode only. Answers 404 while PAYMENTS_ENABLED
// is not "on". Refuses any Stripe key that is not a test key. The secret key comes from the
// Pages environment and is never committed or sent to the browser.
import { callerFrom } from "../../../src/lib/payments/auth";
import { CheckoutError, createCheckoutSession } from "../../../src/lib/payments/checkout";
import { DEFAULT_SUPABASE_URL, json, notFound, serverFlag, type PaymentsEnv } from "../../../src/lib/payments/guard";

interface Context { request: Request; env: PaymentsEnv }

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  if (!serverFlag(env)) return notFound();
  if (request.method !== "POST") return json(405, { error: "POST only" });
  const caller = await callerFrom(request, env.SUPABASE_URL || DEFAULT_SUPABASE_URL);
  if (!caller) return json(401, { error: "Sign in first" });
  let lookupKey = "";
  try {
    const body = (await request.json()) as { lookupKey?: unknown };
    lookupKey = typeof body.lookupKey === "string" ? body.lookupKey : "";
  } catch {
    return json(400, { error: "Send JSON with a lookupKey" });
  }
  try {
    const url = await createCheckoutSession(env.STRIPE_SECRET_KEY, { lookupKey, userId: caller.userId, email: caller.email, origin: new URL(request.url).origin });
    return json(200, { url });
  } catch (e) {
    if (e instanceof CheckoutError) return json(e.status, { error: e.message });
    console.error("checkout failed", String(e));
    return json(500, { error: "Checkout failed" });
  }
};
