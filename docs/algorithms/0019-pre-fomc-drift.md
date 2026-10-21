---
id: ALG-0019
title: Pre-FOMC announcement drift
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, open-source, strategy]
related: []
---

# Pre-FOMC announcement drift

## In plain words

US stocks used to go up a lot in the day before the Fed announced its interest rate decision. The strategy buys stocks only in that one day and sits in cash the rest of the time.

## Summary

| | |
| --- | --- |
| Family | seasonality-calendar |
| Markets | equities, fx |
| Horizon | daily |
| Tags | fomc, announcement-premium, calendar-event, decayed |
| Origin | academic: Lucca and Moench |
| First published | 2011 (15 years ago) |
| Primary source | [The pre-FOMC announcement drift (Journal of Finance 70(1), 2015; first FRBNY staff report 2011)](https://doi.org/10.1111/jofi.12196) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: A well known calendar effect on the S&P 500 benchmark itself, useful as a comparison or overlay, but evidence says it faded after 2015. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/pre-fomc-drift.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** US stocks used to go up a lot in the day before the Fed announced its interest rate decision. The strategy buys stocks only in that one day and sits in cash the rest of the time.

<details><summary>Analogy</summary>

Like ticket prices rising the evening before a big concert: the build-up, not the show itself, is where the move happened.

</details>

<details><summary>Precise</summary>

From 1994 to 2011 the S&P 500 earned on average about 49 bp in the 24 hours before scheduled FOMC announcements, roughly 80 percent of realized excess equity returns over the period, with no matching effect in Treasuries. Pre-announcement FX returns also exist in the dollar portfolio (Mueller et al. 2017), but the original drift is an equity finding.

</details>

### The rule

Buy the S&P 500 (index future or ETF) at 2pm ET on the day before a scheduled FOMC announcement and sell about 15 minutes before the announcement; hold cash at all other times. A daily approximation buys at the close two days before and sells at the close the day before, or holds close to close on the announcement day.

### Data needed

- S&P 500 index or futures prices, intraday (2pm) or daily close
- Scheduled FOMC announcement dates and times
- Risk-free rate (T-bill)

### Why it might work

Lucca and Moench document the drift but say standard asset pricing models struggle to explain it; returns were higher when the yield curve slope was low and implied volatility was high.

### Why it might fail

Kurov, Wolfe and Gilbert (2021) extend the sample to December 2019 and find the drift essentially disappeared after 2015, with the mean falling from about 0.49 percent to about 0.05 percent per meeting according to a search summary of their paper.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Lucca and Moench (2013 working paper version), pre-FOMC 2pm to 2pm window](https://conference.nber.org/confer/2013/MEs13/Lucca_Moench.pdf) | Sep 1994 - Mar 2011 | S&P 500, 131 scheduled FOMC meetings | 1.14 | 3.9% | n/a | n/a | backtest | no | yes |
| [Lucca and Moench (2013 working paper version), close to close on FOMC day](https://conference.nber.org/confer/2013/MEs13/Lucca_Moench.pdf) | Sep 1994 - Mar 2011 | S&P 500 | 0.84 | 2.7% | n/a | n/a | backtest | no | yes |
| [Kurov, Wolfe and Gilbert (2021), Finance Research Letters 40](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3134546) | Apr 2011 - Dec 2019 | S&P 500 | n/a | n/a | n/a | n/a | backtest | no | no |

Notes on these numbers:

- **Lucca and Moench (2013 working paper version), pre-FOMC 2pm to 2pm window:** Average 48.8 bp in the 24 hours before announcements. 3.89 percent per year is the annualized excess return earned in those windows only (versus 0.88 percent on all other days). NBER conference draft dated Feb 2013, numbers may differ slightly from the 2015 JF version.
- **Lucca and Moench (2013 working paper version), close to close on FOMC day:** Close-to-close FOMC-day return about 33 bp; annualized 2.7 percent versus 2.08 percent on all other days. Shows a daily-data version also worked in that sample.
- **Kurov, Wolfe and Gilbert (2021), Finance Research Letters 40:** Abstract (read on IDEAS) says the drift essentially disappeared after 2015. Per-meeting means of 0.492 percent (1994-2011) and 0.047 percent (2011-2019) seen only in a search summary.

### After publication

Kurov, Wolfe and Gilbert (2021) find the pre-FOMC drift essentially disappeared after 2015, both with and without press conferences, and suggest reduced uncertainty as a reason: https://ideas.repec.org/a/eee/finlet/v40y2021ics1544612320315956.html

### Implementations

- [https://github.com/angiekwang/pre-fomc-drift-replication](https://github.com/angiekwang/pre-fomc-drift-replication) (R, license: none): Replication of Table B.3 of Lucca and Moench (2013). No license file, so reuse rights are unclear.
- [https://github.com/johnhz0229/pre-fomc-backtest](https://github.com/johnhz0229/pre-fomc-backtest) (unknown, license: none): Backtest of the Lucca and Moench strategy. No license file.

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
