---
id: ALG-0042
title: Cross-sectional equity momentum (winners minus losers)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [momentum, open-source, strategy]
related: []
---

# Cross-sectional equity momentum (winners minus losers)

## In plain words

Buy the stocks that went up the most over the past year and sell the ones that went down the most.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | equities |
| Horizon | monthly |
| Tags | cross-sectional, factor, long-short, anomaly |
| Origin | academic: Jegadeesh, Titman |
| First published | 1993 (33 years ago) |
| Primary source | [Returns to Buying Winners and Selling Losers: Implications for Stock Market Efficiency](https://doi.org/10.1111/j.1540-6261.1993.tb04702.x) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: An equity factor rather than an FX strategy; mainly useful as a comparison and as evidence on how momentum decays after publication. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/equity-cross-sectional-momentum.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Buy the stocks that went up the most over the past year and sell the ones that went down the most.

<details><summary>Analogy</summary>

Like betting on the students with the best grades this year to keep doing well next term.

</details>

<details><summary>Precise</summary>

Rank stocks on past 3 to 12 month returns and hold a long-short portfolio of winners minus losers for 3 to 12 months. Jegadeesh and Titman find significant positive returns not explained by systematic risk, with partial reversal in the following two years. The Fama-French UMD factor uses returns from month t-12 to t-2.

</details>

### The rule

Each month, rank stocks by cumulative return from t-12 to t-2; go long the top 30% and short the bottom 30% (value-weighted within size groups, as in the French UMD factor); hold one month and rebalance.

### Data needed

- Monthly total returns for a broad stock universe
- Market capitalization
- Or the free UMD factor series from the Kenneth French library

### Why it might work

Investors underreact to firm news and then overreact later, so past winners keep outperforming for some months (Jegadeesh and Titman 1993, 2001).

### Why it might fail

Momentum crashes after market rebounds from panics (Daniel and Moskowitz 2016); in the French data UMD lost money from 2009 to 2026 (about -0.8% a year) and had a -78% drawdown over its history.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Our calculation from Kenneth French data library, Momentum factor (UMD)](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Momentum_Factor_CSV.zip) | 1927-01 to 2026-08 | US stocks | 0.45 | 7.3% | 16.3% | -78.4% | backtest | no | no |
| [Our calculation from Kenneth French data library, Momentum factor (UMD)](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Momentum_Factor_CSV.zip) | 1965-01 to 1989-12 | US stocks | 0.8 | 9.8% | 12.3% | -20.3% | backtest | no | no |
| [Our calculation from Kenneth French data library, Momentum factor (UMD)](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Momentum_Factor_CSV.zip) | 1993-01 to 2026-08 | US stocks | 0.29 | 4.8% | 16.6% | -57.8% | backtest | no | no |
| [Our calculation from Kenneth French data library, Momentum factor (UMD)](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Momentum_Factor_CSV.zip) | 2009-01 to 2026-08 | US stocks | -0.05 | -0.8% | 15.8% | -56.4% | backtest | no | no |

Notes on these numbers:

- **Our calculation from Kenneth French data library, Momentum factor (UMD):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Long-short factor, gross of costs.
- **Our calculation from Kenneth French data library, Momentum factor (UMD):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Matches the Jegadeesh and Titman (1993) sample window.
- **Our calculation from Kenneth French data library, Momentum factor (UMD):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After publication.
- **Our calculation from Kenneth French data library, Momentum factor (UMD):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Starts with the 2009 momentum crash.

### After publication

Jegadeesh and Titman (2001, https://doi.org/10.1111/0022-1082.00342) report that momentum profits continued in the 1990s. Over a longer span the French UMD factor's Sharpe ratio fell from about 0.80 (1965 to 1989) to about 0.29 (1993 to 2026), catalog computation. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

### Implementations

- [https://github.com/stefan-jansen/zipline-reloaded](https://github.com/stefan-jansen/zipline-reloaded) (Python, license: Apache-2.0): General event-driven backtester with a pipeline API for ranking stocks; the momentum rule must be written by the user.

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
