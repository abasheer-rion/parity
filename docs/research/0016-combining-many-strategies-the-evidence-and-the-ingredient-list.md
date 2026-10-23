---
id: RES-0016
title: Combining many strategies, the evidence and the ingredient list
type: research
status: current
created: 2026-10-22
updated: 2026-10-22
authors: [amanda]
tags: [commodities, fx, method]
related: [RES-0012, RES-0013, RES-0015, DEC-0014, HYP-0009, HYP-0013]
---

# Combining many strategies, the evidence and the ingredient list

## In plain words

Most single trading ideas in currencies and commodities are weak: a Sharpe ratio of 0.3 to 0.6 before costs, and less after they were published. The published evidence says the reliable way to get something stronger is to hold several weak ideas at once, as long as they do not all win and lose at the same time. Two ideas with a Sharpe ratio of 0.34 each became 0.63 when combined, because one tended to win when the other lost. Giving every idea an equal weight worked as well as or better than every clever weighting scheme tested. This page lists the ideas we could combine, says which ones our free data supports, and sets out rules so that combining cannot be used to fool ourselves.

## Summary

For this round we read the relevant sections and tables of eleven more papers, all public, and checked one free data source. What they say, most useful first:

1. **Combining weak ideas that disagree is where the strength comes from.** In AQR's Value and Momentum Everywhere, currency value and currency momentum each had a Sharpe ratio of 0.34 from 1979 to 2011, with a correlation of -0.42 between them; the 50/50 mix had **0.63**. In commodities, value (0.26) and momentum (0.53), correlation -0.39, mixed to **0.71** over 1972 to 2011 (Asness, Moskowitz and Pedersen, 2013, Table I; [published version](https://pages.stern.nyu.edu/~lpederse/papers/ValMomEverywhere.pdf)) [@asness2013]. The simple formula below reproduces both numbers, so we can plan with it.
2. **Equal weights beat clever weights.** Fernandez-Perez, Fuertes and Miffre (2019) compared equal weights for five commodity signals (momentum, value, carry, liquidity, skewness) with six ways of choosing weights from past data, including mean-variance optimisation, style rotation and volatility timing. Over 1989 to 2017 the single signals had Sharpe ratios of 0.16 to 0.59; equal weights had **0.97**, and no other method did better (optimised weights: 0.74). In currency futures, equal weights scored 0.40 and volatility timing 0.45, a gap the authors' test could not tell from chance (p = 0.27) ([accepted version](https://openaccess.city.ac.uk/id/eprint/22246/1/JBF_Integration%20for%20CRO.pdf)) [@fernandezperez2019].
3. **A new ingredient helps most when it is unlike the others.** Adding the currency volatility risk premium strategy to four common currency strategies raised the Sharpe ratio of a minimum-volatility mix from 0.50 to 0.60 in a sample with emerging markets, 1998 to 2013 (Della Corte, Ramadorai and Sarno, 2016; [accepted version](https://openaccess.city.ac.uk/id/eprint/13156/1/VRP_Paper_18Feb2015%20%28with%20Figures%29.pdf)) [@dellacorte2016a]. Its returns come from exchange rate moves rather than interest gaps, which is why it adds something carry does not.
4. **Some "different" signals are the same signal in disguise.** Commodities with low inventories already had a higher futures basis (7.4 percentage points a year higher) and higher past-year returns (7.6 points higher) than those with high inventories (Gorton, Hayashi and Rouwenhorst, 1971 to 2010; [2012 version](https://www.sba.hub.hit-u.ac.jp/assets/files/research/fs_wp/FS-2012-E-002.pdf)) [@gorton2013]. An inventory signal therefore overlaps with carry and momentum, and adding it would count three times what is partly one bet.
5. **Scaling by volatility is a risk control, not a source of return, in our markets.** Man Group's study of more than 60 assets found volatility targeting raised Sharpe ratios for stocks and credit but had a negligible effect for bonds, currencies and commodities, while cutting extreme returns in every asset class (Harvey et al., 2018; [published version](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf)) [@harvey2018]. We should use it to size the combined book, and not expect it to add return.
6. **One signal from the developed world can time emerging market currencies.** The average interest rate gap of developed currencies over the dollar predicts the return of a basket of emerging market currencies: about 1.8 percentage points more a year per point of gap. The emerging basket's own average gap does not predict it this way (Lustig, Roussanov and Verdelhan, 2014; [NBER version](https://www.nber.org/system/files/working_papers/w16427/revisions/w16427.rev1.pdf)) [@lustig2014]. We have both inputs already, so this is a new, testable ingredient for the EM book.
7. **Two celebrated edges are decayed or out of reach.** Shorting natural gas futures around the weekly EIA storage report earned a Sharpe ratio of 1.76 after costs over 2003 to 2018, but 3.26 in the early years and about 0.5 recently, and it needs intraday prices (Prokopczuk, Wese Simen and Wichmann, 2021; [accepted version](https://centaur.reading.ac.uk/90003/1/NG_paper_final_round.pdf)) [@prokopczuk2021]. Month-end currency hedging flows at the London 4pm fix, studied by two BlackRock researchers, are a G10 intraday effect of a few basis points; a study they cite found no such link in 23 emerging market currencies ([ECB workshop version](https://ecb.eu/events/pdf/conferences/131216/Third_FX_Workshop_MELVIN_PRINS_Equity%20hedging%20and%20exchange%20rates%20Nov%202013.pdf)) [@melvin2015].

## How much combining can add

If each of N ideas has the same Sharpe ratio S, the same volatility, and every pair has correlation r, the equal-weight mix has a Sharpe ratio of

S x sqrt(N / (1 + (N - 1) x r))

Two checks against published numbers: currencies, S = 0.34, r = -0.42, N = 2 gives 0.63, as in AQR's table. Commodities, with unequal Sharpe ratios 0.26 and 0.53 and r = -0.39, gives about 0.72 against the paper's 0.71 (the volatilities differ slightly).

What it means for planning, with ideas of Sharpe 0.3:

| Ideas | Average correlation | Combined Sharpe |
| --- | --- | --- |
| 6 | 0.0 | 0.73 |
| 6 | 0.1 | 0.60 |
| 6 | 0.3 | 0.46 |
| 6 | 0.5 | 0.39 |
| 10 | 0.1 | 0.69 |

Three lessons:

- **Correlation matters more than the count.** Six ideas at correlation 0.1 beat ten at 0.3. When the correlation is r, the ceiling as N grows is S / sqrt(r): 0.95 at r = 0.1, 0.55 at r = 0.3.
- **The inputs must be post-publication Sharpe ratios, after costs.** AQR's century of data ([RES-0015](0015-lesser-known-strategies-and-what-firms-have-published.md)) shows some ideas keep most of their strength (currency value 0.72 to 0.69) and some lose all of it (currency carry 0.51 to -0.17). Planning with the original figures would promise too much.
- **Our energy universe is small and correlated.** Four energy contracts move together, so cross-commodity signals in our data have far less room to diversify than the 20 to 30 commodities in the papers. Combining several signals over the same four contracts is the way to get breadth.

## The ingredient list

Every idea below is already in the catalog. "Since publication" is the best evidence we have on what happened after the paper; "Free data" says whether our engine can test it today.

### Emerging market currencies

| Ingredient | Published Sharpe | Since publication | Free data | Notes |
| --- | --- | --- | --- | --- |
| Carry, [ALG-0083](../algorithms/0083-em-fx-carry.md) | 0.74 net, 1983 to 2009 | Currency carry -0.17 in AQR's data | Yes, registered (REG-0006) | Crashes with the others in a crisis |
| Passive EM basket, [ALG-0084](../algorithms/0084-em-fx-passive-basket.md) | 1.34, 1999 to 2008 | Untested after 2008 | Yes, registered (REG-0006) | Mostly a bet on the dollar falling |
| Momentum, [ALG-0085](../algorithms/0085-em-fx-momentum.md), [ALG-0005](../algorithms/0005-fx-cross-sectional-momentum.md) | 0.95 gross for 1-month momentum, 1976 to 2010 | "Weakened substantially" (Della Corte et al.) | Yes, registered (REG-0006) | Strongest in hard-to-trade currencies |
| Value adjusted for fundamentals, [ALG-0016](../algorithms/0016-fx-value-adjusted.md) | 0.8 to 0.9, 1976 to 2013 | Currency value 0.69 in AQR's data | Partly: BIS real exchange rates, no full adjustment | Best post-publication record |
| Dollar carry, [ALG-0006](../algorithms/0006-fx-dollar-carry.md) | 0.66, 1983 to 2010 | 0.55 over 1985 to 2023 (G10, no costs) | Yes (G10 rates) | Times the whole dollar, not single currencies |
| Developed gap times the EM basket (new, [ALG-0097](../algorithms/0097-fx-developed-rate-gap-times-em-basket.md)) | Regression only: 1.8 points a year per point of gap | Untested | Yes | Lustig, Roussanov and Verdelhan |
| Commodity exporters vs importers, [ALG-0076](../algorithms/0076-fx-commodity-trade-imx.md) | 0.42 net, annual rebalancing, 1988 to 2012 | Untested | Yes, with UN Comtrade trade data | Very slow; overlaps with carry |
| Net foreign assets, [ALG-0075](../algorithms/0075-fx-global-imbalances.md) | 0.68, 1983 to 2014 | Untested | Yes, annual data | Slow; overlaps with value |
| Volatility risk premium, [ALG-0018](../algorithms/0018-fx-volatility-risk-premium.md) | 0.51 with EM, 1998 to 2013 | Untested | No: needs option prices | Most "different" ingredient |
| Sovereign credit risk, [ALG-0095](../algorithms/0095-fx-sovereign-credit-risk.md) | 0.71, 2003 to 2013 | Untested | No: needs CDS prices | |

### Energy futures

| Ingredient | Published Sharpe | Since publication | Free data | Notes |
| --- | --- | --- | --- | --- |
| Carry (curve slope), [ALG-0038](../algorithms/0038-commodity-carry-roll-yield.md) | 0.76, 1959 to 2004; 1.04 out of sample to 2014 | Commodity carry 0.58 in AQR's data | Yes to April 2024, registered (REG-0007) | |
| Time-series momentum, [ALG-0039](../algorithms/0039-commodity-time-series-momentum.md) | 1.01, 1985 to 2009 | 0.21, 2012 to 2026 (catalog calculation on AQR's factor) | Yes to April 2024, registered (REG-0007) | Clear decay |
| Basis-momentum, [ALG-0088](../algorithms/0088-commodity-basis-momentum.md) | 0.92, 1960 to 2014 | Untested after February 2014 | Yes to April 2024 | Best candidate (RES-0015) |
| Value (5-year reversal), [ALG-0089](../algorithms/0089-commodity-value-reversal.md) | 0.38, 1926 to 2020 | 0.44 after publication | Yes to April 2024 | Negatively correlated with momentum |
| Skewness, [ALG-0090](../algorithms/0090-commodity-skewness.md) | 0.78, 1987 to 2014 | Untested | Weak with 4 contracts | |
| Inventories (new, [ALG-0096](../algorithms/0096-commodity-inventory-level.md)) | Low minus high inventory, t-statistic 2.78, 1971 to 2010 | Untested | Yes: EIA weekly stocks from 1982 | Overlaps with carry and momentum |
| Short oil volatility, [ALG-0086](../algorithms/0086-commodity-variance-risk-premium.md) | 0.59, 1996 to 2006 | Untested | Yes, registered (REG-0008) | Large crash risk |
| Hedging pressure, [ALG-0091](../algorithms/0091-commodity-hedging-pressure.md) | 0.51, 1992 to 2011 (summary only) | Untested | Yes, CFTC reports | Gorton et al. reject it as a main driver |
| Gas storage report day, [ALG-0044](../algorithms/0044-natural-gas-storage-report.md) | 1.76 net, 2003 to 2018 | About 0.5 recently | Not the paper's version, which trades intraday | Decayed |

### Risk controls for the combined books

- **Volatility targeting**, [ALG-0054](../algorithms/0054-volatility-managed-portfolios.md): size each book to a fixed risk level. Expect fewer extreme months, not a higher Sharpe ratio.
- **Crash filter for carry**, [ALG-0002](../algorithms/0002-fx-carry-volatility-timing.md): carry losses cluster when market volatility jumps. Published versions use option prices; a free version would use the VIX, which we have.
- **Equal weights**, [ALG-0098](../algorithms/0098-equal-weight-style-combination.md): the combination method itself.

## Two combined books worth registering

Neither has been built or run. Both are designs to register before any result is computed.

**Energy book.** For each of the four contracts, every month, turn each signal into a standardised score (carry, basis-momentum, 5-year value and 12-month time-series momentum), average the four scores with equal weights, and hold the contract in proportion to the average, sized to a fixed volatility. Inventories are left out of the first version because they overlap with carry and momentum. The test window has to be from March 2014 to April 2024, after the basis-momentum paper's sample, because the free futures prices end there.

**EM currency book.** Every month, average standardised scores for value (BIS real exchange rate against its own 5-year average), momentum (3-month return) and carry, each with equal weight, across the 17 currencies with rate data; then scale the whole book up when the developed-market rate gap over the dollar is high and down when it is low. The window starts in 2014, after the currency value paper's sample.

**Why average scores rather than run separate strategies side by side.** Averaging scores per contract nets out opposing trades (momentum says buy, value says sell) before any trade is made, so turnover and costs are lower. Fernandez-Perez et al. use this approach, and note the low turnover of their equal-weight version.

## Rules so that combining does not fool us

Combining gives a researcher many new choices: which ingredients, which weights, which periods. Each choice tried and dropped is a hidden trial. The rules:

1. **Choose ingredients from published evidence, before looking at our own results.** The lists above were made from papers only.
2. **Fix equal weights in advance.** No weight is chosen from our data.
3. **Never drop an ingredient after seeing results.** A book that loses an ingredient is a new strategy, registered and counted again.
4. **Count every ingredient tested on its own as a trial**, and the combined book as one more. The always-on search ([DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)) can try combinations at random; anything it finds is a lead, not a result, and its tries count.
5. **Test only after each paper's sample ended.** For the energy book that leaves ten years; for the EM book, about twelve.
6. **Report the correlations between ingredients only after the registration is merged.** The correlations come from the same returns we are testing, so looking first would shape the design.

## What we could not verify

- **Brunnermeier, Nagel and Pedersen (2008) on carry crashes.** We used search summaries of the abstract (rises in the VIX coincide with carry losses and unwinding), not the paper's tables.
- **Bianchi, Drew and Fan (2016) on 52-week-high momentum in commodities.** Abstract only; the free working paper link failed to download.
- **Crack spread (refinery margin) trading.** The papers we found use neural networks and are paywalled. We did not add a catalog entry.
- **EIA gas storage before 2010.** The current Lower 48 storage series starts in 2010 on the EIA site; older weekly storage data exists under a different series, which we have not checked.
- **Kroencke, Schindler and Schrimpf (2014).** Their out-of-sample test with equal weights found adding currency styles to a mix of US bonds, US stocks and international stocks raised the Sharpe ratio from 0.12 to 0.15 a month after costs, 1985 to 2009 ([working paper](https://repec.econ.au.dk/repec/creates/rp/11/rp11_10.pdf)) [@kroencke2014]. We did not check how they annualise, so we quote the monthly figures.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@asness2013](../REFERENCES.md#asness2013): Asness et al. (2013), Value and Momentum Everywhere
- [@fernandezperez2019](../REFERENCES.md#fernandezperez2019): Fernandez-Perez et al. (2019), A \[...\] Appraisal of Style-Integration Methods
- [@dellacorte2016a](../REFERENCES.md#dellacorte2016a): Della Corte et al. (2016), Volatility risk premia and exchange rate predictability
- [@gorton2013](../REFERENCES.md#gorton2013): Gorton et al. (2013), The Fundamentals of Commodity Futures Returns
- [@harvey2018](../REFERENCES.md#harvey2018): Harvey et al. (2018), The Impact of Volatility Targeting
- [@lustig2014](../REFERENCES.md#lustig2014): Lustig et al. (2014), Countercyclical Currency Risk Premia
- [@prokopczuk2021](../REFERENCES.md#prokopczuk2021): Prokopczuk et al. (2021), The Natural Gas Announcement Day Puzzle
- [@melvin2015](../REFERENCES.md#melvin2015): Melvin and Prins (2015), Equity hedging and exchange rates at the London 4p.m. fix
- [@kroencke2014](../REFERENCES.md#kroencke2014): Kroencke et al. (2014), International Diversification Benefits with Foreign Exchange Investment Styles

## Referenced by

- [RES-0017: How the ingredients behave in crises, and what Sim World should show](0017-how-the-ingredients-behave-in-crises-and-what-sim-world-should-show.md)
- [LOG-0012: Combining many strategies, and rebasing on the factory](../log/2026-10-22-combining-many-strategies-and-rebasing-on-the-factory.md)
<!-- backlinks:end -->
