// The order ticket when orders go through the server (DEC-0046): quantity or dollars,
// market, limit, stop and stop-limit, an optional bracket, time in force, then a Preview
// from the server with the estimated cost, fees and any warnings, then Confirm. Pretend
// money until the production switch. The mode badge stays on the ticket and the preview.
import { useEffect, useRef, useState, type Ref } from "react";
import { toast } from "../ui";
import { isCrypto, newIdempotencyKey, tifsFor } from "../lib/trading/client";
import type { OrderRequest, OrderSide, OrderType, Preview, TimeInForce } from "../lib/trading/types";
import { usd } from "./demo";
import type { Cue } from "./OrderTicket";
import { SandboxCard } from "./brokerBlotter";
import { ModeBadge, useTrading } from "./trading";

const TYPES: [OrderType, string][] = [["market", "Market"], ["limit", "Limit"], ["stop", "Stop"], ["stop_limit", "Stop limit"]];
export const TIF_LABEL: Record<TimeInForce, string> = { day: "Day", gtc: "Good till cancelled", ioc: "Immediate or cancel", fok: "Fill or kill", opg: "At the open", cls: "At the close" };

const n = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[,\s$]/g, "")));
const ok = (v: number) => Number.isFinite(v) && v > 0;
const px = (v: number | null | undefined) => (v == null ? "n/a" : String(+v.toFixed(v < 1 ? 6 : 2)));
const PAIR = /^([A-Z0-9]+)[-/]?(USD|USDT|USDC)$/;

/** The broker symbol for a chart key: S:AAPL is AAPL, a streamed BTC-USD is BTC/USD. */
export function brokerSymbol(key: string): string {
  if (key.startsWith("S:")) return key.slice(2).toUpperCase();
  if (key.startsWith("L:")) {
    const m = (key.split(":")[2] ?? "").toUpperCase().match(PAIR);
    if (m) return `${m[1]}/${m[2]}`;
  }
  return "";
}

