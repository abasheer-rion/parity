// The demo account behind every Parity Trade panel (DEC-0034, DEC-0040): one shared
// state for the order ticket, the bottom dock, Portfolio, Orders and Strategies. Virtual
// money, practice orders filled in this browser against delayed end-of-day prices. No
// real money and no real orders, ever (DEC-0019).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "../ui";
import { useRows } from "../lib/userStore";
import { loadDailyBars, priceText, digitsFor, type Instrument } from "../lib/tradeData";
import type { Bar } from "../lib/indicators";
import type { Point } from "../lib/types";
import { isActive, ORDER_TYPE_LABEL, type Book, type BracketInput, type Costs, type OrderInput, type PaperOrder } from "../lib/paper/matching";
import {
  accountStart, accountsTable, bookOf, cancel, catchUp, costsOf, ensureAccount, fillsTable, newAccount, ordersTable, positionsTable,
  sortFills, STARTING_CASH, submitBracket, submitOrder, toFill, toOrder, type AccountRow, type FillRow, type Snapshot,
} from "../lib/paper/account";
import { equityCurve, statsFor, type Stats } from "../lib/paper/stats";
import { readPref, writePref } from "./shared";

const REF_SYMBOL = "eq.US_MKT";

/** Tradable here: daily price series (indices, FX, crypto, commodities), not yields or macro levels. */
export const tradable = (s: Instrument) => s.kind === "price" && s.freq === "D";

export const usd = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const signedUsd = (v: number) => `${v > 0 ? "+" : ""}${usd(v)}`;
export const tone = (v: number | null | undefined) => (v == null || Math.abs(v) < 1e-9 ? "" : v > 0 ? "good" : "bad");

export interface Holding { symbol: string; qty: number; avg_cost: number; realized: number; px: Bar | null; value: number | null; cost: number; upl: number | null }

export type PlaceInput = { kind: "order"; input: OrderInput } | { kind: "bracket"; input: BracketInput };

export interface Demo {
  all: Instrument[];
  list: Instrument[];
  error: string | null;
  loaded: boolean;
  accounts: AccountRow[];
  account: AccountRow | undefined;
  chooseAccount: (id: string) => void;
  addAccount: () => void;
  book: Book | null;
  orders: PaperOrder[];
  open: PaperOrder[];
  done: PaperOrder[];
  fills: FillRow[];
  holdings: Holding[];
  equity: number;
  start: number;
  upl: number;
  realized: number;
  curve: Point[];
  stats: Stats;
  costs: Costs;
  last: (k: string) => Bar | null;
  refPrice: (k: string) => number | null;
  label: (k: string) => string;
  busy: boolean;
  place: (o: PlaceInput, symbol: string) => Promise<void>;
  cancelOrder: (id: string) => void;
}

const Ctx = createContext<Demo | null>(null);

export function useDemo(): Demo {
  const d = useContext(Ctx);
  if (!d) throw new Error("useDemo needs a DemoProvider");
  return d;
}

