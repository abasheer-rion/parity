// Depth of book and recent trades for a live crypto symbol (DEC-0053), in Trade's side panel.
// Rows are drawn once at a fixed count and height; each update (at most once per animation
// frame, batched by the live client) writes text and bar widths straight into them, so a busy
// book never re-renders React or moves the layout.
import { useEffect, useRef, useState } from "react";
import { subscribeBook, subscribeTrades, type BookSnap } from "../lib/live/client";
import type { TradeRow } from "../lib/live/protocol";
import { sourceById } from "../lib/live/sources";
import { digitsFor, priceText } from "../lib/tradeData";

const LEVELS = 12;
const TRADES = 40;

const sizeText = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(2)}K` : v >= 1 ? v.toFixed(3) : v.toPrecision(3));
const hhmmss = (ms: number) => new Date(ms).toTimeString().slice(0, 8);

export const hasBook = (src: string | undefined) => !!src && !!sourceById(src)?.book;

export function BookPanel({ src, sym }: { src: string; sym: string }) {
  const [tab, setTab] = useState<"book" | "trades">("book");
  return (
    <div className="bk">
      <div className="bk-tabs" role="tablist" aria-label="Book and trades">
        <button type="button" role="tab" aria-selected={tab === "book"} className={tab === "book" ? "on" : ""} onClick={() => setTab("book")}>Book</button>
        <button type="button" role="tab" aria-selected={tab === "trades"} className={tab === "trades" ? "on" : ""} onClick={() => setTab("trades")}>Trades</button>
        <span className="bk-sym">{sym}</span>
      </div>
      {tab === "book" ? <Book key={`${src}:${sym}`} src={src} sym={sym} /> : <Trades key={`${src}:${sym}`} src={src} sym={sym} />}
    </div>
  );
}

function Book({ src, sym }: { src: string; sym: string }) {
  const asks = useRef<(HTMLDivElement | null)[]>([]);
  const bids = useRef<(HTMLDivElement | null)[]>([]);
  const mid = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    let seen = false;
    const fill = (rows: (HTMLDivElement | null)[], levels: [number, number][], max: number, digits: number) => {
      let cum = 0;
      rows.forEach((el, i) => {
        if (!el) return;
        const l = levels[i];
        const [p, q, bar] = el.children as unknown as HTMLElement[];
        if (!l) { p.textContent = ""; q.textContent = ""; bar.style.transform = "scaleX(0)"; return; }
        cum += l[1];
        p.textContent = priceText(l[0], digits);
        q.textContent = sizeText(l[1]);
        bar.style.transform = `scaleX(${Math.min(1, cum / max).toFixed(3)})`;
      });
    };
    return subscribeBook(src, sym, (b: BookSnap) => {
      if (!seen) { seen = true; setEmpty(false); }
      const ask = b.a.slice(0, LEVELS), bid = b.b.slice(0, LEVELS);
      const max = Math.max(ask.reduce((s, l) => s + l[1], 0), bid.reduce((s, l) => s + l[1], 0)) || 1;
      const ref = bid[0]?.[0] ?? ask[0]?.[0] ?? 1;
      const digits = Math.max(digitsFor(ref), 2);
      // Asks are listed best last (nearest the middle), so the rows fill from the bottom up.
      fill([...asks.current].reverse(), ask, max, digits);
      fill(bids.current, bid, max, digits);
      if (mid.current && ask[0] && bid[0]) {
        const spread = ask[0][0] - bid[0][0];
        mid.current.textContent = `Spread ${priceText(spread, digits)} (${((spread / ((ask[0][0] + bid[0][0]) / 2)) * 10_000).toFixed(1)} bp)`;
      }
    });
  }, [src, sym]);
  const row = (side: "a" | "b", i: number, refs: typeof asks) => (
    <div key={`${side}${i}`} ref={(el) => { refs.current[i] = el; }} className={`bk-row bk-${side}`}><span className="tabular" /><span className="tabular" /><i aria-hidden /></div>
  );
  return (
    <div className="bk-book" aria-label={`Order book, ${sym}`} aria-busy={empty}>
      <div className="bk-head"><span>Price</span><span>Size</span></div>
      {Array.from({ length: LEVELS }, (_, i) => row("a", i, asks))}
      <div ref={mid} className="bk-mid tabular">{empty ? "Waiting for the book" : ""}</div>
      {Array.from({ length: LEVELS }, (_, i) => row("b", i, bids))}
    </div>
  );
}

function Trades({ src, sym }: { src: string; sym: string }) {
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const list = useRef<TradeRow[]>([]);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    list.current = [];
    let seen = false;
    return subscribeTrades(src, sym, (d) => {
      if (!seen) { seen = true; setEmpty(false); }
      list.current = [...d.slice().reverse(), ...list.current].slice(0, TRADES);
      const digits = Math.max(digitsFor(list.current[0]?.[1] ?? 1), 2);
      rows.current.forEach((el, i) => {
        if (!el) return;
        const t = list.current[i];
        const [tm, p, q] = el.children as unknown as HTMLElement[];
        el.className = `bk-row bk-t ${t ? (t[3] === 1 ? "good" : t[3] === 2 ? "bad" : "") : ""}`;
        tm.textContent = t ? hhmmss(t[0]) : "";
        p.textContent = t ? priceText(t[1], digits) : "";
        q.textContent = t ? sizeText(t[2]) : "";
      });
    });
  }, [src, sym]);
  return (
    <div className="bk-trades" aria-label={`Recent trades, ${sym}`} aria-busy={empty}>
      <div className="bk-head bk-head3"><span>Time</span><span>Price</span><span>Size</span></div>
      {empty && <div className="bk-mid">Waiting for trades</div>}
      {Array.from({ length: TRADES }, (_, i) => (
        <div key={i} ref={(el) => { rows.current[i] = el; }} className="bk-row bk-t"><span className="tabular" /><span className="tabular" /><span className="tabular" /></div>
      ))}
    </div>
  );
}
