---
id: ALG-0072
title: Donchian channel / Turtle Traders breakout
type: algorithm
status: sourced
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [commodities, fx, momentum, open-source, strategy]
related: []
---

# Donchian channel / Turtle Traders breakout

## In plain words

Buy when price makes a new 20-day (or 55-day) high and sell when it makes a new low. Bet the same amount of risk every time and cut losers fast.

## Summary

| | |
| --- | --- |
| Family | momentum-trend |
| Markets | fx, commodities, multi-asset |
| Horizon | daily |
| Tags | channel-breakout, trend-following, turtle-traders, position-sizing |
| Origin | practitioner: Richard Donchian; later Richard Dennis and William Eckhardt's Turtle program (1983), popularized by Curtis Faith's Way of the Turtle (2007) |
| First published | 1960 (66 years ago) |
| Primary source | [High Finance in Copper (Financial Analysts Journal, Nov/Dec 1960)](https://farmdoc.illinois.edu/assets/marketing/agmas/AgMAS04_04.pdf) |
| Research stage | 2 of 9: sourced |
| Relevance to us | 4 of 5: Daily breakout on G10 FX is cheap to test with free data and is the classic retail trend system. |
| Testable with free data | yes |

This page is generated from `catalog/algorithms/turtle-donchian-breakout.json`. Edit that file, then run `python3 scripts/docs.py index`. Terms are explained in the [glossary](../reference/0004-glossary.md).

## How it works

**Simple:** Buy when price makes a new 20-day (or 55-day) high and sell when it makes a new low. Bet the same amount of risk every time and cut losers fast.

<details><summary>Analogy</summary>

Like surfing: you do not guess which wave will be big, you jump on any wave that starts rising and bail if it fizzles.

</details>

<details><summary>Precise</summary>

A channel breakout trend rule. The Turtle version (System 1) enters on a 20-day high or low and exits on a 10-day opposite extreme; System 2 uses 55 and 20 days. Position size is set so a move of one N (the 20-day average true range) costs about 1 percent of equity, with a 2N stop. Park and Irwin (2004) trace the channel idea to Donchian (1960) and cite channel systems among the profitable futures rules of 1975 to 1984.

</details>

### The rule

Daily: go long when the close exceeds the highest high of the prior 20 days, short when it falls below the lowest low of the prior 20 days; exit longs on a 10-day low and shorts on a 10-day high; stop at 2 x ATR(20); size each position so 1 x ATR(20) equals 1 percent of equity.

### Data needed

- Daily OHLC prices (FX pairs, futures or ETFs)
- ATR computed from the same data
- Interest or swap rates for carry while in position

### Why it might work

Trend-following profits are usually explained by slow diffusion of information and herding; Park and Irwin (2004) list noise traders and slow reaction among the theories. The wider managed-futures literature supports trend in diversified futures (see the managed-futures-trend-following entry).

### Why it might fail

Neely, Weller and Ulrich (2009) find FX trend profits had largely disappeared by the early 1990s for widely known rules. A single-market breakout has long losing streaks; the Turtle results came from a diversified futures book in a strong trend era, and the original traders' returns are anecdotes, not audited records.

## Reported results

Numbers as reported by each source, not checked by us unless the research stage says so. "Checked on page" means we read the number on the source itself rather than in a summary.

| Source | Period | Market | Sharpe | Return a year | Volatility | Max drawdown | Evidence | Costs | Checked on page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Lukac, Brorsen and Irwin (1988), as summarized in Park and Irwin (2004)](https://farmdoc.illinois.edu/assets/marketing/agmas/AgMAS04_04.pdf) | 1975-1984 | 12 futures markets (commodities, metals, financials) | n/a | n/a | n/a | n/a | backtest | yes | yes |
| [Brock, Lakonishok and LeBaron (1992) trading range breakout, as summarized in Park and Irwin (2004)](https://farmdoc.illinois.edu/assets/marketing/agmas/AgMAS04_04.pdf) | 1897-1986 | Dow Jones Industrial Average | n/a | n/a | n/a | n/a | backtest | no | yes |
| [Neely, Weller and Ulrich (2009), abstract (working paper version)](https://s3.amazonaws.com/real.stlouisfed.org/wp/2006/2006-046.pdf) | Original 1970s-1980s samples, ex post samples to June 2005 | Major FX rates | n/a | n/a | n/a | n/a | backtest | unclear | yes |

Notes on these numbers:

- **Lukac, Brorsen and Irwin (1988), as summarized in Park and Irwin (2004):** Out-of-sample with yearly re-optimization. Four of twelve systems, including the close channel (a Donchian-type breakout), earned significant monthly net returns of 1.89 to 2.78 percent after costs. annual_return left null because the range is monthly and per system.
- **Brock, Lakonishok and LeBaron (1992) trading range breakout, as summarized in Park and Irwin (2004):** Breakouts of 50, 150 and 200 day highs and lows: average 10-day buy return 0.63 percent, sell return -0.24 percent, buy-sell spread 0.86 percent, all six rules significant. No costs.
- **Neely, Weller and Ulrich (2009), abstract (working paper version):** Abstract: excess returns of the 1970s and 1980s 'were genuine' but 'had disappeared by the early 1990s for filter and moving average rules'; less-studied rules declined but 'probably not completely disappeared'.

### After publication

Once the Turtle rules were published openly (Faith 2007 and the free rules PDF), there is no audited evidence that followers earned the original program's returns. Neely, Weller and Ulrich (2009) document decay of simple FX trend rules over time.

### Implementations

- [https://github.com/mementum/backtrader](https://github.com/mementum/backtrader) (Python, license: GPL-3.0): Event-driven backtester with built-in indicators and order types (stops, OCO).
- [https://github.com/bukosabino/ta](https://github.com/bukosabino/ta) (Python, license: MIT): Pure pandas indicator library, includes Ichimoku, Donchian channel, Bollinger, RSI, MACD.

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

- [RES-0015: Famous currency and commodity traders and what their records teach](../research/0015-famous-currency-and-commodity-traders-and-what-their-records-teach.md)
<!-- backlinks:end -->
