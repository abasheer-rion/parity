// Binance (binance.com) spot with a read-only API key (DEC-0091). The person makes an HMAC
// key with only "Enable Reading" on and names the markets they traded. Before reading we ask
// Binance for the key's restrictions (apiRestrictions) and refuse the key unless reading is
// the only thing switched on. A flag we do not know that is on is refused too, so a new kind
// of permission fails closed.
//
// Binance.US has no way to ask what a key may do (its apiRestrictions answers 404, checked
// 3 November 2026), so we cannot prove a Binance.US key only reads, and we do not take one.
// Its trade history can be uploaded as a file instead.
//
// Official docs (fetched 3 November 2026):
//   https://developers.binance.com/docs/wallet/account/api-key-permission
//   https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md (SIGNED endpoints, GET /api/v3/myTrades)
//   https://docs.binance.us/
// Limits: myTrades needs a symbol (there is no "all my trades"), weight 20 a call, 1,000
// trades a call, 6,000 weight a minute per IP address; startTime to endTime at most 24 hours,
// so we page by trade id from the start of the market instead. Binance.com answers 451 to
// addresses in the United States, so a read only works when our server runs outside it.
import type { Fill } from "../../verify/parse/fills";
import { splitPair } from "../../verify/parse/fills";
import { hmac, toHex } from "../bytes";
import { call, guardSize, jsonOf } from "../http";
import { ConnectError, dayEnd, dayStart, isoTime, MAX_FILLS, refused, type Connector, type Range, type VenueCtx, type VenueRead } from "../types";

export interface BinanceCredentials { apiKey: string; secret: string }

const NAME = "Binance";
const BASE = "https://api.binance.com";

/** Restriction flags a read-only key may have on. Every other "enable" or "permits" flag must be off. */
const ALLOWED_ON = new Set(["enableReading", "enableFixReadOnly", "ipRestrict"]);
const FLAG_WORDS: Record<string, string> = {
  enableWithdrawals: "withdraw money", enableInternalTransfer: "move money between accounts", enableMargin: "use margin",
  enableFutures: "trade futures", permitsUniversalTransfer: "transfer money", enableVanillaOptions: "trade options",
  enableSpotAndMarginTrading: "trade", enablePortfolioMarginTrading: "trade on portfolio margin", enableFixApiTrade: "trade through FIX",
};

/** Refuses unless reading is on and nothing that trades, moves or withdraws money is. */
export function judgeRestrictions(r: Record<string, unknown>): void {
  const on = Object.entries(r).filter(([k, v]) => /^(enable|permits)/.test(k) && v === true && !ALLOWED_ON.has(k)).map(([k]) => k);
  if (on.length) throw refused(NAME, on.map((k) => FLAG_WORDS[k] ?? "do more than read").filter((w, i, a) => a.indexOf(w) === i).join(", "));
  if (r.enableReading !== true) throw new ConnectError(403, "This Binance key cannot read. Switch on Enable Reading, and nothing else.", "venue_auth");
}

async function signed<T>(ctx: VenueCtx, c: BinanceCredentials, path: string, params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams({ ...params, recvWindow: "10000", timestamp: String(Math.floor(ctx.now())) }).toString();
  const sig = toHex(await hmac("SHA-256", new TextEncoder().encode(c.secret), q));
  const res = await call(ctx, `${BASE}${path}?${q}&signature=${sig}`, { headers: { "X-MBX-APIKEY": c.apiKey, Accept: "application/json" } }, { venue: NAME });
  if (res.status === 451) throw new ConnectError(451, "Binance.com does not answer from the country our server is in. If you are in the United States, upload Binance.US's trade history file instead.", "venue_down");
  const j = await jsonOf<T & { code?: number; msg?: string }>(res, NAME);
  if (!res.ok) {
    const code = typeof j.code === "number" ? j.code : 0;
    if (code === -2014 || code === -2015 || code === -1022 || res.status === 401) throw new ConnectError(401, "Binance did not accept this key. Check the API key and the secret key, and that the key allows our server's address.", "venue_auth");
    if (code === -1121) throw new ConnectError(400, `Binance does not know the market ${params.symbol ?? ""}. Write it like BTCUSDT.`);
    if (code === -1021) throw new ConnectError(502, "Binance and our server disagree about the time. Try again.", "venue_down");
    throw new ConnectError(502, `Binance could not answer this request (code ${String(code).replace(/[^-\d]/g, "")}). Try again later.`, "venue_down");
  }
  return j;
}

interface BTrade { symbol?: string; id?: number; price?: string; qty?: string; quoteQty?: string; commission?: string; commissionAsset?: string; time?: number; isBuyer?: boolean }

