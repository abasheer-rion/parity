---
id: ALG-0043
title: Managed futures trend following (diversified time-series momentum)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, fx, momentum, open-source, strategy]
related: []
---

# Managed futures trend following (diversified time-series momentum)

## In plain words

If something has been going up, bet it keeps going up; if it has been going down, bet it keeps falling. Do this for many markets at once.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | multi-asset, fx, commodities, rates, equities |
| Horizon | monthly |
| Tags | time-series-momentum, futures, volatility-scaling, crisis-hedge, cta |
| Origin | academic: Hurst, Ooi, Pedersen |
| First published | 2014 (12 years ago) |
| Primary source | [A Century of Evidence on Trend-Following Investing (AQR white paper 2014; Journal of Portfolio Management 2017)](https://www.trendfollowing.com/whitepaper/Century_Evidence_Trend_Following.pdf) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 5 of 5: Currency trend following is one of the four sleeves, so this is the closest well-documented template for an FX strategy that aims to diversify away from the S&P 500. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/managed-futures-trend-following.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** If something has been going up, bet it keeps going up; if it has been going down, bet it keeps falling. Do this for many markets at once.

<details><summary>Analogy</summary>

Like a surfer who does not guess where waves start but jumps on any wave already moving and steps off when it fades.

</details>

<details><summary>Precise</summary>

For each futures or forward market, take a long position if its past excess return over a lookback is positive and a short if negative, sizing every position to the same ex ante volatility. Hurst, Ooi and Pedersen combine 1, 3 and 12 month lookbacks over 67 markets in four asset classes and scale the portfolio to 10% annual volatility. Returns are close to uncorrelated with stocks and bonds and tended to be positive in long equity bear markets.

</details>

### The rule

Each month, for each of N futures, compute the sign of the past 1, 3 and 12 month excess return; position = average of the three signs times (target risk / ex ante volatility of that market); scale the total book to 10% annual ex ante volatility; rebalance monthly.

### Data needed

- Continuous (rolled) futures or forward returns for equity indices, bonds, commodities and currencies, daily or monthly
- Short-term interest rates for excess returns

### Why it might work

Investor underreaction followed by delayed overreaction, plus hedging flows, create return persistence at 1 to 12 months (Moskowitz, Ooi and Pedersen 2012; Hurst, Ooi and Pedersen 2014).

### Why it might fail

Trend following loses in choppy markets and at sharp reversals; AQR's own TSMOM factor had a Sharpe ratio of about 0.38 from 2012 to mid 2026 versus about 1.4 up to 2009 (catalog computation from AQR data), and the SG Trend Index was down 9.3% in the first four months of 2025.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Hurst, Ooi and Pedersen, Exhibit 1](https://www.trendfollowing.com/whitepaper/Century_Evidence_Trend_Following.pdf) | 1880-2013 | 67 markets: equity indices, bonds, commodities, currencies | 0.77 | 11.2% | 9.7% | n/a | backtest | yes | yes |
| [Hurst, Ooi and Pedersen, Exhibit 1](https://www.trendfollowing.com/whitepaper/Century_Evidence_Trend_Following.pdf) | 2000-2013 | 67 markets | 0.62 | 7.9% | 9.6% | n/a | backtest | yes | yes |
| [Moskowitz, Ooi and Pedersen (2012), Time Series Momentum](https://pages.stern.nyu.edu/~lpederse/papers/TimeSeriesMomentum.pdf) | 1985-2009 | 58 liquid futures and forwards | n/a | n/a | 12.0% | n/a | backtest | no | yes |
| [Our calculation from AQR Time Series Momentum factors dataset (TSMOM, all assets)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx) | 1985-01 to 2026-05 | Equity indices, bonds, commodities, currencies | 0.98 | 12.2% | 12.5% | -27.9% | backtest | unclear | no |
| [Our calculation from AQR Time Series Momentum factors dataset (TSMOM, all assets)](https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx) | 2012-01 to 2026-05 | Equity indices, bonds, commodities, currencies | 0.38 | 5.1% | 13.2% | -27.9% | backtest | unclear | no |

Notes on these numbers:

- **Hurst, Ooi and Pedersen, Exhibit 1:** Net of simulated transaction costs and of a hypothetical 2% management and 20% performance fee; gross of fees the annualized return was 14.9%. Correlation to US equities 0.00. Transaction costs assumed 6 times 2012 levels before 1993.
- **Hurst, Ooi and Pedersen, Exhibit 1:** Net of simulated costs and 2/20 fees; gross 11.3%. Correlation to US equities -0.30.
- **Moskowitz, Ooi and Pedersen (2012), Time Series Momentum:** Paper reports a Sharpe ratio greater than one (no exact figure in the passage read) and an alpha of about 1.58% per month versus market, SMB, HML and UMD; diversified portfolio annualized volatility about 12%.
- **Our calculation from AQR Time Series Momentum factors dataset (TSMOM, all assets):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. 12-month lookback, 1-month hold. The dataset does not state that costs are deducted, so treat as gross.
- **Our calculation from AQR Time Series Momentum factors dataset (TSMOM, all assets):** Computed by the catalog on 2026-10-20 from the data file at source_url; this exact figure is not printed by the source. Arithmetic mean of monthly returns times 12; volatility is monthly standard deviation times sqrt(12); Sharpe uses excess returns; max drawdown from monthly compounding. Period after the 2012 journal publication.

### After publication

After the 2012 Moskowitz, Ooi and Pedersen publication, the AQR TSMOM factor's Sharpe ratio fell to about 0.38 (2012 to 2026-05, catalog computation) from about 1.41 over 1985 to 2009. Societe Generale reports the SG Trend Index lost 4.9% in April 2025 and was down 9.3% year to date (https://content.sgmarkets.com/CTA_UPDATE_KEEPING_UP_WITH_THE_TRENDFOLLOWERS_2025). McLean and Pontiff (2016) find that across 97 published stock return predictors, portfolio returns are 26% lower out of sample and 58% lower after publication (https://doi.org/10.1111/jofi.12365).

### Implementations

- [https://github.com/pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) (Python, license: GPL-3.0): Futures trading framework by Rob Carver; the provided rules folder includes ewmac.py (trend) and carry.py. Repo moved from robcarver17/pysystemtrade.

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
