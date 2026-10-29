---
id: ALG-0099
title: Crack spread mean reversion (3:2:1 refining margin)
type: algorithm
status: sourced
created: 2026-10-25
updated: 2026-10-25
authors: [amanda]
tags: [commodities, strategy]
related: []
---

# Crack spread mean reversion (3:2:1 refining margin)

## In plain words

A refinery turns three barrels of crude into two of gasoline and one of heating oil. When the gap between what the products sell for and what the crude costs is unusually wide or narrow, bet that it goes back to normal.

## Summary

| | |
| --- | --- |
| Family | statistical-arbitrage |
| Markets | commodities |
| Horizon | weekly |
| Tags | energy, spread, crack-spread, cointegration, futures |
| Origin | academic: Karathanasopoulos, Dunis, Khalil |
| First published | 2016 (10 years ago) |
| Primary source | [Modelling, forecasting and trading with a new sliding window approach: the crack spread example (Quantitative Finance 16(12), 1875-1886)](https://doi.org/10.1080/14697688.2016.1211796) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: It is the one new energy idea that our existing EIA futures data can test (RES-0019 on the energy book branch), and it is a spread, so it is not another bet on the oil price. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/crack-spread-mean-reversion.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** A refinery turns three barrels of crude into two of gasoline and one of heating oil. When the gap between what the products sell for and what the crude costs is unusually wide or narrow, bet that it goes back to normal.

<details><summary>Analogy</summary>

Like a bakery's margin between flour and bread: if bread gets very expensive while flour does not, bakers make more bread until the gap closes.

</details>

<details><summary>Precise</summary>

The 3:2:1 crack spread per barrel is (2 x gasoline + 1 x heating oil, both in dollars per barrel) minus 3 x crude, divided by 3. Refiners can change how much they run, so the three prices are tied together (cointegrated) and the spread tends to mean-revert. A simple version trades the spread when its z-score against a rolling window is large; the source paper instead forecasts it five days ahead with neural networks.

</details>

### The rule

Our simple version, for testing: each week, compute the 3:2:1 crack spread from contract 2 of CL, RB and HO (products times 42 to get dollars per barrel). If the spread is more than 2 standard deviations above its 1-year mean, sell the spread (short 2 RB and 1 HO, long 3 CL); below -2, buy it; close when it crosses its mean. This rule is ours, not the paper's.

### Data needed

- Daily settlement prices of NYMEX WTI crude, RBOB gasoline and ULSD heating oil futures (EIA has contracts 1 to 4 up to 2024-04-05)

### Why it might work

Refiners and blenders can arbitrage a margin that is too wide or too narrow by changing how much crude they process, which pulls the three prices back together.

### Why it might fail

The spread has long seasonal and regime shifts (refinery outages, hurricanes, the 2022 diesel squeeze), so a mean that looked stable can move for months. The source paper picks its best model from many with 250 inputs, which is a lot of hidden trials. Gasoline changed grade (unleaded to RBOB in 2006), which breaks the history.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Karathanasopoulos, Dunis and Khalil (2016), Quantitative Finance, Table 4](https://scholarworks.aub.edu.lb/server/api/core/bitstreams/45e0cec2-3f3c-48e8-aa0c-97b4cd958818/content) | 2005-05-09 to 2015-12-21 | NYMEX 3:2:1 crack spread | n/a | 42.7% | 20.6% | -30.9% | backtest | yes | yes |

Notes on these numbers:

- **Karathanasopoulos, Dunis and Khalil (2016), Quantitative Finance, Table 4:** Best of six model variants (PSO-RBF network, 300-day training window, forecasts 5 days ahead, 250 inputs). Table 4 reports gross annualised return 52.82%, annualised volatility 20.65%, maximum drawdown -30.90%, information ratio 2.06, about 99 trades a year, transaction costs of 10.08% a year and net annualised return 42.74%. The paper says the period is 2087 trading days, which is fewer than the dates imply (about 2,670). Return and volatility recorded here are the net figures.

### After publication

Not checked by us yet. Dunis, Laws and Evans (2006, Derivatives Use, Trading and Regulation) studied the gasoline crack spread earlier; we found only secondhand summaries of it.

### Implementations

None found.

## Our research

| Stage | Status |
| --- | --- |
| 1. catalogued | done |
| 2. sourced | done |
| 3. hypothesis | not yet |
| 4. implemented | not yet |
| 5. registered | not yet |
| 6. official | not yet |
| 7. reproduced | not yet |
| 8. forward | not yet |
| 9. verdict | not yet |


Free EIA data ends 2024-04-05 and RBOB history starts in October 2005, so a test would cover about 18 years. Added by Amanda's library batch on 2026-10-25 (options, intraday and equity anomalies that retail traders and bots claim to use).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
