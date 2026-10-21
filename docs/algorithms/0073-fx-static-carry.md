---
id: ALG-0073
title: Static carry: hold the currencies that usually pay high interest
type: algorithm
status: sourced
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [carry, fx, strategy]
related: []
---

# Static carry: hold the currencies that usually pay high interest

## In plain words

Some countries pay high interest year after year. Instead of reshuffling every month, buy the currencies that have paid high interest on average in the past and sell the ones that have paid little, and mostly keep those positions.

## Summary

| | |
| --- | --- |
| Family | carry |
| Markets | fx |
| Horizon | monthly |
| Tags | carry, g10, low-turnover, interest-rates |
| Origin | academic: Hassan and Mano |
| First published | 2019 (7 years ago) |
| Primary source | [Forward and Spot Exchange Rates in a Multi-Currency World (Quarterly Journal of Economics 134(1), 397-450)](https://www.nber.org/papers/w20294) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Needs only interest rates and spot rates, trades rarely so costs are low, and gives a cleaner version of our carry test. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-static-carry.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Some countries pay high interest year after year. Instead of reshuffling every month, buy the currencies that have paid high interest on average in the past and sell the ones that have paid little, and mostly keep those positions.

<details><summary>Analogy</summary>

Like choosing a savings account by its long record rather than by this month's teaser rate.

</details>

<details><summary>Precise</summary>

Weights are proportional to each currency's average forward premium minus the cross-currency average, estimated on data before the trading period, and held with rolling one-month forwards. Hassan and Mano split carry into a static part, a dollar part and a dynamic part and find the static part carries most of the return.

</details>

### The rule

Estimate each currency's average forward premium (interest differential against USD) on a past window. Go long currencies with above-average premia and short those below, with weights proportional to the gap from the cross-currency average. Roll one-month forwards monthly and re-estimate the averages rarely (for example once a year).

### Data needed

- Monthly spot and one-month forward rates, or short-term interest rates by country
- Bid-ask spreads for costs

### Why it might work

Hassan and Mano find that most carry profit comes from currencies that pay high interest permanently, which points to a persistent risk premium rather than to short-term timing.

### Why it might fail

The static weights depend on which past window is used, and the 1994-2010 sample includes the years when carry worked best. Hutchinson et al. (2022) found published FX factors decayed after publication. The static trade is also exposed to the same crash risk as ordinary carry.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Hassan and Mano (2019), NBER w20294, Table 2, static trade](https://www.nber.org/system/files/working_papers/w20294/w20294.pdf) | 12/1994-6/2010 | Currencies vs USD, '1 Rebalance' sample | 0.39 | 3.5% | n/a | n/a | backtest | unclear | yes |
| [Hassan and Mano (2019), NBER w20294, Table 1, carry trade](https://www.nber.org/system/files/working_papers/w20294/w20294.pdf) | 12/1994-6/2010 | Currencies vs USD | 0.54 | 5.0% | n/a | n/a | backtest | yes | yes |

Notes on these numbers:

- **Hassan and Mano (2019), NBER w20294, Table 2, static trade:** Quote: "The mean annualized return on the static trade is 3.46% with a Sharpe ratio of 0.39." Table 2, column 1. The sentence does not say whether this is net of costs.
- **Hassan and Mano (2019), NBER w20294, Table 1, carry trade:** Quote: "yields a mean annualized net return of 4.95% with a Sharpe ratio of 0.54" Table 1, the ordinary (linear) carry trade for comparison; the paper says net return.

### After publication

We found no independent replication. The paper itself says the static part contributes 70% of carry trade returns over 12/1994 to 6/2010.

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


Added from the paper library (RES-0010) on 2026-10-21.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0010: Paper library: FX and market microstructure](../research/0010-paper-library-fx-and-market-microstructure.md)
<!-- backlinks:end -->
