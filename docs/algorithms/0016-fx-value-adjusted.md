---
id: ALG-0016
title: Fundamentals-adjusted currency value (Menkhoff et al. 2017)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, strategy]
related: []
---

# Fundamentals-adjusted currency value (Menkhoff et al. 2017)

## In plain words

Some currencies get cheap compared to what they can buy. But some are cheap for a good reason, like a country getting poorer. This strategy buys currencies that are cheap for no good reason and sells ones that are pricey for no good reason.

## Summary

| | |
| --- | --- |
| Family | value-mean-reversion |
| Markets | fx |
| Horizon | quarterly |
| Tags | cross-sectional, real-exchange-rate, value, macro-adjusted |
| Origin | academic: Menkhoff, Sarno, Schmeling, Schrimpf |
| First published | 2017 (9 years ago) |
| Primary source | [Currency Value (Review of Financial Studies 30(2), 416-441)](https://ideas.repec.org/a/oup/rfinst/v30y2017i2p416-441..html) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: A slow, low-turnover FX signal that diversifies carry and momentum, but it needs macro data that is hard to assemble point in time for free. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-value-adjusted.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Some currencies get cheap compared to what they can buy. But some are cheap for a good reason, like a country getting poorer. This strategy buys currencies that are cheap for no good reason and sells ones that are pricey for no good reason.

<details><summary>Analogy</summary>

Like shopping for a used car: a low price only counts as a bargain after you account for the mileage and condition.

</details>

<details><summary>Precise</summary>

Take each currency's 5-year change in the real exchange rate against the USD as the raw value signal. Each quarter, regress that signal cross-sectionally on (expected) productivity, export quality, net foreign assets over GDP and the output gap. The residual is the adjusted value signal; sort currencies on it and go long undervalued, short overvalued.

</details>

### The rule

Each quarter, compute the 5-year log real exchange rate change for each currency versus USD, regress it across countries on real GDP per capita, export quality, NFA/GDP and output gap (or their EWMA or VAR forecasts), and hold rank-weighted long positions in currencies with the most positive residual (cheapest) and short positions in those with the most negative residual, rebalanced quarterly.

### Data needed

- Spot exchange rates vs USD, quarterly (end of quarter)
- CPI by country (to build real exchange rates)
- Forward rates or short-term interest rates for excess returns
- Real GDP per capita, output gap, net foreign assets/GDP (Lane and Milesi-Ferretti), IMF export quality index

### Why it might work

Real exchange rates tend to revert, but part of a currency's real move reflects fundamentals that do not mean revert; stripping those out leaves a cleaner measure of the currency risk premium (Menkhoff, Sarno, Schmeling and Schrimpf 2017).

### Why it might fail

Macro inputs are low frequency, revised and partly unavailable in real time (the paper notes export quality data cover a short window), so live signals may be noisier than the backtest. Hutchinson et al. (2022) find currency value predictability disappeared after publication of the evidence.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Menkhoff et al. 2017, Table 4 (CEPR working paper version)](https://openaccess.city.ac.uk/id/eprint/14851/13/FXVALUE_Rev3_cepr.pdf) | 1976Q1-2014Q1 | 22 currencies vs USD (23 advanced and emerging economies) | 0.5 | 3.6% | 7.3% | n/a | backtest | no | yes |
| [Menkhoff et al. 2017, Table 5 Panel D (CEPR working paper version)](https://openaccess.city.ac.uk/id/eprint/14851/13/FXVALUE_Rev3_cepr.pdf) | 1976Q1-2013Q4 (at most) | 22 currencies vs USD | 0.9 | 4.7% | 5.2% | n/a | backtest | no | yes |

Notes on these numbers:

- **Menkhoff et al. 2017, Table 4 (CEPR working paper version):** Benchmark (unadjusted) value: rank portfolio sorted on 5-year real exchange rate change. HML of 4 bins had Sharpe 0.44, mean 3.89%, vol 8.93%. No transaction costs mentioned.
- **Menkhoff et al. 2017, Table 5 Panel D (CEPR working paper version):** Adjusted value: rank portfolio on residual after regressing on panel-VAR expected fundamentals. Linear-weight version: Sharpe 0.91, mean 2.43%, vol 2.68%. Gain comes from lower volatility, not higher mean. Expected fundamentals are estimated recursively, but regressions use the cross-section at each date.

### After publication

Hutchinson, Kyziropoulos, O'Brien, O'Reilly and Sharma (2022, https://doi.org/10.1016/j.irfa.2022.102245; abstract at https://zenodo.org/records/7326532) replicated published currency carry, momentum and value studies and found the average out-of-sample Sharpe ratio fell from +0.39 before publication to -0.32 after it, with currencies no longer responding to interest rate and real exchange rate differentials.

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
