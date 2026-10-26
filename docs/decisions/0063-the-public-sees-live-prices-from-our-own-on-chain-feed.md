---
id: DEC-0063
title: The public sees live prices from our own on-chain feed
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [crypto, data, infra, ui]
related: [DEC-0052, DEC-0056, REF-0014, REF-0017, DEC-0045, REF-0018]
---

# The public sees live prices from our own on-chain feed

## In plain words

The owner asked for something really low latency that everyone can see, and whether we could make our own feed. Pyth is no longer free: since 26 August 2026 every request needs a paid key, and showing its prices costs 500 USD a month for crypto or 2,500 USD for stocks and FX. Copying exchange feeds is not allowed, and no exchange we checked lets us publish an index built from its data. Blockchain data has no owner, so we built our own feed from it: every swap in the deepest trading pools on Base, a public blockchain, turned into a price for 14 tokens. It updates every 2 seconds, when Base seals a block, and everyone sees it. CoinGecko stays as the fallback and for the coins Base does not trade.

## Context

- The public feed was CoinGecko, about a minute behind ([DEC-0052](0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md)). It was down: CoinGecko's free API answers 429 to Cloudflare's shared addresses.
- Team members already see real-time exchange feeds that are not allowed in public ([DEC-0056](0056-team-members-see-real-time-venue-feeds-the-public-does-not.md)).
- No accounts, keys or contracts were allowed for this work. Terms were read on 26 October 2026.

## What the terms say

**Pyth.** Hermes, Pyth's public price service, answers 401 to every price request without a key. Its docs say: "Since August 26, 2026, every `hermes.pyth.network` request requires a Pyth API Key" (https://docs.pyth.network/price-feeds/core/api-reference). The plans (https://app.pyth.com/products):

| Plan | Price | Speed | Assets | Public display |
| --- | --- | --- | --- | --- |
| Free | 0 | 10 s | View only, in Pyth's own terminal | No API access, no rights |
| Starter | 500 USD a month | up to 1 s | Crypto | Yes |
| Pro | from 2,500 USD a month | up to 50 ms | Stocks, futures, commodities, FX, rates, crypto | Yes, plus limited redistribution |

