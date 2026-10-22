// Markets data for the product side: crypto, perps, ETFs and "new and trending".
// The deploy job runs `parity markets export` and ships the files under /data/markets/;
// in local development the engine's own export (engine/output/markets) is served at
// /local/markets/. Shapes match engine/src/parity/markets/export.py.
//
// Percent fields from the engine are already in percent (10.95 means 10.95%).
import { useEffect, useState } from "react";
import { source } from "./data";
import type { Point } from "./types";

export interface MarketSource {
  id: string; name: string; provider: string; what: string; terms_url: string; licence: string;
  display: "yes" | "ask" | "no"; attribution: string | null; attribution_url: string | null;
  fetched_at: string | null; error: string | null;
}

export interface Coin {
  id: string; symbol: string; name: string; rank: number | null; price_usd: number | null;
  market_cap_usd: number | null; volume_24h_usd: number | null; change_24h_pct: number | null;
  change_7d_pct: number | null; change_30d_pct: number | null; change_1y_pct: number | null;
  ath_usd: number | null; ath_change_pct: number | null; ath_date: string | null;
  circulating_supply: number | null; max_supply: number | null; major: boolean;
}

export interface PriceStats {
  days: number; first_date: string; return_period_pct: number; vol_30d_pct: number | null; vol_period_pct: number;
  max_drawdown_pct: number; max_drawdown_date: string; below_peak_pct: number; worst_day_pct: number; worst_day: string;
  best_day_pct: number; best_day: string; big_days: number; down_days_share: number;
}

export interface CryptoDoc {
  generated_at: string; fetched_at: string | null; coins: Coin[];
  history: Record<string, { stats: PriceStats; prices: Point[] }>; sources: MarketSource[];
}

export interface FundingStats {
  avg_1d_annual_pct: number | null; avg_7d_annual_pct: number | null; avg_30d_annual_pct: number | null;
  positive_share_30d: number | null; max_hour_annual_pct: number | null; min_hour_annual_pct: number | null; hours: number;
}

export interface Perp {
  coin: string; max_leverage: number | null; funding_hourly: number | null; funding_annual_pct: number | null;
  open_interest_coins: number | null; open_interest_usd: number | null; mark_px: number | null; oracle_px: number | null;
  premium: number | null; day_volume_usd: number | null; change_24h_pct: number | null;
  liquidation_move_at_max_pct: number | null; funding: FundingStats | null; funding_daily: Point[];
}

export interface PerpsDoc {
  generated_at: string; fetched_at: string | null; venue: string; perps: Perp[]; hours_per_year: number;
  sources: MarketSource[]; withheld?: boolean;
}

export interface EtfTheme { id: string; label: string; what: string; check: string; glossary: string | null; count: number }

export interface Etf {
  ticker: string; name: string; issuer: string; themes: string[]; structure: "fund" | "trust";
  new_this_year: boolean; series_number: number | null; first_seen: string | null;
}

interface EtfsFile {
  generated_at: string; fetched_at: string | null; count: number; themes: EtfTheme[];
  columns: string[]; issuers: string[]; etfs: unknown[][]; sources: MarketSource[];
}

export interface EtfsDoc { generated_at: string; fetched_at: string | null; count: number; themes: EtfTheme[]; etfs: Etf[]; sources: MarketSource[] }

export interface Filing {
  adsh: string; form: string; root_form: string; kind: "new-company" | "new-series" | "trust" | "other"; what: string;
  filed: string; name: string; cik: string; tickers: string[]; description: string | null; url: string | null; themes: string[];
}

export interface TrendingCoin {
  position: number; id: string; symbol: string; name: string; market_cap_rank: number | null; price_usd: number | null;
  change_24h_pct: number | null; market_cap_usd: number | null; volume_24h_usd: number | null;
}

export interface DiscoverDoc {
  generated_at: string; filings: Filing[]; trending_coins: TrendingCoin[]; trending_fetched_at: string | null;
  newest_series: Etf[]; filing_days: number; sources: MarketSource[];
}

const base = source === "local" ? "/local/markets" : "/data/markets";
const cache = new Map<string, Promise<unknown>>();

function get<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${base}/${name}`, { cache: "no-cache" }).then(async (res) => {
      if (!res.ok) {
        cache.delete(name);
        throw new Error(res.status === 404 ? "No markets data has been exported yet. Run `parity markets fetch` then `parity markets export`." : `Could not load markets data (${res.status}).`);
      }
      return res.json();
    }));
  }
  return cache.get(name) as Promise<T>;
}

export const loadCrypto = () => get<CryptoDoc>("crypto.json");
export const loadPerps = () => get<PerpsDoc>("perps.json");
export const loadDiscover = () => get<DiscoverDoc>("discover.json");
export const loadEtfs = () => get<EtfsFile>("etfs.json").then((f): EtfsDoc => ({
  ...f,
  etfs: f.etfs.map((r) => {
    const d = Object.fromEntries(f.columns.map((c, i) => [c, r[i]])) as Record<string, unknown>;
    return { ...d, issuer: f.issuers[d.issuer as number] ?? "" } as unknown as Etf;
  }),
}));

/** Load one file; returns [data, error]. */
export function useMarket<T>(load: () => Promise<T>): [T | null, string | null] {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { load().then(setData).catch((e: Error) => setError(e.message)); }, [load]);
  return [data, error];
}

// ------------------------------------------------------------------ formatting

const MINUS = "−";

/** A percent already in percent units, with a true minus sign. */
export function pctText(v: number | null | undefined, digits = 1, signed = true): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const sign = v > 0 && signed ? "+" : v < 0 ? MINUS : "";
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
}

export function usd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const a = Math.abs(v);
  const digits = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return `${v < 0 ? MINUS : ""}$${a.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function usdCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const a = Math.abs(v);
  const s = a >= 1e12 ? `${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}K` : a.toFixed(0);
  return `${v < 0 ? MINUS : ""}$${s}`;
}

export function day(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const h = (Date.now() - new Date(iso).getTime()) / 3.6e6;
  if (h < 1) return "less than an hour ago";
  if (h < 48) return `${Math.round(h)} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime()) / 864e5);
}

// ------------------------------------------------------------------ practice positions

// Practice mode keeps hypothetical positions in this browser only. No real money, no
// orders, nothing sent anywhere. Every read and write tolerates storage being blocked.
export interface Practice {
  id: string; kind: "coin" | "etf"; symbol: string; name: string; coinId?: string;
  amount: number; entryPrice: number; entryDate: string;
  /** ETFs: we have no licensed price feed yet, so the user types the latest price. */
  manualPrice?: number;
}

const KEY = "parity.practice.v1";
const listeners = new Set<() => void>();

function readPractice(): Practice[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

let practice = readPractice();

export function savePractice(next: Practice[]) {
  practice = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked: keep in memory */ }
  listeners.forEach((l) => l());
}

export function usePractice(): Practice[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return practice;
}

export function addPractice(p: Omit<Practice, "id">) {
  savePractice([...practice, { ...p, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
}

export function removePractice(id: string) {
  savePractice(practice.filter((p) => p.id !== id));
}

export function updatePractice(id: string, patch: Partial<Practice>) {
  savePractice(practice.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

/** Value of a practice position at a price. Returns null when no price is known. */
export function positionValue(p: Practice, price: number | null | undefined) {
  if (price == null || !p.entryPrice) return null;
  const units = p.amount / p.entryPrice;
  const value = units * price;
  return { units, value, change: value - p.amount, changePct: (value / p.amount - 1) * 100 };
}
