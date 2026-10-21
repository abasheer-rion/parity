---
id: ALG-0039
title: Commodity time-series momentum
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, momentum, open-source, strategy]
related: []
---

# Commodity time-series momentum

## In plain words

Look at each commodity, like oil or wheat. If its price rose over the last year, buy it; if it fell, sell it.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | commodities |
| Horizon | monthly |
| Tags | time-series-momentum, futures, volatility-scaling, trend |
| Origin | academic: Moskowitz, Ooi, Pedersen |
| First published | 2012 (14 years ago) |
| Primary source | [Time Series Momentum (Journal of Financial Economics)](https://doi.org/10.1016/j.jfineco.2011.11.003) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: Commodity trends feed commodity currencies (AUD, CAD, NOK), so this is a useful signal source and comparison for parity. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/commodity-time-series-momentum.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Look at each commodity, like oil or wheat. If its price rose over the last year, buy it; if it fell, sell it.

<details><summary>Analogy</summary>

Like a weather forecaster who says tomorrow will be like the last few days, and is right more often than not.

</details>

<details><summary>Precise</summary>

For each commodity future, the sign of its trailing 12-month excess return sets a long or short position, scaled to a constant ex ante volatility, with a one month holding period. Moskowitz, Ooi and Pedersen find that commodity TSMOM has a significant alpha (0.57% per month) even after controlling for cross-sectional commodity momentum.

</details>

### The rule

Each month, for each commodity future, go long if its past 12-month excess return is positive and short if negative; size each position at 40% annualized ex ante volatility divided by the number of contracts (or scale the sleeve to a target); hold one month.

### Data needed

- Rolled front-month commodity futures returns, daily
- T-bill rate

### Why it might work

Slow diffusion of supply and demand news and hedger flows make commodity trends persist; speculators profit from TSMOM at the expense of hedgers (Moskowitz, Ooi and Pedersen 2012).

### Why it might fail

Commodity trends reverse sharply around supply shocks and policy events; in AQR's own data the commodity sleeve earned a Sharpe ratio of about 0.21 from 2012 to mid 2026, versus about 1.0 before 2010 (catalog computation).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx) | 1985-01 to 2026-05 | Commodity futures | 0.65 | 9.7% | 14.9% | -46.3% | backtest | unclear | no |
| [Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx) | 1985-01 to 2009-12 | Commodity futures | 1.01 | 14.1% | 13.9% | -19.6% | backtest | unclear | no |
| [Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx) | 2012-01 to 2026-05 | Commodity futures | 0.21 | 3.1% | 15.3% | -46.3% | backtest | unclear | no |
| [Moskowitz, Ooi and Pedersen (2012), TSMOM vs XSMOM regression table, Panel A](https://pages.stern.nyu.edu/~lpederse/papers/TimeSeriesMomentum.pdf) | 1985-2009 | Commodity futures | n/a | n/a | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Gross of costs as far as the dataset states.
- **Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Roughly the original paper's sample.
- **Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After publication.
- **Moskowitz, Ooi and Pedersen (2012), TSMOM vs XSMOM regression table, Panel A:** Regression of commodity TSMOM on cross-sectional commodity momentum: monthly intercept (alpha) 0.57%, t = 4.43. No Sharpe ratio for the commodity sleeve was read on the page.

### After publication

The commodity sleeve of AQR's TSMOM data dropped from a Sharpe ratio near 1.0 (1985 to 2009) to about 0.21 (2012 to 2026-05) in the catalog's computation. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

### Implementations

- [https://github.com/pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) (Python, license: GPL-3.0): Futures trading framework by Rob Carver; the provided rules folder includes ewmac.py (trend) and carry.py. Repo moved from robcarver17/pysystemtrade.

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
