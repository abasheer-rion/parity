// Alpaca through its own sign-in, OAuth 2.0 "Alpaca Connect" (DEC-0091). Alpaca's API keys
// have no read-only setting, so we never take a key: the person signs in at Alpaca, and
// Parity asks for no scope at all, which Alpaca documents as read-only ("Read-only endpoint
// access is assumed by default"). If the token comes back with any scope (trading, data,
// account:write) it is refused and dropped.
//
// Official docs (fetched 3 November 2026):
//   https://docs.alpaca.markets/docs/using-oauth2-and-trading-api
//   https://docs.alpaca.markets/us/docs/account-activities.md
//   https://docs.alpaca.markets/us/reference/getaccount-1.md
//   https://alpaca.markets/support/usage-limit-api-calls
// Limits: 200 requests a minute per account; 100 activities per page; no documented limit on
// how far back fills go. The token has no documented expiry and Alpaca documents no way for
// an app to revoke it: the person removes Parity under Alpaca's connected apps. Live use for
// other people needs Alpaca to approve Parity's app first.
import type { Fill } from "../../verify/parse/fills";
import { call, guardSize, jsonOf } from "../http";
import { ConnectError, dayEnd, dayStart, isoTime, MAX_FILLS, text, type Connector, type Range, type VenueCtx, type VenueRead } from "../types";

export interface AlpacaCredentials { accessToken: string; env: "live" | "paper" }

const NAME = "Alpaca";
export const ALPACA_AUTHORIZE = "https://app.alpaca.markets/oauth/authorize";
export const ALPACA_TOKEN = "https://api.alpaca.markets/oauth/token";
const BASE = { live: "https://api.alpaca.markets", paper: "https://paper-api.alpaca.markets" } as const;

/** The address that sends the person to Alpaca to sign in. No scope: read-only. */
export function authorizeUrl(clientId: string, redirectUri: string, state: string, env: "live" | "paper"): string {
  const q = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state, env });
  return `${ALPACA_AUTHORIZE}?${q}`;
}

/** Swaps the one-time code for a token, and refuses any token that can do more than read. */
export async function exchangeCode(ctx: VenueCtx, a: { code: string; clientId: string; clientSecret: string; redirectUri: string }): Promise<string> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code: a.code, client_id: a.clientId, client_secret: a.clientSecret, redirect_uri: a.redirectUri });
  const res = await call(ctx, ALPACA_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body }, { venue: NAME, retries: 0 });
  if (res.status === 400 || res.status === 401) throw new ConnectError(401, "Alpaca did not accept the sign-in. It may have taken too long. Start again.", "venue_auth");
  if (!res.ok) throw new ConnectError(502, `Alpaca answered with error ${res.status}. Try again later.`, "venue_down");
  const j = await jsonOf<{ access_token?: unknown; scope?: unknown }>(res, NAME);
  if (typeof j.access_token !== "string" || !j.access_token) throw new ConnectError(502, "Alpaca did not send a sign-in token. Start again.", "venue_down");
  const scope = typeof j.scope === "string" ? j.scope.trim() : "";
  if (scope) throw new ConnectError(403, `Alpaca gave this sign-in more than read access (${scope.replace(/[^a-z: ]/gi, "").slice(0, 60)}). Parity only takes read-only access, so we dropped it. Start again and do not add permissions.`, "refused");
  return j.access_token;
}

interface Activity { id?: string; activity_type?: string; transaction_time?: string; type?: string; price?: string; qty?: string; side?: string; symbol?: string }

async function get<T>(ctx: VenueCtx, c: AlpacaCredentials, path: string): Promise<T> {
  const res = await call(ctx, `${BASE[c.env]}${path}`, { headers: { Authorization: `Bearer ${c.accessToken}`, Accept: "application/json" } }, { venue: NAME });
  if (res.status === 401 || res.status === 403) throw new ConnectError(401, "Alpaca no longer accepts this sign-in. Connect again.", "venue_auth");
  if (!res.ok) throw new ConnectError(502, `Alpaca answered with error ${res.status}. Try again later.`, "venue_down");
  return jsonOf<T>(res, NAME);
}

export function fillsFrom(acts: Activity[], range: Range): Fill[] {
  const lo = dayStart(range.from), hi = dayEnd(range.to);
  const out: Fill[] = [];
  for (const a of acts) {
    if (a.activity_type && a.activity_type !== "FILL") continue;
    const t = Date.parse(a.transaction_time ?? "");
    const price = Number(a.price), qty = Math.abs(Number(a.qty));
    if (!Number.isFinite(t) || t < lo || t > hi || !(price > 0) || !(qty > 0) || !a.symbol) continue;
    const side = a.side === "buy" ? "buy" : a.side === "sell" || a.side === "sell_short" ? "sell" : null;
    if (!side) continue;
    out.push({ time: isoTime(t), symbol: a.symbol, side, qty, price, value: qty * price, fee: 0 });
  }
  return out;
}

export const alpaca: Connector<AlpacaCredentials> = {
  id: "alpaca",
  credentials(raw) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const env = r.env === "paper" ? "paper" : r.env === "live" ? "live" : null;
    if (!env) throw new ConnectError(400, "Say whether this is your live or your paper Alpaca account.");
    return { accessToken: text(r.accessToken, "the Alpaca sign-in", /^[A-Za-z0-9._~+/=-]{8,2048}$/, 2048), env };
  },
  // The scope was checked when the code was swapped (exchangeCode). Alpaca has no call that
  // reports a token's scope later, so a kept token is only ever one that passed that check.
  async check() {},
  async read(c, range, ctx): Promise<VenueRead> {
    const acct = await get<{ account_number?: unknown; currency?: unknown; status?: unknown }>(ctx, c, "/v2/account");
    const account = typeof acct.account_number === "string" ? acct.account_number : "";
    if (!account) throw new ConnectError(502, "Alpaca did not say which account this is. Try again later.", "venue_down");
    const after = new Date(dayStart(range.from) - 1000).toISOString();
    const until = new Date(dayEnd(range.to)).toISOString();
    const acts: Activity[] = [];
    let token = "";
    for (;;) {
      const q = new URLSearchParams({ direction: "asc", page_size: "100", after, until });
      if (token) q.set("page_token", token);
      const page = await get<Activity[]>(ctx, c, `/v2/account/activities/FILL?${q}`);
      if (!Array.isArray(page)) throw new ConnectError(502, "Alpaca sent fills in a form we could not read.", "venue_down");
      acts.push(...page);
      guardSize(acts.length, NAME, MAX_FILLS);
      const last = page[page.length - 1]?.id;
      if (page.length < 100 || !last || last === token) break;
      token = last;
    }
    return {
      account, env: c.env, fills: fillsFrom(acts, range), allowShort: true, sameAs: "alpaca",
      currency: typeof acct.currency === "string" ? acct.currency : undefined,
      notes: ["Alpaca's fills carry no fee. Regulatory fees on sales and crypto fees are booked by Alpaca as separate items and are not taken off here."],
    };
  },
};
