---
id: ALG-0007
title: Economic momentum in currencies (Dahlquist and Hasseltoft 2020)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, strategy]
related: []
---

# Economic momentum in currencies (Dahlquist and Hasseltoft 2020)

## In plain words

If a country's economy has been getting stronger for a while, its money tends to go up in value. So you buy money from countries that are improving and sell money from countries that are slipping.

## Summary

| | |
| --- | --- |
| Family | macro-fundamental |
| Markets | fx |
| Horizon | monthly |
| Tags | cross-sectional, macro-trend, growth, inflation |
| Origin | academic: Dahlquist, Hasseltoft |
| First published | 2015 (11 years ago) |
| Primary source | [Economic momentum and currency returns (Journal of Financial Economics 136(1), 152-167, 2020; SSRN working paper 2015)](https://doi.org/10.1016/j.jfineco.2019.09.002) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Directly matches parity's macro angle and uses free data (FRED, OECD), though real-time vintages matter. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-economic-momentum.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** If a country's economy has been getting stronger for a while, its money tends to go up in value. So you buy money from countries that are improving and sell money from countries that are slipping.

<details><summary>Analogy</summary>

Like picking a sports team that has been winning more games each season, rather than one with a single lucky win.

</details>

<details><summary>Precise</summary>

Compute trends (past changes measured over 1 to 60 months) in country fundamentals linked to economic activity and inflation, relative to other countries. Rank currencies on the combined economic momentum score and go long the strongest, short the weakest. The authors report the strategy earns alpha against carry, momentum and value and subsumes the alpha of carry.

</details>

### The rule

At each month end, for each currency compute the change in activity and inflation indicators over several lookbacks between 1 and 60 months, standardize across countries, average into one economic momentum score, and hold equal-weight long the top group and short the bottom group of currencies (forward contracts vs USD) for one month.

### Data needed

- Monthly spot and 1-month forward exchange rates (or short rates) vs USD
- Monthly macro series by country: activity indicators (e.g. industrial production, unemployment) and inflation (CPI), with publication lags respected

### Why it might work

Markets appear to underreact to slowly building trends in growth and inflation, and those trends also line up with differences in interest rates, so the signal captures part of what carry captures (Dahlquist and Hasseltoft 2020).

### Why it might fail

Macro data are revised and released with lags, so a backtest on final data can overstate results. An independent replication by Papers With Backtest on 1990-2026 G10 data shows a Sharpe ratio of 0.21 and a 38.9% drawdown, far below the paper's 0.70.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Dahlquist and Hasseltoft 2020, abstract (EconPapers)](https://econpapers.repec.org/article/eeejfinec/v_3a136_3ay_3a2020_3ai_3a1_3ap_3a152-167.htm) | 1976-2017 | Developed and emerging market currencies | 0.7 | n/a | n/a | n/a | backtest | unclear | yes |
| [Papers With Backtest replication](https://paperswithbacktest.com/strategies/economic-momentum-and-currency-returns) | 1990-2026 | G10 currencies vs USD (7 positions shown) | 0.21 | 1.3% | 7.8% | -38.9% | backtest | unclear | yes |

Notes on these numbers:

- **Dahlquist and Hasseltoft 2020, abstract (EconPapers):** Sharpe 0.70 read in the abstract. The period (Jan 1976 to Mar 2017) and universe (21 developed plus some emerging markets) come from search summaries, not a page I read. A time-series version with Sharpe 0.59 was also only seen in a search summary. Full paper was paywalled.
- **Papers With Backtest replication:** Third-party implementation with monthly rebalancing; exact signal definition and cost treatment not shown on the page.

### After publication

No peer-reviewed post-publication test found. The independent Papers With Backtest replication (1990-2026) reports a much weaker Sharpe ratio of 0.21. The broader currency anomaly decay documented by Hutchinson et al. (2022, https://doi.org/10.1016/j.irfa.2022.102245) covers carry, momentum and value, not this signal.

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

- [RES-0011: Where market edges come from and which survive](../research/0011-where-market-edges-come-from-and-which-survive.md)
<!-- backlinks:end -->
