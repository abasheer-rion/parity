// Reads TradingView Pine Script (versions 4 to 6, the common subset) into Parity's rule format.
// Deterministic: the same script always gives the same rules. What is read:
//   strategy(...) settings: initial_capital, default_qty_type and _value, commission
//   inputs: input(), input.int(), input.float(), input.bool(), input.source(); plain number settings
//   values: arithmetic, comparisons, and/or/not, a ? b : c, x[n], nz(), na()
//   indicators on the close: ta.sma, ema, rma, wma, rsi, roc, change, mom, stdev, highest,
//     lowest, cci, macd, bb, crossover, crossunder, cross; math.abs, max, min, log, sqrt, pow
//   orders: strategy.entry, strategy.close, strategy.close_all, strategy.exit with stop,
//     limit, loss and profit, inside if / else blocks or with when=
// Anything else that the orders depend on is refused by name with its line (blocking);
// drawings, alerts and values no order uses are listed as left out (ignored).
import { BUILTINS, MARKETS, NEEDS_MORE_DATA, type Expr, type Market, type Rules, type SideRules, RULES_FORMAT } from "./rules";
import { and, or, ScriptError, substitute, uses, type ScriptRead, type Unsupported } from "./script";

// ---------------------------------------------------------------- tokens and lines

interface Tok { k: "num" | "str" | "id" | "op"; v: string }
interface Line { indent: number; toks: Tok[]; line: number }

const OPS = [":=", "==", "!=", ">=", "<=", "=>", "+=", "-=", "*=", "/=", "%=", "+", "-", "*", "/", "%", ">", "<", "=", "?", ":", ",", "(", ")", "[", "]"];

function tokenize(text: string, line: number): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (ch === "/" && text[i + 1] === "/") break;
    if (ch === '"' || ch === "'") {
      let j = i + 1, s = "";
      while (j < text.length && text[j] !== ch) { if (text[j] === "\\") { s += text[j + 1] ?? ""; j += 2; continue; } s += text[j++]; }
      if (j >= text.length) throw new ScriptError("a text value is not closed with a quote.", line);
      out.push({ k: "str", v: s }); i = j + 1; continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      const m = text.slice(i).match(/^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/)!;
      out.push({ k: "num", v: m[0] }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/)!;
      out.push({ k: "id", v: m[0] }); i += m[0].length; continue;
    }
    if (ch === "#") { const m = text.slice(i).match(/^#[0-9A-Fa-f]{3,8}/); if (m) { out.push({ k: "str", v: m[0] }); i += m[0].length; continue; } }
    const op = OPS.find((o) => text.startsWith(o, i));
    if (!op) throw new ScriptError(`"${ch}" is not something Pine Script uses here.`, line);
    out.push({ k: "op", v: op }); i += op.length;
  }
  return out;
}

/** Physical lines to logical ones: brackets and lines indented by a number of spaces that is not a multiple of 4 continue the line before. */
function logicalLines(src: string): { lines: Line[]; version: number | null } {
  const raw = src.replace(/\r\n?/g, "\n").split("\n");
  let version: number | null = null;
  const lines: Line[] = [];
  let cur: Line | null = null, depth = 0;
  raw.forEach((text, k) => {
    const n = k + 1;
    const v = text.match(/^\s*\/\/\s*@version\s*=\s*(\d+)/);
    if (v) version = +v[1];
    const body = text.replace(/\t/g, "    ");
    const toks = tokenize(body, n);
    if (!toks.length) return;
    const indent = body.length - body.trimStart().length;
    if (cur && (depth > 0 || indent % 4 !== 0)) cur.toks.push(...toks);
    else { cur = { indent: indent / 4, toks, line: n }; lines.push(cur); depth = 0; }
    for (const t of toks) if (t.k === "op") { if (t.v === "(" || t.v === "[") depth++; else if (t.v === ")" || t.v === "]") depth--; }
  });
  return { lines, version };
}

// ---------------------------------------------------------------- expressions

type Node =
  | { t: "num"; v: number } | { t: "str"; v: string } | { t: "bool"; v: boolean } | { t: "na" } | { t: "id"; v: string }
  | { t: "call"; fn: string; args: Node[]; named: Record<string, Node> }
  | { t: "idx"; x: Node; i: Node } | { t: "bin"; op: string; a: Node; b: Node } | { t: "un"; op: string; a: Node }
  | { t: "tern"; c: Node; a: Node; b: Node } | { t: "tuple"; items: Node[] };

const BIN: Record<string, number> = { or: 1, and: 2, "==": 3, "!=": 3, "<": 4, ">": 4, "<=": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6 };

class P {
  i = 0;
  constructor(public toks: Tok[], public line: number) {}
  peek(o = 0): Tok | undefined { return this.toks[this.i + o]; }
  is(v: string, o = 0) { const t = this.peek(o); return !!t && (t.k === "op" || t.k === "id") && t.v === v; }
  eat(v: string) { if (!this.is(v)) throw new ScriptError(`expected "${v}"${this.peek() ? ` but found "${this.peek()!.v}"` : " at the end of the line"}.`, this.line); this.i++; }
  done() { return this.i >= this.toks.length; }

