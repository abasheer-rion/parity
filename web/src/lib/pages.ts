// One list of every page: its plain name, what it is for, and when to go there.
// The sidebar, the Start here page and search all read from this, so a page is
// described once and the three never disagree (INT-0002, "a dashboard people can
// find their way around").

export interface PageInfo {
  href: string;
  title: string;
  area: "markets" | "research";
  /** One line: what this page is. */
  what: string;
  /** One line: go here when you want to... */
  when: string;
  /** Extra words people might type when looking for it. */
  keywords: string[];
}

export const PAGES: PageInfo[] = [
  { href: "#/start", title: "Start here", area: "markets", what: "A two-minute guide to Parity and how to read its numbers.", when: "you are new, or lost", keywords: ["help", "guide", "how", "tour", "new", "lost"] },
  { href: "#/", title: "Sim World", area: "markets", what: "Replay every strategy against the US stock market, step by step.", when: "you want to watch strategies race over time", keywords: ["home", "race", "replay", "simulate", "sim"] },
  { href: "#/strategies", title: "All strategies", area: "markets", what: "Every strategy we have tested, with its result and verdict.", when: "you want to find a strategy or see which ones work", keywords: ["list", "best", "top", "rank", "results", "algos", "algorithms"] },
  { href: "#/compare", title: "Compare", area: "markets", what: "All strategies side by side, how they move together, and how they did in crashes.", when: "you want to pick between strategies", keywords: ["versus", "vs", "side by side", "crash", "correlation"] },
  { href: "#/lab", title: "Try settings", area: "markets", what: "Change a strategy's settings and see how the result moves.", when: "you wonder if a strategy only works with lucky settings", keywords: ["lab", "parameters", "sensitivity", "tweak", "settings"] },
  { href: "#/explore", title: "Raw prices", area: "markets", what: "Chart the raw price series behind the strategies.", when: "you want to look at the data itself, not a strategy", keywords: ["explore", "series", "chart", "prices", "data"] },
  { href: "#/signals", title: "Early signals", area: "markets", what: "Whether each strategy's signal predicts anything before costs and rules.", when: "a strategy fails and you want to know if the idea or the rule is at fault", keywords: ["signals", "ic", "information coefficient", "predict"] },
  { href: "#/scenarios", title: "Scenarios", area: "markets", what: "Describe an event and see what markets did after similar past events.", when: "you ask \"what if\" about a war, a rate change or a shock", keywords: ["what if", "event", "war", "shock", "predict", "future"] },
  { href: "#/news", title: "News", area: "markets", what: "The newest official headlines and how markets moved afterwards.", when: "you want to know what is happening now", keywords: ["headlines", "today", "market moves", "reports"] },
  { href: "#/news/history", title: "Biggest days", area: "markets", what: "The largest market moves since 1999 and what was in the news.", when: "you want history's big days", keywords: ["history", "crash", "biggest", "moves"] },
  { href: "#/catalog", title: "Algorithm library", area: "markets", what: "Every trading idea we know of, where it came from and how far we have tested it.", when: "you are looking for the next strategy to build", keywords: ["catalog", "ideas", "algorithms", "library", "papers"] },
  { href: "#/ledger", title: "Official record", area: "markets", what: "The sealed list of official runs. Only these count as results.", when: "you need to know if a number is official", keywords: ["ledger", "official", "proof", "sealed", "hash"] },
  { href: "#/data", title: "Data health", area: "markets", what: "Whether every data series behind this run is fresh and complete.", when: "a number looks wrong and you want to rule out bad data", keywords: ["data", "health", "stale", "coverage", "freshness"] },
  { href: "#/sources", title: "Data sources", area: "markets", what: "Every market data source we looked at: what it has, cost and terms.", when: "you need data and want to know where to get it", keywords: ["providers", "api", "feeds", "ticks", "vendors"] },
  { href: "#/docs", title: "Research docs", area: "research", what: "Every decision, experiment, paper note and log, readable with previews.", when: "you want the reasoning behind a result", keywords: ["docs", "papers", "notes", "reports", "decisions", "experiments", "reading"] },
  { href: "#/learn", title: "Glossary", area: "research", what: "Every trading word we use, explained simply, by analogy and precisely.", when: "a word on the page means nothing to you", keywords: ["terms", "words", "definitions", "meaning", "learn", "what is"] },
  { href: "#/refs", title: "Bibliography", area: "research", what: "Every paper, book, data provider and repo the project relies on.", when: "you want the original source", keywords: ["sources", "citations", "papers", "references"] },
  { href: "#/ui", title: "UI library", area: "research", what: "The buttons, charts and colours the site is built from.", when: "you are building a page", keywords: ["design", "components", "colours", "buttons"] },
];

export const pageByHref: Record<string, PageInfo> = Object.fromEntries(PAGES.map((p) => [p.href, p]));

/** Rank pages for a search query. */
export function searchPages(query: string): { page: PageInfo; score: number }[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: { page: PageInfo; score: number }[] = [];
  for (const p of PAGES) {
    const t = p.title.toLowerCase();
    let score = t === q ? 95 : t.startsWith(q) ? 75 : t.includes(q) ? 55 : 0;
    if (!score && p.keywords.some((k) => k === q || q.includes(k) || k.startsWith(q))) score = 45;
    if (!score && `${p.what} ${p.when}`.toLowerCase().includes(q)) score = 20;
    if (score) out.push({ page: p, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
