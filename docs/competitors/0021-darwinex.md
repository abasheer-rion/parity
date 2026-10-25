---
id: CMP-0021
title: Darwinex, a regulated broker that turns traders into risk-scaled indexes
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, fx, method, strategy]
related: [CMP-0001, RES-0020, DEC-0032, DEC-0036, DEC-0043]
---

# Darwinex, a regulated broker that turns traders into risk-scaled indexes

## In plain words

Darwinex is a UK-regulated broker. When you trade there, it turns your trading into a fund-like product called a DARWIN that investors can put money into, and you get 15% of the profit you make them. Before showing you to investors, it resizes every trade so all traders carry the same risk, then scores you on twelve traits, including a test against 10,000 random traders. Parity should learn from that random-trader test, and beat Darwinex by working on any record from any broker and letting people share the result.

## Summary

| | |
| --- | --- |
| What it is | An FCA-regulated broker (Tradeslide Trading Tech, FRN 586466; also CNMV in Spain and FSA Seychelles) plus a marketplace of DARWIN indexes built from traders' strategies, and Darwinex Zero, a paid virtual-account route to the same capital ([help centre](https://help.darwinex.com/), [Darwinex Zero](https://www.darwinexzero.com/)) |
| Who uses it | Algorithmic and discretionary FX and CFD traders who want outside capital, and investors who allocate to DARWINs. Darwinex Zero says "10K+ traders" and showed $464.58M "capital invested in traders" on a live counter ([pricing](https://www.darwinexzero.com/pricing), checked 24 October 2026). Over $5 million paid to providers in performance fees ([help](https://help.darwinex.com/performance-fees-darwin-provider)) |
| Pricing | Investors pay a 20% performance fee on profits (15% to the trader, 5% to Darwinex), quarterly, with a high-water mark. Darwinex Zero: $50 a month, $40 a month yearly, $35 a month for 3 years; futures $56 a month including $6 data; restarts from $50 (checked 24 October 2026). Live broker commissions **unverified**: darwinex.com redirected in a loop for us |
| Markets | FX, index, commodity and stock CFDs, futures, US stocks and ETFs, crypto CFDs (up to 1,500 assets on Zero) |
| Platforms | MetaTrader 4 and 5, TradingView, web terminal; a Darwinex for Investors iOS app last updated 2020; public GitHub connectors |
| Signature features | Risk Engine (3.25% to 6.5% monthly VaR); D-Score; 12 Investable Attributes; DarwinIA monthly capital allocation; INDX invested portfolio; de-listed DARWINs stay on the record |

## Strengths and weaknesses

How it verifies: Darwinex holds the account, so every trade is real data from its own books. The Risk Engine rescales each DARWIN to a target between 3.25% and 6.5% monthly value at risk (95%), set from the last 45 days of exposure and up to six months of history ([Risk Engine](https://help.darwinex.com/risk-manager)). Twelve Investable Attributes score the strategy 0 to 10 each. The Performance attribute ranks the DARWIN's risk-adjusted return against "10,000 random strategies with exactly the same level of risk" ([Pf](https://help.darwinex.com/performance-attribute)). Experience needs 12 "D-Periods" to reach 10, so short records score low ([Ex](https://help.darwinex.com/experience-attribute)). The D-Score, a single number on the quality of the return curve over five years, drives filters and fee discounts ([D-Score](https://help.darwinex.com/d-score)). Where it falls short: the random test is per strategy, not per person. Nothing adjusts for the many DARWINs or Zero accounts one trader may run, or for the thousands of DARWINs competing for the same allocation. It works only on Darwinex accounts.

Strengths:
- The closest thing to a luck test in retail: a random-strategy benchmark at equal risk, plus an experience score that punishes thin records.
- Risk standardisation makes very different traders comparable and caps damage from one oversized trade.
- Deleted DARWINs "continue to appear as part of the trader's track record" ([delete](https://help.darwinex.com/how-to-delete-a-darwin)).
- Traders are paid on results: 15% of investor profit, above a high-water mark, not per copier or per seat.
- Help pages explain each attribute with worked examples and charts.

Weaknesses:
- Inside the walls only: a record from another broker cannot be scored.
- No trial count across accounts. A trader can run many strategies and the best one rises to the top of the rankings.
- The D-Score method is proprietary; since 2020 it uses only the DARWIN's quote, and the formula is not published.
- Providers may not promote their DARWIN in public unless licensed, under UK financial promotion rules ([public speech rules](https://help.darwinex.com/speaking-about-your-darwin-in-public)). There is no shareable badge.
- Darwinex Zero charges $35 to $56 a month and allows paid restarts. What a restart does to the visible record is **unverified**.
- The DARWIN return differs from the trader's own return because of the Risk Engine, which confuses newcomers ([help](https://help.darwinex.com/darwin-vs-its-underlying-trading-strategy)).

## What users say

<!-- collector:start -->
Our feedback collector ([CMP-0001](0001-ux-patterns-users-praise-most.md#how-we-count)), pass of 2026-10-25: **42 public items** that name Darwinex (GitHub issues 40, Hacker News 2).

| | Count |
| --- | --- |
| Praise | 3 |
| Complaints | 16 |
| Neither | 23 |
| Praise share | 16% |

- Most praised themes: API and automation (2), Market data and quotes (2), Speed and lag (1).
- Most complained-about themes: Crashes and bugs (14), API and automation (7), Market data and quotes (5).
- US App Store, app 1448246447: 5.00 stars from 2 ratings.
<!-- collector:end -->

Public feedback we could read is thin. The investor iOS app has 2 ratings and no update since 2020. Hacker News has a few comments. The Darwinex Zero FAQ sits behind a login wall in practice: clicking through sent us to the login page.
- Liked most: a real path from trading skill to outside capital without a prop firm fee per attempt; risk-normalised comparison; the algorithmic trading community and connectors (dwx-zeromq-connector has 374 GitHub stars).
- Complained about most: leaderboards that look better than lasting results; DARWIN returns that differ from the trader's own; monthly fees on Zero.

> "it shows leaderboards of supposed profit-generating trading systems" (Hacker News comment, 2023, [link](https://news.ycombinator.com/item?id=34768768))

## UX notes

- **Layout**: each DARWIN has a profile with a return chart and a row of attribute icons at the top right; clicking one opens that attribute's chart and score history.
- **Onboarding**: two doors. Open a live broker account, or buy a Darwinex Zero membership and trade a virtual account. Either way the track record builds itself.
- **Navigation**: Zero's site splits into "How it works", "Features", "Why us", "Pricing". The help centre groups by trader, investor and account.
- **Density**: high on profiles: twelve attributes, D-Score, VaR ratio, drawdowns, D-Periods.
- **Charting**: return curves for DARWIN and underlying strategy side by side, attribute score history, Experience chart split into 12 D-Periods.
- **Order entry**: through MetaTrader, TradingView or the web terminal.
- **Shortcuts**: those of MetaTrader and TradingView.
- **Mobile**: an investor app from 2020; trading is done in the platforms' own apps.
- **Speed perception**: D-Score updates at least hourly on DARWINs.
- **Trust signals**: three regulators named on every page, the 55% retail CFD loss disclosure, public provider payout totals, de-listed DARWINs kept on record.

## What Parity should copy, avoid or beat

- **Copy:** a random-strategy benchmark at equal risk, shown as a percentile. Verify can add it beside the deflated Sharpe as a plain "beats X% of random traders" line ([DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)).
- **Copy:** an experience score that cannot rise fast. Verify should rank short records lower no matter how good the curve looks.
- **Copy:** keep withdrawn records visible as withdrawn. Verify's badge withdrawal should leave a public stub ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
- **Copy:** risk-normalised comparison in Workbench's compare view, so two strategies are judged at the same risk ([DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)).
- **Avoid:** an unpublished headline score. Our method should be public.
- **Beat:** count the tries. Ask for, or detect, the number of strategies and accounts behind a record, and deflate the result.
- **Beat:** portable and shareable. Score a record from any broker and let the trader post it, within the rules on hypothetical results.

## Sources

- [Darwinex help centre](https://help.darwinex.com/), checked 24 October 2026
- [Darwinex Risk Engine](https://help.darwinex.com/risk-manager), checked 24 October 2026
- [DARWIN versus its underlying strategy](https://help.darwinex.com/darwin-vs-its-underlying-trading-strategy), checked 24 October 2026
- [D-Score](https://help.darwinex.com/d-score), checked 24 October 2026
- [What are Investable Attributes](https://help.darwinex.com/what-are-investable-attributes), checked 24 October 2026
- [Performance (Pf) attribute](https://help.darwinex.com/performance-attribute), checked 24 October 2026
- [Experience (Ex) attribute](https://help.darwinex.com/experience-attribute), checked 24 October 2026
- [How to delete a DARWIN](https://help.darwinex.com/how-to-delete-a-darwin), checked 24 October 2026
- [Performance fees for DARWIN providers](https://help.darwinex.com/performance-fees-darwin-provider), checked 24 October 2026
- [Speaking about your DARWIN in public](https://help.darwinex.com/speaking-about-your-darwin-in-public), checked 24 October 2026
- [Darwinex Zero pricing](https://www.darwinexzero.com/pricing), checked 24 October 2026
- [Darwinex Zero, your investable track record](https://www.darwinexzero.com/your-darwin-index), checked 24 October 2026
- [Darwinex Zero, why us](https://www.darwinexzero.com/why-us), checked 24 October 2026
- [Darwinex for Investors, App Store](https://apps.apple.com/us/app/darwinex-for-investors/id1448246447), checked 24 October 2026
- [darwinex on GitHub](https://github.com/darwinex), checked 24 October 2026
- [Hacker News comment on Darwinex leaderboards](https://news.ycombinator.com/item?id=34768768), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
