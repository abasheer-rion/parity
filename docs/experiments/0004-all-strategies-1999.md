---
id: EXP-0004
title: Sixteen strategies against the US stock market, 1999 to 2026
type: experiment
status: done
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [benchmark, method, strategy]
related: [DEC-0008, RES-0007, REF-0006]
---

# Sixteen strategies against the US stock market, 1999 to 2026

## In plain words

We tested every strategy we have built, sixteen in total, on the same 27 years of data, against simply holding the whole US stock market. None of them beat it once we allowed for how many ideas we have tried. The ones that came closest are rules that hold stocks and step aside when stocks are falling. Of the currency strategies, the most useful finding is that currency trend made money in most stock market crashes.

**Read with care:** this run was scored before two bugs were fixed (Sharpe ignored the risk-free rate, and borrowing was free). See [DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md). An official rerun will replace these numbers.

## Question

With the Yahoo-free benchmark ([DEC-0008](../decisions/0008-benchmark-data-without-yahoo.md)) and history from 1999-01-04, does any strategy at default settings pass all six "beat the market" tests? Registered as [REG-0003](../../registrations/REG-0003-all-strategies-1999.json).

## Setup

- Sixteen strategies at their default settings: the four earlier ones plus twelve built from the catalog (currency dollar carry, cross-sectional momentum, value, a carry plus trend plus value mix, two retail technical rules, five stock market timing rules, a commodity trend rule and a stocks plus currency trend overlay). The registration's title says fifteen; that is a counting slip, the file lists sixteen.
- 1 basis point costs, carry credited, stock timing rules earn the US 3-month rate in cash.
- 188 trials counted: 172 declared in advance plus these 16.
- Run officially on GitHub Actions; outputs and data are attached to the release named after the run.

## Results

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

Crisis behaviour and the correlations between strategies are on the dashboard's Compare page and summarised in [RES-0007](../research/0007-comparing-every-algorithm.md).

## Threats to validity

- **Already seen.** Exploratory results for all sixteen were seen before registration. This run makes them official; it is not a new test.
- **Many trials.** 188 trials make the "not luck" test (A3) very hard to pass. That is intended, but it also means a real but modest effect cannot pass it on 27 years of data.
- **Benchmark tail.** The last two months of the benchmark are estimated until Fama and French publish them.
- **Stock timing rules hold cash** at the 3-month rate, which assumes cash could always earn that rate.
- **`commodity_tsmom` is not meaningful.** It trades daily spot prices for Brent and Henry Hub gas. Spot gas has spikes nobody could trade (for example the February 2021 Texas freeze), and the strategy's 99.5% drawdown comes from those. Real commodity trend following uses futures, which we do not have for free. Treat this row as a data limitation, not a finding.
- All threats listed in [EXP-0002](0002-baseline-gauntlet.md#threats-to-validity) still apply.

## What we learned

1. Nothing beats the market on all six tests. The best (`stocks_vol_managed`, 8 of 11) fails "wins in every era" and "not luck".
2. The near misses all hold stocks most of the time. No purely currency strategy passes more than 4 of 11.
3. Retail technical rules on currencies show no edge (RSI reversion passes 0 of 11).
4. Currency trend's value is in crashes, which is why the overlay passes 6 of 11.

## Next

- Forward-test the three near misses from today.
- Register the overlay on its own ([HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md)).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0007: Comparing every algorithm we know of](../research/0007-comparing-every-algorithm.md)
- [RES-0012: Emerging market currencies](../research/0012-emerging-market-currencies.md)
- [RES-0013: Commodity futures, carry, trend and volatility](../research/0013-commodity-futures-carry-trend-and-volatility.md)
- [LOG-0003: Cleaner data and head to head comparison](../log/2026-10-20-cleaner-data-and-head-to-head-comparison.md)
- [LOG-0004: Ayan work log, requests and outcomes](../log/2026-10-21-ayan-work-log-requests-and-outcomes.md)
<!-- backlinks:end -->
