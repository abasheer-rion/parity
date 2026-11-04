// Reading a seller's claims from the words of a page (DEC-0088): returns, win rate, largest
// fall, number of trades, how long it has run and more. Fixed patterns only, in a fixed
// order, so the same text always gives the same claims, and every claim keeps the words it
// came from and where they are. Statistics pages put a label next to a value ("Growth:
// 339.96%", "Profit Trades: 654 (71.55%)"); sales pages and posts say it in a sentence ("92%
// win rate", "+340% in 12 months"). Both are read. A person's own AI model can add claims
// later (model.ts), and each of those is checked against the text too.
import type { Claim } from "../types";
import { plainText } from "./text";

export type ClaimField =
  | "totalReturn" | "monthlyReturn" | "yearlyReturn" | "winRate" | "maxDrawdown" | "trades" | "tradesPerMonth"
  | "months" | "startDate" | "profitFactor" | "takeProfit" | "stopLoss" | "noStop" | "maxLoss" | "avgLoss"
  | "leverage" | "grid" | "martingale" | "maxLossCapped" | "pips" | "sharpe";

export interface FoundClaim {
  field: ClaimField;
  /** Rates and returns as fractions (0.92), counts as numbers, a start date as YYYY-MM-DD, flags as true. */
  value: number | string | boolean;
  /** The value as the page writes it: "71.55%", "914", "2024.10.22". */
  shown: string;
  /** The words around it, at most about 160 characters, for the page to show. */
  quote: string;
  /** Where the matched words start in the text, and how long they are. */
  at: number;
  length: number;
  /** "pattern" for our fixed patterns, "model" for the person's own AI model. */
  how: "pattern" | "model";
  /** How it was read, in words: 'Next to the label "Growth"'. */
  rule: string;
}

export const FIELD_LABEL: Record<ClaimField, string> = {
  totalReturn: "Total return", monthlyReturn: "Return a month", yearlyReturn: "Return a year", winRate: "Win rate",
  maxDrawdown: "Largest fall from a high", trades: "Number of trades", tradesPerMonth: "Trades a month", months: "How long it ran",
  startDate: "Started on", profitFactor: "Profit factor", takeProfit: "Take-profit", stopLoss: "Stop-loss", noStop: "No stop-loss",
  maxLoss: "Largest single loss", avgLoss: "Average loss", leverage: "Leverage", grid: "Grid trading", martingale: "Adds to losing positions",
  maxLossCapped: "Loss limit stated", pips: "Pips", sharpe: "Sharpe ratio",
};

type Match = RegExpMatchArray;

// ------------------------------------------------------------------ numbers

