// The shapes the Trade app and the /api/trade endpoints share (DEC-0046). Imported by both
// the browser and Pages Functions, so nothing here may read import.meta.env.

/** demo: pretend money in Alpaca's shared paper account (or in the browser when no keys are
 *  set). sandbox: the person's own Alpaca Broker API sandbox account, also pretend money.
 *  live: real money. Refused unless every gate in mode.ts passes. */
export type TradingMode = "demo" | "sandbox" | "live";

/** Which engine carries out demo orders. "browser" is the in-browser demo account
 *  (DEC-0034) used when the server has no Alpaca keys. */
export type TradingEngine = "browser" | "alpaca_paper" | "alpaca_broker_sandbox" | "alpaca_broker_live";

export type AssetClass = "us_equity" | "crypto";
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderClass = "simple" | "bracket";
export type TimeInForce = "day" | "gtc" | "ioc" | "fok" | "opg" | "cls";

/** The badge every ticket, position and confirmation shows. Never empty. */
export const MODE_BADGE: Record<TradingMode, string> = {
  demo: "Demo money",
  sandbox: "Sandbox",
  live: "Real money",
};

export interface TradingStatus {
  mode: TradingMode;
  engine: TradingEngine;
  badge: string;
  /** Short plain reasons the server fell back, such as "Sandbox keys are not set". */
  notes: string[];
  /** Sandbox only: whether this person has a sandbox account, and whether it is funded. */
  account?: { status: string; funded: boolean } | null;
  /** Limits the server enforces, so the ticket can say them before the server refuses. */
  limits: RiskLimits;
}

export interface RiskLimits {
  maxOrderValue: number;
  maxQty: number;
  /** A limit or stop price this far from the last price (as a fraction) is refused. */
  priceCollar: number;
  shortingAllowed: boolean;
  ordersPerMinute: number;
}

export interface OrderRequest {
  symbol: string;
  assetClass?: AssetClass;
  side: OrderSide;
  type: OrderType;
  /** Exactly one of qty and notional. Notional is dollars, market orders only. */
  qty?: number;
  notional?: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  orderClass?: OrderClass;
  /** Bracket legs. */
  takeProfit?: number;
  stopLoss?: number;
}

export interface Preview {
  ok: boolean;
  badge: string;
  mode: TradingMode;
  /** The price the estimate used, and where it came from. */
  price: number | null;
  priceSource: string;
  estQty: number | null;
  estCost: number | null;
  /** Commission is zero at Alpaca; regulatory fees apply to sells. */
  estFees: number;
  errors: string[];
  warnings: string[];
}

export interface TradeOrder {
  id: string;
  clientOrderId: string;
  brokerOrderId: string | null;
  mode: TradingMode;
  symbol: string;
  assetClass: AssetClass;
  side: OrderSide;
  type: OrderType;
  orderClass: OrderClass;
  qty: number | null;
  notional: number | null;
  limitPrice: number | null;
  stopPrice: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
  timeInForce: TimeInForce;
  status: string;
  filledQty: number;
  filledAvgPrice: number | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeFill {
  at: string;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
}

export interface TradePosition {
  symbol: string;
  assetClass: AssetClass;
  qty: number;
  avgCost: number;
  lastPrice: number | null;
  marketValue: number | null;
  unrealizedPl: number | null;
  realizedPl: number;
}

export interface TradeBalances {
  mode: TradingMode;
  badge: string;
  cash: number | null;
  buyingPower: number | null;
  equity: number | null;
  /** Realized plus unrealized, from this person's own fills. */
  totalPl: number | null;
}

/** Order statuses that can still change. */
export const OPEN_STATUSES = new Set(["sending", "new", "accepted", "pending_new", "partially_filled", "held", "accepted_for_bidding", "pending_cancel", "pending_replace", "calculated"]);
