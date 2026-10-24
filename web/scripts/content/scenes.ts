// Shareable clips from the sims (DEC-0035). Each scene is a pure function from a moment
// of the clip (t from 0 to 1) and a canvas size to SVG markup, drawn from the same files
// the site reads: Bot Battle's replays, the strategy results and the world file. The
// renderer (render.ts) turns frames into video with ffmpeg.
//
// Rules every scene follows: every number is labelled hypothetical, backtested or
// simulated, with its period; the risk line is on screen in every frame; no scene says
// what to buy, and none promises anything.
//
// Plain TypeScript with type-only syntax, so Node can run it with type stripping.
import { statsAt, money, type BotRunFile, type BotsIndex } from "../../src/lib/botStats.ts";

export const C = {
  bg: "#0b0d14", panel: "#141824", text: "#f1f3f9", muted: "#a3a8b9", faint: "#6f7486", grid: "#ffffff14",
  blue: "#85a8ff", good: "#4cc98a", bad: "#f07a7a", warn: "#e8c06a", violet: "#c9a2ff", cyan: "#6fd3e0", pink: "#ff8fc7",
};
export const RISK = "Hypothetical, educational, not investment advice.";
export const SITE = "parity.endyland.com";

export interface Layout { w: number; h: number; vertical: boolean }

export interface Data {
  bots?: { index: BotsIndex; run: (id: string) => BotRunFile | null };
  world?: { weekly: { dates: string[]; series: Record<string, (number | null)[]> } };
  report?: { runs: { strategy: string; is_benchmark?: boolean; equity: [string, number][] }[] };
}

export interface Scene {
  id: string;
  /** The line on screen, and the title of the clip. */
  hook: string;
  /** What the data is and its period, always on screen. */
  period: string;
  seconds: number;
  /** Burned-in captions: from this share of the clip on, show this text. */
  captions: [number, string][];
  social: { caption: string; hashtags: string[] };
  /** The big line on the end card. */
  end: string;
  /** The chart area for moment t (0 to 1 of the clip, before the end card). */
  body: (t: number, box: Box) => string;
}

export interface Box { x: number; y: number; w: number; h: number; scale: number }

// ------------------------------------------------------------------ drawing helpers

const r1 = (v: number) => Math.round(v * 10) / 10;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ease = (v: number) => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);

export function text(x: number, y: number, t: string, o: { size?: number; fill?: string; anchor?: string; weight?: number; opacity?: number; family?: string } = {}): string {
  const op = o.opacity != null && o.opacity < 1 ? ` opacity="${r1(clamp(o.opacity) * 100) / 100}"` : "";
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${o.size ?? 28}" fill="${o.fill ?? C.text}" text-anchor="${o.anchor ?? "start"}" font-weight="${o.weight ?? 400}" font-family="${o.family ?? "Inter, Helvetica, Arial, sans-serif"}"${op}>${esc(t)}</text>`;
}

/** Break text into lines that fit `width` at `size` (a rough average letter width). */
export function wrap(t: string, width: number, size: number): string[] {
  const max = Math.max(8, Math.floor(width / (size * 0.53)));
  const out: string[] = [];
  let line = "";
  for (const word of t.split(/\s+/)) {
    if ((line + " " + word).trim().length > max && line) { out.push(line); line = word; } else line = (line + " " + word).trim();
  }
  if (line) out.push(line);
  return out;
}

export function lines(x: number, y: number, t: string, width: number, size: number, o: { fill?: string; weight?: number; anchor?: string; lead?: number; opacity?: number } = {}): string {
  return wrap(t, width, size).map((l, i) => text(x, y + i * size * (o.lead ?? 1.22), l, { size, ...o })).join("");
}

function path(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");
}

export interface Lane { label: string; color: string; values: (number | null)[]; width?: number; opacity?: number; tag?: string }

/**
 * Lines drawn in from the left up to `reveal` (0 to 1), with a y axis fixed for the whole
 * series so nothing rescales while it plays, and a dot and label at each line's end.
 */
