---
id: ALG-0051
title: Combined trend and carry portfolio
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, fx, open-source, strategy]
related: []
---

# Combined trend and carry portfolio

## In plain words

Run two simple ideas side by side: follow price trends, and own things that pay you to hold them. They tend to lose at different times, so together they are smoother.

## Summary

| | |
| --- | --- |
| Family | portfolio-construction |
| Markets | multi-asset, fx, commodities, rates, equities |
| Horizon | monthly |
| Tags | carry, time-series-momentum, diversification, multi-factor |
| Origin | academic: Koijen, Moskowitz, Pedersen, Vrugt |
| First published | 2013 (13 years ago) |
| Primary source | [Carry (NBER WP 19325, 2013; Journal of Financial Economics 2018)](https://doi.org/10.1016/j.jfineco.2017.11.002) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 5 of 5: FX carry plus FX trend is the most common systematic currency recipe, so this is the most direct multi-asset template and comparison for parity. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/trend-plus-carry-combined.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Run two simple ideas side by side: follow price trends, and own things that pay you to hold them. They tend to lose at different times, so together they are smoother.

<details><summary>Analogy</summary>

Like owning both an umbrella shop and an ice cream stand: one of them usually has a good day.

</details>

<details><summary>Precise</summary>

Allocate between a diversified time-series momentum strategy and a global carry factor (long high-carry, short low-carry within equities, bonds, currencies and commodities). Koijen et al. find carry strategies have little time-series momentum exposure, so the two returns have low correlation and the mix has a higher Sharpe ratio than either alone.

</details>

### The rule

Each month, run a 12-month time-series momentum book and a cross-sectional carry book in each asset class (each scaled to equal ex ante volatility); hold them in equal risk (or simple 50/50 weights) and rebalance monthly.

### Data needed

- Futures and forward prices across asset classes
- Interest rates and futures curves to compute carry
- Or the free AQR TSMOM and Century of Factor Premia datasets

### Why it might work

Carry earns a risk premium and trend earns a behavioral premium; Koijen et al. (2018) show carry returns are largely unrelated to time-series momentum, so combining them diversifies.

### Why it might fail

Both legs weakened after publication: in AQR's data the All Macro carry factor had a Sharpe ratio of about -0.13 from 2013 to early 2026, and the 50/50 combination about 0.33 (catalog computation).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Koijen, Moskowitz, Pedersen and Vrugt, Carry (NBER WP 19325), Table II, global carry factor](https://www.nber.org/system/files/working_papers/w19325/w19325.pdf) | varies by asset class, ending 2012-09 | Equities, bonds, currencies, commodities, credit, options | 1.1 | 6.8% | 6.1% | n/a | backtest | no | yes |
| [Our calculation from Catalog computation: 50/50 AQR TSMOM and AQR All Macro Carry](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Century-of-Factor-Premia-Monthly.xlsx) | 1985-01 to 2026-02 | Equity indices, bonds, currencies, commodities | 1.06 | 7.1% | 6.7% | -18.7% | backtest | no | no |
| [Our calculation from Catalog computation: 50/50 AQR TSMOM and AQR All Macro Carry](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Century-of-Factor-Premia-Monthly.xlsx) | 2013-01 to 2026-02 | Equity indices, bonds, currencies, commodities | 0.33 | 2.2% | 6.9% | -18.7% | backtest | no | no |

Notes on these numbers:

- **Koijen, Moskowitz, Pedersen and Vrugt, Carry (NBER WP 19325), Table II, global carry factor:** Carry legs weighted by inverse full-sample volatility (hindsight in weights). Passive equal-weight exposure to the same assets: Sharpe 0.47.
- **Our calculation from Catalog computation: 50/50 AQR TSMOM and AQR All Macro Carry:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Equal dollar weights on the two factor return series; TSMOM from https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx. Correlation between the legs 0.10. Same window: TSMOM alone Sharpe 0.97, carry alone 0.55. TSMOM dominates the risk because its volatility (12.5%) is far above carry's (3.7%).
- **Our calculation from Catalog computation: 50/50 AQR TSMOM and AQR All Macro Carry:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After the Carry working paper.

### After publication

In the catalog's computation from AQR data, the All Macro carry factor earned a Sharpe ratio of about 0.61 up to 2012 and about -0.13 from 2013 to early 2026, and currency carry fell from about 0.50 to 0.18. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

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
