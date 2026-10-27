// Where the trading service keeps orders, the audit log and warnings (DEC-0046). Production
// uses Supabase's REST API with the service role key, the only role that can write these
// tables (supabase/migrations/20261110120000_broker_sandbox.sql); tests use memoryStore().
// Imported by Pages Functions, so nothing here may read import.meta.env.
import type { AssetClass, OrderClass, OrderSide, OrderType, TimeInForce } from "./types";

// "live" is in the type so a live order reaches the database, whose checks refuse it until a
// later migration allows it on purpose (one more gate).
export type StoredMode = "demo" | "sandbox" | "live";
export type Provider = "alpaca_paper" | "alpaca_broker";

export interface StoredOrder {
  id: string;
  user_id: string;
  mode: StoredMode;
  provider: Provider;
  asset_class: AssetClass;
  client_order_id: string;
  broker_order_id: string | null;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  order_class: OrderClass;
  qty: number | null;
  notional: number | null;
  limit_price: number | null;
  stop_price: number | null;
  take_profit: number | null;
  stop_loss: number | null;
  time_in_force: TimeInForce;
  status: string;
  filled_qty: number;
  filled_avg_price: number | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export type NewOrder = Omit<StoredOrder, "id" | "created_at" | "updated_at" | "filled_qty" | "filled_avg_price" | "broker_order_id" | "reason" | "status"> & { status?: string };

export type AuditEvent = "requested" | "refused" | "sent" | "accepted" | "rejected" | "error" | "duplicate" | "cancel_requested"
  | "cancelled" | "replace_requested" | "replaced" | "fill" | "status" | "onboarding" | "funded" | "rate_limited";

export interface AuditRow {
  user_id: string;
  mode: StoredMode;
  provider?: Provider | null;
  event: AuditEvent;
  client_order_id?: string | null;
  broker_order_id?: string | null;
  idem_key?: string | null;
  detail?: Record<string, unknown>;
}

export interface StoredAudit extends AuditRow { id: number; at: string }

export interface StoredAccount { user_id: string; provider: Provider; mode: "sandbox"; external_account_id: string; status: string; funded_at: string | null }

export class DuplicateError extends Error {
  constructor() { super("duplicate"); this.name = "DuplicateError"; }
}

export interface TradingStore {
  findOrder(userId: string, clientOrderId: string): Promise<StoredOrder | null>;
  getOrder(userId: string, id: string): Promise<StoredOrder | null>;
  /** Throws DuplicateError when (user_id, client_order_id) already exists. */
  insertOrder(row: NewOrder): Promise<StoredOrder>;
  /** Updates one order. With `ifFilledQty`, only when filled_qty still equals it, so two
   *  refreshes never both record the same fill. Returns null when nothing changed. */
  updateOrder(id: string, patch: Partial<StoredOrder>, ifFilledQty?: number): Promise<StoredOrder | null>;
  listOrders(userId: string, opts: { openOnly?: boolean; limit?: number }): Promise<StoredOrder[]>;
  /** Appends to the audit log. False when the idem_key was already used (a retry). */
  audit(row: AuditRow): Promise<boolean>;
  auditByIdem(userId: string, idemKey: string): Promise<StoredAudit | null>;
  listAudit(userId: string, events: AuditEvent[], limit?: number): Promise<StoredAudit[]>;
  /** Order actions (requested, cancel_requested, replace_requested) since a time. */
  countActions(userId: string, sinceIso: string): Promise<number>;
  warn(source: string, severity: "info" | "warn" | "error", message: string, detail?: Record<string, unknown>): Promise<void>;
  account(userId: string): Promise<StoredAccount | null>;
  upsertAccount(row: Omit<StoredAccount, "funded_at"> & { funded_at?: string | null }): Promise<void>;
  recordOnboarding(userId: string, agreementVersion: string): Promise<void>;
  adminSwitchOn(): Promise<boolean>;
}

export const ACTION_EVENTS: AuditEvent[] = ["requested", "cancel_requested", "replace_requested"];

// ---------------------------------------------------------------- Supabase REST

type Fetch = typeof fetch;
const NUMERIC: (keyof StoredOrder)[] = ["qty", "notional", "limit_price", "stop_price", "take_profit", "stop_loss", "filled_qty", "filled_avg_price"];

function toOrder(r: Record<string, unknown>): StoredOrder {
  const o = { ...r } as Record<string, unknown>;
  for (const k of NUMERIC) if (o[k] !== null && o[k] !== undefined) o[k] = Number(o[k]);
  return o as unknown as StoredOrder;
}

export function supabaseTradingStore(url: string, serviceKey: string, fetcher: Fetch = fetch): TradingStore {
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const auth: Record<string, string> = { apikey: serviceKey, ...(serviceKey.startsWith("eyJ") ? { Authorization: `Bearer ${serviceKey}` } : {}) };
  async function call<T>(method: string, path: string, body?: unknown, prefer?: string): Promise<T> {
    const res = await fetcher(`${base}/${path}`, {
      method,
      headers: { ...auth, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 409) throw new DuplicateError();
    if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed with ${res.status}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  const eq = (v: string | number) => `eq.${encodeURIComponent(String(v))}`;
  const inList = (vs: string[]) => `in.(${vs.map((v) => encodeURIComponent(v)).join(",")})`;

  return {
    async findOrder(userId, cid) {
      const rows = await call<Record<string, unknown>[]>("GET", `broker_orders?user_id=${eq(userId)}&client_order_id=${eq(cid)}&select=*`);
      return rows[0] ? toOrder(rows[0]) : null;
    },
    async getOrder(userId, id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const rows = await call<Record<string, unknown>[]>("GET", `broker_orders?user_id=${eq(userId)}&id=${eq(id)}&select=*`);
      return rows[0] ? toOrder(rows[0]) : null;
    },
    async insertOrder(row) {
      const [made] = await call<Record<string, unknown>[]>("POST", "broker_orders", row, "return=representation");
      return toOrder(made);
    },
    async updateOrder(id, patch, ifFilledQty) {
      const cond = ifFilledQty === undefined ? "" : `&filled_qty=${eq(ifFilledQty)}`;
      const rows = await call<Record<string, unknown>[]>("PATCH", `broker_orders?id=${eq(id)}${cond}`, { ...patch, updated_at: new Date().toISOString() }, "return=representation");
      return rows[0] ? toOrder(rows[0]) : null;
    },
    async listOrders(userId, { openOnly, limit = 200 }) {
      const open = openOnly ? `&status=${inList(["sending", "new", "accepted", "pending_new", "partially_filled", "held", "pending_cancel", "pending_replace", "accepted_for_bidding", "calculated"])}` : "";
      const rows = await call<Record<string, unknown>[]>("GET", `broker_orders?user_id=${eq(userId)}${open}&select=*&order=created_at.desc&limit=${Math.min(500, limit)}`);
      return rows.map(toOrder);
    },
    async audit(row) {
      try {
        await call("POST", "broker_order_audit", { detail: {}, ...row }, "return=minimal");
        return true;
      } catch (e) {
        if (e instanceof DuplicateError) return false;
        throw e;
      }
    },
    async auditByIdem(userId, key) {
      const rows = await call<StoredAudit[]>("GET", `broker_order_audit?user_id=${eq(userId)}&idem_key=${eq(key)}&select=*`);
      return rows[0] ?? null;
    },
    async listAudit(userId, events, limit = 500) {
      return call<StoredAudit[]>("GET", `broker_order_audit?user_id=${eq(userId)}&event=${inList(events)}&select=*&order=at.desc&limit=${Math.min(2000, limit)}`);
    },
    async countActions(userId, since) {
      const rows = await call<{ id: number }[]>("GET", `broker_order_audit?user_id=${eq(userId)}&event=${inList(ACTION_EVENTS)}&at=gte.${encodeURIComponent(since)}&select=id&limit=200`);
      return rows.length;
    },
    async warn(source, severity, message, detail = {}) {
      try {
        await call("POST", "ops_warnings", { source, severity, message: message.slice(0, 300), detail }, "return=minimal");
      } catch (e) {
        console.error("warning not recorded", String(e));
      }
    },
    async account(userId) {
      const rows = await call<StoredAccount[]>("GET", `broker_accounts?user_id=${eq(userId)}&select=user_id,provider,mode,external_account_id,status,funded_at`);
      return rows[0] ?? null;
    },
    async upsertAccount(row) {
      await call("POST", "broker_accounts?on_conflict=user_id", { ...row, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
    },
    async recordOnboarding(userId, version) {
      const now = new Date().toISOString();
      await call("POST", "broker_onboarding?on_conflict=user_id", {
        user_id: userId, sandbox: true, kyc_submitted_at: now, disclosures_accepted_at: now, agreement_accepted_at: now, agreement_version: version, updated_at: now,
      }, "resolution=merge-duplicates,return=minimal");
    },
    async adminSwitchOn() {
      const rows = await call<{ live_enabled: boolean; set_by: string | null }[]>("GET", "trading_switch?id=eq.1&select=live_enabled,set_by");
      const row = rows[0];
      if (!row?.live_enabled || !row.set_by) return false;
      const admins = await call<{ user_id: string }[]>("GET", `trading_admins?user_id=${eq(row.set_by)}&select=user_id`);
      return admins.length === 1;
    },
  };
}

// ---------------------------------------------------------------- in memory (tests, CI)

export function memoryStore(): TradingStore & { orders: StoredOrder[]; audits: StoredAudit[]; warnings: { source: string; severity: string; message: string }[]; accounts: StoredAccount[]; switchOn: boolean } {
  const orders: StoredOrder[] = [];
  const audits: StoredAudit[] = [];
  const warnings: { source: string; severity: string; message: string }[] = [];
  const accounts: StoredAccount[] = [];
  let seq = 0;
  const now = () => new Date().toISOString();
  const s = {
    orders, audits, warnings, accounts, switchOn: false,
    async findOrder(u: string, c: string) { return orders.find((o) => o.user_id === u && o.client_order_id === c) ?? null; },
    async getOrder(u: string, id: string) { return orders.find((o) => o.user_id === u && o.id === id) ?? null; },
    async insertOrder(row: NewOrder) {
      if (orders.some((o) => o.user_id === row.user_id && o.client_order_id === row.client_order_id)) throw new DuplicateError();
      const o: StoredOrder = { ...row, id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, status: row.status ?? "sending", broker_order_id: null, filled_qty: 0, filled_avg_price: null, reason: null, created_at: now(), updated_at: now() };
      orders.push(o);
      return { ...o };
    },
    async updateOrder(id: string, patch: Partial<StoredOrder>, ifFilledQty?: number) {
      const o = orders.find((x) => x.id === id);
      if (!o || (ifFilledQty !== undefined && o.filled_qty !== ifFilledQty)) return null;
      Object.assign(o, patch, { updated_at: now() });
      return { ...o };
    },
    async listOrders(u: string, { openOnly, limit = 200 }: { openOnly?: boolean; limit?: number }) {
      const open = new Set(["sending", "new", "accepted", "pending_new", "partially_filled", "held", "pending_cancel", "pending_replace", "accepted_for_bidding", "calculated"]);
      return orders.filter((o) => o.user_id === u && (!openOnly || open.has(o.status))).slice().reverse().slice(0, limit).map((o) => ({ ...o }));
    },
    async audit(row: AuditRow) {
      if (row.idem_key && audits.some((a) => a.user_id === row.user_id && a.idem_key === row.idem_key)) return false;
      audits.push({ detail: {}, ...row, id: audits.length + 1, at: now() });
      return true;
    },
    async auditByIdem(u: string, k: string) { return audits.find((a) => a.user_id === u && a.idem_key === k) ?? null; },
    async listAudit(u: string, events: AuditEvent[]) { return audits.filter((a) => a.user_id === u && events.includes(a.event)).slice().reverse(); },
    async countActions(u: string, since: string) { return audits.filter((a) => a.user_id === u && ACTION_EVENTS.includes(a.event) && a.at >= since).length; },
    async warn(source: string, severity: "info" | "warn" | "error", message: string) { warnings.push({ source, severity, message }); },
    async account(u: string) { return accounts.find((a) => a.user_id === u) ?? null; },
    async upsertAccount(row: Omit<StoredAccount, "funded_at"> & { funded_at?: string | null }) {
      const i = accounts.findIndex((a) => a.user_id === row.user_id);
      const next = { funded_at: i >= 0 ? accounts[i].funded_at : null, ...row } as StoredAccount;
      if (i >= 0) accounts[i] = next; else accounts.push(next);
    },
    async recordOnboarding() { /* nothing to keep in memory */ },
    async adminSwitchOn() { return s.switchOn; },
  };
  return s;
}
