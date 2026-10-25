---
id: CMP-0008
title: thinkorswim, Schwab's dense pro trading platform for options and futures traders
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, strategy, ui]
related: [CMP-0001, RES-0020, RES-0021, DEC-0031, DEC-0033, DEC-0034, DEC-0040, DEC-0043]
---

# thinkorswim, Schwab's dense pro trading platform for options and futures traders

## In plain words

thinkorswim is the trading program that Charles Schwab gives its customers for free. It is packed with charts, scanners and options tools, and it lets you practise with pretend money first. Serious hobby traders love it because almost everything can be changed and saved. Parity should learn from how it lets people save a whole screen layout and share it with one link.

## Summary

| | |
| --- | --- |
| What it is | Schwab's free advanced trading platform (desktop, web and mobile), inherited from TD Ameritrade |
| Who uses it | Schwab reports 39.8 million active brokerage accounts (30 June 2026, Schwab 10-Q via [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)); how many use thinkorswim is not stated. The iPhone app has about 325,000 ratings |
| Pricing | Platform free. $0 online stock and ETF trades, $0.65 per options contract, $2.25 per futures contract, forex paid through the spread (stockbrokers.com, checked 24 October 2026; schwab.com refused our request, so these are **unverified** against Schwab's own page) |
| Markets | US stocks, ETFs, options, futures, futures options, forex, bonds (bonds via Schwab). No direct crypto for retail customers (stockbrokers.com) |
| Platforms | Desktop (Windows, Mac), web, iOS, Android; a Schwab developer API exists but developer.schwab.com refused us, so its terms are **unverified** |
| Signature features | paperMoney practice trading; Active Trader ladder; Analyze tab with risk profile and probability analysis; thinkScript custom studies, scans and strategies; thinkBack options backtesting; shareable flexible chart grids |

## Strengths and weaknesses

Strengths:
- Depth: stockbrokers.com counts 374 chart studies and names Schwab first for advanced trading and mobile apps in its 2026 review ([stockbrokers.com](https://www.stockbrokers.com/review/charlesschwab)).
- Options analysis is built in: a risk profile chart, a probability cone at one standard deviation, earnings move analysis and a stress test ([Analyze](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Analyze)).
- Users can program their own tools in thinkScript: studies, backtest strategies, watchlist columns, alerts, conditional orders and scans ([thinkScript](https://toslc.thinkorswim.com/center/reference/thinkScript)).
- Layouts can be saved and shared as a link; another user opens it with "Open shared item" ([Flexible Grid](https://toslc.thinkorswim.com/center/howToTos/thinkManual/charts/Flexible-Grid)).
- paperMoney gives a full practice account with real market data, also in the phone app ([App Store listing](https://apps.apple.com/us/app/id299366785)).
- Six ready-made workspaces (default, futures, active trader, long term, forex, options) so new users do not start from a blank screen ([Workspaces](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Getting-Started/Workspaces)).

Weaknesses:
- The desktop app is heavy. Users on Hacker News report high memory use and battery drain (see below).
- Steep learning curve. Stockbrokers.com notes the education assumes you already know the basics.
- Trading hotkeys are off by default and must be switched on in settings ([shortcuts](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Getting-Started/Keyboard-Shortcuts)).
- Margin is expensive for small balances (11.825% under $25,000, per stockbrokers.com).
- Strategy backtests in thinkScript show results with no correction for how many versions were tried; the docs mention none. **Unverified** beyond the docs.

## What users say

<!-- collector:start -->
Our feedback collector ([CMP-0001](0001-ux-patterns-users-praise-most.md#how-we-count)), pass of 2026-10-25: **29 public items** that name thinkorswim (Hacker News 25, Stack Exchange 4).

| | Count |
| --- | --- |
| Praise | 8 |
| Complaints | 6 |
| Neither | 15 |
| Praise share | 57% |

- Most praised themes: Charts and indicators (3), Customisation and shortcuts (2), Fees and pricing (2).
- Most complained-about themes: Mobile app (3), Outages and downtime (1), Community and copy trading (1).
- US App Store, app 299366785: 4.74 stars from 325,316 ratings.
<!-- collector:end -->

From our own reading (App Store listing, Hacker News, stockbrokers.com):
- Liked most: how much it can do for free; the options layout (Greeks, premium and charts on one screen); paperMoney for practice; deep customisation.
- Complained about most: memory use and slowness on desktop; a cluttered first screen; paper results that did not carry over to real money; options entry is hard to learn.
- The iPhone app rates 4.74 out of 5 from about 325,000 ratings ([App Store](https://apps.apple.com/us/app/id299366785), checked 24 October 2026).

> "No one else has figured out how to lay out options" (Hacker News comment, 2022, [link](https://news.ycombinator.com/item?id=31239500))

> "Even on my desktop it will routinely use 5gb+ RAM alone." (Hacker News comment, 2023, [link](https://news.ycombinator.com/item?id=36349070))

> "I was doubling and tripling my money effortlessly" in paper trading, then not live (Hacker News comment, 2025, [link](https://news.ycombinator.com/item?id=46156161))

## UX notes

- **Layout:** A left sidebar of small gadgets (balances, watchlist, live news, trade flash) and a main area with eight tabs: Monitor, Trade, Analyze, Scan, MarketWatch, Charts, Tools, plus Home. Chart grids go up to 32 cells in a fixed grid, or as many as fit in the flexible grid. See [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).
- **Onboarding:** You pick one of six preset workspaces, then customise. A setup wizard and a Learning Center with a manual and videos. Assumes prior knowledge.
- **Navigation:** Ctrl+1 to Ctrl+7 jump between the main tabs; Ctrl+H for home; Ctrl+Tab cycles subtabs.
- **Density:** Very high. Users describe it as a high information density UI built for day traders ([Hacker News](https://news.ycombinator.com/item?id=43928048)). It assumes you know what each number means.
- **Charting:** 374 studies (stockbrokers.com), drawings that sync between desktop, web and phone, company and economic events on the chart, custom studies in thinkScript.
- **Order entry:** Several tickets: All Products, Active Trader ladder (click a price to place an order), Forex Trader, Futures Trader, Pairs Trader. Order templates and conditional orders.
- **Shortcuts:** Alt+B buy at market, Alt+S sell at market, Alt+F flatten, Alt+R reverse, all off by default.
- **Mobile:** Full trading, multi-touch charts with hundreds of studies, paperMoney, live chat with screen sharing, Schwab Network and CNBC streams.
- **Speed perception:** Users report heavy memory use on desktop (quotes above). We did not measure start-up time.
- **Trust signals:** Schwab brand, SIPC, long risk disclosures on every Learning Center page, live chat with trading specialists.

## What Parity should copy, avoid or beat

- **Copy:** Share a layout as a link that another user can open in one step (Trade, Terminal). [DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)
- **Copy:** A small set of preset workspaces by trading style before the blank canvas (Trade). [DEC-0031](../decisions/0031-trade-charts-pro-charting-on-delayed-data.md)
- **Copy:** The risk profile chart (profit and loss across prices, today and at expiry) as a what-if view (Workbench). [DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)
- **Copy:** Custom watchlist columns and alert conditions written as simple rules (Trade). [DEC-0033](../decisions/0033-trade-trackers-watchlists-alerts-and-a-screener.md)
- **Avoid:** A heavy desktop install. Parity runs in the browser and should stay light.
- **Avoid:** Hiding trading hotkeys behind settings without saying they exist; show them in the key sheet.
- **Beat:** paperMoney results that feel too good. Parity's demo accounts should show fees, slippage and a forward test, and say plainly how far paper results are from live ones (Trade, Verify). [DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)
- **Beat:** thinkScript backtests count no tries. Workbench and Verify should show the number of variants tried and a luck-adjusted result.

## Sources

- [Charles Schwab review, stockbrokers.com](https://www.stockbrokers.com/review/charlesschwab), checked 24 October 2026
- [thinkorswim: Trade. Invest., App Store](https://apps.apple.com/us/app/id299366785), checked 24 October 2026
- [thinkorswim Keyboard Shortcuts](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Getting-Started/Keyboard-Shortcuts), checked 24 October 2026
- [thinkorswim Getting Started](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Getting-Started), checked 24 October 2026
- [thinkorswim Workspaces](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Getting-Started/Workspaces), checked 24 October 2026
- [thinkorswim Trade tab](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Trade), checked 24 October 2026
- [thinkorswim Analyze tab](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Analyze), checked 24 October 2026
- [thinkorswim Flexible Grid](https://toslc.thinkorswim.com/center/howToTos/thinkManual/charts/Flexible-Grid), checked 24 October 2026
- [thinkScript reference](https://toslc.thinkorswim.com/center/reference/thinkScript), checked 24 October 2026
- [thinkorswim Tools tab](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Tools), checked 24 October 2026
- [Schwab thinkorswim page](https://www.schwab.com/trading/thinkorswim), refused our request on 24 October 2026
- [Schwab pricing](https://www.schwab.com/pricing), refused our request on 24 October 2026
- [Hacker News comment 31239500](https://news.ycombinator.com/item?id=31239500), checked 24 October 2026
- [Hacker News comment 36349070](https://news.ycombinator.com/item?id=36349070), checked 24 October 2026
- [Hacker News comment 43928048](https://news.ycombinator.com/item?id=43928048), checked 24 October 2026
- [Hacker News comment 46156161](https://news.ycombinator.com/item?id=46156161), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
