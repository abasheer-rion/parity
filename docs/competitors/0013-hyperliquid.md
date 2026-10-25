---
id: CMP-0013
title: Hyperliquid, an onchain exchange for crypto perpetuals and spot
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, crypto, open-source, ui]
related: [CMP-0001, RES-0021, RES-0020, DEC-0040, DEC-0032, DEC-0034]
---

# Hyperliquid, an onchain exchange for crypto perpetuals and spot

## In plain words

Hyperliquid is a trading venue that runs on its own blockchain. People connect a crypto wallet or an email address, put in USDC, and bet on prices going up or down with borrowed money. Every order and trade sits on a public ledger, so anyone can check anyone's record. Parity should learn two things: a dense, fixed trading screen can still feel calm, and a public record of every trade is the best raw material for checking claims.

## Summary

| | |
| --- | --- |
| What it is | A layer one blockchain whose core runs fully onchain order books for perpetual futures and spot, plus an EVM side for apps ([docs](https://hyperliquid.gitbook.io/hyperliquid-docs)) |
| Who uses it | Crypto traders, market makers and app builders. No user count published; Hyperliquid says perps and spot drive "billions in daily volume" ([Hyperliquid 101](https://hyperliquid.gitbook.io/hyperliquid-docs/about-hyperliquid/hyperliquid-101-for-non-crypto-audiences)). Our own API read on 24 October 2026: about $4.5 billion of 24 hour perp volume and $11.2 billion open interest across 178 main perps |
| Pricing | Perps 0.045% taker and 0.015% maker at the base tier, down to 0.024% and 0% at the top tier; spot 0.070% and 0.040% at base. Staking HYPE cuts fees 5% to 40% (checked 24 October 2026, [fees](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees)). No account or data fees |
| Markets | Crypto perps (up to 40x on the main list), spot tokens, builder-deployed perps (HIP-3) that include stock and commodity style markets, outcome markets on recurring BTC price questions |
| Platforms | Web app (app.hyperliquid.xyz), public REST and WebSocket API, Python and Rust SDKs. No official native mobile app: the docs point to third-party apps (Dexari, MetaMask, Phantom) |
| Signature features | Public ledger of every order and fill; vaults anyone can deposit into; TWAP, scale, chase and trailing stop orders in the web app; email login; a testnet with a faucet |

## Strengths and weaknesses

Strengths:
- Low fees next to centralised venues, with maker rebates at volume ([fees](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees)).
- Rich order types in a plain web app: TWAP with randomised slices, scale orders across a range, chase orders that follow the best price, trailing stops ([order types](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/order-types)).
- Everything is public. Fills, liquidations and vault results can be checked by anyone, and node data is exported to public buckets ([historical data](https://hyperliquid.gitbook.io/hyperliquid-docs/historical-data)).
- Open builder model: other teams build apps and terminals on the same liquidity and earn fees through "builder codes", over $65 million so far by Hyperliquid's count ([Hyperliquid 101](https://hyperliquid.gitbook.io/hyperliquid-docs/about-hyperliquid/hyperliquid-101-for-non-crypto-audiences), [builder codes](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes)).
- Vault leaders must keep at least 5% of their own vault, which is a simple skin-in-the-game rule ([vault leaders](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-leaders-legacy)).

Weaknesses:
- Self-custody and bridging are real friction for newcomers: wallets, chains and gas only to deposit ([how to start](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading)).
- When an account goes below zero, profitable traders on the other side can be force-closed (auto-deleveraging) ([ADL](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/auto-deleveraging)).
- The portfolio page's max drawdown uses its own formula and the charts sample every 15 minutes, so the numbers are not fit for precise records ([misc UI](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/miscellaneous-ui), [portfolio graphs](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-graphs)).
- Historical market data in the public bucket comes about once a month, "no guarantee" of timely updates; no candles there ([historical data](https://hyperliquid.gitbook.io/hyperliquid-docs/historical-data)).
- No official phone app and a fixed desktop layout (see [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md)).
- Leverage up to 40x and outcome markets put it in the high-risk end of retail trading; it is not a regulated broker.

## What users say

<!-- collector:start -->
Our feedback collector ([CMP-0001](0001-ux-patterns-users-praise-most.md#how-we-count)), pass of 2026-10-25: **114 public items** that name Hyperliquid (Hacker News 77, GitHub issues 37).

| | Count |
| --- | --- |
| Praise | 17 |
| Complaints | 28 |
| Neither | 69 |
| Praise share | 38% |

- Most praised themes: API and automation (9), Fees and pricing (7), Community and copy trading (5).
- Most complained-about themes: API and automation (21), Crashes and bugs (12), Market data and quotes (10).
<!-- collector:end -->

Hyperliquid has no official App Store app, so there is no review feed. From Hacker News threads and the docs:
- Liked most: speed and fees; trading 24/7, including stock-style perps; the open API that lets people build their own terminals and bots.
- Complained about most: volume and liquidity outside the top pairs are thin; the venue's risk rules (auto-deleveraging, oracle-set markets on HIP-3) are hard to follow; wallet setup.
- We found few direct user comments on public, allowed sources. Themes above are partly our own reading and are **unverified** as majority views.

> "HL does have a trading pair for MSFT and trades 24/7." (Hacker News comment, 2026, [link](https://news.ycombinator.com/item?id=48330428))

## UX notes

- **Layout**: top nav, a stats strip, one large chart, order form on the right, a tabbed bottom dock. Measured in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md); we do not repeat it here.
- **Onboarding**: "Connect" with a wallet or an email code, then "Enable Trading" (a gasless signature), then Deposit. Four steps, all in modals ([how to start](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading)).
- **Navigation**: a handful of top-level pages in the top nav (Trade, Vaults, Portfolio and a few more; exact list **unverified**). The token selector is the main way to move.
- **Density**: high. Book, trades, chart and dock all visible at 1440 by 900; labels are short and there is no help text.
- **Charting**: one chart per view with the usual indicators. The chart library is **unverified**.
- **Order entry**: leverage and margin mode at the top of the ticket; size by slider or typed; a confirm modal with "Don't show this again" ([how to start](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading)). Chase orders run in the browser tab, up to 5 at once.
- **Shortcuts**: no keyboard shortcut list in the docs. **Unverified** whether the app has any.
- **Mobile**: web app on the phone, or third-party apps. A QR code links a phone to a desktop wallet ([QR](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/connect-mobile-via-qr-code)).
- **Speed perception**: one-block finality and a claimed 200,000 orders a second ([docs](https://hyperliquid.gitbook.io/hyperliquid-docs)). Trading itself costs no gas, so there is no wallet pop-up per order once trading is enabled.
- **Trust signals**: public ledger, audits page, bug bounty, validator set, no outside investors. A Statuspage at hyperliquid.statuspage.io answers, but we did not find it linked from the docs (**unverified** as official).

## What Parity should copy, avoid or beat

- **Copy:** the order type set (TWAP, scale, trailing stop, chase) as paper-trading options in Trade ([DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md), [DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)).
- **Copy:** for Verify, use public ledgers like this one as a first source: any address's fills can be pulled and checked without trusting a screenshot ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
- **Copy:** publish the formula behind every number on a results page, as Hyperliquid does for max drawdown. Applies to Verify and Workbench.
- **Avoid:** account-relative drawdown windows and 15 minute sampling for anything we call a track record.
- **Avoid:** a fixed layout with no saved views. Trade already plans resizable, saved layouts.
- **Beat:** vaults show leader returns with no adjustment for luck or for the many vaults that failed. Verify can score vault leaders against the whole population of vaults, dead ones included (see [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md) for the gap).

## Sources

- [Hyperliquid docs home](https://hyperliquid.gitbook.io/hyperliquid-docs), checked 24 October 2026
- [Hyperliquid 101 for non-crypto audiences](https://hyperliquid.gitbook.io/hyperliquid-docs/about-hyperliquid/hyperliquid-101-for-non-crypto-audiences), checked 24 October 2026
- [Fees](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees), checked 24 October 2026
- [Order types](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/order-types), checked 24 October 2026
- [How to start trading](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading), checked 24 October 2026
- [Contract specifications](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications), checked 24 October 2026
- [HIP-3 builder-deployed perpetuals](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals), checked 24 October 2026
- [Builder codes](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes), checked 24 October 2026
- [Vaults](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults) and [for vault leaders (legacy)](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-leaders-legacy), checked 24 October 2026
- [Protocol vaults](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/protocol-vaults), checked 24 October 2026
- [Auto-deleveraging](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/auto-deleveraging), checked 24 October 2026
- [Miscellaneous UI](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/miscellaneous-ui), checked 24 October 2026
- [Portfolio graphs](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-graphs), checked 24 October 2026
- [Historical data](https://hyperliquid.gitbook.io/hyperliquid-docs/historical-data), checked 24 October 2026
- [Connect mobile via QR code](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/connect-mobile-via-qr-code), checked 24 October 2026
- [Hyperliquid public info API](https://api.hyperliquid.xyz/info) (metaAndAssetCtxs request), checked 24 October 2026
- [Hyperliquid trade app](https://app.hyperliquid.xyz/trade), checked 24 October 2026
- [hyperliquid-dex on GitHub](https://github.com/hyperliquid-dex), checked 24 October 2026
- [Hacker News comment on MSFT perps](https://news.ycombinator.com/item?id=48330428), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
