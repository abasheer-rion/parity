---
id: ALG-0020
title: Commodity gap (our own idea)
type: algorithm
status: official
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, fx, open-source, strategy]
related: [HYP-0003]
---

# Commodity gap (our own idea)

## In plain words

Canada and Norway sell lots of oil, so their money usually moves with oil. When oil moves and their money has not caught up yet, buy their money and wait for it to catch up.

## Summary

| | |
| --- | --- |
| Family | macro-fundamental |
| Markets | fx, commodities |
| Horizon | weekly |
| Tags | commodity-currency, lead-lag, residual, our-idea |
| Origin | academic: Parity team |
| First published | 2026 (0 years ago) |
| Primary source | [HYP-0003 in this repository, building on Chen and Rogoff (2003) and Kohlscheen, Avalos and Schrimpf (2017)](../../docs/hypotheses/0003-commodity-currencies-catch-up.md) |
| Research stage | 6 of 9: official |
| Relevance to us | 5 of 5: Our main attempt at an idea that is not already a standard retail or academic strategy. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/parity-commodity-gap.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Canada and Norway sell lots of oil, so their money usually moves with oil. When oil moves and their money has not caught up yet, buy their money and wait for it to catch up.

<details><summary>Analogy</summary>

Like a dog on a lead walking behind its owner. If the owner has walked ahead, bet that the dog will catch up.

</details>

<details><summary>Precise</summary>

For CAD (WTI) and NOK (Brent), estimate the currency's sensitivity to oil over a trailing year, take the residual daily return after removing that oil exposure, sum it over 20 days, and z-score it over a year. Go long the currency when the residual is low (it has lagged oil) and short when high, sized by the z-score and capped.

</details>

### The rule

Each week, for CAD and NOK, compute a 20-day sum of the currency's return minus beta times its oil return (beta from the prior 250 days), z-score it over 250 days, and hold minus z over 2, capped at 1, split equally across the two currencies.

### Data needed

- CAD and NOK against USD, daily
- WTI and Brent crude, daily

### Why it might work

Commodity prices drive the terms of trade of exporters (Chen and Rogoff 2003), and commodity indices have predicted commodity currencies out of sample for up to two months (Kohlscheen, Avalos and Schrimpf 2017).

### Why it might fail

The oil and CAD link is strongest on the same day and fades at lower frequencies (Ferraro, Rogoff and Rossi 2015), currencies may lead commodities (Chen, Rogoff and Rossi 2010), and the oil to dollar link changed after 2020 (Rees 2025).

## Reported results

No source reports trading results for this algorithm.

### After publication

We found no evidence on how it did after it became known.

### Implementations

- [engine/src/parity/strategies/fx_commodity_gap.py](../../engine/src/parity/strategies/fx_commodity_gap.py) (Python, license: private): Our implementation.

## Our research

| Stage | Status |
| --- | --- |
| 1. catalogued | done |
| 2. sourced | done |
| 3. hypothesis | done |
| 4. implemented | done |
| 5. registered | done |
| 6. official | done |
| 7. reproduced | not yet |
| 8. forward | not yet |
| 9. verdict | not yet |

- Hypothesis: [HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md)
- Strategy in the engine: `fx_commodity_gap`
- Registration: [REG-0001](../../registrations/REG-0001-baseline-gauntlet.json)
- Registration: [REG-0002](../../registrations/REG-0002-monthly-commodity-gap.json)

Weekly version fails the gauntlet (RUN-000001). The pre-registered monthly version (REG-0002, HYP-0008) also failed its own bar of 4 reality tests, passing 2 (RUN-000002). Both versions are retired unless a new hypothesis gives a fresh reason.

### RUN-000001

<!-- results:RUN-000001 -->
Official run [RUN-000001](../../ledger/runs/RUN-000001.json) of `REG-0001`, recorded 2026-10-21, commit `d2d7569d`, data fingerprint `87741fa9da7a`, 39 trials counted. Generated from the ledger by `scripts/docs.py`; it cannot be edited by hand.

| Strategy | Sharpe | CAGR | Max drawdown | Deflated Sharpe | Gauntlet | Meets plan |
| --- | --- | --- | --- | --- | --- | --- |
| `fx_carry` | 0.39 | 1.4% | -16.1% | 0.44 | 3/11 | no |
| `fx_commodity_gap` | 0.06 | 0.2% | -16.1% | 0.03 | 1/11 | no |
| `fx_tsmom` | 0.17 | 0.9% | -29.8% | 0.10 | 3/11 | no |

| Strategy | A1 | A2 | A3 | A4 | A5 | A6 | B1 | B2 | B3 | B4 | B5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fx_carry` | fail | fail | fail | fail | fail | fail | pass | fail | pass | pass | fail |
| `fx_commodity_gap` | fail | fail | fail | fail | fail | fail | fail | fail | pass | fail | fail |
| `fx_tsmom` | fail | fail | fail | fail | fail | fail | fail | fail | pass | pass | pass |
<!-- /results -->

### RUN-000002

<!-- results:RUN-000002 -->
Official run [RUN-000002](../../ledger/runs/RUN-000002.json) of `REG-0002`, recorded 2026-10-21, commit `aceff25b`, data fingerprint `8bb4de5fa80e`, 13 trials counted. Generated from the ledger by `scripts/docs.py`; it cannot be edited by hand.

| Strategy | Sharpe | CAGR | Max drawdown | Deflated Sharpe | Gauntlet | Meets plan |
| --- | --- | --- | --- | --- | --- | --- |
| `fx_commodity_gap` | 0.26 | 1.0% | -15.0% | 0.36 | 2/11 | no |

| Strategy | A1 | A2 | A3 | A4 | A5 | A6 | B1 | B2 | B3 | B4 | B5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fx_commodity_gap` | fail | fail | fail | fail | fail | fail | fail | fail | pass | pass | fail |
<!-- /results -->

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
