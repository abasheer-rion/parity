---
id: ALG-0083
title: Emerging market currency carry, cost aware
type: algorithm
status: registered
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [carry, fx, strategy]
related: [HYP-0009]
---

# Emerging market currency carry, cost aware

## In plain words

Countries like Brazil, Mexico and South Africa pay much higher interest than the US. Hold their money to collect that interest, spread over many countries, and only when the extra interest is bigger than the cost of trading.

## Summary

| | |
| --- | --- |
| Family | carry |
| Markets | fx |
| Horizon | monthly |
| Tags | carry, emerging-markets, cross-sectional, transaction-costs |
| Origin | academic: Burnside, Eichenbaum, Rebelo |
| First published | 2007 (19 years ago) |
| Primary source | [The Returns to Currency Speculation in Emerging Markets (NBER WP 12916, 2007)](https://www.nber.org/papers/w12916) |
| Research stage | 5 of 9: registered |
| Relevance to us | 4 of 5: Testable with free data on a period no published study covers (2009 on), and the clearest way to extend our G10 carry results. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/em-fx-carry.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Countries like Brazil, Mexico and South Africa pay much higher interest than the US. Hold their money to collect that interest, spread over many countries, and only when the extra interest is bigger than the cost of trading.

<details><summary>Analogy</summary>

Like lending to many small shops at a high rate: any one may go bust, but across many of them the interest usually more than covers the losses.

</details>

<details><summary>Precise</summary>

Each month rank emerging market currencies by their interest rate gap to USD (or forward discount). Hold the high-carry group long, funded in USD, equal weight, and skip currencies whose gap does not exceed the bid and ask cost. Burnside et al. show that ignoring spreads turns the Sharpe ratio negative; a cost-aware rule earns a high Sharpe ratio before crises are added.

</details>

### The rule

Monthly: for each EM currency with data, carry = local short-term rate minus US 3-month rate. Long the top third by carry against USD, equal weights; drop any currency whose carry is below an assumed cost; close at a penalty if the currency stops being quoted.

### Data needed

- Daily EM spot rates (ECB reference rates)
- EM short-term interest rates (OECD IR3TIB or BIS policy rates)
- US 3-month rate

### Why it might work

High-rate EM currencies have not depreciated by enough to offset their interest gap on average (forward premium puzzle), and many EM currencies move independently, so a basket diversifies.

### Why it might fail

Spreads are two to four times wider than in G10; devaluations of 20% to 56% in a week (Russia 1998, Argentina 2002); capital controls and sanctions can stop exit (RUB 2022); every published sample ends by 2010, before a weak decade for EM currencies.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Burnside, Eichenbaum and Rebelo (2007), Table 1, transaction-cost-based carry, 63 currencies](https://www.nber.org/system/files/working_papers/w12916/w12916.pdf) | 1997-10 to 2006-11 | 63 developed and EM currencies, weekly | 1.32 | n/a | n/a | n/a | backtest | yes | yes |
| [Menkhoff, Sarno, Schmeling and Schrimpf (2012), Table I, all countries with bid-ask](https://openaccess.city.ac.uk/id/eprint/3391/1/CTVOL_R3_v4_paper.pdf) | 1983-12 to 2009-08 | 48 developed and EM currencies | 0.74 | 7.2% | 9.8% | n/a | backtest | yes | yes |

Notes on these numbers:

- **Burnside, Eichenbaum and Rebelo (2007), Table 1, transaction-cost-based carry, 63 currencies:** Quote: "the Sharpe ratio for this strategy is very high: 0.18 on a weekly basis and 1.32 on an annualized basis". The naive rule with spreads charged is "actually negative (-0.05)". Adding five crises by hand cuts the weekly Sharpe from 0.183 to 0.097.
- **Menkhoff, Sarno, Schmeling and Schrimpf (2012), Table I, all countries with bid-ask:** High minus low carry portfolio, skewness -1.03. Developed only (15 countries): 5.72% a year, Sharpe 0.56.

### After publication

None found by us after 2010. Press reports (Bloomberg via BloombergQuint) put 2018 losses on dollar-funded carry at 22% (TRY) and 20% (ARS). See RES-0012.

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

- Hypothesis: [HYP-0009](../hypotheses/0009-emerging-market-carry-pays-after-costs.md)
- Strategy in the engine: `em_fx_carry`
- Registration: [REG-0006](../../registrations/REG-0006-emerging-market-currencies-since-2010.json)

Added from RES-0012 and RES-0013 on 2026-10-21. Registered on 2026-10-21 as REG-0006 (em_fx_carry), not yet run.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0016: Combining many strategies, the evidence and the ingredient list](../research/0016-combining-many-strategies-the-evidence-and-the-ingredient-list.md)
<!-- backlinks:end -->
