// Finds the pools behind the Parity price (DEC-0063, DEC-0065) and writes
// web/live/src/venues/onchain-registry.json. Read only and keyless: CoinGecko's public list
// (which coins, and each coin's contract address per chain) and public nodes (which pools
// exist, how deep they are, whether they trade). The pick itself is proposePools().
//   node --experimental-strip-types scripts/onchain-discover.ts [--top 500] [--min-liq 50000]
// COINGECKO_API_KEY (optional, a free demo key) is sent when set.
import { readFileSync, writeFileSync } from "node:fs";
import { CHAINS, proposePools, type ChainDef, type PoolEntry, type Proposal, type Registry } from "../live/src/venues/onchainRegistry.ts";

const OUT = new URL("../live/src/venues/onchain-registry.json", import.meta.url);
const arg = (name: string, def: number) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : def; };
const TOP = arg("--top", 500), MIN_LIQ = arg("--min-liq", 50_000);

/** CoinGecko's platform names for our chains. */
const PLATFORM: Record<string, string> = { ethereum: "ethereum", arbitrum: "arbitrum-one", base: "base", optimism: "optimistic-ethereum", polygon: "polygon-pos", bnb: "binance-smart-chain" };
/** Coins with no contract of their own (layer 1 coins), priced by a wrapped or pegged form. */
const ALIASES: Record<string, [chain: string, address: string, via: string][]> = {
  bitcoin: [["ethereum", "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", "WBTC"], ["arbitrum", "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", "WBTC"], ["base", "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", "cbBTC"], ["bnb", "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", "BTCB"]],
  ethereum: [["ethereum", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "WETH"], ["arbitrum", "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", "WETH"], ["base", "0x4200000000000000000000000000000000000006", "WETH"], ["optimism", "0x4200000000000000000000000000000000000006", "WETH"], ["polygon", "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", "WETH"]],
  binancecoin: [["bnb", "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", "WBNB"]],
  "polygon-ecosystem-token": [["polygon", "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", "WPOL"]],
  solana: [["bnb", "0x570a5d26f7765ecb712c0924e4de545b89fd43df", "Binance-Peg SOL"]],
  ripple: [["bnb", "0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe", "Binance-Peg XRP"]],
  dogecoin: [["bnb", "0xba2ae424d960c26247dd6c32edc70b295c744c43", "Binance-Peg DOGE"]],
  cardano: [["bnb", "0x3ee2200efb3400fabb9aacf31297cbdd1d435d47", "Binance-Peg ADA"]],
  litecoin: [["bnb", "0x4338665cbb7b2485a8855a139b75d5e34ab0db94", "Binance-Peg LTC"]],
  "bitcoin-cash": [["bnb", "0x8ff795a6f4d97e7887c79bea79aba5cc76444adf", "Binance-Peg BCH"]],
  polkadot: [["bnb", "0x7083609fce4d1d8dc0c979aab8c869ea2c873402", "Binance-Peg DOT"]],
  tron: [["bnb", "0xce7de646e7208a4ef112cb6ed5038fa6cc6b12e3", "Binance-Peg TRX"]],
  "avalanche-2": [["bnb", "0x1ce0c2827e2ef14d5c4f29a091d735a204794041", "Binance-Peg AVAX"]],
  filecoin: [["bnb", "0x0d8ce2a99bb6e3b7db580ed848240e4a0f9ae153", "Binance-Peg FIL"]],
  "ethereum-classic": [["bnb", "0x3d6545b08693dae087e957cb1180ee38b9e3c25e", "Binance-Peg ETC"]],
  near: [["bnb", "0x1fa4a73a3f0133f0025378af00236f3abdee5d63", "Binance-Peg NEAR"]],
  cosmos: [["bnb", "0x0eb3a705fc54725037cc9e008bdede697f62f335", "Binance-Peg ATOM"]],
};
/** Dollar coins are quotes, not assets to price. */
const SKIP = new Set(["tether", "usd-coin", "dai", "first-digital-usd", "ethena-usde", "usds", "paypal-usd", "binance-bridged-usdt-bnb-smart-chain", "bridged-usdc-polygon-pos-bridge"]);

