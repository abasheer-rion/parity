// Loading the bars a request needs (DEC-0092): from our cache first, then from the source,
// within one request's budget of calls and time, at each source's pace. Bars are fetched in
// fixed slices (a UTC day of minute bars, an hour of pool swaps) so the cache serves the next
// request too. Past slices never change and are kept 30 days; the last two days 10 minutes.
// The cache is ours and server side: nothing in it is ever sent to a page.
import { utcDate } from "./clock";
import { plan, type Bar, type Book, type Span, type SymData } from "./engine";
import { marketOfSent } from "./market";
import { isSpan, OutOfBudget, SourceBusy, type Ctx, type RangeEnv, type SourceDef } from "./sources";
import { LIMITS, type Clock, type FillPoint, type NoneWhy } from "./types";

/** A small store of strings with an expiry: Cloudflare's cache, a KV namespace, or memory in tests. */
export interface RangeCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export function memoryCache(): RangeCache & { size: () => number; keys: () => string[] } {
  const m = new Map<string, { v: string; until: number }>();
  return {
    get: async (k) => { const e = m.get(k); return e && e.until > Date.now() ? e.v : null; },
    put: async (k, v, ttl) => { m.set(k, { v, until: Date.now() + ttl * 1000 }); },
    size: () => m.size,
    keys: () => [...m.keys()],
  };
}

export interface LoadDeps {
  env: RangeEnv;
  sources: SourceDef[];
  cache: RangeCache;
  fetch: typeof fetch;
  now: number;
  /** Real time, for pacing and the deadline (tests fix `now` but still need a moving clock). */
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Call budget for this request (default LIMITS.upstream). */
  maxCalls?: number;
}

export interface LoadStats { calls: number; cached: number; busy: string[] }

/** When each source may next be called, per server instance. */
const nextAt = new Map<string, number>();
/** Sources that refused recently, per server instance, and until when. */
const resting = new Map<string, number>();
const CACHE_V = "fills-1";
const DAY = 86_400_000;

/** Forgets the pacing and resting state (tests). */
export function resetPacing(): void { nextAt.clear(); resting.clear(); }

const packBars = (t0: number, bars: Bar[]) => JSON.stringify(bars.map((b) => [Math.round((b[0] - t0) / 1000), b[1], b[2]]));
const unpackBars = (t0: number, s: string): Bar[] => (JSON.parse(s) as [number, number, number][]).map((b) => [t0 + b[0] * 1000, b[1], b[2]]);

/** The slice length a source is read in. */
const sliceOf = (src: SourceDef) => (isSpan(src) ? src.maxSpan : DAY);