export function chart(box: Box, lanes: Lane[], reveal: number, o: { log?: boolean; fmt: (v: number) => string; xLabels?: [number, string][]; base?: number; floor?: number; endLabels?: boolean }): string {
  const s = box.scale;
  const pad = { l: 120 * s, r: (o.endLabels === false ? 30 : 230) * s, t: 20 * s, b: 50 * s };
  const x0 = box.x + pad.l, x1 = box.x + box.w - pad.r, y0 = box.y + pad.t, y1 = box.y + box.h - pad.b;
  const tv = (v: number) => (o.log ? Math.log(Math.max(v, o.floor ?? 1e-9)) : v);
  let lo = Infinity, hi = -Infinity, n = 0;
  for (const l of lanes) {
    n = Math.max(n, l.values.length);
    for (const v of l.values) if (v != null && Number.isFinite(v)) { lo = Math.min(lo, tv(v)); hi = Math.max(hi, tv(v)); }
  }
  if (o.base != null) { lo = Math.min(lo, tv(o.base)); hi = Math.max(hi, tv(o.base)); }
  const span = hi - lo || 1;
  lo -= span * 0.04; hi += span * 0.04;
  const X = (k: number) => x0 + (n > 1 ? (k / (n - 1)) * (x1 - x0) : 0);
  const Y = (v: number) => y1 - ((tv(v) - lo) / (hi - lo)) * (y1 - y0);
  let out = "";
  // Grid: a few round values.
  const ticks: number[] = [];
  if (o.log) {
    for (let m = 1e-3; m < 1e12; m *= 10) for (const k of [1, 3]) { const v = m * k; if (tv(v) >= lo && tv(v) <= hi) ticks.push(v); }
  } else {
    const raw = (hi - lo) / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => (hi - lo) / m <= 5) ?? raw;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  }
  const shown = ticks.length > 7 ? ticks.filter((v) => Math.abs(Math.log10(v) % 1) < 1e-9 || Math.abs(Math.log10(v) % 1) > 1 - 1e-9) : ticks;
  for (const v of shown.length > 7 ? shown.filter((_, i) => i % 2 === 0) : shown) {
    out += `<line x1="${r1(x0)}" x2="${r1(x1)}" y1="${r1(Y(v))}" y2="${r1(Y(v))}" stroke="${C.grid}" stroke-width="${r1(2 * s)}"/>`;
    out += text(x0 - 14 * s, Y(v) + 9 * s, o.fmt(v), { size: 24 * s, fill: C.faint, anchor: "end" });
  }
  if (o.base != null) out += `<line x1="${r1(x0)}" x2="${r1(x1)}" y1="${r1(Y(o.base))}" y2="${r1(Y(o.base))}" stroke="${C.muted}" stroke-dasharray="${r1(8 * s)} ${r1(8 * s)}" stroke-width="${r1(2 * s)}" opacity="0.6"/>`;
  for (const [k, l] of o.xLabels ?? []) if (k < n) out += text(X(k), y1 + 38 * s, l, { size: 24 * s, fill: C.faint, anchor: "middle" });
  const m = Math.max(1, Math.round(clamp(reveal) * (n - 1)));
  const ends: { y: number; lane: Lane; v: number }[] = [];
  for (const l of lanes) {
    const pts: [number, number][] = [];
    let last: number | null = null;
    for (let k = 0; k <= m && k < l.values.length; k++) {
      const v = l.values[k];
      if (v == null || !Number.isFinite(v)) continue;
      pts.push([X(k), Y(v)]);
      last = v;
    }
    if (pts.length < 2 || last == null) continue;
    out += `<path d="${path(pts)}" fill="none" stroke="${l.color}" stroke-width="${r1((l.width ?? 4) * s)}" stroke-linejoin="round" stroke-linecap="round" opacity="${l.opacity ?? 1}"/>`;
    const [px, py] = pts[pts.length - 1];
    if ((l.opacity ?? 1) >= 0.9) {
      out += `<circle cx="${r1(px)}" cy="${r1(py)}" r="${r1(8 * s)}" fill="${l.color}"/>`;
      if (o.endLabels !== false) ends.push({ y: py, lane: l, v: last });
    }
  }
  // End labels pushed apart so they never overlap.
  ends.sort((a, b) => a.y - b.y);
  const gap = 56 * s;
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < gap) ends[i].y = ends[i - 1].y + gap;
  const xe = X(m) + 18 * s;
  for (const e of ends) {
    out += text(xe, e.y - 2 * s, e.lane.tag ?? e.lane.label, { size: 24 * s, fill: e.lane.color, weight: 600 });
    out += text(xe, e.y + 26 * s, o.fmt(e.v), { size: 24 * s, fill: C.text });
  }
  return out;
}

