// Starting a Stripe Checkout session for a self-serve plan (DEC-0045), test mode only.
// The browser never sees a Stripe secret: it asks /api/payments/checkout, which checks the
// person's sign-in, finds the price by its lookup key and asks Stripe for a session. The
// session carries the person's id as client_reference_id and in the subscription's
// metadata, which is how the webhook knows whose subscription it is.
import { isTestSecretKey } from "./guard";
import { SELF_SERVE_KEYS } from "./plans";

type Fetch = typeof fetch;
const STRIPE = "https://api.stripe.com/v1";

export class CheckoutError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Form-encodes nested params the way Stripe's API expects (a[b][0][c]=...). */
export function formEncode(params: Record<string, unknown>, prefix = ""): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") {
      const inner = Array.isArray(v) ? Object.fromEntries(v.map((x, i) => [String(i), x])) : (v as Record<string, unknown>);
      const s = formEncode(inner, key);
      if (s) out.push(s);
    } else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

export interface CheckoutInput { lookupKey: string; userId: string; email: string | null; origin: string }

export function sessionParams(input: CheckoutInput, price: { id: string; metered: boolean }): Record<string, unknown> {
  const back = `${input.origin}/app/#/pricing`;
  return {
    mode: "subscription",
    line_items: [price.metered ? { price: price.id } : { price: price.id, quantity: 1 }],
    client_reference_id: input.userId,
    customer_email: input.email ?? undefined,
    subscription_data: { metadata: { user_id: input.userId } },
    metadata: { user_id: input.userId, lookup_key: input.lookupKey },
    success_url: `${back}?checkout=done`,
    cancel_url: `${back}?checkout=cancelled`,
    allow_promotion_codes: false,
  };
}

async function stripe<T>(fetcher: Fetch, key: string, method: "GET" | "POST", path: string, body?: string): Promise<T> {
  const res = await fetcher(`${STRIPE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body,
  });
  if (!res.ok) throw new CheckoutError(`Stripe answered ${res.status}`, 502);
  return (await res.json()) as T;
}

/** Creates a test-mode Checkout session and returns its URL. Refuses a live key, an
 *  unknown plan, or a session Stripe reports as live. */
export async function createCheckoutSession(secretKey: string | undefined, input: CheckoutInput, fetcher: Fetch = fetch): Promise<string> {
  if (!isTestSecretKey(secretKey)) throw new CheckoutError("Payments accept a Stripe test key only", 503);
  if (!SELF_SERVE_KEYS.includes(input.lookupKey)) throw new CheckoutError("Unknown plan", 400);
  const prices = await stripe<{ data: { id: string; livemode: boolean; recurring?: { usage_type?: string } | null }[] }>(
    fetcher, secretKey, "GET", `/prices?active=true&lookup_keys[]=${encodeURIComponent(input.lookupKey)}`,
  );
  const price = prices.data[0];
  if (!price) throw new CheckoutError("That plan has no price in Stripe yet", 503);
  if (price.livemode) throw new CheckoutError("Live prices are refused", 503);
  const session = await stripe<{ url?: string; livemode: boolean }>(
    fetcher, secretKey, "POST", "/checkout/sessions", formEncode(sessionParams(input, { id: price.id, metered: price.recurring?.usage_type === "metered" })),
  );
  if (session.livemode) throw new CheckoutError("Live sessions are refused", 503);
  if (!session.url) throw new CheckoutError("Stripe returned no checkout address", 502);
  return session.url;
}
