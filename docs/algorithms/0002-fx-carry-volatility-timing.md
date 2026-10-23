---
id: ALG-0002
title: Carry with volatility targeting and crash protection
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [carry, fx, open-source, strategy]
related: []
---

# Carry with volatility targeting and crash protection

## In plain words

Run the normal carry trade, but bet smaller when currency markets get jumpy and bigger when they are calm, so a sudden crash hurts less.

## Summary

| | |
| --- | --- |
| Family | carry |
| Markets | fx |
| Horizon | monthly |
| Tags | volatility-targeting, risk-management, crash-risk, g10, options-hedge |
| Origin | academic: Daniel, Hodrick, Lu |
| First published | 2014 (12 years ago) |
| Primary source | [The carry trade: risks and drawdowns (NBER WP 20433; Critical Finance Review 2017)](https://www.nber.org/papers/w20433) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Carry crashes are the main way a currency strategy loses to the S&P 500, and volatility scaling is cheap to add and test with free daily data. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-carry-volatility-timing.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Run the normal carry trade, but bet smaller when currency markets get jumpy and bigger when they are calm, so a sudden crash hurts less.

<details><summary>Analogy</summary>

Like driving the same route every day but slowing down when it rains, because most crashes happen in bad weather.

</details>

<details><summary>Precise</summary>

Carry losses cluster in periods of high and rising FX volatility (Menkhoff, Sarno, Schmeling and Schrimpf 2012). Daniel, Hodrick and Lu (2014) rescale G10 carry positions each month using an IGARCH (RiskMetrics) covariance matrix so the portfolio targets 5 percent annual volatility, and also test buying 10-delta and 25-delta options to cap crash losses.

</details>

### The rule

Build the G10 carry portfolio (equal or spread weighted by interest differential versus USD). Each month, estimate the currency covariance matrix with an exponentially weighted model (alpha = 0.06 on daily return cross-products, times 22 for monthly) and scale all positions so the predicted annual volatility is 5 percent. Optional: cut exposure further when a global FX volatility index jumps above its recent average.

### Data needed

- G10 daily spot rates
- 1-month interest rates or forward rates
- Optional: FX implied volatility index (e.g. JP Morgan VXY) or currency option prices for hedging

### Why it might work

Menkhoff et al. (2012) find high-yield currencies lose when global FX volatility rises unexpectedly, and a global volatility factor captures more than 90 percent of cross-sectional carry returns, so cutting size when volatility is high removes some of the worst losses at a modest cost in average return.

### Why it might fail

Volatility forecasts react after the shock, so a sudden crash such as the 2008 yen rally can land before positions shrink. Daniel, Hodrick and Lu find risk rebalancing barely changes the worst drawdown of the equal-weighted strategy, and option hedging reduced average returns in their 2000-2013 sample.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (EQ-RR)](https://www.nber.org/system/files/working_papers/w20433/w20433.pdf) | 1976-02 to 2013-08 | G10 currencies vs USD, equal weight, risk rebalanced to 5 percent volatility | 0.92 | 5.4% | 5.9% | n/a | backtest | unclear | yes |
| [Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (SPD-RR)](https://www.nber.org/system/files/working_papers/w20433/w20433.pdf) | 1976-02 to 2013-08 | G10 currencies vs USD, spread weighted, risk rebalanced to 5 percent volatility | 1.02 | 6.2% | 6.1% | n/a | backtest | unclear | yes |
| [Daniel, Hodrick, Lu (2014), NBER WP 20433, Section 7 (unhedged EQ over option sample)](https://www.nber.org/system/files/working_papers/w20433/w20433.pdf) | 2000-09 to 2013-08 | G10 currencies vs USD, equal weight, before option hedging | 0.47 | 2.2% | n/a | n/a | backtest | unclear | yes |

Notes on these numbers:

- **Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (EQ-RR):** Compare with the unscaled EQ strategy in the same table: Sharpe 0.78, 3.96 percent mean, 5.06 percent volatility. Excess kurtosis falls from 2.01 to 0.40.
- **Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (SPD-RR):** The paper says risk rebalancing cuts the largest drawdown of the spread-weighted strategy in half (from 21.5 percent) but has minimal effect on the equal-weighted one. In-sample IGARCH parameter taken from RiskMetrics, not fitted.
- **Daniel, Hodrick, Lu (2014), NBER WP 20433, Section 7 (unhedged EQ over option sample):** Baseline for their option-hedged tests. Hedging with 10-delta and 25-delta USD options lowered average returns further; the paper says hedging reduces but does not eliminate abnormal returns.

### After publication

Fan, Paseka, Qi and Zhang (2022) find carry performance declined after 2008 largely because the downside risk it used to carry disappeared, which leaves less for a crash filter to remove (https://ideas.repec.org/a/eee/intfin/v76y2022ics1042443121001670.html). Hutchinson et al. (2022) find published currency carry strategies lost their edge after publication (https://doi.org/10.1016/j.irfa.2022.102245). No out-of-sample test of this exact volatility-targeted rule was found.

### Implementations

- [https://github.com/jqx527/Managing-Crash-Risk-in-Currency-Carry-Trades](https://github.com/jqx527/Managing-Crash-Risk-in-Currency-Carry-Trades) (Python, license: none): Carry signals with real exchange rate, momentum and risk-regime filters, out-of-sample forecasting. Data scripts need Macrobond and LSEG access. No license file.
- [https://github.com/pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) (Python, license: GPL-3.0): General futures system with built-in volatility targeting that can be applied to FX futures carry.

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

- [RES-0016: Combining many strategies, the evidence and the ingredient list](../research/0016-combining-many-strategies-the-evidence-and-the-ingredient-list.md)
<!-- backlinks:end -->
