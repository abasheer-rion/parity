// Kraken spot with a query-only API key (DEC-0091). The person makes a key with "Query
// closed orders & trades" (and nothing that trades, moves or withdraws money), and gives us
// the key and its private key. Before reading anything we ask Kraken what the key may do
// (GetApiKeyInfo, which needs no permission itself) and refuse it unless every permission is
// a query or export one. If Kraken cannot tell us, we refuse.
//
// Official docs (fetched 3 November 2026):
//   https://docs.kraken.com/exchange/guides/rest/authentication.md
//   https://docs.kraken.com/api-reference/account-data/get-api-key-info.md
//   https://docs.kraken.com/api-reference/account-data/get-trades-history.md
//   https://docs.kraken.com/exchange/guides/rest/ratelimits.md
//   https://docs.kraken.com/api-reference/market-data/get-tradable-asset-pairs.md
// Limits: each trade-history call costs 2 on a counter of 15 (Starter) that falls by 0.33 a
// second, 20 for Intermediate and Pro; at most 100 trades a call. So one read gets roughly a
// thousand trades before our 25-second limit; for more, pick a shorter range or upload
// trades.csv. A key with two-step login for API calls (otp) is not supported.
import type { Fill } from "../../verify/parse/fills";
import { fromB64, hmac, sha256, toB64, utf8 } from "../bytes";
import { call, guardSize, jsonOf } from "../http";
import { ConnectError, dayEnd, dayStart, isoTime, MAX_FILLS, refused, type Connector, type Range, type VenueCtx, type VenueRead } from "../types";

export interface KrakenCredentials { apiKey: string; secret: Uint8Array }

const NAME = "Kraken";
const BASE = "https://api.kraken.com";

/** Permissions a read-only key may have. Anything else, including a name we do not know, is refused. */
export const READ_PERMISSIONS = new Set(["query-funds", "query-open-trades", "query-closed-trades", "query-ledger", "export-data", "create-ws-token"]);
const PERMISSION_WORDS: Record<string, string> = {
  "modify-trades": "place and change orders", "close-trades": "cancel and close orders", "withdraw-funds": "withdraw money",
  "add-funds": "deposit money", "earn-funds": "move money into Earn", "add-withdraw-address": "add withdrawal addresses",
  "update-withdraw-address": "change withdrawal addresses",
};

/** API-Sign: HMAC-SHA512 of (path + SHA256(nonce + body)) with the decoded secret, as base64. */
export async function sign(path: string, nonce: string, body: string, secret: Uint8Array): Promise<string> {
  const inner = await sha256(nonce + body);
  const msg = new Uint8Array([...utf8(path), ...inner]);
  return toB64(await hmac("SHA-512", secret, msg));
}

let lastNonce = 0;
const nextNonce = (now: number) => { lastNonce = Math.max(lastNonce + 1, Math.floor(now * 1000)); return String(lastNonce); };

