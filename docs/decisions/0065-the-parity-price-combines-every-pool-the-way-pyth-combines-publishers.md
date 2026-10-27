---
id: DEC-0065
title: The Parity price combines every pool the way Pyth combines publishers
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [crypto, data, infra, ui]
related: [DEC-0063, DEC-0064, RES-0027, DEC-0052, DEC-0045, REF-0014, REF-0018]
---

# The Parity price combines every pool the way Pyth combines publishers

## In plain words

The owner wants Pyth's coverage without paying for Pyth. Showing Pyth's own prices is a paid right ([RES-0027](../research/0027-how-pyth-works-and-what-we-may-take-from-it.md)), but Pyth's method is published. So the public feed is now the Parity price. We treat every decentralised exchange pool we can read on six blockchains as a publisher. Each asset's price combines all of its pools the way Pyth combines its publishers, and comes with a confidence band and an age. The pools are found by a script, not picked by hand. Assets on chains we do not read, and coins with no deep pool, still come from CoinGecko.

## Context

- [DEC-0063](0063-the-public-sees-live-prices-from-our-own-on-chain-feed.md) put a public live feed built from 34 pools on Base on the site. The owner asked for Pyth's and CoinGecko's coverage, and does not want to pay for Pyth.
- How Pyth works, and why its own prices are not shown, is in [RES-0027](../research/0027-how-pyth-works-and-what-we-may-take-from-it.md).

## Decision

1. **Sources.** Uniswap v3 pools on Ethereum, Arbitrum, Optimism, Polygon, Base and BNB Chain, plus Aerodrome on Base and PancakeSwap v3 on BNB Chain. Each pool is priced against USDC, USDT or the chain's main coin (ETH, BNB, POL). All of this is public blockchain data with no licence ([DEC-0063](0063-the-public-sees-live-prices-from-our-own-on-chain-feed.md)). Each chain gets its own line to a free public node: PublicNode, Tenderly's public gateway or dRPC. A line that is refused or goes quiet moves to the next node on its own.
2. **Which pools.** `web/scripts/onchain-discover.ts` reads CoinGecko's top 500 list and each coin's contract address on each chain. Coins without a contract of their own (BTC, XRP, SOL and other base-layer coins) use a wrapped or pegged form, which their label names: WBTC, cbBTC, Binance-Peg XRP. The script then asks each chain's DEX factories which pools exist for every fee tier and quote token. It measures each pool's depth (the quote token it holds, in dollars) and counts its swaps in the last 15 minutes. It hands everything to `proposePools()` in `web/live/src/venues/onchainRegistry.ts`, which keeps the deepest pools per asset across all chains, under these rules:
   - at least 50,000 USD deep;
   - at most 8 pools per asset, and at most 3 on one chain;
   - each within 2% of the best pool's weight;
   - a pool that did not trade counts a quarter;
   - Ethereum counts a fifth, because of its 12 s blocks.

   The result is `onchain-registry.json`. `proposePools()` is the one way to add pools. The data registry ([DEC-0064](0064-one-data-registry-finds-enrols-tests-and-watches-every-series-by-itself.md)) is Python, so it calls it through `web/scripts/onchain-propose.ts`, passing its proposals as JSON.
3. **The method, after Pyth** (`web/live/src/venues/parityPrice.ts`).
   - Each pool is a publisher. Its price is the pool's price after its last swap, in dollars. Pools priced in ETH, BNB or POL are converted with that coin's own Parity price.
   - A pool's confidence is half its fee as a share of the price. A pool priced in ETH, BNB or POL also adds that coin's confidence.
   - A pool's weight is its recent dollar volume, halving every 5 minutes, plus 1% of its depth. Ethereum pools are weighted a fifth.
   - Each pool casts three votes: at its price minus its confidence, at its price, and at its price plus its confidence, each with its weight. The Parity price is the weighted median of the votes.
   - The confidence is the larger distance from the Parity price to the votes' weighted 25th and 75th percentiles.
   - A pool with no swap for 10 minutes is left out while any pool is fresh. When none is fresh, the price is marked stale.
   - With three or more pools, any pool more than 5% from the first median is dropped as an outlier, and the median is taken again.
4. **Delivery.** Every swap updates the asset's price at once. Each viewer gets at most four updates a second, each carrying the price, the confidence and the block time. A viewer who subscribes gets the current price straight away: the deepest pool on each chain is read over the open lines. The chart header shows the confidence ("± 0.42"). The badge shows the age and the whole trip, and its card names the method.
5. **Pyth's own prices are not shown.** That includes the ones written on-chain ([RES-0027](../research/0027-how-pyth-works-and-what-we-may-take-from-it.md)): no text grants display, and outside Solana they are hours to days old.

## Consequences

- **Coverage, 26 October 2026:** 133 of CoinGecko's top 500 assets (7 of those 500 are dollar coins we price against, not assets). That is 234 pools: 93 on BNB Chain, 78 on Ethereum, 31 on Base, 22 on Arbitrum, 8 on Polygon and 2 on Optimism. Most of the rest have no deep Uniswap v3-style pool on these chains. Their deepest pools are Uniswap v2 pools, Solana pools or other chains, so CoinGecko covers them. Latency per chain is in [REF-0018](../reference/0018-parity-latency-baseline.md). Rerun the discovery script every few weeks: pools deepen and dry up.
- Solana is not read. Its free public node is rate limited and not meant for production, and finding its pools needs program-wide scans that the free node refuses. Coins whose deep pools sit only on Solana come from CoinGecko.
- Uniswap v2 and v4 pools are not read yet. v2 prices come from reserves rather than a price field, and v4 pools share one contract and need their own decoding. Adding v2 is the largest coverage gain left on Ethereum and BNB Chain.
- The weekly workflow `.github/workflows/onchain-discover.yml` reruns discovery and proposes the new list as a pull request.
- A pegged form (Binance-Peg XRP) can drift from the coin itself. The label says what we price, and the confidence widens when its pools disagree.
- The confidence measures how much the pools agree and how much they charge. It does not show how far DEX prices sit from centralised exchanges.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0078: Enrolled Base pools join the live feed by themselves, a few a day](0078-enrolled-base-pools-join-the-live-feed-by-themselves-a-few-a-day.md)
- [RES-0027: How Pyth works and what we may take from it](../research/0027-how-pyth-works-and-what-we-may-take-from-it.md)
<!-- backlinks:end -->