  expr(): Node {
    const c = this.binary(1);
    if (this.is("?")) { this.i++; const a = this.expr(); this.eat(":"); const b = this.expr(); return { t: "tern", c, a, b }; }
    return c;
  }
  binary(min: number): Node {
    let a = this.unary();
    for (;;) {
      const t = this.peek();
      const p = t && (t.k === "op" || t.k === "id") ? BIN[t.v] : undefined;
      if (p == null || p < min) return a;
      this.i++;
      const b = this.binary(p + 1);
      a = { t: "bin", op: t!.v, a, b };
    }
  }
  unary(): Node {
    if (this.is("-") || this.is("+")) { const op = this.peek()!.v; this.i++; return { t: "un", op, a: this.unary() }; }
    if (this.is("not")) { this.i++; return { t: "un", op: "not", a: this.unary() }; }
    return this.postfix(this.primary());
  }
  postfix(x: Node): Node {
    for (;;) {
      if (this.is("(") && x.t === "id") { x = this.call(x.v); continue; }
      if (this.is("[")) { this.i++; const i = this.expr(); this.eat("]"); x = { t: "idx", x, i }; continue; }
      return x;
    }
  }
  call(fn: string): Node {
    this.eat("(");
    const args: Node[] = [], named: Record<string, Node> = {};
    while (!this.is(")")) {
      if (this.peek()?.k === "id" && this.is("=", 1)) { const k = this.peek()!.v; this.i += 2; named[k] = this.expr(); }
      else args.push(this.expr());
      if (!this.is(")")) this.eat(",");
    }
    this.eat(")");
    return { t: "call", fn, args, named };
  }
  primary(): Node {
    const t = this.peek();
    if (!t) throw new ScriptError("the line ends too early.", this.line);
    this.i++;
    if (t.k === "num") return { t: "num", v: Number(t.v) };
    if (t.k === "str") return { t: "str", v: t.v };
    if (t.k === "id") {
      if (t.v === "true" || t.v === "false") return { t: "bool", v: t.v === "true" };
      if (t.v === "na") return { t: "na" };
      return { t: "id", v: t.v };
    }
    if (t.v === "(") { const e = this.expr(); this.eat(")"); return e; }
    if (t.v === "[") {
      const items: Node[] = [];
      while (!this.is("]")) { items.push(this.expr()); if (!this.is("]")) this.eat(","); }
      this.eat("]");
      return { t: "tuple", items };
    }
    throw new ScriptError(`"${t.v}" cannot start a value.`, this.line);
  }
}

// ---------------------------------------------------------------- statements

type Stmt =
  | { s: "decl"; name: string; value: Node; line: number; isVar: boolean }
  | { s: "tuple"; names: string[]; value: Node; line: number }
  | { s: "assign"; name: string; op: string; line: number }
  | { s: "expr"; e: Node; line: number }
  | { s: "if"; cond: Node; body: Stmt[]; els: Stmt[] | null; line: number }
  | { s: "block"; what: string; why: string; line: number; body: Stmt[] };

const TYPES = new Set(["int", "float", "bool", "string", "color", "series", "simple", "const", "line", "label", "box", "table", "array", "matrix", "map"]);

function parseBlock(lines: Line[], from: number, indent: number): { stmts: Stmt[]; next: number } {
  const stmts: Stmt[] = [];
  let i = from;
  while (i < lines.length && lines[i].indent >= indent) {
    const ln = lines[i];
    if (ln.indent > indent) throw new ScriptError("this line is indented more than the block it is in.", ln.line);
    const p = new P(ln.toks, ln.line);
    const head = p.peek()!;
    const body = () => { const b = parseBlock(lines, i + 1, indent + 1); i = b.next; return b.stmts; };
    if (head.k === "id" && head.v === "if") {
      p.i++;
      const cond = p.expr();
      const st: Stmt = { s: "if", cond, body: body(), els: null, line: ln.line };
      stmts.push(st);
      // else and else if chains
      let tail = st as Extract<Stmt, { s: "if" }>;
      while (i < lines.length && lines[i].indent === indent && lines[i].toks[0]?.v === "else") {
        const el = lines[i], q = new P(el.toks, el.line);
        q.i++;
        if (q.is("if")) {
          q.i++;
          const c = q.expr();
          const nested: Extract<Stmt, { s: "if" }> = { s: "if", cond: c, body: [], els: null, line: el.line };
          nested.body = body();
          tail.els = [nested];
          tail = nested;
        } else tail.els = body();
      }
      continue;
    }
    if (head.k === "id" && ["for", "while", "switch"].includes(head.v)) {
      stmts.push({ s: "block", what: head.v, why: head.v === "switch" ? "a switch block chooses between values in a way we cannot turn into rules yet" : "loops keep state from day to day, which we cannot turn into rules yet", line: ln.line, body: body() });
      continue;
    }
    if (head.k === "id" && ["import", "export", "type", "method"].includes(head.v)) {
      stmts.push({ s: "block", what: head.v, why: head.v === "import" ? "libraries are other people's code that we cannot read" : "custom types and exported functions are not supported", line: ln.line, body: body() });
      continue;
    }
    if (ln.toks.some((t) => t.k === "op" && t.v === "=>")) {
      const name = head.v;
      const multi = ln.toks[ln.toks.length - 1].v === "=>";
      stmts.push({ s: "block", what: `${name}(...) =>`, why: "functions written in the script are not supported yet", line: ln.line, body: multi ? body() : [] });
      i++;
      continue;
    }
    // Declarations: [var] [type] name = value, and [a, b] = value.
    let k = 0, isVar = false;
    if (head.k === "id" && (head.v === "var" || head.v === "varip")) { isVar = true; k++; }
    while (ln.toks[k]?.k === "id" && TYPES.has(ln.toks[k].v) && ln.toks[k + 1]?.k === "id") k++;
    const t0 = ln.toks[k], t1 = ln.toks[k + 1];
    if (t0?.k === "op" && t0.v === "[") {
      const close = ln.toks.findIndex((t, j) => j > k && t.v === "]");
      if (ln.toks[close + 1]?.v === "=") {
        const names = ln.toks.slice(k + 1, close).filter((t) => t.k === "id").map((t) => t.v);
        p.i = close + 2;
        stmts.push({ s: "tuple", names, value: p.expr(), line: ln.line });
        if (!p.done()) throw new ScriptError(`something follows the value: "${p.peek()!.v}".`, ln.line);
        i++;
        continue;
      }
    }
    if (t0?.k === "id" && t1?.k === "op" && ["=", ":=", "+=", "-=", "*=", "/=", "%="].includes(t1.v)) {
      p.i = k + 2;
      if (p.is("if") || p.is("switch") || p.is("for")) {
        stmts.push({ s: "block", what: `${t0.v} = ${p.peek()!.v}`, why: "a value chosen by an if or switch block is not supported yet; write it with ? : instead", line: ln.line, body: body() });
        continue;
      }
      const value = p.expr();
      if (!p.done()) throw new ScriptError(`something follows the value: "${p.peek()!.v}".`, ln.line);
      if (t1.v === "=") stmts.push({ s: "decl", name: t0.v, value, line: ln.line, isVar });
      else stmts.push({ s: "assign", name: t0.v, op: t1.v, line: ln.line });
      i++;
      continue;
    }
    const e = p.expr();
    if (!p.done()) throw new ScriptError(`something follows "${ln.toks[0].v}...": "${p.peek()!.v}".`, ln.line);
    stmts.push({ s: "expr", e, line: ln.line });
    i++;
  }
  return { stmts, next: i };
}

