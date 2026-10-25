---
id: CMP-0001
title: What users praise most in trading platforms, and what Parity takes from it
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, ui]
related: [DEC-0047, RES-0020, RES-0021, RES-0022, REF-0019, DEC-0024, DEC-0040, DEC-0042, DEC-0043]
---

# What users praise most in trading platforms, and what Parity takes from it

## In plain words

We wrote a profile of 22 trading products, from the Bloomberg Terminal to Robinhood to Myfxbook, and a small program counts what people say about them in public. This page adds it up. People praise low costs, good tools for automation, good market data, a clean layout and speed. They complain most about data problems, fees, getting money in and out, and whether they can trust the company. At the end is a list of what each Parity app should copy, avoid or do better.

## Summary

- 22 profiles, CMP-0002 to CMP-0023, each with the same sections. Prices and features were checked on 24 October 2026. How the platforms are built and how fast they are is in [RES-0022](../research/0022-how-trading-and-market-data-platforms-are-built.md) and [REF-0019](../reference/0019-latency-budget-and-target-architecture.md); this set covers product, UX and what users say.
- The counts come from the feedback collector ([DEC-0047](../decisions/0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md)), which runs once a day inside the sims service and only reads sources whose terms allow it. The table below is a snapshot; the research site's Competitors page shows the live counts.
- The five themes users praise most, by count of public posts: see the table in [what users praise most](#what-users-praise-most). Across the profiles, the patterns named most often as worth copying are saved and linked layouts, a practice account one tap from the real screen, and one-click order entry on the chart.
- Every Verify competitor checks that trades happened. None we found counts how many strategies or settings were tried before the one shown, so none can say how much of a record is luck. That is still Verify's opening ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)), with one correction: QuantPad now shows a deflated Sharpe ratio, but it assumes a single try ([CMP-0018](0018-quantpad.md)).

## How we count

- **Where the posts come from.** Hacker News (Algolia API), Stack Exchange (money and quant sites, official API), GitHub issues on each product's official or best-known open-source repository, status page feeds, product changelog feeds, and App Store star ratings. Each source's terms are listed by `parity profiles sources`.
- **What we do not read.** App Store review text: Apple's robots.txt disallows its review feeds, so the collector skips them. Google Play: there is no allowed route. Reddit: only through its official API, which needs a key we do not have yet. Never G2, Trustpilot or Capterra pages, and never anything behind a login.
- **Matching.** A post counts for a product only if its own text contains one of the product's search phrases (listed in `docs/_system/competitors.json`).
- **Praise or complaint.** A fixed word list we wrote, with a rule that flips a word after "not", "never" and similar. A star rating, when there is one, decides on its own.
- **Themes.** 18 fixed keyword lists, such as "Charts and indicators" or "Deposits and withdrawals". One post can sit in several themes.
- **Limits.** Hacker News and Stack Exchange lean technical, so retail apps (Robinhood, Webull, eToro) are under-counted until Reddit is keyed. "Market data and quotes" catches any mention of data and runs high. Four Verify competitors have under 20 posts each, too few to rank. These are counts of where people talk, not a survey.
- **Quotes in the profiles** were read once by hand during research, at most three per product and each under 15 words. Some come from App Store review pages; the collector itself does not read review text.

## What users say

### What users praise most

<!-- patterns:start -->
<!-- patterns:end -->

### What users complain about most

<!-- complaints:start -->
<!-- complaints:end -->

## UX notes

Patterns that recur across the profiles. How many of the 22 profiles name each pattern, as a strength to copy or a weakness to avoid. Counted from the profiles' own text.

| Pattern | Profiles | Examples |
| --- | --- | --- |
| Saved, named layouts, often shared by link | 18 | thinkorswim shares a layout as a link ([CMP-0008](0008-thinkorswim.md)); cTrader flips workspaces with F7 and F8 ([CMP-0005](0005-ctrader.md)); Robinhood Legend saves without a button ([CMP-0009](0009-robinhood.md)) |
| A practice or demo account one tap from the real screen | 14 | eToro's virtual portfolio ([CMP-0017](0017-etoro.md)); Webull colours its demo differently ([CMP-0010](0010-webull.md)); thinkorswim paperMoney ([CMP-0008](0008-thinkorswim.md)) |
| One-click order entry on the chart, draggable orders or a ladder | 9 | Robinhood Legend order pills ([CMP-0009](0009-robinhood.md)); Kraken Pro ladder ([CMP-0016](0016-kraken-pro.md)) |
| A phone app that does less than the desktop, and users notice | 7 | Bloomberg ([CMP-0002](0002-bloomberg-terminal.md)), cTrader ([CMP-0005](0005-ctrader.md)), Interactive Brokers ([CMP-0007](0007-interactive-brokers.md)) |
| A simple view and an advanced view of the same account | 6 | Coinbase and Coinbase Advanced ([CMP-0015](0015-coinbase-advanced.md)); Binance's classic and pro layouts ([CMP-0014](0014-binance.md)) |
| Rules and formulas published next to the numbers | 5 | eToro's entry rules for copyable traders ([CMP-0017](0017-etoro.md)); Hyperliquid's drawdown formula ([CMP-0013](0013-hyperliquid.md)); LMAX's execution rules ([CMP-0012](0012-lmax.md)) |
| Prices hidden behind "contact sales" | 5 | Bloomberg, LSEG, LMAX ([CMP-0002](0002-bloomberg-terminal.md), [CMP-0003](0003-lseg-workspace.md), [CMP-0012](0012-lmax.md)) |
| A working screen before any sign-in | 4 | TradingView opens on a chart ([CMP-0006](0006-tradingview.md)); Myfxbook records open without an account ([CMP-0019](0019-myfxbook.md)) |
| Costs shown on the ticket before the order | 2 | OANDA ([CMP-0011](0011-oanda.md)); Kraken Pro's missing costs are a complaint ([CMP-0016](0016-kraken-pro.md)) |
| Chart replay for practice | 3 | TradingView Bar Replay ([CMP-0006](0006-tradingview.md)), cTrader ([CMP-0005](0005-ctrader.md)), Webull ([CMP-0010](0010-webull.md)) |

Keyboard shortcuts and status pages appear in most profiles too, but mostly as facts about the product rather than as something users single out. Layout and key conventions are already in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).

