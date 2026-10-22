---
id: DEC-0013
title: Dashboard clarity, plain names, verdicts and search that answers
type: decision
status: accepted
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [ui]
related: [INT-0002, DEC-0011, REF-0009]
---

# Dashboard clarity, plain names, verdicts and search that answers

## In plain words

The owner said the dashboard was messy: it was unclear where to go, what the words meant, what search found, and what the reports and papers were saying ([INT-0002](../intent/0002-two-products-a-research-and-simulation-platform-and-a-public-trading-app.md)). Now there is a Start here page, the sidebar uses plain names, every strategy shows its human name and a one-word verdict, a strategy page opens with one sentence saying what $10,000 became, and search finds pages and strategies and answers simple questions such as "what is carry" or "best strategy".

## Context

Before this change:

- Sidebar items had internal names: Lab, Explore, Signals, Catalog, Ledger. Nothing said what each one was for.
- Tables and strategy pages showed engine ids such as `stocks_trend_10m`. Human names already existed for Sim World but were not used elsewhere.
- The gauntlet showed "7 of 11" with no sense of whether that is good.
- Search covered only docs, glossary words and sources. Typing a page name or a strategy found nothing.
- The docs list grouped by type ("Decisions", "Registers") without saying what a type is.

## Decision

1. **One page directory.** `web/src/lib/pages.ts` describes every page once: its plain name, what it is, and when to go there. The sidebar's hover text, the Start here page and search all read from it, so they cannot disagree.
2. **Plain names in the sidebar.** Lab becomes Try settings. Signals becomes Early signals. Explore becomes Raw prices. Catalog becomes Algorithm library. Ledger becomes Official record. Home becomes Sim World. Docs becomes Research docs. Start here sits at the top of both areas. The addresses (`#/lab` and so on) do not change, so bookmarks still work.
3. **Start here page** (`#/start`) has four parts:
   - What Parity asks.
   - "What do you want to do?", with five jobs, each linking to the right pages.
   - How to read the five numbers on every strategy. The US market's own values come from the selected run, not typed in.
   - What each verdict means, and exploratory against official.
4. **Human names everywhere.** Strategies, Compare, Early signals, Try settings, Overview and the strategy page use the strategy's display name. The engine id is shown on hover.
5. **A one-word verdict** for every strategy (`verdictOf` in `web/src/lib/strategyMeta.ts`):
   - **Passed:** passed every gauntlet test and beats the S&P 500.
   - **Promising:** passed at least 60% of the tests.
   - **Not proven:** passed fewer than 60%.
   - **Not tested:** has not been through the gauntlet.
   - **Benchmark:** the US stock market itself.

   The verdict is a reading aid, not a new result. The gauntlet and the official record still decide what counts ([DEC-0009](0009-excess-returns-financed-leverage-frozen-code.md)).
6. **Strategy page story line.** One sentence under the title, for example: "$10,000 put in from 1999 became $117,409, against $109,526 in the US stock market, after costs. It passed 7 of 11 tests, but does not beat the S&P 500 after costs."
7. **Search that answers.** Search now ranks pages, strategies, catalog ideas, glossary words, docs and sources together. It also recognises a few questions and shows an answer card first:
   - "What is X" gives the glossary entry.
   - "Best strategy" gives the strongest strategy by verdict, then Sharpe.
   - "Does anything beat the market" gives how many tested strategies beat it.
   - "How many strategies" gives the count of strategies and catalog ideas.

   Empty search shows example questions.
8. **Doc types explained.** Each doc type has one line saying what it is. The line appears under each group on the docs page and on hover over the type on a doc.
9. **Local preview without signing in.** `VITE_AUTH_BYPASS=1 npm run dev` skips sign-in on the local dev server only. It is tied to Vite's dev mode, which is off in every build, so it cannot reach the deployed site.

## Alternatives considered

- **A guided tour with pop-ups.** Rejected. Tours are skipped and forgotten. A page you can return to, plus hover text, lasts.
- **An AI model answering search questions.** Left for the AI strategy helper ([INT-0002](../intent/0002-two-products-a-research-and-simulation-platform-and-a-public-trading-app.md)). Fixed answers built from the run's own numbers cannot make things up, and they need no key or cost.
- **Renaming the addresses too.** Rejected, because it would break bookmarks and links in the docs.

## Consequences

- A new page needs one entry in `lib/pages.ts` to show up in search and on Start here.
- The 60% line between Promising and Not proven is a judgement call. If it misleads, change it in one place.
- Some catalog entries describe a strategy loosely. For example, the 10-month stock trend's About text speaks of "many markets". That is a catalog wording issue to fix separately.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
