// The order ticket on the demo account (DEC-0034): market, limit, stop, stop-limit,
// trailing stop and bracket orders with the cost before you place it. Orders go to the
// demo account's matching engine (lib/paper/matching.ts). When the server carries orders
// (DEC-0046), the broker ticket in BrokerTicket.tsx takes its place.
import { useEffect, useRef, useState, type Ref } from "react";
import { checkBracket, checkOrder, estimate, heldQty, committedQty, type BracketInput, type OrderInput, type OrderType, type Side } from "../lib/paper/matching";
import { digitsFor, priceText } from "../lib/tradeData";
import { toast } from "../ui";
import { useDemo, usd } from "./demo";
import { BrokerTicket } from "./BrokerTicket";
import { ModeBadge, useTrading } from "./trading";

type TicketType = OrderType | "bracket";
const TYPES: [TicketType, string][] = [
  ["market", "Market"], ["limit", "Limit"], ["stop", "Stop"], ["stop_limit", "Stop limit"], ["trailing_stop", "Trailing stop"], ["bracket", "Bracket"],
];
// Order types are the one control here that can mean different things on different
// platforms, so each says what it does here on hover.
const TYPE_TIP: Record<TicketType, string> = {
  market: "Fills at the latest delayed close plus slippage",
  limit: "Fills on a later daily bar at the limit or better",
  stop: "Becomes a market order when a later bar trades through the stop",
  stop_limit: "Becomes a limit order when the stop is reached",
  trailing_stop: "A stop that follows the best close by the percent set",
  bracket: "Buy with a take-profit and a stop-loss; one cancels the other",
};

const n = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[,\s$]/g, "")));

/** A request from a hotkey: open the ticket on this side and focus the quantity. */
export interface Cue { side: Side; type?: "market" | "limit"; at: number; /** Place at market at once (one-key orders). */ fire?: boolean }

