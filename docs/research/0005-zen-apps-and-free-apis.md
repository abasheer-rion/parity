---
id: RES-0005
title: Zenbot, similar apps and free data APIs
type: research
status: current
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [crypto, data, news, open-source]
related: [HYP-0004, REF-0003, RES-0002, RES-0003]
---

# Zenbot, similar apps and free data APIs

## In plain words

We looked up the app called "zenpilot" and found three things with similar names. None of them gives us data we can use. Then we listed the free services that do let a program download prices, interest rates, oil prices, news and economic calendars, and picked the ones worth plugging in next.

## Summary

Checked 2026-10-20. "zenpilot" is almost certainly Zenbot, an open source crypto bot archived in 2022 with no API and no FX data. ZenPilot is a ClickUp consultancy, and Zennbot is a paid MetaTrader forex robot with no API and unchecked return claims.

The recommended data stack, in order: FRED and ALFRED, an OANDA practice account, BIS, Frankfurter (ECB rates), EIA, Dukascopy ticks, GDELT news, and the weekly Forex Factory calendar file. Three need a free sign-up by the owner: FRED, EIA and an OANDA demo account. No free source keeps a clean history of economists' forecasts before each release, so we should start saving the Forex Factory file every week now ([HYP-0004](../hypotheses/0004-macro-surprises-move-fx-predictably.md)).

Every claim below links to the page it came from. Items we tested ourselves say "tested". Anything not confirmed on the provider's own page is marked unverified. Usefulness scores run from 5 (build on it) to 1 (skip).

## What "zenpilot" might mean

We found three real candidates. None of them is a data source or an API we can use. The closest to our project is Zenbot, and only as an example of how a backtester is laid out.

### Zenbot (github.com/DeviaVir/zenbot)

