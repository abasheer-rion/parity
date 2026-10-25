// The Stripe webhook's logic (DEC-0046), kept apart from the Pages Function so it can be
// tested without a network. In order:
//   1. check the signature on the raw body, refuse anything unsigned or stale (400);
//   2. refuse live-mode events (400): this scaffold is test mode only;
//   3. record the event by its id; a redelivery of a handled event does nothing (200);
//   4. update the customer, the subscription and the person's entitlements;
//   5. mark the event handled, or record the error and answer 500 so Stripe retries.
import { entitlementsFor, planForLookupKey, type SubscriptionStatus } from "./plans";
import type { PaymentsStore } from "./store";
import { verifyStripeSignature } from "./stripeSignature";

export interface WebhookResult { status: number; body: { received?: boolean; duplicate?: boolean; ignored?: string; error?: string } }

/** The event types we act on. Others are recorded and acknowledged. */
export const HANDLED = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"] as const;

interface StripeEvent { id: string; type: string; livemode: boolean; data: { object: Record<string, unknown> } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: SubscriptionStatus[] = ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"];

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const idOf = (v: unknown): string | null => str(v) ?? (v && typeof v === "object" ? str((v as { id?: unknown }).id) : null);
const iso = (unix: unknown): string | null => (typeof unix === "number" && Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : null);

function parseEvent(raw: string): StripeEvent | null {
  try {
    const e = JSON.parse(raw) as Partial<StripeEvent>;
    if (typeof e.id !== "string" || !e.id.startsWith("evt_") || typeof e.type !== "string" || typeof e.livemode !== "boolean") return null;
    if (!e.data || typeof e.data.object !== "object" || e.data.object === null) return null;
    return e as StripeEvent;
  } catch {
    return null;
  }
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  deps: { secret: string; store: PaymentsStore; nowS?: number },
): Promise<WebhookResult> {
  const sig = await verifyStripeSignature(rawBody, signature, deps.secret, deps.nowS);
  if (!sig.ok) return { status: 400, body: { error: `signature: ${sig.reason}` } };
  const event = parseEvent(rawBody);
  if (!event) return { status: 400, body: { error: "not a Stripe event" } };
  if (event.livemode) return { status: 400, body: { error: "live mode events are refused: payments are test mode only" } };

  const object = event.data.object;
  const claim = await deps.store.claimEvent({ stripe_event_id: event.id, type: event.type, object_id: idOf(object) });
  if (claim === "done") return { status: 200, body: { received: true, duplicate: true } };

  let userId: string | null = null;
  try {
    if (event.type === "checkout.session.completed") userId = await onCheckoutCompleted(object, deps.store);
    else if (event.type.startsWith("customer.subscription.")) userId = await onSubscription(object, deps.store);
    else {
      await deps.store.finishEvent(event.id, { user_id: null, error: null });
      return { status: 200, body: { received: true, ignored: event.type } };
    }
    await deps.store.finishEvent(event.id, { user_id: userId, error: null });
    return { status: 200, body: { received: true } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await deps.store.finishEvent(event.id, { user_id: userId, error: message });
    return { status: 500, body: { error: "could not process event" } };
  }
}

/** Checkout tells us which person (client_reference_id, set by our checkout endpoint) owns
 *  which Stripe customer. */
async function onCheckoutCompleted(session: Record<string, unknown>, store: PaymentsStore): Promise<string | null> {
  const userId = str(session.client_reference_id);
  const customer = idOf(session.customer);
  if (!userId || !UUID.test(userId)) throw new Error("checkout session has no valid client_reference_id");
  if (!customer) throw new Error("checkout session has no customer");
  await store.upsertCustomer(userId, customer);
  return userId;
}

async function onSubscription(sub: Record<string, unknown>, store: PaymentsStore): Promise<string | null> {
  const subId = str(sub.id);
  const customer = idOf(sub.customer);
  if (!subId || !customer) throw new Error("subscription without id or customer");
  const metaUser = str((sub.metadata as Record<string, unknown> | undefined)?.user_id);
  const userId = (metaUser && UUID.test(metaUser) ? metaUser : null) ?? (await store.userForCustomer(customer));
  if (!userId) throw new Error("subscription for a customer we do not know");
  if (metaUser && UUID.test(metaUser)) await store.upsertCustomer(userId, customer);

  const items = ((sub.items as { data?: Record<string, unknown>[] } | undefined)?.data ?? []);
  const first = items[0] ?? {};
  const price = (first.price ?? {}) as Record<string, unknown>;
  const plan = planForLookupKey(str(price.lookup_key)) ?? planForLookupKey(str((sub.metadata as Record<string, unknown> | undefined)?.plan));
  if (!plan) throw new Error("subscription price has no known lookup key");
  const status = str(sub.status) as SubscriptionStatus | null;
  if (!status || !STATUSES.includes(status)) throw new Error("unknown subscription status");
  // Newer API versions moved the period end onto each item.
  const periodEnd = iso(sub.current_period_end) ?? iso(first.current_period_end);

  await store.upsertSubscription({
    user_id: userId, stripe_subscription_id: subId, stripe_customer_id: customer, plan,
    status, current_period_end: periodEnd, cancel_at_period_end: sub.cancel_at_period_end === true,
  });
  const all = await store.subscriptionsFor(userId);
  await store.replaceEntitlements(userId, entitlementsFor(all));
  return userId;
}
