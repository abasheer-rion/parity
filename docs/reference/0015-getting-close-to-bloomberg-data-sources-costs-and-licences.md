---
id: REF-0015
title: Getting close to Bloomberg data: sources, costs and licences
type: reference
status: current
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [data]
related: [REF-0003, REF-0010, REF-0013, DAT-0039]
---

# Getting close to Bloomberg data: sources, costs and licences

## In plain words

A Bloomberg terminal costs about 25,000 USD a year and shows almost every market number in one place. We cannot buy that, but governments and central banks give away a lot of the same numbers for free. This page lists, for each kind of market data, where we can get it free, what a cheap paid service adds, and what only the big vendors sell. It also says which data we are allowed to show on our own site, because most paid services forbid that.

## Summary

Checked on 2026-10-22 by reading each provider's own pages and, where an API answers without a key, calling it. Anything we could not confirm on the provider's own page says **unverified**.

- **Connected now, free, no key:** ECB reference rates for 29 currencies, the euro area AAA yield curve and the euro overnight rate; the full US Treasury yield curve (13 tenors, 1990 on); central bank policy rates for 32 currencies (BIS); CFTC positioning for 23 futures; more FRED series (2s10s, breakevens, real yields, the broad dollar, fed funds, commercial paper, financial conditions, jobless claims, IMF metals and grains). That is 151 new series.
- **Connected, needs a free key:** EIA weekly oil and gas stocks (8 series), skipped until `EIA_API_KEY` is set.
- **The big gap is display rights.** No paid plan under 100 USD a month lets us show its data on our site. Free official data mostly does, with the source named.
- **What we still lack for free:** live prices, FX forwards, option volatility, credit spreads, company estimates and shipping data. Those need paid sources.
- **Plan:** now, keep adding free official data (below). Soon, a FRED key, an EIA key and one paid market data plan under 100 USD a month for our own research. Later, an institutional licence if the site ever needs to show live or proprietary data.

`parity data sources` lists every provider, whether it is on, and whether its key is set. `parity data series --source ecb` lists the series behind one provider.

## What a Bloomberg terminal gives

Bloomberg's student guide lists live FX spot and forecasts, FX option pricing, yield curves and sovereign spreads, bond and CDS pricing, equity indices and screening, a commodity monitor, company financials and analyst estimates, news, and an economic release calendar with forecasts ([Bloomberg student guide](https://assets.bbhub.io/professional/sites/10/Getting-Started-Guide-for-Students-English.pdf)). Positioning data, fund holdings and ship tracking are widely reported to be there too, but we did not confirm them on a Bloomberg page (unverified). A seat is reported at about 27,660 USD a year for one user (unverified, [Wall Street Prep](https://www.wallstreetprep.com/knowledge/bloomberg-vs-capital-iq-vs-factset-vs-thomson-reuters-eikon/)). Display rights cover the seat only.

## Area by area

"Show" means whether the terms let us display the data on our own site.

### FX spot and forwards

