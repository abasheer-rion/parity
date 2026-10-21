# Source and number verification

Run date: 2026-10-21. Made by `scripts/verify_sources.py` in 0 minutes with 22 web requests.
Raw results: `sources.json`, `numbers.json`, `crossrefs.json` in this folder.

## In plain words

Every link in the catalog and the research docs was opened, and every reported Sharpe ratio, return,
volatility and drawdown in the catalog was searched for on the page it cites. A number counts as found
only if it appears on the page in a form it would normally be written in. Not found does not always mean
wrong: the paper may print it differently, or the catalog may have computed it. But it does mean nobody
can check it by opening the link.

## Counts

Links and repo paths checked: 575

| Link status | Count |
|---|---|
| ok | 392 |
| redirect-ok | 45 |
| blocked | 130 |
| not-found | 7 |
| error | 1 |

Catalog numbers checked: 332 (from 118 reported results)

| Number status | Count |
|---|---|
| found | 200 |
| not-found | 3 |
| page-unreadable | 129 |

3 of the not-found and 128 of the unreadable numbers are the catalog's own calculations from data files (see below), not claims about a page.
Of the found numbers, 6 matched only after rounding (for example 7.23 percent found as 7.2).
Of the unreadable ones, 0 cite only an abstract or landing page, and the rest are blocked, broken or failed to extract.

Numbers written next to links in docs/research: 186 checked, 141 found, 7 not found, 38 unreadable.

Reported results marked verified_on_page=true but with a number missing from a readable page: 0 results (0 numbers).

Papers (DOI, arXiv, NBER or SSRN id) cited in more than one place: 38. With a year or first-author disagreement between places: 10.

## Catalog numbers not found on a readable page

These are the suspicious ones. The page opened and had text, but the number was not on it.

| Entry | Result | Field | Value | Claimed verified | Source | Page read |
|---|---|---|---|---|---|---|
| (none) | | | | | | |

## Numbers the catalog says it calculated itself

139 numbers in 35 reported results say "our calculation" from a public dataset. They cannot be
checked by reading a page. They need to be recomputed from the data file. Entries: betting-against-beta, commodity-carry-roll-yield, commodity-time-series-momentum, dual-momentum, equity-cross-sectional-momentum, managed-futures-trend-following, sell-in-may-halloween, sixty-forty-portfolio, sp500-buy-and-hold, trend-plus-carry-combined, turn-of-the-month, value-hml, volatility-managed-portfolios.

## Found, but scattered across the page

All numbers of these results were found, but not close together (more than 1,500 characters apart at best), so
they may be matching unrelated places in the paper rather than one table row. Worth a look.

| Entry | Result | Closest window (characters) | Source |
|---|---|---|---|
| betting-against-beta | 0 | 5705 | Frazzini and Pedersen, Betting Against Beta (May 2013 draft), Table III |
| finbert-gdelt-fx-sentiment | 0 | numbers found in different documents | Zhang (2025), arXiv 2505.16136, Table 1 |
| fx-carry-g10 | 2 | 1504 | Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (EQ strategy) |
| fx-carry-g10 | 3 | 2154 | Daniel, Hodrick, Lu (2014), NBER WP 20433, Table 1 (SPD strategy) |
| sixty-forty-portfolio | 2 | 4669 | Our calculation from Damodaran historical returns, 60% S&P 500 and 40% 10-year T-bond |
| sixty-forty-portfolio | 3 | 7432 | Our calculation from Damodaran historical returns, 60% S&P 500 and 40% 10-year T-bond |
| sp500-buy-and-hold | 0 | 4218 | Our calculation from Damodaran historical returns (S&P 500 incl. dividends) |

## Found, but only weakly

The only number of the result that was found, and either no matching word (Sharpe, return, volatility, drawdown) is nearby or it
matched only after rounding. The match may be a coincidence.

| Entry | Result | Field | Value | Snippet |
|---|---|---|---|---|
| sp500-buy-and-hold | 1 | annual_return | 0.1778 | 5,538.74 $ 12,649.47 2025 17.78% 16.53% 4.21% 7.80% 6.96% 1.5 |

## verified_on_page claims that the page contradicts

Each of these reported results says it was checked on the page, but at least one of its numbers is not on the readable page.

| Entry | Result | Missing fields | Source |
|---|---|---|---|
| (none) | | | |

## Catalog numbers whose page could not be read