export function fillsFrom(rows: BTrade[], range: Range): { fills: Fill[]; feeCoins: string[] } {
  const lo = dayStart(range.from), hi = dayEnd(range.to);
  const fills: Fill[] = [];
  const feeCoins = new Set<string>();
  for (const t of rows) {
    const ms = t.time ?? NaN;
    if (!Number.isFinite(ms) || ms < lo || ms > hi || !t.symbol) continue;
    const price = Number(t.price), qty = Number(t.qty), quote = Number(t.quoteQty), fee = Number(t.commission ?? 0);
    if (!(price > 0) || !(qty > 0)) continue;
    const pair = splitPair(t.symbol);
    // The fee is in whatever coin Binance took it in: the quote coin as it is, the base coin
    // at the fill's price, and any other coin (BNB) left out and named, as for the file.
    let cost = 0;
    if (fee > 0 && pair && t.commissionAsset === pair.quote) cost = fee;
    else if (fee > 0 && pair && t.commissionAsset === pair.base) cost = fee * price;
    else if (fee > 0 && t.commissionAsset) feeCoins.add(t.commissionAsset);
    fills.push({ time: isoTime(ms), symbol: t.symbol, side: t.isBuyer ? "buy" : "sell", qty, price, value: Number.isFinite(quote) && quote > 0 ? quote : qty * price, fee: cost });
  }
  return { fills, feeCoins: [...feeCoins] };
}

export const binance: Connector<BinanceCredentials> = {
  id: "binance",
  credentials(raw) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const apiKey = typeof r.apiKey === "string" ? r.apiKey.trim() : "";
    const secret = typeof r.secret === "string" ? r.secret.trim() : "";
    if (!apiKey) throw new ConnectError(400, "Fill in the API key.");
    if (!secret) throw new ConnectError(400, "Fill in the secret key.");
    if (!/^[A-Za-z0-9]{32,128}$/.test(apiKey)) throw new ConnectError(400, "The API key does not look right. Copy it again from Binance.");
    if (!/^[A-Za-z0-9]{32,128}$/.test(secret)) throw new ConnectError(400, "The secret key does not look right. Parity takes Binance's system-generated (HMAC) keys; Ed25519 and RSA keys are not supported yet.");
    return { apiKey, secret };
  },
  async check(c, ctx) {
    judgeRestrictions(await signed<Record<string, unknown>>(ctx, c, "/sapi/v1/account/apiRestrictions", {}));
  },
  async read(c, range, ctx, opts): Promise<VenueRead> {
    const symbols = opts.symbols ?? [];
    if (!symbols.length) throw new ConnectError(400, "Name the markets you traded, such as BTCUSDT.");
    const acct = await signed<{ uid?: unknown }>(ctx, c, "/api/v3/account", { omitZeroBalances: "true" });
    const account = acct.uid != null ? String(acct.uid) : "";
    if (!/^\d{1,20}$/.test(account)) throw new ConnectError(502, "Binance did not say which account this key belongs to. Try again later.", "venue_down");
    const hi = dayEnd(range.to);
    const rows: BTrade[] = [];
    for (const symbol of symbols) {
      // From the market's first trade, a thousand at a time, until past the end date.
      let fromId = 0;
      for (;;) {
        const page = await signed<BTrade[]>(ctx, c, "/api/v3/myTrades", { symbol, fromId: String(fromId), limit: "1000" });
        if (!Array.isArray(page)) throw new ConnectError(502, "Binance sent trades in a form we could not read.", "venue_down");
        rows.push(...page);
        guardSize(rows.length, NAME, MAX_FILLS);
        const last = page[page.length - 1];
        if (page.length < 1000 || !last || typeof last.id !== "number" || (last.time ?? 0) > hi) break;
        fromId = last.id + 1;
      }
    }
    const { fills, feeCoins } = fillsFrom(rows, range);
    const notes = feeCoins.length ? [`Fees paid in ${feeCoins.join(", ")} are left out: we do not hold a price for ${feeCoins.length === 1 ? "that coin" : "those coins"}.`] : [];
    return { account, env: "live", fills, allowShort: false, sameAs: "binance_spot", notes };
  },
};

/** Binance.US: refused, because Binance.US cannot tell us whether a key only reads. */
export const binanceUs: Connector<never> = {
  id: "binance_us",
  credentials() {
    throw new ConnectError(400, "Binance.US has no way for us to check that a key can only read, so Parity does not take Binance.US keys. Export your trade history from Binance.US and upload the file instead.", "refused");
  },
  async check() {},
  async read() { throw new ConnectError(400, "Binance.US is not supported.", "refused"); },
};
