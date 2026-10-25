// Live symbols in Parity Trade (DEC-0049): the whole symbol universe for search, live
// candles that tick in place, and the strategy signals drawn on them.
//
// Keys: "L:<source>:<symbol>" is a streamed symbol (for example L:hyperliquid:BTC-PERP);
// "S:<ticker>" is a US-listed stock or fund from the SEC's list. Existing keys (eq.US_MKT,
// fx.EUR and so on) are the daily series the Terminal export already carries.
import { useEffect, useMemo, useState } from "react";
import type { Bar } from "../lib/indicators";
import { CandleBuilder, LIVE_TFS, type LiveTf } from "../lib/live/candles";
import { liveOrigin, subscribeTicks } from "../lib/live/client";
import { sourceById } from "../lib/live/sources";
import type { Instrument, Loadable } from "../lib/tradeData";

export interface UniverseDoc { at: number; stocks: [string, string, string][]; live: Record<string, string[]> }

const httpOrigin = () => liveOrigin().replace(/^ws/, "http");

let uniP: Promise<UniverseDoc | null> | null = null;
/** The symbol universe, loaded once per page and cached by the edge for a day. */
export function loadUniverse(): Promise<UniverseDoc | null> {
  uniP ??= fetch(`${httpOrigin()}/live/universe`).then((r) => (r.ok ? (r.json() as Promise<UniverseDoc>) : null)).catch(() => null);
  return uniP;
}

export function useUniverse(on = true): UniverseDoc | null {
  const [u, setU] = useState<UniverseDoc | null>(null);
  useEffect(() => { if (!on) return; let live = true; void loadUniverse().then((d) => { if (live) setU(d); }); return () => { live = false; }; }, [on]);
  return u;
}

export interface LiveRef { src: string; sym: string }
export interface StockRef { ticker: string; exchange: string }
export type ExtInstrument = Instrument & { live?: LiveRef; stock?: StockRef };

const BASE = { group: "", licence: "", kind: "price" as const, unit: "", first: "", asof: "", last: null, chg: {}, vol: null, z: null, pct1y: null, spark: [], file: "" };

export function liveInstrument(src: string, sym: string): ExtInstrument {
  const meta = sourceById(src);
  const perp = sym.endsWith("-PERP");
  const base = sym.replace(/-(PERP|USD)$/, "");
  return { ...BASE, key: `L:${src}:${sym}`, short: sym, label: `${base} ${perp ? "perpetual" : "in US dollars"}, ${meta?.short ?? src}`, class: "crypto", freq: "live", source: meta?.name ?? src, live: { src, sym } };
}

export function stockInstrument(ticker: string, name: string, exchange: string): ExtInstrument {
  return { ...BASE, key: `S:${ticker}`, short: ticker, label: name || ticker, class: "equities", freq: "D", source: "SEC symbol list", stock: { ticker, exchange } };
}

/** Every symbol the search can offer beyond the daily series: live first, then stocks. */
export function universeInstruments(u: UniverseDoc | null): ExtInstrument[] {
  if (!u) return [];
  const out: ExtInstrument[] = [];
  for (const [src, syms] of Object.entries(u.live)) for (const s of syms) out.push(liveInstrument(src, s));
  for (const [t, n, ex] of u.stocks) out.push(stockInstrument(t, n, ex));
  return out;
}

/** An instrument for a key, from the universe or rebuilt from the key itself. */
export function instrumentForKey(key: string, u: UniverseDoc | null): ExtInstrument | null {
  if (key.startsWith("L:")) {
    const [, src, sym] = key.split(":");
    return src && sym ? liveInstrument(src, sym) : null;
  }
  if (key.startsWith("S:")) {
    const t = key.slice(2);
    const row = u?.stocks.find((r) => r[0] === t);
    return stockInstrument(t, row?.[1] ?? t, row?.[2] ?? "");
  }
  return null;
}

export const isLiveTf = (v: unknown): v is LiveTf => LIVE_TFS.some((t) => t.id === v);

/** The timeframes a source's history supports, and the one a chart starts on. */
export function tfsFor(src: string): typeof LIVE_TFS {
  const only = sourceById(src)?.tfs;
  return only ? LIVE_TFS.filter((t) => only.includes(t.id)) : LIVE_TFS;
}
export function tfFor(src: string, want: LiveTf | undefined): LiveTf {
  const list = tfsFor(src);
  return want && list.some((t) => t.id === want) ? want : list[0].id;
}

/**
 * Candles for a streamed symbol: the source's own history, then live updates folded in
 * by the CandleBuilder (which the chart reads in place, once per frame).
 */
export function useLiveBars(ref: LiveRef | undefined, tf: LiveTf): Loadable<CandleBuilder> {
  const [state, setState] = useState<Loadable<CandleBuilder>>({ status: "loading" });
  const key = ref ? `${ref.src}:${ref.sym}:${tf}` : "";
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    let stop: (() => void) | null = null;
    setState({ status: "loading" });
    fetch(`${httpOrigin()}/live/history?src=${encodeURIComponent(ref.src)}&s=${encodeURIComponent(ref.sym)}&tf=${tf}`)
      .then(async (r) => {
        if (!alive) return;
        const history: Bar[] = r.ok ? ((await r.json()) as { bars: Bar[] }).bars ?? [] : [];
        const b = new CandleBuilder(history, tf, !!sourceById(ref.src)?.fromCloses);
        // Ticks that arrive before history lands are folded in too (older ones are ignored).
        stop = subscribeTicks(ref.src, ref.sym, (t) => b.apply(t));
        setState({ status: "ok", data: b });
      })
      .catch((e: Error) => { if (alive) setState({ status: "error", message: e.message }); });
    return () => { alive = false; stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Finished bars in a builder, refreshed each time a bar finishes (not per tick). */
export function useClosedCount(b: CandleBuilder | null): number {
  const [n, setN] = useState(() => b?.closed ?? 0);
  useEffect(() => {
    if (!b) return;
    setN(b.closed);
    return b.on((c) => { if (c === "new") setN(b.closed); });
  }, [b]);
  // A forming bar that finishes with no new trade (a quiet symbol) is caught each minute.
  useEffect(() => {
    if (!b) return;
    const t = window.setInterval(() => setN(b.closed), 15_000);
    return () => window.clearInterval(t);
  }, [b]);
  return useMemo(() => n, [n]);
}
