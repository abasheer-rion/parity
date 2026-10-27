// Each person's Home layout (DEC-0075), kept in Supabase's home_layouts (one row per person,
// own row only). This browser keeps a copy so Home draws in its final order on the first frame;
// the local preview and a missing table fall back to that copy alone. Saves are debounced and
// sent one at a time, like the onboarding store.
import { useSyncExternalStore } from "react";
import { normalize, type Layout, type Segment } from "./registry";

const KEY = "parity.home.layout.v1";

let raw: unknown = (() => { try { return JSON.parse(window.localStorage.getItem(KEY) ?? "null"); } catch { return null; } })();
let version = 0;
let userId: string | null = null;
let remote = false;
const subs = new Set<() => void>();
let started = false;
let timer: number | undefined;
let writes: Promise<unknown> = Promise.resolve();

function emit() { version++; for (const f of subs) f(); }

async function load() {
  try {
    const { supabase } = await import("../auth/client");
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user.id ?? null;
    if (!userId) return;
    const { data: row, error } = await supabase.from("home_layouts").select("layout").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    remote = true;
    if (row?.layout && typeof row.layout === "object" && Object.keys(row.layout).length) {
      raw = row.layout;
      try { window.localStorage.setItem(KEY, JSON.stringify(raw)); } catch { /* copy only */ }
      emit();
    }
  } catch {
    remote = false; // table not there yet, or offline: this browser's copy carries on
  }
}

/** The person's layout for this segment, re-read whenever it changes. */
export function useLayout(segment: Segment): Layout {
  if (!started && typeof window !== "undefined") { started = true; void load(); }
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => version);
  return normalize(raw, segment);
}

/** Saves a new layout: at once on this page, then to the account a moment later. */
export function saveLayout(next: Layout) {
  raw = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* memory only */ }
  emit();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (!remote || !userId) return;
    const uid = userId;
    writes = writes.then(async () => {
      const { supabase } = await import("../auth/client");
      await supabase.from("home_layouts").upsert({ user_id: uid, layout: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    }).catch(() => { /* the page already shows it; the next save tries again */ });
  }, 600);
}
