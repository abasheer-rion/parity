---
id: RES-0002
title: Open-source projects and public results
type: research
status: current
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [crypto, fx, method, open-source, strategy]
related: [EXP-0001, HYP-0001, HYP-0003, RES-0001, RES-0003]
---

# Open-source projects and public results

## Summary

Other people's code, live logs and post-mortems for strategies like ours, including the same ideas in crypto, and what worked and what did not. Gathered 2026-10-20. Repo numbers (stars, license, last commit) come from the GitHub API on that date. Every result has a link, and anything we could not open ourselves is marked unverified. We did not clone or run anything yet.

1. The closest public match to what we want is Rob Carver's pysystemtrade. It trades FX futures and commodity futures with trend and carry rules. It ships sample data for 252 instruments, and Carver publishes yearly live results after costs.
2. Simple FX carry on its own has been weak lately. One public G10 backtest shows a Sharpe of 0.02 for 2015 to 2025. The long-run index figure is about 0.29.
3. Macro inputs for FX (terms of trade, growth, inflation) have public research behind them, mostly from Macrosynergy. The reported Sharpe ratios are modest, around 0.3 to 0.6. Commodity prices seem to help at a daily horizon for CAD but not at monthly horizons.
4. In crypto, funding-rate carry looked very strong from 2020 to 2023. It decayed to roughly zero or negative in 2025 and 2026, and three separate sources show this.
5. The failure pattern repeats across almost every source: backtest Sharpe does not predict live Sharpe, costs decide the outcome, and edges decay once known.

How this compares with our own baseline ([EXP-0001](../experiments/0001-baseline-backtests.md)): our G10 carry has a Sharpe of 0.39 from 2000 to 2026, higher than both public figures above (0.02 for 2015 to 2025, 0.29 for the 1989 to 2009 index). It could be the sample period, our monthly rebalance, or a bug. We will not trust it until our carry series roughly matches the free academic portfolio data listed below.

## Open-source frameworks