| Option | What and how deep | Frequency | Cost and limits | Show? | Key? |
| --- | --- | --- | --- | --- | --- |
| Fed H.10 on FRED (in use) | 21 currencies against USD, 1971 on | Daily, noon New York, out weekly | Free; FRED API 120 requests a minute ([FRED errors](https://fred.stlouisfed.org/docs/api/fred/errors.html)) | Yes, public domain | Optional |
| **ECB reference rates (new)** | 29 currencies against EUR, 1999 on | Daily, about 16:00 CET ([ECB](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)) | Free; no published limit | Yes, ECB named as source ([ECB copyright](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html)) | No |
| Bank of Canada Valet, Riksbank, Norges Bank, RBA | Their own currency against many | Daily | Free; Riksbank 5 calls a minute without a key ([Riksbank FAQ](https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/retrieving-interest-rates-and-exchange-rates-via-api/faq--the-api-for-interest-rates-and-exchange-rates/)) | Yes with credit for Canada ([terms](https://www.bankofcanada.ca/terms/)), Sweden and Australia ([RBA](https://www.rba.gov.au/copyright/)); Norway unverified | No |
| Frankfurter | Rates from about 105 central banks, 1948 on | Daily | Free, no key ([Frankfurter](https://frankfurter.dev/)) | Yes for blended rates | No |
| OANDA v20 practice | Bid and ask candles, 5 seconds up, 2005 on | Live | Free account; 120 requests a second ([OANDA guide](https://developer.oanda.com/rest-live-v20/development-guide/)) | No, licence bans showing rates ([OANDA licence](https://legal.oanda.com/oc/api_license_agreement_oc/en)) | Token |
| Massive Currencies | Real-time FX, 10+ years | Live | 49 USD a month, unlimited calls ([Massive pricing](https://massive.com/pricing)) | No, personal use ([terms](https://massive.com/legal/individuals-terms-of-service)) | Yes |
| Tiingo | 140+ pairs plus metals, 1-minute bars from 2020 | Live | Free 1,000 calls a day; 30 USD Power ([Tiingo pricing](https://www.tiingo.com/about/pricing)) | No; redistribution from 250 USD a month ([Tiingo docs](https://www.tiingo.com/documentation/general/overview)) | Yes |
| FX forwards and swap points | No free official daily source found | | LSEG, Bloomberg, ICE (quote only) | Vendor licence | |

### Interest rates and government curves

| Option | What and how deep | Frequency | Cost and limits | Show? | Key? |
| --- | --- | --- | --- | --- | --- |
| **US Treasury par yield curve (new)** | 13 tenors, 1990 on; real curve from 2003 ([Treasury](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610)) | Daily, from 3:30 pm quotes | Free; one year per request (a request for all years is refused) | Yes, public domain | No |
| Treasury Fiscal Data | Exchange rates, debt, auctions | Varies | Free, no registration ([Fiscal Data](https://fiscaldata.treasury.gov/api-documentation/)) | Yes | No |
| **ECB yield curve (new)** | Euro area AAA spot curve, 2004 on | Daily | Free | Yes, ECB named | No |
| **BIS policy rates (new)** | 32 central banks, some from 1946 | Daily | Free; one request for all | Yes, BIS named, not misleading, no extra charge ([BIS legal](https://data.bis.org/help/legal)) | No |
| NY Fed Markets API | SOFR, EFFR, repo rates | Daily | Free | Yes with the NY Fed notice ([terms](https://www.newyorkfed.org/privacy/termsofuse)) | No |
| Bank of England database | Bank Rate, gilt curves, SONIA | Daily | Free | Yes under the Open Government Licence, except some FX series ([BoE legal](https://www.bankofengland.co.uk/legal)) | No |
| **FRED extras (new)** | 2s10s, 3m10s, breakevens, TIPS yields, fed funds | Daily | Free | Yes; each is tagged public domain or citation required on FRED | Optional |
| OECD | Interbank rates by country (in use through FRED) | Monthly | Free; rate limited, no number published (unverified) | Yes with citation | No |

### Credit

| Option | What | Show? | Notes |
| --- | --- | --- | --- |
| ICE BofA spreads on FRED | High-yield and investment-grade spreads | **No** | ICE forbids reproduction without permission and FRED keeps only 3 years from April 2026 ([BAMLH0A0HYM2](https://fred.stlouisfed.org/series/BAMLH0A0HYM2)). Left out. |
| Moody's Aaa and Baa on FRED | Corporate bond yields | **No** | Moody's forbids redistribution without consent ([DAAA](https://fred.stlouisfed.org/series/DAAA)). Left out. |
| **Treasury HQM curve (new)** | High quality corporate yields, monthly, 1984 on | Yes, public domain | Our licence-clean credit gauge, used a month late. |
| **Commercial paper rates (new)** | 3-month financial and nonfinancial CP | Yes | A short-term credit stress gauge. |
| **NFCI and St. Louis stress index (new)** | Weekly financial conditions | Yes, citation required | |
| Finnhub Bond-1 | US corporate bond trades, 4 hours late | No | 99.99 USD a month ([Finnhub pricing](https://finnhub.io/pricing)) |
| ICE, LSEG, Bloomberg | CDS, bond prices, index levels | Vendor licence | Quote only ([ICE indices](https://www.ice.com/fixed-income-data-services/index-solutions)) |

### Equities and indices

- In use: Kenneth French's library for US total returns, factors and industries ([French](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html)). S&P 500 on FRED is tagged "pre-approval required" and keeps only 10 years ([SP500](https://fred.stlouisfed.org/series/SP500)); we use it only as a cross-check.
- Cheap and keyed: EODHD All-in-One, 99.99 USD a month, 30+ years of global prices plus macro and news ([EODHD pricing](https://eodhd.com/pricing)); Massive Stocks from 29 USD; FMP from 19 USD a month billed yearly ([FMP pricing](https://site.financialmodelingprep.com/pricing-plans)); Alpaca free IEX feed or 99 USD for the full US feed ([Alpaca](https://alpaca.markets/data)). All are personal or internal use only ([EODHD terms](https://eodhd.com/financial-apis/terms-conditions)).
- Display: Intrinio Startup from 333 USD a month is the cheapest plan we found that allows display, US only ([Intrinio](https://intrinio.com/pricing)). Twelve Data Venture is 499 USD a month ([Twelve Data business](https://twelvedata.com/pricing-business)).

### Commodities and futures curves

- In use and new: WTI, Brent, Henry Hub (EIA through FRED) and IMF monthly copper, aluminium, nickel, iron ore, wheat, maize and soybeans. The IMF asks for permission before commercial reuse ([IMF terms](https://www.imf.org/en/About/copyright-and-terms)), so the new IMF series stay off the site.
- A catch: EIA's daily crude spot prices name Refinitiv as their source ([EIA definitions](https://www.eia.gov/dnav/pet/TblDefs/pet_pri_spt_tbldef2.asp)). EIA's public domain policy excludes privately licensed content ([EIA reuse](https://www.eia.gov/about/copyrights_reuse.php)), so showing WTI and Brent on the site carries some risk. We did not add the refined product spot prices for that reason.
- Gold: FRED removed the LBMA gold and silver prices on 2022-01-31 ([FRED notice](https://fred.stlouisfed.org/series/GOLDAMGBD228NLBM)). No free official daily gold price remains. Options: the World Bank Pink Sheet (monthly, CC BY 4.0 for most World Bank data, [licences](https://datacatalog.worldbank.org/public-licenses)), Tiingo's metals feed, or CFTC gold positioning (now connected).
- Futures curves: Databento sells all CME futures and options since 2010 ([Databento dataset](https://databento.com/docs/datasets/glbx-mdp3.md)). New accounts get 125 USD of credit ([Databento credits](https://databento.com/docs/faqs/usage-pricing-and-data-credits.md)), then Standard is 199 USD a month ([Databento pricing](https://databento.com/pricing)). Showing CME data needs a CME distribution licence ([Databento live data](https://databento.com/docs/portal/live-data.md)). Massive Futures starts at 29 USD a month, 10 minutes late.

### Options and volatility

- Free: the VIX on FRED (in use; FRED tags it "citation required", and the note says Cboe reprints it with permission).
- Cheap: Massive Options from 29 USD a month with greeks and implied volatility, personal use. ORATS from 199 USD a month, internal only ([ORATS](https://orats.com/data-api), [terms](https://orats.com/terms)). Cboe DataShop end-of-day option data, price not shown until an order is built (unverified, [DataShop](https://datashop.cboe.com/option-eod-summary)).
- No free source of FX option volatility was found.

### Economic data, calendars and central bank decisions

| Option | What | Cost and limits | Show? | Key? |
| --- | --- | --- | --- | --- |
| FRED and ALFRED | 800,000 series; ALFRED keeps every past version since 2006 ([ALFRED](https://alfred.stlouisfed.org/)) | Free key, 120 requests a minute | Per series tag; FRED's API terms ask for a notice and forbid copying the FRED experience ([FRED API terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html)) | Yes |
| FRED release dates | Future release dates for every release ([docs](https://fred.stlouisfed.org/docs/api/fred/releases_dates.html)) | Free key | Yes | Yes |
| BLS | US jobs and prices | 25 queries a day without a key, 500 with one ([BLS FAQ](https://www.bls.gov/developers/api_faqs.htm)); BLS blocks some scripts | Yes | Optional |
| BEA | GDP, income, trade | 100 requests a minute ([BEA guide](https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf)); release dates as JSON | Yes | Yes |
| Census | Retail sales, housing, trade | A key is now required for every query ([Census limits](https://www.census.gov/data/developers/guidance/api-user-guide.Query_Limits.html)) | Yes with its notice | Yes |
| Eurostat | EU prices, output, jobs | Free ([Eurostat](https://ec.europa.eu/eurostat/help/copyright-notice)) | Yes with source, except third-party data | No |
| IMF | 225 data sets: reserves, BOP, WEO, prices | Free, no key; limits unverified ([IMF API](https://data.imf.org/en/Resource-Pages/IMF-API)) | Commercial reuse needs permission | No |
| OECD, World Bank | Leading indicators, development data | Free | Yes with citation ([OECD terms](https://www.oecd.org/en/about/terms-conditions.html)) | No |
| Central bank meeting dates | FOMC ([calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)), ECB, BoE, BoJ, BoC, RBA, Norges Bank, Riksbank | Free web pages; no machine feed apart from the ECB and FRED | Dates are facts | No |
| Economists' forecasts before each release | Not free anywhere official | Finnhub Economic-1 50 USD a month (personal); Trading Economics calendar is Enterprise only ([TE pricing](https://tradingeconomics.com/api/pricing.aspx)) | No | Yes |

### Company fundamentals, estimates and filings

- **SEC EDGAR** is the free core: filings and XBRL financial facts, no key, at most 10 requests a second, and a User-Agent that names who we are ([EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [developer rules](https://www.sec.gov/about/developer-resources)). Free to reuse.
- Analyst estimates are not free. FMP Premium (69 USD a month) and Finnhub estimates (75 USD) have them, personal use only. Institutional: FactSet, S&P Capital IQ, LSEG I/B/E/S (quote only).

### News, flows, positioning and ownership

- News: see [REF-0013](0013-news-sources-and-market-impact.md). GDELT is free and may be shown with a citation ([GDELT](https://www.gdeltproject.org/about.html)).
- **CFTC Commitments of Traders (new):** weekly positions as of Tuesday, released Friday 3:30 pm ET ([CFTC COT](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm)). Public domain with acknowledgement ([CFTC policy](https://www.cftc.gov/WebPolicy/index.htm)). We use the legacy futures-only report from 1986. The disaggregated and traders-in-financial-futures reports start in 2006 and are the next step. No token is needed; a token only raises a shared limit ([Socrata tokens](https://dev.socrata.com/docs/app-tokens.html)).
- FX volume and flows: CLS sells real FX volume and flow data, quote only ([CLS](https://www.cls-group.com/products/data/clsmarketdata/)).
- Ownership: 13F holdings and insider filings are free from EDGAR. Quiver Quant packages them from 30 USD a month, no redistribution ([Quiver](https://api.quiverquant.com/pricing/)).

### Shipping and alternative data

- **IMF PortWatch:** daily chokepoint transits and port calls from 2019, through a public ArcGIS service with no key. Under IMF terms, so commercial reuse needs permission (unverified licence field).
- UN Comtrade: free key, 500 calls a day, but the data may not be passed on without permission ([Comtrade policy](https://uncomtrade.org/docs/policy-on-comtrade-data-use/)).
- AIS ship positions: aisstream.io offers a free live feed; its terms page did not load (unverified, [aisstream](https://aisstream.io/)).
- The Baltic Dry Index has no free official source that we found.
- Institutional: Kpler now owns MarineTraffic and Spire Maritime ([Kpler](https://www.kpler.com/spireMT/product)); Vortexa (unverified). Quote only.

## Keys the owner should consider

None of these were created. Each goes in the macOS Keychain and is exported as the environment variable shown, for example `export EIA_API_KEY=$(security find-generic-password -s EIA_API_KEY -w)`. The engine reads it by name and never prints it. Add a row to the credentials register in the same step.

| Variable | Service and plan | Cost | What it adds |
| --- | --- | --- | --- |
| `FRED_API_KEY` | FRED API key ([sign-up](https://fred.stlouisfed.org/docs/api/api_key.html)) | Free | The supported route to FRED, ALFRED vintages and release dates. Do this first. |
| `EIA_API_KEY` | EIA open data key | Free | Turns on the 8 weekly oil and gas series already in the catalog. |
| `BLS_API_KEY`, `BEA_API_KEY` | BLS and BEA keys | Free | US jobs, prices and GDP straight from source. |
| `MASSIVE_API_KEY` | Massive Currencies (add Futures for 29 USD) | 49 USD a month | Real-time FX, 10+ years. Research only. |
| `TIINGO_API_KEY` | Tiingo Power | 30 USD a month | FX plus gold, silver and platinum, global daily prices, news. Research only. |
| `DATABENTO_API_KEY` | Databento | 125 USD credit, then usage | CME futures and options history for curves and volatility. |
| `OANDA_API_TOKEN` | OANDA practice account | Free | Bid and ask FX candles since 2005, and paper trading. Research only. |

The best single paid plan under 100 USD a month for our mix is either Massive Currencies (49 USD) for live FX or EODHD All-in-One (99.99 USD) for breadth. Neither allows display on the site.

## Recommended plan

**Now (free).** Done in this change: ECB, US Treasury, BIS, CFTC and more FRED. Next free steps:
1. Get the FRED and EIA keys.
2. Add the CFTC disaggregated and financial futures reports.
3. Add the NY Fed reference rates (SOFR), carrying its notice.
4. Add SEC EDGAR company facts, with `PARITY_CONTACT` in the User-Agent.
5. Store FRED release dates and ALFRED first releases, so tests can use data as first published.

**Soon (under 100 USD a month).** One market data plan for our own research: Massive Currencies (49 USD), Tiingo Power (30 USD), or EODHD All-in-One (99.99 USD). Spend the Databento credit on CME curve history. Keep paid data off the site.

**Later (institutional).** If the site must show live or proprietary data, budget for a redistribution licence: Tiingo from 250 USD a month, Twelve Data Venture 499 USD, or vendors such as LSEG (Workspace reported about 22,000 USD a year, unverified), Bloomberg B-PIPE or Data License (quote only), ICE, FactSet, CLS for FX flows and Kpler for shipping.

## What we left out and why

| Source | Why |
| --- | --- |
| ICE BofA spreads, Moody's yields, S&P 500 on FRED | Owners forbid redistribution or need pre-approval. |
| EIA refined product spot prices | EIA sources them from Refinitiv. |
| Dukascopy, Stooq, Yahoo | Terms ban scraping or allow personal use only ([Dukascopy terms](https://www.dukascopy.com/swiss/english/legal-pages/terms-of-use/)). Yahoo stays a cross-check. |
| SNB and Bank of Japan data | Non-commercial use only ([SNB](https://www.snb.ch/en/srv/disclaimer_copyright), [BoJ](https://www.boj.or.jp/en/copyright.htm)). Fine for research, not yet added. |
| exchangerate.host | Terms ban posting the data on the internet ([terms](https://exchangerate.host/terms)). |

## How it works in the engine

- New series are all optional, so an official run never fails on them, and no existing strategy reads them.
- Weekly data are moved to the day they are released: COT by 3 business days, EIA petroleum by 3, gas storage, claims and the stress index by 4, the euro overnight rate by 1. Monthly averages are used after the month ends, as for copper.
- Bulk series (most COT contract counts, the less used tenors and currencies) are fetched but kept off the site's data file, which stays small.
- Each provider gets one request per data set where it can, with pauses between requests and our own User-Agent. A full fetch of the new series took 100 seconds.
- Code: `engine/src/parity/data/catalog.py`, `sources.py`, `providers.py`. Tests: `engine/tests/test_wider_data.py`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0024: Parity Terminal, a market terminal of its own at the sim address](../decisions/0024-parity-terminal-a-market-terminal-of-its-own-at-the-sim-address.md)
- [DEC-0026: A news archive and an impact engine that ranks by evidence](../decisions/0026-a-news-archive-and-an-impact-engine-that-ranks-by-evidence.md)
- [DEC-0029: Private markets, free proxies, an unsmoothing study and plain pages](../decisions/0029-private-markets-free-proxies-an-unsmoothing-study-and-plain-pages.md)
- [DEC-0031: Trade charts, pro charting on delayed data](../decisions/0031-trade-charts-pro-charting-on-delayed-data.md)
- [RES-0012: Private markets, how they are measured and how individuals get in](../research/0012-private-markets-how-they-are-measured-and-how-individuals-get-in.md)
- [REF-0003: Data sources](0003-data-sources.md)
- [REF-0010: FX data sources, licences and resolution](0010-fx-data-sources-licences-and-resolution.md)
- [LOG-0008: Ayan work log, wordmark, Sim World, markets, legal and the redesign](../log/2026-10-22-ayan-work-log-wordmark-sim-world-markets-legal-and-redesign.md)
<!-- backlinks:end -->
