// The Alpaca adapter, server side only (DEC-0046). Imported by Pages Functions; keys come
// from the Pages environment and never reach the browser or a log.
//
//   Trading API, paper    https://paper-api.alpaca.markets/v2         demo mode, one shared
//                                                                    practice account
//   Broker API, sandbox   https://broker-api.sandbox.alpaca.markets   sandbox mode, one
//                                                                    account per person
//   Broker API, live      https://broker-api.alpaca.markets           live mode. Only built
//                                                                    by gatewayFor() after
//                                                                    every live gate passed
//
// Docs: https://docs.alpaca.markets/reference (orders, positions, account) and
// https://docs.alpaca.markets/docs/about-broker-api (accounts, funding).
import type { ModeDecision, TradingEnv } from "./mode";
import type { AssetClass, OrderRequest, TradingEngine } from "./types";

export const PAPER_BASE = "https://paper-api.alpaca.markets";
export const BROKER_SANDBOX_BASE = "https://broker-api.sandbox.alpaca.markets";
export const BROKER_LIVE_BASE = "https://broker-api.alpaca.markets";
export const DATA_BASE = "https://data.alpaca.markets";

export class BrokerError extends Error {
  constructor(public status: number, message: string, public code: string | null = null) {
    super(message);
    this.name = "BrokerError";
  }
  /** A 4xx the person can fix (bad price, not enough buying power). Not a warning. */
  get isUserError(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 401 && this.status !== 403 && this.status !== 429;
  }
}

/** The order as Alpaca returns it (the fields we use). */
export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  status: string;
  symbol: string;
  side: string;
  type?: string;
  order_type?: string;
  qty: string | null;
  notional: string | null;
  filled_qty: string;
  filled_avg_price: string | null;
  limit_price: string | null;
  stop_price: string | null;
  time_in_force: string;
  created_at: string;
  updated_at: string;
  legs?: AlpacaOrder[] | null;
}

export interface AlpacaPosition { symbol: string; qty: string; avg_entry_price: string; current_price: string | null; asset_class: string }
export interface AlpacaAccount { cash: string; buying_power: string; equity: string; daytrade_count?: number; status?: string }

export interface OrderPatch { qty?: number; limitPrice?: number; stopPrice?: number; timeInForce?: string }

/** One shape for the paper account and the Broker API. `account` is the Broker API
 *  account id; the paper gateway ignores it (there is one account). */
export interface Gateway {
  readonly engine: TradingEngine;
  placeOrder(account: string | null, req: OrderRequest & { symbol: string; assetClass: AssetClass }, clientOrderId: string): Promise<AlpacaOrder>;
  orderByClientId(account: string | null, clientOrderId: string): Promise<AlpacaOrder | null>;
  cancelOrder(account: string | null, brokerOrderId: string): Promise<void>;
  replaceOrder(account: string | null, brokerOrderId: string, patch: OrderPatch, clientOrderId: string): Promise<AlpacaOrder>;
  positions(account: string | null): Promise<AlpacaPosition[]>;
  account(account: string | null): Promise<AlpacaAccount>;
  lastPrice(symbol: string, assetClass: AssetClass): Promise<number | null>;
}

/** Extra calls only the Broker API has: opening and funding sandbox accounts. */
export interface BrokerAccounts {
  createAccount(body: Record<string, unknown>): Promise<{ id: string; status: string }>;
  getAccount(id: string): Promise<{ id: string; status: string }>;
  createAchRelationship(id: string, body: Record<string, unknown>): Promise<{ id: string; status: string }>;
  listAchRelationships(id: string): Promise<{ id: string; status: string }[]>;
  createTransfer(id: string, body: Record<string, unknown>): Promise<{ id: string; status: string }>;
}

type Fetch = typeof fetch;

/** Builds the Alpaca order body from a checked, normalised request. */
export function orderBody(req: OrderRequest & { symbol: string }, clientOrderId: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    symbol: req.symbol, side: req.side, type: req.type, time_in_force: req.timeInForce, client_order_id: clientOrderId,
  };
  if (req.qty !== undefined) body.qty = String(req.qty);
  if (req.notional !== undefined) body.notional = req.notional.toFixed(2);
  if (req.limitPrice !== undefined) body.limit_price = String(req.limitPrice);
  if (req.stopPrice !== undefined) body.stop_price = String(req.stopPrice);
  if (req.orderClass === "bracket") {
    body.order_class = "bracket";
    body.take_profit = { limit_price: String(req.takeProfit) };
    body.stop_loss = { stop_price: String(req.stopLoss) };
  }
  return body;
}

