---
id: ALG-0046
title: Risk parity (inverse volatility asset allocation)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, open-source, strategy]
related: []
---

# Risk parity (inverse volatility asset allocation)

## In plain words

Give each type of investment the same amount of wobble instead of the same amount of money. Calm things get more money, jumpy things get less.

## Summary

| | |
| --- | --- |
| Family | portfolio-construction |
| Markets | multi-asset, equities, rates, commodities |
| Horizon | monthly |
| Tags | inverse-volatility, diversification, volatility-targeting, leverage |
| Origin | academic: Asness, Frazzini, Pedersen |
| First published | 2012 (14 years ago) |
| Primary source | [Leverage Aversion and Risk Parity (Financial Analysts Journal)](https://doi.org/10.2469/faj.v68.n1.1) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: The same inverse-volatility weighting can size FX positions, and it is a common multi-asset benchmark. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/risk-parity.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Give each type of investment the same amount of wobble instead of the same amount of money. Calm things get more money, jumpy things get less.

<details><summary>Analogy</summary>

Like loading a canoe so every paddler carries the same effort, rather than giving each the same size bag.

</details>

<details><summary>Precise</summary>

Weights are set proportional to the inverse of each asset class's estimated volatility, so each contributes similar risk; the whole portfolio is then scaled (often with borrowing) to a target volatility. Asness, Frazzini and Pedersen argue that leverage-averse investors overprice risky assets, so safer assets like bonds carry higher risk-adjusted returns that a levered risk parity portfolio can collect.

</details>

### The rule

At each month end, set the weight of each asset class to k divided by its volatility, estimated from the past 36 monthly excess returns; choose k so the portfolio hits a volatility target (for example the volatility of a 60/40 or market portfolio); rebalance monthly.

### Data needed

- Monthly total returns for equities, government bonds, credit, commodities
- T-bill or futures financing rate

### Why it might work

Leverage aversion makes low-risk assets offer higher Sharpe ratios; risk parity overweights them and applies leverage (Asness, Frazzini and Pedersen 2012; Frazzini and Pedersen 2014).

### Why it might fail

It depends on bonds staying a good diversifier and on cheap borrowing; in 2022 stocks and bonds fell together (S&P 500 -18.0%, 10-year Treasury -17.8% per Damodaran), the setting where a bond-heavy levered portfolio is hurt most.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Asness, Frazzini and Pedersen (2012), Table 2, RP (levered)](https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/Leverage-Aversion-and-Risk-Parity.pdf) | 1926-2010 | US stocks and bonds (CRSP) | 0.53 | 8.0% | 15.1% | n/a | backtest | unclear | yes |
| [Asness, Frazzini and Pedersen (2012), Table 2, RP unlevered](https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/Leverage-Aversion-and-Risk-Parity.pdf) | 1926-2010 | US stocks and bonds (CRSP) | 0.52 | 2.2% | 4.2% | n/a | backtest | unclear | yes |
| [Asness, Frazzini and Pedersen (2012), Table 2, 60/40 benchmark](https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/Leverage-Aversion-and-Risk-Parity.pdf) | 1926-2010 | US stocks and bonds (CRSP) | 0.4 | 4.7% | 11.7% | n/a | backtest | unclear | yes |
| [Asness, Frazzini and Pedersen (2012), Table 2, RP broad sample](https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/Leverage-Aversion-and-Risk-Parity.pdf) | 1973-2010 | Global stocks, US bonds, credit, commodities | 0.61 | 6.2% | 10.1% | n/a | backtest | unclear | yes |

Notes on these numbers:

- **Asness, Frazzini and Pedersen (2012), Table 2, RP (levered):** Annual excess return over T-bills. Leverage chosen to match the ex post volatility of the value-weighted benchmark, which uses hindsight for scaling only. Trading costs not explicitly deducted; financing discussed in the paper's Appendix B.
- **Asness, Frazzini and Pedersen (2012), Table 2, RP unlevered:** Weights rescaled to sum to one each month; annual excess return over T-bills.
- **Asness, Frazzini and Pedersen (2012), Table 2, 60/40 benchmark:** Comparison row from the same table; RP minus 60/40 had a 3.34% excess return (t = 2.93).
- **Asness, Frazzini and Pedersen (2012), Table 2, RP broad sample:** Annual excess return over T-bills; value-weighted benchmark in the same sample had a Sharpe ratio of 0.43.

### After publication

The 2012 paper's sample ends in 2010, during a long bond rally. The catalog did not find a verifiable post-2012 risk parity index series to quote; the 2022 joint stock and bond loss (Damodaran data) is the main known stress for the approach.

### Implementations

- [https://github.com/dcajasn/Riskfolio-Lib](https://github.com/dcajasn/Riskfolio-Lib) (Python, license: BSD-3-Clause): Portfolio optimization library with risk parity and risk budgeting models.

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
