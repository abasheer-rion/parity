---
id: REF-0009
title: UI library
type: reference
status: current
created: 2026-10-21
updated: 2026-10-26
authors: [ayan]
tags: [docs, ui]
related: [DEC-0011, DEC-0017, DEC-0058, DEC-0061, REF-0001]
---

# UI library

## In plain words

The dashboard is built from one box of parts: buttons, text, cards, tables, filters, charts, colours and animations. Every page takes its parts from that box, so a change in one place changes the whole site, and nothing drifts. You can see every part working in the dashboard under Research, then UI library (`#/ui`).

## Summary

| What | Where | Notes |
| --- | --- | --- |
| Tokens (colour, type, space, radius, shadow, glass, layers, motion, breakpoints) | `web/src/ui/tokens.css` | The only place values are set ([DEC-0058](../decisions/0058-one-token-file-for-every-app-and-a-lint-that-blocks-raw-values.md)). Dark only. |
| Tokens in TypeScript | `web/src/ui/tokens.ts`, generated `tokens.gen.ts` | Typed names, live values for canvas charts, plain values for share images and the desktop app (`npm run tokens`). |
| Token lint | `npm run lint:styles` | Fails on raw colours, px font sizes, durations, curves, written-out number figures, page-level z-index and undefined `var(--x)` outside the token file, and on durations or easings typed into scripted motion. Runs in CI. |
| Accessibility check | `npm run a11y` | WCAG 2.2 AA on every route, a keyboard walk through `#/ui` and reduced motion ([DEC-0061](../decisions/0061-every-part-meets-wcag-2-2-aa-and-ci-fails-on-overlap-or-clipped-numbers.md)). Runs in CI. |
| Component styles | `web/src/ui/ui.css` | Reads tokens only. |
| Components | `web/src/ui/*.tsx`, imported from `web/src/ui` | Pages import from `../ui`, never from a single file. |
| Live gallery | `web/src/pages/UILibrary.tsx`, route `#/ui` | Every part, live, with usage and rules. Chart demos use sample data, labelled so. |
| Decision | [DEC-0011](../decisions/0011-read-the-docs-inside-the-dashboard-with-stacked-previews.md) | Why the layout copies Mercury and the charts merge Mercury and Robinhood. |

## Changing a style site-wide

Edit the value in `web/src/ui/tokens.css`, then run `npm run tokens` to refresh the generated copies. Every app, the legal pages and the desktop app follow. Then run `npx vitest run tests/contrast.test.ts`: it fails if the new value drops any text below 4.5:1 or any control part below 3:1 on any surface.

| Token group | Names | What it sets |
| --- | --- | --- |
| Colour | `--color-canvas`, `-surface`, `-surface-raised`, `-surface-overlay`, `-glass`, `-border`, `-border-strong`, `-border-control` (edges of fields, checkboxes, switches, sliders), `-text`, `-text-body`, `-text-muted`, `-text-faint`, `-primary`, `-on-primary`, `-accent`, `-accent-text`, `-accent-soft`, `-selected`, `-positive`, `-negative`, `-warning`, `-info`, `-focus`, `-glow` | Backgrounds, lines, text, the main button (white), the selected state (red), gains, losses, warnings, focus rings and the red glow |
| Type | `--type-3xs` (10px) to `--type-8xl` (44px), `--type-display`, `--weight-*`, `--leading-*`, `--num-variant`, `--num-features` | Text sizes, weights, line heights, tabular figures for every number |
| Space and shape | `--space-*`, `--radius-xs` to `--radius-pill`, `--control-h-*` | Gaps, corners, control heights |
| Depth | `--shadow-1` to `-3`, `--shadow-ring`, `--shadow-focus`, `--glass-blur`, `--glow-accent`, `--card-sheen` | Shadows, frosted glass, the glow |
| Layers | `--z-backdrop` to `--z-top` | What sits above what: sticky, nav, panel, popover, tooltip, modal, toast |
| Motion | `--dur-1` to `--dur-6`, loop durations, `--ease-out`, `-in-out`, `-spring`, `-glide`, `-emphasized` | Every transition and animation, in CSS and in scripts (`durationMs`, `tokenValue`, `usePresence(open, "dur-2")`); all collapse under reduced motion |
| Breakpoints | `--bp-phone` 600, `--bp-tablet` 860, `--bp-laptop` 1080, `--bp-desktop` 1440 | Media queries use the same numbers; `tokens.ts` exports them |

