---
id: RES-0003
title: What practitioners say in forums
type: research
status: current
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [data, method, news, open-source]
related: [DEC-0005, HYP-0004, RES-0001, RES-0002]
---

# What practitioners say in forums

## In plain words

We read what traders say online, on Reddit, Wall Street Oasis and other forums. Lots of people claim to make money, but almost nobody can prove it. The useful part is their advice on how not to fool yourself.

## Summary

What traders and hobbyists say on Reddit, Wall Street Oasis, Elite Trader, QuantConnect, Hacker News, Quantitative Finance Stack Exchange and blogs about building a first systematic FX strategy, gathered 2026-10-20. Short version: almost everything forums say about who makes money is anecdote, and we found no audited retail FX track record anywhere. The advice about how to fail less (clean data, realistic costs, no lookahead) is consistent and useful. Speed trading on news is not realistic for us: practitioners say most of the move is over within half a second ([DEC-0005](../decisions/0005-no-microsecond-trading-in-the-poc.md)).

## How we gathered this, and its limits

- We read threads on Reddit (r/algotrading, r/quant, r/Forex), Hacker News, Elite Trader, QuantConnect, Quantitative Finance Stack Exchange, Wall Street Oasis, StrategyQuant and a few blogs. We did not log in anywhere.
- reddit.com blocks automated reading, so we read Reddit posts and comments through the public Arctic Shift archive (https://arctic-shift.photon-reddit.com). Links below point to reddit.com. Vote counts are from the archive snapshot and may differ from the live page.
- Wall Street Oasis blocks direct reading. We read two of its threads through Internet Archive snapshots (linked).
- Nuclear Phynance did not resolve (the domain did not answer on 2026-10-20). The Wilmott forum returned 503 and 403 errors. We could not read X/Twitter directly. We found no article summary of the X quant community that we trusted enough to cite, so that source is missing from this survey.
- Some thread summaries came from a fetch tool that condenses a page. Where we relied only on a search result snippet and did not open the page, we mark it **[unverified]**.
- Evidence labels used below:
  - **[anecdote]** a single person's claim with no checkable record
  - **[self-reported data]** a person shows numbers or screenshots, but nothing independent confirms them
  - **[public record]** results published openly over years by a named person, still self-published and not audited
  - **[research]** academic paper, regulator document, or vendor documentation

Short version: almost everything forums say about who makes money is anecdote. We found no audited retail FX track record in any thread. The advice about how to fail less (data hygiene, costs, look-ahead bias) is far more consistent and more useful than any claim about what wins.

## Recurring advice on building a first systematic strategy

### Data

- **Use the same price feed for research and for live trading.** Spot FX has no single price. Each broker quotes its own, so a strategy tuned on one feed can lose its edge on another. QuantConnect staff said this directly: "Forex isn't a single price; each broker serves their own prices" ([QuantConnect: backtesting vs live](https://www.quantconnect.com/forum/discussion/1297/backtesting-vs-live-or-paper-trading-results/)). A long-time r/algotrading user said the same about Dukascopy versus broker feeds ([r/algotrading: Dukascopy forex data, 2017](https://www.reddit.com/r/algotrading/comments/65kb14/dukascopy_forex_data/)).
- **Check how daily bars are cut.** QuantConnect builds FX daily bars midnight to midnight UTC, while TradingView and most of the FX market use 5pm New York to 5pm New York. Opens and closes then disagree even with the same broker data ([QuantConnect: daily bar data in Forex do not match, Dec 2024](https://www.quantconnect.com/forum/discussion/18398/daily-bar-data-in-forex-do-not-match/)).
- **Macro data must be point in time.** Two separate issues get mixed up: the release calendar (when a number came out) and vintages (what the number was on that day before revisions). A Quant SE answer suggests ALFRED's `realtime_start` as the first-available date and warns that "a perfect calendar on top of revised-only values still has look-ahead" ([Quant SE: historical economic release calendar](https://quant.stackexchange.com/questions/63166/historical-economic-release-calendar)). FRED's API documents the vintage parameters ([FRED API: series/observations](https://fred.stlouisfed.org/docs/api/fred/series_observations.html), [vintagedates](https://fred.stlouisfed.org/docs/api/fred/series_vintagedates.html)). This matters for us because a macro-driven FX model built on today's revised data has look-ahead built in.
- **Data cleaning is real work.** On HN, people asked how anyone knows their data is accurate, and the reply was that large funds have whole teams for it ([HN: Anyone making money through algorithmic trading?, 2018](https://news.ycombinator.com/item?id=16922538)). One r/algotrading user found 88,371 mismatched rows between two endpoints of the same commercial vendor ([r/algotrading: where do you get your data, 2024](https://www.reddit.com/r/algotrading/comments/1et9k3v/where_do_you_get_your_data_for_backtesting_from/)) **[anecdote]**.

### Backtesting pitfalls

- **Look-ahead bias is the most reported bug, by far.** Typical forms: computing an indicator on the bar's close and trading that same bar; pandas rolling stats that include the current bar; scalers fitted on the full series; merges that pull values forward. A 2026 post shows the one-line version (`signal * ret` instead of `signal.shift(1) * ret`) turning a breakeven moving-average rule into a Sharpe above 2 ([r/algotrading: letting an LLM write your backtest, May 2026](https://www.reddit.com/r/algotrading/comments/1tpren4/letting_an_llm_write_your_backtest_check_for_this/)). Others describe losing months to it ([r/algotrading: look-ahead bias is a hell of a drug, Sep 2025](https://www.reddit.com/r/algotrading/comments/1n8rn14/lookahead_bias_is_a_hell_of_a_drug/)).
- **Checklists people actually use** (same thread): verify the signal lag on random bars; fill at the next available price after the signal; apply costs and slippage; run a random-entry baseline; run a permutation test (shuffle the signal and see whether "alpha" survives); log signal time, order time and first executable quote, and treat any fill timestamped before its signal as a leak. Several people suggest an event-driven backtester, which feeds data one bar at a time so look-ahead is hard to write by accident.
- **Bars cannot tell you whether stop or target hit first.** With M15 or hourly bars, a stop and a take-profit inside the same bar are ambiguous. Tick data fixes this and also gives realistic, time-varying spreads ([r/algotrading: 3.5 years building a forex algo, Mar 2026](https://www.reddit.com/r/algotrading/comments/1s5tihu/i_spent_35_years_building_a_forex_algo_from/)).
- **Overfitting and regimes.** One user reports a Sharpe of 1.77 in backtest falling to 0.4 once delisted names and walk-forward testing were added ([r/algotrading: are most retail quant strategies just overfit regime bets?, Feb 2026](https://www.reddit.com/r/algotrading/comments/1r96n10/are_most_retail_quant_strategies_just_overfit/)) **[anecdote]**. A recurring view is that many retail "algos" are just disguised exposure to a rising market ([r/algotrading: is anyone here actually successful?, Jun 2026](https://www.reddit.com/r/algotrading/comments/1u9ongr/genuine_question_is_anyone_here_actually/)). For a project that benchmarks against the S&P 500, this is the main trap: we should report correlation to the S&P and to simple FX factors, not only returns.
- **How much data is enough.** The top Quant SE answer gives a sample-size formula from the standard error: n = (2 s alpha / Delta)^2. Their worked example needed about 3,458 trades to confirm a 2 basis point edge with 45 bp per-trade noise ([Quant SE: how much data to validate a short-horizon strategy](https://quant.stackexchange.com/questions/1891/how-much-data-is-needed-to-validate-a-short-horizon-trading-strategy)). Another answer adds that trades within one period are correlated, so they count for less than they seem. For a low-frequency FX strategy with tens of trades a year, this means years of history give only modest statistical power.
- **Backtests over five years may capture one regime; twenty-year backtests include market conditions that no longer exist** ([HN: Algorithmic trading, the play-at-home version, 2015](https://news.ycombinator.com/item?id=10035625)). A commenter there: "the role of back testing is making sure your algo trades when you expect it to. You need to forward test."
- **LLM-generated code is a new source of these bugs.** People report that AI assistants write tutorial-style backtests with the unlagged signal bug, and that "I had the AI audit the code" is not a check ([r/algotrading, May 2026](https://www.reddit.com/r/algotrading/comments/1tpren4/letting_an_llm_write_your_backtest_check_for_this/)).

### Costs

- **Costs and fees are the most common reason a backtest edge disappears.** HN, 2018: people often forget trading fees and taxes ([HN 16922538](https://news.ycombinator.com/item?id=16922538)). A 2015 HN comment lists what beginners miss: "trading costs, financing costs, roll costs, liquidity constraints, data delays, market impact" ([HN 10035625](https://news.ycombinator.com/item?id=10035625)).
- **FX-specific: overnight swap (rollover) interest.** QuantConnect does not model FX rollover by default. Users must inject it by hand (OANDA books it daily around 5pm ET). For carry strategies this is most of the return, so leaving it out makes the backtest meaningless ([QuantConnect: Forex carry rollover interests](https://www.quantconnect.com/forum/discussion/5234/forex-carry-rollover-interests/)).
- **Historical spreads.** Applying today's tight ECN spreads to 1999 to 2010 data "alone can massively inflate results" ([r/algotrading, Mar 2026](https://www.reddit.com/r/algotrading/comments/1s5tihu/i_spent_35_years_building_a_forex_algo_from/)). Spreads also widen every day around the New York close and Asian open; one user's fix is a spread filter that skips trading when spreads are far above average.
- **Slippage is what "murdered" first profitable backtests** in several personal accounts ([r/algotrading, Jun 2026](https://www.reddit.com/r/algotrading/comments/1u9ongr/genuine_question_is_anyone_here_actually/)) **[anecdote]**.
- **A public benchmark for cost levels.** Rob Carver, who trades a diversified futures system including FX futures and publishes yearly results, reported slippage of 0.55% and commissions of 0.33% of capital for his 2025/26 year ([qoppac: annual performance update, year 12, Apr 2026](https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html)) **[public record]**.

### Execution

- Paper trading and live trading differ, both in fills and in how people behave. One HN user lost $100k after careful backtesting and called it "mostly psychological" ([HN 16922538](https://news.ycombinator.com/item?id=16922538)) **[anecdote]**.
- Go live small. Several replies to a Sharpe 7.78 FX claim said to run it "in very small size", because a real edge that large would show quickly ([r/algotrading, Mar 2026](https://www.reddit.com/r/algotrading/comments/1s5tihu/i_spent_35_years_building_a_forex_algo_from/)).
- Retail's real advantages, according to professionals on r/quant: small size (little market impact), no forced trading, longer holding periods, and freedom to trade small, capacity-limited opportunities ([r/quant: what advantages do retail traders have?, Feb 2025](https://www.reddit.com/r/quant/comments/1ilivyx/)). The repeated point is that the disadvantage only bites "when things get fast" ([r/algotrading: those that have seen retail find an edge, Feb 2025](https://www.reddit.com/r/algotrading/comments/1iv8qgk/those_that_have_seen_retail_find_an_edge_in_algo/)).

### Position sizing

- Common simple rules: risk about 1% of capital per trade, cap the number of trades ([r/algotrading: does anyone live off their systems?, 2022](https://www.reddit.com/r/algotrading/comments/vwvu99/does_anyone_here_actually_live_off_of_the_profits/)) **[anecdote]**.
- Kelly sizing comes up as a way to judge a strategy (one profitable poster uses the Kelly bet size as his main metric) and as a discipline most retail traders skip ([r/algotrading: successful algo traders, what's your story?, 2023](https://www.reddit.com/r/algotrading/comments/10zw9nh/successful_algo_tradings_whats_your_story/); [HN: how to get into quantitative trading?, 2024](https://news.ycombinator.com/item?id=39146654)).
- Diversify across signals, assets and timeframes, and watch negative skew ([r/quant: is a high return, low drawdown possible for retail?, Apr 2025](https://www.reddit.com/r/quant/comments/1ju7o6t/)). "Most blowups I have seen were sizing mistakes during regime change, not model math" ([r/algotrading, Feb 2026](https://www.reddit.com/r/algotrading/comments/1r96n10/are_most_retail_quant_strategies_just_overfit/)) **[anecdote]**.
- Carver's published approach (volatility targeting across many instruments) is the most documented retail-scale sizing method we came across ([qoppac blog](https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html)).

## What people report worked, and what did not

### FX

| Claim | Where | Evidence |
|---|---|---|
| Trend following on futures (including currency futures) with volatility-targeted sizing. Sharpe 0.80 in 2025/26 versus 0.54 for the SG CTA index. The year before was his worst futures year, about minus 16%. | [qoppac year 12](https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html), [year 11](https://qoppac.blogspot.com/2025/04/annual-performance-update-returneth.html) | **[public record]**, 12 years, by a former Man AHL portfolio manager. Self-published, not audited. The closest thing to a real track record we found. Year 11 figures come from a search snippet **[unverified]**. |
| r/quant practitioner: "Trend following does provide consistent alpha", cites Carver, Bouchaud and AQR research; another replies that momentum is a risk factor, not alpha. | [r/quant: is algo trading profitable for individuals?, 2023](https://www.reddit.com/r/quant/comments/13sjot4/is_algorithmic_trading_profitable_for_individuals/) | Opinion plus pointers to **[research]**. |
| Same thread: "Mine weren't (forex)", with the bigger issue being drawdown after a few good months. | same | **[anecdote]** |
| Prop trader selling FX algos: plus 57% year to date, max drawdown 6%, "73%" over two years live, backtest about 35% a year, scaled to $600k. A fund manager replied that the numbers imply only about 13% over the first 20 months. Others said funds do not buy algos and asked for an audited or public track record (Collective2, FundSeeder). | [WSO, May 2021 (archive)](https://web.archive.org/web/20230921160738/https://www.wallstreetoasis.com/forum/hedge-fund/my-algos-are-up-57-ytd-i-want-to-sell-them) | **[self-reported data]**, numbers do not add up cleanly |
| Several users report MT4/MT5 forex bots running 8 to 12 months. One links Myfxbook accounts and says his speciality is martingale systems. | [r/algotrading: has anyone made a successful bot in FX?, 2024](https://www.reddit.com/r/algotrading/comments/19b046o/has_anyone_made_a_successful_bot_in_fx_how_long/) | **[anecdote]**; martingale is a known blow-up pattern (see section 5) |
| A 25-year M15 backtest on EURUSD, GBPUSD, EURGBP with 83% win rate and Sharpe 7.78. Replies identified likely causes: too-tight historical spreads, bar-level stop/target ambiguity, and small wins with large losses. | [r/algotrading, Mar 2026](https://www.reddit.com/r/algotrading/comments/1s5tihu/i_spent_35_years_building_a_forex_algo_from/) | **[self-reported data]**, backtest plus one week of demo |
| Macro-sentiment FX algorithm on QuantConnect using an economic calendar: 268 trades, negative net profit, $3,468 in fees. | [QuantConnect: FX macro economic sentiment algorithm](https://www.quantconnect.com/forum/discussion/1835) | **[self-reported data]**, a failed attempt shared openly |
| Interactive Brokers FX trader, 3 years, strategies ranging from 1.7% to 55% a year. | [Blind](https://www.teamblind.com/post/algotrading-ocgevgm3) | **[unverified]**, seen only in a search snippet |

Background that forums point to: the Meese and Rogoff result that a random walk forecasts exchange rates as well as macro models ([r/quant: how are FX forecasts modelled?, 2024](https://www.reddit.com/r/quant/comments/1ebgtvd/), linking [Meese and Rogoff 1983](https://scholar.harvard.edu/files/rogoff/files/51_jie1983.pdf)). A Quant SE answer quotes a 2015 paper: at intraday frequency "no economic variable is known to describe exchange rate dynamics, except for their associated order flows" ([Quant SE: known forex market trends](https://quant.stackexchange.com/questions/40186/known-forex-market-trends)). A sell-side commenter on r/quant says there is "no alpha on fx unless you have proprietary datasets", while another says they have seen and implemented FX/rates alpha, and that fancy ML was not the hard part ([r/quant: alpha in rates/fx, 2024](https://www.reddit.com/r/quant/comments/1d1tee6/)) **[anecdote]**. On the oil link specifically, a 2025 blog reports the USDCAD to oil correlation weakening to roughly zero over three months ([search result](https://priceactionninja.com/top-usd-cad-correlations-every-forex-trader-should-know/)) **[unverified]**, and one r/quant reply notes that "even for aud, a classic commodity currency, it's rarely commodity moves driving fx" **[anecdote]**.

Base rates: a Quant SE answer says US broker disclosures (NFA) show roughly 65% of retail FX accounts losing, stable over time ([Quant SE: distribution of retail FX P&L, 2013](https://quant.stackexchange.com/questions/7964/distribution-of-profit-loss-for-retail-traders-in-fx)). EU and UK CFD brokers must publish their own loss percentages on their sites; we did not collect current figures.

### Crypto

What people say worked, nearly all **[anecdote]**:
- Cross-exchange arbitrage in 2013, when "few sophisticated competitors" existed. The poster claims double his salary within 6 months ([HN, June 2013](https://news.ycombinator.com/item?id=5904071)).
- "Millions" from algo trading crypto in 2017, starting with 5 BTC ([HN 16922538](https://news.ycombinator.com/item?id=16922538)).
- Front-running FTX's daily rebalance around midnight; arbitraging ANT against ETH during Aragon's fixed-rate wind-down, 1% a few times a day on six-figure positions ([r/algotrading, Feb 2025](https://www.reddit.com/r/algotrading/comments/1iv8qgk/those_that_have_seen_retail_find_an_edge_in_algo/)).
- A friend who did flash-loan / MEV arbitrage early and was bought by Jump in 2020 ([r/quant: does retail quant trading exist?, 2024](https://www.reddit.com/r/quant/comments/1dvx838/)) **[anecdote, second-hand]**.

What did not work:
- Arbitrage bots that were technically sound but faced tiny volumes, exchange counterparty risk and front-running; fees "basically lose any edge" ([HN 16922538](https://news.ycombinator.com/item?id=16922538)).
- Funding-rate arbitrage: blogs claim high historical yields, but also report rates compressing toward zero as automated capital arrived ([Medium guide, 2026](https://arbitrageghost.medium.com/funding-rate-arbitrage-in-2026-the-complete-guide-with-real-calculations-40e6cf341e52)) **[unverified]**.

The common thread in what "worked" in crypto: an early, small, structural inefficiency (fixed conversion rates, a predictable rebalance, a thin new market), not a predictive model. Each one closed. A practitioner on r/quant said crypto opened the field "thanks to cheap data and somewhat [level] playing field in term of connection to the exchanges", while still assuming most self-described retail quants are "delusional" ([r/quant 1dvx838](https://www.reddit.com/r/quant/comments/1dvx838/)).

### Size of the prize, even if it works

A professional on r/quant: an information ratio of 0.4 (realistic for a full-time pro) on $200k at 20% volatility earns about $16k a year, "7 bucks an hour" ([r/quant: how do you view retail traders?, Jan 2025](https://www.reddit.com/r/quant/comments/1htzwh2/)). For parity this does not matter, since we care about risk-adjusted performance and not income. It is still a useful reminder that a believable target Sharpe is closer to 0.5 to 1 than to 3.

## High-frequency and news trading for retail

### Latency that is realistic without co-location

- **Microsecond trading is out of reach.** A 2025 r/quant post (695 votes in our snapshot) describes two years and savings spent on a retail HFT attempt: about $2k minimum for one instrument's depth data, "250ms" from a cloud server versus microseconds for large firms, and CME co-location quoted at about $8k a month before power and bandwidth ([r/quant: you can't build HFT as a retail trader, Aug 2025](https://www.reddit.com/r/quant/comments/1mjfhlp/)) **[anecdote]**. A former HFT worker of 20 years compared it to "a Formula 1 engineer against a retail guy that works on really nice bicycles".
- On Elite Trader in 2025, two replies to a news-feed co-location plan: "you will have to co-locate and pay for low latency data feeds... competing with other HFTs", and "pure news trading is very competitive and you'd probably need a seven-figure budget" ([Elite Trader: ultra-low-latency news feed delivery, Feb 2025](https://www.elitetrader.com/et/threads/ultra-low-latency-news-feed-delivery.383001/)).
- **How fast the window closes.** One r/algotrading trader who reacts to earnings, crop reports and macro releases says: the market prices the news in about 10 milliseconds, it is "basically done" by 500 ms, only "bread crumbs" remain after 2 to 3 seconds, and nothing is left after 1 to 2 minutes. He gets tick-to-trade in 3 to 5 ms and still only eats crumbs ([r/algotrading: news feed latency, Nov 2025](https://www.reddit.com/r/algotrading/comments/1ozljry/news_feed_latency/)) **[anecdote]**, but consistent with every other account we read.
- **What retail actually gets.** In the same thread: newswire RSS updates 5 to 10 minutes late; one commercial API had noticeable lag; a websocket news service gave about 10 seconds from article to analysis. A user trading "slow HFT" reports getting orders in about 10 ms after the trigger tick using C++, Rithmic and a Chicago VPS ([r/algotrading: how fast is it really?, Jul 2025](https://www.reddit.com/r/algotrading/comments/1lpzxio/how_fast_is_it_really_on_latency_measurement_and/)) **[anecdote]**. Retail VPS vendors claim about 1 ms to broker servers when hosted in the same data centre; we did not test this **[unverified]**.
- **Slippage around releases.** Elite Trader traders in 2026 report that slippage around NFP and CPI is "almost unavoidable", worse with size, and that "most experienced traders either reduce size or stay out" ([Elite Trader: slippage during news events, Mar 2026](https://www.elitetrader.com/et/threads/slippage-during-news-events.389051/)).

### Oil and gas releases

- The EIA Weekly Petroleum Status Report comes out Wednesdays at 10:30 ET and the natural gas storage report Thursdays at 10:30 ET ([EIA petroleum data](https://www.eia.gov/petroleum/data.php), [EIA natural gas data](https://www.eia.gov/naturalgas/data.php)).
- In a 2015 to 2016 Elite Trader thread, people refreshed the EIA PDF at 10:30 and reported 2 to 3 seconds to load. Investing.com updated at 10:30, other sites up to 15 minutes late. The consensus was that crude had already moved $0.20 to $0.50 by the time retail could read the number, and the advice was to trade the price action afterwards ([Elite Trader: earliest way to read EIA report](https://www.elitetrader.com/et/threads/earliest-way-to-read-eia-report.290115/)).
- An r/algotrading trader notes that even a fast scraper loses because the government web server is not next to the exchange, while firms with feeds next to the exchange react first ([r/algotrading 1ozljry](https://www.reddit.com/r/algotrading/comments/1ozljry/news_feed_latency/)).

### Is trading the news worth it?

The answer from people who tried is mostly no, at least for speed:
- "I used to trade economic data using low latency news feeds over 25 years ago. Massively profitable but... returns dwindled while news feeds kept going up (5 figures a month)." This person sees remaining edge only in unscheduled news ([r/algotrading: trading based on news, Apr 2026](https://www.reddit.com/r/algotrading/comments/1siwtqy/trading_based_on_news/)) **[anecdote]**.
- Same thread: "All kind of events for FX and Indices and everything is non-predictive. In backtest you will see Sharpes between 5 and 10 for trading news only. But this is completely curve fitted" **[anecdote]**.
- What might still be studied at a slower pace (same thread): for scheduled releases, use the surprise (actual minus consensus, scaled), not text sentiment; define event classes first and test whether each class moves prices at your horizon after costs; deduplicate wire reprints because the same story arrives 40 times; if using an LLM to score text, constrain it to a fixed rubric and check consistency, since repeated runs give different scores.
- Older Elite Trader discussion reached the same view in 2012: big firms had already spent heavily on news algorithms, and the semantic problem (different wording, same meaning) is hard ([Elite Trader, 2012](https://www.elitetrader.com/et/threads/using-an-algo-to-trade-news-headlines-automatically.248390/)).

### News and calendar sources people mention

| Source | Cost as reported | Notes |
|---|---|---|
| Forex Factory calendar weekly export (JSON/CSV/XML) | free | Recommended repeatedly ([r/algotrading: economic calendar API, 2023](https://www.reddit.com/r/algotrading/comments/1772vas/economic_calendar_api/)). We confirmed the JSON feed at `nfs.faireconomy.media/ff_calendar_thisweek.json` returns forecast and previous values; it is this-week only and is not an official API, so history must be collected or scraped. |
| FRED release calendar and release-dates API, plus ALFRED vintages | free, API key | Suggested in [r/algotrading 17uyeo3](https://www.reddit.com/r/algotrading/comments/17uyeo3/macroeconomic_calendar_api/) and on [Quant SE](https://quant.stackexchange.com/questions/63166/historical-economic-release-calendar). No consensus forecasts. Proprietary series such as ISM are missing. |
| Finnhub economic calendar | about $50/month (2023 comment) | One user reported data problems years earlier ([r/algotrading 1772vas](https://www.reddit.com/r/algotrading/comments/1772vas/economic_calendar_api/)). |
| EODHD economic events | about $50/month bundle (2023 comment) | Not real-time to the minute per the 1772vas poster. |
| Trading Economics | described as expensive | |
| AlphaFlash | paid; ultra-low-latency tier "extremely expensive" | Users say it is often seconds ahead of Bloomberg ([r/algotrading 1772vas](https://www.reddit.com/r/algotrading/comments/1772vas/economic_calendar_api/), [1ozljry](https://www.reddit.com/r/algotrading/comments/1ozljry/news_feed_latency/)). |
| Bloomberg Event-Driven Feed | reported about $20k/month | From a search snippet of an [Elite Trader thread](https://elitetrader.com/et/threads/any-one-tried-bloomberg-event-driven-feed.269723/) **[unverified]**. Machine-readable news vendors listed on [Quant SE](https://quant.stackexchange.com/questions/7365/fastest-news-feed-apis-targeting-high-frequency-trading). |
| GDELT | free | See section 4. Updates every 15 minutes, so it cannot be a speed source. |

Our reading: for three students, any strategy that needs to act within seconds of a release or headline is not feasible, and the forums agree. Hours-to-days reactions to release surprises, or to oil and gas moves, remain testable with free data.

## Free or cheap data sources and their quality

### FX prices

- **Dukascopy** (free tick data, 2003 onward for majors). Widely called the best free retail source. Quality notes from users:
  - Each record is the best bid and ask on Dukascopy's own ECN, not trades. The volume fields are quoted size at the top of book, so summing them into "bar volume" is misleading. Duplicate ticks occur when quotes repeat, and spreads are wide for about an hour after weekends and holidays ([Elite Trader: interpreting Dukascopy tick data, 2020 to 2021](https://www.elitetrader.com/et/threads/interpreting-dukascopy-tick-data.352792/)).
  - Direct download URL pattern `datafeed.dukascopy.com/datafeed/{PAIR}/{YEAR}/{MONTH}/{DAY}/{HOUR}h_ticks.bi5`, LZMA-compressed, 20-byte records, months zero-indexed ([Quant SE](https://quant.stackexchange.com/questions/34919/where-can-someone-get-free-or-very-cheap-high-frequency-tick-forex-data), [r/algotrading 65kb14](https://www.reddit.com/r/algotrading/comments/65kb14/dukascopy_forex_data/)). Apparent "gaps" are often Sundays and holidays ([r/algotrading 61h9v2](https://www.reddit.com/r/algotrading/comments/61h9v2/dukascopy_forex_data_gaps/)).
  - One user calls Dukascopy index CFD data "pretty trash" with irregular session hours ([r/algotrading un2htz](https://www.reddit.com/r/algotrading/comments/un2htz/dukascopy_data_intraday_strategies_dealing_with/)) **[anecdote]**. FX seems better regarded than their CFDs.
- **HistData.com** (free M1 and some tick). Convenient CSVs. A StrategyQuant forum contributor said its data is "of very low quality and I do not recommend you use that" ([StrategyQuant forum, 2018](https://strategyquant.com/forum/topic/tip-free-historical-data-for-backtesting/)) **[anecdote]**. A blog claims it is derived from Dukascopy **[unverified]**.
- **TrueFX** (free after registration, tick data from 2009, top of book from Integral). About 600 MB per month for EURUSD, and a spike at the daily roll around 22:00 UTC that needs cleaning ([Free finance datasets for quants, 2023](https://dm13450.github.io/2023/11/25/Free-Finance-Datasets-for-Quants.html); [TrueFX downloads](https://www.truefx.com/truefx-historical-downloads-2/)).
- **OANDA v20 API with a free practice account.** Bid, ask and mid candles back to about 2005, 5,000 candles per request, rate limited ([OANDA developer docs](https://developer.oanda.com/rest-live-v20/api-comparison/); [oandapyV20 wrapper](https://github.com/hootnot/oanda-api-v20)). Prices are OANDA's own, which is an advantage if OANDA is also the execution venue. QuantConnect supports live OANDA trading ([QuantConnect: Oanda for EU](https://www.quantconnect.com/forum/discussion/5847/oanda-and-quantconnect-for-eu/)).
- **Tickstory Lite** (free desktop tool built on Dukascopy data), mentioned on [Quant SE](https://quant.stackexchange.com/questions/34919/where-can-someone-get-free-or-very-cheap-high-frequency-tick-forex-data).
- **ECB reference rates** via the ECB Data Portal API. One daily fixing per currency, good for daily research and as an independent check. We confirmed the endpoint answers ([example query](https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1)).

### Commodities

- **EIA API v2** (free key): weekly petroleum stocks, gas storage and daily spot prices (WTI, Brent, Henry Hub). Release times above ([EIA petroleum data](https://www.eia.gov/petroleum/data.php); [a Python walk-through](https://dev.to/chat13f/tracking-us-crude-oil-inventories-with-python-and-the-eia-api-1n8k)). For backtests, record the release timestamp, not only the "week ending" date.
- **Nasdaq Data Link** (formerly Quandl) continuous futures were the usual free source for roll-adjusted oil and gas futures ([dm13450, 2023](https://dm13450.github.io/2023/11/25/Free-Finance-Datasets-for-Quants.html)). We did not check whether the free continuous-futures dataset is still maintained **[unverified]**.
- **Databento** comes up as the reasonably priced, pay-per-dataset option for futures tick data ([HN 39146654](https://news.ycombinator.com/item?id=39146654), [r/algotrading 1et9k3v](https://www.reddit.com/r/algotrading/comments/1et9k3v/where_do_you_get_your_data_for_backtesting_from/)). Not free.

### Macro

- **FRED and ALFRED** for US series and vintages (links in section 1). ALFRED is what avoids revision look-ahead.
- **ECB Data Portal** for euro area series (same API as above).
- Several people advise downloading calendars and macro data into a local file or database rather than calling an API from the live system, so the data can be inspected and reused in backtests ([r/algotrading 17uyeo3](https://www.reddit.com/r/algotrading/comments/17uyeo3/macroeconomic_calendar_api/)).

### News

- **GDELT** (free, updates every 15 minutes). Research on it reports high recall and low precision: many false events, duplicates and geolocation errors. One study found only 21% of valid URLs behind protest events described an actual protest ([Communication Methods and Measures, 2022](https://www.tandfonline.com/doi/full/10.1080/19312458.2022.2128099)). Its DOC API rate-limited us (HTTP 429) on a single test call. Usable for slow, aggregated features if we deduplicate heavily. Not a speed source.
- r/quant on free data generally: "The more widely used/available a data set is, the less alpha it will produce. For something free and publicly available you'd be safe to assume no alpha" ([r/quant 1dvx838](https://www.reddit.com/r/quant/comments/1dvx838/)) **[opinion]**. For parity this argues for testing how data is combined (FX plus oil plus macro surprises) rather than expecting any single free series to carry an edge.

### Crypto

- Free exchange data via Binance and the CCXT library ([HN 39146654](https://news.ycombinator.com/item?id=39146654)).

## Red flags in published "profitable bot" claims

Collected from the threads above, roughly in order of how often they come up:

1. **Sharpe ratios far above about 3, or very high win rates.** A professional on WSO: keeping Sharpe above 3 for years is "extremely hard" without something specialised and capacity-limited ([WSO quant AMA (archive)](https://web.archive.org/web/20250819124954/https://www.wallstreetoasis.com/forum/hedge-fund/ask-me-anything-buy-side-systematic-quant)). Replies to a Sharpe 7.78 FX backtest: "either massively overfit... or there's future leaking" ([r/algotrading 1s5tihu](https://www.reddit.com/r/algotrading/comments/1s5tihu/i_spent_35_years_building_a_forex_algo_from/)). On r/quant: "almost every1 is between 1 and 2, and everyone who isn't gets diluted down to that over time" ([r/quant 1ju7o6t](https://www.reddit.com/r/quant/comments/1ju7o6t/)).
2. **High win rate with a low profit factor.** 83% wins with profit factor 1.54 means the average loss is several times the average win. This is the signature of systems that win small and lose big, including martingale and grid systems.
3. **Martingale, grid, or no stop loss.** Myfxbook-linked accounts in forum threads sometimes openly use martingale ([r/algotrading 19b046o](https://www.reddit.com/r/algotrading/comments/19b046o/has_anyone_made_a_successful_bot_in_fx_how_long/)). Vendor guides on reading Myfxbook list rising lot sizes after losses and hidden open positions as signs ([example guide](https://forexrobotlab.com/myfxbook-ea-risk-checklist/)).
4. **Backtest only, or a very short live record.** A few weeks of demo after a 25-year backtest proves little. WSO commenters want a live record held at a third party with the trader's real name (Collective2, FundSeeder, or an audited broker statement) ([WSO 2021 (archive)](https://web.archive.org/web/20230921160738/https://www.wallstreetoasis.com/forum/hedge-fund/my-algos-are-up-57-ytd-i-want-to-sell-them)).
5. **Hidden or reset history.** On Myfxbook, look for both "track record verified" and "trading privileges verified"; hidden open trades and recently reset accounts are warnings ([vendor guide](https://forexrobotlab.com/myfxbook-ea-risk-checklist/)) **[vendor source, treat with care]**.
6. **Only a year-to-date figure, or numbers that do not reconcile.** In the WSO case, "57% YTD" and "73% over two years" together imply a weak first 20 months, which a reader caught.
7. **Return statistics that flatter.** Arithmetic mean returns instead of geometric; no drawdown or Sharpe; no trading costs; ignoring borrow fees for shorts. One "24.85% a year" strategy had a Sharpe of 0.067 and a 41% drawdown when someone reran it ([HN: Show HN 24.85% annually, 2021](https://news.ycombinator.com/item?id=27414677)).
8. **Unrealistic cost assumptions.** Today's spreads applied to old data; no slippage around news; no swap or rollover for FX positions held overnight.
9. **Disguised market exposure.** A strategy that mostly holds a rising asset will look smart in a bull market. "Everyone looks like a genius in a bull market" ([HN 39833025](https://news.ycombinator.com/item?id=39833025)); the same author reported live results at one quarter to three quarters of backtest performance **[self-reported data]**.
10. **Selling the bot or the signals.** The forum view on r/Forex is blunt: "People don't sell legit bots" ([r/Forex: do trading bots actually work?, 2024](https://www.reddit.com/r/Forex/comments/1famvpl/do_trading_bots_actually_work/)). Some reply that a creator might sell for diversification, but the burden of proof sits with the seller. An HN comment notes that strategies in retail app stores tend to be ones developers discarded as not good enough to trade themselves ([HN 10035625](https://news.ycombinator.com/item?id=10035625)).
11. **"AI" as the selling point, guaranteed returns, 100% win rates.** The US regulator's advisory lists exactly these ([CFTC: AI won't turn trading bots into money machines, Jan 2024](https://www.cftc.gov/sites/default/files/2024/01/AITradingBots_0.pdf); [press release](https://www.cftc.gov/PressRoom/PressReleases/8854-24)). A Man Group executive quoted in a 2025 Decrypt piece: generative AI's gains are "on the language side. It's not particularly helpful for numerical predictions" ([Yahoo Finance / Decrypt, Aug 2025](https://finance.yahoo.com/news/ai-trading-bots-booming-trust-150102860.html)).
12. **Survivorship in the forum itself.** People who failed stop posting; people who succeed rarely share. A reply on HN: asking "who is making money?" invites the lucky to answer, and luck can look like skill in a large crowd ([HN 16922538](https://news.ycombinator.com/item?id=16922538)). The 2021 r/algotrading post arguing successful traders simply do not share ([lqciwr](https://www.reddit.com/r/algotrading/comments/lqciwr/truth_about_successful_algo_traders_they_dont/)) is the mirror image of the same bias. Neither side can be checked.
13. **No capacity discussion.** "A strategy at 25k is diff than at 50m" ([WSO AMA (archive)](https://web.archive.org/web/20250819124954/https://www.wallstreetoasis.com/forum/hedge-fund/ask-me-anything-buy-side-systematic-quant)). For our purposes capacity matters less, but a claim that ignores costs at size is also usually ignoring costs at small size.

## Threads worth reading in full

1. [r/algotrading: Letting an LLM write your backtest? Check for this one-line look-ahead bug (May 2026)](https://www.reddit.com/r/algotrading/comments/1tpren4/letting_an_llm_write_your_backtest_check_for_this/): the clearest list of quiet backtest bugs and a validation checklist.
2. [r/algotrading: I spent 3.5 years building a forex algo (Mar 2026)](https://www.reddit.com/r/algotrading/comments/1s5tihu/i_spent_35_years_building_a_forex_algo_from/): a live example of an impossible-looking FX backtest and how commenters take it apart.
3. [Quant SE: How much data is needed to validate a short-horizon strategy?](https://quant.stackexchange.com/questions/1891/how-much-data-is-needed-to-validate-a-short-horizon-trading-strategy): the sample-size arithmetic we should apply to our own trade counts.
4. [Quant SE: Historical economic release calendar](https://quant.stackexchange.com/questions/63166/historical-economic-release-calendar): release dates versus vintages, and why both matter for a macro FX backtest.
5. [QuantConnect: Forex carry rollover interests](https://www.quantconnect.com/forum/discussion/5234/forex-carry-rollover-interests/): swap interest is not modelled by default, which breaks any carry test.
6. [QuantConnect: Daily bar data in Forex do not match (Dec 2024)](https://www.quantconnect.com/forum/discussion/18398/daily-bar-data-in-forex-do-not-match/): the 5pm New York bar convention.
7. [Elite Trader: Interpreting Dukascopy tick data (2020 to 2021)](https://www.elitetrader.com/et/threads/interpreting-dukascopy-tick-data.352792/): what the free tick data actually contains.
8. [r/algotrading: News feed latency (Nov 2025)](https://www.reddit.com/r/algotrading/comments/1ozljry/news_feed_latency/): the 10 ms / 500 ms / 2 s timeline from someone who trades releases.
9. [r/algotrading: Trading based on news (Apr 2026)](https://www.reddit.com/r/algotrading/comments/1siwtqy/trading_based_on_news/): ex-news trader's history, curve-fit news backtests, surprise-based features, deduplication.
10. [Elite Trader: Earliest way to read EIA report (2015 to 2016)](https://www.elitetrader.com/et/threads/earliest-way-to-read-eia-report.290115/): what retail sees at 10:30 on oil report day.
11. [r/quant: You can't build HFT as a retail trader (Aug 2025)](https://www.reddit.com/r/quant/comments/1mjfhlp/): cost and latency numbers for retail speed attempts.
12. [r/quant: Is algorithmic trading profitable for individuals? (May 2023)](https://www.reddit.com/r/quant/comments/13sjot4/is_algorithmic_trading_profitable_for_individuals/): a real disagreement between industry people about trend following and retail feasibility.
13. [r/quant: How are FX forecasts modelled? (Jul 2024)](https://www.reddit.com/r/quant/comments/1ebgtvd/): Meese and Rogoff, and frank views on sell-side FX forecasts.
14. [WSO: My algos are up 57% YTD, I want to sell them (May 2021, archived)](https://web.archive.org/web/20230921160738/https://www.wallstreetoasis.com/forum/hedge-fund/my-algos-are-up-57-ytd-i-want-to-sell-them): how hedge fund people react to an FX track record claim.
15. [HN: Ask HN: Anyone making money through algorithmic trading? (2018)](https://news.ycombinator.com/item?id=16922538): the widest spread of personal stories, wins and losses, with sharp sceptics.
16. [HN: Show HN: a trading algorithm that returns ~24.85% annually (2021)](https://news.ycombinator.com/item?id=27414677): a compact lesson in how returns get overstated.
17. [This Blog is Systematic: annual performance update, year 12 (Apr 2026)](https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html): twelve years of published live results for a retail-scale systematic futures account, with costs.
18. [r/algotrading: Are most retail quant strategies just overfit regime bets? (Feb 2026)](https://www.reddit.com/r/algotrading/comments/1r96n10/are_most_retail_quant_strategies_just_overfit/): regime dependence, walk-forward, and sizing.
19. [r/algotrading: Those that have seen retail find an edge, what are they? (Feb 2025)](https://www.reddit.com/r/algotrading/comments/1iv8qgk/those_that_have_seen_retail_find_an_edge_in_algo/): concrete examples of small structural edges, mostly closed now.

## What this suggests for parity (our reading, not the forums')

- Treat speed-based news or oil-release trading as out of scope. Every account we found says the move is over within about a second, and our data arrives seconds to minutes later.
- If we use oil, gas and macro data, use them at daily or slower horizons, with release timestamps and vintage-correct values. Surprises (actual minus consensus) are the feature practitioners point to; consensus history is the hard part to get for free.
- Build cost realism in from the start: time-varying spreads, slippage around releases, and overnight swap for any position held past 5pm New York.
- Validate with a lagged, event-driven backtest, a holdout period we do not look at until the end, a random-entry baseline and a permutation test. Report correlation to the S&P 500 so we do not mistake market exposure for skill.
- Expect a believable Sharpe in the 0.5 to 1 range. A result far above that is more likely a bug than a discovery, and the forums are full of examples.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [INT-0001: Initial intent](../intent/0001-initial-intent.md)
- [RES-0002: Open-source projects and public results](0002-open-source-and-public-results.md)
- [RES-0005: Zenbot, similar apps and free data APIs](0005-zen-apps-and-free-apis.md)
- [RES-0006: What trading courses and traders swear by, and what the evidence says](0006-courses-and-trader-beliefs.md)
- [RES-0007: Comparing every algorithm we know of](0007-comparing-every-algorithm.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
- [LOG-0004: Ayan work log, requests and outcomes](../log/2026-10-21-ayan-work-log-requests-and-outcomes.md)
<!-- backlinks:end -->
