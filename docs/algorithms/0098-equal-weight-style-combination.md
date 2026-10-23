---
id: ALG-0098
title: Equal-weight combination of styles
type: algorithm
status: registered
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [commodities, fx, strategy]
related: [HYP-0016]
---

# Equal-weight combination of styles

## In plain words

Run several weak trading signals at once, each with the same weight, instead of picking the one that looked best.

## Summary

| | |
| --- | --- |
| Family | portfolio-construction |
| Markets | fx, commodities |
| Horizon | monthly |
| Tags | combination, diversification, carry, momentum, value |
| Origin | academic: Asness, Moskowitz, Pedersen; Fernandez-Perez, Fuertes, Miffre |
| First published | 2013 (13 years ago) |
| Primary source | [Value and Momentum Everywhere (Journal of Finance 68(3), 2013); their appraisal of style-integration methods (Journal of Banking and Finance 105, 134-150, 2019)](https://doi.org/10.1016/j.jbankfin.2019.05.016) |
| Research stage | 5 of 9: registered |
| Relevance to us | 5 of 5: The method behind both combined books proposed in RES-0016; no data of its own needed. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/equal-weight-style-combination.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Run several weak trading signals at once, each with the same weight, instead of picking the one that looked best.

<details><summary>Analogy</summary>

Like a panel of judges: each one is often wrong, but they are wrong about different things, so the average verdict is better than any single judge.

</details>

<details><summary>Precise</summary>

Standardise each signal across assets every month and average the scores with equal weights, then hold assets in proportion to the average. In commodity futures 1989 to 2017, five signals with Sharpe ratios 0.16 to 0.59 combined to 0.97; six methods that chose weights from past data did no better (mean-variance: 0.74). In AQR's data, currency value and momentum (0.34 each, correlation -0.42) mixed 50/50 to 0.63, and commodity value and momentum (0.26 and 0.53) to 0.71.

</details>

### The rule

Monthly, per book: z-score each ingredient signal across the book's assets, average with weights 1/K over the K ingredients chosen in advance, scale the book to a fixed volatility. No weight is estimated from our data.

### Data needed

- The ingredient signals' own data

### Why it might work

Ideas that win at different times average out each other's bad years. Equal weights avoid estimation error, which is large when Sharpe ratios are small.

### Why it might fail

Only helps if the ingredients are not highly correlated and each still has some return after publication and costs. It also adds choices (which ingredients), each a hidden trial unless fixed in advance.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Fernandez-Perez, Fuertes and Miffre (2019), accepted version, Tables 1 and 4, Panel D](https://openaccess.city.ac.uk/id/eprint/22246/1/JBF_Integration%20for%20CRO.pdf) | 1989-07 to 2017-12 | Commodity futures, 5 signals | 0.97 | n/a | n/a | n/a | backtest | unclear | yes |
| [Fernandez-Perez, Fuertes and Miffre (2019), accepted version, Tables 1 and 4, Panel C](https://openaccess.city.ac.uk/id/eprint/22246/1/JBF_Integration%20for%20CRO.pdf) | 1989-08 to 2017-12 | Currency futures, 5 signals | 0.4 | n/a | n/a | n/a | backtest | unclear | yes |
| [Asness, Moskowitz and Pedersen (2013), Table I, 50/50 combination P3-P1](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf) | 1979-01 to 2011-07 | Currencies | 0.63 | n/a | n/a | n/a | backtest | unclear | yes |
| [Asness, Moskowitz and Pedersen (2013), Table I, 50/50 combination P3-P1](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf) | 1972-01 to 2011-07 | Commodities | 0.71 | n/a | n/a | n/a | backtest | unclear | yes |

Notes on these numbers:

- **Fernandez-Perez, Fuertes and Miffre (2019), accepted version, Tables 1 and 4, Panel D:** Single signals: momentum 0.59, value 0.27, carry 0.35, liquidity 0.16, skewness 0.45. Optimised (mean-variance) 0.74; best alternative 0.85.
- **Fernandez-Perez, Fuertes and Miffre (2019), accepted version, Tables 1 and 4, Panel C:** Single signals: momentum 0.11, value 0.67, carry 0.41, liquidity 0.29, skewness -0.04. Volatility timing 0.45, not significantly better (p = 0.27).
- **Asness, Moskowitz and Pedersen (2013), Table I, 50/50 combination P3-P1:** Value 0.34, momentum 0.34, correlation -0.42.
- **Asness, Moskowitz and Pedersen (2013), Table I, 50/50 combination P3-P1:** Value 0.26, momentum 0.53, correlation -0.39.

### After publication

Fernandez-Perez et al. find equal weights unsurpassed in sub-periods and across asset classes; AQR's century study reports a commodity multi-style Sharpe of 0.77 after publication (RES-0015).

### Implementations

None found.

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

- Hypothesis: [HYP-0016](../hypotheses/0016-an-equal-weight-energy-book-pays-after-2014.md)
- Strategy in the engine: `energy_book`
- Registration: [REG-0009](../../registrations/REG-0009-equal-weight-energy-book.json)

Added from RES-0016 on 2026-10-22. Implemented on 2026-10-23 as energy_book (carry, basis-momentum, 5-year value and trend on four energy futures), registered as REG-0009, not yet run.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [HYP-0016: An equal-weight energy book pays after 2014](../hypotheses/0016-an-equal-weight-energy-book-pays-after-2014.md)
- [RES-0016: Combining many strategies, the evidence and the ingredient list](../research/0016-combining-many-strategies-the-evidence-and-the-ingredient-list.md)
<!-- backlinks:end -->