Parity Terminal overrides colour and radius tokens on `.ptm` in the same file, so it keeps amber and square corners.

## The parts

| Group | Parts |
| --- | --- |
| Text and numbers | `Heading`, `Text`, `Label`, `Kbd`, `Money`, `Delta`, `Num` (tabular figures, true minus, sign colour, switches to 1.2M by itself when the full number does not fit), `formatFull`, `formatCompact`, `fmt` (pct, signedPct, num, compact, date) |
| Buttons | `Button` (primary, secondary, ghost, outline, danger; sm, md, lg; loading; icon; as a link; "tertiary" is the older name for ghost), `IconButton` (sm, md, lg; always labelled), `ButtonGroup` |
| Inputs | `Input`, `SearchInput`, `Field` (label, help, error read out), `Select`, `Segmented` (sliding thumb), `RadioGroup`, `Slider`, `Toggle` (switch), `Checkbox`, `Tabs` (sliding underline, arrow keys) |
| Filters and sorting | `FilterBar`, `FilterChip`, `Separator`, `useFilters`, `useSort` |
| Tables | `TableScroll` (the box a wide table scrolls in; joins the tab order as a named region only when the table does not fit), `DataTable` (columns describe sort, alignment, tone and rendering; pinned rows; row links; `expand` rows that open in place; `maxHeight` for a sticky header in its own box; `virtual` for thousands of rows; rows glide on a sort), `ShareBar` |
| Long lists | `VirtualList`, `useVirtual` (draw only the rows on screen, rows may grow) |
| Expand | `Collapse`, `Disclosure`, `Accordion`, `useDisclosure` |
| Layout | `PageHeader`, `Panel` (`glass` for a frosted card), `Grid`, `Stat`, `KeyValues`, `Section`, `Badge` (neutral, accent, good, warning, bad, info, dark), `Status`, `Divider`, `Meter`, `SettingsRow`, `EmptyState` |
| Navigation and identity | `Breadcrumb`, `Pagination`, `Avatar`, `Tag` (removable) |
| Feedback | `ErrorState` (with Retry), `ProgressBar` (known or busy), `Spinner` |
| Loading | `Skeleton`, `SkeletonText`, `SkeletonStat`, `SkeletonChart`, `SkeletonTable`, `SkeletonCard`, `PageSkeleton` |
| Overlays | `Tooltip`, `Popover`, `Menu` (dropdown), `Dialog`, `Drawer`, `Sheet` (bottom drawer), `CommandPalette`, `TourStep` (one step of a product tour), `toast` and `dismissToast` with `Toaster`; doc previews come from any link carrying `data-term`, `data-doc` or `data-ref` |
| Motion | `Animate` (fade, rise, pop, slide), `RollingNumber`, `CountUp`, `AnimatedNumber`, `Stagger` (or the class `STAGGER`), `LIFT` (lift on hover), `Tilt`, `DrawIn`, `Reveal`, `PageTransition`, `RouteTransition`, `Loaded`, `HeroGlow`, `CHART_REVEAL`, `STAGGER_ROWS`, `MotionControl`; hooks `usePresence`, `useFlip`, `useReducedMotion`, `useMotionLevel`; durations `--dur-1` to `--dur-5`. Charts and sparklines draw in by themselves. Tokens and the Motion setting in [REF-0023](0023-motion-system.md). Rules in [DEC-0017](../decisions/0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md) |
| Data | `useResource` (show the last copy at once, refresh it quietly), `preload` |
| Charts | `HeroChart`, `LineChart`, `BarChart`, `FanChart` (spread of outcomes after past events: single paths, middle-half and full-range bands, median), `Sparkline`, `DotGrid`, `sliceRange`, `RANGES` |
| Icons | `Icon` with 47 names, 16px stroke icons drawn for this site |

