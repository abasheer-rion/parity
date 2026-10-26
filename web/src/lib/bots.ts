// Loads Bot Battle's files (DEC-0035): a small index of every replay and its summary, then
// one replay at a time. Dev reads /local/bots/, builds read /data/bots/ (behind sign-in,
// like every other data file).
import { source } from "./data";
import type { BotRunFile, BotsIndex } from "./botStats";

export type BotsLoaded<T> = { status: "ok"; data: T } | { status: "missing"; message: string } | { status: "error"; message: string };

const BASE = source === "local" ? "/local/bots" : "/data/bots";
const MISSING = source === "local" ? "Run `parity bots export` in engine/ first." : "The Bot Battle files have not been published yet.";

async function get<T>(url: string): Promise<BotsLoaded<T>> {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (res.status === 404 || (res.headers.get("content-type") ?? "").includes("text/html")) return { status: "missing", message: MISSING };
    if (!res.ok) return { status: "error", message: `Could not load ${url} (${res.status}).` };
    return { status: "ok", data: (await res.json()) as T };
  } catch (e) {
    return { status: "error", message: `Could not load ${url}: ${(e as Error).message}` };
  }
}

let indexP: Promise<BotsLoaded<BotsIndex>> | null = null;
export function loadBotsIndex(): Promise<BotsLoaded<BotsIndex>> {
  if (!indexP) indexP = get<BotsIndex>(`${BASE}/index.json`).then((r) => { if (r.status !== "ok") indexP = null; return r; });
  return indexP;
}

const runs = new Map<string, Promise<BotsLoaded<BotRunFile>>>();
export function loadBotRun(id: string): Promise<BotsLoaded<BotRunFile>> {
  let p = runs.get(id);
  if (!p) {
    p = get<BotRunFile>(`${BASE}/${encodeURIComponent(id)}.json`).then((r) => { if (r.status !== "ok") runs.delete(id); return r; });
    runs.set(id, p);
  }
  return p;
}
