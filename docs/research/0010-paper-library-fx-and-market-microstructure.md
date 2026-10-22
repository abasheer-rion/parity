---
id: RES-0010
title: Paper library: FX and market microstructure
type: research
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [carry, fx, method, momentum, news]
related: [RES-0001, RES-0007, RES-0008]
---

# Paper library: FX and market microstructure

## In plain words

This is a library of research papers about how traders make or lose money with currencies, how currency markets work minute by minute, and how researchers fool themselves with backtests. For each paper we wrote down what it asked, what it found, and whether the finding held up later. Most currency strategies earned modest returns, many shrank after they were published, and the ones that look strongest usually need costly data or very cheap trading.

## Summary

61 papers, grouped into 13 themes. None was in our [reading list](0001-reading-list.md), though four (Osler 2003, Oomen 2017, Sullivan, Timmermann and White 1999, and King, Osler and Rime) were already cited elsewhere in the repo. We read the full text of 32 (often an NBER or university working paper version, which can differ from the journal), only the abstract page of 26, and could not read 3 (listed in [what we could not verify](#what-we-could-not-verify)). Every number below comes from the page we read, and quotes are copied from it. Where we only saw an abstract, we give no table numbers.

What the library tells us:

- **Plain carry is modest over long samples.** Doskov and Swinkels (2015) find carry Sharpe ratios of 0.2 to 0.4 over 1900-2012, well below the 0.6 or more reported for recent samples. Bekaert and Panayotov (2020) get 0.32 for G10 carry over 1994-2014. Higher numbers usually come from shorter or hand-picked samples.
- **Most carry return comes from currencies that always pay high interest.** Hassan and Mano (2019) put the static part at 70% of carry returns. That trade is cheap to run and cheap to test.
- **Signals built from the economy look good but are untested by others.** Global imbalances (Sharpe 0.68), output gaps (0.50 after costs) and commodity trade structure (0.42) all come from the authors' own samples. We found no outside replication of any of them.
- **The highest Sharpe ratios here (0.9 to 1.7) are intraday or need paid order flow or volume data,** and they shrink sharply after costs (Breedon and Ranaldo, 2013; Rime, Sarno and Sojli, 2010; Cespa et al., 2022).
- **Costs decide fast strategies.** Novy-Marx and Velikov (2016) find few stock anomalies with turnover above 50% a month survive costs. Melvin, Pan and Wikstrom (2020) find FX strategies that trade on a few days of returns are too costly even for small portfolios. Hau et al. (2021) find the median corporate client pays 10.9 pips more than the best clients for FX forwards.
- **Overfitting is the default.** Harvey and Liu (2015) show the right haircut for a backtested Sharpe ratio below 0.4 is usually more than 50%. Qi and Wu (2006) find FX technical rules still pass a data-snooping test over the full sample but weaken in the recent period. This backs the trial-counting concerns in our [audit](0008-independent-audit.md).
- **Currencies matter more as equity hedges than as equity substitutes.** Campbell, Serfaty-de Medeiros and Viceira (2010) find the US dollar, euro and Swiss franc moved against world equities. Professional currency managers earned about -1.1% a year after accounting for carry, trend, value and volatility factors (Pojarliev and Levich, 2008).

Ten strategies from these papers were not in our catalog and are now added at stage 2 (sourced), with results quoted from the papers: static carry, good carry, option-hedged carry, global imbalances, output gaps, commodity trade structure, the local trading hours effect, low-volume reversal, asymmetric information risk and complex ridge market timing. See [what this means for us](#what-this-means-for-us).

How to read each entry: **Question**, **Data** and **Method** describe the paper. **Main result** gives its numbers, with the authors' words in quotes. **Later evidence** says what later work found, or that we found nothing. **For us** says what it means for a small team trying to beat the S&P 500.

## The library

### Carry and the dollar

Carry means borrowing in low-interest currencies and holding high-interest ones. These papers ask how much carry really earns over long samples, where the return comes from, and how it fails.

#### Doskov and Swinkels (2015), Empirical evidence on the currency carry trade, 1900-2012

*Journal of International Money and Finance 51, 370-389.* DOI [10.1016/j.jimonfin.2014.12.001](https://doi.org/10.1016/j.jimonfin.2014.12.001). Page we read: <https://ideas.repec.org/a/eee/jimfin/v51y2015icp370-389.html> [@doskov2015]. Checked: abstract page only.

- **Question:** How did the currency carry trade do over a very long history, 1900-2012, not just since Bretton Woods?
- **Data:** 20 currencies, 1900 to 2012.
- **Method:** Builds carry trade returns over the long sample and compares their Sharpe ratios and losses with recent periods and with global equities.
- **Main result:** The abstract reports "modest Sharpe ratios in the range of 0.2-0.4 for carry trading over this period", "markedly lower than the Sharpe ratios above 0.6 reported for recent sample periods." Carry "occasionally incurs substantial losses", and these "do not necessarily coincide with large losses in global equity markets."
- **Later evidence:** Not known to us. Bekaert and Panayotov (2020) report a similar G-10 carry Sharpe ratio of 0.32 for 1994-2014, which is in the same modest range.
- **For us:** A long history suggests the true carry Sharpe ratio may be 0.2-0.4, which makes beating the S&P 500 with plain carry unlikely without leverage.

#### Bekaert and Panayotov (2020), Good Carry, Bad Carry

*Journal of Financial and Quantitative Analysis 55(4), 1063-1094.* DOI [10.1017/S0022109019000887](https://doi.org/10.1017/S0022109019000887). Page we read: <https://www.nber.org/papers/w25420> [@bekaert2020]. Checked: full text.

- **Question:** Do all G-10 currencies help the carry trade, or do some (like AUD and JPY) make it worse?
- **Data:** G-10 currencies, monthly forward and spot rates with bid and ask quotes, 12/1984 to 6/2014.
- **Method:** An investor drops currencies one at a time when doing so raises the past Sharpe ratio, then the authors build fixed 'good' and 'bad' subsets and compare their returns and skewness with bootstrap tests.
- **Main result:** The standard G-10 carry trade "has an annualized Sharpe ratio of 0.32, and return skewness of -0.33"; an enhanced trade that excludes seven currencies reaches "the Sharpe ratio is now 0.61, while skewness is positive". The 'bad' trades built from prototypical carry currencies have "much lower annualized Sharpe ratios, which are between 0.04 and 0.18". The authors warn the good trades suffer from "look-back bias".
- **Later evidence:** Not known to us. The authors themselves note look-back bias in choosing the good currencies.
- **For us:** A plain G-10 carry trade with a Sharpe ratio near 0.3 is well below what equities often deliver, and the better 'good carry' subsets were picked with hindsight, so a small team should treat them as in-sample.

#### Hassan and Mano (2019), Forward and Spot Exchange Rates in a Multi-Currency World

*Quarterly Journal of Economics 134(1), 397-450.* DOI [10.1093/qje/qjy026](https://doi.org/10.1093/qje/qjy026). Page we read: <https://www.nber.org/papers/w20294> [@hassan2019]. Checked: full text.

- **Question:** How do the forward premium puzzle, the carry trade and the dollar trade relate to each other?
- **Data:** Monthly spot and forward rates from Datastream, October 1983 to June 2010; main trading sample 12/1994 to 6/2010.
- **Method:** Splits UIP violations into a cross-currency (static), a between-time-and-currency (dynamic) and a cross-time (dollar) component and measures each as a trading strategy.
- **Main result:** The carry trade "yields a mean annualized net return of 4.95% with a Sharpe ratio of 0.54". The static trade earns "3.46% with a Sharpe ratio of 0.39" and "contributes 70% of carry trade returns"; the dollar trade "has a Sharpe ratio of 0.25". Most carry profit comes from currencies that pay high interest permanently.
- **Later evidence:** Not known to us.
- **For us:** Shows most carry profit comes from a slow, nearly fixed long-short basket, which needs little trading and only free average interest rate data, but its Sharpe ratio is modest.

#### Lustig, Stathopoulos and Verdelhan (2019), The Term Structure of Currency Carry Trade Risk Premia

*American Economic Review 109(12), 4142-4177.* DOI [10.1257/aer.20180098](https://doi.org/10.1257/aer.20180098). Page we read: <https://www.nber.org/papers/w19623> [@lustig2019]. Checked: full text.

- **Question:** Does the carry trade still pay if you hold long-term foreign government bonds instead of short-term bills?
- **Data:** Developed-country government bonds and currencies, monthly, 1/1975 to 12/2015 (also 1/1951-12/2015).
- **Method:** Sorts currencies into portfolios by interest rates or yield slopes and compares dollar returns on short bills versus 10-year bonds, then checks no-arbitrage models.
- **Main result:** The bill-based carry trade "delivers an average annual log excess return of 2.05% - (-0.61%) = 2.66% and a Sharpe ratio of 0.36". With 10-year bonds the trade "delivers a negative average return of -3.78% + 2.66% = -1.12%", not statistically significant. Carry premia fall as bond maturity rises.
- **Later evidence:** Not known to us.
- **For us:** Tells a small team to implement carry with short-term instruments (forwards or bills), since long bonds cancel the premium.

#### Bansal and Dahlquist (2000), The forward premium puzzle: different tales from developed and emerging economies

*Journal of International Economics 51(1), 115-144.* DOI [10.1016/S0022-1996(99)00039-2](https://doi.org/10.1016/S0022-1996(99)00039-2). Page we read: <https://ideas.repec.org/a/eee/inecon/v51y2000i1p115-144.html> [@bansal2000]. Checked: abstract page only.

- **Question:** Is the forward premium puzzle the same in developed and emerging economies?
- **Data:** Developed and emerging economies (exact currencies and sample not read).
- **Method:** Panel regressions of currency depreciation on interest rate differentials, split by country type and by whether US rates are above or below foreign rates.
- **Main result:** The abstract says the negative link between expected depreciation and interest differentials "is, contrary to popular belief, not a pervasive phenomenon. It is confined to developed economies, and here only to states where the U.S. interest rate exceeds foreign interest rates." Differences relate to "per capita GNP, average inflation rates, and inflation volatility." No numbers were read.
- **Later evidence:** Not known to us directly. Hassan and Mano (2019) also find the forward premium puzzle is mostly a time-series (dollar) effect, which is related but a different test.
- **For us:** Warns that carry may not work the same way in emerging markets, so a small team should test developed and emerging currencies separately.

#### Lettau, Maggiori and Weber (2014), Conditional risk premia in currency markets and other asset classes

*Journal of Financial Economics 114(2), 197-225.* DOI [10.1016/j.jfineco.2014.07.001](https://doi.org/10.1016/j.jfineco.2014.07.001). Page we read: <https://www.nber.org/papers/w18844> [@lettau2014]. Checked: full text.

- **Question:** Can a CAPM that treats bad stock-market months differently (downside risk CAPM) explain currency carry returns and other asset classes?
- **Data:** Monthly currency portfolios sorted on interest rates (53 currencies), plus equities, index options, commodities and sovereign bonds, January 1974 to March 2010.
- **Method:** Estimates unconditional and downside market betas for portfolios and runs cross-sectional (Fama-MacBeth) pricing tests of the CAPM against the downside-risk CAPM.
- **Main result:** High interest rate currencies have bigger market betas in bad markets. The plain CAPM gives "a R2 of only 9%" for currencies, while "the DR-CAPM explains 79% of the cross-sectional variation in mean returns", with a price of downside risk of "(2.18)". Both models are still formally rejected by a chi-square test.
- **Later evidence:** Not known to us. Bekaert and Panayotov (2020) argue that good carry trades with positive skewness undercut crash and skewness explanations, which is related but not a direct test.
- **For us:** Carry returns look like payment for losing money when stocks crash, so an FX carry sleeve may not diversify an S&P 500 holding when it matters most.

#### Bakshi and Panayotov (2013), Predictability of currency carry trades and asset pricing implications

*Journal of Financial Economics 110(1), 139-163.* DOI [10.1016/j.jfineco.2013.04.010](https://doi.org/10.1016/j.jfineco.2013.04.010). Page we read: <https://ideas.repec.org/a/eee/jfinec/v110y2013i1p139-163.html> [@bakshi2013]. Checked: abstract page only.

- **Question:** Can commodity prices, currency volatility and liquidity predict when currency carry trades will pay off?
- **Data:** Carry trades against the US dollar built from forward discounts, monthly predictive regressions (exact currencies and sample not read).
- **Method:** Monthly predictive regressions of carry payoffs on changes in a commodity index, currency volatility and a liquidity measure, with out-of-sample checks and a decision rule.
- **Main result:** The abstract reports that these variables "predict in-sample the payoffs of dynamically re-balanced carry trades" at "horizons up to six months", and that "a predictability-based decision rule produces sizable improvements in the Sharpe ratios and skewness profile". The abstract gives no numbers, and we did not read the tables.
- **Later evidence:** Not known to us.
- **For us:** A timing rule using free commodity index and FX volatility data could be tested cheaply, but we have not seen the reported Sharpe ratios, so its size is unknown to us.

#### Melvin and Shand (2017), When Carry Goes Bad: The Magnitude, Causes, and Duration of Currency Carry Unwinds

*Financial Analysts Journal 73(1), 121-144.* DOI [10.2469/faj.v73.n1.4](https://doi.org/10.2469/faj.v73.n1.4). Page we read: <https://ideas.repec.org/a/taf/ufajxx/v73y2017i1p121-144.html> [@melvin2017]. Checked: abstract page only.

- **Question:** How large and how long are carry trade drawdowns, and can their duration be predicted?
- **Data:** Currency carry trade returns over recent decades (exact currencies and dates not seen, abstract only).
- **Method:** Analyse the worst carry drawdowns and estimate a duration model using expected carry return, financial stress indicators and deviations from a fundamental value portfolio.
- **Main result:** Drawdown duration "varies systematically with (1) expected return on the carry trade at the onset of the drawdown, (2) financial stress indicators, and (3) the magnitude of deviations from a fundamental value portfolio". In "an out-of-sample test", these determinants "can be used to control carry-related losses and improve investment performance". No numbers in the abstract.
- **Later evidence:** Not known to us.
- **For us:** Carry crashes are the main way an FX strategy can lose to the S&P 500, and this gives ideas for a stress-based exit filter.

### Crash risk, options and the volatility risk premium

Carry earns slowly and loses fast. These papers ask whether that crash risk explains the return, and whether option prices carry their own premium.

#### Jurek (2014), Crash-neutral currency carry trades

*Journal of Financial Economics 113(3), 325-347.* DOI [10.1016/j.jfineco.2014.05.004](https://doi.org/10.1016/j.jfineco.2014.05.004). Page we read: <https://ideas.repec.org/a/eee/jfinec/v113y2014i3p325-347.html> [@jurek2014]. Checked: abstract page only.

- **Question:** Are high carry trade returns just pay for rare currency crashes (peso problems)?
- **Data:** G10 currencies with out-of-the-money FX options data, 1990-2012 (per abstract).
- **Method:** Builds carry portfolios hedged against crashes with out-of-the-money FX options and compares hedged with unhedged returns.
- **Main result:** The abstract says G10 carry trades "deliver significant excess returns with annualized Sharpe ratios equal to or greater than those of equity market factors (1990-2012)". It concludes "crash risk premia account for at most one-third of the excess return to currency carry trades." We did not read table numbers.
- **Later evidence:** Caballero and Doyle (2012) also find that carry hedged with FX options earns large returns (Sharpe ratio 0.79, 2004-2012), which fits Jurek's view that crash risk does not explain most of the carry premium.
- **For us:** Suggests carry is not only crash compensation, but the hedged version needs FX options data that is not free, so a small team can test only the unhedged leg with free data.

#### Caballero and Doyle (2012), Carry Trade and Systemic Risk: Why are FX Options so Cheap?

*NBER Working Paper 18644.* DOI [10.3386/w18644](https://doi.org/10.3386/w18644). Page we read: <https://www.nber.org/papers/w18644> [@caballero2012]. Checked: full text.

- **Question:** Are carry trade returns just pay for systemic (crash) risk, and are FX options priced cheaply?
- **Data:** 25 countries, monthly, March 2004 (start of VIX futures) to August 2012.
- **Method:** Compares carry returns with a VIX futures rolldown strategy as a systemic-risk benchmark, for unhedged carry and carry hedged with at-the-money FX options.
- **Main result:** "For the unhedged carry, the annualized Sharpe ratio is 0.47, below the 0.57 of its required returns", but for hedged carry "the realized Sharpe ratio of 0.79 is nearly 40% higher". The carry protection options alone earn "a Sharpe ratio of 1.19" after controlling for systemic exposure.
- **Later evidence:** Consistent with Jurek (2014), which also finds crash-hedged carry keeps most of its return; we did not find a direct replication.
- **For us:** Short sample (2004-2012) and needs FX options data, which is not free, so a small team could only test the unhedged half cheaply.

#### Farhi and Gabaix (2016), Rare Disasters and Exchange Rates

*Quarterly Journal of Economics 131(1), 1-52.* DOI [10.1093/qje/qjv040](https://doi.org/10.1093/qje/qjv040). Page we read: <https://www.nber.org/papers/w13805> [@farhi2016]. Checked: abstract page only.

- **Question:** Can the risk of rare world disasters explain why high interest rate currencies do not depreciate as theory says?
- **Data:** Mainly a calibrated theory model; uses FX options evidence (details not read).
- **Method:** A frictionless complete-markets model where countries differ in time-varying exposure to rare world disasters, calibrated and compared with options data.
- **Main result:** In the model "Risky countries command high risk premia: they feature a depreciated exchange rate and a high interest rate", so "currencies of high interest rate countries appreciate on average." The abstract says the calibration gives "quantitatively realistic values" for the forward premium regressions and that "The evidence from the options market appears to be supportive of the model." No numbers were read.
- **Later evidence:** Not known to us. Jurek (2014) finds crash risk premia are at most one-third of carry returns, which suggests disasters are not the whole story.
- **For us:** Theory only; it suggests option prices could signal currency crash risk, but that needs paid options data.

#### Londono and Zhou (2017), Variance risk premiums and the forward premium puzzle

*Journal of Financial Economics 124(2), 415-440.* DOI [10.1016/j.jfineco.2017.02.002](https://doi.org/10.1016/j.jfineco.2017.02.002). Page we read: <https://ideas.repec.org/a/eee/jfinec/v124y2017i2p415-440.html> [@londono2017]. Checked: abstract page only.

- **Question:** Do currency and stock variance risk premiums predict how currencies move against the dollar?
- **Data:** 22 currencies against the US dollar (journal version); world currency and US stock variance risk premiums from options.
- **Method:** Predictive regressions of currency appreciation on currency and stock variance risk premiums, and a consumption-based model.
- **Main result:** The journal abstract says these premiums "have nonredundant and significant predictive power for the appreciation rates of 22 with respect to the U.S. dollar, especially at the four-month and one-month horizons, respectively." We did not read the journal tables, so we give no R2 or t-statistics.
- **Later evidence:** Not known to us.
- **For us:** Needs option-implied variance, which is not free for currencies, though the US stock part could use free VIX data.

### Currency risk premia from the economy

Three papers sort currencies on slow-moving facts about each country's economy instead of on interest rates.

#### Della Corte, Riddiough and Sarno (2016), Currency Premia and Global Imbalances

*Review of Financial Studies 29(8), 2161-2193.* DOI [10.1093/rfs/hhw038](https://doi.org/10.1093/rfs/hhw038). Page we read: <https://www.repository.cam.ac.uk/bitstreams/8c73c934-ac4f-4cf6-8044-1c5de19b8997/download> [@dellacorte2016b]. Checked: full text.

- **Question:** Do countries' net foreign debts and the currency of those debts explain which currencies earn higher returns?
- **Data:** Up to 55 currencies (and 15 developed), monthly end-of-month rates, October 1983 to June 2014, with annual net foreign asset and liability-currency data.
- **Method:** Sorts currencies into five portfolios by net foreign assets to GDP, then by share of foreign liabilities in domestic currency, forms a high-minus-low global imbalance (IMB) factor, and runs asset pricing tests.
- **Main result:** Average excess returns rise from "(0.92% and 0.67% per annum)" in the creditor portfolio "to the last portfolio (5.32% and 4.65% per annum)". The global imbalance strategy has a Sharpe ratio of "0.68 compared to 0.65 for all countries, and 0.59 compared to 0.43 for developed countries" against carry. The info "arrives only once a year".
- **Later evidence:** Not known to us.
- **For us:** Uses free annual balance-sheet data and trades rarely, so costs are low, but its Sharpe ratio of about 0.6-0.7 is still before any check against equity returns over the same period.

#### Colacito, Riddiough and Sarno (2020), Business cycles and currency returns

*Journal of Financial Economics 137(3), 659-678.* DOI [10.1016/j.jfineco.2020.04.005](https://doi.org/10.1016/j.jfineco.2020.04.005). Page we read: <https://www.nber.org/papers/w26299> [@colacito2020]. Checked: full text.

- **Question:** Do currencies of countries with stronger business cycles earn higher returns?
- **Data:** Monthly currency data with output gaps from industrial production, 1983 to 2016, plus real-time 'vintage' data from 1999.
- **Method:** Sorts currencies each month into five portfolios on output gap relative to the US (cross-sectional GAP-CS) and also a time-series version (GAP-TS), and runs asset pricing tests.
- **Main result:** Between 1999 and 2016 with vintage data, the cross-sectional output-gap strategy "generates a Sharpe ratio of 0.72 before transaction costs, and 0.50 after costs"; the time-series version "generates a Sharpe ratio of 0.65 before costs and 0.50 after costs". Correlations with the carry trade "are found to be essentially zero".
- **Later evidence:** Not known to us.
- **For us:** Uses free industrial production data, is close to uncorrelated with carry, and reports after-cost Sharpe ratios near 0.5, which makes it a good candidate to test, though it may not beat equities alone.

#### Ready, Roussanov and Ward (2017), Commodity Trade and the Carry Trade: A Tale of Two Countries

*Journal of Finance 72(6), 2629-2684.* DOI [10.1111/jofi.12546](https://doi.org/10.1111/jofi.12546). Page we read: <https://www.nber.org/papers/w19371> [@ready2017]. Checked: full text.

- **Question:** Why do commodity exporters have high interest rates and finished-goods exporters low ones, and does that explain carry returns?
- **Data:** Monthly forward and spot rates (Barclays, Reuters via Datastream) and annual UN Comtrade trade data, 1/1988 to 12/2012.
- **Method:** A trade model with shipping limits, plus a strategy (IMX) that sorts currencies on a commodity-versus-finished-goods trade ratio, and regressions of carry returns on IMX.
- **Main result:** Spreads in average returns between extreme trade-sorted portfolios are "close to 4% per year". An annually rebalanced IMX strategy with bid and ask quotes has "a Sharpe ratio for the IMX strategy of 0.42". IMX "fully explains the returns to the U HML FX strategy" (unconditional carry) but only some of standard carry.
- **Later evidence:** Not known to us.
- **For us:** Uses free trade data, rebalances once a year so costs are small, but a Sharpe ratio of about 0.4 is unlikely to beat the S&P 500 on its own.

### Momentum and value

Momentum buys recent winners. These papers test whether currency momentum survived after the 1980s and what drives it.

#### Okunev and White (2003), Do Momentum-Based Strategies Still Work in Foreign Currency Markets?

*Journal of Financial and Quantitative Analysis 38(2), 425-447.* DOI [10.2307/4126758](https://doi.org/10.2307/4126758). Page we read: <https://ideas.repec.org/a/cup/jfinqa/v38y2003i02p425-447_00.html> [@okunev2003]. Checked: abstract page only.

- **Question:** Did the profits from currency momentum strategies seen in the 1970s and 1980s continue into the 1990s?
- **Data:** Major foreign exchange rates, monthly, through the 1990s (exact currency list and dates not seen, abstract only).
- **Method:** Momentum trading rules applied across currencies, varying the rule specification and the base currency, plus tests of whether profits reflect a time-varying risk premium.
- **Main result:** The abstract says the "well-documented profitability of momentum strategies during the 1970s and the 1980s has continued throughout the 1990s" and that results are "insensitive to the specification of the trading rule and the base currency". It attributes profits to "the underlying autocorrelation structure of the currency returns" rather than a time-varying risk premium. No numbers are given in the abstract.
- **Later evidence:** Later work, for example Menkhoff, Sarno, Schmeling and Schrimpf (2012, JFE, Currency momentum strategies), also found currency momentum profits but stressed they are concentrated in costly-to-trade currencies; we did not re-read that paper here.
- **For us:** An early, simple monthly momentum rule on major currencies that can be re-tested with free daily spot data, but we could not see its return or Sharpe numbers.

#### Accominotti and Chambers (2016), If You're So Smart: John Maynard Keynes and Currency Speculation in the Interwar Years

*Journal of Economic History 76(2), 342-386.* DOI [10.1017/S0022050716000589](https://doi.org/10.1017/S0022050716000589). Page we read: <https://www.cambridge.org/core/services/aop-cambridge-core/content/view/EDE2AA44C9394C69B54283D052B96B1E/S0022050716000589a.pdf/div-class-title-if-you-re-so-smart-john-maynard-keynes-and-currency-speculation-in-the-interwar-years-div.pdf> [@accominotti2016]. Checked: full text.

- **Question:** How did carry, momentum and Keynes's own fundamentals-based currency trading perform in the 1920s and 1930s?
- **Data:** Nine currencies (BEF, CHF, DEM, ESP, FRF, GBP, ITL, NLG, USD) against sterling, monthly spot and forward quotes from newspapers, roughly 1920 to 1939, plus Keynes's own trading records.
- **Method:** Rank currencies monthly by forward discount (carry) or past one-month spot change (momentum), go long the top two and short the bottom two in forwards, with and without bid-ask costs; compare with Keynes's trades and UK stocks.
- **Main result:** Over the whole interwar sample, carry and momentum earned "mean annualized excess returns of 10.11 percent and 12.47 percent before transaction costs", with Sharpe ratios of 0.57 and 0.63, against 0.26 for UK stocks (Table 3); after costs the Sharpe ratios were 0.38 and 0.47. Results split by regime: strong in the 1920s float (carry Sharpe 1.04) but in the 1931 onward managed float carry had a Sharpe of -0.30 before costs. The authors say "Technical strategies were highly profitable during the 20s and even outperformed Keynes", while in the 30s "both technical strategies and Keynes performed relatively poorly".
- **Later evidence:** The paper itself cites the same strategies on G10 currencies over 1985-2012 with Sharpe ratios of 0.56 (carry) and 0.24 (momentum) from Accominotti and Chambers (2014). Other replications not known to us.
- **For us:** Shows that simple monthly carry and momentum rules beat stocks over one era but can turn negative for years in another, a warning about regime dependence for any FX-vs-S&P test.

#### Raza, Marshall and Visaltanachoti (2014), Is there momentum or reversal in weekly currency returns?

*Journal of International Money and Finance 45, 38-60.* DOI [10.1016/j.jimonfin.2014.02.009](https://doi.org/10.1016/j.jimonfin.2014.02.009). Page we read: <https://ideas.repec.org/a/eee/jimfin/v45y2014icp38-60.html> [@raza2014]. Checked: abstract page only.

- **Question:** In one- to four-week currency returns, is momentum or reversal the dominant pattern?
- **Data:** 63 emerging and developed market currencies, weekly returns (exact dates not seen, abstract only).
- **Method:** Short-horizon cross-sectional momentum and reversal strategies with one- to four-week formation, checked across sub-periods, USD up and down phases, and business cycles.
- **Main result:** The abstract reports "evidence of momentum rather than reversal" and that "Momentum strategy returns are as large as 8% p.a." Returns are "larger in the earlier sub-period but still exist in the more recent period" and are better "in business cycle expansions".
- **Later evidence:** Not known to us.
- **For us:** A weekly rule on free spot data is easy to test, but 8% p.a. at weekly turnover across many emerging currencies may shrink a lot after realistic costs.

#### Orlov (2016), Currency momentum, carry trade, and market illiquidity

*Journal of Banking and Finance 67, 1-11.* DOI [10.1016/j.jbankfin.2016.02.010](https://doi.org/10.1016/j.jbankfin.2016.02.010). Page we read: <https://ideas.repec.org/a/eee/jbfina/v67y2016icp1-11.html> [@orlov2016]. Checked: abstract page only.

- **Question:** Does equity market illiquidity predict the returns of currency momentum and carry strategies?
- **Data:** Currency momentum and carry portfolio returns and an equity market illiquidity measure, monthly (exact sample not seen).
- **Method:** Predictive regressions of currency momentum and carry excess returns on lagged equity market illiquidity, with robustness checks.
- **Main result:** The abstract says equity illiquidity "explains the evolution of currency momentum strategy payoffs, but not carry trade", and "Returns on currency momentum are low following months of high equity market illiquidity". It adds that "in the recent decade, illiquidity positively predicts the associated payoffs" and that the effect approximates "one-third of average monthly profits".
- **Later evidence:** Not known to us.
- **For us:** Suggests a possible timing filter for FX momentum using stock market liquidity, but the sign flipped in the recent decade, so it is fragile for a small team.

#### Filippou, Gozluklu and Taylor (2018), Global Political Risk and Currency Momentum

*Journal of Financial and Quantitative Analysis 53(5), 2227-2259.* DOI [10.1017/S0022109018000686](https://doi.org/10.1017/S0022109018000686). Page we read: <https://ideas.repec.org/a/cup/jfinqa/v53y2018i05p2227-2259_00.html> [@filippou2018]. Checked: abstract page only.

- **Question:** Is political risk priced in the cross-section of currency momentum returns?
- **Data:** Currency momentum portfolios and a political risk measure relative to the United States (sample and frequency not seen, abstract only).
- **Method:** Asset pricing tests of momentum portfolios on a global political risk factor, controlling for transaction costs, reversals and limits to arbitrage.
- **Main result:** The abstract says "political risk is priced in the cross section of currency momentum and contains information beyond other risk factors", robust "after controlling for transaction costs, reversals, and alternative limits to arbitrage". Investors are "compensated for the exposure to the global political risk" of past winners, mainly via exposure to "U.S. political shocks". No numbers in the abstract.
- **Later evidence:** Not known to us.
- **For us:** Offers a risk story for why FX momentum pays, but the political risk data are likely not free, so it is hard for a small team to use directly.

### Central bank announcements

How much a surprise in interest rate policy, or in central bank speeches, moves the currency, and how fast.

#### Kearns and Manners (2006), The Impact of Monetary Policy on the Exchange Rate: A Study Using Intraday Data

*International Journal of Central Banking 2(4), 157-183.* Page we read: <https://www.ijcb.org/journal/v2n4/impact-monetary-policy-exchange-rate-study-using-intraday-data> [@kearns2006]. Checked: full text.

- **Question:** How much does a surprise change in the policy rate move the exchange rate, measured in a narrow intraday window?
- **Data:** Intraday exchange rates for Australia, Canada, New Zealand and the United Kingdom around policy announcements, in carefully chosen sample periods.
- **Method:** Event study with a short intraday window, using market-implied surprises, and separating surprises that change the expected future path from those that only shift timing.
- **Main result:** "An unanticipated tightening of 25 basis points leads to a rapid appreciation of around 0.35 percent", with country estimates of a quarter to a half percent (RBA version). If expectations of future policy are revised by the full surprise, the impact is larger "(0.4 percent)" than if the surprise only brings forward a change "(0.2 percent)". The RBA version adds that policy changes "account for only a small part of the observed variability of exchange rates".
- **Later evidence:** Not known to us; Inoue and Rossi (2019) also find easing depreciates the currency for the US using a different method.
- **For us:** Gives a size for announcement moves (about 0.35% per 25bp surprise), which is small next to daily FX noise and needs intraday data plus a surprise measure to trade.

#### Ranaldo and Rossi (2010), The reaction of asset markets to Swiss National Bank communication

*Journal of International Money and Finance 29(3), 486-503.* DOI [10.1016/j.jimonfin.2009.07.004](https://doi.org/10.1016/j.jimonfin.2009.07.004). Page we read: <https://ideas.repec.org/a/eee/jimfin/v29y2010i3p486-503.html> [@ranaldo2010a]. Checked: abstract page only.

- **Question:** How do Swiss currency, bond and stock markets react in real time to SNB announcements, speeches and interviews?
- **Data:** High-frequency Swiss franc, bond and stock market prices around SNB communication events (sample dates not seen).
- **Method:** High-frequency event study of price reactions to monetary policy announcements, speeches and interviews.
- **Main result:** The abstract says "speeches and interviews, along with monetary policy announcements, engender a significant price reaction" across the currency, bond and stock markets. No effect sizes are given in the abstract.
- **Later evidence:** Not known to us.
- **For us:** Suggests central bank talk, not just rate decisions, moves the franc, but trading it needs intraday data and event timestamps, not free daily data.

#### Inoue and Rossi (2019), The effects of conventional and unconventional monetary policy on exchange rates

*Journal of International Economics 118, 419-447.* DOI [10.1016/j.jinteco.2019.01.015](https://doi.org/10.1016/j.jinteco.2019.01.015). Page we read: <https://ideas.repec.org/a/eee/inecon/v118y2019icp419-447.html> [@inoue2019]. Checked: full text.

- **Question:** Does US monetary easing depreciate the dollar in both conventional and unconventional (QE) periods?
- **Data:** US yield curve shocks and dollar exchange rates, split into a conventional period (1995:1-2008:10) and an unconventional period (2008:11-2016:6) per the NBER version.
- **Method:** Identifies policy shocks as shifts in the whole yield curve caused by unanticipated policy moves, letting shocks differ by how they change expectations and perceived risk.
- **Main result:** The abstract finds "a monetary policy easing leads to a depreciation of the country's spot nominal exchange rate in both conventional and unconventional periods", with "substantial heterogeneity in monetary policy shocks over time". It reports "favorable evidence to Dornbusch's (1976) overshooting hypothesis". The abstract gives no headline numbers and we did not extract impulse response sizes.
- **Later evidence:** Not known to us.
- **For us:** Confirms the sign of the FOMC effect on the dollar, but the shock measure needs yield curve data around meetings, so it is a context paper more than a tradeable rule.

### Order flow and market structure

Order flow is the net buying or selling pressure from trades. These papers ask what it reveals, who trades, and how computers changed the market.

#### King, Osler and Rime (2011), Foreign exchange market structure, players and evolution

*Norges Bank Working Paper 2011/10 (later published as a chapter in the Handbook of Exchange Rates, Wiley, 2012, pp. 1-44).* DOI [10.1002/9781118445785.ch1](https://doi.org/10.1002/9781118445785.ch1). Page we read: <https://ideas.repec.org/p/bno/worpap/2011_10.html> [@king2012]. Checked: full text.

- **Question:** Who trades FX, how do they interact, and how has the market's structure changed over two decades?
- **Data:** A survey drawing on BIS triennial survey figures up to 2010 and other sources; no single trading data set.
- **Method:** Descriptive survey of players (dealers, customers, retail, high-frequency traders), trading venues and their evolution, with points relevant to exchange rate modelling.
- **Main result:** The paper says "With daily average turnover most recently estimated at $2.0 trillion" for spot and forwards, and that other currency instruments "swell average daily turnover in FX markets beyond $4.0 trillion". Retail platforms "reached an estimated $125 to 150 billion per day in 2010, equivalent to 8 to 10 percent of global spot turnover", and algorithmic trading "now accounts for from one third to one half of trading in the most liquid currencies". It also states "Interdealer bid-ask spreads in the major currencies are typically 0.5 to 2.0 pips".
- **Later evidence:** Not applicable for a survey; figures are as of about 2010 and will be dated.
- **For us:** Useful for setting realistic cost assumptions (interdealer spreads of 0.5 to 2 pips, wider for retail) and for understanding who a small team trades against.

#### Payne (2003), Informed trade in spot foreign exchange markets: an empirical investigation

*Journal of International Economics 61(2), 307-329.* DOI [10.1016/S0022-1996(03)00003-5](https://doi.org/10.1016/S0022-1996(03)00003-5). Page we read: <https://ideas.repec.org/a/eee/inecon/v61y2003i2p307-329.html> [@payne2003]. Checked: not read: Title, journal, volume and pages confirmed on IDEAS/RePEc and via Crossref, but IDEAS says 'No abstract is available for this item', ScienceDirect returned 403, Unpaywall and OpenAlex list no open copy, and the Bristol repository page showed no abstract. Web search budget was exhausted so no other host could be found. Nothing below is taken from the paper itself..

- **Why it is here:** Background on whether FX order flow carries information; it needs proprietary interdealer trade data, so it is not directly testable with free daily data.
- **What we know:** only the title and journal. We report no results for it.

#### Rime, Sarno and Sojli (2010), Exchange rate forecasting, order flow and macroeconomic information

*Journal of International Economics 80(1), 72-88.* DOI [10.1016/j.jinteco.2009.03.005](https://doi.org/10.1016/j.jinteco.2009.03.005). Page we read: <https://ideas.repec.org/a/eee/inecon/v80y2010i1p72-88.html> [@rime2010]. Checked: full text.

- **Question:** Can interdealer order flow, which may reflect differing views about macro fundamentals, explain and forecast daily exchange rate moves out of sample?
- **Data:** Reuters D2000-2 interdealer quotes and trades for USD vs EUR, GBP and JPY, high frequency, aggregated to daily (7:00-17:00 GMT) order flow, February 13, 2004 to February 14, 2005.
- **Method:** Relates order flow to current and expected macro fundamentals, then uses order flow models to forecast next-day exchange rate changes and feeds the forecasts into a daily Sharpe-ratio-maximizing allocation across three currencies and an overnight deposit, compared with a random walk and other models.
- **Main result:** The journal abstract says order flow is "a powerful predictor of daily movements in exchange rates in an out-of-sample exercise". In the working paper (Table 8) the best order flow model "yields Sharpe ratios ranging from 0.44 to 2.24 depending on which hour of the day the investor closes his position" and "The average Sharpe ratio for M OF is 1.59". With the highest assumed cost of 0.0004 dollars per unit traded (Table 9), "the average Sharpe ratio for M OF for the highest transaction costs is 0.82".
- **Later evidence:** not known to us. The sample is one year only, which the paper itself treats as a limitation of the evidence; we did not find a later out-of-sample check.
- **For us:** Shows Sharpe ratios above the paper's own quoted S&P 500 buy-and-hold range of 0.4 to 0.5, but it needs interdealer order flow data that is not free, and the sample is only one year.

#### Osler (2003), Currency Orders and Exchange Rate Dynamics: An Explanation for the Predictive Success of Technical Analysis

*Journal of Finance 58(5), 1791-1819.* DOI [10.1111/1540-6261.00588](https://doi.org/10.1111/1540-6261.00588). Page we read: <https://ideas.repec.org/a/bla/jfinan/v58y2003i5p1791-1819.html> [@osler2003]. Checked: full text.

- **Question:** Can clustering of stop-loss and take-profit orders at round numbers explain why support/resistance levels seem to work in FX?
- **Data:** Stop-loss and take-profit orders at one large dealing bank in dollar-yen, euro-dollar and dollar-pound, September 1, 1999 through April 11, 2000 (9,667 orders in the working paper).
- **Method:** Compares the distribution of the last two digits of requested order prices with a uniform distribution, separately for take-profit and stop-loss, buy and sell orders.
- **Main result:** The abstract says "Take-profit orders cluster particularly strongly at round numbers" and "Stop-loss orders cluster strongly just beyond round numbers", which could explain trend reversals at, and fast trends after crossing, support/resistance levels. In the working paper, "9.3 percent of take-profit orders are executed exactly at 00, while the corresponding percent for stop-loss orders is only 4.4", against roughly 1 percent under uniformity.
- **Later evidence:** Osler later extended this to stop-loss cascades (NY Fed Staff Report 150, 'Stop-Loss Orders and Price Cascades in Currency Markets'); we saw only its title, so we cannot say what it found.
- **For us:** Gives a mechanism for round-number support/resistance effects that a small team could test on free hourly or daily FX data, though the order data themselves are proprietary.

#### Chaboud et al. (2014), Rise of the Machines: Algorithmic Trading in the Foreign Exchange Market

*Journal of Finance 69(5), 2045-2084.* DOI [10.1111/jofi.12186](https://doi.org/10.1111/jofi.12186). Page we read: <https://ideas.repec.org/a/bla/jfinan/v69y2014i5p2045-2084.html> [@chaboud2014]. Checked: abstract page only.

- **Question:** Does algorithmic (computer-generated) trading make FX prices more or less efficient?
- **Data:** EBS interdealer minute-by-minute data that flag computer versus human trades in euro-dollar, dollar-yen and euro-yen; the 2009 version says EBS AT data run 2003 through 2007.
- **Method:** Relates the share of algorithmic trading to triangular arbitrage frequency and high-frequency return autocorrelation, separating computers taking versus providing liquidity, and checks correlation of algorithmic strategies.
- **Main result:** The abstract reports "AT causes an improvement in two measures of price efficiency: the frequency of triangular arbitrage opportunities and the autocorrelation of high-frequency returns." The fall in arbitrage is linked "primarily with computers taking liquidity", which "may also impose higher adverse selection costs on slower traders". Algorithmic strategies look "highly correlated" but this "does not appear to cause a degradation in market quality, at least not on average". No headline numbers are in the abstract.
- **Later evidence:** not known to us
- **For us:** Suggests short-horizon FX patterns (autocorrelation, arbitrage) have been competed away by machines, so a small team should not expect easy intraday edges; not testable with free daily data.

#### Mancini, Ranaldo and Wrampelmeyer (2013), Liquidity in the Foreign Exchange Market: Measurement, Commonality, and Risk Premiums

*Journal of Finance 68(5), 1805-1841.* DOI [10.1111/jofi.12053](https://doi.org/10.1111/jofi.12053). Page we read: <https://ideas.repec.org/a/bla/jfinan/v68y2013i5p1805-1841.html> [@mancini2013]. Checked: full text.

- **Question:** How should FX liquidity be measured, does it co-move across currency pairs, and is liquidity risk priced in currency returns?
- **Data:** EBS one-second quote and order flow data for nine major exchange rates, January 2007 to December 2008 (working paper version).
- **Method:** Builds several high-frequency liquidity measures (price impact, return reversal, spreads) and a latent common liquidity factor, then adds a liquidity risk factor to an asset pricing model for currency (carry) portfolio returns.
- **Main result:** The abstract says "liquidity co-moves across currency pairs and that systematic FX liquidity decreases dramatically during the crisis" and that "liquidity risk is heavily priced". In the working paper, "A currency pair with a [beta-CLS] of one earns a risk premium of 7% and 13% per year, depending on whether latent or average liquidity is used" (Greek beta replaced with [beta-CLS]), and the authors summarise "liquidity risk receiving a significant risk premium of as high as 20% per year".
- **Later evidence:** not known to us
- **For us:** Warns that carry-style FX returns partly pay for crash-time liquidity risk, and that trading costs jump in crises; the liquidity measures need tick data, but the risk premium idea can be partly checked with free daily data.

#### Ranaldo and Somogyi (2021), Asymmetric information risk in FX markets

*Journal of Financial Economics 140(2), 391-411.* DOI [10.1016/j.jfineco.2020.12.007](https://doi.org/10.1016/j.jfineco.2020.12.007). Page we read: <https://ideas.repec.org/a/eee/jfinec/v140y2021i2p391-411.html> [@ranaldo2021]. Checked: full text.

- **Question:** Does FX order flow carry superior information across participant types, time and currency pairs, and is that asymmetric information risk priced?
- **Data:** CLS hourly spot order flow split by participant type (corporates, funds, non-bank financials, banks) for 16 major currencies and 30 currency pairs, 2 September 2012 to 31 December 2019.
- **Method:** Estimates the permanent price impact of order flow per pair and agent group, averages it into a pair-level asymmetric information measure, and sorts currency pairs into a monthly long-short portfolio, then checks it against carry, momentum, value and volatility factors.
- **Main result:** The abstract says a strategy on permanent price impact "generates high returns even after accounting for risk, transaction cost, and other common risk factors". The working paper reports that the long-short portfolio "generates a both economically and statistically significant annualised return of 4.05% (3.16%) and a Sharpe ratio (SR) of 0.83 (0.65) before (after) transaction cost", and that "these returns cannot be explained by common FX risk factors, such as carry, momentum, value and volatility".
- **Later evidence:** not known to us
- **For us:** A post-cost Sharpe of about 0.65 is in the range a small team might compare with the S&P 500, but the signal needs CLS order flow data, which is not free.

#### Hasbrouck and Levich (2021), Network structure and pricing in the FX market

*Journal of Financial Economics 141(2), 705-729.* DOI [10.1016/j.jfineco.2021.04.013](https://doi.org/10.1016/j.jfineco.2021.04.013). Page we read: <https://ideas.repec.org/a/eee/jfinec/v141y2021i2p705-729.html> [@hasbrouck2021]. Checked: abstract page only.

- **Question:** Does a trader's position in the FX trading network (centrality) affect the prices it gets?
- **Data:** CLS Bank settlement data across diverse currency pairs, participants and execution platforms (sample dates not stated in the abstract).
- **Method:** Builds the trading network and centrality measures, defines an average centrality differential as the return to the more-central counterparty, and attributes trading profits.
- **Main result:** The abstract says "the more-central counterparty receives a higher return, and that this differential increases as the counterparties' centralities diverge", consistent with "a pervasive centrality premium". The premium "is partially offset by losses that central agents incur in supplying liquidity". The abstract gives no numbers.
- **Later evidence:** not known to us
- **For us:** Suggests small, peripheral traders pay a price penalty versus central dealers, which matters for a small team's realistic cost assumptions; not testable with free data.

### Last look and benchmark fixings

Last look lets a dealer reject a trade after seeing it. Fixings are the official daily rates that funds trade at. Both shape the prices a small trader actually gets.

#### Oomen (2017), Last look

*Quantitative Finance 17(7), 1057-1070.* DOI [10.1080/14697688.2016.1262545](https://doi.org/10.1080/14697688.2016.1262545). Page we read: <https://ideas.repec.org/a/taf/quantf/v17y2017i7p1057-1070.html> [@oomen2017]. Checked: full text.

- **Question:** How do different last look designs and trading protocols change the execution risk and transaction costs a trader faces?
- **Data:** No empirical data set; a model-based and simulation framework.
- **Method:** A unified framework comparing 'symmetric' and 'asymmetric' last look designs and protocols that do or do not pass price improvement and slippage back to the trader, including the case where the trader adversely selects the liquidity provider.
- **Main result:** The paper finds "the choice of last look design and trading protocol determines the degree of execution risk inherent in the process, but the effective transaction costs borne by the trader need not be affected by it". Also, "when a trader adversely selects the liquidity provider she chooses to deal with, the distinction between the different symmetric and asymmetric last look designs fades and the primary driver of execution risk is the choice of trading protocol". The abstract gives no numbers.
- **Later evidence:** not known to us
- **For us:** Reminds a small team that quoted FX prices may be rejected or re-quoted, so backtests on indicative quotes can understate real costs and fill risk.

#### Cartea, Jaimungal and Walton (2019), Foreign exchange markets with Last Look

*Mathematics and Financial Economics 13(1), 1-30.* DOI [10.1007/s11579-018-0218-3](https://doi.org/10.1007/s11579-018-0218-3). Page we read: <https://arxiv.org/abs/1806.04460> [@cartea2019]. Checked: abstract page only.

- **Question:** How does a last look option change the spreads brokers quote when they face latency arbitrageurs, with one or two venues?
- **Data:** No empirical data; a theoretical model.
- **Method:** Risk-neutral brokers set spreads so expected profit is zero, recovering losses to latency arbitrageurs from other traders; the paper compares venues with and without last look and studies migration equilibria between two venues.
- **Main result:** With one venue, "the Last Look option reduces quoted spreads". With two venues the market reaches an equilibrium where "traders have no incentive to migrate", with both venues coexisting or one surviving, and "counterintuitively, it may be the case that the Last Look venue quotes larger spreads". The abstract gives no numbers.
- **Later evidence:** not known to us
- **For us:** Background on why quoted FX spreads may not equal real execution costs; not a strategy and not testable with free daily data.

#### Evans (2018), Forex trading and the WMR Fix

*Journal of Banking and Finance 87, 233-247.* DOI [10.1016/j.jbankfin.2017.09.017](https://doi.org/10.1016/j.jbankfin.2017.09.017). Page we read: <https://mpra.ub.uni-muenchen.de/81583/1/MPRA_paper_81583.pdf> [@evans2018]. Checked: full text.

- **Question:** How do forex prices behave around the 4:00 pm London WMR Fix, and does that match a model of competitive dealer trading?
- **Data:** Minute-level prices for 21 currency pairs around the 4 pm WMR Fix, from the start of 2004 to the end of 2013, with EBS trading samples from 2007, 2010 and 2013.
- **Method:** Builds a microstructure model of competitive trading before the Fix, then compares pre- and post-Fix price changes with bootstrap distributions of price changes away from the Fix and runs projections of post-Fix changes on pre-Fix changes.
- **Main result:** The abstract says that "Contrary to the predictions of the model, forex price changes display extraordinary volatility and negative serial correlation around the Fix." At month end, atypically large one-minute pre-Fix moves occur "between four and twelve times the rate consistent with normal trading activity", and projection coefficients of post-Fix on pre-Fix changes are "uniformly negative, ranging in value from -0.07 to -0.61" with R2 "generally small (i.e. below 0.2)". On intra-month days post-Fix reversals are "on the order of one basis point".
- **Later evidence:** Krohn, Mueller and Whelan (2024) document related dollar return reversals around several fixes, including London, over 21 years; their abstract does not cite Evans by name in what we read, so we only note the overlap.
- **For us:** Shows that the big, regular price effects around the London 4 pm fix are short-lived and mostly at month end, which needs minute data, so a team with free daily data cannot test it directly and reversals of about one basis point on normal days are unlikely to survive costs.

#### Ito and Yamada (2017), Puzzles in the Tokyo fixing in the forex market: Order imbalances and Bank pricing

*Journal of International Economics 109, 214-234.* DOI [10.1016/j.jinteco.2017.09.005](https://doi.org/10.1016/j.jinteco.2017.09.005). Page we read: <https://ideas.repec.org/a/eee/inecon/v109y2017icp214-234.html> [@ito2017]. Checked: full text.

- **Question:** Why do prices spike at the 9:55 am Tokyo fixing, and are bank-announced fixing rates biased?
- **Data:** One-minute ICAP-EBS data for EUR/JPY, EUR/USD, USD/CHF and USD/JPY from January 5, 2006 to December 31, 2013, plus fixing rates announced by banks.
- **Method:** Compares price spikes and order flow around the Tokyo and London fixings, and compares bank-announced fixing rates with the maximum and median transaction prices in the fixing window.
- **Main result:** The published abstract lists three puzzles: "(1) the spikes in prices at the fixing time occur despite a high level of liquidity in the market; (2) the order flows before the fixing are biased toward the dollar, which generates a predictable price pattern; and (3) the bank-announced fixing rates are biased toward dollar appreciation." In the working paper, "the banks used to set the fixing rate higher than the maximum market rates by around 2.5 bp" before November 2008.
- **Later evidence:** Krohn, Mueller and Whelan (2024) report dollar appreciation into fixes and depreciation after them across nine currencies, which fits the Tokyo pattern, but we did not check whether they test Tokyo separately.
- **For us:** Points to a recurring pre-9:55 Tokyo dollar buying pressure, but the effect is a few basis points within minutes, so it needs intraday data and very low costs, and is out of reach for a free-daily-data test.

#### Krohn, Mueller and Whelan (2024), Foreign Exchange Fixings and Returns around the Clock

*Journal of Finance 79(1), 541-578.* DOI [10.1111/jofi.13306](https://doi.org/10.1111/jofi.13306). Page we read: <https://ideas.repec.org/a/bla/jfinan/v79y2024i1p541-578.html> [@krohn2024]. Checked: abstract page only.

- **Question:** Is there a regular intraday pattern in dollar exchange rates around the main FX fixes, and why?
- **Data:** Intraday returns for the top nine traded currencies against the US dollar over a 21-year period (exact dates not seen).
- **Method:** Measures average returns around the clock and around fixing times, uses natural experiments on the existence of a published reference rate, and tests an inventory risk explanation.
- **Main result:** The abstract says "The U.S. dollar appreciates in the run-up to foreign exchange (FX) fixes and depreciates thereafter, tracing a W-shaped return pattern around the clock." The reversals "are pervasive and highly statistically significant, and they imply daily swings of more than one billion U.S. dollars based on spot volumes." The authors find evidence "consistent with an inventory risk explanation whereby FX dealers intermediate unconditional demand for U.S. dollars at the fixes."
- **Later evidence:** Not known to us; it extends the single-fix results of Evans (2018) and Ito and Yamada (2017) to many fixes.
- **For us:** Describes the most recent and broadest fix-timing effect, but testing it needs hourly or finer data and realistic spreads; we did not see their cost-adjusted numbers.

### Intraday seasonality

Patterns by hour of the day: when volatility is high, and which currency tends to fall in which session.

#### Andersen and Bollerslev (1998), Deutsche Mark-Dollar Volatility: Intraday Activity Patterns, Macroeconomic Announcements, and Longer Run Dependencies

*Journal of Finance 53(1), 219-265.* DOI [10.1111/0022-1082.85732](https://doi.org/10.1111/0022-1082.85732). Page we read: <https://www.nber.org/papers/w5783> [@andersen1998]. Checked: abstract page only.

- **Question:** How much of DM-dollar volatility is explained by intraday activity patterns, macro announcements and longer-run volatility persistence?
- **Data:** Five-minute DM-dollar returns over a one-year period.
- **Method:** Models and separately quantifies the intraday seasonal pattern, announcement effects and ARCH-type persistence in high-frequency returns.
- **Main result:** The abstract says the approach addresses "pronounced intraday activity patterns, the strong macroeconomic announcement effects, and the volatility persistence, or ARCH effects" and that together these explain a large share of return variability at both intraday and daily horizons. No numbers were visible in the abstract.
- **Later evidence:** Not checked here; the intraday volatility pattern it describes is widely used in later work, but we did not read a specific replication.
- **For us:** Background on when FX volatility is high during the day and around news; useful for timing trades and for knowing that daily data hides this, but it is not a trading strategy.

#### Ranaldo (2009), Segmentation and time-of-day patterns in foreign exchange markets

*Journal of Banking and Finance 33(12), 2199-2206.* DOI [10.1016/j.jbankfin.2009.05.019](https://doi.org/10.1016/j.jbankfin.2009.05.019). Page we read: <https://ideas.repec.org/a/eee/jbfina/v33y2009i12p2199-2206.html> [@ranaldo2009]. Checked: abstract page only.

- **Question:** Do currencies show regular time-of-day patterns tied to the home country's business hours?
- **Data:** Intraday exchange rates for several currency pairs over multiple years (details not seen; Breedon and Ranaldo (2013) describe it as covering the Deutsche mark/euro against the yen from 1993 to 2005).
- **Method:** Compares returns in domestic versus foreign trading hours and relates them to liquidity and inventory management by domestic traders.
- **Main result:** Per the abstract as we read it, domestic currencies systematically weaken during their own country's business hours and strengthen during foreign hours, the pattern persists across years and pairs, and it is explained by domestic participants being net buyers of foreign currency during their local working hours. No numbers were visible in what we read.
- **Later evidence:** Breedon and Ranaldo (2013) confirm the local-hours depreciation pattern with EBS data for six pairs from 1997 to 2007.
- **For us:** Suggests a simple time-of-day rule, but it needs session-level (intraday) prices, not free daily closes.

#### Breedon and Ranaldo (2013), Intraday Patterns in FX Returns and Order Flow

*Journal of Money, Credit and Banking 45(5), 953-965.* DOI [10.1111/jmcb.12032](https://doi.org/10.1111/jmcb.12032). Page we read: <https://ideas.repec.org/a/wly/jmoncb/v45y2013i5p953-965.html> [@breedon2013]. Checked: full text.

- **Question:** Do currencies tend to depreciate during their own local trading hours, and is this linked to order flow?
- **Data:** EBS firm quotes and trades for EUR/USD, USD/JPY, GBP/USD, EUR/JPY, USD/CHF and AUD/USD, January 1997 to early June 2007, intraday.
- **Method:** Compares session returns (home versus foreign trading hours) with t-tests, GARCH with dummies and sign tests, relates them to EBS order flow, and checks a simple session trading rule using firm bid and ask prices.
- **Main result:** The abstract reports "a significant tendency for currencies to depreciate during local trading hours." In Table 2 (working paper) EUR/USD mid-quote annualised log returns are -0.084 in the EUR session and 0.100 in the USD session, both significant at 1%. After costs "most of these simple time-of-day trading strategies are not profitable", except EUR/USD, "profitable on average with Sharpe Ratios of 1.3 and 0.9 respectively for the morning short and afternoon long."
- **Later evidence:** Confirms Ranaldo (2009) on a different data set; Krohn, Mueller and Whelan (2024) later report a related intraday dollar pattern around fixes.
- **For us:** One of the few papers that reports cost-inclusive intraday FX results, and it shows most session rules lose money after spreads; the one survivor needs intraday EUR/USD data, so free daily data cannot test it.

### Transaction costs and liquidity

What trading currencies really costs, how to measure it with free data, and who pays more.

#### Karnaukh, Ranaldo and Soderlind (2015), Understanding FX Liquidity

*Review of Financial Studies 28(11), 3073-3108.* DOI [10.1093/rfs/hhv029](https://doi.org/10.1093/rfs/hhv029). Page we read: <https://ideas.repec.org/a/oup/rfinst/v28y2015i11p3073-3108..html> [@karnaukh2015]. Checked: full text.

- **Question:** Can FX liquidity be measured well with daily, freely available data, and what drives it?
- **Data:** Spot FX liquidity for a large cross-section of currencies from January 1991 to May 2012, benchmarked against EBS high-frequency data from January 2007 to May 2012.
- **Method:** Compares low-frequency liquidity measures built from daily data (bid-ask spreads, Corwin-Schultz high-low estimator and others) against a high-frequency effective-cost benchmark, then relates liquidity to funding constraints and global risk.
- **Main result:** The abstract says "FX liquidity can be accurately measured with daily and readily available data" and "FX liquidity declines with funding constraints and global risk." In the working paper, the correlation of average bid-ask spread levels with the high-frequency effective cost is 0.94, and the BA plus Corwin-Schultz combination has correlation "0.96 for levels and 0.84 for changes" over 2007-2012.
- **Later evidence:** Not known to us.
- **For us:** Directly useful: it supports estimating FX trading costs from free daily bid, ask, high and low data, which a small team needs to haircut any backtest.

#### Melvin, Pan and Wikstrom (2020), Retaining alpha: The effect of trade size and rebalancing frequency on FX strategy returns

*Journal of Financial Markets 51, 100545.* DOI [10.1016/j.finmar.2020.100545](https://doi.org/10.1016/j.finmar.2020.100545). Page we read: <https://www.ifo.de/DocDL/cesifo1_wp8143.pdf> [@melvin2020]. Checked: full text.

- **Question:** How much do realistic, size-dependent trading costs cut the returns of FX strategies, and does building costs into the portfolio help?
- **Data:** Full order books of the major electronic FX brokerages, sweep-to-fill costs for 1, 10 and 25 million USD trades, January 2, 2014 to March 22, 2018.
- **Method:** Computes costs by trade size, backtests momentum strategies with lookbacks from 1 to 259 days and a value strategy with daily or monthly rebalancing, with and without costs in the portfolio optimisation.
- **Main result:** The paper reports that "WM/R spreads range from 1.15 bps for EUR to 3.54 bps for NOK" and that WM/R spreads are larger than actual costs for 1 million USD trades but "for a larger trade size like $25 million, WM/R spreads understate the trading costs." It finds "a very fast strategy of trading on a few days returns is much too costly for even small portfolios" and post-cost momentum returns rise as the lookback is lengthened "out to about six months".
- **Later evidence:** Its finding that WM/R spreads overstate costs for small trades agrees with Menkhoff et al. (2012) and Gargano et al. (2019), as the paper itself notes.
- **For us:** Very relevant: a small team trades small sizes, so WM/R-style daily spreads are a conservative cost estimate, and fast daily-signal strategies are the ones costs kill first.

#### Hau et al. (2021), Discriminatory Pricing of Over-the-Counter Derivatives

*Management Science 67(11), 6660-6677.* DOI [10.1287/mnsc.2020.3787](https://doi.org/10.1287/mnsc.2020.3787). Page we read: <https://ideas.repec.org/a/inm/ormnsc/v67y2021i11p6660-6677.html> [@hau2021]. Checked: abstract page only.

- **Question:** Do dealers charge less sophisticated non-financial clients more for FX derivatives?
- **Data:** New regulatory transaction data on foreign exchange derivatives traded by non-financial clients (details and period not seen in the abstract).
- **Method:** Measures effective spreads per trade and relates them to measures of client sophistication, trading venue (electronic multi-dealer platforms versus bilateral) and market conditions.
- **Main result:** The abstract says "The median client pays 10.9 pips more than blue-chip companies because of its lower level of sophistication, which compares with a sample average effective spread of 6.9 pips." It adds that "price discrimination is fully eliminated when clients trade electronically on multidealer platforms."
- **Later evidence:** Not known to us.
- **For us:** Shows that small clients can pay far more than quoted interbank spreads in FX forwards, so a small team should use pessimistic cost assumptions or trade on competitive electronic venues.

#### Ramadorai (2008), What determines transaction costs in foreign exchange markets?

*International Journal of Finance and Economics 13(1), 14-25.* DOI [10.1002/ijfe.351](https://doi.org/10.1002/ijfe.351). Page we read: <https://ideas.repec.org/a/ijf/ijfiec/v13y2008i1p14-25.html> [@ramadorai2008]. Checked: abstract page only.

- **Question:** Why do some institutional funds pay lower FX transaction costs than others?
- **Data:** Detailed currency transactions of institutional fund managers (sample period not seen in the abstract).
- **Method:** Relates funds' FX transaction costs to their currency returns in the cross section and over time, and to fund size, trade frequency and return volatility.
- **Main result:** The abstract says "funds that experience high returns on their currency holdings also incur lower transaction costs on their currency trades", both in the cross section and in time series, where "funds that do better over the past two months incur lower transaction costs on subsequent transactions." No numbers were visible in the abstract.
- **Later evidence:** Not known to us.
- **For us:** Reminds a small team that real costs depend on who you are, so retail costs may be higher than the interbank spreads used in many backtests.

#### Cespa et al. (2022), Foreign Exchange Volume

*Review of Financial Studies 35(5), 2386-2427.* DOI [10.1093/rfs/hhab095](https://doi.org/10.1093/rfs/hhab095). Page we read: <https://openaccess.city.ac.uk/id/eprint/26188/1/DP16128.pdf> [@cespa2022]. Checked: full text.

- **Question:** Does FX trading volume help predict next-day currency returns?
- **Data:** Daily CLS settlement volume for 31 currency pairs across 17 currencies, November 2011 to December 2017, with WM/Reuters spot and one-week forward rates; Olsen and Dukascopy spreads for costs.
- **Method:** Daily conditional 3x3 double sort on previous-day return then abnormal volume, forming reversal portfolios within low- and high-volume groups, plus a time-series version; evaluated out of sample with and without bid-ask costs.
- **Main result:** The cross-sectional low-volume reversal portfolio earns "an annualized return of 17.6% and a Sharpe ratio of 1.7", versus a 0.34 Sharpe for the high-volume version. After Olsen spreads "the net return is still high (10%)" and "the Sharpe ratio remains over 0.90". The time-series version earns "6.9% but an equally high Sharpe ratio of 1.7" before costs.
- **Later evidence:** Not known to us; the paper itself reports a Sharpe of just over one using Thomson Reuters volume for 13 pairs in 2011-2015.
- **For us:** One of the few daily FX strategies with a Sharpe near 1 after costs, but it needs CLS volume data, which is not free; daily prices are free but the volume signal is not.

### Machine learning with leakage controls

Whether flexible models forecast exchange rates or markets out of sample, and why finance is a hard place for them.

#### Colombo and Pelagatti (2020), Statistical learning and exchange rate forecasting

*International Journal of Forecasting 36(4), 1260-1289.* DOI [10.1016/j.ijforecast.2019.12.007](https://doi.org/10.1016/j.ijforecast.2019.12.007). Page we read: <https://ideas.repec.org/a/eee/intfor/v36y2020i4p1260-1289.html> [@colombo2020]. Checked: abstract page only.

- **Question:** Can statistical learning (machine learning) methods applied to standard exchange rate models beat the random walk at short and long horizons?
- **Data:** Exchange rates and macro fundamentals for several countries; the abstract does not give the exact currencies, frequency or sample period.
- **Method:** Applies statistical learning tools to standard fundamentals-based exchange rate models (including monetary models) and compares forecasts with a random walk at several horizons, then uses variable-importance measures to interpret the fitted models.
- **Main result:** The abstract says "statistical learning methods deliver remarkably good performance, outperforming the random walk in forecasting the exchange rate at different forecasting horizons, with the exception of the very short term (a period of one to two months)." Results "were robust across countries, time, and models", and "sticky price versions of the monetary model with an error correction specification delivered the best performance." The abstract gives no accuracy numbers.
- **Later evidence:** Not known to us.
- **For us:** It suggests machine learning on fundamentals may help at multi-month horizons but not at the one to two month horizon, which is where a small, cost-sensitive FX strategy would usually trade; macro fundamentals are monthly and partly free.

#### Israel, Kelly and Moskowitz (2020), Can Machines 'Learn' Finance?

*Journal of Investment Management 18(2), 23-36.* DOI [10.2139/ssrn.3624052](https://doi.org/10.2139/ssrn.3624052). Page we read: <https://www.aqr.com/Insights/Research/Journal-Article/Can-Machines-Learn-Finance> [@israel2020]. Checked: full text.

- **Question:** Why is machine learning harder in asset management than in other fields, and where can it still help?
- **Data:** Illustrations use US data, e.g. CRSP value-weighted market returns and Shiller CAPE 1926-2018 and the Fama-French 100 size and value portfolios 1927-2019.
- **Method:** A non-technical essay with simple illustrative regressions on small data, low signal-to-noise and changing markets.
- **Main result:** They write that "return prediction" "is a small data problem" and that low signal-to-noise is inherent. In their CAPE example the in-sample R2 rises from 0.5% at one month to 29.6% at five years, but a five-year model "only has 19 distinct return observations to learn from!" They also report "a 71% average pairwise correlation" among the Fama-French 100 portfolios.
- **Later evidence:** Not applicable (an essay); not known to us.
- **For us:** A clear warning that a few decades of daily FX data is still small data for machine learning, so a small team should prefer simple, economically motivated rules and strict out-of-sample tests.

#### Kelly, Malamud and Zhou (2024), The Virtue of Complexity in Return Prediction

*Journal of Finance 79(1), 459-503.* DOI [10.1111/jofi.13298](https://doi.org/10.1111/jofi.13298). Page we read: <https://ideas.repec.org/a/bla/jfinan/v79y2024i1p459-503.html> [@kelly2024]. Checked: full text.

- **Question:** Do highly parameterized ('complex') models, with more parameters than observations, predict market returns better than simple models?
- **Data:** US equity market (CRSP value-weighted) monthly returns, 1926-2020, with 15 predictors from Goyal and Welch (2008).
- **Method:** Theory for ridge regression with many random nonlinear features, then an empirical market-timing test using random Fourier features (up to P = 12,000) built from the 15 predictors, trained on rolling windows of 12, 60 or 120 months.
- **Main result:** The abstract says "simple models severely understate return predictability compared to 'complex' models in which the number of parameters exceeds the number of observations." In the NBER version: "Over the standard CRSP sample 1926-2020, out-of-sample market timing Sharpe ratio improvements (relative to market buy-and-hold) reach roughly 0.47 per annum with t-statistics near 3.0." The paper also notes out-of-sample R2 can be very negative even when the timing strategy is valuable.
- **Later evidence:** Not checked by us. We know later work has questioned where the gains come from, but we have not read it yet.
- **For us:** It is the main argument that heavy machine learning can help with tiny samples, which also makes it a prime overfitting risk for a small team; it is about the US stock market, not FX, so any FX use would be an untested transfer.

### Replication and decay of anomalies

What happens to published trading signals after publication, after costs and before the sample the authors used.

#### Chordia, Subrahmanyam and Tong (2014), Have capital market anomalies attenuated in the recent era of high liquidity and trading activity?

*Journal of Accounting and Economics 58(1), 41-58.* DOI [10.1016/j.jacceco.2014.06.001](https://doi.org/10.1016/j.jacceco.2014.06.001). Page we read: <https://ideas.repec.org/a/eee/jaecon/v58y2014i1p41-58.html> [@chordia2014]. Checked: abstract page only.

- **Question:** Did well known US stock anomalies weaken after liquidity and trading activity rose (around decimalization)?
- **Data:** US equities; prominent return anomalies before and after decimalization (exact sample not seen in the abstract).
- **Method:** Compares anomaly returns before and after decimalization and relates the decline to hedge fund assets, short interest and share turnover.
- **Main result:** The abstract says "the majority of the anomalies have attenuated and the average returns from a portfolio strategy based on prominent anomalies have approximately halved after decimalization." It links the decline to "hedge fund assets under management, short interest and aggregate share turnover".
- **Later evidence:** Consistent with McLean and Pontiff (2016) on post-publication decay, though we did not re-read that paper here.
- **For us:** Expect any published edge, including FX ones, to be weaker today than in its original sample; test on recent years separately.

#### Linnainmaa and Roberts (2018), The History of the Cross-Section of Stock Returns

*Review of Financial Studies 31(7), 2606-2649.* DOI [10.1093/rfs/hhy030](https://doi.org/10.1093/rfs/hhy030). Page we read: <https://www.nber.org/papers/w22894> [@linnainmaa2018]. Checked: full text.

- **Question:** Do accounting-based stock anomalies hold up in hand-collected data from before their original samples?
- **Data:** US stocks with hand-collected accounting data back to the early 20th century; 36 anomalies; monthly.
- **Method:** Tests anomalies out-of-sample by going backward (pre-1963) and forward (post-discovery) in time.
- **Main result:** Abstract: "most accounting-based return anomalies are spurious" and "The data-snooping problem is so severe that even the true asset pricing model is expected to be rejected when tested using in-sample data." The average in-sample anomaly earns a CAPM alpha of "32 basis points per month (t-value = 10.87)" versus "13 basis points (t-value = 4.42)" pre-discovery and "14 basis points (t-value = 4.06)" post-discovery; "Just eight out of the 36" are significant pre-1963.
- **Later evidence:** Not known to us from this session.
- **For us:** Suggests halving in-sample results as a rough prior and always holding out a sample the strategy was never tuned on.

#### Novy-Marx and Velikov (2016), A Taxonomy of Anomalies and Their Trading Costs

*Review of Financial Studies 29(1), 104-147.* DOI [10.1093/rfs/hhv063](https://doi.org/10.1093/rfs/hhv063). Page we read: <https://www.nber.org/papers/w20721> [@novymarx2016]. Checked: full text.

- **Question:** How much of the profit of well known stock anomalies survives realistic trading costs, and which cost-cutting tricks work best?
- **Data:** US equities, a large set of anomaly strategies, monthly, using estimated effective spreads (sample period not recorded in our notes).
- **Method:** Estimates trading costs for each anomaly, groups anomalies by turnover, and tests cost-mitigation rules such as a buy/hold spread.
- **Main result:** Abstract: a buy/hold spread "is the single most effective simple cost mitigation strategy", and "Most of the anomalies that we consider with one-sided monthly turnover lower than 50% continue to generate statistically significant net spreads" while "Few of the strategies with higher turnover do." The paper says costs cut spreads by more than 1% of monthly one-sided turnover, "if the long side of a strategy turns over 20% per month, the realized long/short spread will be at least 20 bps per month lower".
- **Later evidence:** Not known to us from this session.
- **For us:** Turnover is the cost driver; an FX strategy that trades often must clear its costs, and a no-trade band (buy/hold spread) is a cheap fix to test.

#### Qi and Wu (2006), Technical Trading-Rule Profitability, Data Snooping, and Reality Check: Evidence from the Foreign Exchange Market

*Journal of Money, Credit, and Banking 38(8), 2135-2158.* DOI [10.1353/mcb.2007.0006](https://doi.org/10.1353/mcb.2007.0006). Page we read: <https://api.openalex.org/works/doi:10.1353/mcb.2007.0006> [@qi2006]. Checked: not read: Seen only as an OpenAlex record with the abstract; the publisher page did not load..

- **Question:** Are technical trading rules in FX still profitable after adjusting for data snooping with White's Reality Check?
- **Data:** Major exchange rates and cross rates (exact currencies, frequency and sample not in the abstract).
- **Method:** Tests 2,127 technical trading rules and applies White (2000) Reality Check, full sample and sub-samples.
- **Main result:** The abstract says "The best rules are found to be significantly profitable based on standard tests" among "2,127 technical trading rules", and "data-snooping biases do not change the basic conclusions for the full sample." But "the data-snooping problem is more serious in the second half of the sample" and "Profitability becomes much weaker in the more recent period".
- **Later evidence:** Consistent with the decay story in Chordia, Subrahmanyam and Tong (2014) for stocks; we did not check later FX replications here.
- **For us:** The most direct evidence here that FX technical rules faded over time, so a small team should expect weak results on recent data.

### Backtest overfitting and data snooping

Statistical tools for asking whether the best of many backtests is better than luck.

#### White (2000), A Reality Check for Data Snooping

*Econometrica 68(5), 1097-1126.* DOI [10.1111/1468-0262.00152](https://doi.org/10.1111/1468-0262.00152). Page we read: <https://www.econometricsociety.org/publications/econometrica/2000/09/01/reality-check-data-snooping> [@white2000]. Checked: abstract page only.

- **Question:** How can we test whether the best model found in a specification search truly beats a benchmark, rather than winning by chance?
- **Data:** Methodological; the abstract does not describe an application.
- **Method:** A bootstrap test (the 'Reality Check') of the null that the best of many models has no predictive superiority over a benchmark.
- **Main result:** The abstract says data snooping "is practically unavoidable in the analysis of time-series data" and is "endemic". It offers "a straightforward procedure for testing the null hypothesis that the best model encountered in a specification search has no predictive superiority over a given benchmark model." No numbers in the abstract.
- **Later evidence:** Refined by Hansen (2005) (more power, studentized) and Romano and Wolf (2005) (stepwise), both read in this batch.
- **For us:** Lets us test 'best FX rule vs buy-and-hold S&P 500' while counting every rule we tried; easy to run on free daily data.

#### Sullivan, Timmermann and White (1999), Data-Snooping, Technical Trading Rule Performance, and the Bootstrap

*Journal of Finance 54(5), 1647-1691.* DOI [10.1111/0022-1082.00163](https://doi.org/10.1111/0022-1082.00163). Page we read: <https://ideas.repec.org/a/bla/jfinan/v54y1999i5p1647-1691.html> [@sullivan1999]. Checked: abstract page only.

- **Question:** Do simple technical trading rules on the Dow still look profitable after adjusting for searching across a whole universe of rules?
- **Data:** 100 years of daily Dow Jones Industrial Average data.
- **Method:** Applies White's Reality Check bootstrap to an expanded universe of the Brock, Lakonishok and LeBaron (1992) 26 rules.
- **Main result:** The abstract says the paper "presents a complete test of performance across all technical trading rules examined" and applies the rules "to 100 years of daily data on the Dow Jones Industrial Average". The abstract on the page we read gives no Sharpe or return figures.
- **Later evidence:** Qi and Wu (2006) applied the same Reality Check approach to FX (read in this batch).
- **For us:** The template for testing many technical FX rules honestly with free daily data.

#### Hansen (2005), A Test for Superior Predictive Ability

*Journal of Business and Economic Statistics 23(4), 365-380.* DOI [10.1198/073500105000000063](https://doi.org/10.1198/073500105000000063). Page we read: <https://cdr.lib.unc.edu/downloads/zp38wf793> [@hansen2005]. Checked: full text.

- **Question:** Can the Reality Check be made more powerful and less sensitive to poor or irrelevant alternative models?
- **Data:** Monte Carlo plus an application to forecasts of annual US inflation evaluated over n = 160 quarters (1952-2000).
- **Method:** A studentized test statistic with a sample-dependent null distribution (the SPA test); in the application 3,303 regression models with 32-quarter rolling windows are compared with a random-walk forecast using mean absolute error.
- **Main result:** The abstract says the test "is more powerful and less sensitive to poor and irrelevant alternatives" than the Reality Check. In the inflation application "The random-walk forecast is found to be inferior to regression-based forecasts" and "the best sample performance is achieved by models that have a Phillips curve structure."
- **Later evidence:** Widely used as the standard upgrade to White (2000); we did not check specific replications.
- **For us:** Use SPA rather than the plain Reality Check, so that many bad FX variants in our search do not hide a good one.

#### Romano and Wolf (2005), Stepwise Multiple Testing as Formalized Data Snooping

*Econometrica 73(4), 1237-1282.* DOI [10.1111/j.1468-0262.2005.00615.x](https://doi.org/10.1111/j.1468-0262.2005.00615.x). Page we read: <https://ideas.repec.org/a/ecm/emetrp/v73y2005i4p1237-1282.html> [@romano2005]. Checked: abstract page only.

- **Question:** How can we tell which of many strategies beat a common benchmark while controlling the chance of any false discovery?
- **Data:** Simulations plus one real-data application (not described in the abstract).
- **Method:** A stepwise bootstrap procedure, with studentization, that controls the familywise error rate and captures dependence among test statistics.
- **Main result:** The abstract says the procedure "asymptotically controls the familywise error rate" and "is more powerful and often will reject more false hypotheses" than single-step methods. It is "presented in the context of comparing several strategies to a common benchmark." No numbers in the abstract.
- **Later evidence:** Not known to us.
- **For us:** Tells us which individual FX rules (not just the best one) beat the S&P 500 benchmark after accounting for the search.

#### Harvey and Liu (2015), Backtesting

*Journal of Portfolio Management 42(1), 13-28.* DOI [10.3905/jpm.2015.42.1.013](https://doi.org/10.3905/jpm.2015.42.1.013). Page we read: <https://people.duke.edu/~charvey/Research/Published_Papers/P120_Backtesting.PDF> [@harvey2015a]. Checked: full text.

- **Question:** How much should a backtested Sharpe ratio be discounted for the number of strategies tried?
- **Data:** Illustrative examples (e.g. E/P, momentum and betting-against-beta strategies) plus simulated settings; not a new data set.
- **Method:** Converts a Sharpe ratio to a t-ratio and p-value, adjusts the p-value for multiple testing (Bonferroni, Holm, BHY), and converts back to a 'haircut' Sharpe ratio.
- **Main result:** They argue "it is a serious mistake to use the usual 50% haircut" and that "the multiple testing haircut is nonlinear." The haircut "is almost always more than and sometimes much larger than 50% when the annualized Sharpe ratio is less than 0.4", while "when the Sharpe ratio is greater than 1.0, the haircut is at most 25%." In one example under BHY "the adjusted, annualized Sharpe ratio is 0.438 and the associated haircut is 52.0%".
- **Later evidence:** Extended by Harvey, Liu and Zhu (2016) and Arnott, Harvey and Markowitz (2019) on backtest protocols (seen on Harvey's paper list, not re-read).
- **For us:** Gives a direct way to shrink the Sharpe ratio of any FX rule we pick after trying many variants before comparing it with the S&P 500.

#### Baz et al. (2015), Dissecting Investment Strategies in the Cross Section and Time Series

*SSRN Working Paper 2695101.* DOI [10.2139/ssrn.2695101](https://doi.org/10.2139/ssrn.2695101). Page we read: <https://doi.org/10.2139/ssrn.2695101> [@baz2015]. Checked: not read: Title and authors were seen on Campbell Harvey's research page and in Crossref, but SSRN returned 403 and no abstract or full text was found, so no content is recorded..

- **Why it is here:** If it can be read, it may help separate cross-sectional (carry-style) and time-series (trend-style) versions of the same FX signal; for now it is unverified.
- **What we know:** only the title and journal. We report no results for it.

### FX next to equities

Our real question is whether FX helps an investor who could just hold the S&P 500. These papers look at currencies as hedges and diversifiers for equity holders.

#### Campbell, Serfaty-de Medeiros and Viceira (2010), Global Currency Hedging

*Journal of Finance 65(1), 87-121.* DOI [10.1111/j.1540-6261.2009.01524.x](https://doi.org/10.1111/j.1540-6261.2009.01524.x). Page we read: <https://ideas.repec.org/a/bla/jfinan/v65y2010i1p87-121.html> [@campbell2010]. Checked: full text.

- **Question:** Which currencies should a risk-minimizing global equity or bond investor hold or hedge?
- **Data:** Seven currencies (USD, EUR, JPY, CHF, GBP, CAD, AUD) with equity and bond returns, 1975 to 2005.
- **Method:** Mean-variance risk-minimizing currency positions for global stock and bond portfolios, with tests of whether interest differentials should change those positions.
- **Main result:** The US dollar, euro and Swiss franc "moved against world equity markets", so they "should be attractive to risk-minimizing global equity investors despite their low average returns". For bond investors the risk-minimizing strategy "is close to a full currency hedge, with a modest long position in the US dollar", and there is "little evidence" positions should respond to interest differentials. The abstract gives no headline numbers.
- **Later evidence:** Opie and Riddiough (2020) build on this and propose a dynamic hedge they say beats leading alternatives.
- **For us:** Directly about equity-vs-FX diversification: safe-haven currencies (USD, CHF, EUR) hedge stock risk, which a small team can check with free daily data.

#### Opie and Riddiough (2020), Global currency hedging with common risk factors

*Journal of Financial Economics 136(3), 780-805.* DOI [10.1016/j.jfineco.2019.12.001](https://doi.org/10.1016/j.jfineco.2019.12.001). Page we read: <https://ideas.repec.org/a/eee/jfinec/v136y2020i3p780-805.html> [@opie2020]. Checked: abstract page only.

- **Question:** Can predictable currency returns from global factors be used to hedge FX exposure in international stock and bond portfolios?
- **Data:** Currency returns and international equity and bond portfolios with global factor returns (sample not seen, abstract only).
- **Method:** A dynamic hedging rule that uses a forecastable component of global factor returns to predict currency returns, compared with standard hedging approaches.
- **Main result:** The abstract says the hedging strategy "outperforms leading alternative approaches to currency hedging across a large set of performance metrics". A stand-alone currency portfolio using the same predictability "delivers a high risk-adjusted return and provides superior diversification gains to global equity and bond investors relative to currency carry, value, and momentum". No numbers in the abstract.
- **Later evidence:** Not known to us.
- **For us:** Most directly about FX as a diversifier for equity investors, but we could not see its Sharpe ratios, so its claims need checking before relying on them.

#### Pojarliev and Levich (2008), Do Professional Currency Managers Beat the Benchmark?

*Financial Analysts Journal 64(5), 18-32.* DOI [10.2469/faj.v64.n5.4](https://doi.org/10.2469/faj.v64.n5.4). Page we read: <https://ideas.repec.org/a/taf/ufajxx/v64y2008i5p18-32.html> [@pojarliev2008]. Checked: full text.

- **Question:** Do currency fund managers earn alpha after accounting for carry, trend, value and volatility factors?
- **Data:** A currency manager index (BCTI) and 34 individual currency managers, monthly, 1990-2006.
- **Method:** Regress manager excess returns on four style factors (carry, trend, value, volatility) and treat only the unexplained part as alpha.
- **Main result:** Managers earned "excess returns averaging 25 bps per month" over 1990-2006. In the NBER version, after the four factors index "alpha was -9 bps per month or about -1.1% per year over the 204 month period", with 34 bps of factor return made up of "10 bps attributed to carry ... 27 bps to trend, -3 bps to value and 0 bps to volatility". Still, "some currency fund managers still generate alpha returns".
- **Later evidence:** Not known to us.
- **For us:** Suggests professional FX returns were mostly simple trend and carry, which a small team could copy cheaply; it also shows how thin true alpha is.

#### Lilley et al. (2022), Exchange Rate Reconnect

*Review of Economics and Statistics 104(4), 845-855.* DOI [10.1162/rest_a_00978](https://doi.org/10.1162/rest_a_00978). Page we read: <https://ideas.repec.org/a/tpr/restat/v104y2022i4p845-855.html> [@lilley2022]. Checked: full text.

- **Question:** Did exchange rates start co-moving with global risk appetite and US capital flows after 2007?
- **Data:** Major currencies and the broad US dollar, proxies for global risk appetite, and US purchases of foreign bonds, monthly and quarterly, before and after 2007 up to about 2018.
- **Method:** Rolling regressions of exchange rate changes on risk proxies and US foreign bond flows, plus security-level US portfolio data.
- **Main result:** Risk appetite proxies "which did not co-move with exchange rates prior to 2007, have provided significant in-sample explanatory power for currencies since then". US foreign bond purchases "explain as much as half of the quarterly variation in the US dollar during 2007-2012". The NBER version says the 5-year rolling R2 peaked "above 50 percent" for 2007-2012 and "returns to a near-zero level for 2013-2018".
- **Later evidence:** Not known to us.
- **For us:** Shows the dollar's link to stock market risk appetite is unstable over time, which matters for whether an FX strategy actually diversifies an S&P 500 holding.

## What this means for us

Tests we can run with free daily or monthly data, roughly in order of cost:

| Idea | Paper | Data we would need | Catalog entry |
| --- | --- | --- | --- |
| Static carry | Hassan and Mano (2019) | Interest rates and spot rates | [ALG-0073](../algorithms/0073-fx-static-carry.md) |
| Good carry with a rolling exclusion rule | Bekaert and Panayotov (2020) | G10 forwards | [ALG-0077](../algorithms/0077-fx-good-carry-g10.md) |
| Global imbalances | Della Corte, Riddiough and Sarno (2016) | Yearly external balance sheets, lagged by their publication date | [ALG-0075](../algorithms/0075-fx-global-imbalances.md) |
| Commodity trade structure | Ready, Roussanov and Ward (2017) | Yearly trade data | [ALG-0076](../algorithms/0076-fx-commodity-trade-imx.md) |
| Output gaps | Colacito, Riddiough and Sarno (2020) | Vintage industrial production | [ALG-0074](../algorithms/0074-fx-output-gap-business-cycle.md) |
| Complex ridge market timing | Kelly, Malamud and Zhou (2024) | Goyal-Welch predictors | [ALG-0082](../algorithms/0082-complex-ml-market-timing.md) |

Out of reach without paid data or intraday quotes: [option-hedged carry](../algorithms/0078-fx-option-hedged-carry.md), the [local trading hours effect](../algorithms/0079-fx-local-hours-time-of-day.md), [low-volume reversal](../algorithms/0080-fx-low-volume-reversal.md) and [asymmetric information risk](../algorithms/0081-fx-asymmetric-information-risk.md).

Three lessons for how we test:

1. **Use a better data-snooping test.** Hansen's (2005) test and Romano and Wolf's (2005) stepwise test compare many strategies with one benchmark, which is exactly our setup.
2. **Cost the trades properly.** Karnaukh, Ranaldo and Soderlind (2015) show daily bid-ask quotes track true costs closely (correlation 0.94 in levels), so we can build a better cost model from free data. Melvin, Pan and Wikstrom (2020) warn that WM/R spreads understate costs for large trades.
3. **Avoid the fix and the session edges.** Evans (2018), Ito and Yamada (2017) and Krohn, Mueller and Whelan (2024) all find prices swing and reverse around the daily fixes, so daily prices taken at a fix contain noise that a backtest can mistake for signal.

## What we could not verify

- Payne (2003), Informed trade in spot foreign exchange markets: an empirical investigation: Title, journal, volume and pages confirmed on IDEAS/RePEc and via Crossref, but IDEAS says 'No abstract is available for this item', ScienceDirect returned 403, Unpaywall and OpenAlex list no open copy, and the Bristol repository page showed no abstract. Web search budget was exhausted so no other host could be found. Nothing below is taken from the paper itself.
- Qi and Wu (2006), Technical Trading-Rule Profitability, Data Snooping, and Reality Check: Evidence from the Foreign Exchange Market: Seen only as an OpenAlex record with the abstract; the publisher page did not load.
- Baz et al. (2015), Dissecting Investment Strategies in the Cross Section and Time Series: Title and authors were seen on Campbell Harvey's research page and in Crossref, but SSRN returned 403 and no abstract or full text was found, so no content is recorded.
- Abstract only, so no table numbers: Jurek (2014), Bakshi and Panayotov (2013), Doskov and Swinkels (2015), Londono and Zhou (2017), Farhi and Gabaix (2016), Bansal and Dahlquist (2000), Okunev and White (2003), Raza, Marshall and Visaltanachoti (2014), Orlov (2016), Filippou, Gozluklu and Taylor (2018), Ranaldo and Rossi (2010), Melvin and Shand (2017), Opie and Riddiough (2020), Chaboud et al. (2014), Cartea, Jaimungal and Walton (2019), Hasbrouck and Levich (2021), Krohn, Mueller and Whelan (2024), Ranaldo (2009), Andersen and Bollerslev (1998), Ramadorai (2008), Hau et al. (2021), Colombo and Pelagatti (2020), Chordia, Subrahmanyam and Tong (2014), White (2000), Sullivan, Timmermann and White (1999), Romano and Wolf (2005).
- Working paper versions: where we read an NBER, SSRN or university working paper, the published numbers may differ slightly. Each entry names the page we read.
- Later evidence: for most papers we did not find an independent replication. That means we did not find one, not that none exists.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@doskov2015](../REFERENCES.md#doskov2015): Doskov and Swinkels (2015), Empirical evidence on the currency carry trade, 1900-2012
- [@bekaert2020](../REFERENCES.md#bekaert2020): Bekaert and Panayotov (2020), Good Carry, Bad Carry
- [@hassan2019](../REFERENCES.md#hassan2019): Hassan and Mano (2019), Forward and Spot Exchange Rates in a Multi-Currency World
- [@lustig2019](../REFERENCES.md#lustig2019): Lustig et al. (2019), The Term Structure of Currency Carry Trade Risk Premia
- [@bansal2000](../REFERENCES.md#bansal2000): Bansal and Dahlquist (2000), The forward premium puzzle: different tales from developed and emerging economies
- [@lettau2014](../REFERENCES.md#lettau2014): Lettau et al. (2014), Conditional risk premia in currency markets and other asset classes
- [@bakshi2013](../REFERENCES.md#bakshi2013): Bakshi and Panayotov (2013), Predictability of currency carry trades and asset pricing implications
- [@melvin2017](../REFERENCES.md#melvin2017): Melvin and Shand (2017), When Carry Goes Bad: The Magnitude, Causes, and Duration of Currency Carry Unwinds
- [@jurek2014](../REFERENCES.md#jurek2014): Jurek (2014), Crash-neutral currency carry trades
- [@caballero2012](../REFERENCES.md#caballero2012): Caballero and Doyle (2012), Carry Trade and Systemic Risk: Why are FX Options so Cheap?
- [@farhi2016](../REFERENCES.md#farhi2016): Farhi and Gabaix (2016), Rare Disasters and Exchange Rates
- [@londono2017](../REFERENCES.md#londono2017): Londono and Zhou (2017), Variance risk premiums and the forward premium puzzle
- [@dellacorte2016b](../REFERENCES.md#dellacorte2016b): Della Corte et al. (2016), Currency Premia and Global Imbalances
- [@colacito2020](../REFERENCES.md#colacito2020): Colacito et al. (2020), Business cycles and currency returns
- [@ready2017](../REFERENCES.md#ready2017): Ready et al. (2017), Commodity Trade and the Carry Trade: A Tale of Two Countries
- [@okunev2003](../REFERENCES.md#okunev2003): Okunev and White (2003), Do Momentum-Based Strategies Still Work in Foreign Currency Markets?
- [@accominotti2016](../REFERENCES.md#accominotti2016): Accominotti and Chambers (2016), If You're So Smart: John Maynard Keynes and Currency Speculation in the Interwar Years
- [@raza2014](../REFERENCES.md#raza2014): Raza et al. (2014), Is there momentum or reversal in weekly currency returns?
- [@orlov2016](../REFERENCES.md#orlov2016): Orlov (2016), Currency momentum, carry trade, and market illiquidity
- [@filippou2018](../REFERENCES.md#filippou2018): Filippou et al. (2018), Global Political Risk and Currency Momentum
- [@kearns2006](../REFERENCES.md#kearns2006): Kearns and Manners (2006), The Impact of Monetary Policy on the Exchange Rate: A Study Using Intraday Data
- [@ranaldo2010a](../REFERENCES.md#ranaldo2010a): Ranaldo and Rossi (2010), The reaction of asset markets to Swiss National Bank communication
- [@inoue2019](../REFERENCES.md#inoue2019): Inoue and Rossi (2019), The effects of conventional and unconventional monetary policy on exchange rates
- [@king2012](../REFERENCES.md#king2012): King et al. (2012), Foreign Exchange Market Structure, Players, and Evolution
- [@payne2003](../REFERENCES.md#payne2003): Payne (2003), Informed trade in spot foreign exchange markets: an empirical investigation
- [@rime2010](../REFERENCES.md#rime2010): Rime et al. (2010), Exchange rate forecasting, order flow and macroeconomic information
- [@osler2003](../REFERENCES.md#osler2003): Osler (2003), Currency Orders and Exchange Rate Dynamics: An Explanation for the Predictive Success of Technical Analysis
- [@chaboud2014](../REFERENCES.md#chaboud2014): Chaboud et al. (2014), Rise of the Machines: Algorithmic Trading in the Foreign Exchange Market
- [@mancini2013](../REFERENCES.md#mancini2013): Mancini et al. (2013), Liquidity in the Foreign Exchange Market: Measurement, Commonality, and Risk Premiums
- [@ranaldo2021](../REFERENCES.md#ranaldo2021): Ranaldo and Somogyi (2021), Asymmetric information risk in FX markets
- [@hasbrouck2021](../REFERENCES.md#hasbrouck2021): Hasbrouck and Levich (2021), Network structure and pricing in the FX market
- [@oomen2017](../REFERENCES.md#oomen2017): Oomen (2017), Last look
- [@cartea2019](../REFERENCES.md#cartea2019): Cartea et al. (2019), Foreign exchange markets with Last Look
- [@evans2018](../REFERENCES.md#evans2018): Evans (2018), Forex trading and the WMR Fix
- [@ito2017](../REFERENCES.md#ito2017): Ito and Yamada (2017), Puzzles in the Tokyo fixing in the forex market: Order imbalances and Bank pricing
- [@krohn2024](../REFERENCES.md#krohn2024): Krohn et al. (2024), Foreign Exchange Fixings and Returns around the Clock
- [@andersen1998](../REFERENCES.md#andersen1998): Andersen and Bollerslev (1998), Deutsche Mark-Dollar Volatility: Intraday Activity Patterns, Macroeconomic Announcements, and Longer Run Dependencies
- [@ranaldo2009](../REFERENCES.md#ranaldo2009): Ranaldo (2009), Segmentation and time-of-day patterns in foreign exchange markets
- [@breedon2013](../REFERENCES.md#breedon2013): Breedon and Ranaldo (2013), Intraday Patterns in FX Returns and Order Flow
- [@karnaukh2015](../REFERENCES.md#karnaukh2015): Karnaukh et al. (2015), Understanding FX Liquidity
- [@melvin2020](../REFERENCES.md#melvin2020): Melvin et al. (2020), Retaining alpha: The effect of trade size and rebalancing frequency on FX strategy returns
- [@hau2021](../REFERENCES.md#hau2021): Hau et al. (2021), Discriminatory Pricing of Over-the-Counter Derivatives
- [@ramadorai2008](../REFERENCES.md#ramadorai2008): Ramadorai (2008), What determines transaction costs in foreign exchange markets?
- [@cespa2022](../REFERENCES.md#cespa2022): Cespa et al. (2022), Foreign Exchange Volume
- [@colombo2020](../REFERENCES.md#colombo2020): Colombo and Pelagatti (2020), Statistical learning and exchange rate forecasting
- [@israel2020](../REFERENCES.md#israel2020): Israel et al. (2020), Can Machines 'Learn' Finance?
- [@kelly2024](../REFERENCES.md#kelly2024): Kelly et al. (2024), The Virtue of Complexity in Return Prediction
- [@chordia2014](../REFERENCES.md#chordia2014): Chordia et al. (2014), Have capital market anomalies attenuated in the recent era of high liquidity and trading activity?
- [@linnainmaa2018](../REFERENCES.md#linnainmaa2018): Linnainmaa and Roberts (2018), The History of the Cross-Section of Stock Returns
- [@novymarx2016](../REFERENCES.md#novymarx2016): Novy-Marx and Velikov (2016), A Taxonomy of Anomalies and Their Trading Costs
- [@qi2006](../REFERENCES.md#qi2006): Qi and Wu (2006), Technical Trading-Rule Profitability, Data Snooping, and Reality Check: Evidence from the Foreign Exchange Market
- [@white2000](../REFERENCES.md#white2000): White (2000), A Reality Check for Data Snooping
- [@sullivan1999](../REFERENCES.md#sullivan1999): Sullivan et al. (1999), Data-Snooping, Technical Trading Rule Performance, and the Bootstrap
- [@hansen2005](../REFERENCES.md#hansen2005): Hansen (2005), A Test for Superior Predictive Ability
- [@romano2005](../REFERENCES.md#romano2005): Romano and Wolf (2005), Stepwise Multiple Testing as Formalized Data Snooping
- [@harvey2015a](../REFERENCES.md#harvey2015a): Harvey and Liu (2015), Backtesting
- [@baz2015](../REFERENCES.md#baz2015): Baz et al. (2015), Dissecting Investment Strategies in the Cross Section and Time Series
- [@campbell2010](../REFERENCES.md#campbell2010): Campbell et al. (2010), Global Currency Hedging
- [@opie2020](../REFERENCES.md#opie2020): Opie and Riddiough (2020), Global currency hedging with common risk factors
- [@pojarliev2008](../REFERENCES.md#pojarliev2008): Pojarliev and Levich (2008), Do Professional Currency Managers Beat the Benchmark?
- [@lilley2022](../REFERENCES.md#lilley2022): Lilley et al. (2022), Exchange Rate Reconnect

## Referenced by

- [INT-0002: Two products, a research and simulation platform and a public trading app](../intent/0002-two-products-a-research-and-simulation-platform-and-a-public-trading-app.md)
- [LOG-0005: Ayan work log, site rebuild, research expansion and sign-in](../log/2026-10-21-ayan-work-log-site-rebuild-research-expansion-and-sign-in.md)
<!-- backlinks:end -->
