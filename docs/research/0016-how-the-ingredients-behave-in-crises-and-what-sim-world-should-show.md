---
id: RES-0016
title: How the ingredients behave in crises, and what Sim World should show
type: research
status: current
created: 2026-10-22
updated: 2026-10-22
authors: [amanda]
tags: [commodities, fx, method]
related: [RES-0015, RES-0011, DEC-0020, DEC-0021]
---

# How the ingredients behave in crises, and what Sim World should show

## In plain words

Before we build the two combined books from [RES-0015](0015-combining-many-strategies-the-evidence-and-the-ingredient-list.md), we need to know how each ingredient tends to behave when markets break. The published evidence is clear on three of them. Carry trades lose suddenly when fear spikes. Momentum loses when a falling market snaps back. Trend following usually makes money in slow bear markets but not in fast crashes. Emerging market currencies with weak budgets and large trade deficits fell most when the Fed hinted at slowing its bond buying in 2013. We also checked the site Ayan built for viewing these scenarios. Its crisis dates match the published dates. It is missing some of the crises that matter most for emerging market currencies, and its "what if" page has no emerging market currency in it yet.

## Summary

We read four more public sources in full or in the relevant sections, and compared them with the crisis windows and the event list on the site (`web/src/pages/sim/play/data.ts` and `catalog/events/`, as exported by `parity scenario export` on 22 October).

