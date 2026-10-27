// The demo account's tables (DEC-0034), shared by the bottom dock, Portfolio and Orders:
// positions, orders, fills and the P&L numbers.
import type { ReactNode } from "react";
import { fmt } from "../ui/text";
import { AnimatedNumber } from "../ui/motion";
import { priceText } from "../lib/tradeData";
import { isActive, ORDER_TYPE_LABEL, trailingStopLevel, type PaperOrder } from "../lib/paper/matching";
import type { FillRow } from "../lib/paper/account";
import { signedUsd, tone, usd, useDemo, type Holding } from "./demo";
import { timeIn } from "./state";
import { TTable } from "./TTable";
import { Button } from "../ui";

const q = (v: number) => String(+v.toFixed(6));

export function PositionsTable({ onSymbol, active }: { onSymbol?: (k: string) => void; active?: string }) {
  const d = useDemo();
  return (
    <TTable<Holding> label="Positions" rows={d.holdings} rowKey={(h) => h.symbol} empty={d.loaded ? <FirstOrder start={d.start} /> : "Loading"} initial={{ key: "v", dir: "desc" }}
      onRow={onSymbol ? (h) => onSymbol(h.symbol) : undefined} active={(h) => h.symbol === active}
      cols={[
        { key: "s", head: "Symbol", align: "left", sort: (h) => d.label(h.symbol), cell: (h) => d.label(h.symbol) },
        { key: "q", head: "Qty", sort: (h) => h.qty, cell: (h) => q(h.qty) },
        { wide: true, key: "a", head: "Avg", sort: (h) => h.avg_cost, cell: (h) => priceText(h.avg_cost) },
        { key: "l", head: "Last", sort: (h) => h.px?.close ?? null, cell: (h) => (h.px ? priceText(h.px.close) : "n/a") },
        { key: "v", head: "Value", sort: (h) => h.value, cell: (h) => (h.value == null ? "n/a" : usd(h.value)) },
        { key: "u", head: "Unrl P&L", sort: (h) => h.upl, tone: (h) => h.upl, cell: (h) => (h.upl == null ? "n/a" : signedUsd(h.upl)) },
        { key: "p", head: "%", sort: (h) => (h.upl == null ? null : h.upl / h.cost), tone: (h) => h.upl, cell: (h) => (h.upl == null ? "" : fmt.signedPct(h.upl / h.cost, 2)) },
        { wide: true, key: "r", head: "Rlzd", sort: (h) => h.realized, tone: (h) => h.realized, cell: (h) => signedUsd(h.realized) },
      ]} />
  );
}

/** Asks Trade to open the order ticket on a buy, without placing anything (TradeApp listens). */
export const openTicket = () => window.dispatchEvent(new Event("parity:trade-order"));

/** An empty demo account: what to do first, with one button (DEC-0077). */
function FirstOrder({ start }: { start: number }) {
  return (
    <div className="tt-start">
      <p><strong>No positions yet.</strong> The demo account starts with {usd(start)} of virtual money. Buy anything on the chart with the order ticket. Prices are delayed.</p>
      <Button variant="accent" size="sm" icon="plus" onClick={openTicket}>Place a demo order</Button>
    </div>
  );
}

function prices(o: PaperOrder): string {
  const parts: string[] = [];
  if (o.limit_price != null) parts.push(`L ${priceText(o.limit_price)}`);
  if (o.stop_price != null) parts.push(`S ${priceText(o.stop_price)}`);
  if (o.type === "trailing_stop") { const lvl = trailingStopLevel(o); parts.push(`T ${o.trail_pct}%${lvl != null && isActive(o) ? ` @ ${priceText(lvl)}` : ""}`); }
  return parts.join(" ") || "MKT";
}

const ROLE: Record<string, string> = { entry: "entry", take_profit: "TP", stop_loss: "SL" };

function status(o: PaperOrder): string {
  if (o.status === "held") return "Held";
  if (o.status === "pending") return o.type === "stop_limit" && o.triggered ? "Triggered" : "Working";
  if (o.status === "filled") return `Filled ${priceText(o.fill_price)}`;
  if (o.status === "rejected") return "Rejected";
  return "Cancelled";
}

