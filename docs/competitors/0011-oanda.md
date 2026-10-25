---
id: CMP-0011
title: OANDA, a long-running forex broker and currency data provider
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, data, fx, open-source, ui]
related: [CMP-0001, RES-0021, DEC-0031, DEC-0032, DEC-0034, DEC-0040]
---

# OANDA, a long-running forex broker and currency data provider

## In plain words

OANDA lets people bet on one currency against another, like dollars against euros. It has done this for over 25 years and is licensed by strict regulators in many countries. It also sells exchange rate data that companies, auditors and tax offices use. Parity should learn from OANDA's choice to put TradingView charts inside its own web platform instead of building charts from scratch, and from how it turned price data into a second business.

## Summary

| | |
| --- | --- |
| What it is | A forex and CFD broker with its own web and mobile platform, plus MT4, MT5 and TradingView access, and a currency data business (OANDA Rates and an FX data API) |
| Who uses it | No client count published that we could find. The iPhone app has about 24,000 ratings. OANDA says its rates are used by "major corporations, tax authorities, auditing firms" ([converter](https://www.oanda.com/currency-converter/en/)) |
| Pricing | Spread-only account: typical EUR/USD spread 1.4 pips (OANDA US page). Elite Trader rebates of $5 to $17 per million traded. Core pricing at $5 per $100,000 plus raw spread with a $10,000 minimum, per forexbrokers.com, **unverified** on OANDA's site. Average EUR/USD spread 1.69 pips per forexbrokers.com (checked 24 October 2026) |
| Markets | US: 68 forex pairs, crypto through OANDA Paxos. Elsewhere: forex plus CFDs on indices, commodities, metals, bonds, shares and ETFs, about 4,172 symbols depending on region (forexbrokers.com) |
| Platforms | Web (OANDA Trade web, with TradingView charts), iOS, Android, MT4, MT5 (some regions), TradingView broker link, v20 REST API with demo and live accounts |
| Signature features | TradingView charting inside its own platform; order book and position ratio overlays; trade performance analytics; long FX price history (API back to 2005, converter back to 1990); 7 major regulators |

## Strengths and weaknesses

Strengths:
- Trust: licensed by the CFTC, FCA, ASIC, CIRO, JFSA, MAS and in the EU; forexbrokers.com gives a trust score of 92 of 99 ([forexbrokers.com](https://www.forexbrokers.com/reviews/oanda)).
- Uses TradingView charts in OANDA Trade web: over 100 indicators, 12+ chart types, 50+ drawing tools, trading from the chart ([OANDA Trade web](https://www.oanda.com/us-en/trading/platforms/oanda-trade-web/)).
- Shows crowd data on the chart: an order book depth overlay and the ratio of client positions long and short.
- A free TradingView link-up, with three months of a paid TradingView plan for new clients until 31 December 2026 ([TradingView page](https://www.oanda.com/us-en/trading/platforms/tradingview/)).
- A real data business: 212 currencies, 38,000+ pairs and history back to January 1990 in the converter, sold as an FX data API ([converter](https://www.oanda.com/currency-converter/en/)).
- Free practice accounts and a public API that works on demo accounts ([v20 API](https://developer.oanda.com/rest-live-v20/introduction/)).

Weaknesses:
- Spreads are high next to the cheapest brokers (forexbrokers.com).
- The platform trails the best in class and has fewer education videos (forexbrokers.com).
- In the UK, 76.6% of retail CFD accounts lose money with OANDA, its own required warning ([OANDA UK](https://www.oanda.com/uk-en/)).
- US leverage is capped by the CFTC at 50:1 on majors and 20:1 on others, so US products are narrower ([margin page](https://www.oanda.com/us-en/trading/spreads-margin/)).
- Its open-source API libraries on GitHub were last updated in 2021 and 2022 ([GitHub](https://github.com/oanda)).

## What users say

<!-- collector:start -->
<!-- collector:end -->

From our own reading (App Store listing, Hacker News, forexbrokers.com):
- Liked most: regulation and safety; the clean mobile app; the TradingView link; the API for building bots; its exchange rate data, which people cite in contracts.
- Complained about most: spreads wider than rivals; a platform that feels basic next to the best; fewer learning materials.
- The iPhone app rates 4.74 out of 5 from about 24,000 ratings ([App Store](https://apps.apple.com/us/app/id370922777), checked 24 October 2026).
- On Hacker News OANDA comes up more as a source of exchange rates than as a trading platform.

> "Interest was paid/received every second" on OANDA's forex positions (Hacker News comment, 2023, [link](https://news.ycombinator.com/item?id=35933887))

> "an exchange rate at X date on Oanda.com shall apply" (Hacker News comment, 2026, [link](https://news.ycombinator.com/item?id=47660815))

## UX notes

- **Layout:** OANDA Trade web is marketed as a simple, chart-first page built on TradingView charts that works in desktop, tablet and phone browsers. We did not open an account, so the panel arrangement is **unverified**. See [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).
- **Onboarding:** Demo account first, then "apply, fund, trade" in the app. Several platform choices up front (own platform, MT4, MT5, TradingView), which may confuse beginners.
- **Navigation:** OANDA mentions personalised layouts; how they are saved and switched is **unverified**.
- **Density:** Looks lighter than broker desktops in OANDA's screenshots; **unverified** without an account.
- **Charting:** TradingView inside OANDA's own web platform; the mobile app has 32 overlay indicators, 11 drawing tools and 9 chart types ([App Store](https://apps.apple.com/us/app/id370922777)).
- **Order entry:** Market, limit, stop and stop-limit orders with price bounds, stop loss and trailing stop; the ticket shows the profit or loss impact of a pending order before you place it.
- **Shortcuts:** None documented that we could find.
- **Mobile:** Same functions as the web platform, chart trading in a few taps, notifications and default order settings.
- **Speed perception:** Streaming prices; the app is marketed as fast and reliable, which we could not measure.
- **Trust signals:** Regulator details in the page footer, risk warning with the share of losing accounts in the UK, 25+ years in business. Its status page is private (oanda.statuspage.io asks for a key).

## What Parity should copy, avoid or beat

- **Copy:** Show the money impact of an order on the ticket before it is placed (Trade). [DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)
- **Copy:** Use a proven chart engine instead of building one, as OANDA does with TradingView (Trade). [DEC-0031](../decisions/0031-trade-charts-pro-charting-on-delayed-data.md)
- **Copy:** Sell clean historical data as its own product with an API (Verify, Terminal). [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)
- **Copy:** Put the share of losing accounts in plain view; Parity's demo should be as frank about paper results (Trade). [DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)
- **Avoid:** Asking a beginner to choose between four platforms before they have placed a trade.
- **Avoid:** Letting public SDKs go stale for years.
- **Beat:** OANDA's analytics show a trader's own performance with no adjustment for luck. Verify can add that adjustment and a shareable badge.

## Sources

- [OANDA - Forex trading, App Store](https://apps.apple.com/us/app/id370922777), checked 24 October 2026
- [OANDA US pricing](https://www.oanda.com/us-en/trading/our-pricing/), checked 24 October 2026
- [OANDA US spreads and margin](https://www.oanda.com/us-en/trading/spreads-margin/), checked 24 October 2026
- [OANDA US platforms](https://www.oanda.com/us-en/trading/platforms/), checked 24 October 2026
- [OANDA Trade web](https://www.oanda.com/us-en/trading/platforms/oanda-trade-web/), checked 24 October 2026
- [OANDA and TradingView](https://www.oanda.com/us-en/trading/platforms/tradingview/), checked 24 October 2026
- [OANDA UK home](https://www.oanda.com/uk-en/), checked 24 October 2026
- [OANDA currency converter](https://www.oanda.com/currency-converter/en/), checked 24 October 2026
- [OANDA v20 REST API introduction](https://developer.oanda.com/rest-live-v20/introduction/), checked 24 October 2026
- [oanda on GitHub](https://github.com/oanda), checked 24 October 2026
- [OANDA review, forexbrokers.com](https://www.forexbrokers.com/reviews/oanda), checked 24 October 2026
- [Hacker News comment 35933887](https://news.ycombinator.com/item?id=35933887), checked 24 October 2026
- [Hacker News comment 47660815](https://news.ycombinator.com/item?id=47660815), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