| Reason | Numbers |
|---|---|
| ok: source is a data file (spreadsheet, zip or CSV); the number is a calculation, not prin | 128 |
| blocked: HTTP 403 | 1 |

Pages behind the unreadable numbers:

- https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip (32 numbers; ok: source is a data file (spreadsheet, zip or CSV); the number is a calculation, not printed text)
- https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip (24 numbers; ok: source is a data file (spreadsheet, zip or CSV); the number is a calculation, not printed text)
- https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Time-Series-Momentum-Factors-Monthly.xlsx (20 numbers; ok: source is a data file (spreadsheet, zip or CSV); the number is a calculation, not printed text)
- https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Century-of-Factor-Premia-Monthly.xlsx (16 numbers; ok: source is a data file (spreadsheet, zip or CSV); the number is a calculation, not printed text)
- https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Momentum_Factor_CSV.zip (16 numbers; ok: source is a data file (spreadsheet, zip or CSV); the number is a calculation, not printed text)
- https://www.aqr.com/-/media/AQR/Documents/Insights/Data-Sets/Betting-Against-Beta-Equity-Factors-Monthly.xlsx (12 numbers; ok: source is a data file (spreadsheet, zip or CSV); the number is a calculation, not printed text)
- https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_ex_US_3_Factors_CSV.zip (8 numbers; ok: source is a data file (spreadsheet, zip or CSV); the number is a calculation, not printed text)
- https://doi.org/10.1093/rfs/hhj020 (1 numbers; blocked: HTTP 403)

## Links that are broken

| Link | Status | Why | Cited in |
|---|---|---|---|
| https://api.tradingeconomics.com/calendar?c=guest:guest | not-found | HTTP 410 | catalog/datasets/trading-economics.json |
| https://datafeed.dukascopy.com/datafeed/EURUSD/2024/00/02/10h_ticks.bi5 | error | HTTP 503 | catalog/datasets/dukascopy.json |
| https://docs.data.nasdaq.com/ | not-found | HTTP 404 | catalog/datasets/nasdaq-data-link.json |
| https://docs.data.nasdaq.com/docs/rate-limits-1 | not-found | HTTP 404 | catalog/datasets/nasdaq-data-link.json |
| https://www.ftc.gov/legal-library/browse/cases-proceedings/2023198-warrior-trading-inc-ftc-v | not-found | HTTP 404 | docs/research/0006-courses-and-trader-beliefs.md |
| https://www.ftc.gov/news-events/news/press-releases/2022/04/federal-trade-commission-cracks-down-warrior-trading-misleading-consumers-false-investment-promises | not-found | HTTP 404 | docs/research/0006-courses-and-trader-beliefs.md |
| https://www.ftc.gov/system/files/ftc_gov/pdf/2023198WarriorTradingComplaint_0.pdf | not-found | HTTP 404 | docs/research/0006-courses-and-trader-beliefs.md |
| https://www.warriortrading.com/pricing/ | not-found | HTTP 404 | docs/research/0006-courses-and-trader-beliefs.md |

## Links that block automated readers

These may work in a normal browser. They cannot be checked by script.
Of these, 43 are DOI links that reach a publisher which blocks scripts. All 63 of 63 DOI links are registered DOIs (checked with the doi.org handle API).

doi.org (43), papers.ssrn.com (11), fred.stlouisfed.org (10), quant.stackexchange.com (6), www.bls.gov (5), macrosynergy.com (4), www.kaggle.com (4), www.oecd.org (3), academic.oup.com (2), data.imf.org (2), onlinelibrary.wiley.com (2), site.financialmodelingprep.com (2), stooq.com (2), www.coingecko.com (2), www.trustpilot.com (2), academy.investopedia.com (1), alfred.stlouisfed.org (1), api-fxpractice.oanda.com (1), api.eia.gov (1), api.gdeltproject.org (1), arbitrageghost.medium.com (1), data-explorer.oecd.org (1), finnhub.io (1), researchonline.lse.ac.uk (1), scholar.harvard.edu (1), ssrn.com (1), theforexgeek.com (1), tradingbrokers.com (1), uk.trustpilot.com (1), www.ams.org (1), www.babypips.com (1), www.bluecapitaltrading.com (1), www.cmegroup.com (1), www.forbes.com (1), www.forexfactory.com (1), www.imf.org (1), www.investing.com (1), www.myfxbook.com (1), www.octobot.cloud (1), www.quantvps.com (1), www.sec.gov (1), www.sunsethq.com (1), www.tandfonline.com (1), www.udemy.com (1), www.wikifx.com (1)

