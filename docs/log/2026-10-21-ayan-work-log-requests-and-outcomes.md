---
id: LOG-0004
title: Ayan work log, requests and outcomes
type: log
status: final
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [intent, process]
related: [DEC-0007, DEC-0008, DEC-0009, INT-0001, LOG-0001]
---

# Ayan work log, requests and outcomes

## In plain words

A record of everything Ayan asked for on the first two days of the project, in order, with what was done each time and where to find it. The requests are written close to how they were asked, with spelling tidied. This is the owner's own log; the session logs ([LOG-0001](2026-10-20-project-start.md) and later) record the technical detail.

## What happened

| # | What Ayan asked for | What was done | Where |
| --- | --- | --- | --- |
| 1 | Start a new project with Amanda and Abanish (not Rayan), not Argus. A quant currency trading research proof of concept with a UI and backend, historical data scrapers, comparison with open-source algorithms, simulations, leading KPIs, swappable strategies, a goal of beating the S&P 500, maybe news and gas price reactions and commodities. Research papers, economic theory. Private GitHub repo, CI/CD, Supabase and Vercel or Cloudflare Pages on free tiers. Record the intent and history, tag and deep link everything, non-AI humble language. | Repo, engine, dashboard, CI/CD, docs system, intent, first backtests | [INT-0001](../intent/0001-initial-intent.md), [LOG-0001](2026-10-20-project-start.md) |
| 2 | Look at platforms that post algorithms and results, courses, forums such as Wall Street Oasis and Yahoo Finance, papers on building algorithms, repos of people doing the same thing even in crypto, compare methods and run simulations. Long term proof of concept, maybe a paper. | Three research surveys | [RES-0001](../research/0001-reading-list.md), [RES-0002](../research/0002-open-source-and-public-results.md), [RES-0003](../research/0003-forums-and-practitioners.md) |
| 3 | Very strict organisation of files, linking, wording, consistency, formatting, simplicity and metadata, with checks, automatic categorising and better indexing. | Docs checker, schema, generated index, tags and backlinks | [DEC-0004](../decisions/0004-docs-are-checked-by-a-script.md) |
| 4 | Make the tests brutal and paper-like, explain like I am a child, glossary for every economic term, tabs for analogies. | The 11-test gauntlet, paper-style experiment, 75-term glossary with simple, analogy and precise tabs, "In plain words" required everywhere | [REF-0006](../reference/0006-the-gauntlet.md), [EXP-0002](../experiments/0002-baseline-gauntlet.md), [REF-0004](../reference/0004-glossary.md) |
| 5 | Look up "zenpilot" and similar apps, and open APIs. Confirm Amanda's most active account. | Zenbot identified; free data API survey; Amanda invited | [RES-0005](../research/0005-zen-apps-and-free-apis.md) |
| 6 | Connect Supabase (secret key and publishable key saved from the clipboard), use teammates' GitHub emails for access. | Database connected with an insert-only writer and read-only team access | [REF-0001](../reference/0001-architecture.md#database) |
| 7 | Somewhere to see, plot and change data and variables; catalog and tag every type of algorithm with origin, age, gains and real KPIs; methods for new algorithms; a place to test; flawless protocols against bias and forged data; work, run, trial and data logs; professional reports per algorithm and data source; a ruthless routine. | Catalog and data source reports, Lab, Explore, Ledger, pre-registration, official runs, research routine | [DEC-0007](../decisions/0007-official-results-come-only-from-the-ledger.md), [GDE-0004](../guides/0004-the-research-routine.md), [REF-0007](../reference/0007-ways-to-build-new-algorithms.md) |
| 8 | Find cleaner data sources, automatic ingest and comparison, history back to the late 1990s; compare all algorithms with each other; what traders, forums and courses swear by. | Yahoo-free benchmark from 1999, sixteen strategies compared, retail favourites and course claims researched | [DEC-0008](../decisions/0008-benchmark-data-without-yahoo.md), [EXP-0004](../experiments/0004-all-strategies-1999.md), [RES-0006](../research/0006-courses-and-trader-beliefs.md), [RES-0007](../research/0007-comparing-every-algorithm.md) |
| 9 | Is this the normal research-driven approach, with protocols? | Yes, with four named gaps (no untouched data, low power, single backtest, no independent replication) | This log, [RES-0008](../research/0008-independent-audit.md) |
| 10 | Spend more time on our weak points, and make sure results are not lost and are meaningful and tagged. | Independent audit; four copies of every result, weekly archive, results register | [RES-0008](../research/0008-independent-audit.md), [REF-0008](../reference/0008-where-results-live.md), [results register](../RESULTS.md) |
| 11 | "You barely checked and cross referenced." | Fair. Started a full check of every source link and reported number | Verification report, in progress |
| 12 | Note what we go off of: full sources and citations for everything. | Bibliography system started (full citations, cited-in links, checked status) | In progress |
| 13 | Document everything from today, decisions, research and prompts, in my own work log. | This log, DEC-0009 and the audit write-up | This page |

## Decisions

The decisions made across these requests, in order: [DEC-0001](../decisions/0001-keep-a-decision-record.md) to [DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md). The most important for reading results: official results only come from pre-registered runs ([DEC-0007](../decisions/0007-official-results-come-only-from-the-ledger.md)), and since [DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md) everything is scored on returns above the T-bill with borrowing paid for.

## Open questions

- Run the official rerun of all strategies under the fixed scoring (needs a new registration).
- Fix the remaining audit findings, starting with test power and how trials are counted.
- Finish the source verification and bibliography, and correct anything they find.
- Start a forward test of the strongest candidates.
- A copy of the archive outside GitHub (needs a new storage key, waiting for approval).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [LOG-0005: Ayan work log, site rebuild, research expansion and sign-in](2026-10-21-ayan-work-log-site-rebuild-research-expansion-and-sign-in.md)
<!-- backlinks:end -->
