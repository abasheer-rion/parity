// Plans, entitlements and metering (DEC-0046). Pure functions, no network.
import { describe, expect, it } from "vitest";
import { isTestSecretKey, isWebhookSecret, serverFlag } from "../../src/lib/payments/guard";
import { meterEvent, overage } from "../../src/lib/payments/metering";
import { checksLeft, entitlementsFor, grants, hasEntitlement, planForLookupKey, planOf, PLANS, SELF_SERVE_KEYS, type SubscriptionLike } from "../../src/lib/payments/plans";

const NOW = new Date("2026-11-01T00:00:00Z");
const LATER = "2026-12-01T00:00:00.000Z";
const EARLIER = "2026-10-01T00:00:00.000Z";
const sub = (over: Partial<SubscriptionLike>): SubscriptionLike => ({ id: "s1", plan: "pro", status: "active", current_period_end: LATER, ...over });

describe("plans", () => {
  it("maps lookup keys to plans and refuses unknown ones", () => {
    expect(planForLookupKey("pro_monthly")).toBe("pro");
    expect(planForLookupKey("pro_yearly")).toBe("pro");
    expect(planForLookupKey("seller_monthly")).toBe("seller");
    expect(planForLookupKey("api_starter_monthly")).toBe("api_starter");
    expect(planForLookupKey("platform_monthly")).toBeNull();
    expect(planForLookupKey(null)).toBeNull();
    expect(SELF_SERVE_KEYS).not.toContain("free");
  });

  it("keeps DEC-0032's prices and quotas", () => {
    expect(PLANS.free.monthlyQuota).toBe(5);
    expect(PLANS.pro.price).toBe("$15 a month or $144 a year");
    expect(PLANS.api_starter.monthlyQuota).toBe(2000);
  });

  it("seller includes every pro feature", () => {
    for (const f of PLANS.pro.features) expect(PLANS.seller.features).toContain(f);
  });
});

describe("entitlements", () => {
  it("grants only for active, trialing and past due", () => {
    expect(["active", "trialing", "past_due"].every((s) => grants(s as never))).toBe(true);
    expect(["incomplete", "incomplete_expired", "canceled", "unpaid", "paused"].some((s) => grants(s as never))).toBe(false);
  });

  it("an active pro subscription gives the pro features until the period ends", () => {
    const rows = entitlementsFor([sub({})]);
    expect(rows.map((r) => r.feature).sort()).toEqual([...PLANS.pro.features].sort());
    expect(rows.every((r) => r.valid_until === LATER && r.subscription_id === "s1")).toBe(true);
    expect(hasEntitlement(rows, "verify_unlimited", NOW)).toBe(true);
    expect(hasEntitlement(rows, "verify_unlimited", new Date("2026-12-02T00:00:00Z"))).toBe(false);
    expect(hasEntitlement(rows, "api_access", NOW)).toBe(false);
    expect(planOf(rows, NOW)).toBe("pro");
  });

  it("a cancelled subscription gives nothing", () => {
    expect(entitlementsFor([sub({ status: "canceled" })])).toEqual([]);
    expect(planOf([], NOW)).toBe("free");
  });

  it("overlapping subscriptions keep the longest-lasting row per feature", () => {
    const rows = entitlementsFor([sub({ id: "a", current_period_end: EARLIER }), sub({ id: "b", plan: "seller", current_period_end: LATER })]);
    const unlimited = rows.find((r) => r.feature === "verify_unlimited")!;
    expect(unlimited.subscription_id).toBe("b");
    expect(planOf(rows, NOW)).toBe("seller");
    expect(new Set(rows.map((r) => r.feature)).size).toBe(rows.length);
  });

  it("a row with no end date lasts longest", () => {
    const rows = entitlementsFor([sub({ id: "a", current_period_end: null }), sub({ id: "b", current_period_end: LATER })]);
    expect(rows.every((r) => r.subscription_id === "a" && r.valid_until === null)).toBe(true);
  });

  it("counts free checks left, and none are capped with unlimited", () => {
    expect(checksLeft([], 3, NOW)).toBe(2);
    expect(checksLeft([], 9, NOW)).toBe(0);
    expect(checksLeft(entitlementsFor([sub({})]), 99, NOW)).toBeNull();
  });
});

describe("guards", () => {
  it("the server flag is on only for the exact string", () => {
    expect(serverFlag({})).toBe(false);
    expect(serverFlag({ PAYMENTS_ENABLED: "true" })).toBe(false);
    expect(serverFlag({ PAYMENTS_ENABLED: "on" })).toBe(true);
  });

  it("accepts test keys only", () => {
    expect(isTestSecretKey("sk_test_abc123")).toBe(true);
    expect(isTestSecretKey("rk_test_abc123")).toBe(true);
    expect(isTestSecretKey("sk_live_abc123")).toBe(false);
    expect(isTestSecretKey("rk_live_abc123")).toBe(false);
    expect(isTestSecretKey(undefined)).toBe(false);
    expect(isWebhookSecret("whsec_abc")).toBe(true);
    expect(isWebhookSecret("sk_test_abc")).toBe(false);
  });
});

describe("metering", () => {
  it("builds a meter event with an idempotency identifier", () => {
    const e = meterEvent("cus_ABC", "req-1", new Date("2026-11-01T00:00:10Z"), 3);
    expect(e).toEqual({ event_name: "parity_scored_record", identifier: "req-1", timestamp: 1793491210, payload: { stripe_customer_id: "cus_ABC", value: "3" } });
    expect(() => meterEvent("bad", "req", NOW)).toThrow();
    expect(() => meterEvent("cus_A", "", NOW)).toThrow();
    expect(() => meterEvent("cus_A", "r", NOW, 0)).toThrow();
  });

  it("works out overage from DEC-0032's rates", () => {
    expect(overage("api_starter", 1500)).toEqual({ over: 0, usd: 0 });
    expect(overage("api_starter", 2100)).toEqual({ over: 100, usd: 25 });
    expect(overage("platform", 26000)).toEqual({ over: 1000, usd: 100 });
    expect(overage("pro", 10_000)).toEqual({ over: 0, usd: 0 });
  });
});
