---
id: RES-0011
title: Where market edges come from and which survive
type: research
status: current
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [carry, method, momentum, news, strategy]
related: [DEC-0009, DEC-0014, DEC-0026, REF-0003, RES-0009, RES-0010]
---

# Where market edges come from and which survive

## In plain words

An edge is a reason a trade should make money more often than luck allows. Real edges come from a few places: being paid to carry a risk others want to shed, other people being slow or forced to trade, or knowing something sooner. Most edges that were written up in papers got smaller once people read about them, and many vanish once you pay to trade. This page lists the best known ones, how strong the evidence is, and whether our own data can test each one.

## Summary

Gathered 2026-10-23, for the owner's request to "look into possible edges in the market, anything that could work or help others develop an edge". It covers 25 edges in four families, plus what kills edges. Every paper was checked against its Crossref record (authors, year, title, journal, volume, pages and DOI). Where we read only the registry record and not the abstract, we say so in [what we could not check](#what-we-could-not-check).

What the evidence says, in short:

- **Risk premia are the sturdiest edges.** Carry, trend, value and the bond term premium have worked across many markets and many decades. They are paid for a reason: they lose money in bad times. Expect Sharpe ratios of about 0.2 to 0.6 for each one alone, with sharp crashes.
- **Behavioural and flow edges are real but small and short.** Index changes, month-end cash needs, FX fixes and FOMC timing all left clear marks in prices. Most have shrunk since they were published, and several need intraday data or very cheap trading.
- **Information edges mostly belong to the fastest.** Macro news moves prices within minutes. A daily model cannot trade the surprise itself. It can only use slower economic trends, such as "economic momentum".
- **Publication costs about half.** Across 97 stock return predictors, returns were 26% lower out of sample and 58% lower after publication [@mclean2016]. Treat any paper's Sharpe ratio as an upper bound and plan for half.
- **Our data can test about half of the list directly.** The best fits are carry on the wider currency set (BIS policy rates for 32 currencies), Treasury curve and term premium signals, COT positioning, financial stress regimes and the FOMC and month-end calendar. Those are the families planned in [DEC-0026](../decisions/0026-new-edge-families-from-the-wider-data.md).

## How to read each edge

For each edge we give:

- **Evidence:** the key papers and their headline numbers.
- **Decay:** whether it shrank after it was published, and by how much if anyone measured it.
- **Capacity:** how much money it can absorb before trading moves the price against you. "Large" means index futures and major currencies. "Small" means it lives in small stocks or a few minutes a day.
- **Costs:** how sensitive it is to trading costs. Fast and frequent trading makes costs decide everything [@novymarx2016].
- **Our data:** yes, partly or no, and which series in [REF-0003](../reference/0003-data-sources.md). Every result is scored the way [DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md) sets out, and every variation counts against the luck check in [DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md).

## Risk premia: paid for taking a risk

These edges exist because someone pays to get rid of a risk. That is why they last. It is also why they lose money at the worst times.

### Carry

