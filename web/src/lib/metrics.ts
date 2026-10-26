// Reads for the Metrics page (DEC-0053). Every call is a database function that answers
// only accounts on the team list (analytics.viewers); anyone else gets an error.
export type Days = 7 | 30 | 90;

export interface Live { visitors: number; apps: { app: string; visitors: number }[]; pages: { app: string; route: string; visitors: number }[] }
export interface PageRow { app: string; route: string; views: number; visitors: number; sessions: number; avg_visible_ms: number | null; avg_scroll: number | null }
export interface DayRow { day: string; views: number; visitors: number }
export interface ClickRow { app: string; route: string; kind: "click" | "rage"; target: string; clicks: number; visitors: number }
export interface EventRow { app: string; name: string; events: number; visitors: number }
export interface ErrorRow { app: string; route: string; message: string; errors: number }
export interface FunnelRow { step: number; label: string; visitors: number }
export interface RetentionRow { cohort: string; size: number; weeks: number[] }

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { supabase } = await import("../auth/client");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === "42501" ? "team only" : error.message);
  return data as T;
}

/** True for accounts on the team list. Signed out, it answers false without asking the database. */
export async function metricsAllowed(): Promise<boolean> {
  const { supabase } = await import("../auth/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  return rpc<boolean>("metrics_allowed").catch(() => false);
}
export const loadLive = () => rpc<Live>("metrics_live");
export const loadPages = (days: Days) => rpc<PageRow[]>("metrics_pages", { p_days: days });
export const loadDaily = (days: Days) => rpc<DayRow[]>("metrics_daily", { p_days: days });
export const loadClicks = (days: Days, app: string | null, route: string | null) => rpc<ClickRow[]>("metrics_clicks", { p_app: app, p_route: route, p_days: days });
export const loadEvents = (days: Days) => rpc<EventRow[]>("metrics_events", { p_days: days });
export const loadErrors = (days: Days) => rpc<ErrorRow[]>("metrics_errors", { p_days: days });
export const loadFunnel = (days: Days) => rpc<FunnelRow[]>("metrics_funnel", { p_days: days });
export const loadRetention = (weeks = 8) => rpc<RetentionRow[]>("metrics_retention", { p_weeks: weeks });

/** "1 m 05 s" style visible time, or n/a. */
export function visibleTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "n/a";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} m ${String(s % 60).padStart(2, "0")} s` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m`;
}

/** A share as a whole percent, or n/a when there is nothing to divide by. */
export function share(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : "n/a";
}
