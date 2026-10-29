// The broker account's lists when orders go through the server (DEC-0046): open orders
// with Cancel and Modify, order history, fills, positions with P&L, balances, the history
// export and the sandbox onboarding card. Each list carries the mode badge.
import { useState } from "react";
import { Button, Checkbox, Dialog, toast } from "../ui";
import { newIdempotencyKey } from "../lib/trading/client";
import type { TradeFill, TradeOrder, TradePosition } from "../lib/trading/types";
import { signedUsd, tone, usd } from "./demo";
import { timeIn } from "./state";
import { TTable } from "./TTable";
import { BadgedList, ModeBadge, useTrading } from "./trading";

const q = (v: number) => String(+v.toFixed(6));
const px = (v: number | null | undefined) => (v == null ? "n/a" : String(+v.toFixed(v < 1 ? 6 : 2)));
const TYPE: Record<string, string> = { market: "Market", limit: "Limit", stop: "Stop", stop_limit: "Stop limit" };
const word = (s: string) => { const t = s.replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };

function status(o: TradeOrder): string {
  if (o.status === "filled") return `Filled ${px(o.filledAvgPrice)}`;
  if (o.status === "partially_filled") return `${q(o.filledQty)} filled at ${px(o.filledAvgPrice)}`;
  return word(o.status);
}

function prices(o: TradeOrder): string {
  const p: string[] = [];
  if (o.limitPrice != null) p.push(`L ${px(o.limitPrice)}`);
  if (o.stopPrice != null) p.push(`S ${px(o.stopPrice)}`);
  if (o.takeProfit != null) p.push(`TP ${px(o.takeProfit)}`);
  if (o.stopLoss != null) p.push(`SL ${px(o.stopLoss)}`);
  return p.join(" ") || "MKT";
}

export function BrokerPositionsTable({ onSymbol }: { onSymbol?: (k: string) => void }) {
  const t = useTrading();
  return (
    <BadgedList>
      <TTable<TradePosition> label="Positions" rows={t.positions} rowKey={(p) => p.symbol} empty={t.loaded ? "No positions" : "Loading"} initial={{ key: "v", dir: "desc" }}
        onRow={onSymbol ? (p) => onSymbol(p.symbol) : undefined}
        cols={[
          { key: "s", head: "Symbol", align: "left", sort: (p) => p.symbol, cell: (p) => p.symbol },
          { key: "q", head: "Qty", sort: (p) => p.qty, cell: (p) => q(p.qty) },
          { wide: true, key: "a", head: "Avg", sort: (p) => p.avgCost, cell: (p) => px(p.avgCost) },
          { key: "l", head: "Last", sort: (p) => p.lastPrice, cell: (p) => px(p.lastPrice) },
          { key: "v", head: "Value", sort: (p) => p.marketValue, cell: (p) => (p.marketValue == null ? "n/a" : usd(p.marketValue)) },
          { key: "u", head: "Unrl P&L", sort: (p) => p.unrealizedPl, tone: (p) => p.unrealizedPl, cell: (p) => (p.unrealizedPl == null ? "n/a" : signedUsd(p.unrealizedPl)) },
          { wide: true, key: "r", head: "Rlzd", sort: (p) => p.realizedPl, tone: (p) => p.realizedPl, cell: (p) => signedUsd(p.realizedPl) },
        ]} />
    </BadgedList>
  );
}

