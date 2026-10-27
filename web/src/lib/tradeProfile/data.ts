// Reading and saving the trade profile. Demo fills come from the paper tables (lib/paper/
// account.ts); the leaderboard reads only the leaderboard_public view, and the caller's own
// numbers come from my_trade_stats, so no other person's private rows ever reach the page
// (supabase/migrations/20261112000000_trade_profile.sql). The local preview has no
// Supabase user: there the profile is kept in this browser and the board is empty.
import { accountsTable, fillsTable, type AccountRow, type FillRow } from "../paper/account";
import { isMockStore } from "../userStore";
import type { BoardPeriod, BoardRow } from "./logic";

export interface Profile { handle: string | null; display_name: string | null; country: string | null; on_leaderboard: boolean }
export const EMPTY_PROFILE: Profile = { handle: null, display_name: null, country: null, on_leaderboard: false };

export interface MyStats {
  period: BoardPeriod;
  trades: number;
  active_days: number;
  total_return: number | null;
  risk_adjusted: number | null;
  win_rate: number | null;
  max_drawdown: number | null;
  min_trades: number;
  qualifies: boolean;
  on_leaderboard: boolean;
  board_rank: number | null;
}

async function client() {
  const { supabase } = await import("../../auth/client");
  return supabase;
}

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export async function loadDemo(): Promise<{ accounts: AccountRow[]; fills: FillRow[] }> {
  const [accounts, fills] = await Promise.all([accountsTable.list(), fillsTable.list()]);
  return { accounts, fills };
}

const LOCAL_KEY = "parity.tradeProfile.v1";

export async function loadProfile(): Promise<Profile> {
  if (isMockStore()) {
    try { return { ...EMPTY_PROFILE, ...(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "null") ?? {}) }; } catch { return EMPTY_PROFILE; }
  }
  const { data, error } = await (await client()).from("trader_profiles").select("handle, display_name, country, on_leaderboard").limit(1);
  if (error) throw new Error("Could not load your leaderboard settings.");
  const row = (data ?? [])[0] as Partial<Profile> | undefined;
  return row ? { handle: row.handle ?? null, display_name: row.display_name ?? null, country: row.country ?? null, on_leaderboard: !!row.on_leaderboard } : EMPTY_PROFILE;
}

/** Saves the caller's own profile row (one per person, keyed by their user id in the database). */
export async function saveProfile(p: Profile): Promise<void> {
  const row = { handle: p.handle?.trim() || null, display_name: p.display_name?.trim() || null, country: p.country || null, on_leaderboard: p.on_leaderboard };
  if (isMockStore()) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(row)); } catch { /* memory only */ }
    return;
  }
  const { error } = await (await client()).from("trader_profiles").upsert(row, { onConflict: "user_id" });
  if (!error) return;
  if (/duplicate key|unique/i.test(`${error.message} ${error.code ?? ""}`) || error.code === "23505") throw new Error("That handle is taken. Try another.");
  throw new Error("Could not save. Try again.");
}

export async function loadMyStats(): Promise<MyStats[]> {
  if (isMockStore()) return [];
  const { data, error } = await (await client()).from("my_trade_stats").select("*");
  if (error) throw new Error("Could not load your stats.");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    period: r.period as BoardPeriod,
    trades: num(r.trades) ?? 0,
    active_days: num(r.active_days) ?? 0,
    total_return: num(r.total_return),
    risk_adjusted: num(r.risk_adjusted),
    win_rate: num(r.win_rate),
    max_drawdown: num(r.max_drawdown),
    min_trades: num(r.min_trades) ?? 0,
    qualifies: !!r.qualifies,
    on_leaderboard: !!r.on_leaderboard,
    board_rank: num(r.board_rank),
  }));
}

export async function loadBoard(period: BoardPeriod): Promise<BoardRow[]> {
  if (isMockStore()) return [];
  const { data, error } = await (await client()).from("leaderboard_public").select("*").eq("period", period).order("rank", { ascending: true }).limit(500);
  if (error) throw new Error("Could not load the leaderboard.");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    period: r.period as BoardPeriod,
    rank: num(r.rank) ?? 0,
    handle: String(r.handle ?? ""),
    display_name: (r.display_name as string | null) ?? null,
    initials: String(r.initials ?? ""),
    country: (r.country as string | null) ?? null,
    region: (r.region as string | null) ?? null,
    trades: num(r.trades) ?? 0,
    active_days: num(r.active_days) ?? 0,
    total_return: num(r.total_return) ?? 0,
    risk_adjusted: num(r.risk_adjusted),
    win_rate: num(r.win_rate),
    max_drawdown: num(r.max_drawdown),
    min_trades: num(r.min_trades) ?? 0,
    is_you: !!r.is_you,
  }));
}
