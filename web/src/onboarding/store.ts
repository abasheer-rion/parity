// Each person's checklist and tour state (DEC-0060), kept in Supabase's onboarding_state (one
// row per person, row level security: own row only). The local preview has no Supabase user,
// so it keeps the same row in this browser instead. Every page that shows the checklist or a
// tour shares this one store.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../auth/client";
import { track } from "../lib/analytics";
import { onTableChange } from "../lib/userStore";
import { COLUMN, DOABLE, type ItemId, type Signals, type Stamps } from "./items";
import { localSignals, remoteSignals } from "./signals";

export interface OnboardingRow {
  checklist_hidden: boolean;
  tours_off: boolean;
  tours_seen: string[];
  notify_brokerage: boolean;
  email_at: string | null; ai_at: string | null; verify_at: string | null; trade_at: string | null;
  watch_at: string | null; lesson_at: string | null; mfa_at: string | null; wallet_at: string | null;
}

export interface OnboardingState {
  ready: boolean;
  /** True when the row lives in this browser (local preview, or the table is not there yet). */
  local: boolean;
  row: OnboardingRow;
  signals: Signals;
  mfaAvailable: boolean;
  /** True once the live signals have been read, so the checklist draws once, without a jump. */
  checked: boolean;
}

const EMPTY: OnboardingRow = {
  checklist_hidden: false, tours_off: false, tours_seen: [], notify_brokerage: false,
  email_at: null, ai_at: null, verify_at: null, trade_at: null, watch_at: null, lesson_at: null, mfa_at: null, wallet_at: null,
};
const LOCAL_KEY = "parity.onboarding.v1";
const AREA = /^[a-z][a-z0-9-]{0,39}$/;

// The last state this browser saw, so Home can draw the checklist in its final shape on the
// first frame instead of making the page jump when the data arrives. Tours still wait for the
// real row (`ready`); only the checklist reads the cached one.
const CACHE_KEY = "parity.onboarding.cache.v1";

function readCache(): Partial<OnboardingState> {
  try {
    const c = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null");
    return c?.row ? { row: { ...EMPTY, ...c.row }, signals: c.signals ?? {}, mfaAvailable: c.mfaAvailable !== false, checked: true } : {};
  } catch {
    return {};
  }
}

let state: OnboardingState = { ready: false, local: true, row: EMPTY, signals: {}, mfaAvailable: true, checked: false, ...(typeof window !== "undefined" ? readCache() : {}) };
let userId: string | null = null;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
let writes: Promise<unknown> = Promise.resolve();

function set(next: Partial<OnboardingState>) {
  state = { ...state, ...next };
  if (state.ready && state.checked) {
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ row: state.row, signals: state.signals, mfaAvailable: state.mfaAvailable })); } catch { /* no cache */ }
  }
  for (const f of listeners) f();
}

function readLocal(): OnboardingRow {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeLocal(row: OnboardingRow) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(row)); } catch { /* memory only */ }
}

/** Loads the person's row once per page. Safe to call often. */
export function ensureLoaded(): Promise<void> {
  loading ??= (async () => {
    try {
      const sb = supabase;
      const { data } = await sb.auth.getSession();
      userId = data.session?.user.id ?? null;
      if (!userId) { set({ ready: true, local: true, row: readLocal() }); return; }
      const { data: row, error } = await sb.from("onboarding_state").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      set({ ready: true, local: false, row: { ...EMPTY, ...(row ?? {}) } });
    } catch {
      // The table is missing (migration not applied yet) or the network failed: keep going in
      // this browser so nothing breaks, and never block a page on it.
      userId = null;
      set({ ready: true, local: true, row: readLocal() });
    }
    startWatching();
    void refreshSignals();
  })();
  return loading;
}

/** Saves part of the row: at once on this page, then in Supabase (in order, one at a time). */
async function save(patch: Partial<OnboardingRow>) {
  set({ row: { ...state.row, ...patch } });
  await ensureLoaded();
  const row = { ...state.row, ...patch };
  set({ row });
  if (state.local) { writeLocal(row); return; }
  const uid = userId;
  writes = writes.then(async () => {
    const { error } = await supabase.from("onboarding_state").upsert({ user_id: uid, ...patch }, { onConflict: "user_id" });
    if (error) throw error;
  }).catch(() => { /* the page already shows the change; the next save tries again */ });
  return writes;
}

