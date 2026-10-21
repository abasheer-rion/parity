---
id: ALG-0047
title: Sell in May (Halloween indicator)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [strategy]
related: []
---

# Sell in May (Halloween indicator)

## In plain words

Own stocks from November to April and sit in cash from May to October, because winter months have tended to be better.

## Summary

| | |
| --- | --- |
| Family | seasonality-calendar |
| Markets | equities |
| Horizon | monthly |
| Tags | calendar-anomaly, seasonal, market-timing |
| Origin | academic: Bouman, Jacobsen |
| First published | 2002 (24 years ago) |
| Primary source | [The Halloween Indicator, Sell in May and Go Away: Another Puzzle (American Economic Review)](https://doi.org/10.1257/000282802762024683) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: A simple timing rule versus the S&P 500; little direct link to FX. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/sell-in-may-halloween.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Own stocks from November to April and sit in cash from May to October, because winter months have tended to be better.

<details><summary>Analogy</summary>

Like a beach kiosk that only opens in the busy season and stays shut when few customers come.

</details>

<details><summary>Precise</summary>

Bouman and Jacobsen document that stock returns from November to April exceed those from May to October across many countries. The strategy is a simple switch between equities and bills on fixed dates.

</details>

### The rule

On the last trading day of October buy an equity index fund; on the last trading day of April sell it and hold T-bills until the end of October.

### Data needed

- Monthly equity index total returns
- T-bill rate

### Why it might work

Bouman and Jacobsen call it a puzzle; suggested reasons such as summer vacations are untested in the sources read here.

### Why it might fail

It gives up the summer equity premium: in the catalog's computation, May to October still averaged 0.75% a month in excess returns from 2003 to 2026, so the switch lagged buy and hold on a Sharpe basis (0.58 vs 0.72).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Our calculation from Kenneth French data library, market excess return](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 1926-07 to 2026-08 | US stocks (CRSP) | 0.48 | 5.8% | 12.1% | -57.8% | backtest | no | no |
| [Our calculation from Kenneth French data library, market excess return](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 1999-01 to 2026-08 | US stocks (CRSP) | 0.49 | 5.5% | 11.3% | -31.2% | backtest | no | no |
| [Our calculation from Kenneth French data library, market excess return](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 2003-01 to 2026-08 | US stocks (CRSP) | 0.58 | 6.2% | 10.8% | -31.2% | backtest | no | no |

Notes on these numbers:

- **Our calculation from Kenneth French data library, market excess return:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Monthly returns compounded from daily data. Nov-Apr averaged 0.98% a month excess versus 0.42% for May-Oct. Always invested: Sharpe 0.46, max drawdown -84.7%.
- **Our calculation from Kenneth French data library, market excess return:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After the end of Bouman and Jacobsen's sample (1998). Nov-Apr 0.91% vs May-Oct 0.41% a month. Always invested: Sharpe 0.51.
- **Our calculation from Kenneth French data library, market excess return:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After publication. Nov-Apr 1.04% vs May-Oct 0.75% a month. Always invested: Sharpe 0.72.

### After publication

The seasonal gap persisted after 1998 in US data but shrank after 2002 (catalog computation from French data). Andrade, Chhaochharia and Fuerst (2013, https://doi.org/10.2469/faj.v69.n4.4) titled their out-of-sample study 'Sell in May and Go Away Just Won't Go Away'; the catalog could only read the title, not the results. The catalog also could not open Bouman and Jacobsen's paper to quote their numbers.

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

- Strategy in the engine: `stocks_sell_in_may`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `stocks_sell_in_may` and run officially in RUN-000003, but no hypothesis doc yet, so the stage stays at 2 until one is written.

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
