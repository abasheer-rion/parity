---
id: DEC-0067
title: One signature chart system for lessons, strategy pages and clips
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [process, ui]
related: [DEC-0017, DEC-0028, DEC-0042, DEC-0058, DEC-0061, REF-0017, REF-0023]
---

# One signature chart system for lessons, strategy pages and clips

## In plain words

The owner asked for charts with "our own signature": animated explainers that teach one thing per step, in the style of short finance videos, built on our own look rather than copied. This decision adds one chart system that the Academy, the "how it holds up" sections and the 9:16 and 1:1 clips all draw with.

- **Seven scenes.** A line that draws in with a dot and its value riding the tip (`equity`), two charts side by side (`split`), how far below its last high an account sat (`underwater`), where one result sits in a pile of others with a 95% range (`distribution`), rolling correlation as a strip of cells (`heatmap`), wins and losses by kind of market (`regimes`) and the numbers with a verdict (`scorecard`).
- **Steps.** Each picture is a list of steps with a caption. Next and Back, the arrow keys, a slider, and one play-through when it first scrolls into view. Between steps the camera eases to fit what is drawn, so every step fills the chart.
- **Reduced motion means still frames that fill the chart.** Nothing plays on its own and the slider moves a whole step at a time.
- **Every picture carries its numbers.** "Show the numbers" opens a table built from the same data, and the picture has a full text description.

## Context

The Academy pictures ([DEC-0028](0028-parity-academy-short-courses-with-moving-pictures.md)) drew each lesson on a fixed 480 by 270 axis. A step that showed the first 12% of a 30-year line left most of the box empty. With reduced motion the player stays on that first step, so people who turn motion off saw a small line in an empty chart. Strategy pages and Verify had no animated charts at all, and the clip renderer drew its own pictures.

## Decision

1. **One package, `web/src/ui/signature/`.** `renderSignature(visual, s, { size, theme })` returns SVG markup for one frame. It is a pure function, loads in Node with `--experimental-strip-types`, and is the only drawing code. The player, build scripts and the clip renderer all call it.
2. **A visual is data.** `{ kind, alt, params, steps }`, the same shape as an Academy picture. A step setting carries forward until a later step changes it, and number settings ease between steps. Position `s` from -1 to 0 draws the first step in from empty; whole numbers are the finished steps.
3. **The camera fits what is drawn.** Each step's view is fitted to the data visible at that step, and moves between steps ease from one fit to the next. A zoom belongs to its own step. A line tip never leaves the plot.
4. **The look.** Near-black background on clips, faint grid lines with their values on them, one large number top left that ticks with the line, value pills at the line tips, a dashed par line for zero or the benchmark. Colour is semantic only: gains green, losses red, one accent for the thing being taught, a second hue (violet) for the other side of a two-sided scale, everything else grey. Every value comes from `tokens.gen.ts` ([DEC-0058](0058-one-token-file-for-every-app-and-a-lint-that-blocks-raw-values.md)), with a light theme for light pages.
5. **Four sizes.** `lesson` (480 by 270), `compact` (360 by 300, phones), `square` (1080 by 1080) and `vertical` (1080 by 1920). Clip sizes add the background, a small brand line and the burned-in caption. On 9:16 the verdict gets a band of its own between the chart and the caption.
6. **The player keeps its shape.** The stage is 16:9, or 6:5 below 480 pixels wide, set in CSS from the first paint with a container query. The player picks the drawing size at the same breakpoint before the first paint, so nothing moves.
7. **Motion follows [DEC-0017](0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md) and [REF-0023](../reference/0023-motion-system.md).** Moves take `dur-6`. It plays once when half on screen, waits while the tab is hidden, and stops at the end. Reduced motion shows whole steps only.
8. **Accessibility ([DEC-0061](0061-every-part-meets-wcag-2-2-aa-and-ci-fails-on-overlap-or-clipped-numbers.md)).** The stage is an image with the visual's description. The current caption is announced. The slider has a text value ("Step 2 of 4"). The controls work from the keyboard. `signatureTable(visual)` builds the table behind every picture, and the player shows it on request.
9. **Copy** follows [REF-0017](../reference/0017-parity-copy-rules.md).
10. **"How it holds up" on every strategy page, under Verify and in Workbench Compare.** One section, `web/src/components/holdup/`, asks seven things of a record's daily returns: did it beat the market, could it be luck after every try (deflated Sharpe and p-values corrected by Bonferroni, Sidak and Holm), how wide are the error bars (block bootstrap of return and Sharpe), what does it move with (one-year rolling correlation to stocks and bonds), where does it win and lose (rates rising or falling, calm or volatile markets, named crises, decades), how bad did it get (the five deepest falls, the worst year and 12 months) and what has to stay true. Each block has a sentence built from its numbers, a signature picture and a data table. The numbers come from `engine/src/parity/metrics/holdup.py` on research runs. Verify builds the same shape in the browser from an upload's daily returns with `web/src/lib/holdup.ts`, a port the test `web/tests/holdup.test.ts` checks against the Python on a fixture (`scripts/holdup_fixture.py`); only the bootstrap differs, because the two languages use different random generators. A missing input (no benchmark, no rate series, an upload) is named with its reason, never filled in. Workbench Compare adds a "How they hold up" table of every strategy with the full section for the one picked.

## Alternatives considered

- **A charting library (D3, Recharts, lightweight-charts).** Rejected for this use. The same frame must be drawn in Node for clips and public pages, step by step, without a DOM. Our charts are a few hundred lines of SVG strings.
- **Video files for the explainers.** Rejected. A video cannot show a strategy's own numbers, cannot be read by a screen reader, and weighs far more than SVG.
- **Copying the reference creator's graphics.** Rejected. We took the teaching method (one idea per step, the number on screen, the test before the verdict) and built our own look on our tokens.

## Consequences

- Strategy pages, Verify and Workbench show the "how it holds up" numbers as step-by-step pictures with tables. Runs published before the engine computed them say so in place of the section. A public Verify badge does not keep these numbers.
- The Academy courses can move to the new scenes lesson by lesson. The old `academy/scenes.ts` stays until every lesson has moved.
- The clip renderer can draw the same scenes at 9:16 and 1:1.
- `web/tests/signature.test.tsx` draws every scene at every step, between steps, at every size and in both themes, and checks the tables and the player.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
