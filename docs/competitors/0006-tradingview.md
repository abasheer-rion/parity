---
id: CMP-0006
title: TradingView, browser charts and a social network for traders
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, crypto, strategy, ui]
related: [CMP-0001, RES-0020, RES-0021, DEC-0031, DEC-0033, DEC-0034, DEC-0043]
---

# TradingView, browser charts and a social network for traders

## In plain words

TradingView is a website and app where people draw on price charts, set alerts, share ideas and, through a linked broker, trade. It is free to start and has paid plans for more charts and alerts. Its charts are so good that many other apps borrow them. Parity should copy how fast and clean its charts feel, and should avoid the pushy subscription tricks people complain about.

## Summary

| | |
| --- | --- |
| What it is | Web, desktop and mobile charting with screeners, alerts, paper trading, a scripting language (Pine Script) and a social feed; founded 2011, offices in New York, London, Malaga and Tbilisi ([Wikipedia](https://en.wikipedia.org/wiki/TradingView)) |
| Who uses it | Retail traders and investors of every kind. Claims "100 million traders" ([pricing](https://www.tradingview.com/pricing/)); a company claim, not audited |
| Pricing | Basic free. Essential $12.95, Plus $29.95, Premium $59.95, Ultimate $199.95 a month billed yearly; the page says yearly billing saves $24 to $480 a year against monthly. Real-time exchange data costs extra (checked 24 October 2026) |
| Markets | Stocks, ETFs, futures, FX, crypto (exchange and DEX pairs), bonds, CFDs; trading through 100+ linked brokers |
| Platforms | Web, desktop app, iOS, Android; free open-source Lightweight Charts library and a licensed Charting Library for other companies |
| Signature features | Supercharts with 21 chart types, 400+ indicators and 110+ drawing tools; up to 16 charts per tab; Pine Script; Bar Replay with 9 speeds; six screeners; cloud alerts; paper trading |

## Strengths and weaknesses

Strengths:
- The best-liked charts in retail trading: fast, clean, any device ([features](https://www.tradingview.com/features/)).
- One account syncs layouts, drawings and alerts across web, desktop and phone ([features](https://www.tradingview.com/features/)).
- Pine Script with autocomplete, version control, a profiler and a strategy tester; a huge public script library.
- Bar Replay and paper trading let people practise without money ([features](https://www.tradingview.com/features/)).
- A clear plan ladder on one page: charts per tab go 1, 2, 4, 8, 16; indicators per chart 2, 5, 10, 25, 50; price alerts 3, 20, 100, 400, 1,000 ([pricing](https://www.tradingview.com/pricing/)).
- Huge reach: 4.8 stars from 420,687 ratings on the US App Store (checked 24 October 2026).

Weaknesses:
- Subscription and cancellation complaints, including an HN thread on its cancellation flow ([HN, 2024](https://news.ycombinator.com/item?id=41004113)).
- Support is hard to reach, per many recent App Store reviews.
- The free plan has ads and only 2 indicators per chart and 3 alerts.
- Strategy tester results are easy to overfit and the public script library shows winners with no correction for tries ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)).
- Real-time data is sold per exchange on top of the plan.

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the US App Store public review feed and Hacker News:
- Liked most: smooth, responsive charts; everything in one place; broker trading from the chart; the community.
- Complained about most: billing and cancelling; unreachable support; alerts and watchlists failing on the phone; ads on the free plan; data lag reports.

> "Great charts but prolly the worst customer service" (App Store review, 2026, [link](https://apps.apple.com/us/app/tradingview-track-all-markets/id1205990992))

> "It is a dark pattern if unsubscribing is more inconvenient than subscribing." (Hacker News comment, 2024, [link](https://news.ycombinator.com/item?id=41005434))

> "Alert Notification work 50% of the time." (App Store review, 2026, [link](https://apps.apple.com/us/app/tradingview-track-all-markets/id1205990992))

## UX notes

Layout and keys are already covered in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md); these notes add to it.

- **Layout**
  - Top toolbar, left drawing rail, right widget bar (watchlist, alerts, news), bottom panel for Pine editor, screener, strategy tester and trading. Up to 16 charts per tab on Ultimate.
- **Onboarding**
  - Opens straight onto a chart with no sign-in (**unverified** on an official page); sign-up is asked for when you save or set an alert. Free trial without a card ([pricing](https://www.tradingview.com/pricing/)).
- **Navigation**
  - Start typing anywhere to change symbol; Ctrl+K command search ([RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md)).
- **Density**
  - Medium. Clean by default, dense on demand.
- **Charting**
  - The reference. 21 chart types, multi-chart sync of symbol, interval and drawings.
- **Order entry**
  - Buy and Sell by the chart legend, full ticket in the account panel, draggable order lines.
- **Shortcuts**
  - Many and well documented; type an interval and press Enter; Alt+T, Alt+H, Alt+F for drawings.
- **Mobile**
  - Full charts, alerts and watchlists; iPad shows fewer products than desktop per one review.
- **Speed perception**
  - Charts feel instant. Complaints concern data lag and alerts, not drawing speed.
- **Trust signals**
  - Size and brand, broker partners, a public status page listing each service and past incidents ([status](https://status.tradingview.com/)); less trust around billing.

## What Parity should copy, avoid or beat

- **Copy:**
  - Trade: start on a working chart with no sign-in wall; ask for an account only to save ([DEC-0031](../decisions/0031-trade-charts-pro-charting-on-delayed-data.md)).
  - Trade: Bar Replay with a few fixed speeds and paper trading on the same chart ([DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)).
  - Trade: one-line limits that grow by plan, shown in a plain table ([DEC-0033](../decisions/0033-trade-trackers-watchlists-alerts-and-a-screener.md)).
  - Trade: the open-source Lightweight Charts library is a candidate engine (Apache 2.0, [GitHub](https://github.com/tradingview/lightweight-charts)).
- **Avoid:**
  - Urgency tricks and hard cancelling. One-click cancel, same as one-click subscribe.
  - Alerts that sometimes do not fire. An alert must log when it fired and when it was delivered.
- **Beat:**
  - Workbench: a strategy tester that counts how many settings were tried and shows a luck-adjusted result next to the raw one ([DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)).
  - Verify: a badge for a published Pine strategy's record, honest about tries.

## Sources

- [TradingView pricing](https://www.tradingview.com/pricing/), checked 24 October 2026
- [TradingView features](https://www.tradingview.com/features/), checked 24 October 2026
- [TradingView about](https://www.tradingview.com/about/), checked 24 October 2026
- [TradingView status](https://status.tradingview.com/), checked 24 October 2026
- [Lightweight Charts on GitHub](https://github.com/tradingview/lightweight-charts), checked 24 October 2026
- [TradingView, Wikipedia](https://en.wikipedia.org/wiki/TradingView), checked 24 October 2026
- [TradingView, US App Store listing](https://apps.apple.com/us/app/tradingview-track-all-markets/id1205990992), checked 24 October 2026
- [TradingView's emotional subscription cancellation, Hacker News thread](https://news.ycombinator.com/item?id=41004113), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
