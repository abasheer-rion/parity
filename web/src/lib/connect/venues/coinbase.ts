// Coinbase Advanced Trade with a view-only API key (DEC-0091). The person makes a key at
// portal.cdp.coinbase.com with the View permission only and the ECDSA signature type, and
// gives us the key name and the private key. Before reading anything we ask Coinbase what
// the key may do (key_permissions) and refuse it if it can trade or transfer.
//
// Official docs (fetched 3 November 2026):
//   https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication.md
//   https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/data-api/get-api-key-permissions.md
//   https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/orders/list-fills.md
// Each request carries its own JWT (ES256, two minutes). Ed25519 keys are not supported by
// Advanced Trade, so we ask for ECDSA. Coinbase publishes no REST rate limit today; we stay
// well under by reading 100 fills a call. A key may be limited to one portfolio, and then
// only that portfolio's fills are read. EU accounts may need a two-step check to read
// history (proof_token_required), which Parity cannot do yet.
import { p256 } from "@noble/curves/nist.js";
import type { Fill } from "../../verify/parse/fills";
import { fromB64, randomBytes, toB64url, toHex, utf8 } from "../bytes";
import { call, guardSize, jsonOf } from "../http";
import { ConnectError, dayEnd, dayStart, isoTime, MAX_FILLS, refused, type Connector, type Range, type VenueCtx, type VenueRead } from "../types";

export interface CoinbaseCredentials { keyName: string; privateKey: Uint8Array }

const NAME = "Coinbase";
const HOST = "api.coinbase.com";

/** The 32-byte private key inside an EC PEM (SEC1 "EC PRIVATE KEY" or PKCS#8 "PRIVATE KEY"). */
export function ecPrivateKey(pem: string): Uint8Array | null {
  const clean = pem.replace(/\\n/g, "\n").trim();
  const m = clean.match(/-----BEGIN (EC )?PRIVATE KEY-----([\s\S]+?)-----END (EC )?PRIVATE KEY-----/);
  if (!m) return null;
  let der: Uint8Array;
  try { der = fromB64(m[2].replace(/\s+/g, "")); } catch { return null; }
  // ECPrivateKey: SEQUENCE { INTEGER 1, OCTET STRING (32 bytes) ... }. In PKCS#8 the same
  // structure sits inside an OCTET STRING, so finding "02 01 01 04 20" works for both.
  for (let i = 0; i + 37 <= der.length; i++) {
    if (der[i] === 0x02 && der[i + 1] === 0x01 && der[i + 2] === 0x01 && der[i + 3] === 0x04 && der[i + 4] === 0x20) {
      const key = der.slice(i + 5, i + 37);
      try { p256.getPublicKey(key); return key; } catch { return null; }
    }
  }
  return null;
}

/** The JWT for one request (header kid and nonce, claims iss, sub, nbf, exp, uri), signed ES256. */
export function requestJwt(c: CoinbaseCredentials, method: string, path: string, nowSec: number, nonce = toHex(randomBytes(16))): string {
  const head = toB64url(utf8(JSON.stringify({ alg: "ES256", kid: c.keyName, nonce, typ: "JWT" })));
  const body = toB64url(utf8(JSON.stringify({ iss: "cdp", sub: c.keyName, nbf: nowSec, exp: nowSec + 120, uri: `${method} ${HOST}${path}` })));
  const sig = p256.sign(utf8(`${head}.${body}`), c.privateKey, { prehash: true, lowS: true });
  return `${head}.${body}.${toB64url(sig)}`;
}