- What it is: a command line crypto trading bot written in Node.js with a MongoDB backend. It has a backtesting simulator, paper trading mode and live trading on about a dozen exchanges such as Binance, Kraken, Bitstamp and GDAX ([repo](https://github.com/DeviaVir/zenbot)).
- Active? No. The repo was archived (read only) on 15 February 2022, and the README says the project "is no longer actively maintained" ([repo](https://github.com/DeviaVir/zenbot)). It has about 8.3k stars and 2.0k forks ([repo](https://github.com/DeviaVir/zenbot)).
- API: none. It is a CLI tool. There is no REST server, websocket feed, SDK or webhook ([repo](https://github.com/DeviaVir/zenbot)).
- Auth: not applicable. It uses your own exchange keys to trade.
- Pricing: free.
- License: MIT ([repo](https://github.com/DeviaVir/zenbot)).
- Strategies: about 40 indicator strategies, for example bollinger, macd, rsi, ichimoku, trend_ema, wavetrend, and a "neural" one ([strategy folder](https://github.com/DeviaVir/zenbot/tree/unstable/extensions/strategies)).
- Useful to us? A little. The README itself warns that the default settings "will underperform vs. a buy-hold strategy" ([README](https://raw.githubusercontent.com/DeviaVir/zenbot/unstable/README.md)). That is a useful honest baseline, but it covers crypto only, has no FX or macro data, and publishes no backtest results. Score: **1**.

### ZenPilot (zenpilot.com)

- What it is: a consulting firm that sets up ClickUp (project management software) for agencies and service firms. It has nothing to do with trading ([home page](https://www.zenpilot.com/)).
- Active? Yes. Its pricing page lists a "Blueprint" from $5,000, implementation projects of $15k to $30k, and retainers from $2k a month ([pricing](https://www.zenpilot.com/pricing)).
- API: none. It sells consulting, not software ([pricing](https://www.zenpilot.com/pricing)).
- License, free tier: not applicable.
- Useful to us? No. Score: **1**.

### Zennbot (zennbot.com)

- What it is: a paid retail service selling automated forex "Expert Advisors" (robots) for MetaTrader. Its site says MetaTrader 5 and mentions prop firms like FTMO and brokers like Pepperstone ([home page](https://zennbot.com/)). A July 2026 review says MetaTrader 4 ([The Forex Geek](https://theforexgeek.com/zennbot-review/)), so the platform is unclear.
- Active? Yes. The site is live and claims 4,500+ members ([home page](https://zennbot.com/)).
- API: none mentioned on the site or in the review ([home page](https://zennbot.com/), [The Forex Geek](https://theforexgeek.com/zennbot-review/)).
- Auth: not applicable. The robot runs inside your own MetaTrader account.
- Pricing: no free tier. The site offers a 14 day money back guarantee and asks for at least $1,000 in a personal account ([home page](https://zennbot.com/)). A search snippet from a Trustpilot review mentions an upfront fee of about 485 GBP plus 35 GBP a month (unverified, [Trustpilot](https://www.trustpilot.com/review/zennbot.com?page=3)).
- Claims: the site says verified Myfxbook accounts average "6 to 9% a month" ([home page](https://zennbot.com/)). We could not open the Myfxbook pages (HTTP 403), so the track records are unverified ([Myfxbook profile](https://www.myfxbook.com/members/Zennbot)). The review notes a young domain, low trust scores and "no independent validation" ([The Forex Geek](https://theforexgeek.com/zennbot-review/)). Some reviewers say the robots are rebranded from another developer (unverified, [search summary of Trustpilot](https://uk.trustpilot.com/review/zennbot.com?page=5)).
- Useful to us? No. It is a closed product, and its return claims should be treated as marketing. Score: **1**.

### Other similar names

- No trading product called "Zen Pilot" or "ZenPilot" turned up in our searches ([search 1](https://sourceforge.net/software/product/Zenbot/), [search 2](https://www.forbes.com/sites/investor-hub/article/what-is-autopilot-investment-app/)).
- "Autopilot" (joinautopilot) is an app that copies politicians' and fund managers' disclosed stock trades into your brokerage. It is US stocks only, with no public API we could find ([Forbes](https://www.forbes.com/sites/investor-hub/article/what-is-autopilot-investment-app/)). It may be what someone half remembers as "zenpilot".
- "Pilot" (pilottrading.co) is a signal and watchlist app for stocks, futures, forex and crypto ([site](https://pilottrading.co/)).
- "ZenTrader" is used by several unrelated firms: ZenTrader.io (a tool for auditing your own systematic trading, no public API seen) ([site](https://zentrader.io/zentrader/)), Zentrader.com (a binary options style broker) ([TradingBrokers review](https://tradingbrokers.com/zentrader-review/)), and an unregulated MT4 broker of the same name ([WikiFX](https://www.wikifx.com/en/dealer/2191728552.html)). We would avoid all of them.

**Our read:** the user most likely meant Zenbot. It is a dead crypto bot, but it is open source (MIT), so its strategy files can be read for ideas. It gives us no data and no API.

## Free or freemium APIs

Format for each entry: what it gives, history, free limits, key, terms, score.

### FX prices

**Frankfurter** ([docs](https://frankfurter.dev/docs/))
- Gives: daily reference rates. v2 now blends 223 currencies from 105 central banks. v1 is the original ECB only feed ([site](https://frankfurter.dev/)).
- History: v2 says back to 1948 ([docs](https://frankfurter.dev/docs/)). We tested v1 and got ECB rates from 1999-01-04 (tested).
- Limits: no daily or monthly quota, only abuse throttling ([site](https://frankfurter.dev/)).
- Key: none (tested).
- Terms: blended rates free for commercial use. Provider specific endpoints follow each provider's terms. Open source and self hostable ([site](https://frankfurter.dev/)).
- Score: **4**. The easiest daily FX feed. One fixing per day only (ECB fixes at 14:15 CET, unverified), so no intraday.

**exchangerate.host** ([site](https://exchangerate.host/))
- Gives: latest and end of day rates, about 19 years of history.
- Limits: free plan is 100 requests a month. Paid starts at $14.99 a month. Owned by APILayer ([site](https://exchangerate.host/)).
- Key: yes.
- Score: **1**. Frankfurter does the same job with no key and no cap.

**OANDA v20 API, practice environment** ([development guide](https://developer.oanda.com/rest-live-v20/development-guide/))
- Gives: live streaming prices, historical candles (bid, ask, mid), and full order placement on a demo account. Practice REST is `api-fxpractice.oanda.com`, streaming is `stream-fxpractice.oanda.com` ([development guide](https://developer.oanda.com/rest-live-v20/development-guide/)).
- History: candles back many years, max 5000 candles per request (both unverified, we could not load the instrument page).
- Limits: 100 requests a second on a persistent connection, 2 new connections a second ([best practices](https://developer.oanda.com/rest-live-v20/best-practices/)).
- Key: a bearer token generated in the OANDA hub. Demo accounts can generate one (Tools, API, Generate) ([OANDA help](https://help.oanda.com/us/en/faqs/rest-v20-api-troubleshooting-guide.htm)). We tested that the practice endpoint exists and returns 401 without a token (tested).
- Terms: standard OANDA account terms. We did not read the data redistribution terms (unverified).
- Score: **5**. Intraday FX with real spreads, plus paper trading, in one free account.

**Dukascopy historical data** ([export page](https://www.dukascopy.com/swiss/english/marketwatch/historical/))
- Gives: tick to monthly bid and ask data for forex, commodities and indices ([export page](https://www.dukascopy.com/swiss/english/marketwatch/historical/)). The raw feed is LZMA compressed hourly tick files; we downloaded one EURUSD hour from 2024 with no key (tested). Open source downloaders exist, such as [dukascopy-node](https://github.com/Leo4815162342/dukascopy-node).
- History: 15+ years for majors (unverified, [third party guide](https://www.bluecapitaltrading.com/products/free-historical-data/)).
- Limits: none published (unverified).
- Key: none for the raw feed (tested). The web export tool may need a demo login (unverified).
- Terms: we could not find a data specific terms page (unverified). Treat as personal research use only and do not redistribute.
- Score: **4**. Best free tick history for measuring spreads and costs. Some work to decode.

**TrueFX** ([downloads](https://www.truefx.com/truefx-historical-downloads-2/))
- Gives: free historical tick by tick data after a free registration ([downloads](https://www.truefx.com/truefx-historical-downloads-2/)). Third parties say about 15 majors from May 2009, monthly CSV files (unverified, [guide](https://marketdata-hub.com/guide/best-free-historical-market-data-sources)). Live data is now a paid product at $4,950 a month and up ([home](https://www.truefx.com/)).
- Key: registration and login for downloads.
- Score: **3**. Good backup to Dukascopy, but needs a login and manual downloads.

**Alpha Vantage** ([docs](https://www.alphavantage.co/documentation/), [support](https://www.alphavantage.co/support/))
- Gives: FX_DAILY, FX_WEEKLY, FX_MONTHLY free. FX_INTRADAY is premium ([docs](https://www.alphavantage.co/documentation/)).
- History: free keys only get the compact output; `outputsize=full` is premium ([docs](https://www.alphavantage.co/documentation/)). Compact is the last 100 points (unverified on this page).
- Limits: 25 requests a day. Free unlimited access is offered to "verified open-source or educational projects" ([support](https://www.alphavantage.co/support/)), which a student project might qualify for (unverified).
- Key: yes.
- Score: **2**. Too limited for FX unless we get the educational exemption.

**Twelve Data** ([pricing](https://twelvedata.com/pricing))
- Gives: real time forex, US stocks and crypto on the free Basic plan.
- Limits: 8 credits a minute, 800 a day, plus 8 trial websocket credits ([pricing](https://twelvedata.com/pricing)).
- History depth on free: not stated (unverified).
- Key: yes.
- Terms: Basic is for "internal non-display usage" ([pricing](https://twelvedata.com/pricing)).
- Score: **3**. Handy for intraday FX bars if OANDA is not enough.

**Massive (formerly Polygon.io), Currencies** ([pricing](https://massive.com/pricing?product=currencies))
- Polygon renamed itself Massive on 30 October 2025; old keys and api.polygon.io still work ([Massive blog](https://massive.com/blog/polygon-is-now-massive)).
- Free "Currencies Basic": 5 calls a minute, 2 years of history, end of day data, minute aggregates ([pricing](https://massive.com/pricing?product=currencies)).
- Key: yes.
- Score: **2**. Two years is too short for a strategy test.

**Finnhub forex** ([docs](https://finnhub.io/docs/api/forex-candles), [pricing](https://finnhub.io/pricing))
- Forex candles and "all rates" are both marked Premium in the docs (read on the docs page). Free plan is 60 calls a minute, personal use ([pricing](https://finnhub.io/pricing)), with a 30 calls a second cap on top ([docs](https://finnhub.io/docs/api/rate-limit)).
- Score: **1** for FX prices.

**Tiingo** ([pricing](https://www.tiingo.com/about/pricing))
- Forex data is not on the free plan; it needs the $30 a month Power plan. Free is 50 requests an hour, 1,000 a day, internal use only ([pricing](https://www.tiingo.com/about/pricing)).
- Score: **1** for FX. (Its free end of day stock prices could serve as an S&P 500 ETF benchmark.)

### Interest rates and macro

**FRED and ALFRED** ([FRED API](https://fred.stlouisfed.org/docs/api/fred/), [ALFRED](https://alfred.stlouisfed.org/))
- Gives: hundreds of thousands of US and international series: policy rates, yields, CPI, payrolls, plus daily WTI ([DCOILWTICO](https://fred.stlouisfed.org/series/DCOILWTICO)) and Henry Hub gas ([DHHNGSP](https://fred.stlouisfed.org/series/DHHNGSP)) copied from EIA. ALFRED keeps each past vintage, so we can see what a number looked like on the day it was first released ([ALFRED](https://alfred.stlouisfed.org/)). The API supports this through real time periods ([FRED API](https://fred.stlouisfed.org/docs/api/fred/)). A v2 endpoint pulls a whole release in bulk ([FRED API](https://fred.stlouisfed.org/docs/api/fred/)).
- Limits: 120 requests a minute, then HTTP 429 and possibly a temporary block ([errors page](https://fred.stlouisfed.org/docs/api/fred/errors.html)).
- Key: yes, free. Without it the API says "Variable api_key is not set" (tested).
- Terms: FRED API terms of use; some series carry their source's copyright ([terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html)).
- Score: **5**. Our main macro source, and the only free one with first release values.

**ECB Data Portal (SDMX 2.1)** ([API overview](https://data.ecb.europa.eu/help/api/overview))
- Gives: all ECB statistics: euro reference FX rates (EXR), money market rates, yield curves ([API overview](https://data.ecb.europa.eu/help/api/overview)). We pulled daily EUR/USD as CSV from `data-api.ecb.europa.eu` (tested).
- Limits: none published (unverified).
- Key: none (tested).
- Score: **4**. Euro area rates and the official FX fixings, straight from the source.

**BIS Data Portal (SDMX)** ([API docs](https://stats.bis.org/api-doc/v2/))
- Gives: central bank policy rates for many countries (WS_CBPOL), effective exchange rates, and more. We pulled the daily US policy rate series, which notes coverage from 1954 (tested).
- Limits: none published (unverified).
- Key: none (tested).
- Score: **5**. One place for policy rates across all the currencies we would trade, which is what a carry signal needs.

**OECD Data API (SDMX)** ([best practices](https://www.oecd.org/en/data/insights/data-explainers/2024/11/Api-best-practices-and-recommendations.html))
- Gives: key economic indicators, short and long rates, leading indicators, by country. We pulled the US 3 month rate series (tested).
- Limits: 60 data downloads an hour, and the same limit applies to CSV downloads from the Data Explorer ([best practices](https://www.oecd.org/en/data/insights/data-explainers/2024/11/Api-best-practices-and-recommendations.html)).
- Key: none (tested).
- Score: **3**. Useful for comparing countries; mostly monthly, and revised values only.

**IMF Data API (SDMX 2.1 and 3.0)** ([third party guide](https://bd-econ.com/imfapi3.html))
- Gives: IFS, balance of payments, reserves, exchange rates. We listed the dataflows at `api.imf.org/external/sdmx/2.1/dataflow` with no key (tested).
- Limits: not published by the IMF (unverified). A third party reports about 10 requests per 5 seconds per IP (unverified, [api-evangelist](https://github.com/api-evangelist/imf)).
- Score: **2**. Monthly or slower; good for country background, not for timing.

**World Bank Indicators API** (`api.worldbank.org/v2`)
- Gives: annual development indicators. We pulled US GDP, last updated 2026-10-08 (tested).
- Key: none (tested). Limits: none published (unverified).
- Score: **1**. Annual data is too slow for us.

**BLS** ([API FAQ](https://www.bls.gov/developers/api_faqs.htm))
- Gives: CPI, payrolls, and other US labor series. We pulled CPI for September 2026 with no key (tested).
- Limits: without a key 25 queries a day, 25 series and 10 years per query. With a free key 500 a day, 50 series and 20 years per query. Both 50 requests per 10 seconds ([API FAQ](https://www.bls.gov/developers/api_faqs.htm)).
- Score: **2**. FRED already carries these series; BLS is only needed for detail.

**BEA** ([signup](https://apps.bea.gov/api/signup/))
- Gives: GDP, PCE inflation, trade balance.
- Limits: 100 requests a minute, 100 MB a minute, 30 errors a minute (from the user guide via search, unverified on the page itself, [user guide PDF](https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf)).
- Key: yes, free, after agreeing to terms ([signup](https://apps.bea.gov/api/signup/)).
- Score: **2**. Again mostly on FRED.

**US Treasury Fiscal Data** (`api.fiscaldata.treasury.gov`)
- Gives: Treasury fiscal and debt data. We pulled average interest rates on Treasury debt from 2001 to September 2026 (tested).
- Key: none (tested). Limits: none published (unverified).
- Score: **2**. Daily yield curves are easier to get from FRED.

### Commodities and energy

**EIA API v2** ([docs](https://www.eia.gov/opendata/documentation.php), [open data](https://www.eia.gov/opendata/))
- Gives: petroleum and natural gas prices, weekly inventories and production, the Short Term Energy Outlook, and international data. Bulk files refresh twice a day ([open data](https://www.eia.gov/opendata/)).
- Limits: up to 5,000 rows per JSON request. Programs must throttle per second and per hour or the key is suspended for a while; exact numbers are not given ([docs](https://www.eia.gov/opendata/documentation.php)).
- Key: yes, free. Without it the API answers `API_KEY_MISSING` (tested).
- Terms: EIA API terms of service and reuse policy ([open data](https://www.eia.gov/opendata/)).
- Route names such as `petroleum/pri/spt` for WTI and Brent spot are from third party examples (unverified, [example](https://docs.oilpriceapi.com/compare/eia-alternative)).
- Score: **5**. Weekly oil and gas inventory releases are the commodity "news" most likely to move CAD and NOK.

**CME and ICE free delayed data**
- We found no free official API. CME DataMine is a paid historical service with an API for purchased data ([DataMine API](https://www.cmegroup.com/datamine/datamine-api.html)). A third party says the free tier has daily settlements but no API (unverified, [QuantVPS](https://www.quantvps.com/blog/cme-historical-data-complete-guide)).
- Score: **1**.

**Nasdaq Data Link (formerly Quandl)**
- The free continuous futures set (CHRIS) is deprecated and no longer updated ([GitHub issue citing Nasdaq support](https://github.com/PacktPublishing/Python-for-Algorithmic-Trading-Cookbook/issues/5)). Around 40 free datasets remain. Free key limits of 300 calls per 10 seconds and 50,000 a day are from third parties (unverified, [QuantInsti](https://blog.quantinsti.com/nasdaq-data-link/)).
- Score: **1**. What is left is mostly on FRED.

**World Bank Pink Sheet** ([commodity markets](https://www.worldbank.org/en/research/commodity-markets))
- Gives: monthly and annual commodity prices since 1960 as Excel files. Next update 3 November 2026. Licensing through the World Bank data catalog under CC BY ([commodity markets](https://www.worldbank.org/en/research/commodity-markets)). No API.
- Score: **2**. Good for long monthly history, too slow for trading signals.

### Economic calendar and consensus forecasts

This is the hard one. **We found no free source of point in time consensus history.** Finnhub states that "historical events and surprises are available for Enterprise clients" ([Finnhub API spec](https://finnhub.io/static/swagger.json)). The only free forward looking consensus feed we found is the Forex Factory weekly file, so if we want our own history we have to start saving it every week now.

| Source | Forecast/consensus field? | Point in time history? | Free? |
|---|---|---|---|
| Forex Factory weekly JSON | yes ("forecast") | no, only this week; we would have to snapshot it | yes, no key |
| Forex Factory archive on Hugging Face | yes | no, values may have been edited after the event | yes |
| Trading Economics | yes (Forecast and TEForecast) | history by date range, paid | no, guest access ended |
| Finnhub economic calendar | yes, unverified field names | Enterprise only | no, premium |
| FMP economic calendar | yes ("estimate") | 90 day windows, unclear if point in time | unclear, likely paid |
| Investing.com | yes on the website | no API | no API |
| Alpha Vantage economic indicators | no, actual values only | no | yes, 25 a day |
| FRED release dates plus ALFRED | no consensus | yes, first release values and dates | yes, key |

**Forex Factory calendar export** (`nfs.faireconomy.media/ff_calendar_thisweek.json`)
- We fetched it (tested). Fields are title, country, date (with time zone), impact, forecast and previous. There is no "actual" field and only the current week is included (tested).
- Limits: 2 downloads per 5 minutes; after that it returns a "Request Denied" page (unverified, reported on [MQL5](https://www.mql5.com/en/blogs/post/762107)). Our first request was refused and a later one worked, which fits that limit.
- Terms: the main site blocked our reader (HTTP 403), so we could not read its terms (unverified). Personal research use only, no redistribution.
- Score: **4**. The only free consensus feed. Start a weekly snapshot job now.

**Forex Factory archive on Hugging Face** ([dataset](https://huggingface.co/datasets/Ehsanrs2/Forex_Factory_Calendar))
- About 83.4k events from 2007 to April 2025, with actual, forecast and previous. Scraped with Selenium. Labelled MIT, but the card says that does not grant rights over the source content and warns that values "may have been updated after the event" ([dataset](https://huggingface.co/datasets/Ehsanrs2/Forex_Factory_Calendar)).
- Score: **3**. Good enough for a first look at surprise effects. Not clean point in time data.

**Trading Economics** ([pricing](https://tradingeconomics.com/api/pricing.aspx), [calendar docs](https://docs.tradingeconomics.com/economic_calendar/snapshot/))
- Calendar has Actual, Previous, Forecast and TEForecast, and can be filtered by date range ([calendar docs](https://docs.tradingeconomics.com/economic_calendar/snapshot/)).
- The free guest:guest login is gone. It returns HTTP 410 "the guest account has been discontinued" (tested). Only a paid trial exists, which is not refundable and renews automatically ([pricing](https://tradingeconomics.com/api/pricing.aspx)).
- Score: **1** on a zero budget.

**Finnhub economic calendar** ([pricing](https://finnhub.io/pricing))
- Marked Premium in the docs and not included in the free plan on the pricing table (read on both pages).
- Score: **1**.

**FMP economic calendar** ([endpoint docs](https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar), [pricing](https://site.financialmodelingprep.com/developer/docs/pricing))
- Returns date, country, event, previous, estimate, actual, change and impact. Each request covers at most 90 days ([endpoint docs](https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar)).
- Free Basic plan: 250 calls a day, 500 MB a month, end of day data. Showing or redistributing FMP data needs a separate licence ([pricing](https://site.financialmodelingprep.com/developer/docs/pricing)). Whether Basic includes the calendar: unverified (the pricing table was hard to read). Whether "estimate" is the value known before the release: unverified.
- Score: **2**. Worth one test with a free key.

**Investing.com** ([calendar](https://www.investing.com/economic-calendar/))
- Shows actual, forecast (economist consensus) and previous, but has no official API or export ([calendar](https://www.investing.com/economic-calendar/)). Scraping is the only route and is likely against its terms (unverified).
- Score: **1**.

**Alpha Vantage economic indicators** ([docs](https://www.alphavantage.co/documentation/))
- Real GDP, CPI, inflation, retail sales, fed funds, Treasury yields, unemployment, payrolls. Actual values only, no forecasts ([docs](https://www.alphavantage.co/documentation/)).
- Score: **1**. FRED covers it better.

### News and sentiment

**GDELT** ([DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/), [raw data](https://www.gdeltproject.org/data.html))
- DOC 2.0 API: full text search over world news in 65 languages, with article lists and tone or volume timelines. It searches a rolling 3 month window, up to 250 records per call ([DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)).
- GKG and Events raw files: from February 2015, updated every 15 minutes, also on Google BigQuery ([raw data](https://www.gdeltproject.org/data.html)). This is the route for long backtests.
- Limits: when we went too fast the API replied "Please limit requests to one every 5 seconds" (tested).
- Key: none. Terms: "100% free and open", with citation expected ([raw data](https://www.gdeltproject.org/data.html)).
- Score: **4**. The only free news source with years of history and a ready made tone score.

**NewsAPI.org** ([pricing](https://newsapi.org/pricing))
- Free Developer plan: 100 requests a day, articles delayed 24 hours, search up to a month back, development only (not even internal production) ([pricing](https://newsapi.org/pricing)).
- Score: **1**. Too short and too restricted.

**Finnhub market news** ([docs](https://finnhub.io/docs/api/market-news))
- Free endpoint with a "forex" category (also general, crypto, merger) ([docs](https://finnhub.io/docs/api/market-news)). The news sentiment endpoint is Premium and US companies only ([docs](https://finnhub.io/docs/api/market-news)). History depth for market news: unverified.
- Score: **2**. Fine for a live headline feed; not for backtests.

**Alpha Vantage NEWS_SENTIMENT** ([docs](https://www.alphavantage.co/documentation/))
- News with sentiment scores, filterable by ticker (for example `FOREX:USD`), topic and `time_from` ([docs](https://www.alphavantage.co/documentation/)). History back to about 2022 (unverified). Shares the 25 a day free cap ([support](https://www.alphavantage.co/support/)).
- Score: **2**. Ready made FX tagged sentiment, but the daily cap makes a backfill slow.

**Marketaux** ([pricing](https://www.marketaux.com/pricing), [docs](https://www.marketaux.com/documentation))
- Free: 100 requests a day, 3 articles per request ([pricing](https://www.marketaux.com/pricing)). Each entity gets a sentiment score from -1 to +1, and currencies are a supported entity type. The time series stats endpoint is Standard plan and up ([docs](https://www.marketaux.com/documentation)).
- Score: **2**. 300 articles a day is too thin.

**GNews** ([pricing](https://gnews.io/pricing))
- Free: 100 requests a day, 10 articles each, 30 days back, 12 hour delay, non commercial only ([pricing](https://gnews.io/pricing)).
- Score: **1**.

**Reddit API**
- Reddit's own pages blocked our reader, so all of this is unverified. Third parties say: OAuth is required, the free tier is 100 queries a minute, and since 2025 to 2026 new apps need manual approval ([socialcrawl](https://www.socialcrawl.dev/blog/reddit-data-api-2026), [prowlo](https://prowlo.com/blog/reddit-data-api)).
- Score: **1**. Slow to get access, little FX signal.

### Crypto (for comparison)

**Binance public market data** ([limits doc](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/limits))
- **From a US address, binance.com and its futures API return HTTP 451 "Service unavailable from a restricted location"** (tested). Binance.US public klines do work (tested). The bulk archive at data.binance.vision, including futures funding rate files, also loads (tested).
- Limits are by request weight per IP. Ignoring 429s gets the IP banned for 2 minutes up to 3 days ([limits doc](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/limits)).
- Key: none for public data.
- Score: **3**. Use data.binance.vision for history and funding rates.

**Coinbase Exchange public API** ([rate limits](https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits))
- Daily BTC-USD candles with no key (tested). Public endpoints allow 10 requests a second per IP, bursts to 15 ([rate limits](https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits)).
- Score: **3**.

**CoinGecko** ([pricing](https://www.coingecko.com/en/api/pricing))
- Demo plan: 100 calls a minute, 10k calls a month, attribution required ([pricing](https://www.coingecko.com/en/api/pricing)). A simple price call worked without a key (tested). Demo history limit: unverified.
- Score: **2**.

**Deribit public API**
- Funding rate history for BTC-PERPETUAL with no key (tested). Rate limits: unverified (the knowledge base page did not load). Deribit is now owned by Coinbase (page title, [Deribit](https://www.deribit.com/kb/deribit-rate-limits)).
- Score: **2**.

### Paper trading

**OANDA practice (fxTrade demo)** ([OANDA help](https://help.oanda.com/us/en/faqs/rest-v20-api-troubleshooting-guide.htm))
- Demo accounts can generate an API token and trade through `api-fxpractice.oanda.com` ([OANDA help](https://help.oanda.com/us/en/faqs/rest-v20-api-troubleshooting-guide.htm)). Same limits as above ([best practices](https://developer.oanda.com/rest-live-v20/best-practices/)). Whether the demo expires: unverified.
- Score: **5**. The simplest way for us to paper trade FX through an API.

**Alpaca paper** ([paper trading](https://docs.alpaca.markets/docs/paper-trading), [about](https://docs.alpaca.markets/us/docs/about-alpaca))
- Free, open to anyone with an email, starts at $100,000 virtual, covers stocks and crypto ([paper trading](https://docs.alpaca.markets/docs/paper-trading)).
- **No forex.** Alpaca lists FX as "on our roadmap" ([about](https://docs.alpaca.markets/us/docs/about-alpaca)).
- Score: **3**. Good for paper trading the S&P 500 benchmark (via an ETF) and crypto, not FX.

**Interactive Brokers paper** ([paper account lesson](https://www.interactivebrokers.com/campus/trading-lessons/request-paper-trading-account/), [free trial](https://portal.interactivebrokers.com/en/trading/free-trial.php))
- A paper account is requested from inside a live account's portal; it mirrors the live account's permissions ([paper account lesson](https://www.interactivebrokers.com/campus/trading-lessons/request-paper-trading-account/)).
- The separate free trial gives delayed data except spot FX and metals, which are live ([free trial](https://portal.interactivebrokers.com/en/trading/free-trial.php)).
- Third parties say trial accounts cannot use the API, but an approved, unfunded live account's paper account can trade FX through the API (unverified, [supa.is](https://supa.is/article/how-to-set-up-ibkr-api-paper-trading-account-step-by-step-2026)).
- Score: **3**. The most realistic FX execution, but it needs a full brokerage application.

## Recommended stack, in priority order

1. **FRED and ALFRED** (free key). Rates, yields, CPI, payrolls, daily WTI and Henry Hub, and first release values so our backtest does not peek at revised data.
2. **OANDA v20 practice** (free demo account plus API token). Intraday FX with bid and ask, and our paper trading venue.
3. **BIS SDMX** (no key). Policy rates for every currency we trade, for the carry signal.
4. **Frankfurter, with ECB SDMX as the source of truth** (no key). Clean daily FX history from 1999 for the first backtests.
5. **EIA API v2** (free key). Weekly oil and gas inventories and spot prices for the commodity side.
6. **Dukascopy ticks** (no key). Real spreads, so our cost model is honest.
7. **GDELT** (no key). News tone over time, with raw files from 2015 for backtests.
8. **Forex Factory weekly JSON** (no key). Start a weekly snapshot job now so we build our own record of consensus forecasts; use the Hugging Face archive for a rough first look.

**Keys the owner needs to sign up for (all free):**
- FRED API key: https://fred.stlouisfed.org/docs/api/api_key.html
- OANDA fxTrade demo account, then generate a token in the hub (Tools, API)
- EIA API key: https://www.eia.gov/opendata/register.php

Optional later: a free BLS v2 key, a free FMP key (to test the calendar), and Alpha Vantage (worth asking about the educational exemption).

**Things to keep in mind**
- No free source gives a clean history of what economists expected before each release. Any "news surprise" backtest before we start saving snapshots is approximate.
- binance.com is blocked from US addresses. Use data.binance.vision or Binance.US.
- Most free tiers say personal or internal use only. We should keep raw data private and only publish our own results and charts.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [GDE-0004: The research routine](../guides/0004-the-research-routine.md)
- [LOG-0001: Project start](../log/2026-10-20-project-start.md)
- [LOG-0004: Ayan work log, requests and outcomes](../log/2026-10-21-ayan-work-log-requests-and-outcomes.md)
<!-- backlinks:end -->
