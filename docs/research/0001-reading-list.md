---
id: RES-0001
title: Reading list of papers, books and courses
type: research
status: current
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [economics, fx, method]
related: [HYP-0001, HYP-0002, HYP-0003, RES-0004]
---

# Reading list of papers, books and courses

## In plain words

This is our reading list: the research papers, books and free courses that matter for this project, with a sentence or two on each saying why. The most important lesson so far is that tricks that worked in old studies mostly stopped working once they were published.

## Summary

The papers, books and courses we think matter most for this project, with one or two sentences on why. The first table is the foundation we started from. Everything after it was gathered on 2026-10-20 and each item was checked against a live publisher, DOI, SSRN, NBER, arXiv or RePEc page. Items we could not fully confirm are marked.

Three things stood out:

- **Published FX factors have decayed.** Hutchinson et al. (2022) found that replicated carry, momentum and value strategies went from an average Sharpe ratio of 0.39 before publication to minus 0.32 after. We should expect [HYP-0001](../hypotheses/0001-carry-still-pays-after-costs.md) and [HYP-0002](../hypotheses/0002-currency-trends-persist.md) to disappoint on recent data.
- **No paper we found shows FX alone beating the S&P 500.** Two find that FX styles help when held alongside stocks, which is why we added [HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md).
- **The commodity link may have flipped after 2020** (Rees, 2025), so [HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md) is tested before and after 2020 separately.

Relevance labels: H1 is [HYP-0001](../hypotheses/0001-carry-still-pays-after-costs.md), H2 is [HYP-0002](../hypotheses/0002-currency-trends-persist.md), H3 is [HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md), "new" means it suggests a hypothesis we did not start with, "method" means it is about how to test rather than what to test.

## Foundations

The papers we started from. DOIs were checked to resolve on 2026-10-20.