/** Daily bars for a set of instruments, loaded once each. */
function useBarsFor(list: Instrument[]): { bars: Record<string, Bar[]>; ready: (key: string) => boolean } {
  const [bars, setBars] = useState<Record<string, Bar[]>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const keys = list.map((s) => s.key).sort().join(",");
  useEffect(() => {
    let live = true;
    for (const inst of list) {
      if (bars[inst.key] || failed[inst.key]) continue;
      void loadDailyBars(inst).then((r) => {
        if (!live) return;
        if (r.status === "ok") setBars((b) => ({ ...b, [inst.key]: r.data }));
        else setFailed((f) => ({ ...f, [inst.key]: true }));
      });
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return { bars, ready: useCallback((k: string) => !!bars[k] || !!failed[k], [bars, failed]) };
}

/** Equity from the account's start (or its first fill) to the latest bar, on the union of trading days. */
function curveFor(account: AccountRow, fills: FillRow[], bars: Record<string, Bar[]>): Point[] {
  const fs = sortFills(fills).map(toFill);
  const syms = new Set([REF_SYMBOL, ...fs.map((f) => f.symbol)]);
  const dates = new Set<string>();
  for (const s of syms) for (const b of bars[s] ?? []) dates.add(b.time);
  const all = [...dates].sort();
  if (!all.length) return [];
  const startDay = accountStart(account);
  const firstFill = fs[0]?.bar_date;
  let anchor = all.filter((d) => d <= startDay).pop() ?? all[0];
  if (firstFill && firstFill < anchor) anchor = firstFill;
  return equityCurve(Number(account.starting_cash), fs, bars, all.filter((d) => d >= anchor));
}

export function DemoProvider({ all, focus, children }: { all: Instrument[]; focus: string[]; children: ReactNode }) {
  const list = useMemo(() => all.filter(tradable), [all]);
  const accounts = useRows(accountsTable, "paper_accounts");
  const creating = useRef(false);
  useEffect(() => {
    if (accounts.loading || accounts.error || accounts.rows.length || creating.current) return;
    creating.current = true;
    ensureAccount().catch((e: Error) => toast(e.message, { tone: "bad" }));
  }, [accounts.loading, accounts.error, accounts.rows.length]);

  const [pref, setPref] = useState(() => readPref("demo", { account: "" }));
  const chooseAccount = useCallback((id: string) => setPref((old) => { const next = { ...old, account: id }; writePref("demo", next); return next; }), []);
  const account = accounts.rows.find((a) => a.id === pref.account) ?? accounts.rows[0];
  const filter = { account_id: account?.id ?? "-" };
  const orders = useRows(ordersTable, "paper_orders", filter);
  const fills = useRows(fillsTable, "paper_fills", filter);
  const positions = useRows(positionsTable, "paper_positions", filter);

  const book = useMemo(() => (account ? bookOf(account, fills.rows) : null), [account, fills.rows]);
  const orderList = useMemo(() => orders.rows.map(toOrder), [orders.rows]);
  const focusKey = focus.join(",");
  const needed = useMemo(() => {
    const keys = new Set<string>([REF_SYMBOL, ...focusKey.split(",").filter(Boolean)]);
    for (const o of orderList) if (isActive(o)) keys.add(o.symbol);
    for (const f of fills.rows) keys.add(f.symbol);
    return all.filter((s) => keys.has(s.key));
  }, [all, focusKey, orderList, fills.rows]);
  const { bars, ready } = useBarsFor(needed);
  const last = useCallback((k: string): Bar | null => { const b = bars[k]; return b?.length ? b[b.length - 1] : null; }, [bars]);
  const refPrice = useCallback((k: string) => last(k)?.close ?? null, [last]);
  const label = useCallback((k: string) => { const s = all.find((x) => x.key === k); return s ? s.short || s.label : k; }, [all]);

  const loaded = !!account && !orders.loading && !fills.loading && !positions.loading;
  const snap: Snapshot | null = loaded && account ? { account, orders: orders.rows, fills: fills.rows, positions: positions.rows } : null;

  // Check waiting orders against any new delayed bars, once per new set of bars.
  const caught = useRef("");
  useEffect(() => {
    if (!snap) return;
    const pending = orderList.filter((o) => o.status === "pending");
    if (!pending.length || !pending.every((o) => ready(o.symbol))) return;
    const key = `${snap.account.id}|${pending.map((o) => `${o.id}:${o.checked_through ?? ""}`).join(",")}|${pending.map((o) => last(o.symbol)?.time ?? "").join(",")}`;
    if (caught.current === key) return;
    caught.current = key;
    catchUp(snap, bars).then((r) => { if (r.filled) toast(`${r.filled} order${r.filled > 1 ? "s" : ""} filled`); }, (e: Error) => toast(e.message, { tone: "bad" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.account.id, orderList, bars, ready]);

  const [busy, setBusy] = useState(false);
  const place = useCallback(async (o: PlaceInput, symbol: string) => {
    if (!snap) return;
    const bar = last(symbol);
    if (!bar) { toast("No price yet", { tone: "bad" }); return; }
    setBusy(true);
    try {
      const made = o.kind === "order" ? await submitOrder(snap, o.input, bar) : await submitBracket(snap, o.input, bar);
      const head = made[0];
      if (head.status === "rejected") toast(`Rejected: ${head.reason}`, { tone: "bad" });
      else if (head.status === "filled") toast(`${head.side === "buy" ? "Bought" : "Sold"} ${+head.qty.toFixed(6)} ${label(head.symbol)} @ ${priceText(head.fill_price, digitsFor(head.fill_price))}`, { tone: "good" });
      else toast(`${ORDER_TYPE_LABEL[head.type]} ${head.side} ${+head.qty.toFixed(6)} ${label(head.symbol)} working`);
    } catch (e) {
      toast((e as Error).message, { tone: "bad" });
    } finally { setBusy(false); }
  }, [snap, last, label]);

  const cancelOrder = useCallback((id: string) => {
    if (snap) cancel(snap, id).then(() => toast("Cancelled"), (e: Error) => toast(e.message, { tone: "bad" }));
  }, [snap]);

  const addAccount = useCallback(() => {
    accountsTable.insert(newAccount(`Demo ${accounts.rows.length + 1}`)).then((a) => chooseAccount(a.id), (e: Error) => toast(e.message, { tone: "bad" }));
  }, [accounts.rows.length, chooseAccount]);

  const holdings: Holding[] = useMemo(() => Object.values(book?.positions ?? {}).map((p) => {
    const px = bars[p.symbol]?.length ? bars[p.symbol][bars[p.symbol].length - 1] : null;
    const value = px ? p.qty * px.close : null;
    const cost = p.qty * p.avg_cost;
    return { ...p, px, value, cost, upl: value == null ? null : value - cost };
  }), [book, bars]);
  const mv = holdings.reduce((s, h) => s + (h.value ?? h.cost), 0);
  const equity = (book?.cash ?? 0) + mv;
  const start = account ? Number(account.starting_cash) : STARTING_CASH;
  const closed = useMemo(() => fills.rows.filter((f) => f.side === "sell" && f.realized_pnl != null).map((f) => Number(f.realized_pnl)), [fills.rows]);
  const realized = closed.reduce((s, p) => s + p, 0);
  const upl = holdings.reduce((s, h) => s + (h.upl ?? 0), 0);
  const curve = useMemo(() => (account ? curveFor(account, fills.rows, bars) : []), [account, fills.rows, bars]);
  const stats = useMemo(() => statsFor(curve, closed), [curve, closed]);
  const fillRows = useMemo(() => sortFills(fills.rows).reverse(), [fills.rows]);

  const value: Demo = {
    all, list, error: accounts.error ?? null, loaded, accounts: accounts.rows, account, chooseAccount, addAccount,
    book, orders: orderList, open: orderList.filter(isActive), done: orderList.filter((o) => !isActive(o)).reverse(), fills: fillRows,
    holdings, equity, start, upl, realized, curve, stats, costs: account ? costsOf(account) : { fee_bps: 0, fee_min: 0, slippage_bps: 0 },
    last, refPrice, label, busy: busy || !snap, place, cancelOrder,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
