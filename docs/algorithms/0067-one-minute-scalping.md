---
id: ALG-0067
title: Scalping on 1-minute charts
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [crypto, fx, strategy]
related: []
---

# Scalping on 1-minute charts

## In plain words

Make dozens of very quick trades a day, each trying to grab a few cents or pips, using signals on charts where each bar is one minute.

## Summary

| | |
| --- | --- |
| Family | technical-indicator |
| Markets | fx, equities, crypto |
| Horizon | intraday |
| Tags | scalping, day-trading, retail-outcomes, high-turnover |
| Origin | community: Day-trading courses and YouTube channels; no single author |
| First published | n/a (n/a ago) |
| Primary source | [No dated primary source found](https://faculty.haas.berkeley.edu/odean/papers/Day%20Traders/Day%20Trade%20040330.pdf) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 1 of 5: Needs tick or minute data and the evidence on people who try it is strongly negative. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/one-minute-scalping.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Make dozens of very quick trades a day, each trying to grab a few cents or pips, using signals on charts where each bar is one minute.

<details><summary>Analogy</summary>

Like picking up coins in front of a steamroller: each coin is small, and the costs and one bad slip add up fast.

</details>

<details><summary>Precise</summary>

Typical rules combine fast EMAs (for example 9 and 21), VWAP or stochastic crosses on 1-minute bars, targets of 3 to 10 pips and stops of similar size, often several dozen trades a day. Because each gain is about the size of the spread and commission, costs dominate. The best evidence is on the people doing it: large studies of day traders in Taiwan and Brazil find the vast majority lose money.

</details>

### The rule

Example as taught: on EUR/USD 1-minute bars, buy when the 9 EMA crosses above the 21 EMA and price is above VWAP; take profit at 5 pips, stop at 5 pips; sell short on the opposite cross; no trades outside the London and New York sessions.

### Data needed

- Tick or 1-minute FX data
- Realistic spread and commission per trade

### Why it might work

Proponents claim short-term order-flow imbalances are predictable. Barber, Lee, Liu and Odean (2004) find a small group of day traders with persistent skill, so it is not impossible, but it is rare.

### Why it might fail

Barber et al. (2004) find more than eight in ten Taiwanese day traders lose money in a typical six-month period and heavy day traders' gross profits do not cover costs. Barber et al. (2017) find the aggregate performance of day traders is negative and fewer than 1 percent are predictably profitable. Chague and Giovannetti (2025) estimate Brazilian individual day traders lost R$9.9 billion from the pandemic to December 2023.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Barber, Lee, Liu and Odean (2004), Do individual day traders make money? Evidence from Taiwan](https://faculty.haas.berkeley.edu/odean/papers/Day%20Traders/Day%20Trade%20040330.pdf) | 1995-1999 | Taiwan Stock Exchange, individual day traders | n/a | n/a | n/a | n/a | live | yes | yes |
| [Barber, Lee, Liu, Odean and Zhang (2017 version), Do day traders rationally learn about their ability?](https://faculty.haas.berkeley.edu/odean/papers/Day%20Traders/Day%20Trading%20and%20Learning%20110217.pdf) | 1992-2006 | Taiwan, individual day traders | n/a | n/a | n/a | n/a | live | yes | yes |
| [Chague and Giovannetti (2025), The COVID-19 and day-trade pandemics in Brazil, Revista Brasileira de Financas, abstract](https://doi.org/10.12660/rbfin.v23n1.2025.94291) | Mar 2020 - Dec 2023 | All individual day traders on the Brazilian exchange | n/a | n/a | n/a | n/a | live | no | yes |
| [ESMA product intervention press release, 27 March 2018](https://www.esma.europa.eu/press-news/esma-news/esma-agrees-prohibit-binary-options-and-restrict-cfds-protect-retail-investors) | Data cited by national regulators before 2018 | Retail CFD accounts in the EU (FX is the largest CFD market) | n/a | n/a | n/a | n/a | live | yes | yes |

Notes on these numbers:

- **Barber, Lee, Liu and Odean (2004), Do individual day traders make money? Evidence from Taiwan:** 'In the typical six month period, more than eight out of ten day traders lose money.' Heavy day traders earn gross profits that do not cover costs. A small group with strong past performance keeps earning; their buys beat their sells by 62 bp per day.
- **Barber, Lee, Liu, Odean and Zhang (2017 version), Do day traders rationally learn about their ability?:** Aggregate day-trader performance is negative and 'the vast majority of day traders are unprofitable'; cites their 2010 finding that less than 1 percent of day traders predictably earn profits.
- **Chague and Giovannetti (2025), The COVID-19 and day-trade pandemics in Brazil, Revista Brasileira de Financas, abstract:** Abstract read through its OpenAlex record. Gross losses of R$9.9 billion, an average loss of R$10,200 per individual, around 100,000 active day traders per day.
- **ESMA product intervention press release, 27 March 2018:** '74-89% of retail accounts typically lose money on their investments, with average losses per client ranging from EUR 1,600 to EUR 29,000.' ESMA then limited retail positions on major FX pairs to 30 times the margin posted. Covers all retail CFD trading, not this strategy alone.

### After publication

We found no evidence on how it did after it became known.

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