## What Parity should copy, avoid or beat

**Trade** ([DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md))
- Open on a working chart with delayed data before any sign-in; ask for an account only to save.
- Keep the practice account one tap away and make it look different from anything real.
- Show every cost (fee, spread, financing, slippage) on the ticket before the order and in the fills list.
- Saved, named layouts that autosave, shareable by link, with colour link groups between panels.
- Draggable orders on the chart, with "send without confirming" off by default.
- Never block the screen with an update or a modal while orders are open.

**Terminal** ([DEC-0024](../decisions/0024-parity-terminal-a-market-terminal-of-its-own-at-the-sim-address.md))
- Short, stable command codes with one-key help, as Bloomberg users praise.
- Every panel and every answer shows the series and date behind its numbers.
- A phone view that does a few things well and says what it leaves out.

**Verify**
- One public link per record that opens without a login, with what was checked and what was not on separate lines.
- Score records against everyone who tried, including those who stopped or deleted, and show how many tries the result survives.
- When the number of tries is unknown, say so on the badge instead of assuming one.
- Publish the badge rules and the formula behind each number.

**Workbench** ([DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md))
- Count every setting tried and show the luck-adjusted result next to the raw one. MetaTrader, TradingView, thinkorswim and QuantConnect testers do not.
- Offer fast and exact test modes and a forward test on held-out data, as MetaTrader does.
- Replay on history with a starting balance and speed control.

**Academy** ([DEC-0042](../decisions/0042-parity-academy-a-full-screen-course-player-of-its-own.md))
- Short courses tied to the screen they explain, linked from that screen.
- A first-ten-codes course for the Terminal, like the training Bloomberg gives new users.

**Across all five:** a dated public changelog and a status page split by service; prices shown, never "contact sales"; no game-like rewards on screens that move money, real or practice.

## Sources

The profiles CMP-0002 to CMP-0023 list their own sources. The counts come from the collector's pass named in each profile.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0047: Competitor profiles and a feedback collector that runs by itself](../decisions/0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md)
- [CMP-0002: Bloomberg Terminal, the data, news and chat desk of professional finance](0002-bloomberg-terminal.md)
- [CMP-0003: LSEG Workspace, the Reuters-backed data terminal that replaced Eikon](0003-lseg-workspace.md)
- [CMP-0004: MetaTrader 4 and 5, the free broker platform most FX traders use](0004-metatrader-4-and-5.md)
- [CMP-0005: cTrader, a modern broker platform with copy, algos and a store](0005-ctrader.md)
- [CMP-0006: TradingView, browser charts and a social network for traders](0006-tradingview.md)
- [CMP-0007: Interactive Brokers, a global broker with four trading apps](0007-interactive-brokers.md)
- [CMP-0008: thinkorswim, Schwab's dense pro trading platform for options and futures traders](0008-thinkorswim.md)
- [CMP-0009: Robinhood, the simple trading app that added a pro desktop called Legend](0009-robinhood.md)
- [CMP-0010: Webull, a zero-commission broker with pro desktop tools and paper trading](0010-webull.md)
- [CMP-0011: OANDA, a long-running forex broker and currency data provider](0011-oanda.md)
- [CMP-0012: LMAX, an institutional FX exchange with a broker for professional traders](0012-lmax.md)
- [CMP-0013: Hyperliquid, an onchain exchange for crypto perpetuals and spot](0013-hyperliquid.md)
- [CMP-0014: Binance, the largest crypto exchange with futures and copy trading](0014-binance.md)
- [CMP-0015: Coinbase Advanced, the pro trading screen inside Coinbase](0015-coinbase-advanced.md)
- [CMP-0016: Kraken Pro, a customisable crypto trading app with a native desktop](0016-kraken-pro.md)
- [CMP-0017: eToro, a social investing broker built around copying other investors](0017-etoro.md)
- [CMP-0018: QuantPad, an AI quant workspace that grades strategies A to F](0018-quantpad.md)
- [CMP-0019: Myfxbook, the forex track record and analysis site traders cite](0019-myfxbook.md)
- [CMP-0020: FX Blue, free forex account analysis and MetaTrader add-ons](0020-fx-blue.md)
- [CMP-0021: Darwinex, a regulated broker that turns traders into risk-scaled indexes](0021-darwinex.md)
- [CMP-0022: Collective2, a marketplace of live-tracked trading strategies](0022-collective2.md)
- [CMP-0023: QuantConnect, cloud backtesting and live trading on open-source LEAN](0023-quantconnect.md)
- [LOG-0017: Ayan work log, competitor profiles, feedback collector and architecture](../log/2026-10-24-ayan-work-log-competitor-profiles-feedback-collector-and-architecture.md)
<!-- backlinks:end -->
