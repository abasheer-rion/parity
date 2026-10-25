// Plans and entitlements (DEC-0045). The tiers and prices are the starting points in
// DEC-0032, section 2; Stripe holds the real prices, and each Stripe price carries one of
// the lookup keys below so the code never hard-codes a price id. Pure functions only:
// the webhook, the pricing page and the tests all use them.

export type Plan = "free" | "pro" | "seller" | "api_starter" | "platform";
export type PaidPlan = Exclude<Plan, "free">;

/** What a person may use. Stored one row per feature in payment_entitlements. */
export type Feature =
  | "verify_unlimited"
  | "private_reports"
  | "pdf_export"
  | "claim_checker"
  | "check_history"
  | "public_profile"
  | "badge_embeds"
  | "recheck_reminders"
  | "api_access"
  | "api_overage"
  | "white_label"
  | "api_webhooks";

export interface PlanInfo {
  plan: Plan;
  name: string;
  /** Who the tier is for, from DEC-0032. */
  who: string;
  /** Price text from DEC-0032. Display only; Stripe decides what is charged. */
  price: string;
  features: Feature[];
  /** Included checks or scored records a month; null means no cap. */
  monthlyQuota: number | null;
  /** Stripe price lookup keys that start this plan through self-serve Checkout. */
  lookupKeys: string[];
}

const PRO: Feature[] = ["verify_unlimited", "private_reports", "pdf_export", "claim_checker", "check_history"];

export const PLANS: Record<Plan, PlanInfo> = {
  free: { plan: "free", name: "Free", who: "Anyone", price: "$0", features: [], monthlyQuota: 5, lookupKeys: [] },
  pro: { plan: "pro", name: "Pro", who: "Retail traders", price: "$15 a month or $144 a year", features: PRO, monthlyQuota: null, lookupKeys: ["pro_monthly", "pro_yearly"] },
  seller: {
    plan: "seller", name: "Seller", who: "Signal sellers, bot builders, traders raising money", price: "$49 a month",
    features: [...PRO, "public_profile", "badge_embeds", "recheck_reminders"], monthlyQuota: null, lookupKeys: ["seller_monthly"],
  },
  api_starter: {
    plan: "api_starter", name: "API Starter", who: "Small platforms, AI-agent builders", price: "$500 a month, 2,000 scored records, then $0.25 each",
    features: ["api_access", "api_overage"], monthlyQuota: 2000, lookupKeys: ["api_starter_monthly"],
  },
  // Platform deals are signed, not bought through Checkout, so it has no lookup key.
  platform: {
    plan: "platform", name: "Platform", who: "Copy-trading sites, bot marketplaces, prop firms, brokers", price: "$2,000 to $10,000 a month",
    features: ["api_access", "api_overage", "white_label", "api_webhooks"], monthlyQuota: 25000, lookupKeys: [],
  },
};

export const SELF_SERVE_KEYS: string[] = Object.values(PLANS).flatMap((p) => p.lookupKeys);

/** The plan a Stripe price lookup key starts, or null for a key we do not sell. */
export function planForLookupKey(key: string | null | undefined): PaidPlan | null {
  if (!key) return null;
  for (const p of Object.values(PLANS)) if (p.plan !== "free" && p.lookupKeys.includes(key)) return p.plan as PaidPlan;
  return null;
}

/** Stripe subscription statuses (https://docs.stripe.com/billing/subscriptions/overview). */
export type SubscriptionStatus = "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";

export interface SubscriptionLike {
  id: string;
  plan: PaidPlan;
  status: SubscriptionStatus;
  /** ISO time the paid period ends, or null if Stripe did not say. */
  current_period_end: string | null;
}

/** Whether a subscription in this status should grant its plan's features. Active and
 *  trialing do. Past due keeps access while Stripe retries the card, until the paid period
 *  ends. Everything else (incomplete, canceled, unpaid, paused) does not. */
export function grants(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export interface EntitlementRow {
  feature: Feature;
  subscription_id: string | null;
  valid_until: string | null;
}

/** The entitlements a person's subscriptions give them: one row per feature, from the
 *  subscription that lasts longest. A feature with no end date beats one with an end. */
export function entitlementsFor(subs: SubscriptionLike[]): EntitlementRow[] {
  const best = new Map<Feature, EntitlementRow>();
  for (const s of subs) {
    if (!grants(s.status)) continue;
    for (const feature of PLANS[s.plan].features) {
      const row: EntitlementRow = { feature, subscription_id: s.id, valid_until: s.current_period_end };
      const have = best.get(feature);
      if (!have || lastsLonger(row.valid_until, have.valid_until)) best.set(feature, row);
    }
  }
  return [...best.values()].sort((a, b) => a.feature.localeCompare(b.feature));
}

function lastsLonger(a: string | null, b: string | null): boolean {
  if (b === null) return false;
  if (a === null) return true;
  return Date.parse(a) > Date.parse(b);
}

/** Whether these rows let a person use a feature at `now`. */
export function hasEntitlement(rows: Pick<EntitlementRow, "feature" | "valid_until">[], feature: Feature, now: Date = new Date()): boolean {
  return rows.some((r) => r.feature === feature && (r.valid_until === null || Date.parse(r.valid_until) > now.getTime()));
}

/** The plan these rows amount to, for display: the highest tier whose features are all
 *  present. Free when nothing matches. */
export function planOf(rows: Pick<EntitlementRow, "feature" | "valid_until">[], now: Date = new Date()): Plan {
  const order: Plan[] = ["platform", "api_starter", "seller", "pro"];
  for (const p of order) if (PLANS[p].features.every((f) => hasEntitlement(rows, f, now))) return p;
  return "free";
}

/** How many Verify checks are left this month on the free tier; null when uncapped. */
export function checksLeft(rows: Pick<EntitlementRow, "feature" | "valid_until">[], usedThisMonth: number, now: Date = new Date()): number | null {
  if (hasEntitlement(rows, "verify_unlimited", now)) return null;
  return Math.max(0, (PLANS.free.monthlyQuota ?? 0) - usedThisMonth);
}