## Cross-reference disagreements

The same paper (same DOI, arXiv, NBER or SSRN id) cited with a different year or first author in different places.
Year gaps of a few years are often a working paper year against a journal year, which is a style issue, not an error.

Real disagreements between citations of the same paper:

| Paper id | Problem | Places |
|---|---|---|
| (none) | | |

Disagreements that involve only an entry's origin field. Either the origin names who first had the idea (for example
Appel for MACD, 1979) while origin.source_url links a later paper by someone else, or the origin year is the working
paper year while other places give the journal year. Not citation errors, but the origin link does not always point
to the originator:

| Paper id | Problem | Places |
|---|---|---|
| arxiv:2011.09607 | places name different first authors: FinRL, Liu | deep-rl-trading-finrl.json origin.source_url: Liu 2020; deep-rl-trading-finrl.json reported_results[0].source_url: FinRL None |
| arxiv:2510.14435 | places cite different years: 2022, 2025; places name different first authors: Borri, Schmeling | crypto-cross-sectional-factors.json reported_results[1].source_url: Borri 2025; crypto-perp-funding-carry.json origin.source_url: Schmeling 2022; crypto-perp-funding-carry.json reported_results[0].source_url: Borri 2025 |
| doi:10.1016/j.jfineco.2016.02.015 | places cite different years: 2013, 2016; places name different first authors: Corte, Della | fx-volatility-risk-premium.json origin.source_url: Della 2013; 0001-reading-list.md line 67: Corte 2016 |
| doi:10.1016/j.jfineco.2017.11.002 | places cite different years: 2013, 2018 | trend-plus-carry-combined.json origin.source_url: Koijen 2013; 0001-reading-list.md line 56: Koijen 2018 |
| doi:10.1016/j.jinteco.2016.03.012 | places cite different years: 1978, 2016; places name different first authors: Cornell, Hsu | fx-technical-trading-rules.json origin.source_url: Cornell 1978; 0001-reading-list.md line 153: Hsu 2016 |
| doi:10.1080/17446540701206576 | places cite different years: 2001, 2007; places name different first authors: Bollinger, Lento | bollinger-band-reversion-breakout.json origin.source_url: Bollinger 2001; bollinger-band-reversion-breakout.json reported_results[0].source_url: Lento 2007 |
| doi:10.1093/rfs/hhj020 | places cite different years: 1999, 2006 | pairs-trading-distance.json origin.source_url: Gatev 1999; pairs-trading-distance.json reported_results[0].source_url: Gatev 2006 |
| doi:10.1287/mnsc.2019.3508 | places cite different years: 2010, 2020 | copy-trading-signal-services.json origin.source_url: None 2010; copy-trading-signal-services.json reported_results[0].source_url: Apesteguia 2020 |
| doi:10.3390/jrfm7010001 | places cite different years: 1979, 2014; places name different first authors: Appel, Chong | macd-crossover.json origin.source_url: Appel 1979; macd-crossover.json reported_results[0].source_url: Chong 2014; rsi-overbought-oversold.json reported_results[0].source_url: Chong 2014 |
| ssrn:2628581 | places cite different years: 1969, 2016; places name different first authors: Hosoda, Lim | ichimoku-cloud.json origin.source_url: Hosoda 1969; ichimoku-cloud.json reported_results[0].source_url: Lim 2016 |

## Citations that disagree with the registry

Year or first author given in the repo against Crossref or arXiv metadata. Only first-author mismatches and year gaps
of more than 3 years are listed here, since smaller gaps are usually working paper against journal year. All are in crossrefs.json.

