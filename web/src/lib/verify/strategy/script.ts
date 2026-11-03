// What every reader of strategy code returns: the rules, the settings the script declares,
// and every part of the script that was not turned into rules, each named with its line, so
// nothing is skipped without saying so.
import type { Expr, Rules } from "./rules";

export interface Unsupported {
  /** The construct, as written in the script: "ta.atr", "request.security", ":=". */
  what: string;
  line: number;
  /** Why it cannot be run, in plain words. */
  why: string;
}

export interface ScriptRead {
  language: "pine" | "python" | "rules" | "plain";
  /** The rules, or null when something the orders depend on cannot be run. */
  rules: Rules | null;
  /** The strategy's name from the script, when it has one. */
  name: string | null;
  /** Constructs the orders depend on that we cannot run. Any of these means no backtest. */
  blocking: Unsupported[];
  /** Parts left out that do not change the trades: drawings, alerts, values no order uses. */
  ignored: Unsupported[];
  /** Assumptions made while reading, in words: "Pine fills at the next open; we fill at the close". */
  notes: string[];
  /** The starting balance the script declares, if any. */
  capital: number | null;
}

/** A syntax problem, with the line it is on. */
export class ScriptError extends Error {
  constructor(message: string, public line: number) { super(`Line ${line}: ${message}`); }
}

/** Replaces every use of one name in an expression. */
export function substitute(e: Expr, from: string, to: Expr): Expr {
  if (e === from) return to;
  if (Array.isArray(e)) return [e[0], ...e.slice(1).map((x) => substitute(x, from, to))] as Expr;
  return e;
}

/** True when an expression reads any of the names. */
export function uses(e: Expr | undefined, names: string[]): boolean {
  if (e == null) return false;
  if (typeof e === "string") return names.includes(e);
  if (Array.isArray(e)) return e.slice(1).some((x) => uses(x, names));
  return false;
}

export const or = (a: Expr | undefined, b: Expr): Expr => (a == null ? b : ["or", a, b]);
export const and = (a: Expr | undefined, b: Expr): Expr => (a == null ? b : ["and", a, b]);
