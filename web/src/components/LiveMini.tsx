// A compact live board (DEC-0052, DEC-0063) for the Terminal (LIVE) and the Workbench: a few streamed
// symbols with prices that tick in place, a small live chart of the one picked, and the
// latency badge. Prices are written straight to the page on each frame, not through React.
import { useEffect, useRef, useState } from "react";
import { subscribeStatus, subscribeTicks } from "../lib/live/client";
import { digitsFor, priceText } from "../lib/tradeData";
import { ProChart } from "../ui/proChart";
import { tfFor, useLiveBars } from "../trade/live";
import { ConfidenceTag, LiveBadge } from "./LiveBadge";
import "./liveMini.css";
import { PauseLive } from "./PauseLive";

export const LIVE_BOARD = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "BNB-USD", "DOGE-USD", "ADA-USD", "LINK-USD"];
/** The Parity price board (DEC-0065): live from DEX swaps on six chains, shown to everyone. */
export const ONCHAIN_BOARD = ["BTC-USD", "ETH-USD", "BNB-USD", "XRP-USD", "SOL-USD", "ADA-USD", "LINK-USD", "AAVE-USD"];

/**
 * The public source to show: our on-chain feed, or CoinGecko (delayed) after the on-chain
 * line has been down for 20 s. It goes back once the on-chain feed is up again.
 */
export function usePublicSource(): "onchain" | "coingecko" {
  const [src, setSrc] = useState<"onchain" | "coingecko">("onchain");
  useEffect(() => {
    // Down until the first status says otherwise, so a line that never opens also falls back.
    let downSince = Date.now();
    const check = () => { if (downSince && Date.now() - downSince > 20_000) setSrc("coingecko"); };
    const stop = subscribeStatus("onchain", (s) => {
      const down = s.line !== "open" || s.upstream !== "up" || !!s.refused;
      if (!down) { downSince = 0; setSrc("onchain"); return; }
      downSince ||= Date.now();
      check();
    });
    const t = window.setInterval(check, 5_000);
    return () => { stop(); window.clearInterval(t); };
  }, []);
  return src;
}

function Row({ src, sym, on, pick }: { src: string; sym: string; on: boolean; pick: () => void }) {
  const px = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  useEffect(() => subscribeTicks(src, sym, (t) => {
    const el = px.current;
    if (!el) return;
    el.textContent = priceText(t.p, digitsFor(t.p));
    if (prev.current != null && t.p !== prev.current) el.dataset.dir = t.p > prev.current ? "up" : "down";
    prev.current = t.p;
  }), [src, sym]);
  return (
    <li>
      <button type="button" className={on ? "on" : ""} aria-pressed={on} onClick={pick}>
        <span>{sym.replace(/-USDC?$/, "")}</span>
        <span ref={px} className="tabular lm-px">…</span>
      </button>
    </li>
  );
}

export function LiveMini({ src: want, symbols: wantSyms, height = 220 }: { src?: string; symbols?: string[]; height?: number }) {
  const pub = usePublicSource();
  const src = want ?? pub;
  const symbols = wantSyms ?? (src === "onchain" ? ONCHAIN_BOARD : LIVE_BOARD);
  const [pick, setSym] = useState(symbols[0]);
  const sym = symbols.includes(pick) ? pick : symbols[0];
  const tf = tfFor(src, undefined);
  const state = useLiveBars({ src, sym }, tf);
  const b = state.status === "ok" ? state.data : null;
  return (
    <div className="lmini">
      <div className="lmini-head">
        <strong>{sym}</strong>
        {src === "coingecko" && <a className="lmini-attr" href="https://www.coingecko.com/" target="_blank" rel="noreferrer">Data provided by CoinGecko</a>}
        {src === "onchain" && <ConfidenceTag src={src} sym={sym} />}
        <span className="lmini-gap" />
        <PauseLive />
        <LiveBadge src={src} />
      </div>
      <div className="lmini-body">
        <ul className="lmini-list" aria-label="Live prices">
          {symbols.map((s) => <Row key={s} src={src} sym={s} on={s === sym} pick={() => setSym(s)} />)}
        </ul>
        <div className="lmini-chart" style={{ height }}>
          {b && b.bars.length ? (
            <ProChart fill bare bars={b.bars} live={b} viewKey={`${src}:${sym}:${tf}`} label={sym} type="candles" height={height} digits={digitsFor(b.bars[b.bars.length - 1].close)} />
          ) : <div className="lmini-msg">{state.status === "error" ? "No data" : state.status === "missing" ? state.message : ""}</div>}
        </div>
      </div>
    </div>
  );
}
