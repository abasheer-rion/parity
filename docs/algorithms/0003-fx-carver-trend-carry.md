---
id: ALG-0003
title: Rob Carver trend plus carry futures system (pysystemtrade)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [fx, momentum, open-source, strategy]
related: []
---

# Rob Carver trend plus carry futures system (pysystemtrade)

## In plain words

The system buys things that have been going up and sells things that have been going down, and also leans toward things that pay you to hold them. It keeps each bet small enough that no single market can hurt too much.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | fx, multi-asset |
| Horizon | daily |
| Tags | trend-following, carry, vol-targeting, futures, open-source |
| Origin | practitioner: Rob Carver |
| First published | 2015 (11 years ago) |
| Primary source | [Systematic Trading (2015) and the pysystemtrade framework; blog post Simulating my futures system](https://qoppac.blogspot.com/2015/03/simulating-my-futures-system.html) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 5 of 5: A documented, open-source trend plus carry system that can be run on FX futures or spot data and compared directly with the S&P 500. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-carver-trend-carry.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** The system buys things that have been going up and sells things that have been going down, and also leans toward things that pay you to hold them. It keeps each bet small enough that no single market can hurt too much.

<details><summary>Analogy</summary>

Like a sailor who follows the wind (trend) but also prefers routes with a helpful current (carry), and reefs the sails when the sea gets rough.

</details>

<details><summary>Precise</summary>

Forecasts from several EWMA crossover speeds (and breakouts) plus a carry rule (roll yield, which for FX futures is the interest differential) are scaled to a common average absolute value, capped, and combined with fixed forecast weights. Positions are sized so each instrument contributes a target share of portfolio volatility, using recent standard deviation, with a buffer to cut trading costs.

</details>

### The rule

Daily, for each futures contract (including CME FX futures) compute EWMAC forecasts (e.g. 16/64, 32/128, 64/256 day spans) divided by price volatility and a carry forecast equal to annualized roll yield divided by volatility, scale each to average absolute 10, cap at 20, take a weighted average, and set position = forecast/10 x (annual vol target x capital x instrument weight x diversification multiplier) / (instrument price volatility in currency), trading only when the position moves outside a buffer.

### Data needed

- Daily futures prices for current and next contracts (or spot plus interest rates to synthesize FX carry)
- Contract specifications and costs
- Daily FX rates for P&L conversion

### Why it might work

Trend captures slow reaction to news and herding; carry earns a risk premium for holding higher-yielding assets; volatility targeting keeps risk steady (Carver, Systematic Trading 2015).

### Why it might fail

Trend can lose for years when markets chop, and carry crashes in risk-off episodes. Carver himself says he would not expect to realize the backtested Sharpe ratio, partly because the backtest period had unusually strong returns.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Carver blog, Simulating my futures system (2015)](https://qoppac.blogspot.com/2015/03/simulating-my-futures-system.html) | 1978-2015 | Up to 43 futures across asset classes (FX about 19% of risk) | 0.88 | 16.0% | 19.0% | -33.0% | backtest | yes | yes |
| [Carver blog, Annual performance update year 12](https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html) | Apr 2025-Apr 2026 | Personal diversified futures account (bonds, FX, commodities, equities) | 0.8 | 23.7% | 17.3% | n/a | live | yes | yes |

Notes on these numbers:

- **Carver blog, Simulating my futures system (2015):** Includes trend, carry, relative value and short volatility rules, not trend plus carry alone. 16% is described as an average over 32 years. Weights fitted on an expanding window. Excludes interest, FX margin effects and data fees.
- **Carver blog, Annual performance update year 12:** One year of live trading, geometric net return; the post says it underperformed the SG CTA index and AHL on a vol-adjusted basis. Since-inception stats not given in this post.

### After publication

Carver has published live annual results since 2014 on his blog; the year 12 review (Apr 2025 to Apr 2026) shows a 23.7% net return with Sharpe 0.80, behind AHL on a vol-adjusted basis.

### Implementations

- [https://github.com/pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) (Python, license: GPL-3.0): Full backtest and live trading framework by Carver; GPL-3 means derived code must stay open if distributed.

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
