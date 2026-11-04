// Read-only broker and exchange connections for Verify, the browser side (DEC-0091, which
// replaces the switched-off scaffold of DEC-0081). The page sends a read-only credential to
// /api/connect once; the server checks it can only read, fetches the trades, runs Verify's
// checks and signs the result. The page never keeps the credential: the form is cleared as
// soon as the request is sent. Switched on by the build (VITE_VERIFY_CONNECTIONS=on: pull
// request previews and the E2E build); production stays off until the owner turns it on.
import type { Result } from "../checks";
import type { PublicCards } from "../publish";
import { VENUE_LIST, VENUES, type VenueInfo } from "../../connect/venues";
import type { VenueId } from "../../connect/types";

export { VENUE_LIST, VENUES, type VenueInfo, type VenueId };

/** The venues in the order the page lists them. */
export const PROVIDERS = VENUE_LIST.map((v) => ({ id: v.id, name: v.name, method: v.method }));

/** The switch. Off unless the build sets VITE_VERIFY_CONNECTIONS=on; production leaves it off. */
export function connectionsEnabled(env: Record<string, unknown> = import.meta.env ?? {}): boolean {
  return env.VITE_VERIFY_CONNECTIONS === "on";
}

export type TrustLevel = "Self-reported" | "Broker-connected";

/** An upload is self-reported. Only a record Parity read from the broker, with a valid proof, is broker-connected. */
export function trustLevel(source: "upload" | "connection"): TrustLevel {
  return source === "connection" ? "Broker-connected" : "Self-reported";
}

/** Where a connected record came from, as the server signed it. */
export interface ConnectedSource {
  venue: VenueId;
  name: string;
  env: "live" | "paper";
  /** A one-way code for the account, not the account number. */
  account: string;
  fetchedAt: string;
  from: string;
  to: string;
}

export interface ConnectedRecord {
  result: Result;
  cards: PublicCards;
  attestation: string;
  /** The trades Parity read, as a CSV the person can download and upload again. */
  csv: string;
}

export interface FetchAnswer {
  record: ConnectedRecord;
  source: ConnectedSource;
  notes: string[];
  /** The kept connection's id, when "keep in sync" was ticked. */
  connection: string | null;
}

export interface ConnectStatus { on: boolean; signing: boolean; keep: boolean; alpaca: boolean }

export class ConnectFailed extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

async function sessionToken(): Promise<string> {
  const { requireClient } = await import("../../../auth/client");
  const { data } = await requireClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ConnectFailed("Sign in first.", "signed_out", 401);
  return token;
}

/** One call to /api/connect. Errors come back in the server's plain words. */
export async function connectCall<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`/api/connect/${path}`, body === undefined
    ? { headers: { Accept: "application/json" } }
    : { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? (await sessionToken())}` }, body: JSON.stringify(body) });
  const out = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) throw new ConnectFailed(out.error ?? `The server answered ${res.status}. Try again.`, out.code ?? "unknown", res.status);
  return out;
}

export const connectStatus = () => connectCall<ConnectStatus>("status");
