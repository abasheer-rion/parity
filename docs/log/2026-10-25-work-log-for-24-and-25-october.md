---
id: LOG-0019
title: Work log for 24 and 25 October
type: log
status: final
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [infra, process, ui]
related: [LOG-0013, LOG-0014, LOG-0015, LOG-0016, LOG-0017, LOG-0018]
---

# Work log for 24 and 25 October

## In plain words

This is the whole of 24 and 25 October 2026 in one place, pull requests 66 to 111. Earlier logs already cover some of it, so those parts only get a line and a link here. The rest is new: two more full-screen apps (Academy and Workbench), three more versions of the sign-in screen, five versions of the desktop app, live prices, a way for AI apps to connect, our own analytics, a stricter database, legal and news pages, and faster apps. On 25 October GitHub stopped running our automatic checks because of a billing limit, and within half an hour the code repository became public.

## What happened

All times are UTC. Pull requests are written as #N. Every one listed below was merged unless it says open.

### Already logged elsewhere

| Topic | Pull requests | Logged in |
| --- | --- | --- |
| Verify: the checker and shareable badges | #66, #67 | [LOG-0013](2026-10-24-parity-verify-built-and-shipped.md) |
| Everything runs by itself: the sims service, a search that widens itself, the health line | #68 | [LOG-0014](2026-10-24-ayan-work-log-everything-runs-by-itself.md) |
| Parity Trade as its own app at trade.endyland.com | #72 | [LOG-0015](2026-10-24-parity-trade-becomes-its-own-app.md), [LOG-0016](2026-10-25-ayan-work-log-front-page-trade-links-copy-and-apps.md) |
| Front page for Verify, page tags and deep links, plain copy and its rules | #69, #70, #71 | [LOG-0016](2026-10-25-ayan-work-log-front-page-trade-links-copy-and-apps.md) |
| Installable site and the first desktop app | #73, #74 | [LOG-0016](2026-10-25-ayan-work-log-front-page-trade-links-copy-and-apps.md) |
| Competitor profiles and the daily feedback collector | #83 | [LOG-0017](2026-10-24-ayan-work-log-competitor-profiles-feedback-collector-and-architecture.md) |
| Bug sweep across every app, 13 fixes and a smoke test in CI | #94 | [LOG-0018](2026-10-25-bug-sweep-across-every-parity-app.md) |

The work log itself, LOG-0016, was #75.

### Academy and Workbench become their own apps

| Pull request | What came of it |
| --- | --- |
| #76 | Parity Academy at `/academy/` and academy.endyland.com ([DEC-0042](../decisions/0042-parity-academy-a-full-screen-course-player-of-its-own.md)): a library, course pages and a lesson player with keys. Progress is saved to the account in a new `academy_progress` table that only its owner can read. Old links in the product app redirect to the same lesson |
| #78 | Parity Workbench at `/lab/` and lab.endyland.com ([DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)): Try settings, What if, Compare, Strategy search and the Edge Lab in one tool. Every view keeps its state in the link. It only reads published files and adds no table |

### Sign-in, three more versions

| Version | Pull request | What changed |
| --- | --- | --- |
| 2 | #79 | One sign-in panel fades in over the front page with no orbs; the stand-alone sign-in pages use the same panel ([DEC-0044](../decisions/0044-one-sign-in-panel-that-fades-in-over-the-front-page.md)) |
| 3 | #88 | No box around the form, three text sizes and three colours, legal links small and grey at the bottom, and "Forgot password?" on the first step. Research on Google, Apple, phone and passkey sign-in; none was switched on |
| 4 | #98 | Motion modelled on Linear's sign-in, a four-part password strength bar, a check mark on success and a skippable welcome after sign-up. All motion is off with reduced motion |

### Desktop app, 0.1.0 to 0.2.1

