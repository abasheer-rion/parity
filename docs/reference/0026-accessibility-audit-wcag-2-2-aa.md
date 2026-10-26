---
id: REF-0026
title: Accessibility audit, WCAG 2.2 AA
type: reference
status: current
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [process, ui]
related: [REF-0009, DEC-0058, REF-0017]
---

# Accessibility audit, WCAG 2.2 AA

## In plain words

The owner asked for Parity to be ADA compliant. The usual yardstick is WCAG 2.2 at level AA. We built checks that open every page of every app the way a keyboard or screen reader user would, found what failed, fixed it, and made the checks run on every pull request so the fixes stay fixed. axe-core found 39 serious or critical problems before and none after. Our own keyboard, focus, motion and contrast checks found 751 problems before and none after. Some limits remain and are listed below and on the public accessibility statement.

## Summary

- axe-core, serious and critical: **39 before (7 critical, 32 serious, 6 rules), 0 after**. Moderate and minor: 0 before and after (the WCAG A and AA rules are all rated serious or critical).
- Our own checks: **751 problems before, 0 after**. Most of the 751 were small targets (547 links on the Learn pages that turned out to be inline text, which the first version of the check counted wrongly, plus real ones in the Terminal and Trade), 45 pages with an animation loop running under reduced motion, and missing headings, skip links, focus outlines and chart text.
- Both run in CI in the web job (`npm run a11y`, `npm run a11y:checks`) and fail the build on any problem.
- The public statement is [/legal/accessibility/](../../web/legal/accessibility/index.html).

## What runs

### axe-core on every page (web/scripts/a11y.mjs)

- Every route in `web/scripts/lib/routes.mjs` (87 routes: site, sign-in, legal, product, research, Terminal, Trade, Academy, Workbench), plus the verify, connect, OAuth, badge and 404 pages and each app's not-found view, plus one page of each kind among the static pages (Learn, Ideas, Notes, Blog, News, tags, authors): 120 pages.
- At 1280 by 860 and 390 by 844, signed out (a first visit, cookie notice showing) and with sign-in skipped (`VITE_AUTH_BYPASS=1` and the smoke fixture data): 480 page views.
- The desktop app's own pages (title bar, sections menu, command palette, Open link, Settings, error page, offline strip, the site's offline page) opened as plain files in headless Chromium with a stand-in for the preload bridge. Electron is never started.
- Rules: WCAG 2.0, 2.1 and 2.2, A and AA. Fails on any serious or critical violation, on sideways scroll at phone size, or on a page that could not be audited.

### Our own checks (web/scripts/a11y-checks.mjs)

On every page, signed in with sign-in skipped, at 1280 by 860:

- **Structure.** One main landmark, one visible h1, no skipped heading levels, no positive tabindex.
- **Names.** Every button, link, field, tab, switch and image has an accessible name, read from Chromium's accessibility tree. Every image has alt text. Every chart (a canvas or svg over 120 by 60) has a name or a written summary beside it; hidden decoration is allowed.
- **Keyboard.** Tab from the top of the page: the first stop is a working skip link (unless the first stop is already in the main area), focus reaches the main area, focus never loops or sticks, every stop shows a visible focus change, and no focused element is hidden under a sticky bar or notice (WCAG 2.4.7, 2.4.11).
- **Menus and dialogs** on 19 key pages: each button that opens a menu or dialog is pressed from the keyboard. A dialog takes focus and keeps it on Tab, Escape closes it, and focus goes back to the button. First-run tours get the same checks.
- **Targets.** Every control is at least 24 by 24 CSS px, or a 24 px circle around it touches no other control (WCAG 2.5.8). Links inside a line of text are exempt. Panel dividers you can move with the arrow keys are exempt; their pointer band is widened in CSS.
- **Reflow.** No sideways page scroll at 320 CSS px and at 640 px (200% zoom of 1280) (WCAG 1.4.10).
- **Motion.** With reduced motion on: no endless or long animation and no animation loop (more than 60 frames in 2 seconds). With it off: anything that changes or moves by itself for more than 5 seconds needs a visible Pause or Stop control (WCAG 2.2.2).
- **Live regions.** A polite region may change at most 3 times in 6.5 seconds, an assertive one at most once.
- **Contrast over real backgrounds.** For text axe cannot judge (over glass, gradients, glows, images), the check hides the text, photographs what is behind it and measures the text colour against the 10th and 90th percentile pixels (WCAG 1.4.3). A low reading is taken twice before it counts.
- **Form errors** on log in, sign up and reset (signed out): bad input marks the field `aria-invalid`, the error is tied with `aria-describedby`, and it sits in an alert or live region.
- **Desktop app pages**: names, structure, keyboard walk and visible focus; Escape closes the menu and palette.

