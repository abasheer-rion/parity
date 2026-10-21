---
id: ALG-0049
title: S&P 500 buy and hold
type: algorithm
status: official
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [open-source, strategy]
related: []
---

# S&P 500 buy and hold

## In plain words

Buy a little piece of the 500 biggest US companies and keep it. You get their dividends and their growth.

## Summary

| | |
| --- | --- |
| Family | portfolio-construction |
| Markets | equities |
| Horizon | monthly |
| Tags | benchmark, passive, equity-premium, beta |
| Origin | commercial: Standard and Poor's |
| First published | 1957 (69 years ago) |
| Primary source | [S&P 500 index (historical annual returns compiled by Aswath Damodaran)](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html) |
| Research stage | 6 of 9: official |
| Relevance to us | 5 of 5: This is the benchmark parity is trying to beat, so its return, volatility and drawdown set the bar. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/sp500-buy-and-hold.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Buy a little piece of the 500 biggest US companies and keep it. You get their dividends and their growth.

<details><summary>Analogy</summary>

Like planting an orchard of 500 trees and never picking which ones; some die, but the orchard as a whole grows.

</details>

<details><summary>Precise</summary>

A capitalization-weighted long-only position in the S&P 500 total return index, rebalanced only by the index provider. Its excess return over T-bills is the US equity risk premium. This is the benchmark parity must beat after costs and on a risk-adjusted basis.

</details>

### The rule

Hold 100% in an S&P 500 total return index fund (or SPY with dividends reinvested) at all times; never trade except to reinvest dividends.

### Data needed

- S&P 500 total return index, daily or monthly
- 3-month T-bill rate for excess returns

### Why it might work

Investors demand a premium for holding risky equities rather than safe bills; Damodaran's annual data show S&P 500 returns well above T-bills since 1928.

### Why it might fail

Long stretches of poor returns are possible: per the Damodaran data the worst calendar year since 1928 was -43.8%, and from 2000 to 2025 the index compounded about 8.0% a year versus about 10.0% over the full 1928 to 2025 span.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Our calculation from Damodaran historical returns (S&P 500 incl. dividends)](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html) | 1928-2025 | S&P 500 | 0.43 | 10.0% | 19.4% | -64.8% | index | no | no |
| [Damodaran historical returns (S&P 500 incl. dividends)](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html) | 2025 | S&P 500 | n/a | 17.8% | n/a | n/a | index | no | yes |
| [Our calculation from Kenneth French data library, US market (Mkt-RF + RF)](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip) | 1926-07 to 2026-08 | CRSP value-weighted US stocks | 0.45 | 10.4% | 18.3% | -83.7% | index | no | no |
| [Our calculation from Kenneth French data library, US market (Mkt-RF + RF)](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip) | 1993-01 to 2026-08 | CRSP value-weighted US stocks | 0.6 | 11.0% | 15.2% | -50.3% | index | no | no |

Notes on these numbers:

- **Our calculation from Damodaran historical returns (S&P 500 incl. dividends):** Computed by the catalog from the annual return table on the page. annual_return is the geometric mean; volatility is the standard deviation of annual returns; Sharpe uses annual excess over 3-month T-bills; drawdown measured on annual data, so it understates the intra-year drawdown.
- **Damodaran historical returns (S&P 500 incl. dividends):** Single calendar year return printed on the page (page updated January 5, 2026).
- **Our calculation from Kenneth French data library, US market (Mkt-RF + RF):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. annual_return here is the compound annual total return. CRSP total market, a close proxy for the S&P 500, not the S&P 500 itself.
- **Our calculation from Kenneth French data library, US market (Mkt-RF + RF):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. annual_return is the compound annual total return. Window roughly matches the life of SPY (launched 1993).

### After publication

Not a published anomaly. The premium has persisted: in the Damodaran data the S&P 500 compounded about 8.0% a year over 2000 to 2025, lower than the 10.0% long-run figure but still well above T-bills (about 1.9% a year over the same span).

### Implementations

- [https://github.com/pmorissette/ffn](https://github.com/pmorissette/ffn) (Python, license: MIT): Performance statistics (CAGR, drawdown, Sharpe) for a price series.
- [https://github.com/pmorissette/bt](https://github.com/pmorissette/bt) (Python, license: MIT): Backtesting framework; a buy and hold benchmark is a one-line strategy.

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

- Strategy in the engine: `us_market_buy_hold`
- Registration: [REG-0001](../../registrations/REG-0001-baseline-gauntlet.json)

Our benchmark, run in every batch; it tests no hypothesis. Since DEC-0008 it is measured with the Fama and French US total market return extended by the S&P 500 index (daily correlation with SPY about 0.98). RUN-000001 and RUN-000002 used SPY from Yahoo.

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
