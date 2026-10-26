---
id: REF-0023
title: Motion system
type: reference
status: current
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [ui]
related: [REF-0009, DEC-0017]
---

# Motion system

## In plain words

How things move in every Parity app: pages fade in and rise a little when they open, lists and cards come in one after another, numbers tick to their new value, charts draw in from left to right, and dialogs, drawers, menus and toasts slide or grow open. Everything uses the same timings. If a device asks for less motion, things still fade but nothing moves. A Motion setting in each app lets a person choose Match my device, Full or Reduced.

## Summary

One set of motion tokens in `web/src/ui/tokens.css`, the one token file for every app (DEC-0058), a few shared classes in `web/src/ui/ui.css` and `web/src/ui/motion.css`, and small React helpers in `web/src/ui/motion.tsx`. Only `transform` and `opacity` animate (plus a chart's clip and a line's dash as it draws in), so nothing shifts the layout. CSS does the work; JavaScript runs only for number tickers, one animation frame at a time.

The timings follow the patterns of a reference dashboard: short fades for small things, a gentle rise for pages and lists, a slightly springy curve for toasts and small pop-ups, and a smooth decelerating curve for drawers.

## Tokens

| Token | Value | Used for |
| --- | --- | --- |
| `--dur-1` | 100ms | Hover, press |
| `--dur-2` | 160ms | Small things opening, fades out |
| `--dur-3` | 250ms | Pages, list items, panels |
| `--dur-4` | 350ms | Drawers, toasts |
| `--dur-5` | 600ms | Reveals on scroll, charts drawing in |
| `--dur-6` | 900ms | Lines drawing in |
| `--dur-count` | 700ms | Numbers ticking to a new value |
| `--ease-out` | `cubic-bezier(0, 0, .2, 1)` | Most entrances |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | Exits |
| `--ease-spring` | `cubic-bezier(.2, .9, .25, 1)` | Dialogs, indicators |
| `--ease-pop` | `cubic-bezier(.34, 1.56, .64, 1)` | Toasts (a small overshoot) |
| `--ease-glide` | `cubic-bezier(.2, .8, .2, 1)` | Drawers and sheets |
| `--stagger-step` | 40ms | Gap between list items |
| `--stagger-max` | 320ms | Latest start for any list item |
| `--rise-sm`, `--rise`, `--rise-lg` | 4px, 8px, 16px | Route change, page or list item, reveal on scroll |
| `--lift` | 2px | Card hover lift |
| `--press` | .985 | Scale on press |
| `--m` | 1 or 0 | Movement: 0 when motion is reduced |

## Pieces

| Piece | What it does |
| --- | --- |
| `RouteTransition`, class `ui-route` | A view fades in and rises 4px when the route changes. |
| class `ui-route-kids` | On a container: whichever view mounts inside it eases in (Trade, Workbench, Academy, Terminal panels). |
| `Stagger`, `STAGGER`, `Grid` | Children come in one after another, 40ms apart. Every `Grid` does this. |
| `STAGGER_ROWS` | A table's first 12 rows come in one after another (Trade, Workbench, Terminal and library tables). |
| `AnimatedNumber`, `CountUp` | A number ticker with tabular figures and a held width, so the text beside it never moves. |
| `Skeleton*`, `Loaded`, class `ui-fade-in` | A soft band sweeps across skeletons; content fades in over the same space. |
| `LIFT` | A card rises 2px and gains a shadow on hover, and presses in slightly. |
| `DrawIn`, class `ui-draw` | SVG lines draw from start to end. Library charts and Terminal charts do this on first show. |
| `CHART_REVEAL` | Canvas charts (lightweight-charts) reveal left to right with a clip and a fade, once, when data first arrives. `ProChart` does this itself. |
| `Dialog`, `Drawer`, `Popover`, `Menu`, `Tooltip` | Open and close with a fade plus a small scale, rise or slide; they stay mounted until the exit has played. |
| `toast` | Rises in with a small spring, sinks out. |

## Reduced motion

Reduced motion reduces; it does not remove. When the device asks for less motion, or the person chooses Reduced, `--m` is 0. Every distance and scale in the shared classes is multiplied by `--m`, so the same animations play as fades and crossfades with no movement. Number tickers jump to the new value. Lines and charts fade in instead of drawing. Everything else on the page (each app's own animations) is cut to an instant (`--dur-instant`) as before; add the class `ui-mo` to an element whose CSS is written with `--m` to keep it.

## The Motion setting

Each app's settings page has a Motion control: Match my device (the default), Full and Reduced. Parity Terminal has it at the end of HELP. The choice is kept in this browser under `parity.motion` and written to `<html data-motion>`, which the CSS reads to override the device. Full plays every animation even when the device asks for less. The front page follows the same choice. Code is in `web/src/ui/motionCore.ts` (no React), `web/src/ui/motionPref.ts` (hooks) and `web/src/ui/motionSetting.tsx` (the control).

## Rules

1. Animate `transform` and `opacity` only. No width, height, top or margin animation.
2. Entrances finish within 600ms, including stagger. No loops in a view except the hero glow and loading indicators.
3. Use the tokens; do not write new durations or curves.
4. Write distances as `calc(<distance> * var(--m))` so reduced motion keeps the fade.
5. Layout shift stays under 0.02 on every page (`npm run cls`).

## Related

- [REF-0009: UI library](0009-ui-library.md)
- [DEC-0017: Motion on the site, 3D on the front page and quiet movement in the app](../decisions/0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md)

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0009: UI library](0009-ui-library.md)
<!-- backlinks:end -->