| Paper | Why we read it | Relevance |
| --- | --- | --- |
| Meese and Rogoff (1983), "Empirical exchange rate models of the seventies: do they fit out of sample?", *Journal of International Economics*. [doi:10.1016/0022-1996(83)90017-X](https://doi.org/10.1016/0022-1996(83)90017-X) | The famous result that a random walk forecasts exchange rates as well as economic models. Every claim we make has to beat this. | method |
| Fama (1984), "Forward and spot exchange rates", *Journal of Monetary Economics*. [doi:10.1016/0304-3932(84)90046-1](https://doi.org/10.1016/0304-3932(84)90046-1) | High-rate currencies do not depreciate as much as interest parity says, which is why carry has paid. | H1 |
| Evans and Lyons (2002), "Order flow and exchange rate dynamics", *Journal of Political Economy*. [doi:10.1086/324391](https://doi.org/10.1086/324391) | Order flow explains daily FX moves far better than macro models. | new |
| Andersen, Bollerslev, Diebold and Vega (2003), "Micro effects of macro announcements", *American Economic Review*. [doi:10.1257/000282803321455151](https://doi.org/10.1257/000282803321455151) | Surprises in US data releases move the dollar within minutes. | new |
| Chen and Rogoff (2003), "Commodity currencies", *Journal of International Economics*. [doi:10.1016/S0022-1996(02)00072-7](https://doi.org/10.1016/S0022-1996(02)00072-7) | World commodity prices explain much of the AUD, CAD and NZD real exchange rates. | H3 |
| Engel and West (2005), "Exchange rates and fundamentals", *Journal of Political Economy*. [doi:10.1086/429137](https://doi.org/10.1086/429137) | Explains why exchange rates look like random walks even if fundamentals matter. | method |
| Kilian (2009), "Not all oil price shocks are alike", *American Economic Review*. [doi:10.1257/aer.99.3.1053](https://doi.org/10.1257/aer.99.3.1053) | Supply and demand oil shocks have different effects; a raw oil price mixes them. | H3 |
| Chen, Rogoff and Rossi (2010), "Can exchange rates forecast commodity prices?", *Quarterly Journal of Economics*. [doi:10.1162/qjec.2010.125.3.1145](https://doi.org/10.1162/qjec.2010.125.3.1145) | The currency often leads the commodity, not the reverse. A direct challenge to H3. | H3 |
| Lustig, Roussanov and Verdelhan (2011), "Common risk factors in currency markets", *Review of Financial Studies*. [doi:10.1093/rfs/hhr068](https://doi.org/10.1093/rfs/hhr068) | Carry returns look like compensation for a global risk factor. | H1 |
| Menkhoff, Sarno, Schmeling and Schrimpf (2012), "Carry trades and global foreign exchange volatility", *Journal of Finance*. [doi:10.1111/j.1540-6261.2012.01728.x](https://doi.org/10.1111/j.1540-6261.2012.01728.x) | Carry loses when global FX volatility jumps. | H1 |
| Menkhoff, Sarno, Schmeling and Schrimpf (2012), "Currency momentum strategies", *Journal of Financial Economics*. [doi:10.1016/j.jfineco.2012.06.009](https://doi.org/10.1016/j.jfineco.2012.06.009) | Currency momentum exists but is costly to trade and concentrated in harder-to-trade currencies. | H2 |
| Moskowitz, Ooi and Pedersen (2012), "Time series momentum", *Journal of Financial Economics*. [doi:10.1016/j.jfineco.2011.11.003](https://doi.org/10.1016/j.jfineco.2011.11.003) | The design our trend strategy copies. | H2 |
| Brunnermeier, Nagel and Pedersen (2008), "Carry trades and currency crashes", *NBER Macroeconomics Annual*. [NBER w14473](https://www.nber.org/papers/w14473) | Carry goes up by the stairs and down by the elevator. | H1 |
| Asness, Moskowitz and Pedersen (2013), "Value and momentum everywhere", *Journal of Finance*. [doi:10.1111/jofi.12021](https://doi.org/10.1111/jofi.12021) | Value and momentum across asset classes, including currencies. | H2 |
| Rossi (2013), "Exchange rate predictability", *Journal of Economic Literature*. [doi:10.1257/jel.51.4.1063](https://doi.org/10.1257/jel.51.4.1063) | The best survey of what does and does not forecast exchange rates. | method |
| Bailey and Lopez de Prado (2014), "The deflated Sharpe ratio", *Journal of Portfolio Management*. [doi:10.3905/jpm.2014.40.5.094](https://doi.org/10.3905/jpm.2014.40.5.094) | The statistic we use to discount for the number of things we tried. | method |
| Ferraro, Rogoff and Rossi (2015), "Can oil prices forecast exchange rates?", *Journal of International Money and Finance*. [doi:10.1016/j.jimonfin.2015.03.001](https://doi.org/10.1016/j.jimonfin.2015.03.001) | Oil and CAD move together on the same day, but the link fades at lower frequencies. | H3 |
| Harvey, Liu and Zhu (2016), "... and the cross-section of expected returns", *Review of Financial Studies*. [doi:10.1093/rfs/hhv059](https://doi.org/10.1093/rfs/hhv059) | Argues for a t-stat hurdle near 3, not 2, for new factors. | method |
| Bailey, Borwein, Lopez de Prado and Zhu (2016), "The probability of backtest overfitting", *Journal of Computational Finance*. [doi:10.21314/JCF.2016.322](https://doi.org/10.21314/JCF.2016.322) | A way to estimate how likely a backtest is to be overfit. On our roadmap. | method |
| Koijen, Moskowitz, Pedersen and Vrugt (2018), "Carry", *Journal of Financial Economics*. [doi:10.1016/j.jfineco.2017.11.002](https://doi.org/10.1016/j.jfineco.2017.11.002) | Carry defined the same way across asset classes. | H1 |
| Lopez de Prado (2018), *Advances in Financial Machine Learning*, Wiley. | Practical guide to backtesting without fooling yourself. | method |
| Carver (2015), *Systematic Trading*, Harriman House. | How to size and combine simple rules. | method |

## Papers

### FX factors: value, dollar, volatility risk premium, and FX next to equities

1. **Menkhoff, Sarno, Schmeling and Schrimpf (2017). "Currency Value." Review of Financial Studies 30(2), 416-441.** https://ideas.repec.org/a/oup/rfinst/v30y2017i2p416-441..html (open copy: https://openaccess.city.ac.uk/14851/)
   Real exchange rates predict currency returns, and they predict better once adjusted for productivity, export quality, net foreign assets and output gaps. The value signal carries information that carry and momentum do not, so it is a natural third leg for our portfolio. Relevance: new, H1.

2. **Della Corte, Ramadorai and Sarno (2016). "Volatility risk premia and exchange rate predictability." Journal of Financial Economics 120(1), 21-40.** https://doi.org/10.1016/j.jfineco.2016.02.015 (SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2233367)
   Selling currencies where volatility insurance is expensive and buying where it is cheap earns returns that diversify carry. It needs FX option implied volatilities, which are not free at daily frequency, so it is probably out of reach for us. Relevance: new (data-limited).

3. **Lustig, Roussanov and Verdelhan (2014). "Countercyclical currency risk premia." Journal of Financial Economics 111(3), 527-553.** https://ssrn.com/abstract=1541230 (author PDF: http://web.mit.edu/adrienv/www/LRV_JFE_2014.pdf)
   A "dollar carry" trade (go long or short a basket of all currencies against the USD depending on the average interest rate gap) earned large returns that were unrelated to ordinary carry. It needs only interest rates and spot rates, so it is cheap for us to test. Relevance: H1, new.

4. **Verdelhan (2018). "The Share of Systematic Variation in Bilateral Exchange Rates." Journal of Finance 73(1), 375-418.** https://doi.org/10.1111/jofi.12587
   Two factors (a dollar factor and a carry factor) explain between 18% and 80% of monthly moves in bilateral rates. This tells us that much of what looks like a currency-specific signal may just be dollar exposure, which we should strip out before claiming anything. Relevance: method, H1.

5. **Daniel, Hodrick and Lu (2017). "The Carry Trade: Risks and Drawdowns." Critical Finance Review 6(2), 211-262.** https://doi.org/10.2139/ssrn.2486275 (NBER w20433: https://www.nber.org/papers/w20433)
   Classic dollar-neutral carry is negatively skewed and crashes with risk assets. A diversified dollar-carry portfolio had a higher Sharpe ratio and little downside risk in their sample. This is the main warning for H1: report skew and drawdowns, not only the Sharpe ratio. Relevance: H1.

6. **Kroencke, Schindler and Schrimpf (2014). "International Diversification Benefits with Foreign Exchange Investment Styles." Review of Finance 18(5), 1847-1883.** https://ideas.repec.org/a/oup/revfin/v18y2014i5p1847-1883..html
   Adding a mix of carry, momentum and value FX strategies to a global stock and bond portfolio raised the out-of-sample Sharpe ratio from 0.64 to 1.05, after costs. This is the closest published answer to our headline question, and it frames FX as a complement to equities rather than a replacement. Relevance: H1, H2, new.

7. **Barroso and Santa-Clara (2015). "Beyond the Carry Trade: Optimal Currency Portfolios." Journal of Financial and Quantitative Analysis 50(5), 1037-1056.** https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2041460
   Carry, momentum and reversal helped a combined currency portfolio out of sample over 16 years, while the real exchange rate and current account did not. Its returns were valuable to investors who already held stocks and bonds. Relevance: H1, H2.

8. **Dahlquist and Hasseltoft (2020). "Economic momentum and currency returns." Journal of Financial Economics 136(1), 152-167.** https://econpapers.repec.org/article/eeejfinec/v_3a136_3ay_3a2020_3ai_3a1_3ap_3a152-167.htm
   Recent trends in a country's growth and inflation data predicted its currency, with a Sharpe ratio of about 0.70 that carry, momentum and value did not explain (1976-2017). It uses monthly macro data, which is free but gets revised, so we would need first-release values to avoid look-ahead. Relevance: new.

9. **Hurst, Ooi and Pedersen (2017). "A Century of Evidence on Trend-Following Investing." Journal of Portfolio Management 44(1), 15-29.** https://doi.org/10.3905/jpm.2017.44.1.015 (SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2993026)
   Trend following across asset classes earned positive average returns in every decade since 1880 and did well in 8 of the 10 worst 60/40 drawdowns. The authors work at a fund that sells this strategy, which we should note. Relevance: H2.

### Macro news and announcements

10. **Faust, Rogers, Wang and Wright (2007). "The high-frequency response of exchange rates and interest rates to macroeconomic announcements." Journal of Monetary Economics 54(4), 1051-1068.** https://papers.ssrn.com/sol3/papers.cfm?abstract_id=465323
    Uses intraday data to measure how the dollar and interest rates jump around US data releases. Useful background, but the effect plays out within minutes, which daily data cannot capture. Relevance: new, method.

11. **Evans and Lyons (2008). "How is macro news transmitted to exchange rates?" Journal of Financial Economics 88(1), 26-50.** https://www.nber.org/papers/w9433
    About two thirds of the price effect of macro news arrives through trading flows rather than an instant jump, and macro news explains about 36% of daily price variance. This suggests some news effects take hours to play out, but we would need order flow data we do not have. Relevance: new.

12. **Mueller, Tahbaz-Salehi and Vedolin (2017). "Exchange Rates and Monetary Policy Uncertainty." Journal of Finance 72(3), 1213-1252.** https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2705818
    Being short the dollar earned much more on scheduled FOMC days, more so for high-interest currencies and when policy uncertainty was high. The FOMC calendar is public, so this is a daily-data test we can actually run. Relevance: new, H1.

13. **Bortnikova (2026). "Macroeconomic News and Exchange Rates: A Meta-Analysis of Event Studies." Journal of Economic Surveys (online September 2026).** https://onlinelibrary.wiley.com/doi/10.1111/joes.70159 (working paper: https://ideas.repec.org/p/fau/wpaper/wp2025_01.html)
    Pools 985 estimates from 31 studies and finds publication bias. Once that bias is corrected, the average effect of macro news on exchange rates is close to zero. This is a strong reason to be careful with any news-based signal. Relevance: method, new.

### Oil, gas and commodity currencies

14. **Kohlscheen, Avalos and Schrimpf (2017). "When the Walk Is Not Random: Commodity Prices and Exchange Rates." International Journal of Central Banking 13(2).** https://www.ijcb.org/sites/default/files/journal/v13n2/ijcb-v13n2-when-walk-not-random-commodity-prices-and-exchange-rates.pdf (BIS WP 551: https://www.bis.org/publ/work551.pdf)
    Country-specific commodity price indices predicted the currencies of 11 commodity exporters out of sample for horizons up to two months, beating the random walk. The link was not explained by risk appetite or carry. This is the most direct support for H3. Relevance: H3.

15. **Lizardo and Mollick (2010). "Oil price fluctuations and U.S. dollar exchange rates." Energy Economics 32(2), 399-408.** https://econpapers.repec.org/RePEc:eee:eneeco:v:32:y:2010:i:2:p:399-408
    Higher real oil prices went with a weaker USD against oil exporters (Canada, Mexico, Russia) and a stronger USD against importers such as Japan. Adding oil improved forecasts for some currencies. Relevance: H3.

16. **Beckmann, Czudaj and Arora (2020). "The relationship between oil prices and exchange rates: Revisiting theory and evidence." Energy Economics 88, 104772.** https://ideas.repec.org/a/eee/eneeco/v88y2020ics0140988320301122.html
    A survey: the long-run link between oil and FX is often strong, but short-run predictability goes both ways and changes a lot over time. Results depend heavily on sample and method. Relevance: H3, method.

17. **Rees (2025). "Commodity prices and the US dollar." Journal of International Economics 157, 104114.** https://doi.org/10.1016/j.jinteco.2025.104114
    After Covid, higher commodity prices came with a stronger dollar, against the old pattern. The paper links this to the US becoming a net oil exporter. For us this means any H3 rule fitted on pre-2020 data may break after 2020, so we must test the two periods separately. Relevance: H3.

    Gap: we did not find a verified, well-cited paper on natural gas prices and NOK (or other gas exporters) at daily frequency. Treat any gas signal as untested.

### Machine learning and LLM work on FX

18. **Filippou, Rapach, Taylor and Zhou (2020). "Exchange Rate Prediction with Machine Learning and a Smart Carry Trade Portfolio." SSRN working paper / CEPR DP15305.** https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3696388
    An elastic net on 70 predictors beat the no-change forecast for monthly exchange rates and improved a carry portfolio, especially after 2008. It shows that regularised linear models are a sensible ML baseline before trying anything deeper. We could not confirm a final journal version. Relevance: H1, method.

19. **Amat, Michalski and Stoltz (2018). "Fundamentals and exchange rate forecastability with simple machine learning methods." Journal of International Money and Finance 88, 1-24.** https://ideas.repec.org:443/a/eee/jimfin/v88y2018icp1-24.html (code and data: https://data.mendeley.com/datasets/yxystdn2hz/2)
    Ridge regression and simple online learners using fundamentals improved on OLS but did not always beat the random walk. The replication files are public, which makes it a good first exercise for us. Relevance: method.

20. **Zhang (2025). "Interpretable Machine Learning for Macro Alpha: A News Sentiment Case Study." arXiv:2505.16136. Preprint, not peer reviewed.** https://arxiv.org/abs/2505.16136
    Builds FinBERT sentiment from free GDELT news and feeds it to XGBoost to predict next-day EUR/USD, USD/JPY and Treasury futures. It reports cost-adjusted Sharpe ratios above 4.65 out of sample. We think a number that high is a warning sign of leakage or overfitting, not a target, but the free data pipeline is worth copying. Relevance: new, method.

21. **Glasserman and Lin (2023). "Assessing Look-Ahead Bias in Stock Return Predictions Generated By GPT Sentiment Analysis." arXiv:2309.17322.** https://arxiv.org/abs/2309.17322
    LLMs trained on data that overlaps the backtest can "remember" what happened next, which inflates results. Any LLM news signal we build must only be scored on text published after the model's training cutoff. Relevance: method.

### Overfitting, replication and decay

22. **Hou, Xue and Zhang (2020). "Replicating Anomalies." Review of Financial Studies 33(5), 2019-2133.** https://doi.org/10.1093/rfs/hhy131
    65% of 452 equity anomalies fail a basic t-test of 1.96 once small stocks are handled properly, and 82% fail a multiple-testing hurdle of 2.78. We should use the higher hurdle for any signal we searched for. Relevance: method.

23. **McLean and Pontiff (2016). "Does Academic Research Destroy Stock Return Predictability?" Journal of Finance 71(1), 5-32.** https://doi.org/10.1111/jofi.12365
    Equity anomaly returns were 26% lower out of sample and 58% lower after publication. We should expect any published FX effect to be weaker now than in its paper. Relevance: method.

24. **Hutchinson, Kyziropoulos, O'Brien, O'Reilly and Sharma (2022). "Are carry, momentum and value still there in currencies?" International Review of Financial Analysis 83, 102245.** https://doi.org/10.1016/j.irfa.2022.102245
    After publication, FX carry, momentum and value lost much of their performance. Replicated strategies went from an average Sharpe ratio of +0.39 to -0.32 out of sample. This is the single most important paper for H1 and H2, and it suggests both may fail on recent data. Relevance: H1, H2, method.

25. **Neely, Weller and Ulrich (2009). "The Adaptive Markets Hypothesis: Evidence from the Foreign Exchange Market." Journal of Financial and Quantitative Analysis 44(2), 467-488.** https://doi.org/10.1017/S0022109009090103 (SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1403345)
    Profits from technical FX trading rules shrank over time, which fits a market that slowly learns rather than one that is always efficient. Supports testing H2 on rolling windows rather than one long sample. Relevance: H2.

### Also verified, shorter notes

- **Burnside, Eichenbaum, Kleshchelski and Rebelo (2011). "Do Peso Problems Explain the Returns to the Carry Trade?" Review of Financial Studies 24(3), 853-891.** https://www.nber.org/papers/w14054. Carry payoffs may reflect rare bad states that have not shown up in the sample. Relevance: H1.
- **Jordà and Taylor (2012). "The carry trade and fundamentals: Nothing to fear but FEER itself." Journal of International Economics 88, 74-90.** http://www.nber.org/papers/w15518.pdf. Adding a fair-value term to carry reduced crash losses. Relevance: H1, new.
- **Hsu, Taylor and Wang (2016). "Technical trading: Is it still beating the foreign exchange market?" Journal of International Economics 102, 188-208.** https://doi.org/10.1016/j.jinteco.2016.03.012. Tests over 21,000 rules on 30 currencies with a correction for data snooping and still finds predictability. Read together with Neely et al. and Hutchinson et al., which point the other way. Relevance: H2.
- **Gu, Kelly and Xiu (2020). "Empirical Asset Pricing via Machine Learning." Review of Financial Studies 33(5), 2223-2273.** https://doi.org/10.1093/rfs/hhaa009. Trees and neural nets did best on equities, and the strongest signals were momentum, liquidity and volatility. Relevance: method.
- **Ding, Zhao, Deng, Abdullah and Dewi (2024). "EUR-USD Exchange Rate Forecasting Based on Information Fusion with Large Language Models and Deep Learning Methods." arXiv:2408.13214. Preprint.** https://arxiv.org/abs/2408.13214. Reports about 10% lower forecast error than baselines. It reports error metrics, not trading returns after costs. Relevance: new.
- **Lopez-Lira and Tang (2023). "Can ChatGPT Forecast Stock Price Movements? Return Predictability and Large Language Models." arXiv:2304.07619.** https://arxiv.org/abs/2304.07619. GPT-4 headline scores predicted the following drift in stocks, mostly small stocks and bad news. This is equities, not FX. Relevance: new.
- **Jensen, Kelly and Pedersen (2023). "Is There a Replication Crisis in Finance?" Journal of Finance 78(5), 2465-2518.** https://doi.org/10.1111/jofi.13249. The counterpoint to Hou et al.: most factors replicate when grouped into themes. Code is public. Relevance: method.
- **Arnott, Harvey and Markowitz (2019). "A Backtesting Protocol in the Era of Machine Learning." Journal of Financial Data Science 1(1), 64-74.** Author copy: https://people.duke.edu/~charvey/Research/Published_Papers/SSRN-id3275654.pdf. A checklist we can adopt almost as is. Relevance: method.
- **Bailey, Borwein, Lopez de Prado and Zhu (2014). "Pseudo-Mathematics and Financial Charlatanism: The Effects of Backtest Overfitting on Out-of-Sample Performance." Notices of the AMS 61(5), 458.** https://www.ams.org/notices/201405/rnoti-p458.pdf. Short and free. Shows how few trials it takes to get an impressive but false backtest. Relevance: method.
- **Gençay (2026). "What survives honest evaluation? Leakage-safe, search-aware assessment of LLM-driven trading strategy discovery." arXiv:2608.27734. Preprint, not peer reviewed.** https://arxiv.org/abs/2608.27734. Under leakage controls and a penalty for how many strategies were searched, every LLM-discovered strategy was rejected and only passive benchmarks survived. Relevance: method.

## Books and courses

| Item | What it is | Free? | Link |
|---|---|---|---|
| Carver, *Leveraged Trading* (Harriman House, 2019) | How to size and run a simple FX/CFD system without blowing up | No | https://www.harriman-house.com/authors/robert-carver/48419 |
| Carver, *Advanced Futures Trading Strategies* (Harriman House, 2023) | 30 strategies with rules and historical results, including carry and trend | No | https://www.systematicmoney.org/advanced-futures-information |
| pysystemtrade (Carver's open-source backtester) | Python code implementing the *Systematic Trading* framework | Yes | https://github.com/pst-group/pysystemtrade |
| Chan, *Quantitative Trading*, 2nd ed. (Wiley, 2021) | Practical intro to building and testing a small quant strategy | No | https://www.wiley.com/en-us/Quantitative+Trading:+How+to+Build+Your+Own+Algorithmic+Trading+Business,+2nd+Edition-p-9781119800064 |
| Chan, *Algorithmic Trading: Winning Strategies and Their Rationale* (Wiley, 2013) | Mean reversion and momentum, with attention to backtest pitfalls | No | Year from a bibliography listing; publisher page not checked |
| Lopez de Prado, *Machine Learning for Asset Managers* (Cambridge Elements, 2020) | Short companion to his 2018 book, focused on avoiding false discoveries | No (low cost) | https://doi.org/10.1017/9781108883658 |
| Jansen, *Machine Learning for Algorithmic Trading*, 2nd ed. (Packt, 2020) | End-to-end ML pipeline for trading, about 150 notebooks | Book no, code yes | https://github.com/stefan-jansen/machine-learning-for-trading |
| Pedersen, *Efficiently Inefficient* (Princeton UP, 2015) | Why carry, trend and value earn money and when they fail | No | https://www.aqr.com/Insights/Research/Book/Efficiently-Inefficient |
| Ilmanen, *Expected Returns* (Wiley, 2011) | Reference on carry, value and trend across asset classes | No | https://www.aqr.com/Insights/Research/Book/Expected-Returns-An-Investors-Guide-to-Harvesting-Market-Rewards |
| Quantopian Lecture Series (archive) | About 50 notebooks on statistics, backtesting and overfitting | Yes | https://github.com/quantopian/research_public/tree/master/notebooks/lectures ; Python 3 version with free sample data: https://github.com/quantrocket-codeload/quant-finance-lectures |
| QuantConnect Learning Center and Boot Camp | Interactive tutorials on the open-source LEAN engine | Yes | https://www.quantconnect.com/docs/v2/cloud-platform/learning-center |
| Georgia Tech, *Machine Learning for Trading* (CS 7646, Tucker Balch) | Intro course: pandas, backtesting, simple ML and RL | Yes (Udacity videos; we did not confirm the Udacity page is still live) | https://lucylabs.gatech.edu/ml4t |
| MIT OCW 18.S096, *Topics in Mathematics with Applications in Finance* (2013) | Math foundations with lectures from industry practitioners | Yes | https://ocw.mit.edu/courses/18-s096-topics-in-mathematics-with-applications-in-finance-fall-2013/ |
| Coursera, *Machine Learning for Trading* (Google Cloud and NYIF) | 3 courses on ML and RL for trading | Unverified: Coursera often lets you audit for free, certificate is paid | https://coursera.org/specializations/machine-learning-trading |
| Coursera, *Investment Management with Python and Machine Learning* (EDHEC) | 4 courses on portfolio construction and ML in Python | Same as above, unverified | https://online.edhec.edu/en/online-programmes/data-science-and-machine-learning-for-asset-management/ |
| WorldQuant University MSc in Financial Engineering | Accredited 2-year online master's | Yes, tuition free. Next start 5 January 2027, deadline 29 December 2026 | https://www.wqu.edu/mscfe |

Our suggested order: Bailey et al. (2014) and Arnott, Harvey and Markowitz (2019) first, since both are short and free. Then the Quantopian lectures on overfitting. Then Carver's *Leveraged Trading* for position sizing and costs.

## Hypotheses the literature suggests

We think the retail-bot space is crowded with price-only technical rules on single pairs. The literature points to four tests that use only free daily data (FRED, central bank rates, public commodity prices, the FOMC calendar) and that we could defend in a paper.

**N1 (now [HYP-0005](../hypotheses/0005-dollar-carry-beats-pair-carry.md)). Dollar carry beats pair-by-pair carry, after costs and after 2008.**
Go long or short an equal-weight basket of G10 currencies against the USD, depending on the average interest rate gap (Lustig, Roussanov and Verdelhan 2014; Daniel, Hodrick and Lu 2017). This is one trade, so costs are low. Compare it to classic carry on Sharpe, skew and worst drawdown. This replaces or sharpens H1.

**N2 (folded into [HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md)). Commodity prices lead commodity currencies by days, and the link broke after 2020.**
Test whether yesterday's change in a country-specific commodity index (oil for CAD and NOK, metals for AUD, a dairy or broad index for NZD) predicts today's or this week's currency move (Kohlscheen, Avalos and Schrimpf 2017). Then split the sample at 2020, because Rees (2025) shows the oil and dollar relationship flipped. This is a sharper, testable version of H3. A finding that the edge vanished after 2020 would itself be publishable.

**N3 (now [HYP-0006](../hypotheses/0006-short-the-dollar-on-fomc-days.md)). Short the dollar on scheduled FOMC days.**
A calendar trade from Mueller, Tahbaz-Salehi and Vedolin (2017). It needs only the public FOMC calendar and daily closes, and it trades about 8 days a year. We would test whether it survived after the paper came out in 2017.

**N4 (now [HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md)). The honest benchmark is "S&P plus FX", not "FX versus S&P".**
Kroencke, Schindler and Schrimpf (2014) and Barroso and Santa-Clara (2015) find that FX styles add value next to stocks, not instead of them. We suggest we report two results: our FX strategy alone against the S&P, and a 50/50 or volatility-matched mix of the two against the S&P alone. This makes the question answerable even if FX alone loses.

**What will probably fail, based on what we read.**
- Plain carry, momentum and value on recent data. Hutchinson et al. (2022) found the published versions turned negative out of sample. We should expect H1 and H2 to disappoint and plan the write-up so a negative result is still useful.
- Beating the S&P outright with FX alone. We found no paper showing it, and the S&P had a strong run in recent years. We could not find a source that states a single verified long-run S&P Sharpe figure, so we will compute it ourselves for the same window.
- Intraday news trading. The effects in Faust et al. (2007) and Evans and Lyons (2008) last minutes and need tick data or order flow. The meta-analysis by Bortnikova (2026) finds the average effect is close to zero after correcting for publication bias.
- LLM or news-sentiment signals with very high backtested Sharpe ratios. Glasserman and Lin (2023) show that LLMs can leak future information into backtests. Gençay (2026, preprint) rejected every LLM-discovered strategy under strict controls. If we try one, we should score it only on news published after the model's training cutoff.
- Any signal we pick after looking at many. With a few dozen variations, a good-looking backtest is easy to get by chance (Bailey et al. 2014). We should write down our trials and apply the deflated Sharpe ratio we already plan to use.

## What we could not verify

- A peer-reviewed paper on natural gas prices and NOK or other gas-exporter currencies at daily frequency.
- The final journal version (if any) of Filippou, Rapach, Taylor and Zhou (2020).
- DOIs for Menkhoff et al. (2017), Kohlscheen et al. (2017), Jordà and Taylor (2012) and Burnside et al. (2011). We confirmed the venue and pages through RePEc, NBER or the journal's own PDF, and gave those links instead.
- Whether the Udacity version of the Georgia Tech course and Coursera's free audit option are still available today.
- The publisher page for Chan (2013).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [INT-0001: Initial intent](../intent/0001-initial-intent.md)
- [HYP-0001: Currency carry still pays after costs](../hypotheses/0001-carry-still-pays-after-costs.md)
- [HYP-0002: Currency trends persist over months](../hypotheses/0002-currency-trends-persist.md)
- [HYP-0003: Commodity currencies catch up to their commodity](../hypotheses/0003-commodity-currencies-catch-up.md)
- [HYP-0004: Macro and energy surprises move currencies in a predictable direction](../hypotheses/0004-macro-surprises-move-fx-predictably.md)
- [HYP-0005: Dollar carry beats pair-by-pair carry](../hypotheses/0005-dollar-carry-beats-pair-carry.md)
- [HYP-0006: The dollar weakens on scheduled Fed decision days](../hypotheses/0006-short-the-dollar-on-fomc-days.md)
- [HYP-0007: The S&P 500 plus an FX strategy beats the S&P 500 alone](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md)
- [EXP-0001: Baseline backtests of carry, trend and the commodity gap](../experiments/0001-baseline-backtests.md)
- [EXP-0002: The baseline gauntlet for carry, trend and the commodity gap](../experiments/0002-baseline-gauntlet.md)
- [RES-0002: Open-source projects and public results](0002-open-source-and-public-results.md)
- [RES-0003: What practitioners say in forums](0003-forums-and-practitioners.md)
- [RES-0004: Exchange rate theory primer](0004-exchange-rate-theory-primer.md)
- [GDE-0003: Writing and filing docs](../guides/0003-writing-docs.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
<!-- backlinks:end -->