| Paper id | Registry title | Problem |
|---|---|---|
| arxiv:2011.09607 | FinRL: A Deep Reinforcement Learning Library for Automated Stock Tradi | deep-rl-trading-finrl.json reported_results[0].source_url: names FinRL, arXiv says Liu |
| arxiv:2510.14435 | Cryptocurrency as an Investable Asset Class: Coming of Age | crypto-perp-funding-carry.json origin.source_url: names Schmeling, arXiv says Borri |
| doi:10.1007/s10479-019-03357-1 | Technical trading and cryptocurrencies | technical-indicator-trading-bots.json origin.source_url: cites 2016, Crossref says 2021 (online 2019); technical-indicator-trading-bots.json origin.source_url: names Zenbot, Crossref says Hudson |
| doi:10.1016/j.jfineco.2016.02.015 | Volatility risk premia and exchange rate predictability | fx-volatility-risk-premium.json origin.source_url: names Della, Crossref says Della Corte |
| doi:10.1016/j.jfineco.2017.11.002 | Carry | trend-plus-carry-combined.json origin.source_url: cites 2013, Crossref says 2018 |
| doi:10.1016/j.jfineco.2019.09.002 | Economic momentum and currency returns | fx-economic-momentum.json origin.source_url: cites 2015, Crossref says 2020 |
| doi:10.1016/j.jinteco.2016.03.012 | Technical trading: Is it still beating the foreign exchange market? | fx-technical-trading-rules.json origin.source_url: cites 1978, Crossref says 2016; fx-technical-trading-rules.json origin.source_url: names Cornell, Crossref says Hsu |
| doi:10.1017/9781108883658 | Machine Learning for Asset Managers | 0001-reading-list.md line 171: names Elements, Crossref says Lopez de Prado |
| doi:10.1080/17446540701206576 | Investment information content in Bollinger Bands? | bollinger-band-reversion-breakout.json origin.source_url: cites 2001, Crossref says 2007; bollinger-band-reversion-breakout.json origin.source_url: names Bollinger, Crossref says Lento |
| doi:10.1093/rfs/hhj020 | Pairs Trading: Performance of a Relative-Value Arbitrage Rule | pairs-trading-distance.json origin.source_url: cites 1999, Crossref says 2006 |
| doi:10.1111/jofi.12196 | The PreFOMC Announcement Drift | pre-fomc-drift.json origin.source_url: cites 2011, Crossref says 2015 |
| doi:10.1257/000282803321455151 | Micro Effects of Macro Announcements: Real-Time Price Discovery in For | 0001-reading-list.md line 40: names Andersen, Crossref says Anderson |
| doi:10.1287/mnsc.2019.3508 | Copy Trading | copy-trading-signal-services.json origin.source_url: cites 2010, Crossref says 2020 |
| doi:10.3390/jrfm7010001 | Revisiting the Performance of MACD and RSI Oscillators | macd-crossover.json origin.source_url: cites 1979, Crossref says 2014; macd-crossover.json origin.source_url: names Appel, Crossref says Chong |

## Numbers in docs/research not found on the linked page

Found by a looser scan: every decimal or percent in a list item or table row that has a link. Some are the doc's
own numbers rather than claims about the link, so treat this as a list to look at, not a list of errors.

