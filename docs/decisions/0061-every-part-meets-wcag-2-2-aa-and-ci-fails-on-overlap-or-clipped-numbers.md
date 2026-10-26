---
id: DEC-0061
title: Every part meets WCAG 2.2 AA and CI fails on overlap or clipped numbers
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [ui]
related: [REF-0009, DEC-0058, DEC-0030, DEC-0017, REF-0017]
---

# Every part meets WCAG 2.2 AA and CI fails on overlap or clipped numbers

## In plain words

Every button, field, table and panel on Parity now meets the WCAG 2.2 AA accessibility standard, and CI checks it on every pull request. Text is readable on the dark glass even where the red glow is brightest. Anyone using a keyboard sees a clear ring on whatever they are on. Every control is at least 24 pixels, or has that much room around it. Nothing keeps moving for people who turn motion down. The every-page test also opens each page at four window sizes and fails if any text overlaps other text or a number is cut off. To change a style for the whole site, change its value in `web/src/ui/tokens.css`.

## Context

- The owner asked for one token file, one component library, a lint that blocks raw colours and inline motion, a test that catches overlapping or clipped numbers, and WCAG 2.2 AA for every component.
- DEC-0058 had already made `tokens.css` the one source and added the lint. The component library was finished in the pull request before this one.
- An axe run over all 89 routes at desktop and phone width found 52 serious or critical problems: tables that scroll sideways but could not be reached by keyboard, links in sentences told apart only by colour, the latency badge's spoken name not matching its words, small buttons under 24 pixels, and a markets table with a row group holding no rows.
- Field, checkbox and radio edges were white at 14%, about 1.4:1 on the page. WCAG asks 3:1 for the edge that shows where a control is.
- Many components cleared their focus outline with `outline: none`, and the shared ring had no weight, so those controls showed only a faint border change.
- The layout audit with real engine output found numbers cut off in the Terminal's KPI panel at 1280 wide and a "Promising 3" count cut to "..." on the research home on a phone. The small CI fixture had not shown either.
- The shared motion system (#105) is still open, so the motion tokens in DEC-0058 stay the names it builds on.

## Decision

1. **A contrast test on the tokens.** `web/tests/contrast.test.ts` checks every text colour at 4.5:1 and every control colour and the focus ring at 3:1 on every surface, including frosted glass over the brightest point of the glow (35% red over the page, above the front page's 27.5% peak), a selected row, the red badge and the Terminal's panels. A token change that fails a pair fails the tests.
2. **A control edge token.** `--color-border-control` (grey 500, 3:1 on every surface) draws the edge of fields, selects, checkboxes, radios, switches and slider tracks. Hover lightens it and focus turns it white.
3. **The focus ring always wins.** `web/src/a11y.css` draws a 2px ring in `--color-focus` on every focused control, over any component rule. Elements focused by code only (`tabindex="-1"`, such as the page after a route change) are left alone.
4. **`TableScroll` for every scrolling table.** The box joins the tab order as a named region only when its table does not fit, so arrow keys scroll it. `DataTable` uses it, and 28 hand-written table boxes in 12 files were replaced.
5. **24px targets.** `xs` buttons and icon buttons are 24 pixels, icon buttons never shrink in a row, and list and row buttons are at least 24 pixels tall.
6. **Motion timing from tokens in scripts too.** `usePresence` takes a duration token (`"dur-2"`), not a number. The lint now fails on a duration, delay or easing typed into scripted motion (`element.animate`, smooth scroll) as well as in CSS.
7. **Figures from one token.** Every number uses `font-variant-numeric: var(--num-variant)` (tabular, lining). The lint fails on writing it out.
8. **CI runs it all.** The smoke test runs the overlap and clipping check on every route at 1280x800, 1440x900, 1920x1080 and 390x844. `npm run a11y` runs axe's WCAG 2.2 A and AA rules on every route at two sizes, walks the UI library page by keyboard and checks that nothing animates under reduced motion.

## Alternatives considered

- **Run the audits by hand before releases.** Rejected: a hand check misses every page changed after it ran. A check that fails the pull request does not.
- **Check contrast in the browser with axe only.** Rejected as the only check: axe cannot judge text on a blurred, see-through panel over a gradient and skips those cases. The token test covers them by working out the worst case.
- **Lighter field edges with a second cue (a fill).** Rejected: the fill on glass is too faint to count, and a field must be findable without its label.
- **Unify the public site's larger buttons with the app's.** Not done here. The front page, sign-in, legal pages and `/connect/` use the site kit's hero buttons, which read the same tokens. Folding them into `Button` changes the front page's look and needs the owner's eye.

## Consequences

- Field, checkbox, radio, switch and slider edges are a visible grey instead of a faint line.
- Plain links inside sentences, table cells and notes are underlined.
- The CI web job is about four minutes longer (two more smoke sizes, and the accessibility run).
- New code cannot add a control without a visible focus ring or a page with a keyboard-unreachable scrolling table without CI failing.
- REF-0009 lists the checks, the tokens and what each part does to meet AA.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0009: UI library](../reference/0009-ui-library.md)
<!-- backlinks:end -->
