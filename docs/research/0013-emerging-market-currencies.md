---
id: RES-0013
title: Emerging market currencies
type: research
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [amanda]
tags: [carry, fx, momentum]
related: [RES-0010, RES-0007, HYP-0001, HYP-0005]
---

# Emerging market currencies

## In plain words

Countries like Brazil, Mexico, Turkey and South Africa usually pay much higher interest than the US, Europe or Japan. Researchers found that owning their money and collecting that interest paid well from the late 1990s to 2008, better than the rich-country version we already tested. But it costs more to trade, it can lose a quarter of its value in a week when a country gets into trouble, and almost every study stops before the hard years after 2008. So it is worth testing, carefully, on the years nobody has studied yet.

## Summary

We read eight papers on emerging market (EM) currencies in full and checked the numbers below against the text. What they say, in order of how much it matters to us:

1. **Adding EM currencies raised the carry trade's Sharpe ratio in every study we read.** Menkhoff, Sarno, Schmeling and Schrimpf (2012) get a Sharpe ratio of 0.74 for a 48-country carry trade after bid and ask costs, against 0.56 for 15 developed countries, over 1983 to 2009 [@menkhoff2012b]. The gain came mostly from diversification: many EM currencies do not move together.
2. **Costs decide whether EM carry works at all.** Burnside, Eichenbaum and Rebelo (2007) find bid and ask spreads two to four times wider in EM than in developed markets. A carry rule that ignores spreads has a negative Sharpe ratio once spreads are charged; a rule that only trades when the interest gap beats the spread earns 1.32 a year ([NBER w12916](https://www.nber.org/papers/w12916)) [@burnside2007].
3. **The best numbers come from one lucky window.** Gilmore and Hayashi (2011) report that an equal-weighted basket of 20 EM currencies earned 6.6% a year over the dollar with a Sharpe ratio of 1.34, from January 1999 to September 2008 ([NBER w14528](https://www.nber.org/papers/w14528)) [@gilmore2008]. That window was an EM boom with a falling dollar. Their sample ends one month before the worst EM currency sell-off in a decade.
4. **Currency momentum lives mostly in EM.** Menkhoff et al. find momentum is "basically non-existent after transaction costs" among developed currencies and comes from smaller, less liquid ones [@menkhoff2012a]. That fits our own result: G10 cross-sectional momentum failed ([EXP-0004](../experiments/0004-all-strategies-1999.md)).
5. **The crash risk is real and lumpy.** Over 1997 to 2006 Burnside et al. count one-week losses of 29% (Argentina 2002), 23% (Brazil 1999), 32% (Korea 1997), 56% (Russia 1998) and 29% (Turkey 2001). Bloomberg reported that dollar-funded carry into the Turkish lira lost 22% in 2018 and into the Argentine peso 20%.
6. **Free data covers about 16 EM currencies from the ECB, and their short-term rates from the OECD and BIS.** It does not cover offshore forward rates for currencies with capital controls (India, Korea, Brazil, China, Taiwan), so our carry for those will be approximate.

Nobody we found has tested these strategies on the years since 2009 with costs counted. That is the gap Parity can fill.

## Why EM currencies might behave differently

| Feature | Developed (G10) | Emerging |
| --- | --- | --- |
| Interest rate gap to USD | Usually 0 to 5 points | Often 5 to 40 points (Turkey, Argentina, Brazil at times) |
| Bid and ask spread | 0.04% to 0.06% (median spot, Burnside et al.) | Two to four times wider |
| Central bank behaviour | Mostly free floating | Frequent intervention, pegs, bands, capital controls |
| Crisis behaviour | Rare one-day breaks (Swiss franc 2015) | Devaluations of 20% to 60% in days |
| Correlation between currencies | High (they all move with the dollar) | Lower, spread across regions |
| Forward rate bias | Strong: high-rate currencies tend to rise | Weaker: high-rate currencies partly fall, as theory says (Frankel and Poonawala, 2010) |

The last row matters. Frankel and Poonawala (2010) test 14 EM currencies and find the forward rate bias is smaller than for major currencies and the coefficient "is on average positive" ([NBER w12496](https://www.nber.org/papers/w12496)) [@frankel2006]. In plain terms: in EM, a high interest rate is more often a fair warning that the currency will weaken. Carry still paid in their sample, but for a different reason than in G10. Bansal and Dahlquist (2000) found the same split earlier [@bansal2000].

## What the papers found

Every number in this table was read in the paper's own text. "WP" means we read the working paper version.

| Paper | Sample | Strategy | Result | Read |
| --- | --- | --- | --- | --- |
| Burnside, Eichenbaum and Rebelo (2007) | 63 currencies, weekly, Oct 1997 to Nov 2006 | Carry, equal weight, ignoring spreads when deciding | Sharpe 1.92 a year at mid prices; "actually negative (-0.05)" once spreads are paid | Full text, WP |
| same | same | Carry that only trades when the gap beats the spread | Sharpe 1.32 a year; 12 currencies never traded | Full text, WP |
| same | same, plus five crises added by hand | Same rule, with the crisis weeks charged in full | Weekly Sharpe falls from 0.183 to 0.097 (about 0.70 a year) | Full text, WP |
| Gilmore and Hayashi (2011) | 20 EM, monthly, Jan 1999 to Sep 2008 | Passive long basket against USD | 6.6% a year, volatility 4.9%, Sharpe 1.34 | Full text, WP |
| same | 9 majors, same dates | Passive long basket against USD | 2.8% a year, volatility 7.3%, Sharpe 0.38 | Full text, WP |
| same | 20 EM | Cost of rolling forwards | About 30 basis points a year for EM, under 10 for majors; doubled for EM in autumn 2008 | Full text, WP |
| Menkhoff, Sarno, Schmeling and Schrimpf (2012), carry | 48 currencies, Dec 1983 to Aug 2009, net of spreads | Long top fifth, short bottom fifth by interest rate | 7.23% a year, Sharpe 0.74, skewness -1.03 | Full text, WP |
| same | 15 developed | Same | 5.72% a year, Sharpe 0.56 | Full text, WP |
| Menkhoff et al. (2012), momentum | Up to 48 currencies, Jan 1976 to Jan 2010 | Past winners minus past losers | Up to about 10% a year before costs; the best version drops "from nearly 10% to about 4%" after full spreads; developed-only version "basically non-existent after transaction costs" | Full text, journal |
| Frankel and Poonawala (2010) | 14 EM | Forward rate bias regressions | Bias smaller than in majors; slope positive on average, never significantly below zero | Full text, WP |
| de Zwart, Markwat, Swinkels and van Dijk (2009) | 21 EM, 1997 to 2007, non-deliverable forwards | Carry, macro and technical rules | Both fundamental and technical rules profitable; combining them better ([record](https://repub.eur.nl/pub/16035)) [@dezwart2009] | Abstract only |

Two cautions on the table:

- **Conflicts of interest.** Gilmore worked for Banque AIG, and Hayashi consulted for it. The paper says so. Their data set is proprietary.
- **Overlapping, short, kind samples.** Every EM study above ends between 2006 and 2010. The 2000s were the best decade for EM currencies in living memory: China's boom lifted commodity exporters and the dollar fell. A strategy tested only on that decade is close to a strategy tested in-sample.

## What happened after the papers

These are the episodes a 2009-onward test will face. The catalog already holds several of them as events (`catalog/events/`).

| Episode | What happened to EM currencies | Source quality |
| --- | --- | --- |
| Autumn 2008 | EM currencies fell sharply after Lehman; Gilmore and Hayashi note spreads doubled | Paper (full text) |
| 2013 "taper tantrum" | Fed hint at slowing bond buying hit high-rate currencies (Brazil, India, Indonesia, Turkey, South Africa) | Not checked by us |
| 2014 to 2015 | Oil collapse and Russia sanctions; ruble roughly halved | Not checked by us |
| August 2015 | China devalued the yuan; EM sold off | Event in catalog |
| 2018 | Turkey and Argentina crises; Bloomberg reported dollar-funded carry losses of 22% (lira) and 20% (peso) for the year | News, via [BloombergQuint](https://www.bloombergquint.com/amp/onweb/turkey-replaces-argentina-as-worst-market-for-bond-investors) |
| March 2020 | Covid sell-off; carry crashed with stocks | Not checked by us |
| March 2022 | Russia sanctions: the ECB stopped publishing a ruble rate; foreign holders could not get out | Event in catalog |
| 2025 to 2026 | Reported EM carry gains, mostly interest income rather than currency moves, per Commerzbank via [FXStreet](https://www.fxstreet.com/news/carry-trade-war-driven-gains-question-durability-commerzbank-202604161838) | News, not checked |

The 2022 ruble case is the one our engine handles worst. When a price stops being published, the backtester's returns go to zero and the position freezes at its last price. A real holder could neither sell nor mark the position. Any EM test must close a position, at a penalty, when its currency stops trading.

## Costs

Two papers disagree on costs by a factor of three or more, and the reason is useful:

- **Open and close every month** (most academic studies): over 100 basis points a year even for developed currencies, and enough to turn EM carry negative (Burnside et al.).
- **Roll the position with FX swaps** (what practitioners do): about 30 basis points a year for EM and under 10 for majors in normal times (Gilmore and Hayashi), doubling in a crisis.

Our backtester charges a flat 1 basis point per unit traded. For EM that is too low. A fair EM test should charge at least 10 basis points per unit traded, roughly what the spreads above imply, and the gauntlet's double-cost test (A4) then checks 20.

## Free data

| What | Source | Coverage | Problem |
| --- | --- | --- | --- |
| Spot rates, 16 EM currencies plus EUR/USD | [ECB data portal](https://data.ecb.europa.eu/) reference rates | Daily, 1999 on for most (later for some) | Fixed at 14:15 CET, not New York close; RUB stops on 1 March 2022 |
| 3-month interbank rates | OECD short-term interest rates (`IR3TIB`) | Monthly; Mexico, South Africa, Poland, Hungary, Czechia, Korea, India, Indonesia, Israel, Chile, Colombia and others | Monthly averages; some series start late |
| Policy rates | BIS central bank policy rates (`WS_CBPOL`) | Daily, almost every EM | Policy rate is not the rate a forward pays, especially under capital controls |
| Offshore forward (NDF) rates | Not free | | Without them, carry on INR, KRW, BRL, CNY and TWD is approximate |

We checked on 2026-10-21 that the ECB, OECD and BIS endpoints answer scripted requests. Their terms allow reuse with attribution.

## What this means for us

1. **EM carry, cost aware, from 2009.** Long the highest-rate EM currencies, short the lowest or the dollar, rebalanced monthly, charged realistic costs, tested only on data after every paper's sample ended. This is the clean out-of-sample test the literature lacks.
2. **The passive EM basket since October 2008.** Gilmore and Hayashi's equal-weighted basket is simple to rebuild. Everything after September 2008 is out of their sample.
3. **EM momentum.** If Menkhoff et al. are right that momentum lives in minor currencies, an EM cross-sectional momentum rule should do better than the G10 version that failed.
4. **None of these is likely to beat the S&P 500 alone.** A 6.6% return at 4.9% volatility (the best case above) is a Sharpe of 1.34, which would pass the risk-matched tests if it held. Every later piece of evidence suggests it did not hold. The realistic hope is a modest positive return that does not crash with stocks, which makes EM carry a candidate for the overlay idea ([HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md)) rather than a replacement for stocks. Lettau, Maggiori and Weber (2014) warn the opposite: carry tends to lose in bad stock markets ([RES-0010](0010-paper-library-fx-and-market-microstructure.md)).

## What we could not verify

- The 2018 Turkey and Argentina carry losses come from a Bloomberg data compilation reported secondhand. We did not see Bloomberg's numbers.
- We did not find a free, published index of EM carry returns since 2009 (J.P. Morgan's ELMI+ and GBI-EM are licensed).
- de Zwart et al. (2009): we read only the abstract and have no numbers.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@menkhoff2012b](../REFERENCES.md#menkhoff2012b): Menkhoff et al. (2012), Carry Trades and Global Foreign Exchange Volatility
- [@burnside2007](../REFERENCES.md#burnside2007): Burnside et al. (2007), The Returns to Currency Speculation in Emerging Markets
- [@gilmore2008](../REFERENCES.md#gilmore2008): Gilmore and Hayashi (2008), Emerging Market Currency Excess Returns
- [@menkhoff2012a](../REFERENCES.md#menkhoff2012a): Menkhoff et al. (2012), Currency momentum strategies
- [@frankel2006](../REFERENCES.md#frankel2006): Frankel and Poonawala (2006), The Forward Market in Emerging Currencies: Less Biased Than in Major Currencies
- [@bansal2000](../REFERENCES.md#bansal2000): Bansal and Dahlquist (2000), The forward premium puzzle: different tales from developed and emerging economies
- [@dezwart2009](../REFERENCES.md#dezwart2009): de Zwart et al. (2009), The economic value of fundamental and technical information in emerging currency markets

## Referenced by

- [HYP-0009: Emerging market carry pays after costs](../hypotheses/0009-emerging-market-carry-pays-after-costs.md)
- [HYP-0010: Emerging market basket kept paying after 2008](../hypotheses/0010-emerging-market-basket-kept-paying-after-2008.md)
- [HYP-0011: Emerging market momentum survives costs](../hypotheses/0011-emerging-market-momentum-survives-costs.md)
- [EXP-0008: Emerging market currencies since 2010](../experiments/0008-emerging-market-currencies-since-2010.md)
- [RES-0015: Famous currency and commodity traders and what their records teach](0015-famous-currency-and-commodity-traders-and-what-their-records-teach.md)
- [RES-0016: Lesser-known strategies and what firms have published](0016-lesser-known-strategies-and-what-firms-have-published.md)
- [RES-0017: Combining many strategies, the evidence and the ingredient list](0017-combining-many-strategies-the-evidence-and-the-ingredient-list.md)
- [RES-0018: How the ingredients behave in crises, and what Sim World should show](0018-how-the-ingredients-behave-in-crises-and-what-sim-world-should-show.md)
- [REF-0003: Data sources](../reference/0003-data-sources.md)
- [LOG-0011: Emerging markets, energy futures and the next official runs](../log/2026-10-22-emerging-markets-energy-futures-and-the-next-official-runs.md)
<!-- backlinks:end -->
