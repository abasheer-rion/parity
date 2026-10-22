// Human names, tags and a plain strengths-and-weaknesses read for each strategy.
// New runs carry display_name, description and tags from the engine; runs published
// before that fall back to the table below. Internal ids never change.
import type { Comparison, StrategyRun, StrategyTags } from "./types";

const FALLBACK: Record<string, { name: string; tags: StrategyTags }> = {
  us_market_buy_hold: { name: "US stock market", tags: { family: "benchmark", asset: "stocks", style: "buy and hold", horizon: "multi-year" } },
  fx_carry: { name: "Currency carry", tags: { family: "carry", asset: "fx", style: "risk premium", horizon: "monthly" } },
  fx_carry_trend_value: { name: "Carry, trend and value blend", tags: { family: "mixed", asset: "fx", style: "multi-factor", horizon: "monthly" } },
  fx_commodity_gap: { name: "Oil currency gap", tags: { family: "value", asset: "fx", style: "mean reversion", horizon: "monthly" } },
  fx_dollar_carry: { name: "Dollar carry", tags: { family: "carry", asset: "fx", style: "timing", horizon: "monthly" } },
  fx_ma_cross: { name: "Currency moving-average cross", tags: { family: "trend", asset: "fx", style: "momentum", horizon: "daily" } },
  fx_rsi_reversion: { name: "Currency RSI bounce", tags: { family: "value", asset: "fx", style: "mean reversion", horizon: "daily" } },
  fx_tsmom: { name: "Currency trend", tags: { family: "trend", asset: "fx", style: "momentum", horizon: "monthly" } },
  fx_value_reer: { name: "Currency value", tags: { family: "value", asset: "fx", style: "mean reversion", horizon: "multi-month" } },
  fx_xs_momentum: { name: "Currency winners", tags: { family: "trend", asset: "fx", style: "momentum", horizon: "monthly" } },
  commodity_tsmom: { name: "Oil and gas trend", tags: { family: "trend", asset: "commodities", style: "momentum", horizon: "monthly" } },
  stocks_golden_cross: { name: "Golden cross", tags: { family: "trend", asset: "stocks", style: "timing", horizon: "daily" } },
  stocks_plus_fx_trend: { name: "Stocks plus currency trend", tags: { family: "mixed", asset: "mixed", style: "diversified", horizon: "monthly" } },
  stocks_sell_in_may: { name: "Sell in May", tags: { family: "calendar", asset: "stocks", style: "seasonal", horizon: "multi-month" } },
  stocks_trend_10m: { name: "Stock trend, 10-month", tags: { family: "trend", asset: "stocks", style: "timing", horizon: "monthly" } },
  stocks_turn_of_month: { name: "Turn of the month", tags: { family: "calendar", asset: "stocks", style: "seasonal", horizon: "daily" } },
  stocks_vol_managed: { name: "Calm-market stocks", tags: { family: "volatility", asset: "stocks", style: "risk scaling", horizon: "monthly" } },
};

function guessTags(r: StrategyRun): StrategyTags {
  const keys = Object.keys(r.exposure);
  const asset = keys.every((k) => k.startsWith("fx.")) ? "fx"
    : keys.every((k) => k.startsWith("eq.") || k.startsWith("cash.")) ? "stocks"
    : keys.every((k) => k.startsWith("cmd.")) ? "commodities" : "mixed";
  return { family: r.is_benchmark ? "benchmark" : "mixed", asset, style: "", horizon: "" };
}

export function nameOf(r: StrategyRun): string {
  if (r.display_name) return r.display_name;
  if (FALLBACK[r.strategy]) return FALLBACK[r.strategy].name;
  const s = r.strategy.replace(/_/g, " ");
  return s[0].toUpperCase() + s.slice(1);
}

export function tagsOf(r: StrategyRun): StrategyTags {
  return r.tags ?? FALLBACK[r.strategy]?.tags ?? guessTags(r);
}

export const ASSET_LABEL: Record<string, string> = { fx: "Currencies", stocks: "Stocks", commodities: "Commodities", mixed: "Mixed" };
export const FAMILY_LABEL: Record<string, string> = {
  carry: "Carry", trend: "Trend", value: "Value", calendar: "Calendar", volatility: "Volatility", mixed: "Blend", benchmark: "Benchmark",
};

