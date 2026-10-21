---
id: ALG-0051
title: Combined trend and carry portfolio
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, fx, open-source, strategy]
related: []
---

# Combined trend and carry portfolio

## In plain words

Run two simple ideas side by side: follow price trends, and own things that pay you to hold them. They tend to lose at different times, so together they are smoother.

## Summary

| | |
| --- | --- |
| Family | portfolio-construction |
| Markets | multi-asset, fx, commodities, rates, equities |
| Horizon | monthly |
| Tags | carry, time-series-momentum, diversification, multi-factor |
| Origin | academic: Koijen, Moskowitz, Pedersen, Vrugt |
| First published | 2013 (13 years ago) |
| Primary source | [Carry (NBER WP 19325, 2013; Journal of Financial Economics 2018)](https://doi.org/10.1016/j.jfineco.2017.11.002) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 5 of 5: FX carry plus FX trend is the most common systematic currency recipe, so this is the most direct multi-asset template and comparison for parity. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/trend-plus-carry-combined.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Run two simple ideas side by side: follow price trends, and own things that pay you to hold them. They tend to lose at different times, so together they are smoother.

<details><summary>Analogy</summary>

Like owning both an umbrella shop and an ice cream stand: one of them usually has a good day.

</details>

<details><summary>Precise</summary>

Allocate between a diversified time-series momentum strategy and a global carry factor (long high-carry, short low-carry within equities, bonds, currencies and commodities). Koijen et al. find carry strategies have little time-series momentum exposure, so the two returns have low correlation and the mix has a higher Sharpe ratio than either alone.

</details>

### The rule

Each month, run a 12-month time-series momentum book and a cross-sectional carry book in each asset class (each scaled to equal ex ante volatility); hold them in equal risk (or simple 50/50 weights) and rebalance monthly.

### Data needed

- Futures and forward prices across asset classes
- Interest rates and futures curves to compute carry
- Or the free AQR TSMOM and Century of Factor Premia datasets

### Why it might work

Carry earns a risk premium and trend earns a behavioral premium; Koijen et al. (2018) show carry returns are largely unrelated to time-series momentum, so combining them diversifies.

### Why it might fail

Both legs weakened after publication: in AQR's data the All Macro carry factor had a Sharpe ratio of about -0.13 from 2013 to early 2026, and the 50/50 combination about 0.33 (catalog computation).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Koijen, Moskowitz, Pedersen and Vrugt, Carry (NBER WP 19325), Table II, global carry factor](https://www.nber.org/system/files/working_papers/w19325/w19325.pdf) | varies by asset class, ending 2012-09 | Equities, bonds, currencies, commodities, credit, options | 1.1 | 6.8% | 6.1% | n/a | backtest | no | yes |
| [Our calculation from Catalog computation: 50/50 AQR TSMOM and AQR All Macro Carry](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Century-of-Factor-Premia-Monthly.xlsx) | 1985-01 to 2026-02 | Equity indices, bonds, currencies, commodities | 1.06 | 7.1% | 6.7% | -18.7% | backtest | no | no |
| [Our calculation from Catalog computation: 50/50 AQR TSMOM and AQR All Macro Carry](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Century-of-Factor-Premia-Monthly.xlsx) | 2013-01 to 2026-02 | Equity indices, bonds, currencies, commodities | 0.33 | 2.2% | 6.9% | -18.7% | backtest | no | no |

Notes on these numbers:

- **Koijen, Moskowitz, Pedersen and Vrugt, Carry (NBER WP 19325), Table II, global carry factor:** Carry legs weighted by inverse full-sample volatility (hindsight in weights). Passive equal-weight exposure to the same assets: Sharpe 0.47.
- **Our calculation from Catalog computation: 50/50 AQR TSMOM and AQR All Macro Carry:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Equal dollar weights on the two factor return series; TSMOM from https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx. Correlation between the legs 0.10. Same window: TSMOM alone Sharpe 0.97, carry alone 0.55. TSMOM dominates the risk because its volatility (12.5%) is far above carry's (3.7%).
- **Our calculation from Catalog computation: 50/50 AQR TSMOM and AQR All Macro Carry:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After the Carry working paper.

### After publication

In the catalog's computation from AQR data, the All Macro carry factor earned a Sharpe ratio of about 0.61 up to 2012 and about -0.13 from 2013 to early 2026, and currency carry fell from about 0.50 to 0.18. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

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

- Strategy in the engine: `fx_carry_trend_value`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `fx_carry_trend_value` and run officially in RUN-000003, but no hypothesis doc yet, so the stage stays at 2 until one is written.

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
