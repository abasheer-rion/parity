---
id: RES-0014
title: Lesser-known strategies and what firms have published
type: research
status: current
created: 2026-10-22
updated: 2026-10-22
authors: [amanda]
tags: [commodities, fx, method]
related: [RES-0011, RES-0012, RES-0013, HYP-0009, HYP-0013]
---

# Lesser-known strategies and what firms have published

## In plain words

We looked for trading ideas in emerging market currencies and commodities that few people trade, and for the numbers big investment firms have published about which ideas kept working. The firms' own figures say the popular currency trade (owning high-interest currencies) stopped paying after it became famous, while two less popular ideas held up: buying currencies that are cheap after allowing for how rich the country is, and choosing commodities by the shape of their futures prices. One commodity idea, basis-momentum, looks strong and can be tested on the years after its paper was written, using data we already have.

## Summary

We read eleven papers and practitioner notes in full and three more in summary. We did not use leaked or confidential material from any firm: it would expose the project to legal risk, could never be cited in a document we share, and in the cases that have become public it was mostly versions of published ideas.

What the published evidence says, most useful first:

1. **AQR's own century of data says currency carry did not survive publication, but currency value did.** In Ilmanen, Israel, Lee, Moskowitz and Thapar (2021), currency carry had a Sharpe ratio of 0.51 in its original sample and **-0.17 after publication**; currency value had 0.72 and **0.69 after** ([JOIM, 2021](https://www.aqr.com/-/media/AQR/Documents/Journal-Articles/JOIM_How-Do-Factor-Premia-Vary-Over-Time.pdf)) [@ilmanen2021]. Commodity carry went from 0.40 to **0.58 after publication**. This is the single most important input for our test plans: it lowers our expectations for EM carry ([HYP-0009](../hypotheses/0009-emerging-market-carry-pays-after-costs.md)) and supports energy carry ([HYP-0013](../hypotheses/0013-energy-futures-carry-pays.md)).
2. **Basis-momentum is the strongest commodity signal we found, and it can be tested out of sample.** Boons and Prado (2019) define it as the past year's return of the nearest futures contract minus that of the second-nearest. Long the four commodities with the highest value, short the four with the lowest, earned 18.4% a year with a Sharpe ratio of 0.92 over 1960 to 2014 (0.80 after 1986). A version that holds only calendar spreads, so it is close to neutral on the price of oil, had a Sharpe ratio of 1.06 after 1986 ([working paper](https://4nations.albertjmenkveld.com/papers/boonsprado17.pdf)) [@boons2019]. Their sample ends in February 2014; our free energy data runs to April 2024, so ten years are untouched.
3. **Fundamentals-adjusted currency value works in samples that include emerging markets.** Menkhoff, Sarno, Schmeling and Schrimpf (2017) find a plain real-exchange-rate value strategy earns a Sharpe ratio of about 0.5, and about 0.8 to 0.9 once the real exchange rate is adjusted for productivity, export quality, net foreign assets and output gaps, over 1976 to 2013 for 22 currencies including Hungary, India, Indonesia, Korea, Mexico, South Africa, Taiwan, Thailand and Turkey ([accepted version](https://openaccess.city.ac.uk/id/eprint/14851/13/FXVALUE_Rev3_cepr.pdf)) [@menkhoff2017]. The BIS publishes monthly real effective exchange rates for EM countries for free, so a simplified EM version is testable. It is not in our test plans yet.
4. **Commodity skewness is a lesser-known factor with a decent record.** Long the commodities whose daily returns over the past year were most negatively skewed and short the most positively skewed earned 8.01% a year, Sharpe 0.78, over 1987 to 2014 on 27 commodities (Fernandez-Perez, Frijns, Fuertes and Miffre, 2018; [accepted version](https://openaccess.city.ac.uk/id/eprint/17843/1/SSRN-id2671165_July2017.pdf)) [@fernandezperez2018]. With four energy contracts we cannot build a fair version.
5. **One famous "hidden" edge is gone.** Front-running the roll of the big commodity index (the "Goldman roll") was reported to have Sharpe ratios as high as 4.39 over 2000 to 2010 (Mou, 2010; we could not open the paper). A later study finds the price pressure reversed after index money flooded in from 2004 and that front-running "does not generate abnormal profits after transaction costs" (Dubois and Marechal, [poster](https://business.ucdenver.edu/jpmorgancenter/content/poster-loic-marechal)) [@dubois-poster]. This is a good example of why a strategy "not known to the market" usually stops working once it is known.
6. **Sovereign default risk predicts EM currencies, but the data is paid.** Della Corte, Sarno, Schmeling and Wagner find buying high-risk and selling low-risk currencies by credit default swap exposure earned 6.25% a year, Sharpe 0.71, 2003 to 2013; Calice and Lin find currencies of countries with high default swap spreads keep falling, a 9.4% a year spread in spot terms over 2007 to 2021 ([Della Corte et al.](https://openaccess.city.ac.uk/id/eprint/16863/1/Exchange%20Rates%20and%20Sovereign%20Risk.pdf); [Calice and Lin](https://www.efmaefm.org/0EFMAMEETINGS/EFMA%20ANNUAL%20MEETINGS/2022-Rome/papers/EFMA%202022_stage-3032_question-Full%20Paper_id-99.pdf)) [@dellacorte2013; @calice2022]. Both use Markit data we cannot get for free.

## What the big firms publish

Several large firms put research and even return series online. Everything below is public; none of it is confidential.

| Firm | What is public | What it tells us | Can we use it |
| --- | --- | --- | --- |
| AQR | Papers, plus monthly factor return files (Value and Momentum Everywhere, Century of Factor Premia, Time Series Momentum) | Which styles held up after publication, by asset class (table below) | Papers: yes, cited. Data files: AQR's terms forbid reproducing or distributing anything from the site without written consent ([DAT-0003](../datasets/0003-aqr-datasets.md)); we use the published numbers, not the files |
| Two Sigma | Street View notes | Rolling futures cost the S&P GSCI about 10% a year from 2004 to 2017, while spot prices barely moved; the "roll tax" was the main drag on commodity indices ([Street View, October 2017](https://www.twosigma.com/wp-content/uploads/SV_10_17.pdf)) [@twosigma2017] | Yes, as context for carry |
| Man Group (Man Institute) | Articles and summaries | Volatility targeting barely changes Sharpe ratios for currencies and commodities but cuts tail losses ([RES-0012](0012-commodity-futures-carry-trend-and-volatility.md)) | Summary only |
| Macrosynergy (J.P. Morgan JPMaQS) | Research posts and notebooks | Simple nominal FX carry across 28 currencies since 2002: Sharpe about 0.4 to 0.5 before costs; adjusting carry for inflation alone does not fix its problems | Posts only ([FX carry](https://macrosynergy.com/?p=43153)); their data is licensed |
| BIS | Working papers and free data | A weaker dollar loosens financial conditions in EM through foreign investors' risk-taking; free real effective exchange rates and policy rates | Yes ([BIS Bulletin 114](https://www.bis.org/publ/bisbull114.pdf)); we already use BIS policy rates |

### AQR's century: what held up after publication

Annualised Sharpe ratios from Ilmanen et al. (2021), Tables 1 and 2. "Original" is the period of the first paper on each idea; "post" is everything after.

| Asset class | Style | Full sample | Original | Post-publication |
| --- | --- | --- | --- | --- |
| Currencies | Carry | 0.42 (1974 to 2020) | 0.51 | -0.17 |
| Currencies | Value | 0.60 | 0.72 | 0.69 |
| Currencies | Momentum | 0.16 | 0.40 | 0.08 |
| Currencies | All three combined | 0.62 | 0.97 | 0.63 |
| Commodities | Carry | 0.28 (1926 to 2020) | 0.40 | 0.58 |
| Commodities | Value (5-year price reversal) | 0.38 | 0.50 | 0.44 |
| Commodities | Momentum | 0.29 | 0.55 | 0.19 |
| Commodities | All three combined | 0.64 | 1.02 | 0.77 |

Three lessons. Combining styles roughly doubles the Sharpe ratio of any one of them. Momentum faded after publication in both asset classes, which matches our own G10 results. And the style everyone teaches (currency carry) is the one that stopped working. The paper itself estimates a 30% average drop in premia out of sample and attributes it more to overfitting than to traders arbitraging the effects away.

## Candidates, ranked

Ranked by evidence after publication, then by whether we can test them with free data.

| Rank | Idea | Market | Best published result | After publication | Free data? | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Basis-momentum, time series and spread versions | Energy futures | Sharpe 0.92, spread version 1.06 after 1986 (21 commodities, to 2014) | Not yet tested; our 2014 to 2024 data is out of sample | Yes, EIA contracts 1 and 2 to April 2024 | Build and register next |
| 2 | Fundamentals-adjusted currency value | EM and G10 currencies | Sharpe 0.8 to 0.9 (22 currencies, 1976 to 2013) | AQR currency value 0.69 after publication | Partly: BIS real effective exchange rates, World Bank GDP per head | Build a simplified version and register |
| 3 | Combine carry, value and momentum | Energy futures | AQR commodity multifactor 0.77 after publication | Supported | Yes | Build once 1 and 2 exist; one combined registration |
| 4 | Commodity value (5-year reversal) | Energy futures | AQR 0.38, post-publication 0.44 | Supported | Yes | Part of 3, not alone |
| 5 | Skewness | Commodities | Sharpe 0.78 (27 commodities, 1987 to 2014) | Unknown | Too few contracts | Catalog only |
| 6 | Hedging pressure from CFTC positions | Commodities | Gross Sharpe about 0.51 (literature review, 1992 to 2011, secondary) | Mixed: Gorton, Hayashi and Rouwenhorst ([NBER w13249](https://www.nber.org/papers/w13249)) reject it | Yes, CFTC data | Low priority |
| 7 | Open interest growth | Commodities, all together | One standard deviation more open interest predicts about 0.63% higher monthly commodity returns (Hong and Yogo, [NBER w16712](https://www.nber.org/papers/w16712); figure from a secondary summary) | Unknown | Yes, CFTC data | Low priority |
| 8 | Same-calendar-month seasonality | Commodities | 0.93% a month, t-statistic 1.93 (24 commodities, 1970 to 2011; Keloharju, Linnainmaa and Nyberg, [NBER w20815](https://www.nber.org/papers/w20815)) | Unknown | Yes | Weak statistics; low priority |
| 9 | Front-running index rolls | Commodities | Sharpe up to 4.39 (2000 to 2010, unverified) | Reversed after 2004; no profit after costs | Partly | Reject |
| 10 | Sovereign default risk | EM currencies | Sharpe 0.71 (2003 to 2013) | One later study agrees in direction | No, Markit data | Catalog only |
| 11 | Korean dividend repatriation in April | KRW | News reports only | None | Yes | No study exists; not worth a trial |

### Basis-momentum in detail

- **Signal.** For each commodity: the product of the last 12 monthly returns of a position in the nearest contract, minus the same for the second-nearest contract. A high value means the front of the curve has been rising faster than the back.
- **Why it might work.** The authors argue it captures price pressure at specific maturities when rising volatility reduces speculators' ability to absorb hedgers' trades, and that it is not explained by inventories, storage or hedging pressure.
- **Three ways to trade it.** (a) Cross-sectional, as in the paper: needs many commodities; with four energy contracts it is weak. (b) Time series: long a commodity when its basis-momentum is positive, short when negative. (c) Spread: hold the nearest contract against the second-nearest according to the sign, which takes out most of the oil price direction. The paper reports this spread version in the cross-section; (b) and (c) per commodity are our adaptation and must be stated as such.
- **What could go wrong.** Our version uses four highly correlated energy contracts; the effect may be weaker in energy than in the full set; spread trades have smaller returns, so costs matter more.

### EM currency value in detail

- **Signal.** Real effective exchange rate (BIS, monthly) relative to its own 5-year average, adjusted for the country's GDP per head relative to the US, because richer countries tend to have stronger real exchange rates (the Balassa-Samuelson effect the paper adjusts for).
- **Why it might work.** AQR's post-publication result (0.69) is the best of any currency style; the adjusted version removes the part of cheapness that simply reflects being poorer.
- **What could go wrong.** Menkhoff et al. use four fundamentals; we can get one or two for free. Without the adjustment, Macrosynergy finds cheap currencies keep getting cheaper and the return comes from their interest rates. Our G10 value test already failed ([EXP-0004](../experiments/0004-all-strategies-1999.md)), which is a warning, although it used only G10 currencies.

## What this means for our test plans

1. **Expect little from EM carry (HYP-0009).** AQR's post-publication currency carry Sharpe ratio is negative. The registration stays as it is; a failure would agree with the firm's own data.
2. **Energy carry (HYP-0013) has the best outside support of anything we registered.**
3. **Register basis-momentum next**, on 2014-03 to 2024-04 only, so the whole test is after the paper's sample.
4. **Register a simplified EM value strategy next**, from 2014, after Menkhoff et al.'s sample ends.
5. **Then one combined energy strategy** (carry, value, basis-momentum), because every firm's numbers say combinations beat single styles.

## What we could not verify

- Mou (2010) on the Goldman roll: SSRN and the Columbia repository blocked our reader; the 4.39 figure comes from search summaries of the abstract.
- The hedging pressure (0.51) and open interest (0.63% a month) figures come from CXO Advisory summaries, not the papers' tables.
- Macrosynergy's numbers come from their posts; their data and notebooks need a J.P. Morgan licence.
- We did not open AQR's data files because of its terms of use; to analyse them directly, ask AQR for written permission first.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@ilmanen2021](../REFERENCES.md#ilmanen2021): Ilmanen et al. (2021), How Do Factor Premia Vary Over Time? A Century of Evidence
- [@boons2019](../REFERENCES.md#boons2019): Boons and Prado (2019), Basis-Momentum
- [@menkhoff2017](../REFERENCES.md#menkhoff2017): Menkhoff et al. (2017), Currency Value
- [@fernandezperez2018](../REFERENCES.md#fernandezperez2018): Fernandez-Perez et al. (2018), The skewness of commodity futures returns
- [@dubois-poster](../REFERENCES.md#dubois-poster): Dubois and Marechal (n.d.), The valuation effects of index investment in commodity futures (poster)
- [@dellacorte2013](../REFERENCES.md#dellacorte2013): Della Corte et al. (2013), Exchange Rates and Sovereign Risk
- [@calice2022](../REFERENCES.md#calice2022): Calice and Lin (2022), Sovereign Momentum Currency Returns
- [@twosigma2017](../REFERENCES.md#twosigma2017): Manzo and Saret (2017), The Commodity Futures Roll Return 'Tax': Addressing a Recent Headwind (Two Sigma Street View)

## Referenced by

- [LOG-0009: Lesser-known strategies and published firm research](../log/2026-10-22-lesser-known-strategies-and-published-firm-research.md)
<!-- backlinks:end -->