const http = (c: ChainDef) => c.nodes[0].replace(/^wss/, "https");
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
let rid = 0;
async function batch(c: ChainDef, calls: { method: string; params: unknown[] }[]): Promise<(string | null | unknown[])[]> {
  const out: (string | null | unknown[])[] = [];
  for (let i = 0; i < calls.length; i += 50) {
    const part = calls.slice(i, i + 50).map((x) => ({ jsonrpc: "2.0", id: rid++, ...x }));
    for (let tries = 0; ; tries += 1) {
      try {
        const res = await fetch(http(c), { method: "POST", headers: { "content-type": "application/json", "user-agent": "parity-discovery (contact@paritytrading.ai)" }, body: JSON.stringify(part) });
        if (res.status === 429 || res.status >= 500) throw new Error(String(res.status));
        const body = (await res.json()) as { id: number; result?: string | unknown[] }[];
        const byId = new Map(body.map((r) => [r.id, r.result ?? null]));
        out.push(...part.map((x) => byId.get(x.id) ?? null));
        break;
      } catch (e) {
        if (tries >= 4) { out.push(...part.map(() => null)); console.error(`${c.chain}: batch failed (${String(e)})`); break; }
        await sleep(1500 * (tries + 1));
      }
    }
    await sleep(150);
  }
  return out;
}
const pad = (a: string) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const int = (n: number) => (n < 0 ? (2n ** 256n + BigInt(n)).toString(16) : n.toString(16)).padStart(64, "0");
const addrOf = (r: unknown) => (typeof r === "string" && r.length >= 66 ? `0x${r.slice(26, 66)}` : null);
const num = (r: unknown) => (typeof r === "string" && r.length > 2 ? BigInt(r.slice(0, 66)) : null);
const feeOf = (kind: "fee" | "spacing", p: number) => (kind === "fee" ? p / 1e6 : ({ 1: 0.0001, 50: 0.0005, 100: 0.0005, 200: 0.003, 2000: 0.01 } as Record<number, number>)[p] ?? 0.003);
const label = (dex: string, kind: "fee" | "spacing", p: number) => (kind === "fee" ? `${dex} ${+(p / 1e4).toFixed(2)}%` : `${dex} CL${p}`);

async function cg(path: string): Promise<unknown> {
  const key = process.env.COINGECKO_API_KEY;
  for (let tries = 0; ; tries += 1) {
    const res = await fetch(`https://api.coingecko.com/api/v3${path}`, { headers: { accept: "application/json", ...(key ? { "x-cg-demo-api-key": key } : {}) } });
    if (res.ok) return res.json();
    if (tries >= 4) throw new Error(`coingecko ${res.status}`);
    await sleep(15_000);
  }
}

interface Coin { id: string; symbol: string; name: string; rank: number; price: number }
const top: Coin[] = [];
for (let page = 1; top.length < TOP; page += 1) {
  const rows = (await cg(`/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`)) as { id: string; symbol: string; name: string; market_cap_rank: number | null; current_price: number | null }[];
  if (!rows.length) break;
  for (const r of rows) top.push({ id: r.id, symbol: r.symbol, name: r.name, rank: r.market_cap_rank ?? top.length + 1, price: r.current_price ?? 0 });
}
top.splice(TOP);
const list = new Map(((await cg("/coins/list?include_platform=true")) as { id: string; platforms?: Record<string, string> }[]).map((c) => [c.id, c.platforms ?? {}]));
const priceOf = (id: string) => top.find((c) => c.id === id)?.price ?? 0;
console.error(`coins: ${top.length}`);

