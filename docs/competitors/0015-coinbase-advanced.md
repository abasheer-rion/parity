---
id: CMP-0015
title: Coinbase Advanced, the pro trading screen inside Coinbase
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, crypto, ui]
related: [CMP-0001, RES-0021, DEC-0040, DEC-0031, DEC-0024]
---

# Coinbase Advanced, the pro trading screen inside Coinbase

## In plain words

Coinbase is the best-known place in the US to buy crypto. Coinbase Advanced is its trading screen for people who want charts, an order book and more order types than the simple buy button. Since 2026 the same screen and API also trade US stocks and, outside the US, a wide set of perpetual futures. Parity should learn how Coinbase keeps one account and one login while giving beginners a simple view and traders a dense one.

## Summary

| | |
| --- | --- |
| What it is | The advanced trading mode of the Coinbase app and website: order book, charts, spot crypto, US futures, US equities (since July 2026) and international perpetuals (since October 2026 on a Deribit-powered gateway) ([API changelog](https://docs.cdp.coinbase.com/coinbase-app/introduction/changelog)) |
| Who uses it | Coinbase customers who trade actively. Coinbase reports $246 billion of assets on platform at 30 June 2026 and a 10.3% share of crypto trading volume ([investor site](https://investor.coinbase.com/home/default.aspx)). No separate Advanced user count |
| Pricing | Maker and taker fees by 30 day volume. coinbase.com refused our requests (HTTP 403), so today's table is **unverified**. The last schedule we know started at 0.40% maker and 0.60% taker below $10,000 a month, falling to 0% maker and 0.05% taker at the top. Coinbase One subscribers get some fee-free trading (terms **unverified**). Checked 24 October 2026 |
| Markets | Crypto spot, US-regulated crypto futures, US equities, international perpetuals (125+ contracts incl. equity and commodity perps, up to 50x, outside the US) ([derivatives guide](https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/guides/derivatives/overview)) |
| Platforms | Web, inside the Coinbase iOS and Android app, Advanced Trade REST and WebSocket API, official Python SDK |
| Signature features | Bracket, TWAP, scaled and stop-limit orders; smart order routing type in the API; one account across simple and advanced views; equities and derivatives in the same API |

## Strengths and weaknesses

Strengths:
- Brand trust and US regulation. A public company that reports assets on platform each quarter ([investor site](https://investor.coinbase.com/home/default.aspx)).
- Real order types: limit (GTC, GTD, FOK), market (IOC, FOK), stop-limit, bracket and trigger bracket, TWAP, scaled ([create order API](https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/orders/create-order)). A Kraken Pro reviewer singles out its bracket order.
- One account, two levels: users switch from the simple app to the advanced screen without a new sign-up.
- Moving fast in 2026: equities in July, international perps through Deribit in October, scaled orders in 2025 ([API changelog](https://docs.cdp.coinbase.com/coinbase-app/introduction/changelog)).
- Good developer surface: REST, WebSocket, an AsyncAPI spec, and a Python SDK ([coinbase-advanced-py](https://github.com/coinbase/coinbase-advanced-py)).

Weaknesses:
- Fees at small volume are high next to Binance, Kraken Pro or Hyperliquid (if the schedule above still holds, **unverified**).
- Perps and high leverage are only for non-US users; US users get dated and perpetual-style futures through a separate US exchange (**unverified** detail).
- The international derivatives move changed protocol (JSON-RPC instead of REST) and order model, so API users had to rebuild ([derivatives guide](https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/guides/derivatives/overview)).
- App reviewers complain about account restrictions, slow identity checks and forced updates.
- Coinbase's public site blocks automated reading, which also makes it hard for tools like ours to compare.

## What users say

<!-- collector:start -->
Our feedback collector ([CMP-0001](0001-ux-patterns-users-praise-most.md#how-we-count)), pass of 2026-10-25: **92 public items** that name Coinbase Advanced (GitHub issues 47, Hacker News 45).

| | Count |
| --- | --- |
| Praise | 8 |
| Complaints | 34 |
| Neither | 50 |
| Praise share | 19% |

- Most praised themes: Deposits and withdrawals (1), Trust and safety (1), Fees and pricing (1).
- Most complained-about themes: Crashes and bugs (20), API and automation (15), Market data and quotes (6).
- US App Store, app 886427730: 4.68 stars from 1,797,988 ratings.
- 25 status page incidents in the last 90 days.
- 9 releases or changelog entries in the last 90 days.
<!-- collector:end -->

From the public App Store review feed for the main Coinbase app (4.68 stars from about 1.8 million US ratings, checked 24 October 2026). Advanced lives inside that app, so most reviews are about Coinbase in general. Of the 100 most recent US reviews, 54 were five stars and 39 one star.
- Liked most: easy to use and safe-feeling; good for a first crypto purchase; transfers to wallets without bank blocks.
- Complained about most: accounts frozen or limited for weeks; support that feels like bots; a portfolio graph and balances that lag or vanish after updates; an update prompt that interrupted a live trade.

> "Portfolio Overview is useless. Why have you removed the cash balances?" (App Store review, US, 2026, [link](https://apps.apple.com/us/app/id886427730))

> "have a simple bracket order like coinbase advanced" (Kraken Pro App Store review, US, 2026, [link](https://apps.apple.com/us/app/id1473024338))

## UX notes

- **Layout**: classic exchange screen: markets list, chart in the middle, order book and trades beside it, order form on the right, open orders and fills below. Detail of today's layout is **unverified** because the product page refused us. See [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md) for the common pattern.
- **Onboarding**: no separate sign-up. Users already verified on Coinbase open the advanced view from the trade screen.
- **Navigation**: switching between simple and advanced is a toggle in the app (**unverified** current label).
- **Density**: medium. Fewer panels than Binance or Kraken Pro.
- **Charting**: TradingView-based charts with drawing tools (**unverified** today).
- **Order entry**: bracket orders attach a take profit and stop loss in one ticket; TWAP and scaled orders split size over time or price ([create order API](https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/orders/create-order)).
- **Shortcuts**: none documented that we could reach.
- **Mobile**: Advanced is a mode inside the main app, not a second app. Reviewers note forced updates during trades.
- **Speed perception**: WebSocket feeds; one Hacker News user saw the site return errors while WebSocket data kept flowing ([HN, 2025](https://news.ycombinator.com/item?id=46158625)).
- **Trust signals**: public company filings, status pages for the app and the exchange, quarterly assets on platform.

## What Parity should copy, avoid or beat

- **Copy:** one account and one login, with a simple view and an advanced view of the same data. Fits Trade and Terminal ([DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md), [DEC-0024](../decisions/0024-parity-terminal-a-market-terminal-of-its-own-at-the-sim-address.md)).
- **Copy:** bracket, TWAP and scaled orders as paper-trading order types in Trade.
- **Copy:** a dated, public changelog for each product, like Coinbase's developer changelog. Applies to every Parity app.
- **Avoid:** forcing an app update in the middle of an open position. Trade should never block the screen while orders are live.
- **Avoid:** removing balances or summary numbers in a redesign without warning.
- **Beat:** Coinbase gives no help judging whether a trader or a strategy is any good. Verify and Workbench can sit next to a Coinbase account as the honest scorer ([DEC-0031](../decisions/0031-trade-charts-pro-charting-on-delayed-data.md) for charts).

## Sources

- [Coinbase App API changelog](https://docs.cdp.coinbase.com/coinbase-app/introduction/changelog), checked 24 October 2026
- [Global Derivatives overview (Advanced Trade)](https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/guides/derivatives/overview), checked 24 October 2026
- [Advanced Trade API: create order](https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/orders/create-order), checked 24 October 2026
- [Coinbase Derivatives changelog](https://docs.cdp.coinbase.com/derivatives/changes/changelog), checked 24 October 2026
- [Coinbase investor relations](https://investor.coinbase.com/home/default.aspx), checked 24 October 2026
- [Coinbase Advanced fees](https://www.coinbase.com/advanced-fees), refused (HTTP 403) on 24 October 2026
- [Coinbase Advanced product page](https://www.coinbase.com/advanced-trade), refused (HTTP 403) on 24 October 2026
- [coinbase-advanced-py on GitHub](https://github.com/coinbase/coinbase-advanced-py), checked 24 October 2026
- [Coinbase app on the US App Store](https://apps.apple.com/us/app/id886427730), checked 24 October 2026
- [Kraken Pro app on the US App Store](https://apps.apple.com/us/app/id1473024338), checked 24 October 2026
- [Coinbase status](https://status.coinbase.com) and [Coinbase Exchange status](https://status.exchange.coinbase.com), checked 24 October 2026
- [Hacker News comment on Coinbase WebSocket during an outage](https://news.ycombinator.com/item?id=46158625), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