// ---------------------------------------------------------------- turning it into rules

const DRAW = /^(plot|plotshape|plotchar|plotarrow|plotcandle|plotbar|bgcolor|barcolor|fill|hline|alert|alertcondition|label\.|line\.|box\.|table\.|linefill\.|polyline\.|log\.|runtime\.error|color\.|array\.|matrix\.|map\.|str\.)/;
const DOW: Record<string, number> = { sunday: 1, monday: 2, tuesday: 3, wednesday: 4, thursday: 5, friday: 6, saturday: 7 };
const SIMPLE: Record<string, [string, number]> = {
  sma: ["sma", 2], ema: ["ema", 2], rma: ["rma", 2], wma: ["wma", 2], rsi: ["rsi", 2], roc: ["roc", 2], stdev: ["stdev", 2], cci: ["cci", 2],
};

class Blocked extends Error { constructor(public u: Unsupported) { super(u.why); } }

interface Decl { node: Node; line: number; tupleIndex?: number; isVar?: boolean }

class Lower {
  decls = new Map<string, Decl>();
  reassigned = new Map<string, number>();
  inputs: Record<string, number> = {};
  lets: Record<string, Expr> = {};
  done = new Map<string, Expr>();
  busy = new Set<string>();
  blocking: Unsupported[] = [];
  ignored: Unsupported[] = [];
  notes: string[] = [];
  autoInput = 0;
  constructor(public market: Market) {}

  block(what: string, line: number, why: string): never { throw new Blocked({ what, line, why }); }

  /** Our name for a script name: names our format reserves get "my_" in front. */
  ours(name: string) { return BUILTINS[name] != null ? `my_${name}` : name; }

  /** Every blocked construct in a value, not only the first, so the person sees them all at once. */
  scan(n: Node, line: number, out: Unsupported[]) {
    const tryIt = (f: () => unknown) => { try { f(); } catch (e) { if (e instanceof Blocked) out.push(e.u); else throw e; } };
    switch (n.t) {
      case "id": {
        // Look inside the value's own definition, so every blocked part behind a name is found.
        const d = this.decls.get(n.v);
        if (d && !this.done.has(n.v) && d.tupleIndex == null && !this.seen.has(n.v) && !this.reassigned.has(n.v)) {
          this.seen.add(n.v);
          const before = out.length;
          this.scan(d.node, d.line, out);
          if (out.length === before) tryIt(() => this.name(n.v, line));
          return;
        }
        tryIt(() => this.name(n.v, line));
        return;
      }
      case "call": {
        // A function we cannot run is named once; its arguments do not matter.
        const known = /^((ta|math)\.)?(sma|ema|rma|wma|rsi|roc|change|mom|stdev|highest|lowest|cci|crossover|crossunder|cross|abs|max|min|log|sqrt|pow|nz|na|timestamp)$|^input(\.|$)/.test(n.fn);
        if (!known) { tryIt(() => this.call(n, line)); return; }
        const before = out.length;
        for (const a of [...n.args, ...Object.values(n.named)]) this.scan(a, line, out);
        if (out.length === before) tryIt(() => this.call(n, line));
        return;
      }
      case "idx": this.scan(n.x, line, out); this.scan(n.i, line, out); return;
      case "bin": this.scan(n.a, line, out); this.scan(n.b, line, out); if (n.op === "%") out.push({ what: "%", line, why: "the remainder operator is not supported yet." }); return;
      case "un": this.scan(n.a, line, out); return;
      case "tern": this.scan(n.c, line, out); this.scan(n.a, line, out); this.scan(n.b, line, out); return;
      case "str": out.push({ what: `"${n.v}"`, line, why: "text values cannot be used in rules." }); return;
      case "tuple": out.push({ what: "[...]", line, why: "a list of values cannot be used here." }); return;
      default: return;
    }
  }

