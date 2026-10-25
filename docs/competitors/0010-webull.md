---
id: CMP-0010
title: Webull, a zero-commission broker with pro desktop tools and paper trading
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, crypto, open-source, strategy, ui]
related: [CMP-0001, RES-0021, DEC-0033, DEC-0034, DEC-0040, DEC-0043]
---

# Webull, a zero-commission broker with pro desktop tools and paper trading

## In plain words

Webull is a trading app that looks more like a trader's screen than Robinhood does: more charts, more numbers, more panels. You can practise with pretend money that never runs out, on the same screens you would use for real. It also has a free toolkit that lets programmers, and now AI assistants, place trades. Parity should learn from how Webull makes the practice account look different so nobody mixes it up with the real one.

## Summary

| | |
| --- | --- |
| What it is | A global online broker (Webull Corp, listed as BULL) with a mobile app, a desktop app, a web app and an open API |
| Who uses it | 28.2 million registered users and 5.13 million funded accounts; customer assets $28.5 billion (Q2 2026, [Webull 6-K](https://www.sec.gov/Archives/edgar/data/1866364/000121390026091702/ea030257601ex99-1.htm)) |
| Pricing | $0 commission on US stocks, ETFs and equity options; index options $0.50 per contract; futures from $0.25 per contract (App Store listing), $1.25 per stockbrokers.com; $75 outgoing transfer; no minimum. Webull Premium $3.99 a month or $40 a year per stockbrokers.com; the official page did not show a price (checked 24 October 2026) |
| Markets | US stocks, ETFs, options, futures, crypto (via Webull Pay), bonds and treasuries, event contracts; local markets in 18 countries |
| Platforms | Desktop (Windows, Mac, Linux Ubuntu), web, iOS, Android, Apple Watch, OpenAPI with SDKs, a CLI and an MCP server |
| Signature features | Unlimited paper trading with real-time data; widget layouts with link groups; TurboTrader and price ladder; order flow tools; chart replay; Level 2 (Nasdaq TotalView) with Premium |

## Strengths and weaknesses

Strengths:
- Paper trading is a first-class product: stocks, options, futures and crypto, unlimited virtual money, resets at any time, margin calls and liquidations simulated, and a distinct look so it cannot be confused with live ([paperTrade](https://www.webull.com/paper-trading)).
- Desktop layouts are built from widgets, can be preset or custom, and sync to the account when saved as custom ([layouts](https://www.webull.com/learn/2uYwVO/dwHBFK/What-is-a-layout)).
- Strong mobile app: stockbrokers.com gives it 4.5 of 5 for mobile, with 56 indicators and a replay mode ([stockbrokers.com](https://www.stockbrokers.com/review/webull)).
- Official open-source SDKs (Python, Java), a CLI, agent skills and an MCP server for its OpenAPI, all updated in October 2026 ([GitHub](https://github.com/webull-inc)).
- Runs on Linux as well as Windows and Mac ([desktop app](https://www.webull.com/trading-platforms/desktop-app)).

Weaknesses:
- Customer service ranked last of 11 brokers by stockbrokers.com (2026).
- Multi-leg options entry feels cumbersome compared with specialist platforms (stockbrokers.com).
- Education is scattered and confusing for beginners (stockbrokers.com).
- Fewer account types: no trust, custodial or inherited IRA accounts (stockbrokers.com).

## What users say

<!-- collector:start -->
<!-- collector:end -->

From our own reading (App Store listing, Hacker News, stockbrokers.com):
- Liked most: the mobile app; free options trades; the paper trading account; extended and overnight hours.
- Complained about most: customer service; busy screens for beginners; options strategy building; an education section that is hard to follow.
- The iPhone app rates 4.70 out of 5 from about 343,000 ratings ([App Store](https://apps.apple.com/us/app/id1179213067), checked 24 October 2026).

> "WeBull has the best mobile app hands down." (Hacker News comment, 2022, [link](https://news.ycombinator.com/item?id=30124430))

> "I use Fidelity and Webull. I have no strong preference." (Hacker News comment, 2022, [link](https://news.ycombinator.com/item?id=31175596))

## UX notes

- **Layout:** Preset and custom layouts made of widgets; widgets can overlap as tabs; numbered link groups keep panels on one symbol. See [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).
- **Onboarding:** The paper account uses the same interface as the active-trader layout, so practice transfers.
- **Navigation:** Layout menu with "All Layouts" and favourites; multi-screen support on desktop.
- **Density:** High. Many numbers per widget. Busier than Robinhood, lighter than thinkorswim.
- **Charting:** 52 desktop and 56 mobile indicators, 19 drawing tools (stockbrokers.com); an indicator editor; technical signals; chart replay.
- **Order entry:** Classic ticket, chart trading, price ladder and the TurboTrader panel; custom indicators can be tied to pre-filled orders that open from an alert.
- **Shortcuts:** Hotkeys on desktop, configurable ([hotkeys course](https://www.webull.com/learn/courseware/jMIB8w/How-to-Use-the-Hotkey-Function-on-Webull-Desktop-Platform)).
- **Mobile:** Full trading, Level 2, options chains, paper trading, and an AI summary of market movers.
- **Speed perception:** Real-time data even in paper mode; trading from Sunday 8 pm to Friday 8 pm ET makes the app feel always on.
- **Trust signals:** SEC and FINRA registration, SIPC, a listed parent with quarterly results. We found no current public status page (a webull.statuspage.io page exists but was last updated in 2022).

## What Parity should copy, avoid or beat

- **Copy:** Give demo accounts a clearly different look (colour band, label) from anything that could be real (Trade). [DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)
- **Copy:** Simulate margin calls and liquidations in practice, not just fills (Trade).
- **Copy:** Numbered link groups so two charts can follow different symbols on one screen (Trade, Terminal). [DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)
- **Copy:** An alert that opens a pre-filled order when tapped (Trade). [DEC-0033](../decisions/0033-trade-trackers-watchlists-alerts-and-a-screener.md)
- **Avoid:** Scattered education. Academy courses should be short and in one place.
- **Avoid:** Feature sprawl that leaves beginners on a busy first screen.
- **Beat:** Webull's MCP server lets AI agents trade, but nothing checks whether the agent's strategy is any good. Workbench and Verify can test and score a strategy before any order is placed. [DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)
- **Beat:** Chart replay without counting tries. Parity can show how many replays or settings were tried before the "good" one.

## Sources

- [Webull: Investing and Trading, App Store](https://apps.apple.com/us/app/id1179213067), checked 24 October 2026
- [Webull pricing](https://www.webull.com/pricing), checked 24 October 2026
- [Webull Premium](https://www.webull.com/premium), checked 24 October 2026 (prices not shown)
- [Webull desktop app](https://www.webull.com/trading-platforms/desktop-app), checked 24 October 2026
- [Webull paperTrade](https://www.webull.com/paper-trading), checked 24 October 2026
- [What is a layout, Webull Learn](https://www.webull.com/learn/2uYwVO/dwHBFK/What-is-a-layout), checked 24 October 2026
- [Webull hotkeys course](https://www.webull.com/learn/courseware/jMIB8w/How-to-Use-the-Hotkey-Function-on-Webull-Desktop-Platform), via RES-0021, 24 October 2026
- [Webull Q2 2026 results, Form 6-K exhibit 99.1](https://www.sec.gov/Archives/edgar/data/1866364/000121390026091702/ea030257601ex99-1.htm), checked 24 October 2026
- [Webull Corporation](https://www.webullcorp.com/), checked 24 October 2026
- [webull-inc on GitHub](https://github.com/webull-inc), checked 24 October 2026
- [Webull review, stockbrokers.com](https://www.stockbrokers.com/review/webull), checked 24 October 2026
- [Hacker News comment 30124430](https://news.ycombinator.com/item?id=30124430), checked 24 October 2026
- [Hacker News comment 31175596](https://news.ycombinator.com/item?id=31175596), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
