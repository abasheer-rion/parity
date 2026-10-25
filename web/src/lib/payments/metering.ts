// Usage metering for the API plans (DEC-0045, DEC-0032 section 2). Each scored record an
// API customer asks for becomes one Stripe meter event; Stripe adds them up and bills the
// records over the plan's included amount. Nothing calls Stripe from here: this builds
// the event and works out the overage so the API can show it. The API itself is not
// built yet, so nothing sends these events today.
import { PLANS, type PaidPlan } from "./plans";

/** The meter's event name, set up in Stripe when the API plans are created. */
export const METER_EVENT = "parity_scored_record";

export interface MeterEvent {
  event_name: string;
  /** Stripe dedupes on this, so a retried request is counted once. */
  identifier: string;
  /** Unix seconds. */
  timestamp: number;
  payload: { stripe_customer_id: string; value: string };
}

export function meterEvent(stripeCustomerId: string, requestId: string, at: Date, records = 1): MeterEvent {
  if (!/^cus_[A-Za-z0-9_]+$/.test(stripeCustomerId)) throw new Error("not a Stripe customer id");
  if (!requestId || requestId.length > 100) throw new Error("a request id of 1 to 100 characters is needed");
  if (!Number.isInteger(records) || records < 1) throw new Error("records must be a whole number above 0");
  return { event_name: METER_EVENT, identifier: requestId, timestamp: Math.floor(at.getTime() / 1000), payload: { stripe_customer_id: stripeCustomerId, value: String(records) } };
}

/** Per-record prices after the included amount, from DEC-0032. */
export const OVERAGE_USD: Partial<Record<PaidPlan, number>> = { api_starter: 0.25, platform: 0.1 };

/** Records over the plan's monthly amount, and what they would cost. */
export function overage(plan: PaidPlan, usedThisMonth: number): { over: number; usd: number } {
  const included = PLANS[plan].monthlyQuota;
  const per = OVERAGE_USD[plan];
  if (included === null || per === undefined) return { over: 0, usd: 0 };
  const over = Math.max(0, usedThisMonth - included);
  return { over, usd: Math.round(over * per * 100) / 100 };
}