/** A rounded panel with a big number and a label, for live stats. */
export function stat(x: number, y: number, w: number, h: number, s: number, label: string, value: string, color: string, sub?: string): string {
  return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(18 * s)}" fill="${C.panel}" stroke="${color}" stroke-opacity="0.5" stroke-width="${r1(2 * s)}"/>`
    + text(x + 24 * s, y + 44 * s, label, { size: 26 * s, fill: color, weight: 600 })
    + text(x + 24 * s, y + 44 * s + 62 * s, value, { size: 56 * s, fill: C.text, weight: 700 })
    + (sub ? text(x + 24 * s, y + 44 * s + 106 * s, sub, { size: 24 * s, fill: C.muted }) : "");
}

const yearsOf = (dates: string[], every: number): [number, string][] => {
  const out: [number, string][] = [];
  let last = "";
  dates.forEach((d, k) => { const y = d.slice(0, 4); if (y !== last && Number(y) % every === 0 && k > 0) out.push([k, y]); last = y; });
  return out;
};

const monthYear = (iso: string) => new Date(Date.parse(iso)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** Timing shared by the races: a short still start, the race, then the result held. */
function race(t: number, intro = 0.08, done = 0.78): number {
  return ease(clamp((t - intro) / (done - intro)));
}

/** A seeded random number generator, so a clip renders the same every time. */
function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return { next, normal: () => Math.sqrt(-2 * Math.log(Math.max(next(), 1e-9))) * Math.cos(2 * Math.PI * next()) };
}

// ------------------------------------------------------------------ the scenes

const TAGS = ["#investing", "#trading", "#finance", "#backtest", "#education"];

