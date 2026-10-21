---
id: ALG-0036
title: Technical indicator bots (freqtrade, Zenbot sample strategies)
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [crypto, open-source, strategy]
related: []
---

# Technical indicator bots (freqtrade, Zenbot sample strategies)

## In plain words

A program watches price charts and buys or sells when lines like moving averages or RSI cross certain levels.

## Summary

| | |
| --- | --- |
| Family | technical-indicator |
| Markets | crypto |
| Horizon | intraday |
| Tags | retail-bot, moving-average, data-snooping, open-source |
| Origin | open-source: Zenbot (2016) and freqtrade (2017) communities; academic test by Hudson and Urquhart |
| First published | 2016 (10 years ago) |
| Primary source | [Technical trading and cryptocurrencies (Annals of Operations Research 2021)](https://doi.org/10.1007/s10479-019-03357-1) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 2 of 5: Freqtrade is good test plumbing, but indicator rules themselves show little out-of-sample edge on the main liquid asset. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/technical-indicator-trading-bots.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** A program watches price charts and buys or sells when lines like moving averages or RSI cross certain levels.

<details><summary>Analogy</summary>

Like a thermostat that turns the heat on and off at set temperatures, whether or not the weather pattern has changed.

</details>

<details><summary>Precise</summary>

Rules built from moving averages, RSI, Bollinger bands, MACD and similar indicators on 1-minute to 1-day candles, often tuned with hyperparameter search (freqtrade hyperopt). Hudson and Urquhart test about 15,000 rules with multiple-testing corrections.

</details>

### The rule

Example freqtrade-style rule: on 5-minute candles, buy when RSI(14) < 30 and the fast EMA crosses above the slow EMA; sell when RSI > 70 or a fixed stop loss or take profit is hit.

### Data needed

- OHLCV candles from exchange APIs (free)
- Fee schedule

### Why it might work

Detzel et al. (2021) argue technical rules can be rational when fundamentals are hard to value, as with bitcoin.

### Why it might fail

Zenbot's README says default parameters will underperform buy-and-hold; freqtrade's docs say lookahead bias is easy to introduce and makes biased strategies look very profitable. Hudson and Urquhart find no predictability for Bitcoin out of sample.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Hudson and Urquhart (2021), abstract (open access copy)](https://centaur.reading.ac.uk/85715/8/Hudson-Urquhart2019_Article_TechnicalTradingAndCryptocurre.pdf) | CoinDesk BTC from 2010-07-18; other coins from later start dates | Two BTC markets plus three other coins | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Zenbot README](https://github.com/DeviaVir/zenbot) | n/a | Crypto exchanges | n/a | n/a | n/a | n/a | backtest | unclear | yes |

Notes on these numbers:

- **Hudson and Urquhart (2021), abstract (open access copy):** In-sample: significant predictability for all five rule classes after data-snooping corrections, with breakeven costs above typical crypto costs. Out-of-sample: 'no predictability for Bitcoin', though some remains in other coins.
- **Zenbot README:** README states default trade parameters will underperform a buy-hold strategy and that the project is no longer maintained (repo archived).

### After publication

Hudson and Urquhart's out-of-sample period shows no Bitcoin predictability. Zenbot was archived in 2022. Freqtrade added lookahead and recursive analysis tools because user strategies often contain leakage.

### Implementations

- [https://github.com/freqtrade/freqtrade](https://github.com/freqtrade/freqtrade) (Python, license: GPL-3.0): Active; includes backtesting, hyperopt, FreqAI, lookahead-analysis.
- [https://github.com/freqtrade/freqtrade-strategies](https://github.com/freqtrade/freqtrade-strategies) (Python, license: GPL-3.0): Community sample strategies, explicitly not vetted for profit.
- [https://github.com/DeviaVir/zenbot](https://github.com/DeviaVir/zenbot) (JavaScript, license: MIT): Archived, unmaintained.
- [https://github.com/jesse-ai/jesse](https://github.com/jesse-ai/jesse) (Python, license: MIT): Alternative backtest framework.

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
