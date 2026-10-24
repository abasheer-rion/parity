// The demo order ticket: market, limit, stop, stop-limit, trailing stop and bracket
// orders, with the fee, slippage and an estimate shown before you place it. Orders go to
// the demo account's matching engine (lib/paper/matching.ts), never to a broker.
import { useState } from "react";
import { Button, Segmented, Select } from "../../ui";
import { Icon } from "../../ui/icons";
import { checkBracket, checkOrder, estimate, heldQty, committedQty, type Book, type BracketInput, type Costs, type OrderInput, type OrderType, type PaperOrder, type Side } from "../../lib/paper/matching";
import { digitsFor, priceText, type Instrument } from "../../lib/tradeData";
import type { Bar } from "../../lib/indicators";
import { InstrumentSelect } from "./shared";

type TicketType = OrderType | "bracket";
const TYPES: [TicketType, string][] = [
  ["market", "Market"], ["limit", "Limit"], ["stop", "Stop"], ["stop_limit", "Stop-limit"], ["trailing_stop", "Trailing stop"], ["bracket", "Bracket"],
];
const TYPE_HELP: Record<TicketType, string> = {
  market: "Fills now at the latest delayed close, moved against you by the slippage.",
  limit: "Waits for a later daily bar to reach your price. A buy fills at the limit or lower, a sell at the limit or higher.",
  stop: "Waits until a later bar trades through the stop, then fills like a market order. A gap through the stop fills at the open, which can be worse.",
  stop_limit: "When the stop is reached it becomes a limit order. If the price gaps past the limit it does not fill.",
  trailing_stop: "A stop that follows the best close since you placed it, by the percent you set.",
  bracket: "A buy with a take-profit and a stop-loss attached. Both wait until the buy fills; when one fills, the other is cancelled.",
};

export interface TicketProps {
  list: Instrument[];
  symbol: string;
  onSymbol: (key: string) => void;
  bar: Bar | null;
  book: Book;
  orders: PaperOrder[];
  costs: Costs;
  refPrice: (symbol: string) => number | null;
  busy: boolean;
  onPlace: (o: { kind: "order"; input: OrderInput } | { kind: "bracket"; input: BracketInput }) => void;
}

const n = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[,\s$]/g, "")));
const usd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Field({ label, value, onChange, step = "any", suffix, help }: { label: string; value: string; onChange: (v: string) => void; step?: string; suffix?: string; help?: string }) {
  return (
    <label className="ui-field pt-field">
      <span className="ui-field-label">{label}{suffix ? <span className="muted"> ({suffix})</span> : null}</span>
      <input className="ui-input" type="number" inputMode="decimal" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      {help && <span className="muted small">{help}</span>}
    </label>
  );
}

