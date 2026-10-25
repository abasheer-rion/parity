// Every live or near-live source we considered (DEC-0049), with what its terms let us do.
// Only "display" sources are switched on in the fan-out (web/live/src/adapters.ts). The
// same list, with the daily sources, is printed by `parity data sources` (engine
// providers.py) and explained in REF-0014. Terms were read on the date given.
import type { FeedType } from "./protocol";
import type { LiveTf } from "./candles";

/** display: terms allow showing the data on our site; ask: terms are silent or unclear,
 *  so it waits for the owner; no: terms forbid it or the source blocks us. */
export type Licence = "display" | "ask" | "no";

export interface SourceMeta {
  id: string;
  name: string;
  short: string;
  feed: FeedType;
  delayMin?: number;
  /** What it covers, in words. */
  covers: string;
  licence: Licence;
  terms: string;
  read: string;
  /** Why it is on or off, in one line. */
  note: string;
  /** Live symbols offered (sources with a short fixed list). */
  symbols?: string[];
  /** Streams through our fan-out (otherwise fetched on a schedule). */
  streams: boolean;
  /** Chart timeframes its history supports (all when left out). */
  tfs?: LiveTf[];
  /** Bars are built from prices, not trades: each opens at the previous close. */
  fromCloses?: boolean;
}

const READ = "2026-10-25";

