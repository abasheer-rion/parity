// The demo account's records (DEC-0033) and the few steps that change them. The tables
// are in supabase/migrations/20261024010000_paper_trading.sql, each person sees only
// their own rows; the local preview keeps them in this browser (lib/userStore.ts).
//
// The fills are the record. Cash and holdings are rebuilt from them every time
// (bookFromFills), and the stored cash and positions are kept as a copy of that.
import { newId, table, type Row } from "../userStore";
import type { Bar } from "../indicators";
import {
  bookFromFills, cancelOrder, DEFAULT_COSTS, placeBracket, placeOrder, processBars, type Book, type BracketInput, type Costs,
  type OrderInput, type PaperFill, type PaperOrder, type Placed,
} from "./matching";

export const STARTING_CASH = 100_000;

export interface AccountRow extends Row {
  name: string;
  starting_cash: number;
  cash: number;
  fee_bps: number;
  fee_min: number;
  slippage_bps: number;
  strategy_source: "report" | "draft" | null;
  strategy_key: string | null;
  strategy_name: string | null;
  strategy_spec: Record<string, unknown> | null;
  strategy_start: string | null;
  strategy_capital: number | null;
  strategy_attached_at: string | null;
  reset_at: string | null;
}
export interface OrderRow extends Row, Omit<PaperOrder, "id"> { account_id: string }
export interface FillRow extends Row, PaperFill { account_id: string }
export interface PositionRow extends Row { account_id: string; symbol: string; qty: number; avg_cost: number; realized: number }

export const accountsTable = table<AccountRow>("paper_accounts");
export const ordersTable = table<OrderRow>("paper_orders");
export const fillsTable = table<FillRow>("paper_fills");
export const positionsTable = table<PositionRow>("paper_positions");

/** Numbers can come back from the database as strings (Postgres numeric); make them numbers. */
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : num(v));

export function costsOf(a: Pick<AccountRow, "fee_bps" | "fee_min" | "slippage_bps">): Costs {
  return { fee_bps: num(a.fee_bps), fee_min: num(a.fee_min), slippage_bps: num(a.slippage_bps) };
}

export function toOrder(r: OrderRow): PaperOrder {
  return {
    ...r, qty: num(r.qty), limit_price: numOrNull(r.limit_price), stop_price: numOrNull(r.stop_price), trail_pct: numOrNull(r.trail_pct),
    trail_ref: numOrNull(r.trail_ref), fill_price: numOrNull(r.fill_price), triggered: !!r.triggered,
  };
}

export function toFill(r: FillRow): PaperFill {
  return { order_id: r.order_id, symbol: r.symbol, side: r.side, qty: num(r.qty), price: num(r.price), fee: num(r.fee), bar_date: r.bar_date, realized_pnl: numOrNull(r.realized_pnl) };
}

