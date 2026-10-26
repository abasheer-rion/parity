// The Stripe webhook (DEC-0046): signature first, live mode refused, each event handled
// once, entitlements rebuilt from subscriptions. Uses the in-memory store; no network.
import { describe, expect, it, vi } from "vitest";
import { onRequest as webhookFn } from "../../functions/api/payments/webhook";
import { onRequest as checkoutFn } from "../../functions/api/payments/checkout";
import { createCheckoutSession, formEncode, sessionParams } from "../../src/lib/payments/checkout";
import { memoryStore } from "../../src/lib/payments/store";
import { signForTest } from "../../src/lib/payments/stripeSignature";
import { handleStripeWebhook } from "../../src/lib/payments/webhook";

const SECRET = "whsec_testsecretfortheunittestsonly";
const NOW = 1_800_000_000;
const USER = "11111111-2222-4333-8444-555555555555";
const PERIOD_END = NOW + 30 * 86400;

const event = (id: string, type: string, object: Record<string, unknown>, livemode = false) => JSON.stringify({ id, type, livemode, data: { object } });
const subscription = (over: Record<string, unknown> = {}) => ({
  id: "sub_123", object: "subscription", customer: "cus_123", status: "active", cancel_at_period_end: false,
  metadata: { user_id: USER }, items: { data: [{ price: { lookup_key: "pro_monthly" }, current_period_end: PERIOD_END }] }, ...over,
});

async function deliver(store: ReturnType<typeof memoryStore>, body: string) {
  return handleStripeWebhook(body, await signForTest(body, SECRET, NOW), { secret: SECRET, store, nowS: NOW });
}

describe("webhook", () => {
  it("refuses an unsigned or badly signed delivery and stores nothing", async () => {
    const store = memoryStore();
    const body = event("evt_1", "customer.subscription.created", subscription());
    expect((await handleStripeWebhook(body, null, { secret: SECRET, store, nowS: NOW })).status).toBe(400);
    expect((await handleStripeWebhook(body, await signForTest(body, "whsec_other", NOW), { secret: SECRET, store, nowS: NOW })).status).toBe(400);
    expect(store.events.size).toBe(0);
  });

  it("refuses live-mode events", async () => {
    const store = memoryStore();
    const r = await deliver(store, event("evt_live", "customer.subscription.created", subscription(), true));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/test mode only/);
    expect(store.events.size).toBe(0);
  });

  it("checkout completed links the person to the Stripe customer", async () => {
    const store = memoryStore();
    const r = await deliver(store, event("evt_c", "checkout.session.completed", { id: "cs_test_1", client_reference_id: USER, customer: "cus_123" }));
    expect(r).toEqual({ status: 200, body: { received: true } });
    expect(store.customers.get(USER)).toBe("cus_123");
    expect(store.events.get("evt_c")).toMatchObject({ user_id: USER, error: null });
  });

  it("a subscription event stores the subscription and grants the plan's features", async () => {
    const store = memoryStore();
    expect((await deliver(store, event("evt_s", "customer.subscription.created", subscription()))).status).toBe(200);
    expect(store.subs).toHaveLength(1);
    expect(store.subs[0]).toMatchObject({ user_id: USER, plan: "pro", status: "active", current_period_end: new Date(PERIOD_END * 1000).toISOString() });
    expect(store.entitlements.get(USER)?.map((e) => e.feature)).toContain("verify_unlimited");
  });

  it("finds the person by customer when metadata is missing", async () => {
    const store = memoryStore();
    await store.upsertCustomer(USER, "cus_123");
    expect((await deliver(store, event("evt_m", "customer.subscription.updated", subscription({ metadata: {} })))).status).toBe(200);
    expect(store.subs[0].user_id).toBe(USER);
  });

  it("a deleted subscription removes the features", async () => {
    const store = memoryStore();
    await deliver(store, event("evt_1", "customer.subscription.created", subscription()));
    await deliver(store, event("evt_2", "customer.subscription.deleted", subscription({ status: "canceled" })));
    expect(store.subs).toHaveLength(1);
    expect(store.entitlements.get(USER)).toEqual([]);
  });

  it("a redelivered event is handled once", async () => {
    const store = memoryStore();
    const body = event("evt_dup", "customer.subscription.created", subscription());
    expect((await deliver(store, body)).body).toEqual({ received: true });
    const spy = vi.spyOn(store, "upsertSubscription");
    expect((await deliver(store, body)).body).toEqual({ received: true, duplicate: true });
    expect(spy).not.toHaveBeenCalled();
    expect(store.events.size).toBe(1);
  });

  it("records a failure, answers 500 so Stripe retries, and handles the retry", async () => {
    const store = memoryStore();
    const body = event("evt_f", "customer.subscription.created", subscription({ metadata: {} }));
    const first = await deliver(store, body);
    expect(first.status).toBe(500);
    expect(store.events.get("evt_f")?.error).toMatch(/customer we do not know/);
    await store.upsertCustomer(USER, "cus_123");
    expect((await deliver(store, body)).status).toBe(200);
    expect(store.events.get("evt_f")?.error).toBeNull();
  });

  it("refuses a price we do not sell", async () => {
    const store = memoryStore();
    const r = await deliver(store, event("evt_p", "customer.subscription.created", subscription({ items: { data: [{ price: { lookup_key: "mystery" } }] } })));
    expect(r.status).toBe(500);
    expect(store.subs).toHaveLength(0);
  });

  it("acknowledges and records event types it does not act on", async () => {
    const store = memoryStore();
    const r = await deliver(store, event("evt_i", "invoice.paid", { id: "in_1" }));
    expect(r.body).toEqual({ received: true, ignored: "invoice.paid" });
    expect(store.events.get("evt_i")?.processed_at).toBeTruthy();
  });

  it("rejects a checkout session without a valid person id", async () => {
    const store = memoryStore();
    const r = await deliver(store, event("evt_x", "checkout.session.completed", { id: "cs_test_2", client_reference_id: "not-a-uuid", customer: "cus_1" }));
    expect(r.status).toBe(500);
    expect(store.customers.size).toBe(0);
  });
});