export interface Insight { text: string; kind: "strength" | "weakness"; detail?: string }

/** A plain read of what a strategy does well and badly, from its gauntlet and numbers. */
export function insightsFor(r: StrategyRun, comparison?: Comparison, bench?: StrategyRun): Insight[] {
  const out: Insight[] = [];
  const m = r.metrics;
  const add = (kind: Insight["kind"], text: string, detail?: string) => out.push({ kind, text, detail });

  if (m.sharpe != null) {
    if (m.sharpe >= 0.5) add("strength", `Steady for the risk it takes (Sharpe ${m.sharpe.toFixed(2)}).`);
    else if (m.sharpe <= 0.1) add("weakness", `Barely paid for its risk (Sharpe ${m.sharpe.toFixed(2)}).`);
  }
  if (m.max_drawdown != null) {
    if (m.max_drawdown > -0.15) add("strength", `Never fell more than ${Math.abs(m.max_drawdown * 100).toFixed(0)}% from a high.`);
    else if (m.max_drawdown < -0.4) add("weakness", `Once fell ${Math.abs(m.max_drawdown * 100).toFixed(0)}% from a high.`);
  }
  if (m.breakeven_cost_bps != null) {
    if (m.breakeven_cost_bps <= 0) add("weakness", "Loses money even before trading costs.");
    else if (m.breakeven_cost_bps < 5) add("weakness", `Trading costs above ${m.breakeven_cost_bps.toFixed(1)} bps a trade would wipe out the edge.`);
    else if (m.breakeven_cost_bps > 30) add("strength", "Survives realistic trading costs easily.");
  }
  if (!r.is_benchmark && m.correlation != null && Math.abs(m.correlation) < 0.2) add("strength", "Moves mostly independently of the stock market.");
  if (!r.is_benchmark && m.correlation != null && m.correlation > 0.7) add("weakness", "Mostly rides the stock market, so it adds little that holding the market does not.");

  const bRet = (c: Comparison["crises"][number]) => (bench ? c.returns[bench.strategy] : undefined);
  for (const c of comparison?.crises ?? []) {
    const v = c.returns[r.strategy];
    const b = bRet(c);
    if (v == null || r.is_benchmark) continue;
    if (v > 0.02 && (b == null || b < 0)) add("strength", `Made money in the ${c.name} (${pctSigned(v)}).`);
    else if (v < -0.2) add("weakness", `Lost ${Math.abs(v * 100).toFixed(0)}% in the ${c.name}.`);
  }

  for (const t of r.gauntlet?.tests ?? []) {
    if (t.group !== "real" || t.passed == null) continue;
    add(t.passed ? "strength" : "weakness", `${t.passed ? "Passes" : "Fails"} the "${t.name.toLowerCase()}" test.`, t.plain);
  }
  const g = r.gauntlet;
  if (g && !g.beats_sp500) add("weakness", "Does not beat the S&P 500 after costs and counting every idea tried.");
  return out;
}

function pctSigned(v: number) {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)}%`;
}

export interface Verdict { label: string; tone: "good" | "accent" | "neutral" | "bad"; plain: string }

/** One word and one sentence a newcomer can read: did this strategy hold up? */
export function verdictOf(r: StrategyRun): Verdict {
  if (r.is_benchmark) return { label: "Benchmark", tone: "neutral", plain: "The US stock market. Every strategy has to beat this." };
  const g = r.gauntlet;
  if (!g) return { label: "Not tested", tone: "neutral", plain: "Has not been through the gauntlet of tests yet." };
  const share = g.total ? g.passed / g.total : 0;
  const beats = g.beats_sp500 ? "beats the S&P 500 after costs" : "does not beat the S&P 500 after costs";
  const tests = `passed ${g.passed} of ${g.total} tests`;
  if (g.beats_sp500 && g.passed === g.total) return { label: "Passed", tone: "good", plain: `It ${tests} and ${beats}.` };
  if (share >= 0.6) return { label: "Promising", tone: "accent", plain: g.beats_sp500 ? `It ${beats}, but only ${tests}.` : `It ${tests}, but ${beats}.` };
  return { label: "Not proven", tone: "bad", plain: `It ${tests} and ${beats}.` };
}
