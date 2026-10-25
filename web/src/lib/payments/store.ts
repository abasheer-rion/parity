// Where the webhook writes (DEC-0045). The handler talks to this interface, so the tests
// use an in-memory copy and production uses Supabase's REST API with the service role key
// (the only role allowed to write these tables, see
// supabase/migrations/20261029000000_payments_scaffold.sql).
import type { EntitlementRow, PaidPlan, SubscriptionStatus } from "./plans";

export interface StoredSubscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  plan: PaidPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export type Claim = "new" | "retry" | "done";

export interface PaymentsStore {
  /** Records an event by its Stripe id. "new" the first time, "retry" if an earlier
   *  attempt was recorded but not finished, "done" if it was already handled. */
  claimEvent(e: { stripe_event_id: string; type: string; object_id: string | null }): Promise<Claim>;
  finishEvent(stripeEventId: string, result: { user_id: string | null; error: string | null }): Promise<void>;
  upsertCustomer(userId: string, stripeCustomerId: string): Promise<void>;
  userForCustomer(stripeCustomerId: string): Promise<string | null>;
  upsertSubscription(s: Omit<StoredSubscription, "id">): Promise<StoredSubscription>;
  subscriptionsFor(userId: string): Promise<StoredSubscription[]>;
  /** Replaces the subscription-derived entitlements for one person. */
  replaceEntitlements(userId: string, rows: EntitlementRow[]): Promise<void>;
}

// ---------------------------------------------------------------- Supabase REST

type Fetch = typeof fetch;

export function supabaseStore(url: string, serviceKey: string, fetcher: Fetch = fetch): PaymentsStore {
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  // New-style secret keys (sb_secret_) go in the apikey header only; legacy service role
  // JWTs also go in Authorization.
  const auth: Record<string, string> = { apikey: serviceKey, ...(serviceKey.startsWith("eyJ") ? { Authorization: `Bearer ${serviceKey}` } : {}) };

  async function call<T>(method: string, path: string, body?: unknown, prefer?: string): Promise<T> {
    const res = await fetcher(`${base}/${path}`, {
      method,
      headers: { ...auth, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed with ${res.status}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  const eq = (v: string) => `eq.${encodeURIComponent(v)}`;

  return {
    async claimEvent(e) {
      const made = await call<unknown[]>("POST", "payment_events?on_conflict=stripe_event_id", { ...e, livemode: false }, "resolution=ignore-duplicates,return=representation");
      if (made.length) return "new";
      const [row] = await call<{ processed_at: string | null; error: string | null }[]>("GET", `payment_events?stripe_event_id=${eq(e.stripe_event_id)}&select=processed_at,error`);
      return row && row.processed_at && !row.error ? "done" : "retry";
    },
    async finishEvent(id, r) {
      await call("PATCH", `payment_events?stripe_event_id=${eq(id)}`, { processed_at: new Date().toISOString(), user_id: r.user_id, error: r.error?.slice(0, 500) ?? null }, "return=minimal");
    },
    async upsertCustomer(userId, customer) {
      await call("POST", "payment_customers?on_conflict=user_id", { user_id: userId, stripe_customer_id: customer, livemode: false, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
    },
    async userForCustomer(customer) {
      const [row] = await call<{ user_id: string }[]>("GET", `payment_customers?stripe_customer_id=${eq(customer)}&select=user_id`);
      return row?.user_id ?? null;
    },
    async upsertSubscription(s) {
      const [row] = await call<StoredSubscription[]>("POST", "payment_subscriptions?on_conflict=stripe_subscription_id", { ...s, livemode: false, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=representation");
      return row;
    },
    async subscriptionsFor(userId) {
      return call<StoredSubscription[]>("GET", `payment_subscriptions?user_id=${eq(userId)}&select=id,user_id,stripe_subscription_id,stripe_customer_id,plan,status,current_period_end,cancel_at_period_end`);
    },
    async replaceEntitlements(userId, rows) {
      await call("DELETE", `payment_entitlements?user_id=${eq(userId)}&subscription_id=not.is.null`, undefined, "return=minimal");
      if (rows.length) await call("POST", "payment_entitlements", rows.map((r) => ({ user_id: userId, ...r })), "return=minimal");
    },
  };
}

// ---------------------------------------------------------------- in memory (tests)

export function memoryStore(): PaymentsStore & {
  events: Map<string, { type: string; object_id: string | null; processed_at: string | null; user_id: string | null; error: string | null }>;
  customers: Map<string, string>;
  subs: StoredSubscription[];
  entitlements: Map<string, EntitlementRow[]>;
} {
  const events = new Map<string, { type: string; object_id: string | null; processed_at: string | null; user_id: string | null; error: string | null }>();
  const customers = new Map<string, string>(); // user_id -> cus_
  const subs: StoredSubscription[] = [];
  const entitlements = new Map<string, EntitlementRow[]>();
  let n = 0;
  return {
    events, customers, subs, entitlements,
    async claimEvent(e) {
      const have = events.get(e.stripe_event_id);
      if (!have) {
        events.set(e.stripe_event_id, { type: e.type, object_id: e.object_id, processed_at: null, user_id: null, error: null });
        return "new";
      }
      return have.processed_at && !have.error ? "done" : "retry";
    },
    async finishEvent(id, r) {
      const have = events.get(id);
      if (have) Object.assign(have, { processed_at: new Date().toISOString(), user_id: r.user_id, error: r.error });
    },
    async upsertCustomer(userId, customer) { customers.set(userId, customer); },
    async userForCustomer(customer) {
      for (const [u, c] of customers) if (c === customer) return u;
      return null;
    },
    async upsertSubscription(s) {
      const i = subs.findIndex((x) => x.stripe_subscription_id === s.stripe_subscription_id);
      const row = { ...s, id: i >= 0 ? subs[i].id : `sub-row-${++n}` };
      if (i >= 0) subs[i] = row;
      else subs.push(row);
      return row;
    },
    async subscriptionsFor(userId) { return subs.filter((s) => s.user_id === userId); },
    async replaceEntitlements(userId, rows) { entitlements.set(userId, rows); },
  };
}
