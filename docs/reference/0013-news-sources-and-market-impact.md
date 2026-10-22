---
id: REF-0013
title: News sources and market impact
type: reference
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [data, fx, method, news]
related: [DAT-0016, DAT-0042, REF-0003]
---

# News sources and market impact

## In plain words

The News page shows the newest announcements from central banks, government statistics offices and an open news index, and how prices moved after each one. It also lists the biggest market days since 1999. A big move after a headline does not prove the headline caused it: lots of things happen on the same day.

## Summary

The engine fetches headlines from sources whose terms allow it, tags each one with the currencies, commodities, regions and kind of news it mentions, and stores only the headline, the link and, where the terms allow, a short summary. It then measures the move in our own price series 1 day, 1 week and 1 month after publication and compares it with a normal move (a z-score). The site gets this as static JSON at deploy time. Code: `engine/src/parity/news/`. Page: `#/news`.

## Sources

Checked on 2026-10-21 by opening each feed and each terms page. Each source also has a catalog entry with a "News use" section.

| Source | What | Licence | Shown on the site | Needs |
| --- | --- | --- | --- | --- |
| Federal Reserve ([DAT-0042](../datasets/0042-federal-reserve-press.md)) | Press releases, FOMC statements | Public domain | yes | nothing |
| ECB ([DAT-0043](../datasets/0043-ecb-press.md)) | Press releases, speeches | Free use if the ECB is cited | yes | nothing |
| Bank of England ([DAT-0044](../datasets/0044-bank-of-england-news.md)) | News, MPC decisions | Bank copyright, headline reuse not spelled out | not yet | owner to ask the Bank |
| Bank of Japan ([DAT-0045](../datasets/0045-bank-of-japan-news.md)) | What's new | Reuse allowed crediting the Bank, non-commercial | yes | nothing |
| EIA ([DAT-0011](../datasets/0011-eia.md)) | Today in Energy, press releases | Public domain | yes | nothing |
| BEA ([DAT-0004](../datasets/0004-bea.md)) | Release feed | Public domain | yes | nothing |
| BLS ([DAT-0007](../datasets/0007-bls.md)) | Latest releases | Public domain | yes | `PARITY_CONTACT` (BLS refuses unnamed bots) |
| SEC ([DAT-0046](../datasets/0046-sec-press.md)) | Press releases | Public domain | yes | `PARITY_CONTACT` (SEC asks bots to name themselves) |
| CFTC ([DAT-0047](../datasets/0047-cftc-press.md)) | Press releases | Public domain | yes | nothing |
| GDELT ([DAT-0016](../datasets/0016-gdelt.md)) | Headlines seen worldwide, 2017 on | Free with citation; headlines belong to each outlet | yes, headline and link only | nothing |
| Alpha Vantage ([DAT-0002](../datasets/0002-alpha-vantage.md)) | News with sentiment | Personal, non-commercial use | no | `ALPHAVANTAGE_API_KEY` |
| Finnhub ([DAT-0012](../datasets/0012-finnhub.md)) | Market news | Free plan strictly personal, no sharing | no | `FINNHUB_API_KEY` |
| Marketaux ([DAT-0022](../datasets/0022-marketaux.md)) | Financial news | Personal, non-commercial use | no | `MARKETAUX_API_TOKEN` |

`PARITY_CONTACT` is an email or web address, not a secret. It is added to our own user agent (`parity-research/0.1 (private research project; <contact>)`). We never pretend to be a browser.

The three keyed APIs work if someone sets a key, but their free plans are for one person's own use, so the export leaves them out of the shared site. No keys were created for this work.

### Sources we do not use

- **Robinhood** and **the Wall Street Journal**. Dow Jones's terms forbid access "using any automated means, webcrawler, spider, script". We did not find a scraping clause in Robinhood's terms, but it offers no public news feed and we will not collect from its pages.
- **Most news sites.** Their terms forbid scraping. We do not bypass bot checks or spoof user agents.
- **BBC News RSS.** Allowed on a personal site with credit, but "you're not allowed to pluck metadata" and business use needs permission, so we leave it out.

## What we store

| Field | Meaning |
| --- | --- |
| `id` | First 16 characters of a hash of source and link |
| `source`, `publisher` | Our source id, and the outlet when that differs (GDELT, APIs) |
| `published_at` | UTC time from the feed |
| `title`, `url` | Headline and link |
| `summary` | At most 280 characters, only when the source's terms allow it; empty for GDELT and the keyed APIs |
| `currencies`, `commodities`, `regions`, `category` | Keyword tags, see `parity/news/tagging.py` |

Stored as parquet in `engine/data/news/`, which git ignores. Never the article text.

## How the market move is measured