export function botBattle(d: Data): Scene | null {
  const run = d.bots?.run("stocks-1928");
  const ix = d.bots?.index;
  if (!run || !ix) return null;
  const A = "martingale", B = "trend";
  const fa = run.runs[A].summary, fb = run.runs[B].summary;
  const wa = Math.round((fa.win_rate ?? 0) * 100), wb = Math.round((fb.win_rate ?? 0) * 100);
  const period = `Backtest of simple rules on US stocks (Kenneth French total market), ${monthYear(run.start)} to ${monthYear(run.end)}. $10,000 each, 2 bp costs, no interest.`;
  const n = run.labels.length;
  const others = ix.bots.filter((b) => b.id !== A && b.id !== B && run.runs[b.id]);
  return {
    id: "bot-battle",
    end: "Win rate is not profit.",
    hook: `${wa}% win rate vs ${wb}% win rate: who wins?`,
    period,
    seconds: 22,
    captions: [
      [0, `Two trading bots. $10,000 each. Same US stock prices since ${run.start.slice(0, 4)}.`],
      [0.18, "Double down buys more every time the price falls, and sells on a small bounce."],
      [0.36, "Trend follower buys breakouts and cuts losers fast. It is wrong more often than right."],
      [0.56, `Double down wins ${wa}% of its trades. Its rare losses are huge, and they decide the result.`],
      [0.78, "Expectancy = win rate x average win - loss rate x average loss."],
    ],
    social: {
      caption: `A bot that wins ${wa}% of its trades against one that wins ${wb}%. Same prices, same $10,000, very different endings. Win rate is not profit: what matters is the size of the losses. Hypothetical backtest of simple rules, ${run.start.slice(0, 4)} to ${run.end.slice(0, 4)}. Educational, not investment advice.`,
      hashtags: [...TAGS, "#tradingbot", "#winrate", "#riskmanagement"],
    },
    body: (t, box) => {
      const s = box.scale;
      const p = race(t);
      const k = Math.round(p * (n - 1));
      const chartH = box.h * 0.66;
      const lanes: Lane[] = [
        ...others.map((b) => ({ label: b.name, color: C.faint, values: run.runs[b.id].equity.map((v) => Math.max(10, v)), width: 2, opacity: 0.35 })),
        { label: "Trend follower", color: C.good, values: run.runs[B].equity.map((v) => Math.max(10, v)), width: 5, tag: `Trend ${wb}%` },
        { label: "Double down", color: C.bad, values: run.runs[A].equity.map((v) => Math.max(10, v)), width: 5, tag: `Double down ${wa}%` },
      ];
      let out = chart({ ...box, h: chartH }, lanes, p, { log: true, fmt: money, base: 10000, xLabels: yearsOf(run.labels, 20), floor: 10 });
      out += text(box.x, box.y + 10 * s, "Grey: five other simple bots", { size: 22 * s, fill: C.faint });
      out += text(box.x + box.w / 2, box.y + 10 * s, monthYear(run.labels[k] ?? run.start), { size: 40 * s, fill: C.warn, weight: 700, anchor: "middle" });
      const sa = statsAt(run.runs[A], k), sb = statsAt(run.runs[B], k);
      const y = box.y + chartH + 24 * s, w = (box.w - 24 * s) / 2, h = box.h - chartH - 24 * s;
      out += stat(box.x, y, w, Math.min(h, 190 * s), s, "Double down", `${sa.winRate == null ? "n/a" : (sa.winRate * 100).toFixed(1) + "%"} wins`, C.bad, `Account ${sa.stopped ? "stopped" : money(sa.equity)}`);
      out += stat(box.x + w + 24 * s, y, w, Math.min(h, 190 * s), s, "Trend follower", `${sb.winRate == null ? "n/a" : (sb.winRate * 100).toFixed(1) + "%"} wins`, C.good, `Account ${money(sb.equity)}`);
      return out;
    },
  };
}

const NAMES: Record<string, string> = {
  us_market_buy_hold: "Buy and hold", stocks_vol_managed: "Calmer in storms", stocks_trend_10m: "10-month trend",
  stocks_golden_cross: "Golden cross", stocks_plus_fx_trend: "Stocks+FX trend", stocks_sell_in_may: "Sell in May",
  stocks_turn_of_month: "Turn of month", fx_carry: "Currency carry", fx_dollar_carry: "Dollar carry", commodity_tsmom: "Oil and gas trend",
};
const short = (s: string) => (s.length > 18 ? `${s.slice(0, 17).trimEnd()}.` : s);
const nice = (s: string) => NAMES[s] ?? s.replace(/^fx_/, "FX ").replace(/_/g, " ");