/** Fills oldest first: by the bar they filled on, then by when they were recorded. */
export function sortFills(rows: FillRow[]): FillRow[] {
  return [...rows].sort((a, b) => (a.bar_date < b.bar_date ? -1 : a.bar_date > b.bar_date ? 1 : (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1));
}

export function bookOf(account: AccountRow, fills: FillRow[]): Book {
  return bookFromFills(num(account.starting_cash), sortFills(fills).map(toFill));
}

export function newAccount(name = "Demo account"): Omit<AccountRow, "id" | "user_id" | "created_at"> {
  return {
    name, starting_cash: STARTING_CASH, cash: STARTING_CASH, ...DEFAULT_COSTS,
    strategy_source: null, strategy_key: null, strategy_name: null, strategy_spec: null, strategy_start: null, strategy_capital: null, strategy_attached_at: null,
    reset_at: null,
  };
}

/** The signed-in person's accounts, creating the first one on the first visit. */
export async function ensureAccount(): Promise<AccountRow[]> {
  const list = await accountsTable.list();
  if (list.length) return list;
  return [await accountsTable.insert(newAccount())];
}

const orderRow = (o: PaperOrder, account: string) => ({ ...o, account_id: account });
const fillRow = (f: PaperFill, account: string) => ({ ...f, account_id: account });

/** Copy the rebuilt book into the account's cash and positions rows. */
export async function syncBook(account: AccountRow, book: Book, stored: PositionRow[]): Promise<void> {
  if (Math.abs(num(account.cash) - book.cash) > 1e-6) await accountsTable.update(account.id, { cash: Math.max(0, round8(book.cash)) });
  const have = new Map(stored.map((p) => [p.symbol, p]));
  const adds: Omit<PositionRow, "id" | "user_id" | "created_at">[] = [];
  for (const p of Object.values(book.positions)) {
    const row = have.get(p.symbol);
    const next = { qty: round8(p.qty), avg_cost: round8(p.avg_cost), realized: round8(p.realized) };
    if (!row) adds.push({ account_id: account.id, symbol: p.symbol, ...next });
    else if (Math.abs(num(row.qty) - next.qty) > 1e-9 || Math.abs(num(row.avg_cost) - next.avg_cost) > 1e-9) await positionsTable.update(row.id, next);
    have.delete(p.symbol);
  }
  if (adds.length) await positionsTable.insertMany(adds);
  for (const row of have.values()) await positionsTable.remove(row.id);
}

function round8(v: number): number { return Math.round(v * 1e8) / 1e8; }

export interface Snapshot { account: AccountRow; orders: OrderRow[]; fills: FillRow[]; positions: PositionRow[] }

async function savePlaced(s: Snapshot, placed: Placed): Promise<void> {
  // Parents first, so a bracket's children can point at their entry.
  await ordersTable.insertMany(placed.orders.map((o) => orderRow(o, s.account.id)));
  if (placed.fills.length) await fillsTable.insertMany(placed.fills.map((f) => fillRow(f, s.account.id)));
  await syncBook(s.account, placed.book, s.positions);
}

const ctxFor = (s: Snapshot, bar: Bar) => ({ bar, costs: costsOf(s.account), now: new Date().toISOString(), newId });

export async function submitOrder(s: Snapshot, input: OrderInput, bar: Bar): Promise<PaperOrder[]> {
  const placed = placeOrder(input, bookOf(s.account, s.fills), s.orders.map(toOrder), ctxFor(s, bar));
  await savePlaced(s, placed);
  return placed.orders;
}

export async function submitBracket(s: Snapshot, input: BracketInput, bar: Bar): Promise<PaperOrder[]> {
  const placed = placeBracket(input, bookOf(s.account, s.fills), s.orders.map(toOrder), ctxFor(s, bar));
  await savePlaced(s, placed);
  return placed.orders;
}

async function saveOrderChanges(before: PaperOrder[], after: PaperOrder[], ids: Iterable<string>): Promise<void> {
  const old = new Map(before.map((o) => [o.id, o]));
  for (const id of ids) {
    const next = after.find((o) => o.id === id);
    const prev = old.get(id);
    if (!next || !prev) continue;
    const patch: Partial<PaperOrder> = {};
    for (const k of Object.keys(next) as (keyof PaperOrder)[]) if (next[k] !== prev[k]) (patch as Record<string, unknown>)[k] = next[k];
    if (Object.keys(patch).length) await ordersTable.update(id, patch as Partial<OrderRow>);
  }
}

export async function cancel(s: Snapshot, id: string): Promise<void> {
  const before = s.orders.map(toOrder);
  const after = cancelOrder(before, id);
  await saveOrderChanges(before, after, after.filter((o, i) => o.status !== before[i].status).map((o) => o.id));
}

/** Check waiting orders against new bars and save what happened. Returns how many filled. */
export async function catchUp(s: Snapshot, bars: Record<string, Bar[]>): Promise<{ filled: number; changed: number }> {
  const before = s.orders.map(toOrder);
  if (!before.some((o) => o.status === "pending")) return { filled: 0, changed: 0 };
  const r = processBars(before, bookOf(s.account, s.fills), bars, costsOf(s.account));
  if (!r.changed.length) return { filled: 0, changed: 0 };
  await saveOrderChanges(before, r.orders, r.changed);
  if (r.fills.length) await fillsTable.insertMany(r.fills.map((f) => fillRow(f, s.account.id)));
  await syncBook(s.account, r.book, s.positions);
  return { filled: r.fills.length, changed: r.changed.length };
}

/** Start the account again: remove its orders, fills and positions and restore the cash. */
export async function resetAccount(account: AccountRow, startingCash = STARTING_CASH): Promise<void> {
  await fillsTable.removeWhere({ account_id: account.id });
  await ordersTable.removeWhere({ account_id: account.id });
  await positionsTable.removeWhere({ account_id: account.id });
  await accountsTable.update(account.id, { starting_cash: startingCash, cash: startingCash, reset_at: new Date().toISOString() });
}

export async function saveCosts(account: AccountRow, c: Costs): Promise<void> {
  await accountsTable.update(account.id, { fee_bps: c.fee_bps, fee_min: c.fee_min, slippage_bps: c.slippage_bps });
}

export interface Attach { source: "report" | "draft"; key: string | null; name: string; spec: Record<string, unknown> | null; start: string; capital: number }

export async function attachStrategy(account: AccountRow, a: Attach): Promise<void> {
  await accountsTable.update(account.id, {
    strategy_source: a.source, strategy_key: a.key, strategy_name: a.name, strategy_spec: a.spec, strategy_start: a.start, strategy_capital: a.capital,
    strategy_attached_at: new Date().toISOString(),
  });
}

export async function detachStrategy(account: AccountRow): Promise<void> {
  await accountsTable.update(account.id, {
    strategy_source: null, strategy_key: null, strategy_name: null, strategy_spec: null, strategy_start: null, strategy_capital: null, strategy_attached_at: null,
  });
}

/** The day the account's history starts: its last reset, or when it was made. */
export function accountStart(a: AccountRow): string {
  return (a.reset_at ?? a.created_at ?? new Date().toISOString()).slice(0, 10);
}
