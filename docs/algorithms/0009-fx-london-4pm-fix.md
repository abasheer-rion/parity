---
id: ALG-0009
title: London 4pm fix flow and reversal effects
type: algorithm
status: sourced
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [fx, open-source, strategy]
related: []
---

# London 4pm fix flow and reversal effects

## In plain words

Big funds buy and sell lots of currency at 4pm London time, when the official daily exchange rate is set. Prices tend to get pushed one way before that moment and then bounce back after it.

## Summary

| | |
| --- | --- |
| Family | market-making-liquidity |
| Markets | fx |
| Horizon | intraday |
| Tags | benchmark-fix, month-end, hedging-flows, reversal, intraday |
| Origin | academic: Melvin and Prins; Evans; Krohn, Mueller and Whelan |
| First published | 2015 (11 years ago) |
| Primary source | [Equity hedging and exchange rates at the London 4p.m. fix (Journal of Financial Markets 22, 2015)](https://ideas.repec.org/a/eee/finmar/v22y2015icp50-72.html) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: A real flow effect, but it is intraday and cost-sensitive, so it is a weak candidate for a daily or monthly strategy meant to beat the S&P 500. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/fx-london-4pm-fix.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Big funds buy and sell lots of currency at 4pm London time, when the official daily exchange rate is set. Prices tend to get pushed one way before that moment and then bounce back after it.

<details><summary>Analogy</summary>

Like a crowded store right before closing: prices of the last items get pushed around by the rush, then settle once the crowd leaves.

</details>

<details><summary>Precise</summary>

Melvin and Prins show that relative equity gains over a month predict that country's currency weakening before the month-end 4pm fix, consistent with foreign equity investors resizing currency hedges. Evans finds extraordinary volatility and negative serial correlation around the fix across 21 currencies, and Krohn, Mueller and Whelan document the dollar rising before major fixes and falling after, every year from 1999 to 2018.

</details>

### The rule

Month-end version: on the last trading day of the month, if a country's equity market outperformed US equities over the month, sell its currency against USD a few hours before the 4pm London fix and close at the fix (Melvin and Prins). Daily version: go long USD in the hours before the fix and short USD after it, closing by the New York close (Krohn, Mueller and Whelan).

### Data needed

- Intraday FX quotes around 4pm London (minute or tick)
- Monthly equity index returns by country
- Realistic bid-ask spreads

### Why it might work

Predictable, price-insensitive orders from passive equity hedgers and other benchmark users concentrate at the fix, and dealers who absorb them need compensation for inventory risk (Melvin and Prins; Krohn, Mueller and Whelan).

### Why it might fail

Krohn, Mueller and Whelan find the intraday swings mostly vanish with full bid-ask costs and only survive for traders with tighter spreads. Fix-related trading by banks drew regulatory fines (Evans), and the fix process changed after those reviews, so past patterns may not repeat.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Krohn, Mueller and Whelan (2020 working paper; JF 2024), EUR around London fix](https://sites.insead.edu/facultyresearch/research/file.cfm?fid=66802) | 1999-2018 | EUR/USD | 0.65 | n/a | n/a | n/a | backtest | yes | yes |
| [Krohn, Mueller and Whelan (2020 working paper), fix reversal strategy, gross](https://sites.insead.edu/facultyresearch/research/file.cfm?fid=66802) | Jan 1999 - Dec 2018 | EUR around ECB fix, GBP around London fix, JPY around Tokyo fix | n/a | 13.6% | n/a | n/a | backtest | no | yes |
| [Melvin and Prins (2015), ECB workshop version (BlackRock authors)](https://ecb.eu/events/pdf/conferences/131216/Third_FX_Workshop_MELVIN_PRINS_Equity%20hedging%20and%20exchange%20rates%20Nov%202013.pdf) | About 2004 to 2012-12 (8.66 years) | G10 currencies, 15:00 to 16:00 London on the last day of the month | n/a | n/a | n/a | n/a | backtest | unclear | yes |

Notes on these numbers:

- **Krohn, Mueller and Whelan (2020 working paper; JF 2024), EUR around London fix:** Authors' example with conservative transaction costs: $1 in 1999 more than triples by 2018, realized Sharpe 0.65, about twice a passive S&P 500 position over the same period.
- **Krohn, Mueller and Whelan (2020 working paper), fix reversal strategy, gross:** Table 8: gross annualized returns 13.6, 11.2 and 12.9 percent for euro, pound and yen (only the pound is traded around the London fix). With full indicative bid-ask spreads most windows turn negative; with spreads cut by 50 percent returns are 6.6, 4.2 and 3.4 percent, with Sharpe ratios of about 0.5 to 0.7. annual_return shows the euro gross figure.
- **Melvin and Prins (2015), ECB workshop version (BlackRock authors):** Equity returns over the month predict currency depreciation before the month-end fix; the authors call the effect statistically significant but small, a few basis points. They cite Rizeanu and Zhang (2013), who find no such link for 23 emerging market currencies.

### After publication

Krohn, Mueller and Whelan (published Journal of Finance 2024) find the pre-fix dollar appreciation and post-fix reversal present in each of the twenty years of their 1999-2018 sample, after the Melvin and Prins (2015) and Evans (2018) papers, but say the swings are hard to exploit after costs.

### Implementations

- [https://github.com/amandanish882/fxfixaware_wpattern](https://github.com/amandanish882/fxfixaware_wpattern) (Python, license: none): Small personal project on fix-aware quoting in CME FX futures based on Krohn, Mueller and Whelan. No license file; not reviewed in detail.

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


RES-0016: not useful for emerging markets, and needs intraday prices.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