## Rules

1. **One primary button per view.** It is the only thing in the accent colour. Everything else sits near the surface tone.
2. **Accent is never data.** Charts use the series colours; the accent marks the primary action and selected states.
3. **A change always carries a sign.** The gain and loss colours failed the colour-blind check (see below), so `Delta`, `fmt.signedPct` and table tones always print `+` or a true minus, and an arrow where space allows.
4. **Series colours follow the strategy by name** in the fixed order; the market is always the neutral benchmark line.
5. **One y axis per chart.** Two measures on different scales get two charts.
6. **Status shows the word.** The dot only helps.
7. **Motion explains a change or invites a touch** (arriving, updating, opening, hovering). Entrances stay under 400ms and line draws under a second. The only loop in a view is the faint hero glow. Nothing flashes. Reduced motion keeps short fades and drops all movement, and each app has a Motion setting ([REF-0023](0023-motion-system.md), [DEC-0017](../decisions/0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md)).
8. **Numbers use tabular figures** so columns line up.
9. **Nothing jumps.** Every page stays under 0.02 cumulative layout shift (the browser's score for how much a page moves while it loads, while data arrives, on hover and on scroll). `npm run cls` measures every page at 1440 and 390 pixels wide. See "Keeping pages still" below.
10. **Things open in place and float from where they were opened.** Rows, cards and sections grow from their own top edge; popovers, menus and dialogs come out of their trigger; drawers slide from an edge. All of them animate out as well as in.

## Keeping pages still

What causes a page to jump, and what the library does about each:

| Cause | Fix |
| --- | --- |
| Content arrives and pushes things down | A skeleton the size of the content (`PageSkeleton`, `SkeletonTable` and the rest), never a line of "Loading" text |
| Coming back to a page shows it empty first | `useResource` keeps the last copy and draws it at once |
| Web font swap changes text width | Fallback faces (`Inter Fallback`, `Roboto Mono Fallback` in `tokens.css`) stretched to the web fonts' measurements |
| Scroll bar appears or a dialog hides it | `scrollbar-gutter: stable` on the page, and a dialog's scroll lock keeps the gutter |
| Charts draw at a guessed width then resize | Charts read their width before the first paint and have fixed heights |
| A number or a sort arrow changes width | Tabular figures, `AnimatedNumber` holds its width, sort arrows keep their space |
| Hover makes something bigger | Hover changes colour, shadow and transforms only |
| Animating height or position | Transforms and opacity only; `Collapse` is the one height animation and grows from its own top edge |

## Nothing overlaps or gets cut off

`npm run layout` opens every route of every app at 1280x800, 1440x900, 1920x1080 and 390x844, saves a screenshot of each to `web/layout-shots/` and lists text that collides with other text, text cut off by a box, numbers shortened with "...", controls cut off by a box too narrow for them, and pages that scroll sideways (`web/scripts/lib/layout-check.mjs`). The smoke test in CI runs the same check on every route at all four sizes, so a regression fails the build. Text marked `data-layout-ignore` is skipped. Run the audit against real engine output too (`PARITY_OUTPUT_DIR=../engine/output`): long strategy names and big numbers show problems the small CI fixture does not.

How each kind of problem is fixed:

| Problem | Fix |
| --- | --- |
| A number grows past its cell or tile | `Num` (switches to 1.2M by itself), or `fmt.compact` |
| A table is wider than its card at desktop width | Let long identifiers wrap (`td.wrap.code-cell`), hide low-priority columns in narrow panels (container queries in the Terminal: `c-label`, `c-vol`, `c-m1`, `c-n2`, `c-n3`) |
| A note beside controls is cut on a phone | Let the row wrap (`lb-bar-wrap`) instead of an ellipsis |
| Line-end labels on a chart stack on top of each other | `spreadLabels` in the Academy pictures spaces them a line apart |
| Lightweight Charts axis labels | A 64px minimum price axis width, whole labels only, time labels thinned to fit |
| A negative zero or a hyphen minus | `pct`, `num` and `fmt` print a true minus and never "-0.0%" |
| A long name pushes the last number out of a narrow Terminal panel | Names shorten to 16 characters with "..." in panels under 380px; words may be cut, numbers never |
| A small count in a proportional bar is cut ("Promising 3") | Each part is at least as wide as its label (`flex: 0 0 auto`, grows by its count) and the bar wraps on a phone |

## Using the newer parts

- **Collapse, Disclosure, Accordion.** `<Collapse open={open}>` animates its children open by height with no measuring. Closed content is `inert`. `Disclosure` adds the summary row and chevron; `Accordion single` keeps one open at a time.
- **Popover.** `<Popover label="Range" trigger={(open) => ...}>{(close) => ...}</Popover>`. Anchored to the trigger, follows it on scroll, flips near screen edges, closes on Escape or a click outside, gives focus back.
- **Drawer.** `<Drawer open onClose title side="right">`. Right, left or bottom; side drawers become bottom sheets on phones. Holds the page still and traps focus.
- **Dialog.** Grows out of the button that opened it; focus stays inside; Escape closes.
- **toast.** Returns an id; `dismissToast(id)` closes it early. At most three show at once.
- **DataTable for long lists.** `maxHeight="min(70vh, 640px)" virtual` plus a `width` on each column. Header sticks; only visible rows are drawn; widths are fixed so nothing reflows. `expand={(row) => ...}` opens a row's details in place.
- **VirtualList.** `<VirtualList items rowHeight render getKey />` for long lists that are not tables. Scrolls with the page or inside `scrollRef`.
- **Skeletons.** Pick the variant that matches the final layout. `PageSkeleton parts={["stats", "chart", "table"]}` for a whole page.
- **AnimatedNumber.** `<AnimatedNumber value={n} format={...} />` glides between values and holds its width.
- **Stagger.** Wrap a grid's first paint, or add the `STAGGER` class to an existing list. Children rise in 30ms apart, all within 240ms.
- **useResource.** `const { data, error, loading } = useResource("search", loadSearch)`. Show `PageSkeleton` only while `loading`.
- **usePresence, useFlip.** For your own components: keep something mounted while it animates out (`data-state` is enter, open or exit), and glide reordered children (`data-flip` keys) with transforms.

## How charts work

Every series is a list of `[date, value]` pairs sorted by date. A chart measures its width, keeps the points inside the chosen range, thins long series to about 900 points, maps dates to x by time and values to y between the lowest and highest point, then draws a dotted background, the lines, a soft fill under the main line and a dotted line at the starting value. A transparent layer finds the nearest date under the pointer by binary search and updates the crosshair and the header. The full walk-through is in the gallery under Charts.

## Colour checks

Run on 2026-10-21 with the dataviz palette validator (lightness band, saturation floor, colour-blind separation, normal-vision separation, contrast against the background):

| Palette | Result | Consequence |
| --- | --- | --- |
| Eight series on the dark background (`#0a0a0c`) | Pass | Worst colour-blind pair is series 3 and 4 at 8.4, just above the target of 8 |
| Eight series on the light background (`#ffffff`) | Pass with a warning | Series 3, 4 and 5 fall below 3:1 contrast, so light-mode charts keep labels or a table view |
| Gain and loss green and red on dark | Fail | Difference of 1.5 for red-green colour blindness, hence rule 3 |

Text contrast against the dark background, measured in the gallery: primary 18.2:1, labels 8.7:1, meta 5.3:1 (raised from 4.3:1 so it passes the 4.5:1 minimum), links 7.9:1.

## Accessibility (WCAG 2.2 AA)

Every part meets WCAG 2.2 AA ([DEC-0061](../decisions/0061-every-part-meets-wcag-2-2-aa-and-ci-fails-on-overlap-or-clipped-numbers.md)). Three checks keep it that way, all in CI:

| Check | What it proves | Where |
| --- | --- | --- |
| Contrast test | Every text colour is at least 4.5:1 and every control colour and the focus ring at least 3:1 on every surface, including frosted glass over the brightest point of the red glow, a selected row, the red badge and the Terminal's panels | `web/tests/contrast.test.ts` |
| axe on every route | Names, roles and states, 24px targets, links told apart by more than colour, tables that scroll by keyboard, no sideways scroll, at 1280 and 390 wide | `npm run a11y` |
| Keyboard walk and motion | Tab reaches every control on `#/ui` and each shows a ring at least 2px wide, none off screen; with reduced motion on, nothing keeps animating on the app homes | `npm run a11y` |

What each part does:

| Need | How the library meets it |
| --- | --- |
| Visible focus | `web/src/a11y.css` draws a 2px ring in `--color-focus` on every focused control, over any component rule. Library checkboxes and radios ring their drawn box. |
| 24px targets | `Button` `xs` and `IconButton` `xs` are 24px, icon buttons never shrink in a row, row and list buttons are at least 24px tall |
| Edges of controls | Fields, selects, checkboxes, radios, switches and slider tracks use `--color-border-control` (3:1 on every surface); hover lightens it, focus turns it white |
| Names, roles, states | Icon buttons need a `label`; toggle buttons carry `aria-pressed`, switches `aria-checked`, tabs `aria-selected`, sortable headers `aria-sort`, rows that open `aria-expanded`. A button's spoken name starts with the words on it. |
| Keyboard | Tabs and segmented controls move with the arrow keys, dialogs and drawers trap focus and close on Escape, popovers give focus back, a table that scrolls is focusable (`TableScroll`) |
| Links in text | Underlined inside sentences, table cells and notes |
| Reduced motion | Duration tokens collapse to 1ms, loops stop, `usePresence` and `useFlip` skip their animation |

## Adding a part

1. Build it in `web/src/ui/`, reading only tokens. `npm run lint:styles` fails on anything else. Give it a visible focus state, a name, a 24px target and keyboard control.
2. Export it from `web/src/ui/index.ts`.
3. Add it to the gallery with a live demo, a usage snippet and its rules. The keyboard walk in `npm run a11y` then checks it.
4. Use it on a page instead of hand-written markup.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0013: Dashboard clarity, plain names, verdicts and search that answers](../decisions/0013-dashboard-clarity-plain-names-verdicts-and-search-that-answers.md)
- [DEC-0017: Motion on the site, 3D on the front page and quiet movement in the app](../decisions/0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md)
- [DEC-0030: Pages that hold still, open in place and come from one library](../decisions/0030-pages-that-hold-still-open-in-place-and-come-from-one-library.md)
- [DEC-0058: One token file for every app and a lint that blocks raw values](../decisions/0058-one-token-file-for-every-app-and-a-lint-that-blocks-raw-values.md)
- [DEC-0061: Every part meets WCAG 2.2 AA and CI fails on overlap or clipped numbers](../decisions/0061-every-part-meets-wcag-2-2-aa-and-ci-fails-on-overlap-or-clipped-numbers.md)
- [REF-0023: Motion system](0023-motion-system.md)
- [REF-0026: Accessibility audit, WCAG 2.2 AA](0026-accessibility-audit-wcag-2-2-aa.md)
- [LOG-0005: Ayan work log, site rebuild, research expansion and sign-in](../log/2026-10-21-ayan-work-log-site-rebuild-research-expansion-and-sign-in.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
