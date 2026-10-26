// Bot Battle's numbers at any moment of a replay (DEC-0035). The engine's `parity bots
// export` runs every bot once and writes, for each weekly frame, the account, the worst
// fall so far and the longest time under water so far, plus every trade with the frame
// it closed in. Everything on the leaderboard at frame k is worked out here from those,
// so the numbers grow as the replay plays.
//
// No imports and only type syntax Node can strip, so the content renderer
// (web/scripts/content/) can load this file with `node --experimental-strip-types`.

export interface BotInfo { id: string; name: string; style: string; rule: string; params: Record<string, number> }

export interface BotSummary {
  trades: number; wins: number; win_rate: number | null; avg_win: number; avg_loss: number;
  profit_factor: number | null; expectancy: number | null; max_drawdown: number;
  days_to_recover: number | null; longest_underwater_days: number; final: number; pnl: number;
  pnl_pct: number; blown: boolean; margin_calls: number; stopped_on?: string | null;
}

export interface RunBrief {
  id: string; kind: "market" | "synthetic"; market?: string; label: string; source: string;
  start: string; end: string; seed?: number; crashes?: { day: number; days: number; depth: number; frame: number }[];
  frames: number; summary: Record<string, BotSummary>;
}

export interface BotsIndex {
  generated_at: string; data_through: string | null; disclaimer: string;
  assumptions: { start_cash: number; cost_bps: number; max_leverage: number; blown_below: number };
  bots: BotInfo[];
  runs: RunBrief[];
  synthetic: { years: number; paths: number; summary: Record<string, { paths: number; blown: number; ahead: number; median_final: number; median_win_rate: number | null; median_max_drawdown: number }> };
}

/** One trade: [frame it closed, profit in dollars, flag]; flag 1 = margin call, 2 = closed on the last day. */
export type TradeRow = [number, number] | [number, number, number];

export interface BotTrack {
  equity: number[];
  /** Worst fall from a peak so far, in percent (negative). */
  worst: number[];
  /** Longest spell under a previous peak so far, in weeks. */
  underwater: number[];
  trades: TradeRow[];
  stopped: number | null;
  summary: BotSummary;
}

export interface BotRunFile extends RunBrief { labels: string[]; price: number[]; runs: Record<string, BotTrack> }

export interface LiveStats {
  trades: number; wins: number; winRate: number | null; avgWin: number; avgLoss: number;
  profitFactor: number | null; expectancy: number | null; equity: number; pnl: number; pnlPct: number;
  worst: number; underwaterWeeks: number; stillUnder: boolean; stopped: boolean; marginCalls: number;
}

/** First index in `trades` whose frame is after k (trades are in the order they closed). */
function cut(trades: TradeRow[], k: number): number {
  let lo = 0, hi = trades.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (trades[mid][0] <= k) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/**
 * The leaderboard numbers at frame k. Trades still open on the last day only count on
 * the last frame, where the engine closed them.
 */
export function statsAt(track: BotTrack, k: number, start = 10_000): LiveStats {
  const n = cut(track.trades, k);
  let wins = 0, gw = 0, gl = 0, losses = 0, calls = 0;
  for (let i = 0; i < n; i++) {
    const t = track.trades[i];
    const p = t[1];
    if (p > 0) { wins++; gw += p; } else { losses++; gl -= p; }
    if (t[2] === 1) calls++;
  }
  const equity = track.equity[Math.min(k, track.equity.length - 1)] ?? start;
  const winRate = n ? wins / n : null;
  const avgWin = wins ? gw / wins : 0;
  const avgLoss = losses ? gl / losses : 0;
  let peak = 0;
  for (let i = 0; i <= k && i < track.equity.length; i++) peak = Math.max(peak, track.equity[i]);
  return {
    trades: n, wins, winRate, avgWin, avgLoss,
    profitFactor: gl > 0 ? gw / gl : null,
    expectancy: winRate == null ? null : winRate * avgWin - (1 - winRate) * avgLoss,
    equity, pnl: equity - start, pnlPct: (equity / start - 1) * 100,
    worst: track.worst[Math.min(k, track.worst.length - 1)] ?? 0,
    underwaterWeeks: track.underwater[Math.min(k, track.underwater.length - 1)] ?? 0,
    stillUnder: equity < peak,
    stopped: track.stopped != null && k >= track.stopped,
    marginCalls: calls,
  };
}

/** "$12,345", "-$1.2m", "$3.4bn": short money for a board cell. */
export function money(v: number): string {
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}bn`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`;
  if (a >= 1e4) return `${sign}$${Math.round(a / 1e3)}k`;
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
}

/** "7 wks", "1.5 yrs". */
export function weeksText(w: number): string {
  if (w <= 0) return "none";
  return w < 104 ? `${w} wk${w === 1 ? "" : "s"}` : `${(w / 52.18).toFixed(1)} yrs`;
}

export const pctText = (v: number | null, digits = 0) => (v == null ? "n/a" : `${(v * 100).toFixed(digits)}%`);

/** The expectancy line, in words and numbers, for the formula card. */
export function expectancyLine(s: LiveStats): string {
  if (s.winRate == null) return "No closed trades yet.";
  const w = s.winRate;
  return `${pctText(w, 1)} x ${money(s.avgWin)} - ${pctText(1 - w, 1)} x ${money(s.avgLoss)} = ${money(s.expectancy ?? 0)} a trade`;
}
