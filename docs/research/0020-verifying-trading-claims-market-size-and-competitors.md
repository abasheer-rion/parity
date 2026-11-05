---
id: RES-0020
title: Verifying trading claims, market size and competitors
type: research
status: current
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [data, method, strategy]
related: [INT-0003, DEC-0032, REF-0016, RES-0009, RES-0011]
---

# Verifying trading claims, market size and competitors

## In plain words

Before building Parity Verify we wanted to know three things. How many people and companies might pay to have a trading record checked? Who already does something like it? And why has nobody done it properly yet? The short answers: a few million serious retail traders plus a few hundred platforms, worth roughly one to two billion dollars a year if everyone paid, and far less in practice; plenty of tools that test strategies or show track records, but none that adjusts a record for how many things were tried; and the reason is that the platforms that show records earn more when the records look good.

## Summary

Gathered on 23 October 2026 for [INT-0003](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md). Every number below comes from a page we fetched that day, listed in [sources](#sources). Company user counts are the companies' own claims, not audited. Market research firms disagree with each other by large amounts, so we show two estimates side by side. Anything we could not open, or worked out ourselves, is marked **unverified** or **our estimate**.

- **Context, not our market.** The algorithmic trading market is put at $20.2 billion (2026, Mordor Intelligence) to $23.5 billion (2025, Grand View Research) [@url-10a779e1; @url-fac0e504]. The alternative data market is put at $11.7 billion (Mordor) to $18.8 billion (Grand View) for the same year, 2025 [@url-2914af50; @url-c9da2bd1]. These are top-down figures; we do not build on them.
- **Bottom-up, our estimate.** About 5 to 10 million active bot, copy, prop-firm and systematic traders worldwide, plus a few hundred platforms. If all of them paid list prices: roughly $0.9 to 1.9 billion a year. Serviceable today: roughly $90 to 210 million. A realistic three-year share: about $2.5 million a year in revenue. See [bottom-up sizing](#bottom-up-sizing).
- **The gap.** Strategy builders (QuantConnect, TradingView, Composer, StrategyQuant, Build Alpha) let one person try thousands or millions of variants and show the winner with no correction. Track-record sites (Myfxbook, FX Blue, Darwinex, Collective2, eToro) check that trades happened, not whether they were luck. Only Numerai makes overfitting cost money, and only inside its own tournament.
- **Closest competitor.** QuantPad's "Verdict" grades a strategy A to F and flags overfit backtests [@url-1b09894d]. Its public page shows no trial counting, no luck adjustment and no shareable badge.
- **Why the gap exists.** Platforms earn on volume, seats or assets copied. A luck adjustment shrinks the leaderboards that drive all three. Losing accounts can usually be deleted or hidden. And regulation requires a "hypothetical" label, not a check [@url-40d7e26e; @url-a99cdde2].

## The problem, with numbers

| Signal | Number | Source |
| --- | --- | --- |
| US consumers' reported losses to investment scams, 2024 | $5.7 billion, the largest fraud category, out of $12.5 billion total | FTC, 10 March 2025 [@url-21b265d8] |
| Bitcoin taken in one "automated trading" scheme (Mirror Trading International) | At least 29,421 bitcoin, valued at over $1.7 billion; court ordered restitution on 7 September 2023 | CFTC [@url-e0285b3b] |
| What AI trading bot scams promise | "huge returns, sometimes tens of thousands of percent" or "100 percent 'win' rates" | CFTC customer advisory [@url-a1682719] |
| Advisers fined for advertising hypothetical performance | 9 firms, $850,000 in total (September 2023), then 5 more, $200,000 (April 2024) | SEC [@url-c53f97a6; @url-be81eda4] |
| First "AI washing" case | Two advisers, $400,000 in total, for claiming to use AI when they did not (March 2024) | SEC [@url-6c190e5d] |
| Copied traders gaming a copy program | eToro reports "instances of eToro users misusing the Pro Investor program by fraudulently copying each other's positions to increase the fees they might receive", adding that these "have occurred infrequently" | eToro 2025 annual report (20-F) [@url-9a1baa9c] |
| How many retail CFD accounts lose money | 70% at IG UK, the required disclosure on its home page | IG [@url-5d48f0dc] |
| Marketing claims that need checking | ZuluTrade: "73% of our investors make profit when copying top leaders correctly", against "only 11-26%" of manual investors | ZuluTrade home page [@url-dd4f26d0] |

The often-quoted ESMA range of 74% to 89% of retail CFD accounts losing money is **unverified** here: the ESMA page refused our request.

## Who could pay: the inputs

| Group | Number | Source and status |
| --- | --- | --- |
| Robinhood funded customers | 28.4 million (30 June 2026); 4.84 million pay for Robinhood Gold | 10-Q, checked [@url-dd7a6dd5] |
| Schwab active brokerage accounts | 39.8 million (30 June 2026) | 10-Q, checked [@url-e0a49b44] |
| Interactive Brokers accounts | 5.185 million (Q2 2026) | 10-Q, checked [@url-51e0556a] |
| Young US investors using social media for investment information | 60% | FINRA Foundation, 2021 survey data [@url-6d753ea2] |
| TradingView | "100 million traders" | Company claim [@url-0521e581] |
| eToro funded accounts | About 3.81 million (31 December 2025); over 4,800 Pro Investors others can copy | 20-F, checked [@url-9a1baa9c] |
| eToro net contribution (its revenue measure) | $868 million in 2025, $788 million in 2024 | 20-F, checked [@url-9a1baa9c] |
| ZuluTrade | "30M+ accounts", "2M+ leaders" | Company claim [@url-dd4f26d0] |
| FTMO, the largest retail prop firm we could check | "4.5M+ customers", "$650M+ paid in rewards" since 2015 | Company claim [@url-849471fb] |
| Cryptohopper | 1,151,419 users | Company claim [@url-579f7291] |
| 3Commas | "118,000+ active members" | Company claim [@url-e95d4a55] |
| QuantConnect | 557,000 community members, over 1 million backtests a month | Company claim [@url-7b00d723] |
| Trading journals | TradeZella: over 100,000 traders; Tradervue: 207,623; FX Replay: "1M+" | Company claims [@url-fa00b2c3; @url-03c3c09f; @url-7ae24f30] |
| Binance copy trading | Copier slots per lead trader shown from 200 to 1,000; lead traders earn a 10% profit share | Page snapshot [@url-a8c4abb3] |
| Numerai | $30 million Series C at a $500 million valuation (20 November 2025); assets about $550 million | Company blog [@url-fc1425fc] |
| Kaiko, a crypto data vendor | Over $80 million of venture funding raised | Company page [@url-03099067] |

**Not found, so not used:** retail share of US stock trading volume, the number of retail prop firms, the share of prop challenge takers who are ever paid, total financial market data spend, user counts for Pionex, Bybit and Bitget, Darwinex assets, and any survey of traders using AI assistants to write strategies. The MyForexFunds case (CFTC, 2023) and MetaQuotes withdrawing its platform from US prop firms (2024) are widely reported but **unverified** here because the pages could not be opened.

## Bottom-up sizing

All three layers are **our estimate**, built from the inputs above. We state each assumption so it can be argued with.

### Retail and prosumer

| Step | Value | Why |
| --- | --- | --- |
| Active bot, copy, prop and systematic traders worldwide | 5 to 10 million | FTMO's 4.5 million customers, eToro's 3.81 million funded accounts and Cryptohopper's 1.15 million users overlap heavily. TradingView's 100 million is mostly casual chart users and is left out |
| Price | $15 a month, $180 a year | The same as FX Replay's $15 entry plan, below TradeZella's $35 |
| TAM (everyone pays) | $0.9 to 1.8 billion a year | 5 to 10 million x $180 |
| Share who would pay for a narrow checking tool | 5% | Robinhood Gold reaches 17% of funded customers (4.84 of 28.4 million) for a broad perk bundle; a single-purpose tool should expect far less |
| SAM | $45 to 90 million a year | 250,000 to 500,000 payers x $180 |
| SOM, three years | About $1.8 million a year | 10,000 payers, 2% to 4% of SAM |

### Platforms (copy trading, bot marketplaces, prop firms, brokers)

| Kind | Count (unverified) | Price a year | Total |
| --- | --- | --- | --- |
| Copy-trading and social platforms, bot marketplaces | About 50 that matter | $100,000 | $5 million |
| Retail prop firms | About 300 | $30,000 | $9 million |
| Brokers and fintech apps that show strategies | About 500 | $50,000 | $25 million |
| **Platform TAM** | | | **About $40 million**, up to $100 million with usage fees |

SOM, three years: 10 platforms at $50,000, about $0.5 million a year. Small in money, large in strategic value: platforms bring the volume of records that builds the dataset.

### Data buyers

| Step | Value |
| --- | --- |
| Alternative data market, 2025 | $11.7 to 18.8 billion (two disagreeing estimates) |
| Share a strategy-outcome dataset could reach | 0.05% to 0.1% (our assumption) |
| Data TAM | About $6 to 19 million a year |
| SOM, three years | 5 licences at $50,000, about $0.25 million a year |

### Adding up

| | TAM | SAM | SOM (3 years) |
| --- | --- | --- | --- |
| Retail and prosumer | $0.9 to 1.8 billion | $45 to 90 million | $1.8 million |
| Platforms | $40 to 100 million | $40 to 100 million | $0.5 million |
| Data | $6 to 19 million | $6 to 19 million | $0.25 million |
| **Total** | **About $0.9 to 1.9 billion** | **About $90 to 210 million** | **About $2.5 million** |

AI-agent builders are left out because we found no data on them. They are an upside, not part of the base.

What the sizing says: retail is where the people are, platforms are where the money per customer is, and data is small today but is what makes the business hard to copy ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).

## Competitors and adjacent players

### Strategy builders and backtesters

| Player | What it does | Checks it offers | What it does not check | Price and scale |
| --- | --- | --- | --- | --- |
| QuantConnect | Cloud backtesting and live trading on the open-source LEAN engine | Realistic fills and fees | Its optimizer runs thousands of backtests; nothing counts them or deflates the winner | Free to institution tiers, priced at checkout; 557,000 members [@url-7b00d723] |
| TradingView | Charts, Pine Script and a strategy tester | None on published strategies | Its own docs say `lookahead_on` without an offset "will return data from the future on historical bars, which is dangerously misleading" [@url-780a43b3]; published strategies are not scanned for it | Free; $12.95 to $199.95 a month [@url-0521e581] |
| Composer | No-code builder that backtests and auto-trades | None stated | Community strategies are shown on backtests | $0, $10, $32 a month [@url-9d661003] |
| QuantPad | AI coding agent, tick data and cloud compute, aimed at futures and prop-firm traders | "The Verdict": A to F on edge, robustness, risk and sample size; flags a "suspiciously smooth equity curve" and negative expectancy; Monte Carlo; prop pass probability [@url-1b09894d] | No trial count, no deflated Sharpe, no look-ahead detection and no shareable badge on its public page | Price behind sign-in; users and funding not disclosed |
| StrategyQuant X | Generates and robustness-tests strategies | Monte Carlo, parameter permutations, walk-forward | Generates huge numbers of strategies with no trial correction | $129 to $290 a month for 12 months, then lifetime [@url-11e4faa9] |
| Build Alpha | Generates strategies and tests them | Noise test, Monte Carlo, random-strategy test, walk-forward | "Millions of possible combinations" with no correction for them | $1,497 lifetime [@url-950b726b] |
| QuantStats | Open-source Python performance reports | Sharpe, Sortino, drawdown | No probabilistic or deflated Sharpe | Free; over 7,700 GitHub stars [@url-4eefbf30] |

### Journals and practice tools

TradeZella ($35 to $99 a month, 500+ broker links), Tradervue, Edgewonk ($35 a month) and FX Replay ($15 to $29 a month) analyse a trader's own imported trades [@url-fa00b2c3; @url-03c3c09f; @url-8436b75b; @url-7ae24f30]. They see only what the user imports, certify nothing to third parties and make no luck adjustment. They are a channel more than a competitor: their users are exactly the serious traders who want a checked record.

### Bot platforms

| Player | Price | What it checks |
| --- | --- | --- |
| 3Commas | $15 to $140 a month [@url-e0307c82] | No verification of marketplace or signal bots |
| Cryptohopper | $29 to $129 a month; copy bots $9.99 to $99.99 [@url-59599351] | Marketplace strategies carry no stated vetting |
| Pionex | Exchange with built-in bots [@url-c5c4f9e9] | Could not be checked (blocked) |
| Binance copy trading | Lead traders earn a profit share [@url-a8c4abb3] | Shows ROI, 30-day profit, drawdown, Sharpe and copier counts from its own ledger, over 30 days; nothing on accounts a lead trader opened and closed |

### Track records and copy trading

| Player | How "verified" works | The gap |
| --- | --- | --- |
| Myfxbook | "Track record verified" checks history against the broker through a read-only investor password; "trading privileges verified" proves control of the account (**unverified**: the site refused our requests) [@url-c4fa64dc] | Accounts can be deleted or made private; nothing counts how many accounts one person runs; no luck adjustment |
| FX Blue | Upload your results "with just a few clicks"; used by FTMO and several brokers [@url-e132b4e4] | No verification process described |
| Darwinex | UK broker and manager (FCA). Strategies become DARWIN indexes with standardised volatility; the trader gets 15% of profits; claims to allocate "based on merit, not luck"; risk engine scales down outsized positions [@url-23cb3eee; @url-854779e4] | The closest to luck-aware, but it standardises risk rather than counting tries, and only inside its own platform. Its D-Score details are **unverified** |
| Collective2 | "Go-forward, never backtested", "no deleting bad trades", failed strategies stay up [@url-20151496] | One manager can run many strategies with no deflation; it labels all results hypothetical |
| eToro CopyTrader | Pro Investor entry rules include at least 2 months of history, risk score of 7 or below, worst week no deeper than -25%; Champion tier and above are paid up to 1.5% a year of assets copied [@url-e6e8d042] | The risk score measures volatility, not luck; no adjustment for traders who dropped out |
| ZuluTrade | Ranks leaders on "performance, stability, and trading behavior" [@url-dd4f26d0] | With over 2 million leaders, the top of any performance ranking is guaranteed to hold lucky ones |
| Numerai | Pays on a model's correlation to the target and its contribution to the combined model, weighted by stake; history "cannot be reset or erased" [@url-41810c96] | The best real answer to counting tries, because overfitting costs the staker money. But it is a closed tournament, and a user can start a fresh model |

### Data vendors

Kaiko sells institutional crypto market data and indexes and reports over $80 million of venture funding [@url-03099067]. During our checks, Amberdata's site redirected to a notice that Kaiko had acquired it, and Coin Metrics' site said it had been acquired by Talos (both **unverified** beyond the redirect pages). None of these vendors sells a strategy-quality score or a dataset of tested strategies. That slot is open.

## Where verification is missing, and why

1. **Platforms earn on volume and seats, not accuracy.** Exchanges and copy platforms earn from more copying and trading; bot sellers earn per seat. A luck adjustment shrinks the leaderboards that drive both.
2. **Losing records disappear.** Track-record sites, 30-day exchange windows and journals let a bad account be deleted, hidden or never imported. Only Collective2 and Numerai keep history permanently, and only on their own platforms.
3. **Nobody counts the tries.** Backtesting tools let one person run millions of variants and show the best. Large leader pools guarantee lucky winners at the top. This is the selection problem the deflated Sharpe ratio was built for [@bailey2014a], and the reason published results shrink after publication [@mclean2016].
4. **Backtests cannot be verified by the platforms that run them.** TradingView documents how look-ahead invalidates results but does not scan for it.
5. **Rules require a label, not a check.** NFA Rule 2-29 requires the "hypothetical performance results have many inherent limitations" disclaimer [@url-40d7e26e]. The SEC's Marketing Rule defines hypothetical performance as "performance results that were not actually achieved by any portfolio" and requires policies before an adviser may show it [@url-a99cdde2]. Neither requires anyone to measure overfitting.
6. **No neutral third party.** Every "verified" badge today comes from the platform that profits from the trader, or from a read-only account check. None works across platforms, and none says how likely the record is to be luck.

## What this means for Parity

- The opening is a **portable, luck-adjusted verdict** that works on any record from any platform, with the number of tries in it.
- QuantPad is the competitor to watch. It already speaks the language ("the Verdict", overfitting tells) to the same prop-firm audience. Our edge over it is trial counting, look-ahead tests, a public method and a badge built to be shared.
- Darwinex and Numerai prove that "merit, not luck" sells to serious traders and to capital. Both keep it inside their walls.
- The decision that follows is in [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md).

## Sources

All fetched on 2026-10-23. Company figures are self-reported.

| Source | Link |
| --- | --- |
| Grand View Research, algorithmic trading market | <https://www.grandviewresearch.com/industry-analysis/algorithmic-trading-market-report> |
| Mordor Intelligence, algorithmic trading market | <https://www.mordorintelligence.com/industry-reports/algorithmic-trading-market> |
| Grand View Research, alternative data market | <https://www.grandviewresearch.com/industry-analysis/alternative-data-market> |
| Mordor Intelligence, alternative data market | <https://www.mordorintelligence.com/industry-reports/alternative-data-market> |
| Robinhood 10-Q, Q2 2026 | <https://www.sec.gov/Archives/edgar/data/1783879/000178387926000114/hood-20260630.htm> |
| Schwab 10-Q, Q2 2026 | <https://www.sec.gov/Archives/edgar/data/316709/000031670926000031/schw-20260630.htm> |
| Interactive Brokers 10-Q, Q2 2026 | <https://www.sec.gov/Archives/edgar/data/1381197/000138119726000147/ibkr-20260630.htm> |
| FINRA Foundation, investors in a changing landscape | <https://www.finrafoundation.org/sites/finrafoundation/files/NFCS-Investor-Report-Changing-Landscape.pdf> |
| eToro F-1/A, 2025 | <https://www.sec.gov/Archives/edgar/data/1493318/000121390025039451/ea0223534-11.htm> |
| eToro 20-F, 2025 | <https://www.sec.gov/Archives/edgar/data/1493318/000121390026022034/ea0278371-20f_etoro.htm> |
| eToro Pro Investor program | <https://www.etoro.com/copytrader/popular-investor/> |
| ZuluTrade | <https://www.zulutrade.com/> |
| FTMO | <https://ftmo.com/en/> |
| Cryptohopper, home and pricing | <https://www.cryptohopper.com/>, <https://www.cryptohopper.com/pricing> |
| 3Commas, home and pricing | <https://3commas.io/>, <https://3commas.io/pricing> |
| Pionex | <https://www.pionex.com/en/> |
| Binance copy trading | <https://www.binance.com/en/copy-trading> |
| Kaiko | <https://www.kaiko.com/about-kaiko> |
| Numerai Series C and scoring | <https://blog.numer.ai/numerai-raises-30m-series-c-at-500m-valuation/>, <https://docs.numer.ai/numerai-tournament/scoring> |
| FTC, fraud losses 2024 | <https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024> |
| CFTC, AI trading bots advisory | <https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html> |
| CFTC, Mirror Trading International restitution | <https://www.cftc.gov/PressRoom/PressReleases/8772-23> |
| SEC, hypothetical performance cases 2023 and 2024 | <https://www.sec.gov/news/press-release/2023-173>, <https://www.sec.gov/newsroom/press-releases/2024-46> |
| SEC, AI washing cases | <https://www.sec.gov/newsroom/press-releases/2024-36> |
| IG UK | <https://www.ig.com/uk> |
| QuantConnect | <https://www.quantconnect.com/> |
| TradingView pricing and repainting docs | <https://www.tradingview.com/pricing/>, <https://www.tradingview.com/pine-script-docs/concepts/repainting/> |
| Composer pricing | <https://www.composer.trade/pricing> |
| QuantPad | <https://quantpad.ai/> |
| StrategyQuant X pricing | <https://strategyquant.com/pricing/> |
| Build Alpha licensing | <https://www.buildalpha.com/licensing/> |
| QuantStats | <https://github.com/ranaroussi/quantstats> |
| TradeZella, Tradervue, Edgewonk, FX Replay | <https://www.tradezella.com/pricing>, <https://www.tradervue.com/>, <https://edgewonk.com/pricing>, <https://www.fxreplay.com/pricing> |
| FX Blue | <https://www.fxblue.com/> |
| Darwinex | <https://www.darwinex.com/become-investable>, <https://www.darwinex.com/investors> |
| Collective2 | <https://trade.collective2.com/> |
| Myfxbook | <https://www.myfxbook.com/> |
| SEC Marketing Rule, 17 CFR 275.206(4)-1 | <https://www.law.cornell.edu/cfr/text/17/275.206(4)-1> |
| NFA Rule 2-29 | <https://www.nfa.futures.org/rulebook/rules.aspx?RuleID=RULE%202-29&Section=4> |

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@url-10a779e1](../REFERENCES.md#url-10a779e1): Algorithmic trading market size and share analysis (n.d.)
- [@url-fac0e504](../REFERENCES.md#url-fac0e504): Algorithmic trading market size, share and trends report (n.d.)
- [@url-2914af50](../REFERENCES.md#url-2914af50): Alternative data market size and share analysis (n.d.)
- [@url-c9da2bd1](../REFERENCES.md#url-c9da2bd1): Alternative data market size, share and trends report (n.d.)
- [@url-1b09894d](../REFERENCES.md#url-1b09894d): QuantPad home page (n.d.)
- [@url-40d7e26e](../REFERENCES.md#url-40d7e26e): NFA Compliance Rule 2-29, communications with the public and promotional material (n.d.)
- [@url-a99cdde2](../REFERENCES.md#url-a99cdde2): 17 CFR 275.206(4)-1, investment adviser marketing (n.d.)
- [@url-21b265d8](../REFERENCES.md#url-21b265d8): New FTC data show a big jump in reported losses to fraud to $12.5 billion in 2024 (n.d.)
- [@url-e0285b3b](../REFERENCES.md#url-e0285b3b): Federal court orders South African company to pay over $1.7 billion in restitution for forex fraud (n.d.)
- [@url-a1682719](../REFERENCES.md#url-a1682719): Customer Advisory: AI Won't Turn Trading Bots into Money Machines | CFTC (n.d.)
- [@url-c53f97a6](../REFERENCES.md#url-c53f97a6): SEC charges nine investment advisers in ongoing sweep into marketing rule violations (n.d.)
- [@url-be81eda4](../REFERENCES.md#url-be81eda4): SEC charges five investment advisers for marketing rule violations (n.d.)
- [@url-6c190e5d](../REFERENCES.md#url-6c190e5d): SEC charges two investment advisers with making false and misleading statements about their use of artificial intelligence (n.d.)
- [@url-9a1baa9c](../REFERENCES.md#url-9a1baa9c): eToro Group Ltd., annual report on Form 20-F for 2025 (n.d.)
- [@url-5d48f0dc](../REFERENCES.md#url-5d48f0dc): IG UK home page, retail CFD loss disclosure (n.d.)
- [@url-dd4f26d0](../REFERENCES.md#url-dd4f26d0): ZuluTrade home page (n.d.)
- [@url-dd7a6dd5](../REFERENCES.md#url-dd7a6dd5): Robinhood Markets, Form 10-Q for the quarter ended 30 June 2026 (n.d.)
- [@url-e0a49b44](../REFERENCES.md#url-e0a49b44): Charles Schwab Corporation, Form 10-Q for the quarter ended 30 June 2026 (n.d.)
- [@url-51e0556a](../REFERENCES.md#url-51e0556a): Interactive Brokers Group, Form 10-Q for the quarter ended 30 June 2026 (n.d.)
- [@url-6d753ea2](../REFERENCES.md#url-6d753ea2): FINRA Foundation, Investors in the United States: the changing landscape (2022) (n.d.)
- [@url-0521e581](../REFERENCES.md#url-0521e581): TradingView plans and pricing (n.d.)
- [@url-849471fb](../REFERENCES.md#url-849471fb): The Modern Prop Trading Firm since 2015 | FTMO (n.d.)
- [@url-579f7291](../REFERENCES.md#url-579f7291): Cryptohopper home page (n.d.)
- [@url-e95d4a55](../REFERENCES.md#url-e95d4a55): 3Commas home page (n.d.)
- [@url-7b00d723](../REFERENCES.md#url-7b00d723): QuantConnect home page (n.d.)
- [@url-fa00b2c3](../REFERENCES.md#url-fa00b2c3): TradeZella pricing (n.d.)
- [@url-03c3c09f](../REFERENCES.md#url-03c3c09f): Tradervue home page (n.d.)
- [@url-7ae24f30](../REFERENCES.md#url-7ae24f30): FX Replay pricing (n.d.)
- [@url-a8c4abb3](../REFERENCES.md#url-a8c4abb3): Binance copy trading (n.d.)
- [@url-fc1425fc](../REFERENCES.md#url-fc1425fc): Numerai Raises $30M Series C At $500M Valuation (n.d.)
- [@url-03099067](../REFERENCES.md#url-03099067): About Kaiko (n.d.)
- [@url-780a43b3](../REFERENCES.md#url-780a43b3): Pine Script user manual, repainting (n.d.)
- [@url-9d661003](../REFERENCES.md#url-9d661003): Composer pricing (n.d.)
- [@url-11e4faa9](../REFERENCES.md#url-11e4faa9): StrategyQuant X pricing (n.d.)
- [@url-950b726b](../REFERENCES.md#url-950b726b): Build Alpha pricing and licensing (n.d.)
- [@url-4eefbf30](../REFERENCES.md#url-4eefbf30): ranaroussi/quantstats (n.d.)
- [@url-8436b75b](../REFERENCES.md#url-8436b75b): Edgewonk pricing (n.d.)
- [@url-e0307c82](../REFERENCES.md#url-e0307c82): 3Commas pricing (n.d.)
- [@url-59599351](../REFERENCES.md#url-59599351): Cryptohopper pricing (n.d.)
- [@url-c5c4f9e9](../REFERENCES.md#url-c5c4f9e9): Pionex home page (n.d.)
- [@url-c4fa64dc](../REFERENCES.md#url-c4fa64dc): Myfxbook home page (n.d.)
- [@url-e132b4e4](../REFERENCES.md#url-e132b4e4): FX Blue home page (n.d.)
- [@url-23cb3eee](../REFERENCES.md#url-23cb3eee): Darwinex, become investable (n.d.)
- [@url-854779e4](../REFERENCES.md#url-854779e4): Darwinex for investors (n.d.)
- [@url-20151496](../REFERENCES.md#url-20151496): Collective2 home page (n.d.)
- [@url-e6e8d042](../REFERENCES.md#url-e6e8d042): eToro Pro Investor program (n.d.)
- [@url-41810c96](../REFERENCES.md#url-41810c96): Numerai tournament scoring (n.d.)
- [@bailey2014a](../REFERENCES.md#bailey2014a): Bailey and López de Prado (2014), The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality
- [@mclean2016](../REFERENCES.md#mclean2016): McLean and Pontiff (2016), Does Academic Research Destroy Stock Return Predictability?

## Referenced by

- [INT-0003: Parity Verify, the lie detector for trading strategies and bots](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)
- [DEC-0032: Parity Verify as a data and API business, with a free retail tier](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)
- [DEC-0047: Competitor profiles and a feedback collector that runs by itself](../decisions/0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md)
- [RES-0029: Ayan's and Abanish's plans compared, and where Parity fits](0029-ayan-s-and-abanish-s-plans-compared-and-where-parity-fits.md)
- [REF-0016: Parity Verify MVP spec](../reference/0016-parity-verify-mvp-spec.md)
- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](../competitors/0001-ux-patterns-users-praise-most.md)
- [CMP-0004: MetaTrader 4 and 5, the free broker platform most FX traders use](../competitors/0004-metatrader-4-and-5.md)
- [CMP-0005: cTrader, a modern broker platform with copy, algos and a store](../competitors/0005-ctrader.md)
- [CMP-0006: TradingView, browser charts and a social network for traders](../competitors/0006-tradingview.md)
- [CMP-0007: Interactive Brokers, a global broker with four trading apps](../competitors/0007-interactive-brokers.md)
- [CMP-0008: thinkorswim, Schwab's dense pro trading platform for options and futures traders](../competitors/0008-thinkorswim.md)
- [CMP-0009: Robinhood, the simple trading app that added a pro desktop called Legend](../competitors/0009-robinhood.md)
- [CMP-0013: Hyperliquid, an onchain exchange for crypto perpetuals and spot](../competitors/0013-hyperliquid.md)
- [CMP-0014: Binance, the largest crypto exchange with futures and copy trading](../competitors/0014-binance.md)
- [CMP-0017: eToro, a social investing broker built around copying other investors](../competitors/0017-etoro.md)
- [CMP-0018: QuantPad, an AI quant workspace that grades strategies A to F](../competitors/0018-quantpad.md)
- [CMP-0019: Myfxbook, the forex track record and analysis site traders cite](../competitors/0019-myfxbook.md)
- [CMP-0020: FX Blue, free forex account analysis and MetaTrader add-ons](../competitors/0020-fx-blue.md)
- [CMP-0021: Darwinex, a regulated broker that turns traders into risk-scaled indexes](../competitors/0021-darwinex.md)
- [CMP-0022: Collective2, a marketplace of live-tracked trading strategies](../competitors/0022-collective2.md)
- [CMP-0023: QuantConnect, cloud backtesting and live trading on open-source LEAN](../competitors/0023-quantconnect.md)
<!-- backlinks:end -->