/** Marks a checklist item done, once. Called where the action happens, such as Verify. */
export async function markDone(id: Exclude<ItemId, "broker">) {
  await ensureLoaded();
  const col = COLUMN[id] as keyof OnboardingRow;
  if (state.row[col]) return;
  track("onboarding_item_done", { item: id });
  await save({ [col]: new Date().toISOString() } as Partial<OnboardingRow>);
}

let refreshing: Promise<void> | null = null;

/** Reads the live signals and saves a done time for any item that is newly done. */
export function refreshSignals(): Promise<void> {
  refreshing ??= (async () => {
    try {
      const { mfaAvailable, ...signals } = state.local ? localSignals() : await remoteSignals(supabase);
      set({ signals, mfaAvailable, checked: true });
      const now = new Date().toISOString();
      const patch: Partial<OnboardingRow> = {};
      for (const id of DOABLE) {
        const col = COLUMN[id] as keyof OnboardingRow;
        if (signals[id] && !state.row[col]) { (patch as Record<string, string>)[col] = now; track("onboarding_item_done", { item: id }); }
      }
      if (Object.keys(patch).length) await save(patch);
    } finally {
      refreshing = null;
      if (!state.checked) set({ checked: true });
    }
  })();
  return refreshing;
}

let watching = false;
function startWatching() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  let t = 0;
  const soon = () => { window.clearTimeout(t); t = window.setTimeout(() => void refreshSignals(), 800); };
  // A demo order, an alert, a watchlist, a finished lesson or a wallet saved on this page.
  onTableChange((table) => {
    if (["paper_orders", "trade_alerts", "trade_watchlists", "academy_progress", "crypto_wallets"].includes(table)) soon();
  });
  // Coming back to the tab after connecting an AI app or confirming the email elsewhere.
  let last = Date.now();
  window.addEventListener("focus", () => { if (Date.now() - last > 15_000) { last = Date.now(); soon(); } });
}

export function stampsOf(row: OnboardingRow): Stamps {
  return Object.fromEntries(DOABLE.map((id) => [id, row[COLUMN[id] as keyof OnboardingRow] as string | null]));
}

// ---------------------------------------------------------------- checklist and tours

export function setChecklistHidden(hidden: boolean) {
  track(hidden ? "checklist_hidden" : "checklist_shown");
  return save({ checklist_hidden: hidden });
}

export function setNotifyBrokerage(on: boolean) {
  track("brokerage_notify", { on });
  return save({ notify_brokerage: on });
}

/** Whether the first-run tour for `area` should open now. */
export function tourDue(s: OnboardingState, area: string): boolean {
  return s.ready && !s.row.tours_off && !s.row.tours_seen.includes(area);
}

/** Records that the person finished or skipped one area's tour, so it never opens again. */
export async function markTourSeen(area: string) {
  if (!AREA.test(area)) return;
  await ensureLoaded();
  let seen = state.row.tours_seen;
  // Another tab may have added an area since this page loaded: merge with the saved list.
  if (!state.local && userId) {
    try {
      const { data } = await supabase.from("onboarding_state").select("tours_seen").eq("user_id", userId).maybeSingle();
      seen = [...new Set([...seen, ...((data?.tours_seen as string[] | undefined) ?? [])])];
    } catch { /* use what this page has */ }
  }
  if (seen.includes(area) && state.row.tours_seen.includes(area)) return;
  await save({ tours_seen: [...new Set([...seen, area])].slice(-40) });
}

/** "Skip all tours": no first-run tour opens again until the person turns them back on. */
export function skipAllTours(area?: string) {
  track("tours_skipped_all", { area: area ?? "none" });
  const seen = area && AREA.test(area) ? [...new Set([...state.row.tours_seen, area])].slice(-40) : state.row.tours_seen;
  return save({ tours_off: true, tours_seen: seen });
}

/** "Show tours again" in Account settings: every first-run tour opens again, once. */
export function resetTours() {
  track("tours_reset");
  return save({ tours_off: false, tours_seen: [] });
}

/** The store, kept up to date. Loads the row on first use. */
export function useOnboarding(): OnboardingState {
  useEffect(() => { void ensureLoaded(); }, []);
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => state);
}

/** Tests start from a clean store. */
export function resetForTests(next?: Partial<OnboardingState>) {
  state = { ready: false, local: true, row: EMPTY, signals: {}, mfaAvailable: true, checked: false, ...next };
  loading = next?.ready ? Promise.resolve() : null;
  userId = null;
}
