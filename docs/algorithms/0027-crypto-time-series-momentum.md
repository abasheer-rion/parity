---
id: ALG-0027
title: Crypto time-series momentum (Liu and Tsyvinski)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [crypto, momentum, open-source, strategy]
related: []
---

# Crypto time-series momentum (Liu and Tsyvinski)

## In plain words

If bitcoin went up a lot this week, it has tended to keep going up next week too. So you hold it after big up weeks and step aside after bad weeks.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | crypto |
| Horizon | weekly |
| Tags | time-series, trend, bitcoin, short-horizon |
| Origin | academic: Liu, Tsyvinski |
| First published | 2018 (8 years ago) |
| Primary source | [Risks and Returns of Cryptocurrency (NBER w24877; Review of Financial Studies 2021)](https://academic.oup.com/rfs/article-abstract/34/6/2689/5912024) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: Same time-series momentum idea parity can test on FX, but crypto evidence rests on a short bubble-heavy sample. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/crypto-time-series-momentum.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** If bitcoin went up a lot this week, it has tended to keep going up next week too. So you hold it after big up weeks and step aside after bad weeks.

<details><summary>Analogy</summary>

Like a rumor spreading through a school: once it starts, more people hear it over the next few days.

</details>

<details><summary>Precise</summary>

Regress next-period returns on current returns for BTC, XRP and ETH at daily and weekly frequency and sort weekly returns into quintiles. Liu and Tsyvinski find positive autocorrelation at 1 to 4 week horizons, which they link to investor attention, and no exposure to standard stock or macro factors.

</details>

### The rule

Every Sunday 23:59:59 UTC, rank this week's BTC return against quintile cutoffs set on past data only; hold BTC for the next week if it is in the top quintile (or above zero in a simpler version), otherwise hold cash.

### Data needed

- Daily BTC, ETH, XRP close prices (CoinDesk, CoinGecko, exchange APIs)
- T-bill rate

### Why it might work

Liu and Tsyvinski argue slow diffusion of attention among retail investors creates momentum; Google search for 'Bitcoin' also predicts returns.

### Why it might fail

The original sample is short (BTC from 2011 to May 2018) and dominated by the 2017 bubble. Their own Table 17 with no lookahead in quintile cutoffs shows smaller top-minus-bottom spreads (4.53 vs 8.62 percent per week at 1 week). Ethereum shows weaker momentum.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Liu and Tsyvinski NBER w24877, Table 15](https://www.nber.org/system/files/working_papers/w24877/w24877.pdf) | 2011-01-01 to 2018-05-31 | Bitcoin, weekly | 0.45 | n/a | n/a | n/a | backtest | no | yes |
| [Liu and Tsyvinski NBER w24877, Table 17 (no lookahead)](https://www.nber.org/system/files/working_papers/w24877/w24877.pdf) | 2011-01-01 to 2018-05-31, first two years used only to set cutoffs | Bitcoin, weekly | 0.37 | n/a | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Liu and Tsyvinski NBER w24877, Table 15:** Weekly (not annualized) Sharpe of the top formation-return quintile: mean 11.22 percent per week next week vs 2.60 percent and Sharpe 0.19 for the bottom quintile. Quintile cutoffs use the full sample (lookahead). Weekly Sharpe 0.45 implies roughly 3.2 annualized, which is not a realistic forward expectation.
- **Liu and Tsyvinski NBER w24877, Table 17 (no lookahead):** Weekly Sharpe of the top quintile (7.88 percent per week mean) with out-of-sample cutoffs; bottom quintile 3.35 percent, Sharpe 0.25. The long-short spread shrinks to 4.53 percent per week.

### After publication

Borri, Liu, Tsyvinski and Wu (2025) still find a two-week crypto momentum factor significant after 2020 (long-short 2.1 percent per week, t = 3.70), but BTC's own weekly Sharpe over 2014-2025 was 0.13 and drawdowns reached -83.62 percent.

### Implementations

- [https://github.com/freqtrade/freqtrade](https://github.com/freqtrade/freqtrade) (Python, license: GPL-3.0): Trend rules are easy to express as a strategy class; no official TSMOM strategy.

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

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
