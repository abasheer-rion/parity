// Hyperliquid (DEC-0053, team only): every perpetual ("BTC-PERP") and every spot pair
// ("PURR-USDC") over its public WebSocket. Trades, the 20-level book (full snapshots) and
// the overview (allMids for prices, the asset contexts every 30 s for the 24 h open and
// volume). Spot pairs are named by their tokens; the feed itself calls them "PURR/USDC" or
// "@107", so a map from the venue's own lists turns one into the other.
import { allowed, BARS, getJson, keyed, memo, num, TF_MS, type AdapterDef, type BoardPatch, type BookUpdate, type Parsed, type Trade } from "../base";

const INFO = "https://api.hyperliquid.xyz/info";
const post = <T,>(body: unknown) => getJson<T>(INFO, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

interface Maps { toCoin: Map<string, string>; toSym: Map<string, string> }
type PerpCtx = { prevDayPx: string; dayNtlVlm: string; midPx: string | null; markPx: string };
type SpotCtx = PerpCtx & { coin: string };
interface SpotMeta { universe: { tokens: [number, number]; name: string }[]; tokens: { name: string; index: number }[] }

const NAME = /^[A-Za-z0-9]{1,15}$/;

/** Perp and spot lists with their 24 h contexts, shared by every caller for 30 s. */
const lists = memo(30_000, async () => {
  const [[meta, pctx], [smeta, sctx]] = await Promise.all([
    post<[{ universe: { name: string; isDelisted?: boolean }[] }, PerpCtx[]]>({ type: "metaAndAssetCtxs" }),
    post<[SpotMeta, SpotCtx[]]>({ type: "spotMetaAndAssetCtxs" }),
  ]);
  const toCoin = new Map<string, string>(), toSym = new Map<string, string>();
  const rows: BoardPatch[] = [];
  const now = Date.now();
  meta.universe.forEach((u, i) => {
    if (u.isDelisted || !NAME.test(u.name)) return;
    const s = `${u.name.toUpperCase()}-PERP`;
    if (toCoin.has(s)) return;
    toCoin.set(s, u.name); toSym.set(u.name, s);
    const c = pctx[i];
    if (c) rows.push({ s, p: num(c.midPx ?? c.markPx), o: num(c.prevDayPx), v: num(c.dayNtlVlm), te: now });
  });
  const tok = new Map(smeta.tokens.map((t) => [t.index, t.name]));
  for (const u of smeta.universe) {
    const b = tok.get(u.tokens[0]), q = tok.get(u.tokens[1]);
    if (!b || !q || !NAME.test(b) || !NAME.test(q)) continue;
    const s = `${b}-${q}`.toUpperCase();
    if (toCoin.has(s)) continue;
    toCoin.set(s, u.name); toSym.set(u.name, s);
  }
  for (const c of sctx) {
    const s = toSym.get(c.coin);
    if (s) rows.push({ s, p: num(c.midPx ?? c.markPx), o: num(c.prevDayPx), v: num(c.dayNtlVlm), te: now });
  }
  return { maps: { toCoin, toSym } as Maps, rows };
});

export const hyperliquid: AdapterDef = {
  id: "hyperliquid",
  enabled: (env) => allowed("hyperliquid", env),
  make: () => {
    let maps: Maps = { toCoin: new Map(), toSym: new Map() };
    const coin = (s: string) => maps.toCoin.get(s) ?? null;
    const sub = (method: string, type: string, ss: string[]) => ss.flatMap((s) => { const c = coin(s); return c ? [JSON.stringify({ method, subscription: { type, coin: c } })] : []; });
    return {
      id: "hyperliquid", feed: "rt", internal: true, url: "wss://api.hyperliquid.xyz/ws", maxUpstream: 60, bookDepth: 20,
      async prepare() { maps = (await lists()).maps; },
      allows: (s) => maps.toCoin.size ? maps.toCoin.has(s) : /^[A-Z0-9]{1,15}-[A-Z0-9]{2,8}$/.test(s),
      subscribe: (ss) => sub("subscribe", "trades", ss),
      unsubscribe: (ss) => sub("unsubscribe", "trades", ss),
      book: { subscribe: (ss) => sub("subscribe", "l2Book", ss), unsubscribe: (ss) => sub("unsubscribe", "l2Book", ss) },
      board: {
        subscribe: () => [JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } })],
        unsubscribe: () => [JSON.stringify({ method: "unsubscribe", subscription: { type: "allMids" } })],
        poll: { every: 30_000, run: async () => (await lists()).rows },
      },
      parse(data): Parsed {
        let m: { channel?: string; data?: unknown };
        try { m = JSON.parse(data); } catch { return {}; }
        if (m.channel === "trades" && Array.isArray(m.data)) {
          const t: Trade[] = [];
          for (const x of m.data as { coin: string; px: string; sz: string; time: number; side: string }[]) {
            const s = maps.toSym.get(x.coin);
            if (s) t.push({ s, p: num(x.px), v: num(x.sz), te: num(x.time), side: x.side === "B" ? 1 : x.side === "A" ? 2 : 0 });
          }
          return { t };
        }
        if (m.channel === "l2Book" && m.data) {
          const d = m.data as { coin: string; time: number; levels: [{ px: string; sz: string }[], { px: string; sz: string }[]] };
          const s = maps.toSym.get(d.coin);
          if (!s || !Array.isArray(d.levels)) return {};
          const lv = (xs: { px: string; sz: string }[]) => (xs ?? []).map((x) => [num(x.px), num(x.sz)] as [number, number]);
          const b: BookUpdate = { s, snap: true, bids: lv(d.levels[0]), asks: lv(d.levels[1]), te: num(d.time) };
          return { b: [b] };
        }
        if (m.channel === "allMids" && m.data) {
          const mids = (m.data as { mids?: Record<string, string> }).mids ?? {};
          const now = Date.now();
          const r: BoardPatch[] = [];
          for (const [c, px] of Object.entries(mids)) { const s = maps.toSym.get(c); if (s) r.push({ s, p: num(px), te: now }); }
          return { r };
        }
        return {};
      },
      ping: () => JSON.stringify({ method: "ping" }),
      pingEvery: 30_000,
    };
  },
  async history(symbol, tf) {
    if (!TF_MS[tf]) return null;
    const c = (await lists()).maps.toCoin.get(symbol);
    if (!c) return null;
    const now = Date.now();
    const rows = await post<{ t: number; o: string; h: string; l: string; c: string; v: string }[]>({ type: "candleSnapshot", req: { coin: c, interval: tf, startTime: now - TF_MS[tf] * BARS, endTime: now } });
    return keyed(rows.map((r) => ({ t: r.t, o: num(r.o), h: num(r.h), l: num(r.l), c: num(r.c), v: num(r.v) })), tf);
  },
  symbols: async () => [...(await lists()).maps.toCoin.keys()],
};
