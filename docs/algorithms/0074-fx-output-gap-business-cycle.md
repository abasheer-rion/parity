---
id: ALG-0074
title: Output gap currency strategy
type: algorithm
status: sourced
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [fx, strategy]
related: []
---

# Output gap currency strategy

## In plain words

Buy the currencies of countries whose economies are running hotter than usual and sell the currencies of countries whose economies are running cold.

## Summary

| | |
| --- | --- |
| Family | macro-fundamental |
| Markets | fx |
| Horizon | monthly |
| Tags | business-cycle, output-gap, macro, vintage-data |
| Origin | academic: Colacito, Riddiough and Sarno |
| First published | 2020 (6 years ago) |
| Primary source | [Business cycles and currency returns (Journal of Financial Economics 137(3), 659-678)](https://www.nber.org/papers/w26299) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 3 of 5: Monthly and diversifying, but it needs vintage macro data to avoid look-ahead, which takes effort to assemble. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-output-gap-business-cycle.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Buy the currencies of countries whose economies are running hotter than usual and sell the currencies of countries whose economies are running cold.

<details><summary>Analogy</summary>

Like backing the shops on the busiest street in town: when a country is booming, its money tends to be in demand.

</details>

<details><summary>Precise</summary>

Each month compute each country's output gap from industrial production with a Hodrick-Prescott filter, minus the US gap, using data vintages available at the time. Sort currencies into five portfolios and go long the highest relative gap and short the lowest (GAP-CS), or long all currencies with gaps above the US and short those below (GAP-TS).

</details>

### The rule

Month end: for each country, output gap = industrial production minus its one-sided HP trend, using only data published by then. Subtract the US gap. Long the top quintile, short the bottom quintile, equal weights, via one-month forwards. Rebalance monthly.

### Data needed

- Real-time (vintage) industrial production by country, for example OECD Main Economic Indicators vintages
- Monthly spot and forward rates
- Bid-ask spreads

### Why it might work

The authors argue that currencies of countries in strong phases of the business cycle carry higher risk premia, and they find the signal is unrelated to carry.

### Why it might fail

Industrial production is revised, so using today's data instead of the vintage known at the time adds look-ahead. HP filters are known to bend at the end of a sample. The 1999-2016 sample is short, and we found no outside replication.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Colacito, Riddiough and Sarno (2020), NBER w26299, introduction, GAP-CS](https://www.nber.org/system/files/working_papers/w26299/w26299.pdf) | 1999-2016 (vintage data) | Developed and emerging currencies vs USD | 0.72 | n/a | n/a | n/a | backtest | no | yes |
| [Colacito, Riddiough and Sarno (2020), NBER w26299, introduction, GAP-CS after costs](https://www.nber.org/system/files/working_papers/w26299/w26299.pdf) | 1999-2016 (vintage data) | Developed and emerging currencies vs USD | 0.5 | n/a | n/a | n/a | backtest | yes | yes |
| [Colacito, Riddiough and Sarno (2020), NBER w26299, introduction, GAP-TS after costs](https://www.nber.org/system/files/working_papers/w26299/w26299.pdf) | 1999-2016 (vintage data) | Developed and emerging currencies vs USD | 0.5 | n/a | n/a | n/a | backtest | yes | yes |

Notes on these numbers:

- **Colacito, Riddiough and Sarno (2020), NBER w26299, introduction, GAP-CS:** Quote: "Between 1999 and 2016, a high-minus-low cross-sectional strategy that sorts on relative output gaps across countries, which we denote as GAPCS, generates a Sharpe ratio of 0.72 before transaction costs, and 0.50 after costs." Before costs; the same sentence gives 0.50 after costs.
- **Colacito, Riddiough and Sarno (2020), NBER w26299, introduction, GAP-CS after costs:** Quote: "Between 1999 and 2016, a high-minus-low cross-sectional strategy that sorts on relative output gaps across countries, which we denote as GAPCS, generates a Sharpe ratio of 0.72 before transaction costs, and 0.50 after costs."
- **Colacito, Riddiough and Sarno (2020), NBER w26299, introduction, GAP-TS after costs:** Quote: "a time series strategy, which goes long (short) currencies issued by countries with output gaps above (below) the US, denoted as GAPTS, generates a Sharpe ratio of 0.65 before costs and 0.50 after costs." Time series version; 0.65 before costs.

### After publication

None found by us. The paper reports correlations with carry that are essentially zero.

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


Added from the paper library (RES-0010) on 2026-10-21.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0010: Paper library: FX and market microstructure](../research/0010-paper-library-fx-and-market-microstructure.md)
<!-- backlinks:end -->