export function OrderTicket({ list, symbol, onSymbol, bar, book, orders, costs, refPrice, busy, onPlace }: TicketProps) {
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

  const inst = list.find((s) => s.key === symbol);
  const ref = bar?.close ?? null;
  const digits = digitsFor(ref);
  const effSide: Side = type === "bracket" ? "buy" : side;
  const input: OrderInput = { symbol, side: effSide, type: type === "bracket" ? entry : type, qty: n(qty), limit_price: n(limit), stop_price: n(stop), trail_pct: n(trail) };
  if (type === "bracket") { input.limit_price = entry === "limit" ? n(entryPx) : null; input.stop_price = entry === "stop" ? n(entryPx) : null; }
  const bracket: BracketInput = { symbol, qty: n(qty), entry, entry_price: entry === "market" ? null : n(entryPx), take_profit: n(tp), stop_loss: n(sl) };
  const est = ref != null && Number.isFinite(input.qty) ? estimate(input, ref, costs) : null;
  const problem = ref == null ? "Waiting for prices" : type === "bracket" ? checkBracket(bracket, book, orders, costs, ref, refPrice) : checkOrder(input, book, orders, costs, ref, refPrice);
  const free = heldQty(book, symbol) - committedQty(orders, symbol);

  // Fill in sensible prices around the last close when a type needs one.
  const pickType = (t: TicketType) => {
    setType(t);
    if (ref == null) return;
    const r = (v: number) => String(+v.toFixed(digits));
    if (t === "limit" && !limit) setLimit(r(ref * (side === "buy" ? 0.98 : 1.02)));
    if ((t === "stop" || t === "stop_limit") && !stop) setStop(r(ref * (side === "buy" ? 1.02 : 0.98)));
    if (t === "stop_limit" && !limit) setLimit(r(ref * (side === "buy" ? 1.03 : 0.97)));
    if (t === "bracket") { if (!tp) setTp(r(ref * 1.05)); if (!sl) setSl(r(ref * 0.97)); }
  };

  const submit = () => {
    if (problem || busy) return;
    onPlace(type === "bracket" ? { kind: "bracket", input: bracket } : { kind: "order", input });
  };

  return (
    <section className="mcard pt-ticket" aria-label="Demo order ticket">
      <div className="pt-demo-strip" role="note"><Icon name="info" size={14} /><span><strong>Demo account. No real money.</strong> Practice orders on delayed prices.</span></div>
      <div className="pt-ticket-body">
        <InstrumentSelect list={list} value={symbol} onChange={onSymbol} label="Instrument to trade" allowNone={inst ? undefined : "Loading instruments"} />
        <p className="pt-last muted small">
          {bar && inst ? <>Last close <strong className="tabular">{priceText(bar.close, digits)}</strong> on {bar.time}. Delayed, end of day.</> : "Loading the latest delayed close"}
        </p>
        <div className="pt-row">
          <Segmented label="Side" value={effSide} onChange={(v) => { setSide(v); if (v === "sell" && type === "bracket") setType("market"); }}
            options={[["buy", "Buy"], ["sell", "Sell"]]} />
          <Select label="Order type" value={type} onChange={pickType} options={side === "sell" ? TYPES.filter(([t]) => t !== "bracket") : TYPES} />
        </div>
        <p className="muted small pt-help">{TYPE_HELP[type]}</p>
        <div className="pt-fields">
          <Field label="Quantity" value={qty} onChange={setQty} help={effSide === "sell" ? `Free to sell: ${+free.toFixed(6)}` : undefined} />
          {type === "limit" && <Field label="Limit price" value={limit} onChange={setLimit} />}
          {(type === "stop" || type === "stop_limit") && <Field label="Stop price" value={stop} onChange={setStop} />}
          {type === "stop_limit" && <Field label="Limit price" value={limit} onChange={setLimit} />}
          {type === "trailing_stop" && <Field label="Trail" suffix="%" value={trail} onChange={setTrail} />}
          {type === "bracket" && (
            <>
              <label className="ui-field pt-field"><span className="ui-field-label">Entry</span>
                <Select label="Bracket entry" value={entry} onChange={setEntry} options={[["market", "Market"], ["limit", "Limit"], ["stop", "Stop"]]} /></label>
              {entry !== "market" && <Field label="Entry price" value={entryPx} onChange={setEntryPx} />}
              <Field label="Take-profit (limit)" value={tp} onChange={setTp} />
              <Field label="Stop-loss (stop)" value={sl} onChange={setSl} />
            </>
          )}
        </div>
        <dl className="pt-est">
          <div><dt>Estimated price</dt><dd className="tabular">{est ? priceText(est.price, digits) : "n/a"}</dd></div>
          <div><dt>Notional</dt><dd className="tabular">{est ? usd(est.notional) : "n/a"}</dd></div>
          <div><dt>Fee ({costs.fee_bps} bp, min ${costs.fee_min})</dt><dd className="tabular">{est ? usd(est.fee) : "n/a"}</dd></div>
          <div><dt>Slippage</dt><dd className="tabular">{costs.slippage_bps} bp on market and stop fills</dd></div>
          <div className="pt-est-total"><dt>{effSide === "buy" ? "Estimated cost" : "Estimated proceeds"}</dt><dd className="tabular">{est ? usd(est.total) : "n/a"}</dd></div>
          <div><dt>Cash</dt><dd className="tabular">{usd(book.cash)}</dd></div>
        </dl>
        <p className={`small pt-problem ${problem ? "bad" : "muted"}`} aria-live="polite">{problem ?? "Long only: buy, and sell up to what you hold. No short selling or margin."}</p>
        <Button variant="primary" full disabled={!!problem || busy} loading={busy} onClick={submit}>
          {type === "bracket" ? "Place demo bracket" : `Place demo ${effSide} order`}
        </Button>
      </div>
    </section>
  );
}