function Num({ label, value, onChange, inputRef }: { label: string; value: string; onChange: (v: string) => void; inputRef?: Ref<HTMLInputElement> }) {
  return (
    <label className="ot-field">
      <span>{label}</span>
      <input ref={inputRef} className="ot-input" type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function BrokerTicket({ symbol, cue }: { symbol: string; cue?: Cue | null }) {
  const t = useTrading();
  const [sym, setSym] = useState(() => brokerSymbol(symbol));
  const [side, setSide] = useState<OrderSide>("buy");
  const [sizeBy, setSizeBy] = useState<"qty" | "notional">("qty");
  const [qty, setQty] = useState("1");
  const [notional, setNotional] = useState("");
  const [type, setType] = useState<OrderType>("market");
  const [limit, setLimit] = useState("");
  const [stop, setStop] = useState("");
  const [tif, setTif] = useState<TimeInForce>("day");
  const [bracket, setBracket] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const s = brokerSymbol(symbol); if (s) setSym(s); }, [symbol]);
  useEffect(() => {
    if (!cue) return;
    setSide(cue.side);
    if (cue.type) setType(cue.type);
    window.requestAnimationFrame(() => { qtyRef.current?.focus(); qtyRef.current?.select(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.at]);

  const symbolUp = sym.trim().toUpperCase();
  const crypto = isCrypto(symbolUp);
  const tifs = tifsFor(symbolUp).filter((x) => !bracket || x === "day" || x === "gtc");
  const tifKey = tifs.join(",");
  useEffect(() => { if (!tifKey.split(",").includes(tif)) setTif(tifKey.split(",")[0] as TimeInForce); }, [tifKey, tif]);
  useEffect(() => { if (crypto) { setBracket(false); setSizeBy("qty"); } }, [crypto]);
  const canNotional = type === "market" && tif === "day" && !bracket && !crypto;
  const needLimit = type === "limit" || type === "stop_limit";
  const needStop = type === "stop" || type === "stop_limit";

  const req: OrderRequest = {
    symbol: symbolUp, assetClass: crypto ? "crypto" : "us_equity", side, type, timeInForce: tif,
    ...(sizeBy === "qty" ? { qty: n(qty) } : { notional: n(notional) }),
    ...(needLimit ? { limitPrice: n(limit) } : {}),
    ...(needStop ? { stopPrice: n(stop) } : {}),
    orderClass: bracket ? "bracket" : "simple",
    ...(bracket ? { takeProfit: n(tp), stopLoss: n(sl) } : {}),
  };
  const lim = t.status?.limits;
  const problem = !symbolUp ? "Enter a symbol"
    : sizeBy === "qty" && !ok(n(qty)) ? "Enter a quantity"
    : sizeBy === "notional" && !ok(n(notional)) ? "Enter a dollar amount"
    : sizeBy === "notional" && !canNotional ? "Dollar amounts work on market day orders only"
    : needLimit && !ok(n(limit)) ? "Enter a limit price"
    : needStop && !ok(n(stop)) ? "Enter a stop price"
    : bracket && (!ok(n(tp)) || !ok(n(sl))) ? "Enter take profit and stop loss"
    : lim && sizeBy === "qty" && n(qty) > lim.maxQty ? `Over the ${lim.maxQty} quantity limit`
    : lim && sizeBy === "notional" && n(notional) > lim.maxOrderValue ? `Over the ${usd(lim.maxOrderValue)} order limit`
    : null;

  // Any change to the order makes it a new submission, with a new key.
  const fresh = () => { setPreview(null); setError(null); key.current = null; };
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); fresh(); };

  const pickSize = (by: "qty" | "notional") => {
    edit(setSizeBy)(by);
    if (by === "notional") { setType("market"); setTif("day"); setBracket(false); }
  };

  const doPreview = async () => {
    if (problem || busy) return;
    setBusy(true); setError(null);
    try { setPreview(await t.client.preview(req)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!preview || busy) return;
    key.current ??= newIdempotencyKey();
    setBusy(true); setError(null);
    try {
      const { order, duplicate } = await t.client.placeOrder(req, key.current);
      t.upsert(order);
      key.current = null;
      setPreview(null);
      toast(duplicate ? "Already placed" : `${order.side === "buy" ? "Buy" : "Sell"} ${order.symbol} sent`, { tone: "good" });
      void t.refresh();
    } catch (e) {
      // The key stays, so Confirm again retries this same submission.
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  const size = sizeBy === "qty" ? (ok(n(qty)) ? String(+n(qty)) : "") : ok(n(notional)) ? usd(n(notional)) : "";
  const summary = `${side === "buy" ? "Buy" : "Sell"} ${size} ${symbolUp}`.replace(/\s+/g, " ").trim();
  const blocked = !!preview && (!preview.ok || preview.errors.length > 0);

  return (
    <div className="bt">
      <SandboxCard />
      {preview ? (
        <section className="ot bt-preview" aria-label="Order preview">
          <div className="ot-head"><strong className="ot-sym">Preview</strong><span className="vbar-gap" /><ModeBadge /></div>
          <p className="bt-summary tabular">{summary}, {TYPES.find(([k]) => k === type)?.[1]}{bracket ? " bracket" : ""}, {TIF_LABEL[tif]}</p>
          <dl className="ot-est">
            <div><dt>Price</dt><dd className="tabular">{px(preview.price)}</dd></div>
            <div><dt>Price from</dt><dd>{preview.priceSource || "n/a"}</dd></div>
            <div><dt>Est qty</dt><dd className="tabular">{preview.estQty == null ? "n/a" : +preview.estQty.toFixed(6)}</dd></div>
            <div><dt>Est fees</dt><dd className="tabular">{usd(preview.estFees)}</dd></div>
            <div className="ot-total"><dt>{side === "buy" ? "Est cost" : "Est proceeds"}</dt><dd className="tabular">{preview.estCost == null ? "n/a" : usd(preview.estCost)}</dd></div>
          </dl>
          {preview.errors.length > 0 && <ul className="bt-msgs bad" aria-label="Errors">{preview.errors.map((m) => <li key={m}>{m}</li>)}</ul>}
          {preview.warnings.length > 0 && <ul className="bt-msgs" aria-label="Warnings">{preview.warnings.map((m) => <li key={m}>{m}</li>)}</ul>}
          <p className="ot-problem" aria-live="polite">{error ?? ""}</p>
          <div className="bt-actions">
            <button type="button" className="ot-side" onClick={fresh} disabled={busy}>Edit</button>
            <button type="button" className={`ot-go ${side}`} onClick={confirm} disabled={busy || blocked}>{error ? "Try again" : "Confirm"}</button>
          </div>
        </section>
      ) : (
        <form className="ot" aria-label="Order ticket" onSubmit={(e) => { e.preventDefault(); void doPreview(); }}>
          <div className="ot-head">
            <label className="ot-field bt-sym"><span>Symbol</span>
              <input className="ot-input" value={sym} placeholder="AAPL or BTC/USD" autoCapitalize="characters" spellCheck={false} onChange={(e) => edit(setSym)(e.target.value.toUpperCase())} />
            </label>
            <ModeBadge />
          </div>
          <div className="ot-sides" role="radiogroup" aria-label="Side">
            <button type="button" role="radio" aria-checked={side === "buy"} className={`ot-side buy ${side === "buy" ? "on" : ""}`} onClick={() => edit(setSide)("buy")}>Buy</button>
            <button type="button" role="radio" aria-checked={side === "sell"} className={`ot-side sell ${side === "sell" ? "on" : ""}`} onClick={() => edit(setSide)("sell")}>Sell</button>
          </div>
          <div className="ot-sides" role="radiogroup" aria-label="Size by">
            <button type="button" role="radio" aria-checked={sizeBy === "qty"} className={`ot-side ${sizeBy === "qty" ? "on" : ""}`} onClick={() => pickSize("qty")}>Quantity</button>
            <button type="button" role="radio" aria-checked={sizeBy === "notional"} className={`ot-side ${sizeBy === "notional" ? "on" : ""}`} onClick={() => pickSize("notional")} disabled={crypto}
              title="Dollar amounts work on market day orders only">Dollars</button>
          </div>
          <div className="ot-grid">
            <label className="ot-field"><span>Type</span>
              <select className="ot-input" value={type} onChange={(e) => edit(setType)(e.target.value as OrderType)}>
                {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="ot-field"><span>Time in force</span>
              <select className="ot-input" value={tif} onChange={(e) => edit(setTif)(e.target.value as TimeInForce)}>
                {tifs.map((k) => <option key={k} value={k}>{TIF_LABEL[k]}</option>)}
              </select></label>
            {sizeBy === "qty" ? <Num label="Qty" value={qty} onChange={edit(setQty)} inputRef={qtyRef} /> : <Num label="Amount ($)" value={notional} onChange={edit(setNotional)} inputRef={qtyRef} />}
            {needLimit && <Num label="Limit" value={limit} onChange={edit(setLimit)} />}
            {needStop && <Num label="Stop" value={stop} onChange={edit(setStop)} />}
          </div>
          {!crypto && sizeBy === "qty" && (
            <label className="bt-check"><input type="checkbox" checked={bracket} onChange={(e) => edit(setBracket)(e.target.checked)} /> Bracket (take profit and stop loss)</label>
          )}
          {bracket && (
            <div className="ot-grid">
              <Num label="Take profit" value={tp} onChange={edit(setTp)} />
              <Num label="Stop loss" value={sl} onChange={edit(setSl)} />
            </div>
          )}
          <p className="ot-problem" aria-live="polite">{problem ?? error ?? ""}</p>
          <button type="submit" className={`ot-go ${side}`} disabled={!!problem || busy}>{busy ? "Checking" : `Preview ${summary}`}</button>
        </form>
      )}
    </div>
  );
}
