---
id: REF-0009
title: UI library
type: reference
status: current
created: 2026-10-21
updated: 2026-10-23
authors: [ayan]
tags: [docs, ui]
related: [DEC-0011, DEC-0017, REF-0001]
---

# UI library

## In plain words

The dashboard is built from one box of parts: buttons, text, cards, tables, filters, charts, colours and animations. Every page takes its parts from that box, so a change in one place changes the whole site, and nothing drifts. You can see every part working in the dashboard under Research, then UI library (`#/ui`).

## Summary

| What | Where | Notes |
| --- | --- | --- |
| Tokens (colour, type, space, radius, shadow, motion) | `web/src/ui/tokens.css` | The only place values are set. Dark is the default; light is chosen in Settings. |
| Component styles | `web/src/ui/ui.css` | Reads tokens only. |
| Components | `web/src/ui/*.tsx`, imported from `web/src/ui` | Pages import from `../ui`, never from a single file. |
| Live gallery | `web/src/pages/UILibrary.tsx`, route `#/ui` | Every part, live, with usage and rules. Chart demos use sample data, labelled so. |
| Decision | [DEC-0011](../decisions/0011-read-the-docs-inside-the-dashboard-with-stacked-previews.md) | Why the layout copies Mercury and the charts merge Mercury and Robinhood. |

## The parts

| Group | Parts |
| --- | --- |
| Text and numbers | `Heading`, `Text`, `Label`, `Kbd`, `Money`, `Delta`, `fmt` (pct, signedPct, num, compact, date) |
| Buttons | `Button` (primary, secondary, tertiary, outline, danger; sm, md, lg; loading; as a link), `IconButton`, `ButtonGroup` |
| Inputs | `Input`, `SearchInput`, `Select`, `Segmented` (sliding thumb), `Toggle`, `Checkbox`, `Tabs` (sliding underline, arrow keys) |
| Filters and sorting | `FilterBar`, `FilterChip`, `Separator`, `useFilters`, `useSort` |
| Tables | `DataTable` (columns describe sort, alignment, tone and rendering; pinned rows; row links; `expand` rows that open in place; `maxHeight` for a sticky header in its own box; `virtual` for thousands of rows; rows glide on a sort), `ShareBar` |
| Long lists | `VirtualList`, `useVirtual` (draw only the rows on screen, rows may grow) |
| Expand | `Collapse`, `Disclosure`, `Accordion`, `useDisclosure` |
| Layout | `PageHeader`, `Panel`, `Grid`, `Stat`, `KeyValues`, `Section`, `Badge`, `Status`, `Divider`, `Meter`, `SettingsRow`, `EmptyState` |
| Loading | `Skeleton`, `SkeletonText`, `SkeletonStat`, `SkeletonChart`, `SkeletonTable`, `SkeletonCard`, `PageSkeleton` |
| Overlays | `Tooltip`, `Popover`, `Menu`, `Dialog`, `Drawer`, `toast` and `dismissToast` with `Toaster`; doc previews come from any link carrying `data-term`, `data-doc` or `data-ref` |
| Motion | `Animate` (fade, rise, pop, slide), `RollingNumber`, `CountUp`, `AnimatedNumber`, `Stagger` (or the class `STAGGER`), `LIFT` (lift on hover), `Tilt`, `DrawIn`, `Reveal`, `PageTransition`, `HeroGlow`; hooks `usePresence`, `useFlip`, `useReducedMotion`; durations `--dur-1` to `--dur-4`. Charts and sparklines draw in by themselves. Rules in [DEC-0017](../decisions/0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md) |
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
7. **Motion explains a change or invites a touch** (arriving, updating, opening, hovering). Entrances stay under 400ms and line draws under a second. The only loop in a view is the faint hero glow. Nothing flashes, and everything holds still for people who ask for reduced motion ([DEC-0017](../decisions/0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md)).
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

## Adding a part

1. Build it in `web/src/ui/`, reading only tokens.
2. Export it from `web/src/ui/index.ts`.
3. Add it to the gallery with a live demo, a usage snippet and its rules.
4. Use it on a page instead of hand-written markup.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0013: Dashboard clarity, plain names, verdicts and search that answers](../decisions/0013-dashboard-clarity-plain-names-verdicts-and-search-that-answers.md)
- [DEC-0017: Motion on the site, 3D on the front page and quiet movement in the app](../decisions/0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md)
- [LOG-0005: Ayan work log, site rebuild, research expansion and sign-in](../log/2026-10-21-ayan-work-log-site-rebuild-research-expansion-and-sign-in.md)
<!-- backlinks:end -->
