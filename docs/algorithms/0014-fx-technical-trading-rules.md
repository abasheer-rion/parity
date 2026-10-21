---
id: ALG-0014
title: FX technical trading rules (moving averages, filters, breakouts)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, open-source, strategy]
related: []
---

# FX technical trading rules (moving averages, filters, breakouts)

## In plain words

Look only at a currency's past prices. If the price today is above its average over recent weeks, buy it; if below, sell it.

## Summary

| | |
| --- | --- |
| Family | technical-indicator |
| Markets | fx |
| Horizon | daily |
| Tags | moving-average, trend-following, data-snooping, decayed, adaptive-markets |
| Origin | academic: Cornell and Dietrich (early test); Hsu, Taylor and Wang (large-scale test used here) |
| First published | 1978 (48 years ago) |
| Primary source | [Technical trading: Is it still beating the foreign exchange market? (Journal of International Economics 102, 2016)](https://doi.org/10.1016/j.jinteco.2016.03.012) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Easy to test with free daily FX data and a natural baseline for any currency strategy, though developed-currency evidence since the 1990s is weak. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-technical-trading-rules.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Look only at a currency's past prices. If the price today is above its average over recent weeks, buy it; if below, sell it.

<details><summary>Analogy</summary>

Like following the crowd on a busy street: if everyone has been walking one way for a while, you assume they will keep going that way.

</details>

<details><summary>Precise</summary>

Families of rules (moving average crossovers, filters, channel breakouts, support and resistance) produce long or short signals from past exchange rates. Hsu, Taylor and Wang test over 21,000 rules on 30 currencies with a stepwise test for data snooping and find significant profits, mostly in earlier decades and in emerging currencies.

</details>

### The rule

Example rule vma(S, L): each day go long the foreign currency against USD when its S-day moving average is above its L-day moving average and short otherwise (e.g. S=1, L=200 or S=5, L=20), earning the interest differential while in position and paying about 3 to 5 bp per one-way trade in developed currencies.

### Data needed

- Daily FX spot rates (e.g. FRED H.10)
- Daily short-term interest rates for each currency
- Bid-ask spread estimates

### Why it might work

Hsu, Taylor and Wang attribute profits to temporarily not fully rational behavior and market immaturity; Neely, Weller and Ulrich (2009) frame it as the adaptive markets hypothesis, where profits exist until traders learn and compete them away.

### Why it might fail

Hsu, Taylor and Wang find no significant predictability in developed currencies since the 1992-1996 subperiod. Neely and Weller (2013) find that with developed currencies only, about half of their top portfolios lost money in 2000-2012 and none had significant Sharpe ratios.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Hsu, Taylor and Wang (2016), best rules, developed currencies, Sharpe criterion](http://www.cicfconf.org/sites/default/files/paper_412.pdf) | 1971-2015 | 9 developed currencies vs USD | 0.752 | n/a | n/a | n/a | backtest | yes | yes |
| [Hsu, Taylor and Wang (2016), best rules, developed currencies, mean return criterion](http://www.cicfconf.org/sites/default/files/paper_412.pdf) | 1971-2015 | 5 of 9 developed currencies with significant rules | n/a | 6.9% | n/a | n/a | backtest | yes | yes |
| [Hsu, Taylor and Wang (2016), out-of-sample check](http://www.cicfconf.org/sites/default/files/paper_412.pdf) | Jan 2012 - Sep 2015 | Developed currencies, rules picked with data to 2011 | n/a | n/a | n/a | n/a | backtest | yes | yes |
| [Neely and Weller (2013), best ex ante adaptive strategy](https://s3.amazonaws.com/real.stlouisfed.org/wp/2011/2011-021.pdf) | Apr 1975 - Dec 2012 | Forex technical rules in major and emerging currencies plus carry | 0.78 | 9.4% | n/a | n/a | backtest | yes | yes |

Notes on these numbers:

- **Hsu, Taylor and Wang (2016), best rules, developed currencies, Sharpe criterion:** In-sample best rule after data-snooping test. Significant Sharpe ratios: NZD 0.652, DEM/EUR 0.681, JPY 0.752 (value shown). Only 3 of 9 developed currencies were significant on this metric.
- **Hsu, Taylor and Wang (2016), best rules, developed currencies, mean return criterion:** Average annualized excess return of the best significant rule per currency, range 6.5 to 7.7 percent. In-sample selection.
- **Hsu, Taylor and Wang (2016), out-of-sample check:** 5 of 6 selected developed-currency rules had positive returns, with out-of-sample Sharpe ratios of about 0.1 to 0.4; the Swiss franc rule lost money.
- **Neely and Weller (2013), best ex ante adaptive strategy:** Picks the top rule by past Sharpe every 20 days. Gross 10.08 percent, net 9.40 percent. Includes emerging currencies, where much of the later profit came from.

### After publication

Rules published in the 1970s and 1980s lost their edge in developed currencies by the 1990s (Hsu, Taylor and Wang 2016, citing LeBaron 2002, Olson 2004 and Neely, Weller and Ulrich 2009). Neely and Weller (2013) find remaining profits migrated to emerging currencies.

### Implementations

- [https://github.com/pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) (Python, license: GPL-3.0): Rob Carver's systematic futures framework; its EWMAC trend rule is a moving average crossover. Repo moved from robcarver17 to pst-group.
- [https://github.com/kernc/backtesting.py](https://github.com/kernc/backtesting.py) (Python, license: AGPL-3.0): General backtester whose standard example is an SMA crossover; works on any daily price series including FX.

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

- Strategy in the engine: `fx_ma_cross`
- Registration: [REG-0003](../../registrations/REG-0003-all-strategies-1999.json)

Implemented as `fx_ma_cross` and run officially in RUN-000003, but no hypothesis doc yet, so the stage stays at 2 until one is written.

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
