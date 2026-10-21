---
id: ALG-0040
title: Dual momentum (Antonacci global equities momentum)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [momentum, open-source, strategy]
related: []
---

# Dual momentum (Antonacci global equities momentum)

## In plain words

Each month, pick whichever stock market did better over the past year, US or the rest of the world. If even the winner did worse than safe cash, hide in bonds instead.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | equities, multi-asset |
| Horizon | monthly |
| Tags | relative-momentum, absolute-momentum, tactical-allocation, etf |
| Origin | practitioner: Antonacci |
| First published | 2012 (14 years ago) |
| Primary source | [Risk Premia Harvesting Through Dual Momentum (SSRN); book Dual Momentum Investing (2014)](https://doi.org/10.2139/ssrn.2042750) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: A simple, popular attempt to beat the S&P 500 by switching assets, and the same relative plus absolute logic can be applied across currencies. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/dual-momentum.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Each month, pick whichever stock market did better over the past year, US or the rest of the world. If even the winner did worse than safe cash, hide in bonds instead.

<details><summary>Analogy</summary>

Like choosing between two runners by their recent times, but staying home if both are slower than walking.

</details>

<details><summary>Precise</summary>

Relative (cross-sectional) momentum chooses the stronger of US and non-US equities over a 12-month lookback; absolute (time-series) momentum then compares the winner's excess return with T-bills and switches to bonds when it is negative. The aim is to keep most of the equity premium while stepping aside in long bear markets.

</details>

### The rule

Each month end: compute 12-month total returns of US equities and non-US equities; take the higher one; if it beats the 12-month T-bill return hold that equity index next month, otherwise hold aggregate US bonds. (Rule as commonly described for Antonacci's GEM; the catalog could not open the original paper.)

### Data needed

- US equity index total return, monthly
- Non-US developed or all-world ex US equity index total return, monthly
- T-bill rate
- Aggregate bond index total return

### Why it might work

It combines cross-sectional momentum (Jegadeesh and Titman 1993) with time-series momentum (Moskowitz, Ooi and Pedersen 2012), both documented across assets.

### Why it might fail

It holds only one or two assets and trades on one signal, so a few whipsaws dominate results; in the catalog's simplified test it lagged the US market badly after 2013 (8.4% vs 15.0% a year).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Our calculation from Catalog computation, simplified dual momentum on Kenneth French data](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_ex_US_3_Factors_CSV.zip) | 1991-07 to 2026-08 | US market vs developed ex US market, T-bills as the safe asset | 0.63 | 10.1% | 12.5% | -23.2% | backtest | no | no |
| [Our calculation from Catalog computation, simplified dual momentum on Kenneth French data](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_ex_US_3_Factors_CSV.zip) | 2013-01 to 2026-08 | US market vs developed ex US market, T-bills as the safe asset | 0.57 | 8.4% | 12.8% | -23.2% | backtest | no | no |

Notes on these numbers:

- **Our calculation from Catalog computation, simplified dual momentum on Kenneth French data:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Simplified variant: uses T-bills, not bonds, as the safe asset and French market factors, not MSCI indices. annual_return is compound total return. Same window US market: 11.26% a year, volatility 15.1%, Sharpe 0.62, max drawdown -50.3%. About 50 switches in 422 months. US data from https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip.
- **Our calculation from Catalog computation, simplified dual momentum on Kenneth French data:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Same window US market: 14.98% a year, Sharpe 0.91, max drawdown -24.8%.

### After publication

In the catalog's simplified replication, the strategy kept a similar Sharpe ratio to the US market over 1991 to 2026 with less than half the drawdown, but after 2013 it trailed the US market by about 6.6 percentage points a year. The catalog could not read Antonacci's own reported figures (SSRN and optimalmomentum.com returned access errors).

### Implementations

- [https://github.com/DamienGlobal/dual-momentum-portfolio](https://github.com/DamienGlobal/dual-momentum-portfolio) (unknown, license: MIT): Small personal web app for the Antonacci strategy; not reviewed for correctness.

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
