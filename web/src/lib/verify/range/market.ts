// Which market a file's symbol is, written the one way the fill price check sends it:
// a US stock or fund as its ticker ("AAPL", "BRK.B"), a crypto pair as base-quote ("BTC-USDT"),
// a currency pair as base/quote ("EUR/USD"). Anything else (futures, options, contracts for
// difference on indices and metals) is left out, because no source we may use covers it.
import type { FormatId } from "../types";

export type Market = "stock" | "crypto" | "fx";

export interface Routed { market: Market; symbol: string; base?: string; quote?: string }

const CCY = "EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY|NOK|SEK|DKK|SGD|HKD|MXN|ZAR|TRY|PLN|CNH";
const FX = new RegExp(`^(${CCY})(${CCY})$`);

/** Quotes a crypto pair can be priced in, longest first so USDT is not read as USD plus T. */
const QUOTES = ["FDUSD", "USDT", "USDC", "TUSD", "USD", "EUR", "GBP", "BTC", "ETH"];

/** Coins a bare symbol ("BTC") is read as, priced in dollars. Not stock tickers. */
export const COINS = new Set([
  "BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "BNB", "LTC", "DOT", "AVAX", "LINK", "TRX", "SUI", "HYPE", "TON", "SHIB", "BCH",
  "XLM", "UNI", "AAVE", "NEAR", "APT", "ARB", "OP", "PEPE", "ATOM", "ETC", "FIL", "INJ", "SEI", "TIA", "WIF", "BONK", "MATIC", "POL",
]);

/** Kraken's and others' old names for coins. */
const ALIAS: Record<string, string> = { XBT: "BTC", XXBT: "BTC", XETH: "ETH", XDG: "DOGE", XXDG: "DOGE", ZUSD: "USD", ZEUR: "EUR" };

/** Formats whose symbols are futures or contracts: none of our sources covers them. */
const FUTURES: FormatId[] = ["ninjatrader", "tradovate", "tradovate_positions", "tradovate_orders"];

const coin = (s: string) => ALIAS[s] ?? s;

/** The market and the symbol to send, or null when no source covers it. */
export function route(raw: string, format?: FormatId): Routed | null {
  if (!raw || (format && FUTURES.includes(format))) return null;
  let s = raw.trim().toUpperCase();
  // "NASDAQ:AAPL", "BINANCE:BTCUSDT", "#AAPL".
  s = s.replace(/^[A-Z]+:/, "").replace(/^#/, "");
  // Options and anything with spaces left in it (thinkorswim's "AAPL 240119C150").
  if (/\s\d|\d{6}[CP]\d/.test(s)) return null;

  // Crypto written with a separator: BTC-USD, BTC/USDT, ETH_USDC.
  const sep = s.match(/^([A-Z0-9]{2,12})[-/_]([A-Z0-9]{3,6})$/);
  if (sep) {
    const base = coin(sep[1]), quote = coin(sep[2]);
    if (FX.test(base + quote)) return { market: "fx", symbol: `${base}/${quote}`, base, quote };
    if (QUOTES.includes(quote) || COINS.has(base)) return { market: "crypto", symbol: `${base}-${quote}`, base, quote };
    return null;
  }
  // Broker suffixes on currency pairs and stock contracts: EURUSDm, EURUSD.raw, AAPL.US, AAPL.NAS.
  const plain = s.replace(/\.(A|B|C|M|PRO|ECN|RAW|STD|CASH|I|R|X|US|NAS|NYSE|NQ|OQ|N|ARCA)$/, "");
  const fx = plain.match(/^([A-Z]{6})[A-Z]{0,3}$/);
  if (fx && FX.test(fx[1])) return { market: "fx", symbol: `${fx[1].slice(0, 3)}/${fx[1].slice(3)}`, base: fx[1].slice(0, 3), quote: fx[1].slice(3) };
  if (COINS.has(coin(plain))) return { market: "crypto", symbol: `${coin(plain)}-USD`, base: coin(plain), quote: "USD" };
  const xk = plain.match(/^(XXBT|XETH|XXDG)(ZUSD|ZEUR)$/);
  if (xk) return { market: "crypto", symbol: `${coin(xk[1])}-${coin(xk[2])}`, base: coin(xk[1]), quote: coin(xk[2]) };
  const q = QUOTES.find((x) => plain.endsWith(x) && plain.length > x.length + 1);
  if (q) {
    const base = coin(plain.slice(0, -q.length));
    if (COINS.has(base) || q !== "USD") return { market: "crypto", symbol: `${base}-${q}`, base, quote: q };
  }
  // A US stock or fund: one to five letters, with an optional class ("BRK.B", "BRK B", "BRK/B").
  const st = plain.replace(/[ /]([A-Z])$/, ".$1");
  if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(st)) return { market: "stock", symbol: st };
  return null;
}

/** The market of a symbol as it is sent: "BTC-USDT" crypto, "EUR/USD" currencies, else a stock. */
export function marketOfSent(s: string): Market | null {
  if (/^[A-Z0-9]{2,12}-[A-Z0-9]{3,6}$/.test(s)) return "crypto";
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s)) return "fx";
  if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(s)) return "stock";
  return null;
}

/** Quotes that count as US dollars, so a pair can be checked on a venue that lists another one. */
export const USD_LIKE = new Set(["USD", "USDT", "USDC", "FDUSD", "TUSD"]);
