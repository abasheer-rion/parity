// Whether the two always-on services are alive (DEC-0037): the strategy search and the
// sims. Each reports to the service_heartbeats table, which anyone may read; the database
// stamps the time. A service that has not reported for two hours shows as stale.
//
// No imports at the top level, so tests can load the wording without a database.

export interface Heartbeat { service: string; reported_at: string; summary: Record<string, unknown> }

export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export function ago(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 6) / 10;
  if (hours < 48) return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export interface HealthPart { service: "search" | "sims"; text: string; stale: boolean }

const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : null);

/** One short part per service, in a fixed order, e.g. "search: 130,466 tries, last batch 2 min ago". */
export function healthParts(rows: Heartbeat[], now: number = Date.now()): HealthPart[] {
  return (["search", "sims"] as const).map((service) => {
    const row = rows.find((r) => r.service === service);
    if (!row) return { service, text: `${service}: no report yet`, stale: true };
    const stale = now - Date.parse(row.reported_at) > STALE_AFTER_MS;
    const when = ago(row.reported_at, now);
    if (service === "search") {
      const tries = n(row.summary.trials);
      const head = tries ? `search: ${tries} tries, ` : "search: ";
      return { service, stale, text: stale ? `${head}no report for ${when.replace(" ago", "")} (stale)` : `${head}last batch ${when}` };
    }
    const paths = n(row.summary.bot_paths);
    const head = paths ? `sims: ${paths} bot paths, ` : "sims: ";
    return { service, stale, text: stale ? `${head}no report for ${when.replace(" ago", "")} (stale)` : `${head}last cycle ${when}` };
  });
}

/** The live rows, straight from the database with the public key. */
export async function loadHeartbeats(): Promise<Heartbeat[]> {
  const { supabase } = await import("../auth/client");
  const { data, error } = await supabase.from("service_heartbeats").select("service, reported_at, summary");
  if (error) throw error;
  return (data ?? []) as Heartbeat[];
}
