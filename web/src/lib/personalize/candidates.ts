// What the What's new feed can show (DEC-0068): research results the product already displays,
// Academy courses, Workbench tools, markets pages, Sim World scenarios and Verify. Every
// builder takes data the app already loads and returns plain candidates; nothing here
// fetches, so the tests can feed it fixtures. Showing a research result never writes back to
// the research side: the feed only reads (DEC-0015).
import type { Course } from "../academy";
import type { BotsIndex } from "../botStats";
import type { DocMeta } from "../docs";
import type { Report } from "../types";
import { nameOf, tagsOf } from "../strategyMeta";
import type { RecoKind } from "./api";

/** Numbers a hook may quote. Only what the source data holds; absent means unknown. */
export interface Facts {
  cagr?: number | null;
  maxDrawdown?: number | null;
  passed?: number;
  total?: number;
  beatsMarket?: boolean;
  verdict?: string;
  winRate?: number | null;
  trades?: number;
  pnl?: number;
  blown?: boolean;
  marginCalls?: number;
  runLabel?: string;
  lessons?: number;
  minutes?: number;
  level?: string;
}

export interface Candidate {
  /** "kind:id", the id the database stores for clicks and dismissals. */
  item: string;
  kind: RecoKind;
  title: string;
  /** The plain line shown when there is no hook, or when the hook test shows titles only. */
  description: string;
  href: string;
  /** asset:x, family:y, kind:z, level:w. Lower case, as reco_log accepts them. */
  tags: string[];
  /** When it was added, for "New this week" and the newest-first order. */
  addedAt?: string;
  facts: Facts;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const tag = (k: string, v: string | undefined | null) => (v && slug(v) ? [`${k}:${slug(v)}`] : []);
const itemId = (kind: RecoKind, id: string) => `${kind}:${slug(id)}`;

/** Tested strategies from the research report, with the numbers its tests produced. */
export function strategyCandidates(report: Report | null | undefined): Candidate[] {
  if (!report) return [];
  return report.runs.filter((r) => !r.is_benchmark && r.gauntlet).map((r) => {
    const t = tagsOf(r);
    return {
      item: itemId("algo", r.strategy),
      kind: "algo" as const,
      title: nameOf(r),
      description: r.description ?? r.summary,
      href: `#/strategy/${encodeURIComponent(r.strategy)}`,
      tags: ["kind:algo", ...tag("asset", t.asset), ...tag("family", t.family)],
      facts: {
        cagr: r.metrics.cagr, maxDrawdown: r.metrics.max_drawdown, passed: r.gauntlet?.passed, total: r.gauntlet?.total,
        beatsMarket: r.gauntlet?.beats_sp500, verdict: r.gauntlet?.verdict,
      },
    };
  });
}

/** New entries in the algorithm library (ALG docs), dated by the day they were written. */
export function libraryCandidates(docs: DocMeta[] | null | undefined): Candidate[] {
  if (!docs) return [];
  return docs.filter((d) => d.type === "algorithm" && d.status !== "retired").map((d) => ({
    item: itemId("algo", d.id),
    kind: "algo" as const,
    title: d.title,
    description: "A new entry in the algorithm library, with the paper it comes from and how we test it.",
    href: `#/doc/${encodeURIComponent(d.id)}`,
    tags: ["kind:algo", ...d.tags.slice(0, 4).flatMap((x) => tag("family", x))],
    addedAt: d.created,
    facts: {},
  }));
}

/** The Bot Battle bots, with their results on the real market run. */
export function botCandidates(index: BotsIndex | null | undefined): Candidate[] {
  if (!index) return [];
  const run = index.runs.find((r) => r.kind === "market") ?? index.runs[0];
  return index.bots.map((b) => {
    const s = run?.summary[b.id];
    return {
      item: itemId("algo", `bot-${b.id}`),
      kind: "algo" as const,
      title: b.name,
      description: b.rule,
      href: "#/sim/bots",
      tags: ["kind:algo", "family:bot", ...tag("family", b.style)],
      facts: s ? { winRate: s.win_rate, trades: s.trades, pnl: s.pnl, blown: s.blown, marginCalls: s.margin_calls, runLabel: run?.label } : {},
    };
  });
}

/** Parity Academy courses. */
export function courseCandidates(courses: Course[] | null | undefined): Candidate[] {
  if (!courses) return [];
  return courses.map((c) => ({
    item: itemId("lesson", c.id),
    kind: "lesson" as const,
    title: c.title,
    description: c.summary,
    href: `#/academy/${encodeURIComponent(c.id)}`,
    tags: ["kind:lesson", ...tag("level", c.level)],
    facts: { lessons: c.lessons.length, minutes: c.lessons.reduce((n, l) => n + (l.minutes || 0), 0), level: c.level },
  }));
}

/** Parity Workbench tools and Verify: fixed pages, described by what they do. */
export const TOOL_CANDIDATES: Candidate[] = [
  { item: "tool:try", kind: "tool", title: "Try settings", description: "Change a strategy's settings and see how the tested result moves.", href: "#/lab", tags: ["kind:tool", "family:research"], facts: {} },
  { item: "tool:whatif", kind: "tool", title: "What if", description: "Pick a past event and see what each market did after it.", href: "#/scenarios", tags: ["kind:tool", "family:scenario"], facts: {} },
  { item: "tool:compare", kind: "tool", title: "Compare", description: "Put two or more strategies side by side on the same tests.", href: "#/compare", tags: ["kind:tool", "family:research"], facts: {} },
  { item: "tool:search", kind: "tool", title: "Strategy search", description: "Every variation the search tried, including the ones that failed.", href: "#/search", tags: ["kind:tool", "family:research"], facts: {} },
  { item: "tool:edges", kind: "tool", title: "Edge Lab", description: "Short lessons on where trading edges come from, each with a live chart.", href: "#/edges", tags: ["kind:tool", "family:learning"], facts: {} },
  { item: "verify:upload", kind: "verify", title: "Verify a backtest", description: "Upload returns from any backtest and run them through the same tests as our strategies.", href: "#/verify", tags: ["kind:verify", "family:research"], facts: {} },
];

/** Markets pages in the product app. */
export const MARKET_CANDIDATES: Candidate[] = [
  { item: "market:crypto", kind: "market", title: "Crypto prices", description: "Prices and moves for the largest coins.", href: "#/markets/crypto", tags: ["kind:market", "asset:crypto"], facts: {} },
  { item: "market:perps", kind: "market", title: "Perpetual futures", description: "Funding rates and open interest on crypto perpetuals.", href: "#/markets/perps", tags: ["kind:market", "asset:crypto"], facts: {} },
  { item: "market:etfs", kind: "market", title: "ETFs by theme", description: "Exchange traded funds grouped by what they hold.", href: "#/markets/etfs", tags: ["kind:market", "asset:stocks"], facts: {} },
  { item: "market:private", kind: "market", title: "Private markets", description: "How private funds report returns and why they look calm.", href: "#/markets/private", tags: ["kind:market", "asset:private"], facts: {} },
  { item: "market:practice", kind: "market", title: "Practice positions", description: "Track made-up positions against live prices.", href: "#/markets/practice", tags: ["kind:market", "family:practice"], facts: {} },
];

/** Sim World scenarios, from the presets the What if tool already offers. */
export function scenarioCandidates(presets: { label: string; spec: { type?: string; commodities?: string[] } }[] | null | undefined): Candidate[] {
  if (!presets) return [];
  return presets.map((p) => ({
    item: itemId("scenario", p.label),
    kind: "scenario" as const,
    title: p.label,
    description: "See what markets did after past events of this kind.",
    href: `#/scenarios?t=${encodeURIComponent(p.label)}${p.spec.type ? `&type=${encodeURIComponent(p.spec.type)}` : ""}`,
    tags: ["kind:scenario", ...tag("family", p.spec.type), ...(p.spec.commodities ?? []).slice(0, 2).flatMap((c) => tag("asset", c))],
    facts: {},
  }));
}

export interface CandidateSources {
  report?: Report | null;
  docs?: DocMeta[] | null;
  bots?: BotsIndex | null;
  courses?: Course[] | null;
  presets?: { label: string; spec: { type?: string; commodities?: string[] } }[] | null;
}

/** Every candidate, one per item id (the first source wins on a clash). */
export function allCandidates(src: CandidateSources): Candidate[] {
  const list = [
    ...libraryCandidates(src.docs), ...strategyCandidates(src.report), ...botCandidates(src.bots),
    ...courseCandidates(src.courses), ...TOOL_CANDIDATES, ...MARKET_CANDIDATES, ...scenarioCandidates(src.presets),
  ];
  const seen = new Set<string>();
  return list.filter((c) => (seen.has(c.item) ? false : (seen.add(c.item), true)));
}