const proposals: Proposal[] = [];
for (const c of CHAINS) {
  // Candidate tokens on this chain: their own contracts, and the aliases.
  const want: { coin: Coin; address: string; via?: string }[] = [];
  for (const coin of top) {
    if (SKIP.has(coin.id)) continue;
    const a = list.get(coin.id)?.[PLATFORM[c.chain]];
    if (a && /^0x[0-9a-fA-F]{40}$/.test(a)) want.push({ coin, address: a.toLowerCase() });
    for (const [chain, address, via] of ALIASES[coin.id] ?? []) if (chain === c.chain && !want.some((w) => w.address === address)) want.push({ coin, address, via });
  }
  const quoteAddrs = new Set(c.quotes.map((q) => q.address));
  const cands = want.filter((w) => !quoteAddrs.has(w.address) || ALIASES[w.coin.id]);
  // Every factory, every fee tier, every quote: which pools exist.
  const calls: { method: string; params: unknown[] }[] = [];
  const meta: { w: (typeof cands)[number]; q: (typeof c.quotes)[number]; f: (typeof c.factories)[number]; p: number }[] = [];
  for (const w of cands) for (const q of c.quotes) {
    if (q.address === w.address) continue;
    for (const f of c.factories) for (const p of f.params) {
      calls.push({ method: "eth_call", params: [{ to: f.address, data: `${f.kind === "fee" ? "0x1698ee82" : "0x28af8d0b"}${pad(w.address)}${pad(q.address)}${int(p)}` }, "latest"] });
      meta.push({ w, q, f, p });
    }
  }
  const found = (await batch(c, calls)).map((r, i) => ({ ...meta[i], pool: addrOf(r) })).filter((x) => x.pool && !/^0x0+$/.test(x.pool));
  // Depth: the quote token held by the pool, in dollars. Decimals of each base token.
  const bal = await batch(c, found.map((x) => ({ method: "eth_call", params: [{ to: x.q.address, data: `0x70a08231${pad(x.pool!)}` }, "latest"] })));
  const bases = [...new Set(found.map((x) => x.w.address))];
  const decs = new Map(bases.map((b, i) => [b, i] as const));
  const decRes = await batch(c, bases.map((b) => ({ method: "eth_call", params: [{ to: b, data: "0x313ce567" }, "latest"] })));
  const usdOfQuote = (q: (typeof c.quotes)[number]) => (q.usd === "usd" ? 1 : priceOf(q.usd));
  const pools = found.map((x, i) => {
    const b = num(bal[i]);
    const d = num(decRes[decs.get(x.w.address)!]);
    const liq = b == null ? 0 : (Number(b) / 10 ** x.q.decimals) * usdOfQuote(x.q);
    return { ...x, liq, decimals: d == null ? -1 : Number(d) };
  }).filter((x) => x.liq >= MIN_LIQ && x.decimals >= 0 && x.decimals <= 36);
  // Volume: swaps in a recent window, for the pools deep enough to matter.
  const window = Math.round(900_000 / c.blockMs);
  const head = await batch(c, [{ method: "eth_blockNumber", params: [] }]);
  const swaps = new Map<string, number>();
  if (typeof head[0] === "string") {
    const to = Number(BigInt(head[0]));
    const addrs = pools.map((x) => x.pool!);
    for (let i = 0; i < addrs.length; i += 20) {
      const chunk = addrs.slice(i, i + 20);
      const logs = await batch(c, [{ method: "eth_getLogs", params: [{ fromBlock: `0x${(to - window).toString(16)}`, toBlock: `0x${to.toString(16)}`, address: chunk, topics: [[...new Set(c.factories.map((f) => f.topic))]] }] }]);
      const got = logs[0];
      if (Array.isArray(got)) { for (const a of chunk) swaps.set(a, 0); for (const l of got as { address: string }[]) swaps.set(l.address.toLowerCase(), (swaps.get(l.address.toLowerCase()) ?? 0) + 1); }
    }
  }
  const byCoin = new Map<string, Proposal>();
  for (const x of pools) {
    const e: PoolEntry = { chain: c.chain, pool: x.pool!, base: x.w.address, decimals: x.decimals, quote: x.q.key, dex: label(x.f.dex, x.f.kind, x.p), fee: feeOf(x.f.kind, x.p), liq: Math.round(x.liq), swaps: swaps.has(x.pool!) ? swaps.get(x.pool!)! : null, topic: x.f.topic, ...(x.w.via ? { via: x.w.via } : {}) };
    const prev = byCoin.get(x.w.coin.id);
    if (prev) prev.pools.push(e);
    else byCoin.set(x.w.coin.id, { key: x.w.coin.id, sym: x.w.coin.symbol, name: x.w.coin.name, rank: x.w.coin.rank, pools: [e] });
  }
  proposals.push(...byCoin.values());
  console.error(`${c.chain}: ${cands.length} tokens, ${found.length} pools, ${pools.length} deep enough, ${byCoin.size} assets`);
}

let old: Registry | null = null;
try { old = JSON.parse(readFileSync(OUT, "utf8")) as Registry; } catch { /* first run */ }
// A fresh run replaces what it measured; pools it no longer finds drop out.
const reg = proposePools(null, proposals, { minLiqUsd: MIN_LIQ });
writeFileSync(OUT, `${JSON.stringify(reg, null, 1)}\n`);
const covered = new Set(reg.tokens.map((t) => t.key));
const inTop = top.filter((c) => covered.has(c.id)).length;
const perChain: Record<string, number> = {};
for (const t of reg.tokens) for (const p of t.pools) perChain[p.chain] = (perChain[p.chain] ?? 0) + 1;
console.log(JSON.stringify({ assets: reg.tokens.length, ofTop: TOP, covered: inTop, stablecoinsSkipped: top.filter((c) => SKIP.has(c.id)).length, pools: perChain, previousAssets: old?.tokens.length ?? null }));
