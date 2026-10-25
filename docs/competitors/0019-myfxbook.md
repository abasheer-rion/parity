---
id: CMP-0019
title: Myfxbook, the forex track record and analysis site traders cite
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, fx, method, strategy]
related: [CMP-0001, RES-0020, DEC-0032, DEC-0036, DEC-0033]
---

# Myfxbook, the forex track record and analysis site traders cite

## In plain words

Myfxbook is a free website where forex traders connect their trading account and get a public page of charts and numbers. A small "verified" label means Myfxbook has checked the trades really happened at the broker. Traders paste these links in forums and sales pages as proof. Parity should learn that a link people can share is what made Myfxbook the standard, and beat it by saying whether the record could just be luck.

## Summary

| | |
| --- | --- |
| What it is | A forex account analysis and track record site with an economic calendar, news, sentiment ("Community Outlook"), calculators and a forum. Run by Myfxbook Ltd |
| Who uses it | Retail FX traders and the people selling them signals and robots. Its iOS app has 6,479 US ratings (4.4 stars) and its Android app has over 1 million downloads ([App Store](https://apps.apple.com/us/app/forex-calendar-market-news/id985947299), [Google Play](https://play.google.com/store/apps/details?id=com.myfxbook.forex&hl=en), checked 24 October 2026). No site-wide user count we could read |
| Pricing | Core site free, with ads. A paid tier exists (an App Store reviewer says they pay for live updates); its price is **unverified** because the site refused us. A sister app, Marketlog, sells $7.99 to $179.99 subscriptions ([App Store](https://apps.apple.com/us/app/marketlog-portfolio-tracker/id6480523672)) |
| Markets | FX and CFDs via MetaTrader 4 and 5 and other retail platforms (platform list **unverified**) |
| Platforms | Web; iOS and Android app (calendar, news, rates, portfolio view, calculators); a public API (**unverified**, page blocked) |
| Signature features | Public account pages with growth, drawdown and trade stats; "Track Record verified" and "Trading Privileges verified" labels; economic calendar; Community Outlook sentiment; position size and pip calculators |

## Strengths and weaknesses

How it verifies (from [RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md), **unverified** today because myfxbook.com and every subdomain we tried returned HTTP 403 behind a bot check): the trader gives Myfxbook a read-only investor password, and Myfxbook pulls the history from the broker server, so trades cannot be typed in by hand. That earns "Track Record verified". A second label, "Trading Privileges verified", proves the person showing the page controls the account. That is all it checks. It proves the trades happened on that one account. It does not ask how many other accounts the same person runs, and it does not test whether the result is skill or luck.

Strengths:
- The de facto standard link for forex claims. Signal sellers, robot vendors and job seekers point to it, as one Hacker News commenter advised in 2016.
- Pulls history from the broker, not from a spreadsheet, which stops the crudest fakes.
- Free, so the cost of showing a record is close to zero.
- A full daily tool for FX traders (calendar, news impact, sentiment, calculators) keeps them coming back between trades.

Weaknesses:
- A record can be made private or deleted, so losing accounts disappear and winners stay ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)).
- Nothing links the many accounts one person may open. Run ten accounts, publish the best, and every label still says "verified".
- Returns can confuse: one reviewer saw a 9% return fall to 4% after a big deposit. The math may be right (time-weighted), but the page did not make it clear.
- Blocks automated access entirely, so third parties cannot easily check or archive a page.
- The iOS app has a run of one-star reviews in 2025 and 2026 for freezing on launch and full-screen ads.

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the public App Store review feed (50 most recent US reviews, checked 24 October 2026) and Hacker News. We did not read the site's own forum because it refused us.
- Liked most: the news feed with impact ranking; the position size and pip calculators; a lot for free; account stats at a glance.
- Complained about most: the iOS app sticks on the splash screen or an ad; lag; no dark mode or time zone setting in the app; the app does less than the website; support hard to reach.

> "Create a public, real account on myfxbook.com and let them find you." (Hacker News comment, 2016, [link](https://news.ycombinator.com/item?id=11889795))

> "added 100k and it went to 4%" (App Store review, US, 2024, [link](https://apps.apple.com/us/app/id985947299))

> "Wish functionality was closer to what available on the website." (App Store review, US, 2024, [link](https://apps.apple.com/us/app/id985947299))

## UX notes

- **Layout**: account pages are long, with a growth chart on top, then tabs of stats, trade history and analysis (from memory, **unverified** today). The app is organised around calendar, news, rates and portfolio.
- **Onboarding**: register, then link an account with the broker server name and investor password, or run a publisher add-on in MetaTrader (**unverified**).
- **Navigation**: the app's menu and filters are called "clunky" by a December 2025 reviewer who still rated it 4 stars.
- **Density**: very high on the web, many statistics on one screen.
- **Charting**: growth and balance curves on account pages; basic price charts in the app.
- **Order entry**: none. Myfxbook does not take trades.
- **Shortcuts**: none known.
- **Mobile**: one app for calendar, news, portfolio and calculators. Reviewers report freezes on iOS while Android works.
- **Speed perception**: poor on iOS by recent reviews; the web was not tested (blocked).
- **Trust signals**: the green "verified" labels are the product. They are well known, but they certify where the data came from, not what it means.

## What Parity should copy, avoid or beat

- **Copy:** one public link per record that anyone can open with no login. Verify's badge should be just as easy to paste in a forum ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
- **Copy:** separate labels for "where the data came from" and "who controls the account". Verify can show data source as its own line beside the verdict ([DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)).
- **Copy:** daily-use tools (calendar, calculators) that bring traders back. Trade's alerts and screener can play that role ([DEC-0033](../decisions/0033-trade-trackers-watchlists-alerts-and-a-screener.md)).
- **Avoid:** a "verified" label that a reader will take to mean "good". Say plainly what was checked and what was not.
- **Avoid:** returns that jump when money is added without a visible note explaining why.
- **Beat:** a luck-adjusted verdict on the same record. Myfxbook proves the trades happened; Verify can say how likely that result is from chance.
- **Beat:** a badge that shows its own history (when issued, whether withdrawn), so a quietly deleted record is visible as deleted.

## Sources

- [Myfxbook home page](https://www.myfxbook.com/), refused (HTTP 403) on 24 October 2026
- [Myfxbook: Forex Calendar, Market and News, App Store](https://apps.apple.com/us/app/forex-calendar-market-news/id985947299), checked 24 October 2026
- [App Store customer review feed, Myfxbook app](https://itunes.apple.com/us/rss/customerreviews/id=985947299/sortby=mostrecent/json), checked 24 October 2026
- [Myfxbook app on Google Play](https://play.google.com/store/apps/details?id=com.myfxbook.forex&hl=en), checked 24 October 2026
- [Marketlog Portfolio Tracker, App Store](https://apps.apple.com/us/app/marketlog-portfolio-tracker/id6480523672), checked 24 October 2026
- [Hacker News comment on using Myfxbook as proof](https://news.ycombinator.com/item?id=11889795), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
