// Strategy signals on a chart (DEC-0052). The factory recipes that trade one price series
// on its own (engine/src/parity/strategies/factory.py: TrendBook, BreakoutBook and
// OscillatorBook) are ported here rule for rule, so the chart can show where each would
// have bought, sold or stepped aside on the symbol you are looking at.
//
// No look-ahead: the side at bar i uses closes up to and including bar i only, and is
// only drawn for finished bars. The engine's portfolio parts (sizing by volatility,
// monthly rebalancing, costs) are not applied: this shows when each rule fires, not what
// it would have earned. Strategies that rank many assets or need macro data (the edge
// recipes in edges.py) cannot be applied to one chart and are listed as such.
//
// tests/signals.test.ts checks every rule against the engine's own output on the same
// prices (tests/fixtures/signals.json, written by scripts/signals_fixture.py).

export type Side = -1 | 0 | 1;
export type RuleKind = "trend" | "breakout" | "macd" | "bollinger" | "ichimoku";

export interface Rule {
  /** The engine's strategy key, which the research report and its 11 tests use. */
  id: string;
  name: string;
  short: string;
  kind: RuleKind;
  params: Record<string, number>;
  longOnly: boolean;
  /** The market the strategy was tested on in research. */
  tested: "fx" | "stocks" | "commodities";
}

export const RULES: Rule[] = [
  { id: "fx_trend_3m", name: "Currency trend, 3-month", short: "T3m", kind: "trend", params: { lookback: 63 }, longOnly: false, tested: "fx" },
  { id: "fx_trend_1m", name: "Currency trend, 1-month", short: "T1m", kind: "trend", params: { lookback: 21 }, longOnly: false, tested: "fx" },
  { id: "fx_wide_trend", name: "Wide currency trend", short: "T1y", kind: "trend", params: { lookback: 252 }, longOnly: false, tested: "fx" },
  { id: "industry_trend", name: "Industries, each with a trend filter", short: "Ind", kind: "trend", params: { lookback: 252 }, longOnly: true, tested: "stocks" },
  { id: "oil_trend", name: "Oil trend", short: "Oil", kind: "trend", params: { lookback: 126 }, longOnly: true, tested: "commodities" },
  { id: "fx_donchian", name: "Currency breakout (Turtle)", short: "DC", kind: "breakout", params: { entry: 55, exit: 20 }, longOnly: false, tested: "fx" },
  { id: "stocks_donchian", name: "Stock breakout (Turtle)", short: "DC+", kind: "breakout", params: { entry: 55, exit: 20 }, longOnly: true, tested: "stocks" },
  { id: "fx_macd", name: "Currency MACD", short: "MACD", kind: "macd", params: {}, longOnly: false, tested: "fx" },
  { id: "stocks_macd", name: "Stock MACD", short: "MACD+", kind: "macd", params: {}, longOnly: true, tested: "stocks" },
  { id: "fx_ichimoku", name: "Currency Ichimoku cloud", short: "Ichi", kind: "ichimoku", params: {}, longOnly: false, tested: "fx" },
  { id: "fx_bollinger_fade", name: "Currency Bollinger fade", short: "BB", kind: "bollinger", params: { window: 20, band: 2 }, longOnly: false, tested: "fx" },
];

export const ruleById = (id: string) => RULES.find((r) => r.id === id);

const nan = Number.NaN;

function ewm(x: number[], span: number): number[] {
  const a = 2 / (span + 1);
  const out = new Array<number>(x.length);
  let prev = nan;
  for (let i = 0; i < x.length; i++) {
    prev = Number.isNaN(prev) ? x[i] : a * x[i] + (1 - a) * prev;
    out[i] = prev;
  }
  return out;
}

function macdLine(c: number[]): number[] {
  const fast = ewm(c, 12), slow = ewm(c, 26);
  return fast.map((v, i) => v - slow[i]);
}

function rolling(x: number[], w: number, f: (s: number[]) => number): number[] {
  return x.map((_, i) => (i + 1 < w ? nan : f(x.slice(i + 1 - w, i + 1))));
}
const max = (s: number[]) => Math.max(...s);
const min = (s: number[]) => Math.min(...s);
const mean = (s: number[]) => s.reduce((a, b) => a + b, 0) / s.length;
/** Sample standard deviation (n - 1), as pandas computes it. */
const std = (s: number[]) => { const m = mean(s); return Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / (s.length - 1)); };
const shift = (x: number[], k: number) => x.map((_, i) => (i - k >= 0 ? x[i - k] : nan));
const sign = (v: number): Side | null => (Number.isNaN(v) ? null : v > 0 ? 1 : v < 0 ? -1 : 0);

