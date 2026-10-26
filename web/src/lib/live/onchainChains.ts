// The chains behind the Parity price (DEC-0063, DEC-0065), for the browser: names and block
// times, so the badge can say how long a swap waits for its block. The fan-out's own list,
// with nodes, quote tokens and DEX factories, is web/live/src/venues/onchainRegistry.ts.
export interface ChainMeta { chain: string; name: string; blockMs: number }

export const ONCHAIN_CHAINS: ChainMeta[] = [
  { chain: "arbitrum", name: "Arbitrum", blockMs: 250 },
  { chain: "bnb", name: "BNB Chain", blockMs: 450 },
  { chain: "base", name: "Base", blockMs: 2_000 },
  { chain: "optimism", name: "Optimism", blockMs: 2_000 },
  { chain: "polygon", name: "Polygon", blockMs: 2_000 },
  { chain: "ethereum", name: "Ethereum", blockMs: 12_000 },
];
