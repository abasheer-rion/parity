// Input B: a bot described in plain words (REF-0016). A small rule-based extractor pulls
// out the claim (win rate, return, drawdown, trades, holding time, leverage, martingale
// or grid), counts the adjustable settings in the rules, and finds the closest strategies
// we have already tested. An LLM extractor can sit behind the same interface later.
import type { Claim } from "./types";

export interface Extracted {
  claim: Claim;
  /** Adjustable numbers in the rules themselves (not the claimed results). */
  settings: number;
  /** Trades the settings check compares against, when the text gives enough to tell. */
  trades: number | null;
  asset: "crypto" | "fx" | "stocks" | "commodities" | null;
  family: "value" | "trend" | "carry" | "calendar" | "volatility" | null;
  keywords: string[];
  /** What was found, in words, for the page to show. */
  found: string[];
}

const N = String.raw`(\d+(?:[.,]\d+)?)`;
const toNum = (s: string) => Number(s.replace(",", "."));

function first(text: string, patterns: RegExp[]): { value: number; match: string } | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const g = m.slice(1).find((x) => x != null);
      if (g != null) return { value: toNum(g), match: m[0] };
    }
  }
  return null;
}

export function extract(raw: string): Extracted {
  const text = raw.replace(/\s+/g, " ").trim();
  const t = text.toLowerCase();
  const claim: Claim = {};
  const found: string[] = [];
  const used: string[] = [];
  const take = (r: { value: number; match: string } | null) => { if (r) used.push(r.match); return r; };

  const wr = take(first(t, [
    new RegExp(`${N}\\s*%\\s*(?:win(?:ning)?\\s*rate|win\\s*ratio|winners|wins|winning trades|accuracy|hit rate)`),
    new RegExp(`(?:win(?:ning)?\\s*rate|win\\s*ratio|accuracy|hit rate|wins)\\s*(?:of|is|:|=|around|about|over)?\\s*${N}\\s*%`),
  ]));
  if (wr) { claim.winRate = wr.value / 100; found.push(`win rate ${wr.value}%`); }

  const mr = take(first(t, [
    new RegExp(`${N}\\s*%\\s*(?:a|per|each|every|/)\\s*month`),
    new RegExp(`${N}\\s*%\\s*monthly`),
    new RegExp(`monthly\\s*(?:return|gain|profit)s?\\s*(?:of|is|:|around|about)?\\s*${N}\\s*%`),
  ]));
  if (mr) { claim.monthlyReturn = mr.value / 100; found.push(`${mr.value}% a month`); }

  const dd = take(first(t, [
    new RegExp(`(?:max(?:imum)?\\s*)?draw\\s?down\\s*(?:of|is|:|under|below|never above|never over|at most|<)?\\s*${N}\\s*%`),
    new RegExp(`${N}\\s*%\\s*(?:max(?:imum)?\\s*)?draw\\s?down`),
  ]));
  if (dd) { claim.maxDrawdown = dd.value / 100; found.push(`largest fall ${dd.value}%`); }

  const ml = take(first(t, [
    new RegExp(`(?:max(?:imum)?|largest|biggest|worst)\\s*(?:single\\s*)?(?:trade\\s*)?loss\\s*(?:of|is|:|was)?\\s*${N}\\s*%`),
    new RegExp(`(?:loses?|lost)\\s*${N}\\s*%\\s*(?:on|in)\\s*(?:one|a single)\\s*trade`),
  ]));
  if (ml) { claim.maxLoss = ml.value / 100; found.push(`largest single loss ${ml.value}%`); }

  const al = take(first(t, [new RegExp(`average\\s*loss\\s*(?:of|is|:)?\\s*${N}\\s*%`)]));
  if (al) { claim.avgLoss = al.value / 100; found.push(`average loss ${al.value}%`); }

  // Take-profit and stop-loss are settings of the rules, so they stay in the settings count.
  const tp = (first(t, [
    new RegExp(`(?:sells?|exits?|closes?|takes? profit|take-profit|tp|target)\\s*(?:at|of|on|:|after|when up)?\\s*(?:a\\s*)?\\+?${N}\\s*%\\s*(?:profit|gain|up|target)?`),
    new RegExp(`${N}\\s*%\\s*(?:take[- ]?profit|tp|profit target|target)`),
  ]));
  if (tp) { claim.takeProfit = tp.value / 100; found.push(`take-profit ${tp.value}%`); }

  const noStop = /\bno\s*stop|without\s*(?:a\s*)?stop|never\s*uses?\s*(?:a\s*)?stop/.test(t);
  const sl = noStop ? null : (first(t, [
    new RegExp(`(?:stop[- ]?loss|stop|sl)\\s*(?:at|of|is|:)?\\s*-?${N}\\s*%`),
    new RegExp(`${N}\\s*%\\s*(?:stop[- ]?loss|stop|sl)\\b`),
  ]));
  if (sl) { claim.stopLoss = sl.value / 100; found.push(`stop-loss ${sl.value}%`); }
  if (noStop) found.push("no stop-loss");

  const perMonth = take(first(t, [new RegExp(`${N}\\s*trades?\\s*(?:a|per|each|every|/)\\s*month`)]));
  const perWeek = perMonth ? null : take(first(t, [new RegExp(`${N}\\s*trades?\\s*(?:a|per|each|every|/)\\s*week`)]));
  const perDay = perMonth || perWeek ? null : take(first(t, [new RegExp(`${N}\\s*trades?\\s*(?:a|per|each|every|/)\\s*day`)]));
  if (perMonth) claim.tradesPerMonth = perMonth.value;
  else if (perWeek) claim.tradesPerMonth = perWeek.value * 4.33;
  else if (perDay) claim.tradesPerMonth = perDay.value * 21;
  if (claim.tradesPerMonth != null) found.push(`${Math.round(claim.tradesPerMonth)} trades a month`);

  const total = take(first(t, [new RegExp(`(?:over|across|from|in)\\s*${N.replace("[.,]", "[,]")}\\s*trades\\b`), new RegExp(`${N}\\s*(?:closed\\s*)?trades\\s*(?:total|in total|so far|tested)`)]));
  if (total) { claim.trades = total.value; found.push(`${total.value} trades in total`); }

  const dur = take(first(t, [new RegExp(`(?:for|over|in|past|last|since)\\s*(?:the\\s*)?(?:past\\s*|last\\s*)?${N}\\s*(months?|years?)`)]));
  if (dur) {
    const unit = (t.slice(t.indexOf(dur.match)).match(/months?|years?/) ?? ["months"])[0];
    claim.months = unit.startsWith("year") ? dur.value * 12 : dur.value;
    found.push(`${claim.months} months`);
  }

  const lev = take(first(t, [new RegExp(`${N}\\s*x\\s*leverage`), new RegExp(`leverage\\s*(?:of|is|:|up to)?\\s*(?:1\\s*:\\s*)?${N}`), new RegExp(`1\\s*:\\s*${N}\\s*leverage`)]));
  if (lev) { claim.leverage = lev.value; found.push(`leverage ${lev.value}x`); }

  const hold = t.match(/holds?\s*(?:trades?\s*)?(?:for\s*)?(?:about\s*)?(\d+\s*(?:minutes?|mins?|hours?|days?|weeks?))/);
  if (hold) { claim.holding = hold[1]; used.push(hold[0]); found.push(`holds ${hold[1]}`); }

  claim.grid = /\bgrid\b/.test(t) || undefined;
  claim.martingale = /martingale|doubles?\s*(?:the\s*)?(?:size|lots?|position|down|stake)|averag(?:es|ing)\s*down|adds?\s*to\s*(?:losing|losers|a loser)|recovery\s*(?:trades?|mode)/.test(t) || undefined;
  claim.maxLossCapped = /(?:max(?:imum)?\s*loss|loss\s*(?:is\s*)?capped|hard\s*stop|equity\s*stop|daily\s*loss\s*limit)/.test(t) || undefined;
  if (claim.grid) found.push("grid");
  if (claim.martingale) found.push("adds to losers (martingale)");

  // Settings: numbers left in the rules once the claimed results are taken out.
  let rules = t;
  for (const u of used) rules = rules.replace(u, " ");
  rules = rules.replace(/\b(19|20)\d{2}\b/g, " ");
  const settings = new Set((rules.match(/\d+(?:[.,]\d+)?/g) ?? []).map(toNum)).size;

  const asset = /\b(bitcoin|btc|crypto|ethereum|eth|solana|altcoins?|coins?|usdt)\b/.test(t) ? "crypto"
    : /\b(forex|fx|currenc(?:y|ies)|eur\s*\/?\s*usd|gbp|jpy|usd\s*\/?\s*jpy|cable|pairs?)\b/.test(t) ? "fx"
    : /\b(gold|xau|oil|silver|commodit(?:y|ies)|natural gas|wti|brent)\b/.test(t) ? "commodities"
    : /\b(stocks?|shares|equit(?:y|ies)|s&p|spx|spy|nasdaq|qqq|dow|index|indices)\b/.test(t) ? "stocks" : null;
  const family = /\b(rsi|oversold|overbought|bollinger|mean[- ]revert|reversion|dip|pullback|bounce|support)\b/.test(t) ? "value"
    : /\b(moving average|crossover|cross|trend|breakout|momentum|macd|ema|sma|golden)\b/.test(t) ? "trend"
    : /\bcarry|interest rate|swap\b/.test(t) ? "carry"
    : /\b(season|calendar|month[- ]end|turn of the month|weekday|monday|friday|sell in may)\b/.test(t) ? "calendar"
    : /\b(volatility|vix|calm)\b/.test(t) ? "volatility" : null;
  const keywords = (t.match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP.has(w));

  const months = claim.months ?? null;
  const trades = claim.trades ?? (claim.tradesPerMonth != null ? Math.round(claim.tradesPerMonth * (months ?? 1)) : null);
  return { claim, settings, trades, asset, family, keywords: [...new Set(keywords)], found };
}

