// Settings > Personalization (DEC-0068): the switch, what Parity has worked out about how you
// use it, what that was built from, the experiments you are in, and Reset. Everything shown is
// the person's own row; nobody else can read it.
import { useState } from "react";
import { refreshProfile, resetPersonalization, setPersonalization, type Profile } from "../lib/personalize/api";
import { clearSession } from "../lib/personalize/session";
import { reloadPersonal, usePersonal } from "../lib/personalize/usePersonal";
import { Button, SettingsRow, Toggle, toast } from "../ui";

const SEGMENT: Record<Profile["segment"], string> = {
  new: "New to Parity: not enough use yet to tell.",
  learner: "Mostly learning: Academy lessons and explanations.",
  trader: "Mostly trading: demo orders, watchlists and markets.",
  both: "Learning and trading about equally.",
  browser: "Looking around: some use, no clear lean yet.",
};
const RISK: Record<Profile["risk_band"], string> = {
  unknown: "Unknown. You have no demo orders in the last 90 days.",
  careful: "Careful: small positions, calmer markets, stops used.",
  moderate: "Moderate.",
  bold: "Bold: large positions, volatile markets or few stops.",
};
const ENGAGEMENT: Record<Profile["engagement_band"], string> = {
  new: "New", light: "Light", regular: "Regular", heavy: "Heavy",
};
const INPUT_LABELS: Record<string, string> = {
  lessons_done: "Academy lessons finished", lessons_opened: "Academy lessons opened", quiz_pct: "Average quick check score (%)",
  demo_orders: "Demo orders", stop_orders: "Demo orders with a stop", watchlist_items: "Watchlist items",
  verify_badges: "Verify badges", ai_apps: "Connected AI apps", active_days_30: "Days active in the last 30",
  sessions_30: "Visits in the last 30 days", academy_views: "Academy pages opened", trade_views: "Terminal pages opened",
  workbench_views: "Workbench pages opened", verify_runs: "Verify runs",
};
const EXPERIMENT_LABELS: Record<string, string> = {
  whats_new_order: "What's new ordering", whats_new_hook: "What's new wording", widget_defaults: "Home widget defaults",
};

const words = (rec: Record<string, number> | undefined) =>
  Object.entries(rec ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k.replace(/-/g, " ")} ${Math.round(v * 100)}%`).join(", ") || "None yet";

export function PersonalizationSettings() {
  const p = usePersonal();
  const [busy, setBusy] = useState(false);
  if (p === undefined) return <p className="muted small">Loading.</p>;
  if (p === null) return <p className="muted small">Sign in to see and change personalization.</p>;
  const on = p.settings.enabled;
  const prof = p.profile;

  const toggle = async (v: boolean) => {
    setBusy(true);
    await setPersonalization(v, null);
    clearSession();
    if (v) await refreshProfile();
    await reloadPersonal();
    setBusy(false);
    toast(v ? "Personalization is on" : "Personalization is off. Your profile and history were deleted.");
  };
  const reset = async () => {
    setBusy(true);
    await resetPersonalization();
    clearSession();
    await reloadPersonal();
    setBusy(false);
    toast("Your profile, What's new history and widget choices were deleted");
  };
  const rebuild = async () => {
    setBusy(true);
    await refreshProfile();
    await reloadPersonal();
    setBusy(false);
  };

  return (
    <section aria-label="Personalization">
      <SettingsRow label="Personalize Parity" help="Orders What's new and the home widgets by how you use Parity. Off: everything shows in the standard order, nothing about your use is stored, and you are left out of experiments.">
        <Toggle on={on} onChange={(v) => { if (!busy) void toggle(v); }} label="Personalize Parity" />
      </SettingsRow>
      {on && (
        <>
          <SettingsRow label="How you use Parity" help={prof ? `Worked out ${new Date(prof.computed_at).toLocaleString()}.` : "Nothing worked out yet."}>
            {prof ? <span>{SEGMENT[prof.segment]}</span> : <Button onClick={() => void rebuild()} loading={busy}>Work it out now</Button>}
          </SettingsRow>
          {prof && (
            <>
              <SettingsRow label="Demo trading style" help="From demo orders only: position sizes, how much of the account is in use, how volatile the markets are and how often a stop is set. It is used to pick what to show, never to suggest a trade.">
                <span>{RISK[prof.risk_band]}</span>
              </SettingsRow>
              <SettingsRow label="How often you use it" help="Days with any use in the last 30.">
                <span>{ENGAGEMENT[prof.engagement_band]}</span>
              </SettingsRow>
              <SettingsRow label="Interests" help="Markets you trade or watch in demo, and kinds of items you opened in What's new.">
                <span>{[words(prof.interests.asset), words(prof.interests.family)].filter((x) => x !== "None yet").join("; ") || "None yet"}</span>
              </SettingsRow>
              <SettingsRow label="Built from" help={prof.sources.includes("analytics")
                ? "Your actions in the app, and page use because analytics is on in your cookie choices."
                : "Your actions in the app only. Page use is not used because analytics is off in your cookie choices."}>
                <ul className="small">
                  {Object.entries(prof.inputs).map(([k, v]) => <li key={k}>{INPUT_LABELS[k] ?? k.replace(/_/g, " ")}: {v}</li>)}
                </ul>
              </SettingsRow>
            </>
          )}
          <SettingsRow label="Experiments you are in" help="We test changes on a share of people and compare the results. Each person stays in one version.">
            <span>{p.experiments?.length ? p.experiments.map((e) => `${EXPERIMENT_LABELS[e.key] ?? e.key}: ${e.variant}`).join(", ") : "None"}</span>
          </SettingsRow>
          <SettingsRow label="Reset" help="Deletes your profile, your What's new history and your widget choices. Personalization stays on and starts again from your next actions.">
            <Button onClick={() => void reset()} loading={busy}>Reset</Button>
          </SettingsRow>
        </>
      )}
      <p className="muted small">What is used, what is never worked out and how long it is kept: <a href="/legal/privacy/#personalization">privacy policy</a>.</p>
    </section>
  );
}
