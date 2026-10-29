// Which account the Trade app is using (DEC-0046), and the badge that says so. The server's
// /api/trade/status picks the mode. When it fails, or says the engine is "browser", every
// panel keeps using the in-browser demo account (DEC-0034) exactly as before. Otherwise the
// ticket, the dock, Orders and Portfolio read the broker account through the server. Either
// way the money is pretend until the production switch, and every ticket, confirmation and
// list shows the mode badge.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "../ui";
import { MODE_BADGE, OPEN_STATUSES, type TradeBalances, type TradeFill, type TradeOrder, type TradePosition, type TradingMode, type TradingStatus } from "../lib/trading/types";
import { subscribeOrders, trading, type StreamOptions, type TradingClient } from "../lib/trading/client";

export interface Trading {
  /** null until the server answers, and when it fails. */
  status: TradingStatus | null;
  /** True when orders go through the server, false for the in-browser demo account. */
  server: boolean;
  mode: TradingMode;
  badge: string;
  client: TradingClient;
  refreshStatus: () => Promise<void>;
  orders: TradeOrder[];
  open: TradeOrder[];
  done: TradeOrder[];
  fills: TradeFill[];
  positions: TradePosition[];
  balances: TradeBalances | null;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Puts an order the server returned into the lists at once. */
  upsert: (o: TradeOrder) => void;
}

const noop = async () => {};
const BROWSER: Trading = {
  status: null, server: false, mode: "demo", badge: MODE_BADGE.demo, client: trading, refreshStatus: noop,
  orders: [], open: [], done: [], fills: [], positions: [], balances: null, loaded: false, error: null, refresh: noop, upsert: () => {},
};

const Ctx = createContext<Trading>(BROWSER);

/** The current trading mode. Without a provider it is the in-browser demo account. */
export function useTrading(): Trading {
  return useContext(Ctx);
}

export const badgeFor = (s: TradingStatus | null): string => (s?.badge?.trim() ? s.badge : MODE_BADGE[s?.mode ?? "demo"] ?? MODE_BADGE.demo);

const isOpen = (o: TradeOrder) => OPEN_STATUSES.has(o.status);

export function TradingProvider({ children, client = trading, stream }: { children: ReactNode; client?: TradingClient; stream?: StreamOptions }) {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const refreshStatus = useCallback(async () => {
    try { setStatus(await client.status()); } catch { setStatus(null); }
  }, [client]);
  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  const server = !!status && status.engine !== "browser";
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [fills, setFills] = useState<TradeFill[]>([]);
  const [positions, setPositions] = useState<TradePosition[]>([]);
  const [balances, setBalances] = useState<TradeBalances | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBook = useCallback(async () => {
    const [f, p] = await Promise.all([client.fills(), client.positions()]);
    setFills(f);
    setPositions(p.positions);
    setBalances(p.balances);
  }, [client]);

  const refresh = useCallback(async () => {
    if (!server) return;
    try {
      const [o] = await Promise.all([client.orders("all"), refreshBook()]);
      setOrders(o);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoaded(true); }
  }, [client, server, refreshBook]);

  const upsert = useCallback((o: TradeOrder) => {
    setOrders((list) => {
      const i = list.findIndex((x) => x.id === o.id);
      if (i < 0) return [o, ...list];
      const next = list.slice();
      next[i] = o;
      return next;
    });
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Order updates arrive on the stream. A fill changes positions and cash, so those reload,
  // at most once a second.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!server) return;
    const stop = subscribeOrders(client, (o) => {
      upsert(o);
      if (o.filledQty > 0 && !pending.current) {
        pending.current = setTimeout(() => { pending.current = null; refreshBook().catch(() => {}); }, 1000);
      }
    }, stream);
    return () => { stop(); if (pending.current) { clearTimeout(pending.current); pending.current = null; } };
  }, [server, client, stream, upsert, refreshBook]);

  const value = useMemo<Trading>(() => {
    const sorted = [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return {
      status, server, mode: status?.mode ?? "demo", badge: badgeFor(status), client, refreshStatus,
      orders: sorted, open: sorted.filter(isOpen), done: sorted.filter((o) => !isOpen(o)), fills, positions, balances,
      loaded, error, refresh, upsert,
    };
  }, [status, server, client, refreshStatus, orders, fills, positions, balances, loaded, error, refresh, upsert]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The mode badge. Shown on every ticket, confirmation and list, and never dismissible. */
export function ModeBadge() {
  const t = useTrading();
  return (
    <span className="mode-badge" data-mode={t.mode} title={t.mode === "live" ? undefined : "Pretend money. No real money moves."}>
      <Badge tone={t.mode === "live" ? "bad" : "warning"}>{t.badge}</Badge>
    </span>
  );
}

/** A list with the mode badge above it. */
export function BadgedList({ children }: { children: ReactNode }) {
  return (
    <div className="mb-list">
      <div className="mb-row"><ModeBadge /></div>
      {children}
    </div>
  );
}
