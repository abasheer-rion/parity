// Parity's rule format (parity-rules-1): what a strategy does, as data. Pine Script, a simple
// Python strategy and a plain-language description are all turned into this one shape, which
// the backtester runs on our daily prices (backtest.ts). Programs and AI apps can also send it
// directly. Pure data and pure functions; no React, no network.
//
// An expression is JSON in prefix form, so it is short and any model can write it:
//   10                         a number
//   "close"                    the day's closing price (the only price we hold)
//   "fast"                     an input or a value defined in `let`
//   ["sma", "close", 20]       a function: the name, then its arguments
//   [">", "fast", "slow"]      comparisons, ["and", a, b], ["or", a, b], ["not", a]
//   ["crossover", "fast", "slow"]
//   ["prev", "close", 1]       a value some days back (close[1] in Pine)
//
// Example: buy when the 10-day average crosses above the 30-day one, sell on the cross back.
//   { "format": "parity-rules-1", "market": "BTCUSD", "inputs": { "fast": 10, "slow": 30 },
//     "let": { "f": ["sma", "close", "fast"], "s": ["sma", "close", "slow"] },
//     "long": { "entry": ["crossover", "f", "s"], "exit": ["crossunder", "f", "s"] } }

export const RULES_FORMAT = "parity-rules-1";

export type Expr = number | boolean | string | Expr[];

export interface SideRules {
  /** Open a position (or turn one around) on days this is true. */
  entry?: Expr;
  /** Close the position on days this is true. */
  exit?: Expr;
  /** Close when the day's close is at or beyond this price. "entry_price" is the price paid. */
  stop?: Expr;
  /** Take profit when the day's close reaches this price. */
  limit?: Expr;
  /** Shorthand: stop this share below (long) or above (short) the entry price. 0.05 is 5%. */
  stop_loss?: number;
  /** Shorthand: take profit this share away from the entry price. */
  take_profit?: number;
}

export interface Rules {
  format: typeof RULES_FORMAT;
  /** One of the markets we hold daily prices for (MARKETS). */
  market: string;
  /** Settings a person would tune: lengths, levels. Our sweep varies these. */
  inputs: Record<string, number>;
  /** Named values, in order; each may use the inputs and the ones before it. */
  let: Record<string, Expr>;
  long?: SideRules;
  short?: SideRules;
  /** Share of the account each position uses: 1 is all of it, 0.5 half. Default 1. */
  size?: number;
  /** Costs the strategy itself declares, one way, as a share of the amount traded. We use the larger of this and ours. */
  cost?: number;
  /** First and last day to test, "YYYY-MM-DD". Default: all the prices we hold. */
  from?: string;
  to?: string;
}

/** The markets we hold daily prices for, with honest one-way costs for a retail trader. */
export interface Market { id: string; name: string; cost: number; costWhy: string; tick: number; aliases: string[] }

const FX_COST = 0.0001, FX_WHY = "1 basis point each way, about the spread plus commission a retail account pays on a major currency pair";
export const MARKETS: Market[] = [
  { id: "EURUSD", name: "Euro against the US dollar", cost: FX_COST, costWhy: FX_WHY, tick: 0.00001, aliases: ["EUR/USD", "EURUSD", "FX:EURUSD", "OANDA:EURUSD"] },
  { id: "GBPUSD", name: "British pound against the US dollar", cost: FX_COST, costWhy: FX_WHY, tick: 0.00001, aliases: ["GBP/USD", "CABLE"] },
  { id: "AUDUSD", name: "Australian dollar against the US dollar", cost: FX_COST, costWhy: FX_WHY, tick: 0.00001, aliases: ["AUD/USD"] },
  { id: "NZDUSD", name: "New Zealand dollar against the US dollar", cost: 0.00015, costWhy: "1.5 basis points each way, a retail spread on a smaller major pair", tick: 0.00001, aliases: ["NZD/USD"] },
  { id: "USDJPY", name: "US dollar against the Japanese yen", cost: FX_COST, costWhy: FX_WHY, tick: 0.001, aliases: ["USD/JPY"] },
  { id: "USDCAD", name: "US dollar against the Canadian dollar", cost: FX_COST, costWhy: FX_WHY, tick: 0.00001, aliases: ["USD/CAD"] },
  { id: "USDCHF", name: "US dollar against the Swiss franc", cost: FX_COST, costWhy: FX_WHY, tick: 0.00001, aliases: ["USD/CHF"] },
  { id: "USDNOK", name: "US dollar against the Norwegian krone", cost: 0.0003, costWhy: "3 basis points each way, a retail spread on a thin currency pair", tick: 0.0001, aliases: ["USD/NOK"] },
  { id: "USDSEK", name: "US dollar against the Swedish krona", cost: 0.0003, costWhy: "3 basis points each way, a retail spread on a thin currency pair", tick: 0.0001, aliases: ["USD/SEK"] },
  { id: "BTCUSD", name: "Bitcoin in US dollars", cost: 0.0015, costWhy: "0.15% each way: a 0.1% exchange fee plus 0.05% for the spread and slippage", tick: 0.01, aliases: ["BTC", "BITCOIN", "XBTUSD", "BTCUSDT", "BTC/USD", "BTC-USD", "BINANCE:BTCUSDT", "COINBASE:BTCUSD"] },
  { id: "ETHUSD", name: "Ether in US dollars", cost: 0.0015, costWhy: "0.15% each way: a 0.1% exchange fee plus 0.05% for the spread and slippage", tick: 0.01, aliases: ["ETH", "ETHER", "ETHEREUM", "ETHUSDT", "ETH/USD", "ETH-USD"] },
  { id: "SPX", name: "S&P 500 index", cost: 0.0002, costWhy: "2 basis points each way, the spread on an index fund or future", tick: 0.01, aliases: ["SPX", "SP500", "S&P500", "S&P 500", "US500", "SPY", "ES", "ES1!", "SPX500"] },
];

