---
id: ALG-0005
title: FX cross-sectional momentum
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, momentum, open-source, strategy]
related: []
---

# FX cross-sectional momentum

## In plain words

Each month, buy the currencies that went up the most recently and sell the ones that went down the most, betting the leaders keep leading for a while.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | fx |
| Horizon | monthly |
| Tags | cross-sectional, winners-minus-losers, limits-to-arbitrage, transaction-costs |
| Origin | academic: Menkhoff, Sarno, Schmeling, Schrimpf |
| First published | 2012 (14 years ago) |
| Primary source | [Currency momentum strategies (Journal of Financial Economics 106(3), 2012)](https://doi.org/10.1016/j.jfineco.2012.06.009) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: Well documented and easy to code, but in G10 after costs the recent evidence is close to zero, so it is more useful as a diversifier inside a combined portfolio than as a standalone S&P challenger. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-cross-sectional-momentum.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Each month, buy the currencies that went up the most recently and sell the ones that went down the most, betting the leaders keep leading for a while.

<details><summary>Analogy</summary>

Like a league table: back the teams at the top and bet against the teams at the bottom, and redraw the table every month.

</details>

<details><summary>Precise</summary>

Currencies are sorted on lagged excess returns over a formation period f (1 to 12 months) into six portfolios, and the strategy is long the top sixth and short the bottom sixth for a holding period h. Menkhoff et al. (2012) find winners beat losers by up to 10 percent a year before costs, driven mostly by spot moves rather than interest differentials, and largely unrelated to carry and to moving average rules.

</details>

### The rule

At each month end, rank all available currencies by their excess return (spot change plus interest differential) over the last f months (f = 1 or 12 are common). Go long the top sixth (or top 3 of G10) and short the bottom sixth (or bottom 3) in equal weights and hold for one month.

### Data needed

- Spot exchange rates vs USD, month end
- 1-month forward rates or short interest rates
- Bid-ask spreads (important: costs remove most of the profit)

### Why it might work

Menkhoff et al. (2012) find the returns are not explained by standard risk factors and look consistent with under- and over-reaction, but they are concentrated in currencies with high idiosyncratic volatility, high spreads and country risk, which limits arbitrage.

### Why it might fail

Costs: with full quoted spreads the best 1-month strategy drops from 9.46 to 3.92 percent a year and many variants go negative (Menkhoff et al. 2012, Table 8). Chernov, Dahlquist and Lochstoer (2024) find G10 one-month momentum flattened out around 2000 and has a Sharpe near zero after costs over 1985-2023.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Menkhoff et al. (2012), Table 1, MOM(1,1)](https://openaccess.city.ac.uk/id/eprint/3296/1/Currency%20Momentum%20Strategies.pdf) | 1976-01 to 2010-01 | Up to 48 currencies vs USD, long top sixth short bottom sixth | 0.95 | 9.5% | n/a | n/a | backtest | no | yes |
| [Menkhoff et al. (2012), Table 8, MOM(1,1) net](https://openaccess.city.ac.uk/id/eprint/3296/1/Currency%20Momentum%20Strategies.pdf) | 1976-01 to 2010-01 | Up to 48 currencies vs USD | n/a | 3.9% | n/a | n/a | backtest | yes | yes |
| [Menkhoff et al. (2012), Tables 1 and 8, MOM(12,1)](https://openaccess.city.ac.uk/id/eprint/3296/1/Currency%20Momentum%20Strategies.pdf) | 1976-01 to 2010-01 | Up to 48 currencies vs USD | 0.61 | 6.2% | n/a | n/a | backtest | no | yes |
| [Asness, Moskowitz, Pedersen (2013), Value and momentum everywhere, Table I (currency momentum P3-P1)](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf) | 1979-01 to 2011-07 | 10 developed currencies, top third minus bottom third | 0.34 | 3.5% | 10.3% | n/a | backtest | no | yes |
| [Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (CS-Mom 12, G10)](https://www.nber.org/system/files/working_papers/w32900/revisions/w32900.rev0.pdf) | 1985-2023 | G10 currencies | 0.16 | 1.3% | 8.1% | n/a | backtest | no | yes |

Notes on these numbers:

- **Menkhoff et al. (2012), Table 1, MOM(1,1):** 1-month formation, 1-month holding, before costs. Turnover can exceed 70 percent per month.
- **Menkhoff et al. (2012), Table 8, MOM(1,1) net:** After full quoted bid-ask spreads. With 50 percent of quoted spreads (Table 9) it is 6.64 percent.
- **Menkhoff et al. (2012), Tables 1 and 8, MOM(12,1):** 12-month formation, 1-month holding, before costs. After full quoted spreads the return is 1.40 percent a year (t = 0.74).
- **Asness, Moskowitz, Pedersen (2013), Value and momentum everywhere, Table I (currency momentum P3-P1):** 12-month momentum skipping the latest month. Correlation with currency value is -0.42.
- **Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (CS-Mom 12, G10):** Before costs. After full quoted costs the Sharpe is -0.07. The 1-month version (CS-Mom 1) is 0.17 before costs and -0.07 after.

### After publication

Hutchinson et al. (2022) find the replicated currency carry, momentum and value strategies went from an average out-of-sample Sharpe of +0.39 to -0.32 after publication and that currency returns no longer show autocorrelation (https://doi.org/10.1016/j.irfa.2022.102245). Chernov, Dahlquist and Lochstoer (2024) report that G10 cross-sectional one-month momentum flattened around 2000 and broader samples around 2010.

### Implementations

- [https://github.com/QuantConnect/Tutorials/tree/master/04%20Strategy%20Library/17%20Forex%20Momentum](https://github.com/QuantConnect/Tutorials/tree/master/04%20Strategy%20Library/17%20Forex%20Momentum) (Python, license: Apache-2.0): QuantConnect strategy library: 15 FX pairs 2006-2018, long 3 strongest and short 3 weakest on 12-month momentum vs USD. Needs the LEAN engine.
- [https://github.com/UBZapt/Currency-Market-Momentum](https://github.com/UBZapt/Currency-Market-Momentum) (Python, license: none): Replication and extension of Menkhoff et al. (2012) over 2000-2024 with transaction costs, using Datastream data. No license file.

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

- Strategy in the engine: `fx_xs_momentum`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `fx_xs_momentum` and run officially in RUN-000003, but no hypothesis doc yet, so the stage stays at 2 until one is written.

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
