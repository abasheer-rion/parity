// Bybit with a Read-Only API key (DEC-0091). The person makes a system-generated (HMAC) key
// set to Read-Only. Before reading we ask Bybit about the key (query-api, which any key may
// call) and refuse it unless Bybit says it is read-only (readOnly = 1) and its wallet
// permissions do not include withdrawals.
//
// Official docs (fetched 3 November 2026):
//   https://bybit-exchange.github.io/docs/v5/guide (signing)
//   https://bybit-exchange.github.io/docs/v5/user/apikey-info
//   https://bybit-exchange.github.io/docs/v5/order/execution ("Get Trade History (2 years)")
//   https://bybit-exchange.github.io/docs/v5/rate-limit
// Limits: two years of history; seven days per request and 100 fills per page, so we walk the
// range a week at a time, for spot and for USDT and USDC contracts (linear); 50 calls a second
// per account for trade history and 600 per 5 seconds per IP address. Bybit refuses addresses
// in the United States and mainland China (403), so a read only works when our server runs
// elsewhere. Bybit's own documented example shows a read-only key that still lists trading
// permissions, so readOnly is the signal we trust; checking that against a real key is an open item.
import type { Fill } from "../../verify/parse/fills";
import { splitPair } from "../../verify/parse/fills";
import { hmac, toHex } from "../bytes";
import { call, guardSize, jsonOf } from "../http";
import { ConnectError, dayEnd, dayStart, isoTime, MAX_FILLS, refused, type Connector, type Range, type VenueCtx, type VenueRead } from "../types";

export interface BybitCredentials { apiKey: string; secret: string }

const NAME = "Bybit";
const BASE = "https://api.bybit.com";
const WEEK = 7 * 86_400_000;
const RECV = "10000";

async function get<T>(ctx: VenueCtx, c: BybitCredentials, path: string, params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams(params).toString();
  const ts = String(Math.floor(ctx.now()));
  const sign = toHex(await hmac("SHA-256", new TextEncoder().encode(c.secret), ts + c.apiKey + RECV + q));
  const res = await call(ctx, `${BASE}${path}${q ? `?${q}` : ""}`, {
    headers: { "X-BAPI-API-KEY": c.apiKey, "X-BAPI-TIMESTAMP": ts, "X-BAPI-RECV-WINDOW": RECV, "X-BAPI-SIGN": sign, Accept: "application/json" },
  }, { venue: NAME });
  if (res.status === 403) throw new ConnectError(451, "Bybit refused our server's address. Bybit does not answer from the United States or mainland China; upload Bybit's export file instead.", "venue_down");
  const j = await jsonOf<{ retCode?: number; retMsg?: string; result?: T }>(res, NAME);
  const code = j.retCode ?? -1;
  if (code === 0 && j.result) return j.result;
  if (code === 10003 || code === 10004 || code === 33004) throw new ConnectError(401, "Bybit did not accept this key. Check the API key and the secret key, and that the key has not expired.", "venue_auth");
  if (code === 10010) throw new ConnectError(401, "This Bybit key only works from certain IP addresses, and ours is not one of them. Make a key without an address limit.", "venue_auth");
  if (code === 10005) throw new ConnectError(403, "Bybit says this key may not read this.", "venue_auth");
  if (code === 10006) throw new ConnectError(429, "Bybit is limiting how often it can be asked. Try again in a minute.", "venue_limit");
  throw new ConnectError(502, `Bybit could not answer this request (code ${String(code).replace(/[^-\d]/g, "")}). Try again later.`, "venue_down");
}

interface KeyInfo { readOnly?: unknown; permissions?: Record<string, unknown>; userID?: unknown; userIDInt64?: unknown }

export function judgeKey(k: KeyInfo): void {
  if (k.readOnly !== 1 && k.readOnly !== "1") throw refused(NAME, "trade or move money (it is set to Read and Write)");
  const wallet = Array.isArray(k.permissions?.Wallet) ? (k.permissions!.Wallet as unknown[]) : [];
  if (wallet.includes("Withdraw")) throw refused(NAME, "withdraw money");
}

interface Exec { symbol?: string; side?: string; execPrice?: string; execQty?: string; execValue?: string; execFee?: string; feeCurrency?: string; execTime?: string; execType?: string }

/** Bybit's kinds of fill that are trades. Funding and settlement rows are not. */
const TRADE_TYPES = new Set(["Trade", "BustTrade", "AdlTrade"]);

