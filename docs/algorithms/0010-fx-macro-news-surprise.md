---
id: ALG-0010
title: Trading FX on US macro announcement surprises
type: algorithm
status: hypothesis
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, news, open-source, strategy]
related: [HYP-0004]
---

# Trading FX on US macro announcement surprises

## In plain words

When US jobs or growth numbers come out better than experts expected, the dollar usually jumps up within minutes, and when they are worse it drops. The idea is to trade in the direction of that surprise.

## Summary

| | |
| --- | --- |
| Family | event-news |
| Markets | fx |
| Horizon | intraday |
| Tags | macro-surprise, high-frequency, us-dollar, news-reaction |
| Origin | academic: Andersen, Bollerslev, Diebold and Vega |
| First published | 2002 (24 years ago) |
| Primary source | [Micro effects of macro announcements: real-time price discovery in foreign exchange (American Economic Review 93(1), 2003; NBER WP 8959, 2002)](https://www.nber.org/papers/w8959) |
| Research stage | 3 of 9: hypothesis |
| Relevance to us | 2 of 5: Shows macro news moves FX, but the tradable edge is intraday and needs paid consensus and tick data, which is a poor fit for a free-data POC. |
| Testable with free data | no |

This page is generated from `catalog/algorithms/fx-macro-news-surprise.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** When US jobs or growth numbers come out better than experts expected, the dollar usually jumps up within minutes, and when they are worse it drops. The idea is to trade in the direction of that surprise.

<details><summary>Analogy</summary>

Like a school report card: what moves your parents is not the grade itself but how far it is from what they expected.

</details>

<details><summary>Precise</summary>

Andersen et al. show that announcement surprises (actual minus survey median, scaled) produce jumps in the conditional mean of 5-minute dollar exchange rates, with fast adjustment and little drift after. Good US growth news tends to strengthen the dollar, and bad news has a larger effect than good news.

</details>

### The rule

For each scheduled US release (e.g. nonfarm payrolls), compute the standardized surprise (actual minus consensus, divided by its historical standard deviation); immediately after release go long USD against major currencies if the surprise is positive growth news and short if negative, closing within minutes to hours. Because most of the move happens within the first 5 minutes, this needs very fast execution.

### Data needed

- Intraday FX quotes (5-minute or tick)
- Release times, actual values and consensus forecasts for US macro data
- Bid-ask spreads around releases

### Why it might work

Andersen, Bollerslev, Diebold and Vega show exchange rates are linked to fundamentals at high frequency: news moves prices in the direction macro models predict.

### Why it might fail

The paper finds the adjustment is very quick, a jump right after the release and little movement after, so slower traders mostly arrive after the move. Consensus forecast data and intraday quotes are usually paid, and spreads widen at release time.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Andersen, Bollerslev, Diebold and Vega (NBER WP 8959), event study](https://www.nber.org/system/files/working_papers/w8959/w8959.pdf) | Jan 1992 - Dec 1998 | USD vs DM, GBP, JPY, CHF, EUR, 5-minute returns | n/a | n/a | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Andersen, Bollerslev, Diebold and Vega (NBER WP 8959), event study:** Not a trading backtest. A one standard deviation US payroll surprise moves DM/$ by about 0.16 percent, against an average DM/$ spread of about 0.06 percent; only 0.7 percent of 5-minute returns exceed 0.10 percent.

### After publication

No direct out-of-sample test of a tradable surprise strategy was found on pages read. A related 2023 working paper (Antolin-Diaz, Cenedese, Han and Sarno) reports that long-short currency portfolios sorted on exposure to US interest rate surprises earned 5.27 percent a year with a Sharpe ratio of 0.72 from 2009 to 2019: https://fulcrumasset.com/wp-content/uploads/2024/07/us-interest-rate-surprises-and-currency-returns.pdf

### Implementations

- [https://github.com/macrosynergy/macrosynergy](https://github.com/macrosynergy/macrosynergy) (Python, license: BSD-3-Clause): General macro quant research toolkit from Macrosynergy, used in their economic surprise research; the underlying JPMaQS data is commercial.

## Our research

| Stage | Status |
| --- | --- |
| 1. catalogued | done |
| 2. sourced | done |
| 3. hypothesis | done |
| 4. implemented | not yet |
| 5. registered | not yet |
| 6. official | not yet |
| 7. reproduced | not yet |
| 8. forward | not yet |
| 9. verdict | not yet |

- Hypothesis: [HYP-0004](../hypotheses/0004-macro-surprises-move-fx-predictably.md)

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
