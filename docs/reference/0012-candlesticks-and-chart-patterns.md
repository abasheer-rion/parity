---
id: REF-0012
title: Candlesticks and chart patterns
type: reference
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [fx, method]
related: [ALG-0014, ALG-0036, REF-0004, RES-0009]
---

# Candlesticks and chart patterns

## In plain words

A candlestick is a small drawing of four prices for one stretch of time: where the price started, where it ended, and the highest and lowest points in between. Traders give names to shapes made by one, two or three candles, and to bigger shapes like "head and shoulders", and say these shapes tell you what comes next. When researchers test these shapes on lots of data, most of them do not reliably make money after trading costs. This page lists the common shapes, what traders say they mean, and what the tests found.

## Summary

Candles show open, high, low and close, nothing more. A test of candlestick strategies on Dow Jones stocks from 1992 to 2002 found they had no value [@marshall2005]; this is the PhD thesis behind the journal article [@marshall2006]. Two other studies found some patterns worked, in S&P 500 stocks from 1992 to 1996 and in Taiwan stocks [@caginalp1998a; @lu2012]. When many patterns are tried, some look good by chance [@sullivan1999], so we call the evidence unproven rather than settled. The same authors also tested Japanese stocks [@marshall2008]; we have not yet read that paper's full text. In FX, the clearest evidence for chart levels is narrow: published support and resistance levels and round numbers matter a little for intraday moves, because real orders cluster there [@osler2000; @osler2003]. Simple trend rules made money in FX before the 1990s and much less since [@neely2009]. We treat every pattern on this page as a hypothesis to test, not a rule. Each term links to the [glossary](../reference/0004-glossary.md#candlesticks-and-chart-patterns), which has a simple, an everyday and a precise explanation.

## How to read a candle