export function marketOf(s: string | undefined | null): Market | null {
  if (!s) return null;
  const v = s.trim().toUpperCase().replace(/\s+/g, " ");
  return MARKETS.find((m) => m.id === v || m.aliases.some((a) => a.toUpperCase() === v)) ?? null;
}

/** What each function takes and what it needs from the data. Lengths must be fixed numbers or inputs. */
export interface FnSpec { args: number; optional?: number; lengths?: number[]; words: string }
export const FUNCS: Record<string, FnSpec> = {
  sma: { args: 2, lengths: [1], words: "simple moving average" },
  ema: { args: 2, lengths: [1], words: "exponential moving average" },
  rma: { args: 2, lengths: [1], words: "Wilder's moving average" },
  wma: { args: 2, lengths: [1], words: "weighted moving average" },
  rsi: { args: 2, lengths: [1], words: "relative strength index" },
  roc: { args: 2, lengths: [1], words: "rate of change, in percent" },
  change: { args: 2, lengths: [1], words: "change over some days" },
  stdev: { args: 2, lengths: [1], words: "standard deviation" },
  highest: { args: 2, lengths: [1], words: "highest value over some days" },
  lowest: { args: 2, lengths: [1], words: "lowest value over some days" },
  cci: { args: 2, lengths: [1], words: "commodity channel index on the close" },
  macd: { args: 3, lengths: [1, 2], words: "MACD line" },
  macd_signal: { args: 4, lengths: [1, 2, 3], words: "MACD signal line" },
  macd_hist: { args: 4, lengths: [1, 2, 3], words: "MACD histogram" },
  bb_upper: { args: 3, lengths: [1], words: "upper Bollinger band" },
  bb_lower: { args: 3, lengths: [1], words: "lower Bollinger band" },
  prev: { args: 2, lengths: [1], words: "value some days back" },
  crossover: { args: 2, words: "crosses above" },
  crossunder: { args: 2, words: "crosses below" },
  cross: { args: 2, words: "crosses" },
  abs: { args: 1, words: "absolute value" },
  max: { args: 2, words: "larger of two" },
  min: { args: 2, words: "smaller of two" },
  log: { args: 1, words: "natural log" },
  sqrt: { args: 1, words: "square root" },
  nz: { args: 1, optional: 1, words: "replace a missing value" },
  na: { args: 1, words: "is missing" },
  if: { args: 3, words: "choose one of two" },
  "+": { args: 2, words: "plus" }, "-": { args: 2, words: "minus" }, "*": { args: 2, words: "times" }, "/": { args: 2, words: "divided by" },
  neg: { args: 1, words: "minus" }, pow: { args: 2, words: "to the power" },
  ">": { args: 2, words: "above" }, "<": { args: 2, words: "below" }, ">=": { args: 2, words: "at or above" }, "<=": { args: 2, words: "at or below" },
  "==": { args: 2, words: "equal to" }, "!=": { args: 2, words: "not equal to" },
  and: { args: 2, words: "and" }, or: { args: 2, words: "or" }, not: { args: 1, words: "not" },
};

