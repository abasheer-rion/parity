---
id: ALG-0013
title: FX order flow signal
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, open-source, strategy]
related: []
---

# FX order flow signal

## In plain words

Count whether people are mostly buying or mostly selling a currency. Currencies that lots of informed customers are buying tend to keep rising for a while.

## Summary

| | |
| --- | --- |
| Family | market-making-liquidity |
| Markets | fx |
| Horizon | daily |
| Tags | order-flow, microstructure, cross-sectional, proprietary-data |
| Origin | academic: Evans and Lyons |
| First published | 1999 (27 years ago) |
| Primary source | [Order flow and exchange rate dynamics (Journal of Political Economy 110(1), 2002; NBER WP 7317, 1999)](https://www.nber.org/papers/w7317) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: Strong academic results, but the needed order flow data is proprietary, so parity cannot test it with free data. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/fx-order-flow.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Count whether people are mostly buying or mostly selling a currency. Currencies that lots of informed customers are buying tend to keep rising for a while.

<details><summary>Analogy</summary>

Like watching which food stall has the longest queue: the queue tells you something about the food before you taste it.

</details>

<details><summary>Precise</summary>

Evans and Lyons show signed interdealer order flow explains over half of daily DM/$ and yen/$ changes, far more than macro variables. Menkhoff, Sarno, Schmeling and Schrimpf show lagged customer order flow from a large dealer predicts the cross-section of currency excess returns, especially flows from long-term asset managers.

</details>

### The rule

Each day standardize each currency's net customer order flow by its rolling 60-day standard deviation, rank currencies, and go long the top group (highest buying pressure) and short the bottom group against USD, rebalancing daily or every few days (Menkhoff et al. 2016).

### Data needed

- Daily signed customer or interdealer order flow by currency (proprietary, from a dealer or platform)
- Daily FX spot and forward rates
- Bid-ask spreads

### Why it might work

Order flow aggregates dispersed private information about fundamentals and hedging demand, which moves prices (Evans and Lyons 2002); different customer groups differ in information and risk sharing (Menkhoff et al. 2016).

### Why it might fail

The data is proprietary and hard for outsiders to get, and the Evans and Lyons result is mostly contemporaneous, which explains prices but does not by itself forecast them. Free proxies such as weekly CFTC positioning are much coarser.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Evans and Lyons (NBER WP 7317), explanatory model](https://www.nber.org/system/files/working_papers/w7317/w7317.pdf) | May-Aug 1996 (4 months) | DM/$ and yen/$ interdealer flow | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Menkhoff, Sarno, Schmeling and Schrimpf (2016), Table I, BMS portfolio, 15 currencies](https://openaccess.city.ac.uk/id/eprint/13781/1/OFSORTS_JF_COPYEDIT_v4%20paper_and_IA.pdf) | Jan 2001 - May 2011 | 15 currencies vs USD, customer flows from one large dealer | 1.26 | 10.3% | n/a | n/a | backtest | no | yes |
| [Menkhoff, Sarno, Schmeling and Schrimpf (2016), Table I, long-term asset manager flows](https://openaccess.city.ac.uk/id/eprint/13781/1/OFSORTS_JF_COPYEDIT_v4%20paper_and_IA.pdf) | Jan 2001 - May 2011 | 15 currencies vs USD | 1.79 | 15.4% | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Evans and Lyons (NBER WP 7317), explanatory model:** Not a trading backtest. Model of daily changes with order flow has R-squared about 64 percent for DM/$ and 45 percent for yen/$; $1 billion of net dollar purchases raises DM/$ by about 1 pfennig.
- **Menkhoff, Sarno, Schmeling and Schrimpf (2016), Table I, BMS portfolio, 15 currencies:** Gross daily-rebalanced long-short on lagged standardized flow. Authors report returns remain significant after bid-ask costs for rebalancing every 1 to 10 days (figure in Internet Appendix).
- **Menkhoff, Sarno, Schmeling and Schrimpf (2016), Table I, long-term asset manager flows:** Flows of long-term demand-side investment managers were most informative; individual investors' flows had Sharpe -1.55 (they traded the wrong way).

### After publication

Menkhoff et al. (2016) confirm order flow predicts currency returns in 2001-2011, after Evans and Lyons (2002). No public test on data after 2011 was found.

### Implementations

- [https://github.com/giorgiagaleazzi/fx-order-flow-microstructure](https://github.com/giorgiagaleazzi/fx-order-flow-microstructure) (R, license: none): Small personal reproduction of an FX order flow paper using weekly UBS customer flow data 2001-2007. No license file; not reviewed in detail.

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
