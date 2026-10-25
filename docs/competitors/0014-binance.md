---
id: CMP-0014
title: Binance, the largest crypto exchange with futures and copy trading
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, crypto, strategy, ui]
related: [CMP-0001, RES-0021, RES-0020, DEC-0040, DEC-0032]
---

# Binance, the largest crypto exchange with futures and copy trading

## In plain words

Binance is the biggest place in the world to buy, sell and bet on crypto. It has a simple mode for beginners, a busy pro screen for traders, futures with high leverage, ready-made trading bots and a way to copy other traders automatically. It is not available to people in the United States, who get a separate, much smaller company called Binance.US. Parity should learn from its copy trading leaderboards, which show many numbers but none that separate skill from luck.

## Summary

| | |
| --- | --- |
| What it is | A centralised crypto exchange: spot, margin, futures (USDS-M and COIN-M), options, bots, copy trading, earn products, P2P |
| Who uses it | Retail and professional crypto traders outside the US. Binance states "250 million registered users by January 2025" and $95 billion average daily volume ([About](https://www.binance.com/en/about)) |
| Pricing | Spot 0.100% maker and taker at VIP 0, 0.075% when paying in BNB, down to 0.011% and 0.023% at VIP 9 ([fee schedule](https://www.binance.com/en/fee/schedule)). USDS-M futures 0.02% maker and 0.05% taker at VIP 0, 10% off with BNB ([futures fee FAQ](https://www.binance.com/en/support/faq/binance-futures-fee-structure-fee-calculations-360033544231)). Copy trading lead traders take a 10% profit share ([copy trading](https://www.binance.com/en/copy-trading)). All checked 24 October 2026 |
| Markets | Crypto spot, margin, perpetual and dated futures, options; no stocks for most users |
| Platforms | Web, desktop app (Windows, Mac, Linux, **unverified** today), iOS, Android, REST and WebSocket APIs with official connectors in several languages |
| Signature features | Futures Advanced, Fullscreen and Multi-Symbols layouts with up to 6 charts; copy trading leaderboards for futures and spot; trading bots (types **unverified**: the bots page did not render for us); Binance Square social feed |

Binance's API answered us with HTTP 451 ("restricted location") from our US machine. Web pages loaded through our fetch tool. Binance.US is a separate US company with spot trading, convert, OTC and staking, 0% maker and 0.02% taker at entry, and no futures or copy trading on its fee page ([Binance.US fees](https://www.binance.us/fees), checked 24 October 2026).

## Strengths and weaknesses

Strengths:
- Scale: the most pairs and the deepest books for most coins, which keeps spreads tight ([About](https://www.binance.com/en/about)).
- Low base fees, with a BNB discount and VIP tiers ([fee schedule](https://www.binance.com/en/fee/schedule)).
- Flexible futures screen: modules can be added, removed, resized and reordered; up to 6 charts at once ([futures interface](https://www.binance.com/en-BH/support/faq/how-to-customize-binance-futures-trading-interface-a784518335b0492a9ebfa4a72e1ca092)).
- Copy trading is easy to find and browse, with sort tabs for high PnL, high ROI, copier PnL and most copied ([copy trading](https://www.binance.com/en/copy-trading)).
- Large open-source footprint: API docs, connectors and a public market data archive on GitHub ([binance on GitHub](https://github.com/binance)).

Weaknesses:
- Not open to US residents; the US arm offers a fraction of the products ([Binance.US fees](https://www.binance.us/fees)).
- Regulatory history: Binance and its founder settled US criminal charges in November 2023 for about $4.3 billion. We could not load the Department of Justice page today, so the figure is **unverified** here.
- Copy trading leaderboards rank by 30 day PnL and ROI. Short windows and sorting by return reward lucky streaks ([copy trading](https://www.binance.com/en/copy-trading), [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)).
- The app has grown crowded. App Store reviewers say simple tasks got harder over the years.
- Account reviews and withdrawal holds draw the angriest reviews on the App Store.

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the public App Store review feeds (Binance UK app 4.65 stars from 120,950 ratings; Binance.US 4.21 from 111,063; both checked 24 October 2026). Of the 100 most recent UK reviews, 63 were five stars and 25 one star.
- Liked most: speed and the range of coins; P2P as a way to cash out where bank links were cut; a feeling of safety from the SAFU reserve fund; low fees.
- Complained about most: locked accounts and repeated identity checks; withdrawals to banks that stop working by country; support that answers with bots; the app is harder to use than it used to be.

> "So difficult to do simple trades on this platform now." (App Store review, UK, 2026, [link](https://apps.apple.com/gb/app/id1436799971))

> "Feel super safe with their SAFU funds and coin choices." (App Store review, UK, 2026, [link](https://apps.apple.com/gb/app/id1436799971))

## UX notes

- **Layout**: futures has three modes: Advanced (customisable modules), Fullscreen (fixed, buy on the left and sell on the right, for beginners) and Multi-Symbols (several charts). See [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md) for how this compares.
- **Onboarding**: identity checks before trading; the app opens on a simple buy screen with a switch to the full exchange. Detail of the current flow is **unverified**.
- **Navigation**: a very wide top menu (trade, futures, earn, social and more; exact labels **unverified**). Many products compete for the same space.
- **Density**: very high on the pro screens: book on the left, chart in the middle, trades on the right, order form below ([Academy guide](https://www.binance.com/en/academy/articles/advanced-interface-guide)).
- **Charting**: a choice of Binance's own chart and a TradingView chart, and a depth view (**unverified** today). Up to 6 charts in futures.
- **Order entry**: limit, market and stop types on spot; futures adds TP and SL, reduce-only and more. The positions panel can show TP and SL, notional size and an ADL light ([futures interface](https://www.binance.com/en-BH/support/faq/how-to-customize-binance-futures-trading-interface-a784518335b0492a9ebfa4a72e1ca092)).
- **Shortcuts**: we found no official keyboard shortcut list. **Unverified**.
- **Mobile**: the app holds almost every product. Reviewers praise speed and dislike clutter.
- **Speed perception**: reviewers often call it fast. Some US reviewers call Binance.US slow.
- **Trust signals**: SAFU fund and proof-of-reserves pages (both **unverified** today), risk warnings on copy trading, daily caps on copy trading position sizes ([copy trading](https://www.binance.com/en/copy-trading)).

## What Parity should copy, avoid or beat

- **Copy:** the beginner and pro split. Trade can open in a fixed simple layout and let users switch to a free layout ([DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)).
- **Copy:** per-column control over the positions table (what shows, in what order) for Trade's bottom dock.
- **Copy:** for Verify, the leaderboard tabs people already know (PnL, ROI, drawdown, copier PnL), so our corrected numbers sit in a familiar frame ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
- **Avoid:** a top menu with a dozen products. Each Parity app keeps its own short rail.
- **Avoid:** ranking traders by short-window return alone.
- **Beat:** show, next to each lead trader, how likely the record is under luck alone, the full history length, and how many similar traders stopped. Binance shows none of these.

## Sources

- [Binance About](https://www.binance.com/en/about), checked 24 October 2026
- [Binance fee schedule](https://www.binance.com/en/fee/schedule), checked 24 October 2026
- [Binance futures fee structure FAQ](https://www.binance.com/en/support/faq/binance-futures-fee-structure-fee-calculations-360033544231), checked 24 October 2026
- [Binance copy trading](https://www.binance.com/en/copy-trading), checked 24 October 2026
- [How to customise the Binance futures interface](https://www.binance.com/en-BH/support/faq/how-to-customize-binance-futures-trading-interface-a784518335b0492a9ebfa4a72e1ca092), checked 24 October 2026
- [Binance Academy advanced interface guide](https://www.binance.com/en/academy/articles/advanced-interface-guide), checked 24 October 2026
- [Binance.US fees](https://www.binance.us/fees), checked 24 October 2026
- [Binance on GitHub](https://github.com/binance), checked 24 October 2026
- [Binance app on the UK App Store](https://apps.apple.com/gb/app/id1436799971), checked 24 October 2026
- [Binance.US app on the US App Store](https://apps.apple.com/us/app/id1492670702), checked 24 October 2026
- [US Department of Justice press release on Binance](https://www.justice.gov/archives/opa/pr/binance-and-ceo-plead-guilty-federal-charges-4b-resolution), could not be read on 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