/** Values the rules can read besides inputs and `let`. */
export const BUILTINS: Record<string, string> = {
  close: "the day's closing price",
  entry_price: "the price the open position was entered at",
  position: "1 when long, -1 when short, 0 when flat",
  year: "the year", month: "the month (1 to 12)", dayofweek: "the day of the week (1 is Sunday, as in Pine)", dayofmonth: "the day of the month",
  time: "the day's date as milliseconds since 1970",
  nan: "a missing value (Pine's na)",
};

/** Words for data we do not hold, so a strategy that needs them is refused by name. */
export const NEEDS_MORE_DATA: Record<string, string> = {
  open: "the day's opening price", high: "the day's high", low: "the day's low", volume: "volume",
  hl2: "the day's high and low", hlc3: "the day's high and low", ohlc4: "the day's open, high and low", hlcc4: "the day's high and low",
  atr: "the day's high and low (average true range)", tr: "the day's high and low (true range)", stoch: "the day's high and low (stochastic)",
  vwap: "volume", obv: "volume", mfi: "volume", adx: "the day's high and low", dmi: "the day's high and low", supertrend: "the day's high and low",
  sar: "the day's high and low", wpr: "the day's high and low", vwma: "volume", donchian: "the day's high and low", kc: "the day's high and low",
};

export class RulesError extends Error {
  constructor(message: string, public problems: string[] = [message]) { super(message); }
}

const isName = (s: string) => /^[A-Za-z_][A-Za-z0-9_.]*$/.test(s);

/**
 * Checks a rule set and returns it tidied, or throws RulesError with every problem in words.
 * Names that are not inputs, `let` values or built-ins, unknown functions and data we do not
 * hold are each named.
 */
export function validateRules(raw: unknown): Rules {
  const problems: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new RulesError("The rules must be a JSON object.");
  const r = raw as Record<string, unknown>;
  const market = marketOf(typeof r.market === "string" ? r.market : null);
  if (!market) problems.push(`"market" must be one of ${MARKETS.map((m) => m.id).join(", ")}${typeof r.market === "string" ? `; "${r.market}" is not a market we hold daily prices for` : ""}.`);
  const inputs: Record<string, number> = {};
  if (r.inputs != null && (typeof r.inputs !== "object" || Array.isArray(r.inputs))) problems.push('"inputs" must be an object of names and numbers.');
  for (const [k, v] of Object.entries((r.inputs as Record<string, unknown>) ?? {})) {
    if (!isName(k)) problems.push(`The input name "${k}" is not a plain name.`);
    else if (typeof v !== "number" || !Number.isFinite(v)) problems.push(`The input "${k}" must be a number.`);
    else inputs[k] = v;
  }
  const lets: Record<string, Expr> = {};
  const known = new Set<string>([...Object.keys(BUILTINS), ...Object.keys(inputs)]);
  if (r.let != null && (typeof r.let !== "object" || Array.isArray(r.let))) problems.push('"let" must be an object of names and expressions.');
  for (const [k, v] of Object.entries((r.let as Record<string, unknown>) ?? {})) {
    if (!isName(k)) { problems.push(`The name "${k}" in "let" is not a plain name.`); continue; }
    checkExpr(v, `let.${k}`, known, inputs, problems);
    lets[k] = v as Expr;
    known.add(k);
  }
  const side = (key: "long" | "short"): SideRules | undefined => {
    const s = r[key];
    if (s == null) return undefined;
    if (typeof s !== "object" || Array.isArray(s)) { problems.push(`"${key}" must be an object with entry and exit.`); return undefined; }
    const o = s as Record<string, unknown>;
    const out: SideRules = {};
    for (const f of ["entry", "exit", "stop", "limit"] as const) {
      if (o[f] == null) continue;
      checkExpr(o[f], `${key}.${f}`, known, inputs, problems);
      out[f] = o[f] as Expr;
    }
    for (const f of ["stop_loss", "take_profit"] as const) {
      if (o[f] == null) continue;
      if (typeof o[f] !== "number" || !(o[f] as number > 0) || (o[f] as number) > 10) problems.push(`"${key}.${f}" must be a share of the price above 0, such as 0.05 for 5%.`);
      else out[f] = o[f] as number;
    }
    for (const k of Object.keys(o)) if (!["entry", "exit", "stop", "limit", "stop_loss", "take_profit"].includes(k)) problems.push(`"${key}.${k}" is not part of the rule format.`);
    return out;
  };
  const long = side("long"), short = side("short");
  if (!long?.entry && !short?.entry) problems.push('The rules never open a position: give "long.entry" or "short.entry".');
  const size = r.size == null ? undefined : Number(r.size);
  if (size != null && !(size > 0 && size <= 10)) problems.push('"size" must be a share of the account above 0 and at most 10 (1 is all of it).');
  const cost = r.cost == null ? undefined : Number(r.cost);
  if (cost != null && !(cost >= 0 && cost < 0.1)) problems.push('"cost" must be a share of the amount traded, such as 0.001 for 0.1%.');
  for (const f of ["from", "to"] as const) if (r[f] != null && (typeof r[f] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r[f] as string))) problems.push(`"${f}" must be a date written YYYY-MM-DD.`);
  for (const k of Object.keys(r)) if (!["format", "market", "inputs", "let", "long", "short", "size", "cost", "from", "to"].includes(k)) problems.push(`"${k}" is not part of the rule format.`);
  if (problems.length) throw new RulesError(problems.length === 1 ? problems[0] : `The rules have ${problems.length} problems.`, problems);
  const out: Rules = { format: RULES_FORMAT, market: market!.id, inputs, let: lets };
  if (long) out.long = long;
  if (short) out.short = short;
  if (size != null) out.size = size;
  if (cost != null) out.cost = cost;
  if (r.from) out.from = r.from as string;
  if (r.to) out.to = r.to as string;
  return out;
}

