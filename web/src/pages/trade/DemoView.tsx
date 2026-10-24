// The demo account (DEC-0034): virtual money, practice orders filled in this browser
// against delayed end-of-day prices, positions, orders, fills, an equity curve with
// performance numbers, and strategy forward testing. No real money and no real orders,
// ever; real trading is a future decision for the owner (DEC-0019).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, DataTable, Dialog, LineChart, Segmented, Select, toast, type Column } from "../../ui";
import { Icon } from "../../ui/icons";
import { Skeleton } from "../../ui/skeleton";
import { fmt } from "../../ui/text";
import { useRows } from "../../lib/userStore";
import { loadDailyBars, priceText, digitsFor, type Instrument } from "../../lib/tradeData";
import type { Bar } from "../../lib/indicators";
import type { Point } from "../../lib/types";
import { isActive, ORDER_TYPE_LABEL, trailingStopLevel, type Costs, type PaperOrder } from "../../lib/paper/matching";
import {
  accountStart, accountsTable, bookOf, cancel, catchUp, costsOf, ensureAccount, fillsTable, newAccount, ordersTable, positionsTable, resetAccount, saveCosts,
  sortFills, STARTING_CASH, submitBracket, submitOrder, toFill, toOrder, type AccountRow, type FillRow, type Snapshot,
} from "../../lib/paper/account";
import { equityCurve, statsFor } from "../../lib/paper/stats";
import { OrderTicket, type TicketProps } from "./OrderTicket";
import { ForwardTest } from "./ForwardTest";
import { hashParam, readPref, setHashParam, useInstruments, writePref } from "./shared";

const REF_SYMBOL = "eq.US_MKT";
const usd = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signedUsd = (v: number) => `${v > 0 ? "+" : ""}${usd(v)}`;
const tone = (v: number | null | undefined) => (v == null || Math.abs(v) < 1e-9 ? "" : v > 0 ? "good" : "bad");

/** Tradable here: daily price series (indices, FX, crypto, commodities), not yields or macro levels. */
export const tradable = (s: Instrument) => s.kind === "price" && s.freq === "D";

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

