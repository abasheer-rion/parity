---
id: ALG-0061
title: Golden cross / death cross (50 and 200 day moving averages)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, open-source, strategy]
related: []
---

# Golden cross / death cross (50 and 200 day moving averages)

## In plain words

Draw the average price of the last 50 days and of the last 200 days. When the short line climbs above the long line, buy. When it drops below, sell.

## Summary

| | |
| --- | --- |
| Family | technical-indicator |
| Markets | equities, fx |
| Horizon | daily |
| Tags | moving-average, trend-following, retail-classic, data-snooping |
| Origin | practitioner: Retail and press lore; first rigorous test of the 200-day family by Brock, Lakonishok and LeBaron |
| First published | 1992 (34 years ago) |
| Primary source | [Simple technical trading rules and the stochastic properties of stock returns (Journal of Finance 47, 1992)](https://doi.org/10.1111/j.1540-6261.1992.tb04681.x) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Trivial to test on SPY and daily FX with free data, and it is the single most cited retail rule, so it is a natural baseline against buy and hold. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/golden-cross-50-200.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Draw the average price of the last 50 days and of the last 200 days. When the short line climbs above the long line, buy. When it drops below, sell.

<details><summary>Analogy</summary>

Like judging the season by comparing this week's temperature with the average of the last few months: once the recent number is clearly higher, you assume summer is coming.

</details>

<details><summary>Precise</summary>

A variable-length moving average rule: long when MA(50) is above MA(200) (the golden cross), flat or short when below (the death cross). It is one member of the rule families that Brock, Lakonishok and LeBaron (1992) tested on the Dow from 1897 to 1986 (they used 1/50, 1/150, 5/150, 1/200 and 2/200). Later tests with data-snooping controls and costs found the edge faded after the 1980s.

</details>

### The rule

Each day compute the 50-day and 200-day simple moving averages of the close. Hold the asset (SPY, or a currency against USD) when MA50 > MA200, otherwise hold cash (or go short for the long/short version); trade at the next day's open.

### Data needed

- Daily closing prices (SPY or index level, FX spot from FRED H.10)
- Short-term interest rate for the cash leg
- Spread or commission estimate

### Why it might work

Proponents say it catches long trends and sidesteps bear markets. Park and Irwin (2004) note that modern studies found profits at least until the early 1990s, which they and others attribute to noise traders and slow reaction to news.

### Why it might fail

Sullivan, Timmermann and White (1999), as summarized by Park and Irwin, found the best rule picked on 1897 to 1986 earned only 2.8 percent a year out of sample in 1987 to 1996 with no significance. Bajgrowicz and Scaillet (2012) find that on the Dow from 1897 to 2011 even in-sample profits are wiped out by low transaction costs. The crossover reacts late, so it gives back a lot in sharp V-shaped recoveries.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Brock, Lakonishok and LeBaron (1992), as summarized in Park and Irwin (2004)](https://farmdoc.illinois.edu/assets/marketing/agmas/AgMAS04_04.pdf) | 1897-1986 | Dow Jones Industrial Average | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Sullivan, Timmermann and White (1999), as summarized in Park and Irwin (2004)](https://farmdoc.illinois.edu/assets/marketing/agmas/AgMAS04_04.pdf) | 1897-1996 | Dow Jones Industrial Average, the 26 rules from Brock et al. | 0.39 | 9.4% | n/a | n/a | backtest | no | yes |
| [Sullivan, Timmermann and White (1999) out-of-sample, as summarized in Park and Irwin (2004)](https://farmdoc.illinois.edu/assets/marketing/agmas/AgMAS04_04.pdf) | 1987-1996 | Dow Jones Industrial Average | n/a | 2.8% | n/a | n/a | backtest | no | yes |
| [Bajgrowicz and Scaillet (2012), abstract](https://archive-ouverte.unige.ch/unige:79889) | 1897-2011 | Dow Jones Industrial Average, about 7,800 rules | n/a | n/a | n/a | n/a | backtest | yes | yes |

Notes on these numbers:

- **Brock, Lakonishok and LeBaron (1992), as summarized in Park and Irwin (2004):** Variable moving average rules (1/50 up to 2/200): buy days averaged 0.042 percent per day (about 12 percent a year) and sell days -0.025 percent per day (about -7 percent a year), versus 0.017 percent unconditional. No transaction costs. annual_return left null because the 12 percent figure is the return on buy days only, not a strategy return.
- **Sullivan, Timmermann and White (1999), as summarized in Park and Irwin (2004):** Best rule in the Brock et al. universe was a 50-day moving average with a 1 percent band: 9.4 percent a year versus 4.3 percent for buy and hold, Sharpe 0.39 versus 0.034. In-sample selection; Reality Check p-value near zero for the full period but not in several subperiods.
- **Sullivan, Timmermann and White (1999) out-of-sample, as summarized in Park and Irwin (2004):** The best full-universe rule (a 5-day moving average) chosen on 1897-1986 earned 2.8 percent a year out of sample, nominal p-value 0.32, i.e. not significant.
- **Bajgrowicz and Scaillet (2012), abstract:** Abstract: 'even in-sample, the performance is completely offset by the introduction of low transaction costs' and 'an investor would never have been able to select ex ante the future best-performing rules'.

### After publication

After Brock et al. (1992) the rules stopped working on the Dow: Sullivan, Timmermann and White's 1987 to 1996 holdout shows no significant return, and Bajgrowicz and Scaillet (2012) find no persistence through 2011. In FX, Neely, Weller and Ulrich (2009) find moving average profits had disappeared by the early 1990s.

### Implementations

- [https://github.com/kernc/backtesting.py](https://github.com/kernc/backtesting.py) (Python, license: AGPL-3.0): General daily-bar backtester; its standard example is an SMA crossover.
- [https://github.com/TA-Lib/ta-lib-python](https://github.com/TA-Lib/ta-lib-python) (Python, license: BSD-2-Clause): Python wrapper for TA-Lib; has SMA, EMA, MACD, RSI, Bollinger bands and candlestick pattern functions.

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

- Strategy in the engine: `stocks_golden_cross`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `stocks_golden_cross` and run officially in RUN-000003 (see EXP-0004). No hypothesis doc yet, so the stage stays at 2.

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
