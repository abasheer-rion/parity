---
id: ALG-0039
title: Commodity time-series momentum
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, momentum, open-source, strategy]
related: []
---

# Commodity time-series momentum

## In plain words

Look at each commodity, like oil or wheat. If its price rose over the last year, buy it; if it fell, sell it.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | commodities |
| Horizon | monthly |
| Tags | time-series-momentum, futures, volatility-scaling, trend |
| Origin | academic: Moskowitz, Ooi, Pedersen |
| First published | 2012 (14 years ago) |
| Primary source | [Time Series Momentum (Journal of Financial Economics)](https://doi.org/10.1016/j.jfineco.2011.11.003) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: Commodity trends feed commodity currencies (AUD, CAD, NOK), so this is a useful signal source and comparison for parity. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/commodity-time-series-momentum.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Look at each commodity, like oil or wheat. If its price rose over the last year, buy it; if it fell, sell it.

<details><summary>Analogy</summary>

Like a weather forecaster who says tomorrow will be like the last few days, and is right more often than not.

</details>

<details><summary>Precise</summary>

For each commodity future, the sign of its trailing 12-month excess return sets a long or short position, scaled to a constant ex ante volatility, with a one month holding period. Moskowitz, Ooi and Pedersen find that commodity TSMOM has a significant alpha (0.57% per month) even after controlling for cross-sectional commodity momentum.

</details>

### The rule

Each month, for each commodity future, go long if its past 12-month excess return is positive and short if negative; size each position at 40% annualized ex ante volatility divided by the number of contracts (or scale the sleeve to a target); hold one month.

### Data needed

- Rolled front-month commodity futures returns, daily
- T-bill rate

### Why it might work

Slow diffusion of supply and demand news and hedger flows make commodity trends persist; speculators profit from TSMOM at the expense of hedgers (Moskowitz, Ooi and Pedersen 2012).

### Why it might fail

Commodity trends reverse sharply around supply shocks and policy events; in AQR's own data the commodity sleeve earned a Sharpe ratio of about 0.21 from 2012 to mid 2026, versus about 1.0 before 2010 (catalog computation).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx) | 1985-01 to 2026-05 | Commodity futures | 0.65 | 9.7% | 14.9% | -46.3% | backtest | unclear | no |
| [Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx) | 1985-01 to 2009-12 | Commodity futures | 1.01 | 14.1% | 13.9% | -19.6% | backtest | unclear | no |
| [Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx) | 2012-01 to 2026-05 | Commodity futures | 0.21 | 3.1% | 15.3% | -46.3% | backtest | unclear | no |
| [Moskowitz, Ooi and Pedersen (2012), TSMOM vs XSMOM regression table, Panel A](https://pages.stern.nyu.edu/~lpederse/papers/TimeSeriesMomentum.pdf) | 1985-2009 | Commodity futures | n/a | n/a | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Gross of costs as far as the dataset states.
- **Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Roughly the original paper's sample.
- **Our calculation from AQR Time Series Momentum factors dataset (TSMOM^CM):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After publication.
- **Moskowitz, Ooi and Pedersen (2012), TSMOM vs XSMOM regression table, Panel A:** Regression of commodity TSMOM on cross-sectional commodity momentum: monthly intercept (alpha) 0.57%, t = 4.43. No Sharpe ratio for the commodity sleeve was read on the page.

### After publication

The commodity sleeve of AQR's TSMOM data dropped from a Sharpe ratio near 1.0 (1985 to 2009) to about 0.21 (2012 to 2026-05) in the catalog's computation. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

### Implementations

- [https://github.com/pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) (Python, license: GPL-3.0): Futures trading framework by Rob Carver; the provided rules folder includes ewmac.py (trend) and carry.py. Repo moved from robcarver17/pysystemtrade.

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

- Strategy in the engine: `commodity_tsmom`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `commodity_tsmom` and run officially in RUN-000003, but no hypothesis doc yet, so the stage stays at 2 until one is written.

### RUN-000003

<!-- results:RUN-000003 -->
Official run [RUN-000003](../../ledger/runs/RUN-000003.json) of `REG-0003`, recorded 2026-10-21, commit `403cd75d`, data fingerprint `9cf22a565a55`, 188 trials counted. Generated from the ledger by `scripts/docs.py`; it cannot be edited by hand.

| Strategy | Sharpe | CAGR | Max drawdown | Deflated Sharpe | Gauntlet | Meets plan |
| --- | --- | --- | --- | --- | --- | --- |
| `commodity_tsmom` | -0.11 | -15.2% | -99.5% | 0.00 | 1/11 | no |
| `fx_carry` | 0.41 | 1.5% | -16.1% | 0.29 | 3/11 | no |
| `fx_carry_trend_value` | 0.35 | 1.6% | -12.2% | 0.19 | 4/11 | no |
| `fx_commodity_gap` | 0.05 | 0.1% | -16.1% | 0.01 | 1/11 | no |
| `fx_dollar_carry` | 0.26 | 1.7% | -31.2% | 0.08 | 2/11 | no |
| `fx_ma_cross` | 0.13 | 0.6% | -27.0% | 0.02 | 3/11 | no |
| `fx_rsi_reversion` | -0.07 | -0.2% | -16.7% | 0.00 | 0/11 | no |
| `fx_tsmom` | 0.14 | 0.7% | -29.8% | 0.02 | 3/11 | no |
| `fx_value_reer` | 0.01 | -0.0% | -18.6% | 0.00 | 0/11 | no |
| `fx_xs_momentum` | -0.05 | -0.3% | -18.1% | 0.00 | 1/11 | no |
| `stocks_golden_cross` | 0.69 | 8.8% | -34.2% | 0.83 | 7/11 | no |
| `stocks_plus_fx_trend` | 0.57 | 6.8% | -25.9% | 0.62 | 6/11 | no |
| `stocks_sell_in_may` | 0.57 | 7.1% | -34.2% | 0.61 | 5/11 | no |
| `stocks_trend_10m` | 0.75 | 9.1% | -21.8% | 0.90 | 7/11 | no |
| `stocks_turn_of_month` | 0.61 | 4.6% | -17.2% | 0.70 | 6/11 | no |
| `stocks_vol_managed` | 0.66 | 11.0% | -43.9% | 0.78 | 8/11 | no |

| Strategy | A1 | A2 | A3 | A4 | A5 | A6 | B1 | B2 | B3 | B4 | B5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `commodity_tsmom` | fail | fail | fail | fail | fail | fail | fail | fail | fail | fail | pass |
| `fx_carry` | fail | fail | fail | fail | fail | fail | pass | fail | pass | pass | fail |
| `fx_carry_trend_value` | fail | fail | fail | fail | fail | fail | pass | pass | fail | pass | pass |
| `fx_commodity_gap` | fail | fail | fail | fail | fail | fail | fail | fail | pass | fail | fail |
| `fx_dollar_carry` | fail | fail | fail | fail | fail | fail | fail | fail | pass | pass | fail |
| `fx_ma_cross` | fail | fail | fail | fail | fail | fail | fail | fail | pass | pass | pass |
| `fx_rsi_reversion` | fail | fail | fail | fail | fail | fail | fail | fail | fail | fail | fail |
| `fx_tsmom` | fail | fail | fail | fail | fail | fail | fail | fail | pass | pass | pass |
| `fx_value_reer` | fail | fail | fail | fail | fail | fail | fail | fail | fail | fail | fail |
| `fx_xs_momentum` | fail | fail | fail | fail | fail | fail | fail | fail | fail | fail | pass |
| `stocks_golden_cross` | pass | pass | fail | pass | fail | pass | pass | fail | pass | pass | fail |
| `stocks_plus_fx_trend` | pass | pass | fail | pass | fail | fail | pass | pass | fail | pass | fail |
| `stocks_sell_in_may` | pass | pass | fail | pass | fail | fail | pass | fail | fail | pass | fail |
| `stocks_trend_10m` | pass | pass | fail | pass | fail | fail | pass | pass | pass | pass | fail |
| `stocks_turn_of_month` | pass | pass | fail | pass | fail | fail | pass | fail | pass | pass | fail |
| `stocks_vol_managed` | pass | pass | fail | pass | fail | pass | pass | pass | pass | pass | fail |
<!-- /results -->

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