| Version | Pull requests | What changed | Release |
| --- | --- | --- | --- |
| 0.1.0 | #74, #77 | First Electron app with a sidebar. The first release run failed on the Windows file name with spaces; #77 fixed it | Draft, never published |
| 0.1.1 | #80 | Bundles Academy, Workbench and the new sign-in | Published 25 Oct, 01:57 |
| 0.1.2 | #87 | Shows the live site when online and the bundled copy when offline ([DEC-0048](../decisions/0048-the-desktop-app-loads-the-live-site-and-keeps-a-copy-for-offline.md)) | Published 03:55 |
| 0.2.0 | #89, #92 | Opens on a log-in wall, a menu button replaces the sidebar, the window can be dragged, and an update feed ([DEC-0049](../decisions/0049-the-desktop-app-opens-on-the-log-in-page-with-a-menu-button-and-its-own-controls.md)) | The release run could not start (see the Actions incident below). Published 05:57 from the owner's account with Mac files only |
| 0.2.1 | #107 | Warms the two most recent sections in the background, guards against blank windows and keeps a small log file | Published 20:03 by the release workflow, with Mac and Windows files |

### Architecture, payments and latency

| Pull request | What came of it |
| --- | --- |
| #81 | Docs only: how trading and market data platforms are built ([RES-0022](../research/0022-how-trading-and-market-data-platforms-are-built.md)), a latency budget and target architecture ([REF-0019](../reference/0019-latency-budget-and-target-architecture.md)), and payments through Stripe with real trading only through a regulated broker ([DEC-0046](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md), proposed) |
| #82 | A test-mode Stripe scaffold: four empty tables that refuse live-mode rows, a webhook and a checkout endpoint that answer 404 unless switched on, a pricing page behind a build flag, and a broker interface whose real-broker side refuses every call. No Stripe account, keys or charges |
| #84 | Latency tracking ([DEC-0045](../decisions/0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md)): how old each data series is at every hop, how long each GitHub job and step takes, and anonymous page timings from 1 in 10 page loads. A Latency page at `/research/#/latency` |
| #85 | The latency migration was dated before one already applied, so the database push refused it; it got a new date |
| #86 | First live numbers added to the baseline ([REF-0018](../reference/0018-parity-latency-baseline.md)) |

| Baseline measure (REF-0018) | Median | 95th percentile |
| --- | --- | --- |
| Gap between runs of the "hourly" News job | 3.5 h | 5.6 h |
| Delay before a scheduled GitHub job starts | 24 min | 50 min |
| Our fetch to the live site | 3 min | 8 min |
| Front page time to first data (3 test loads only) | 274 ms | 365 ms |

### AI apps connect to Parity

#90 added a hosted MCP server at `/mcp` so Claude, ChatGPT, Gemini CLI, Cursor, VS Code and Codex can read Parity's strategies, tests, Verify, markets, news and lessons as the signed-in person ([DEC-0051](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md), research in [RES-0024](../research/0024-ai-apps-connecting-to-parity-and-bringing-your-own-model.md), guide [GDE-0006](../guides/0006-connecting-ai-tools-to-parity-with-mcp.md)). Two write tools (demo orders, Trade layouts) are off unless switched on and allowed per app. An "Ask AI" panel lets people bring their own model, also off by default. AI apps cannot sign in until the owner turns on Supabase's OAuth server.

### Live prices

| Pull request | What came of it |
| --- | --- |
| #91 | Live prices through our own edge on Cloudflare ([DEC-0052](../decisions/0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md)): one upstream line per source shared by every viewer. CoinGecko (about a minute behind) is on for everyone. Trade searches every SEC-listed symbol, buy and sell markers from 11 strategy rules sit on the candles, and every chart has a badge that says how late its data is |
| #95 | Search came back with no live coins when CoinGecko refused a request and the refusal was cached. Refusals are no longer cached |
| #104 | Real-time feeds for team members only ([DEC-0056](../decisions/0056-team-members-see-real-time-venue-feeds-the-public-does-not.md)): Hyperliquid, Kraken, Coinbase Exchange, Gemini and Binance.US, gated on the server by a new team list. A Markets view, order books and trades in Trade. Stock adapters wait for keys |

Measured from exchange to viewer on the same code run on the owner's Mac (#104): Coinbase 46 ms median and 301 ms at the 95th percentile, Kraken 83 and 353 ms, Hyperliquid 319 and 594 ms.

### Database and analytics

