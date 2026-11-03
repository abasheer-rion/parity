// A strategy described in plain words, turned into Parity's rule format by the person's own
// model (DEC-0051: their key, their bill, called from their browser). Parity never pays for
// this and never sees the key. The model only writes rules; the rules are then checked and
// run like any other, and shown to the person so they can see what was tested.
import { BUILTINS, FUNCS, MARKETS, RULES_FORMAT, RulesError, validateRules, type Rules } from "./rules";
import type { ScriptRead } from "./script";

/** The instructions sent to the person's model with their description. */
export function plainPrompt(description: string, market: string): { system: string; prompt: string } {
  const fns = Object.entries(FUNCS).map(([k, v]) => `${k} (${v.args}${v.optional ? `-${v.args + v.optional}` : ""} args: ${v.words})`).join("; ");
  const system = [
    "You turn a trading strategy described in words into Parity's rule format, JSON only.",
    "Never invent settings the person did not give unless the rule cannot work without one; when you must, use the most common value and list it in \"assumed\".",
    "If the description needs anything the format cannot express (the day's open, high, low or volume, other markets, intraday bars, news, order books, position sizing that changes), do not approximate it: list each one in \"unsupported\" and leave the rules out.",
    "Reply with one JSON object and nothing else: {\"rules\": {...}, \"assumed\": [\"...\"], \"unsupported\": [\"...\"]}.",
  ].join(" ");
  const prompt = [
    `Format "${RULES_FORMAT}". Fields: market (use "${market}"), inputs (name -> number: every length or level a person could tune), let (name -> expression, in order), long and short (each with entry, exit, stop, limit as expressions, or stop_loss and take_profit as fractions such as 0.05), size (share of the account, default 1).`,
    "An expression is a number, a name (an input, a let value, or a built-in), or a list [function, arg, ...].",
    `Built-ins: ${Object.entries(BUILTINS).map(([k, v]) => `${k} (${v})`).join("; ")}.`,
    `Functions: ${fns}. Lengths must be numbers or input names.`,
    "Orders fill at the close of the day the entry or exit rule is true. One position at a time; an entry on the other side turns the position around.",
    'Example, "buy when the 10-day average crosses above the 30-day, sell when it crosses back, 5% stop": {"rules": {"market": "BTCUSD", "inputs": {"fast": 10, "slow": 30}, "let": {"f": ["sma", "close", "fast"], "s": ["sma", "close", "slow"]}, "long": {"entry": ["crossover", "f", "s"], "exit": ["crossunder", "f", "s"], "stop_loss": 0.05}}, "assumed": [], "unsupported": []}',
    `Markets we hold: ${MARKETS.map((m) => m.id).join(", ")}.`,
    "",
    "The strategy:",
    description.slice(0, 4000),
  ].join("\n");
  return { system, prompt };
}

/** Reads the model's reply. Anything wrong with the rules is listed, never fixed silently. */
export function readPlainReply(reply: string, market: string): ScriptRead {
  const m = reply.match(/\{[\s\S]*\}/);
  const fail = (why: string): ScriptRead => ({ language: "plain", rules: null, name: null, blocking: [{ what: "your model's answer", line: 0, why }], ignored: [], notes: [], capital: null });
  if (!m) return fail("the model did not answer with rules in JSON. Try again, or write the rules more plainly.");
  let doc: { rules?: unknown; assumed?: unknown; unsupported?: unknown };
  try { doc = JSON.parse(m[0]); } catch { return fail("the model's JSON could not be read. Try again."); }
  const unsupported = Array.isArray(doc.unsupported) ? doc.unsupported.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
  const assumed = Array.isArray(doc.assumed) ? doc.assumed.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
  const notes = ["Your own model turned the description into the rules below. Check that they say what you meant: the test runs these rules, not the words.", ...assumed.map((a) => `Your model assumed: ${a}`)];
  if (unsupported.length) return { language: "plain", rules: null, name: null, blocking: unsupported.map((u) => ({ what: u, line: 0, why: "your model says the rules need this, and we cannot run it." })), ignored: [], notes, capital: null };
  if (!doc.rules || typeof doc.rules !== "object") return fail("the model's answer has no rules.");
  try {
    const rules: Rules = validateRules({ format: RULES_FORMAT, inputs: {}, let: {}, ...(doc.rules as object), market });
    return { language: "plain", rules, name: null, blocking: [], ignored: [], notes, capital: null };
  } catch (e) {
    if (!(e instanceof RulesError)) throw e;
    return { language: "plain", rules: null, name: null, blocking: e.problems.map((p) => ({ what: "rules", line: 0, why: p })), ignored: [], notes, capital: null };
  }
}
