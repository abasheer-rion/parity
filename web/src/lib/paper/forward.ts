// Strategy forward testing on a demo account (DEC-0034). The research nightly run
// (.github/workflows/research.yml) reruns every strategy on the newest data each night
// with its code frozen. So the honest forward test is the strategy's own equity curve
// from the day it was attached onward: those days were not known when the strategy was
// built or attached. We scale it to the account's capital and show it next to what the
// backtest promised before that day. Nothing here makes up a number.
import type { Point, StrategyRun } from "../types";
import { periodsPerYear, scaleBefore, scaleFrom, statsFor, type Stats } from "./stats";

/** The kinds of spec the MCP server accepts (engine/src/parity/mcp_server.py, SPEC_OPTIONS). */
export const SPEC_KINDS = ["trend", "rank", "timing", "chart", "pair", "mix", "cot", "policy"];

export interface DraftSpec { spec: Record<string, unknown>; name: string | null }

/** Read a pasted MCP draft: a spec object, or a tool result that carries one under `spec`. */
export function parseDraftSpec(text: string): DraftSpec | { error: string } {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return { error: "That is not valid JSON. Paste the spec object the MCP server gave you." }; }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { error: "The spec must be a JSON object, like {\"kind\": \"trend\", ...}." };
  const outer = v as Record<string, unknown>;
  const spec = (outer.spec && typeof outer.spec === "object" && !Array.isArray(outer.spec) ? outer.spec : outer) as Record<string, unknown>;
  if (typeof spec.kind !== "string" || !SPEC_KINDS.includes(spec.kind)) return { error: `The spec needs a "kind", one of ${SPEC_KINDS.join(", ")}.` };
  if (JSON.stringify(spec).length > 10_000) return { error: "That spec is too long to store." };
  const name = [outer.name, outer.display_name, spec.name].find((x): x is string => typeof x === "string" && x.trim().length > 0) ?? null;
  return { spec, name: name ? name.trim().slice(0, 200) : null };
}

export interface ForwardView {
  /** The backtest before the start date, scaled to end at the capital. */
  backtest: Point[];
  /** The out-of-sample part from the start date, scaled to start at the capital. */
  forward: Point[];
  promise: Stats;
  so_far: Stats;
  periods_per_year: number;
}

export function forwardView(run: Pick<StrategyRun, "equity">, start: string, capital: number): ForwardView {
  const ppy = periodsPerYear(run.equity);
  const backtest = scaleBefore(run.equity, start, capital);
  const forward = scaleFrom(run.equity, start, capital);
  return { backtest, forward, promise: statsFor(backtest, [], ppy), so_far: statsFor(forward, [], ppy), periods_per_year: ppy };
}
