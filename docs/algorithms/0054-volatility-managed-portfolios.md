---
id: ALG-0054
title: Volatility-managed portfolios (volatility targeting)
type: algorithm
status: sourced
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [fx, strategy]
related: []
---

# Volatility-managed portfolios (volatility targeting)

## In plain words

When markets have been shaky, hold less; when they have been calm, hold more.

## Summary

| | |
| --- | --- |
| Family | volatility |
| Markets | equities, fx, multi-asset |
| Horizon | monthly |
| Tags | volatility-targeting, risk-management, overlay, leverage |
| Origin | academic: Moreira, Muir |
| First published | 2016 (10 years ago) |
| Primary source | [Volatility-Managed Portfolios (NBER WP 22208, 2016; Journal of Finance 2017)](https://doi.org/10.1111/jofi.12513) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: A cheap overlay that Moreira and Muir show helps the currency carry trade, so it is a natural add-on for any parity FX strategy. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/volatility-managed-portfolios.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** When markets have been shaky, hold less; when they have been calm, hold more.

<details><summary>Analogy</summary>

Like driving slower in fog and faster on a clear road, so the danger stays about the same.

</details>

<details><summary>Precise</summary>

Scale exposure each month by c divided by last month's realized variance, with c chosen so the managed portfolio has the same unconditional volatility as the original. Because volatility is persistent but does not predict returns proportionally, this raises Sharpe ratios; Moreira and Muir show it for equity factors and the currency carry trade.

</details>

### The rule

At each month end, compute realized variance RV from daily returns of the past month; next month hold weight w = c / RV in the factor or index (cap the weight, for example at 2, in practice); c is set so long-run volatility matches buy and hold.

### Data needed

- Daily returns of the asset or factor
- Monthly returns
- Financing rate for leverage

### Why it might work

Changes in volatility are not offset by proportional changes in expected returns, so cutting risk when volatility is high improves the risk-return trade-off (Moreira and Muir 2017).

### Why it might fail

Cederburg et al. (2020) find that across 103 equity strategies, real-time versions generally do not beat the unmanaged portfolios out of sample, and uncapped weights imply large leverage (up to about 15x in the catalog's test).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Moreira and Muir, NBER WP 22208](https://www.nber.org/system/files/working_papers/w22208/w22208.pdf) | 1926-2015 | US equity market | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Our calculation from Kenneth French data library, daily market factor](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 1926-07 to 2015-12 | US stocks (CRSP) | 0.51 | 9.5% | 18.6% | -62.3% | backtest | no | no |
| [Our calculation from Kenneth French data library, daily market factor](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 2016-01 to 2026-08 | US stocks (CRSP) | 0.61 | 9.5% | 15.6% | -37.2% | backtest | no | no |
| [Harvey, Hoyle, Korgaonkar, Rattray, Sargaison and Van Hemert (2018), Man Group](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf) | From as early as 1926 to 2017 | More than 60 assets | n/a | n/a | n/a | n/a | backtest | unclear | yes |

Notes on these numbers:

- **Moreira and Muir, NBER WP 22208:** Volatility-managed market has an annualized alpha of 4.86% and beta of 0.6 versus the market, appraisal ratio 0.33, and about a 25% increase in the buy-and-hold Sharpe ratio. The paper also reports alphas after assumed transaction costs (Table 4, not quoted here).
- **Our calculation from Kenneth French data library, daily market factor:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Weight = c / previous month realized variance, uncapped, c fitted in sample to match market volatility. Unmanaged market Sharpe 0.42, max drawdown -84.7%. Maximum weight about 15.2.
- **Our calculation from Kenneth French data library, daily market factor:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After the working paper. Unmanaged market over the same span: Sharpe 0.88, max drawdown -25.2%. c fitted within this window.
- **Harvey, Hoyle, Korgaonkar, Rattray, Sargaison and Van Hemert (2018), Man Group:** Volatility targeting raises Sharpe ratios for equities and credit, has a negligible effect for bonds, currencies and commodities, and reduces extreme returns in all asset classes.

### After publication

Cederburg, O'Doherty, Wang and Yan (2020, https://doi.org/10.1016/j.jfineco.2020.04.015) find out-of-sample volatility-managed versions generally earn lower Sharpe ratios than the unmanaged portfolios (abstract read via Semantic Scholar). DeMiguel, Martin-Utrera and Uppal (2024, https://doi.org/10.1111/jofi.13395) note Barroso and Detzel find they do not survive costs, but propose a conditional multifactor version that works out of sample net of costs. In the catalog's computation the managed US market underperformed buy and hold from 2016 to 2026 (Sharpe 0.61 vs 0.88).

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

- Strategy in the engine: `stocks_vol_managed`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `stocks_vol_managed` and run officially in RUN-000003, but no hypothesis doc yet, so the stage stays at 2 until one is written. RES-0017: use as a risk control for combined FX and energy books, not as a source of return.

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

- [RES-0017: Combining many strategies, the evidence and the ingredient list](../research/0017-combining-many-strategies-the-evidence-and-the-ingredient-list.md)
<!-- backlinks:end -->