| Pull request | What came of it |
| --- | --- |
| #100 | A stricter, faster schema ([DEC-0054](../decisions/0054-the-data-model-is-strict-indexed-and-keeps-an-append-only-trade-ledger.md), map in [REF-0021](../reference/0021-parity-database-schema-and-data-model.md)): row rules read the sign-in once per query, every foreign key has an index, one fill per demo order, an append-only trade ledger and one function to delete an account's data. A new `db` job in CI tests every migration on a fresh Postgres |
| #102 | Our own product analytics, opt-in and stored in Postgres ([DEC-0053](../decisions/0053-our-own-product-analytics-opt-in-stored-in-postgres.md), events in [REF-0022](../reference/0022-product-analytics-events.md)). Off until a person chooses "Allow analytics"; the cookie notice asks everyone again. A team-only Metrics page |

| Query on 1,000,000 made-up orders (#100) | Before | After |
| --- | --- | --- |
| Count a person's open orders | 67.78 ms | 0.02 ms |
| Delete a login with everything linked to it | 170.39 ms | 5.17 ms |

### Legal, regulatory and news pages

| Pull request | What came of it |
| --- | --- |
| #99 | A public page at `/legal/regulatory/` on what Parity is and is not, the laws it relies on, people's rights and where to complain. The laws are researched in [RES-0026](../research/0026-laws-and-rules-that-apply-to-parity-now-and-later.md) and the steps needed before each new kind of business are in [REF-0020](../reference/0020-compliance-checklist-before-each-new-step.md). No registrations or licences are claimed |
| #106 | The six legal pages and the index restyled as plain legal documents. Draft labels and owner notes came off the public pages and moved to REF-0020 |
| #103 | A blog at `/blog/` and a news page at `/news/` ([DEC-0057](../decisions/0057-blog-and-news-pages-with-labelled-posts-and-real-bylines.md), guide [GDE-0009](../guides/0009-writing-a-blog-or-news-post.md)). Every post says whether it is reporting, analysis or opinion, and the build fails if an opinion piece is not labelled. The three posts on the site are samples, hidden from search |

### Site plumbing: not found pages, speed and one style file

| Pull request | What came of it |
| --- | --- |
| #101 | Addresses that do not exist get a real 404 page instead of the front page, and each app has its own "not found" view ([DEC-0055](../decisions/0055-addresses-that-do-not-exist-get-a-real-404-and-each-app-says-not-found.md)) |
| #107 | Faster apps and never a black page ([DEC-0059](../decisions/0059-a-parity-page-is-never-black-it-shows-a-loading-screen-or-says-what-went-wrong.md), numbers in [REF-0024](../reference/0024-app-speed-how-we-measure-it-and-what-we-changed.md)). The owner had seen a black Academy lesson in desktop 0.2.0 after about 12 hours; the cause was not reproduced, so every app now shows a loading screen and a retry |
| #109 | One file of design values for every app, and a lint in CI that blocks raw colours, sizes and timings ([DEC-0058](../decisions/0058-one-token-file-for-every-app-and-a-lint-that-blocks-raw-values.md)) |

| App (#107) | Largest paint before | After | Code before | After |
| --- | --- | --- | --- | --- |
| Product | 1,624 ms | 380 ms | 1,263 kB | 376 kB |
| Research | 2,056 ms | 1,764 ms | 1,263 kB | 375 kB |
| Terminal | 404 ms | 320 ms | 574 kB | 294 kB |

Research still takes 1.7 s against a goal of 1.5 s.

### Component library

#111 completed the component library and shows it live on the UI page ([REF-0009](../reference/0009-ui-library.md)). It merged at 20:11 on 25 October, while this log was being written.

### Market research

#97 and #110 wrote [RES-0025](../research/0025-market-research-retail-trading-and-investing-leaders-weaknesses-and-gaps.md): US retail trading in October 2026, the leaders and their weak points, ten companies doing part of what Parity plans, and seven ways Parity could stand out. The main gap found: nobody sells a checkable explanation of why news moves a stock at a retail price.

### Still open when this was written

| Pull request | What it is |
| --- | --- |
| #105 | One motion system across every app |
| #108 | A getting started checklist and first-run tours |

### Incident: GitHub Actions hit a billing limit

GitHub stopped starting our CI jobs on 25 October. What the run records show:

| Time (25 Oct, UTC) | What happened |
| --- | --- |
| 05:47 | The desktop 0.2.0 release run: the Mac and Windows jobs were not started. GitHub's message: "recent account payments have failed or your spending limit needs to be increased" |
| 05:50, 05:52 | CI on #92 and #90: the Mac app test was not started, same message. The Linux jobs passed |
| 05:57 | Desktop 0.2.0 published from the owner's account with Mac files only |
| 06:01 | CI on #93: every job, Linux included, was not started. GitHub's message: "an Actions budget is preventing further use" |
| 06:17 | #93 merged: the Mac app test now runs only when the desktop app changes, because Mac minutes cost 10 times as much |
| 06:19 | #92 merged: signing settings are passed only when their secret exists (the empty Mac signing secret had also broken the release build), and a release can go out with Mac files when Windows is missing |
| 06:30 | CI on #94 ran and passed, including the new smoke test. LOG-0018 had said the smoke test had not run in CI yet |
| 19:57 | The desktop 0.2.1 release run built both Mac and Windows and published them |

Not recorded anywhere in the repo: whether the failed payment or the spending limit was fixed, and what the overage cost. CI started running again in the same window in which the repo became public (next section), but no record says that was the reason.

### Incident: the repo became public

- GitHub now reports `abasheer-rion/parity` as public.
- GitHub's event feed holds one "made public" event. Its own timestamp shows the repo's creation time (21 October, 02:29), so it is dated by its place in the feed: between events at 06:01:51 and 06:17:37 on 25 October.
- Not recorded in git history, pull requests, docs or the CHANGELOG: who made the change, why, and whether anything was checked before it went public.
- The repo has no licence file.
- DEC-0048 (#87) and the update feed in #89 were designed while release downloads needed a login; #87 says they answered 404 without one.

### Other problems found and fixed

| Problem | Fix |
| --- | --- |
| Main CI failed three times after #94 (06:42, 07:25, 07:58) on random routes reported as blank, mostly redirects into Trade, Academy and Workbench | #96: the smoke test waits up to 15 s for page text |
| The database push refused the latency migration | #85, above |
| No live coins in search after CoinGecko refused requests | #95, above |

### Notes on numbering

- Some pull request descriptions name a doc number that changed before merge: #102 says REF-0020 for the analytics events (it is REF-0022), #107 says DEC-0058 (it is DEC-0059, because #109 took DEC-0058), and #103's commit says DEC-0053 (it is DEC-0057).
- #103's description is a copy of #104's by mistake. What #103 did is taken from its commit, its files and DEC-0057.
- There is no DEC-0050 on main.

### Corrections to earlier logs

- [LOG-0016](2026-10-25-ayan-work-log-front-page-trade-links-copy-and-apps.md) listed #74 as open; it merged at 00:34 on 25 October. The Academy and Workbench it listed as in progress merged as #76 and #78.
- [LOG-0017](2026-10-24-ayan-work-log-competitor-profiles-feedback-collector-and-architecture.md) said latency tracking was still being drafted; it merged as #84.
- [LOG-0018](2026-10-25-bug-sweep-across-every-parity-app.md) said the smoke test had not run in CI; it did, at 06:30, and passed.

## Open questions

These are owner steps named in the pull requests. Whether any were done since is not recorded.

- **AI connect (#90).** Turn on Supabase's OAuth server with dynamic client registration and the consent path. Until then `/mcp` answers 401.
- **Desktop updates and signing (#89).** A read-only GitHub token as the Pages secret `DESKTOP_RELEASES_TOKEN`, and the Apple signing secrets in GitHub.
- **Team live data (#104).** Add the owner to the team list, add the GitHub secret `CLOUDFLARE_WORKERS_TOKEN` so CI can deploy the live worker, and keys for Alpaca or Finnhub if wanted.
- **Paid data (#91).** Whether to buy a real-time or delayed feed (prices listed in #91), whether to show Hyperliquid, and a free CoinGecko key to stop the refusals.
- **Analytics (#102).** Add the team's user ids to the viewer list.
- **Database (#100).** Turn on leaked password protection in Supabase.
- **Lawyer review.** The Verify dataset opt-in and privacy text (#67), the six legal pages and the questions in REF-0020 (#99), and the analytics wording (#102).
- **GitHub billing.** Whether the failed payment or spending limit needs action now that the repo is public.
- **The public repo.** Who decided, why, and whether it should have a licence.
- From earlier logs: the "lie detector" headline (LOG-0018) and the Reddit key (LOG-0017).

## Decisions

Decision docs written on 24 and 25 October, all accepted unless marked.

| Id | Decision | Pull request |
| --- | --- | --- |
| [DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md) | Verify runs its checks in the browser and holds daily prices only | #66, #67 |
| [DEC-0037](../decisions/0037-everything-runs-by-itself-and-the-search-widens-itself.md) | Everything runs by itself and the search widens itself | #68 |
| [DEC-0038](../decisions/0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md) | Every page gets its tags from one table and every view has a link | #69 |
| [DEC-0039](../decisions/0039-a-front-page-for-verify-dark-glass-and-scroll-scenes.md) | A front page for Verify, dark glass and scroll scenes | #70 |
| [DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md) | Parity Trade, a full-screen trading app of its own | #72 |
| [DEC-0041](../decisions/0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md) | Parity as an installable site and a desktop app for Mac and Windows | #73, #74 |
| [DEC-0042](../decisions/0042-parity-academy-a-full-screen-course-player-of-its-own.md) | Parity Academy, a full-screen course player of its own | #76 |
| [DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md) | Parity Workbench, one full-screen tool for strategy work | #78 |
| [DEC-0044](../decisions/0044-one-sign-in-panel-that-fades-in-over-the-front-page.md) | One sign-in panel that fades in over the front page | #79, #88, #98 |
| [DEC-0045](../decisions/0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md) | We track how old our data is at every hop and how fast pages get it | #84 |
| [DEC-0046](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md) | Payments through Stripe, and real trading only through a regulated broker (proposed) | #81, #82 |
| [DEC-0047](../decisions/0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md) | Competitor profiles and a feedback collector that runs by itself | #83 |
| [DEC-0048](../decisions/0048-the-desktop-app-loads-the-live-site-and-keeps-a-copy-for-offline.md) | The desktop app loads the live site and keeps a copy for offline | #87 |
| [DEC-0049](../decisions/0049-the-desktop-app-opens-on-the-log-in-page-with-a-menu-button-and-its-own-controls.md) | The desktop app opens on the log-in page, with a menu button and its own controls | #89 |
| [DEC-0051](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md) | AI apps connect through a hosted MCP server, and people bring their own model | #90 |
| [DEC-0052](../decisions/0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md) | Live prices stream through our own edge, and every chart says how late they are | #91 |
| [DEC-0053](../decisions/0053-our-own-product-analytics-opt-in-stored-in-postgres.md) | Our own product analytics, opt-in, stored in Postgres | #102 |
| [DEC-0054](../decisions/0054-the-data-model-is-strict-indexed-and-keeps-an-append-only-trade-ledger.md) | The data model is strict, indexed and keeps an append-only trade ledger | #100 |
| [DEC-0055](../decisions/0055-addresses-that-do-not-exist-get-a-real-404-and-each-app-says-not-found.md) | Addresses that do not exist get a real 404 and each app says not found | #101 |
| [DEC-0056](../decisions/0056-team-members-see-real-time-venue-feeds-the-public-does-not.md) | Team members see real-time venue feeds the public does not | #104 |
| [DEC-0057](../decisions/0057-blog-and-news-pages-with-labelled-posts-and-real-bylines.md) | Blog and news pages with labelled posts and real bylines | #103 |
| [DEC-0058](../decisions/0058-one-token-file-for-every-app-and-a-lint-that-blocks-raw-values.md) | One token file for every app and a lint that blocks raw values | #109 |
| [DEC-0059](../decisions/0059-a-parity-page-is-never-black-it-shows-a-loading-screen-or-says-what-went-wrong.md) | A Parity page is never black, it shows a loading screen or says what went wrong | #107 |

Choices made in pull requests without a decision doc of their own:

- The Mac app test in CI runs only when the desktop app changes (#93).
- A desktop release can go out with Mac files when the Windows build is missing (#92).
- Every pull request runs the smoke test over every route (#94, #96).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
