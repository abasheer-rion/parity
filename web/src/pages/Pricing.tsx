// Plans and test-mode checkout (DEC-0046). Only reachable when the build sets
// VITE_PAYMENTS=on; with the flag off this page is never routed. The tiers and prices are
// the starting points in DEC-0032. A button asks /api/payments/checkout for a Stripe
// Checkout address in test mode and goes there; no card is ever charged.
import { useState } from "react";
import { Title } from "../components/Shell";
import { PLANS, type PlanInfo } from "../lib/payments/plans";
import { Button } from "../ui";

const SHOWN: PlanInfo[] = [PLANS.free, PLANS.pro, PLANS.seller, PLANS.api_starter, PLANS.platform];

const FEATURE_LABEL: Record<string, string> = {
  verify_unlimited: "Unlimited checks",
  private_reports: "Private reports",
  pdf_export: "PDF export",
  claim_checker: "Claim checker for sellers' pages",
  check_history: "History of past checks",
  public_profile: "Public profile of every badge",
  badge_embeds: "Badge embeds",
  recheck_reminders: "Monthly re-check reminders",
  api_access: "API keys",
  api_overage: "Records over the included amount billed per record",
  white_label: "White-label badges",
  api_webhooks: "Webhooks",
};

async function startCheckout(lookupKey: string): Promise<string> {
  const { supabase } = await import("../auth/client");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in first");
  const res = await fetch("/api/payments/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lookupKey }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? `Checkout failed (${res.status})`);
  return body.url;
}

export function Pricing() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("checkout");
  const go = async (key: string) => {
    setBusy(key);
    setError(null);
    try {
      window.location.assign(await startCheckout(key));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };
  return (
    <>
      <div className="page-head">
        <Title>Plans</Title>
        <p className="page-purpose">Test mode. Checkout uses Stripe test cards and charges nothing.</p>
      </div>
      {status === "done" && <p role="status">Test checkout finished. Your plan updates when Stripe confirms it.</p>}
      {status === "cancelled" && <p role="status">Test checkout cancelled.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="pricing-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {SHOWN.map((p) => (
          <section key={p.plan} className="card" aria-labelledby={`plan-${p.plan}`}>
            <h2 id={`plan-${p.plan}`}>{p.name}</h2>
            <p className="muted small">{p.who}</p>
            <p><strong>{p.price}</strong></p>
            <ul className="small">
              {p.plan === "free" && <li>{PLANS.free.monthlyQuota} checks a month</li>}
              {p.features.map((f) => <li key={f}>{FEATURE_LABEL[f] ?? f}</li>)}
            </ul>
            {p.lookupKeys.map((key) => (
              <Button key={key} onClick={() => void go(key)} disabled={busy !== null}>
                {busy === key ? "Opening checkout" : key.endsWith("_yearly") ? "Test checkout, yearly" : "Test checkout"}
              </Button>
            ))}
            {p.plan === "platform" && <p className="muted small">Signed agreement, no self-serve checkout.</p>}
          </section>
        ))}
      </div>
    </>
  );
}