export function fillsFrom(rows: Exec[], range: Range, spot: boolean): { fills: Fill[]; feeCoins: string[] } {
  const lo = dayStart(range.from), hi = dayEnd(range.to);
  const fills: Fill[] = [];
  const feeCoins = new Set<string>();
  for (const e of rows) {
    const ms = Number(e.execTime);
    if (!Number.isFinite(ms) || ms < lo || ms > hi || !e.symbol) continue;
    if (e.execType && !TRADE_TYPES.has(e.execType)) continue;
    const price = Number(e.execPrice), qty = Number(e.execQty), value = Number(e.execValue), fee = Number(e.execFee ?? 0);
    if (!(price > 0) || !(qty > 0)) continue;
    const side = e.side === "Buy" ? "buy" : e.side === "Sell" ? "sell" : null;
    if (!side) continue;
    // Contracts pay fees in the settle coin, which is the quote. Spot fees can be in either coin.
    let cost = Number.isFinite(fee) ? fee : 0;
    if (spot && e.feeCurrency) {
      const pair = splitPair(e.symbol);
      if (pair && e.feeCurrency === pair.base) cost = fee * price;
      else if (pair && e.feeCurrency !== pair.quote) { if (fee) feeCoins.add(e.feeCurrency); cost = 0; }
    }
    fills.push({ time: isoTime(ms), symbol: e.symbol, side, qty, price, value: Number.isFinite(value) && value > 0 ? value : qty * price, fee: cost });
  }
  return { fills, feeCoins: [...feeCoins] };
}

/** Runs jobs a few at a time, keeping their order. */
export async function pool<T, R>(items: T[], size: number, job: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await job(items[i]); } };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

async function category(ctx: VenueCtx, c: BybitCredentials, cat: "spot" | "linear", range: Range): Promise<Exec[]> {
  const end = dayEnd(range.to);
  const weeks: [number, number][] = [];
  for (let start = dayStart(range.from); start <= end; start += WEEK) weeks.push([start, Math.min(start + WEEK - 1, end)]);
  // Six weeks at a time: well under Bybit's 50 calls a second, and a two-year range fits in our time limit.
  const pages = await pool(weeks, 6, async ([start, stop]) => {
    const out: Exec[] = [];
    let cursor = "";
    for (;;) {
      const params: Record<string, string> = { category: cat, startTime: String(start), endTime: String(stop), limit: "100" };
      if (cursor) params.cursor = cursor;
      const r = await get<{ list?: Exec[]; nextPageCursor?: string }>(ctx, c, "/v5/execution/list", params);
      const list = Array.isArray(r.list) ? r.list : [];
      out.push(...list);
      const next = typeof r.nextPageCursor === "string" ? r.nextPageCursor : "";
      if (!list.length || !next || next === cursor) break;
      cursor = next;
    }
    return out;
  });
  const all = pages.flat();
  guardSize(all.length, NAME, MAX_FILLS);
  return all;
}

export const bybit: Connector<BybitCredentials> = {
  id: "bybit",
  credentials(raw) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const apiKey = typeof r.apiKey === "string" ? r.apiKey.trim() : "";
    const secret = typeof r.secret === "string" ? r.secret.trim() : "";
    if (!apiKey) throw new ConnectError(400, "Fill in the API key.");
    if (!secret) throw new ConnectError(400, "Fill in the secret key.");
    if (!/^[A-Za-z0-9]{10,64}$/.test(apiKey)) throw new ConnectError(400, "The API key does not look right. Copy it again from Bybit.");
    if (!/^[A-Za-z0-9]{10,128}$/.test(secret)) throw new ConnectError(400, "The secret key does not look right. Parity takes Bybit's system-generated (HMAC) keys, not self-generated RSA keys.");
    return { apiKey, secret };
  },
  async check(c, ctx) {
    judgeKey(await get<KeyInfo>(ctx, c, "/v5/user/query-api", {}));
  },
  async read(c, range, ctx): Promise<VenueRead> {
    const info = await get<KeyInfo>(ctx, c, "/v5/user/query-api", {});
    const account = info.userID != null ? String(info.userID) : info.userIDInt64 != null ? String(info.userIDInt64) : "";
    if (!/^\d{1,20}$/.test(account)) throw new ConnectError(502, "Bybit did not say which account this key belongs to. Try again later.", "venue_down");
    const spot = fillsFrom(await category(ctx, c, "spot", range), range, true);
    const linear = fillsFrom(await category(ctx, c, "linear", range), range, false);
    const notes: string[] = ["Funding paid or received on contracts is not taken off: Bybit books it apart from the fills."];
    if (spot.feeCoins.length) notes.push(`Fees paid in ${spot.feeCoins.join(", ")} are left out: we do not hold a price for ${spot.feeCoins.length === 1 ? "that coin" : "those coins"}.`);
    return {
      account, env: "live", allowShort: false, sameAs: "bybit", notes,
      // Spot cannot be sold short; contracts can. Each is paired on its own.
      fillGroups: [{ fills: spot.fills, allowShort: false }, { fills: linear.fills, allowShort: true }],
    };
  },
};
