---
id: CMP-0009
title: Robinhood, the simple trading app that added a pro desktop called Legend
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, crypto, ui]
related: [CMP-0001, RES-0021, RES-0020, DEC-0031, DEC-0034, DEC-0040, DEC-0042]
---

# Robinhood, the simple trading app that added a pro desktop called Legend

## In plain words

Robinhood is the phone app that made buying shares feel as easy as buying a song. Millions of young people use it. In 2024 it added Robinhood Legend, a big-screen version with charts and panels for people who trade a lot. Parity should learn from how calm and clear the phone app looks, and how Legend saves your layout on its own without a save button.

## Summary

| | |
| --- | --- |
| What it is | A US broker with one simple app for stocks, options, crypto, futures and prediction markets, plus Legend, a browser-based pro platform |
| Who uses it | 28.4 million funded customers and 4.84 million Gold subscribers (30 June 2026, Robinhood 10-Q via [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)) |
| Pricing | $0 commission on stocks, ETFs and options. Gold is $5 a month or $50 a year. Gold members pay $0.50 per futures contract and $0.35 per index options contract; stockbrokers.com lists $0.75 per futures contract without Gold. Crypto cost is in the spread, up to 0.95% per stockbrokers.com. $100 transfer-out fee (checked 24 October 2026) |
| Markets | US stocks, ETFs, options, index options, futures, 80+ crypto assets, prediction markets (event contracts), IRAs, managed portfolios |
| Platforms | iOS, Android, web, Robinhood Legend (in the browser, opened from a desktop link). No public trading API for stocks **unverified** |
| Signature features | One-screen phone trading; Legend widgets with up to 9 layouts; trading on the chart with draggable order pills; Gold perks (3.6% cash yield, IRA match); Cortex AI summaries; prediction markets hub |

## Strengths and weaknesses