1. **Event day.** The first trading day whose 4pm New York close comes after publication. A release at 2pm counts for that day; one at 6pm counts for the next.
2. **Starting price.** The last close before the event day, in that series' own trading days. Days with no new price stay empty rather than being filled, so a stale price is never read as "no move".
3. **Move.** Percent change for prices (stocks, currencies, oil, gas), change in percentage points for yields. Over 1, 5 and 21 trading days.
4. **Normal move.** The standard deviation of daily changes over the 250 trading days up to the starting price, times the square root of the horizon. Only data from before the event is used.
5. **z-score.** Move divided by normal move. Around 1 is ordinary, 2 is unusual, 3 or more is rare.

Which series an item is measured in comes from its tags: each tagged currency against the dollar, a US dollar basket (the dollar against an equal mix of the nine other G10 currencies) for USD, WTI oil for oil, Henry Hub for gas, the 10 year Treasury yield for central bank and economic data news, and US stocks (`eq.US_TOTAL`) for everything.

| Horizon | Status |
| --- | --- |
| 1 hour | Not available: the engine has no intraday prices. The code measures it if an intraday series is passed in. |
| 1 day, 1 week, 1 month | Daily closes from FRED and Kenneth French ([REF-0003](0003-data-sources.md)) |

Gold is not measured: FRED stopped publishing the London gold price in 2022 and we have no other free daily gold series. Copper is monthly only.

## Biggest days in history

For US stocks, the dollar basket, EUR, JPY, WTI and the 10 year yield, the 25 biggest one day moves since 1999, each with its z-score against the year before it. Headlines for those days come from our stored items and from GDELT's search for that day (`parity news records --explain N`), which covers 2017 on. Older days say that no source we may show covers them. Wikipedia's daily "Current events" pages (CC BY-SA) could fill 2002 to 2016, but its API asks for contact details in the user agent and we have not built it.

WTI went below zero in April 2020. A percent change through a negative price means nothing, so those two days have no move.

## Limits

- **Correlation is not cause.** Several items often land on the same day, and the market may be reacting to something else entirely.
- **Look-ahead.** The normal move uses only earlier data, but the price path in the article drawer shows what came after. It is for reading, never for a signal. Any strategy built on this must use only the publication time and prices before it.
- **Explaining after the fact.** Headlines like "stocks fall as..." are written after the move. GDELT's time is when it saw the story, not when the event happened.
- **Feed times.** Some feeds give the time a page was updated, not first published. Alpha Vantage does not say which time zone it uses; we read it as New York time.
- **Daily FX is a noon rate.** FRED's exchange rates are New York noon rates, so a release after noon shows up a day late for currencies.
- **Picking extremes.** Sorting by the most unusual move picks the outliers among hundreds of items; some will be large by chance.
- **Tags are keywords.** They miss things and sometimes tag wrongly. Fix the word lists in `tagging.py`.
- **GDELT throttles.** It returned "too many requests" even at one call every 20 seconds on 2026-10-21. The hourly job makes one call; the record lookups stop at the first refusal and resume next time.

## Commands and schedule

| Command | What it does |
| --- | --- |
| `parity news fetch` | Fetch every source that can run here; `--source fed` for one |
| `parity news list` | Newest headlines; `--currency EUR`, `--category energy` |
| `parity news impact` | Write `impacts.parquet` and print the biggest next day moves |
| `parity news records --explain 10` | Biggest days, looking up 10 more days on GDELT |
| `parity news export web/dist/data` | Write `news/articles.json` and `news/records.json` for the site |

The `News` workflow runs every hour: it restores the data cache, fetches prices if the cache is empty, fetches news from the free sources, looks up a few record days on GDELT and saves the cache. It commits nothing. The deploy workflow restores the same cache and runs `parity news export` before publishing the site.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [LOG-0006: Ayan work log, merges, domain, email and the two product plan](../log/2026-10-21-ayan-work-log-merges-domain-email-and-the-two-product-plan.md)
- [DAT-0002: Alpha Vantage](../datasets/0002-alpha-vantage.md)
- [DAT-0004: BEA Data API](../datasets/0004-bea.md)
- [DAT-0007: BLS Public Data API](../datasets/0007-bls.md)
- [DAT-0011: EIA Open Data API v2](../datasets/0011-eia.md)
- [DAT-0012: Finnhub](../datasets/0012-finnhub.md)
- [DAT-0016: GDELT Project](../datasets/0016-gdelt.md)
- [DAT-0022: Marketaux](../datasets/0022-marketaux.md)
- [DAT-0042: Federal Reserve press releases](../datasets/0042-federal-reserve-press.md)
- [DAT-0043: ECB press releases](../datasets/0043-ecb-press.md)
- [DAT-0044: Bank of England news](../datasets/0044-bank-of-england-news.md)
- [DAT-0045: Bank of Japan what's new](../datasets/0045-bank-of-japan-news.md)
- [DAT-0046: SEC press releases](../datasets/0046-sec-press.md)
- [DAT-0047: CFTC press releases](../datasets/0047-cftc-press.md)
<!-- backlinks:end -->