The subscription terms (https://www.dourolabs.xyz/Subscription-Terms.pdf) allow showing the data in our own websites to our users, but not as "a data feed, file, or other systematic or machine-readable delivery" (section 2.1), and require the Pyth logo, shown "in a clear and reasonably prominent manner", wherever the data appears (section 2.5). Limits: 20 WebSocket connections and 200 feeds. So Pyth is allowed on a public site only with a paid plan and the logo. Not built.

**A composite index from exchange data.** None of the venues we read allow publishing a calculated price from their data:

| Venue | Derived data or index | Where |
| --- | --- | --- |
| Coinbase | No: may not create "indexes, fixings, or other benchmarks" or show "Derived Works" outside the company | https://www.coinbase.com/legal/market_data |
| Gemini | No: may not "create a financial benchmark, reference rate, or index" | https://www.gemini.com/legal/market-data-agreement |
| OKX | No: may not build "a price feed" or "financial data aggregator", public endpoints included | https://www.okx.com/help/okx-api-agreement |
| Binance.US | No: the licence excludes "derivative uses" and public display | https://www.binance.us/terms-of-use |
| Alpaca | No: no public display without written consent | https://files.alpaca.markets/disclosures/library/TermsAndConditions.pdf |
| Kraken | Unclear, leans no: content for "your own benefit" only | https://www.kraken.com/legal/global-terms |
| Hyperliquid | Unclear: the terms cover the website and say nothing about data | https://app.hyperliquid.xyz/terms |

So the composite index across exchanges is not built.

**Public blockchain data.** Swaps on Base are public records that anyone can read from any node; no one licenses them. We read them through PublicNode's free node (https://www.publicnode.com), which needs no key. Its terms cover its own service and site, not the chain's data (https://www.publicnode.com/terms). Base's own public node says it is rate limited and "not suitable for production" (https://docs.base.org/specifications/node-operators/run-a-node), so we do not use it.

## Options compared

| Source | Latency | Coverage | Public display allowed | Cost |
| --- | --- | --- | --- | --- |
| **Parity on-chain, Base (built)** | One Base block, 2 s, plus about 0.1 s to our edge | 14 tokens: ETH, cbBTC, EURC, AERO, VIRTUAL, BRETT, DEGEN, MORPHO, TOSHI, UNI, cbETH, wstETH, USDT, LINK | Yes, public blockchain data | Free |
| CoinGecko (kept as fallback) | About 60 to 120 s | 100 largest coins | Yes, with "Data provided by CoinGecko" | Free; a free Demo key avoids the 429s |
| Pyth Starter | Up to 1 s | Crypto | Yes, with the Pyth logo, paid plan only | 500 USD a month |
| Pyth Pro | Up to 50 ms | Stocks, ETFs, FX, metals, crypto | Yes, with the Pyth logo, paid plan only | From 2,500 USD a month |
| Composite of exchange prices | Under 0.1 s | Every major pair | No (table above) | Free, but not allowed |
| Hyperliquid prices in public | About 0.3 s | 525 perps and spot pairs | Unclear: no data clause | Free |
| Base preconfirmed blocks (every 0.2 s) | About 0.2 s | Same 14 tokens | Yes, but only through Base's own node, which is not for production | Free |
| Uniswap v4, Arbitrum and Ethereum pools | 0.25 s (Arbitrum) to 12 s (Ethereum) | More tokens | Yes | Free; not built yet |

## Decision

1. **Our own feed, `onchain`, is the default public source.** One connection to a Base node carries every swap in 34 pools (Uniswap v3 and Aerodrome, the deepest for each token, listed in `web/live/src/venues/onchain.ts` and refreshed with `web/scripts/onchain-pools.mjs`). Each swap sets that pool's price. A token's price is the average of its pools' prices weighted by the dollar volume each pool traded recently (it fades by half every 5 minutes), in USDC; pools priced in ETH are converted with the ETH price. Each swap is shown as a trade, sized in the token. The overview also shows the change over 24 hours, from the pools' prices 43,200 blocks ago. Chart history is the deepest pool's price read at past blocks, one point per bar (60 bars, or 30 days). The free node limits Cloudflare's shared addresses, so history is often partial or missing; the chart then fills in from live swaps.
2. **Three free nodes, in turn.** The line uses PublicNode first, then Tenderly's public gateway (https://docs.tenderly.co/node-rpc/overview), then dRPC's public endpoint. Each limits by address and Cloudflare's addresses are shared, so a node that refuses the subscription is dropped and the next one is tried within seconds. A new viewer gets each symbol's current pool price at once (read over the same line), then every swap. A scheduled check (`.github/workflows/live-probe.yml`, every 30 minutes) connects as a signed-out visitor and fails if no price arrives within 5 s or no swap within 60 s.
3. **Honest timing.** A swap's time is its block's time. Base seals a block every 2 s, so a swap may be up to 2 s old before it counts; the badge's card says so. We do not use Base's faster preconfirmed blocks, because only Base's own node sends them and it is not meant for production.
4. **Where it shows.** Trade's Markets view lists the on-chain feed first, then CoinGecko. The Terminal's LIVE panel and the Workbench start on the on-chain feed and switch to CoinGecko after the on-chain line has been down for 20 seconds. Symbol search offers the 14 on-chain symbols to everyone. Symbols say what they are: `ETH-USDC`, `CBBTC-USDC`.
5. **CoinGecko stays, keyed if the owner wants.** With a `COINGECKO_API_KEY` secret set on the site and the fan-out worker, every CoinGecko request carries it (a free Demo key; `COINGECKO_PRO=1` for a paid one), which ends the 429s. Unset, nothing changes.
6. **The badge says the feed type plainly**: "Live, 0.4 s" (median time from the block or exchange to this screen), "Delayed 1 min", "Team live, 0.1 s", or what is wrong ("Source down", "Connecting"). The data's age moved into the badge's card, so Trade stays terse.
7. **Not built**: Pyth (paid), the exchange composite (terms forbid it), Hyperliquid in public (unclear), preconfirmed Base blocks (only through a node not meant for production).

## What we measured

On the live site, one client subscribed to all 14 symbols for 10 minutes ([REF-0018](../reference/0018-parity-latency-baseline.md)): Base block to our edge 99 ms median, 167 ms at the 95th percentile; block to the client 127 ms median, 419 ms at the 95th percentile (424 updates). The wait for the block itself, up to 2 s, comes on top. Browsers send their hop samples to the latency tables ([DEC-0045](0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md)) whenever someone watches.

## Alternatives considered

- **Re-publish exchange feeds.** Rejected: their terms forbid it.
- **A composite index from exchanges.** Rejected: no venue allows publishing derived data (table above).
- **Pyth.** Allowed only on a paid plan. Owner decision, below.
- **The last trade of one pool.** Rejected: a thin pool can print a stale price; weighting by recent volume follows where trading happens.

## Consequences

- **Owner decisions:**
  - Pyth Starter, 500 USD a month: real-time crypto (up to 1 s) from Pyth with the logo next to the data. Pyth Pro, from 2,500 USD a month: US stocks, ETFs, FX and metals in public, up to 50 ms. Either is a half day of work once a key exists (an adapter for Hermes, the logo in the badge).
  - A free CoinGecko Demo key ends CoinGecko's 429s: set `COINGECKO_API_KEY` on the Pages project and the worker. Free.
  - Hyperliquid in public: its terms say nothing about data. Free, but unclear; it stays team only.
- Quiet tokens can go minutes without a swap; their badge turns amber, which is true.
- If PublicNode stops answering, the line shows "Source down" and the boards fall back to CoinGecko. A paid node (Alchemy, QuickNode) would also work and needs a key.
- Pool depth changes. Rerun `web/scripts/onchain-pools.mjs` every few months and update the list.
- Copy follows [REF-0017](../reference/0017-parity-copy-rules.md).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0064: One data registry finds, enrols, tests and watches every series by itself](0064-one-data-registry-finds-enrols-tests-and-watches-every-series-by-itself.md)
- [DEC-0065: The Parity price combines every pool the way Pyth combines publishers](0065-the-parity-price-combines-every-pool-the-way-pyth-combines-publishers.md)
- [DEC-0066: Sim World grows a scenario library, stress tests, a shock composer and live echoes](0066-sim-world-grows-a-scenario-library-stress-tests-a-shock-composer-and-live-echoes.md)
- [RES-0027: How Pyth works and what we may take from it](../research/0027-how-pyth-works-and-what-we-may-take-from-it.md)
- [REF-0014: Markets data, crypto, perps and ETF sources and their terms](../reference/0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md)
- [REF-0018: Parity latency baseline](../reference/0018-parity-latency-baseline.md)
<!-- backlinks:end -->
