---
id: RES-0027
title: How Pyth works and what we may take from it
type: research
status: current
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [crypto, data, infra]
related: [DEC-0063, DEC-0065, REF-0014]
---

# How Pyth works and what we may take from it

## In plain words

Pyth collects prices from trading firms and exchanges, combines them into one price with a confidence band, and delivers that price to blockchains. Since 26 August 2026 its price service needs a paid key, and showing its prices on a website is a paid right. Some Pyth prices are also written onto blockchains, where anyone can read them, but no Pyth document says we may show those on our site, and most are hours or days old outside Solana. So we do not show Pyth prices. We copied the method instead: [DEC-0065](../decisions/0065-the-parity-price-combines-every-pool-the-way-pyth-combines-publishers.md) combines every trading pool we read the way Pyth combines its publishers.

## Summary

- Pyth combines publishers' prices with a weighted median of three votes each, and takes its confidence from the quartiles. The whitepaper publishes the method.
- Hermes needs a paid key since 26 August 2026. Display is sold from 500 USD a month.
- Showing Pyth prices read from blockchains: unclear (no grant, no ban), and stale outside Solana. Not built.
- We copy the method, not the data ([DEC-0065](../decisions/0065-the-parity-price-combines-every-pool-the-way-pyth-combines-publishers.md)).

## How Pyth works

**Publishers.** First-party sources (trading firms and exchanges such as Jane Street, HRT, Virtu and LMAX) each send a price and a confidence, how far off their price may be, for each feed (https://docs.pyth.network/whitepaper).

**Aggregation, as designed** (whitepaper v2.0, https://pyth.network/whitepaper). Each publisher casts three votes: one at its price and one at its price minus and plus its confidence. The aggregate price is the stake-weighted median of all votes. The aggregate confidence is the larger of the distances from that median to the votes' weighted 25th and 75th percentiles. Weights were set uniformly at first; Oracle Integrity Staking later let holders stake behind publishers (rewards paused since 22 April 2026, https://docs.pyth.network/oracle-integrity-staking). The price updates once per slot, about 400 ms, on Pythnet, Pyth's own chain, and a feed stops updating when fewer than its minimum number of publishers have sent a fresh price.

**Aggregation now** (https://docs.pyth.network/pro/how-lazer-works, https://docs.pyth.network/pro/understanding-price-data). Pythnet was shut down with the August 2026 change. Publishers send prices over authenticated sockets to relayers run by Douro Labs. Routers take the median of the publishers' prices when at least `min_pub` have sent one, set the confidence from the interquartile range of prices, bids and asks pooled together, and drop stale publishers. Five routers sign each update; a contract accepts it when three signatures check out. Feeds follow each asset's market hours.

**Delivery.**

- **Pull.** An app fetches a signed update from Hermes (a paid key since 26 August 2026) and writes it to a chain with `updatePriceFeeds`; the fee is now zero (https://docs.pyth.network/pro/on-chain-fees). Before the change, Wormhole guardians signed the update roots (13 of 19).
- **Push, or sponsored feeds.** Someone pays to write chosen feeds on a schedule: a heartbeat, or a move past a set deviation (https://docs.pyth.network/pro/sponsored-feeds). On 26 October 2026: 64 feeds on Solana, about once a minute; a handful on Optimism, Monad, HyperEVM and Soneium; on Ethereum only two (BOLD and SPYX), hourly. Base and Arbitrum have none since 31 August 2025. Solana's BTC, ETH and 28 others stop on 15 November 2026 (https://dev-forum.pyth.network/t/863).
- **Pyth Pro (formerly Lazer).** Paid streams at real time, 50 ms, 200 ms or 1 s, from 500 USD a month (https://www.pyth.network/pricing).

## May we show on-chain Pyth prices for free?

**Unclear, so no.** What the texts say (read 26 October 2026):

| Text | What it says | Covers on-chain reads? |
| --- | --- | --- |
| pyth.network Terms of Use (7 August 2025), https://www.pyth.network/legal/terms-conditions | No licence to "any... price feed data (including asset prices, confidence intervals, or related metadata)... contained in the Site"; no extracting it "from the Site" by automated means | No, the Site only |
| Douro Labs subscription terms, https://www.dourolabs.xyz/Subscription-Terms.pdf | Display only for paying customers, with the Pyth logo; no benchmark built from the data | No, its own Site, Services and API |
| Plans, https://www.pyth.network/pricing | Free: "No redistribution rights"; Starter: "Display rights" | Says display is sold |
| Docs, https://docs.pyth.network/llms.txt | "The on-chain contracts are permissionless" | Reading, not showing |
| A data licence | None published (https://www.pyth.network/data-license answers 404) | n/a |

Nothing grants a right to show on-chain Pyth prices in public, and the plans sell display as a right. The practical case is weak too: we read ETH/USD from the Pyth contract on Base, Arbitrum and Ethereum on 26 October 2026 and its last update was 11.6 hours, 24 days and 70 days old. Only Solana's sponsored feeds were fresh (25 s), and the main ones stop on 15 November. A written yes from Douro Labs (data@dourolabs.xyz) would settle the first point; it would not fix the second.

## What we take from it

The method is not owned by anyone and is published in the whitepaper: three votes per source, a weighted median, a confidence from the quartiles, stale and thin sources left out. [DEC-0065](../decisions/0065-the-parity-price-combines-every-pool-the-way-pyth-combines-publishers.md) applies it to our own sources: every DEX pool we read on six chains is a publisher, its fee is its confidence, and its recent trading volume and depth are its weight.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0065: The Parity price combines every pool the way Pyth combines publishers](../decisions/0065-the-parity-price-combines-every-pool-the-way-pyth-combines-publishers.md)
<!-- backlinks:end -->