  /** Lowers a value the orders use; on failure records every blocked part and returns undefined. */
  need(n: Node, line: number): Expr | undefined {
    try { return this.expr(n, line); } catch (e) {
      if (!(e instanceof Blocked)) throw e;
      const all: Unsupported[] = [];
      this.scan(n, line, all);
      this.blocking.push(...(all.length ? all : [e.u]));
      return undefined;
    }
  }

  tried = new Set<string>();
  seen = new Set<string>();

  name(v: string, line: number): Expr {
    this.tried.add(v);
    if (this.done.has(v)) return this.done.get(v)!;
    const d = this.decls.get(v);
    if (d) {
      if (this.reassigned.has(v)) this.block(`${v} :=`, this.reassigned.get(v)!, `"${v}" is changed later with := or +=, so it carries a value from day to day. We cannot turn that into rules yet.`);
      if (this.busy.has(v)) this.block(v, d.line, `"${v}" is defined from itself.`);
      this.busy.add(v);
      try {
        const out = this.declared(v, d);
        this.done.set(v, out);
        return out;
      } finally { this.busy.delete(v); }
    }
    return this.builtin(v, line);
  }

  declared(v: string, d: Decl): Expr {
    const n = d.node, me = this.ours(v);
    if (d.tupleIndex != null) {
      const items = this.tuple(n, d.line);
      const e = items[d.tupleIndex];
      if (e == null) this.block(v, d.line, `the tuple on line ${d.line} has fewer values than names.`);
      this.lets[me] = e; return me;
    }
    // A setting: an input, or a plain number written once (people tune those too).
    const setting = this.inputDefault(n, d.line);
    if (setting != null) {
      if (typeof setting === "string" || typeof setting === "boolean" || Array.isArray(setting)) return setting;
      this.inputs[me] = setting; return me;
    }
    if (n.t === "num" || (n.t === "un" && n.op === "-" && n.a.t === "num")) {
      this.inputs[me] = n.t === "num" ? n.v : -(n.a as { v: number }).v; return me;
    }
    if (n.t === "bool") return n.v;
    const e = this.expr(n, d.line);
    if (typeof e === "number" || typeof e === "boolean") return e;
    this.lets[me] = e; return me;
  }

  /** An input call's default, or a source input's series; null when the node is not an input. */
  inputDefault(n: Node, line: number): Expr | null {
    if (n.t !== "call" || !/^input(\.(int|float|bool|source|price))?$/.test(n.fn)) {
      if (n.t === "call" && /^input\./.test(n.fn)) this.block(n.fn, line, `${n.fn} gives a setting we cannot use in rules (text, a date, a symbol or a time frame).`);
      return null;
    }
    const def = n.named.defval ?? n.args[0];
    if (!def) this.block(n.fn, line, "the input has no default value.");
    if (n.fn === "input.source" || (n.fn === "input" && def.t === "id")) return this.expr(def, line);
    if (def.t === "bool") return def.v;
    if (n.fn === "input.bool") this.block(n.fn, line, "the default of a true or false input must be true or false.");
    const v = this.expr(def, line);
    if (typeof v !== "number") this.block(n.fn, line, "an input's default must be a number.");
    return v;
  }

  builtin(v: string, line: number): Expr {
    if (v === "close" || v === "time" || v === "year" || v === "month" || v === "dayofweek" || v === "dayofmonth") return v;
    if (v === "strategy.position_size") return "position";
    if (v === "strategy.position_avg_price") return "entry_price";
    if (v === "strategy.opentrades") return ["abs", "position"];
    if (v === "syminfo.mintick") return this.market.tick;
    if (v === "barstate.isconfirmed" || v === "barstate.ishistory") return true;
    if (v.startsWith("dayofweek.") && DOW[v.slice(10)]) return DOW[v.slice(10)];
    if (NEEDS_MORE_DATA[v]) this.block(v, line, `"${v}" needs ${NEEDS_MORE_DATA[v]}. We hold one closing price a day.`);
    if (v === "bar_index" || v === "last_bar_index" || v.startsWith("barstate.")) this.block(v, line, `"${v}" depends on the chart the script runs on, which we cannot copy.`);
    if (v.startsWith("timeframe.") || v.startsWith("syminfo.")) this.block(v, line, `"${v}" depends on the chart's market or time frame. We run every script on daily prices of the market you pick.`);
    if (v.startsWith("strategy.")) this.block(v, line, `"${v}" is not supported yet.`);
    this.block(v, line, `"${v}" is not defined in the script.`);
  }

