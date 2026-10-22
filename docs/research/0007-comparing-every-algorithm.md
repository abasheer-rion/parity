---
id: RES-0007
title: Comparing every algorithm we know of
type: research
status: current
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [benchmark, method, strategy]
related: [EXP-0004, REF-0007, RES-0006]
---

# Comparing every algorithm we know of

## In plain words

We lined up all 54 trading ideas in our catalog, and the 16 we have built ourselves, and compared them fairly. The pattern is simple. The newer and more exciting an idea, the better its claimed results, and the weaker the proof behind them. The ideas with long, honest track records earn modest returns. When we tested 16 of them ourselves on 27 years of data, none beat simply holding the US stock market once we allowed for how many ideas we tried. A few came close, and they all have one thing in common: they hold the stock market most of the time and step aside when it gets rough.

## Summary

**Read with care:** the numbers below were scored before two bugs were fixed (Sharpe ignored the risk-free rate, and borrowing was free). See [DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md). An official rerun will replace them.

Two comparisons, kept apart on purpose:

1. **What others claim** for the 54 catalog entries, from their own sources (dashboard Catalog page).
2. **What we measured** for 16 strategies on one data set, one cost model and one set of tests (official run RUN-000003, dashboard Compare page).

Mixing the two is the classic mistake: claimed numbers come from different periods, markets, cost assumptions and amounts of tuning.

## What others claim

Statistics over the catalog on 2026-10-20 (54 entries, 100 reported backtest Sharpe ratios):

| Measure | Value |
| --- | --- |
| Median reported backtest Sharpe | 0.61 |
| Median Sharpe from live trading or published indices | 0.53 (only 4 numbers) |
| Backtest Sharpe ratios above 2 | 5, all with leakage, short-sample or zero-cost caveats |
| Median Sharpe for ideas first published before 2005 | 0.48 (29 numbers) |
| Median Sharpe for ideas first published in 2015 or later | 0.81 (24 numbers) |
| Entries with evidence on what happened after publication | 49 of 54 |
| Entries testable with free data | 43 of 54 |

The newest ideas claim the highest Sharpe ratios. That is the opposite of what you would expect if newer methods were genuinely better and older ones had simply decayed. It is what you would expect if newer results have had less time to be checked, use shorter samples, and include more tuning. The only live and index numbers we have sit below the backtest median. Both patterns match published work on decay after publication ([RES-0001](0001-reading-list.md#overfitting-replication-and-decay)) and the forum evidence ([RES-0003](0003-forums-and-practitioners.md)).

## What we measured

All sixteen strategies, default settings, 1999-01-04 to 2026-10, 1 basis point costs, against the US total market ([DEC-0008](../decisions/0008-benchmark-data-without-yahoo.md)). 188 trials counted.

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

## Strengths and flaws by family

| Family | What it is good at | Its flaw | Our evidence |
| --- | --- | --- | --- |
| Stock timing (trend, vol management) | Sidesteps the worst of long crashes; best Sharpe ratios we measured (0.66 to 0.75) | Fails in fast crashes (the golden cross lost the full 34% of the Covid crash) and volatility management barely helped in the dot-com crash (minus 42% against minus 49%); deflated Sharpe below 0.95 once trials are counted | `stocks_trend_10m`, `stocks_vol_managed`, `stocks_golden_cross`: 7 or 8 of 11 tests |
| Currency carry | Small, steady, consistent across eras; cheap to trade | Loses money exactly when stocks crash; much weaker after costs and after publication | `fx_carry`: 3 of 11; consistent but small |
| Currency trend | Gained in 4 of the 5 worst stock market episodes since 1999 | Little or no return since 2009 | `fx_tsmom`: 3 of 11; the crisis behaviour is its only selling point |
| Combinations (carry plus trend plus value) | Smoother than any one part; passes most reality tests | Still far below the stock market | `fx_carry_trend_value`: 4 of 11, the best purely currency strategy |
| Stocks plus currency trend overlay | Uses trend's crisis behaviour to cushion stocks | Adds risk in calm years; its gains depend on a few crises. It made 10.7% in the 2022 bear market while stocks fell 25% | `stocks_plus_fx_trend`: 6 of 11 |
| Calendar effects (turn of month, sell in May) | Simple, decades of evidence | Old, widely known, and fragile across eras | 5 or 6 of 11 |
| Currency value and cross-sectional momentum | Strong in older academic samples | Close to zero in our data since 1999 | 0 or 1 of 11 |
| Retail technical rules (RSI, moving average crosses on FX) | Easy to explain | No evidence of an edge after costs in our data; matches the academic record on technical trading | `fx_rsi_reversion`: 0 of 11; `fx_ma_cross`: 3 of 11 |
| Commodity-driven currency ideas | A real economic story | The link fades fast and changed after 2020 | `fx_commodity_gap`: 1 of 11. (`commodity_tsmom` used untradeable spot gas prices and is not a fair test; see [EXP-0004](../experiments/0004-all-strategies-1999.md#threats-to-validity).) |
| Machine learning, language models, news | The highest claimed numbers in the catalog | Most exposed to leakage and overfitting; not yet tested by us | Stage 2 only |
| Crypto carry and bots | Clear examples of an edge that existed and then vanished | Crypto specific; exchange risk | Stage 2 only |

## What the comparison tells us

1. **Nothing beats the US stock market on all six tests.** Every strategy fails at least the "not luck" test once 188 trials are counted.
2. **The near misses are stock timing rules, not currency strategies.** They work by holding stocks most of the time. Our currency strategies are best seen as possible complements, not replacements.
3. **The most useful currency result is trend's crisis behaviour**: it made money in the dot-com crash, the financial crisis, the Covid crash and the 2022 bear market. That supports testing [HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md) more carefully, with the overlay registered on its own.
4. **Claimed numbers are not comparable with ours.** The dashboard's Catalog shows them for context, never as evidence.

## Next

- Register a forward test of the three near misses, starting now, so the only truly new data decides.
- Register the stocks plus currency trend overlay on its own, with its crisis behaviour as the stated reason.
- Take one machine learning idea from the catalog to stage 6, with leakage controls, as the honest test of the most hyped family.
- Retail favourites from forums and courses are added to the catalog and compared in [RES-0006](0006-courses-and-trader-beliefs.md).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [EXP-0004: Sixteen strategies against the US stock market, 1999 to 2026](../experiments/0004-all-strategies-1999.md)
- [EXP-0005: Rerun of all sixteen strategies with corrected scoring](../experiments/0005-rerun-of-all-sixteen-strategies-with-corrected-scoring.md)
- [RES-0006: What trading courses and traders swear by, and what the evidence says](0006-courses-and-trader-beliefs.md)
- [RES-0008: Independent audit of our methods and code](0008-independent-audit.md)
- [RES-0010: Paper library: FX and market microstructure](0010-paper-library-fx-and-market-microstructure.md)
- [RES-0011: Emerging market currencies](0011-emerging-market-currencies.md)
- [RES-0012: Commodity futures, carry, trend and volatility](0012-commodity-futures-carry-trend-and-volatility.md)
- [LOG-0003: Cleaner data and head to head comparison](../log/2026-10-20-cleaner-data-and-head-to-head-comparison.md)
- [LOG-0004: Ayan work log, requests and outcomes](../log/2026-10-21-ayan-work-log-requests-and-outcomes.md)
<!-- backlinks:end -->