const STOP = new Set(["the", "and", "when", "with", "for", "buys", "buy", "sells", "sell", "trades", "trade", "claims", "claim", "month", "months", "rate",
  "win", "profit", "goes", "under", "over", "that", "this", "bot", "its", "per", "each", "every", "has", "have", "from", "into", "then", "than", "about", "around"]);

// ---------------------------------------------------------------- the closest tested strategies

export interface Candidate {
  id: string;
  name: string;
  line: string;
  family: string;
  asset: string;
  style: string;
  /** "report": a named strategy with a gauntlet; "search": a search variation. */
  from: "report" | "search";
  verdict: string;
  /** Luck check score (deflated Sharpe) where known. */
  deflated: number | null;
  sharpe: number | null;
}

export interface Match { c: Candidate; score: number; why: string[] }

const ASSET_WORD: Record<string, string> = { fx: "currencies", stocks: "stocks", commodities: "commodities", crypto: "crypto", mixed: "mixed assets" };

/** The closest three strategies by asset, kind of rule and shared words. */
export function closest(x: Extracted, candidates: readonly Candidate[], n = 3): Match[] {
  const scored = candidates.map((c) => {
    let score = 0;
    const why: string[] = [];
    if (x.family && c.family === x.family) { score += 3; why.push(`same kind of rule (${c.family === "value" ? "buying dips" : c.family})`); }
    if (x.asset && c.asset === x.asset) { score += 3; why.push(`same market (${ASSET_WORD[c.asset] ?? c.asset})`); }
    else if (x.asset && c.asset === "mixed") score += 0.5;
    const hay = `${c.name} ${c.line} ${c.style}`.toLowerCase();
    const shared = x.keywords.filter((k) => hay.includes(k)).slice(0, 3);
    if (shared.length) { score += shared.length; why.push(`shares the words ${shared.join(", ")}`); }
    if (c.from === "report") score += 0.25; // a named strategy with a full gauntlet explains itself best
    return { c, score, why };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || (b.c.deflated ?? 0) - (a.c.deflated ?? 0)).slice(0, n);
}

/** A plain verdict for a search variation, from its luck check. */
export function searchVerdict(deflated: number | null): string {
  if (deflated == null) return "Not scored";
  return deflated >= 0.95 ? "Passes the luck check" : deflated >= 0.5 ? "Maybe: below the luck line" : "Could be luck";
}