1. **Carry crashes when fear rises, and adding more currencies does not stop it.** Carry portfolios long the 1 to 3 highest-rate currencies and short the lowest had Sharpe ratios of 0.59 to 0.78 from 1986 to 2006, but skewness of -0.54 to -0.98: frequent small gains and rare large losses. The skew did not shrink as more currencies were added. Weeks when the VIX rose were weeks when carry lost. The sharpest example is the dollar's fall against the yen on 7 and 8 October 1998, with no news to explain it (Brunnermeier, Nagel and Pedersen, 2008, Section 1; [NBER version](https://www.nber.org/papers/w14473)) [@brunnermeier2008].
2. **Momentum crashes in rebounds after a fall.** The worst momentum months come in "panic states": after markets have fallen, while volatility is high, and as markets rebound. In US stocks the past losers rose 232% in July and August 1932 against 32% for past winners, and 163% against 8% from March to May 2009. The same pattern shows up in commodity, currency and bond momentum. Scaling momentum down when its expected risk is high roughly doubled its Sharpe ratio, and across all asset classes the scaled version reached 1.18 (Daniel and Moskowitz, 2016; [NBER version](https://www.nber.org/system/files/working_papers/w20439/w20439.pdf)) [@daniel2016].
3. **Trend following helps in slow bear markets, not in fast ones.** From 1880 to 2016, time-series momentum made money in 8 of the 10 largest falls of a 60/40 stock and bond portfolio. Those falls lasted about 15 months on average, which gave the trend time to turn. The authors say it may not help in a crash as fast as October 1987, and the strategy itself has had drawdowns of up to 25% (Hurst, Ooi and Pedersen, 2017; [published version](https://fairmodel.econ.yale.edu/ec439/hurst.pdf)) [@hurst2017].
4. **In the 2013 taper tantrum, weak balance sheets fell most.** From Bernanke's testimony on 22 May 2013 to December 2013, Brazil, India, Indonesia, Turkey and South Africa (the "fragile five") depreciated more than nine other emerging markets. Larger budget deficits and current account deficits in 2010 to 2012 went with larger falls, a correlation of about -0.3 over May to December and -0.4 to -0.5 over the whole of 2013 (Nechio, 2014; [FRBSF Economic Letter 2014-06](https://www.frbsf.org/research-and-insights/publications/economic-letter/2014/03/federal-reserve-tapering-emerging-markets/)) [@nechio2014]. Four of the five are in our EM carry universe, and carry tends to hold them because their rates are high.
5. **What this means for the two books.** The ingredients are expected to fail at different moments. Carry fails at the onset of a sudden risk-off. Momentum fails at the turn back up. Trend helps only once a fall has lasted a few months. That is a further reason to hold them together. It also means a 63 trading day scenario, like the site's Scenario tab, will mostly show carry's loss and not the later recovery of the other ingredients.

## Expected behaviour by crisis

From the sources above only. A blank means we found no published evidence and should not guess.

| Crisis (site window) | Carry, EM and energy | Momentum (cross-section) | Trend (time series) | Value |
| --- | --- | --- | --- | --- |
| 1998 Russia and LTCM (not a Sim World window) | Large, fast loss; yen funding unwinds ([@brunnermeier2008]) | | | |
| 2008 global financial crisis | Loss in the risk-off ([@brunnermeier2008]) | Loss in the March to May 2009 rebound ([@daniel2016]) | Gain over the slow fall ([@hurst2017]) | |
| 2013 taper tantrum | Loss concentrated in the high-rate "fragile five" ([@nechio2014]) | | | |
| 2020 Covid crash (one month) | | | Too fast to expect a gain ([@hurst2017], by analogy with 1987) | |

## Cross-check of the site

What we checked in Sim World and the Scenarios page, and whether it matches the sources.

| What | On the site | Check |
| --- | --- | --- |
| 2008 window | stress 2007-10-09 to 2009-03-09, shown to 2009-09-25 | Matches the S&P 500 peak and trough. Running on to September includes the March to May 2009 momentum crash, which is right for our purpose. |
| Taper tantrum window | stress 2013-05-22 to 2013-09-05, shown to 2013-12-27 | Starts on the date of Bernanke's testimony, as in [@nechio2014], and covers that letter's May to December window. |
| Covid window | 2020-02-19 to 2020-03-23 | Matches the S&P 500 peak and trough. WTI going negative (2020-04-20) falls inside the shown window and is also a scenario event. |
| Oil crash window | 2014-06-20 to 2016-02-11 | Matches the WTI high and low. |
| 1998 | A scenario event (Russia 1998-08-17, LTCM 1998-09-23), not a Sim World crisis window | The classic carry crash ([@brunnermeier2008]) cannot be played in Sim World, though prices go back to 1986. |
| EM currency crises | China's devaluation (2015-08-11) is an event; the taper tantrum is a window but not an event | Missing as events: the taper tantrum itself, and the crises in single emerging currencies (for example Turkey in 2018). The Scenarios page cannot match a made-up EM shock to past ones. |
| Scenario assets | 15: oil, Brent, gas, S&P 500, VIX, 10-year and 3-month Treasury rates, the dollar and seven G10 currencies | No emerging market currency, so "what if" cannot show the EM book's exposure. |
| Front page counts | "100+" strategies, "82" ideas, "3" official runs | True on main: 102 strategies, 82 algorithm pages, 3 lines in `ledger/runs.jsonl`. It becomes 98 ideas once PRs #16 to #27 merge. |
| Front page sim | "Illustrative paths ... not a forecast" | Correct. The paths come from a random model in the browser, not from our data (DEC-0021). |

## Proposals

These change the plan for the combined books and suggest site changes for the owner to decide. Nothing here was built.

1. **Register crisis results as an output, before the run.** When the energy and EM books are registered, list the windows whose returns must be reported whatever they show: the site's seven Sim World windows that fall inside each book's test period, plus 1998 for any book that starts early enough. Then a book cannot be judged on its best months alone.
2. **Add a 1998 window to Sim World** (August to October 1998), since it is the textbook carry crash and the data covers it.
3. **Add EM currency events** to `catalog/events/`: the taper tantrum (2013-05-22) and single-country currency crises. Each date should come from a primary source, as the existing 76 do. We have not checked those dates yet.
4. **Add a few EM currencies to the scenario assets**, at least MXN, BRL, ZAR and TRY, which are already loaded.
5. **Show 126 days as well as 63 in the Scenario tab** for strategy books, so a carry loss and a later trend gain can both be seen.

## Why we did not run the always-on search

The always-on search ([DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)) backtests random variations of carry, momentum and value on the twelve Fed H.10 emerging market currencies. Those overlap with the strategies in REG-0006, whose registration says their results have not been seen. If we run the search ourselves and read its results before the official runs, that claim stops being true for us. It keeps running on the owner's machine, and its tries are counted at export. We will start it here once REG-0004 to REG-0008 have run.

## What we could not verify

- **Commodity carry in April 2020.** A Bloomberg report says a curve carry index had its best run since at least 2004 when oil went negative. The article is paywalled, so we only saw the summary, and it is not used above.
- **Value in crises.** We found no source in this round on how currency or commodity value behaves in these windows.
- **Exact fragile five falls.** The FRBSF letter shows them only in a chart, so we quote the correlations, not percentages.

## Sources cited

- [@brunnermeier2008](../REFERENCES.md#brunnermeier2008): Brunnermeier et al. (2008), Carry Trades and Currency Crashes
- [@daniel2016](../REFERENCES.md#daniel2016): Daniel and Moskowitz (2016), Momentum Crashes
- [@hurst2017](../REFERENCES.md#hurst2017): Hurst et al. (2017), A Century of Evidence on Trend-Following Investing
- [@nechio2014](../REFERENCES.md#nechio2014): Nechio (2014), Fed Tapering News and Emerging Markets

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@brunnermeier2008](../REFERENCES.md#brunnermeier2008): Brunnermeier et al. (2008), Carry Trades and Currency Crashes
- [@daniel2016](../REFERENCES.md#daniel2016): Daniel and Moskowitz (2016), Momentum Crashes
- [@hurst2017](../REFERENCES.md#hurst2017): Hurst et al. (2017), A Century of Evidence on Trend-Following Investing
- [@nechio2014](../REFERENCES.md#nechio2014): Nechio (2014), Fed Tapering News and Emerging Markets

## Referenced by

- [LOG-0012: Crisis behaviour, and a check of Sim World](../log/2026-10-22-crisis-behaviour-and-a-check-of-sim-world.md)
<!-- backlinks:end -->
