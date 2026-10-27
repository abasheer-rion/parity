// Personalization calls (DEC-0068). Every call is a database function that acts only on the
// signed-in person's own rows (supabase/migrations/20261108000000_personalization.sql). Each one
// fails quietly when signed out or offline: personalization must never break a page.
import { allowed, onConsentChange } from "../../legal/consent";

export type Segment = "new" | "learner" | "trader" | "both" | "browser";
export type RiskBand = "unknown" | "careful" | "moderate" | "bold";
export type EngagementBand = "new" | "light" | "regular" | "heavy";
export type WidgetChoice = "auto" | "keep" | "collapse";
export type RecoKind = "algo" | "lesson" | "tool" | "market" | "scenario" | "verify";
export type Metric = "whats_new_click" | "whats_new_dismiss" | "widget_restore" | "widget_used" | "personalization_off" | "lesson_done" | "demo_order";

export interface Profile {
  learner: number;
  trader: number;
  risk: number | null;
  engagement: number;
  paid_use: number;
  segment: Segment;
  risk_band: RiskBand;
  engagement_band: EngagementBand;
  interests: { asset: Record<string, number>; family: Record<string, number>; kind: Record<string, number> };
  widgets: Record<string, { used: number; ignored_sessions: number }>;
  inputs: Record<string, number>;
  sources: string[];
  computed_at: string;
}

export interface WidgetState { widget_id: string; ignored_sessions: number; choice: WidgetChoice; last_used_at: string | null }
export interface Feedback { item: string; shown: number; clicked_at: string | null; dismissed_at: string | null }
export interface Settings { enabled: boolean; analytics_ok: boolean; updated_at: string | null; reset_at: string | null }
export interface Personal {
  settings: Settings; profile: Profile | null; widgets: WidgetState[]; feedback: Feedback[];
  /** Running experiments this person is in. */
  experiments?: { key: string; variant: string }[];
}
export interface Arm { item: string; shows: number; clicks: number }
export interface Assignment { key: string; variant: string; exposed: boolean }
export interface RecoEvent { item: string; ev: "show" | "click" | "dismiss"; tags: string[] }

export interface TeamPersonalization {
  profiles: number | null; enabled: number | null; disabled: number | null; analytics_ok: number | null;
  segments: { segment: Segment; users: number | null }[];
  risk: { band: RiskBand; users: number | null }[];
  engagement: { band: EngagementBand; users: number | null }[];
  reco: { kind: RecoKind; shows: number | null; clicks: number | null }[];
  days: number;
}
export interface ExperimentArm { variant: string; exposed: number | null; metrics: Record<string, number | null> }
export interface ExperimentRow {
  key: string; name: string; hypothesis: string; status: "draft" | "running" | "stopped";
  primary_metric: string; guardrails: string[]; variants: string[]; min_per_arm: number; max_days: number;
  started_at: string | null; stopped_at: string | null; stop_reason: string | null; arms: ExperimentArm[];
}

async function signedIn(): Promise<boolean> {
  try {
    const { supabase } = await import("../../auth/client");
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { supabase } = await import("../../auth/client");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === "42501" ? "team only" : error.message);
  return data as T;
}

/** Runs a call for a signed-in person; returns `fallback` when signed out or on any error. */
async function quiet<T>(name: string, args: Record<string, unknown>, fallback: T): Promise<T> {
  try {
    if (!(await signedIn())) return fallback;
    // A stubbed or empty answer comes back as null: treat it like no answer.
    return (await rpc<T | null>(name, args)) ?? fallback;
  } catch {
    return fallback;
  }
}

export const getPersonal = () => quiet<Personal | null>("personalization_get", {}, null);
export const setPersonalization = (enabled: boolean | null, analytics: boolean | null = null) =>
  quiet<null>("personalization_set", { p_enabled: enabled, p_analytics: analytics }, null);
export const resetPersonalization = () => quiet<null>("personalization_reset", {}, null);
export const refreshProfile = () => quiet<Profile | null>("personalization_refresh", {}, null);
export const logReco = (events: RecoEvent[]) => (events.length ? quiet<number>("reco_log", { p_events: events.slice(0, 30) }, 0) : Promise.resolve(0));
export const loadArms = (items: string[]) => (items.length ? quiet<Arm[]>("reco_arms", { p_items: items }, []) : Promise.resolve([] as Arm[]));
export const widgetSeen = (seen: string[], used: string[]) => quiet<null>("widget_seen", { p_seen: seen, p_used: used }, null);
export const widgetChoose = (widget: string, choice: WidgetChoice) => quiet<null>("widget_choose", { p_widget: widget, p_choice: choice }, null);
export const assignExperiments = (keys: string[]) => quiet<Assignment[]>("experiment_assign", { p_keys: keys }, []);
export const trackExperiment = (metric: Metric) => quiet<null>("experiment_track", { p_metric: metric }, null);

// Team only, like the other Metrics reads: errors are passed on so the page can say why.
export const loadTeamPersonalization = () => rpc<TeamPersonalization>("metrics_personalization");
export const loadExperiments = () => rpc<ExperimentRow[]>("metrics_experiments");

/** True when this browser may send analytics: switched on, and no Do Not Track or Global Privacy Control. */
export const analyticsOn = () => allowed("analytics");

let synced = false;
/**
 * Tells the database whether analytics may be used for this person's profile, once per page
 * load and again whenever the cookie choice changes. When it is off, the profile is built only
 * from what the person did in the product (lessons, demo orders), never from analytics events.
 */
export function syncConsent(): void {
  if (synced) return;
  synced = true;
  void setPersonalization(null, analyticsOn());
  try {
    onConsentChange(() => { void setPersonalization(null, analyticsOn()); });
  } catch { /* consent listeners are optional */ }
}