export function patchBody(p: OrderPatch, clientOrderId: string): Record<string, unknown> {
  const b: Record<string, unknown> = { client_order_id: clientOrderId };
  if (p.qty !== undefined) b.qty = String(p.qty);
  if (p.limitPrice !== undefined) b.limit_price = String(p.limitPrice);
  if (p.stopPrice !== undefined) b.stop_price = String(p.stopPrice);
  if (p.timeInForce !== undefined) b.time_in_force = p.timeInForce;
  return b;
}

function client(base: string, headers: Record<string, string>, fetcher: Fetch) {
  return async function call<T>(method: string, path: string, body?: unknown, allow404 = false): Promise<T> {
    let res: Response;
    try {
      res = await fetcher(`${base}${path}`, {
        method,
        headers: { ...headers, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      throw new BrokerError(503, `The broker did not answer (${e instanceof Error ? e.name : "network"})`, "network");
    }
    if (allow404 && res.status === 404) return null as T;
    const text = await res.text();
    if (!res.ok) {
      let message = `The broker answered ${res.status}`;
      let code: string | null = null;
      try {
        const j = JSON.parse(text) as { message?: unknown; code?: unknown };
        if (typeof j.message === "string") message = j.message.slice(0, 200);
        if (j.code !== undefined) code = String(j.code).slice(0, 20);
      } catch { /* not JSON */ }
      throw new BrokerError(res.status, message, code);
    }
    return (text ? JSON.parse(text) : null) as T;
  };
}

const q = encodeURIComponent;

function lastPriceVia(headers: Record<string, string>, fetcher: Fetch, dataBase = DATA_BASE) {
  const data = client(dataBase, headers, fetcher);
  return async (symbol: string, assetClass: AssetClass): Promise<number | null> => {
    try {
      if (assetClass === "crypto") {
        const r = await data<{ trades?: Record<string, { p: number }> }>("GET", `/v1beta3/crypto/us/latest/trades?symbols=${q(symbol)}`);
        const p = r?.trades?.[symbol]?.p;
        return typeof p === "number" && p > 0 ? p : null;
      }
      const r = await data<{ trade?: { p: number } }>("GET", `/v2/stocks/${q(symbol)}/trades/latest?feed=iex`);
      const p = r?.trade?.p;
      return typeof p === "number" && p > 0 ? p : null;
    } catch {
      return null;
    }
  };
}

/** Alpaca Trading API on the paper account. Refuses any base that is not paper. */
export function paperGateway(keyId: string, secret: string, fetcher: Fetch = fetch, base = PAPER_BASE): Gateway {
  if (!/^https:\/\/paper-api\.alpaca\.markets$/.test(base) && !base.startsWith("http://mock")) throw new Error("The demo gateway only talks to the paper account");
  const headers = { "APCA-API-KEY-ID": keyId, "APCA-API-SECRET-KEY": secret };
  const call = client(base, headers, fetcher);
  return {
    engine: "alpaca_paper",
    placeOrder: (_a, req, id) => call<AlpacaOrder>("POST", "/v2/orders", orderBody(req, id)),
    orderByClientId: (_a, id) => call<AlpacaOrder | null>("GET", `/v2/orders:by_client_order_id?client_order_id=${q(id)}`, undefined, true),
    cancelOrder: async (_a, oid) => { await call<null>("DELETE", `/v2/orders/${q(oid)}`); },
    replaceOrder: (_a, oid, p, id) => call<AlpacaOrder>("PATCH", `/v2/orders/${q(oid)}`, patchBody(p, id)),
    positions: () => call<AlpacaPosition[]>("GET", "/v2/positions"),
    account: () => call<AlpacaAccount>("GET", "/v2/account"),
    lastPrice: lastPriceVia(headers, fetcher),
  };
}

/** Alpaca Broker API. Sandbox unless `live` is passed, which only gatewayFor() does. */
export function brokerGateway(keyId: string, secret: string, opts: { live?: boolean; fetcher?: Fetch; base?: string; priceHeaders?: Record<string, string> } = {}): Gateway & BrokerAccounts {
  const fetcher = opts.fetcher ?? fetch;
  const base = opts.base ?? (opts.live ? BROKER_LIVE_BASE : BROKER_SANDBOX_BASE);
  const auth = { Authorization: `Basic ${btoa(`${keyId}:${secret}`)}` };
  const call = client(base, auth, fetcher);
  const need = (a: string | null): string => {
    if (!a) throw new BrokerError(409, "Open a sandbox account first", "no_account");
    return q(a);
  };
  const t = (a: string | null) => `/v1/trading/accounts/${need(a)}`;
  return {
    engine: opts.live ? "alpaca_broker_live" : "alpaca_broker_sandbox",
    placeOrder: (a, req, id) => call<AlpacaOrder>("POST", `${t(a)}/orders`, orderBody(req, id)),
    orderByClientId: (a, id) => call<AlpacaOrder | null>("GET", `${t(a)}/orders:by_client_order_id?client_order_id=${q(id)}`, undefined, true),
    cancelOrder: async (a, oid) => { await call<null>("DELETE", `${t(a)}/orders/${q(oid)}`); },
    replaceOrder: (a, oid, p, id) => call<AlpacaOrder>("PATCH", `${t(a)}/orders/${q(oid)}`, patchBody(p, id)),
    positions: (a) => call<AlpacaPosition[]>("GET", `${t(a)}/positions`),
    account: (a) => call<AlpacaAccount>("GET", `${t(a)}/account`),
    lastPrice: opts.priceHeaders ? lastPriceVia(opts.priceHeaders, fetcher) : async () => null,
    createAccount: (body) => call("POST", "/v1/accounts", body),
    getAccount: (id) => call("GET", `/v1/accounts/${q(id)}`),
    createAchRelationship: (id, body) => call("POST", `/v1/accounts/${q(id)}/ach_relationships`, body),
    listAchRelationships: (id) => call("GET", `/v1/accounts/${q(id)}/ach_relationships`),
    createTransfer: (id, body) => call("POST", `/v1/accounts/${q(id)}/transfers`, body),
  };
}

/** The gateway for a mode decision, or null for the in-browser demo account. */
export function gatewayFor(decision: ModeDecision, env: TradingEnv, fetcher: Fetch = fetch): (Gateway & Partial<BrokerAccounts>) | null {
  const priceHeaders = env.ALPACA_KEY_ID && env.ALPACA_SECRET_KEY ? { "APCA-API-KEY-ID": env.ALPACA_KEY_ID, "APCA-API-SECRET-KEY": env.ALPACA_SECRET_KEY } : undefined;
  switch (decision.engine) {
    case "alpaca_paper":
      return paperGateway(env.ALPACA_KEY_ID!, env.ALPACA_SECRET_KEY!, fetcher);
    case "alpaca_broker_sandbox":
      return brokerGateway(env.ALPACA_BROKER_KEY_ID!, env.ALPACA_BROKER_SECRET!, { fetcher, priceHeaders });
    case "alpaca_broker_live":
      // resolveMode only returns this engine after every live gate passed.
      if (decision.mode !== "live") throw new Error("Live gateway asked for outside live mode");
      return brokerGateway(env.ALPACA_LIVE_BROKER_KEY_ID!, env.ALPACA_LIVE_BROKER_SECRET!, { live: true, fetcher, priceHeaders });
    default:
      return null;
  }
}

// ---------------------------------------------------------------- sandbox onboarding

/** Alpaca's published sandbox test identity. The sandbox approves these automatically.
 *  Never a real person's details: the Trade app asks for none of them. */
export function sandboxAccountBody(userId: string, ip: string, now = new Date()): Record<string, unknown> {
  const tag = userId.replace(/-/g, "").slice(0, 16);
  const signedAt = now.toISOString();
  const agreement = (a: string) => ({ agreement: a, signed_at: signedAt, ip_address: ip });
  return {
    contact: {
      email_address: `sandbox+${tag}@example.com`,
      phone_number: "555-666-7788",
      street_address: ["20 N San Mateo Dr"],
      city: "San Mateo",
      state: "CA",
      postal_code: "94401",
      country: "USA",
    },
    identity: {
      given_name: "Sandbox",
      family_name: `Tester ${tag.slice(0, 6)}`,
      date_of_birth: "1970-01-01",
      tax_id: "666-55-4321",
      tax_id_type: "USA_SSN",
      country_of_citizenship: "USA",
      country_of_birth: "USA",
      country_of_tax_residence: "USA",
      funding_source: ["employment_income"],
    },
    disclosures: {
      is_control_person: false,
      is_affiliated_exchange_or_finra: false,
      is_politically_exposed: false,
      immediate_family_exposed: false,
    },
    agreements: [agreement("customer_agreement"), agreement("account_agreement"), agreement("margin_agreement"), agreement("crypto_agreement")],
    enabled_assets: ["us_equity", "crypto"],
  };
}

/** Alpaca's sandbox test bank. Never a real account. */
export const SANDBOX_ACH = {
  account_owner_name: "Sandbox Tester",
  bank_account_type: "CHECKING",
  bank_account_number: "32131231abc",
  bank_routing_number: "121000358",
};
