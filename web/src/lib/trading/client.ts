// The browser side of /api/trade (DEC-0046): typed calls, idempotency keys and the order
// stream. Every call carries the person's Supabase access token. All of it is pretend
// money until the production switch; the server decides the mode and says it in `badge`.
import type {
  OrderRequest, Preview, TimeInForce, TradeBalances, TradeFill, TradeOrder, TradePosition, TradingStatus,
} from "./types";

type Fetch = typeof fetch;

export class TradeApiError extends Error {
  constructor(message: string, readonly status: number, readonly errors: string[] = []) {
    super(message);
    this.name = "TradeApiError";
  }
}

export interface TradingClientOptions {
  /** Defaults to the global fetch. */
  fetch?: Fetch;
  /** The Supabase access token, or null when signed out. Defaults to the app's session. */
  token?: () => Promise<string | null>;
  /** Defaults to "/api/trade". */
  base?: string;
  /** Times a submission is sent before giving up, counting the first. Default 2. */
  attempts?: number;
}

export interface OrderChange { qty?: number; limitPrice?: number; stopPrice?: number; timeInForce?: TimeInForce }

const KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,48}$/;

/** A fresh idempotency key: 32 characters from [A-Za-z0-9], random from the browser's crypto. */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += KEY_CHARS[b % KEY_CHARS.length];
  return out;
}

async function sessionToken(): Promise<string | null> {
  const { supabase } = await import("../../auth/client");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Symbols with a slash (BTC/USD) are crypto at Alpaca. */
export const isCrypto = (symbol: string) => symbol.includes("/");

/** Times in force a symbol allows: crypto takes gtc and ioc only. */
export function tifsFor(symbol: string): TimeInForce[] {
  return isCrypto(symbol) ? ["gtc", "ioc"] : ["day", "gtc", "ioc", "fok"];
}

// A failed network call or a 5xx may or may not have reached the server, so it is retried
// with the same key. A 4xx is the server's answer and is not.
const retryable = (e: unknown) => !(e instanceof TradeApiError) || e.status >= 500 || e.status === 0;

export function createTradingClient(opts: TradingClientOptions = {}) {
  const base = opts.base ?? "/api/trade";
  const getToken = opts.token ?? sessionToken;
  const doFetch: Fetch = opts.fetch ?? ((...a) => fetch(...a));
  const attempts = Math.max(1, opts.attempts ?? 2);

  async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await getToken();
    if (!token) throw new TradeApiError("Sign in first", 401);
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  async function raw(method: string, path: string, body?: unknown, key?: string): Promise<Response> {
    const h = await headers(body !== undefined ? { "Content-Type": "application/json" } : {});
    if (key) {
      if (!IDEMPOTENCY_KEY.test(key)) throw new TradeApiError("Bad idempotency key", 0);
      h["Idempotency-Key"] = key;
    }
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new TradeApiError((e as Error).message || "Network error", 0);
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: unknown; errors?: unknown };
      const errors = Array.isArray(err.errors) ? err.errors.filter((x): x is string => typeof x === "string") : [];
      throw new TradeApiError(typeof err.error === "string" ? err.error : `Request failed (${res.status})`, res.status, errors);
    }
    return res;
  }

  async function call<T>(method: string, path: string, body?: unknown, key?: string): Promise<T> {
    return (await (await raw(method, path, body, key)).json()) as T;
  }

  /** Sends a keyed write, retrying a network failure or 5xx once with the same key. */
  async function keyed<T>(method: string, path: string, body: unknown, key: string): Promise<T> {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try { return await call<T>(method, path, body, key); }
      catch (e) { last = e; if (!retryable(e)) break; }
    }
    throw last;
  }

  return {
    status: () => call<TradingStatus>("GET", "/status"),
    preview: (req: OrderRequest) => call<Preview>("POST", "/preview", req),
    /** Places an order. Pass the same key to retry the same submission. */
    placeOrder: (req: OrderRequest, key: string) => keyed<{ order: TradeOrder; duplicate: boolean }>("POST", "/orders", req, key),
    orders: (status: "open" | "all" = "all") => call<{ orders: TradeOrder[] }>("GET", `/orders?status=${status}`).then((r) => r.orders),
    modifyOrder: (id: string, change: OrderChange, key: string) => keyed<{ order: TradeOrder }>("PATCH", `/orders/${encodeURIComponent(id)}`, change, key).then((r) => r.order),
    cancelOrder: (id: string, key: string) => keyed<{ ok: true }>("DELETE", `/orders/${encodeURIComponent(id)}`, undefined, key),
    fills: () => call<{ fills: TradeFill[] }>("GET", "/fills").then((r) => r.fills),
    positions: () => call<{ positions: TradePosition[]; balances: TradeBalances }>("GET", "/positions"),
    /** The order history and fills as CSV. */
    exportCsv: async (): Promise<Blob> => (await raw("GET", "/export")).blob(),
    createSandboxAccount: () => call<{ account: { status: string; funded: boolean } }>("POST", "/sandbox/account", { agree: true }).then((r) => r.account),
    fundSandbox: (amount: number) => call<{ ok: true }>("POST", "/sandbox/fund", { amount }),
    /** The stream address. EventSource cannot send headers, so the token rides in the query. */
    streamUrl: async (): Promise<string> => {
      const token = await getToken();
      if (!token) throw new TradeApiError("Sign in first", 401);
      return `${base}/stream?access_token=${encodeURIComponent(token)}`;
    },
  };
}

export type TradingClient = ReturnType<typeof createTradingClient>;

export interface StreamOptions {
  /** Defaults to the global EventSource. */
  EventSource?: typeof EventSource;
  /** Wait before reconnecting after the server closes or the link drops. Default 1000 ms. */
  retryMs?: number;
  /** Longest wait after repeated failures. Default 15000 ms. */
  maxRetryMs?: number;
  onError?: (e: unknown) => void;
}

/** Listens for "order" events and reconnects when the server closes (about every 25 s).
 *  A fresh token is read on each connect. Returns a function that stops it. */
export function subscribeOrders(client: Pick<TradingClient, "streamUrl">, onOrder: (o: TradeOrder) => void, opts: StreamOptions = {}): () => void {
  const ES = opts.EventSource ?? globalThis.EventSource;
  const base = opts.retryMs ?? 1000;
  const max = opts.maxRetryMs ?? 15000;
  let stopped = false;
  let es: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  const later = () => {
    if (stopped) return;
    const wait = Math.min(max, base * 2 ** Math.min(failures, 6));
    failures++;
    timer = setTimeout(connect, wait);
  };

  async function connect() {
    timer = null;
    if (stopped || !ES) return;
    let url: string;
    try { url = await client.streamUrl(); }
    catch (e) { opts.onError?.(e); later(); return; }
    if (stopped) return;
    const src = new ES(url);
    es = src;
    src.addEventListener("open", () => { failures = 0; });
    src.addEventListener("order", (ev) => {
      try { onOrder(JSON.parse((ev as MessageEvent<string>).data) as TradeOrder); }
      catch (e) { opts.onError?.(e); }
    });
    src.onerror = () => {
      // The server closing after its window looks like an error too. Either way, start again.
      src.close();
      if (es === src) es = null;
      later();
    };
  }

  void connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    es?.close();
    es = null;
  };
}

/** The client the app uses. */
export const trading = createTradingClient();
