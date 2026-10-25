---
id: LOG-0018
title: Bug sweep across every Parity app
type: log
status: final
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [process, ui]
related: [DEC-0038, DEC-0041, REF-0017]
---

# Bug sweep across every Parity app

## In plain words

On 25 October 2026 the owner said the apps had plenty of bugs. We opened every page of every Parity app in a test browser, on a laptop-sized and a phone-sized screen, signed out on the live site and signed in on a local copy with test data. We wrote down what broke, fixed what we could, and added a check to CI that opens every page on each pull request and fails if a page errors.

## What happened

### How we looked

| Pass | Where | What it covered |
| --- | --- | --- |
| Crawl | Local copy, sign-in skipped, a nightly run as test data | 249 pages at 1440x900 and 390x844, following every link found on a page, sampling at most 3 pages of each kind |
| Crawl | parity.endyland.com, signed out | 400 pages at each size, plus every one of the 550 addresses in the sitemap and the 571 links inside them |
| Screenshots | Local copy | 42 main pages at both sizes, read by eye |
| Clicks | Local copy | Every button, tab and switch on 43 pages, watching for errors |
| Keyboard | Local copy | 60 presses of Tab on 8 pages, watching for traps and lost focus |
| Accessibility | Local copy | axe (WCAG 2.2 A and AA) on 27 pages at both sizes |
| Desktop app | A separate copy of Parity 0.1.2 with its own data folder | Window, menus and a `parity://` deep link, signed out |

The crawler is `web/scripts/crawl.mjs`. The CI check is `web/scripts/smoke.mjs` (`npm run smoke`).

### Found and fixed

| # | Bug | Where | Fix |
| --- | --- | --- | --- |
| 1 | Clicking a column header that is also a glossary word (CAGR, Sharpe, Max drawdown, Deflated) opened the glossary instead of sorting | Discover, every sortable table | Inside a sort button the word is plain text that still shows its preview on hover. Test in `tests/tableTerms.test.tsx` |
| 2 | A missing data file showed "Unexpected token '<' ... is not valid JSON" | Markets, News archive, News impact, and any page whose file is not published | The host answers a missing file with the app's HTML page, so a 200 with HTML now counts as missing. Test in `tests/missingData.test.ts` |
| 3 | Signed-in users were told to run command line tools such as `parity markets fetch` when data was missing | Markets, News | That hint shows only on a developer's machine; the site says the data has not been published yet |
| 4 | Copy link and the back button lost the search, filters and time range | Discover, Algorithm library, News | They are kept in the link (DEC-0038). Checked by the smoke test |
| 5 | Long web addresses and file paths pushed pages sideways on a phone, by up to 524 pixels | Bibliography, algorithm reports, data source pages | Long words in sentences and lists wrap |
| 6 | A missing or broken number could show as "NaN%" or "Infinity%", and a malformed date crashed the page | Every page that formats numbers or dates | They show "n/a". Test in `tests/format.test.ts` |
| 7 | A full-width button's label ran past its edges in a narrow column | Strategy page, "Try other settings in the Workbench" | Full-width buttons wrap their label |
| 8 | The time range tabs held a non-tab control, which screen readers report as broken | Every chart with a comparison line | The comparison key sits outside the tab list |
| 9 | White text on the brightest green and red tiles failed contrast | Parity Terminal heat map | Those tiles use dark text |
| 10 | Links inside sentences were told apart by colour only | Competitors | Underlined |
| 11 | The sign-in screen put a block inside a paragraph, which React warns about | Log in, password step | The lead line is a block |
| 12 | On the 1M range two date labels sat on top of each other, and React warned about a repeated key | Strategy page growth chart | Repeated labels are dropped |
| 13 | A practice position opened in the evening in the Americas was dated tomorrow | Markets, Crypto and Practice | It uses the reader's own date |

### Found and left

| Bug | Why it is left |
| --- | --- |
| The front page headline says "lie detector", which REF-0017 rule 3 lists as a metaphor to avoid | The headline is the owner's call |
| Tables that scroll sideways are not tab stops (axe, "scrollable region must have keyboard access") | Current Chrome and Edge make such regions focusable on their own; adding a tab stop to every table would add dozens of stops |
| Signing in from trade.endyland.com comes back to `trade.endyland.com/trade/` instead of `/` | It works, the address is only longer. The middleware tests pin this on purpose |
| The live site's privacy page links to `/cdn-cgi/l/email-protection`, which answers 404 without JavaScript | Cloudflare's email hiding adds it; with JavaScript the link works |
| Desktop app bugs (below) | `desktop/` belongs to the desktop shell work on `feat/desktop-shell-v2`; handed over in the pull request |

### Desktop app 0.1.2, handed over

| Bug | How seen |
| --- | --- |
| A `parity://trade/#/alerts` link while signed out shows a fully black window, with no log in and no error | Seen by the owner |
| The window cannot be dragged | Seen by the owner. The page fills the whole window under a hidden title bar, so only the 76 pixel sidebar can be a drag area |
| Opening a `parity://` link while the window is closed (the app still running on a Mac) saves the link but opens no window | Code reading: the link waits for a window that is only made when the Dock icon is clicked |
| Cmd+comma is given twice, to "Account settings" in the Parity menu and to "Account" in the Go menu | Code reading |
| The Parity menu always says "Pages load live from parity.endyland.com", also when offline or pointed at another address | Code reading |

### Numbers

| | Count |
| --- | --- |
| Bugs found | 22 |
| Fixed | 13 |
| Left, with a reason | 4 |
| Handed to the desktop work | 5 |

## Decisions

- Every pull request now runs `npm run smoke`: each route of each app at both sizes, failing on an exception, a console error, a failed request, a blank page, NaN in the text or sideways scroll. It uses a 258 kB slice of a nightly run in `web/tests/fixtures/smoke`, made by `web/scripts/smoke-fixture.py`.
- A data file that is not published counts as missing whether the host answers 404 or its HTML page.
- Search, filters and time range on Discover, the Algorithm library and News are part of the link.

## Open questions

- Should the front page headline keep "lie detector"? REF-0017 says no; it is the owner's call.
- GitHub Actions is out of budget, so the new smoke check has not yet run in CI. It passes locally.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
