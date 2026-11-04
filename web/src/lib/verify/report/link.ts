// A report in a link (DEC-0089): the whole report, compressed into the part of the address
// after "#", which browsers never send to a server. So a shared report is never stored by
// Parity, and Parity cannot vouch that a link was not changed: the page says so. Opening a
// link checks every field's type and size before anything is drawn, so a damaged or edited
// link shows a plain message, never a broken page.
import { REPORT_VERSION, type ReportData } from "./model";

/** The longest link we make or read, in characters after "#r=". */
export const MAX_LINK = 60_000;

function toB64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, max = 4_000_000): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) { await reader.cancel(); throw new Error("too large"); }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const canZip = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

/** The text after "#r=" for a report: "z" and deflated JSON, or "j" and plain JSON where the browser cannot compress. */
export async function encodeReport(d: ReportData): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(d));
  if (canZip()) {
    try { return `z${toB64Url(await pipe(json, new CompressionStream("deflate-raw")))}`; } catch { /* fall through to plain */ }
  }
  return `j${toB64Url(json)}`;
}

export class LinkError extends Error {}

/** A report from the text after "#r=", checked; throws LinkError with words for the page. */
export async function decodeReport(code: string): Promise<ReportData> {
  if (!code || code.length > MAX_LINK) throw new LinkError("This link is too long or empty. Ask for the link again.");
  let raw: unknown;
  try {
    const bytes = fromB64Url(code.slice(1));
    const json = code[0] === "z" ? await pipe(bytes, new DecompressionStream("deflate-raw")) : code[0] === "j" ? bytes : null;
    if (!json) throw new Error("kind");
    raw = JSON.parse(new TextDecoder().decode(json));
  } catch {
    throw new LinkError("This link is damaged: part of it is missing or was changed. Ask for the link again.");
  }
  const d = sanitizeReport(raw);
  if (!d) throw new LinkError("This link does not hold a Verify report we can read. It may come from a newer version of Parity: reload the page and try again.");
  return d;
}

/** The address of a report page for a report. */
export async function reportUrl(origin: string, d: ReportData): Promise<string> {
  return `${origin}/verify/report/#r=${await encodeReport(d)}`;
}

// ------------------------------------------------------------------ checking a report read from a link

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown, max = 400): string | null => (typeof x === "string" ? x.slice(0, max) : null);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean => x === true;
const date = (x: unknown): string | null => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 19) : null);
function arr<T>(x: unknown, max: number, f: (v: unknown) => T | null): T[] {
  return Array.isArray(x) ? x.slice(0, max).map(f).filter((v): v is T => v != null) : [];
}
/** Copies the listed fields with their kinds; any field of the wrong kind becomes null (or false). */
function shape(x: unknown, fields: Record<string, "n" | "s" | "b" | "ss">): Obj | null {
  if (!isObj(x)) return null;
  const out: Obj = {};
  for (const [k, kind] of Object.entries(fields)) {
    out[k] = kind === "n" ? num(x[k]) : kind === "s" ? str(x[k]) : kind === "b" ? bool(x[k]) : arr(x[k], 12, (v) => str(v, 300));
  }
  return out;
}

const STATUS = new Set(["pass", "fail", "na", "warn"]);
const check = (x: unknown) => (isObj(x) && typeof x.id === "string" && typeof x.label === "string" && STATUS.has(String(x.status))
  ? { id: x.id.slice(0, 40), label: x.label.slice(0, 120), status: x.status as "pass", detail: str(x.detail, 800) ?? "" } : null);
const VERDICTS = new Set(["holds_up", "could_be_luck", "fragile", "does_not_hold_up", "not_enough_data"]);
const SOURCES = new Set(["file", "description", "strategy", "code"]);
const KINDS = new Set(["real", "demo", "backtest"]);

