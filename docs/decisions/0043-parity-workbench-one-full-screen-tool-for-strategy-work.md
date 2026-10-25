---
id: DEC-0043
title: Parity Workbench, one full-screen tool for strategy work
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [process, ui]
related: [DEC-0040, DEC-0042, DEC-0015, DEC-0014, DEC-0038, DEC-0039, DEC-0041, REF-0011, REF-0017]
---

# Parity Workbench, one full-screen tool for strategy work

## In plain words

Five tools used to be spread over two apps: Try settings, What if and Compare in the product app, and Strategy search and the Edge Lab in the research app. They are now one app, Parity Workbench, that fills the screen like Parity Trade. A thin rail on the left switches between the five tools and Settings. Each tool is dense: controls on the left, results on the right, small numbers, labels instead of explanations, and tooltips only where a word needs one. Whatever you set is kept in the address, so Copy link gives someone the same view. The search and the Edge Lab come from the research side and are shown read only. It lives at lab.endyland.com and at /lab/, behind the same sign-in.

## Context

The owner asked for it on 24 October 2026: "Parity Workbench (strategy workbench): one app at /lab/ combining Try settings (the What if / scenarios lab), Compare, Strategy search and Edge Lab ... Keep the product/research wall from DEC-0015 ... Dense, tool-like UI, its own rail and settings, URL state and Copy link ... terse like Trade." [DEC-0040](0040-parity-trade-a-full-screen-trading-app-of-its-own.md) had recommended this: these are long working sessions with many controls.

The tools existed: Try settings and Compare read a research run, What if reads the past events file ([REF-0011](../reference/0011-scenario-simulator-method.md)), Strategy search reads the always-on search's results and the Edge Lab is lessons plus a checklist ([DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md)). Each was a page with a paragraph of explanation above it.

## Decision

1. **A separate entry and build.** `web/lab/index.html`, marked `<html data-space="lab">`, loads `src/lab/main.tsx` and none of the product or research pages. `vite build --mode lab` writes it to `/lab/` with its files under `/lab/assets/`, the same shape as Trade and the Academy ([DEC-0042](0042-parity-academy-a-full-screen-course-player-of-its-own.md)). It has its own manifest and the service worker keeps its built files ([DEC-0041](0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md)).
2. **Addresses.** `/lab/` on parity.endyland.com and `lab.endyland.com`, which the owner approved and set up as a Pages custom domain on 24 October 2026. The Pages middleware serves `/lab/` at the subdomain's front page, keeps the sign-in pages and assets public there and sends the other apps back to the main address. `labUrl()` in `src/lib/space.ts` points at the subdomain on endyland.com and at `/lab/` elsewhere; one constant, `LAB_SUBDOMAIN`, switches it back to the path.
3. **The tools.**
   - **Try settings** (`#/try`): a strategy list to filter, the settings test's values as dropdowns, the version's Sharpe ratio, return, worst fall and the count of versions with a positive Sharpe, its growth line against the S&P 500, and every version in a table (click a row to load it). The count of versions tried stays on screen, because every version counts as a trial.
   - **What if** (`#/whatif`): the scenario builder on the left; on the right the match count and dates, one line per market on what followed, the table of moves at each horizon, a fan chart per market and the matching events with sources. The limits sit behind one button.
   - **Compare** (`#/compare`): the league table with sortable columns, the crisis table and the correlation grid, one at a time.
   - **Strategy search** (`#/search`): the counts, the service line and every variation tried, with filters.
   - **Edge Lab** (`#/edges`): the checklist beside its pitfalls, and the seven lessons, our own mistakes and further reading as tabs. `#/edges/<lesson>` opens that lesson.
   - **Settings** (`#/settings`): density, which view opens first, clearing the saved scenarios and the checklist draft, the keys and links.
4. **The address holds the state.** Each tool writes its state to the hash query without adding history entries: the strategy and settings (`?s=&p.<setting>=`), the scenario (the existing scenario query), the Compare table and sort (`?t=&sort=`), the search filters (`?q=&asset=&family=&beats=`), the Edge Lab tab (`?t=`) and the run (`?run=`). Copy link in the top bar (or L) copies it ([DEC-0038](0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md)).
5. **The two sides stay apart ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)).** The Workbench reads the published research files the apps already read (`/data/latest.json` and the run files, `/data/search.json`, `/data/scenarios.json`) and the research docs for citations. It writes nothing to the research side and has no table of its own. The search and the Edge Lab carry a "Research, read only" mark. Saved scenarios and the checklist draft stay in this browser, as before. Nothing done in the Workbench reaches a research run, the ledger or the search.
6. **Terse.** No page blurbs or footnotes. Labels, numbers and a tooltip where a term needs one (deflated Sharpe, luck check, correlation with stocks, the reaction table's cells, trials). One line at the bottom carries the disclaimer. The look is the front page's ([DEC-0039](0039-a-front-page-for-verify-dark-glass-and-scroll-scenes.md)) made quiet for a tool: near-black, hairline glass panels, one faint red glow, red for the active view.
7. **Keys.** Shift+1 to 6 switch tools, / goes to the find box, L copies the link, ? lists the keys.
8. **One home for the tools.** The product sidebar loses Compare, Try settings and What if and gains one Workbench link; the research sidebar loses Strategy search and Edge Lab and gains one Workbench link. Both open it in a new tab. Old links keep working: `#/lab` opens Try settings, `#/scenarios?...` What if with the same scenario, `#/compare` Compare, `#/search?...` the search with the same filters and `#/edges/<lesson>` that lesson. In-app links to them open the Workbench in a new tab, and the strategy page's "Try other settings" opens Try settings on that strategy. The five pages are gone from `src/pages/`; nothing is duplicated.

## Alternatives considered

- **Two apps, one for product tools and one for research tools.** Rejected. The owner asked for one, and the tools are used together: a search lead is compared, its settings tried, and the idea checked.
- **Copy research numbers into a Workbench table so they can be edited.** Rejected. That would let product use change what research shows, which DEC-0015 rules out.
- **Saved workspaces in the account.** Not now. The address already reopens any view, and saved scenarios stay in the browser as they did. A table can come later.

## Consequences

- `/lab/` and `lab.endyland.com` are behind the sign-in; the middleware and redirect tests cover both, and the layout shift and accessibility audits include the Workbench views (worst layout shift 0.001).
- The desktop app ([DEC-0041](0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md)) already lists the Workbench once `lab/index.html` is built, and now keeps `lab.endyland.com` links inside the app.
- A native wrapper can add `lab` as an entry the same way as `trade` and `academy`.
- No migration.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