Strengths:
- Very easy to start: no minimum deposit, clean screens, one app for many markets ([App Store listing](https://apps.apple.com/us/app/id938003185)).
- Legend saves every layout change automatically and offers preset templates ([Layouts on Legend](https://robinhood.com/us/en/support/articles/layouts-on-legend/)).
- Order entry from almost anywhere in Legend: chart, watchlist, positions, scanner, ladder, options chain ([Trading with Legend](https://robinhood.com/us/en/support/articles/trading-with-robinhood-legend/)).
- Hotkeys follow the common pattern (Shift+B, Shift+S) and an "Auto-send" switch makes the risk explicit.
- Strong mobile options view with live profit and loss charts for spreads, per stockbrokers.com.

Weaknesses:
- No paper trading at all, per stockbrokers.com. New users learn with real money.
- Thin research on the website: no economic calendar, a limited screener ([stockbrokers.com](https://www.stockbrokers.com/review/robinhood)).
- Legend charts have 90 indicators and 26 drawing tools, with no custom studies and no backtesting (stockbrokers.com).
- No short selling and no OCO or OTO orders, per stockbrokers.com.
- Rated 3.5 of 5 overall and 2.5 of 5 for research by stockbrokers.com (1 October 2026).
- The January 2021 limits on GameStop buying still come up when users discuss trust ([Hacker News](https://news.ycombinator.com/item?id=31210462)); we did not research this further.

## What users say

<!-- collector:start -->
Our feedback collector ([CMP-0001](0001-ux-patterns-users-praise-most.md#how-we-count)), pass of 2026-10-25: **111 public items** that name Robinhood (Hacker News 111).

| | Count |
| --- | --- |
| Praise | 27 |
| Complaints | 22 |
| Neither | 62 |
| Praise share | 55% |

- Most praised themes: Fees and pricing (6), Mobile app (4), Market data and quotes (3).
- Most complained-about themes: Deposits and withdrawals (10), Trust and safety (6), Crashes and bugs (3).
- US App Store, app 938003185: 4.30 stars from 4,892,125 ratings.
<!-- collector:end -->

From our own reading (App Store listing, Hacker News, stockbrokers.com):
- Liked most: simplicity and speed of the phone app; no commissions; crypto and stocks in one place; Gold's cash yield.
- Complained about most: missing tools for serious traders (now partly answered by Legend); thin research; no practice mode; past trading halts.
- The iPhone app rates 4.30 out of 5 from about 4.89 million ratings, lower than Webull (4.70) and thinkorswim (4.74) ([App Store](https://apps.apple.com/us/app/id938003185), checked 24 October 2026).

> "In fairness to Robinhood, they did just release a desktop version" (Hacker News comment, 2024, [link](https://news.ycombinator.com/item?id=42377954))

> "WeBull has the best mobile app hands down. Robinhood is the 'simplest'" (Hacker News comment, 2022, [link](https://news.ycombinator.com/item?id=30124430))

## UX notes

- **Layout:** Phone and web: one big price chart, a buy button, and little else. Legend: a canvas of widgets (chart, watchlist, positions, orders, scanner, ladder, options chain, news) in up to 9 layout tabs. See [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).
- **Onboarding:** Account opening happens inside the app. Legend starts from preset templates "optimized for different trading styles".
- **Navigation:** Phone: bottom tab bar. Legend: layout tabs along the top; right click a tab to open it in a new browser tab for a second monitor.
- **Density:** Phone app is sparse, with large type and lots of white space. Legend is dense but uses the same calm colours and type.
- **Charting:** Legend: real-time charts with sub-second updates, 90 indicators, 26 drawing tools, custom intervals. Phone: a simple price chart on each stock page.
- **Order entry:** Buy and Sell icons on the chart, a "+" on the price axis for limit and stop orders, draggable order pills, right click menus, and a hover "Trade" button on table rows.
- **Shortcuts:** Shift+B and Shift+S market orders, Shift+Alt+B and Shift+Alt+S limit at ask or bid, plus layout switching and flattening. With Auto-send on, orders skip the confirmation.
- **Mobile:** The core product. Big numbers, one action per screen, colour shows gain or loss at a glance.
- **Speed perception:** Animations and instant feedback make it feel fast; Legend advertises sub-second chart updates.
- **Trust signals:** Brand familiarity, SIPC notes, a public status page ([status.robinhood.com](https://status.robinhood.com)), disclaimers such as "Preset order details are not a trading recommendation."

## What Parity should copy, avoid or beat

- **Copy:** Autosave the working layout with no save button, and keep named layouts on top (Trade). [DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)
- **Copy:** Draggable order pills on the chart to change a price (Trade). [DEC-0031](../decisions/0031-trade-charts-pro-charting-on-delayed-data.md)
- **Copy:** Calm, plain first screens with one obvious action; it makes short courses less scary too (Academy). [DEC-0042](../decisions/0042-parity-academy-a-full-screen-course-player-of-its-own.md)
- **Copy:** An explicit "send without confirming" switch for hotkeys, off by default (Trade).
- **Avoid:** Game-like rewards (confetti, streaks) on screens that move real or practice money.
- **Avoid:** Different feature sets on phone and desktop that confuse users about what exists where.
- **Beat:** Robinhood has no practice mode. Parity demo accounts give a free, honest place to learn (Trade). [DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)
- **Beat:** No custom studies or backtests in Legend. Workbench can let users test a rule and see how much of the result is luck.

## Sources

- [Robinhood: Trading and Investing, App Store](https://apps.apple.com/us/app/id938003185), checked 24 October 2026
- [Robinhood Legend](https://robinhood.com/us/en/legend/), checked 24 October 2026
- [Layouts on Legend](https://robinhood.com/us/en/support/articles/layouts-on-legend/), checked 24 October 2026
- [Trading with Robinhood Legend](https://robinhood.com/us/en/support/articles/trading-with-robinhood-legend/), checked 24 October 2026
- [Widget linking on Legend](https://robinhood.com/us/en/support/articles/widget-linking-on-legend/), via RES-0021, 24 October 2026
- [Robinhood Gold](https://robinhood.com/us/en/gold/), checked 24 October 2026
- [Robinhood review, stockbrokers.com](https://www.stockbrokers.com/review/robinhood), checked 24 October 2026
- [Robinhood Form 10-Q, Q2 2026](https://www.sec.gov/Archives/edgar/data/1783879/000178387926000114/hood-20260630.htm), via RES-0020, 23 October 2026
- [Robinhood status page](https://status.robinhood.com), checked 24 October 2026
- [Robinhood fee schedule](https://robinhood.com/us/en/support/articles/robinhood-fee-schedule/), returned 404 on 24 October 2026
- [Hacker News comment 42377954](https://news.ycombinator.com/item?id=42377954), checked 24 October 2026
- [Hacker News comment 31210462](https://news.ycombinator.com/item?id=31210462), checked 24 October 2026
- [Hacker News comment 30124430](https://news.ycombinator.com/item?id=30124430), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