  len(n: Node | undefined, fn: string, line: number, dflt?: number): Expr {
    if (!n) { if (dflt != null) return dflt; this.block(fn, line, `${fn} needs a length.`); }
    const e = this.expr(n, line);
    if (typeof e === "number") { if (!(Number.isInteger(e) && e >= 1)) this.block(fn, line, `the length in ${fn} must be a whole number of at least 1.`); return e; }
    if (typeof e === "string" && this.inputs[e] != null) return e;
    this.block(fn, line, `the length in ${fn} must be a fixed number or a setting, not a value that changes from day to day.`);
  }

  tuple(n: Node, line: number): Expr[] {
    if (n.t !== "call") this.block("[...] =", line, "only ta.macd and ta.bb give several values at once here.");
    const f = n.fn.replace(/^ta\./, "");
    const a = n.args;
    if (f === "macd") {
      const src = this.expr(a[0], line), x = this.len(a[1], n.fn, line), y = this.len(a[2], n.fn, line), z = this.len(a[3], n.fn, line);
      return [["macd", src, x, y], ["macd_signal", src, x, y, z], ["macd_hist", src, x, y, z]];
    }
    if (f === "bb") {
      const src = this.expr(a[0], line), L = this.len(a[1], n.fn, line), m = this.expr(a[2], line);
      return [["sma", src, L], ["bb_upper", src, L, m], ["bb_lower", src, L, m]];
    }
    if (NEEDS_MORE_DATA[f]) this.block(n.fn, line, `${n.fn} needs ${NEEDS_MORE_DATA[f]}. We hold one closing price a day.`);
    this.block(n.fn, line, `${n.fn} is not supported yet.`);
  }

  expr(n: Node, line: number): Expr {
    switch (n.t) {
      case "num": return n.v;
      case "bool": return n.v;
      case "na": return "nan";
      case "str": this.block(`"${n.v}"`, line, "text values cannot be used in rules.");
      // falls through (block throws)
      case "id": return this.name(n.v, line);
      case "tuple": this.block("[...]", line, "a list of values cannot be used here.");
      // falls through
      case "idx": {
        const k = this.expr(n.i, line);
        if (typeof k !== "number" || !Number.isInteger(k) || k < 0) this.block("[ ]", line, "a value from some days back needs a fixed whole number of days.");
        const x = this.expr(n.x, line);
        return k === 0 ? x : ["prev", x, k];
      }
      case "un": {
        const a = this.expr(n.a, line);
        if (n.op === "+") return a;
        if (n.op === "-") return typeof a === "number" ? -a : ["neg", a];
        return ["not", a];
      }
      case "bin": {
        if (n.op === "%") this.block("%", line, "the remainder operator is not supported yet.");
        return [n.op, this.expr(n.a, line), this.expr(n.b, line)];
      }
      case "tern": return ["if", this.expr(n.c, line), this.expr(n.a, line), this.expr(n.b, line)];
      case "call": return this.call(n, line);
    }
  }

  call(n: Extract<Node, { t: "call" }>, line: number): Expr {
    const fn = n.fn, f = fn.replace(/^(ta|math)\./, "");
    const a = n.args, arg = (k: number, name?: string) => n.named[name ?? ""] ?? a[k];
    if (/^input(\.|$)/.test(fn)) {
      const v = this.inputDefault(n, line)!;
      if (typeof v !== "number") return v;
      const title = n.named.title ?? a[1];
      let me = title?.t === "str" ? title.v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") : "";
      if (!/^[a-z_]/.test(me) || this.inputs[me] != null) me = `input_${++this.autoInput}`;
      this.inputs[me] = v; return me;
    }
    if (SIMPLE[f] && (fn.startsWith("ta.") || fn === f)) {
      if (a.length + Object.keys(n.named).length < 2) this.block(fn, line, `${fn} needs a source and a length.`);
      return [SIMPLE[f][0], this.expr(arg(0, "source"), line), this.len(arg(1, "length"), fn, line)];
    }
    switch (f) {
      case "change": case "mom": return ["change", this.expr(arg(0, "source"), line), this.len(arg(1, "length"), fn, line, 1)];
      case "highest": case "lowest": {
        if (a.length + Object.keys(n.named).length < 2) this.block(fn, line, `${fn} with only a length reads the day's ${f === "highest" ? "high" : "low"}, which we do not hold. Give it the close: ${fn}(close, length).`);
        return [f, this.expr(arg(0, "source"), line), this.len(arg(1, "length"), fn, line)];
      }
      case "crossover": case "crossunder": case "cross": return [f, this.expr(a[0], line), this.expr(a[1], line)];
      case "abs": case "log": case "sqrt": return [f, this.expr(a[0], line)];
      case "max": case "min": {
        if (a.length !== 2) this.block(fn, line, `${fn} with ${a.length} values is not supported; use two.`);
        return [f, this.expr(a[0], line), this.expr(a[1], line)];
      }
      case "pow": return ["pow", this.expr(a[0], line), this.expr(a[1], line)];
      case "nz": return a.length > 1 ? ["nz", this.expr(a[0], line), this.expr(a[1], line)] : ["nz", this.expr(a[0], line)];
      case "na": return ["na", this.expr(a[0], line)];
      case "timestamp": return this.timestamp(n, line);
      case "macd": case "bb": this.block(fn, line, `${fn} gives several values; write [a, b, c] = ${fn}(...) on its own line.`);
    }
    if (fn === "request.security" || fn === "security") this.block(fn, line, "it reads another market or time frame. We run every script on the daily prices of one market.");
    const name = f.toLowerCase();
    if (NEEDS_MORE_DATA[name]) this.block(fn, line, `${fn} needs ${NEEDS_MORE_DATA[name]}. We hold one closing price a day.`);
    this.block(fn, line, `${fn} is not supported yet.`);
  }

