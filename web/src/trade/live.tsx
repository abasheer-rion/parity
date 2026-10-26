// Live symbols in Parity Trade (DEC-0052): the whole symbol universe for search, live
// candles that tick in place, and the strategy signals drawn on them.
//
// Keys: "L:<source>:<symbol>" is a streamed symbol (for example L:hyperliquid:BTC-PERP);
// "S:<ticker>" is a US-listed stock or fund from the SEC's list. Existing keys (eq.US_MKT,
// fx.EUR and so on) are the daily series the Terminal export already carries.
import { useEffect, useMemo, useState } from "react";
import type { Bar } from "../lib/indicators";
import { CandleBuilder, LIVE_TFS, type LiveTf } from "../lib/live/candles";
import { liveOrigin, subscribeTicks } from "../lib/live/client";
import { isInternal, sourceById } from "../lib/live/sources";
import { loadTeam, teamHeaders } from "../lib/live/team";
import type { Instrument, Loadable } from "../lib/tradeData";

export interface UniverseDoc { at: number; stocks: [string, string, string][]; live: Record<string, string[]>; liveStocks?: string }

const httpOrigin = () => liveOrigin()?.replace(/^ws/, "http") ?? null;

let uniP: Promise<UniverseDoc | null> | null = null;
/** The symbol universe, loaded once per page and cached by the edge. Team members get every
 *  team-only venue's pairs too (DEC-0056); everyone else gets the public list. */
export function loadUniverse(): Promise<UniverseDoc | null> {
  const o = httpOrigin();
  if (!o) return Promise.resolve(null);
  const pub = () => fetch(`${o}/live/universe`).then((r) => (r.ok ? (r.json() as Promise<UniverseDoc>) : null));
  uniP ??= loadTeam()
    .then(async (t) => {
      if (!t.team) return pub();
      const r = await fetch(`${o}/live/universe?team=1`, { headers: await teamHeaders(), credentials: "include" });
      return r.ok ? (r.json() as Promise<UniverseDoc>) : pub();
    })
    .catch(() => null);
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

/** Government currencies: a pair of two of these is FX, even on a crypto venue. */
export const FIAT = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SGD", "HKD", "SEK", "NOK", "DKK", "PLN", "MXN", "TRY", "ZAR", "AED", "BRL"]);
const QUOTE_WORDS: Record<string, string> = { USD: "US dollars", EUR: "euros", GBP: "pounds", JPY: "yen", CHF: "Swiss francs", CAD: "Canadian dollars", AUD: "Australian dollars" };

/** Base and quote of a pair symbol ("ETH-BTC"), or null for a perp or a ticker. */
export function pairParts(sym: string): [string, string] | null {
  const m = /^([A-Z0-9]+)-([A-Z0-9]+)$/.exec(sym);
  return m && m[2] !== "PERP" ? [m[1], m[2]] : null;
}
export const isFxPair = (sym: string) => { const p = pairParts(sym); return !!p && FIAT.has(p[0]) && FIAT.has(p[1]); };

export function liveInstrument(src: string, sym: string): ExtInstrument {
  const meta = sourceById(src);
  const where = meta?.short ?? src;
  if (meta?.stocks) return { ...BASE, key: `L:${src}:${sym}`, short: sym, label: `${sym}, ${where}`, class: "equities", freq: "live", source: meta.name, live: { src, sym } };
  if (sym.endsWith("-PERP")) return { ...BASE, key: `L:${src}:${sym}`, short: sym, label: `${sym.slice(0, -5)} perpetual, ${where}`, class: "crypto", freq: "live", source: meta?.name ?? src, live: { src, sym } };
  const p = pairParts(sym);
  const fx = isFxPair(sym);
  const label = p ? `${p[0]} in ${QUOTE_WORDS[p[1]] ?? p[1]}, ${where}${fx ? " (FX from a crypto venue)" : ""}` : `${sym}, ${where}`;
  return { ...BASE, key: `L:${src}:${sym}`, short: sym, label, class: fx ? "fx" : "crypto", freq: "live", source: meta?.name ?? src, live: { src, sym } };
}

/** A stock from the SEC list. With a keyed stock feed for the team, it streams from that source. */
export function stockInstrument(ticker: string, name: string, exchange: string, liveSrc?: string): ExtInstrument {
  const base: ExtInstrument = { ...BASE, key: `S:${ticker}`, short: ticker, label: name || ticker, class: "equities", freq: "D", source: "SEC symbol list", stock: { ticker, exchange } };
  return liveSrc ? { ...base, freq: "live", source: sourceById(liveSrc)?.name ?? liveSrc, live: { src: liveSrc, sym: ticker } } : base;
}

/** Every symbol the search can offer beyond the daily series: live first, then stocks. */
export function universeInstruments(u: UniverseDoc | null): ExtInstrument[] {
  if (!u) return [];
  const out: ExtInstrument[] = [];
  for (const [src, syms] of Object.entries(u.live)) for (const s of syms) out.push(liveInstrument(src, s));
  for (const [t, n, ex] of u.stocks) out.push(stockInstrument(t, n, ex, u.liveStocks));
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
    return stockInstrument(t, row?.[1] ?? t, row?.[2] ?? "", u?.liveStocks);
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
    // A free source can refuse for a while (rate limits by address); try three times, 8 s apart,
    // then start from live updates alone.
    const origin = httpOrigin();
    if (!origin) { setState({ status: "missing", message: "Live data runs on the deployed site" }); return; }
    const url = `${origin}/live/history?src=${encodeURIComponent(ref.src)}&s=${encodeURIComponent(ref.sym)}&tf=${tf}`;
    const get = async (left: number): Promise<Response> => {
      // Team-only sources: the edge checks the sign-in (cookie on the site, bearer from the desktop app).
      const init: RequestInit = isInternal(ref.src) ? { headers: await teamHeaders(), credentials: "include" } : {};
      const r = await fetch(url, init).catch(() => null);
      if ((r && r.ok) || left <= 0 || !alive) return r ?? new Response(null, { status: 599 });
      await new Promise((ok) => window.setTimeout(ok, 8_000));
      return get(left - 1);
    };
    get(2)
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
