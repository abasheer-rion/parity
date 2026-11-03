// Reads a simple Python strategy into Parity's rule format. Two common shapes are read:
//
//   pandas columns: a signal or position column built from the close with rolling(), ewm(),
//     shift(), pct_change(), diff(), np.where() and df.loc[...] = ..., where 1 is long,
//     -1 short and 0 flat. Also vectorbt's entries and exits.
//   backtesting.py: a Strategy class with settings as class attributes, indicators made with
//     self.I() in init(), and self.buy(), self.sell() and self.position.close() in next().
//
// Indicators: SMA, EMA, RSI and MACD by those names (backtesting.test, talib, pandas_ta, ta),
// rolling mean, std, max, min and sum, and ewm mean. Deterministic: the same code gives the
// same rules. Anything the trades depend on that we cannot run is refused by name with its
// line; lines that only load data, print or run the backtest are listed as left out.
import { BUILTINS, MARKETS, NEEDS_MORE_DATA, RULES_FORMAT, type Expr, type Rules, type SideRules } from "./rules";
import { and, or, ScriptError, substitute, type ScriptRead, type Unsupported } from "./script";

// ---------------------------------------------------------------- tokens

interface Tok { k: "num" | "str" | "id" | "op"; v: string }
interface Line { indent: number; toks: Tok[]; line: number }

const OPS = ["**=", "//=", "**", "//", "==", "!=", ">=", "<=", "+=", "-=", "*=", "/=", "&=", "|=", "->", ":=", "+", "-", "*", "/", "%", "&", "|", "~", "^", ">", "<", "=", ".", ",", ":", ";", "(", ")", "[", "]", "{", "}", "@"];