  timestamp(n: Extract<Node, { t: "call" }>, line: number): number {
    const a = n.args.filter((x) => !(x.t === "str" && /^(UTC|GMT|[A-Z][a-z]+\/)/.test(x.v)));
    if (a.length === 1 && a[0].t === "str") {
      const ms = Date.parse(a[0].v);
      if (!Number.isFinite(ms)) this.block("timestamp", line, `"${a[0].v}" is not a date we can read.`);
      return ms;
    }
    const nums = a.map((x) => this.expr(x, line));
    if (nums.length < 3 || nums.some((x) => typeof x !== "number")) this.block("timestamp", line, "timestamp needs a fixed year, month and day.");
    const [y, m, d, h = 0, mi = 0] = nums as number[];
    return Date.UTC(y, m - 1, d, h, mi);
  }
}

/** Every declaration in the script, nested ones too, so a name can be looked up wherever it is used. */
function collect(stmts: Stmt[], L: Lower) {
  for (const s of stmts) {
    if (s.s === "decl") {
      if (L.decls.has(s.name) && !s.isVar) L.reassigned.set(s.name, s.line);
      L.decls.set(s.name, { node: s.value, line: s.line, isVar: s.isVar });
    } else if (s.s === "tuple") s.names.forEach((nm, k) => L.decls.set(nm, { node: s.value, line: s.line, tupleIndex: k }));
    else if (s.s === "assign") { if (!L.reassigned.has(s.name)) L.reassigned.set(s.name, s.line); }
    else if (s.s === "if") { collect(s.body, L); if (s.els) collect(s.els, L); }
    else if (s.s === "block") collect(s.body, L);
  }
}

const isOrder = (fn: string) => /^strategy\.(entry|close|close_all|exit|order|cancel|cancel_all|risk\.)/.test(fn);
function hasOrders(stmts: Stmt[]): boolean {
  return stmts.some((s) => (s.s === "expr" && s.e.t === "call" && isOrder(s.e.fn)) || (s.s === "if" && (hasOrders(s.body) || (!!s.els && hasOrders(s.els)))) || (s.s === "block" && hasOrders(s.body)));
}

interface Exit { side: "long" | "short"; stop?: Expr; limit?: Expr; line: number }

export interface PineOptions { market: string }

