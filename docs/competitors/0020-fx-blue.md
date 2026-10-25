---
id: CMP-0020
title: FX Blue, free forex account analysis and MetaTrader add-ons
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, fx, method, strategy]
related: [CMP-0001, RES-0020, DEC-0032, DEC-0036, DEC-0034]
---

# FX Blue, free forex account analysis and MetaTrader add-ons

## In plain words

FX Blue is a free website and set of add-ons for MetaTrader. Traders let it read their account, and it builds a public page of results, with charts and risk numbers. Many forex brokers and FTMO hand its tools to their clients. Parity should learn from how honestly its help pages explain the limits of its own numbers, and beat it by closing the gaps those pages admit, such as choosing your own start date.

## Summary

| | |
| --- | --- |
| What it is | Free account analysis ("FX Blue Live"), MetaTrader add-ons (publisher, trade copier, simulator, indicators), market data tools, an economic calendar and the MyTrader platform ([home](https://www.fxblue.com/)) |
| Who uses it | Retail FX and CFD traders, often through their broker. The home page shows logos of about 35 brokers plus FTMO (Pepperstone, IC Markets, OANDA, CMC Markets, Tickmill and others). No user count published |
| Pricing | Free to register, publish and download tools (checked 24 October 2026, [FAQ](https://www.fxblue.com/faq)). Some services need a verified phone number. No paid plan found |
| Markets | FX and CFDs, from MT4, MT5, cTrader, OANDA fxTrade, XOpenHub, Vertex FX and FXCM Trading Station 2 ([FAQ](https://www.fxblue.com/faq)) |
| Platforms | Web; MetaTrader 4 and 5 add-ins (Windows); MyTrader app on iOS; embeddable widgets plus JavaScript and RSS feeds of a user's history |
| Signature features | Public results page with stats, risk, portfolio and widgets tabs; account sync through a read-only password; combine accounts in one URL; Personal Trade Copier; Trading Simulator; prop firm and challenge comparisons |

## Strengths and weaknesses

How it verifies: results come only from a broker connection, either a publisher add-on running in the trading platform or "account sync", where FX Blue reads the broker server with a read-only investor password ([FAQ](https://www.fxblue.com/faq)). It refuses spreadsheet uploads from the public, to avoid "results on the site which might be entirely fictitious". There is no "verified" label and no review step. The FAQ itself lists the holes: publisher add-ons let a trader set a start date so "All trading activity before this date is then ignored"; switching to a new broker account overwrites the old results; anyone can "register any number of times from the same email address"; brokers often truncate old history. Nothing tests luck.

Strengths:
- Unusually candid help pages: it explains why historic equity is "approximate" and why it will not show a Sharpe ratio it cannot compute well.
- Risk numbers beyond return: a risk/reward ratio close to an annual Sharpe, Cox and Miller risk of ruin, spread of daily returns, "deepest valley" and loss from outset.
- Will not let a publisher hide both balance and equity, because a 50% return on $100 and on $100,000 are different claims.
- Free, broker-distributed and embeddable, so it reaches traders where they already are.
- Combine accounts on the fly by listing usernames in one URL; portfolios get a permanent ID.

Weaknesses:
- Start date filtering and account replacement let a trader show only the good stretch or the good account.
- Unlimited registrations per email make it easy to run many accounts and publish the winner.
- Results are public by default, but a PIN, a white list or a hidden trade list can hide them later.
- No badge, no third-party certificate and no statement of what was checked.
- Phone verification gates only some services, so the identity link is weak.

## What users say

<!-- collector:start -->
<!-- collector:end -->

Little public feedback exists. The MyTrader iOS app has no ratings yet ([App Store](https://apps.apple.com/us/app/mytrader/id1489304242), updated 22 October 2026). We found no Hacker News threads. FX Blue runs a Discord, which we did not read. Themes below come from what the FAQ answers, so they are **unverified** as user opinion.
- Liked most: free tools; MetaTrader add-ons that brokers bundle; the trade copier; charts and widgets for a personal site.
- Complained about most: missing older history when brokers truncate it; results not updating when the add-on stops; brokers missing from account sync.

No quotes: we found no independent user reviews we were allowed to read.

## UX notes

- **Layout**: a results page per username with tabs: Overview, Analysis, Stats, Risk, Widgets, Portfolio ([example](https://www.fxblue.com/users/example)). Top nav groups Tools, Trade, Analysis, Calendar, News, Props, Brokers.
- **Onboarding**: register, then either install a publisher add-on or set up account sync with an investor password. You can register without publishing, but some tools need a published history.
- **Navigation**: a large mega-menu with every tool; a site index page for the rest.
- **Density**: high. Stats and risk tabs are tables of numbers with filters by date, symbol and lot size.
- **Charting**: balance and equity curves, spread of returns histograms, plus separate market charts (mini, tick, premium).
- **Order entry**: through MyTrader and the MetaTrader add-ons, not on the results site.
- **Shortcuts**: none found.
- **Mobile**: MyTrader on iOS; the results site is responsive (**unverified** on a phone).
- **Speed perception**: publisher add-ons can push every 60 seconds; account sync is slower and live accounts refresh more often than demo.
- **Trust signals**: read-only access only ("We do not want to have trading access"), a refusal to host typed-in results, and plain explanations of every statistic.

## What Parity should copy, avoid or beat

- **Copy:** the honest "why this number is approximate" notes beside each statistic. Verify's cards can carry the same short caveats ([DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)).
- **Copy:** refuse to hide both balance and equity on a shared badge. Return without size is not a claim we should certify.
- **Copy:** embeddable widgets and a feed, so a badge can live on a trader's own site ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
- **Copy:** a free simulator next to the analysis. Trade's demo accounts fill that role ([DEC-0034](../decisions/0034-demo-accounts-paper-trading-on-delayed-data.md)).
- **Avoid:** user-chosen start dates without showing that earlier history exists and was cut.
- **Avoid:** overwriting a record when the account changes. Keep the old one visible.
- **Beat:** flag gaps and cut-offs on the badge, then adjust the verdict for the number of accounts or tries the user declares.
- **Beat:** a luck-adjusted verdict. FX Blue says how risky a record looked; Verify can say how likely it was to be chance.

## Sources

- [FX Blue home page](https://www.fxblue.com/), checked 24 October 2026
- [FX Blue frequently asked questions](https://www.fxblue.com/faq), checked 24 October 2026
- [FX Blue example results page](https://www.fxblue.com/users/example), checked 24 October 2026
- [FX Blue robots.txt](https://www.fxblue.com/robots.txt), checked 24 October 2026
- [MyTrader by FXBlue LLP, App Store](https://apps.apple.com/us/app/mytrader/id1489304242), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
