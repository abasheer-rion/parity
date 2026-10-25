// Every live or near-live source we considered (DEC-0052, DEC-0053), with what its terms let
// us do. "display" sources stream to everyone; "internal" sources stream only to team
// members (the team_members list, checked by the server on every connection), because their
// terms allow internal use but not showing the data to the public. The same list, with the
// daily sources, is printed by `parity data sources` (engine providers.py) and explained in
// REF-0014. Terms were read on the date given.
import type { FeedType } from "./protocol";
import type { LiveTf } from "./candles";

/** display: terms allow showing the data on our site; internal: terms allow internal use
 *  only, so only team members see it; ask: terms are silent or unclear, so it waits for the
 *  owner; no: terms forbid it or the source blocks us. */
export type Licence = "display" | "internal" | "ask" | "no";

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
  /** Streams an order book and a recent trades list. */
  book?: boolean;
  /** Offers the market overview (every symbol it lists, with price, change and volume). */
  board?: boolean;
  /** Server settings (Pages and worker secrets) it needs; off until all are set. */
  keys?: string[];
  /** Upstream symbol limit of the plan, when lower than our own cap. */
  limit?: number;
  /** Covers US stocks and funds (any SEC-listed symbol), not a list of its own. */
  stocks?: boolean;
  /** Why internal use is allowed, in one line (internal sources only). */
  basis?: string;
}

const READ = "2026-10-25";

export const SOURCES: SourceMeta[] = [
  // Streamed through the fan-out today.
  { id: "coingecko", name: "CoinGecko", short: "CoinGecko", feed: "delayed", delayMin: 1, covers: "The 100 largest coins, priced in US dollars, refreshed about once a minute", licence: "display",
    terms: "https://www.coingecko.com/en/api_terms", read: "2026-10-22", streams: true, tfs: ["5m", "1h", "1d"], fromCloses: true, board: true,
    note: "Display allowed with \"Data provided by CoinGecko\" linked next to the data. Prices are CoinGecko's own blend across exchanges, about a minute behind." },
  // Team only (DEC-0053): terms allow internal use, so these stream only to people on the
  // team list. Every pair each venue lists is offered.
  { id: "hyperliquid", name: "Hyperliquid", short: "Hyperliquid", feed: "rt", covers: "Every Hyperliquid perpetual and spot pair, real-time trades and book", licence: "internal",
    terms: "https://app.hyperliquid.xyz/terms", read: READ, streams: true, book: true, board: true,
    basis: "Terms (15 June 2026) have no clause limiting data use; we only read the public feed for our own team and never show it to the public.",
    note: "Team only. The app's terms bar US persons from trading; we do not trade, we read public prices. Owner decision 25 Oct 2026." },
  { id: "kraken", name: "Kraken", short: "Kraken", feed: "rt", covers: "Every Kraken spot pair, including its fiat pairs (EUR/USD, GBP/USD, USD/JPY and others)", licence: "internal",
    terms: "https://www.kraken.com/legal/global-terms", read: READ, streams: true, book: true, board: true,
    basis: "Terms (19 Oct 2026) allow use for your own benefit and forbid making content available to third parties; team-only use keeps it inside Parity.",
    note: "Team only. Public display would need written consent (marketdata@kraken.com)." },
  { id: "coinbase", name: "Coinbase Exchange", short: "Coinbase", feed: "rt", covers: "Every Coinbase Exchange pair, real-time trades and book", licence: "internal",
    terms: "https://www.coinbase.com/legal/market_data", read: READ, streams: true, book: true, board: true, tfs: ["1m", "5m", "15m", "1h", "1d"],
    basis: "Market data terms (7 Aug 2026) forbid redistributing or displaying the data to third parties; our own team's use is not either.",
    note: "Team only. The terms page refused automated reads on 25 Oct 2026, so the wording is from the earlier read." },
  { id: "gemini", name: "Gemini", short: "Gemini", feed: "rt", covers: "Every Gemini pair, real-time trades and book", licence: "internal",
    terms: "https://www.gemini.com/legal/market-data-agreement", read: READ, streams: true, book: true, board: true, tfs: ["1m", "5m", "15m", "1h", "1d"],
    basis: "Market data agreement (12 Oct 2025) permits \"personal and/or internal use\"; redistribution needs its Redistribution Agreement.",
    note: "Team only. Public display needs the Redistribution Agreement (bizdev@gemini.com)." },
  { id: "binanceus", name: "Binance.US", short: "Binance.US", feed: "rt", covers: "Every Binance.US pair, real-time trades and book", licence: "internal",
    terms: "https://www.binance.us/terms-of-use", read: READ, streams: true, book: true, board: true,
    basis: "Terms (5 June 2026) present market data for informational purposes and forbid public display; internal viewing is neither.",
    note: "Team only." },
  { id: "alpaca", name: "Alpaca Market Data (IEX)", short: "Alpaca", feed: "rt", covers: "US stocks and ETFs: real-time IEX trades on the free plan, every exchange on Algo Trader Plus", licence: "internal",
    terms: "https://alpaca.markets/disclosures", read: READ, streams: true, board: true, keys: ["ALPACA_KEY_ID", "ALPACA_SECRET_KEY"], limit: 30, stocks: true,
    basis: "The account holder's own market data subscription, used by our team inside Parity and never shown to the public.",
    note: "Team only, off until ALPACA_KEY_ID and ALPACA_SECRET_KEY are set. The free plan covers IEX trades only, a small share of US volume, and 30 symbols at once." },
  { id: "finnhub", name: "Finnhub", short: "Finnhub", feed: "rt", covers: "US stock trades over its websocket", licence: "internal",
    terms: "https://finnhub.io/terms-of-service", read: READ, streams: true, keys: ["FINNHUB_TOKEN"], limit: 50, stocks: true,
    basis: "Only with a plan or written approval that allows business use; the free plan is personal use only, even internally.",
    note: "Team only, off until FINNHUB_TOKEN is set. Finnhub's terms say a personal plan cannot be used by a business, even internally, without written approval." },
  // Turned down: terms forbid display, or a key or contract is needed.
  { id: "bitstamp", name: "Bitstamp", short: "Bitstamp", feed: "rt", covers: "Real-time spot trades", licence: "no", terms: "https://www.bitstamp.net/terms-of-use/", read: READ, streams: false,
    note: "Terms forbid republishing prices on any other website. Not built." },
  { id: "bitfinex", name: "Bitfinex", short: "Bitfinex", feed: "rt", covers: "Real-time spot trades", licence: "no", terms: "https://www.bitfinex.com/legal/general/market-data", read: READ, streams: false,
    note: "No redistribution without written consent." },
  { id: "binance", name: "Binance", short: "Binance", feed: "rt", covers: "Real-time spot and perps", licence: "no", terms: "https://www.binance.com/en/terms", read: READ, streams: false,
    note: "Blocks US addresses (HTTP 451) and bars US persons, so not even internal use." },
  { id: "others-crypto", name: "Crypto.com, KuCoin, Gate, Bitget, MEXC, HTX, OKX, Bybit, Deribit", short: "Other exchanges", feed: "rt", covers: "Real-time spot and perps", licence: "no", terms: "https://www.kucoin.com/legal/terms-of-use", read: READ, streams: false,
    note: "Each forbids display without consent, is personal use only (Deribit, OKX), or bars the US (Bybit, OKX, Binance)." },
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
/** Team-only sources: terms allow internal use only (DEC-0053). */
export const isInternal = (id: string) => sourceById(id)?.licence === "internal";
/** The badge's words for a team-only feed. */
export const INTERNAL_LABEL = "Internal use, real-time";
