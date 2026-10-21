---
id: ALG-0017
title: FX value (5-year real exchange rate reversal / PPP)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, open-source, strategy]
related: []
---

# FX value (5-year real exchange rate reversal / PPP)

## In plain words

If a currency has become much more expensive than its prices at home justify over the last five years, sell it; if it has become cheap, buy it, expecting things to drift back.

## Summary

| | |
| --- | --- |
| Family | value-mean-reversion |
| Markets | fx |
| Horizon | monthly |
| Tags | cross-sectional, purchasing-power-parity, real-exchange-rate, slow-signal |
| Origin | academic: Asness, Moskowitz, Pedersen |
| First published | 2013 (13 years ago) |
| Primary source | [Value and momentum everywhere (Journal of Finance 68(3), 2013)](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Uses only free spot and CPI data, is slow and cheap to trade, and diversifies carry and momentum, so it is a natural building block for parity. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-value-ppp.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** If a currency has become much more expensive than its prices at home justify over the last five years, sell it; if it has become cheap, buy it, expecting things to drift back.

<details><summary>Analogy</summary>

Like noticing that the same burger now costs far more in one country than another after converting money, and betting the gap will shrink over time.

</details>

<details><summary>Precise</summary>

Purchasing power parity implies real exchange rates mean revert over long horizons. Asness, Moskowitz and Pedersen (2013) define currency value as the negative of the 5-year change in the real exchange rate: the log of the average spot rate 4.5 to 5.5 years ago over today's spot, minus the 5-year inflation differential versus the US. Currencies are ranked on this signal and the strategy is long the cheapest third and short the dearest third.

</details>

### The rule

At each month end, for each G10 currency compute value = log(average spot 4.5 to 5.5 years ago / spot today) minus (foreign CPI change minus US CPI change over the same 5 years), with spot in USD per foreign unit. Go long the top third and short the bottom third in equal weights (or rank-weight), hold one month.

### Data needed

- G10 monthly spot rates vs USD, at least 5.5 years of history
- Monthly CPI for each country (free from OECD or FRED)
- 1-month interest rates for excess returns

### Why it might work

Real exchange rates revert toward purchasing power parity over several years, and Asness, Moskowitz and Pedersen (2013) find value is negatively correlated with momentum (-0.42 in currencies), so the two combined give a much higher Sharpe than either alone.

### Why it might fail

Mean reversion in real exchange rates is slow, so the signal can stay wrong for a long time. Hutchinson et al. (2022) find currencies no longer respond to real exchange rate differentials after publication, and Chernov, Dahlquist and Lochstoer (2024) find the value signal is weaker for managed currencies.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Asness, Moskowitz, Pedersen (2013), Table I, currency value P3-P1](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf) | 1979-01 to 2011-07 | 10 developed currencies, top third minus bottom third | 0.34 | 3.3% | 9.7% | n/a | backtest | no | yes |
| [Asness, Moskowitz, Pedersen (2013), Table I, currency 50/50 value and momentum P3-P1](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf) | 1979-01 to 2011-07 | 10 developed currencies | 0.63 | 3.4% | 5.4% | n/a | backtest | no | yes |
| [Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (CS-Value, G10)](https://www.nber.org/system/files/working_papers/w32900/revisions/w32900.rev0.pdf) | 1985-2023 | G10 currencies, 5-year real exchange rate signal | 0.49 | 3.7% | 7.4% | n/a | backtest | no | yes |

Notes on these numbers:

- **Asness, Moskowitz, Pedersen (2013), Table I, currency value P3-P1:** The rank-weighted value factor in the same table: 3.9 percent mean, 9.0 percent volatility, Sharpe 0.44.
- **Asness, Moskowitz, Pedersen (2013), Table I, currency 50/50 value and momentum P3-P1:** Equal mix of value and momentum spread portfolios. The rank-weighted 50/50 factor shows 5.6 percent mean, 8.0 percent volatility, Sharpe 0.69.
- **Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (CS-Value, G10):** After full quoted costs: 1.83 percent mean, Sharpe 0.25. With floating emerging currencies added the no-cost Sharpe is 0.65.

### After publication

Hutchinson et al. (2022) find currencies no longer respond to real exchange rate differentials after the value studies were published, as part of an average Sharpe drop from +0.39 to -0.32 across carry, momentum and value (https://doi.org/10.1016/j.irfa.2022.102245). In contrast, Chernov, Dahlquist and Lochstoer (2024) describe value as having a relatively steady high return through 2023, especially with floating emerging currencies. AQR publishes the currency value factor monthly, which allows a direct check of returns after 2011.

### Implementations

- [https://www.aqr.com/Insights/Datasets/Value-and-Momentum-Everywhere-Factors-Monthly](https://www.aqr.com/Insights/Datasets/Value-and-Momentum-Everywhere-Factors-Monthly) (Excel data, license: AQR data terms): Free monthly value and momentum factor returns including currencies, from 1972, updated monthly. Data, not code.
- [https://github.com/jqx527/Managing-Crash-Risk-in-Currency-Carry-Trades](https://github.com/jqx527/Managing-Crash-Risk-in-Currency-Carry-Trades) (Python, license: none): Builds real exchange rate deviation signals alongside carry. No license file.

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

- Strategy in the engine: `fx_value_reer`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `fx_value_reer` and run officially in RUN-000003, but no hypothesis doc yet, so the stage stays at 2 until one is written.

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