- **Evidence.** Carry is what you earn if prices do not move: the interest gap in currencies, the roll in futures, the yield in bonds. Koijen, Moskowitz, Pedersen and Vrugt (2018) find "carry predicts returns cross-sectionally and in time series" in equities, bonds, commodities, currencies and options [@koijen2018]. In currencies, a common "dollar" factor and a carry factor explain much of the cross section [@lustig2011]. High interest currencies lose money when global FX volatility jumps, which is why carry earns a premium [@menkhoff2012b]. Carry crashes come when traders unwind together [@brunnermeier2008]. Long samples give carry Sharpe ratios of 0.2 to 0.4 ([RES-0010](0010-paper-library-fx-and-market-microstructure.md#carry-and-the-dollar)).
- **Decay.** No sharp post-publication drop in FX carry, but long samples show lower returns than the 1990s and 2000s. The 2008 unwind took years to recover.
- **Capacity.** Large in G10 currencies. Smaller in emerging currencies, where capital controls and wide spreads bite.
- **Costs.** Low. Carry trades monthly or slower.
- **Our data: yes.** OECD 3-month interbank rates for G10 (monthly averages, and still used from the first of the month, an open look-ahead question in DEC-0014), BIS daily policy rates for 32 currencies, Fed H.10 and ECB reference FX. Caveat: a policy rate is not the rate a forward contract pays. For currencies with capital controls (CNY, INR, BRL) the real carry can differ by several points. See [ALG-0001](../algorithms/0001-fx-carry-g10.md) and [ALG-0073](../algorithms/0073-fx-static-carry.md).

### The bond term premium and curve roll-down

- **Evidence.** Long bonds usually pay more than rolling short bills. Fama and Bliss (1987) found the gap between forward and spot rates predicts excess returns on bonds over one to five years (*American Economic Review* 77(4), 680-692, <https://ideas.repec.org/a/aea/aecrev/v77y1987i4p680-92.html>) [@fama1987]. Cochrane and Piazzesi (2005) found one combination of forward rates predicts excess returns on bonds of all maturities [@cochrane2005]. Adrian, Crump and Moench (2013) give a widely used estimate of the term premium from simple regressions [@adrian2013]. Bond carry, which includes roll-down along the curve, also predicts returns [@koijen2018].
- **Decay.** The term premium itself has fallen a lot since the 1980s and was near or below zero for parts of the 2010s. Predictive regressions like Cochrane and Piazzesi are known to be sensitive to the sample and to small errors in the yield data, so the out-of-sample fit is much weaker than in the paper.
- **Capacity.** Very large. Treasury futures are among the deepest markets.
- **Costs.** Low.
- **Our data: yes.** Full US Treasury par curve from 1990, euro AAA curve from 2004, 2s10s and 3m10y spreads. We can build slope, curvature, roll-down and US against euro curve signals. We hold Treasury returns rebuilt from yields, not futures, which is an approximation.

### Value

- **Evidence.** Cheap assets beat expensive ones on average. Asness, Moskowitz and Pedersen (2013) find "consistent value and momentum return premia across eight diverse markets and asset classes", and that value and momentum are negatively correlated with each other [@asness2013]. That negative link is why a mix of the two is steadier than either.
- **Decay.** The stock value factor (HML) had a long losing run from about 2007 to 2020. Whether it is broken or just in a bad spell is disputed. Currency value (real exchange rates) is slow and weak on its own.
- **Capacity.** Large.
- **Costs.** Low to moderate. Value turns over slowly.
- **Our data: yes for stocks, partly for FX.** French HML factor; real effective exchange rates for a short list. See [ALG-0053](../algorithms/0053-value-hml.md) and [ALG-0017](../algorithms/0017-fx-value-ppp.md).

### Momentum and trend

- **Evidence.** Stocks that rose over the past 3 to 12 months kept rising [@jegadeesh1993]. Each market's own past return predicts its next one ("time series momentum") in all 58 futures and forwards tested, and "performs best during extreme markets" [@moskowitz2012a]. Hurst, Ooi and Pedersen (2017) extend trend following back to the 1880s and find it positive in each decade [@hurst2017]. Momentum also crashes: Daniel and Moskowitz (2016) show "infrequent and persistent strings of negative returns", mostly after market falls when volatility is high. Scaling down in those states roughly doubled the Sharpe ratio [@daniel2016].
- **Decay.** Stock momentum still shows up after publication, but it is costly to trade. Managed futures trend had weak returns from about 2012 to 2019 and a strong 2022. Currency trend rules faded after the early 1990s ([RES-0009](0009-trading-myths-and-what-the-evidence-says.md)).
- **Capacity.** Large in futures. Smaller in stock momentum, which leans on small stocks.
- **Costs.** Moderate. We charge stock momentum 3% a year in the factory, in line with [@novymarx2016].
- **Our data: yes.** FX, Treasury, commodity spot, French MOM factor, crypto. See [ALG-0015](../algorithms/0015-fx-time-series-momentum.md) and [ALG-0043](../algorithms/0043-managed-futures-trend-following.md).

### Low volatility and betting against beta

- **Evidence.** Ang, Hodrick, Xing and Zhang (2006) found that stocks with high recent idiosyncratic volatility earned very low average returns [@ang2006]. Frazzini and Pedersen (2014) explain it by leverage limits: investors who cannot borrow buy high beta assets instead, so a leveraged long position in low beta assets against high beta ones "produces significant risk-adjusted returns" in US and global stocks, bonds and futures [@frazzini2014].
- **Decay.** Contested. Some of the effect is the same as known value and profitability factors. Low volatility funds became popular after 2011, and their valuations rose, which may have used up part of the premium.
- **Capacity.** Moderate to large.
- **Costs.** Moderate. The short leg is in volatile stocks, which are costly to borrow.
- **Our data: partly.** We have 12 US industry portfolios and the factor library, but not single stocks. We can test a low beta tilt across industries, not the original stock-level test. See [ALG-0037](../algorithms/0037-betting-against-beta.md).

### Selling volatility (the variance risk premium)

- **Evidence.** Options usually price more volatility than later shows up. Carr and Wu (2009) measure this gap with synthetic variance swaps and find it large and negative for stock indexes [@carr2008]. Bollerslev, Tauchen and Zhou (2009) find the gap between implied and realised variance predicts stock market returns over the next few months [@bollerslev2009].
- **Decay.** The premium has persisted, but selling volatility has very large crash losses (February 2018, March 2020). Short volatility funds lost most of their value in a day in February 2018.
- **Capacity.** Moderate. Crowded short volatility makes crashes worse.
- **Costs.** Moderate, and the tail risk is the real cost.
- **Our data: partly.** We have the VIX and can compute realised S&P 500 volatility from the French market factor, so we can test the VIX minus realised gap as a timing signal for stocks. We have no options prices, so we cannot test selling options. See [ALG-0018](../algorithms/0018-fx-volatility-risk-premium.md).

## Behavioural: slow or distracted investors

### Under-reaction and post-earnings drift

- **Evidence.** After a surprise in earnings, prices keep drifting the same way for weeks. Bernard and Thomas (1989) tested and rejected a risk explanation and concluded prices respond with a delay [@bernard1989]. Time series momentum in futures is also read as initial under-reaction [@moskowitz2012a].
- **Decay.** Drift after earnings has shrunk a lot in large US stocks since the 2000s. What is left sits mostly in small, illiquid stocks.
- **Capacity.** Small.
- **Costs.** High. Trading around each earnings date turns the book over often.
- **Our data: no.** We have no single stocks or earnings data.

### Attention

- **Evidence.** Investors buy what grabs their attention. Barber and Odean (2008) find individual investors are net buyers of stocks in the news, with unusual volume or extreme one-day returns [@barber2008]. Da, Engelberg and Gao (2011) use Google searches: a rise "predicts higher stock prices in the next 2 weeks and an eventual price reversal within the year" [@da2011].
- **Decay.** Not well measured. Retail attention spikes (2021) were large but hard to trade.
- **Capacity.** Small.
- **Costs.** High, since the signal is short-lived.
- **Our data: no.** No search or single stock data. Crypto is the one place we could try something like it, using price and funding spikes as an attention gauge.

## Structural and flow: forced or rule-bound trading

These edges come from someone who must trade at a set time or size, whatever the price. They are often the cleanest stories, but also the easiest for others to copy.

### Index rebalancing

- **Evidence.** When a stock was added to the S&P 500, "prices increase by more than 3 percent" right after the announcement, and the rise "is nearly fully reversed after 2 weeks" [@harris1986]. Shleifer (1986) found lasting price gains for added stocks and read it as evidence that demand curves for stocks slope down [@shleifer1986]. Petajisto (2011) estimates what this costs index funds [@petajisto2011].
- **Decay.** Large. The effect on S&P 500 additions has shrunk a lot since the 1990s as index providers announced earlier and traders front-ran.
- **Capacity.** Small to moderate per event.
- **Costs.** Moderate.
- **Our data: no.** No index membership data.

### Turn of the month and month-end cash needs

- **Evidence.** Stock returns cluster in the days around the turn of the month. Ariel (1987) found returns concentrated at the start of the month [@ariel1987]. Lakonishok and Smidt (1988) confirmed turn-of-month and holiday effects over 90 years of the Dow [@lakonishok1988]. Etula, Rinne, Suominen and Vaittinen (2020) tie it to month-end payments: costs of capital rise temporarily around "key dates associated with month-end cash needs" in markets worldwide [@etula2019].
- **Decay.** The turn-of-month effect has weakened but not vanished. It is small per trade.
- **Capacity.** Large in index futures.
- **Costs.** Moderate. About 12 round trips a year.
- **Our data: yes.** Daily US stock and industry returns, Treasury returns and FX. See [ALG-0052](../algorithms/0052-turn-of-the-month.md).

### Turn of the year

- **Evidence.** Keim (1983) found that much of the small-stock premium was earned in January, especially in its first days [@keim1983].
- **Decay.** Large. The January effect in small stocks is much weaker since the 1990s.
- **Capacity.** Small, as it is a small-stock effect.
- **Costs.** Moderate.
- **Our data: yes.** French SMB factor and industries. FX year-end funding pressure can also be tested with our daily FX.

### FX fixings

- **Evidence.** Around the 4pm London WM/Reuters fix, prices show "extraordinary volatility and negative serial correlation", and post-fix moves partly reverse pre-fix moves, most at month end [@evans2018]. Melvin and Prins (2015) link month-end fix moves to equity managers hedging their currency exposure [@melvin2015]. The dollar rises into fixes and falls afterwards in a W shape through the day [@krohn2024].
- **Decay.** Some patterns changed after the 2013 to 2015 fix rigging fines and the widening of the fix window to five minutes in 2015.
- **Capacity.** Small. It lives in a few minutes.
- **Costs.** High relative to the move. Intraday post-fix reversals are around a basis point on normal days.
- **Our data: no.** It needs minute data. Our Fed and ECB rates are daily snapshots at other times. See [ALG-0009](../algorithms/0009-fx-london-4pm-fix.md).

### Options expiry

- **Evidence.** Stock prices cluster near popular strike prices on expiry dates, consistent with hedging by option dealers (Ni, Pearson and Poteshman, 2005, *Journal of Financial Economics* 78(1)). We left it out of the bibliography because its registry record has a garbled author name.
- **Decay, capacity, costs.** Small and intraday.
- **Our data: no.** No options data.

### Central bank meetings and the pre-FOMC drift

- **Evidence.** US stocks earned large excess returns in the 24 hours before scheduled FOMC decisions, enough to "account for sizable fractions of total annual realized stock returns" [@lucca2015]. Cieslak, Morse and Vissing-Jorgensen (2019) find that since 1994 "the equity premium is earned entirely in weeks 0, 2, 4, and 6" of the FOMC cycle [@cieslak2019]. In currencies, the dollar tends to fall on FOMC days, and the effect is larger when monetary policy uncertainty is high [@mueller2017a].
- **Decay.** Strong. Kurov, Wolfe and Gilbert (2021) find "the pre-FOMC drift essentially disappeared after 2015" [@kurov2021]. This is one of the clearest cases of an edge dying soon after publication.
- **Capacity.** Large in index futures.
- **Costs.** Low. About 8 trades a year.
- **Our data: yes.** Daily stocks, FX and the effective fed funds rate, plus the Fed's published meeting calendar. DEC-0026 tests both the day-before rule and the even-weeks rule. See [ALG-0019](../algorithms/0019-pre-fomc-drift.md) and [HYP-0006](../hypotheses/0006-short-the-dollar-on-fomc-days.md).

### Positioning extremes in the Commitments of Traders report

- **Evidence: mixed.** Wang (2001) found that in six agricultural futures markets, large speculator positioning predicts price continuations and hedger positioning predicts reversals, and that extreme readings give the strongest signal [@wang2001]. Wang (2003) found speculators' trades are positively linked to later returns across 15 futures markets, but "it does not appear that speculators possess superior forecasting power"; the returns look like pay for absorbing hedgers' risk [@wang2002]. Bessembinder and Chan (1992) found futures returns partly forecastable, consistent with risk premia that change over time [@bessembinder1992]. Sanders, Boris and Manfredo (2004) studied energy futures and found positions mostly follow prices rather than lead them [@sanders2004].
- **What this means.** The popular "fade the crowd" rule bets against speculators at extremes. The best evidence points the other way in commodities: speculators are paid, hedgers pay. Contrarian signals may still work in currencies at extremes, but we found no strong published test.
- **Decay.** Unknown. The report has been public and widely watched for decades.
- **Capacity.** Large.
- **Costs.** Low. Weekly data, slow signals.
- **Our data: yes.** CFTC legacy COT for 23 markets, already moved 3 business days forward to match the Friday release. We should test both directions, and count both as tries.

## Information: knowing sooner or reading better

### Macro surprises

- **Evidence.** Announcement surprises move exchange rates within minutes, and bad news has a larger effect than good news [@andersen2003].
- **Decay.** Not a decay story. The surprise is priced almost at once.
- **Capacity.** Large, but the profit goes to whoever is fastest.
- **Costs.** Very high at speed.
- **Our data: partly.** We have the slow releases (weekly claims, the weekly economic index) but no consensus forecasts, so we cannot measure surprises. See [HYP-0004](../hypotheses/0004-macro-surprises-move-fx-predictably.md).

### Nowcasting and economic trends

- **Evidence.** Giannone, Reichlin and Small (2008) built a method that updates a GDP estimate as each monthly release comes in [@giannone2008]. Beber, Brandt and Luisi (2015) condense the flow of macro news into indexes of the state of the economy [@beber2015]. Dahlquist and Hasseltoft (2020) find "economic momentum", trends in a country's economic data, predicts currency returns and is distinct from carry and price momentum [@dahlquist2020].
- **Decay.** Not measured. Economic momentum is recent and has few outside tests.
- **Capacity.** Large.
- **Costs.** Low. Monthly.
- **Our data: partly.** We have US weekly claims, the weekly economic index, NFCI and St. Louis stress indexes, breakevens and TIPS. These are US only, so they suit regime switches (risk on or off) better than a country-by-country FX ranking. A clean test needs vintage data, since releases are revised. See [ALG-0007](../algorithms/0007-fx-economic-momentum.md).

### Financial stress regimes

- **Evidence.** Carry and momentum both lose money when volatility and funding stress jump [@menkhoff2012b; @daniel2016; @frazzini2014]. That makes a stress gauge a natural switch: hold risk premia in calm times, cut them in stress.
- **Decay.** Hard to judge. Such switches were often fitted after 2008 with hindsight.
- **Capacity.** Large.
- **Costs.** Low.
- **Our data: yes.** NFCI, St. Louis stress index, initial claims, VIX. NFCI is revised after release, so a test must use it with a delay and accept some look-ahead in old values.

## What kills edges

Most published edges fail one of these four tests.

- **Costs.** Novy-Marx and Velikov (2016) find most anomalies with monthly turnover below 50% survive costs, and "few of the strategies with higher turnover do" [@novymarx2016]. A daily strategy needs a very large edge to pay its spread.
- **Data mining and multiple testing.** If enough rules are tried, some will look good by chance. Harvey, Liu and Zhu (2016) argue a new factor needs a t-statistic above about 3, not 2 [@harvey2015]. Bailey and Lopez de Prado (2014) correct a Sharpe ratio for the number of tries; we use that in the search [@bailey2014a]. Hou, Xue and Zhang (2020) find 65% of 452 anomalies fail a t-statistic of 1.96, and 82% fail the stricter 2.78 [@hou2018]. Chen and Zimmermann (2022) disagree on replication: for 161 predictors that were clearly significant in the original papers, "98% of our long-short portfolios find t-stats above 1.96" [@chen2022]. The two views fit together: most published effects are real in the original sample, but many are small, live in tiny stocks or do not survive stricter tests.
- **Publication.** Returns were 26% lower out of sample and 58% lower after publication, and fell more for predictors with higher in-sample returns [@mclean2016].
- **Crowding.** When many funds hold the same trade, they all sell at once in a shock. In August 2007, quant equity funds lost heavily over a few days, consistent with a rapid unwind of similar positions [@khandani2011]. Carry crashes show the same pattern in currencies [@brunnermeier2008].

## Summary table

"Survives costs" is for a slow, daily or slower version. "Family" is the factory family that tests it (DEC-0014 for the existing ones, DEC-0026 for the new ones).

| Edge | Mechanism | Survives costs? | Decayed? | Capacity | Our data can test it | Family |
| --- | --- | --- | --- | --- | --- | --- |
| FX carry, G10 | Risk premium (crash risk) | Yes | Somewhat | Large | Yes: OECD rates, BIS rates, H.10 | Existing carry |
| FX carry, wider set | Risk premium | Yes, wider spreads | Unknown | Moderate | Yes: BIS rates, ECB FX (27 currencies) | New: policy rates |
| Hiking central banks | Slow policy cycles | Likely | Unknown | Large | Yes: BIS policy rates | New: policy rates |
| Term premium, curve slope | Risk premium | Yes | Premium fell | Very large | Yes: UST curve, euro AAA curve | New: yield curve |
| Curve roll-down | Carry in bonds | Yes | Somewhat | Very large | Yes: UST curve | New: yield curve |
| US against euro curve | Relative rates | Likely | Unknown | Large | Yes: both curves, ECB FX | New: yield curve |
| Value | Risk premium or mispricing | Yes | Long bad spell | Large | Yes for stocks, partly FX | Existing value |
| Time series momentum | Under-reaction, then overreaction | Yes | Weaker 2012 to 2019 | Large | Yes: FX, bonds, commodities | Existing trend |
| Stock momentum | Under-reaction | Partly | Slight | Moderate | Yes: French MOM | Existing factors |
| Betting against beta | Leverage limits | Partly | Contested | Moderate | Partly: industries only | Existing |
| Selling volatility | Insurance premium | Yes, with crash risk | No | Moderate | Partly: VIX, no options | Not yet |
| Earnings drift | Under-reaction | Small stocks only | Large | Small | No | None |
| Attention | Retail buying | No | Unknown | Small | No | None |
| Index additions | Forced buying | Barely | Large | Small | No | None |
| Turn of month | Month-end cash needs | Yes | Somewhat | Large | Yes: daily returns | Existing calendar |
| Turn of year | Tax and window dressing | Partly | Large | Small | Yes: SMB, FX | New: calendar |
| FX fixes | Forced flows at a set time | No at daily speed | Changed after 2015 | Small | No: needs minute data | None |
| Options expiry | Dealer hedging | No | Unknown | Small | No | None |
| Pre-FOMC drift | Fed news before meetings | Yes | Gone after 2015 | Large | Yes: dates plus daily returns | New: calendar |
| Dollar on FOMC days | Policy uncertainty premium | Yes | Unknown | Large | Yes: H.10, EFFR | Existing FOMC |
| COT extremes | Hedging pressure | Yes | Unknown | Large | Yes: CFTC COT, 23 markets | New: positioning |
| Macro surprises | Fast news | No | Instant | Large | No: no forecasts | None |
| Economic momentum | Slow macro trends | Yes | Few tests | Large | Partly: US only | Existing |
| Stress regimes | Risk premia crash in stress | Yes | Hindsight risk | Large | Yes: NFCI, STLFSI, claims, VIX | New: regimes |
| Crypto funding carry | Leverage demand | Yes, so far | Short history | Small | Partly: 30 days of funding | Existing crypto |

## What this means for us

- **What our first test found** ([DEC-0026](../decisions/0026-new-edge-families-from-the-wider-data.md)). Policy-rate carry on 27 currencies was the strongest new lead, at a Sharpe ratio of 0.75 after costs, passing 9 of 11 tests. It still fell with stocks, as carry does. Contrarian COT rules in currencies were noise. The pre-FOMC drift was small and failed the recent years.
- **Start where the evidence is strong and our data fits.** Carry on the wider set, curve signals and stress switches are slow, cheap to trade and have long histories in our data.
- **Treat calendar effects as tests of decay.** The pre-FOMC drift is the textbook case of an edge that died. If our test finds it after 2015, we should suspect a mistake before celebrating.
- **Test COT in both directions.** The evidence says speculators are paid, which is the opposite of the popular contrarian rule. Both directions count as tries.
- **Halve every paper's number before we start.** A strategy that only works at the published Sharpe ratio will not work for us.
- **Keep combining.** Value and momentum are negatively correlated, and carry and trend fail at different times [@asness2013]. A mix of modest edges is more likely to beat the S&P 500 than any one of them ([HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md)).

## What we could not check

- On 2026-10-23 we checked every new paper's authors, year, title, journal, volume, pages and DOI against Crossref. Fama and Bliss (1987) has no DOI; we checked it on RePEc.
- We read the abstract of: Lucca and Moench, Cieslak et al., Kurov et al., Etula et al., Hou et al., Chen and Zimmermann, McLean and Pontiff, Frazzini and Pedersen, Moskowitz et al., Menkhoff et al. (2012), Asness et al., Koijen et al., Daniel and Moskowitz, Da et al., Harris and Gurel, and both Wang papers.
- We did not read the abstract of Carr and Wu, Bollerslev et al., Ang et al., Bernard and Thomas, Shleifer, Petajisto, Ariel, Keim, Melvin and Prins, Mueller et al., Cochrane and Piazzesi, Adrian et al., Hurst et al., Giannone et al., Beber et al., Dahlquist and Hasseltoft, Bessembinder and Chan, Sanders et al. and Khandani and Lo. Claims about them are the main finding each is known for, and we kept them short. Bessembinder and Chan and Sanders et al. have no abstract on RePEc, so those two claims are the least checked.
- Numbers quoted from RES-0010 (carry Sharpe ratios, FX fix reversals, cost effects) were checked there.
- Decay claims without a citation (value's bad spell, trend's weak 2010s, smaller index and January effects) are widely reported but not tied to one paper here.

## Papers added for this page

New entries in the bibliography, with the link we checked:

- Daniel and Moskowitz (2016), Momentum crashes, *Journal of Financial Economics* 122(2), 221-247. <https://doi.org/10.1016/j.jfineco.2015.12.002>
- Ang, Hodrick, Xing and Zhang (2006), The cross-section of volatility and expected returns, *Journal of Finance* 61(1), 259-299. <https://doi.org/10.1111/j.1540-6261.2006.00836.x>
- Carr and Wu (2009), Variance risk premiums, *Review of Financial Studies* 22(3), 1311-1341. <https://doi.org/10.1093/rfs/hhn038>
- Bollerslev, Tauchen and Zhou (2009), Expected stock returns and variance risk premia, *Review of Financial Studies* 22(11), 4463-4492. <https://doi.org/10.1093/rfs/hhp008>
- Bernard and Thomas (1989), Post-earnings-announcement drift: delayed price response or risk premium?, *Journal of Accounting Research* 27, 1-36. <https://doi.org/10.2307/2491062>
- Da, Engelberg and Gao (2011), In search of attention, *Journal of Finance* 66(5), 1461-1499. <https://doi.org/10.1111/j.1540-6261.2011.01679.x>
- Harris and Gurel (1986), Price and volume effects associated with changes in the S&P 500 list, *Journal of Finance* 41(4), 815-829. <https://doi.org/10.1111/j.1540-6261.1986.tb04550.x>
- Shleifer (1986), Do demand curves for stocks slope down?, *Journal of Finance* 41(3), 579-590. <https://doi.org/10.1111/j.1540-6261.1986.tb04518.x>
- Petajisto (2011), The index premium and its hidden cost for index funds, *Journal of Empirical Finance* 18(2), 271-288. <https://doi.org/10.1016/j.jempfin.2010.10.002>
- Ariel (1987), A monthly effect in stock returns, *Journal of Financial Economics* 18(1), 161-174. <https://doi.org/10.1016/0304-405X(87)90066-3>
- Etula, Rinne, Suominen and Vaittinen (2020), Dash for cash: monthly market impact of institutional liquidity needs, *Review of Financial Studies* 33(1), 75-111. <https://doi.org/10.1093/rfs/hhz054>
- Keim (1983), Size-related anomalies and stock return seasonality, *Journal of Financial Economics* 12(1), 13-32. <https://doi.org/10.1016/0304-405X(83)90025-9>
- Cieslak, Morse and Vissing-Jorgensen (2019), Stock returns over the FOMC cycle, *Journal of Finance* 74(5), 2201-2248. <https://doi.org/10.1111/jofi.12818>
- Kurov, Wolfe and Gilbert (2021), The disappearing pre-FOMC announcement drift, *Finance Research Letters* 40, 101781. <https://doi.org/10.1016/j.frl.2020.101781>
- Wang (2001), Investor sentiment and return predictability in agricultural futures markets, *Journal of Futures Markets* 21(10), 929-952. <https://doi.org/10.1002/fut.2003>
- Wang (2003), The behavior and performance of major types of futures traders, *Journal of Futures Markets* 23(1), 1-31. <https://doi.org/10.1002/fut.10056>
- Bessembinder and Chan (1992), Time-varying risk premia and forecastable returns in futures markets, *Journal of Financial Economics* 32(2), 169-193. <https://doi.org/10.1016/0304-405X(92)90017-R>
- Sanders, Boris and Manfredo (2004), Hedgers, funds, and small speculators in the energy futures markets, *Energy Economics* 26(3), 425-445. <https://doi.org/10.1016/j.eneco.2004.04.010>
- Cochrane and Piazzesi (2005), Bond risk premia, *American Economic Review* 95(1), 138-160. <https://doi.org/10.1257/0002828053828581>
- Adrian, Crump and Moench (2013), Pricing the term structure with linear regressions, *Journal of Financial Economics* 110(1), 110-138. <https://doi.org/10.1016/j.jfineco.2013.04.009>
- Giannone, Reichlin and Small (2008), Nowcasting: the real-time informational content of macroeconomic data, *Journal of Monetary Economics* 55(4), 665-676. <https://doi.org/10.1016/j.jmoneco.2008.05.010>
- Beber, Brandt and Luisi (2015), Distilling the macroeconomic news flow, *Journal of Financial Economics* 117(3), 489-507. <https://doi.org/10.1016/j.jfineco.2015.05.005>
- Chen and Zimmermann (2022), Open source cross-sectional asset pricing, *Critical Finance Review* 11(2), 207-264. <https://doi.org/10.1561/104.00000112>
- Khandani and Lo (2011), What happened to the quants in August 2007?, *Journal of Financial Markets* 14(1), 1-46. <https://doi.org/10.1016/j.finmar.2010.07.005>

## Next

- Build the new families in [DEC-0026](../decisions/0026-new-edge-families-from-the-wider-data.md) and run them through the gauntlet, counting every variation.
- Fix the open look-ahead question on monthly interbank rates before trusting any carry result.
- Look for a futures data source so curve and commodity tests use tradable prices, not spot or rebuilt returns.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@mclean2016](../REFERENCES.md#mclean2016): McLean and Pontiff (2016), Does Academic Research Destroy Stock Return Predictability?
- [@novymarx2016](../REFERENCES.md#novymarx2016): Novy-Marx and Velikov (2016), A Taxonomy of Anomalies and Their Trading Costs
- [@koijen2018](../REFERENCES.md#koijen2018): Koijen et al. (2018), Carry
- [@lustig2011](../REFERENCES.md#lustig2011): Lustig et al. (2011), Common Risk Factors in Currency Markets
- [@menkhoff2012b](../REFERENCES.md#menkhoff2012b): Menkhoff et al. (2012), Carry Trades and Global Foreign Exchange Volatility
- [@brunnermeier2008](../REFERENCES.md#brunnermeier2008): Brunnermeier et al. (2008), Carry Trades and Currency Crashes
- [@fama1987](../REFERENCES.md#fama1987): Fama and Bliss (1987), The Information in Long-Maturity Forward Rates
- [@cochrane2005](../REFERENCES.md#cochrane2005): Cochrane and Piazzesi (2005), Bond Risk Premia
- [@adrian2013](../REFERENCES.md#adrian2013): Adrian et al. (2013), Pricing the term structure with linear regressions
- [@asness2013](../REFERENCES.md#asness2013): Asness et al. (2013), Value and Momentum Everywhere
- [@jegadeesh1993](../REFERENCES.md#jegadeesh1993): Jegadeesh and Titman (1993), Returns to Buying Winners and Selling Losers: Implications for Stock Market Efficiency
- [@moskowitz2012a](../REFERENCES.md#moskowitz2012a): Moskowitz et al. (2012), Time series momentum
- [@hurst2017](../REFERENCES.md#hurst2017): Hurst et al. (2017), A Century of Evidence on Trend-Following Investing
- [@daniel2016](../REFERENCES.md#daniel2016): Daniel and Moskowitz (2016), Momentum crashes
- [@ang2006](../REFERENCES.md#ang2006): Ang et al. (2006), The Cross-Section of Volatility and Expected Returns
- [@frazzini2014](../REFERENCES.md#frazzini2014): Frazzini and Pedersen (2014), Betting against beta
- [@carr2008](../REFERENCES.md#carr2008): Carr and Wu (2008), Variance Risk Premiums
- [@bollerslev2009](../REFERENCES.md#bollerslev2009): Bollerslev et al. (2009), Expected Stock Returns and Variance Risk Premia
- [@bernard1989](../REFERENCES.md#bernard1989): Bernard and Thomas (1989), Post-Earnings-Announcement Drift: Delayed Price Response or Risk Premium?
- [@barber2008](../REFERENCES.md#barber2008): Barber and Odean (2008), All That Glitters: The Effect of Attention and News on the Buying Behavior of Individual and Institutional Investors
- [@da2011](../REFERENCES.md#da2011): Da et al. (2011), In Search of Attention
- [@harris1986](../REFERENCES.md#harris1986): Harris and Gurel (1986), Price and Volume Effects Associated with Changes in the S&P 500 List: New Evidence for the Existence of Price Pressures
- [@shleifer1986](../REFERENCES.md#shleifer1986): Shleifer (1986), Do Demand Curves for Stocks Slope Down?
- [@petajisto2011](../REFERENCES.md#petajisto2011): Petajisto (2011), The index premium and its hidden cost for index funds
- [@ariel1987](../REFERENCES.md#ariel1987): Ariel (1987), A monthly effect in stock returns
- [@lakonishok1988](../REFERENCES.md#lakonishok1988): Lakonishok and Smidt (1988), Are Seasonal Anomalies Real? A Ninety-Year Perspective
- [@etula2019](../REFERENCES.md#etula2019): Etula et al. (2019), Dash for Cash: Monthly Market Impact of Institutional Liquidity Needs
- [@keim1983](../REFERENCES.md#keim1983): Keim (1983), Size-related anomalies and stock return seasonality
- [@evans2018](../REFERENCES.md#evans2018): Evans (2018), Forex trading and the WMR Fix
- [@melvin2015](../REFERENCES.md#melvin2015): Melvin and Prins (2015), Equity hedging and exchange rates at the London 4p.m. fix
- [@krohn2024](../REFERENCES.md#krohn2024): Krohn et al. (2024), Foreign Exchange Fixings and Returns around the Clock
- [@lucca2015](../REFERENCES.md#lucca2015): Lucca and Moench (2015), The Pre-FOMC Announcement Drift
- [@cieslak2019](../REFERENCES.md#cieslak2019): Cieslak et al. (2019), Stock Returns over the FOMC Cycle
- [@mueller2017a](../REFERENCES.md#mueller2017a): Mueller et al. (2017), Exchange Rates and Monetary Policy Uncertainty
- [@kurov2021](../REFERENCES.md#kurov2021): Kurov et al. (2021), The disappearing pre-FOMC announcement drift
- [@wang2001](../REFERENCES.md#wang2001): Wang (2001), Investor Sentiment and Return Predictability in Agricultural Futures Markets
- [@wang2002](../REFERENCES.md#wang2002): Wang (2002), The behavior and performance of major types of futures traders
- [@bessembinder1992](../REFERENCES.md#bessembinder1992): Bessembinder and Chan (1992), Time-varying risk premia and forecastable returns in futures markets
- [@sanders2004](../REFERENCES.md#sanders2004): Sanders et al. (2004), Hedgers, funds, and small speculators in the energy futures markets: an analysis of the CFTC's Commitments of Traders reports
- [@andersen2003](../REFERENCES.md#andersen2003): Andersen et al. (2003), Micro Effects of Macro Announcements: Real-Time Price Discovery in Foreign Exchange
- [@giannone2008](../REFERENCES.md#giannone2008): Giannone et al. (2008), Nowcasting: The real-time informational content of macroeconomic data
- [@beber2015](../REFERENCES.md#beber2015): Beber et al. (2015), Distilling the macroeconomic news flow
- [@dahlquist2020](../REFERENCES.md#dahlquist2020): Dahlquist and Hasseltoft (2020), Economic momentum and currency returns
- [@harvey2015](../REFERENCES.md#harvey2015): Harvey et al. (2015), ... and the Cross-Section of Expected Returns
- [@bailey2014a](../REFERENCES.md#bailey2014a): Bailey and López de Prado (2014), The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality
- [@hou2018](../REFERENCES.md#hou2018): Hou et al. (2018), Replicating Anomalies
- [@chen2022](../REFERENCES.md#chen2022): Chen and Zimmermann (2022), Open Source Cross-Sectional Asset Pricing
- [@khandani2011](../REFERENCES.md#khandani2011): Khandani and Lo (2011), What happened to the quants in August 2007? Evidence from factors and transactions data

## Referenced by

- [DEC-0026: New edge families from the wider data](../decisions/0026-new-edge-families-from-the-wider-data.md)
<!-- backlinks:end -->
