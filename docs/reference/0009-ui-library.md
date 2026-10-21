---
id: REF-0009
title: UI library
type: reference
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [docs, ui]
related: [DEC-0011, REF-0001]
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
| Inputs | `Input`, `SearchInput`, `Select`, `Segmented`, `Toggle`, `Checkbox`, `Tabs` |
| Filters and sorting | `FilterBar`, `FilterChip`, `Separator`, `useFilters`, `useSort` |
| Tables | `DataTable` (columns describe sort, alignment, tone and rendering; pinned rows; row links), `ShareBar` |
| Layout | `PageHeader`, `Panel`, `Grid`, `Stat`, `KeyValues`, `Section`, `Badge`, `Status`, `Divider`, `Meter`, `SettingsRow`, `EmptyState`, `Skeleton` |
| Overlays | `Tooltip`, `Menu`, `Dialog`, `toast` with `Toaster`; doc previews come from any link carrying `data-term`, `data-doc` or `data-ref` |
| Motion | `Animate` (fade, rise, pop, slide), `RollingNumber`, `CountUp`; durations `--dur-1` to `--dur-4` |
| Charts | `HeroChart`, `LineChart`, `BarChart`, `FanChart` (spread of outcomes after past events: single paths, middle-half and full-range bands, median), `Sparkline`, `DotGrid`, `sliceRange`, `RANGES` |
| Icons | `Icon` with 47 names, 16px stroke icons drawn for this site |

## Rules

1. **One primary button per view.** It is the only thing in the accent colour. Everything else sits near the surface tone.
2. **Accent is never data.** Charts use the series colours; the accent marks the primary action and selected states.
3. **A change always carries a sign.** The gain and loss colours failed the colour-blind check (see below), so `Delta`, `fmt.signedPct` and table tones always print `+` or a true minus, and an arrow where space allows.
4. **Series colours follow the strategy by name** in the fixed order; the market is always the neutral benchmark line.
5. **One y axis per chart.** Two measures on different scales get two charts.
6. **Status shows the word.** The dot only helps.
7. **Motion explains a change** (arriving, updating, opening), stays under 400ms, never loops for decoration, and switches off for people who ask for reduced motion.
8. **Numbers use tabular figures** so columns line up.

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

Nothing links here yet.
<!-- backlinks:end -->
