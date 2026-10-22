// What each currency did after a scenario's past events, from the world file's event
// reactions (the engine runs the scenario simulator's event study on every currency).
import { quantile, type Band, type Match } from "../../lib/scenarios";
import type { Horizon, WorldData } from "../../lib/world";

export interface Impact { median: number; q25: number; q75: number; n: number; up: number }

function byId(data: WorldData) {
  return new Map(data.events.map((e) => [e.id, e]));
}

/** Median, middle half and count of each series' move `h` after the matched events. */
export function medianImpact(data: WorldData, matches: Match[], h: Horizon): Record<string, Impact> {
  const ev = byId(data);
  const vals: Record<string, number[]> = {};
  for (const { event } of matches) {
    const r = ev.get(event.id)?.reactions;
    if (!r) continue;
    for (const [code, per] of Object.entries(r)) {
      const v = per[h];
      if (v == null || !Number.isFinite(v)) continue;
      (vals[code] ??= []).push(v);
    }
  }
  const out: Record<string, Impact> = {};
  for (const [code, list] of Object.entries(vals)) {
    const s = [...list].sort((a, b) => a - b);
    out[code] = { median: quantile(s, 0.5), q25: quantile(s, 0.25), q75: quantile(s, 0.75), n: s.length, up: s.filter((x) => x > 0).length };
  }
  return out;
}

/** Fan bands for one series from the world file's event paths (kept every few trading days). */
export function worldBands(data: WorldData, matches: Match[], code: string): { bands: Band[]; paths: { name: string; values: number[] }[] } {
  const ev = byId(data);
  const step = data.event_path_step;
  const paths = matches.map((m) => ({ name: m.event.id, values: ev.get(m.event.id)?.paths[code] ?? [] })).filter((p) => p.values.length);
  const len = Math.max(0, ...paths.map((p) => p.values.length));
  const bands: Band[] = [];
  for (let i = 0; i < len; i++) {
    const v = paths.map((p) => p.values[i]).filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) continue;
    bands.push({ day: i * step, median: quantile(v, 0.5), q25: quantile(v, 0.25), q75: quantile(v, 0.75), min: v[0], max: v[v.length - 1], count: v.length });
  }
  return { bands, paths };
}