describe("endpoints with the flag off", () => {
  const post = (path: string) => new Request(`https://parity.endyland.com${path}`, { method: "POST", body: "{}" });
  it("both answer 404 as if they did not exist", async () => {
    expect((await webhookFn({ request: post("/api/payments/webhook"), env: {} })).status).toBe(404);
    expect((await checkoutFn({ request: post("/api/payments/checkout"), env: { PAYMENTS_ENABLED: "off", STRIPE_SECRET_KEY: "sk_test_x" } })).status).toBe(404);
  });
  it("the webhook refuses to run without its secrets even when on", async () => {
    expect((await webhookFn({ request: post("/api/payments/webhook"), env: { PAYMENTS_ENABLED: "on" } })).status).toBe(503);
  });
  it("checkout needs a signed-in caller when on", async () => {
    expect((await checkoutFn({ request: post("/api/payments/checkout"), env: { PAYMENTS_ENABLED: "on", STRIPE_SECRET_KEY: "sk_test_x" } })).status).toBe(401);
  });
});

describe("checkout", () => {
  const input = { lookupKey: "pro_monthly", userId: USER, email: "a@example.com", origin: "https://parity.endyland.com" };

  it("refuses a live key before any request", async () => {
    const fetcher = vi.fn();
    await expect(createCheckoutSession("sk_live_abc", input, fetcher as unknown as typeof fetch)).rejects.toThrow(/test key only/);
    await expect(createCheckoutSession(undefined, input, fetcher as unknown as typeof fetch)).rejects.toThrow(/test key only/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a plan that is not self-serve", async () => {
    const fetcher = vi.fn();
    await expect(createCheckoutSession("sk_test_abc", { ...input, lookupKey: "platform" }, fetcher as unknown as typeof fetch)).rejects.toThrow(/Unknown plan/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("finds the price by lookup key and creates a session tagged with the person", async () => {
    const calls: { url: string; body?: string }[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined });
      if (url.includes("/prices")) return new Response(JSON.stringify({ data: [{ id: "price_1", livemode: false, recurring: { usage_type: "licensed" } }] }));
      return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_1", livemode: false }));
    }) as unknown as typeof fetch;
    expect(await createCheckoutSession("sk_test_abc", input, fetcher)).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect(calls[0].url).toContain("lookup_keys[]=pro_monthly");
    const body = new URLSearchParams(calls[1].body);
    expect(body.get("client_reference_id")).toBe(USER);
    expect(body.get("subscription_data[metadata][user_id]")).toBe(USER);
    expect(body.get("line_items[0][price]")).toBe("price_1");
    expect(body.get("line_items[0][quantity]")).toBe("1");
    expect(body.get("mode")).toBe("subscription");
  });

  it("refuses a live price or session even with a test key", async () => {
    const live = (async () => new Response(JSON.stringify({ data: [{ id: "price_1", livemode: true }] }))) as unknown as typeof fetch;
    await expect(createCheckoutSession("sk_test_abc", input, live)).rejects.toThrow(/Live prices/);
  });

  it("metered prices go without a quantity", () => {
    const p = sessionParams(input, { id: "price_m", metered: true });
    expect(p.line_items).toEqual([{ price: "price_m" }]);
    expect(formEncode({ a: { b: [{ c: 1 }] }, skip: undefined })).toBe("a%5Bb%5D%5B0%5D%5Bc%5D=1");
  });
});

describe("Supabase store requests", () => {
  it("claims events with an insert that ignores duplicates, then reads the earlier row", async () => {
    const { supabaseStore } = await import("../../src/lib/payments/store");
    const calls: { url: string; method: string; prefer: string | null; apikey: string | null; auth: string | null }[] = [];
    let first = true;
    const fetcher = (async (url: string, init: RequestInit) => {
      const h = new Headers(init.headers);
      calls.push({ url, method: init.method ?? "GET", prefer: h.get("Prefer"), apikey: h.get("apikey"), auth: h.get("Authorization") });
      if (init.method === "POST") { const made = first ? "[{}]" : "[]"; first = false; return new Response(made); }
      return new Response(JSON.stringify([{ processed_at: "2026-11-01T00:00:00Z", error: null }]));
    }) as unknown as typeof fetch;
    const store = supabaseStore("https://x.supabase.co/", "sb_secret_abc", fetcher);
    expect(await store.claimEvent({ stripe_event_id: "evt_1", type: "t", object_id: null })).toBe("new");
    expect(await store.claimEvent({ stripe_event_id: "evt_1", type: "t", object_id: null })).toBe("done");
    expect(calls[0].url).toBe("https://x.supabase.co/rest/v1/payment_events?on_conflict=stripe_event_id");
    expect(calls[0].prefer).toContain("ignore-duplicates");
    expect(calls[0].apikey).toBe("sb_secret_abc");
    expect(calls[0].auth).toBeNull();
    expect(calls[2].url).toContain("stripe_event_id=eq.evt_1");
  });
});