export function strategyRace(d: Data): Scene | null {
  const runs = d.report?.runs;
  if (!runs?.length) return null;
  const dates = runs[0].equity.map((p) => p[0]);
  const series = runs.map((r) => {
    const m = new Map(r.equity);
    return { r, values: dates.map((dt) => m.get(dt) ?? null) };
  });
  const final = (v: (number | null)[]) => { for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return v[i] as number; return 0; };
  series.sort((a, b) => final(b.values) - final(a.values));
  const palette = [C.good, C.blue, C.cyan, C.violet, C.warn];
  const shown = series.slice(0, 4);
  const bench = series.find((x) => x.r.is_benchmark);
  const period = `Backtests of ${runs.length} rule-based strategies, ${monthYear(dates[0])} to ${monthYear(dates[dates.length - 1])}, $10,000 each, after costs.`;
  return {
    id: "strategy-race",
    end: "A backtest is not a promise.",
    hook: `${runs.length} trading rules, ${dates[0].slice(0, 4)} to today. Who comes out ahead?`,
    period,
    seconds: 20,
    captions: [
      [0, `Every strategy we test, replayed from ${dates[0].slice(0, 4)} with the same $10,000.`],
      [0.3, "The dotted line is where they started. Grey lines are the rest of the field."],
      [0.55, "Most rules that sound clever end close to, or behind, simply holding the market."],
      [0.78, "Past results are a backtest, not a promise of future ones."],
    ],
    social: {
      caption: `${runs.length} rule-based strategies replayed since ${dates[0].slice(0, 4)}, each with a hypothetical $10,000, after costs. Most clever-sounding rules end near plain buy and hold. Backtested, educational, not investment advice.`,
      hashtags: [...TAGS, "#strategy", "#quant", "#stockmarket"],
    },
    body: (t, box) => {
      const s = box.scale;
      const p = race(t);
      const k = Math.round(p * (dates.length - 1));
      const lanes: Lane[] = [
        ...series.filter((x) => !shown.includes(x) && x !== bench).map((x) => ({ label: nice(x.r.strategy), color: C.faint, values: x.values.map((v) => (v == null ? null : v * 10000)), width: 2, opacity: 0.35 })),
        ...(bench && !shown.includes(bench) ? [{ label: nice(bench.r.strategy), tag: short(nice(bench.r.strategy)), color: C.text, values: bench.values.map((v) => (v == null ? null : v * 10000)), width: 4 }] : []),
        ...shown.map((x, i) => ({ label: nice(x.r.strategy), tag: short(nice(x.r.strategy)), color: x === bench ? C.text : palette[i], values: x.values.map((v) => (v == null ? null : v * 10000)), width: 5 })),
      ];
      let out = chart({ ...box, h: box.h * 0.8 }, lanes, p, { log: true, fmt: money, base: 10000, xLabels: yearsOf(dates, 5) });
      out += text(box.x + box.w / 2, box.y + 10 * s, monthYear(dates[k] ?? dates[0]), { size: 40 * s, fill: C.warn, weight: 700, anchor: "middle" });
      // Leader board of the top three right now.
      const now = series.map((x) => ({ name: nice(x.r.strategy), v: x.values[k] ?? null, bench: x === bench })).filter((x) => x.v != null).sort((a, b) => (b.v as number) - (a.v as number)).slice(0, 3);
      const y = box.y + box.h * 0.82;
      now.forEach((row, i) => {
        out += text(box.x + 20 * s, y + i * 46 * s + 30 * s, `${i + 1}. ${row.name}${row.bench ? " (US stocks)" : ""}`, { size: 30 * s, fill: i ? C.muted : C.text, weight: i ? 400 : 600 });
        out += text(box.x + box.w - 20 * s, y + i * 46 * s + 30 * s, money((row.v as number) * 10000), { size: 30 * s, fill: C.text, anchor: "end" });
      });
      return out;
    },
  };
}

