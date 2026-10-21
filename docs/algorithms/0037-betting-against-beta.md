---
id: ALG-0037
title: Betting against beta (low beta / low volatility)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [strategy]
related: []
---

# Betting against beta (low beta / low volatility)

## In plain words

Calm stocks have done about as well as wild stocks, so buy extra of the calm ones and sell some of the wild ones.

## Summary

| | |
| --- | --- |
| Family | volatility |
| Markets | equities, multi-asset |
| Horizon | monthly |
| Tags | low-risk, leverage, long-short, factor |
| Origin | academic: Frazzini, Pedersen |
| First published | 2014 (12 years ago) |
| Primary source | [Betting Against Beta (Journal of Financial Economics)](https://doi.org/10.1016/j.jfineco.2013.10.005) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: An equity and multi-asset low-risk factor; the same idea (low-beta currencies earn more per unit of risk) could be tested in FX. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/betting-against-beta.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Calm stocks have done about as well as wild stocks, so buy extra of the calm ones and sell some of the wild ones.

<details><summary>Analogy</summary>

Like noticing that the slow, steady horse finishes nearly as fast as the jumpy one, and backing the steady horse more heavily.

</details>

<details><summary>Precise</summary>

BAB goes long low-beta assets levered to a beta of one and short high-beta assets de-levered to a beta of one, so it is market neutral. Frazzini and Pedersen's model says investors who cannot borrow buy high-beta assets instead, flattening the security market line; the effect appears in US and international stocks, Treasuries, credit and futures.

</details>

### The rule

Each month, estimate betas; rank stocks; build a low-beta portfolio and a high-beta portfolio weighted by beta rank; scale each to beta one at formation; BAB = low-beta portfolio minus high-beta portfolio (both in excess of the risk-free rate); rebalance monthly.

### Data needed

- Daily stock returns to estimate betas
- Market index returns
- Or the free AQR BAB factor dataset

### Why it might work

Leverage and margin constraints push constrained investors into high-beta assets, so low-beta assets earn higher risk-adjusted returns (Frazzini and Pedersen 2014).

### Why it might fail

It needs leverage and shorting, and much of the paper return comes from small, costly-to-trade stocks; when funding tightens BAB returns are low, as the paper itself predicts.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Frazzini and Pedersen, Betting Against Beta (May 2013 draft), Table III](https://pages.stern.nyu.edu/~lpederse/papers/BettingAgainstBeta.pdf) | 1926-01 to 2012-03 | US stocks (CRSP) | 0.78 | 8.4% | 10.7% | n/a | backtest | no | yes |
| [Our calculation from AQR Betting Against Beta equity factors dataset (USA)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Betting-Against-Beta-Equity-Factors-Monthly.xlsx) | 1930-12 to 2026-08 | US stocks | 0.7 | 7.8% | 11.1% | -54.6% | backtest | no | no |
| [Our calculation from AQR Betting Against Beta equity factors dataset (USA)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Betting-Against-Beta-Equity-Factors-Monthly.xlsx) | 2012-04 to 2026-08 | US stocks | 0.71 | 6.0% | 8.6% | -15.3% | backtest | no | no |
| [Our calculation from AQR Betting Against Beta equity factors dataset (Global)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Betting-Against-Beta-Equity-Factors-Monthly.xlsx) | 1987-02 to 2026-08 | Global developed stocks | 0.86 | 8.4% | 9.8% | -31.4% | backtest | no | no |

Notes on these numbers:

- **Frazzini and Pedersen, Betting Against Beta (May 2013 draft), Table III:** Table III shows 0.70% per month excess return (annual_return is 0.70 x 12) and 10.7% annualized volatility; Fama-French 3-factor alpha 0.73% per month (t = 7.39). Gross of costs.
- **Our calculation from AQR Betting Against Beta equity factors dataset (USA):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding.
- **Our calculation from AQR Betting Against Beta equity factors dataset (USA):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. After the paper's sample end.
- **Our calculation from AQR Betting Against Beta equity factors dataset (Global):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding.

### After publication

In AQR's own updated series the US BAB factor kept a Sharpe ratio of about 0.71 from April 2012 to August 2026 (catalog computation), close to its in-sample level, though these are gross returns of a levered long-short portfolio. McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

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