function lines(src: string): Line[] {
  const text = src.replace(/\r\n?/g, "\n");
  const out: Line[] = [];
  let toks: Tok[] = [], depth = 0, lineNo = 1, start = 1, indent = 0, atStart = true, cont = false;
  let i = 0;
  const flush = () => { if (toks.length) out.push({ indent, toks, line: start }); toks = []; atStart = true; };
  while (i < text.length) {
    const ch = text[i];
    if (atStart && depth === 0 && !cont) {
      let j = i, w = 0;
      while (text[j] === " " || text[j] === "\t") { w += text[j] === "\t" ? 8 : 1; j++; }
      if (text[j] === "\n" || text[j] === "#" || j >= text.length) { while (j < text.length && text[j] !== "\n") j++; i = j + 1; lineNo++; continue; }
      indent = w; start = lineNo; atStart = false; i = j; continue;
    }
    cont = false;
    if (ch === "\n") { lineNo++; i++; if (depth === 0) flush(); continue; }
    if (ch === "\\" && text[i + 1] === "\n") { cont = true; lineNo++; i += 2; continue; }
    if (ch === " " || ch === "\t") { i++; continue; }
    if (ch === "#") { while (i < text.length && text[i] !== "\n") i++; continue; }
    const pre = text.slice(i).match(/^([rRbBfFuU]{0,2})("""|'''|"|')/);
    if (pre) {
      const q = pre[2];
      let j = i + pre[0].length, s = "";
      while (j < text.length && !text.startsWith(q, j)) { if (text[j] === "\\") { s += text[j + 1] ?? ""; j += 2; continue; } if (text[j] === "\n") { lineNo++; if (q.length === 1) throw new ScriptError("a text value is not closed with a quote.", lineNo - 1); } s += text[j++]; }
      if (j >= text.length) throw new ScriptError("a text value is not closed with a quote.", lineNo);
      toks.push({ k: "str", v: s }); i = j + q.length; continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      const m = text.slice(i).match(/^(\d[\d_]*\.?[\d_]*|\.\d[\d_]*)([eE][-+]?\d+)?/)!;
      toks.push({ k: "num", v: m[0].replace(/_/g, "") }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(ch)) { const m = text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)!; toks.push({ k: "id", v: m[0] }); i += m[0].length; continue; }
    const op = OPS.find((o) => text.startsWith(o, i));
    if (!op) throw new ScriptError(`"${ch}" is not something Python uses here.`, lineNo);
    if ("([{".includes(op)) depth++;
    if (")]}".includes(op)) depth = Math.max(0, depth - 1);
    toks.push({ k: "op", v: op }); i += op.length;
  }
  flush();
  return out;
}

// ---------------------------------------------------------------- expressions

type Node =
  | { t: "num"; v: number } | { t: "str"; v: string } | { t: "const"; v: "True" | "False" | "None" } | { t: "name"; v: string }
  | { t: "attr"; x: Node; name: string } | { t: "call"; f: Node; args: Node[]; kw: Record<string, Node> } | { t: "sub"; x: Node; idx: Node[] }
  | { t: "bin"; op: string; a: Node; b: Node } | { t: "un"; op: string; a: Node } | { t: "tern"; c: Node; a: Node; b: Node }
  | { t: "tuple"; items: Node[] } | { t: "slice" } | { t: "other"; what: string };

const PREC: Record<string, number> = { or: 1, and: 2, "==": 4, "!=": 4, "<": 4, ">": 4, "<=": 4, ">=": 4, "|": 5, "^": 6, "&": 7, "+": 9, "-": 9, "*": 10, "/": 10, "//": 10, "%": 10 };

class Parser {
  i = 0;
  constructor(public toks: Tok[], public line: number) {}
  peek(o = 0) { return this.toks[this.i + o]; }
  is(v: string, o = 0) { const t = this.peek(o); return !!t && (t.k === "op" || t.k === "id") && t.v === v; }
  eat(v: string) { if (!this.is(v)) throw new ScriptError(`expected "${v}"${this.peek() ? ` but found "${this.peek()!.v}"` : " at the end of the line"}.`, this.line); this.i++; }
  done() { return this.i >= this.toks.length; }

  /** A value, or several separated by commas (a tuple). */
  exprList(): Node {
    const first = this.expr();
    if (!this.is(",")) return first;
    const items = [first];
    while (this.is(",")) { this.i++; if (this.done() || this.is(")") || this.is("=")) break; items.push(this.expr()); }
    return { t: "tuple", items };
  }
  expr(): Node {
    if (this.is("lambda")) { while (!this.done() && !this.is(",") && !this.is(")")) this.i++; return { t: "other", what: "lambda" }; }
    const a = this.binary(1);
    if (this.is("if")) { this.i++; const c = this.binary(1); this.eat("else"); const b = this.expr(); return { t: "tern", c, a, b }; }
    return a;
  }
  binary(min: number): Node {
    let a = this.notExpr(min);
    for (;;) {
      const t = this.peek();
      let op = t && (t.k === "op" || t.k === "id") ? t.v : "";
      if (op === "not" && this.is("in", 1)) op = "not in";
      if (op === "in" || op === "not in" || op === "is") { this.i += op === "not in" ? 2 : 1; if (this.is("not")) this.i++; this.binary(5); a = { t: "other", what: op }; continue; }
      const p = PREC[op];
      if (p == null || p < min) return a;
      this.i++;
      a = { t: "bin", op, a, b: this.binary(p + 1) };
    }
  }
  notExpr(min: number): Node {
    if (this.is("not") && min <= 3) { this.i++; return { t: "un", op: "not", a: this.binary(3) }; }
    return this.unary();
  }
  unary(): Node {
    if (this.is("-") || this.is("+") || this.is("~")) { const op = this.peek()!.v; this.i++; return { t: "un", op, a: this.unary() }; }
    const base = this.trailers(this.atom());
    if (this.is("**")) { this.i++; return { t: "bin", op: "**", a: base, b: this.unary() }; }
    return base;
  }
  atom(): Node {
    const t = this.peek();
    if (!t) throw new ScriptError("the line ends too early.", this.line);
    this.i++;
    if (t.k === "num") return { t: "num", v: Number(t.v) };
    if (t.k === "str") { let s = t.v; while (this.peek()?.k === "str") s += this.toks[this.i++].v; return { t: "str", v: s }; }
    if (t.k === "id") return t.v === "True" || t.v === "False" || t.v === "None" ? { t: "const", v: t.v } : { t: "name", v: t.v };
    if (t.v === "(") { if (this.is(")")) { this.i++; return { t: "tuple", items: [] }; } const e = this.exprList(); this.eat(")"); return e; }
    if (t.v === "[" || t.v === "{") {
      const end = t.v === "[" ? "]" : "}";
      let d = 1;
      while (!this.done() && d) { const v = this.peek()!.v; if (v === "(" || v === "[" || v === "{") d++; if (v === ")" || v === "]" || v === "}") d--; this.i++; }
      return { t: "other", what: end === "]" ? "a list" : "a dictionary" };
    }
    throw new ScriptError(`"${t.v}" cannot start a value.`, this.line);
  }
  trailers(x: Node): Node {
    for (;;) {
      if (this.is(".")) { this.i++; const n = this.peek(); if (n?.k !== "id") throw new ScriptError("a name must follow a dot.", this.line); this.i++; x = { t: "attr", x, name: n.v }; continue; }
      if (this.is("(")) {
        this.i++;
        const args: Node[] = [], kw: Record<string, Node> = {};
        while (!this.is(")")) {
          if (this.is("*") || this.is("**")) { this.i++; }
          if (this.peek()?.k === "id" && this.is("=", 1)) { const k = this.peek()!.v; this.i += 2; kw[k] = this.expr(); }
          else args.push(this.expr());
          if (!this.is(")")) this.eat(",");
        }
        this.i++;
        x = { t: "call", f: x, args, kw };
        continue;
      }
      if (this.is("[")) {
        this.i++;
        const idx: Node[] = [];
        while (!this.is("]")) {
          if (this.is(":")) { this.i++; if (!this.is("]") && !this.is(",")) this.expr(); idx.push({ t: "slice" }); }
          else { const e = this.expr(); if (this.is(":")) { this.i++; if (!this.is("]") && !this.is(",")) this.expr(); idx.push({ t: "slice" }); } else idx.push(e); }
          if (!this.is("]")) this.eat(",");
        }
        this.i++;
        x = { t: "sub", x, idx };
        continue;
      }
      return x;
    }
  }
}

// ---------------------------------------------------------------- statements

type Stmt =
  | { s: "assign"; targets: Node[]; value: Node; line: number; aug?: string }
  | { s: "expr"; e: Node; line: number }
  | { s: "if"; cond: Node; body: Stmt[]; els: Stmt[] | null; line: number }
  | { s: "class"; name: string; bases: string[]; body: Stmt[]; line: number }
  | { s: "def"; name: string; body: Stmt[]; line: number }
  | { s: "skip"; what: string; line: number; body: Stmt[] };

function block(ls: Line[], from: number): { stmts: Stmt[]; next: number } {
  const stmts: Stmt[] = [];
  const indent = ls[from]?.indent ?? 0;
  let i = from;
  const sub = (ln: Line, colon: number): Stmt[] => {
    // "if x: y" on one line, or an indented block below.
    if (colon < ln.toks.length - 1) { const one = block([{ indent: indent + 1, toks: ln.toks.slice(colon + 1), line: ln.line }], 0); i++; return one.stmts; }
    i++;
    if (i < ls.length && ls[i].indent > indent) { const b = block(ls, i); i = b.next; return b.stmts; }
    return [];
  };
  const colonAt = (ln: Line) => { let d = 0; for (let k = 0; k < ln.toks.length; k++) { const v = ln.toks[k].v; if ("([{".includes(v) && ln.toks[k].k === "op") d++; if (")]}".includes(v) && ln.toks[k].k === "op") d--; if (v === ":" && ln.toks[k].k === "op" && d === 0) return k; } return -1; };
  while (i < ls.length && ls[i].indent >= indent) {
    const ln = ls[i];
    if (ln.indent > indent) throw new ScriptError("this line is indented more than the block it is in.", ln.line);
    const h = ln.toks[0];
    if (h.k === "op" && h.v === "@") { i++; continue; }
    if (h.k === "id" && (h.v === "if" || h.v === "elif" || h.v === "while" || h.v === "for" || h.v === "with" || h.v === "try" || h.v === "class" || h.v === "def" || h.v === "else" || h.v === "except" || h.v === "finally")) {
      const c = colonAt(ln);
      if (c < 0) throw new ScriptError(`"${h.v}" needs a colon at the end of the line.`, ln.line);
      if (h.v === "if") {
        const p = new Parser(ln.toks.slice(1, c), ln.line);
        const st: Extract<Stmt, { s: "if" }> = { s: "if", cond: p.expr(), body: [], els: null, line: ln.line };
        st.body = sub(ln, c);
        stmts.push(st);
        let tail = st;
        while (i < ls.length && ls[i].indent === indent && (ls[i].toks[0].v === "elif" || ls[i].toks[0].v === "else")) {
          const el = ls[i], ec = colonAt(el);
          if (el.toks[0].v === "elif") {
            const q = new Parser(el.toks.slice(1, ec), el.line);
            const nested: Extract<Stmt, { s: "if" }> = { s: "if", cond: q.expr(), body: [], els: null, line: el.line };
            nested.body = sub(el, ec);
            tail.els = [nested]; tail = nested;
          } else { tail.els = sub(el, ec); break; }
        }
        continue;
      }
      if (h.v === "class") {
        const name = ln.toks[1]?.v ?? "";
        const bases = ln.toks.slice(2, c).filter((t) => t.k === "id").map((t) => t.v);
        stmts.push({ s: "class", name, bases, line: ln.line, body: sub(ln, c) });
        continue;
      }
      if (h.v === "def") { const name = ln.toks[1]?.v ?? ""; stmts.push({ s: "def", name, line: ln.line, body: sub(ln, c) }); continue; }
      stmts.push({ s: "skip", what: h.v, line: ln.line, body: sub(ln, c) });
      continue;
    }
    if (h.k === "id" && ["import", "from", "return", "pass", "print", "global", "assert", "raise", "del", "break", "continue"].includes(h.v) && !(h.v === "print" && false)) {
      if (h.v === "print" || h.v === "return") stmts.push({ s: "expr", e: { t: "other", what: h.v }, line: ln.line });
      i++; continue;
    }
    // Assignment: find a top-level "=" (or an augmented one).
    let d = 0, at = -1, aug: string | undefined;
    for (let k = 0; k < ln.toks.length; k++) {
      const t = ln.toks[k];
      if (t.k !== "op") continue;
      if ("([{".includes(t.v)) d++; else if (")]}".includes(t.v)) d--;
      else if (d === 0 && (t.v === "=" || /^(\+|-|\*|\/|\/\/|\*\*|&|\|)=$/.test(t.v))) { at = k; aug = t.v === "=" ? undefined : t.v.slice(0, -1); break; }
    }
    if (at > 0) {
      const lhs = new Parser(ln.toks.slice(0, at), ln.line);
      const target = lhs.exprList();
      const rhs = new Parser(ln.toks.slice(at + 1), ln.line);
      // a = b = value
      let value = rhs.exprList();
      const targets = target.t === "tuple" ? target.items : [target];
      if (rhs.is("=")) { rhs.i++; value = rhs.exprList(); }
      stmts.push({ s: "assign", targets: targets.length === 1 ? targets : [{ t: "tuple", items: targets }], value, line: ln.line, aug });
      i++; continue;
    }
    const p = new Parser(ln.toks, ln.line);
    stmts.push({ s: "expr", e: p.exprList(), line: ln.line });
    i++;
  }
  return { stmts, next: i };
}

// ---------------------------------------------------------------- values

class Blocked extends Error { constructor(public u: Unsupported) { super(u.why); } }
const block1 = (what: string, line: number, why: string): never => { throw new Blocked({ what, line, why }); };

/** A value while reading: a series (an expression), a data frame, the self of a strategy class, or something we only pass through. */
type V =
  | { k: "expr"; e: Expr }
  | { k: "frame" }
  | { k: "rolling"; x: Expr; n: Expr; line: number }
  | { k: "ewm"; x: Expr; kind: "ema" | "rma"; n: Expr; adjust: boolean }
  | { k: "tuple"; items: V[] }
  | { k: "blocked"; u: Unsupported }
  | { k: "fn"; name: string; self?: { k: "expr"; e: Expr } };

const PRICE_COLS: Record<string, string> = { close: "close", adj_close: "close", "adj close": "close", price: "close" };
const NAMES_SMA = /^(sma|SMA|ta\.sma|talib\.SMA|ta\.trend\.sma_indicator)$/;
const SIGNAL_NAMES = /^(signal|signals|position|positions|pos|target|target_position|side|trade_signal|sig|regime)$/i;

class Reader {
  env = new Map<string, V>();
  inputs: Record<string, number> = {};
  lets: Record<string, Expr> = {};
  lastName = new Map<string, string>();
  blocking: Unsupported[] = [];
  ignored: Unsupported[] = [];
  notes: string[] = [];
  signal: { e: Expr; name: string; line: number; shifted: boolean } | null = null;
  entries: Expr | null = null; exits: Expr | null = null; shortEntries: Expr | null = null; shortExits: Expr | null = null;
  capital: number | null = null; cost: number | undefined; stopLoss?: number; takeProfit?: number;
  btClass: Extract<Stmt, { s: "class" }> | null = null;

  /** A name for a value in our rules: Python names, with names our format reserves prefixed. */
  ours(name: string) {
    let n = name.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1");
    if (BUILTINS[n] != null) n = `my_${n}`;
    // A name assigned twice gets a new name the second time, so both versions stay readable.
    if (this.lets[n] != null || this.inputs[n] != null) { let k = 2; while (this.lets[`${n}_${k}`] != null || this.inputs[`${n}_${k}`] != null) k++; n = `${n}_${k}`; }
    return n;
  }

  bind(name: string, v: V, line: number) {
    if (v.k === "expr" && Array.isArray(v.e)) { const me = this.ours(name); this.lets[me] = v.e; this.env.set(name, { k: "expr", e: me }); this.lastName.set(name, me); return; }
    void line;
    this.env.set(name, v);
  }

  ex(n: Node, line: number): Expr {
    const v = this.val(n, line);
    if (v.k === "expr") return v.e;
    if (v.k === "blocked") throw new Blocked(v.u);
    if (v.k === "frame") return block1("a whole table", line, "a whole table of prices was used where one column was needed.");
    return block1(describe(n), line, `${describe(n)} is not a value we can use in rules.`);
  }

  len(n: Node | undefined, what: string, line: number): Expr {
    if (!n) return block1(what, line, `${what} needs a length.`);
    const e = this.ex(n, line);
    if (typeof e === "number" && Number.isInteger(e) && e >= 1) return e;
    if (typeof e === "string" && this.inputs[e] != null) return e;
    return block1(what, line, `the length in ${what} must be a fixed whole number or a setting.`);
  }

  column(name: string, line: number): V {
    const c = name.toLowerCase();
    if (PRICE_COLS[c]) return { k: "expr", e: "close" };
    if (NEEDS_MORE_DATA[c]) return block1(`'${name}'`, line, `the "${name}" column needs ${NEEDS_MORE_DATA[c]}. We hold one closing price a day.`);
    const v = this.env.get(`col:${name}`);
    if (v) return v;
    return block1(`'${name}'`, line, `the column "${name}" is used before it is made, or comes from a file we do not have.`);
  }

  val(n: Node, line: number): V {
    switch (n.t) {
      case "num": return { k: "expr", e: n.v };
      case "const": return n.v === "None" ? { k: "expr", e: "nan" } : { k: "expr", e: n.v === "True" };
      case "str": return { k: "blocked", u: { what: `"${n.v}"`, line, why: "text values cannot be used in rules." } };
      case "tuple": return { k: "tuple", items: n.items.map((x) => this.val(x, line)) };
      case "other": return { k: "blocked", u: { what: n.what, line, why: `${n.what} is not supported in the code we read.` } };
      case "slice": return { k: "blocked", u: { what: ":", line, why: "a slice of days is not supported." } };
      case "name": {
        const v = this.env.get(n.v);
        if (v) return v;
        if (/^(np|numpy|pd|pandas|ta|talib|vbt|bt|math)$/.test(n.v)) return { k: "fn", name: n.v };
        if (/^(SMA|EMA|RSI|crossover|cross)$/.test(n.v)) return { k: "fn", name: n.v };
        return { k: "blocked", u: { what: n.v, line, why: `"${n.v}" is not defined in the code, or it comes from data we do not have.` } };
      }
      case "attr": {
        if (n.x.t === "name" && /^(np|numpy)$/.test(n.x.v) && n.name === "nan") return { k: "expr", e: "nan" };
        const base = this.val(n.x, line);
        if (base.k === "blocked") return base;
        if (base.k === "fn") return { k: "fn", name: `${base.name}.${n.name}` };
        if (base.k === "frame") return this.column(n.name, line);
        if (base.k === "expr" && (n.name === "values" || n.name === "vbt")) return base;
        if (base.k === "expr") return { k: "fn", name: n.name, self: base };
        return { k: "blocked", u: { what: describe(n), line, why: `${describe(n)} is not something we can use.` } };
      }
      case "sub": {
        const base = this.val(n.x, line);
        if (base.k === "blocked") return base;
        if (base.k === "frame") {
          const i0 = n.idx[0];
          if (i0?.t === "str") return this.column(i0.v, line);
          return { k: "blocked", u: { what: "df[...]", line, why: "rows picked from the table by a rule are not supported; use np.where instead." } };
        }
        if (base.k === "expr") {
          // x[-1] is today and x[-2] yesterday (backtesting.py); x[0] or x[i] picks a row, which we cannot follow.
          const k = n.idx[0];
          const kv = k?.t === "un" && k.op === "-" && k.a.t === "num" ? -k.a.v : k?.t === "num" ? k.v : null;
          if (kv != null && kv < 0 && Number.isInteger(kv)) return { k: "expr", e: kv === -1 ? base.e : ["prev", base.e, -kv - 1] };
          return { k: "blocked", u: { what: "[...]", line, why: "picking one row by its position is not supported; use shift() for earlier days." } };
        }
        if (base.k === "tuple") { const k = n.idx[0]; if (k?.t === "num" && base.items[k.v]) return base.items[k.v]; }
        return { k: "blocked", u: { what: "[...]", line, why: "this kind of indexing is not supported." } };
      }
      case "un": {
        const a = this.val(n.a, line);
        if (a.k !== "expr") return a.k === "blocked" ? a : { k: "blocked", u: { what: n.op, line, why: "this cannot be negated." } };
        if (n.op === "-") return { k: "expr", e: typeof a.e === "number" ? -a.e : ["neg", a.e] };
        if (n.op === "+") return a;
        return { k: "expr", e: ["not", a.e] };
      }
      case "bin": {
        const a = this.val(n.a, line), b = this.val(n.b, line);
        if (a.k === "blocked") return a;
        if (b.k === "blocked") return b;
        if (a.k !== "expr" || b.k !== "expr") return { k: "blocked", u: { what: n.op, line, why: `"${n.op}" between these values is not supported.` } };
        const op = { "&": "and", "|": "or", and: "and", or: "or", "**": "pow" }[n.op] ?? n.op;
        if (op === "//" || op === "%" || op === "^") return { k: "blocked", u: { what: n.op, line, why: `the "${n.op}" operator is not supported yet.` } };
        return { k: "expr", e: [op, a.e, b.e] };
      }
      case "tern": {
        const c = this.val(n.c, line), a = this.val(n.a, line), b = this.val(n.b, line);
        for (const x of [c, a, b]) if (x.k === "blocked") return x;
        if (c.k !== "expr" || a.k !== "expr" || b.k !== "expr") return { k: "blocked", u: { what: "if else", line, why: "this choice is not supported." } };
        return { k: "expr", e: ["if", c.e, a.e, b.e] };
      }
      case "call": return this.call(n, line);
    }
  }

  call(n: Extract<Node, { t: "call" }>, line: number): V {
    // Methods on rolling() and ewm(): x.rolling(20).mean(), x.ewm(span=20).mean().
    if (n.f.t === "attr") {
      const base = this.val(n.f.x, line);
      if (base.k === "blocked") return base;
      if (base.k === "rolling" || base.k === "ewm") return this.windowed(base, n.f.name, line);
    }
    const f = this.val(n.f, line);
    if (f.k === "blocked") return f;
    const a = n.args, kw = n.kw;
    const arg = (k: number, ...names: string[]) => names.map((x) => kw[x]).find(Boolean) ?? a[k];
    const wrap = (fn: () => Expr): V => { try { return { k: "expr", e: fn() }; } catch (e) { if (e instanceof Blocked) return { k: "blocked", u: e.u }; throw e; } };
    if (f.k === "fn") {
      const name = f.name;
      const self = f.self;
      // Methods on a series.
      if (self) {
        const x = self.e;
        switch (name) {
          case "rolling": { try { return { k: "rolling", x, n: this.len(arg(0, "window"), "rolling", line), line }; } catch (e) { if (e instanceof Blocked) return { k: "blocked", u: e.u }; throw e; } }
          case "ewm": {
            const span = kw.span, com = kw.com, alpha = kw.alpha;
            const adjust = !(kw.adjust?.t === "const" && kw.adjust.v === "False");
            if (span) return wrapEwm(() => ({ k: "ewm", x, kind: "ema", n: this.len(span, "ewm(span=)", line), adjust }));
            if (com) return wrapEwm(() => { const c = this.ex(com, line); if (typeof c !== "number") return block1("ewm(com=)", line, "com must be a fixed number."); return { k: "ewm", x, kind: "rma", n: c + 1, adjust }; });
            if (alpha) return wrapEwm(() => { const al = this.ex(alpha, line); if (typeof al !== "number" || !(al > 0)) return block1("ewm(alpha=)", line, "alpha must be a fixed number."); const L = 1 / al; if (!Number.isInteger(Math.round(L * 1e6) / 1e6)) return block1("ewm(alpha=)", line, "alpha must be 1 divided by a whole number of days."); return { k: "ewm", x, kind: "rma", n: Math.round(L), adjust }; });
            return { k: "blocked", u: { what: "ewm()", line, why: "ewm needs span, com or alpha." } };
          }
          case "shift": {
            return wrap(() => {
              const k = arg(0, "periods") ? this.ex(arg(0, "periods")!, line) : 1;
              if (typeof k !== "number" || !Number.isInteger(k)) return block1("shift()", line, "shift needs a fixed whole number of days.");
              if (k < 0) return block1(`shift(${k})`, line, "a negative shift reads prices from the future. A strategy cannot know tomorrow's price today, so this would be peeking.");
              return k === 0 ? x : ["prev", x, k];
            });
          }
          case "pct_change": return wrap(() => { const k = arg(0, "periods") ? this.len(arg(0, "periods"), "pct_change", line) : 1; return ["/", ["change", x, k], ["prev", x, k]]; });
          case "diff": return wrap(() => ["change", x, arg(0, "periods") ? this.len(arg(0, "periods"), "diff", line) : 1]);
          case "abs": return { k: "expr", e: ["abs", x] };
          case "fillna": return wrap(() => ["nz", x, this.ex(arg(0, "value")!, line)]);
          case "astype": case "copy": case "to_numpy": case "squeeze": return { k: "expr", e: x };
          case "crossed_above": return wrap(() => ["crossover", x, this.ex(a[0], line)]);
          case "crossed_below": return wrap(() => ["crossunder", x, this.ex(a[0], line)]);
          case "where": return wrap(() => ["if", this.ex(a[0], line), x, a[1] ? this.ex(a[1], line) : "nan"]);
          default: return { k: "blocked", u: { what: `.${name}()`, line, why: `.${name}() is not supported yet.` } };
        }
      }
      const lower = name.toLowerCase();
      if (/^(np|numpy)\.where$/.test(name)) return wrap(() => ["if", this.ex(a[0], line), this.ex(a[1], line), this.ex(a[2], line)]);
      if (/^(np|numpy)\.sign$/.test(name)) return wrap(() => { const x = this.ex(a[0], line); return ["if", [">", x, 0], 1, ["if", ["<", x, 0], -1, 0]]; });
      if (/^(np|numpy)\.(abs|log|sqrt)$/.test(name)) return wrap(() => [name.split(".")[1], this.ex(a[0], line)]);
      if (/^(np|numpy)\.(maximum|minimum)$/.test(name)) return wrap(() => [name.endsWith("maximum") ? "max" : "min", this.ex(a[0], line), this.ex(a[1], line)]);
      if (/^(pd|pandas)\.Series$/.test(name)) return a[0] ? this.val(a[0], line) : { k: "blocked", u: { what: name, line, why: "an empty series." } };
      if (/^(crossover|backtesting\.lib\.crossover)$/.test(name)) return wrap(() => ["crossover", this.ex(a[0], line), this.ex(a[1], line)]);
      if (/^cross$/.test(name)) return wrap(() => ["cross", this.ex(a[0], line), this.ex(a[1], line)]);
      if (NAMES_SMA.test(name)) return wrap(() => ["sma", this.ex(a[0], line), this.len(arg(1, "timeperiod", "length", "window", "n"), name, line)]);
      if (/^(ema|EMA|ta\.ema|talib\.EMA|ta\.trend\.ema_indicator)$/.test(name)) return wrap(() => ["ema", this.ex(a[0], line), this.len(arg(1, "timeperiod", "length", "window", "n", "span"), name, line)]);
      if (/^(rsi|RSI|ta\.rsi|talib\.RSI|ta\.momentum\.rsi)$/.test(name)) return wrap(() => ["rsi", this.ex(a[0], line), this.len(arg(1, "timeperiod", "length", "window", "n"), name, line)]);
      if (/^(talib\.MACD|ta\.macd|MACD)$/.test(name)) {
        return wrapT(() => {
          const x = this.ex(a[0], line);
          const fa = this.len(arg(1, "fastperiod", "fast", "window_fast"), name, line), sl = this.len(arg(2, "slowperiod", "slow", "window_slow"), name, line), sg = this.len(arg(3, "signalperiod", "signal", "window_sign"), name, line);
          return [["macd", x, fa, sl], ["macd_signal", x, fa, sl, sg], ["macd_hist", x, fa, sl, sg]];
        });
      }
      if (/^(talib\.BBANDS)$/.test(name)) {
        return wrapT(() => {
          const x = this.ex(a[0], line), L = this.len(arg(1, "timeperiod"), name, line);
          const up = kw.nbdevup ? this.ex(kw.nbdevup, line) : 2, dn = kw.nbdevdn ? this.ex(kw.nbdevdn, line) : 2;
          return [["bb_upper", x, L, up], ["sma", x, L], ["bb_lower", x, L, dn]];
        });
      }
      if (name.includes(".")) {
        const short = lower.split(".").pop()!;
        if (NEEDS_MORE_DATA[short]) return { k: "blocked", u: { what: name, line, why: `${name} needs ${NEEDS_MORE_DATA[short]}. We hold one closing price a day.` } };
      }
      return { k: "blocked", u: { what: `${name}()`, line, why: `${name}() is not something we can turn into rules yet.` } };
    }
    return { k: "blocked", u: { what: describe(n.f), line, why: `${describe(n.f)} cannot be called here.` } };

    function wrapEwm(g: () => V): V { try { return g(); } catch (e) { if (e instanceof Blocked) return { k: "blocked", u: e.u }; throw e; } }
    function wrapT(g: () => Expr[]): V { try { return { k: "tuple", items: g().map((e) => ({ k: "expr", e })) }; } catch (e) { if (e instanceof Blocked) return { k: "blocked", u: e.u }; throw e; } }
  }

  windowed(f: Extract<V, { k: "rolling" | "ewm" }>, m: string, line: number): V {
    if (f.k === "rolling") {
      const e = ((): Expr | null => {
        const { x, n: L } = f;
        switch (m) {
          case "mean": return ["sma", x, L];
          case "max": return ["highest", x, L];
          case "min": return ["lowest", x, L];
          case "sum": return ["*", ["sma", x, L], L];
          // pandas uses the sample standard deviation; ours is the population one, so it is scaled up.
          case "std": return ["*", ["stdev", x, L], ["sqrt", ["/", L, ["-", L, 1]]]];
          default: return null;
        }
      })();
      return e == null ? { k: "blocked", u: { what: `rolling().${m}()`, line, why: `rolling().${m}() is not supported yet.` } } : { k: "expr", e };
    }
    if (m !== "mean") return { k: "blocked", u: { what: `ewm().${m}()`, line, why: `ewm().${m}() is not supported yet.` } };
    if (f.adjust) this.notes.push(`Line ${line}: pandas ewm() with adjust=True weights the first weeks a little differently from the usual exponential average we run; after that the two agree.`);
    return { k: "expr", e: [f.kind, f.x, f.n] };
  }
}

function describe(n: Node): string {
  switch (n.t) {
    case "name": return n.v;
    case "attr": return `${describe(n.x)}.${n.name}`;
    case "call": return `${describe(n.f)}()`;
    case "sub": return `${describe(n.x)}[...]`;
    case "other": return n.what;
    default: return "this";
  }
}

// ---------------------------------------------------------------- the two shapes

const LOADS = /^(pd|pandas)\.(read_csv|read_parquet|read_excel|DataFrame)|^(yf|yfinance)\.(download|Ticker)|\.(history|get_data|load|fetch|download)$|^(ccxt|alpaca|ib_insync)/;

function isFrameSource(n: Node): boolean {
  const d = n.t === "call" ? describe(n.f) : n.t === "sub" || n.t === "attr" ? describe(n) : "";
  return LOADS.test(d) || /^(df|data|prices|ohlc|bars)\b/.test(d);
}

function topLevel(R: Reader, stmts: Stmt[]) {
  for (const s of stmts) {
    try { stmt(R, s); } catch (e) { if (e instanceof Blocked) R.ignored.push(e.u); else throw e; }
  }
}

function stmt(R: Reader, s: Stmt) {
  if (s.s === "class") {
    if (s.bases.some((b) => /Strategy$/.test(b))) { R.btClass = s; return; }
    R.ignored.push({ what: `class ${s.name}`, line: s.line, why: "classes other than a backtesting.py Strategy are not read." });
    return;
  }
  if (s.s === "def") { R.env.set(s.name, { k: "blocked", u: { what: `${s.name}()`, line: s.line, why: `"${s.name}" is a function written in the code; functions are not read yet.` } }); return; }
  if (s.s === "skip") { R.ignored.push({ what: s.what, line: s.line, why: s.what === "for" || s.what === "while" ? "a loop over the days. If it builds the signal, write it with columns instead: rolling(), shift() and np.where()." : `a ${s.what} block is not read.` }); markLoop(R, s); return; }
  if (s.s === "if") { R.ignored.push({ what: "if", line: s.line, why: "an if block outside a strategy class is not read." }); return; }
  if (s.s === "expr") {
    const d = s.e.t === "call" ? describe(s.e.f) : describe(s.e);
    if (/from_signals$/.test(d) && s.e.t === "call") { fromSignals(R, s.e, s.line); return; }
    if (/^(Backtest|bt\.run|.*\.run|.*\.plot|.*\.optimize)/.test(d)) { backtestCall(R, s.e, s.line); return; }
    R.ignored.push({ what: d === "this" ? "a line" : d, line: s.line, why: "it does not build the signal, so it does not change the trades." });
    return;
  }
  // Assignments.
  const [target] = s.targets;
  if (s.aug) {
    const nm = target.t === "name" ? target.v : target.t === "sub" && target.idx[0]?.t === "str" ? `col:${target.idx[0].v}` : null;
    if (nm) R.env.set(nm, { k: "blocked", u: { what: `${s.aug}=`, line: s.line, why: `"${s.aug}=" changes a value in place, which we cannot follow yet.` } });
    return;
  }
  if (s.value.t === "call" && /from_signals$/.test(describe(s.value.f))) { fromSignals(R, s.value, s.line); return; }
  if (s.value.t === "call" && /^(Backtest|bt\.Backtest)$/.test(describe(s.value.f))) { backtestCall(R, s.value, s.line); return; }
  if (target.t === "name" && isFrameSource(s.value) && !(s.value.t === "sub" && s.value.idx[0]?.t === "str")) { R.env.set(target.v, { k: "frame" }); R.ignored.push({ what: describe(s.value), line: s.line, why: "it loads prices. We use our own daily prices for the market you pick." }); return; }
  // df.loc[cond, 'col'] = value
  if (target.t === "sub" && target.x.t === "attr" && (target.x.name === "loc" || target.x.name === "iloc")) {
    const [c, colN] = target.idx;
    if (colN?.t !== "str") { R.env.set("col:?", { k: "blocked", u: { what: ".loc[...]", line: s.line, why: ".loc needs a rule and a column name." } }); return; }
    const key = `col:${colN.v}`;
    const prevV = R.env.get(key);
    const cond = R.val(c, s.line), v = R.val(s.value, s.line);
    for (const x of [cond, v, prevV ?? { k: "expr", e: "nan" } as V]) if (x.k === "blocked") { R.env.set(key, x); return; }
    if (cond.k !== "expr" || v.k !== "expr") { R.env.set(key, { k: "blocked", u: { what: ".loc[...]", line: s.line, why: "this .loc assignment is not supported." } }); return; }
    R.bind(key, { k: "expr", e: ["if", cond.e, v.e, prevV && prevV.k === "expr" ? prevV.e : "nan"] }, s.line);
    rename(R, key, colN.v);
    noteSignal(R, colN.v, s.line, false);
    return;
  }
  const v = R.val(s.value, s.line);
  if (target.t === "tuple") {
    if (v.k !== "tuple") { for (const t of target.items) if (t.t === "name") R.env.set(t.v, v.k === "blocked" ? v : { k: "blocked", u: { what: "a, b =", line: s.line, why: "this gives one value, not several." } }); return; }
    target.items.forEach((t, k) => { if (t.t === "name") R.bind(t.v, v.items[k] ?? { k: "blocked", u: { what: t.v, line: s.line, why: "there are fewer values than names." } }, s.line); });
    return;
  }
  let key: string | null = null, label = "";
  if (target.t === "name") { key = target.v; label = target.v; }
  else if (target.t === "sub" && target.idx[0]?.t === "str") { key = `col:${target.idx[0].v}`; label = target.idx[0].v; }
  else if (target.t === "attr" && target.x.t === "name" && R.env.get(target.x.v)?.k === "frame") { key = `col:${target.name}`; label = target.name; }
  if (!key) { R.ignored.push({ what: describe(target), line: s.line, why: "this kind of assignment is not read." }); return; }
  // A plain number is a setting a person would tune.
  if (target.t === "name" && v.k === "expr" && typeof v.e === "number") { const me = R.ours(label); R.inputs[me] = v.e; R.env.set(key, { k: "expr", e: me }); return; }
  if (v.k === "expr" && typeof v.e === "number" && key.startsWith("col:")) { R.env.set(key, v); noteSignal(R, label, s.line, false); return; }
  // The final position column is often yesterday's signal: we already fill at the signal day's close.
  const shifted = s.value.t === "call" && s.value.f.t === "attr" && s.value.f.name === "shift" && SIGNAL_NAMES.test(label);
  if (shifted && v.k === "expr" && Array.isArray(v.e) && v.e[0] === "prev" && v.e[2] === 1) {
    R.env.set(key, { k: "expr", e: v.e[1] });
    noteSignal(R, label, s.line, true);
    return;
  }
  R.bind(key, v, s.line);
  if (key.startsWith("col:")) rename(R, key, label);
  noteSignal(R, label, s.line, false);
  if (/^(entries|entry|buy_signal|long_entries|enter_long)$/i.test(label) && v.k === "expr") R.entries = v.e;
  if (/^(exits|exit|sell_signal|long_exits|exit_long)$/i.test(label) && v.k === "expr") R.exits = v.e;
  if (/^(short_entries|enter_short)$/i.test(label) && v.k === "expr") R.shortEntries = v.e;
  if (/^(short_exits|exit_short)$/i.test(label) && v.k === "expr") R.shortExits = v.e;
}

/** Columns get their own names in the rules: df['fast'] is "fast". */
function rename(R: Reader, key: string, label: string) {
  const v = R.env.get(key);
  if (v?.k !== "expr" || typeof v.e !== "string") return;
  const me = v.e;
  if (R.lets[me] == null || me === label) return;
  const want = R.ours(label);
  if (want === me) return;
  R.lets[want] = R.lets[me]; delete R.lets[me];
  R.env.set(key, { k: "expr", e: want });
}

function noteSignal(R: Reader, label: string, line: number, shifted: boolean) {
  if (!SIGNAL_NAMES.test(label)) return;
  const key = `col:${label}`;
  const v = R.env.get(key) ?? R.env.get(label);
  if (!v) return;
  if (v.k === "blocked") { R.signal = { e: "nan", name: label, line, shifted }; R.blocking.push(v.u); return; }
  if (v.k === "expr") R.signal = { e: v.e, name: label, line, shifted: shifted || !!R.signal?.shifted };
}

function markLoop(R: Reader, s: Extract<Stmt, { s: "skip" }>) {
  const walk = (ss: Stmt[]) => {
    for (const x of ss) {
      if (x.s === "assign") for (const t of x.targets) {
        const nm = t.t === "name" ? t.v : t.t === "sub" && t.idx[0]?.t === "str" ? `col:${t.idx[0].v}` : t.t === "sub" && t.x.t === "attr" && t.idx[1]?.t === "str" ? `col:${t.idx[1].v}` : null;
        if (nm) {
          R.env.set(nm, { k: "blocked", u: { what: s.what, line: s.line, why: "the value is built in a loop over the days. Write it with columns instead: rolling(), shift() and np.where()." } });
          const label = nm.replace(/^col:/, "");
          if (SIGNAL_NAMES.test(label) && !R.blocking.some((b) => b.line === s.line)) noteSignal(R, label, s.line, false);
        }
      }
      if (x.s === "if") { walk(x.body); if (x.els) walk(x.els); }
      if (x.s === "skip") walk(x.body);
    }
  };
  walk(s.body);
}

function num(R: Reader, n: Node | undefined, line: number): number | null {
  if (!n) return null;
  try { const e = R.ex(n, line); return typeof e === "number" ? e : typeof e === "string" && R.inputs[e] != null ? R.inputs[e] : null; } catch { return null; }
}

function backtestCall(R: Reader, n: Node, line: number) {
  if (n.t === "call") {
    const cash = num(R, n.kw.cash ?? n.kw.init_cash, line);
    if (cash && cash > 0) R.capital = cash;
    const fee = num(R, n.kw.commission ?? n.kw.fees, line);
    if (fee != null && fee >= 0 && fee < 0.1) R.cost = fee;
  }
  R.ignored.push({ what: n.t === "call" ? `${describe(n.f)}()` : describe(n), line, why: "it runs the backtest. We run our own on our prices, with our costs." });
}

function fromSignals(R: Reader, n: Extract<Node, { t: "call" }>, line: number) {
  const get = (k: number, name: string) => n.kw[name] ?? n.args[k];
  const e = get(1, "entries"), x = get(2, "exits");
  try {
    if (e) R.entries = R.ex(e, line);
    if (x) R.exits = R.ex(x, line);
    if (n.kw.short_entries) R.shortEntries = R.ex(n.kw.short_entries, line);
    if (n.kw.short_exits) R.shortExits = R.ex(n.kw.short_exits, line);
  } catch (err) { if (err instanceof Blocked) R.blocking.push(err.u); else throw err; }
  const sl = num(R, n.kw.sl_stop, line), tp = num(R, n.kw.tp_stop, line);
  if (sl) R.stopLoss = sl; if (tp) R.takeProfit = tp;
  backtestCall(R, n, line);
}

/** backtesting.py: settings from the class, indicators from init(), orders from next(). */
function strategyClass(R: Reader, cls: Extract<Stmt, { s: "class" }>, out: { long: SideRules; short: SideRules }) {
  const self: V = { k: "fn", name: "self" };
  for (const s of cls.body) {
    if (s.s === "assign" && s.targets[0].t === "name") {
      const v = R.val(s.value, s.line);
      if (v.k === "expr" && typeof v.e === "number") { const me = R.ours(s.targets[0].v); R.inputs[me] = v.e; R.env.set(`self.${s.targets[0].v}`, { k: "expr", e: me }); }
    }
  }
  const init = cls.body.find((s): s is Extract<Stmt, { s: "def" }> => s.s === "def" && s.name === "init");
  const next = cls.body.find((s): s is Extract<Stmt, { s: "def" }> => s.s === "def" && s.name === "next");
  if (!next) { R.blocking.push({ what: `class ${cls.name}`, line: cls.line, why: "the strategy class has no next() method, so it never places an order." }); return; }
  // Inside the class, self.data.Close is the close and self.<name> is a value made in init().
  const resolve = (n: Node): Node => {
    if (n.t === "attr" && n.x.t === "attr" && n.x.x.t === "name" && n.x.x.v === "self" && n.x.name === "data") return { t: "sub", x: { t: "name", v: "__frame" }, idx: [{ t: "str", v: n.name }] };
    if (n.t === "attr" && n.x.t === "name" && n.x.v === "self") return { t: "name", v: `self.${n.name}` };
    if (n.t === "call" && n.f.t === "attr" && n.f.x.t === "name" && n.f.x.v === "self" && n.f.name === "I") {
      const [fn, ...rest] = n.args;
      return { t: "call", f: resolve(fn), args: rest.map(resolve), kw: Object.fromEntries(Object.entries(n.kw).filter(([k]) => !["name", "overlay", "color", "plot", "scatter"].includes(k)).map(([k, v]) => [k, resolve(v)])) };
    }
    switch (n.t) {
      case "attr": return { ...n, x: resolve(n.x) };
      case "call": return { ...n, f: resolve(n.f), args: n.args.map(resolve), kw: Object.fromEntries(Object.entries(n.kw).map(([k, v]) => [k, resolve(v)])) };
      case "sub": return { ...n, x: resolve(n.x), idx: n.idx.map(resolve) };
      case "bin": return { ...n, a: resolve(n.a), b: resolve(n.b) };
      case "un": return { ...n, a: resolve(n.a) };
      case "tern": return { ...n, c: resolve(n.c), a: resolve(n.a), b: resolve(n.b) };
      case "tuple": return { ...n, items: n.items.map(resolve) };
      default: return n;
    }
  };
  R.env.set("__frame", { k: "frame" });
  R.env.set("self", self);
  R.env.set("self.position", { k: "expr", e: "position" });
  for (const s of init?.body ?? []) {
    if (s.s !== "assign") { if (s.s === "expr") R.ignored.push({ what: describe(s.e), line: s.line, why: "it does not make an indicator." }); continue; }
    const t = s.targets[0];
    const name = t.t === "attr" && t.x.t === "name" && t.x.v === "self" ? `self.${t.name}` : t.t === "name" ? t.v : null;
    if (!name) continue;
    const v = R.val(resolve(s.value), s.line);
    if (v.k === "expr" && Array.isArray(v.e)) { const me = R.ours(name.replace(/^self\./, "")); R.lets[me] = v.e; R.env.set(name, { k: "expr", e: me }); }
    else R.env.set(name, v);
  }
  const posCond = (n: Node): Node => {
    // self.position.is_long and friends.
    if (n.t === "attr" && n.x.t === "name" && n.x.v === "self.position") {
      if (n.name === "is_long") return { t: "bin", op: ">", a: { t: "name", v: "self.position" }, b: { t: "num", v: 0 } };
      if (n.name === "is_short") return { t: "bin", op: "<", a: { t: "name", v: "self.position" }, b: { t: "num", v: 0 } };
      if (n.name === "size") return { t: "name", v: "self.position" };
    }
    if (n.t === "name" && n.v === "self.position") return { t: "bin", op: "!=", a: n, b: { t: "num", v: 0 } };
    switch (n.t) {
      case "un": return { ...n, a: n.op === "not" && ((n.a.t === "attr" && n.a.name === "position") || (n.a.t === "name" && n.a.v === "self.position")) ? { t: "bin", op: "!=", a: { t: "name", v: "self.position" }, b: { t: "num", v: 0 } } : posCond(n.a) };
      case "bin": return { ...n, a: posCond(n.a), b: posCond(n.b) };
      default: return n;
    }
  };
  const walk = (ss: Stmt[], c: Expr | undefined) => {
    const acts = ss.filter((s): s is Extract<Stmt, { s: "expr" }> => s.s === "expr" && s.e.t === "call").map((s) => ({ d: describe((s.e as Extract<Node, { t: "call" }>).f), n: s.e as Extract<Node, { t: "call" }>, line: s.line }));
    const buys = acts.some((x) => x.d === "self.buy"), sells = acts.some((x) => x.d === "self.sell");
    for (const s of ss) {
      if (s.s === "if") {
        let k: Expr;
        try { k = R.ex(resolve(posCond(resolve(s.cond))), s.line); } catch (e) { if (e instanceof Blocked) { R.blocking.push(e.u); continue; } throw e; }
        walk(s.body, and(c, k));
        if (s.els) walk(s.els, and(c, ["not", k]));
        continue;
      }
      if (s.s === "assign") { R.ignored.push({ what: describe(s.targets[0]), line: s.line, why: "values changed inside next() keep state from day to day, which we cannot follow yet." }); continue; }
      if (s.s !== "expr" || s.e.t !== "call") continue;
      const d = describe(s.e.f), n = s.e;
      const at = c ?? true;
      if (d === "self.buy" || d === "self.sell") {
        const side = d === "self.buy" ? out.long : out.short;
        side.entry = or(side.entry, at);
        if (n.kw.size) R.notes.push(`Line ${s.line}: the order's size is replaced by the whole account, as for every trade we run.`);
        for (const [key, field] of [["sl", "stop"], ["tp", "limit"]] as const) {
          if (!n.kw[key]) continue;
          try {
            // Levels are set when the order is placed, at that day's close: the entry price.
            const lv = substitute(R.ex(resolve(n.kw[key]), s.line), "close", "entry_price");
            if (side[field] != null) R.blocking.push({ what: `${d}(${key}=)`, line: s.line, why: "more than one stop or target for the same side." });
            side[field] = lv;
          } catch (e) { if (e instanceof Blocked) R.blocking.push(e.u); else throw e; }
        }
        if (n.kw.limit || n.kw.stop) R.blocking.push({ what: `${d}(limit=, stop=)`, line: s.line, why: "an order that waits for a price needs the day's high and low to know if it filled. We hold one closing price a day." });
        continue;
      }
      if (d === "self.position.close" || /^self\.trades/.test(d)) {
        // Closing and buying in the same step turns the position around; the buy already does that.
        if (!buys) out.long.exit = or(out.long.exit, at);
        if (!sells) out.short.exit = or(out.short.exit, at);
        continue;
      }
      R.ignored.push({ what: d, line: s.line, why: "it does not place or close an order." });
    }
  };
  walk(next.body, undefined);
}

export interface PythonOptions { market: string }

export function readPython(code: string, opt: PythonOptions): ScriptRead {
  const market = MARKETS.find((m) => m.id === opt.market) ?? MARKETS[0];
  const { stmts } = block(lines(code), 0);
  const R = new Reader();
  // Names people use for the price table before it is loaded from somewhere.
  for (const nm of ["df", "data", "prices", "ohlc", "bars"]) R.env.set(nm, { k: "frame" });
  R.env.set("close", { k: "expr", e: "close" });
  topLevel(R, stmts);

  const long: SideRules = {}, short: SideRules = {};
  if (R.btClass) strategyClass(R, R.btClass, { long, short });
  else if (R.entries != null) {
    long.entry = R.entries;
    if (R.exits != null) long.exit = R.exits;
    if (R.shortEntries != null) { short.entry = R.shortEntries; if (R.shortExits != null) short.exit = R.shortExits; }
    if (R.stopLoss) { long.stop_loss = R.stopLoss; if (short.entry) short.stop_loss = R.stopLoss; }
    if (R.takeProfit) { long.take_profit = R.takeProfit; if (short.entry) short.take_profit = R.takeProfit; }
  } else if (R.signal) {
    const sgn = R.signal.e;
    long.entry = [">", sgn, 0]; long.exit = ["<=", sgn, 0];
    if (JSON.stringify(sgn).includes("-1") || JSON.stringify(R.lets).includes("-1") || JSON.stringify(sgn).includes('"neg"')) { short.entry = ["<", sgn, 0]; short.exit = [">=", sgn, 0]; }
    if (R.signal.shifted) R.notes.push(`The "${R.signal.name}" column is the signal moved one day later, so a position is held from the day after the signal. We fill at the signal day's close, which is the same thing.`);
  } else if (!R.blocking.length) {
    R.blocking.push({ what: "signal", line: 0, why: 'we could not find the trading signal. Name a column "signal" or "position" (1 long, -1 short, 0 flat), use vectorbt entries and exits, or write a backtesting.py Strategy class.' });
  }
  const notes = [...R.notes, "Orders fill at the close of the day the signal appears, with our costs for this market."];
  let rules: Rules | null = null;
  if (!R.blocking.length) {
    rules = { format: RULES_FORMAT, market: market.id, inputs: R.inputs, let: R.lets };
    if (long.entry != null) rules.long = long;
    if (short.entry != null) rules.short = short;
    if (R.cost != null) rules.cost = R.cost;
    if (!rules.long && !rules.short) { rules = null; R.blocking.push({ what: "orders", line: 0, why: "the code never opens a position." }); }
  }
  return { language: "python", rules, name: R.btClass?.name ?? null, blocking: R.blocking, ignored: R.ignored, notes, capital: R.capital };
}

export function looksLikePython(code: string): boolean {
  return /^\s*(import |from \w+ import |def |class \w+)/m.test(code) || /\bdf\[['"]/.test(code) || /\.rolling\(/.test(code);
}