export function crisisReplay(d: Data): Scene | null {
  const wk = d.world?.weekly;
  if (!wk) return null;
  const from = "2007-07-06", to = "2009-09-25";
  const a = wk.dates.findIndex((x) => x >= from), b = wk.dates.findIndex((x) => x > to) - 1;
  if (a < 0 || b <= a) return null;
  const keys: [string, string, string][] = [["stocks", "US stocks", C.bad], ["ind.Money", "US banks and finance", C.pink], ["oil", "Oil (WTI)", C.warn], ["JPY", "Japanese yen", C.good], ["bonds10", "US 10-year Treasuries", C.blue]];
  const dates = wk.dates.slice(a, b + 1);
  const lanes = keys.filter(([k]) => wk.series[k]).map(([k, label, color]) => {
    const raw = wk.series[k].slice(a, b + 1);
    const first = raw.find((v) => v != null) ?? 1;
    return { label, color, values: raw.map((v) => (v == null ? null : (v / (first as number)) * 100)), width: 5 };
  });
  return {
    id: "crisis-replay",
    end: "History, not a forecast.",
    hook: "2008 in 20 seconds: what fell, and what held up",
    period: `Past weekly prices, ${monthYear(dates[0])} to ${monthYear(dates[dates.length - 1])}, each starting at 100. Yen is its value in US dollars. Treasuries are total return.`,
    seconds: 20,
    captions: [
      [0, "Summer 2007. Every line starts at 100."],
      [0.3, "September 2008: Lehman Brothers fails. Banks and oil fall hard."],
      [0.55, "The yen and US Treasuries rise while almost everything else falls."],
      [0.78, "History replayed, not a forecast. The next crisis will look different."],
    ],
    social: {
      caption: "The 2008 financial crisis replayed: US stocks, banks, oil, the yen and Treasuries, each starting at 100 in July 2007. Past prices, not a forecast. Educational, not investment advice.",
      hashtags: [...TAGS, "#2008", "#financialcrisis", "#markets", "#history"],
    },
    body: (t, box) => {
      const s = box.scale;
      const p = race(t);
      const k = Math.round(p * (dates.length - 1));
      const xl: [number, string][] = [];
      dates.forEach((dt, i) => { if (dt.slice(5, 7) === "01" && Number(dt.slice(8, 10)) <= 7) xl.push([i, dt.slice(0, 4)]); });
      let out = chart({ ...box, h: box.h * 0.86 }, lanes, p, { fmt: (v) => v.toFixed(0), base: 100, xLabels: xl });
      out += text(box.x + box.w / 2, box.y + 10 * s, monthYear(dates[k]), { size: 44 * s, fill: C.warn, weight: 700, anchor: "middle" });
      return out;
    },
  };
}

export function luckVsSkill(): Scene {
  const N = 400, days = 252 * 3;
  const all: number[][] = [];
  for (let i = 0; i < N; i++) {
    const g = rng(1000 + i);
    const v = [10000];
    for (let d = 1; d < days; d++) v.push(v[d - 1] * Math.exp(-0.00008 + 0.012 * g.normal()));
    all.push(v);
  }
  const best = all.reduce((bi, v, i) => (v[days - 1] > all[bi][days - 1] ? i : bi), 0);
  const end = all[best][days - 1];
  const thin = (v: number[]) => v.filter((_, i) => i % 6 === 0 || i === v.length - 1);
  const lanesBase = all.map((v, i) => ({ label: `Trader ${i + 1}`, color: C.faint, values: thin(v), width: 1.5, opacity: 0.18 }));
  return {
    id: "luck-vs-skill",
    end: "Ask how many others tried.",
    hook: `This trader turned $10,000 into ${money(end)}. They had no skill at all.`,
    period: `Simulated: ${N} made-up traders flipping coins for 3 years, each starting with $10,000. No real trades.`,
    seconds: 20,
    captions: [
      [0, `${N} made-up traders. Every trade is a coin flip. Nobody has an edge.`],
      [0.35, "Some end up. Some end down. That is luck, and it is all luck."],
      [0.6, `The luckiest one turned $10,000 into ${money(end)}. It looks like genius.`],
      [0.8, "Test enough strategies and the best one will always look brilliant. That is why we test for luck."],
    ],
    social: {
      caption: `${N} made-up traders flip coins for three years. The best one looks like a genius. None of them had any skill. When you see a great track record, ask how many others tried. Simulated, educational, not investment advice.`,
      hashtags: [...TAGS, "#luck", "#statistics", "#survivorshipbias"],
    },
    body: (t, box) => {
      const s = box.scale;
      const p = race(t, 0.06, 0.6);
      const glow = clamp((t - 0.6) / 0.1);
      const lanes: Lane[] = [...lanesBase, ...(glow > 0 ? [{ label: "The luckiest", color: C.warn, values: thin(all[best]), width: 6, opacity: glow < 0.9 ? glow : 1, tag: "The luckiest" }] : [])];
      let out = chart({ ...box, h: box.h * 0.84 }, lanes, p, { log: true, fmt: money, base: 10000, xLabels: [[Math.round(thin(all[0]).length / 3), "Year 1"], [Math.round((2 * thin(all[0]).length) / 3), "Year 2"]] });
      const up = all.filter((v) => v[Math.round(p * (days - 1))] > 10000).length;
      out += text(box.x + box.w / 2, box.y + box.h * 0.92, `${up} of ${N} are ahead right now, by pure chance`, { size: 34 * s, fill: C.text, weight: 600, anchor: "middle" });
      return out;
    },
  };
}

