---
id: CMP-0003
title: LSEG Workspace, the Reuters-backed data terminal that replaced Eikon
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, data, ui]
related: [CMP-0001, RES-0021, DEC-0024, DEC-0043]
---

# LSEG Workspace, the Reuters-backed data terminal that replaced Eikon

## In plain words

LSEG Workspace is the main rival to the Bloomberg Terminal. It is a paid program for banks, funds and universities that shows prices, Reuters news and company data, and it now has an AI search that answers questions with sources. It used to be called Refinitiv Eikon, which was switched off in June 2025. Parity should learn from its AI answers that always cite where each number came from.

## Summary

| | |
| --- | --- |
| What it is | A desktop and web terminal for data, news, analytics and messaging, run by London Stock Exchange Group (LSEG) |
| Who uses it | Wealth advisers, bankers, traders, analysts and universities. LSEG does not state a user count on the pages we read (**unverified**) |
| Pricing | Not published; sales-led. A 30-day free trial for new customers ([LSEG](https://www.lseg.com/en/data-analytics/products/workspace/free-trial)). Old Eikon prices of $300 to $1,800 a month (2013) are the last public figures we found ([Wikipedia](https://en.wikipedia.org/wiki/Eikon)); current prices **unverified** (checked 24 October 2026) |
| Markets | Equities, fixed income, FX, commodities, funds, private companies, economics, deals |
| Platforms | Windows 10 desktop, macOS 10.13 or later, web (Chrome, Edge, Safari), iPhone app, Microsoft Teams app, Excel add-in, Python via the LSEG Data Library and CodeBook |
| Signature features | Reuters news plus 10,000 other sources; AI Search with citations; Company Intelligence and Deep Research agents; Teams integration; CodeBook (Python notebooks in the app); StarMine and Datastream |

## Strengths and weaknesses

Strengths:
- Reuters news inside the product, plus "10,000+ authoritative sources" ([LSEG Workspace](https://www.lseg.com/en/data-analytics/products/workspace)).
- AI Search returns cited answers that it says are "transparent, traceable and grounded in underlying data" ([AI capabilities](https://www.lseg.com/en/data-analytics/products/workspace/workspace-ai-capabilities)).
- Works where people already are: a native app inside Microsoft Teams, and Excel add-ins ([LSEG Workspace](https://www.lseg.com/en/data-analytics/products/workspace)).
- Strong developer route: the open `lseg-data` Python library and hundreds of public sample repos ([LSEG Data Library](https://developers.lseg.com/en/api-catalog/lseg-data-platform/lseg-data-library-for-python), [GitHub](https://github.com/LSEG-API-Samples)).
- A student edition with CodeBook, Datastream and LSEG Academy courses ([Workspace for Students](https://www.lseg.com/en/data-analytics/products/workspace/workspace-for-students)).

Weaknesses:
- Heavy machine needs: Intel i7, 16 GB RAM and a 1920 by 1080 screen as the minimum ([technical specifications](https://www.lseg.com/en/data-analytics/products/workspace/workspace-technical-specifications)).
- No published prices and no self-serve plan below enterprise.
- The phone app is thin and rarely reviewed: 68 ratings on the US App Store (4.5 stars, checked 24 October 2026). Tablets get the web version only.
- AI Search has fair-use monthly limits ([AI capabilities](https://www.lseg.com/en/data-analytics/products/workspace/workspace-ai-capabilities)).
- A forced migration: Eikon was withdrawn on 30 June 2025 ([LSEG Eikon page](https://www.lseg.com/en/data-analytics/products/eikon-trading-software)).

## What users say

<!-- collector:start -->
<!-- collector:end -->

From the US App Store listing (public review feed). We found almost no Hacker News discussion of Workspace or Eikon UX.
- Liked most: speed and research depth (older reviews, 2020); Reuters news.
- Complained about most: errors and repeated log-outs in the phone app; the phone app not replacing Eikon's mobile messaging; value for money against Bloomberg's mobile app.

> "no mobile messaging to replace Eikon" (App Store review, 2024, [link](https://apps.apple.com/us/app/lseg-workspace/id1481442629))

> "Fast, dependable source for financial news and market data" (App Store review, 2020, [link](https://apps.apple.com/us/app/lseg-workspace/id1481442629))

## UX notes

- **Layout**
  - Desktop and browser apps with app-style tiles and pages; we could not open a live screen to measure (**unverified** detail).
  - Collaboration is pushed out to Teams and LSEG Messenger rather than kept inside one window.
- **Onboarding**
  - Trial users get training videos by email after sign-up ([free trial](https://www.lseg.com/en/data-analytics/products/workspace/free-trial)). Students get LSEG Academy certifications.
- **Navigation**
  - Search-first. AI Search takes plain questions and returns answers with links into the underlying data.
- **Density**
  - High, desktop-first; the 1920 by 1080 minimum (1920 by 1280 for web) shows how much it puts on screen.
- **Charting**
  - Charts sit alongside analytics apps; not its main pitch.
- **Order entry**
  - Not a retail order ticket. Trading runs through separate LSEG venues and tools (FX venues are outside this profile).
- **Shortcuts**
  - Nothing we could confirm from public pages (**unverified**).
- **Mobile**
  - iPhone app for watchlists, portfolio monitoring with intraday P&L, Reuters news, research and alerts ([App Store listing](https://apps.apple.com/us/app/lseg-workspace/id1481442629)).
- **Speed perception**
  - Older reviewers call it fast; recent ones report "System Error, Tap to Retry" loops on the phone.
- **Trust signals**
  - Reuters brand; every AI answer carries citations to source data; a public changelog of updates on the Workspace pages ([updates](https://www.lseg.com/en/data-analytics/products/workspace/updates)).

## What Parity should copy, avoid or beat

- **Copy:**
  - Terminal: AI or search answers that always cite the series and date behind each number. This fits the dated panels in [DEC-0024](../decisions/0024-parity-terminal-a-market-terminal-of-its-own-at-the-sim-address.md).
  - Workbench: a notebook route for power users (CodeBook) next to the point-and-click tools in [DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md), at least as an export.
  - Academy: courses tied to the product, as LSEG Academy is for students.
- **Avoid:**
  - Hard hardware floors. Parity should work on a laptop screen.
  - A hidden price. Show it.
- **Beat:**
  - Self-serve: open in a browser, no sales call, no 30-day eligibility check.
  - A phone view that does a few things well instead of a stripped desktop.

## Sources

- [LSEG Workspace product page](https://www.lseg.com/en/data-analytics/products/workspace), checked 24 October 2026
- [Workspace AI capabilities](https://www.lseg.com/en/data-analytics/products/workspace/workspace-ai-capabilities), checked 24 October 2026
- [Workspace free trial](https://www.lseg.com/en/data-analytics/products/workspace/free-trial), checked 24 October 2026
- [Workspace technical specifications](https://www.lseg.com/en/data-analytics/products/workspace/workspace-technical-specifications), checked 24 October 2026
- [Workspace for Students](https://www.lseg.com/en/data-analytics/products/workspace/workspace-for-students), checked 24 October 2026
- [Workspace updates](https://www.lseg.com/en/data-analytics/products/workspace/updates), checked 24 October 2026
- [Eikon trading software (withdrawal notice)](https://www.lseg.com/en/data-analytics/products/eikon-trading-software), checked 24 October 2026
- [LSEG Data Library for Python](https://developers.lseg.com/en/api-catalog/lseg-data-platform/lseg-data-library-for-python), checked 24 October 2026
- [LSEG API Samples on GitHub](https://github.com/LSEG-API-Samples), checked 24 October 2026
- [LSEG Workspace, US App Store listing](https://apps.apple.com/us/app/lseg-workspace/id1481442629), checked 24 October 2026
- [Eikon, Wikipedia](https://en.wikipedia.org/wiki/Eikon), checked 24 October 2026
- [Refinitiv, Wikipedia](https://en.wikipedia.org/wiki/Refinitiv), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
