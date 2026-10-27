// Sims and searches this person started (DEC-0075), so Home can list them under "Sims running
// now". Kept in this browser only: the runs themselves happen in this browser too (Sim World's
// stress tests run here), so there is nothing on a server to read back. At most 12, newest first.
import { useSyncExternalStore } from "react";

export interface Activity {
  id: string;
  kind: "stress" | "search" | "scenario" | "backtest";
  label: string;
  /** One short line: what was run, such as "3 mixes, 2,000 paths, 10 years". */
  detail: string;
  href: string;
  startedAt: string;
  endedAt: string | null;
}

const KEY = "parity.activity.v1";
const MAX = 12;
let list: Activity[] = read();
const subs = new Set<() => void>();

function read(): Activity[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((a) => a && typeof a.id === "string" && typeof a.label === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function save(next: Activity[]) {
  list = next.slice(0, MAX);
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* memory only */ }
  for (const f of subs) f();
}

/** Records a run. The same id replaces the older entry, so re-running moves it to the top. */
export function recordRun(a: Omit<Activity, "startedAt" | "endedAt"> & { running?: boolean }) {
  const now = new Date().toISOString();
  const { running, ...rest } = a;
  save([{ ...rest, startedAt: now, endedAt: running ? null : now }, ...list.filter((x) => x.id !== a.id)]);
}

/** Marks a run finished. */
export function finishRun(id: string) {
  save(list.map((x) => (x.id === id && !x.endedAt ? { ...x, endedAt: new Date().toISOString() } : x)));
}

export function useActivity(): Activity[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => list, () => list);
}
