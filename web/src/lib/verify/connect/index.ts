// Read-only broker and exchange connections for Verify: a scaffold, switched off (DEC-0081).
// A connected record would earn the "Broker-connected" trust level, which no upload can
// (REF-0016). Nothing here holds a key, registers an OAuth app or makes a request: the
// interface is written down so the import side (lib/verify/parse) can be shared, and the
// page shows "Coming later" while the flag is off. Turning it on needs a decision record,
// keys in the vault and a server that holds them, never the browser.
import type { Fill } from "../parse/fills";
import type { FormatId } from "../types";

export type ProviderId = "alpaca" | "binance" | "coinbase" | "kraken" | "ibkr";

export interface Provider {
  id: ProviderId;
  name: string;
  /** How a read-only link would be made: a read-only API key the person creates, or the provider's sign-in. */
  method: "read-only key" | "sign-in";
  /** The file import whose rows a connection would return, so both paths share the same checks. */
  sameAs: FormatId;
}

export const PROVIDERS: Provider[] = [
  { id: "alpaca", name: "Alpaca", method: "sign-in", sameAs: "alpaca" },
  { id: "binance", name: "Binance", method: "read-only key", sameAs: "binance_spot" },
  { id: "coinbase", name: "Coinbase", method: "sign-in", sameAs: "coinbase" },
  { id: "kraken", name: "Kraken", method: "read-only key", sameAs: "kraken" },
  { id: "ibkr", name: "Interactive Brokers", method: "read-only key", sameAs: "ibkr" },
];

/** What a connection may do: read fills in a date range. No orders, no transfers, no account details. */
export interface ReadOnlyConnection {
  provider: ProviderId;
  /** Fills between two ISO dates, oldest first, with personal fields already left out. */
  fills(from: string, to: string): Promise<Fill[]>;
  /** Forgets the link on our side and asks the provider to revoke it. */
  disconnect(): Promise<void>;
}

/** The switch. Off unless the build sets VITE_VERIFY_CONNECTIONS=on; production leaves it off. */
export function connectionsEnabled(env: Record<string, unknown> = import.meta.env ?? {}): boolean {
  return env.VITE_VERIFY_CONNECTIONS === "on";
}

export class NotAvailable extends Error {}

/** Always refuses for now: no provider is built, and with the switch off none may be tried. */
export async function connect(provider: ProviderId, env?: Record<string, unknown>): Promise<ReadOnlyConnection> {
  if (!connectionsEnabled(env)) throw new NotAvailable("Read-only connections are switched off.");
  throw new NotAvailable(`A read-only connection to ${PROVIDERS.find((p) => p.id === provider)?.name ?? provider} is not built yet.`);
}

export type TrustLevel = "Self-reported" | "Broker-connected";

/** Every upload is self-reported. Only a working read-only connection could be broker-connected. */
export function trustLevel(source: "upload" | "connection"): TrustLevel {
  return source === "connection" ? "Broker-connected" : "Self-reported";
}
