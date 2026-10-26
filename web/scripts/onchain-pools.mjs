// Lists the deepest Uniswap v3 and Aerodrome pools on Base for the tokens of our on-chain
// feed (DEC-0063), to refresh POOLS in live/src/venues/onchain.ts. Read only: public node
// calls, no key, no account. Run: node scripts/onchain-pools.mjs
const RPC = "https://base-rpc.publicnode.com";
const TOKENS = {
  WETH: ["0x4200000000000000000000000000000000000006", 18], USDC: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6],
  CBBTC: ["0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 8], EURC: ["0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", 6],
  AERO: ["0x940181a94A35A4569E4529A3CDfB74e38FD98631", 18], VIRTUAL: ["0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", 18],
  BRETT: ["0x532f27101965dd16442E59d40670FaF5eBB142E4", 18], DEGEN: ["0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", 18],
  MORPHO: ["0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842", 18], TOSHI: ["0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", 18],
  UNI: ["0xc3De830EA07524a0761646a6a4e4be0e114a3C83", 18], CBETH: ["0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", 18],
  WSTETH: ["0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", 18], USDT: ["0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", 6],
  LINK: ["0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196", 18],
};
const UNISWAP = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"; // getPool(a, b, fee)
const AERODROME = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A"; // getPool(a, b, tickSpacing)
let id = 0;
async function batch(calls) {
  const body = calls.map(([to, data]) => ({ jsonrpc: "2.0", id: id++, method: "eth_call", params: [{ to, data }, "latest"] }));
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const byId = new Map((await res.json()).map((x) => [x.id, x.result]));
  return body.map((b) => byId.get(b.id));
}
const pad = (a) => a.toLowerCase().replace("0x", "").padStart(64, "0");
const int = (n) => (n < 0 ? (2n ** 256n + BigInt(n)).toString(16) : n.toString(16)).padStart(64, "0");
const [ethPx] = await batch([["0xd0b53d9277642d899df5c87a3966a349a798f224", "0x3850c7bd"]]);
const eth = (Number(BigInt(ethPx.slice(0, 66))) / 2 ** 96) ** 2 * 1e12;
const rows = [];
for (const [base, [ba]] of Object.entries(TOKENS)) {
  for (const quote of ["USDC", "WETH"]) {
    if (base === quote || base === "USDC") continue;
    const qa = TOKENS[quote][0];
    const meta = [], calls = [];
    for (const fee of [100, 500, 3000, 10000]) { calls.push([UNISWAP, `0x1698ee82${pad(ba)}${pad(qa)}${int(fee)}`]); meta.push(`Uniswap v3 ${fee / 10000}%`); }
    for (const ts of [1, 50, 100, 200, 2000]) { calls.push([AERODROME, `0x28af8d0b${pad(ba)}${pad(qa)}${int(ts)}`]); meta.push(`Aerodrome CL${ts}`); }
    const found = (await batch(calls)).map((r, i) => [r && r.length >= 66 ? `0x${r.slice(26)}` : null, meta[i]]).filter(([a]) => a && !/^0x0+$/.test(a));
    if (!found.length) continue;
    const bal = await batch(found.map(([a]) => [qa, `0x70a08231${pad(a)}`]));
    found.forEach(([a, m], i) => {
      const q = Number(BigInt(bal[i] || "0x0")) / 10 ** TOKENS[quote][1];
      rows.push({ base, quote, a, m, k: Math.round((quote === "WETH" ? q * eth : q) / 1000) });
    });
  }
}
rows.sort((x, y) => x.base.localeCompare(y.base) || y.k - x.k);
for (const r of rows) if (r.k >= 40) console.log(`  ["${r.base}", "${r.quote}", "${r.a}", "${r.m}", ${r.k}],`);