/** A number as pages write it: 1,602.85, 1 602.85, 1.602,85, 12,5, +340, -2.80. */
const NUM = String.raw`[+-]?(?:\d{1,3}(?:[ ,.]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;

export function parseNumber(raw: string): number | null {
  let s = raw.replace(/\s+/g, " ").trim();
  const neg = s.startsWith("-");
  s = s.replace(/^[+-]/, "");
  const dot = s.lastIndexOf("."), comma = s.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    // Both: the last one is the decimal mark.
    s = dot > comma ? s.replace(/[ ,]/g, "") : s.replace(/[ .]/g, "").replace(",", ".");
  } else if (comma >= 0) {
    // "1,602" or "1,602,000" groups thousands; "12,5" is a decimal comma.
    s = /^\d{1,3}(,\d{3})+$/.test(s.replace(/ /g, "")) ? s.replace(/[ ,]/g, "") : s.replace(/ /g, "").replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/[ .]/g, "");
  } else {
    s = s.replace(/ /g, "");
  }
  const v = Number(s);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const DATE = String.raw`(?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}\s+${MON}\s+\d{4}|${MON}\s+\d{1,2},?\s+\d{4}|${MON}\s+\d{4}|(?:19|20)\d{2})`;

const pad = (n: number) => String(n).padStart(2, "0");

/** A date as a page writes it, to YYYY-MM-DD (the first of the month or year when only those are given). */
export function parseDate(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  const ok = (y: number, m: number, d: number) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
  const mon = (w: string) => MONTHS.indexOf(w.slice(0, 3)) + 1;
  let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2}) ([a-z]+)\.? (\d{4})$/);
  if (m) return ok(+m[3], mon(m[2]), +m[1]);
  m = s.match(/^([a-z]+)\.? (\d{1,2}) (\d{4})$/);
  if (m) return ok(+m[3], mon(m[1]), +m[2]);
  m = s.match(/^([a-z]+)\.? (\d{4})$/);
  if (m) return ok(+m[2], mon(m[1]), 1);
  m = s.match(/^(\d{4})$/);
  if (m) return ok(+m[1], 1, 1);
  return null;
}

// ------------------------------------------------------------------ patterns

interface Pattern {
  field: ClaimField;
  re: RegExp;
  /** The value from the match; null skips it. */
  value: (m: Match) => number | string | boolean | null;
  /** The part of the match to show as the value. */
  shown: (m: Match) => string;
  rule: string;
  /** Words in the match that mean it is something else ("forecast", "risk per trade"). */
  not?: RegExp;
  /** Words just before the match that mean it is something else ("Monthly" before "growth"). */
  before?: RegExp;
}

const pctOf = (g: string | undefined) => { const v = g == null ? null : parseNumber(g); return v == null ? null : v / 100; };
const firstGroup = (m: Match) => m.slice(1).find((x) => x != null) ?? "";
const lbl = (labels: string[]) => labels.map((l) => l.replace(/[.%/]/g, (c) => `\\${c}`).replace(/ /g, String.raw`\s*`)).join("|");
/** A label, then a colon or a line break, then the value (statistics pages). */
const AFTER = String.raw`\s*(?:\([^)\n]{0,24}\)\s*)?[:=]?[ \t]*(?:\n[ \t]*)?`;
const START = String.raw`(?<![a-z0-9])`;

function labelPct(field: ClaimField, labels: string[], name: string, not?: RegExp, before?: RegExp): Pattern {
  const re = new RegExp(`${START}(?:${lbl(labels)})${AFTER}(${NUM})\\s?%`, "gi");
  return { field, re, value: (m) => pctOf(m[1]), shown: (m) => `${m[1].trim()}%`, rule: `Next to the label "${name}"`, not, before };
}

function labelNum(field: ClaimField, labels: string[], name: string, opts: { not?: RegExp; before?: RegExp; scale?: number } = {}): Pattern {
  const re = new RegExp(`${START}(?:${lbl(labels)})${AFTER}(${NUM})(?!\\s?%|[.,]?\\d)`, "gi");
  return { field, re, value: (m) => { const v = parseNumber(m[1]); return v == null ? null : v * (opts.scale ?? 1); }, shown: (m) => m[1].trim(), rule: `Next to the label "${name}"`, not: opts.not, before: opts.before };
}

const NOT_RETURN = /forecast|target|risk|commission|spread|fee|leverage|per trade|deposit load|activity|algo/i;

export const PATTERNS: Pattern[] = [
  // Statistics pages: a label and its value.
  labelPct("totalReturn", ["total gain", "total return", "total growth", "cumulative return", "net return", "all time return", "all-time return", "growth", "gain", "roi", "return"], "Growth or gain", /forecast|per\b|a month|a year/i, /(?:abs\.?|absolute|monthly|daily|weekly|annual|yearly|average|avg\.?|expected|target)\s*$/i),
  labelPct("monthlyReturn", ["average monthly return", "avg monthly return", "avg. monthly return", "monthly return", "monthly gain", "monthly growth", "monthly profit", "monthly"], "Monthly", NOT_RETURN),
  labelPct("yearlyReturn", ["annual return", "annualized return", "annualised return", "yearly return", "yearly gain", "annual gain", "cagr", "annual"], "Annual", NOT_RETURN),
  {
    // "Profit Trades: 654 (71.55%)", "Won: 654 (71%)", "Win rate: 71.5%"
    field: "winRate",
    re: new RegExp(`${START}(?:${lbl(["win rate", "winrate", "win ratio", "win %", "winning trades", "winners", "profit trades", "profitable trades", "won trades", "won", "accuracy", "hit rate", "success rate", "profitability"])})${AFTER}(?:(${NUM})\\s*\\(\\s*(${NUM})\\s?%\\s*\\)|(${NUM})\\s?%)`, "gi"),
    value: (m) => pctOf(m[2] ?? m[3]),
    shown: (m) => `${(m[2] ?? m[3] ?? "").trim()}%`,
    rule: "Next to a win rate label",
    before: /(?:longs?|shorts?|buys?|sells?)\s*$/i,
  },
  {
    // "Drawdown: 23.4%", "Relative drawdown: By Balance: 16.89%", "Maximal: 665.41 USD (9.50%)" under "Drawdown by balance".
    field: "maxDrawdown",
    re: new RegExp(`${START}(?:max(?:imum|imal)?\\.?\\s*|relative\\s*|largest\\s*|biggest\\s*|worst\\s*)?(?:draw\\s?-?downs?|dd)\\b((?:[^%\\n]{0,40}\\n){0,2}[^%\\n]{0,70}?)(${NUM})\\s?%`, "gi"),
    value: (m) => { const v = pctOf(m[2]); return v == null ? null : Math.abs(v); },
    shown: (m) => `${m[2].trim().replace(/^-/, "")}%`,
    rule: "Next to a drawdown label",
    not: /return|month|gain|profit|win|target|risk|growth|recovery|trades?\b|leverage|per\b/i,
  },
  labelNum("trades", ["total trades", "number of trades", "closed trades", "trades taken", "trades"], "Trades", { not: /per\b|a (?:week|month|day)/i, before: /(?:profit|loss|long|short|winning|losing|won|lost|best|worst|open|consecutive)\s*$/i }),
  labelNum("tradesPerMonth", ["trades per month", "trades a month", "trades/month"], "Trades per month"),
  labelNum("tradesPerMonth", ["trades per week", "trades a week", "trades/week"], "Trades per week", { scale: 52 / 12 }),
  labelNum("profitFactor", ["profit factor", "pf"], "Profit factor"),
  labelNum("sharpe", ["sharpe ratio", "sharpe"], "Sharpe ratio"),
  labelNum("months", ["weeks"], "Weeks", { scale: 7 / 30.44 }),
  labelNum("pips", ["total pips", "pips"], "Pips"),
  {
    field: "startDate",
    re: new RegExp(`${START}(?:${lbl(["started on", "start date", "started", "live since", "running since", "trading since", "track record since", "verified since", "since", "launched", "inception"])})${AFTER}(${DATE})`, "gi"),
    value: (m) => parseDate(m[1]),
    shown: (m) => m[1].trim(),
    rule: "Next to a start date",
  },

  // Sentences.
  {
    field: "winRate",
    re: new RegExp(`(${NUM})\\s?%\\s*(?:win(?:ning)?\\s*rate|win\\s*ratio|winners|wins|winning trades|accuracy|hit rate|success rate|of (?:all |our |its )?trades (?:are |were |close (?:in|at) |closed (?:in|at) )?(?:winners|winning|profitable|in profit|in the green))`, "gi"),
    value: (m) => pctOf(m[1]), shown: (m) => `${m[1].trim()}%`, rule: "A percentage before \"win rate\"",
  },
  {
    field: "winRate",
    re: new RegExp(`(?:win(?:ning)?\\s*rate|win\\s*ratio|accuracy|hit rate|success rate)\\s*(?:of|is|was|at|around|about|over|above|near)?\\s*(${NUM})\\s?%`, "gi"),
    value: (m) => pctOf(m[1]), shown: (m) => `${m[1].trim()}%`, rule: "A percentage after \"win rate\"",
  },
  {
    field: "monthlyReturn",
    re: new RegExp(`\\+?(${NUM})\\s?%\\s*(?:a|per|each|every|/)\\s*month|\\+?(${NUM})\\s?%\\s*monthly|(?:monthly|a month|per month)\\s*(?:return|gain|profit|growth)s?\\s*(?:of|is|:|around|about|averag(?:e|ing))?\\s*\\+?(${NUM})\\s?%`, "gi"),
    value: (m) => pctOf(firstGroup(m)), shown: (m) => `${firstGroup(m).trim()}%`, rule: "A return a month in a sentence",
    not: /risk|target|aim/i,
  },
  {
    field: "yearlyReturn",
    re: new RegExp(`\\+?(${NUM})\\s?%\\s*(?:a|per|each|every|/)\\s*year|\\+?(${NUM})\\s?%\\s*(?:annual(?:ly|ized|ised)?|yearly|cagr)\\b`, "gi"),
    value: (m) => pctOf(firstGroup(m)), shown: (m) => `${firstGroup(m).trim()}%`, rule: "A return a year in a sentence",
    not: /forecast|risk|target/i,
  },
  {
    // "+340% in 12 months", "174% gain since January", "total return of 340%", "returned 92% this year"
    field: "totalReturn",
    re: new RegExp([
      `(?:total|overall|net|cumulative|all[- ]time)\\s+(?:gain|return|growth|profit|roi)\\s*(?:of|is|was|:)?\\s*\\+?(${NUM})\\s?%`,
      `\\+?(${NUM})\\s?%\\s*(?:total\\s+|overall\\s+|net\\s+)?(?:gain|return|growth|profit|roi)\\s+(?:in|over|since|from|this|last|so far|to date)\\b`,
      `(?:returned|gained|grew|made|is up|was up)\\s+\\+?(${NUM})\\s?%\\s+(?:in|over|since|this|last|so far|to date)\\b`,
      `\\+(${NUM})\\s?%\\s+(?:in|over)\\s+(?:the\\s+)?(?:last\\s+|past\\s+)?\\d+\\s*(?:months?|years?|weeks?)`,
      `(?:now|balance|account)[^%\\n]{0,40}\\(\\s*\\+(${NUM})\\s?%\\s*\\)`,
    ].join("|"), "gi"),
    value: (m) => pctOf(firstGroup(m)),
    shown: (m) => `${firstGroup(m).trim()}%`,
    rule: "A total return in a sentence",
    not: /monthly|a month|per month|per trade|take|target|risk|forecast|sells? at|exits? at|closes? at|win rate/i,
  },
  {
    field: "maxDrawdown",
    re: new RegExp(`(${NUM})\\s?%\\s*(?:max(?:imum)?\\s*)?(?:draw\\s?-?down|dd)\\b`, "gi"),
    value: (m) => { const v = pctOf(m[1]); return v == null ? null : Math.abs(v); }, shown: (m) => `${m[1].trim().replace(/^-/, "")}%`, rule: "A percentage before \"drawdown\"",
  },
  {
    field: "trades",
    re: new RegExp(`(?:over|across|from|in|after|more than|than)\\s+(${NUM})\\s+(?:closed\\s+|real\\s+|live\\s+|total\\s+)?trades\\b|(${NUM})\\s+(?:closed\\s+|total\\s+|live\\s+|real\\s+)?trades\\s+(?:total|in total|so far|taken|closed|tested|and counting)\\b|(?:closed|completed|its|their|our)\\s+(${NUM})(?:st|nd|rd|th)\\s+trade\\b`, "gi"),
    value: (m) => parseNumber(firstGroup(m)), shown: (m) => firstGroup(m).trim(), rule: "A number of trades in a sentence",
  },
  {
    field: "tradesPerMonth",
    re: new RegExp(`(${NUM})\\s*trades?\\s*(?:a|per|each|every|/)\\s*(month|week|day)`, "gi"),
    value: (m) => { const v = parseNumber(m[1]); const u = m[2].toLowerCase(); return v == null ? null : v * (u === "week" ? 52 / 12 : u === "day" ? 21 : 1); },
    shown: (m) => `${m[1].trim()} a ${m[2].toLowerCase()}`, rule: "Trades a month, week or day",
  },
  {
    field: "months",
    re: new RegExp(`(?:for|over|in|past|last|after)\\s+(?:the\\s+)?(?:past\\s+|last\\s+)?(${NUM})\\s*(months?|years?)\\b`, "gi"),
    value: (m) => { const v = parseNumber(m[1]); return v == null || v <= 0 ? null : m[2].toLowerCase().startsWith("year") ? v * 12 : v; },
    shown: (m) => `${m[1].trim()} ${m[2].toLowerCase()}`, rule: "A length of time",
  },
  {
    field: "profitFactor",
    re: new RegExp(`(?:profit\\s*factor|\\bpf)\\s*(?:of|is|was|:|=)?\\s*(${NUM})(?!\\s?%)`, "gi"),
    value: (m) => parseNumber(m[1]), shown: (m) => m[1].trim(), rule: "A profit factor in a sentence",
  },
  {
    field: "startDate",
    re: new RegExp(`(?:live|running|trading|launched|started|verified|record)\\s+(?:since|in|on)\\s+(${DATE})`, "gi"),
    value: (m) => parseDate(m[1]), shown: (m) => m[1].trim(), rule: "A start date in a sentence",
  },
  {
    field: "maxLoss",
    re: new RegExp(`(?:max(?:imum)?|largest|biggest|worst)\\s*(?:single\\s*)?(?:trade\\s*)?loss\\s*(?:of|is|was|:)?\\s*(${NUM})\\s?%`, "gi"),
    value: (m) => { const v = pctOf(m[1]); return v == null ? null : Math.abs(v); }, shown: (m) => `${m[1].trim()}%`, rule: "A largest single loss",
  },
  {
    field: "avgLoss",
    re: new RegExp(`average\\s*loss\\s*(?:of|is|:)?\\s*(${NUM})\\s?%`, "gi"),
    value: (m) => { const v = pctOf(m[1]); return v == null ? null : Math.abs(v); }, shown: (m) => `${m[1].trim()}%`, rule: "An average loss",
  },
  {
    field: "takeProfit",
    re: new RegExp(`(?:sells?|exits?|closes?|takes?\\s*profit|take-profit|\\btp|target)\\s*(?:at|of|on|:|after|when up)?\\s*(?:a\\s*)?\\+?(${NUM})\\s?%|(${NUM})\\s?%\\s*(?:take[- ]?profit|\\btp\\b|profit target)`, "gi"),
    value: (m) => pctOf(firstGroup(m)), shown: (m) => `${firstGroup(m).trim()}%`, rule: "A take-profit",
    not: /month|year|drawdown/i,
  },
  {
    field: "stopLoss",
    re: new RegExp(`(?:stop[- ]?loss|\\bstop|\\bsl)\\s*(?:at|of|is|:)?\\s*-?(${NUM})\\s?%|(${NUM})\\s?%\\s*(?:stop[- ]?loss|\\bstop\\b|\\bsl\\b)`, "gi"),
    value: (m) => { const v = pctOf(firstGroup(m)); return v == null ? null : Math.abs(v); }, shown: (m) => `${firstGroup(m).trim()}%`, rule: "A stop-loss",
  },
  { field: "noStop", re: /\bno\s*stop[- ]?loss|\bno\s*stops?\b|without\s*(?:a\s*)?stop|never\s*uses?\s*(?:a\s*)?stop/gi, value: () => true, shown: (m) => m[0], rule: "Says there is no stop" },
  {
    field: "leverage",
    re: new RegExp(`(${NUM})\\s*x\\s*leverage|leverage\\s*(?:of|is|:|up to)?\\s*1\\s*:\\s*(${NUM})|1\\s*:\\s*(${NUM})\\s*leverage`, "gi"),
    value: (m) => parseNumber(firstGroup(m)), shown: (m) => m[0].trim(), rule: "Leverage",
  },
  { field: "grid", re: /\bgrid\b/gi, value: () => true, shown: (m) => m[0], rule: "Mentions a grid" },
  {
    field: "martingale",
    re: /martingale|doubles?\s*(?:the\s*)?(?:size|lots?|position|down|stake)|averag(?:es|ing)\s*down|adds?\s*to\s*(?:losing|losers|a loser)|recovery\s*(?:trades?|mode)/gi,
    value: () => true, shown: (m) => m[0], rule: "Says it adds to losing positions",
  },
  {
    field: "pips",
    re: new RegExp(`(${NUM})\\s*pips\\b`, "gi"),
    value: (m) => parseNumber(m[1]), shown: (m) => `${m[1].trim()} pips`, rule: "A number of pips",
    before: /(?:spreads?|from|commission|slippage|stop|sl|tp|target|average|avg\.?|gross|expectancy|expected)[^\n]{0,32}$/i,
  },
  { field: "maxLossCapped", re: /max(?:imum)?\s*loss\s*(?:is\s*)?(?:capped|limit)|loss\s*(?:is\s*)?capped|hard\s*stop|equity\s*stop|daily\s*loss\s*limit/gi, value: () => true, shown: (m) => m[0], rule: "States a loss limit" },
];

/** "No martingale, no grid", "not a grid bot": a negation just before a flag turns it off. */
function negated(text: string, at: number): boolean {
  return /\b(?:no|not|never|without|zero|nor)\s+(?:a\s+|an\s+|any\s+|use\s+|uses\s+|using\s+)?(?:[a-z-]+\s*(?:,|or|and)\s*(?:no\s+)?)?$/i.test(text.slice(Math.max(0, at - 32), at));
}

function quoteAround(text: string, at: number, length: number): string {
  const lineStart = text.lastIndexOf("\n", at - 1) + 1;
  const last = at + length;
  const endNl = text.indexOf("\n", last);
  const lineEnd = endNl < 0 ? text.length : endNl;
  let a = Math.max(lineStart, at - 70);
  let b = Math.min(lineEnd, last + 70);
  if (a > lineStart) { const sp = text.indexOf(" ", a); a = sp >= 0 && sp < at ? sp + 1 : a; }
  if (b < lineEnd) { const sp = text.lastIndexOf(" ", b); if (sp > last) b = sp; }
  return `${a > lineStart ? "..." : ""}${text.slice(a, b).replace(/\s*\n\s*/g, " ").trim()}${b < lineEnd ? "..." : ""}`;
}

/** How a claim was read, in words. For a label, the label as the page writes it: 'Next to "Profit Trades"'. */
function ruleText(p: Pattern, m: Match): string {
  if (!p.rule.startsWith("Next to")) return p.rule;
  const g = m.slice(1).find((x) => x != null && x.trim()) ?? "";
  const head = g ? m[0].slice(0, Math.max(0, m[0].indexOf(g))) : m[0];
  const label = head.split(/[:=\n(]/)[0].replace(/\s+/g, " ").trim();
  return label ? `Next to "${label}"` : p.rule;
}

/** Sentence patterns stay on one line, so a number is never joined to the next block's words. */
const ONE_LINE = new Map<Pattern, RegExp>();
function regexOf(p: Pattern): RegExp {
  if (p.rule.startsWith("Next to")) return p.re;
  let re = ONE_LINE.get(p);
  if (!re) { re = new RegExp(p.re.source.replace(/\\s/g, "[ \\t]"), p.re.flags); ONE_LINE.set(p, re); }
  return re;
}

/** Every claim the fixed patterns find, in the order they appear. */
export function extractClaims(raw: string): FoundClaim[] {
  const text = /[\r −  ]/.test(raw) ? plainText(raw) : raw;
  const out: FoundClaim[] = [];
  const taken: { field: ClaimField; a: number; b: number }[] = [];
  for (const p of PATTERNS) {
    for (const m of text.matchAll(regexOf(p))) {
      const a = m.index ?? 0, b = a + m[0].length;
      if (!m[0].length || p.not?.test(m[0])) continue;
      if (p.before?.test(text.slice(Math.max(0, a - 40), a))) continue;
      // The same words read twice for one field (a label and a sentence): keep the first.
      if (taken.some((t) => t.field === p.field && a < t.b && b > t.a)) continue;
      // A drawdown inside a win rate's or a return's words: the earlier pattern wins.
      if (p.field === "maxDrawdown" && taken.some((t) => (t.field === "winRate" || t.field === "totalReturn") && a < t.b && b > t.a)) continue;
      const value = p.value(m);
      if (value == null || (typeof value === "number" && !Number.isFinite(value))) continue;
      if (value === true && negated(text, a)) continue;
      if (!plausible(p.field, value)) continue;
      taken.push({ field: p.field, a, b });
      out.push({ field: p.field, value, shown: p.shown(m), quote: quoteAround(text, a, m[0].length), at: a, length: m[0].length, how: "pattern", rule: ruleText(p, m) });
    }
  }
  return out.sort((x, y) => x.at - y.at || x.field.localeCompare(y.field));
}

/** Values no record can have are a misread, not a claim. */
function plausible(field: ClaimField, v: number | string | boolean): boolean {
  if (typeof v !== "number") return true;
  switch (field) {
    case "winRate": case "maxDrawdown": case "maxLoss": return v >= 0 && v <= 1;
    case "trades": return v >= 1 && v <= 10_000_000 && Number.isInteger(v);
    case "profitFactor": return v >= 0 && v < 1000;
    case "months": return v > 0 && v <= 1200;
    case "totalReturn": return v > -1 && v < 100_000;
    case "monthlyReturn": return v > -1 && v < 100;
    case "yearlyReturn": return v > -1 && v < 10_000;
    default: return true;
  }
}

/** Fields compared with an attached record, in the order the page lists them. */
export const COMPARED: ClaimField[] = ["totalReturn", "monthlyReturn", "yearlyReturn", "winRate", "maxDrawdown", "trades", "profitFactor", "startDate", "months"];

/**
 * The claim the checks use: one value per field. A label on a statistics page wins over a
 * sentence, then the first on the page; for the largest fall, the largest one stated, the
 * reading kindest to the seller, so a mismatch is never down to which number we picked.
 */
export function chosen(found: readonly FoundClaim[]): Map<ClaimField, FoundClaim> {
  const out = new Map<ClaimField, FoundClaim>();
  const rank = (f: FoundClaim) => (f.how === "pattern" ? (f.rule.startsWith("Next to") ? 0 : 1) : 2);
  for (const f of found) {
    const cur = out.get(f.field);
    if (!cur) { out.set(f.field, f); continue; }
    if (f.field === "maxDrawdown" && typeof f.value === "number" && typeof cur.value === "number") {
      if (f.value > cur.value) out.set(f.field, f);
      continue;
    }
    if (rank(f) < rank(cur)) out.set(f.field, f);
  }
  return out;
}

/** The found claims as the Claim the checks take. */
export function claimFrom(found: readonly FoundClaim[]): Claim {
  const pick = chosen(found);
  const num = (f: ClaimField) => { const v = pick.get(f)?.value; return typeof v === "number" ? v : undefined; };
  const c: Claim = {
    totalReturn: num("totalReturn"), monthlyReturn: num("monthlyReturn"), yearlyReturn: num("yearlyReturn"), winRate: num("winRate"),
    maxDrawdown: num("maxDrawdown"), trades: num("trades"), tradesPerMonth: num("tradesPerMonth"), months: num("months"),
    profitFactor: num("profitFactor"), maxLoss: num("maxLoss"), avgLoss: num("avgLoss"), takeProfit: num("takeProfit"), leverage: num("leverage"),
  };
  const start = pick.get("startDate")?.value;
  if (typeof start === "string") c.startDate = start;
  if (!pick.has("noStop")) c.stopLoss = num("stopLoss");
  if (pick.has("grid")) c.grid = true;
  if (pick.has("martingale")) c.martingale = true;
  if (pick.has("maxLossCapped")) c.maxLossCapped = true;
  for (const k of Object.keys(c) as (keyof Claim)[]) if (c[k] === undefined) delete c[k];
  return c;
}

/** A link that opens the seller's page at the words a claim came from (a text fragment). */
export function textFragmentUrl(url: string, f: Pick<FoundClaim, "quote" | "shown">): string {
  const words = f.quote.replace(/^\.\.\.|\.\.\.$/g, "").trim();
  const i = words.indexOf(f.shown);
  // The value with a few words before it: short enough to match, long enough to be unique.
  const start = i < 0 ? words.slice(0, 60) : words.slice(Math.max(0, words.lastIndexOf(" ", Math.max(0, i - 24)) + 1), i + f.shown.length);
  const enc = (s: string) => encodeURIComponent(s.trim()).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
  return `${url.split("#")[0]}#:~:text=${enc(start)}`;
}
