---
id: ALG-0001
title: G10 currency carry (sorted on interest rates)
type: algorithm
status: official
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [carry, fx, open-source, strategy]
related: [HYP-0001]
---

# G10 currency carry (sorted on interest rates)

## In plain words

Some countries pay more interest on their money than others. You save in the high-interest currencies and borrow in the low-interest ones, and keep the difference as long as exchange rates do not move against you.

## Summary

| | |
| --- | --- |
| Family | carry |
| Markets | fx |
| Horizon | monthly |
| Tags | cross-sectional, risk-premium, forward-premium-puzzle, g10, crash-risk |
| Origin | academic: Lustig, Roussanov, Verdelhan |
| First published | 2008 (18 years ago) |
| Primary source | [Common risk factors in currency markets (NBER WP 14082; Review of Financial Studies 24(11), 2011)](https://www.nber.org/papers/w14082) |
| Research stage | 6 of 9: official |
| Relevance to us | 5 of 5: The core FX risk premium and the natural baseline any parity currency strategy must beat, testable with free FRED rates and spot data. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-carry-g10.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Some countries pay more interest on their money than others. You save in the high-interest currencies and borrow in the low-interest ones, and keep the difference as long as exchange rates do not move against you.

<details><summary>Analogy</summary>

Like borrowing from a bank that charges 1 percent to put the money in a bank that pays 5 percent, knowing that once in a while the second bank's currency can drop sharply and wipe out years of gains.

</details>

<details><summary>Precise</summary>

Uncovered interest parity says high-yield currencies should depreciate by the interest differential, but since Fama (1984) they have tended not to, so forward discounts predict excess returns. Sorting currencies each month by forward discount (or short-rate differential) and going long the top bucket and short the bottom bucket gives a dollar-neutral factor (HML_FX in Lustig, Roussanov and Verdelhan) that earns a premium with negative skew and losses when global FX volatility jumps.

</details>

### The rule

At each month end, rank the G10 currencies (AUD, CAD, CHF, EUR, GBP, JPY, NOK, NZD, SEK, USD) by their 1-month interest rate or 1-month forward discount versus USD. Go long the top 3 and short the bottom 3 in equal weights via 1-month forwards, hold one month, and rebalance.

### Data needed

- G10 spot exchange rates, daily or month end
- 1-month forward rates or 1-month interbank / policy interest rates for each currency
- Bid-ask spreads if testing costs

### Why it might work

Investors are paid for holding currencies that lose value in bad global times: Lustig, Roussanov and Verdelhan (2011) link the premium to a global slope factor, and Menkhoff, Sarno, Schmeling and Schrimpf (2012) show high-yield currencies do badly when global FX volatility rises unexpectedly.

### Why it might fail

Returns are negatively skewed (crashes in 2008, and the H/L skewness is -1.03 in Menkhoff et al. 2012), and Chernov, Dahlquist and Lochstoer (2024) find G10 carry had little growth after 2008 as rate differentials compressed. Hutchinson et al. (2022) find carry predictability faded after publication.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Menkhoff, Sarno, Schmeling, Schrimpf (2012), Journal of Finance, Table I](https://faculty.washington.edu/ss1110/IF/Sarno%20JF%20Carry%20Trade%20(1).pdf) | 1983-12 to 2009-08 | 48 currencies vs USD, 5 portfolios, long P5 short P1 | 0.74 | 7.2% | 9.8% | n/a | backtest | yes | yes |
| [Menkhoff, Sarno, Schmeling, Schrimpf (2012), Journal of Finance, Table I](https://faculty.washington.edu/ss1110/IF/Sarno%20JF%20Carry%20Trade%20(1).pdf) | 1983-12 to 2009-08 | 15 developed currencies vs USD, 5 portfolios, long P5 short P1 | 0.56 | 5.7% | 10.2% | n/a | backtest | yes | yes |
| [Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (EQ strategy)](https://www.nber.org/system/files/working_papers/w20433/w20433.pdf) | 1976-02 to 2013-08 | G10 currencies vs USD, equal weight, long if rate above USD rate, short otherwise | 0.78 | 4.0% | 5.1% | -12.0% | backtest | unclear | yes |
| [Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (SPD strategy)](https://www.nber.org/system/files/working_papers/w20433/w20433.pdf) | 1976-02 to 2013-08 | G10 currencies vs USD, weights proportional to interest differential | 0.87 | 6.6% | 7.6% | -21.5% | backtest | unclear | yes |
| [Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (CS-Carry, G10, no costs)](https://www.nber.org/system/files/working_papers/w32900/revisions/w32900.rev0.pdf) | 1985-2023 | G10 currencies, cross-sectional carry | 0.49 | 4.2% | 8.6% | n/a | backtest | no | yes |
| [Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (CS-Carry, G10, costs = 100 percent of quoted spread)](https://www.nber.org/system/files/working_papers/w32900/revisions/w32900.rev0.pdf) | 1985-2023 | G10 currencies, cross-sectional carry | 0.25 | 2.2% | 8.6% | n/a | backtest | yes | yes |

Notes on these numbers:

- **Menkhoff, Sarno, Schmeling, Schrimpf (2012), Journal of Finance, Table I:** Excess returns after quoted bid-ask spreads. Includes emerging currencies.
- **Menkhoff, Sarno, Schmeling, Schrimpf (2012), Journal of Finance, Table I:** Developed-country sample after bid-ask spreads; skewness -0.92.
- **Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (EQ strategy):** Sign-based G10 carry versus the dollar rather than a top-3/bottom-3 sort. Max drawdown of 12.0 percent is from their daily-data drawdown analysis (Table 22), it took 94 days.
- **Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (SPD strategy):** Spread-weighted version. Worst drawdown 21.5 percent over 163 days from daily data.
- **Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (CS-Carry, G10, no costs):** Independent later replication that runs past the original publication dates. Skewness -0.75.
- **Chernov, Dahlquist, Lochstoer (2024), NBER WP 32900, Table 1 (CS-Carry, G10, costs = 100 percent of quoted spread):** Full quoted bid-offer cost. At 50 percent of the spread the Sharpe is 0.37. Adding floating emerging currencies raises the no-cost Sharpe to 0.71.

### After publication

Hutchinson, Kyziropoulos, O'Brien, O'Reilly and Sharma (2022) replicate published carry, momentum and value studies and find the average out-of-sample Sharpe falls from +0.39 to -0.32 after publication (https://doi.org/10.1016/j.irfa.2022.102245). Chernov, Dahlquist and Lochstoer (2024) report that G10 carry shows little growth in the second half of their 1985-2023 sample, and Fan, Paseka, Qi and Zhang (2022) attribute the post-2008 decline to the disappearance of the downside risk that carry used to be paid for (https://ideas.repec.org/a/eee/intfin/v76y2022ics1042443121001670.html).

### Implementations

- [https://github.com/QuantConnect/Tutorials/tree/master/04%20Strategy%20Library/20%20Forex%20Carry%20Trade](https://github.com/QuantConnect/Tutorials/tree/master/04%20Strategy%20Library/20%20Forex%20Carry%20Trade) (Python, license: Apache-2.0): QuantConnect strategy library: 9 currencies, long highest central bank rate and short lowest, monthly rebalance. Needs the LEAN engine.
- [https://github.com/BenyaminSuicmez/FX_Carry_Trade_Backtest](https://github.com/BenyaminSuicmez/FX_Carry_Trade_Backtest) (Python, license: none): Small G10 carry backtest 2015-2025. No license file, so reuse rights are unclear.

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

- Hypothesis: [HYP-0001](../hypotheses/0001-carry-still-pays-after-costs.md)
- Strategy in the engine: `fx_carry`
- Registration: [REG-0001](../../registrations/REG-0001-baseline-gauntlet.json)

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

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
