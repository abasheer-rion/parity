// One list of every page: which side of Parity it lives on, its plain name, what it
// is for and when to go there. The sidebar, the Start here page and search all read
// from this, so a page is described once and the three never disagree.
//
// Parity has two sides, kept apart on purpose (DEC-0015):
//   product   /app/       the public app: discover, follow and understand strategies
//   research  /research/  where results are made: docs, the official record, the search
import { SPACE, type Space } from "./space";

export interface PageInfo {
  href: string;
  title: string;
  space: Space | "both";
  /** One line: what this page is. */
  what: string;
  /** One line: go here when you want to... */
  when: string;
  /** Extra words people might type when looking for it. */
  keywords: string[];
}

export const PAGES: PageInfo[] = [
  // Both sides
  { href: "#/start", title: "Start here", space: "both", what: "A two-minute guide to this side of Parity and how to read its numbers.", when: "you are new, or lost", keywords: ["help", "guide", "how", "tour", "new", "lost"] },
  { href: "#/how", title: "How Parity works", space: "both", what: "The two sides of Parity, product and research, and the wall between them.", when: "you wonder where a number comes from or why the sides are separate", keywords: ["about", "two sides", "bias", "wall", "product", "research", "how it works"] },
  { href: "#/learn", title: "Glossary", space: "both", what: "Every trading word we use, explained simply, by analogy and precisely.", when: "a word on the page means nothing to you", keywords: ["terms", "words", "definitions", "meaning", "learn", "what is"] },

  // Product
  { href: "#/", title: "Home", space: "product", what: "Your watchlist, strategies worth a look, what if and today's market.", when: "you open the app", keywords: ["home", "dashboard", "overview"] },
  { href: "#/strategies", title: "Discover", space: "product", what: "Every tested strategy, with its result and verdict.", when: "you want to find a strategy or see which ones work", keywords: ["strategies", "list", "best", "top", "rank", "results", "algos", "algorithms", "discover"] },
  { href: "#/watchlist", title: "Watchlist", space: "product", what: "The strategies you follow.", when: "you want to check on the strategies you care about", keywords: ["watchlist", "following", "saved", "favourites", "bookmarks"] },
  { href: "#/compare", title: "Compare", space: "product", what: "All strategies side by side, how they move together, and how they did in crashes.", when: "you want to pick between strategies", keywords: ["versus", "vs", "side by side", "crash", "correlation"] },
  { href: "#/lab", title: "Try settings", space: "product", what: "Change a strategy's settings and see how the result moves.", when: "you wonder if a strategy only works with lucky settings", keywords: ["lab", "parameters", "sensitivity", "tweak", "settings", "build"] },
  { href: "#/scenarios", title: "What if", space: "product", what: "Describe an event and see what markets did after similar past events.", when: "you ask \"what if\" about a war, a rate change or a shock", keywords: ["what if", "scenarios", "event", "war", "shock", "predict", "future"] },
  { href: "#/news", title: "News", space: "product", what: "The newest official headlines and how markets moved afterwards.", when: "you want to know what is happening now", keywords: ["headlines", "today", "market moves", "reports"] },
  { href: "#/news/archive", title: "News archive", space: "product", what: "Every headline we have kept, back to the 1970s, searchable by words, years, topic, asset and source.", when: "you want older news", keywords: ["archive", "old news", "search news", "headlines", "history"] },
  { href: "#/news/impact", title: "News impact search", space: "product", what: "Which news came before unusual moves in an asset, and what usually follows a kind of news, against random days.", when: "you want to know what news moves a market", keywords: ["impact", "event study", "opec", "rate hike", "war", "inflation", "bank failure", "what moves"] },
  { href: "#/news/history", title: "Biggest days", space: "product", what: "The largest market moves since 1999 and what was in the news.", when: "you want history's big days", keywords: ["history", "crash", "biggest", "moves"] },
  { href: "#/trade", title: "Trade", space: "product", what: "Pro charts on delayed, end-of-day prices: candles, OHLC bars, Heikin-Ashi, indicators like RSI and MACD, drawing tools and a compare overlay.", when: "you want to chart a market and its indicators", keywords: ["trade", "chart", "charts", "candles", "candlestick", "rsi", "macd", "bollinger", "indicators", "technical analysis", "fibonacci", "trend line"] },
  { href: "#/trade/watchlists", title: "Watchlists and alerts", space: "product", what: "Your own lists of indices, currencies, crypto, commodities and rates with the last delayed close, day and week change and a one-year line, plus price, RSI and moving average alerts that show up in the app.", when: "you want to keep an eye on a few markets or be told when one crosses a level", keywords: ["watchlist", "watchlists", "tracker", "alerts", "price alert", "notify", "rsi alert", "moving average", "notifications"] },
  { href: "#/trade/screener", title: "Screener", space: "product", what: "Filter every market we can show by asset class, RSI, the 50 and 200 bar averages, one-month and year-to-date change, distance from the one-year high and ADX. Sorted by name, never ranked as advice.", when: "you want to find markets that match a technical condition", keywords: ["screener", "screen", "filter", "scan", "scanner", "rsi", "oversold", "overbought", "sma", "200 day", "adx", "52 week high"] },
  { href: "#/markets", title: "Markets", space: "product", what: "Crypto, perps, ETFs and what is newly filed or trending, with dates, sources and plain risks.", when: "you want to look at the hot stuff without the hype", keywords: ["markets", "crypto", "bitcoin", "coins", "etf", "etfs", "perps", "perpetual", "trending", "new", "hype"] },
  { href: "#/markets/new", title: "New and trending", space: "product", what: "Funds being filed with the SEC and coins people search for, newest first, each with what to check.", when: "you wonder what the next ETF or coin is", keywords: ["new", "trending", "filings", "launches", "next etf", "next coin", "sec", "discover"] },
  { href: "#/markets/crypto", title: "Crypto", space: "product", what: "Prices for the 100 largest coins, a year of history for the majors, and their plain risks.", when: "you want crypto prices and how hard coins fall", keywords: ["crypto", "bitcoin", "ethereum", "solana", "coins", "prices"] },
  { href: "#/markets/perps", title: "Perps", space: "product", what: "Perpetual futures: funding as a cost of holding, open interest and leverage risk.", when: "you hear about perps, funding or leverage", keywords: ["perps", "perpetual", "futures", "funding", "open interest", "leverage", "liquidation"] },
  { href: "#/markets/etfs", title: "ETFs", space: "product", what: "Every US-listed ETF we can find, by theme, newest fund series first.", when: "you want to browse ETFs by theme", keywords: ["etf", "etfs", "funds", "covered call", "buffer", "leveraged", "thematic"] },
  { href: "#/markets/private", title: "Private markets", space: "product", what: "Private equity, venture, private credit, real estate and infrastructure in plain words: how to read IRR, TVPI, DPI and PME, the ways individuals get in, and what to check.", when: "someone offers you a private fund, an interval fund or a BDC, or you wonder how private returns are measured", keywords: ["private markets", "private equity", "venture", "venture capital", "private credit", "direct lending", "interval fund", "tender offer fund", "bdc", "non-traded reit", "evergreen", "secondaries", "infrastructure", "irr", "tvpi", "dpi", "pme", "form d", "accredited investor"] },
  { href: "#/markets/terms", title: "Hype terms explained", space: "product", what: "Staking, memecoins, 0DTE, buffer ETFs and more, in plain words with what can go wrong.", when: "a new money word means nothing to you", keywords: ["hype", "terms", "staking", "restaking", "memecoin", "airdrop", "0dte", "prediction markets", "rwa"] },
  { href: "#/markets/practice", title: "Practice", space: "product", what: "Follow a coin or ETF with pretend money and watch what it would be worth. No real money.", when: "you want to try an idea without risking money", keywords: ["practice", "paper", "pretend", "simulate", "trade", "portfolio"] },

  { href: "#/academy", title: "Academy", space: "product", what: "Short courses with moving pictures: reading a backtest, luck vs skill, how markets move, currencies, rates, crypto, private markets and news.", when: "you want to understand a topic in a few minutes", keywords: ["academy", "course", "courses", "lesson", "lessons", "learn", "tutorial", "teach", "explain", "beginner", "video", "yield curve", "event study", "irr", "tvpi"] },

  // Research
  { href: "#/", title: "Research home", space: "research", what: "Where the research stands: the question, the record, the search and what is open.", when: "you open the research side", keywords: ["home", "dashboard", "status", "overview"] },
  { href: "#/docs", title: "Research docs", space: "research", what: "Every decision, experiment, paper note and log, readable with previews.", when: "you want the reasoning behind a result", keywords: ["docs", "papers", "notes", "reports", "decisions", "experiments", "reading", "hypotheses"] },
  { href: "#/search", title: "Strategy search", space: "research", what: "Thousands of strategy variations a machine tries around the clock, best first.", when: "you want to see what the search has found, or browse many ideas fast", keywords: ["search", "thousands", "variations", "leads", "sims", "simulations", "factory"] },
  { href: "#/ledger", title: "Official record", space: "research", what: "The sealed list of official runs. Only these count as results.", when: "you need to know if a number is official", keywords: ["ledger", "official", "proof", "sealed", "hash", "registered"] },
  { href: "#/catalog", title: "Algorithm library", space: "research", what: "Every trading idea we know of, where it came from and how far we have tested it.", when: "you are looking for the next strategy to build", keywords: ["catalog", "ideas", "algorithms", "library", "papers"] },
  { href: "#/sim", title: "Parity Terminal", space: "research", what: "Opens Parity Terminal in a new tab: a keyboard-first market terminal with a monitor of every series, comparisons, a world map, headlines, strategy results and every Sim World tool (crises, scenarios, simulated paths, stress tests, the strategy race).", when: "you want a dense view of every market, to compare series, to replay history or play out an event, or to export simulated paths", keywords: ["terminal", "bloomberg", "monitor", "dashboard", "race", "replay", "simulate", "sim", "world", "map", "monte carlo", "paths", "scenario", "risk", "carry", "currencies", "export", "csv", "crisis", "crises", "stress", "yield curve", "correlation", "compare", "commodities", "sectors", "kpi", "positioning", "macro"] },
  { href: "#/edges", title: "Edge Lab", space: "research", what: "How to look for a trading edge without fooling yourself: seven lessons, our own mistakes and a checklist for your idea.", when: "you have a trading idea and want to know what could make its backtest lie", keywords: ["edge", "edges", "alpha", "overfitting", "backtest", "pitfalls", "checklist", "look-ahead", "lookahead", "multiple testing", "deflated sharpe", "costs", "holdout", "out of sample", "decay", "crowding", "capacity"] },
  { href: "#/private", title: "Private markets data", space: "research", what: "How much smoothing hides in property indexes, Form D counts of private offerings, BDC loan marks and FRED credit proxies, with what free data cannot show.", when: "you want the numbers behind the Private markets page, or to see unsmoothing at work", keywords: ["private markets", "unsmoothing", "smoothing", "geltner", "getmansky", "appraisal", "stale prices", "form d", "bdc", "nav", "private credit", "real estate", "fred"] },
  { href: "#/signals", title: "Early signals", space: "research", what: "Whether each strategy's signal predicts anything before costs and rules.", when: "a strategy fails and you want to know if the idea or the rule is at fault", keywords: ["signals", "ic", "information coefficient", "predict"] },
  { href: "#/explore", title: "Raw prices", space: "research", what: "Chart the raw price series behind the strategies.", when: "you want to look at the data itself, not a strategy", keywords: ["explore", "series", "chart", "prices", "data"] },
  { href: "#/data", title: "Data health", space: "research", what: "Whether every data series behind this run is fresh and complete.", when: "a number looks wrong and you want to rule out bad data", keywords: ["data", "health", "stale", "coverage", "freshness"] },
  { href: "#/sources", title: "Data sources", space: "research", what: "Every market data source we looked at: what it has, cost and terms.", when: "you need data and want to know where to get it", keywords: ["providers", "api", "feeds", "ticks", "vendors"] },
  { href: "#/refs", title: "Bibliography", space: "research", what: "Every paper, book, data provider and repo the project relies on.", when: "you want the original source", keywords: ["sources", "citations", "papers", "references"] },
  { href: "#/ui", title: "UI library", space: "research", what: "The buttons, charts and colours the site is built from.", when: "you are building a page", keywords: ["design", "components", "colours", "buttons"] },
];

/** Pages on this side (plus the shared ones). */
export const HERE = PAGES.filter((p) => p.space === SPACE || p.space === "both");

export const pageByHref: Record<string, PageInfo> = Object.fromEntries(HERE.map((p) => [p.href, p]));

/** A link that works from either side: a hash on this side, a full path to the other. */
export function linkTo(p: PageInfo): string {
  return p.space === "both" || p.space === SPACE ? p.href : `${p.space === "research" ? "/research/" : "/app/"}${p.href}`;
}

/** Rank pages for a search query, both sides, this side first. */
export function searchPages(query: string): { page: PageInfo; score: number }[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: { page: PageInfo; score: number }[] = [];
  for (const p of PAGES) {
    const t = p.title.toLowerCase();
    let score = t === q ? 95 : t.startsWith(q) ? 75 : t.includes(q) ? 55 : 0;
    if (!score && p.keywords.some((k) => k === q || q.includes(k) || k.startsWith(q))) score = 45;
    if (!score && `${p.what} ${p.when}`.toLowerCase().includes(q)) score = 20;
    if (score && p.space !== "both" && p.space !== SPACE) score -= 10;
    if (score) out.push({ page: p, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