/** Reads a Pine Script strategy. Throws ScriptError for a syntax problem; constructs we cannot run are listed, not thrown. */
export function readPine(code: string, opt: PineOptions): ScriptRead {
  const market = MARKETS.find((m) => m.id === opt.market) ?? MARKETS[0];
  const { lines, version } = logicalLines(code);
  const { stmts } = parseBlock(lines, 0, 0);
  const L = new Lower(market);
  collect(stmts, L);
  const notes: string[] = [];
  if (version != null && version < 4) notes.push(`The script says Pine version ${version}. We read versions 4 to 6; older scripts may be read wrongly.`);

  let name: string | null = null, capital: number | null = null, size = 1, cost: number | undefined;
  let isStrategy = false, onlyLong = false, onlyShort = false;
  const entries = new Map<string, "long" | "short">();
  const cond: Record<"long" | "short", { entry?: Expr; exit?: Expr }> = { long: {}, short: {} };
  const exits: Exit[] = [];
  const drawn = new Map<string, number>(), drawnAt = new Map<string, number>();

  const safe = <T,>(f: () => T): T | undefined => {
    try { return f(); } catch (e) { if (e instanceof Blocked) { L.blocking.push(e.u); return undefined; } throw e; }
  };
  const num = (n: Node | undefined, line: number) => (n ? safe(() => L.expr(n, line)) : undefined);

  const settings = (n: Extract<Node, { t: "call" }>, line: number) => {
    const title = n.named.title ?? n.args[0];
    if (title?.t === "str") name = title.v;
    const ic = num(n.named.initial_capital, line);
    if (typeof ic === "number" && ic > 0) capital = ic;
    const qt = n.named.default_qty_type, qv = num(n.named.default_qty_value, line);
    const kind = qt?.t === "id" ? qt.v : "strategy.fixed";
    if (kind === "strategy.percent_of_equity" && typeof qv === "number" && qv > 0) size = qv / 100;
    else if (kind === "strategy.cash" && typeof qv === "number" && qv > 0) { size = Math.min(10, qv / (capital ?? 1_000_000)); notes.push(`The script trades ${qv.toLocaleString("en-US")} in cash each time. We use the same share of the starting balance (${(size * 100).toFixed(0)}%) in every trade.`); }
    else notes.push("The script trades a fixed number of contracts. We put the whole account into each trade instead, so results are a share of the account. The luck check depends little on the size; the largest fall does.");
    const ct = n.named.commission_type, cv = num(n.named.commission_value, line);
    if (typeof cv === "number" && cv > 0) {
      if (ct?.t === "id" && ct.v === "strategy.commission.percent") cost = cv / 100;
      else notes.push("The script's commission is a fixed amount per order or contract, which we cannot turn into a share of the trade. We use our own cost for this market.");
    }
    const pyr = num(n.named.pyramiding, line);
    if (typeof pyr === "number" && pyr > 1) notes.push(`The script allows ${pyr} entries in the same direction. We hold one position at a time, so added entries are not modelled.`);
  };

  const walk = (ss: Stmt[], c: Expr | undefined, entryHere: Set<string>) => {
    for (const s of ss) {
      if (s.s === "if") {
        const inBody = hasOrders(s.body), inElse = !!s.els && hasOrders(s.els);
        if (!inBody && !inElse) continue;
        const k = L.need(s.cond, s.line);
        if (k === undefined) continue;
        if (inBody) walk(s.body, and(c, k), new Set());
        if (inElse) walk(s.els!, and(c, ["not", k]), new Set());
        continue;
      }
      if (s.s === "block") {
        if (hasOrders(s.body)) L.blocking.push({ what: s.what, line: s.line, why: `${s.why}. Orders are placed inside it.` });
        else L.ignored.push({ what: s.what, line: s.line, why: `${s.why}. No order depends on it, so it is left out.` });
        continue;
      }
      if (s.s !== "expr" || s.e.t !== "call") continue;
      const n = s.e, fn = n.fn;
      if (fn === "strategy") { isStrategy = true; settings(n, s.line); continue; }
      if (fn === "indicator" || fn === "study") { name = n.args[0]?.t === "str" ? n.args[0].v : name; continue; }
      if (DRAW.test(fn)) { drawn.set(fn, (drawn.get(fn) ?? 0) + 1); if (!drawnAt.has(fn)) drawnAt.set(fn, s.line); continue; }
      const when = n.named.when ? L.need(n.named.when, s.line) : undefined;
      if (n.named.when && when === undefined) continue;
      const here = when === undefined ? c : and(c, when);
      if (fn === "strategy.entry") {
        const id = n.named.id ?? n.args[0];
        const dirN = n.named.direction ?? n.args[1];
        const dir = dirN?.t === "id" ? (dirN.v === "strategy.long" ? "long" : dirN.v === "strategy.short" ? "short" : null) : dirN?.t === "bool" ? (dirN.v ? "long" : "short") : null;
        if (!dir) { L.blocking.push({ what: fn, line: s.line, why: "the direction must be strategy.long or strategy.short." }); continue; }
        if (n.named.limit || n.named.stop || n.args[3] || n.args[4]) { L.blocking.push({ what: `${fn}(limit=, stop=)`, line: s.line, why: "an entry that waits for a price needs the day's high and low to know if it filled. We hold one closing price a day." }); continue; }
        if (n.named.qty || n.args[2]) notes.push(`Line ${s.line}: the entry's own quantity is replaced by the account share we use for every trade.`);
        if (id?.t === "str") entries.set(id.v, dir);
        cond[dir].entry = or(cond[dir].entry, here ?? true);
        entryHere.add(dir);
        continue;
      }
      if (fn === "strategy.close" || fn === "strategy.close_all") {
        const id = n.named.id ?? n.args[0];
        const dir = fn === "strategy.close" && id?.t === "str" ? entries.get(id.v) ?? null : null;
        if (n.named.qty || n.named.qty_percent) { L.blocking.push({ what: `${fn}(qty=)`, line: s.line, why: "closing part of a position is not supported; we hold one whole position at a time." }); continue; }
        for (const d of dir ? [dir] : (["long", "short"] as const)) cond[d].exit = or(cond[d].exit, here ?? true);
        continue;
      }
      if (fn === "strategy.exit") {
        const from = n.named.from_entry ?? n.args[1];
        const dir = from?.t === "str" ? entries.get(from.v) ?? null : null;
        if (from?.t === "str" && !dir) notes.push(`Line ${s.line}: strategy.exit names the entry "${from.v}", which is opened later in the script or not at all. It is applied to both directions.`);
        for (const k of ["trail_price", "trail_points", "trail_offset"]) if (n.named[k]) L.blocking.push({ what: `strategy.exit(${k}=)`, line: s.line, why: "trailing stops need the day's high and low. We hold one closing price a day." });
        const qp = num(n.named.qty_percent, s.line);
        if (typeof qp === "number" && qp < 100) { L.blocking.push({ what: "strategy.exit(qty_percent=)", line: s.line, why: "closing part of a position is not supported; we hold one whole position at a time." }); continue; }
        if (n.named.qty) { L.blocking.push({ what: "strategy.exit(qty=)", line: s.line, why: "closing part of a position is not supported; we hold one whole position at a time." }); continue; }
        for (const d of dir ? [dir] : (["long", "short"] as const)) {
          const sign = d === "long" ? 1 : -1;
          let stop = n.named.stop ? L.need(n.named.stop, s.line) : undefined;
          let limit = n.named.limit ? L.need(n.named.limit, s.line) : undefined;
          const loss = num(n.named.loss, s.line), profit = num(n.named.profit, s.line);
          if (loss != null) stop = ["-", "entry_price", ["*", sign, ["*", loss, market.tick]]];
          if (profit != null) limit = ["+", "entry_price", ["*", sign, ["*", profit, market.tick]]];
          if (loss != null || profit != null) notes.push(`Line ${s.line}: profit and loss given in ticks are read with a tick of ${market.tick} for ${market.id}.`);
          if (stop === undefined && limit === undefined) continue;
          // Placed in the same block as its entry: the levels are fixed when the position opens.
          const placedAtEntry = entryHere.has(d);
          const fix = (e: Expr | undefined) => (e === undefined ? undefined : placedAtEntry ? substitute(e, "close", "entry_price") : e);
          stop = fix(stop); limit = fix(limit);
          const onlyPosition = here === undefined || here === true || !uses(here, ["close", ...Object.keys(L.lets), ...Object.keys(L.inputs)]);
          if (!placedAtEntry && !onlyPosition) {
            notes.push(`Line ${s.line}: a stop or target set only on some days is checked on the day after each of those days.`);
            if (stop !== undefined) stop = ["if", here!, stop, "nan"];
            if (limit !== undefined) limit = ["if", here!, limit, "nan"];
          }
          if (exits.some((x) => x.side === d && ((stop !== undefined && x.stop !== undefined) || (limit !== undefined && x.limit !== undefined)))) {
            L.blocking.push({ what: "strategy.exit", line: s.line, why: `more than one stop or target for ${d} positions. We can run one of each.` });
            continue;
          }
          exits.push({ side: d, stop, limit, line: s.line });
        }
        continue;
      }
      if (fn === "strategy.risk.allow_entry_in") {
        const v = n.args[0];
        if (v?.t === "id" && v.v === "strategy.direction.long") onlyLong = true;
        else if (v?.t === "id" && v.v === "strategy.direction.short") onlyShort = true;
        continue;
      }
      if (isOrder(fn)) { L.blocking.push({ what: fn, line: s.line, why: fn === "strategy.order" ? "raw orders that add to or cut a position are not supported; use strategy.entry and strategy.close." : `${fn} is not supported yet.` }); continue; }
      L.ignored.push({ what: fn, line: s.line, why: "it does not place an order, so it does not change the trades." });
    }
  };
  walk(stmts, undefined, new Set());

  // Declarations no order uses are left out; say which ones we could not have run anyway.
  const used = new Set(L.tried);
  for (const [v, d] of L.decls) {
    if (L.done.has(v) || used.has(v)) continue;
    try { L.name(v, d.line); } catch (e) { if (e instanceof Blocked) L.ignored.push({ ...e.u, why: `${e.u.why} No order uses "${v}", so it is left out.` }); else throw e; }
  }
  for (const [fn, k] of drawn) L.ignored.push({ what: fn, line: drawnAt.get(fn) ?? 0, why: `${k === 1 ? "it only draws" : `${k} calls only draw`} on the chart or send alerts, so ${k === 1 ? "it does" : "they do"} not change the trades.` });

  if (!isStrategy) {
    L.blocking.push({ what: name ? `indicator("${name}")` : "indicator", line: 1, why: "this is an indicator, not a strategy: it has no strategy() line and places no orders. Paste a strategy script, one with strategy.entry calls." });
  }
  if (onlyLong && cond.short.entry) { cond.long.exit = or(cond.long.exit, cond.short.entry); delete cond.short.entry; notes.push("strategy.risk.allow_entry_in allows long trades only, so short entries close the long position instead."); }
  if (onlyShort && cond.long.entry) { cond.short.exit = or(cond.short.exit, cond.long.entry); delete cond.long.entry; notes.push("strategy.risk.allow_entry_in allows short trades only, so long entries close the short position instead."); }
  if (isStrategy && !cond.long.entry && !cond.short.entry && !L.blocking.length) {
    L.blocking.push({ what: "strategy.entry", line: 0, why: "the script never opens a position: there is no strategy.entry call we could read." });
  }

  let rules: Rules | null = null;
  if (!L.blocking.length) {
    const side = (d: "long" | "short"): SideRules | undefined => {
      const c = cond[d];
      if (!c.entry) return undefined;
      const out: SideRules = { entry: c.entry };
      if (c.exit) out.exit = c.exit;
      const x = exits.find((e) => e.side === d && e.stop !== undefined), y = exits.find((e) => e.side === d && e.limit !== undefined);
      if (x) out.stop = x.stop; if (y) out.limit = y.limit;
      return out;
    };
    rules = { format: RULES_FORMAT, market: market.id, inputs: L.inputs, let: L.lets };
    const lg = side("long"), sh = side("short");
    if (lg) rules.long = lg;
    if (sh) rules.short = sh;
    if (size !== 1) rules.size = size;
    if (cost != null) rules.cost = cost;
  }
  notes.push("Pine fills an order at the next day's open; we fill it at the close of the day the signal appears, which for currencies and crypto, traded round the clock, is the same price. The one-day-later run below shows how much that matters.");
  L.blocking.sort((x, y) => x.line - y.line);
  return { language: "pine", rules, name, blocking: dedupe(L.blocking), ignored: dedupe(L.ignored), notes: [...notes, ...L.notes], capital };
}

function dedupe(xs: Unsupported[]): Unsupported[] {
  const seen = new Set<string>();
  return xs.filter((x) => { const k = `${x.what}|${x.line}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** True when text looks like Pine Script rather than Python or words. */
export function looksLikePine(code: string): boolean {
  return /\/\/\s*@version|\bstrategy\s*\(|\bstrategy\.(entry|exit|close)|\bta\.\w+\(|\binput\.(int|float)/.test(code);
}