export const SOURCES: SourceMeta[] = [
  // Streamed through the fan-out today.
  { id: "coingecko", name: "CoinGecko", short: "CoinGecko", feed: "delayed", delayMin: 1, covers: "The 100 largest coins, priced in US dollars, refreshed about once a minute", licence: "display",
    terms: "https://www.coingecko.com/en/api_terms", read: "2026-10-22", streams: true, tfs: ["5m", "1h", "1d"], fromCloses: true,
    note: "Display allowed with \"Data provided by CoinGecko\" linked next to the data. Prices are CoinGecko's own blend across exchanges, about a minute behind." },
  // Built and tested, switched off until the owner decides (terms silent or forbid).
  { id: "hyperliquid", name: "Hyperliquid", short: "Hyperliquid", feed: "rt", covers: "Real-time trades for every Hyperliquid perpetual", licence: "ask",
    terms: "https://app.hyperliquid.xyz/terms", read: READ, streams: true,
    note: "Terms have no clause on data reuse and bar US persons from the app. Off until the owner decides; LIVE_ALLOW=hyperliquid turns it on." },
  { id: "kraken", name: "Kraken", short: "Kraken", feed: "rt", covers: "Real-time spot trades", licence: "no",
    terms: "https://www.kraken.com/legal/global-terms", read: READ, streams: true,
    note: "Terms forbid making content available to third parties without consent (marketdata@kraken.com). Adapter kept for a written consent." },
  // Turned down: terms forbid display, or a key or contract is needed.
  { id: "coinbase", name: "Coinbase Exchange", short: "Coinbase", feed: "rt", covers: "Real-time spot trades", licence: "no", terms: "https://www.coinbase.com/legal/market_data", read: READ, streams: false,
    note: "Market data terms (7 Aug 2026) forbid display to third parties and apps for end users." },
  { id: "bitstamp", name: "Bitstamp", short: "Bitstamp", feed: "rt", covers: "Real-time spot trades", licence: "no", terms: "https://www.bitstamp.net/terms-of-use/", read: READ, streams: false,
    note: "Terms forbid republishing prices on any other website." },
  { id: "gemini", name: "Gemini", short: "Gemini", feed: "rt", covers: "Real-time spot trades", licence: "no", terms: "https://www.gemini.com/legal/market-data-agreement", read: READ, streams: false,
    note: "Personal and internal use only; a Redistribution Agreement (bizdev@gemini.com) would allow display." },
  { id: "bitfinex", name: "Bitfinex", short: "Bitfinex", feed: "rt", covers: "Real-time spot trades", licence: "no", terms: "https://www.bitfinex.com/legal/general/market-data", read: READ, streams: false,
    note: "No redistribution without written consent." },
  { id: "binance", name: "Binance and Binance.US", short: "Binance", feed: "rt", covers: "Real-time spot trades", licence: "no", terms: "https://www.binance.us/terms-of-use", read: READ, streams: false,
    note: "Binance blocks US addresses; Binance.US forbids public display." },
  { id: "others-crypto", name: "Crypto.com, KuCoin, Gate, Bitget, MEXC, HTX, OKX, Bybit, Deribit", short: "Other exchanges", feed: "rt", covers: "Real-time spot and perps", licence: "no", terms: "https://www.kucoin.com/legal/terms-of-use", read: READ, streams: false,
    note: "Each forbids display without consent, is personal use only, or bars the US." },
  { id: "dydx", name: "dYdX v4 indexer", short: "dYdX", feed: "rt", covers: "Real-time perps", licence: "no", terms: "https://dydx.trade/terms", read: READ, streams: false,
    note: "No data licence and not available to US persons." },
  { id: "pyth", name: "Pyth Network", short: "Pyth", feed: "rt", covers: "Real-time crypto, FX, metals, US stocks", licence: "no", terms: "https://www.pyth.network/pricing", read: READ, streams: false,
    note: "Every request needs a key since 26 Aug 2026. Display rights from 500 USD a month (crypto) or 2,500 USD (all assets)." },
  { id: "coincap", name: "CoinCap", short: "CoinCap", feed: "rt", covers: "Crypto prices", licence: "no", terms: "https://coincap.io", read: READ, streams: false, note: "Needs a key since 2025." },
  // Daily and reference sources used beside the live ones.
  { id: "sec", name: "SEC company tickers", short: "SEC", feed: "eod", covers: "Every US-listed company and fund symbol (search only, no prices)", licence: "display", terms: "https://www.sec.gov/privacy", read: READ, streams: false,
    note: "Public information that may be copied; we cite the SEC and name a contact in our requests." },
  { id: "ecb", name: "ECB reference rates (and Frankfurter)", short: "ECB", feed: "eod", covers: "Daily euro reference rates for about 30 currencies", licence: "display", terms: "https://www.ecb.europa.eu/services/disclaimer/html/index.en.html", read: READ, streams: false,
    note: "Free use with the ECB cited. One fix a day, about 16:00 CET." },
  { id: "treasury", name: "US Treasury yield curve", short: "Treasury", feed: "eod", covers: "Daily par yields", licence: "display", terms: "https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics", read: READ, streams: false, note: "US government work, public domain." },
  { id: "eia", name: "EIA spot prices", short: "EIA", feed: "eod", covers: "WTI, Brent, Henry Hub daily", licence: "display", terms: "https://www.eia.gov/about/copyrights_reuse.php", read: READ, streams: false, note: "Free to use and share with EIA cited." },
  { id: "iex-hist", name: "IEX historical data", short: "IEX", feed: "eod", covers: "Next-day IEX trades only (about 8% of US volume)", licence: "display", terms: "https://iextrading.com/trading/market-data/", read: READ, streams: false,
    note: "Free with the IEX credit line, but raw packet files and IEX trades only; not built." },
  { id: "us-stocks", name: "US stock prices (any vendor)", short: "Stocks", feed: "delayed", delayMin: 15, covers: "Full-market US stock and ETF prices", licence: "no", terms: "https://www.cboe.com/market_data_services/us/equities/cboe_one/", read: READ, streams: false,
    note: "No free source allows display. Intrinio from 333 USD a month (15 min delayed), Massive Business 2,499 plus 499 USD, Cboe One 5,000 USD." },
  // The licensed vendor slot: off until VENDOR and VENDOR_KEY are set.
  { id: "vendor", name: "Licensed vendor", short: "Vendor", feed: "rt", covers: "US stocks, once a display licence is signed", licence: "display", terms: "https://massive.com/pricing", read: READ, streams: true,
    note: "Plugs in by setting VENDOR and VENDOR_KEY; nothing runs until then." },
];

export const sourceById = (id: string): SourceMeta | undefined => SOURCES.find((s) => s.id === id);
export const liveSources = () => SOURCES.filter((s) => s.streams && s.licence === "display");
