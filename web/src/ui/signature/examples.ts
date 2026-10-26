// Example visuals for every signature scene, on made-up data (seeded, so they never
// change). The UI library shows them labelled "Example data", and the tests draw them.
// Real pages build their visuals from engine numbers instead.
import { walk, rng } from "./core.ts";
import type { SigVisual } from "./scenes.ts";

const months = 12 * 20;
const strat = walk(months, 0.0075, 0.035, 7, 100);
const bench = walk(months, 0.006, 0.045, 11, 100);
const labels = Array.from({ length: months }, (_, i) => `${2005 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
const r2 = (v: number) => Math.round(v * 100) / 100;

function corr(seed: number, base: number): number[] {
  const g = rng(seed);
  let x = base;
  return Array.from({ length: months }, () => (x = Math.max(-0.95, Math.min(0.95, x * 0.97 + base * 0.03 + 0.06 * g.normal()))));
}

function samples(seed: number, n: number, mean: number, sd: number): number[] {
  const g = rng(seed);
  return Array.from({ length: n }, () => mean + sd * g.normal());
}

export const EXAMPLES: Record<string, SigVisual> = {
  equity: {
    kind: "equity",
    alt: "Example data. A strategy and the US stock market from 2005 to 2024, each starting at $100.",
    params: { fmt: "money", labels, series: [{ label: "Strategy", values: strat.map(r2) }, { label: "Stocks", values: bench.map(r2), role: "benchmark" }], headline: { label: "Strategy, $100 at the start" } },
    steps: [
      { caption: "Each line starts at $100 in 2005.", to: 0.25 },
      { caption: "2008: the market falls hard. Zoomed in on the fall.", to: 0.27, zoom: [0.1, 0.3], callouts: [{ series: 1, at: 0.2, label: "Market low" }] },
      { caption: "Twenty years later.", to: 1, bands: [{ from: 0.13, to: 0.21, label: "Crisis", tone: "neg" }, { from: 0.75, to: 0.85, label: "Rates up", tone: "warn" }] },
      { caption: "The verdict.", verdict: "Ahead of the market over 20 years, with smaller falls in both crises.", tone: "pos" },
    ],
  },
  split: {
    kind: "split",
    alt: "Example data. Two strategies side by side, from 2005 to 2024.",
    params: { fmt: "money", labels, left: { title: "Before costs", values: strat.map(r2), tone: "accent" }, right: { title: "After costs", values: strat.map((v, i) => r2(v * Math.pow(0.9975, i))), tone: "muted" } },
    steps: [
      { caption: "The same rules, before and after trading costs.", to: 0.4 },
      { caption: "Costs take a little every month.", to: 1 },
      { caption: "Over 20 years the gap is large.", winner: "left", verdict: "Costs took more than a third of the end value.", tone: "warn" },
    ],
  },
  underwater: {
    kind: "underwater",
    alt: "Example data. How far a strategy's account stood below its last high, each month from 2005 to 2024.",
    params: { values: bench.map(r2), labels, fmt: "money" },
    steps: [
      { caption: "The red area is how far the account is below its last high.", to: 0.3 },
      { caption: "The worst fall so far.", to: 0.3, worst: true },
      { caption: "Every fall, over 20 years.", to: 1, worst: true, verdict: "It took more than four years to make back the 2008 fall.", tone: "neg" },
    ],
  },
  distribution: {
    kind: "distribution",
    alt: "Example data. The Sharpe ratios of 2,000 strategies that traded at random, with this strategy's Sharpe ratio marked to the right of almost all of them.",
    params: { samples: samples(3, 2000, 0.05, 0.22).map(r2), bins: 32, fmt: "num2", par: 0, parLabel: "Zero", marker: { value: 0.71, label: "This strategy", tone: "accent" }, band: { lo: -0.38, hi: 0.48, label: "95% of random" }, ends: { low: "Worse", high: "Better" } },
    steps: [
      { caption: "2,000 versions that trade at random, each one bar.", grow: 1 },
      { caption: "95% of random tries land in this range.", band: 1 },
      { caption: "This strategy's Sharpe ratio.", marker: 1 },
      { caption: "Luck rarely gets this far.", verdict: "Beats 99% of random tries.", tone: "pos" },
    ],
  },
  heatmap: {
    kind: "heatmap",
    alt: "Example data. The one-year rolling correlation of a strategy to stocks and to bonds, each month from 2005 to 2024.",
    params: { labels, rows: [{ label: "Stocks", values: corr(5, 0.35).map(r2) }, { label: "Bonds", values: corr(9, -0.1).map(r2) }] },
    steps: [
      { caption: "Each cell is one year of daily returns compared.", to: 0.4 },
      { caption: "Teal: moves with it. Violet: moves against it.", to: 1 },
      { caption: "In 2008 the link to stocks jumped.", highlight: [0.13, 0.22], highlightLabel: "2008" },
      { caption: "The verdict.", verdict: "Mostly unrelated to bonds, loosely tied to stocks.", tone: "accent" },
    ],
  },
  regimes: {
    kind: "regimes",
    alt: "Example data. A strategy's return a year against the market's in seven kinds of market.",
    params: {
      fmt: "pctSigned",
      items: [
        { label: "Rates rising", strategy: 0.06, benchmark: 0.04 }, { label: "Rates falling", strategy: 0.09, benchmark: 0.12 },
        { label: "Calm markets", strategy: 0.08, benchmark: 0.11 }, { label: "Wild markets", strategy: 0.04, benchmark: -0.06 },
        { label: "Crises", strategy: -0.08, benchmark: -0.31 }, { label: "2000s", strategy: 0.07, benchmark: 0.01 }, { label: "2010s", strategy: 0.08, benchmark: 0.13 },
      ],
    },
    steps: [
      { caption: "Rising and falling rates.", reveal: 2 },
      { caption: "Calm and wild markets.", reveal: 4 },
      { caption: "Crises and decades.", reveal: 7 },
      { caption: "Where it wins: when markets fall.", highlight: 4, verdict: "Wins when markets fall, lags in calm rallies.", tone: "accent" },
    ],
  },
  scorecard: {
    kind: "scorecard",
    alt: "Example data. A strategy's Sharpe ratio, its deflated chance of being more than luck, its worst fall and its 95% range for return a year.",
    params: {
      stats: [
        { label: "Sharpe ratio", value: 0.71, fmt: "num2" }, { label: "Chance it is more than luck", value: 0.93, fmt: "pct", tone: "warn", note: "After 160 tries" },
        { label: "Worst fall", value: -0.24, fmt: "pct", tone: "neg" }, { label: "Return a year, 95% range", text: "2% to 11%", note: "From 1,000 resamples" },
      ],
    },
    steps: [
      { caption: "The headline numbers.", reveal: 2 },
      { caption: "The worst case and the range.", reveal: 4 },
      { caption: "The verdict.", verdict: "Promising, but below the 95% line after counting every try.", tone: "warn" },
    ],
  },
};
