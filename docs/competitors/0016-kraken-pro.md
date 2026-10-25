---
id: CMP-0016
title: Kraken Pro, a customisable crypto trading app with a native desktop
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, crypto, ui]
related: [CMP-0001, RES-0021, DEC-0040, DEC-0041, DEC-0033]
---

# Kraken Pro, a customisable crypto trading app with a native desktop

## In plain words

Kraken is one of the oldest crypto exchanges, and Kraken Pro is its app for active traders. You build your own screen from small boxes (charts, order book, trades, positions) and save several screens. There is also a fast desktop program written for Mac, Windows and Linux. Parity should learn from its widget dashboards and from the anger when a phone redesign took away what traders relied on.

## Summary

| | |
| --- | --- |
| What it is | The trading app of Kraken (Payward, Inc.): spot, margin, perps and futures, staking, on web, phone and a native desktop app ([Kraken Pro](https://www.kraken.com/pro)) |
| Who uses it | Active crypto traders. Kraken says it is "trusted by 13+ million people" ([About](https://www.kraken.com/about)); no separate Pro count |
| Pricing | Spot from 0.40% maker and 0.80% taker at the lowest tier to 0% and 0.05% at the top; stablecoin and FX pairs 0.20% at base; futures 0.02% maker and 0.05% taker at base; margin opening and rollover 0.01% to 0.04% per 4 hours; the simple Kraken app charges 1% plus a spread ([fee schedule](https://www.kraken.com/features/fee-schedule), checked 24 October 2026) |
| Markets | Crypto spot, margin, perpetuals and futures (where allowed), stablecoins and fiat pairs, tokenised stocks in some regions; 400+ assets on Pro |
| Platforms | Web (pro.kraken.com), iOS, Android, desktop app for Mac, Windows and Linux, REST and WebSocket APIs, an official CLI |
| Signature features | 25+ widgets and saved dashboards; compare up to 4 markets; drag orders on the chart; Rust desktop app with multi-window and a ladder module; dashboard gallery to share layouts |

## Strengths and weaknesses

Strengths:
- Layout freedom: pick from layouts or build dashboards from 25+ widgets and save several ([Kraken Pro](https://www.kraken.com/pro)).
- Native desktop app built in Rust: multiple windows across monitors, a ladder that joins book, time and sales and click-to-trade, 30+ indicators, and a gallery of shared dashboards ([desktop](https://www.kraken.com/desktop)).
- Lower fees than the simple app. One third-party test posted on Hacker News found the simple app far dearer than Pro for the same buy ([HN, 2025](https://news.ycombinator.com/item?id=46057464)).
- Trust work: proof of reserves with a Merkle check users can run on their own balance; reserve ratios of 100.3% to 105%+ at 30 June 2026 ([proof of reserves](https://www.kraken.com/proof-of-reserves)).
- Open tooling: an official CLI and API clients on GitHub ([krakenfx](https://github.com/krakenfx)).

Weaknesses:
- High spot fees at the lowest tier (0.80% taker) next to Binance or Hyperliquid ([fee schedule](https://www.kraken.com/features/fee-schedule)).
- Margin rollover fees every 4 hours surprise users; a reviewer says the app did not show them.
- 2026 mobile redesigns drew many one-star reviews: less on screen, harder to scan charts, removed sorting on favourites.
- Withdrawal holds after deposits and AI-first support are common complaints.
- The simple app and Pro charge very differently for the same trade, which can feel like a trap.

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the public App Store review feed for Kraken Pro (4.71 stars from 25,681 US ratings, checked 24 October 2026). Of the 100 most recent US reviews, 58 were five stars and 28 one star; many one-star reviews since July 2026 are about app updates.
- Liked most: a clean, easy interface; low trade costs on Pro; easy limit orders; a sense that Kraken is the safer exchange.
- Complained about most: updates that waste screen space or split chart and order entry; lost stop-loss entry for a time; chart data lagging the order book; hidden margin costs; withdrawal holds.

> "Last update again made the UI worse, a waste of screen space" (App Store review, US, 2026, [link](https://apps.apple.com/us/app/id1473024338))

> "UI is good, charting not so good" (App Store review, US, 2026, [link](https://apps.apple.com/us/app/id1473024338))

> "Kraken pro doesn't show the rollover fees" (App Store review, US, 2026, [link](https://apps.apple.com/us/app/id1473024338))

## UX notes

- **Layout**: preset layouts plus fully custom dashboards from widgets; several saved. On desktop, windows can be mixed across screens ([Kraken Pro](https://www.kraken.com/pro), [desktop](https://www.kraken.com/desktop)). See [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md) for how others do it.
- **Onboarding**: same Kraken account as the simple app; Pro is a separate app and site. Higher verification levels open more products.
- **Navigation**: a market picker and dashboards as tabs (**unverified** labels).
- **Density**: high and user-controlled on web and desktop. Reviewers say the phone app shows less after 2026 updates.
- **Charting**: full charting with indicators, compare up to 4 markets, orders drawn on the chart and dragged to change them ([Kraken Pro](https://www.kraken.com/pro)). TradingView is named as a resource; whether the main chart uses it is **unverified**.
- **Order entry**: stop loss, take profit, IOC, reduce-only and trigger options ([Kraken Pro](https://www.kraken.com/pro)); a ladder for click trading on desktop. Trailing stops exist on mobile per a reviewer.
- **Shortcuts**: not listed on the desktop page. **Unverified**.
- **Mobile**: separate Kraken Pro app; widgets and multi-chart scanning were cut back in 2026 updates according to reviews.
- **Speed perception**: the desktop app pitches Rust and a native UI over web iframes for low latency ([desktop](https://www.kraken.com/desktop)). Some phone reviewers report lag after updates.
- **Trust signals**: proof of reserves, public status page with incident history, 14+ years of operation ([About](https://www.kraken.com/about)).

## What Parity should copy, avoid or beat

- **Copy:** dashboards built from widgets, saved by name, plus a gallery where users share layouts. Fits Trade and Terminal ([DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)).
- **Copy:** a ladder panel that joins book, recent trades and click-to-trade for Trade's order entry.
- **Copy:** the multi-window desktop idea for Parity's desktop app ([DEC-0041](../decisions/0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md)).
- **Avoid:** cutting density on mobile in a redesign. Keep a dense mode and keep user sort orders on watchlists ([DEC-0033](../decisions/0033-trade-trackers-watchlists-alerts-and-a-screener.md)).
- **Avoid:** costs that are not shown before an order is placed. Paper trading should show all costs, including financing.
- **Beat:** show every fee, spread and financing cost inline in the ticket and in the fills list. Kraken's two apps and two price levels confuse users.

## Sources

- [Kraken Pro](https://www.kraken.com/pro), checked 24 October 2026
- [Kraken fee schedule](https://www.kraken.com/features/fee-schedule), checked 24 October 2026
- [Kraken desktop app](https://www.kraken.com/desktop), checked 24 October 2026
- [Kraken About](https://www.kraken.com/about), checked 24 October 2026
- [Kraken proof of reserves](https://www.kraken.com/proof-of-reserves), checked 24 October 2026
- [krakenfx on GitHub](https://github.com/krakenfx), checked 24 October 2026
- [Kraken Pro app on the US App Store](https://apps.apple.com/us/app/id1473024338), checked 24 October 2026
- [Kraken status](https://status.kraken.com), checked 24 October 2026
- [Hacker News comment on Kraken app and Pro pricing](https://news.ycombinator.com/item?id=46057464), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
