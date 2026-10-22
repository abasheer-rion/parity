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
  { href: "#/news/history", title: "Biggest days", space: "product", what: "The largest market moves since 1999 and what was in the news.", when: "you want history's big days", keywords: ["history", "crash", "biggest", "moves"] },

  // Research
  { href: "#/", title: "Research home", space: "research", what: "Where the research stands: the question, the record, the search and what is open.", when: "you open the research side", keywords: ["home", "dashboard", "status", "overview"] },
  { href: "#/docs", title: "Research docs", space: "research", what: "Every decision, experiment, paper note and log, readable with previews.", when: "you want the reasoning behind a result", keywords: ["docs", "papers", "notes", "reports", "decisions", "experiments", "reading", "hypotheses"] },
  { href: "#/search", title: "Strategy search", space: "research", what: "Thousands of strategy variations a machine tries around the clock, best first.", when: "you want to see what the search has found, or browse many ideas fast", keywords: ["search", "thousands", "variations", "leads", "sims", "simulations", "factory"] },
  { href: "#/ledger", title: "Official record", space: "research", what: "The sealed list of official runs. Only these count as results.", when: "you need to know if a number is official", keywords: ["ledger", "official", "proof", "sealed", "hash", "registered"] },
  { href: "#/catalog", title: "Algorithm library", space: "research", what: "Every trading idea we know of, where it came from and how far we have tested it.", when: "you are looking for the next strategy to build", keywords: ["catalog", "ideas", "algorithms", "library", "papers"] },
  { href: "#/sim", title: "Sim World", space: "research", what: "Replay every strategy against the US stock market, step by step.", when: "you want to watch strategies race over time", keywords: ["race", "replay", "simulate", "sim", "world"] },
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
