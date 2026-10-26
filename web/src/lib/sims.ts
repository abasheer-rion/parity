// The always-on sims' accumulated summary (DEC-0037): out of every made-up path the
// service has run, how often each Bot Battle bot was stopped out, and where its account
// ended. Dev reads /local/sims.json (`parity sims export`), builds read /data/sims.json,
// which the deploy job copies from the newest snapshot.
import { source } from "./data";

export interface SimBot {
  name: string; paths: number; blown: number; ahead: number; crash_paths: number; blown_in_crash: number;
  blown_share: number | null; blown_in_crash_share: number | null;
  /** End account in dollars at the 5th, 25th, 50th, 75th and 95th percentile. */
  final: number[] | null;
  median_max_drawdown: number | null; median_win_rate: number | null;
}

export interface SimsDoc {
  generated_at: string; cycles: number; last_cycle_at: string | null;
  bots: { years: number; start_cash: number; paths: number; crash_paths: number; by_bot: Record<string, SimBot> };
  world: { weeks: number; assets: Record<string, { paths: number; p_loss: number; p_loss_gt_10: number; returns: number[] | null }> };
  disclaimer: string;
}

let p: Promise<SimsDoc | null> | null = null;

/** The summary, or null when the sims have not published one yet. */
export function loadSims(): Promise<SimsDoc | null> {
  if (!p) {
    const url = source === "local" ? "/local/sims.json" : "/data/sims.json";
    p = fetch(url, { cache: "no-cache" })
      .then(async (res) => (res.ok && (res.headers.get("content-type") ?? "").includes("json") ? ((await res.json()) as SimsDoc) : null))
      .catch(() => null)
      .then((d) => { if (!d) p = null; return d; });
  }
  return p;
}
