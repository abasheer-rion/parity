---
id: LOG-0023
title: Verify QA sweep on production
type: log
status: final
created: 2026-11-04
updated: 2026-11-04
authors: [ayan]
tags: [process, ui]
related: [DEC-0081, DEC-0089, DEC-0090, DEC-0091, DEC-0061]
---

# Verify QA sweep on production

## In plain words

On 4 November 2026 we used Verify on the live site the way a new user would, in a hidden test browser: every file kind we have samples of, pasted strategy code, a seller's page and pasted claims, the batch screen with the synthetic sample, compare, share links, the PDF, the post image, the badge and broker steps up to the sign-in, the pilot form without sending it, the API with no key and a bad key, and the AI app connection. We also checked phone width, keyboard only and screen reader names. Nothing was sent from the pilot form and no account was made. We found 9 bugs and fixed all 9, each with a test.

## What happened

### What was checked

| Area | How | Result |
| --- | --- | --- |
| File uploads | All 59 sample exports (19 made-up layouts, 7 copied layouts, 33 real files), each read and checked | All read. Files with no closed trades say why |
| Strategy code | 7 sample scripts and both built-in examples, signed out | Read correctly; the two that cannot run say which line and why |
| Seller's claims | 3 pasted pages, the example, 3 real MQL5 signal pages, a page behind a login (X), a page with no claims, a page that fills in by script | Claims listed with their source; refusals in plain words |
| Page reader safety | Local, private, cloud metadata and odd IP spellings, file links, a redirect to a private address | All refused |
| Batch screen | Synthetic sample, one row's full report, an empty run, a blank balance, a single file | All worked |
| Share | Link copied and opened, broken links, PDF, post image, compare from a link and from a file | Worked, with the bugs below |
| Pilot form | All three business pages: empty, bad email, Escape, focus return. Never sent | Worked |
| Broker and badge | Signed out, both send the person to log in and back | Worked. The signed-in form was tested locally |
| API | Every Verify endpoint with no key, a bad key, an unknown well-formed key and a foreign browser | 401 or 403 with plain words; the index and the spec stay open |
| AI app connection | The tool list | Asks for sign-in, with the discovery address that AI apps follow |
| Phone, keyboard, screen readers | axe (WCAG 2.2 AA) on 10 pages and 4 live results at 1280 and 390 pixels wide, sideways overflow, 40 presses of Tab | Two bugs below; no page scrolls sideways |

Screenshots are in the owner's Desktop folder `parity-verify/qa/` (before) and `parity-verify/qa/after/` (after, on a local build).

### Found and fixed

| # | Bug | Fix |
| --- | --- | --- |
| 1 | Compare: a file checked there said "we hold no daily prices for EURUSD", which is false, and never checked the fills even when signed in | Compare checks a file the way the Verify page does. Signed out it says the prices were not loaded |
| 2 | Compare: an equity curve with no deposits column was assumed to have none, without asking | It asks, as the Verify page does |
| 3 | Save as PDF on the public page printed the introduction and all 26 file cards: a one-page result came out at 10 pages | Only the report prints |
| 4 | "Only 1 trades and 1 daily returns", and the same on badges, cards and checks | Counts take the right word |
| 5 | On a short record every chart label read "1.0x" and every date "2024-01" | Two decimals under 3x, and days instead of months under three months |
| 6 | The cookie notice covered "Screen the accounts" completely, even with keyboard focus on it (WCAG 2.4.11) | While the notice shows, the page keeps the strip under it clear and scrolls focused controls above it |
| 7 | The API guide's wide tables and code could not be reached by keyboard (axe, serious) | The plain pages load the same scroll-region helper as the apps |
| 8 | The broker form sent the key before finding that the dates could not be read (start after end, range too long, future end) | The form checks dates, tries and balance first and says what is wrong. A test keeps it in step with the server |
| 9 | If adding a result to the research dataset failed after a badge was published, the error was never shown | It shows under the published badge. The badge name is trimmed |

Also: the compare footnote now names every red mark, and the compare sentence reads "A: Not enough data, luck check cannot be measured."

Tests: `web/tests/verify/qa-sweep.test.tsx`.

### Found and left

| What | Why |
| --- | --- |
| A seller's page that says "since 2005" about the seller lists 2005 as a start date among the claims | The claim used is the dated one from the statistics; the extra line is shown with its quote, so the reader can see what it is |
| MQL5 "Monthly growth" can be negative on an account up 340% in total | That is what the page says; Verify quotes it with its source |

## Decisions

None new. The fixes follow DEC-0081, DEC-0089, DEC-0090, DEC-0091 and DEC-0061.

## Open questions

None.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