function Num({ label, value, onChange, inputRef, suffix }: { label: string; value: string; onChange: (v: string) => void; inputRef?: Ref<HTMLInputElement>; suffix?: string }) {
  return (
    <label className="ot-field">
      <span>{label}{suffix ? ` ${suffix}` : ""}</span>
      <input ref={inputRef} className="ot-input" type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

type TicketProps = { symbol: string; cue?: Cue | null; confirm: boolean; onNeedConfirm?: (text: string, go: () => void) => void };

export function OrderTicket(props: TicketProps) {
  const t = useTrading();
  return t.server ? <BrokerTicket symbol={props.symbol} cue={props.cue} /> : <DemoTicket {...props} />;
}

function DemoTicket({ symbol, cue, confirm, onNeedConfirm }: TicketProps) {
  const d = useDemo();
  const [side, setSide] = useState<Side>("buy");
  const [type, setType] = useState<TicketType>("market");
  const [qty, setQty] = useState("1");
  const [limit, setLimit] = useState("");
  const [stop, setStop] = useState("");
  const [trail, setTrail] = useState("5");
  const [entry, setEntry] = useState<"market" | "limit" | "stop">("market");
  const [entryPx, setEntryPx] = useState("");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const qtyRef = useRef<HTMLInputElement>(null);

  const inst = d.all.find((s) => s.key === symbol);
  const tradableHere = d.list.some((s) => s.key === symbol);
  const bar = d.last(symbol);
  const ref = bar?.close ?? null;
  const digits = digitsFor(ref);
  const book = d.book ?? { cash: 0, positions: {} };
  const effSide: Side = type === "bracket" ? "buy" : side;
  const input: OrderInput = { symbol, side: effSide, type: type === "bracket" ? entry : type, qty: n(qty), limit_price: n(limit), stop_price: n(stop), trail_pct: n(trail) };
  if (type === "bracket") { input.limit_price = entry === "limit" ? n(entryPx) : null; input.stop_price = entry === "stop" ? n(entryPx) : null; }
  const bracket: BracketInput = { symbol, qty: n(qty), entry, entry_price: entry === "market" ? null : n(entryPx), take_profit: n(tp), stop_loss: n(sl) };
  const est = ref != null && Number.isFinite(input.qty) ? estimate(input, ref, d.costs) : null;
  const problem = !tradableHere ? "Not tradable in demo" : ref == null ? "Loading price"
    : type === "bracket" ? checkBracket(bracket, book, d.orders, d.costs, ref, d.refPrice) : checkOrder(input, book, d.orders, d.costs, ref, d.refPrice);
  const free = heldQty(book, symbol) - committedQty(d.orders, symbol);

  const r = (v: number) => String(+v.toFixed(digits));
  const pickType = (t: TicketType, s: Side = side) => {
    setType(t);
    if (ref == null) return;
    if (t === "limit" && !limit) setLimit(r(ref * (s === "buy" ? 0.98 : 1.02)));
    if ((t === "stop" || t === "stop_limit") && !stop) setStop(r(ref * (s === "buy" ? 1.02 : 0.98)));
    if (t === "stop_limit" && !limit) setLimit(r(ref * (s === "buy" ? 1.03 : 0.97)));
    if (t === "bracket") { if (!tp) setTp(r(ref * 1.05)); if (!sl) setSl(r(ref * 0.97)); }
  };

  const fireNext = useRef(false);
  useEffect(() => {
    if (!cue) return;
    setSide(cue.side);
    if (cue.fire) { setType("market"); fireNext.current = true; return; }
    if (cue.type === "limit") { setType("limit"); if (ref != null) setLimit(r(ref * (cue.side === "buy" ? 0.98 : 1.02))); }
    else if (type === "bracket" && cue.side === "sell") setType("market");
    window.requestAnimationFrame(() => { qtyRef.current?.focus(); qtyRef.current?.select(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.at]);

  const name = inst ? inst.short || inst.label : symbol.startsWith("L:") ? symbol.split(":")[2] ?? symbol : symbol.startsWith("S:") ? symbol.slice(2) : symbol;
  const verb = type === "bracket" ? "Buy bracket" : effSide === "buy" ? "Buy" : "Sell";
  const summary = `${verb} ${Number.isFinite(input.qty) ? +input.qty : ""} ${name}${type === "market" || (type === "bracket" && entry === "market") ? " @ market" : ""}`;
  const submit = () => {
    if (problem || d.busy) return;
    const go = () => void d.place(type === "bracket" ? { kind: "bracket", input: bracket } : { kind: "order", input }, symbol);
    if (confirm && onNeedConfirm) onNeedConfirm(summary, go); else go();
  };

  // A one-key order fires once the side and type above have taken effect.
  useEffect(() => {
    if (!fireNext.current || !cue || type !== "market" || side !== cue.side) return;
    fireNext.current = false;
    if (problem) toast(problem, { tone: "bad" }); else submit();
  });

  return (
    <form className="ot" aria-label="Order ticket" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="ot-head">
        <strong className="ot-sym">{name}</strong>
        <span className="ot-last tabular">{bar ? priceText(bar.close, digits) : "n/a"}</span>
        <span className="ot-asof">{bar?.time ?? ""}</span>
      </div>
      <div className="mb-row"><ModeBadge /></div>
      <div className="ot-sides" role="radiogroup" aria-label="Side">
        <button type="button" role="radio" aria-checked={effSide === "buy"} className={`ot-side buy ${effSide === "buy" ? "on" : ""}`} onClick={() => setSide("buy")}>Buy</button>
        <button type="button" role="radio" aria-checked={effSide === "sell"} className={`ot-side sell ${effSide === "sell" ? "on" : ""}`}
          onClick={() => { setSide("sell"); if (type === "bracket") setType("market"); }}>Sell</button>
      </div>
      <label className="ot-field">
        <span>Type</span>
        <select className="ot-input" value={type} onChange={(e) => pickType(e.target.value as TicketType)} title={TYPE_TIP[type]}>
          {(effSide === "sell" ? TYPES.filter(([t]) => t !== "bracket") : TYPES).map(([t, l]) => <option key={t} value={t} title={TYPE_TIP[t]}>{l}</option>)}
        </select>
      </label>
      <div className="ot-grid">
        <Num label="Qty" value={qty} onChange={setQty} inputRef={qtyRef} />
        {type === "limit" && <Num label="Limit" value={limit} onChange={setLimit} />}
        {(type === "stop" || type === "stop_limit") && <Num label="Stop" value={stop} onChange={setStop} />}
        {type === "stop_limit" && <Num label="Limit" value={limit} onChange={setLimit} />}
        {type === "trailing_stop" && <Num label="Trail" suffix="%" value={trail} onChange={setTrail} />}
        {type === "bracket" && (
          <>
            <label className="ot-field"><span>Entry</span>
              <select className="ot-input" value={entry} onChange={(e) => setEntry(e.target.value as typeof entry)}>
                <option value="market">Market</option><option value="limit">Limit</option><option value="stop">Stop</option>
              </select></label>
            {entry !== "market" && <Num label="Entry price" value={entryPx} onChange={setEntryPx} />}
            <Num label="Take profit" value={tp} onChange={setTp} />
            <Num label="Stop loss" value={sl} onChange={setSl} />
          </>
        )}
      </div>
      <dl className="ot-est">
        <div><dt>Price</dt><dd className="tabular">{est ? priceText(est.price, digits) : "n/a"}</dd></div>
        <div><dt>Notional</dt><dd className="tabular">{est ? usd(est.notional) : "n/a"}</dd></div>
        <div><dt>Fee</dt><dd className="tabular">{est ? usd(est.fee) : "n/a"}</dd></div>
        <div className="ot-total"><dt>{effSide === "buy" ? "Cost" : "Proceeds"}</dt><dd className="tabular">{est ? usd(est.total) : "n/a"}</dd></div>
        <div><dt>Cash</dt><dd className="tabular">{usd(book.cash)}</dd></div>
        <div><dt>Held</dt><dd className="tabular">{+free.toFixed(6)}</dd></div>
      </dl>
      <p className="ot-problem" aria-live="polite">{problem ?? ""}</p>
      <button type="submit" className={`ot-go ${effSide}`} disabled={!!problem || d.busy}>{summary}</button>
    </form>
  );
}
