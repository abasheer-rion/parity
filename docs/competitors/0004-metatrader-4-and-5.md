---
id: CMP-0004
title: MetaTrader 4 and 5, the free broker platform most FX traders use
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, fx, strategy, ui]
related: [CMP-0001, RES-0020, RES-0021, DEC-0032, DEC-0043, DEC-0040]
---

# MetaTrader 4 and 5, the free broker platform most FX traders use

## In plain words

MetaTrader is the trading program most forex brokers hand to their customers for free. You chart prices, place trades, and can write or buy small robots that trade for you. There is a shop of robots and a list of traders you can copy, each showing how much money they made. Parity should learn from how easy it is to test a robot on old prices, and should do better at telling people whether those shiny results were just luck.

## Summary

| | |
| --- | --- |
| What it is | Desktop, web and mobile trading platforms made by MetaQuotes (founded 2000) and licensed to brokers; MT4 dates from 2005, MT5 from 2010 ([Wikipedia](https://en.wikipedia.org/wiki/MetaTrader_4)) |
| Who uses it | Retail FX and CFD traders and prop-firm traders. MetaQuotes says it partners with "nearly a thousand" financial institutions ([MetaQuotes](https://www.metaquotes.net/en/company)); its community site claims over 7,000,000 unique monthly visitors ([MetaTrader 5](https://www.metatrader5.com/en)). No trader count is published |
| Pricing | Free to download and use; the broker pays MetaQuotes (licence terms **unverified**). Extras: signal subscriptions set by providers (examples from $30 to $999 a month), Market apps from about $30 to $2,800, VPS $10 to $15 a month (checked 24 October 2026) |
| Markets | FX and CFDs on MT4; FX, stocks and futures on MT5, depending on the broker |
| Platforms | Windows, macOS, Linux, web terminal, iOS, Android, Huawei AppGallery |
| Signature features | Expert Advisors (robots) in MQL4 and MQL5; Strategy Tester with genetic optimisation and a cloud network; Signals copy trading; Market of apps; built-in VPS; an AI Assistant in MT5 (2026) |

## Strengths and weaknesses

Strengths:
- Free and everywhere: "Connect to hundreds of brokers" from one app ([App Store listing](https://apps.apple.com/us/app/metatrader-5/id413251709)).
- The MT5 Strategy Tester tests on every tick, 1 minute bars or open prices, optimises with a genetic algorithm, and offers forward testing ([Strategy Tester](https://www.metatrader5.com/en/automated-trading/strategy-tester)).
- The MQL5 Cloud Network rents out other users' computers so optimisations that would take months finish in hours ([Strategy Tester](https://www.metatrader5.com/en/automated-trading/strategy-tester)).
- MT5 numbers: 21 timeframes, 38 built-in indicators, 44 analytical objects, up to 100 charts open ([trading platform](https://www.metatrader5.com/en/trading-platform)).
- Very high phone ratings: MT4 4.8 stars from 81,652 ratings and MT5 4.8 from 85,727 on the US App Store (checked 24 October 2026).
- Fast-moving MT5: an AI Assistant that can prepare robots for testing, launch optimisations and read tester reports, across several LLM providers (builds 6140 to 6230, August to September 2026, [release notes](https://www.metatrader5.com/en/releasenotes)).

Weaknesses:
- The look has barely changed in twenty years. HN commenters say the industry resists change.
- Signals and Market show growth and drawdown but no luck or multiple-testing check; the page warns that past statistics guarantee nothing ([Signals](https://www.mql5.com/en/signals)).
- Platform risk: MT4 and MT5 left the Apple App Store from September 2022 to March 2023 ([Wikipedia](https://en.wikipedia.org/wiki/MetaTrader_4)). MetaQuotes pulling the platform from US prop firms in 2024 is **unverified** ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)).
- The broker owns the customer, so data, symbols and support vary by broker.
- MT4 robots (MQL4) do not run on MT5 (MQL5), which splits the ecosystem.

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the US App Store public review feeds and Hacker News:
- Liked most: simple to use on the phone; works with many brokers; robots and indicators; reliability over years of use.
- Complained about most: no price alerts in the MT5 phone app (the desktop has them); missing indicators; editing pending orders; many low-effort five-star reviews and a few that call the brokers behind it scams.

> "PLEASE add price alert option" (App Store review, 2026, [link](https://apps.apple.com/us/app/metatrader-5/id413251709))

> "The existing market does NOT like change." (Hacker News comment, 2020, [link](https://news.ycombinator.com/item?id=25253035))

## UX notes

- **Layout**
  - The usual desktop layout (**unverified** on an official page): Market Watch and Navigator on the left, tiled chart windows in the middle, a Toolbox along the bottom with trade, history, news and journal tabs. Matches the common pattern in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).
  - Profiles and templates save chart sets.
- **Onboarding**
  - A demo account is offered on first launch from a list of brokers; then you are on your own.
- **Navigation**
  - Menus and a Navigator tree; robots and indicators are dragged onto charts.
- **Density**
  - High and plain. Small grey toolbars, many tabs.
- **Charting**
  - Good enough for most FX traders, behind TradingView in looks and drawing tools.
- **Order entry**
  - A modal New Order window plus one-click trading from the chart. MT5 adds 6 pending order types and depth of market ([trading platform](https://www.metatrader5.com/en/trading-platform)).
- **Shortcuts**
  - Function keys for core windows (F9 new order, for example); customisable hotkeys (**unverified** full list).
- **Mobile**
  - Strong: up to four charts on iPad, trade levels on the chart, full order set ([App Store listing](https://apps.apple.com/us/app/metatrader-4/id496212596)).
- **Speed perception**
  - Lightweight native app; VPS sold on "0-5 ms latency" to broker servers ([VPS](https://www.mql5.com/en/vps)).
- **Trust signals**
  - Mostly borrowed from the broker. Every store listing opens with a risk warning that most retail accounts lose money.

## What Parity should copy, avoid or beat

- **Copy:**
  - Workbench: the three test modes (fast, balanced, exact) and forward testing on held-out data, shown as a simple choice in [DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md).
  - Trade: a demo account offered at the first screen, as in [DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md).
  - Workbench: an assistant that can set up and run a test, then explain the report.
- **Avoid:**
  - Showing growth since start as the headline number on a copy list.
  - A design frozen in time because the users are used to it.
- **Beat:**
  - Verify: MQL5 Signals and Market show a growth figure and drawdown, but not how many robots or settings were tried before this one. Verify can read an MT4 or MT5 statement and adjust it for luck and tries, which is the gap in [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md) and [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md).
  - Workbench: genetic optimisation finds the best settings fast but also overfits fast. Show the penalty for the number of combinations tried next to the result.

## Sources

- [MetaTrader 5 home](https://www.metatrader5.com/en), checked 24 October 2026
- [MetaTrader 5 trading platform](https://www.metatrader5.com/en/trading-platform), checked 24 October 2026
- [MetaTrader 5 Strategy Tester](https://www.metatrader5.com/en/automated-trading/strategy-tester), checked 24 October 2026
- [MetaTrader 5 release notes](https://www.metatrader5.com/en/releasenotes), checked 24 October 2026
- [MetaTrader 4 home](https://www.metatrader4.com/en), checked 24 October 2026
- [MetaQuotes company page](https://www.metaquotes.net/en/company), checked 24 October 2026
- [MQL5 Signals](https://www.mql5.com/en/signals), checked 24 October 2026
- [MQL5 Market](https://www.mql5.com/en/market), checked 24 October 2026
- [MetaTrader VPS](https://www.mql5.com/en/vps), checked 24 October 2026
- [MetaTrader 4, Wikipedia](https://en.wikipedia.org/wiki/MetaTrader_4), checked 24 October 2026
- [MetaTrader 4, US App Store listing](https://apps.apple.com/us/app/metatrader-4/id496212596), checked 24 October 2026
- [MetaTrader 5, US App Store listing](https://apps.apple.com/us/app/metatrader-5/id413251709), checked 24 October 2026
- [Hacker News comment on MetaTrader and change](https://news.ycombinator.com/item?id=25253035), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
