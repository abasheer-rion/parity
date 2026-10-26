---
id: CMP-0022
title: Collective2, a marketplace of live-tracked trading strategies
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, method, strategy]
related: [CMP-0001, RES-0020, DEC-0032, DEC-0036, DEC-0043]
---

# Collective2, a marketplace of live-tracked trading strategies

## In plain words

Collective2 is a website where traders publish their buy and sell calls as they make them, and other people pay a monthly fee to copy those calls automatically in their own brokerage accounts. A strategy's record starts on day one and can never be edited, so a bad month stays on the page forever. Parity should copy that "no backfill, no delete" rule, and beat Collective2 by adjusting for the thousands of strategies that compete for the top of its leaderboard.

## Summary

| | |
| --- | --- |
| What it is | A US strategy marketplace (NFA member) that records signals forward in time, routes them to followers' brokers ("AutoTrade") and ranks strategies on a leaderboard ([home](https://trade.collective2.com/)) |
| Who uses it | Strategy managers, from hobbyists to small firms, and self-directed investors who follow them. "Tracking strategies since 2001" ([managers](https://trade.collective2.com/strategy-managers.html)). The top strategy showed $9.3M of follower capital in September 2026. No total user count published |
| Pricing | Investors: free account to browse. Managers: 14-day free trial, no card needed; plan prices did not appear on the public pricing page (**unverified**). Managers set their own flat monthly subscription; no performance fees. Followers also pay an AutoTrade plan and broker commissions ([pricing](https://trade.collective2.com/pricing.html), [AutoTrading](https://collective2.com/about-autotrading), checked 24 October 2026) |
| Markets | US stocks, options, futures and forex |
| Platforms | Web; REST API (API4) with an OpenAPI spec, an agents.md guide and llms.txt for AI agents; signals by email; white label; an iOS app last updated 2020 |
| Signature features | Go-forward records; fills re-marked to followers' real broker prices; "Trades Own Strategy" badge; failed strategies stay public; leaderboard; AutoTrade at many brokers |

## Strengths and weaknesses

How it verifies: a record begins when the strategy goes live and grows signal by signal, "Nothing is backfilled, nothing is edited, and nothing is quietly deleted" ([managers](https://trade.collective2.com/strategy-managers.html)). When followers AutoTrade a signal, Collective2 re-marks the recorded price to the volume-weighted average of the fills their brokers reported, keeps the manager's original price, and logs every re-mark. With no followers, it simulates fills at real-time bid or ask ([home](https://trade.collective2.com/)). Managers who prove real money on the line get a "Trades Own Strategy" badge. A strategy taken private still shows that it exists and when it started. Where it falls short: every result is labelled hypothetical, and nothing corrects for selection. One manager can run several strategies, thousands compete, and the leaderboard surfaces the luckiest. Its own page says a backtest is "the one trial out of ten that happened to work", yet the same logic applies to the top of its leaderboard and is not adjusted for.

Strengths:
- The strongest anti-cherry-picking rules of any track record site we reviewed: no backfill, no edits, no deletion, failed strategies stay up.
- Real follower fills feed the record, so crowding and slippage show up in the numbers.
- Fees are in the math: returns are net of subscription, AutoTrade fees and estimated commissions ([pricing](https://trade.collective2.com/pricing.html)).
- Clear incentive: flat monthly fee, no performance fee, so managers are not paid more for taking big risks.
- Unusually agent-ready: one JSON API, OpenAPI, agents.md and llms.txt.

Weaknesses:
- No trial count or deflation: winners are picked from a large field and shown first.
- "Hypothetical" on every number, which is legally required but leaves readers to guess how much to trust it.
- Short-lived strategies dominate: an App Store reviewer and a Hacker News commenter both say few strategies last years.
- The mobile app has 1.9 stars from 12 ratings and has not been updated since 2020.
- Manager plan prices are not public on the pricing page.
- Its help centre refused us (HTTP 403), so finer rules are **unverified**.

## What users say

<!-- collector:start -->
Our feedback collector ([CMP-0001](0001-ux-patterns-users-praise-most.md#how-we-count)), pass of 2026-10-25: **2 public items** that name Collective2 (Hacker News 2).

Too few to rank themes (under 20). The notes below rest on our own reading.
- US App Store, app 519099516: 1.92 stars from 12 ratings.
<!-- collector:end -->

From the App Store review feed (4 US reviews in total) and Hacker News. We did not read the Collective2 forum or help centre.
- Liked most: the premise and the service itself (even critics of the app say so); real-time records; trying strategies before paying.
- Complained about most: few strategies with long histories; the mobile app (log-in failures, poor design); strategies that fail to beat simply holding the index.

> "There are only a couple that has a large history of trades" (Hacker News comment, 2024, [link](https://news.ycombinator.com/item?id=40969550))

> "I don't see a long time strategy on this platform." (App Store review, US, 2022, [link](https://apps.apple.com/us/app/id519099516))

> "this mobile application is very bad with user experience" (App Store review, US, 2025, [link](https://apps.apple.com/us/app/id519099516))

## UX notes

- **Layout**: a strategy record page with tabs for Overview, Trade history, Drawdowns and Risk measures; headline cumulative return, then annual return, then details.
- **Onboarding**: managers open a "Model Account" and the first trade starts the record. Investors browse free, then connect a broker for AutoTrade.
- **Navigation**: top nav split by audience: For investors, How it works, For strategy managers, For AI agents.
- **Density**: medium on the marketing site; record pages carry long trade lists with every fill (broker, size, price, time) behind each price.
- **Charting**: equity curves and drawdown charts; a fill chart shows each subscriber fill against the manager's signal price, to the second.
- **Order entry**: managers send signals from the web, the API, supported platforms or plain email. Followers can scale, pause, close early or add their own stops.
- **Shortcuts**: none found.
- **Mobile**: the old iOS app; the site is responsive.
- **Speed perception**: fills shown "within two seconds" across brokers in examples; we did not test.
- **Trust signals**: NFA membership, a long hypothetical-results disclosure, an audit log of re-marks, the "Trades Own Strategy" badge, a bug bounty page.

## What Parity should copy, avoid or beat

- **Copy:** "a record, once begun, is not easy to walk away from". Verify badges should be append-only, and a withdrawn badge should leave a dated stub ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
- **Copy:** show the evidence behind each number (the fills behind a price). Verify's cards can link each red flag to the trades that caused it ([DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)).
- **Copy:** separate labels for "trades own money" and "model only". Verify can mark whether a record is live, paper or backtest.
- **Copy:** an agent-friendly API with OpenAPI and llms.txt. Verify's API should ship the same.
- **Avoid:** a leaderboard sorted by raw return. If Workbench ever ranks strategies, deflate the ranking for the number of entrants ([DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)).
- **Beat:** apply the multiple-testing correction Collective2 explains but does not use, at manager level and at leaderboard level.
- **Beat:** say how much to trust a hypothetical record in one line, instead of a page of boilerplate.

## Sources

- [Collective2 home page](https://trade.collective2.com/), checked 24 October 2026
- [Collective2 for strategy managers](https://trade.collective2.com/strategy-managers.html), checked 24 October 2026
- [Collective2 pricing](https://trade.collective2.com/pricing.html), checked 24 October 2026
- [About AutoTrading](https://collective2.com/about-autotrading), checked 24 October 2026
- [Collective2 API](https://trade.collective2.com/c2-api.html), checked 24 October 2026
- [Build with Collective2, for AI agents](https://collective2.com/build-with-c2.html), checked 24 October 2026
- [Collective2 robots.txt](https://www.collective2.com/robots.txt), checked 24 October 2026
- [Collective2 help centre](https://support.collective2.com/), refused (HTTP 403) on 24 October 2026
- [Collective2 iOS app, App Store](https://apps.apple.com/us/app/collective2/id519099516), checked 24 October 2026
- [App Store customer review feed, Collective2 app](https://itunes.apple.com/us/rss/customerreviews/id=519099516/sortby=mostrecent/json), checked 24 October 2026
- [Hacker News comment on long-lived Collective2 systems](https://news.ycombinator.com/item?id=40969550), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