| Doc line | Number | Context | Page read |
|---|---|---|---|
| 0001-reading-list.md:155 | 10% | Learning Methods." . Preprint.** Reports about 10% lower forecast error than bas | https://arxiv.org/pdf/2408.13214 |
| 0002-open-source-and-public-results.md:136 | 15% | py / Copy his structure. Expect losing years of 15% or more even with a Sharpe ne | https://qoppac.blogspot.com/2025/04/annual-performance-update-returneth.html |
| 0003-forums-and-practitioners.md:84 | 16% | ar before was his worst futures year, about minus 16%. / , / **[public record]** | https://qoppac.blogspot.com/2026/04/annual-performance-update-year-12.html |
| 0003-forums-and-practitioners.md:193 | 7.78 | ([WSO quant AMA (archive)]). Replies to a Sharpe 7.78 FX backtest: "either massivel | https://web.archive.org/web/20250819124954/https://www.wallstreetoasis.com/forum/hedge-fun |
| 0006-courses-and-trader-beliefs.md:81 | 0.39 | omentum and value went from an average Sharpe of +0.39 to -0.32 ( , via our earlier | https://qoppac.blogspot.com/2025/10/is-degradation-of-trend-following.html |
| 0006-courses-and-trader-beliefs.md:81 | -0.32 | and value went from an average Sharpe of +0.39 to -0.32 ( , via our earlier note). Ca | https://qoppac.blogspot.com/2025/10/is-degradation-of-trend-following.html |
| 0006-courses-and-trader-beliefs.md:121 | 74% | currency pairs ([ESMA]). ESMA's earlier range was 74% to 89%. | https://www.esma.europa.eu/press-news/esma-news/esma-agrees-prohibit-binary-options-and-re |

## Manual checks

Done by hand on 2026-10-21 by opening each source. The script found only 2 reported results whose verified_on_page claim
looked contradicted, so the list below also covers the weakest automatic matches, the scattered matches, the one blocked
source, every Sharpe above 2, and a recompute of the catalog's own calculations.

1. fx-volatility-risk-premium, result 0 (volatility 8.15 percent). Page supports it. The PDF prints decimal points as
   colons ("8:15", "17:0"), so the text search missed it. Table 3 Panel A, developed column: mean 4.95, Sdev 8.15,
   SR 0.61, MDD 17.0. All four catalog numbers are right. The script now corrects colon decimals.
2. fx-volatility-risk-premium, result 1 (volatility 8.14 percent, drawdown 24.4 percent). Page supports it. Same table,
   developed and emerging column: 4.16, 8.14, 0.51, 24.4. The carry figures in the notes (Sharpe 0.53, drawdown 28.2) also match.
3. fx-carry-g10, results 2 and 3 (Daniel, Hodrick and Lu). Page supports them. Sharpe 0.78 and 0.87, standard deviation
   5.06 and 7.62, means 3.96 and 6.60 percent, drawdowns 12 percent (94 days) and 21.5 percent are all printed. They
   look scattered only because the drawdowns come from a later section, as the notes say.
4. betting-against-beta, result 0. Page supports it. Table III: BAB excess return 0.70 percent a month, volatility 10.7,
   Sharpe 0.78. The 8.4 percent annual return is 0.70 times 12, as the notes say. The script's own match for 8.4 was a
   coincidence elsewhere in the paper.
5. crypto-time-series-momentum, result 1 (Sharpe 0.37). Number is right but misleading. Table 17 shows 0.37 for the top
   quintile, but it is a weekly Sharpe ratio (about 2.7 if annualized). Result 0 (0.45) and
   crypto-google-search-attention (0.48) are weekly too. They sit in the same field as annual Sharpe ratios, so any
   comparison or median across the catalog (for example in docs/research/0007) mixes units.
6. fx-fomc-dollar-announcement, result 0 (Sharpe 0.51). Page supports it. The script's first hit was "-0.51bps", a
   coincidence, but the paper also says "an increase in the Sharpe ratio from 0.51 to 0.93".
7. managed-futures-trend-following, result 2 (volatility 12 percent). Page supports it. The script matched an unrelated
   0.12 coefficient, but the paper says the TSMOM factor "has an annualized volatility of 12% per year over the sample
   period 1985-2009".
8. pairs-trading-distance, result 0 (11 percent). The DOI page blocks scripts. The abstract (read through OpenAlex) says
   "average annualized excess returns of up to 11%". Supported, but it is an upper figure ("up to"), not an average.
9. Every Sharpe above 2. All are printed in their sources exactly as the catalog has them: finbert-gdelt-fx-sentiment
   5.87 (with 55.4 percent return and -15.6 percent drawdown in the same row of Table 1), crypto-perp-funding-carry 6.45
   and 2.24, llm-headline-sentiment 2.97, lstm-sequence-models 2.3365 (same column as its return, volatility and
   drawdown). The copying is right. Whether these numbers are believable is a separate question.
10. The catalog's own calculations (139 numbers, 35 results). Recomputed 15 results (60 numbers) from the Kenneth French
    files (HML, momentum, market) and the AQR time series momentum file with the method the notes describe. Every
    number matched to the printed precision. Not recomputed: AQR betting against beta, AQR Century of Factor Premia,
    Damodaran, dual momentum, turn of the month, Halloween and volatility-managed portfolios.

Other things found while checking:

- The three FTC links about Warrior Trading in docs/research/0006 return 404, also with a browser user agent. The claims
  they support currently have no working source.
- Carver's year 11 post is readable. It shows -16.3 percent, a 12.0 percent CAGR and a Sharpe of 0.76, so the
  "[unverified, from a search snippet]" note in docs/research/0003 can be dropped.
- Doc numbers the scan flagged as missing are supported in another form: ESMA prints "74-89%", and arXiv 2408.13214 says
  10.69 percent lower MAE (the doc says "about 10%").
- Crossref lists the first author of the 2003 AER paper (doi 10.1257/000282803321455151) as "Anderson". The repo's
  "Andersen" is correct. The registry is wrong.
- No two places cite the same paper with a different year or author, except where an entry's origin field names the
  original idea or the working paper year. In 7 entries (MACD, Bollinger, Ichimoku, FX technical rules, copy trading,
  crypto funding carry, pairs trading) origin.source_url links a later paper, not the originator.