export function DemoView() {
  const insts = useInstruments();
  const all = useMemo(() => (insts.status === "ok" ? insts.data : []), [insts]);
  const list = useMemo(() => all.filter(tradable), [all]);
  const accounts = useRows(accountsTable, "paper_accounts");
  const creating = useRef(false);
  useEffect(() => {
    if (accounts.loading || accounts.error || accounts.rows.length || creating.current) return;
    creating.current = true;
    ensureAccount().catch((e: Error) => toast(e.message, { tone: "bad" }));
  }, [accounts.loading, accounts.error, accounts.rows.length]);

  const [pref, setPref] = useState(() => readPref("demo", { account: "", symbol: "" }));
  const savePref = (p: Partial<typeof pref>) => setPref((old) => { const next = { ...old, ...p }; writePref("demo", next); return next; });
  const account = accounts.rows.find((a) => a.id === pref.account) ?? accounts.rows[0];
  const filter = { account_id: account?.id ?? "-" };
  const orders = useRows(ordersTable, "paper_orders", filter);
  const fills = useRows(fillsTable, "paper_fills", filter);
  const positions = useRows(positionsTable, "paper_positions", filter);

  const [symbol, setSymbol] = useState(() => hashParam("s") ?? pref.symbol);
  const ticketInst = list.find((s) => s.key === symbol) ?? list.find((s) => s.key === REF_SYMBOL) ?? list[0];
  const pickSymbol = (k: string) => { setSymbol(k); setHashParam("s", k); savePref({ symbol: k }); };

  const book = useMemo(() => (account ? bookOf(account, fills.rows) : null), [account, fills.rows]);
  const orderList = useMemo(() => orders.rows.map(toOrder), [orders.rows]);
  const needed = useMemo(() => {
    const keys = new Set<string>([REF_SYMBOL]);
    if (ticketInst) keys.add(ticketInst.key);
    for (const o of orderList) if (isActive(o)) keys.add(o.symbol);
    for (const f of fills.rows) keys.add(f.symbol);
    return all.filter((s) => keys.has(s.key));
  }, [all, ticketInst, orderList, fills.rows]);
  const { bars, ready } = useBarsFor(needed);
  const last = (k: string): Bar | null => { const b = bars[k]; return b?.length ? b[b.length - 1] : null; };
  const refPrice = (k: string) => last(k)?.close ?? null;
  const label = (k: string) => { const s = all.find((x) => x.key === k); return s ? s.short || s.label : k; };

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
    catchUp(snap, bars).then((r) => { if (r.filled) toast(`${r.filled} demo order${r.filled > 1 ? "s" : ""} filled on new delayed prices`); }, (e: Error) => toast(e.message, { tone: "bad" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.account.id, orderList, bars, ready]);

  const [busy, setBusy] = useState(false);
  const onPlace: TicketProps["onPlace"] = async (o) => {
    if (!snap || !ticketInst) return;
    const bar = last(ticketInst.key);
    if (!bar) return;
    setBusy(true);
    try {
      const made = o.kind === "order" ? await submitOrder(snap, o.input, bar) : await submitBracket(snap, o.input, bar);
      const head = made[0];
      if (head.status === "rejected") toast(`Rejected: ${head.reason}`, { tone: "bad" });
      else if (head.status === "filled") toast(`Demo ${head.side} filled: ${+head.qty.toFixed(6)} ${label(head.symbol)} at ${priceText(head.fill_price, digitsFor(head.fill_price))}`);
      else toast(`Demo ${ORDER_TYPE_LABEL[head.type].toLowerCase()} order placed. It is checked against each new daily bar.`);
    } catch (e) {
      toast((e as Error).message, { tone: "bad" });
    } finally { setBusy(false); }
  };

  // Value and curve.
  const holdings = useMemo(() => Object.values(book?.positions ?? {}).map((p) => {
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
  const curve = useMemo(() => (account ? curveFor(account, fills.rows, bars) : []), [account, fills.rows, bars]);
  const stats = useMemo(() => statsFor(curve, closed), [curve, closed]);

  const [view, setView] = useState<"open" | "history" | "fills">("open");
  const [resetOpen, setResetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (insts.status === "missing" || insts.status === "error") {
    return <div className="mk-banner" role="note"><strong>No price data yet.</strong> {insts.message}</div>;
  }
  if (accounts.error) return <div className="mk-banner" role="note"><strong>Could not open your demo account.</strong> {accounts.error}</div>;

  const open = orderList.filter(isActive);
  const done = orderList.filter((o) => !isActive(o)).reverse();
  const fillRows = sortFills(fills.rows).reverse();

  return (
    <div className="pt">
      <div className="pt-banner" role="note">
        <Icon name="info" size={16} />
        <div>
          <strong>Demo account. No real money.</strong>{" "}
          Orders here are practice: they are filled in your browser against delayed, end-of-day prices, and nothing is sent to any broker or exchange.
          This is a demo for testing ideas, not an exchange, and not advice.
        </div>
      </div>

      <div className="pt-bar">
        {accounts.rows.length > 1 && account && (
          <Select label="Demo account" value={account.id} onChange={(id) => savePref({ account: id })} options={accounts.rows.map((a) => [a.id, a.name] as [string, string])} />
        )}
        <span className="pt-bar-name">{account ? account.name : "Opening your demo account"}</span>
        <span className="pt-spacer" />
        <Button size="sm" icon="plus" disabled={!account} onClick={() => accountsTable.insert(newAccount(`Demo account ${accounts.rows.length + 1}`)).then((a) => savePref({ account: a.id }), (e: Error) => toast(e.message, { tone: "bad" }))}>New demo account</Button>
        <Button size="sm" icon="gear" disabled={!account} onClick={() => setSettingsOpen(true)}>Fees and slippage</Button>
        <Button size="sm" icon="restart" disabled={!account} onClick={() => setResetOpen(true)}>Reset</Button>
      </div>

      <dl className="pt-stats" aria-label="Demo account summary">
        <div><dt>Equity</dt><dd className="tabular">{book ? usd(equity) : <Skeleton width={110} height={26} />}</dd></div>
        <div><dt>Cash</dt><dd className="tabular">{book ? usd(book.cash) : <Skeleton width={110} height={26} />}</dd></div>
        <div><dt>Total return</dt><dd className={`tabular ${tone(equity - start)}`}>{book ? fmt.signedPct(equity / start - 1, 2) : <Skeleton width={70} height={26} />}</dd></div>
        <div><dt>Unrealized P&amp;L</dt><dd className={`tabular ${tone(mv - holdings.reduce((s, h) => s + h.cost, 0))}`}>{book ? signedUsd(holdings.reduce((s, h) => s + (h.upl ?? 0), 0)) : <Skeleton width={90} height={26} />}</dd></div>
        <div><dt>Realized P&amp;L</dt><dd className={`tabular ${tone(realized)}`}>{book ? signedUsd(realized) : <Skeleton width={90} height={26} />}</dd></div>
      </dl>

      <div className="pt-main">
        <OrderTicket list={list} symbol={ticketInst?.key ?? ""} onSymbol={pickSymbol} bar={ticketInst ? last(ticketInst.key) : null}
          book={book ?? { cash: 0, positions: {} }} orders={orderList} costs={account ? costsOf(account) : { fee_bps: 0, fee_min: 0, slippage_bps: 0 }}
          refPrice={refPrice} busy={busy || !snap} onPlace={onPlace} />
        <div className="pt-side">
          <section className="mcard flush pt-card" aria-label="Positions">
            <div className="mcard-head pt-pad"><h2>Positions</h2><span className="muted small">Valued at the latest delayed close</span></div>
            <div className="pt-scroll">
              <DataTable dense rows={holdings} rowKey={(h) => h.symbol} empty={loaded ? "No positions yet. Place a demo buy to start." : "Loading"}
                columns={[
                  { key: "s", header: "Instrument", align: "left", sort: (h) => label(h.symbol), render: (h) => <a href={`#/trade?s=${h.symbol}`}>{label(h.symbol)}</a> },
                  { key: "q", header: "Qty", sort: (h) => h.qty, render: (h) => +h.qty.toFixed(6) },
                  { key: "a", header: "Avg cost", sort: (h) => h.avg_cost, render: (h) => priceText(h.avg_cost) },
                  { key: "l", header: "Last close", sort: (h) => h.px?.close ?? null, render: (h) => (h.px ? <span title={`Close on ${h.px.time}, delayed`}>{priceText(h.px.close)}</span> : "n/a") },
                  { key: "v", header: "Value", sort: (h) => h.value, render: (h) => (h.value == null ? "n/a" : usd(h.value)) },
                  { key: "u", header: "Unrealized", sort: (h) => h.upl, tone: (h) => h.upl, render: (h) => (h.upl == null ? "n/a" : `${signedUsd(h.upl)} (${fmt.signedPct(h.upl / h.cost, 1)})`) },
                ] satisfies Column<(typeof holdings)[number]>[]} />
            </div>
          </section>

          <section className="mcard pt-card" aria-label="Equity curve and performance">
            <div className="mcard-head"><h2>Equity</h2><span className="muted small">Since {account ? accountStart(account) : "the start"}</span></div>
            <div className="pt-chart">
              {curve.length > 1
                ? <LineChart label="Demo account equity" height={220} format={(v) => `$${Math.round(v).toLocaleString("en-US")}`} series={[{ name: "Equity", color: "var(--series-1)", points: curve, emphasis: true }]} />
                : <div className="pt-chart-empty muted">{!loaded ? "Loading" : fills.rows.length ? "One day so far. The curve grows by one point each day new delayed prices arrive." : "The curve starts with your first trade and grows by one point each day new delayed prices arrive."}</div>}
            </div>
            <dl className="pt-kv pt-kv-5">
              <div><dt>Total return</dt><dd className="tabular">{fmt.signedPct(stats.total_return, 2)}</dd></div>
              <div><dt>Win rate</dt><dd className="tabular">{stats.win_rate == null ? "n/a" : `${fmt.pct(stats.win_rate, 0)} of ${stats.closed_trades}`}</dd></div>
              <div><dt>Profit factor</dt><dd className="tabular">{fmt.num(stats.profit_factor)}</dd></div>
              <div><dt>Sharpe</dt><dd className="tabular">{fmt.num(stats.sharpe)}</dd></div>
              <div><dt>Max drawdown</dt><dd className="tabular">{fmt.pct(stats.max_drawdown, 2)}</dd></div>
            </dl>
            <p className="muted small pt-note">Win rate and profit factor count closed trades (each sell) after fees. Sharpe and max drawdown use the engine's definitions on daily equity: zero risk-free rate, 252 days a year.</p>
          </section>
        </div>
      </div>

      <section className="mcard flush pt-card" aria-label="Orders and fills">
        <div className="mcard-head pt-pad">
          <Segmented size="sm" label="Show" value={view} onChange={setView} options={[["open", `Open orders (${open.length})`], ["history", "Order history"], ["fills", "Fills"]]} />
        </div>
        <div className="pt-scroll">
          {view === "open" && <OrderTable rows={open} label={label} empty={loaded ? "No open orders." : "Loading"} onCancel={(id) => snap && cancel(snap, id).then(() => toast("Demo order cancelled"), (e: Error) => toast(e.message, { tone: "bad" }))} />}
          {view === "history" && <OrderTable rows={done} label={label} empty="No finished orders yet." />}
          {view === "fills" && <FillTable rows={fillRows} label={label} />}
        </div>
      </section>

      {account && <ForwardTest account={account} />}

      <p className="muted small">
        How fills work: a market order fills at the latest delayed close plus slippage. Other orders are checked against each new daily bar dated after the
        day you placed them; a daily bar opens at the previous close, so a gap through a stop fills at that open. Long only: no short selling, no margin.
        Fees and slippage are set per account. Read the full rules in DEC-0034.
      </p>

      {account && <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} account={account} />}
      {account && <CostsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} account={account} />}
    </div>
  );
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

function priceCell(o: PaperOrder): string {
  const parts: string[] = [];
  if (o.limit_price != null) parts.push(`limit ${priceText(o.limit_price)}`);
  if (o.stop_price != null) parts.push(`stop ${priceText(o.stop_price)}`);
  if (o.type === "trailing_stop") { const lvl = trailingStopLevel(o); parts.push(`trail ${o.trail_pct}%${lvl != null && isActive(o) ? `, now ${priceText(lvl)}` : ""}`); }
  if (o.type === "stop_limit" && o.triggered && isActive(o)) parts.push("triggered");
  return parts.join(", ") || "market";
}

const ROLE: Record<string, string> = { entry: "Bracket entry", take_profit: "Take-profit", stop_loss: "Stop-loss" };

function OrderTable({ rows, label, empty, onCancel }: { rows: PaperOrder[]; label: (k: string) => string; empty: string; onCancel?: (id: string) => void }) {
  const cols: Column<PaperOrder>[] = [
    { key: "t", header: "Placed", align: "left", sort: (o) => o.placed_at, render: (o) => o.placed_at.slice(0, 10) },
    { key: "s", header: "Instrument", align: "left", sort: (o) => label(o.symbol), render: (o) => label(o.symbol) },
    { key: "d", header: "Side", align: "left", render: (o) => (o.side === "buy" ? "Buy" : "Sell") },
    { key: "y", header: "Type", align: "left", render: (o) => `${ORDER_TYPE_LABEL[o.type]}${o.role ? ` (${ROLE[o.role]})` : ""}` },
    { key: "q", header: "Qty", sort: (o) => o.qty, render: (o) => +o.qty.toFixed(6) },
    { key: "p", header: "Prices", align: "left", render: priceCell },
    { key: "st", header: "Status", align: "left", render: (o) => <span title={o.reason ?? undefined}>{statusText(o)}</span> },
  ];
  if (onCancel) cols.push({ key: "x", header: "", align: "right", render: (o) => <Button size="sm" variant="tertiary" onClick={() => onCancel(o.id)}>Cancel</Button> });
  return <DataTable dense rows={rows} rowKey={(o) => o.id} columns={cols} empty={empty} initialSort={{ key: "t", dir: "desc" }} />;
}

function statusText(o: PaperOrder): string {
  if (o.status === "held") return "Waiting for its entry";
  if (o.status === "pending") return o.checked_through ? `Open, checked to ${o.checked_through}` : "Open";
  if (o.status === "filled") return `Filled ${o.filled_on} at ${priceText(o.fill_price)}`;
  if (o.status === "rejected") return `Rejected: ${o.reason ?? ""}`;
  return `Cancelled${o.reason ? `: ${o.reason}` : ""}`;
}

function FillTable({ rows, label }: { rows: FillRow[]; label: (k: string) => string }) {
  return (
    <DataTable dense rows={rows} rowKey={(f) => f.id} empty="No fills yet." initialSort={{ key: "d", dir: "desc" }} columns={[
      { key: "d", header: "Bar date", align: "left", sort: (f) => f.bar_date, render: (f) => f.bar_date },
      { key: "s", header: "Instrument", align: "left", sort: (f) => label(f.symbol), render: (f) => label(f.symbol) },
      { key: "side", header: "Side", align: "left", render: (f) => (f.side === "buy" ? "Buy" : "Sell") },
      { key: "q", header: "Qty", sort: (f) => Number(f.qty), render: (f) => +Number(f.qty).toFixed(6) },
      { key: "p", header: "Price", sort: (f) => Number(f.price), render: (f) => priceText(Number(f.price)) },
      { key: "f", header: "Fee", sort: (f) => Number(f.fee), render: (f) => usd(Number(f.fee)) },
      { key: "r", header: "Realized", sort: (f) => (f.realized_pnl == null ? null : Number(f.realized_pnl)), tone: (f) => (f.realized_pnl == null ? null : Number(f.realized_pnl)),
        render: (f) => (f.realized_pnl == null ? "" : signedUsd(Number(f.realized_pnl))) },
    ]} />
  );
}

function ResetDialog({ open, onClose, account }: { open: boolean; onClose: () => void; account: AccountRow }) {
  const [cash, setCash] = useState(String(STARTING_CASH));
  const [busy, setBusy] = useState(false);
  const amount = Number(cash);
  const ok = amount > 0 && amount <= 1e9;
  const go = async () => {
    setBusy(true);
    try { await resetAccount(account, amount); toast("Demo account reset"); onClose(); }
    catch (e) { toast((e as Error).message, { tone: "bad" }); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Reset this demo account?" width={480}
      footer={<><Button variant="tertiary" onClick={onClose}>Keep it</Button><Button variant="danger" disabled={!ok || busy} loading={busy} onClick={go}>Reset account</Button></>}>
      <p>This removes every order, fill and position in <strong>{account.name}</strong> and starts it again with fresh demo cash. It cannot be undone. An attached strategy stays attached.</p>
      <label className="ui-field pt-field"><span className="ui-field-label">Starting cash ($)</span>
        <input className="ui-input" type="number" min="1" step="any" value={cash} onChange={(e) => setCash(e.target.value)} aria-label="Starting cash" /></label>
      <p className="muted small">Demo money only. No real money is involved.</p>
    </Dialog>
  );
}

function CostsDialog({ open, onClose, account }: { open: boolean; onClose: () => void; account: AccountRow }) {
  const c = costsOf(account);
  const [v, setV] = useState({ fee_bps: String(c.fee_bps), fee_min: String(c.fee_min), slippage_bps: String(c.slippage_bps) });
  const parsed: Costs = { fee_bps: Number(v.fee_bps), fee_min: Number(v.fee_min), slippage_bps: Number(v.slippage_bps) };
  const ok = Object.values(parsed).every((x) => Number.isFinite(x) && x >= 0 && x <= 1000);
  const field = (k: keyof typeof v, label: string, help: string) => (
    <label className="ui-field pt-field"><span className="ui-field-label">{label}</span>
      <input className="ui-input" type="number" min="0" max="1000" step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} aria-label={label} />
      <span className="muted small">{help}</span></label>
  );
  return (
    <Dialog open={open} onClose={onClose} title="Fees and slippage" width={480}
      footer={<><Button variant="tertiary" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={() => saveCosts(account, parsed).then(() => { toast("Saved"); onClose(); }, (e: Error) => toast(e.message, { tone: "bad" }))}>Save</Button></>}>
      <div className="pt-fields">
        {field("fee_bps", "Fee (bp of notional)", "1 bp is 0.01%.")}
        {field("fee_min", "Minimum fee ($)", "Charged when the bp fee is smaller.")}
        {field("slippage_bps", "Slippage (bp)", "Added against you on market and stop fills.")}
      </div>
      <p className="muted small">New settings apply to fills from now on. Past fills keep the costs they had.</p>
    </Dialog>
  );
}
