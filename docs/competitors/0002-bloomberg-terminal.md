---
id: CMP-0002
title: Bloomberg Terminal, the data, news and chat desk of professional finance
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, data, ui]
related: [CMP-0001, RES-0021, DEC-0024, DEC-0042]
---

# Bloomberg Terminal, the data, news and chat desk of professional finance

## In plain words

The Bloomberg Terminal is a very expensive computer program that people at banks and funds keep open all day. It shows prices, news and company facts for almost everything that trades, and it has a chat that nearly everyone in finance uses. You drive it by typing short codes, not by clicking through menus. Parity should learn that experts love a dense screen they can run from the keyboard, as long as every code is quick to learn and quick to type.

## Summary

| | |
| --- | --- |
| What it is | A paid desktop service for market data, news, analytics, trading tools and chat, sold per user by Bloomberg L.P. |
| Who uses it | Traders, analysts, portfolio managers, bankers and journalists. About 325,000 subscribers in 2022 ([Wikipedia](https://en.wikipedia.org/wiki/Bloomberg_Terminal), citing Bloomberg); the 2026 number is **unverified** |
| Pricing | Not published by Bloomberg. Reported at $2,500 a month ($30,000 a year) for a single subscription and $2,215 a month for multiple subscriptions from 1 January 2023 ([NeuGroup](https://connect.neugroup.com/public/blogs/bloomberg-terminal-inflation-9-price-hike-on-jan-1-2023)). The 2026 price is **unverified** (checked 24 October 2026) |
| Markets | Stocks, bonds, FX, commodities, futures, options, funds, economics, news |
| Platforms | Windows desktop, Bloomberg Anywhere remote access, iOS and Android app (Anywhere subscribers only), Excel add-in, BLPAPI for C, C++, Java, Python and more |
| Signature features | Command line of short function codes with a special keyboard; Launchpad views of linked components; Instant Bloomberg (IB) chat; news; ASKB conversational AI; BLPAPI and Excel |

Bloomberg's own site refused our requests (HTTP 403), as it did for [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md). Facts below rest on Wikipedia, a university library guide, the official App Store listing and press.

## Strengths and weaknesses

Strengths:
- Breadth: one place for prices, news, fundamentals and economics across asset classes ([Wikipedia](https://en.wikipedia.org/wiki/Bloomberg_Terminal)).
- The chat (IB) is the network effect. Hacker News commenters who worked on rival chat products say they could not break its hold ([HN, 2017](https://news.ycombinator.com/item?id=13736009)).
- Keyboard-first command syntax: type a security, a yellow market key, a function and GO ([Wikipedia](https://en.wikipedia.org/wiki/Bloomberg_Terminal)).
- Launchpad lets users save named views and pages, and group components so one symbol change updates the rest ([Lippincott Library guide](https://lippincottlibrary.wordpress.com/2013/03/11/bloomberg-launchpad-part-one/)).
- AI is now built in: the mobile app advertises ASKB, a conversational AI over Bloomberg research and data ([App Store listing](https://apps.apple.com/us/app/bloomberg-professional/id407761767)).

Weaknesses:
- Price: around $30,000 a year per seat, out of reach for retail traders.
- Steep learning curve. Users need training and memorised codes; Bloomberg runs its own training ([HN, 2026](https://news.ycombinator.com/item?id=49909583)).
- The mobile app is weak next to the desktop: 3.7 stars from 460 ratings on the US App Store (checked 24 October 2026), with repeated complaints about forced updates, worksheet columns and the research viewer.
- Login needs a separate B-Unit app or fingerprint device ([App Store listing](https://apps.apple.com/us/app/bloomberg-professional/id407761767)).
- Some developers say the data still needs checking against other sources ([HN, 2017](https://news.ycombinator.com/item?id=13736009)).

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the US App Store listing (public review feed) and Hacker News threads:
- Liked most: the chat and alerts on the phone; news speed and coverage; the density of the desktop screens, which experts compare to cockpit displays.
- Complained about most: forced app updates that drop older phones; mobile worksheets and portfolio screens that show too few columns; slow support tickets; the price.

> "a product that costs more than a manhattan studio" (App Store review, 2023, [link](https://apps.apple.com/us/app/bloomberg-professional/id407761767))

> "This is the difference between accessible and efficient." (Hacker News comment, 2026, [link](https://news.ycombinator.com/item?id=49915810))

> "most people get 'connected' via Bloomberg Chat." (Hacker News comment, 2017, [link](https://news.ycombinator.com/item?id=13736156))

## UX notes

- **Layout**
  - Several panels on one or more monitors, each running a function (panel count **unverified**). Launchpad adds a canvas of components saved as views and pages ([Lippincott](https://lippincottlibrary.wordpress.com/2013/03/11/bloomberg-launchpad-part-one/)).
  - Dark background, amber and coloured text, very little whitespace.
- **Onboarding**
  - Formal training rather than a guided tour. Help is one keypress away: HN users say pressing Help twice reaches a live helpdesk (**unverified** on an official page).
  - Universities give students access in libraries, so many users learn it before their first job.
- **Navigation**
  - The command line is the navigation. Codes are short and stable for decades, so muscle memory carries over.
  - Securities are named with a ticker plus a market sector key (Equity, Govt, Curncy and so on).
- **Density**
  - Very high. Commenters praise it for showing what is needed and nothing more ([HN, 2026](https://news.ycombinator.com/item?id=49909583)).
- **Charting**
  - Charts are functions like any other, and Launchpad can hold chart components. Not the reason people buy it.
- **Order entry**
  - Trading lives in separate functions and execution systems, not on every screen.
- **Shortcuts**
  - A custom keyboard with colour-coded keys: yellow market keys, green GO, red Cancel ([Wikipedia](https://en.wikipedia.org/wiki/Bloomberg_Terminal)).
- **Mobile**
  - A companion, not a replacement: news, IB chat, alerts, worksheets and market data. Only for Bloomberg Anywhere subscribers ([App Store listing](https://apps.apple.com/us/app/bloomberg-professional/id407761767)).
- **Speed perception**
  - Users describe it as fast from press release to screen. HN commenters say the desktop is now built on a private fork of Chromium (**unverified**).
- **Trust signals**
  - The brand itself: a Bloomberg screenshot is used as "proof" in finance chat, per HN users. Compliance capture of chat is a selling point.

## What Parity should copy, avoid or beat

- **Copy:**
  - Terminal: a command bar with short, stable codes and one-key help. Our `MON` and `WMAP` codes in [DEC-0024](../decisions/0024-parity-terminal-a-market-terminal-of-its-own-at-the-sim-address.md) are the right shape; keep them short and never rename them.
  - Terminal and Trade: named saved views with groups, so one symbol change moves every linked panel (the pattern in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md)).
  - Academy: short structured training before first use, like the university route. A Terminal "first ten codes" course fits [DEC-0042](../decisions/0042-parity-academy-a-full-screen-course-player-of-its-own.md).
- **Avoid:**
  - A phone app that is a thin, frustrating shadow of the desktop. Either make the phone view good at a few things or say clearly what it does not do.
  - Hardware or second-device login that locks people out.
- **Beat:**
  - Price and access: a dense terminal anyone can open in a browser.
  - Labelled honesty: every Parity panel shows the date of its data and marks simulations as history, which Bloomberg does not need to do but retail users do.

## Sources

- [Bloomberg Terminal, Wikipedia](https://en.wikipedia.org/wiki/Bloomberg_Terminal), checked 24 October 2026
- [Bloomberg Terminal inflation: 9% price hike on Jan. 1, 2023, NeuGroup](https://connect.neugroup.com/public/blogs/bloomberg-terminal-inflation-9-price-hike-on-jan-1-2023), checked 24 October 2026
- [Bloomberg Professional, US App Store listing](https://apps.apple.com/us/app/bloomberg-professional/id407761767), checked 24 October 2026
- [Bloomberg Launchpad part one, Lippincott Library](https://lippincottlibrary.wordpress.com/2013/03/11/bloomberg-launchpad-part-one/), checked 24 October 2026
- [Ask HN: What is so great about Bloomberg Terminal?](https://news.ycombinator.com/item?id=13736009), checked 24 October 2026
- [A brief history of the Bloomberg terminal, Hacker News thread](https://news.ycombinator.com/item?id=49909583), checked 24 October 2026
- [Bloomberg Terminal product page](https://www.bloomberg.com/professional/products/bloomberg-terminal/), refused (HTTP 403), 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
