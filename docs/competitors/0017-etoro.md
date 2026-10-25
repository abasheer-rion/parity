---
id: CMP-0017
title: eToro, a social investing broker built around copying other investors
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, crypto, strategy, ui]
related: [CMP-0001, RES-0020, RES-0021, DEC-0032, DEC-0034, DEC-0042]
---

# eToro, a social investing broker built around copying other investors

## In plain words

eToro is an investing app where you can buy stocks and crypto, and also copy other people: when they trade, your account does the same, in proportion. Popular people get paid by eToro when others copy them. There are also ready-made baskets called Smart Portfolios and a free practice account with $100,000 of pretend money. Parity should learn from how easy eToro makes following someone, and do better at telling users whether that person was skilled or just lucky.

## Summary

| | |
| --- | --- |
| What it is | A listed multi-asset broker with a social feed, CopyTrader, Smart Portfolios and a virtual practice portfolio ([platforms](https://www.etoro.com/trading/platforms/)) |
| Who uses it | Retail investors, many first-timers. About 3.81 million funded accounts at 31 December 2025 and over 4,800 Pro Investors others can copy ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md), from eToro's 20-F) |
| Pricing | Stocks $1 or $2 per open and close depending on country and exchange; ETFs zero commission; crypto 1% for most club levels (down to 0.10% for top tiers by volume); CFDs on spreads plus overnight fees; $5 withdrawal from USD accounts; no inactivity fee. CopyTrader itself is free, minimum $200 ([fees](https://www.etoro.com/trading/fees/), [CopyTrader](https://www.etoro.com/copytrader/), checked 24 October 2026) |
| Markets | Stocks, ETFs, crypto, commodities, currencies, indices, CFDs where allowed; "10,000+" or "7000+" assets by region ([platforms](https://www.etoro.com/trading/platforms/)) |
| Platforms | Web, iOS, Android, a separate "eToro AI" iOS app, a developer API portal (refused us, HTTP 403), an MCP connector repo on GitHub |
| Signature features | CopyTrader (up to 100 traders at once, copy stop loss); Pro Investor program; Smart Portfolios; $100,000 virtual portfolio; ProCharts; Tori AI assistant |

## Strengths and weaknesses

Strengths:
- Copying is one click: pick an investor, set an amount, trades mirror "in real time and direct proportion" ([CopyTrader](https://www.etoro.com/copytrader/)).
- Guard rails on who can be copied for money: at least 2 months of history, risk score 7 or less, worst week no deeper than minus 25% ([Pro Investor](https://www.etoro.com/copytrader/popular-investor/)).
- Practice first: every account gets a $100,000 virtual portfolio ([platforms](https://www.etoro.com/trading/platforms/)).
- Many asset types in one simple app, with fractional shares and recurring investments.
- A public company with audited numbers and a public status page ([status](https://status.etoro.com)).

Weaknesses:
- Pro Investors are paid up to 1.5% a year of assets copied, which rewards gathering copiers, not just results ([Pro Investor](https://www.etoro.com/copytrader/popular-investor/)). eToro's own filing reports users gaming the program ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)).
- Track records show returns and a volatility score, with no adjustment for luck or for traders who quit ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)).
- Crypto at 1% and CFD overnight fees are costly next to exchanges ([fees](https://www.etoro.com/trading/fees/)).
- The October 2026 app redesign set off a wave of one-star reviews in the UK.
- Smart Portfolio minimums and fees did not load for us; the product pages we tried returned 404 or blank. Details are **unverified**.

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the public App Store review feeds: eToro 4.24 stars from 18,286 UK ratings and 4.39 from 9,966 US ratings (checked 24 October 2026). Of the 100 most recent UK reviews, 24 were one star, most posted after the October 2026 update.
- Liked most: very easy to start; quick deposits and small first trades; the social side and copying; plenty of learning material.
- Complained about most: the new app hides entry prices and open orders, mixes currencies and drops candlestick charts; demo mode hard to find in the new app; withdrawals slow or blocked; overnight fees; support that is hard to reach.

> "You've taken away all control over displaying the data that we want to see" (App Store review, UK, 2026, [link](https://apps.apple.com/gb/app/id674984916))

> "There is no way to change to the virtual portfolio on the app" (App Store review, US, 2026, [link](https://apps.apple.com/us/app/id674984916))

> "Great platform for social trading with excellent supporting team" (App Store review, UK, 2026, [link](https://apps.apple.com/gb/app/id674984916))

## UX notes

- **Layout**: a feed, a watchlist and a portfolio as the main screens; each asset has its own page with chart, stats, feed and a trade button. It is an investing app, not a docked trading workspace like those in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).
- **Onboarding**: sign up, a questionnaire, identity checks, then the real and virtual portfolios side by side. Exact current steps **unverified**.
- **Navigation**: home, watchlist, portfolio, discover (people and Smart Portfolios) and a search bar. Labels **unverified** after the October redesign.
- **Density**: low by design. UK reviewers say the new app shows even less (no invested amount next to PnL, entry price per trade hidden).
- **Charting**: a basic chart on asset pages and ProCharts for side-by-side comparison of instruments or time frames ([platforms](https://www.etoro.com/trading/platforms/)).
- **Order entry**: a single trade sheet with amount, stop loss and take profit; leverage on CFDs. A UK reviewer says TP on limit orders went missing in the update.
- **Shortcuts**: none that we know of.
- **Mobile**: the main surface. A separate eToro AI app also exists.
- **Speed perception**: some reviewers say the new app is faster, while others report white screens and lost Face ID.
- **Trust signals**: risk warnings on CopyTrader pages, Pro Investor rules in public, a listed company, public status page.

## What Parity should copy, avoid or beat

- **Copy:** the virtual portfolio next to the real one, always one tap away. Trade's demo accounts should be just as easy to reach ([DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)).
- **Copy:** published entry rules for anyone shown as copyable (history length, risk cap, drawdown cap). Verify can publish its own badge rules the same way ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
- **Copy:** short learning content beside the product. Academy can link each lesson to the screen it explains ([DEC-0042](../decisions/0042-parity-academy-a-full-screen-course-player-of-its-own.md)).
- **Avoid:** a redesign that removes per-trade detail (entry price, invested amount) that holders check daily.
- **Avoid:** paying people by assets copied without showing users that incentive next to the profile.
- **Beat:** score copyable investors for luck, for how many tries it took, and against those who stopped. Show the badge next to the eToro numbers people already know.

## Sources

- [eToro platforms](https://www.etoro.com/trading/platforms/), checked 24 October 2026
- [eToro fees](https://www.etoro.com/trading/fees/), checked 24 October 2026
- [eToro CopyTrader](https://www.etoro.com/copytrader/), checked 24 October 2026
- [eToro Pro Investor program](https://www.etoro.com/copytrader/popular-investor/), checked 24 October 2026
- [eToro 20-F for 2025 (SEC)](https://www.sec.gov/Archives/edgar/data/1493318/000121390026022034/ea0278371-20f_etoro.htm), via RES-0020
- [eToro investor relations](https://investors.etoro.com/), refused (HTTP 403) on 24 October 2026
- [eToro Smart Portfolios page](https://www.etoro.com/smartportfolios/), returned no content on 24 October 2026
- [eToro app on the UK App Store](https://apps.apple.com/gb/app/id674984916), checked 24 October 2026
- [eToro app on the US App Store](https://apps.apple.com/us/app/id674984916), checked 24 October 2026
- [eToro AI app on the App Store](https://apps.apple.com/gb/app/id6751894197), checked 24 October 2026
- [eToro status](https://status.etoro.com), checked 24 October 2026
- [etoro-mcp-plugin on GitHub](https://github.com/etoro/etoro-mcp-plugin), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
