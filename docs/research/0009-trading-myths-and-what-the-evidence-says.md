---
id: RES-0009
title: Trading myths and what the evidence says
type: research
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [fx, method]
related: [RES-0006, REF-0004, REF-0012]
---

# Trading myths and what the evidence says

## In plain words

Many things people believe about trading sound sensible but do not hold up when someone checks the numbers. We collected 26 common beliefs and looked for the best study or official figure on each. Most of them are wrong or only partly true. A few have some support, but less than people think. Each belief also has an entry in the [glossary](../reference/0004-glossary.md#myths-and-false-notions) so the dashboard can show it.

## Summary

Gathered 2026-10-21. This page builds on [RES-0006](0006-courses-and-trader-beliefs.md), which looked at what trading courses teach. Here we look at beliefs themselves, one row each, with the source we trust most. Of 26 beliefs, we rate 20 as false, 3 as partly true, 2 as unproven and 1 ("most traders fail") as true. The strongest evidence is on retail losses (regulators and large account studies), on overtrading and on the disposition effect. The weakest is on patterns traders use every day (Fibonacci levels, single candles), where we found few large tests at all. We checked each source's details and abstract against the publisher record; sources whose claims we could not see are marked unchecked in the bibliography, and the claims that rest on them are worded as such. See [what we could not check](#what-we-could-not-check).

## How to read the table

- **Verdict** is our reading of the evidence, not a final word. "False" means the best large studies we found contradict the belief. "Partly" means there is real support for a narrow version. "Unproven" means we found no large test either way, or tests that disagree.
- **Source** is the study or official figure we lean on most. Numbers are quoted from the source abstracts or headline findings.
- **Test here** says whether our engine can check the belief on our own FX data.

## Beliefs about who wins

| Belief | Verdict | What the evidence says | Source | Test here |
| --- | --- | --- | --- | --- |
| If you keep at it, you will eventually make money | False | 97% of Brazilians who day traded futures on more than 300 days lost money; fewer than 1% of Taiwanese day traders were predictably profitable after fees | [@url-9d8bddf7; @url-1f7e3d9c] | No (needs account data) |
| Most retail CFD and FX accounts make money | False | ESMA found 74 to 89% of retail CFD accounts typically lose money | [@url-46fb23ac] | No |
| Trading more often makes more money | False | The most active US households earned 11.4% a year against 17.9% for the market | [@barber2000] | Yes, by varying turnover |
| Experts and gurus can forecast the market | False | Mutual fund persistence is almost fully explained by factors and costs, with no support for skilled managers; classic forecaster studies agree but are not yet checked | [@carhart1997; @cowles1933; @tetlock2005] | No |
| Last year's best fund or trader will stay on top | False | Mutual fund persistence is mostly explained by common factors and costs; only the worst funds stay bad | [@carhart1997] | No |
| Buying the market means any single stock will do | False | Most US stocks since 1926 returned less than Treasury bills; about 4% of firms made all the net gain | [@bessembinder2018] | No (stocks, not FX) |

## Beliefs about charts and signals

| Belief | Verdict | What the evidence says | Source | Test here |
| --- | --- | --- | --- | --- |
| Candlestick patterns reliably predict the next move | Unproven | No value on Dow Jones stocks (1992 to 2002); some patterns worked in S&P 500 stocks (1992 to 1996) and Taiwan stocks; many patterns are tried, so some will look good by chance | [@marshall2005; @caginalp1998a; @lu2012; @sullivan1999] | Yes, see [REF-0012](../reference/0012-candlesticks-and-chart-patterns.md) |
| Support and resistance are pure superstition | Partly false | Published FX levels predicted intraday trend stops better than random levels, and orders cluster at round numbers; the effect is small and short-lived | [@osler2000; @osler2003] | Partly (needs intraday data) |
| Fibonacci levels are where price turns | Unproven | We found no peer-reviewed large-sample test supporting it | [@park2007] (general review) | Yes |
| Moving average rules still beat FX | Partly | They made money in the 1970s and 1980s and faded after the early 1990s | [@neely2009] | Yes, [ALG-0014](../algorithms/0014-fx-technical-trading-rules.md) |
| Head and shoulders tops predict falls in FX | Partly | Profitable on daily dollar rates from 1973 to 1994, but beaten by simpler trading rules | [@chang1999] | Yes |
| The right indicator settings will make it work | False | The best of many tried settings looks good by chance; popular rules shrink once the search is counted | [@sullivan1999; @bailey2016] | Yes, deflated Sharpe |
| A great backtest proves a strategy works | False | New factors should need a t-statistic above about 3; selected backtests are often overfit | [@harvey2015; @bailey2016] | Yes |
| Once found, an edge keeps working | False | Stock return predictors earned 26% less out of sample and 58% less after publication | [@mclean2016] | Yes, forward test |

## Beliefs about risk and sizing

| Belief | Verdict | What the evidence says | Source | Test here |
| --- | --- | --- | --- | --- |
| More leverage means more profit | False | Long-run growth is roughly mean return minus half the variance, so past a point more leverage lowers growth and raises the risk of ruin | [@thorp2008; @messmore1995] | Yes, by simulation |
| A high win rate means a good strategy | False | Expectancy needs win rate and win and loss sizes together; carry has many small wins and rare crashes | [@brunnermeier2008] | Yes |
| A stop loss caps your loss exactly | False | Stops fill at the next price; on 15 January 2015 the franc jumped past many stops when the SNB removed its floor | [@snb2015] | Yes, with gap data |
| Huge moves are too rare to worry about | False | Price changes follow fatter-tailed laws than a bell curve | [@mandelbrot1963] | Yes |
| Trading many dollar pairs spreads your risk | False | The dollar is on one side of 89.2% of FX trades, and a common dollar factor drives much of currency returns | [@bis2025; @lustig2011] | Yes, correlation check |
| Carry is free money | False | Carry pays on average but crashes when positions unwind together | [@brunnermeier2008] | Yes, [ALG-0001](../algorithms/0001-fx-carry-g10.md) |
| High-interest currencies fall by the rate gap | False | They tended to hold or gain value instead (the forward premium puzzle) | [@fama1984] | Yes |

## Beliefs about the mind

| Belief | Verdict | What the evidence says | Source | Test here |
| --- | --- | --- | --- | --- |
| It is not a loss until you sell | False | Investors strongly preferred selling winners to selling losers, and later returns did not justify it | [@odean1998] | No |
| After a losing streak, a win is due | False | Independent outcomes do not self-correct; streaks are common in random data | [@tversky1971] | Yes, streak test |
| Strong feelings give you conviction | False (small study) | Day traders with stronger emotional reactions had worse results | [@lo2005] | No |
| You can trade the news before the market reacts | False | Announcement surprises make FX rates jump at release time | [@andersen2003] | Partly |
| "Most traders fail" | True | See the first two rows. This one holds up. | [@url-46fb23ac] | No |

## What the beliefs have in common

1. Most of them confuse a story with a rate. A vivid winner or a perfect chart is easy to remember; the base rate of losing accounts is not ([availability heuristic](../reference/0004-glossary.md#availability-heuristic), [base rate](../reference/0004-glossary.md#base-rate)).
2. Several come from looking at too few cases. One good month, three candles or a hot streak is a small sample ([law of small numbers](../reference/0004-glossary.md#law-of-small-numbers)).
3. The beliefs about risk all ignore that losses compound. A 50% loss needs a 100% gain to recover ([recovery math](../reference/0004-glossary.md#recovery-math)).
4. Where a belief has some support (support and resistance, early trend rules), the support is narrow, small and usually from before the 1990s.

## What we could not check

- On 2026-10-21 we checked authors, year, title and journal for every paper against Crossref or OpenAlex, and read the abstract or text where one was open. Three DOIs were wrong and are fixed.
- Sources marked "unchecked" in [REFERENCES.md](../REFERENCES.md) are ones whose claim we could not see: mostly books, and papers with no open abstract. Each has a note saying why.
- The ESMA page blocked our reader; we rely on the existing record that was checked earlier.
- The verdicts on Fibonacci levels and candlestick patterns rest on few or conflicting tests. A good large test could change them.

## Next

- Run the beliefs marked "Yes" in the table through our engine on G10 data, starting with candlestick rules and the many-pairs correlation check.
- Read the unchecked sources in a library and update their verification status.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@url-9d8bddf7](../REFERENCES.md#url-9d8bddf7): Chague, De-Losso and Giovannetti, 2020, SSRN 3423101 (n.d.)
- [@url-1f7e3d9c](../REFERENCES.md#url-1f7e3d9c): Barber, Lee, Liu, Odean and Zhang (2017 version), Do day traders rationally learn about their ability? (n.d.)
- [@url-46fb23ac](../REFERENCES.md#url-46fb23ac): ESMA agrees to prohibit binary options and restrict CFDs to protect retail investors (n.d.)
- [@barber2000](../REFERENCES.md#barber2000): Barber and Odean (2000), Trading Is Hazardous to Your Wealth: The Common Stock Investment Performance of Individual Investors
- [@carhart1997](../REFERENCES.md#carhart1997): Carhart (1997), On Persistence in Mutual Fund Performance
- [@cowles1933](../REFERENCES.md#cowles1933): Cowles (1933), Can Stock Market Forecasters Forecast?
- [@tetlock2005](../REFERENCES.md#tetlock2005): Tetlock (2005), Expert Political Judgment: How Good Is It? How Can We Know?
- [@bessembinder2018](../REFERENCES.md#bessembinder2018): Bessembinder (2018), Do stocks outperform Treasury bills?
- [@marshall2005](../REFERENCES.md#marshall2005): Marshall (2005), Candlestick technical trading strategies: can they create value for investors? (PhD thesis)
- [@caginalp1998a](../REFERENCES.md#caginalp1998a): Caginalp and Laurent (1998), The predictive power of price patterns
- [@lu2012](../REFERENCES.md#lu2012): Lu et al. (2012), Profitable candlestick trading strategies: The evidence from a new perspective
- [@sullivan1999](../REFERENCES.md#sullivan1999): Sullivan et al. (1999), Data-Snooping, Technical Trading Rule Performance, and the Bootstrap
- [@osler2000](../REFERENCES.md#osler2000): Osler (2000), https://www.newyorkfed.org/medialibrary/media/research/epr/00v06n2/0007osle.pdf
- [@osler2003](../REFERENCES.md#osler2003): Osler (2003), Currency Orders and Exchange Rate Dynamics: An Explanation for the Predictive Success of Technical Analysis
- [@park2007](../REFERENCES.md#park2007): Park and Irwin (2007), What Do We Know About the Profitability of Technical Analysis?
- [@neely2009](../REFERENCES.md#neely2009): Neely et al. (2009), https://s3.amazonaws.com/real.stlouisfed.org/wp/2006/2006-046.pdf
- [@chang1999](../REFERENCES.md#chang1999): Chang and Osler (1999), Methodical Madness: Technical Analysis and the Irrationality of Exchange-Rate Forecasts
- [@bailey2016](../REFERENCES.md#bailey2016): Bailey et al. (2016), The probability of backtest overfitting
- [@harvey2015](../REFERENCES.md#harvey2015): Harvey et al. (2015), ... and the Cross-Section of Expected Returns
- [@mclean2016](../REFERENCES.md#mclean2016): McLean and Pontiff (2016), Does Academic Research Destroy Stock Return Predictability?
- [@thorp2008](../REFERENCES.md#thorp2008): Thorp (2008), The Kelly criterion in blackjack, sports betting and the stock market
- [@messmore1995](../REFERENCES.md#messmore1995): Messmore (1995), Variance Drain
- [@brunnermeier2008](../REFERENCES.md#brunnermeier2008): Brunnermeier et al. (2008), Carry Trades and Currency Crashes
- [@snb2015](../REFERENCES.md#snb2015): Swiss National Bank (2015), Swiss National Bank discontinues minimum exchange rate and lowers interest rate to -0.75%
- [@mandelbrot1963](../REFERENCES.md#mandelbrot1963): Mandelbrot (1963), The Variation of Certain Speculative Prices
- [@bis2025](../REFERENCES.md#bis2025): Bank for International Settlements (2025), OTC foreign exchange turnover in April 2025, Triennial Central Bank Survey
- [@lustig2011](../REFERENCES.md#lustig2011): Lustig et al. (2011), Common Risk Factors in Currency Markets
- [@fama1984](../REFERENCES.md#fama1984): Fama (1984), Forward and spot exchange rates
- [@odean1998](../REFERENCES.md#odean1998): Odean (1998), Are Investors Reluctant to Realize Their Losses?
- [@tversky1971](../REFERENCES.md#tversky1971): Tversky and Kahneman (1971), Belief in the law of small numbers
- [@lo2005](../REFERENCES.md#lo2005): Lo et al. (2005), Fear and Greed in Financial Markets: A Clinical Study of Day-Traders
- [@andersen2003](../REFERENCES.md#andersen2003): Andersen et al. (2003), Micro Effects of Macro Announcements: Real-Time Price Discovery in Foreign Exchange

## Referenced by

- [RES-0011: Where market edges come from and which survive](0011-where-market-edges-come-from-and-which-survive.md)
- [REF-0012: Candlesticks and chart patterns](../reference/0012-candlesticks-and-chart-patterns.md)
- [LOG-0005: Ayan work log, site rebuild, research expansion and sign-in](../log/2026-10-21-ayan-work-log-site-rebuild-research-expansion-and-sign-in.md)
<!-- backlinks:end -->