export function OrdersTable({ rows, tz, onCancel }: { rows: PaperOrder[]; tz: string; onCancel?: (id: string) => void }) {
  const d = useDemo();
  return (
    <TTable<PaperOrder> label={onCancel ? "Open orders" : "Order history"} rows={rows} rowKey={(o) => o.id} empty={d.loaded ? "No orders" : "Loading"} initial={{ key: "t", dir: "desc" }}
      cols={[
        { key: "t", head: "Time", align: "left", sort: (o) => o.placed_at, cell: (o) => timeIn(o.placed_at, tz) },
        { key: "s", head: "Symbol", align: "left", sort: (o) => d.label(o.symbol), cell: (o) => d.label(o.symbol) },
        { key: "d", head: "Side", align: "left", cell: (o) => <span className={o.side === "buy" ? "good" : "bad"}>{o.side === "buy" ? "Buy" : "Sell"}</span> },
        { key: "y", head: "Type", align: "left", cell: (o) => `${ORDER_TYPE_LABEL[o.type]}${o.role ? ` ${ROLE[o.role]}` : ""}` },
        { key: "q", head: "Qty", sort: (o) => o.qty, cell: (o) => q(o.qty) },
        { key: "p", head: "Price", align: "left", cell: prices },
        { key: "st", head: "Status", align: "left", cell: (o) => <span title={o.reason ?? undefined}>{status(o)}</span> },
        ...(onCancel ? [{ key: "x", head: <span className="sr-only">Cancel</span>, width: 64, cell: (o: PaperOrder) => <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); onCancel(o.id); }}>Cancel</Button> }] : []),
      ]} />
  );
}

export function FillsTable({ rows, tz }: { rows: FillRow[]; tz: string }) {
  const d = useDemo();
  return (
    <TTable<FillRow> label="Fills" rows={rows} rowKey={(f) => f.id} empty={d.loaded ? "No fills" : "Loading"} initial={{ key: "t", dir: "desc" }}
      cols={[
        { key: "t", head: "Time", align: "left", sort: (f) => `${f.created_at ?? ""}|${f.bar_date}`, cell: (f) => timeIn(f.created_at, tz) },
        { wide: true, key: "b", head: "Bar", align: "left", sort: (f) => f.bar_date, cell: (f) => f.bar_date },
        { key: "s", head: "Symbol", align: "left", sort: (f) => d.label(f.symbol), cell: (f) => d.label(f.symbol) },
        { key: "side", head: "Side", align: "left", cell: (f) => <span className={f.side === "buy" ? "good" : "bad"}>{f.side === "buy" ? "Buy" : "Sell"}</span> },
        { key: "q", head: "Qty", sort: (f) => Number(f.qty), cell: (f) => q(Number(f.qty)) },
        { key: "p", head: "Price", sort: (f) => Number(f.price), cell: (f) => priceText(Number(f.price)) },
        { wide: true, key: "f", head: "Fee", sort: (f) => Number(f.fee), cell: (f) => usd(Number(f.fee)) },
        { key: "r", head: "Rlzd", sort: (f) => (f.realized_pnl == null ? null : Number(f.realized_pnl)), tone: (f) => (f.realized_pnl == null ? null : Number(f.realized_pnl)),
          cell: (f) => (f.realized_pnl == null ? "" : signedUsd(Number(f.realized_pnl))) },
      ]} />
  );
}

/** The account's numbers in one dense strip. */
export function PnlStrip({ wide }: { wide?: boolean }) {
  const d = useDemo();
  const s = d.stats;
  const v = (x: string) => (d.book ? x : "n/a");
  // Money values tick to their new amount as prices move (a number ticker, REF-0023).
  const tick = (x: number, f: (n: number) => string) => (d.book ? <AnimatedNumber value={x} format={f} /> : "n/a");
  const items: [string, ReactNode, number | null][] = [
    ["Equity", tick(d.equity, usd), null],
    ["Cash", tick(d.book?.cash ?? 0, usd), null],
    ["Return", v(fmt.signedPct(d.equity / d.start - 1, 2)), d.equity - d.start],
    ["Unrl P&L", tick(d.upl, signedUsd), d.upl],
    ["Rlzd P&L", tick(d.realized, signedUsd), d.realized],
    ["Win rate", s.win_rate == null ? "n/a" : `${fmt.pct(s.win_rate, 0)} (${s.closed_trades})`, null],
    ["Profit factor", fmt.num(s.profit_factor), null],
    ["Sharpe", fmt.num(s.sharpe), null],
    ["Max DD", fmt.pct(s.max_drawdown, 2), null],
  ];
  return (
    <dl className={`pnl ${wide ? "pnl-wide" : ""}`} aria-label="Account">
      {items.map(([k, x, t]) => <div key={k}><dt>{k}</dt><dd className={`tabular ${tone(t)}`}>{x}</dd></div>)}
    </dl>
  );
}