function checkExpr(e: unknown, where: string, known: Set<string>, inputs: Record<string, number>, problems: string[]): void {
  if (typeof e === "number") { if (!Number.isFinite(e)) problems.push(`${where}: numbers must be finite.`); return; }
  if (typeof e === "boolean") return;
  if (typeof e === "string") {
    if (known.has(e)) return;
    const lower = e.toLowerCase();
    if (NEEDS_MORE_DATA[lower]) problems.push(`${where}: "${e}" needs ${NEEDS_MORE_DATA[lower]}, and we hold one closing price a day.`);
    else problems.push(`${where}: "${e}" is not an input, a value defined earlier in "let", or one of ${Object.keys(BUILTINS).join(", ")}.`);
    return;
  }
  if (!Array.isArray(e) || !e.length || typeof e[0] !== "string") { problems.push(`${where}: an expression is a number, a name, or a list starting with a function name.`); return; }
  const [fn, ...args] = e as [string, ...unknown[]];
  const spec = FUNCS[fn];
  if (!spec) {
    const need = NEEDS_MORE_DATA[fn.toLowerCase()];
    problems.push(need ? `${where}: "${fn}" needs ${need}, and we hold one closing price a day.` : `${where}: "${fn}" is not a function we can run. We can run ${Object.keys(FUNCS).filter((k) => /^[a-z]/.test(k)).join(", ")}.`);
    return;
  }
  const max = spec.args + (spec.optional ?? 0);
  if (args.length < spec.args || args.length > max) { problems.push(`${where}: "${fn}" takes ${spec.optional ? `${spec.args} or ${max}` : spec.args} argument${max === 1 ? "" : "s"}, not ${args.length}.`); return; }
  args.forEach((a, i) => {
    if (spec.lengths?.includes(i)) {
      const ok = (typeof a === "number" && Number.isInteger(a) && a >= 1 && a <= 1000) || (typeof a === "string" && inputs[a] != null);
      if (!ok) problems.push(`${where}: the length in "${fn}" must be a whole number from 1 to 1000 or an input name.`);
      return;
    }
    checkExpr(a, where, known, inputs, problems);
  });
}

/** An expression in words, short: ["crossover","f","s"] gives "f crosses above s". */
export function exprText(e: Expr): string {
  if (typeof e === "number") return String(e);
  if (typeof e === "boolean") return e ? "always" : "never";
  if (typeof e === "string") return e;
  const [fn, ...a] = e as [string, ...Expr[]];
  const t = a.map(exprText);
  switch (fn) {
    case "crossover": return `${t[0]} crosses above ${t[1]}`;
    case "crossunder": return `${t[0]} crosses below ${t[1]}`;
    case "cross": return `${t[0]} crosses ${t[1]}`;
    case "and": case "or": return `(${t[0]} ${fn} ${t[1]})`;
    case "not": return `not ${t[0]}`;
    case "neg": return `-${t[0]}`;
    case "prev": return `${t[0]} ${t[1]} day${t[1] === "1" ? "" : "s"} ago`;
    case "if": return `(${t[1]} if ${t[0]}, else ${t[2]})`;
    default:
      if (/^[^a-z]/.test(fn)) return `${t[0]} ${fn} ${t[1]}`;
      return `${fn}(${t.join(", ")})`;
  }
}
