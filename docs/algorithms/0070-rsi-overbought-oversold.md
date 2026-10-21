---
id: ALG-0070
title: RSI overbought / oversold reversal (30 / 70)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, open-source, strategy]
related: []
---

# RSI overbought / oversold reversal (30 / 70)

## In plain words

RSI is a score from 0 to 100 for how hard price has been rising lately. Under 30 means it fell a lot, so buy; over 70 means it rose a lot, so sell.

## Summary

| | |
| --- | --- |
| Family | technical-indicator |
| Markets | equities, fx |
| Horizon | daily |
| Tags | oscillator, mean-reversion, retail-classic, wilder |
| Origin | practitioner: J. Welles Wilder |
| First published | 1978 (48 years ago) |
| Primary source | [New Concepts in Technical Trading Systems (1978)](https://farmdoc.illinois.edu/assets/marketing/agmas/AgMAS04_04.pdf) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: Testable on SPY and daily FX at once; a useful mean-reversion counterpart to the trend rules. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/rsi-overbought-oversold.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** RSI is a score from 0 to 100 for how hard price has been rising lately. Under 30 means it fell a lot, so buy; over 70 means it rose a lot, so sell.

<details><summary>Analogy</summary>

Like a rubber band: the further it is stretched one way, the more people expect it to snap back.

</details>

<details><summary>Precise</summary>

RSI(n) = 100 - 100/(1+RS), where RS is the average up-close over n days divided by the average down-close (Wilder 1978, as given in Park and Irwin 2004). The retail rule treats RSI(14) below 30 as oversold (buy) and above 70 as overbought (sell). Wilder himself described these zones as points where 'a reaction or reversal is imminent'.

</details>

### The rule

Daily RSI(14) on closes. Buy when RSI crosses back above 30 from below; sell or go short when it crosses back below 70 from above; exit at the opposite signal. A common variant buys below 30 and exits when RSI crosses 50.

### Data needed

- Daily closing prices (SPY, FX spot)
- Cost estimate

### Why it might work

Short-term overreaction could make extreme moves partly reverse. Chong, Ng and Liew (2014) report RSI(14,30/70) was profitable on the Dow Jones Industrials in their sample.

### Why it might fail

Shorting at RSI 70 fights trends, which are the main source of documented technical profits in FX and futures (Park and Irwin 2004). Chong, Ng and Liew find RSI rules work in some indices and not others, with no correction for testing many markets.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Chong, Ng and Liew (2014), abstract](https://doi.org/10.3390/jrfm7010001) | Not stated in abstract | Five OECD stock indices | n/a | n/a | n/a | n/a | backtest | unclear | yes |

Notes on these numbers:

- **Chong, Ng and Liew (2014), abstract:** Abstract read through its OpenAlex record. RSI(21,50) significant in Milan and Toronto; 'the RSI(14,30/70) rule is also profitable in the Dow Jones Industrials Index'. No return numbers in the abstract.

### After publication

We found no evidence on how it did after it became known.

### Implementations

- [https://github.com/TA-Lib/ta-lib-python](https://github.com/TA-Lib/ta-lib-python) (Python, license: BSD-2-Clause): Python wrapper for TA-Lib; has SMA, EMA, MACD, RSI, Bollinger bands and candlestick pattern functions.
- [https://github.com/kernc/backtesting.py](https://github.com/kernc/backtesting.py) (Python, license: AGPL-3.0): General daily-bar backtester; its standard example is an SMA crossover.

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

- Strategy in the engine: `fx_rsi_reversion`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `fx_rsi_reversion` and run officially in RUN-000003 (see EXP-0004). No hypothesis doc yet, so the stage stays at 2.

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
