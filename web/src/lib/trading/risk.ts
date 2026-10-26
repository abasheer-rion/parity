// Server-side checks on every order before it reaches a broker (DEC-0046). The ticket runs
// the same checks for a preview, but only the server's answer counts. Imported by Pages
// Functions, so nothing here may read import.meta.env.
import type { AssetClass, OrderRequest, RiskLimits, TimeInForce, TradingMode } from "./types";

export const DEFAULT_LIMITS: RiskLimits = {
  maxOrderValue: 25_000,
  maxQty: 10_000,
  priceCollar: 0.1,
  shortingAllowed: false,
  ordersPerMinute: 20,
};

/** FINRA's pattern day trader line: 4 or more day trades in 5 business days in a margin
 *  account under $25,000 equity. We warn at the third, before the fourth. */
export const PDT_EQUITY = 25_000;
export const PDT_WARN_AT = 3;

/** SEC fee on sells (per dollar sold) and FINRA trading activity fee (per share sold, capped).
 *  Estimates only: the broker's figure is final. Commission at Alpaca is zero. */
export const SEC_FEE_RATE = 0.0000278;
export const TAF_PER_SHARE = 0.000166;
export const TAF_CAP = 8.3;

export interface RiskContext {
  mode: TradingMode;
  /** The latest price we know for the symbol, or null if none. */
  lastPrice: number | null;
  /** This person's current holding of the symbol (positive long). */
  heldQty: number;
  /** Shares already promised to this person's open sell orders. */
  pendingSellQty: number;
  buyingPower: number | null;
  equity: number | null;
  /** Day trades in the last 5 business days. */
  dayTrades: number;
  limits?: RiskLimits;
}

export interface RiskResult { ok: boolean; errors: string[]; warnings: string[]; estQty: number | null; estCost: number | null; estFees: number }

export const SYMBOL_RE = /^[A-Z][A-Z0-9.]{0,9}(\/[A-Z]{2,6})?$/;
export const assetClassOf = (symbol: string): AssetClass => (symbol.includes("/") ? "crypto" : "us_equity");

const CRYPTO_TIF: TimeInForce[] = ["gtc", "ioc"];
const pos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function estimateFees(side: OrderRequest["side"], qty: number | null, value: number | null, assetClass: AssetClass): number {
  if (side !== "sell" || assetClass === "crypto" || !qty || !value) return 0;
  const sec = Math.ceil(value * SEC_FEE_RATE * 100) / 100;
  const taf = Math.min(TAF_CAP, Math.ceil(qty * TAF_PER_SHARE * 100) / 100);
  return Math.round((sec + taf) * 100) / 100;
}

