// The venues Parity can read from with a read-only link, in words for the page (DEC-0091):
// what to make at the venue, what to paste, and what the venue limits. Shared by the
// browser (the connect form and the methodology page) and the server. No secrets here.
import type { VenueId } from "./types";

export interface VenueField {
  id: string;
  label: string;
  /** Hidden as it is typed, and never kept in the page after sending. */
  secret: boolean;
  /** Several lines (a PEM private key). */
  multiline?: boolean;
  placeholder?: string;
}

export interface VenueInfo {
  id: VenueId;
  name: string;
  /** How the link is made. */
  method: "token" | "key" | "sign-in";
  /** One line under the name. */
  line: string;
  fields: VenueField[];
  /** What to do at the venue, step by step, in plain words. */
  steps: string[];
  /** What the venue limits, and what Parity therefore cannot read. */
  limits: string[];
  /** How Parity makes sure the credential can only read. */
  readOnly: string;
  /** Official pages the connector follows. */
  docs: string[];
  /** The longest date range one read may ask for, in days. */
  maxDays: number;
  /** False when Parity cannot prove a key only reads, so the venue is listed but not offered. */
  available: boolean;
}

export const VENUES: Record<VenueId, VenueInfo> = {
  ibkr: {
    id: "ibkr", available: true, name: "Interactive Brokers", method: "token", maxDays: 365,
    line: "A Flex Web Service token and an Activity Flex Query id.",
    fields: [
      { id: "token", label: "Flex Web Service token", secret: true },
      { id: "queryId", label: "Flex Query id", secret: false, placeholder: "For example 123456" },
    ],
    steps: [
      "In Client Portal open Performance & Reports, then Flex Queries.",
      "Make an Activity Flex Query. Add the Trades section with Executions, and tick Account ID, Date/Time, Symbol, Buy/Sell, Quantity, Trade Price, Proceeds, IB Commission, Currency, FX Rate To Base, Multiplier and Realized P/L. Format: CSV or XML.",
      "Note the query id under the query's Info button.",
      "Open Flex Web Service Configuration, switch it on and copy the current token. You can make it expire after 6 hours.",
    ],
    limits: [
      "At most 365 days in one read.",
      "Interactive Brokers allows 1 request a second and 10 a minute for a token, so a read takes a few seconds.",
      "The query must cover one account.",
      "Times are US Eastern, as Interactive Brokers writes them.",
    ],
    readOnly: "A Flex token can only fetch reports. It cannot trade or move money, and it is not your Interactive Brokers login.",
    docs: [
      "https://www.interactivebrokers.com/docs/web-api/api-reference/send-request",
      "https://www.interactivebrokers.com/docs/web-api/api-reference/get-statement",
      "https://www.interactivebrokers.com/docs/web-api/flex-web-service/error-codes",
    ],
  },
  alpaca: {
    id: "alpaca", available: true, name: "Alpaca", method: "sign-in", maxDays: 3650,
    line: "Sign in at Alpaca. Parity asks for read access only.",
    fields: [],
    steps: [
      "Pick your live or your paper account.",
      "Continue to Alpaca, sign in and allow Parity. Parity asks for no permission to trade, so Alpaca gives read access only.",
      "You come back here and the trades are read once.",
    ],
    limits: [
      "Alpaca's API keys cannot be made read-only, so Parity never takes a key. Use the sign-in.",
      "Alpaca allows 200 requests a minute per account; a read uses one per 100 fills.",
      "Fills carry no fee. Regulatory and crypto fees are booked by Alpaca as separate items and are not taken off.",
      "To stop the link at Alpaca's end, remove Parity from the connected apps in your Alpaca account.",
    ],
    readOnly: "Parity asks Alpaca for no scope, which Alpaca documents as read-only. A sign-in that comes back with any permission to trade or change the account is refused.",
    docs: [
      "https://docs.alpaca.markets/docs/using-oauth2-and-trading-api",
      "https://docs.alpaca.markets/us/docs/account-activities.md",
      "https://alpaca.markets/support/usage-limit-api-calls",
    ],
  },
  coinbase: {
    id: "coinbase", available: true, name: "Coinbase", method: "key", maxDays: 3650,
    line: "A Coinbase Advanced Trade API key with the View permission only.",
    fields: [
      { id: "keyName", label: "Key name", secret: false, placeholder: "organizations/.../apiKeys/..." },
      { id: "privateKey", label: "Private key", secret: true, multiline: true, placeholder: "-----BEGIN EC PRIVATE KEY-----" },
    ],
    steps: [
      "Open portal.cdp.coinbase.com, API keys, and make a Secret API key.",
      "Under the advanced settings pick ECDSA as the signature type, and give it the View permission only. Do not tick Trade or Transfer.",
      "Copy the key name and the private key.",
    ],
    limits: [
      "Spot fills only. Futures are left out and named.",
      "If the key is limited to one portfolio, only that portfolio is read.",
      "Accounts in the EU may need a two-step check to read history, which Parity cannot do yet. Upload the fills file instead.",
      "Coinbase does not take Ed25519 keys for this. Pick ECDSA.",
    ],
    readOnly: "Before reading, Parity asks Coinbase what the key may do and refuses it if it can trade or transfer.",
    docs: [
      "https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication.md",
      "https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/data-api/get-api-key-permissions.md",
      "https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/orders/list-fills.md",
    ],
  },
  kraken: {
    id: "kraken", available: true, name: "Kraken", method: "key", maxDays: 3650,
    line: "A Kraken API key that can query trades and nothing else.",
    fields: [
      { id: "apiKey", label: "API key", secret: false },
      { id: "secret", label: "Private key", secret: true },
    ],
    steps: [
      "In Kraken open Settings, API, and make a new key.",
      "Tick \"Query closed orders & trades\" only. Leave every order, funding and withdrawal box unticked.",
      "Copy the API key and the private key.",
    ],
    limits: [
      "Kraken counts trade-history calls against a small allowance, so one read gets roughly a thousand trades. For more, pick a shorter range or upload trades.csv.",
      "Keys that ask for a two-step code on every call are not supported.",
      "Spot trades. Margin trades are read as they are filled; funding costs of margin positions are not taken off.",
    ],
    readOnly: "Before reading, Parity asks Kraken for the key's permissions and refuses any key that can place, cancel or close orders, deposit, withdraw, move money to Earn or manage withdrawal addresses.",
    docs: [
      "https://docs.kraken.com/exchange/guides/rest/authentication.md",
      "https://docs.kraken.com/api-reference/account-data/get-api-key-info.md",
      "https://docs.kraken.com/api-reference/account-data/get-trades-history.md",
      "https://docs.kraken.com/exchange/guides/rest/ratelimits.md",
    ],
  },
  binance: {
    id: "binance", available: true, name: "Binance", method: "key", maxDays: 3650,
    line: "A Binance.com API key with Enable Reading only. Not Binance.US.",
    fields: [
      { id: "apiKey", label: "API key", secret: false },
      { id: "secret", label: "Secret key", secret: true },
      { id: "symbols", label: "Markets to read", secret: false, placeholder: "BTCUSDT, ETHUSDT" },
    ],
    steps: [
      "In Binance open Account, API Management, and make a system-generated (HMAC) key.",
      "Leave only Enable Reading on. Do not enable spot, margin, futures, options, transfers or withdrawals.",
      "Copy the API key and the secret key, and list the markets you traded, such as BTCUSDT.",
    ],
    limits: [
      "Binance has no call for all of an account's trades, so name each market (up to 20). Each market is read from its first trade.",
      "Spot trades only. Futures are not read yet: export them as a file instead.",
      "Binance.com does not answer from the United States, so a read fails when our server runs there.",
      "Binance.US is not offered: it has no way for us to check that a key can only read. Upload its trade history file instead.",
      "Fees paid in BNB are left out, as for the file.",
    ],
    readOnly: "Before reading, Parity asks Binance for the key's restrictions and refuses any key that can trade, use margin or futures, transfer or withdraw.",
    docs: [
      "https://developers.binance.com/docs/wallet/account/api-key-permission",
      "https://developers.binance.com/docs/binance-spot-api-docs/rest-api/account-endpoints",
    ],
  },
  binance_us: {
    id: "binance_us", available: false, name: "Binance.US", method: "key", maxDays: 3650,
    line: "Not offered: Binance.US cannot tell us whether a key only reads.",
    fields: [
      { id: "apiKey", label: "API key", secret: false },
      { id: "secret", label: "Secret key", secret: true },
      { id: "symbols", label: "Markets to read", secret: false, placeholder: "BTCUSD, ETHUSD" },
    ],
    steps: [
      "In Binance.US open Profile, API Management, and make a key.",
      "Leave trading and withdrawals off.",
      "Copy the API key and the secret key, and list the markets you traded, such as BTCUSD.",
    ],
    limits: [
      "Binance.US has no call for all of an account's trades, so name each market (up to 20).",
      "Spot trades only.",
    ],
    readOnly: "Binance.US has no call that says what a key may do (it answered 404 when we checked on 3 November 2026), so Parity cannot prove a key only reads and does not take one.",
    docs: ["https://docs.binance.us/"],
  },
  bybit: {
    id: "bybit", available: true, name: "Bybit", method: "key", maxDays: 730,
    line: "A Bybit API key set to Read-Only.",
    fields: [
      { id: "apiKey", label: "API key", secret: false },
      { id: "secret", label: "Secret key", secret: true },
    ],
    steps: [
      "In Bybit open API Management and make a system-generated key.",
      "Pick Read-Only.",
      "Copy the API key and the secret key.",
    ],
    limits: [
      "Bybit keeps two years of trades and answers seven days at a time, so a long range takes many calls.",
      "Spot and USDT or USDC contracts. Funding on contracts is not taken off. Inverse contracts and options are not read.",
      "Bybit does not answer from the United States or mainland China, so a read fails when our server runs there.",
      "Self-generated RSA keys are not supported; use a system-generated key.",
    ],
    readOnly: "Before reading, Parity asks Bybit for the key's details and refuses any key that is not Read-Only.",
    docs: [
      "https://bybit-exchange.github.io/docs/v5/user/apikey-info",
      "https://bybit-exchange.github.io/docs/v5/order/execution",
    ],
  },
};

/** The venues offered on the page. */
export const VENUE_LIST: VenueInfo[] = Object.values(VENUES).filter((v) => v.available);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What is wrong with a date range for a venue, in words, or null when it can be read. The
 * page checks this before the key leaves it, and the server checks it again (server.ts).
 */
export function rangeProblem(from: string, to: string, venue: VenueId, now: number = Date.now()): string | null {
  if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return "Pick a start and an end date.";
  if (from > to) return "The start date is after the end date.";
  if (from < "2000-01-01") return "Pick a start date in 2000 or later.";
  if (to > new Date(now).toISOString().slice(0, 10)) return "The end date is in the future.";
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  const v = VENUES[venue];
  if (days > v.maxDays) return `${v.name} can be read at most ${v.maxDays.toLocaleString("en-US")} days at a time. Pick a shorter range.`;
  return null;
}