| Framework | GitHub | License | Stars | Last commit (default branch) | Language | Markets | What it is good for |
|---|---|---|---|---|---|---|---|
| pysystemtrade | [pst-group/pysystemtrade](https://github.com/pst-group/pysystemtrade) | GPL-3.0 | 3,559 | 2026-10-16 | Python | Futures (incl. FX and commodity futures), via Interactive Brokers | Full Carver-style system: forecasts, vol targeting, carry, cost model, live trading. Closest to our idea. |
| NautilusTrader | [nautechsystems/nautilus_trader](https://github.com/nautechsystems/nautilus_trader) | LGPL-3.0 | 30,383 | 2026-10-21 (UTC) | Rust core, Python API | Crypto venues, Interactive Brokers, data from Databento and Tardis ([integrations](https://nautilustrader.io/docs/latest/integrations/)) | Event-driven, tick-level backtests that use the same code as live. Heavy for a proof of concept. |
| QuantConnect Lean | [QuantConnect/Lean](https://github.com/QuantConnect/Lean) | Apache-2.0 | 22,121 | 2026-10-20 | C#, Python strategies | Equities, FX, futures, options, crypto | Multi-asset engine. The hosted cloud has FX data ([FX data docs](https://www.quantconnect.com/docs/v2/writing-algorithms/datasets/quantconnect/forex-data)) and public research notebooks. |
| vectorbt | [polakowo/vectorbt](https://github.com/polakowo/vectorbt) | Apache-2.0 with Commons Clause (no selling) | 9,461 | 2026-10-19 | Python | Any price series | Very fast vectorised backtests and parameter sweeps. Fast sweeps also make overfitting easy. |
| backtrader | [mementum/backtrader](https://github.com/mementum/backtrader) | GPL-3.0 | 23,528 | 2023-04-19 | Python | Any, has broker adapters | Popular event-driven backtester. Effectively unmaintained since 2023. |
| zipline-reloaded | [stefan-jansen/zipline-reloaded](https://github.com/stefan-jansen/zipline-reloaded) | Apache-2.0 | 1,967 | 2026-10-17 | Python | Mostly US equities, daily | Maintained fork of Quantopian's engine. Pairs with [machine-learning-for-trading](https://github.com/stefan-jansen/machine-learning-for-trading) (MIT, 21,480 stars). Poor fit for FX. |
| bt | [pmorissette/bt](https://github.com/pmorissette/bt) | MIT | 2,998 | 2026-10-20 | Python | Any price series | Simple portfolio allocation and rebalancing backtests. Good for "monthly FX basket vs SPY" comparisons. |
| Qlib | [microsoft/qlib](https://github.com/microsoft/qlib) | MIT | 49,561 | 2026-10-08 | Python | Equities (China and US datasets) | ML research pipeline with model benchmarks. Equity cross-section, not FX. |
| FinRL | [AI4Finance-Foundation/FinRL](https://github.com/AI4Finance-Foundation/FinRL) | MIT | 16,767 | 2026-10-20 | Python | Equities, crypto | Reinforcement learning for trading. Results we saw are backtests. Treat as a teaching tool. |
| freqtrade | [freqtrade/freqtrade](https://github.com/freqtrade/freqtrade) | GPL-3.0 | 55,671 | 2026-10-20 | Python | Crypto only (exchanges via CCXT) | Crypto bot with backtest, dry run and live modes. Its built-in lookahead and recursive bias checks are worth copying ([docs](https://www.freqtrade.io/en/stable/lookahead-analysis/)). |
| Hummingbot | [hummingbot/hummingbot](https://github.com/hummingbot/hummingbot) | Apache-2.0 | 20,609 | 2026-09-22 | Python | Crypto CEX and DEX | Market making and arbitrage. Not built for directional macro signals. |
| Jesse | [jesse-ai/jesse](https://github.com/jesse-ai/jesse) | MIT | 8,675 | 2026-10-17 | Python | Crypto | Clean candle-by-candle crypto backtester with a simple strategy API. |
| OctoBot | [Drakkar-Software/OctoBot](https://github.com/Drakkar-Software/OctoBot) | GPL-3.0 | 6,833 | 2026-10-07 | Python | Crypto | Plugin "evaluators", including Reddit, Google Trends, Telegram signals and a GPT evaluator ([docs](https://www.octobot.cloud/en/guides/octobot-trading-modes/chatgpt-trading)). The closest open bot to news-driven trading, but crypto only. |
| Zenbot | [DeviaVir/zenbot](https://github.com/DeviaVir/zenbot) | MIT | 8,257 | 2022-02-14 (archived) | JavaScript (Node.js, MongoDB) | Crypto | Technical-indicator crypto bot, now archived. Its README says "the default trade parameters will underperform vs. a buy-hold strategy". |

Notes:

- pysystemtrade moved from `robcarver17` to the `pst-group` organisation in January 2026. Andy Geach has been the primary maintainer since 2024 ([README](https://github.com/pst-group/pysystemtrade)).
- pysystemtrade ships sample data for 252 instruments under `data/futures/adjusted_prices_csv`. This includes AUD, CAD, CHF, EUR, GBP, JPY and cross-rate FX futures, plus Brent and other commodities. The sample EUR series runs from 1999-06-15 to 2024-03-28 (checked through the GitHub API). It also ships per-instrument cost files (`spreadcosts.csv`, `instrumentconfig.csv`).

### What "zenpilot" probably means

- We found no trading tool called ZenPilot.
- **ZenPilot** is a Pittsburgh consultancy that sets up ClickUp project management ([about](https://www.zenpilot.com/about/)). It has nothing to do with trading.
- A few tiny GitHub repos use the name. The main one is a browser helper for Claude in the Zen browser ([beSaif/zenpilot](https://github.com/beSaif/zenpilot), 1 star). None of them trade.
- Our best guess is **Zenbot**, the archived Node.js crypto bot listed above. Two other possibilities are **Zipline**, which sounds similar, and a paid retail product called **Zennbot** ([Trustpilot page](https://www.trustpilot.com/review/zennbot.com)), which we did not look into. We should ask the user which one they meant.

## Public strategies with reported results

### FX carry, FX momentum, commodity currencies, macro FX

- **Rob Carver, live futures system (includes FX futures).** He runs about 100 instruments with trend and carry, live since 2014, and publishes results after costs.
  - UK tax year to April 2025: -16.3%. Over the same period the SG CTA index returned -17.9% and AHL -18.2%. His CAGR since 2015 is 12.0%, with a Sharpe of 0.76 ([year 11](https://qoppac.blogspot.com/2025/04/annual-performance-update-returneth.html)). Pure momentum rules did worst. Relative carry and skew rules made money.
  - Year to April 2026: +23.7%, behind SG CTA (29.9%) and AHL (30.3%). His long-run Sharpe is 0.80, against 0.54 for SG CTA. All-in costs were 0.88% of capital. He says his execution algorithm saved 78bp ([year 12](https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html)).
  - On FX specifically, he says FX has a "crap SR long only" but does "pretty well trend following". He finds carry is much less linked to trend returns ([Jan 2026 post](https://qoppac.blogspot.com/2026/01/are-markets-that-are-good-for-trend.html)).
  - He finds trend returns have roughly halved since 2010 across all instruments, which he puts down to the market environment. Carry looks more like a decaying signal ([Oct 2025 post](https://qoppac.blogspot.com/2025/10/is-degradation-of-trend-following.html)).
- **BenyaminSuicmez/FX_Carry_Trade_Backtest** ([repo](https://github.com/BenyaminSuicmez/FX_Carry_Trade_Backtest)). G10 against USD, long the top 3 and short the bottom 3 by 3-month OECD rates, rebalanced quarterly, with prices from Yahoo. It lags the rate data one quarter to avoid lookahead and models costs (1bp per rebalance plus a 30bp yearly funding spread).
  - 2015 to 2025: 0.13% a year, 8.3% volatility, Sharpe 0.02, maximum drawdown -15.4%.
  - The interest carry earned about +19.5% in total. Currency moves took away about -12.8%. The 2015 Swiss franc shock is the example it gives of the short side losing.
- **Quantpedia FX carry entry** ([page](https://quantpedia.com/strategies/fx-carry-trade)). It cites the Deutsche Bank carry index for 1989 to 2009: 7.27% a year, 9.6% volatility, Sharpe 0.29, maximum drawdown -32%.
- **Academic FX carry baselines.**
  - Daniel, Hodrick and Lu find dollar-neutral G10 carry is strongly negatively skewed with large drawdowns. Most of the reward comes from the dollar-exposure part ([paper](https://cfr.ivo-welch.org/forthcoming/papers/daniel-hodrick-lu.pdf)).
  - Free portfolio data to check our numbers against:
    - Lustig, Roussanov and Verdelhan currency portfolios, monthly from 1983 ([Verdelhan data page](https://web.mit.edu/adrienv/www/Data.html)).
    - AQR time-series momentum factors, which include currencies, from 1985 ([AQR TSMOM](https://www.aqr.com/Insights/Datasets/Time-Series-Momentum-Factors-Monthly)).
    - AQR value and momentum factors, which include currencies, from 1972 ([AQR VME](https://www.aqr.com/Insights/Datasets/Value-and-Momentum-Everywhere-Factors-Monthly)).
- **QuantConnect research notebooks.**
  - "Combined Carry and Trend" re-creates strategy 11 from Carver's 2023 book on 10 futures. It reports Sharpe 0.749 for July 2020 to July 2023, against 0.294 for trend alone. Costs are not modelled, and the authors list this as further work ([page](https://www.quantconnect.com/research/16001/combined-carry-and-trend/)).
  - A volatility-regime version of the same idea reports Sharpe 0.944 over the same three years, again with costs not disclosed ([page](https://www.quantconnect.com/research/15989/futures-trend-following-and-carry-in-different-risk-regimes/)). Three years is a short sample.
  - The "Yen Carry Trade" micro study ran USDJPY against BIL at 100x margin. It reports a Sharpe of 16 for most of 2024, then a 60% drawdown in the final four weeks, through August 2024 ([page](https://www.quantconnect.com/research/17843/micro-study-yen-carry-trade/)). This is the clearest public example of carry's crash risk.
- **Macrosynergy (macro data for FX).** The Python package is [macrosynergy/macrosynergy](https://github.com/macrosynergy/macrosynergy) (BSD-3-Clause, 197 stars, pushed 2026-10-19). Their website blocked our fetch tool (HTTP 403), so the numbers below come from search-result excerpts of their pages. **Unverified** by us on the page itself.
  - Terms-of-trade changes predicted FX forward returns since 2000. They report 51.3% monthly accuracy, and Sharpe ratios of about 0.3 for a relative FX strategy, on 27 developed and emerging currencies ([terms of trade as trading signals](https://macrosynergy.com/research/terms-of-trade-as-trading-signals/)).
  - Other notebooks cover regression-based FX signals ([notebook](https://macrosynergy.com/academy/notebooks/regression-based-fx-signals/)).
  - Their data (JPMaQS) is paid. There is a free sample on Kaggle ([dataset](https://www.kaggle.com/datasets/macrosynergy/fixed-income-returns-and-macro-trends)) and a free academic data programme ([academic liaison](https://macrosynergy.com/academy/academic-liaison/)). As students we should apply.
- **Commodity currencies.** Ferraro, Rogoff and Rossi find oil prices predict USD/CAD out of sample at a daily frequency, but not at monthly or quarterly ones. The predictive ability is short-lived and varies over time ([NBER w17998](https://www.nber.org/system/files/working_papers/w17998/w17998.pdf)). For us this means a commodity signal is more likely to show up at a daily horizon than in a monthly rebalance.
- **Inpirical/fxaa** ([repo](https://github.com/Inpirical/fxaa), MIT, R). A long-term FX momentum codebase with a documentation site. We did not find reported results. **Unverified.**
- **News or sentiment FX.** We found no public FX repo with credible reported results. The nearest is a GDELT-versus-FX correlation dashboard with no trading results ([justvibes99/gdelt-forex](https://github.com/justvibes99/gdelt-forex), 0 stars).
- **Nearest equity evidence on news sentiment.**
  - Lopez-Lira and Tang find GPT headline scores predict next-day stock returns. Lopez-Lira himself expects the effect to fade as more people use these tools ([paper](https://arxiv.org/abs/2304.07619), [CNBC interview](https://www.cnbc.com/2023/04/12/chatgpt-may-be-able-to-predict-stock-movements-finance-professor-says.html)).
  - Glasserman and Lin show LLM backtests can carry lookahead bias from the model's training data. They propose anonymising the text as a check ([paper](https://arxiv.org/abs/2309.17322)).

### Crypto equivalents

- **Funding-rate carry (long spot, short perpetual).**
  - Borri, Liu, Tsyvinski and Wu report a Sharpe of 6.45 for 2020 to 2025 on Binance BTC. It falls to 4.06 from 2024 and turns negative in 2025 ([arXiv 2510.14435](https://arxiv.org/html/2510.14435v4), building on Schmeling, Schrimpf and Todorov, [BIS WP 1087](https://econpapers.repec.org/RePEc:bis:biswps:1087)).
  - Robot Wealth says the trade "has gotten harder as more people chase it". They describe carry as paying "a little most of the time but whack[ing] you hard occasionally" ([article](https://robotwealth.com/the-art-and-science-of-trading-carry/)).
  - Open repos exist, for example [aoki-h-jp/funding-rate-arbitrage](https://github.com/aoki-h-jp/funding-rate-arbitrage) (310 stars). They do not publish audited results.
- **Cross-sectional crypto factors.** Robot Wealth tests carry, momentum and breakout on Binance perpetuals from 2019, with R code. It is educational, with no live results or cost figures ([article](https://robotwealth.com/quantifying-and-combining-crypto-alphas/)).
- **Crypto momentum, academic.** Liu and Tsyvinski find strong time-series momentum at one- to four-week horizons, and that investor-attention proxies predict returns ([NBER w24877](https://www.nber.org/system/files/working_papers/w24877/w24877.pdf)).
- **Individual write-ups.** These are single authors on dev.to. The numbers are their own and **unverified** beyond the post.
  - "I built a crypto trading bot. It lost to doing nothing" (Aug 2024). A Donchian breakout with walk-forward testing and Kraken fees of 0.26% per side made +4.33% over 3 years out of sample. Buy-and-hold BTC made +127.77% over the same period. Fees ate 11.4% a year on a 4-hour timeframe ([post](https://dev.to/nar1frames/i-built-a-crypto-trading-bot-it-lost-to-doing-nothing-355a)).
  - "1,285 strategy sleeves, frozen before the test" (Oct 2026). Stock and crypto-carry selections were fixed with a hash before testing. The test-period Sharpe was 3.42 after costs, but -0.44 since January 2025. The author links the crypto collapse to funding rates falling from 0.0449% to 0.0003% ([post](https://dev.to/arhancanli/1285-strategy-sleeves-frozen-before-the-test-the-year-by-year-table-is-the-warning-2np4)).
  - "Three crypto edges, three different killers" (Sep 2026). Mean reversion had a gross Sharpe of 7 to 13 but was rejected after costs. Funding carry went from +48.6% in development to -0.5% on holdout, then +1.31% on a rerun the author could not reconcile. A momentum peak at a 14-day lookback sat between much weaker neighbouring settings ([post](https://dev.to/pavel_kkkkazantsev/three-crypto-edges-three-different-killers-1i6o)).

## Public live logs, post-mortems and competitions

- **Rob Carver's blog (qoppac).** About 12 years of public live results after costs, with benchmark comparisons and breakdowns by rule and asset class ([start page](https://qoppac.blogspot.com/p/systematic-trading-start-here.html)). Links to the yearly reviews are in 2a. He also wrote a 2019 book on margin trading of FX, CFDs and spread bets with a one-rule "Starter System" ([publisher page](https://www.systematicmoney.org/leveraged-trading)). It is the most direct guide for retail spot FX.
- **Quantopian.**
  - The firm's own study of 888 user algorithms found backtest Sharpe had almost no power to predict out-of-sample Sharpe (R² < 0.025). The more backtests an author ran, the bigger the gap. Volatility and drawdown predicted better. A non-linear classifier reached R² of 0.17 ([paper](https://www.semanticscholar.org/paper/All-That-Glitters-Is-Not-Gold:-Comparing-Backtest-a-Wiecki-Campbell/b028c2d0b2145e85d543fb21ad3fcf896c932ab5), [Quantpedia summary](https://quantpedia.com/quantopians-academic-paper-about-in-vs-out-of-sample-performance-of-trading-alg/)).
  - Point72 committed up to $250M in 2016. The market-neutral fund underperformed for about two years. Investor money was returned from February 2020 and the platform shut in November 2020 ([Business of Business](https://www.businessofbusiness.com/articles/how-quantopian-died-shut-down-quant-investment-robinhood/), [Wikipedia](https://en.wikipedia.org/wiki/Quantopian)).
  - The common reading is "you can't crowdsource alpha" from overfit backtests ([Sunset write-up](https://www.sunsethq.com/blog/why-did-quantopian-fail)). This is commentary, not data.
- **QuantConnect Alpha Streams.** Discontinued around February 2022. QuantConnect's stated reason was that filtering for strategies that do well in all regimes "results in strong overfitting" ([forum announcement](https://www.quantconnect.com/forum/discussion/13441/alpha-streams-refactoring-2-0/)).
- **Numerai.**
  - 2024: +25.45% net with a Sharpe of 2.75 ([Numerai blog](https://blog.numer.ai/jpmorgan-secures-500m-capacity/)).
  - 2023: down about 17% (Numerai One) to 21% (Supreme), per a community thread ([Portfolio123](https://community.portfolio123.com/t/numerai-2023-performance/65670)). We found no official root-cause write-up. One interview remark says exposure to volatility was raised just before the drawdown, which is **unverified** second-hand reporting ([forum](https://forum.numer.ai/t/funds-recent-performance/6660)).
  - Lesson: even a large, well-run model ensemble can lose 17% in a year.
- **Kaggle competitions.**
  - G-Research Crypto (2021 to 2022): 14 coins, weighted Pearson correlation, a 3-month live scoring period. All top three teams used LightGBM. Feature engineering mattered far more than model choice. The leaderboard was very noisy ([G-Research wrap-up](https://www.gresearch.com/news/wrapping-up-the-g-research-crypto-forecasting-competition/)).
  - Optiver Trading at the Close (2023): the 1st place solution blended CatBoost, GRU and Transformer models on about 300 features, with online retraining. This comes from search-result summaries of the [Kaggle post](https://www.kaggle.com/competitions/optiver-trading-at-the-close/discussion/487446), which did not render for us. **Unverified** in detail.
  - Jane Street Real-Time Market Data Forecasting (2024 to 2025): the 2nd place approach used GRUs with small daily online updates on the previous day's labels. This comes from a reproduction repo ([cweill/jane-street-causal-forecasting](https://github.com/cweill/jane-street-causal-forecasting)) and a [Kaggle walkthrough video](https://www.youtube.com/watch?v=lfzzPZZyzjE). **Unverified** against the original write-up.
  - What carries over to us: these are short-horizon, low-signal tasks. Winners rely on careful features, time-aware validation and frequent retraining, not exotic models.
- **freqtrade community.**
  - The strategies repo says the strategies are "for educational purposes only". It warns that results depend heavily on pairs, timeframe and timerange ([README](https://github.com/freqtrade/freqtrade-strategies)).
  - Users report dry-run signals that differ from backtests over the same period ([issue #12894](https://github.com/freqtrade/freqtrade/issues/12894)).
  - A well-known "backtesting traps" post shows a 0.1% trailing-stop strategy making "2506% profit" in 11 days of backtest, purely from unrealistic fills inside each candle ([post](https://brookmiles.github.io/freqtrade-stuff/2021/04/12/backtesting-traps/)).
  - The community testing site strat.ninja now redirects to what looks like a parked domain (checked 2026-10-20). We could not use it.

## Comparison table

| Project | Market | Signal type | Data frequency | Reported result | Live or backtest | Costs modelled? | What worked | What failed | Lessons for us |
|---|---|---|---|---|---|---|---|---|---|
| Carver / pysystemtrade ([y11](https://qoppac.blogspot.com/2025/04/annual-performance-update-returneth.html), [y12](https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html)) | ~100 futures incl. FX, commodities | Trend, carry, relative value, skew | Daily | CAGR 12.0% since 2015. Sharpe 0.80 long run. -16.3% then +23.7% in the last two years | Live | Yes, measured (0.85 to 0.88% of capital a year) | Diversifying across many instruments and rules. Relative carry and skew in 2024-25 | Pure momentum in choppy 2024-25 | Copy his structure. Expect losing years of 15% or more even with a Sharpe near 0.8 |
| FX_Carry_Trade_Backtest ([repo](https://github.com/BenyaminSuicmez/FX_Carry_Trade_Backtest)) | G10 FX | Rate-differential carry, top 3 vs bottom 3 | Quarterly rebalance, daily prices | Sharpe 0.02, 2015-2025 | Backtest | Yes, simple | Carry income itself (+19.5%) | Currency moves (-12.8%), CHF 2015 | Plain carry alone will probably not beat SPY. A good honest baseline |
| DB carry index via Quantpedia ([page](https://quantpedia.com/strategies/fx-carry-trade)) | 10-20 FX | Carry | Monthly | Sharpe 0.29, max DD -32%, 1989-2009 | Index (backtest-like) | Unclear | Long-run premium | 2008 crash | Size for crash risk |
| QC Combined Carry and Trend ([page](https://www.quantconnect.com/research/16001/combined-carry-and-trend/)) | 10 futures (no FX) | EMAC trend plus carry | Daily | Sharpe 0.749 vs 0.294 trend only | Backtest, 3 years | No | Adding carry to trend | Not tested | Shows the combination helps, but the sample is too short to trust |
| QC Yen carry micro study ([page](https://www.quantconnect.com/research/17843/micro-study-yen-carry-trade/)) | USDJPY | Single carry trade, 100x margin | Daily | Sharpe 16, then a 60% drawdown | Backtest, 8 months | Interest only | Steady carry while calm | August 2024 unwind | A high Sharpe over a short calm period means little |
| Macrosynergy terms of trade ([page](https://macrosynergy.com/research/terms-of-trade-as-trading-signals/)) | 27 DM and EM FX | Macro (terms of trade) | Monthly, weekly | Sharpe ~0.3 (relative FX), accuracy 51.3% (unverified, page blocked) | Backtest | Unclear | Point-in-time macro data | EM signal only after 2008 | Macro gives a small but separate edge. Point-in-time data is essential |
| Ferraro, Rogoff, Rossi ([NBER](https://www.nber.org/system/files/working_papers/w17998/w17998.pdf)) | USD/CAD | Oil price | Daily | Significant out of sample at daily horizon only | Academic out-of-sample test | n/a | Daily horizon | Monthly and quarterly horizons | Test commodity links at daily frequency |
| Crypto funding carry ([arXiv](https://arxiv.org/html/2510.14435v4)) | BTC spot vs perp | Funding carry | 8-hourly | Sharpe 6.45 (2020-25), 4.06 (2024+), negative in 2025 | Backtest | Partly | Retail demand for borrowed exposure | Arbitrage capital arrived | Edges decay. Test by sub-period |
| Frozen 1,285 sleeves ([post](https://dev.to/arhancanli/1285-strategy-sleeves-frozen-before-the-test-the-year-by-year-table-is-the-warning-2np4)) | Stocks and crypto carry | Ranked signals, carry | Daily | Sharpe 3.42 test period, -0.44 since Jan 2025 | Frozen out-of-sample backtest | Yes | Pre-registering choices | Funding collapse. Costs do not diversify away | Report results year by year, not one headline number |
| Crypto bot vs HODL ([post](https://dev.to/nar1frames/i-built-a-crypto-trading-bot-it-lost-to-doing-nothing-355a)) | BTC | Donchian breakout | 1d, 4h, 1m | +4.33% vs +127.77% buy and hold | Walk-forward backtest | Yes, 0.26% per side | Honest testing method | Fees at short timeframes | Fees can be bigger than the signal. Always show a passive benchmark |
| Quantopian 888 algos ([paper](https://www.semanticscholar.org/paper/All-That-Glitters-Is-Not-Gold:-Comparing-Backtest-a-Wiecki-Campbell/b028c2d0b2145e85d543fb21ad3fcf896c932ab5)) | US equities | Many | Mixed | Backtest Sharpe R² < 0.025 for OOS | Backtest vs paper/live | Platform defaults | Volatility and drawdown predicted better | Sharpe was a poor predictor | Count how many variants we try. Expect live Sharpe well below backtest |
| Numerai ([blog](https://blog.numer.ai/jpmorgan-secures-500m-capacity/), [P123](https://community.portfolio123.com/t/numerai-2023-performance/65670)) | Global equities, market neutral | Crowdsourced ML ensemble | Weekly to daily | +25.45% (2024), about -17% (2023) | Live fund | Yes (net) | Large ensemble, neutralisation | 2023 drawdown | Year-to-year variance is large even for professionals |
| G-Research Crypto ([wrap-up](https://www.gresearch.com/news/wrapping-up-the-g-research-crypto-forecasting-competition/)) | 14 coins | ML on price features | Minute | Correlation metric (no values published) | Live-scored competition | No | Feature engineering, LightGBM | Noisy leaderboard | Spend effort on features and validation, not models |
| Zenbot ([repo](https://github.com/DeviaVir/zenbot)) | Crypto | Technical indicators | 5m to 1h | README: defaults often underperform buy and hold | Backtest, paper, live | Partial | n/a | Archived 2022 | Indicator bots on default settings are not a baseline worth beating |

## Recurring failure patterns, with examples

1. **Overfitting and too many trials.**
   - Quantopian: the more backtests per algorithm, the bigger the gap between backtest and live, and backtest Sharpe R² < 0.025 ([paper](https://www.semanticscholar.org/paper/All-That-Glitters-Is-Not-Gold:-Comparing-Backtest-a-Wiecki-Campbell/b028c2d0b2145e85d543fb21ad3fcf896c932ab5)).
   - The crypto momentum peak sat between much weaker neighbouring lookbacks ([post](https://dev.to/pavel_kkkkazantsev/three-crypto-edges-three-different-killers-1i6o)).
   - QuantConnect closed Alpha Streams partly because of overfitting ([forum](https://www.quantconnect.com/forum/discussion/13441/alpha-streams-refactoring-2-0/)).
   - Tools to use: the Deflated Sharpe Ratio ([Bailey and Lopez de Prado](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551)) and a t-statistic hurdle above 3 ([Harvey, Liu, Zhu](https://academic.oup.com/rfs/article-abstract/29/1/5/1843824)).
2. **Costs.**
   - The crypto bot paid 11.4% a year in fees at 4 hours ([post](https://dev.to/nar1frames/i-built-a-crypto-trading-bot-it-lost-to-doing-nothing-355a)).
   - A gross Sharpe of 7 to 13 for mean reversion was rejected after costs ([post](https://dev.to/pavel_kkkkazantsev/three-crypto-edges-three-different-killers-1i6o)).
   - Carver pays about 0.9% of capital a year even with a slow system and an execution algorithm ([y12](https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html)).
   - The QuantConnect carry and trend notebooks leave costs out ([page](https://www.quantconnect.com/research/16001/combined-carry-and-trend/)).
   - For spot FX we also need swap or rollover charges and the broker's markup on interest, not just the spread.
3. **Lookahead.**
   - freqtrade built a dedicated command because whole-dataframe backtests make it easy to use future rows (`shift(-n)`, full-sample `.mean()`) ([docs](https://www.freqtrade.io/en/stable/lookahead-analysis/)).
   - Unrealistic fills inside a candle produced "2506%" in 11 days ([post](https://brookmiles.github.io/freqtrade-stuff/2021/04/12/backtesting-traps/)).
   - Macro data must be point-in-time, since first releases get revised. That is why Macrosynergy sells vintage data.
   - LLM news scores can leak future knowledge from the model's training data ([Glasserman and Lin](https://arxiv.org/abs/2309.17322)).
   - The carry repo above lags the rate data one quarter for this reason ([repo](https://github.com/BenyaminSuicmez/FX_Carry_Trade_Backtest)).
4. **Survivorship and selection.**
   - Less of an issue for G10 FX, but real for EM currencies: pegs, capital controls, and currencies that stopped trading or were redenominated.
   - In crypto it is serious, because many coins were delisted. The arXiv crypto study had to filter 16,468 coins ([arXiv](https://arxiv.org/html/2510.14435v4)).
   - Sources that publish only their good strategies are a form of selection too. The freqtrade strategy repo warns about this indirectly ([README](https://github.com/freqtrade/freqtrade-strategies)).
5. **Regime change and crowding.**
   - Crypto carry went from a Sharpe of 6.45 to negative ([arXiv](https://arxiv.org/html/2510.14435v4)).
   - FX carry has been weaker since about 2010 ([Robot Wealth](https://robotwealth.com/the-art-and-science-of-trading-carry/), [repo](https://github.com/BenyaminSuicmez/FX_Carry_Trade_Backtest)).
   - Carver's trend returns roughly halved after 2010 ([post](https://qoppac.blogspot.com/2025/10/is-degradation-of-trend-following.html)).
   - Published equity anomalies lose 58% of their returns after publication ([McLean and Pontiff](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2156623)).
6. **Tail events and broker risk (FX-specific).**
   - When the Swiss franc peg broke on 2015-01-15, FXCM clients owed $225M and Alpari UK went insolvent ([swissinfo](https://www.swissinfo.ch/eng/fxcm-faces-losses-as-swiss-shock-leaves-alpari-uk-insolvent/41219974)).
   - The August 2024 yen unwind caused a 60% drawdown in the QuantConnect study ([page](https://www.quantconnect.com/research/17843/micro-study-yen-carry-trade/)).
   - Daniel, Hodrick and Lu show dollar-neutral carry is negatively skewed ([paper](https://cfr.ivo-welch.org/forthcoming/papers/daniel-hodrick-lu.pdf)).
7. **Reproducibility.**
   - One author could not rerun their own funding-carry holdout and got the opposite sign ([post](https://dev.to/pavel_kkkkazantsev/three-crypto-edges-three-different-killers-1i6o)).
   - Quantopian users lost their code and backtests when the platform closed ([Business of Business](https://www.businessofbusiness.com/articles/how-quantopian-died-shut-down-quant-investment-robinhood/)).
   - We should store every run's config, data snapshot hash and code commit.

## What we suggest cloning and reproducing first

1. **pysystemtrade** ([repo](https://github.com/pst-group/pysystemtrade), GPL-3.0).
   - It already covers FX futures and commodity futures, with carry and trend rules, volatility targeting and per-instrument costs.
   - It ships the sample data and has a live record we can compare against.
   - First goal: run the example FX-only and FX-plus-commodities backtests on the shipped CSVs (to 2024-03). Then compare the Sharpe and drawdown with SPY over the same dates.
   - The GPL-3.0 license matters only if we ever distribute modified code.
2. **A plain G10 carry baseline**, using [BenyaminSuicmez/FX_Carry_Trade_Backtest](https://github.com/BenyaminSuicmez/FX_Carry_Trade_Backtest) as a readable reference.
   - It is small, models costs, avoids lookahead in an obvious way, and reports an honest weak result (Sharpe 0.02).
   - We should check our own version against the free Lustig, Roussanov and Verdelhan portfolios ([data](https://web.mit.edu/adrienv/www/Data.html)) and the AQR currency factors ([AQR](https://www.aqr.com/Insights/Datasets/Value-and-Momentum-Everywhere-Factors-Monthly)). If our carry series does not roughly match theirs, our pipeline has a bug.
   - The repo has no license file that we saw. Use it for reading only.
3. **macrosynergy** ([repo](https://github.com/macrosynergy/macrosynergy), BSD-3-Clause), plus the free Kaggle JPMaQS sample and an academic data request.
   - This is the most direct public route to point-in-time macro signals for FX, with panel tests built in.
   - First goal: reproduce one FX notebook, for example terms of trade, with the sample data.
4. **QuantConnect Lean** ([repo](https://github.com/QuantConnect/Lean), Apache-2.0) and the "Combined Carry and Trend" notebook ([page](https://www.quantconnect.com/research/16001/combined-carry-and-trend/)).
   - This is an independent re-implementation of Carver's rules on a different engine, and the cloud gives free FX data.
   - Running the same idea on two engines helps us catch engine-specific bugs. We would add costs, since the notebook leaves them out.
5. **Optional, crypto control: freqtrade** ([repo](https://github.com/freqtrade/freqtrade), GPL-3.0).
   - Only if we want a crypto version of the same idea, such as funding carry or momentum.
   - Its lookahead-analysis and recursive-analysis checks are the main thing worth borrowing as a design pattern, even if we never trade crypto.

What we would skip for now:

- backtrader: unmaintained since 2023.
- Zenbot: archived.
- Qlib and zipline-reloaded: built for equity cross-sections.
- FinRL: we saw backtest-only evidence.
- Hummingbot: market making.
- NautilusTrader: more engineering than a proof of concept needs, though it is well maintained.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [INT-0001: Initial intent](../intent/0001-initial-intent.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
<!-- backlinks:end -->
