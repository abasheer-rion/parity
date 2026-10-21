---
id: ALG-0015
title: FX time-series momentum (trend)
type: algorithm
status: official
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, momentum, open-source, strategy]
related: [HYP-0002]
---

# FX time-series momentum (trend)

## In plain words

For each currency on its own, if it has been rising against the dollar, buy it; if it has been falling, sell it. Check again next month.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | fx |
| Horizon | monthly |
| Tags | time-series, trend-following, volatility-scaling, crisis-alpha |
| Origin | academic: Moskowitz, Ooi, Pedersen |
| First published | 2012 (14 years ago) |
| Primary source | [Time series momentum (Journal of Financial Economics 104(2), 2012)](https://w4.stern.nyu.edu/facdir/lpederse/papers/TimeSeriesMomentum.pdf) |
| Research stage | 6 of 9: official |
| Relevance to us | 4 of 5: Simple, works on free daily data, can be long or short the dollar, and historically paid off in equity crises, which matters for a test against the S&P 500. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-time-series-momentum.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** For each currency on its own, if it has been rising against the dollar, buy it; if it has been falling, sell it. Check again next month.

<details><summary>Analogy</summary>

Like a surfer who paddles in the direction the wave is already moving, rather than guessing which wave will be biggest.

</details>

<details><summary>Precise</summary>

Each currency's own past excess return (commonly over 12 months, or 1 month in Burnside, Eichenbaum and Rebelo 2011) sets the sign of the position, and positions are often scaled by inverse ex ante volatility. Unlike cross-sectional momentum the portfolio can be net long or short the dollar. Moskowitz, Ooi and Pedersen (2012) find significant time-series momentum in 10 currency forwards, part of a pattern across 58 futures and forwards.

</details>

### The rule

At each month end, for each G10 currency vs USD, compute the excess return over the past 12 months (or 1 month). Go long if positive, short if negative, size each position to equal target volatility (e.g. 40 percent annual divided by the currency's 60-day EWMA volatility, as in Moskowitz et al.) and average across currencies. Hold one month.

### Data needed

- G10 daily spot rates vs USD
- 1-month interest rates or forward rates
- Optional: AQR free monthly TSMOM factor returns for a currency benchmark

### Why it might work

Moskowitz, Ooi and Pedersen (2012) attribute trends to initial under-reaction and delayed over-reaction, and find speculators profit at the expense of hedgers. Central bank smoothing of policy rates can also make currency moves persistent.

### Why it might fail

Trend strategies bleed in range-bound markets and get whipsawed at turning points. Chernov, Dahlquist and Lochstoer (2024) show G10 12-month TS momentum at a Sharpe of 0.33 before costs and 0.20 after full costs over 1985-2023, much less than early samples, and Hutchinson et al. (2022) find currency returns no longer show the autocorrelation the strategy needs.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Burnside, Eichenbaum, Rebelo (2011), NBER WP 16942, Section 2.1 (momentum portfolio)](https://www.nber.org/system/files/working_papers/w16942/w16942.pdf) | 1976-2010 | 20 major currencies vs USD, equal-weighted, sign of last month's return | 0.62 | 4.5% | 7.3% | n/a | backtest | no | yes |
| [Moskowitz, Ooi, Pedersen (2012), Table 2 Panel E](https://w4.stern.nyu.edu/facdir/lpederse/papers/TimeSeriesMomentum.pdf) | 1985-01 to 2009-12 | 10 currency forwards (9 currencies vs USD) | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (TS-Mom 12, G10)](https://www.nber.org/system/files/working_papers/w32900/revisions/w32900.rev0.pdf) | 1985-2023 | G10 currencies | 0.33 | 2.3% | 6.9% | n/a | backtest | no | yes |
| [Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (TS-Mom 1, G10)](https://www.nber.org/system/files/working_papers/w32900/revisions/w32900.rev0.pdf) | 1985-2023 | G10 currencies | 0.37 | 2.3% | 6.2% | n/a | backtest | no | yes |

Notes on these numbers:

- **Burnside, Eichenbaum, Rebelo (2011), NBER WP 16942, Section 2.1 (momentum portfolio):** Payoffs abstract from transaction costs. A 50-50 mix with the equal-weighted carry trade gave 4.5 percent mean, 4.6 percent volatility, Sharpe 0.98. US stocks over the same period: 6.5 percent mean, Sharpe 0.41.
- **Moskowitz, Ooi, Pedersen (2012), Table 2 Panel E:** Only t-statistics of alphas are tabulated for the currency sub-portfolio: 3.41 for a 12-month lookback and 1-month hold, 3.16 for a 1-month lookback. No currency-only Sharpe in the text tables.
- **Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (TS-Mom 12, G10):** After full quoted costs: 1.34 percent mean, Sharpe 0.20.
- **Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (TS-Mom 1, G10):** 1-month lookback. Positive skew (0.53). After full quoted costs: 1.36 percent mean, Sharpe 0.22.

### After publication

Chernov, Dahlquist and Lochstoer (2024) find modest but positive G10 time-series momentum through 2023 (Sharpe 0.20 to 0.37 depending on lookback and costs). Hutchinson et al. (2022) find published currency momentum lost its edge after publication and that autocorrelation in currency excess returns disappeared (https://doi.org/10.1016/j.irfa.2022.102245). AQR keeps publishing an updated monthly TSMOM series that includes a currency sleeve, which allows an out-of-sample check from 2012 on.

### Implementations

- [https://www.aqr.com/Insights/Datasets/Time-Series-Momentum-Factors-Monthly](https://www.aqr.com/Insights/Datasets/Time-Series-Momentum-Factors-Monthly) (Excel data, license: AQR data terms): Free monthly TSMOM returns from 1985, 12-month lookback, with a currencies series. Data, not code.
- [https://github.com/pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) (Python, license: GPL-3.0): Full trend-following futures system (EWMAC and breakout rules, volatility targeting); FX futures can be plugged in.
- [https://github.com/rkohli3/TSMOM](https://github.com/rkohli3/TSMOM) (Jupyter Notebook, license: none): Replication of Moskowitz, Ooi and Pedersen. No license file.

## Our research

| Stage | Status |
| --- | --- |
| 1. catalogued | done |
| 2. sourced | done |
| 3. hypothesis | done |
| 4. implemented | done |
| 5. registered | done |
| 6. official | done |
| 7. reproduced | not yet |
| 8. forward | not yet |
| 9. verdict | not yet |

- Hypothesis: [HYP-0002](../hypotheses/0002-currency-trends-persist.md)
- Strategy in the engine: `fx_tsmom`
- Registration: [REG-0001](../../registrations/REG-0001-baseline-gauntlet.json)

### RUN-000001

<!-- results:RUN-000001 -->
Official run [RUN-000001](../../ledger/runs/RUN-000001.json) of `REG-0001`, recorded 2026-10-21, commit `d2d7569d`, data fingerprint `87741fa9da7a`, 39 trials counted. Generated from the ledger by `scripts/docs.py`; it cannot be edited by hand.

| Strategy | Sharpe | CAGR | Max drawdown | Deflated Sharpe | Gauntlet | Meets plan |
| --- | --- | --- | --- | --- | --- | --- |
| `fx_carry` | 0.39 | 1.4% | -16.1% | 0.44 | 3/11 | no |
| `fx_commodity_gap` | 0.06 | 0.2% | -16.1% | 0.03 | 1/11 | no |
| `fx_tsmom` | 0.17 | 0.9% | -29.8% | 0.10 | 3/11 | no |

| Strategy | A1 | A2 | A3 | A4 | A5 | A6 | B1 | B2 | B3 | B4 | B5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fx_carry` | fail | fail | fail | fail | fail | fail | pass | fail | pass | pass | fail |
| `fx_commodity_gap` | fail | fail | fail | fail | fail | fail | fail | fail | pass | fail | fail |
| `fx_tsmom` | fail | fail | fail | fail | fail | fail | fail | fail | pass | pass | pass |
<!-- /results -->

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
