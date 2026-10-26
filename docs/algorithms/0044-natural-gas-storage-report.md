---
id: ALG-0044
title: EIA weekly natural gas storage report trading
type: algorithm
status: sourced
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [commodities, news, strategy]
related: []
---

# EIA weekly natural gas storage report trading

## In plain words

Every Thursday the US says how much natural gas went into or out of storage. Gas prices swing hard right after, depending on whether the number beat guesses.

## Summary

| | |
| --- | --- |
| Family | event-news |
| Markets | commodities |
| Horizon | intraday |
| Tags | macro-announcement, surprise, natural-gas, volatility |
| Origin | academic: Linn, Zhu |
| First published | 2004 (22 years ago) |
| Primary source | [Natural gas prices and the gas storage report: Public news and volatility in energy futures markets (Journal of Futures Markets)](https://doi.org/10.1002/fut.10115) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: A scheduled energy news event, but natural gas has little direct link to major currencies, so it is mainly a template for event handling. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/natural-gas-storage-report.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Every Thursday the US says how much natural gas went into or out of storage. Gas prices swing hard right after, depending on whether the number beat guesses.

<details><summary>Analogy</summary>

Like a school posting exam results at a set time: everyone reacts in the same few minutes.

</details>

<details><summary>Precise</summary>

The storage surprise is the reported weekly injection or withdrawal minus the analyst consensus. Linn and Zhu find volatility of NYMEX natural gas futures spikes at the release and stays high for about 30 minutes. Gay, Simkins and Turac show the market weights individual analyst forecasts by their past accuracy when forming the expectation.

</details>

### The rule

At the Thursday 10:30 ET EIA storage release, compute surprise = actual net change minus consensus; go short front-month natural gas futures if the build is larger than expected (or the draw smaller), long in the opposite case; exit within 30 minutes. A volatility variant buys short-dated options before the release.

### Data needed

- EIA Weekly Natural Gas Storage Report history (free)
- Analyst consensus forecasts (paid)
- Intraday NYMEX natural gas futures prices
- Weather (heating and cooling degree days) as a control

### Why it might work

Storage is the main public signal of the gas supply and demand balance, so news moves prices (Linn and Zhu 2004; Hu, Hu and Lin 2014).

### Why it might fail

Most of the move happens within minutes and expectations already embed analyst forecasts (Gay, Simkins and Turac 2009); weather shocks also drive prices and can swamp the storage signal (Hu, Hu and Lin 2014).

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Linn and Zhu (2004), Journal of Futures Markets abstract](https://doi.org/10.1002/fut.10115) | 1999-01 to 2002 (AGA report) and after 2002-05 (EIA report) | NYMEX natural gas futures, intraday | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Hu, Hu and Lin (2014), The Scientific World Journal (full text via Europe PMC PMC4122141)](https://doi.org/10.1155/2014/457636) | 2003-01 to 2006-12 | Near and far month natural gas futures, daily | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Prokopczuk, Wese Simen and Wichmann (2021), accepted version, Table 8](https://centaur.reading.ac.uk/90003/1/NG_paper_final_round.pdf) | 2003-03 to 2018-12 | Henry Hub natural gas futures, front contract | 1.76 | 12.0% | n/a | n/a | backtest | yes | yes |

Notes on these numbers:

- **Linn and Zhu (2004), Journal of Futures Markets abstract:** Volatility study, not a trading backtest: the storage report caused considerable volatility at release and for up to 30 minutes after. No return figures in the abstract. Read via the OpenAlex record.
- **Hu, Hu and Lin (2014), The Scientific World Journal (full text via Europe PMC PMC4122141):** Storage announcements significantly affect natural gas futures returns; expected inventory surprises negatively affect far-month returns; volatility is higher on Thursdays. No Sharpe or return figures for a trading rule.
- **Prokopczuk, Wese Simen and Wichmann (2021), accepted version, Table 8:** Short from 90 minutes before to 30 minutes after each EIA storage report, after bid-ask and funding costs. Settlement-price version 17.86% a year, Sharpe 2.57. Early sub-period 25% a year, Sharpe 3.26; recent sub-period about 3% and Sharpe 0.5, not enough to cover costs.

### After publication

Prokopczuk et al. (2021) find the announcement-day effect absent in 2014 to 2018 and conclude the anomaly has been arbitraged away.

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


RES-0017: decayed, and the paper's version needs intraday prices.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0015: Famous currency and commodity traders and what their records teach](../research/0015-famous-currency-and-commodity-traders-and-what-their-records-teach.md)
- [RES-0017: Combining many strategies, the evidence and the ingredient list](../research/0017-combining-many-strategies-the-evidence-and-the-ingredient-list.md)
<!-- backlinks:end -->