/** The side each bar's close gives, before the long-only rule. Exported for tests. */
export function rawSides(rule: Rule, c: number[]): Side[] {
  const p = rule.params;
  if (rule.kind === "trend") {
    return c.map((v, i) => (i >= p.lookback ? sign(v / c[i - p.lookback] - 1) ?? 0 : 0));
  }
  if (rule.kind === "macd") {
    const m = macdLine(c), s = ewm(m, 9);
    return m.map((v, i) => sign(v - s[i]) ?? 0);
  }
  if (rule.kind === "bollinger") {
    const mu = rolling(c, p.window, mean), sd = rolling(c, p.window, std);
    const z = c.map((v, i) => (v - mu[i]) / sd[i]);
    const out: Side[] = [];
    let state: Side = 0, started = false;
    for (let i = 0; i < c.length; i++) {
      const zi = z[i], zs = sign(zi), zp = i > 0 ? sign(z[i - 1]) : null;
      if (zs != null && Math.abs(zi) > p.band) { state = (-zs) as Side; started = true; }
      else if (zs == null || zp == null || zs !== zp) { state = 0; started = true; }
      out.push(started ? state : 0);
    }
    return out;
  }
  if (rule.kind === "ichimoku") {
    const mid = (w: number) => { const lo = rolling(c, w, min); return rolling(c, w, max).map((v, i) => (v + lo[i]) / 2); };
    const conv = mid(9), base = mid(26);
    const a = shift(conv.map((v, i) => (v + base[i]) / 2), 26), b = shift(mid(52), 26);
    return c.map((v, i) => {
      if (Number.isNaN(a[i]) || Number.isNaN(b[i])) return 0;
      const top = Math.max(a[i], b[i]), bottom = Math.min(a[i], b[i]);
      return v > top ? 1 : v < bottom ? -1 : 0;
    });
  }
  // breakout: the Turtle state machine against yesterday's channels.
  const hiE = shift(rolling(c, p.entry, max), 1), loE = shift(rolling(c, p.entry, min), 1);
  const hiX = shift(rolling(c, p.exit, max), 1), loX = shift(rolling(c, p.exit, min), 1);
  const out: Side[] = [];
  let state: Side = 0;
  for (let i = 0; i < c.length; i++) {
    const v = c[i];
    if (state <= 0 && v > hiE[i]) state = 1;
    else if (state >= 0 && v < loE[i]) state = -1;
    else if (state > 0 && v < loX[i]) state = 0;
    else if (state < 0 && v > hiX[i]) state = 0;
    out.push(state);
  }
  return out;
}

/** Sides for a rule, long-only rules stepping to cash instead of going short. */
export function sides(rule: Rule, closes: number[]): Side[] {
  const raw = rawSides(rule, closes);
  return rule.longOnly ? raw.map((s) => (s < 0 ? 0 : s)) : raw;
}

export type Action = "buy" | "sell" | "exit";

export interface Signal {
  id: string;
  rule: Rule;
  index: number;
  time: string;
  action: Action;
  from: Side;
  to: Side;
  close: number;
  /** Why it fired, in plain words, with the numbers at that close. */
  why: string;
}

const f = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(2) : Math.abs(v) >= 1 ? v.toFixed(4) : v.toPrecision(4));

function explain(rule: Rule, c: number[], i: number, to: Side): string {
  const p = rule.params;
  const word = to > 0 ? "long" : to < 0 ? "short" : rule.longOnly ? "in cash" : "flat";
  if (rule.kind === "trend") {
    const r = (c[i] / c[i - p.lookback] - 1) * 100;
    return `The close ${f(c[i])} is ${r >= 0 ? "up" : "down"} ${Math.abs(r).toFixed(2)}% on ${p.lookback} bars ago (${f(c[i - p.lookback])}), so the rule goes ${word}.`;
  }
  if (rule.kind === "macd") {
    const m = macdLine(c.slice(0, i + 1)), s = ewm(m, 9);
    return `MACD (12, 26) is ${f(m[i])} and its 9-bar signal line ${f(s[i])}. MACD ${m[i] > s[i] ? "crossed above" : m[i] < s[i] ? "crossed below" : "met"} the signal, so the rule goes ${word}.`;
  }
  if (rule.kind === "bollinger") {
    const w = c.slice(i + 1 - p.window, i + 1), z = (c[i] - mean(w)) / std(w);
    return to === 0
      ? `Price crossed back over its ${p.window}-bar average (z ${z.toFixed(2)}), so the fade is closed.`
      : `Price is ${Math.abs(z).toFixed(2)} standard deviations ${z > 0 ? "above" : "below"} its ${p.window}-bar average, past the ${p.band} band, so the rule bets on a move back: ${word}.`;
  }
  if (rule.kind === "ichimoku") {
    return to > 0 ? "The close is above the Ichimoku cloud, so the rule goes long." : to < 0 ? `The close is below the cloud, so the rule goes ${word}.` : "The close is inside the cloud, so the rule is flat.";
  }
  const hiE = max(c.slice(Math.max(0, i - p.entry), i)), loE = min(c.slice(Math.max(0, i - p.entry), i));
  const hiX = max(c.slice(Math.max(0, i - p.exit), i)), loX = min(c.slice(Math.max(0, i - p.exit), i));
  if (to > 0) return `The close ${f(c[i])} broke the ${p.entry}-bar high ${f(hiE)}, so the rule goes long.`;
  if (to < 0) return `The close ${f(c[i])} broke the ${p.entry}-bar low ${f(loE)}, so the rule goes short.`;
  return `The close ${f(c[i])} crossed the ${p.exit}-bar ${rule.longOnly || c[i] < hiX ? `low ${f(loX)}` : `high ${f(hiX)}`}, so the rule steps aside.`;
}

/**
 * Every change of side over `bars` (oldest first), using the first `closed` bars only.
 * Only bars that are finished may be passed as closed; the forming bar is never used.
 */
export function signals(rule: Rule, bars: { time: string; close: number }[], closed = bars.length): Signal[] {
  const c = bars.slice(0, closed).map((b) => b.close);
  const s = sides(rule, c);
  const out: Signal[] = [];
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) continue;
    const action: Action = s[i] > 0 ? "buy" : s[i] < 0 ? "sell" : "exit";
    out.push({ id: `${rule.id}@${bars[i].time}`, rule, index: i, time: bars[i].time, action, from: s[i - 1], to: s[i], close: c[i], why: explain(rule, c, i, s[i]) });
  }
  return out;
}

/** Bars a rule needs before it can say anything. */
export function warmup(rule: Rule): number {
  const p = rule.params;
  return rule.kind === "trend" ? p.lookback + 1 : rule.kind === "breakout" ? p.entry + 1 : rule.kind === "ichimoku" ? 78 : rule.kind === "bollinger" ? p.window : 35;
}
