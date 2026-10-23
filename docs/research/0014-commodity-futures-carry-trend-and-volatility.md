---
id: RES-0014
title: Commodity futures, carry, trend and volatility
type: research
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [amanda]
tags: [commodities, kpis, momentum]
related: [EXP-0004, HYP-0003, HYP-0008, RES-0007, RES-0010]
---

# Commodity futures, carry, trend and volatility

## In plain words

Commodities like oil and gas jump around about as much as stocks, but over 140 years simply owning them earned less per unit of risk than owning stocks. So more ups and downs alone does not help: our tests compare every strategy at the same level of risk, and the bumpier one just gets turned down. What has worked better is choosing which commodity to own (the ones where buyers pay more for delivery now than later), following trends, and selling insurance against big price swings. Each of these has a known way to fail, and we can now test several of them with free futures prices.

## Summary

We read eleven papers in full and checked every number below against the text.

1. **Volatility is not the goal; return per unit of volatility is.** Over 1877 to 2015, commodity futures had about the same volatility as US stocks (17.6% against 17.0% a year) but a lower Sharpe ratio (0.27 against 0.40), per Levine, Ooi, Richardson and Sasseville (2018) ([NBER w22793](https://www.nber.org/papers/w22793)) [@levine2016]. Out of sample, from 2005 to 2014, commodities earned 3.67% a year over T-bills with 15.2% volatility (Sharpe 0.24) while stocks earned 7.09% with 14.7% (Sharpe 0.48) [@bhardwaj2015]. A strategy only beats the S&P 500 on our tests if it has a better ratio, not more swing. See [the volatility question](#does-more-volatility-help-us-beat-the-sp-500).
2. **Picking commodities by their futures curve has held up out of sample.** Owning the half of commodities with the highest "basis" (spot above futures, called backwardation) and selling the half with the lowest earned 9.2% a year (Sharpe 0.68) in 1959 to 2004 and 10.4% (Sharpe 1.04) in 2005 to 2014, after the original paper was published [@bhardwaj2015]. Koijen, Moskowitz, Pedersen and Vrugt (2018) find commodity carry earns 11.2% a year with 18.8% volatility (Sharpe 0.60) on 24 commodities, 1980 to 2012 [@koijen2018]. This is one of very few strategies in our catalog that did as well after publication as before.
3. **Trend following on futures has a long record but a weak recent decade.** AQR's backtest reports a net Sharpe of 0.77 from 1880 to 2013 and 0.62 from 2000 to 2013 [@hurst2014]. Trend managers struggled for much of the 2010s, then had a record year in 2022 (SG Trend Index +27.35%).
4. **Selling commodity volatility earns a premium, with crash risk.** Shorting variance earned a Sharpe of 0.59 in crude oil and 0.35 in natural gas over 1996 to 2006, against 1.02 for the S&P 500 ([Trolle and Schwartz, 2010](https://infoscience.epfl.ch/record/148475)) [@trolle2010]. Buyers of variance lost money in 18 of 21 commodity markets ([Prokopczuk, Symeonidis and Wese Simen, 2017](https://ueaeprints.uea.ac.uk/63547/)) [@prokopczuk2017].
5. **Commodity currencies predict commodity prices better than the reverse.** Chen, Rogoff and Rossi (2010) find the exchange rates of Australia, Canada, New Zealand, South Africa and Chile forecast commodity prices out of sample, while the reverse "is notably less robust" [@chen2010]. Ferraro, Rogoff and Rossi (2015) find oil moves the Canadian dollar on the same day, but lagged oil predicts little, and nothing at monthly or quarterly frequency [@ferraro2015]. That explains why our oil catch-up idea failed ([EXP-0003](../experiments/0003-monthly-commodity-gap.md)) and suggests turning it around.
6. **Free futures data exists for energy, up to April 2024.** The US Energy Information Administration published daily settlement prices for the first four NYMEX contracts of crude oil, natural gas, heating oil and gasoline until 5 April 2024, when it stopped. That is enough for proper rolled futures returns and the slope of each curve over about 20 to 40 years, but not for anything after April 2024. It fixes the flaw in our `commodity_tsmom` test, which traded spot gas prices nobody could trade ([EXP-0004](../experiments/0004-all-strategies-1999.md#threats-to-validity)).

## Does more volatility help us beat the S&P 500?

No, for three reasons, and one way it does help.

**Our tests are risk matched.** Test A1 compares Sharpe ratios, which do not change if you double the position. Test A2 scales every strategy to the stock market's own volatility, charging for any borrowing, before comparing returns ([REF-0006](../reference/0006-the-gauntlet.md)). A strategy with twice the volatility and the same Sharpe gets scaled down by half and lands in the same place.

**Volatility costs compound growth.** For returns with arithmetic mean m and volatility s, compound growth is roughly m minus s squared over two. At 40% volatility that drag is 8 points a year; at 15% it is about 1. Two strategies with the same average return do not end with the same money: the calmer one ends richer. Leverage makes this worse with the square: double the leverage and the drag quadruples.

**History says volatile assets often pay less per unit of risk, not more.** The long-run commodity numbers above are one example. Frazzini and Pedersen (2014) offer a reason: investors who cannot borrow buy volatile, high-beta assets to get higher returns, which bids those assets up and lowers what they pay later [@frazzini2014].

**Where volatility does help.** If a strategy has a good Sharpe ratio but low volatility, it can be levered up to the stock market's risk and then beat it on money made. A2 already does this. So the useful search is for high Sharpe ratios with low correlation to stocks, and then sizing them up, not for volatile instruments. Commodity carry at 18.8% volatility and Sharpe 0.60 is attractive because of the 0.60, not the 18.8%.

**Volatility targeting is not a free lunch either.** Harvey, Hoyle, Korgaonkar, Rattray, Sargaison and Van Hemert (2018) find that scaling positions to a constant volatility raises Sharpe ratios for equities and credit but has a "negligible" effect for bonds, currencies and commodities, though it does cut extreme losses in all of them ([summary](https://www.man.com/insights/the-impact-of-volatility-targeting); we read a summary, not the paper). Moreira and Muir (2017) find volatility timing helps equity factors; for the currency carry trade its benefit disappears when a common volatility measure is used [@moreira2017].

## Long-only commodities

| Paper | Sample | Excess return | Volatility | Sharpe | Read |
| --- | --- | --- | --- | --- | --- |
| Gorton and Rouwenhorst (2006), equal-weighted index | Jul 1959 to Dec 2004 | 5.23% | 12.10% | 0.43 | Full text, follow-up's Table 3 |
| Bhardwaj, Gorton and Rouwenhorst (2015), same index | Jan 2005 to Dec 2014 | 3.67% | 15.23% | 0.24 | Full text |
| US stocks, same paper | Jan 2005 to Dec 2014 | 7.09% | 14.71% | 0.48 | Full text |
| Levine et al. (2018), commodity futures | 1877 to 2015 | | 17.6% | 0.27 | Full text, WP |
| Levine et al. (2018), US stocks | 1877 to 2015 | | 17.0% | 0.40 | Full text, WP |
| Koijen et al. (2018), equal-weighted 24 commodities | Jan 1980 to Sep 2012 | 1.05% | 13.45% | 0.08 | Full text, WP |

The good news for long-only commodities is diversification and inflation. Levine et al. find commodities had a Sharpe ratio of 0.84 when inflation was above its average, against -0.27 when it was below, and a 10% commodity sleeve raised a 60/40 portfolio's long-run Sharpe ratio from 0.42 to 0.45. Gorton and Rouwenhorst (2006) found commodity futures negatively correlated with stocks and bonds [@gorton2006]. The bad news: commodities lost in recessions (Sharpe -0.37 in Levine et al.'s recession states), which is when a stock investor most needs help.

## Carry and the futures curve

When a commodity is scarce now, buyers pay more for delivery today than for delivery later (backwardation). A long futures position then earns the gap as the contract rolls toward the spot price. When storage is full, later delivery costs more (contango), and a long position pays the gap.

| Paper | Sample | Strategy | Result | Read |
| --- | --- | --- | --- | --- |
| Gorton and Rouwenhorst, as updated in Bhardwaj et al. (2015) | 1959 to 2004 | High-basis half minus low-basis half, monthly | 9.2% a year, Sharpe 0.68 | Full text |
| same | 2005 to 2014, after publication | same | 10.41% a year, Sharpe 1.04 | Full text |
| Koijen et al. (2018) | 24 commodities, 1980 to 2012 | Long high carry, short low carry | 11.22% a year, volatility 18.78%, Sharpe 0.60, skewness -0.40 | Full text, WP |
| Szymanowska, de Roon, Nijman and van den Goorbergh (2014) | Many commodities | Sorts on basis, momentum, volatility and others | Spot premia of 5% to 14% a year; term premia of 1% to 3% | Abstract only ([record](https://ideas.repec.org/a/bla/jfinan/v69y2014i1p453-482.html)) |

Two cautions. Both big papers use 20 to 30 commodities. With free data we have four energy contracts, so our version is far less diversified and its Sharpe ratio will be lower and noisier. And Koijen et al. note that carry across all asset classes did badly in the same episodes, which coincide with global recessions.

## Trend following

Moskowitz, Ooi and Pedersen (2012) find that a 12-month time series momentum rule was profitable in every one of 58 futures markets from 1985 to 2009, and a diversified version had a Sharpe ratio above one [@moskowitz2012a]. AQR's long backtest extends this to 1880 [@hurst2014]:

| Period | Net return | Volatility | Net Sharpe |
| --- | --- | --- | --- |
| 1880 to 2013 | 11.2% | 9.7% | 0.77 |
| 1990 to 1999 | 13.2% | 8.5% | 0.98 |
| 2000 to 2013 | 7.9% | 9.6% | 0.62 |

These are the authors' own hypothetical backtests after assumed costs and 2-and-20 fees. Real trend funds had a weak decade after 2009, with industry assets in quantitative currency funds alone falling from about $35 billion in 2008 to about $6 billion in 2013 according to press reports citing BIS data ([RES-0015](0015-famous-currency-and-commodity-traders-and-what-their-records-teach.md)). Then in 2022 the SG Trend Index gained 27.35% and the SG CTA Index 20.07%, which the trade press called a record year ([Hedgeweek](https://www.hedgeweek.com/flat-december-sees-ctas-complete-record-year-2022/)). This matches what we found for currency trend: weak returns in calm years, gains in crises.

## Selling volatility

Option buyers pay for protection. On average the volatility they pay for is higher than the volatility that follows, so sellers earn a premium. The premium is real, and so are the losses when prices gap.

| Paper | Sample | Result | Read |
| --- | --- | --- | --- |
| Trolle and Schwartz (2010) | NYMEX crude oil and natural gas options, Jan 1996 to Nov 2006 | Shorting variance: Sharpe 0.59 in crude, 0.35 in gas, 1.02 in the S&P 500 | Full text, WP |
| Prokopczuk, Symeonidis and Wese Simen (2017) | 21 commodity markets | Variance buyers lost in 18 of 21; for example an average payoff of -8.985% in natural gas; payoffs more negative after 2000 | Full text, accepted manuscript |

The crashes are easy to name. Natural gas variance behaves like a call option (it explodes upward in cold snaps), per Trolle and Schwartz. Amaranth Advisors lost more than $6 billion in September 2006 on natural gas spreads, a different trade but the same market and the same lesson about short-tail exposure ([RES-0015](0015-famous-currency-and-commodity-traders-and-what-their-records-teach.md)).

**What we can test for free.** CBOE publishes OVX, a 30-day implied volatility index for crude oil, on FRED from 2007. Because OVX is built like the VIX, its square is close to the price of a 30-day variance swap. Realised variance can be measured from the EIA crude futures prices, which end in April 2024. That gives an approximate monthly payoff for selling crude oil variance. It leaves out the cost of trading variance swaps or option strips, which is large, so any result is an upper bound.

## Commodity currencies and commodity prices

Our first original idea was that oil prices lead the Canadian dollar and Norwegian krone ([HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md)). It failed weekly and monthly ([EXP-0003](../experiments/0003-monthly-commodity-gap.md)). The literature says why:

- Ferraro, Rogoff and Rossi (2015) find "little systematic relation between commodity price changes and exchange rate changes at the monthly and quarterly frequencies." The link is mostly same-day. Lagged oil prices predict the Canadian dollar only briefly and only at daily frequency.
- Chen, Rogoff and Rossi (2010) find the opposite direction works: quarterly changes in the Australian, Canadian, New Zealand, South African and Chilean exchange rates predict quarterly changes in commodity price indices out of sample. Their reasoning is that exchange rates are forward looking, so they price in news about commodity demand before commodity spot prices move. Their samples end in early 2008.

So the testable version is: use last quarter's moves in commodity currencies to decide whether to hold commodity futures next quarter. Everything since the second quarter of 2008 is out of their sample.

## Free data

| What | Source | Coverage | Notes |
| --- | --- | --- | --- |
| NYMEX futures, contracts 1 to 4 | [EIA](https://www.eia.gov/dnav/pet/pet_pri_fut_s1_d.htm) | Daily; WTI crude from 1983, heating oil from 1980 (contract 2 from 1994), natural gas from 1994, RBOB gasoline from October 2005. **All series stop on 5 April 2024**; the EIA tables say later prices are not available | Public domain. Contract 1 rolls at each expiry, so returns must be stitched from the same contract on each day. Backtests can run to April 2024 only, and nothing can be forward tested with this source |
| Crude oil implied volatility (OVX) | FRED, series `OVXCLS` | Daily, May 2007 on | Index, not a tradable price |
| Gold implied volatility (GVZ) | FRED, series `GVZCLS` | Daily, 2008 on | Same |
| Metals and agricultural futures curves | Not free | | So our carry and trend tests are energy only |

## What this means for us

1. **Rebuild commodity trend on real futures returns.** Replace the spot-price test with rolled NYMEX energy futures. This is a fairness fix for an existing result, not a new idea.
2. **Test energy carry.** Long backwardated, short contango contracts, using the slope between contracts 1 and 2. Expect a weaker result than the papers, since we have four contracts, not 24.
3. **Test selling crude oil variance** with the OVX approximation, and treat its result as an upper bound.
4. **Test commodity currencies as a signal for energy futures.** This turns our failed idea around in the direction the evidence supports.
5. **Do not chase volatility.** Look for higher Sharpe ratios and low correlation with stocks. Then let A2 scale them.

## What we could not verify

- Harvey et al. (2018) on volatility targeting: we read a summary on the publisher's site, not the paper.
- Szymanowska et al. (2014): abstract only.
- SG index returns and the currency fund asset figures come from press reports, not the index provider's own files.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@levine2016](../REFERENCES.md#levine2016): Levine et al. (2016), Commodities for the Long Run
- [@bhardwaj2015](../REFERENCES.md#bhardwaj2015): Bhardwaj et al. (2015), Facts and Fantasies about Commodity Futures Ten Years Later
- [@koijen2018](../REFERENCES.md#koijen2018): Koijen et al. (2018), Carry
- [@hurst2014](../REFERENCES.md#hurst2014): Hurst et al. (2014), A Century of Evidence on Trend-Following Investing
- [@trolle2010](../REFERENCES.md#trolle2010): Trolle and Schwartz (2010), Variance Risk Premia in Energy Commodities
- [@prokopczuk2017](../REFERENCES.md#prokopczuk2017): Prokopczuk et al. (2017), Variance Risk in Commodity Markets
- [@chen2010](../REFERENCES.md#chen2010): Chen et al. (2010), Can Exchange Rates Forecast Commodity Prices? \*
- [@ferraro2015](../REFERENCES.md#ferraro2015): Ferraro et al. (2015), Can oil prices forecast exchange rates? An empirical analysis of the relationship between commodity prices and exchange rates
- [@frazzini2014](../REFERENCES.md#frazzini2014): Frazzini and Pedersen (2014), Betting against beta
- [@moreira2017](../REFERENCES.md#moreira2017): Moreira and Muir (2017), Volatility-Managed Portfolios
- [@gorton2006](../REFERENCES.md#gorton2006): Gorton and Rouwenhorst (2006), Facts and Fantasies about Commodity Futures
- [@moskowitz2012a](../REFERENCES.md#moskowitz2012a): Moskowitz et al. (2012), Time series momentum

## Referenced by

- [RES-0015: Famous currency and commodity traders and what their records teach](0015-famous-currency-and-commodity-traders-and-what-their-records-teach.md)
<!-- backlinks:end -->
