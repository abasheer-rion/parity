---
id: ALG-0048
title: 60/40 stock and bond portfolio
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [open-source, strategy]
related: []
---

# 60/40 stock and bond portfolio

## In plain words

Put 60 dollars of every 100 in stocks and 40 in government bonds, and reset to that mix now and then.

## Summary

| | |
| --- | --- |
| Family | portfolio-construction |
| Markets | multi-asset, equities, rates |
| Horizon | monthly |
| Tags | benchmark, rebalancing, stock-bond-mix, passive |
| Origin | practitioner: Industry convention; mean-variance theory from Markowitz |
| First published | 1952 (74 years ago) |
| Primary source | [Portfolio Selection (Markowitz 1952) as the theory; the 60/40 split itself has no single paper](https://doi.org/10.2307/2975974) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: A common balanced benchmark; useful as a second yardstick next to the S&P 500 when judging a lower-volatility FX strategy. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/sixty-forty-portfolio.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Put 60 dollars of every 100 in stocks and 40 in government bonds, and reset to that mix now and then.

<details><summary>Analogy</summary>

Like a meal that is mostly main course with a big side salad; when one part grows too big you move some back.

</details>

<details><summary>Precise</summary>

A static strategic allocation of 60% equities and 40% intermediate or long government bonds, rebalanced on a calendar schedule. Bonds historically had low or negative correlation with stocks, lowering volatility and drawdown at the cost of some return. It is the standard balanced benchmark for multi-asset strategies.

</details>

### The rule

At each month end (or year end), set weights to 60% S&P 500 total return and 40% 10-year US Treasury total return; hold until the next rebalance.

### Data needed

- S&P 500 total return, monthly
- 10-year US Treasury total return or yield series, monthly
- T-bill rate

### Why it might work

Combining two assets with imperfect correlation lowers risk per unit of return (Markowitz 1952); in the Damodaran annual data a 60/40 mix had a slightly higher Sharpe ratio than stocks alone over 1928 to 2025.

### Why it might fail

When stocks and bonds fall together the cushion disappears: in 2022 the S&P 500 returned -18.0% and the 10-year Treasury -17.8% per Damodaran, so a 60/40 mix lost about 18%.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Hurst, Ooi and Pedersen, A Century of Evidence on Trend-Following Investing (AQR)](https://www.trendfollowing.com/whitepaper/Century_Evidence_Trend_Following.pdf) | 1880-2013 | 60% US equities, 40% US 10-year bonds | 0.38 | 7.8% | 10.8% | -62.3% | backtest | no | yes |
| [Asness, Frazzini and Pedersen (2012), Leverage Aversion and Risk Parity, Table 2](https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/Leverage-Aversion-and-Risk-Parity.pdf) | 1926-2010 | US stocks and bonds (CRSP) | 0.4 | 4.7% | 11.7% | n/a | backtest | no | yes |
| [Our calculation from Damodaran historical returns, 60% S&P 500 and 40% 10-year T-bond](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html) | 1928-2025 | US stocks and Treasuries | 0.46 | 8.3% | 12.1% | -40.1% | backtest | no | no |
| [Our calculation from Damodaran historical returns, 60% S&P 500 and 40% 10-year T-bond](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html) | 2000-2025 | US stocks and Treasuries | n/a | 6.9% | 10.0% | -18.0% | backtest | no | no |

Notes on these numbers:

- **Hurst, Ooi and Pedersen, A Century of Evidence on Trend-Following Investing (AQR):** Exhibit 4 of the AQR white paper. The paper notes that no fees or transaction costs are subtracted from the 60/40 portfolio.
- **Asness, Frazzini and Pedersen (2012), Leverage Aversion and Risk Parity, Table 2:** Return is annual excess return over T-bills, rebalanced monthly.
- **Our calculation from Damodaran historical returns, 60% S&P 500 and 40% 10-year T-bond:** Computed by the catalog from the annual table on the page, rebalanced annually. annual_return is geometric; drawdown on annual data understates intra-year drawdown.
- **Our calculation from Damodaran historical returns, 60% S&P 500 and 40% 10-year T-bond:** Computed by the catalog from the annual table on the page, rebalanced annually; geometric annual return.

### After publication

No publication date to test against. The stock-bond hedge failed in 2022, when the Damodaran data show the S&P 500 at -18.0% and 10-year Treasuries at -17.8%, the worst joint year in the table.

### Implementations

- [https://github.com/pmorissette/bt](https://github.com/pmorissette/bt) (Python, license: MIT): Has fixed-weight and periodic rebalancing building blocks suited to a 60/40 backtest.

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