/** A report read from a link, with every field checked; null when it is not one. */
export function sanitizeReport(x: unknown): ReportData | null {
  if (!isObj(x) || x.v !== REPORT_VERSION) return null;
  const v = x.verdict;
  if (!isObj(v) || !VERDICTS.has(String(v.id)) || !SOURCES.has(String(x.source))) return null;
  const c1 = shape(x.c1, { basis: "s", n: "n", winRate: "n", lossRate: "n", avgWin: "n", avgLoss: "n", payoff: "n", expectancy: "n", expectancyPct: "n", breakEven: "n", profitFactor: "n", grossProfit: "n", grossLoss: "n" });
  if (c1 && (c1.winRate == null || c1.expectancy == null || (c1.basis !== "trade" && c1.basis !== "period"))) return null;
  let c2 = shape(x.c2, { worstTrade: "n", worstTradePct: "n", worstDay: "n", worstDayPct: "n", winsWipedOut: "n", maxDrawdown: "n", longestUnderwaterDays: "n", es5: "n", skew: "n", skewBasis: "s", red: "b", reasons: "ss" });
  if (c2) c2 = { ...c2, martingale: shape(isObj(x.c2) ? x.c2.martingale : null, { found: "b", streaks: "n", grew: "n", adds: "n", checkable: "b" }) ?? { found: false, streaks: 0, grew: 0, adds: 0, checkable: false } };
  let c3 = shape(x.c3, { basis: "s", observations: "n", sharpe: "n", sharpeAnnual: "n", tries: "n", dsr: "n", survives: "n", monthsMore: "n", varianceStandIn: "b" });
  if (c3) {
    const m = shape(isObj(x.c3) ? x.c3.moments : null, { t: "n", sr: "n", skew: "n", kurt: "n" });
    c3 = { ...c3, tries: c3.tries ?? 1, moments: m && m.t != null && m.sr != null && m.skew != null && m.kurt != null ? m : undefined };
  }
  const curve = isObj(x.curve) && (x.curve.unit === "growth" || x.curve.unit === "money") ? (() => {
    const dates = arr(x.curve.dates, 600, date);
    const values = arr(x.curve.values, 600, num);
    if (dates.length < 2 || dates.length !== values.length) return null;
    const bench = Array.isArray(x.curve.bench) && x.curve.bench.length === dates.length ? x.curve.bench.slice(0, 600).map(num) : null;
    return { unit: x.curve.unit as "growth", dates, values, bench, benchName: str(x.curve.benchName, 60) };
  })() : null;
  const spread = isObj(x.spread) && (x.spread.what === "sharpe" || x.spread.what === "perTrade") ? (() => {
    const edges = arr(x.spread.edges, 61, num), counts = arr(x.spread.counts, 60, num);
    if (counts.length < 2 || edges.length !== counts.length + 1) return null;
    const pair = (p: unknown): [number, number] | null => (Array.isArray(p) && num(p[0]) != null && num(p[1]) != null ? [p[0] as number, p[1] as number] : null);
    return { what: x.spread.what as "sharpe", n: num(x.spread.n) ?? 0, block: num(x.spread.block) ?? 1, edges, counts, point: num(x.spread.point), ci95: pair(x.spread.ci95), ci80: pair(x.spread.ci80), above: num(x.spread.above) };
  })() : null;
  const groups = isObj(x.groups) ? (() => {
    const families = arr(x.groups.families, 8, (f) => (isObj(f) && (f.unit === "return" || f.unit === "money") ? {
      family: str(f.family, 30) ?? "group", title: str(f.title, 80) ?? "", unit: f.unit as "return",
      items: arr(f.items, 30, (i) => (isObj(i) && typeof i.label === "string" && num(i.value) != null ? { label: i.label.slice(0, 60), value: i.value as number, bench: num(i.bench), n: num(i.n) ?? undefined } : null)),
    } : null)).filter((f) => f.items.length);
    return families.length ? { families } : null;
  })() : null;
  const claims = isObj(x.claims) ? {
    url: (() => { const u = str(x.claims.url, 2048); return u && /^https?:\/\//i.test(u) ? u : null; })(),
    title: str(x.claims.title, 200), readAt: date(x.claims.readAt),
    found: arr(x.claims.found, 60, (f) => (isObj(f) && typeof f.field === "string" && (typeof f.value === "number" || typeof f.value === "string" || typeof f.value === "boolean")
      ? { field: f.field.slice(0, 30) as never, value: typeof f.value === "string" ? f.value.slice(0, 40) : f.value, shown: str(f.shown, 60) ?? "", quote: str(f.quote, 300) ?? "", at: num(f.at) ?? 0, length: num(f.length) ?? 0, how: f.how === "model" ? ("model" as const) : ("pattern" as const), rule: str(f.rule, 120) ?? "" }
      : null)),
  } : null;
  const facts = isObj(x.facts) ? { totalReturn: num(x.facts.totalReturn), monthlyReturn: num(x.facts.monthlyReturn), yearlyReturn: num(x.facts.yearlyReturn) } : null;
  const code = shape(x.code, { market: "s", marketName: "s", cost: "n", costWhy: "s", totalReturn: "n", delayedReturn: "n", buyHoldReturn: "n", triesStated: "n", triesSweep: "n", sweepRuns: "n", sweepProfitable: "n" });
  const gauntlet = shape(x.gauntlet, { verdict: "s", passed: "n", total: "n" });
  const screen = shape(x.screen, { verdict: "s", reason: "s", method: "s", account: "s" });
  const pairs = (y: unknown, a: string, b: string) => arr(y, 30, (p) => (isObj(p) && typeof p[a] === "string" && typeof p[b] === "string" ? { [a]: (p[a] as string).slice(0, 120), [b]: (p[b] as string).slice(0, 600) } : null));
  return {
    v: REPORT_VERSION,
    method: str(x.method, 40) ?? "unknown", checkedOn: date(x.checkedOn)?.slice(0, 10) ?? "unknown",
    source: x.source as ReportData["source"], kind: (KINDS.has(String(x.kind)) ? x.kind : "backtest") as ReportData["kind"],
    what: str(x.what, 200) ?? "", dateFrom: date(x.dateFrom), dateTo: date(x.dateTo), trades: num(x.trades), dailyReturns: num(x.dailyReturns) ?? 0,
    tries: Math.max(1, num(x.tries) ?? 1), triesDefaulted: bool(x.triesDefaulted), balance: num(x.balance),
    verdict: { id: v.id as ReportData["verdict"]["id"], label: str(v.label, 40) ?? "", sentence: str(v.sentence, 1200) ?? "" },
    c1: c1 as unknown as ReportData["c1"], c2: c2 as unknown as ReportData["c2"], c3: c3 as unknown as ReportData["c3"],
    c4: arr(x.c4, 12, check), c5: arr(x.c5, 12, check),
    arithmetic: arr(x.arithmetic, 12, (c) => (isObj(c) && typeof c.id === "string" && (c.status === "fail" || c.status === "warn" || c.status === "info") ? { id: c.id.slice(0, 30), status: c.status, text: str(c.text, 800) ?? "" } : null)),
    facts, curve, spread, groups, benchmark: str(x.benchmark, 60), claims,
    inputs: pairs(x.inputs, "label", "value") as ReportData["inputs"],
    cannot: pairs(x.cannot, "check", "why") as ReportData["cannot"],
    notes: arr(x.notes, 20, (n) => str(n, 600)),
    gauntlet: gauntlet as ReportData["gauntlet"], code: code as ReportData["code"],
    description: str(x.description, 600), screen: screen as ReportData["screen"],
    kept: x.kept === "summary" ? "summary" : "full",
  };
}
