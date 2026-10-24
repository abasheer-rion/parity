// Each signed-in person's own Trade records: chart drawings, watchlists, alerts and the
// demo account. They live in Supabase tables where row level security lets a person
// read and write only their own rows (supabase/migrations/*_trade_*.sql).
//
// The local preview (VITE_AUTH_BYPASS=1) has no Supabase user, so it uses a mock store
// in this browser instead. That branch is only reachable when there is no user id,
// which never happens behind the real sign-in.
import { useCallback, useEffect, useState } from "react";

export interface Row { id: string; user_id?: string; created_at?: string }

let currentUser: string | null = null;
let forceLocal = false;
const listeners = new Set<(table: string) => void>();

/** Called once by the app with the signed-in user's id (null in the local preview). */
export function setStoreUser(id: string | null) { currentUser = id; }
/** Tests use the in-browser store. */
export function setLocalStore(on = true) { forceLocal = on; }
export const isMockStore = () => forceLocal || !currentUser;

function emit(table: string) { for (const f of listeners) f(table); }

// ------------------------------------------------------------------ local mock

const memory = new Map<string, unknown[]>();
const KEY = (t: string) => `parity.demo.${t}`;

function readLocal<T>(table: string): T[] {
  try {
    const raw = window.localStorage.getItem(KEY(table));
    if (raw) return JSON.parse(raw) as T[];
  } catch { /* storage blocked: fall back to memory */ }
  return (memory.get(table) as T[] | undefined) ?? [];
}

function writeLocal<T>(table: string, rows: T[]) {
  memory.set(table, rows);
  try { window.localStorage.setItem(KEY(table), JSON.stringify(rows)); } catch { /* memory only */ }
}

export function newId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

const matches = (row: Record<string, unknown>, filter: Record<string, unknown>) => Object.entries(filter).every(([k, v]) => row[k] === v);

// ------------------------------------------------------------------ the table API

export interface Table<T extends Row> {
  list(filter?: Partial<T>): Promise<T[]>;
  insert(row: Omit<T, "id" | "user_id" | "created_at"> & Partial<Pick<T, "id">>): Promise<T>;
  insertMany(rows: (Omit<T, "id" | "user_id" | "created_at"> & Partial<Pick<T, "id">>)[]): Promise<T[]>;
  update(id: string, patch: Partial<T>): Promise<void>;
  remove(id: string): Promise<void>;
  removeWhere(filter: Partial<T>): Promise<void>;
}

async function client() {
  const { supabase } = await import("../auth/client");
  return supabase;
}

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`Could not ${what}: ${error.message}`);
}

export function table<T extends Row>(name: string): Table<T> {
  const local: Table<T> = {
    async list(filter = {}) { return readLocal<T>(name).filter((r) => matches(r as unknown as Record<string, unknown>, filter)); },
    async insert(row) { return (await local.insertMany([row]))[0]; },
    async insertMany(rows) {
      const now = new Date().toISOString();
      const made = rows.map((r) => ({ id: newId(), created_at: now, user_id: "local", ...r }) as unknown as T);
      writeLocal(name, [...readLocal<T>(name), ...made]);
      emit(name);
      return made;
    },
    async update(id, patch) { writeLocal(name, readLocal<T>(name).map((r) => (r.id === id ? { ...r, ...patch } : r))); emit(name); },
    async remove(id) { writeLocal(name, readLocal<T>(name).filter((r) => r.id !== id)); emit(name); },
    async removeWhere(filter) { writeLocal(name, readLocal<T>(name).filter((r) => !matches(r as unknown as Record<string, unknown>, filter))); emit(name); },
  };
  const remote: Table<T> = {
    async list(filter = {}) {
      let q = (await client()).from(name).select("*");
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as never);
      const { data, error } = await q.order("created_at", { ascending: true });
      fail(`load your ${name.replace(/_/g, " ")}`, error);
      return (data ?? []) as T[];
    },
    async insert(row) { return (await remote.insertMany([row]))[0]; },
    async insertMany(rows) {
      // user_id defaults to auth.uid() in the database, and the policy checks it.
      const { data, error } = await (await client()).from(name).insert(rows as never).select("*");
      fail("save", error);
      emit(name);
      return (data ?? []) as T[];
    },
    async update(id, patch) {
      const { error } = await (await client()).from(name).update(patch as never).eq("id", id);
      fail("save", error);
      emit(name);
    },
    async remove(id) {
      const { error } = await (await client()).from(name).delete().eq("id", id);
      fail("delete", error);
      emit(name);
    },
    async removeWhere(filter) {
      let q = (await client()).from(name).delete();
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as never);
      const { error } = await q;
      fail("delete", error);
      emit(name);
    },
  };
  return new Proxy({} as Table<T>, { get: (_t, key: keyof Table<T>) => (isMockStore() ? local : remote)[key] });
}

/** Rows of one table for the current user, reloaded whenever the table changes. */
export function useRows<T extends Row>(t: Table<T>, name: string, filter?: Partial<T>): { rows: T[]; loading: boolean; error: string | null; reload: () => void } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(filter ?? {});
  const reload = useCallback(() => {
    t.list(filter).then((r) => { setRows(r); setError(null); }, (e: Error) => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, key]);
  useEffect(() => {
    reload();
    const on = (changed: string) => { if (changed === name) reload(); };
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, [reload, name]);
  return { rows, loading, error, reload };
}
