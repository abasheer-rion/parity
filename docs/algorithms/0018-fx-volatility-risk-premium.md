---
id: ALG-0018
title: FX volatility risk premium sort
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, strategy]
related: []
---

# FX volatility risk premium sort

## In plain words

For each currency, compare how jumpy options traders expect it to be with how jumpy it has actually been. Buy the currencies where insurance against big moves is cheap and sell the ones where it is expensive.

## Summary

| | |
| --- | --- |
| Family | volatility |
| Markets | fx |
| Horizon | monthly |
| Tags | cross-sectional, options-implied, risk-premium, currency-portfolios |
| Origin | academic: Della Corte, Ramadorai and Sarno |
| First published | 2013 (13 years ago) |
| Primary source | [Volatility risk premia and exchange rate predictability (Journal of Financial Economics 120(1), 2016)](https://doi.org/10.1016/j.jfineco.2016.02.015) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: Strong and diversifying in the paper, but needs FX options data that is rarely free, which limits a student POC. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/fx-volatility-risk-premium.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** For each currency, compare how jumpy options traders expect it to be with how jumpy it has actually been. Buy the currencies where insurance against big moves is cheap and sell the ones where it is expensive.

<details><summary>Analogy</summary>

Like house insurance: if people are paying a lot to insure houses in one town, they are worried about it, and that worry tends to show up later in prices.

</details>

<details><summary>Precise</summary>

The currency volatility risk premium is expected realized volatility minus model-free implied volatility from options. Sorting currencies monthly on the 1-year VRP and going long the cheapest-to-insure quintile and short the most expensive predicts spot rate changes, with low correlation to carry, momentum and value.

</details>

### The rule

At each month end compute, for each currency vs USD, the 1-year volatility risk premium (realized volatility proxy minus model-free implied volatility). Buy the top 20 percent (highest VRP, cheapest insurance) and sell the bottom 20 percent, equal weighted, using forwards; rebalance monthly.

### Data needed

- Monthly FX spot and 1-month forward rates
- FX option implied volatilities (ATM, risk reversals, butterflies) at 1-year tenor
- Daily spot rates for realized volatility

### Why it might work

Della Corte, Ramadorai and Sarno link returns to the cost of insuring currency volatility: hedging demand and limits to arbitrage in options spill into spot prices, so expensive insurance predicts depreciation.

### Why it might fail

The sample is short (1998-2013, 16 years) and options data is costly. Hutchinson et al. (2022) found that carry, momentum and value currency strategies stopped working after publication, and VRP may face the same learning, though no direct test of VRP after 2016 was found.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Della Corte, Ramadorai and Sarno (2016), Table 3, developed currencies](https://openaccess.city.ac.uk/id/eprint/13156/1/VRP_Paper_18Feb2015%20%28with%20Figures%29.pdf) | Jan 1998 - Dec 2013 | 10 developed currencies vs USD | 0.61 | 5.0% | 8.2% | -17.0% | backtest | yes | yes |
| [Della Corte, Ramadorai and Sarno (2016), Table 3, developed and emerging](https://openaccess.city.ac.uk/id/eprint/13156/1/VRP_Paper_18Feb2015%20%28with%20Figures%29.pdf) | Jan 1998 - Dec 2013 | Developed plus liquid emerging currencies | 0.51 | 4.2% | 8.1% | -24.4% | backtest | yes | yes |

Notes on these numbers:

- **Della Corte, Ramadorai and Sarno (2016), Table 3, developed currencies:** Net of bid-ask costs. Spot component alone 5.45 percent a year. Accepted manuscript version; signs read from a text extraction that drops minus signs, so values are as reported positive.
- **Della Corte, Ramadorai and Sarno (2016), Table 3, developed and emerging:** Same paper; carry had Sharpe 0.53 and max drawdown 28.2 percent in this sample, VRP had near-zero correlation with carry.

### After publication

No independent test of the FX VRP strategy after publication was found. For related currency styles, Hutchinson et al. (2022) report the average out-of-sample Sharpe of published carry, momentum and value strategies falling from +0.39 to -0.32 after publication: https://doi.org/10.1016/j.irfa.2022.102245

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

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
