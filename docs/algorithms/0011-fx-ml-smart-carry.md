---
id: ALG-0011
title: Machine learning smart carry (Filippou, Rapach, Taylor, Zhou)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, strategy]
related: []
---

# Machine learning smart carry (Filippou, Rapach, Taylor, Zhou)

## In plain words

The normal carry trade buys money that pays high interest. This version also asks a computer model whether each currency is likely to rise or fall, and adds that guess before deciding what to buy.

## Summary

| | |
| --- | --- |
| Family | machine-learning |
| Markets | fx |
| Horizon | monthly |
| Tags | carry, elastic-net, panel-regression, mean-variance |
| Origin | academic: Filippou, Rapach, Taylor, Zhou |
| First published | 2020 (6 years ago) |
| Primary source | [Exchange Rate Prediction with Machine Learning and a Smart Carry Trade Portfolio (CEPR DP15305, SSRN 3696388)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3696388) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Combines carry with macro and news-type uncertainty indices, close to parity's thesis, and most inputs (FRED, policy uncertainty indices) are free. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-ml-smart-carry.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** The normal carry trade buys money that pays high interest. This version also asks a computer model whether each currency is likely to rise or fall, and adds that guess before deciding what to buy.

<details><summary>Analogy</summary>

Like choosing a savings account by its interest rate but also checking whether the bank looks shaky before you deposit.

</details>

<details><summary>Precise</summary>

Forecast monthly USD exchange rate changes with a panel elastic net (and neural nets) on 70 predictors: 10 country characteristics (inflation, interest rate, unemployment gap, valuation differentials and others) interacted with 6 global variables (uncertainty indices, geopolitical risk, global FX volatility, illiquidity, correlation). Expected excess return equals the interest differential plus the forecast currency change, and a mean-variance investor (risk aversion 5) allocates across currencies monthly.

</details>

### The rule

Each month, re-estimate the panel elastic net on an expanding window, forecast next month's spot change for each currency, set expected excess return = bill yield differential + forecast appreciation, and hold mean-variance optimal weights (risk aversion 5) for one month.

### Data needed

- Monthly spot exchange rates vs USD for G10 (and legacy euro-area currencies)
- Government bill yields by country
- Country macro data: inflation, unemployment gap, equity valuation ratios
- Global variables: economic and monetary policy uncertainty indices, geopolitical risk index, FX volatility and liquidity measures

### Why it might work

Plain carry ignores predictable currency moves; adding forecasts that react to global risk conditions (for example the dollar's safe-haven moves in 2008) improves allocations (Filippou, Rapach, Taylor and Zhou 2021).

### Why it might fail

Many predictors and hyperparameters create overfitting risk; the authors show plain OLS on the same predictors loses money out of sample. Results are from a single working paper with no live track record found.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Filippou et al. July 2021 draft, Table 3 Panel A](https://www.wu.ac.at/fileadmin/wu/d/ri/isk/VSFX_2021/Papers/Rapach_SmartCarry_07-02-2021.pdf) | 1995:01-2020:09 (out of sample) | G10 plus legacy euro-area currencies vs USD | 0.94 | 11.0% | 11.8% | n/a | backtest | no | yes |
| [Filippou et al. July 2021 draft, Table 3 Panel C](https://www.wu.ac.at/fileadmin/wu/d/ri/isk/VSFX_2021/Papers/Rapach_SmartCarry_07-02-2021.pdf) | 2008:09-2020:09 (out of sample) | G10 currencies vs USD | 0.73 | 9.2% | 12.6% | n/a | backtest | no | yes |

Notes on these numbers:

- **Filippou et al. July 2021 draft, Table 3 Panel A:** Smart-Opt ensemble. Basic-Opt (carry only) had Sharpe 0.66; a conventional quintile carry sort had 0.33. With 75% of Datastream quoted bid-ask spreads, Smart-Opt Sharpe ratios are 0.64.
- **Filippou et al. July 2021 draft, Table 3 Panel C:** Smart-Opt ensemble after the financial crisis; Basic-Opt carry Sharpe 0.15 and conventional carry -0.08 in the same period.

### After publication

No independent post-publication test found. The paper itself notes conventional carry deteriorated after 2008, in line with Hutchinson et al. (2022, https://doi.org/10.1016/j.irfa.2022.102245).

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