export function BrokerOrdersTable({ rows, tz, actions }: { rows: TradeOrder[]; tz: string; actions?: boolean }) {
  const t = useTrading();
  const [editing, setEditing] = useState<TradeOrder | null>(null);
  // One key per cancel, kept until it succeeds, so a retry is the same request.
  const [cancelKeys] = useState(() => new Map<string, string>());
  const cancel = (o: TradeOrder) => {
    const key = cancelKeys.get(o.id) ?? newIdempotencyKey();
    cancelKeys.set(o.id, key);
    t.client.cancelOrder(o.id, key).then(() => { cancelKeys.delete(o.id); toast("Cancel sent"); void t.refresh(); }, (e: Error) => toast(e.message, { tone: "bad" }));
  };
  return (
    <BadgedList>
      <TTable<TradeOrder> label={actions ? "Open orders" : "Order history"} rows={rows} rowKey={(o) => o.id} empty={t.loaded ? "No orders" : "Loading"} initial={{ key: "t", dir: "desc" }}
        cols={[
          { key: "t", head: "Time", align: "left", sort: (o) => o.createdAt, cell: (o) => timeIn(o.createdAt, tz) },
          { key: "s", head: "Symbol", align: "left", sort: (o) => o.symbol, cell: (o) => o.symbol },
          { key: "d", head: "Side", align: "left", cell: (o) => <span className={o.side === "buy" ? "good" : "bad"}>{o.side === "buy" ? "Buy" : "Sell"}</span> },
          { key: "y", head: "Type", align: "left", cell: (o) => `${TYPE[o.type] ?? word(o.type)}${o.orderClass === "bracket" ? " bracket" : ""}` },
          { key: "q", head: "Qty", sort: (o) => o.qty ?? o.notional, cell: (o) => (o.qty != null ? q(o.qty) : o.notional != null ? usd(o.notional) : "n/a") },
          { key: "p", head: "Price", align: "left", cell: prices },
          { wide: true, key: "f", head: "TIF", align: "left", cell: (o) => o.timeInForce.toUpperCase() },
          { key: "st", head: "Status", align: "left", cell: (o) => <span title={o.reason ?? undefined}>{status(o)}</span> },
          ...(actions ? [{
            key: "x", head: <span className="sr-only">Actions</span>, width: 128,
            cell: (o: TradeOrder) => (
              <span className="bt-row-actions">
                <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(o); }}>Modify</Button>
                <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); cancel(o); }}>Cancel</Button>
              </span>
            ),
          }] : []),
        ]} />
      {editing && <ModifyDialog order={editing} onClose={() => setEditing(null)} />}
    </BadgedList>
  );
}

function ModifyDialog({ order, onClose }: { order: TradeOrder; onClose: () => void }) {
  const t = useTrading();
  const [qty, setQty] = useState(order.qty != null ? String(order.qty) : "");
  const [limit, setLimit] = useState(order.limitPrice != null ? String(order.limitPrice) : "");
  const [stop, setStop] = useState(order.stopPrice != null ? String(order.stopPrice) : "");
  const [busy, setBusy] = useState(false);
  // One key for this change. A retry from the same dialog reuses it.
  const [key] = useState(newIdempotencyKey);
  const hasLimit = order.type === "limit" || order.type === "stop_limit";
  const hasStop = order.type === "stop" || order.type === "stop_limit";
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const change = { qty: num(qty), ...(hasLimit ? { limitPrice: num(limit) } : {}), ...(hasStop ? { stopPrice: num(stop) } : {}) };
  const valid = Object.values(change).every((v) => v === undefined || (Number.isFinite(v) && v > 0)) && Object.values(change).some((v) => v !== undefined);
  const go = async () => {
    setBusy(true);
    try { t.upsert(await t.client.modifyOrder(order.id, change, key)); toast("Change sent"); onClose(); }
    catch (e) { toast((e as Error).message, { tone: "bad" }); }
    finally { setBusy(false); }
  };
  const field = (label: string, v: string, set: (s: string) => void) => (
    <label className="ot-field"><span>{label}</span><input className="ot-input" type="number" min="0" step="any" value={v} onChange={(e) => set(e.target.value)} /></label>
  );
  return (
    <Dialog open onClose={onClose} title={`Modify ${order.side} ${order.symbol}`} width={380}
      footer={<><Button variant="tertiary" onClick={onClose}>Close</Button><Button variant="primary" disabled={!valid || busy} loading={busy} onClick={go}>Send change</Button></>}>
      <div className="bt-dialog-badge"><ModeBadge /></div>
      <div className="ot-grid">
        {order.qty != null && field("Qty", qty, setQty)}
        {hasLimit && field("Limit", limit, setLimit)}
        {hasStop && field("Stop", stop, setStop)}
      </div>
    </Dialog>
  );
}

