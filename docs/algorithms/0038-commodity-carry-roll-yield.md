---
id: ALG-0038
title: Commodity carry (roll yield / basis)
type: algorithm
status: registered
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [carry, commodities, open-source, strategy]
related: [HYP-0013]
---

# Commodity carry (roll yield / basis)

## In plain words

Some commodity futures get cheaper the further out you go, so holding them earns a small gain each month as they roll up. Buy those, and sell the ones that work the other way.

## Summary

| | |
| --- | --- |
| Family | carry |
| Markets | commodities |
| Horizon | monthly |
| Tags | cross-sectional, risk-premium, term-structure, futures |
| Origin | academic: Gorton, Rouwenhorst |
| First published | 2004 (22 years ago) |
| Primary source | [Facts and Fantasies about Commodity Futures (NBER WP 10595, 2004; Financial Analysts Journal 2006)](https://doi.org/10.2469/faj.v62.n2.4083) |
| Research stage | 5 of 9: registered |
| Relevance to us | 3 of 5: The commodity analogue of FX carry; useful as a building block and because commodity term structures can inform commodity-currency trades. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/commodity-carry-roll-yield.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Some commodity futures get cheaper the further out you go, so holding them earns a small gain each month as they roll up. Buy those, and sell the ones that work the other way.

<details><summary>Analogy</summary>

Like renting out a flat where the rent already covers the mortgage; you earn even if the flat's price stays put.

</details>

<details><summary>Precise</summary>

Carry (basis) is the annualized slope between near and next futures prices. Backwardated commodities (high carry) tend to have low inventories and earn higher future returns; a long-short portfolio sorted on carry earns a premium. Koijen, Moskowitz, Pedersen and Vrugt show the same carry signal predicts returns across many asset classes.

</details>

### The rule

Each month end, compute basis = (F_near / F_next - 1) annualized for each commodity; go long the half (or top third) with the highest basis and short the lowest, equal-weighted or rank-weighted; roll before delivery; rebalance monthly.

### Data needed

- Front and second-month futures prices for 20 or more commodities, daily or monthly
- T-bill rate for collateral return

### Why it might work

Low inventories raise both backwardation and expected returns, compensating holders for price risk (Gorton and Rouwenhorst 2006; Koijen et al. 2018).

### Why it might fail

Carry trades crash together in global recessions (Koijen et al. 2018), and AQR's commodity carry series had an 87% peak to trough loss over its history in the catalog's computation.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Gorton and Rouwenhorst (2004 NBER version), Table 8, High minus Low basis](https://www.nber.org/system/files/working_papers/w10595/w10595.pdf) | 1959-07 to 2004-12 | Commodity futures | 0.76 | 10.0% | 13.2% | n/a | backtest | no | yes |
| [Bhardwaj, Gorton and Rouwenhorst (2015), Table 4, High minus Low basis, out of sample](https://www.nber.org/system/files/working_papers/w21243/w21243.pdf) | 2005-01 to 2014-12 | Commodity futures | 1.04 | 10.4% | 10.0% | n/a | backtest | no | yes |
| [Koijen, Moskowitz, Pedersen and Vrugt, Carry (NBER WP 19325), Table II](https://www.nber.org/system/files/working_papers/w19325/w19325.pdf) | 1980 to 2012-09 | Commodity futures | 0.6 | 11.2% | 18.8% | n/a | backtest | no | yes |
| [Our calculation from AQR Century of Factor Premia dataset (Commodities Carry)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Century-of-Factor-Premia-Monthly.xlsx) | 1926-07 to 2026-02 | Commodity futures | 0.3 | 5.2% | 17.0% | -86.7% | backtest | no | no |
| [Our calculation from AQR Century of Factor Premia dataset (Commodities Carry)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Century-of-Factor-Premia-Monthly.xlsx) | 2013-01 to 2026-02 | Commodity futures | 0.2 | 3.5% | 17.9% | -50.7% | backtest | no | no |

Notes on these numbers:

- **Gorton and Rouwenhorst (2004 NBER version), Table 8, High minus Low basis:** Annualized monthly returns of high-basis minus low-basis halves.
- **Bhardwaj, Gorton and Rouwenhorst (2015), Table 4, High minus Low basis, out of sample:** Ten-year out-of-sample check of the original basis strategy.
- **Koijen, Moskowitz, Pedersen and Vrugt, Carry (NBER WP 19325), Table II:** Long-short commodity carry; passive equal-weight commodities over the same span had a Sharpe ratio of 0.08.
- **Our calculation from AQR Century of Factor Premia dataset (Commodities Carry):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding.
- **Our calculation from AQR Century of Factor Premia dataset (Commodities Carry):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After the Koijen et al. working paper.

### After publication

Bhardwaj, Gorton and Rouwenhorst (2015) find the high minus low basis spread held up out of sample (10.41% a year, Sharpe 1.04, 2005 to 2014), while the long-only commodity risk premium fell to 3.67% a year (Sharpe 0.24). In AQR's century dataset, commodity carry earned a Sharpe ratio of about 0.20 from 2013 to early 2026 (catalog computation).

### Implementations

- [https://github.com/pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) (Python, license: GPL-3.0): Futures trading framework by Rob Carver; the provided rules folder includes ewmac.py (trend) and carry.py. Repo moved from robcarver17/pysystemtrade.

## Our research

| Stage | Status |
| --- | --- |
| 1. catalogued | done |
| 2. sourced | done |
| 3. hypothesis | done |
| 4. implemented | done |
| 5. registered | done |
| 6. official | not yet |
| 7. reproduced | not yet |
| 8. forward | not yet |
| 9. verdict | not yet |

- Hypothesis: [HYP-0013](../hypotheses/0013-energy-futures-carry-pays.md)
- Strategy in the engine: `energy_carry`
- Registration: [REG-0007](../../registrations/REG-0007-energy-futures-trend-and-carry.json)

 Registered on 2026-10-21 as REG-0007 (energy_carry), not yet run.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0015: Combining many strategies, the evidence and the ingredient list](../research/0015-combining-many-strategies-the-evidence-and-the-ingredient-list.md)
<!-- backlinks:end -->
