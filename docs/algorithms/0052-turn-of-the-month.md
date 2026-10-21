---
id: ALG-0052
title: Turn-of-the-month effect
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [strategy]
related: []
---

# Turn-of-the-month effect

## In plain words

Stocks have tended to rise mostly in the few days around the end and start of each month. So only own stocks on those days.

## Summary

| | |
| --- | --- |
| Family | seasonality-calendar |
| Markets | equities |
| Horizon | daily |
| Tags | calendar-anomaly, month-end, flows, market-timing |
| Origin | academic: Lakonishok, Smidt |
| First published | 1988 (38 years ago) |
| Primary source | [Are Seasonal Anomalies Real? A Ninety-Year Perspective (Review of Financial Studies)](https://doi.org/10.1093/rfs/1.4.403) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: A simple timing benchmark; a month-end version could be tested on currencies, but these sources only cover stocks. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/turn-of-the-month.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Stocks have tended to rise mostly in the few days around the end and start of each month. So only own stocks on those days.

<details><summary>Analogy</summary>

Like a shop that does most of its sales on payday weekend; you only open the till then.

</details>

<details><summary>Precise</summary>

Returns over the last trading day of a month and the first three trading days of the next are much higher than on other days. McConnell and Xu (2008) report that over 1926 to 2005 essentially all of the positive US excess market return came in this four-day window, and the effect appears in 31 of 35 countries.

</details>

### The rule

Buy an S&P 500 or total market fund at the close of the second-to-last trading day of the month (so you earn the last trading day) and sell at the close of the third trading day of the new month; hold T-bills otherwise.

### Data needed

- Daily equity index total returns
- Daily T-bill rate
- Trading calendar

### Why it might work

Proposed explanations include month-end pay and pension flows and window dressing, but McConnell and Xu find no support from volume or fund flows, so the cause is unclear.

### Why it might fail

The edge has shrunk: in the catalog's computation from French daily data, the four-day window averaged 5.4 bp a day versus 4.4 bp on other days over 2008 to 2026, compared with 15.0 bp versus 0.1 bp before 1987.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [McConnell and Xu (2008), working paper abstract on Purdue e-Pubs](https://docs.lib.purdue.edu/ciberwp/43) | 1926-2005 (CRSP); 1897-2005 (DJIA) | US equities | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Our calculation from Kenneth French data library, daily market factor](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 1926-07 to 2026-08 | US stocks (CRSP) | 0.84 | 6.1% | 7.3% | -22.5% | backtest | no | no |
| [Our calculation from Kenneth French data library, daily market factor](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 1987-01 to 2026-08 | US stocks (CRSP) | 0.59 | 4.4% | 7.5% | -18.6% | backtest | no | no |
| [Our calculation from Kenneth French data library, daily market factor](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip) | 2008-01 to 2026-08 | US stocks (CRSP) | 0.33 | 2.5% | 7.4% | -12.8% | backtest | no | no |

Notes on these numbers:

- **McConnell and Xu (2008), working paper abstract on Purdue e-Pubs:** All of the positive excess market return occurred during the four-day turn-of-the-month interval; on the other 16 days investors received no reward for market risk. No Sharpe figure in the abstract.
- **Our calculation from Kenneth French data library, daily market factor:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Strategy holds the market only on the last and first three trading days of each month, excess return otherwise zero. Turn-of-month days averaged 12.7 bp versus 1.0 bp on other days.
- **Our calculation from Kenneth French data library, daily market factor:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After Lakonishok and Smidt's sample. Always invested over the same span: Sharpe 0.58.
- **Our calculation from Kenneth French data library, daily market factor:** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After McConnell and Xu. Always invested over the same span: Sharpe 0.67.

### After publication

In the catalog's computation from French daily data, the turn-of-month strategy roughly matched buy and hold on a Sharpe basis from 1987 to 2026 (0.59 vs 0.58) and fell well behind it from 2008 to 2026 (0.33 vs 0.67), before costs of about 12 round trips a year. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

### Implementations

None found.

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
