// Watchlists and alerts (DEC-0033): the two saved tables, the default list a new person
// starts with, and the check that runs alerts against the latest delayed daily bars.
import { toast } from "../ui";
import { desktopNotify } from "../desktop/bridge";
import { dayOf, describeAlert, evaluateAlert, type AlertKind } from "../lib/alerts";
import { digitsFor, loadBars, priceText, type Instrument } from "../lib/tradeData";
import { table, type Row } from "../lib/userStore";

export interface WatchlistRow extends Row { name: string; items: string[]; position: number }
export interface AlertRow extends Row {
  symbol: string; kind: AlertKind; value: number | null; param: number | null; active: boolean;
  triggered_at: string | null; triggered_value: number | null; triggered_bar: string | null;
}

export const watchlistsTable = table<WatchlistRow>("trade_watchlists");
export const alertsTable = table<AlertRow>("trade_alerts");

/** What a new person's first list holds, where the export has it. */
export const DEFAULT_ITEMS = ["eq.US_MKT", "fx.EUR", "crypto.BTC", "crypto.ETH", "cmd.WTI", "bond.UST10Y"];

export const byPosition = (a: WatchlistRow, b: WatchlistRow) => a.position - b.position || (a.created_at ?? "").localeCompare(b.created_at ?? "");

let seeding: Promise<unknown> | null = null;
/** Makes the default list once, when the person has no list at all (the last list cannot be deleted). */
export function seedDefaultList(available: Instrument[]): Promise<unknown> {
  seeding ??= watchlistsTable.list().then((rows) => {
    if (rows.length) return;
    const have = new Set(available.map((s) => s.key));
    return watchlistsTable.insert({ name: "My first list", items: DEFAULT_ITEMS.filter((k) => have.has(k)), position: 0 });
  }).finally(() => { seeding = null; });
  return seeding;
}

/** The value an alert reports, in words: a price for price and cross alerts, a number for RSI. */
export function alertValueText(a: Pick<AlertRow, "kind">, v: number | null | undefined): string {
  if (v == null) return "n/a";
  return a.kind === "rsi_above" || a.kind === "rsi_below" ? v.toFixed(1) : priceText(v);
}

export function alertText(a: AlertRow): string {
  return describeAlert(a, (v) => priceText(v, digitsFor(v)));
}

let running: Promise<AlertRow[]> | null = null;

/**
 * Checks every active alert against its instrument's latest daily bars and marks the ones
 * that fire, with the bar's date and value, so each fires once. Shows a toast per alert.
 */
export function checkAlerts(insts: Instrument[]): Promise<AlertRow[]> {
  running ??= (async () => {
    const active = (await alertsTable.list()).filter((a) => a.active && !a.triggered_at);
    const fired: AlertRow[] = [];
    const bySymbol = new Map<string, AlertRow[]>();
    for (const a of active) bySymbol.set(a.symbol, [...(bySymbol.get(a.symbol) ?? []), a]);
    for (const [symbol, alerts] of bySymbol) {
      const inst = insts.find((s) => s.key === symbol);
      if (!inst) continue;
      const bars = await loadBars(inst, "D");
      if (bars.status !== "ok") continue;
      for (const a of alerts) {
        const hit = evaluateAlert(a, bars.data, dayOf(a.created_at));
        if (!hit) continue;
        const patch = { active: false, triggered_at: new Date().toISOString(), triggered_value: hit.value, triggered_bar: hit.bar };
        await alertsTable.update(a.id, patch);
        fired.push({ ...a, ...patch });
        toast(`${inst.short || inst.label}: ${alertText(a)} (${hit.bar}, ${alertValueText(a, hit.value)})`, { ms: 7000 });
        // The desktop app also shows it as a system notification (DEC-0041).
        desktopNotify(`${inst.short || inst.label}: ${alertText(a)}`, `${hit.bar}, ${alertValueText(a, hit.value)}`, `/trade/#/chart?s=${encodeURIComponent(symbol)}`);
      }
    }
    return fired;
  })().catch((e: Error) => { toast(e.message, { tone: "bad" }); return []; }).finally(() => { running = null; });
  return running;
}

// When the notifications were last opened, so the bell counts only new ones. This browser only.
const SEEN = "parity.trade.alertsSeen";
export function readSeen(): string {
  try { return window.localStorage.getItem(SEEN) ?? ""; } catch { return ""; }
}
export function writeSeen(iso: string) {
  try { window.localStorage.setItem(SEEN, iso); } catch { /* a convenience only */ }
}
