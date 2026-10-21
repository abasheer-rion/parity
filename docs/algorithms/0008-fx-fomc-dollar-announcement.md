---
id: ALG-0008
title: Short the dollar on FOMC announcement days
type: algorithm
status: hypothesis
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, news, strategy]
related: [HYP-0006]
---

# Short the dollar on FOMC announcement days

## In plain words

Eight times a year the US central bank announces its interest rate decision. On those days, other currencies have tended to rise against the US dollar, so the idea is to bet against the dollar only on those days.

## Summary

| | |
| --- | --- |
| Family | event-news |
| Markets | fx |
| Horizon | daily |
| Tags | fomc, us-dollar, announcement-premium, calendar-event, monetary-policy |
| Origin | academic: Mueller, Tahbaz-Salehi and Vedolin |
| First published | 2017 (9 years ago) |
| Primary source | [Exchange rates and monetary policy uncertainty (Journal of Finance 72(3), 2017)](https://researchonline.lse.ac.uk/id/eprint/77256/) |
| Research stage | 3 of 9: hypothesis |
| Relevance to us | 4 of 5: Simple, uses free daily FX data and public FOMC dates, and gives a calendar overlay a currency strategy could add, though with only 8 trades a year. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-fomc-dollar-announcement.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Eight times a year the US central bank announces its interest rate decision. On those days, other currencies have tended to rise against the US dollar, so the idea is to bet against the dollar only on those days.

<details><summary>Analogy</summary>

Like an insurer who charges extra on the few days a storm is forecast: people holding currencies on uncertain Fed days seem to get paid more for the worry.

</details>

<details><summary>Precise</summary>

A portfolio short USD and long G10 currencies earns significantly higher excess returns on scheduled FOMC announcement days than on other days, with larger returns for high interest rate currencies, more monetary policy uncertainty and easing decisions. The authors read this as a premium for monetary policy uncertainty borne by constrained intermediaries.

</details>

### The rule

On each scheduled FOMC announcement day, hold an equal-weight long position in the other G10 currencies against USD from 4pm ET the day before to 4pm ET on the announcement day; hold cash otherwise. Variant from the paper: only buy currencies with a positive interest rate differential versus the US, and reverse the position right after the announcement if the Fed tightens.

### Data needed

- Daily G10 spot and forward (or interest rate) data, sampled around 4pm
- Scheduled FOMC announcement dates (Federal Reserve website)
- Optional: intraday FX quotes to split pre and post announcement returns

### Why it might work

Mueller, Tahbaz-Salehi and Vedolin argue the returns compensate for heightened uncertainty about US monetary policy, carried by financiers whose risk-bearing capacity tightens on those days.

### Why it might fail

There are only 8 trades a year, so a few bad meetings can erase years of gains, and the paper's sample ends in 2013. A single practitioner blog that extended the data to 2025 still saw G10 currencies rise against the dollar on FOMC days on average, but it did not test performance after publication separately.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Mueller, Tahbaz-Salehi and Vedolin (2017), Table II, dol portfolio on announcement days](https://researchonline.lse.ac.uk/id/eprint/77256/2/Vedoli_exchange%20rates%20and%20monetary%201.pdf) | 1994-2013 | 9 G10 currencies vs USD, 160 FOMC days | 0.51 | n/a | n/a | n/a | backtest | no | yes |
| [Mueller, Tahbaz-Salehi and Vedolin (2017), improved strategy](https://researchonline.lse.ac.uk/id/eprint/77256/2/Vedoli_exchange%20rates%20and%20monetary%201.pdf) | 1994-2013 | G10 currencies with positive rate differential vs USD | 0.93 | n/a | n/a | n/a | backtest | no | yes |
| [Mueller, Tahbaz-Salehi and Vedolin (2017), cost check](https://researchonline.lse.ac.uk/id/eprint/77256/2/Vedoli_exchange%20rates%20and%20monetary%201.pdf) | 1994-2013 | G10 currencies vs USD | n/a | n/a | n/a | n/a | backtest | yes | yes |

Notes on these numbers:

- **Mueller, Tahbaz-Salehi and Vedolin (2017), Table II, dol portfolio on announcement days:** Mean 10.77 bp per announcement day (t = 2.27) versus 0.47 bp on other days. Sharpe annualized using 8 announcements per year. About 41% of the dol portfolio's annual return came on the 8 announcement days. Accepted manuscript version.
- **Mueller, Tahbaz-Salehi and Vedolin (2017), improved strategy:** Restricting to currencies with a positive rate differential and reversing after tightening raised announcement-day returns from 10.77 to 20.54 bp and the Sharpe ratio from 0.51 to 0.93 (introduction). Table VII reports S2 at 22.54 bp.
- **Mueller, Tahbaz-Salehi and Vedolin (2017), cost check:** Authors state announcement day returns stay significant with annualized Sharpe ratios of up to 0.8 after adjusting for bid-ask spreads. No single figure given in the passage read.

### After publication

No peer-reviewed out-of-sample test after 2013 was found. Quantseeker (practitioner blog, 2026, data Jan 1992 to Dec 2025) reports every G10 currency appreciated against USD on FOMC days on average and that the effect is almost entirely a post-2000 phenomenon, but gives no subperiod split after publication: https://www.quantseeker.com/p/the-fomc-day-puzzle-why-every-g10

### Implementations

None found.

## Our research

| Stage | Status |
| --- | --- |
| 1. catalogued | done |
| 2. sourced | done |
| 3. hypothesis | done |
| 4. implemented | not yet |
| 5. registered | not yet |
| 6. official | not yet |
| 7. reproduced | not yet |
| 8. forward | not yet |
| 9. verdict | not yet |

- Hypothesis: [HYP-0006](../hypotheses/0006-short-the-dollar-on-fomc-days.md)

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
