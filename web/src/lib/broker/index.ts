// One interface for placing orders, whoever carries them out (DEC-0045). Today there is one
// working implementation, the demo account (DEC-0034), which matches orders against
// delayed daily bars in the browser with pretend money. A real broker adapter has the same
// shape but every call throws: real trading needs the owner's decision, a lawyer and a
// regulated broker partner first (DEC-0019). Parity never holds customer money; if real
// trading ever comes, the partner holds the account, the cash and the KYC.
import {
  bookOf, cancel, ensureAccount, fillsTable, ordersTable, positionsTable, submitOrder, toOrder, type Snapshot,
} from "../paper/account";
import type { Bar } from "../indicators";
import type { OrderInput, PaperOrder } from "../paper/matching";

export type BrokerMode = "paper" | "live";

export interface BrokerAccount {
  id: string;
  name: string;
  mode: BrokerMode;
  currency: "USD";
  cash: number;
}

export interface BrokerPosition { symbol: string; qty: number; avgCost: number }

/** The order fields every broker understands. The demo account's order record is the
 *  common shape; a real adapter maps its broker's order to it. */
export type BrokerOrder = PaperOrder;
export type BrokerOrderRequest = OrderInput;

export interface Broker {
  readonly id: string;
  readonly mode: BrokerMode;
  readonly label: string;
  account(): Promise<BrokerAccount>;
  positions(): Promise<BrokerPosition[]>;
  orders(): Promise<BrokerOrder[]>;
  placeOrder(req: BrokerOrderRequest): Promise<BrokerOrder[]>;
  cancelOrder(id: string): Promise<void>;
}

export class BrokerNotEnabledError extends Error {
  constructor(broker: string) {
    super(`Real trading is not enabled. ${broker} is a placeholder until the owner decides (DEC-0019, DEC-0045).`);
    this.name = "BrokerNotEnabledError";
  }
}

// ---------------------------------------------------------------- the demo account

/** The demo account behind the Broker interface. `latestBar` gives the newest delayed bar
 *  for a symbol, which market orders fill against. */
export function paperBroker(latestBar: (symbol: string) => Promise<Bar | null>, accountId?: string): Broker {
  async function snapshot(): Promise<Snapshot> {
    const accounts = await ensureAccount();
    const account = (accountId && accounts.find((a) => a.id === accountId)) || accounts[0];
    const [orders, fills, positions] = await Promise.all([
      ordersTable.list({ account_id: account.id }),
      fillsTable.list({ account_id: account.id }),
      positionsTable.list({ account_id: account.id }),
    ]);
    return { account, orders, fills, positions };
  }
  return {
    id: "paper",
    mode: "paper",
    label: "Demo account",
    async account() {
      const s = await snapshot();
      return { id: s.account.id, name: s.account.name, mode: "paper", currency: "USD", cash: bookOf(s.account, s.fills).cash };
    },
    async positions() {
      const s = await snapshot();
      return Object.values(bookOf(s.account, s.fills).positions).map((p) => ({ symbol: p.symbol, qty: p.qty, avgCost: p.avg_cost }));
    },
    async orders() {
      return (await snapshot()).orders.map(toOrder);
    },
    async placeOrder(req) {
      const bar = await latestBar(req.symbol);
      if (!bar) throw new Error(`No delayed price for ${req.symbol} yet`);
      return submitOrder(await snapshot(), req, bar);
    },
    async cancelOrder(id) {
      await cancel(await snapshot(), id);
    },
  };
}

// ---------------------------------------------------------------- real brokers (off)

/** The partners DEC-0045 compares. Each would carry the accounts, the money and the KYC. */
export type LiveBrokerId = "alpaca" | "ibkr" | "oanda" | "coinbase";

const LIVE_LABEL: Record<LiveBrokerId, string> = {
  alpaca: "Alpaca Broker API",
  ibkr: "Interactive Brokers",
  oanda: "OANDA v20",
  coinbase: "Coinbase",
};

/** A real broker adapter. Every call throws BrokerNotEnabledError: it holds no keys, opens
 *  no connection and creates no account. */
export function liveBrokerStub(id: LiveBrokerId): Broker {
  const off = async (): Promise<never> => { throw new BrokerNotEnabledError(LIVE_LABEL[id]); };
  return { id, mode: "live", label: LIVE_LABEL[id], account: off, positions: off, orders: off, placeOrder: off, cancelOrder: off };
}

/** The broker the app should use. Always the demo account unless real trading has been
 *  turned on, which it cannot be in this code: asking for a live broker gives the stub. */
export function brokerFor(mode: BrokerMode, latestBar: (symbol: string) => Promise<Bar | null>, live: LiveBrokerId = "alpaca"): Broker {
  return mode === "live" ? liveBrokerStub(live) : paperBroker(latestBar);
}