| Part | What it shows | Glossary |
| --- | --- | --- |
| Body | From the open to the close | [Candle body](../reference/0004-glossary.md#candle-body) |
| Upper wick | From the top of the body to the high | [Candle wick](../reference/0004-glossary.md#candle-wick) |
| Lower wick | From the bottom of the body to the low | [Candle wick](../reference/0004-glossary.md#candle-wick) |
| Colour | Green or hollow if close is above open, red or filled if below | [Bullish and bearish candles](../reference/0004-glossary.md#bullish-and-bearish-candles) |

Two cautions for FX:

- FX has no single official open or close, because it trades around the clock on weekdays. Daily candles from different data vendors start at different times (often 5 pm New York) and so have different shapes.
- A candle is a summary. Two days with the same candle can have had very different paths inside them.

## Single-candle patterns

| Pattern | Shape | What chartists say | What tests found |
| --- | --- | --- | --- |
| [Doji](../reference/0004-glossary.md#doji) | Open and close almost equal | Indecision, possible turn | No value in the Dow Jones test [@marshall2005] |
| [Spinning top](../reference/0004-glossary.md#spinning-top) | Small body, long wicks both sides | Indecision | No large test we know of |
| [Marubozu](../reference/0004-glossary.md#marubozu) | Long body, little or no wick | Strong one-way pressure | No value in the Dow Jones test [@marshall2005] |
| [Hammer](../reference/0004-glossary.md#hammer) | Small body at top, long lower wick, after a fall | Turn up | No value in the Dow Jones test [@marshall2005] |
| [Hanging man](../reference/0004-glossary.md#hanging-man) | Same as hammer, after a rise | Turn down | No value in the Dow Jones test [@marshall2005] |
| [Shooting star](../reference/0004-glossary.md#shooting-star) | Small body at bottom, long upper wick, after a rise | Turn down | No value in the Dow Jones test [@marshall2005] |
| [Inverted hammer](../reference/0004-glossary.md#inverted-hammer) | Same as shooting star, after a fall | Turn up | No large test we know of |

The hammer and the hanging man are the same shape with opposite meanings, decided by what came before. That kind of flexibility makes rules easy to fit to the past and hard to test fairly.

## Two- and three-candle patterns

| Pattern | Shape | What chartists say | What tests found |
| --- | --- | --- | --- |
| [Engulfing](../reference/0004-glossary.md#engulfing-pattern) | Second body covers the first, opposite colour | Turn in the second candle's direction | No value in the Dow Jones test [@marshall2005]; three bullish two-day patterns profitable in Taiwan stocks [@lu2012] |
| [Harami](../reference/0004-glossary.md#harami) | Small body inside the previous large body | Pause or turn | No value in the Dow Jones test [@marshall2005] |
| [Morning star](../reference/0004-glossary.md#morning-star) | Long down, small, long up | Bottom | Three-day patterns had predictive power in S&P 500 stocks 1992 to 1996 [@caginalp1998a]; no value in the Dow Jones test [@marshall2005] |
| [Evening star](../reference/0004-glossary.md#evening-star) | Long up, small, long down | Top | As morning star |
| [Three white soldiers](../reference/0004-glossary.md#three-white-soldiers) | Three rising long up candles | Strong buying | Streaks are common in random data [@tversky1971] |
| [Three black crows](../reference/0004-glossary.md#three-black-crows) | Three falling long down candles | Strong selling | As above |

## Chart patterns and levels

| Pattern | What chartists say | What tests found |
| --- | --- | --- |
| [Head and shoulders](../reference/0004-glossary.md#head-and-shoulders) | Three peaks, middle highest; break of the neckline means a fall | In FX 1973 to 1994, profitable but beaten by simpler trading rules [@chang1999]; a little information in US stocks [@lo2000] |
| [Double top and bottom](../reference/0004-glossary.md#double-top-and-double-bottom) | Two failed attempts at a level mean a reversal | At most a small amount of information in US stocks [@lo2000] |
| [Support and resistance](../reference/0004-glossary.md#support-and-resistance) | Prices stop at levels where they stopped before | Published FX levels predicted intraday trend stops better than random levels [@osler2000] |
| [Round number clustering](../reference/0004-glossary.md#round-number-clustering) | Prices react at numbers like 1.1000 | FX take-profit orders cluster at round numbers and stops just beyond them; trends tend to reverse at round numbers and speed up after crossing them [@osler2003] |
| [Breakout](../reference/0004-glossary.md#breakout) and [false breakout](../reference/0004-glossary.md#false-breakout) | A move through a level continues, unless it fails | Channel breakout rules made money in FX before the 1990s [@neely2009] |
| [Trendline](../reference/0004-glossary.md#trendline) | Price follows a line through past lows or highs | Hard to test because the line is drawn by eye |
| [Fibonacci retracement](../reference/0004-glossary.md#fibonacci-retracement) | Price pauses at 38.2%, 50% or 61.8% of a move | We found no large peer-reviewed test supporting it |

## Indicators built from candles

| Indicator | Idea | Evidence |
| --- | --- | --- |
| [Moving average crossover](../reference/0004-glossary.md#moving-average-crossover) | Follow the trend when a short average crosses a long one | FX profits faded after the early 1990s [@neely2009]; on the Dow Jones, the best rule as of 1986 did not keep working from 1987 to 1996 [@brock1992; @sullivan1999] |
| [RSI](../reference/0004-glossary.md#relative-strength-index-rsi) | Overbought above 70, oversold below 30 | Part of the mixed technical analysis literature [@park2007] |
| [MACD](../reference/0004-glossary.md#macd) | Difference of two moving averages | A trend rule with the same lag and the same evidence as crossovers |
| [Bollinger Bands](../reference/0004-glossary.md#bollinger-bands) | Bands at two standard deviations around an average | Used both for reversal and breakout signals, so the rule alone does not say which |

## The wider evidence

- A review of 95 modern studies found 56 reported profits from technical analysis, but many had problems with data snooping, rule selection after the fact and cost estimates [@park2007].
- Technical analysis is widespread in the FX market [@menkhoff2007]. That professionals use it does not show it makes money.
- Testing many patterns and keeping the winners is the main trap. Our [gauntlet](0006-the-gauntlet.md) and the deflated Sharpe ratio are how we guard against it.

## How we would test a pattern

1. Write the pattern as an exact rule, with numbers for every "small", "long" and "after a fall".
2. Fix the rule before looking at the test period.
3. Count every variation tried and deflate the result for it.
4. Include spreads and slippage at realistic FX levels.
5. Compare against a random entry with the same holding period and the same number of trades.

[ALG-0014](../algorithms/0014-fx-technical-trading-rules.md) and [ALG-0036](../algorithms/0036-technical-indicator-trading-bots.md) hold our notes on technical rules so far. Our list of beliefs and what the evidence says on each is [RES-0009](../research/0009-trading-myths-and-what-the-evidence-says.md).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@marshall2005](../REFERENCES.md#marshall2005): Marshall (2005), Candlestick technical trading strategies: can they create value for investors? (PhD thesis)
- [@marshall2006](../REFERENCES.md#marshall2006): Marshall et al. (2006), Candlestick technical trading strategies: Can they create value for investors?
- [@caginalp1998a](../REFERENCES.md#caginalp1998a): Caginalp and Laurent (1998), The predictive power of price patterns
- [@lu2012](../REFERENCES.md#lu2012): Lu et al. (2012), Profitable candlestick trading strategies: The evidence from a new perspective
- [@sullivan1999](../REFERENCES.md#sullivan1999): Sullivan et al. (1999), Data-Snooping, Technical Trading Rule Performance, and the Bootstrap
- [@marshall2008](../REFERENCES.md#marshall2008): Marshall et al. (2008), Are candlestick technical trading strategies profitable in the Japanese equity market?
- [@osler2000](../REFERENCES.md#osler2000): Osler (2000), https://www.newyorkfed.org/medialibrary/media/research/epr/00v06n2/0007osle.pdf
- [@osler2003](../REFERENCES.md#osler2003): Osler (2003), Currency Orders and Exchange Rate Dynamics: An Explanation for the Predictive Success of Technical Analysis
- [@neely2009](../REFERENCES.md#neely2009): Neely et al. (2009), https://s3.amazonaws.com/real.stlouisfed.org/wp/2006/2006-046.pdf
- [@tversky1971](../REFERENCES.md#tversky1971): Tversky and Kahneman (1971), Belief in the law of small numbers
- [@chang1999](../REFERENCES.md#chang1999): Chang and Osler (1999), Methodical Madness: Technical Analysis and the Irrationality of Exchange-Rate Forecasts
- [@lo2000](../REFERENCES.md#lo2000): Lo et al. (2000), Foundations of Technical Analysis: Computational Algorithms, Statistical Inference, and Empirical Implementation
- [@brock1992](../REFERENCES.md#brock1992): Brock et al. (1992), Simple Technical Trading Rules and the Stochastic Properties of Stock Returns
- [@park2007](../REFERENCES.md#park2007): Park and Irwin (2007), What Do We Know About the Profitability of Technical Analysis?
- [@menkhoff2007](../REFERENCES.md#menkhoff2007): Menkhoff and Taylor (2007), The Obstinate Passion of Foreign Exchange Professionals: Technical Analysis

## Referenced by

- [RES-0009: Trading myths and what the evidence says](../research/0009-trading-myths-and-what-the-evidence-says.md)
<!-- backlinks:end -->