async function priv<T>(ctx: VenueCtx, c: KrakenCredentials, method: string, params: Record<string, string> = {}): Promise<T> {
  const path = `/0/private/${method}`;
  const nonce = nextNonce(ctx.now());
  const body = new URLSearchParams({ nonce, ...params }).toString();
  const res = await call(ctx, `${BASE}${path}`, {
    method: "POST",
    headers: { "API-Key": c.apiKey, "API-Sign": await sign(path, nonce, body, c.secret), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  }, { venue: NAME });
  if (!res.ok) throw new ConnectError(502, `Kraken answered with error ${res.status}. Try again later.`, "venue_down");
  const j = await jsonOf<{ error?: string[]; result?: T }>(res, NAME);
  const err = (j.error ?? []).join(" ");
  if (err) {
    if (/Invalid key|Invalid signature|Invalid nonce/i.test(err)) throw new ConnectError(401, "Kraken did not accept this key. Check the API key and the private key, copied in full.", "venue_auth");
    if (/Permission denied|Invalid permissions/i.test(err)) throw new ConnectError(403, "Kraken says this key may not read trades. Give it \"Query closed orders & trades\".", "venue_auth");
    if (/Rate limit|Throttled|Too many/i.test(err)) throw new ConnectError(429, "Kraken is limiting how often this key can be used. Wait a minute and try again, or pick a shorter range.", "venue_limit");
    if (/otp|2FA/i.test(err)) throw new ConnectError(400, "This key asks for a two-step code on every call. Make a key without that setting: it can only read.");
    throw new ConnectError(502, "Kraken could not answer this request. Try again later.", "venue_down");
  }
  if (!j.result) throw new ConnectError(502, "Kraken sent an empty answer. Try again later.", "venue_down");
  return j.result;
}

interface KeyInfo { permissions?: unknown; iban?: unknown; IBAN?: unknown }

/** Refuses unless every permission is a read one and trades can be read. */
export function judgePermissions(info: KeyInfo): void {
  if (!Array.isArray(info.permissions)) throw new ConnectError(403, "Kraken did not tell us what this key may do, so we did not use it. Try again later.", "refused");
  const perms = info.permissions.filter((p): p is string => typeof p === "string");
  const bad = perms.filter((p) => !READ_PERMISSIONS.has(p));
  if (bad.length) throw refused(NAME, bad.map((p) => PERMISSION_WORDS[p] ?? `do more than read ("${p.replace(/[^a-z-]/g, "").slice(0, 40)}")`).join(", "));
  if (!perms.includes("query-closed-trades") && !perms.includes("query-open-trades")) {
    throw new ConnectError(403, "This Kraken key cannot read trades. Give it \"Query closed orders & trades\" and nothing that trades or withdraws.", "venue_auth");
  }
}

interface KTrade { pair?: string; time?: number; type?: string; price?: string; cost?: string; fee?: string; vol?: string; margin?: string }
interface Pair { altname?: string; wsname?: string; quote?: string }

export function fillsFrom(trades: KTrade[], pairs: Record<string, Pair>, range: Range): { fills: Fill[]; margin: boolean } {
  const lo = dayStart(range.from), hi = dayEnd(range.to);
  const fills: Fill[] = [];
  let margin = false;
  for (const t of trades) {
    const ms = Math.round((t.time ?? NaN) * 1000);
    if (!Number.isFinite(ms) || ms < lo || ms > hi) continue;
    const qty = Number(t.vol), price = Number(t.price), cost = Number(t.cost), fee = Number(t.fee ?? 0);
    if (!(qty > 0) || !(price > 0)) continue;
    const side = t.type === "buy" ? "buy" : t.type === "sell" ? "sell" : null;
    if (!side) continue;
    if (Number(t.margin ?? 0) > 0) margin = true;
    const p = pairs[t.pair ?? ""];
    // Kraken's wsname is BASE/QUOTE with readable names (XBT/USD).
    const symbol = p?.wsname ?? p?.altname ?? t.pair ?? "";
    fills.push({ time: isoTime(ms), symbol, side, qty, price, value: Number.isFinite(cost) && cost > 0 ? cost : qty * price, fee: Number.isFinite(fee) ? fee : 0 });
  }
  return { fills, margin };
}

export const kraken: Connector<KrakenCredentials> = {
  id: "kraken",
  credentials(raw) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const apiKey = typeof r.apiKey === "string" ? r.apiKey.trim() : "";
    if (!apiKey) throw new ConnectError(400, "Fill in the API key.");
    if (!/^[A-Za-z0-9+/=]{20,128}$/.test(apiKey)) throw new ConnectError(400, "The API key does not look right. Copy it again from Kraken, with nothing before or after it.");
    const s = typeof r.secret === "string" ? r.secret.trim() : "";
    if (!s) throw new ConnectError(400, "Fill in the private key.");
    let secret: Uint8Array;
    try { secret = fromB64(s); } catch { throw new ConnectError(400, "The private key does not look right. Copy it again from Kraken, in full."); }
    if (secret.length < 32 || secret.length > 128) throw new ConnectError(400, "The private key does not look right. Copy it again from Kraken, in full.");
    return { apiKey, secret };
  },
  async check(c, ctx) {
    judgePermissions(await priv<KeyInfo>(ctx, c, "GetApiKeyInfo"));
  },
  async read(c, range, ctx): Promise<VenueRead> {
    const info = await priv<KeyInfo>(ctx, c, "GetApiKeyInfo");
    const account = typeof info.iban === "string" ? info.iban : typeof info.IBAN === "string" ? info.IBAN : "";
    if (!account) throw new ConnectError(502, "Kraken did not say which account this key belongs to. Try again later.", "venue_down");
    const pairsRes = await call(ctx, `${BASE}/0/public/AssetPairs`, { headers: { Accept: "application/json" } }, { venue: NAME });
    const pairs = res2pairs(await jsonOf<{ result?: Record<string, Pair> }>(pairsRes, NAME));
    const all: KTrade[] = [];
    const start = String(Math.floor(dayStart(range.from) / 1000) - 1);
    const end = String(Math.floor(dayEnd(range.to) / 1000));
    let cursor = "";
    let ofs = 0;
    for (let page = 0; ; page++) {
      // Two points a call on a counter of 15 that falls 0.33 a second (Starter): six calls at
      // once, then one every six seconds.
      if (page >= 6) await ctx.sleep(6_100);
      const params: Record<string, string> = { type: "all", start, end, limit: "100", with_cursor: "true" };
      if (cursor) params.cursor = cursor; else if (ofs) params.ofs = String(ofs);
      const r = await priv<{ trades?: Record<string, KTrade>; count?: number; cursor?: { next?: string } | string }>(ctx, c, "TradesHistory", params);
      const rows = Object.values(r.trades ?? {});
      all.push(...rows);
      guardSize(all.length, NAME, MAX_FILLS);
      const next = typeof r.cursor === "string" ? r.cursor : r.cursor?.next ?? "";
      if (!rows.length) break;
      if (next) { if (next === cursor) break; cursor = next; continue; }
      ofs += rows.length;
      if (!r.count || ofs >= r.count) break;
    }
    const { fills, margin } = fillsFrom(all, pairs, range);
    return {
      account, env: "live", fills, allowShort: margin, sameAs: "kraken",
      notes: ["Kraken's fees are taken as charged in the quote currency of each pair."],
    };
  },
};

function res2pairs(j: { result?: Record<string, Pair> }): Record<string, Pair> {
  return j.result && typeof j.result === "object" ? j.result : {};
}