export function BrokerFillsTable({ tz }: { tz: string }) {
  const t = useTrading();
  return (
    <BadgedList>
      <TTable<TradeFill> label="Fills" rows={t.fills} rowKey={(f) => `${f.clientOrderId}|${f.at}|${f.qty}|${f.price}`} empty={t.loaded ? "No fills" : "Loading"} initial={{ key: "t", dir: "desc" }}
        cols={[
          { key: "t", head: "Time", align: "left", sort: (f) => f.at, cell: (f) => timeIn(f.at, tz) },
          { key: "s", head: "Symbol", align: "left", sort: (f) => f.symbol, cell: (f) => f.symbol },
          { key: "side", head: "Side", align: "left", cell: (f) => <span className={f.side === "buy" ? "good" : "bad"}>{f.side === "buy" ? "Buy" : "Sell"}</span> },
          { key: "q", head: "Qty", sort: (f) => f.qty, cell: (f) => q(f.qty) },
          { key: "p", head: "Price", sort: (f) => f.price, cell: (f) => px(f.price) },
          { wide: true, key: "v", head: "Value", sort: (f) => f.qty * f.price, cell: (f) => usd(f.qty * f.price) },
        ]} />
    </BadgedList>
  );
}

/** Cash, buying power, equity and total P&L in one strip. */
export function BalancesStrip({ wide }: { wide?: boolean }) {
  const t = useTrading();
  const b = t.balances;
  const m = (v: number | null | undefined, f = usd) => (v == null ? "n/a" : f(v));
  const items: [string, string, number | null][] = [
    ["Equity", m(b?.equity), null],
    ["Cash", m(b?.cash), null],
    ["Buying power", m(b?.buyingPower), null],
    ["Total P&L", m(b?.totalPl, signedUsd), b?.totalPl ?? null],
  ];
  return (
    <div className="mb-list">
      <div className="mb-row"><ModeBadge /></div>
      <dl className={`pnl ${wide ? "pnl-wide" : ""}`} aria-label="Balances">
        {items.map(([k, v, s]) => <div key={k}><dt>{k}</dt><dd className={`tabular ${tone(s)}`}>{v}</dd></div>)}
      </dl>
    </div>
  );
}

/** Downloads the order history and fills as CSV. */
export function ExportButton() {
  const t = useTrading();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const blob = await t.client.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parity-trade-history-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast((e as Error).message, { tone: "bad" }); }
    finally { setBusy(false); }
  };
  return <Button size="sm" icon="download" loading={busy} disabled={busy} onClick={go}>Export history</Button>;
}

/** Sandbox only: open the sandbox account, then add pretend funds. Asks for no personal
 *  details and no bank details. The server fills Alpaca's published test identity values. */
export function SandboxCard() {
  const t = useTrading();
  const [agree, setAgree] = useState(false);
  const [amount, setAmount] = useState("10000");
  const [busy, setBusy] = useState(false);
  if (!t.server || t.status?.mode !== "sandbox") return null;
  const account = t.status.account ?? null;
  if (account?.funded) return null;
  const run = async (f: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await f(); toast(done, { tone: "good" }); await t.refreshStatus(); void t.refresh(); }
    catch (e) { toast((e as Error).message, { tone: "bad" }); }
    finally { setBusy(false); }
  };
  const dollars = Number(amount);
  return (
    <section className="vbox bt-sandbox" aria-label="Sandbox account">
      <div className="vh-row"><h2 className="vh">Sandbox account</h2><span className="vbar-gap" /><ModeBadge /></div>
      <p className="bt-note">Sandbox uses test identity values. No personal details are collected. All money here is pretend.</p>
      {!account ? (
        <>
          <Checkbox checked={agree} onChange={setAgree} label="I accept the sandbox account agreement" />
          <Button size="sm" variant="primary" disabled={!agree || busy} loading={busy} onClick={() => run(() => t.client.createSandboxAccount(), "Sandbox account created")}>Create sandbox account</Button>
        </>
      ) : (
        <>
          <label className="ot-field"><span>Pretend funds ($)</span>
            <input className="ot-input" type="number" min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <Button size="sm" variant="primary" disabled={!(dollars > 0) || busy} loading={busy} onClick={() => run(() => t.client.fundSandbox(dollars), "Pretend funds added")}>Add pretend funds</Button>
        </>
      )}
    </section>
  );
}
