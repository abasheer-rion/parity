---
id: ALG-0004
title: Commodity prices and terms of trade as a currency signal
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, fx, open-source, strategy]
related: []
---

# Commodity prices and terms of trade as a currency signal

## In plain words

Countries like Australia, Canada and Norway sell a lot of raw materials. When the prices of what they sell go up, people want their money more, so it tends to rise.

## Summary

| | |
| --- | --- |
| Family | macro-fundamental |
| Markets | fx, commodities |
| Horizon | daily |
| Tags | commodity-currencies, terms-of-trade, time-series, cross-asset |
| Origin | academic: Kohlscheen, Avalos, Schrimpf |
| First published | 2016 (10 years ago) |
| Primary source | [When the walk is not random: commodity prices and exchange rates (BIS Working Paper 551, 2016; International Journal of Central Banking 13(2), 2017)](https://www.ijcb.org/sites/default/files/journal/v13n2/ijcb-v13n2-when-walk-not-random-commodity-prices-and-exchange-rates.pdf) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Fits parity's commodities-plus-FX idea directly, and free daily commodity and FX prices are enough for a first test. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/fx-commodity-terms-of-trade.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Countries like Australia, Canada and Norway sell a lot of raw materials. When the prices of what they sell go up, people want their money more, so it tends to rise.

<details><summary>Analogy</summary>

Like a farmer's bank balance going up when the price of wheat rises: the town that sells wheat gets richer too.

</details>

<details><summary>Precise</summary>

Build a country-specific commodity export price index (CXPI) weighting commodity prices by each country's export basket, then relate CXPI changes to that country's exchange rate. Kohlscheen et al. show daily CXPI changes beat a random walk for 11 exporters in out-of-sample fit tests, but mostly when the commodity move is the same day; lagged CXPI changes beat the random walk in only a few countries. Practitioners (Macrosynergy) use smoothed terms-of-trade changes as a slower signal.

</details>

### The rule

Daily, compute each exporter's export-weighted commodity price index; go long the currency (vs USD) after a rise in its index over the signal window and short after a fall, for example using the average of 1-week, 1-month and 1-year changes, sized by inverse volatility.

### Data needed

- Daily spot FX for commodity exporters (AUD, CAD, NOK, NZD, BRL, CLP, ZAR, etc.)
- Daily commodity prices (oil, metals, agriculturals)
- Export shares by commodity per country (UN Comtrade)

### Why it might work

Higher prices for a country's exports raise expected export revenue and capital inflows, which supports its currency (terms-of-trade channel, Kohlscheen, Avalos and Schrimpf 2017).

### Why it might fail

The strong link is mostly contemporaneous, so it does not translate into a tradable forecast unless commodities themselves are predicted; the authors state lagged commodity prices beat the random walk in only a few countries. Central bank intervention weakens the link in some emerging markets.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Kohlscheen, Avalos, Schrimpf 2017, Table 3 (IJCB)](https://www.ijcb.org/sites/default/files/journal/v13n2/ijcb-v13n2-when-walk-not-random-commodity-prices-and-exchange-rates.pdf) | Jan 2009-Feb 2015 evaluation (data from Jan 2004) | 11 commodity exporter currencies vs USD, daily | n/a | n/a | n/a | n/a | backtest | no | yes |

Notes on these numbers:

- **Kohlscheen, Avalos, Schrimpf 2017, Table 3 (IJCB):** Forecast test, not a trading backtest. RMSE ratio vs random walk 0.850 for CAD and 0.858 for AUD using same-day commodity changes (pseudo out-of-sample fit). With lagged commodity prices only, few countries beat the random walk (Chile best).

### After publication

Macrosynergy research (https://macrosynergy.com/research/commodity-terms-of-trade/) reports using commodity-based terms-of-trade changes as an FX signal with point-in-time data; I could not open the page (bot protection), so no numbers are recorded here.

### Implementations

- [https://github.com/macrosynergy/macrosynergy](https://github.com/macrosynergy/macrosynergy) (Python, license: BSD-3-Clause): Macrosynergy's signal research package; its terms-of-trade examples rely on paid JPMaQS data.

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