/** Normalises the symbol and checks the order. Never throws. */
export function checkOrder(req: OrderRequest, ctx: RiskContext): RiskResult {
  const L = ctx.limits ?? DEFAULT_LIMITS;
  const errors: string[] = [];
  const warnings: string[] = [];
  const symbol = String(req.symbol ?? "").trim().toUpperCase();
  const cls = assetClassOf(symbol);
  const orderClass = req.orderClass ?? "simple";

  if (!SYMBOL_RE.test(symbol)) errors.push("Unknown symbol");
  if (req.side !== "buy" && req.side !== "sell") errors.push("Pick buy or sell");
  if (!["market", "limit", "stop", "stop_limit"].includes(req.type)) errors.push("Unknown order type");
  if (!["day", "gtc", "ioc", "fok", "opg", "cls"].includes(req.timeInForce)) errors.push("Unknown time in force");
  if (cls === "crypto" && !CRYPTO_TIF.includes(req.timeInForce)) errors.push("Crypto orders are GTC or IOC");

  const hasQty = req.qty !== undefined && req.qty !== null;
  const hasNotional = req.notional !== undefined && req.notional !== null;
  if (hasQty === hasNotional) errors.push("Enter a quantity or a dollar amount, not both");
  if (hasQty && !pos(req.qty)) errors.push("Quantity must be above zero");
  if (hasNotional && !pos(req.notional)) errors.push("Amount must be above zero");
  if (hasNotional && (req.type !== "market" || (cls === "us_equity" && req.timeInForce !== "day"))) errors.push("A dollar amount works with market orders only, for the day");
  if (hasQty && pos(req.qty) && req.qty > L.maxQty) errors.push(`Quantity is over the ${L.maxQty.toLocaleString("en-US")} limit`);

  const needsLimit = req.type === "limit" || req.type === "stop_limit";
  const needsStop = req.type === "stop" || req.type === "stop_limit";
  if (needsLimit && !pos(req.limitPrice)) errors.push("Enter a limit price");
  if (needsStop && !pos(req.stopPrice)) errors.push("Enter a stop price");
  if (!needsLimit && req.limitPrice !== undefined && req.limitPrice !== null) errors.push("Only limit orders take a limit price");
  if (!needsStop && req.stopPrice !== undefined && req.stopPrice !== null) errors.push("Only stop orders take a stop price");

  const last = ctx.lastPrice;
  if (last === null || !pos(last)) {
    if (req.type === "market") errors.push("No recent price for this symbol");
    else warnings.push("No recent price to check against");
  } else {
    const collar = (p: number | undefined, what: string) => {
      if (pos(p) && Math.abs(p - last) / last > L.priceCollar) errors.push(`${what} is more than ${Math.round(L.priceCollar * 100)}% from the last price`);
    };
    collar(req.limitPrice, "Limit price");
    collar(req.stopPrice, "Stop price");
    if (orderClass === "bracket") {
      collar(req.takeProfit, "Take profit");
      collar(req.stopLoss, "Stop loss");
    }
  }

  if (orderClass === "bracket") {
    if (cls === "crypto") errors.push("Bracket orders are for stocks and ETFs");
    if (!pos(req.takeProfit) || !pos(req.stopLoss)) errors.push("A bracket needs a take profit and a stop loss");
    if (hasNotional) errors.push("A bracket needs a whole-share quantity");
    if (hasQty && pos(req.qty) && !Number.isInteger(req.qty)) errors.push("A bracket needs a whole-share quantity");
    if (req.timeInForce !== "day" && req.timeInForce !== "gtc") errors.push("A bracket is DAY or GTC");
    const ref = req.limitPrice ?? last ?? null;
    if (pos(req.takeProfit) && pos(req.stopLoss) && ref) {
      const okOrder = req.side === "buy" ? req.takeProfit > ref && req.stopLoss < ref : req.takeProfit < ref && req.stopLoss > ref;
      if (!okOrder) errors.push(req.side === "buy" ? "Take profit must be above the entry and stop loss below it" : "Take profit must be below the entry and stop loss above it");
    }
  }

  const price = req.type === "limit" || req.type === "stop_limit" ? req.limitPrice ?? last : req.type === "stop" ? req.stopPrice ?? last : last;
  const estQty = hasQty && pos(req.qty) ? req.qty : hasNotional && pos(req.notional) && pos(price) ? req.notional / price : null;
  const estCost = hasNotional && pos(req.notional) ? req.notional : estQty !== null && pos(price) ? estQty * price : null;

  if (estCost !== null && estCost > L.maxOrderValue) errors.push(`Order value is over the $${L.maxOrderValue.toLocaleString("en-US")} limit`);
  if (req.side === "buy" && estCost !== null && ctx.buyingPower !== null && estCost > ctx.buyingPower) errors.push("Not enough buying power");

  if (req.side === "sell") {
    const free = ctx.heldQty - ctx.pendingSellQty;
    if (!L.shortingAllowed && cls === "crypto" && estQty !== null && estQty > free + 1e-9) errors.push("Crypto cannot be sold short");
    else if (!L.shortingAllowed && estQty !== null && estQty > free + 1e-9) errors.push(free > 0 ? `You can sell up to ${+free.toFixed(6)}` : "Short selling is off. Sell only what you hold");
  }

  const isMargin = ctx.equity !== null && ctx.equity < PDT_EQUITY;
  if (cls === "us_equity" && isMargin && ctx.dayTrades >= PDT_WARN_AT) {
    warnings.push(`${ctx.dayTrades} day trades in 5 days. A 4th under $25,000 equity marks the account a pattern day trader`);
  }
  if (req.type === "market" && cls === "us_equity" && req.timeInForce !== "day") warnings.push("Market orders outside DAY may fill at the next open");

  const estFees = estimateFees(req.side, estQty, estCost, cls);
  return { ok: errors.length === 0, errors, warnings, estQty, estCost, estFees };
}

/** The order with its symbol normalised and unused fields dropped, as stored and sent. */
export function normalise(req: OrderRequest): OrderRequest & { symbol: string; assetClass: AssetClass } {
  const symbol = String(req.symbol).trim().toUpperCase();
  const out: OrderRequest & { symbol: string; assetClass: AssetClass } = {
    symbol, assetClass: assetClassOf(symbol), side: req.side, type: req.type, timeInForce: req.timeInForce, orderClass: req.orderClass ?? "simple",
  };
  if (req.qty !== undefined && req.qty !== null) out.qty = req.qty;
  if (req.notional !== undefined && req.notional !== null) out.notional = Math.round(req.notional * 100) / 100;
  if (req.limitPrice !== undefined && req.limitPrice !== null) out.limitPrice = req.limitPrice;
  if (req.stopPrice !== undefined && req.stopPrice !== null) out.stopPrice = req.stopPrice;
  if (out.orderClass === "bracket") { out.takeProfit = req.takeProfit; out.stopLoss = req.stopLoss; }
  return out;
}

/** Idempotency keys: what the client sends, stored as the broker's client_order_id. */
export const IDEM_RE = /^[A-Za-z0-9_-]{8,48}$/;