async function get<T>(ctx: VenueCtx, c: CoinbaseCredentials, path: string, query = ""): Promise<T> {
  const jwt = requestJwt(c, "GET", path, Math.floor(ctx.now() / 1000));
  const res = await call(ctx, `https://${HOST}${path}${query ? `?${query}` : ""}`, { headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" } }, { venue: NAME });
  if (res.status === 401) throw new ConnectError(401, "Coinbase did not accept this key. Check the key name and the private key, and that the key is not expired or deleted.", "venue_auth");
  if (res.status === 403) throw new ConnectError(403, "Coinbase says this key may not read this. Give the key the View permission.", "venue_auth");
  if (!res.ok) throw new ConnectError(502, `Coinbase answered with error ${res.status}. Try again later.`, "venue_down");
  return jsonOf<T>(res, NAME);
}

interface CbFill { trade_time?: string; price?: string; size?: string; size_in_quote?: boolean; commission?: string; product_id?: string; side?: string; trade_type?: string }

export function fillsFrom(rows: CbFill[], range: Range): { fills: Fill[]; skipped: string[] } {
  const lo = dayStart(range.from), hi = dayEnd(range.to);
  const fills: Fill[] = [];
  const skipped = new Set<string>();
  for (const f of rows) {
    const t = Date.parse(f.trade_time ?? "");
    if (!Number.isFinite(t) || t < lo || t > hi) continue;
    const product = f.product_id ?? "";
    // Spot pairs only (BTC-USD). Futures (BIT-28JUN24-CDE) need a contract size we do not get here.
    if (!/^[A-Z0-9]{2,12}-[A-Z0-9]{2,8}$/.test(product)) { if (product) skipped.add(product); continue; }
    const price = Number(f.price), size = Number(f.size), fee = Number(f.commission ?? 0);
    if (!(price > 0) || !(size > 0)) continue;
    const qty = f.size_in_quote ? size / price : size;
    const side = f.side === "BUY" ? "buy" : f.side === "SELL" ? "sell" : null;
    if (!side) continue;
    fills.push({ time: isoTime(t), symbol: product, side, qty, price, value: qty * price, fee: Number.isFinite(fee) ? fee : 0 });
  }
  return { fills, skipped: [...skipped] };
}

export const coinbase: Connector<CoinbaseCredentials> = {
  id: "coinbase",
  credentials(raw) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const keyName = typeof r.keyName === "string" ? r.keyName.trim() : "";
    if (!keyName) throw new ConnectError(400, "Fill in the key name.");
    if (!/^organizations\/[0-9a-f-]{8,64}\/apiKeys\/[0-9a-f-]{8,64}$/i.test(keyName)) {
      throw new ConnectError(400, "The key name should look like organizations/.../apiKeys/... Copy it again from the Coinbase developer page.");
    }
    const pem = typeof r.privateKey === "string" ? r.privateKey : "";
    if (!pem.trim()) throw new ConnectError(400, "Fill in the private key.");
    if (pem.length > 4000) throw new ConnectError(400, "The private key is longer than a Coinbase key. Copy it again.");
    const key = ecPrivateKey(pem);
    if (!key) throw new ConnectError(400, "The private key must be the ECDSA kind, starting with -----BEGIN EC PRIVATE KEY-----. Coinbase Advanced Trade does not take Ed25519 keys: make a new key and pick ECDSA.");
    return { keyName, privateKey: key };
  },
  async check(c, ctx) {
    const p = await get<{ can_view?: unknown; can_trade?: unknown; can_transfer?: unknown }>(ctx, c, "/api/v3/brokerage/key_permissions");
    if (p.can_trade !== false) throw refused(NAME, "trade");
    if (p.can_transfer !== false) throw refused(NAME, "move money out of the account");
    if (p.can_view !== true) throw new ConnectError(403, "This Coinbase key cannot read. Give it the View permission and nothing else.", "venue_auth");
  },
  async read(c, range, ctx): Promise<VenueRead> {
    const p = await get<{ portfolio_uuid?: unknown }>(ctx, c, "/api/v3/brokerage/key_permissions");
    const account = typeof p.portfolio_uuid === "string" && p.portfolio_uuid ? p.portfolio_uuid : c.keyName.split("/")[1];
    const rows: CbFill[] = [];
    let cursor = "";
    for (;;) {
      const q = new URLSearchParams({ start_sequence_timestamp: new Date(dayStart(range.from)).toISOString(), end_sequence_timestamp: new Date(dayEnd(range.to)).toISOString(), limit: "100", sort_by: "TRADE_TIME" });
      if (cursor) q.set("cursor", cursor);
      const page = await get<{ fills?: CbFill[]; cursor?: string; proof_token_required?: boolean }>(ctx, c, "/api/v3/brokerage/orders/historical/fills", q.toString());
      if (!Array.isArray(page.fills)) {
        if (page.proof_token_required) throw new ConnectError(403, "Coinbase asks for a two-step check before it shows this account's history (accounts in the EU). Parity cannot do that check yet. Export the fills as a file and upload it instead.", "venue_auth");
        throw new ConnectError(502, "Coinbase sent fills in a form we could not read.", "venue_down");
      }
      rows.push(...page.fills);
      guardSize(rows.length, NAME, MAX_FILLS);
      const next = typeof page.cursor === "string" ? page.cursor : "";
      if (!page.fills.length || !next || next === cursor) break;
      cursor = next;
    }
    const { fills, skipped } = fillsFrom(rows, range);
    const notes = skipped.length ? [`Left out ${skipped.length} market${skipped.length === 1 ? "" : "s"} that ${skipped.length === 1 ? "is" : "are"} not a spot pair: ${skipped.slice(0, 5).join(", ")}.`] : [];
    return { account, env: "live", fills, allowShort: false, sameAs: "coinbase", notes };
  },
};