export function smoothing(d: Data): Scene | null {
  const wk = d.world?.weekly;
  const raw = wk?.series.stocks;
  if (!wk || !raw) return null;
  const from = "2007-06-01", to = "2011-06-30";
  const a = wk.dates.findIndex((x) => x >= from), b = wk.dates.findIndex((x) => x > to) - 1;
  if (a < 0 || b <= a) return null;
  const dates = wk.dates.slice(a, b + 1);
  const px = raw.slice(a, b + 1).map((v, i, arr) => (v ?? arr[i - 1] ?? 1) as number);
  const market = px.map((v) => (v / px[0]) * 100);
  // Appraisal smoothing: each quarter the reported value moves only part of the way to
  // the market value (the common model behind private market returns, with 70% weight on
  // the last report). An illustration of the effect, not a real fund.
  const appraised: number[] = [];
  let rep = 100;
  market.forEach((v, i) => { if (i % 13 === 0) rep = 0.7 * rep + 0.3 * v; appraised.push(rep); });
  const worst = (v: number[]) => { let peak = v[0], w = 0; for (const x of v) { peak = Math.max(peak, x); w = Math.min(w, x / peak - 1); } return Math.round(w * 100); };
  const wm = worst(market), wa = worst(appraised);
  return {
    id: "smoothing-illusion",
    end: "Smoother is not safer.",
    hook: `Same assets. One fell ${-wm}%, the other only ${-wa}%.`,
    period: `US stocks, weekly, ${monthYear(dates[0])} to ${monthYear(dates[dates.length - 1])}, and the same values re-priced quarterly the way appraisals smooth them (illustration).`,
    seconds: 20,
    captions: [
      [0, "Blue: US stocks priced every week by the market."],
      [0.25, "Yellow: the same values, but appraised once a quarter and moved only part way."],
      [0.5, `The market fell ${-wm}%. The appraised line shows ${wm === wa ? "the same" : `only ${-wa}%`}.`],
      [0.78, "Calm-looking private market returns can hide the same risk. Smoother is not safer."],
    ],
    social: {
      caption: `Same assets, two ways of pricing them. Priced by the market every week, US stocks fell ${-wm}% in 2008 and 2009. Appraised once a quarter, the same values show a fall of only ${-wa}%. Private market returns often look calm for this reason. Illustration with past prices, educational, not investment advice.`,
      hashtags: [...TAGS, "#privateequity", "#privatemarkets", "#volatility"],
    },
    body: (t, box) => {
      const s = box.scale;
      const p = race(t);
      const k = Math.round(p * (dates.length - 1));
      const xl: [number, string][] = [];
      dates.forEach((dt, i) => { if (dt.slice(5, 7) === "01" && Number(dt.slice(8, 10)) <= 7) xl.push([i, dt.slice(0, 4)]); });
      const lanes: Lane[] = [
        { label: "Priced weekly", color: C.blue, values: market, width: 5, tag: "Market price" },
        { label: "Appraised", color: C.warn, values: appraised, width: 6, tag: "Appraised" },
      ];
      let out = chart({ ...box, h: box.h * 0.78 }, lanes, p, { fmt: (v) => v.toFixed(0), base: 100, xLabels: xl });
      out += text(box.x + box.w / 2, box.y + 10 * s, monthYear(dates[k]), { size: 40 * s, fill: C.warn, weight: 700, anchor: "middle" });
      const w = (box.w - 24 * s) / 2, y = box.y + box.h * 0.8;
      const sh = Math.min(180 * s, box.y + box.h - y);
      out += stat(box.x, y, w, sh, s, "Market price", `${worst(market.slice(0, k + 1))}%`, C.blue, sh >= 170 * s ? "worst fall so far" : undefined);
      out += stat(box.x + w + 24 * s, y, w, sh, s, "Appraised", `${worst(appraised.slice(0, k + 1))}%`, C.warn, sh >= 170 * s ? "worst fall so far" : undefined);
      return out;
    },
  };
}

