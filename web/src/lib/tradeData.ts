// What the Trade area can chart: every series the Parity Terminal export may show
// (DEC-0024; only sources whose terms allow display, REF-0014 and REF-0015), with crypto
// volume added from the Markets export where CoinGecko gives it. All of it is end of day
// and delayed; nothing here is a live quote.
import { loadSeries, loadIndex, type Loadable, type TermSeries } from "../terminal/data";
import { barsFromCloses, resample, type Timeframe } from "./bars";
import type { Bar } from "./indicators";
import { loadCrypto } from "./markets";

export type { Loadable };

export interface Instrument extends TermSeries {
  /** CoinGecko id when the series is a coin, for volume. */
  coinId?: string;
}

export const CLASS_LABEL: Record<string, string> = {
  equities: "Indices and US equities", fx: "Currencies (FX)", crypto: "Crypto", commodities: "Commodities",
  rates: "Rates and yields", positioning: "Positioning", macro: "Macro",
};
export const CLASS_ORDER = ["equities", "fx", "crypto", "commodities", "rates", "positioning", "macro"];

let instP: Promise<Loadable<Instrument[]>> | null = null;

/** Every chartable series, in catalog order. */
export function loadInstruments(): Promise<Loadable<Instrument[]>> {
  instP ??= loadIndex().then(async (r) => {
    if (r.status !== "ok") return r;
    const coins = await loadCrypto().then((d) => d.coins).catch(() => []);
    const bySymbol = new Map(coins.map((c) => [c.symbol.toUpperCase(), c.id]));
    const list = r.data.series.map((s): Instrument => (s.class === "crypto" && bySymbol.has(s.short.toUpperCase()) ? { ...s, coinId: bySymbol.get(s.short.toUpperCase()) } : s));
    return { status: "ok" as const, data: list };
  });
  return instP;
}

async function volumesFor(inst: Instrument): Promise<Map<string, number> | undefined> {
  if (!inst.coinId) return undefined;
  try {
    const doc = await loadCrypto();
    const v = (doc.history[inst.coinId] as { volumes?: [string, number | null][] } | undefined)?.volumes;
    if (!v?.length) return undefined;
    return new Map(v.filter((x): x is [string, number] => x[1] != null && Number.isFinite(x[1])));
  } catch {
    return undefined;
  }
}

/** Before 2016 the export keeps one close a week, so daily charts start in 2016. */
export const DAILY_FROM = "2016-01-01";

const barsP = new Map<string, Promise<Loadable<Bar[]>>>();

/** Daily bars for an instrument (from its whole history), cached. */
export function loadDailyBars(inst: Instrument): Promise<Loadable<Bar[]>> {
  let p = barsP.get(inst.key);
  if (!p) {
    p = Promise.all([loadSeries(inst), volumesFor(inst)]).then(([r, vols]) => (r.status === "ok" ? { status: "ok" as const, data: barsFromCloses(r.data, vols) } : r));
    barsP.set(inst.key, p);
  }
  return p;
}

/** Bars for a timeframe. Daily charts show only the part of history that is daily. */
export async function loadBars(inst: Instrument, tf: Timeframe): Promise<Loadable<Bar[]>> {
  const r = await loadDailyBars(inst);
  if (r.status !== "ok") return r;
  const daily = inst.freq === "D" ? r.data.filter((b) => b.time >= DAILY_FROM) : r.data;
  if (tf === "D") return { status: "ok", data: inst.freq === "D" ? daily : r.data };
  // Weekly and monthly bars use the whole history (weekly before 2016 is still one close a week).
  return { status: "ok", data: resample(r.data, tf) };
}

/** How old the data is, in words: always end of day, never live. */
export function delayText(inst: Pick<TermSeries, "asof" | "freq">, today = new Date()): string {
  const asof = new Date(`${inst.asof}T00:00:00Z`);
  const days = Math.max(0, Math.round((today.getTime() - asof.getTime()) / 86400000));
  const freq = inst.freq === "D" ? "Daily closes" : inst.freq === "W" ? "Weekly values" : inst.freq === "M" ? "Monthly values" : "Values";
  return `${freq}, as of ${asof.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} (${days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`}). Delayed, not live.`;
}

/** Sensible decimals for a price level. */
export function digitsFor(v: number | null | undefined): number {
  const a = Math.abs(v ?? 0);
  return a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : 8;
}

export function priceText(v: number | null | undefined, digits?: number): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const d = digits ?? digitsFor(v);
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");
}
