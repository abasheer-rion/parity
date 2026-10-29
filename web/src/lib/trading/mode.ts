// Which trading mode the server runs in (DEC-0046). Every order path calls resolveMode on
// the server before it talks to a broker. Imported by Pages Functions, so nothing here may
// read import.meta.env.
//
//   demo     the default. Pretend money in Alpaca's shared paper account, or the in-browser
//            demo account when the paper keys are not set.
//   sandbox  each person's own Alpaca Broker API sandbox account. Pretend money. Needs
//            TRADING_MODE=sandbox and both sandbox keys; otherwise demo.
//   live     real money. Refused unless ALL FOUR gates pass: a live key, a trading admin
//            has switched it on in the database, the deploy sets TRADING_LIVE_DEPLOY=on, and
//            the repo checklist (live-checklist.json) is marked complete with evidence.
//            The database also refuses live order rows until a later migration says so.
import checklist from "./live-checklist.json";
import { MODE_BADGE, type TradingEngine, type TradingMode } from "./types";

export interface TradingEnv {
  /** "demo" (default), "sandbox" or "live". Anything else means demo. */
  TRADING_MODE?: string;
  /** Alpaca Trading API paper keys (already set on Pages for market data). */
  ALPACA_KEY_ID?: string;
  ALPACA_SECRET_KEY?: string;
  /** Alpaca Broker API sandbox keys. Keychain items parity-alpaca-broker-key-id and
   *  parity-alpaca-broker-secret. Not set anywhere yet. */
  ALPACA_BROKER_KEY_ID?: string;
  ALPACA_BROKER_SECRET?: string;
  /** Alpaca Broker API production keys. Not set anywhere, and must not be until the
   *  checklist is complete. */
  ALPACA_LIVE_BROKER_KEY_ID?: string;
  ALPACA_LIVE_BROKER_SECRET?: string;
  /** Only the exact string "on" counts. One of the four live gates. */
  TRADING_LIVE_DEPLOY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface Checklist {
  complete: boolean;
  items: { id: string; item: string; done: boolean; evidence: string }[];
}

/** The checklist counts as complete only when it says so AND every item is done with
 *  written evidence. Marking "complete": true alone is not enough. */
export function checklistComplete(c: Checklist = checklist as Checklist): boolean {
  return c.complete === true && c.items.length > 0 && c.items.every((i) => i.done === true && typeof i.evidence === "string" && i.evidence.trim().length >= 10);
}

const has = (v: string | undefined) => typeof v === "string" && v.trim().length > 0;

export const paperKeys = (env: TradingEnv) => has(env.ALPACA_KEY_ID) && has(env.ALPACA_SECRET_KEY);
export const sandboxKeys = (env: TradingEnv) => has(env.ALPACA_BROKER_KEY_ID) && has(env.ALPACA_BROKER_SECRET);
export const liveKeys = (env: TradingEnv) => has(env.ALPACA_LIVE_BROKER_KEY_ID) && has(env.ALPACA_LIVE_BROKER_SECRET);

export interface LiveGate { ok: boolean; missing: string[] }

/** The four live gates. `adminSwitchOn` reads the database: the trading_switch row is on
 *  and was set by someone in trading_admins (a trigger refuses anything else). */
export async function liveGate(env: TradingEnv, adminSwitchOn: () => Promise<boolean>, list: Checklist = checklist as Checklist): Promise<LiveGate> {
  const missing: string[] = [];
  if (!liveKeys(env)) missing.push("No live broker key is set");
  if (env.TRADING_LIVE_DEPLOY !== "on") missing.push("The deploy does not set TRADING_LIVE_DEPLOY=on");
  if (!checklistComplete(list)) missing.push("The registration checklist is not complete");
  let switchOn = false;
  try {
    switchOn = await adminSwitchOn();
  } catch {
    switchOn = false;
  }
  if (!switchOn) missing.push("No trading admin has switched live trading on");
  return { ok: missing.length === 0, missing };
}

export interface ModeDecision {
  mode: TradingMode;
  engine: TradingEngine;
  badge: string;
  notes: string[];
}

/** Decides the mode for one request. Never returns live unless every gate passed. */
export async function resolveMode(env: TradingEnv, adminSwitchOn: () => Promise<boolean>, list?: Checklist): Promise<ModeDecision> {
  const wanted = (env.TRADING_MODE ?? "demo").trim().toLowerCase();
  const notes: string[] = [];
  if (wanted === "live") {
    const gate = await liveGate(env, adminSwitchOn, list);
    if (gate.ok) return { mode: "live", engine: "alpaca_broker_live", badge: MODE_BADGE.live, notes };
    notes.push("Live trading is refused", ...gate.missing);
    // Fall through to the safest pretend mode available.
  }
  if (wanted === "sandbox" || wanted === "live") {
    if (sandboxKeys(env)) return { mode: "sandbox", engine: "alpaca_broker_sandbox", badge: MODE_BADGE.sandbox, notes };
    if (wanted === "sandbox") notes.push("Sandbox keys are not set");
  }
  if (paperKeys(env)) return { mode: "demo", engine: "alpaca_paper", badge: MODE_BADGE.demo, notes };
  notes.push("Paper keys are not set, so orders stay in this browser");
  return { mode: "demo", engine: "browser", badge: MODE_BADGE.demo, notes };
}
