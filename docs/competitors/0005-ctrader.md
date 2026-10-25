---
id: CMP-0005
title: cTrader, a modern broker platform with copy, algos and a store
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, fx, strategy, ui]
related: [CMP-0001, RES-0020, RES-0021, DEC-0032, DEC-0040, DEC-0043]
---

# cTrader, a modern broker platform with copy, algos and a store

## In plain words

cTrader is a trading program that many forex brokers offer as a nicer-looking choice next to MetaTrader. It is free for traders. One login works across all brokers and devices, and your screen setup follows you. It also lets you copy other traders, build robots in C# or Python, buy robots in a shop, and now lets AI assistants place trades for you. Parity should learn from its saved workspaces and its replay mode, and should beat it on honest performance numbers.

## Summary

| | |
| --- | --- |
| What it is | A multi-asset trading platform made by Spotware Systems (Limassol, Cyprus) and licensed to brokers and prop firms; launched 2011 ([Wikipedia](https://en.wikipedia.org/wiki/CTrader)) |
| Who uses it | Retail FX and CFD traders at brokers such as IC Markets, Pepperstone, FxPro and many more ([App Store listing](https://apps.apple.com/us/app/ctrader-cfd-trading-charts/id767428811)). The Store says it reaches "millions of cTrader users" ([help](https://help.ctrader.com/ctrader-store/)); no exact count is published |
| Pricing | Free to traders; brokers pay Spotware (terms **unverified**). Store products are free or paid, with a 14-day money-back period; cTrader keeps 30% of paid sales ([Store help](https://help.ctrader.com/ctrader-store/)). Copy strategies charge performance, management or volume fees set by providers (checked 24 October 2026) |
| Markets | CFDs on FX, metals, energy, indices, stocks, ETFs and crypto, depending on the broker |
| Platforms | Windows, native Mac, web, iOS, Android, Huawei and Samsung stores; Open API, FIX API, a CLI and MCP servers |
| Signature features | cTrader ID with cloud workspaces; Trade, Copy, Algo and Analyze apps in one window; cBots in C# and Python with cloud running; Market Replay; Store; MCP servers for AI agents |

## Strengths and weaknesses

Strengths:
- One cTrader ID across brokers; workspaces save charts, Quick Trade settings, theme and layout and follow you between computers ([Workspace](https://help.ctrader.com/ctrader/)).
- Algo in C# and, since August 2025, Python ([Wikipedia](https://en.wikipedia.org/wiki/CTrader)); cBots can run in cTrader's cloud, "no VPS, no setup" ([ctrader.com](https://www.ctrader.com/)).
- Market Replay: pick a date, set a starting balance and speed, and practise trading on tick or 1 minute history with an equity chart and statistics ([Market Replay](https://help.ctrader.com/ctrader/)).
- Analyze app shows net profit, profit factor, win rate, max drawdown and a performance calendar for your own account ([Analyze](https://help.ctrader.com/ctrader-analyze/)).
- AI agent access: local and remote MCP servers connect cTrader to Claude Code, Codex, Cursor and others to trade and analyse ([MCP servers](https://help.ctrader.com/ctrader-ai-agent-connect/)).
- Open by default to developers: public samples, Open API and FIX libraries on GitHub ([Spotware GitHub](https://github.com/spotware)); a help centre that welcomes AI crawlers.

Weaknesses:
- CFD-only for most users; no exchange stocks or options.
- iPad performance complaints in recent App Store reviews.
- Store backtest numbers are entered by the seller from their own test; the page hides ROI if the system's monthly figure is under 7% ([Store help](https://help.ctrader.com/ctrader-store/)), which favours the best-looking tests.
- Copy ranking rewards recent ROI and profitable months; nothing adjusts for how many strategies were tried ([Copy help](https://help.ctrader.com/ctrader-copy/)).
- Spotware restricted US prop firms from offering cTrader in early 2026, per [Wikipedia](https://en.wikipedia.org/wiki/CTrader) (**unverified** on an official page).

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the US App Store public review feed (4.8 stars from 1,807 ratings, checked 24 October 2026) and Hacker News:
- Liked most: a cleaner interface than MT5; fast for scalping; the cBot tools; FIX access at any cTrader broker.
- Complained about most: iPad lag; percentage change not refreshing; clumsy symbol and timeframe switching on the phone; features on desktop missing from mobile.

> "even better than trading view in terms of UI/UX" (App Store review, 2026, [link](https://apps.apple.com/us/app/ctrader-cfd-trading-charts/id767428811))

> "Performance on Apple devices is abysmal." (App Store review, 2026, [link](https://apps.apple.com/us/app/ctrader-cfd-trading-charts/id767428811))

> "any broker that supports cTrader will have a FIX API" (Hacker News comment, 2020, [link](https://news.ycombinator.com/item?id=23209789))

## UX notes

- **Layout**
  - Main menu switches between Trade, Copy, Algo and Analyze. Trade has Market Watch on the left, charts in the middle, Trade Watch along the bottom and an Active Symbol Panel on the right for orders and depth ([Basics and layouts](https://help.ctrader.com/ctrader/)).
  - Three chart modes: Multi-chart, Single-chart (tabs) and Free-chart (resize each); charts can detach into their own windows.
- **Onboarding**
  - A hedging demo account is created at sign-up with virtual funds; a help centre with one-minute summaries at the top of each page.
- **Navigation**
  - Space opens smart chart search; Ctrl+Tab cycles charts; F7 and F8 move between workspaces.
- **Density**
  - Medium to high; dark theme; a status bar shows server and proxy latency.
- **Charting**
  - Linked charts, chartshots, a risk-reward tool, market sentiment.
- **Order entry**
  - Active Symbol Panel on the right, QuickTrade one-click mode, F9 for a new order, trading from the chart.
- **Shortcuts**
  - Every hotkey is remappable in settings. F2 chart mode, F3 layout, F11 full screen, Ctrl+W Trade Watch, Ctrl+E symbol panel, Ctrl+N new chart, Alt+1 to 4 chart types ([Hotkeys](https://help.ctrader.com/ctrader/)).
- **Mobile**
  - Full order types, alerts, statistics, and a new Signals app in version 5.11 ([App Store listing](https://apps.apple.com/us/app/ctrader-cfd-trading-charts/id767428811)).
- **Speed perception**
  - Latency shown on screen builds trust; iPad users report lag.
- **Trust signals**
  - Store sellers verified by Sumsub; a 14-day money-back period; copy pages show ROI, equity, drawdown and fees with a high-water mark.

## What Parity should copy, avoid or beat

- **Copy:**
  - Trade: named workspaces stored in the account, with F7 and F8 to flip between them, and remappable keys ([DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)).
  - Workbench: a replay mode with starting balance, speed and an equity chart, so people can practise on history ([DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)).
  - Trade: latency shown in the status bar, so speed is visible rather than claimed.
- **Avoid:**
  - Hiding weak results (the 7% monthly ROI rule) while showing strong ones. That is a selection effect.
  - Mobile that lags behind desktop features.
- **Beat:**
  - Verify: an independent check of a cTrader Copy strategy or a Store cBot's claimed backtest, with luck and number of tries counted ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md), [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)).

## Sources

- [cTrader home and Store](https://www.ctrader.com/), checked 24 October 2026
- [Spotware home](https://www.spotware.com/), checked 24 October 2026
- [cTrader Windows help (chart modes, layouts, workspace, hotkeys, Market Replay)](https://help.ctrader.com/ctrader/), checked 24 October 2026
- [cTrader Copy help](https://help.ctrader.com/ctrader-copy/), checked 24 October 2026
- [cTrader Store help](https://help.ctrader.com/ctrader-store/), checked 24 October 2026
- [cTrader Analyze help](https://help.ctrader.com/ctrader-analyze/), checked 24 October 2026
- [cTrader MCP servers help](https://help.ctrader.com/ctrader-ai-agent-connect/), checked 24 October 2026
- [cTrader Help Centre index for LLMs](https://help.ctrader.com/llms.txt), checked 24 October 2026
- [Spotware on GitHub](https://github.com/spotware), checked 24 October 2026
- [cTrader, Wikipedia](https://en.wikipedia.org/wiki/CTrader), checked 24 October 2026
- [cTrader, US App Store listing](https://apps.apple.com/us/app/ctrader-cfd-trading-charts/id767428811), checked 24 October 2026
- [Hacker News comment on cTrader and FIX](https://news.ycombinator.com/item?id=23209789), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
