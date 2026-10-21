---
id: ALG-0045
title: Pairs trading (distance method)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [open-source, strategy]
related: []
---

# Pairs trading (distance method)

## In plain words

Find two stocks whose prices usually move together. When they drift apart, buy the cheap one and sell the expensive one, and wait for them to come back together.

## Summary

| | |
| --- | --- |
| Family | statistical-arbitrage |
| Markets | equities |
| Horizon | daily |
| Tags | mean-reversion, relative-value, market-neutral, long-short |
| Origin | academic: Gatev, Goetzmann, Rouwenhorst |
| First published | 1999 (27 years ago) |
| Primary source | [Pairs Trading: Performance of a Relative-Value Arbitrage Rule (NBER WP 7032, 1999; Review of Financial Studies 2006)](https://doi.org/10.1093/rfs/hhj020) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: Mostly an equity method, but the same spread logic can be tried on related currency pairs such as AUD and NZD. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/pairs-trading-distance.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Find two stocks whose prices usually move together. When they drift apart, buy the cheap one and sell the expensive one, and wait for them to come back together.

<details><summary>Analogy</summary>

Like two dogs on one leash: when they pull apart you bet they will soon walk side by side again.

</details>

<details><summary>Precise</summary>

In a 12-month formation period, each stock is matched with the partner that minimizes the sum of squared differences in normalized price paths. In the next 6 months, a position opens when the spread exceeds two historical standard deviations and closes when prices cross. Gatev, Goetzmann and Rouwenhorst link profits to a common latent factor rather than to simple reversal.

</details>

### The rule

Formation: 12 months of normalized total return indices; pick the 20 pairs with the smallest sum of squared spread. Trading: next 6 months; open long the loser and short the winner when the spread exceeds 2 formation-period standard deviations; close when the normalized prices cross or at period end.

### Data needed

- Daily total returns for a stock universe
- Liquidity filters (exclude days with no trades)

### Why it might work

Temporary mispricing of close substitutes, linked to a common factor, is corrected over weeks (Gatev, Goetzmann and Rouwenhorst 2006).

### Why it might fail

Profits have trended down as the method spread (Do and Faff 2010), and waiting one day after the signal cut excess returns by about 200 basis points in the original working paper, showing sensitivity to execution and bid-ask bounce.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Gatev, Goetzmann and Rouwenhorst (2006), RFS abstract](https://doi.org/10.1093/rfs/hhj020) | 1962-2002 | US stocks | n/a | 11.0% | n/a | n/a | backtest | no | yes |
| [Gatev, Goetzmann and Rouwenhorst (1999), NBER WP 7032](https://www.nber.org/system/files/working_papers/w7032/w7032.pdf) | 1962-1997 | US stocks, top pairs portfolios | n/a | 12.0% | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Gatev, Goetzmann and Rouwenhorst (2006), RFS abstract:** Abstract: average annualized excess returns of up to 11% for self-financing portfolios of pairs; profits typically exceed conservative transaction-cost estimates. Abstract text read via the OpenAlex record for this DOI.
- **Gatev, Goetzmann and Rouwenhorst (1999), NBER WP 7032:** About 12% average annualized excess return for top-pairs portfolios; annualized standard deviations of 4% to 6%; a one-day delay in trading lowered excess returns by about 200 basis points.

### After publication

Do and Faff (2010, https://doi.org/10.2469/faj.v66.n4.1) confirm a continuing downward trend in pairs trading profits, though the strategy did well in long turbulent periods including the 2008 crisis. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

### Implementations

- [https://github.com/hudson-and-thames/arbitragelab](https://github.com/hudson-and-thames/arbitragelab) (Python, license: BSD-3-Clause): Includes a distance_approach module (basic and Pearson distance methods).
- [https://github.com/wywongbd/pairstrade-fyp-2019](https://github.com/wywongbd/pairstrade-fyp-2019) (Python, license: MIT): Student project testing distance, cointegration and reinforcement learning pairs methods.

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

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
