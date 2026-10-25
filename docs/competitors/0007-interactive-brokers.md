---
id: CMP-0007
title: Interactive Brokers, a global broker with four trading apps
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, data, ui]
related: [CMP-0001, RES-0020, RES-0021, DEC-0040, DEC-0042]
---

# Interactive Brokers, a global broker with four trading apps

## In plain words

Interactive Brokers (IBKR) is a broker that lets people trade almost anything in about 170 markets from one account. It is cheap to trade with and very powerful, but its main program is famous for being hard to use. To fix that it now offers several apps: an old expert one, a newer cleaner desktop one, a phone app and a simple phone app for beginners. Parity should learn from its linked panels and its newer desktop, and should avoid burying simple things under menus.

## Summary

| | |
| --- | --- |
| What it is | A broker (founded 1978) with Trader Workstation (TWS), IBKR Desktop, IBKR Mobile, IBKR GlobalTrader, a web Client Portal, ForecastTrader, IMPACT and APIs ([NerdWallet](https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers)) |
| Who uses it | Active traders, professionals and international investors. 5.185 million accounts in Q2 2026 ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md), from the 10-Q) |
| Pricing | IBKR Lite: $0 US stock commissions, options $0.65 a contract. IBKR Pro: $0.005 a share fixed, or $0.0005 to $0.0035 tiered; options $0.15 to $0.65. No account minimum. Market data fees extra (amounts **unverified**). From [NerdWallet](https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers), 13 October 2026 (checked 24 October 2026) |
| Markets | Stocks, ETFs, options, futures, FX, bonds, funds, crypto, prediction markets, overnight trading, across 170+ markets |
| Platforms | TWS desktop (operating systems **unverified**), IBKR Desktop, web Client Portal, iOS, Android, TWS API (Python, Java, C++, C# and more) |
| Signature features | Mosaic workspace with colour-linked panels; Risk Navigator; many order types and algos; IBKR Desktop MultiSort screener and Option Lattice; GlobalTrader for beginners; Traders Academy courses |

IBKR's own site refused our requests (HTTP 403), as in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md). Facts rest on IBKR's guide site, the App Store, Wikipedia and two reputable reviews.

## Strengths and weaknesses

Strengths:
- Range: one account for nearly every asset class in 170+ markets ([App Store listing](https://apps.apple.com/us/app/ibkr-mobile-invest-worldwide/id454558592)).
- TWS depth: 155 indicators, 85 drawing tools, 659 watchlist columns and algos like TWAP and VWAP ([StockBrokers.com](https://www.stockbrokers.com/review/interactivebrokers), 31 July 2026).
- Mosaic snaps windows into one workspace and colour-links them so one symbol change updates every linked panel ([IBKR guide](https://www.ibkrguides.com/traderworkstation/mosaic-layout.htm)).
- IBKR Desktop is a cleaner rebuild: MultiSort screener with up to 10 weighted criteria, Option Lattice and a Strategy Builder ([StockBrokers.com](https://www.stockbrokers.com/review/interactivebrokers)).
- Low costs and no minimum ([NerdWallet](https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers)).
- A public API repo with 646 GitHub stars ([tws-api-public](https://github.com/InteractiveBrokers/tws-api-public)).

Weaknesses:
- TWS has a steep learning curve; reviewers rate ease of use 4 of 5 even after IBKR Desktop ([StockBrokers.com](https://www.stockbrokers.com/review/interactivebrokers)).
- The phone app draws complaints about repeated logins, lag, buried settings and AI news cluttering stock pages (US App Store reviews, 2026).
- Four overlapping apps make it unclear where to start.
- Interest on cash only above $10,000 and a complex rate table ([NerdWallet](https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers)).
- Hard-to-reach support, per many App Store reviews.

## What users say

<!-- collector:start -->
Our feedback collector ([CMP-0001](0001-ux-patterns-users-praise-most.md#how-we-count)), pass of 2026-10-25: **534 public items** that name Interactive Brokers (Hacker News 357, Stack Exchange 103, GitHub issues 74).

| | Count |
| --- | --- |
| Praise | 127 |
| Complaints | 129 |
| Neither | 278 |
| Praise share | 50% |

- Most praised themes: API and automation (53), Look and layout (39), Speed and lag (33).
- Most complained-about themes: API and automation (43), Crashes and bugs (42), Market data and quotes (34).
- US App Store, app 454558592: 4.50 stars from 11,559 ratings.
- US App Store, app 1604776354: 4.29 stars from 212 ratings.
<!-- collector:end -->

From the US App Store public review feed (IBKR Mobile 4.5 stars from 11,559 ratings; GlobalTrader 4.3 from 212, checked 24 October 2026) and Hacker News:
- Liked most: global access and low costs; TWS power for experts; IBKR Desktop seen as a real step up.
- Complained about most: TWS feels old; the phone app logs out and lags; settings are buried; support and withdrawals are slow.

> "navigating that 1998 Java interface just to check your PnL" (Hacker News comment, 2026, [link](https://news.ycombinator.com/item?id=47426110))

> "no Face ID or passkey, is it really 2026 now?" (App Store review, 2026, [link](https://apps.apple.com/us/app/ibkr-mobile-invest-worldwide/id454558592))

> "Many settings are buried under other settings" (App Store review, 2026, [link](https://apps.apple.com/us/app/ibkr-mobile-invest-worldwide/id454558592))

## UX notes

- **Layout**
  - TWS Mosaic: order entry, portfolio, order monitor, charts, watchlists, scanners and news in snap-docked windows; TWS Classic is an older view (**unverified**) ([IBKR guide](https://www.ibkrguides.com/traderworkstation/mosaic-layout.htm)).
  - Order entry usually on the left, orders at the bottom ([RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md)).
- **Onboarding**
  - A paper trading account comes with every account (**unverified** on an official page). GlobalTrader is the simple entry app; IBKR's guide site links to its Traders Academy courses.
- **Navigation**
  - TWS is menu-driven; reviewers describe IBKR Desktop as a modern, more intuitive interface ([StockBrokers.com](https://www.stockbrokers.com/review/interactivebrokers)).
- **Density**
  - Extreme in TWS (659 watchlist columns). Reviewers say the density takes real time to master.
- **Charting**
  - Capable but not the reason people choose IBKR; 97 studies on mobile ([StockBrokers.com](https://www.stockbrokers.com/review/interactivebrokers)).
- **Order entry**
  - Every order type and algo you can name: bracket, stop limit, profit taker, one-cancels-other, TWAP, VWAP ([IBKR guide](https://www.ibkrguides.com/traderworkstation/mosaic-layout.htm)).
- **Shortcuts**
  - User-built hotkeys in TWS (details **unverified**: the hotkeys guide page returned 404).
- **Mobile**
  - IBKR Mobile is broad (stocks to prediction markets, AI news summaries, IV rank on option chains). GlobalTrader is the simple version.
- **Speed perception**
  - Recent reviews report 5 to 10 second page loads and frozen launch screens on the phone.
- **Trust signals**
  - Listed company, regulators in many countries, published account metrics; strong execution quality per [NerdWallet](https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers).

## What Parity should copy, avoid or beat

- **Copy:**
  - Trade: colour link groups so a watchlist, chart and ticket follow one symbol, and snap docking ([DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)).
  - Trade: a weighted screener (pick up to 10 criteria and weights), as in MultiSort.
  - Academy: short courses tied to the tools, like Traders Academy ([DEC-0042](../decisions/0042-parity-academy-a-full-screen-course-player-of-its-own.md)).
- **Avoid:**
  - Many apps for one job. Parity already has five apps; each must say what it is for in one line.
  - Burying simple numbers (total P&L) under settings.
  - AI text pushed onto every page without a way to turn it off.
- **Beat:**
  - Simple and dense at once: IBKR Desktop is moving there; Parity Trade can start there.
  - Phone sign-in with passkeys and no repeated log-outs.

## Sources

- [TWS Mosaic layout, IBKR guide](https://www.ibkrguides.com/traderworkstation/mosaic-layout.htm), checked 24 October 2026
- [Interactive Brokers review 2026, NerdWallet](https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers), checked 24 October 2026
- [Interactive Brokers review, StockBrokers.com](https://www.stockbrokers.com/review/interactivebrokers), checked 24 October 2026
- [Interactive Brokers, Wikipedia](https://en.wikipedia.org/wiki/Interactive_Brokers), checked 24 October 2026
- [IBKR Mobile, US App Store listing](https://apps.apple.com/us/app/ibkr-mobile-invest-worldwide/id454558592), checked 24 October 2026
- [IBKR GlobalTrader, US App Store listing](https://apps.apple.com/us/app/ibkr-globaltrader/id1604776354), checked 24 October 2026
- [tws-api-public on GitHub](https://github.com/InteractiveBrokers/tws-api-public), checked 24 October 2026
- [Hacker News comment on the TWS desktop client](https://news.ycombinator.com/item?id=47426110), checked 24 October 2026
- [IBKR Desktop product page](https://www.interactivebrokers.com/en/trading/ibkr-desktop.php), refused (HTTP 403), 24 October 2026
- [IBKR investor relations](https://investors.interactivebrokers.com/), refused (HTTP 403), 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