export function allScenes(d: Data): Scene[] {
  return [botBattle(d), strategyRace(d), crisisReplay(d), luckVsSkill(), smoothing(d)].filter((x): x is Scene => x != null);
}

// ------------------------------------------------------------------ the whole frame

export interface Brand { wordmark: string }

/** One full frame: wordmark, hook, the scene, a caption, the period, the risk line, and
 * the end card over the last `endSeconds`. */
export function frame(scene: Scene, t: number, L: Layout, brand: Brand, endSeconds = 2.5): string {
  const { w, h, vertical } = L;
  const s = vertical ? 1 : 0.78;
  const endAt = 1 - endSeconds / scene.seconds;
  const tt = clamp(t / endAt);
  const pad = 56 * s;
  let out = `<rect width="${w}" height="${h}" fill="${C.bg}"/>`;
  out += `<image href="${brand.wordmark}" x="${pad}" y="${(vertical ? 60 : 34)}" width="${282 * s * 1.15}" height="${64 * s * 1.15}"/>`;
  out += text(w - pad, (vertical ? 108 : 78), "HYPOTHETICAL", { size: 22 * s, fill: C.warn, anchor: "end", weight: 600 });
  const hookSize = vertical ? 64 : 50;
  const hookY = vertical ? 250 : 170;
  const hookLines = wrap(scene.hook, w - 2 * pad, hookSize);
  out += lines(pad, hookY, scene.hook, w - 2 * pad, hookSize, { weight: 700 });
  const bodyTop = hookY + hookLines.length * hookSize * 1.22 + (vertical ? 50 : 20);
  const footH = vertical ? 330 : 190;
  const box: Box = { x: pad, y: bodyTop, w: w - 2 * pad, h: h - bodyTop - footH, scale: s };
  out += scene.body(tt, box);
  // Burned-in caption.
  const cap = [...scene.captions].reverse().find(([at]) => tt >= at)?.[1] ?? "";
  const capY = h - footH + (vertical ? 50 : 26);
  out += `<rect x="${pad - 12}" y="${capY - 44 * s}" width="${w - 2 * pad + 24}" height="${(vertical ? 150 : 96)}" rx="${16 * s}" fill="#000000" opacity="0.55"/>`;
  out += lines(w / 2, capY + 6 * s, cap, w - 2 * pad - 40, (vertical ? 40 : 30), { anchor: "middle", weight: 600 });
  // Period and the risk line, every frame.
  const fy = h - (vertical ? 120 : 72);
  out += lines(pad, fy, scene.period, w - 2 * pad, 22 * s, { fill: C.muted, lead: 1.25 });
  out += text(pad, h - (vertical ? 36 : 22), RISK, { size: 26 * s, fill: C.warn, weight: 600 });
  // End card.
  const e = clamp((t - endAt) / 0.04);
  if (e > 0) {
    out += `<rect width="${w}" height="${h}" fill="${C.bg}" opacity="${r1(e * 100) / 100}"/>`;
    const cy = h / 2;
    out += `<g opacity="${e}">`;
    out += `<image href="${brand.wordmark}" x="${w / 2 - 282 * 2.2 * s / 2}" y="${cy - 260 * s}" width="${282 * 2.2 * s}" height="${64 * 2.2 * s}"/>`;
    out += text(w / 2, cy + 20 * s, scene.end, { size: 52 * s, weight: 700, anchor: "middle" });
    out += text(w / 2, cy + 90 * s, "Try the sims yourself:", { size: 34 * s, fill: C.muted, anchor: "middle" });
    out += text(w / 2, cy + 160 * s, SITE, { size: 56 * s, fill: C.blue, weight: 700, anchor: "middle" });
    out += lines(w / 2, cy + 260 * s, RISK + " Past and simulated results do not predict future ones.", w - 4 * pad, 28 * s, { fill: C.warn, anchor: "middle" });
    out += `</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${out}</svg>`;
}