### Never online

Both scripts start their own Vite servers on 127.0.0.1 and block every other host. The signed-out server points Supabase at a dead local address, so nothing reaches the hosted project and no account is used. Trade and the Terminal get a small made-up market export so their charts, tables and ticker are checked too.

## What was found and fixed

| Area | Before | Fix |
| --- | --- | --- |
| Wide tables and code lines that scroll | 14 not reachable by keyboard | Focusable, named regions when they overflow (`web/src/lib/a11y/scrollRegions.ts`) |
| Links in sentences and table row headers | 13 told apart by colour only | Underlined |
| Live badge name | Visible words not in the name (3) | The details are hidden text after the visible words |
| Markets table (Trade) | Rows not inside the row group | Spacer marked presentational, empty state is a row |
| Small buttons | Bookmark and copy link 13 px wide on phones; Terminal panel buttons, segment buttons, rows and tape 18 to 22 px; Trade watchlist and Workbench price buttons 20 to 22 px | 24 px |
| Desktop menu and palette | Rows marked as list options outside a list; palette field unnamed, no focus mark | Plain buttons in the menu; the palette is a named combobox with `aria-activedescendant`; a focus line under the field |
| Reduced motion | Smooth scroll ran an animation loop on 45 pages | Smooth scroll is not started when reduced motion is on |
| Headings | No h1 in Trade's chart view, the Terminal, the OpenRouter page and desktop Settings; skips on Hype terms, Blog and News lists and the Academy list | Hidden h1s where the design has none; card titles are h2 where they follow the h1; Terminal panel titles are h2 |
| Skip links | Missing on connect; static pages moved only the Tab start point | Skip link added; static pages' main takes focus |
| Focus | Plain fields lost their outline to a global rule; the Verify file picker showed nothing; Terminal rows had none | Outlines back; the picker's label shows focus; rows show an amber outline |
| First-run tours | Kept focus but were not marked modal; focus fell to the page body when they ended | `aria-modal`; focus goes back where it was, or to the main area |
| Charts | Line, bar, growth and fan charts had only a short name; Trade's chart canvas had none | A written summary of each chart (span, start, end, low, high per line) tied with `aria-describedby`; the Trade chart gets the same in hidden text |
| Live and moving content | Prices, books, the markets board and the Terminal tape had no Pause | A Pause / Resume button (`web/src/components/PauseLive.tsx`); updates are held while paused and caught up on Resume (`web/src/lib/live/pause.ts`) |
| Live regions | The animated number announced every frame; service status every minute; chart tooltips on every mouse move | The final number only; status and tooltips are not live regions |
| Contrast | Primary buttons in Trade, Workbench and Academy not-found views were white on white; front page subtitle 2.96:1 over the red glow; chart labels crossed by lines | Button text colour restored; subtitle one step lighter; chart labels keep a dark halo or a background; Academy end labels no longer overlap |
| Status messages | "Copied" on the connect page was not announced | A status region |

## How to re-run

From `web/`, after `npm ci` and `npx playwright install chromium`:

1. `npm run a11y` (about 8 minutes). `A11Y_ONLY=/legal/` limits it to paths containing the text, `A11Y_MODES=bypass` to one mode (`bypass`, `signed-out`, `desktop`), `A11Y_JSON=out.json` writes every violation.
2. `npm run a11y:checks` (about 11 minutes). `A11Y_ONLY` works the same; `A11Y_SKIP=motion,contrast,reflow,keyboard,forms,desktop` leaves parts out; `A11Y_DEBUG=<folder>` saves the pictures behind each low contrast reading.

Both are headless. Neither opens a window, starts Electron or reaches the internet.

## Known limits

- Automated checks do not find everything. We have not tested with each screen reader and browser pair, and there has been no independent audit, so the statement does not claim full conformance.
- The value under the pointer on a chart is for mouse and touch only; keyboard and screen reader users get the written summary, not each point. Trade's drawing tools need a mouse or touch.
- Sim World's map is visual only.
- Chart lines are told apart by colour, with names in the legend and summary, but no patterns.
- Pause holds updates; on Resume everything catches up at once. Ticks held past 20,000 per listener are dropped.
- The contrast check reads the pixels at one moment; text over a moving 3D picture is checked as it stands when the page settles.
- The behaviour checks run at desktop size, signed in. axe covers phone size and signed out.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
