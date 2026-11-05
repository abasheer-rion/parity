// Contract sizes of common US futures: dollars per point of price, by root symbol. Exports
// that list futures fills without a multiplier (thinkorswim, Tradovate orders) need these to
// turn a price move into money. Sources: the exchanges' contract specifications (CME Group).
const POINT_VALUE: Record<string, number> = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5, EMD: 100,
  CL: 1000, MCL: 100, QM: 500, NG: 10000, QG: 2500, RB: 42000, HO: 42000,
  GC: 100, MGC: 10, SI: 5000, SIL: 1000, HG: 25000, MHG: 2500, PL: 50, PA: 100,
  ZB: 1000, ZN: 1000, ZF: 1000, ZT: 2000, UB: 1000, TN: 1000,
  "6E": 125000, M6E: 12500, "6B": 62500, M6B: 6250, "6J": 12500000, "6A": 100000, M6A: 10000, "6C": 100000, "6S": 125000, "6N": 100000,
  ZC: 50, ZS: 50, ZW: 50, ZL: 600, ZM: 100, HE: 400, LE: 400, GF: 500,
  BTC: 5, MBT: 0.1, ETH: 50, MET: 0.1, VX: 1000,
};

/** The root of a futures symbol: "/ESM19" gives ES, "MNQU6" gives MNQ, "NQ JUN25" gives NQ. */
export function futuresRoot(sym: string): string | null {
  const s = sym.trim().toUpperCase().replace(/^\//, "").split(/[\s:]/)[0];
  for (const len of [3, 2]) {
    const root = s.slice(0, len);
    if (POINT_VALUE[root] != null && /^[FGHJKMNQUVXZ]\d{1,2}$/.test(s.slice(len)) || (POINT_VALUE[root] != null && s.length === len)) return root;
  }
  return null;
}

/** Dollars per point for a futures symbol, or null when we do not know the contract. */
export function pointValue(sym: string): number | null {
  const r = futuresRoot(sym);
  return r ? POINT_VALUE[r] : null;
}