export async function load(clock: Clock, fills: readonly FillPoint[], deps: LoadDeps): Promise<{ book: Book; stats: LoadStats }> {
  const realNow = deps.clock ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = realNow() + LIMITS.fetchMs;
  const maxCalls = deps.maxCalls ?? LIMITS.upstream;
  const stats: LoadStats = { calls: 0, cached: 0, busy: [] };
  const busyHere = new Set<string>();

  const ctx: Ctx = {
    env: deps.env,
    now: deps.now,
    async get(src, url, init) {
      if (busyHere.has(src.id)) throw new SourceBusy(src.id);
      if (stats.calls >= maxCalls || realNow() > deadline) throw new OutOfBudget();
      const wait = (nextAt.get(src.id) ?? 0) - realNow();
      if (wait > 0) { if (realNow() + wait > deadline) throw new OutOfBudget(); await sleep(wait); }
      nextAt.set(src.id, realNow() + src.gap);
      stats.calls++;
      let res: Response;
      try {
        res = await deps.fetch(url, {
          method: init?.body ? "POST" : "GET",
          headers: { Accept: "application/json", "User-Agent": "ParityVerify/1.0 (fill price check; contact@paritytrading.app)", ...(init?.headers ?? {}) },
          ...(init?.body ? { body: init.body } : {}),
        });
      } catch {
        throw new SourceBusy(src.id);
      }
      if (res.status === 429 || res.status === 418 || res.status >= 500) {
        resting.set(src.id, realNow() + 60_000);
        throw new SourceBusy(src.id);
      }
      if (!res.ok) throw Object.assign(new SourceBusy(src.id), { status: res.status });
      return res.json();
    },
  };

  const enabled = deps.sources.filter((s) => s.enabled(deps.env));
  const firstFor = (s: string) => enabled.find((x) => x.market === marketOfSent(s));
  const needs = plan(clock, fills, (s) => {
    const src = firstFor(s);
    return { reach: src ? src.window + src.barMs : 0, exactTime: !!src && isSpan(src) };
  });
  const book: Book = { syms: new Map(), calendar: null };
  let earliest: string | null = null, latest: string | null = null;

  /** The first enabled, rested source of the symbol's market that lists it. */
  async function pick(sym: string): Promise<{ src: SourceDef; vsym: string } | NoneWhy> {
    const market = marketOfSent(sym);
    const list = enabled.filter((s) => s.market === market);
    let why: NoneWhy = "sym";
    for (const src of list) {
      if ((resting.get(src.id) ?? 0) > realNow() || busyHere.has(src.id)) { why = "busy"; continue; }
      try {
        const v = await src.venueSymbol(sym, ctx);
        if (v) return { src, vsym: v };
      } catch (e) {
        if (e instanceof OutOfBudget) return "more";
        why = "busy";
      }
    }
    return why;
  }

  /** Runs one load; a refusal or failure marks the source busy for the rest of this request. */
  async function guarded<T>(src: SourceDef, f: () => Promise<T>): Promise<T | NoneWhy> {
    try { return await f(); } catch (e) {
      if (e instanceof OutOfBudget) return "more";
      if ((e as { why?: string }).why === "old") return "old";
      const status = (e as { status?: number }).status;
      // A symbol a venue does not have answers 400, 404 or 422: no data, the source itself is fine.
      if (status === 400 || status === 404 || status === 422) return "data";
      // Refused outright: rest it for an hour, and when another source covers the market, ask
      // the page to send these fills again so that one is used.
      if (status === 401 || status === 403) {
        resting.set(src.id, realNow() + 3_600_000);
        busyHere.add(src.id);
        if (enabled.some((x) => x.id !== src.id && x.market === src.market)) return "more";
      }
      busyHere.add(src.id);
      if (!stats.busy.includes(src.id)) stats.busy.push(src.id);
      return "busy";
    }
  }

  async function cached<T>(key: string, ttl: number, make: () => Promise<T>, pack: (v: T) => string, unpack: (s: string) => T): Promise<T> {
    const hit = await deps.cache.get(key).catch(() => null);
    if (hit != null) { stats.cached++; return unpack(hit); }
    const v = await make();
    await deps.cache.put(key, pack(v), ttl).catch(() => undefined);
    return v;
  }
  const ttlFor = (endMs: number) => (endMs > deps.now - 2 * DAY ? 600 : 30 * 86_400);

  /** The day's lows and highs, a calendar year per call. */
  async function daysOf(src: SourceDef, vsym: string, from: string, to: string): Promise<{ days: Map<string, [number, number]>; why: NoneWhy | null }> {
    const days = new Map<string, [number, number]>();
    let why: NoneWhy | null = null;
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
      const a = `${y}-01-01`, b = `${y}-12-31` < utcDate(deps.now) ? `${y}-12-31` : utcDate(deps.now);
      if (a > b) continue;
      const v = await guarded(src, () => cached(`${CACHE_V}/${src.id}/${vsym}/d/${y}`, b >= utcDate(deps.now - 2 * DAY) ? 3600 : 30 * 86_400,
        () => src.daily!(vsym, a, b, ctx), (m) => JSON.stringify([...m]), (s) => new Map(JSON.parse(s) as [string, [number, number]][])));
      if (typeof v === "string") { why ??= v; continue; }
      for (const [d, x] of v) days.set(d, x);
    }
    return { days, why };
  }

  const vsyms = new Map<string, string>();
  const defs = new Map<SymData, SourceDef>();
  for (const [sym, need] of needs) {
    if (book.syms.size >= LIMITS.symbols) { book.syms.set(sym, "more"); continue; }
    const got = await pick(sym);
    if (typeof got === "string") { book.syms.set(sym, got); continue; }
    const { src, vsym } = got;
    const sd: SymData = { src, spans: [], days: null, until: deps.now - src.lag };
    book.syms.set(sym, sd);
    defs.set(sd, src);
    vsyms.set(sym, vsym);
    if (src.market === "stock") {
      if (!earliest || need.from < earliest) earliest = need.from;
      if (!latest || need.to > latest) latest = need.to;
    }
    if (!src.daily) continue;
    const { days, why } = await daysOf(src, vsym, need.from, need.to);
    sd.days = why && !days.size ? why : days;
  }

  // Intraday slices, in the order the fills were sent, a few at a time.
  const tasks: { sd: SymData; src: SourceDef; vsym: string; at: number; len: number }[] = [];
  const seen = new Set<string>();
  for (const f of fills) {
    const sd = book.syms.get(f.s);
    const need = needs.get(f.s);
    if (!sd || typeof sd === "string" || !need) continue;
    const src = defs.get(sd)!;
    const len = sliceOf(src);
    for (const [a, b] of need.spans) {
      for (let at = Math.floor(a / len) * len; at < b; at += len) {
        const k = `${f.s}|${at}`;
        if (seen.has(k)) continue;
        seen.add(k);
        tasks.push({ sd, src, vsym: vsyms.get(f.s)!, at, len });
      }
    }
  }
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) {
      const t = tasks[i++];
      const { src } = t;
      const end = t.at + t.len;
      let got: Bar[] | NoneWhy;
      if (t.at > deps.now) got = [];
      else if (isSpan(src)) {
        const to = Math.min(end, deps.now - src.lag);
        got = to <= t.at ? [] : await guarded(src, () => cached(`${CACHE_V}/${src.id}/${t.vsym}/h/${t.at}`, ttlFor(end),
          () => src.spanBars(t.vsym, t.at, to, ctx), (b) => packBars(t.at, b), (s) => unpackBars(t.at, s)));
      } else {
        const date = utcDate(t.at);
        got = await guarded(src, () => cached(`${CACHE_V}/${src.id}/${t.vsym}/m/${date}`, ttlFor(end),
          () => src.dayBars(t.vsym, date, ctx), (b) => packBars(t.at, b), (s) => unpackBars(t.at, s)));
      }
      const span: Span = typeof got === "string" ? { from: t.at, to: end, why: got } : { from: t.at, to: end, bars: got };
      t.sd.spans.push(span);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  for (const sd of book.syms.values()) if (typeof sd !== "string") sd.spans.sort((a, b) => a.from - b.from);

  // US trading days, from a broad fund's daily bars, to tell a holiday from a quiet day.
  const stockSrc = [...defs.values()].find((x) => x.market === "stock");
  if (earliest && latest && stockSrc?.daily) {
    const { days, why } = await daysOf(stockSrc, "SPY", earliest, latest);
    if (!why && days.size) { book.calendar = new Set(days.keys()); book.calFrom = earliest; book.calTo = [...days.keys()].sort().pop()!; }
  }
  return { book, stats };
}
