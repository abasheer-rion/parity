---
id: DEC-0017
title: Motion on the site, 3D on the front page and quiet movement in the app
type: decision
status: accepted
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [ui]
related: [DEC-0011, DEC-0015, REF-0009]
---

# Motion on the site, 3D on the front page and quiet movement in the app

## In plain words

The owner asked for a site that moves like Public and QuantPad: things to touch, 3D, small looping animations and scroll effects. Now:

- **The front page** has a turning 3D globe of markets around the Parity starburst, numbers that count up, a looping preview of the app, a story that follows your scroll, and a section in the light blue gradient the team likes.
- **The app** has cards that lift, strategy cards that lean toward the pointer, charts that draw in, pages that ease in, and a faint moving glow behind the first block of each home page.

Everything stays still for people who ask their device for less motion. Nothing flashes. The front page still paints at once, because the 3D part loads only after the page is on screen.

## Context

The front page was plain HTML with no script, and the app's motion was limited to short entrances and rolling numbers ([REF-0009](../reference/0009-ui-library.md) rule 7: "never loops for decoration"). The owner wants the site to feel alive, like Public and QuantPad, without losing speed or honesty.

## Decision

### The front page (`web/index.html`)

1. **It must work and read with no script.** CSS is inline. One small module script (`web/src/site/main.ts`, about 7 kB compressed, Lenis included) adds the motion.
2. **3D loads last.** three.js (MIT) loads after the page has finished loading and the browser is idle (`web/src/site/hero3d.ts`, about 133 kB compressed). It does not load at all when:
   - the visitor asks for reduced motion;
   - the browser has no WebGL;
   - the visitor has turned on data saving.
3. **A still picture first.** The same globe is drawn as an SVG at build time (`web/plugins/site.ts`), from the same points (`web/src/site/nodes.ts`). It shows until the 3D scene is ready, then fades out. People who get no 3D keep the picture.
4. **The 3D scene stops** when it is off screen or the tab is hidden. It leans at most about 15 degrees toward the pointer, and ignores touch.
5. **Counters are real.**
   - "Ideas in the library" and "official runs sealed" are counted from the repo at build time.
   - "Strategies tested" and "variations searched" come from `/stats.json`, written at deploy by `scripts/export_site_data.py`. It holds counts only.
   - Until it loads, or if it is missing, the page shows "100+" and "Thousands", labelled "Rounded".
6. **The app preview** is HTML and CSS, not a GIF or video. It loops every 12 seconds, only while on screen, and is labelled "Example data". Its strategy names and numbers come from a real run.
7. **The scroll story** swaps its picture as each step reaches the middle of the screen. With reduced motion it swaps without movement.
8. **No layout shift.** Reveals move with transform and opacity only. The 3D box has a fixed shape. Counters reserve their final width.

### The app (the UI library, `web/src/ui/motion.tsx`)

| Part | What it does | Where |
| --- | --- | --- |
| `LIFT` | A card rises 3px with a shadow on hover | Home cards, theme tiles, the steps on How Parity works |
| `Tilt` | A card leans up to 6 degrees toward the pointer, with a soft light | Top strategy cards on the product home, the two sides on How Parity works |
| Draw-in | Chart lines draw left to right once, under a second | Every library chart and sparkline; `DrawIn` for hand-made SVG |
| `Reveal` | Fades and rises the first time it scrolls into view | Cards below the fold |
| `PageTransition` | The page eases up 8px as it opens | Product home, research home, How Parity works |
| `HeroGlow` | A slow, faint wash of the brand blues | Behind the first block of those pages |

### The rules

1. **Motion explains or invites.** It shows something arriving or changing, or that something can be touched.
2. **One loop per view in the app**: the hero glow, a drift of about a minute. The small flow line on How Parity works shows the direction results travel. The front page may loop more, always slowly.
3. **Nothing flashes.** No blinking, no strobing, no colour jumps.
4. **Reduced motion means still.** Every part checks it. The CSS also caps every animation for those visitors.
5. **Text keeps its contrast.** Glows sit behind text, never on top. Gradient sections use dark text (`#0d1530` on the light blue).
6. **Hover effects need a mouse.** Tilt is off on touch screens.
7. **No new layout shift.** Only transform and opacity move.

## Alternatives considered

- **A screen-recorded GIF or video of the app.** Rejected. A GIF of this size is several megabytes, and a video still costs more than the HTML mock, which is sharp at any size.
- **A motion library such as Framer Motion.** Not needed. CSS and a few small hooks cover every case, at no extra weight in the app.
- **Raw WebGL instead of three.js.** Smaller, but harder to keep up. three.js loads last, so its size does not slow the first paint.

## Consequences

- REF-0009 rule 7 now points here: one quiet loop is allowed per view.
- The front page is about 18 kB compressed HTML plus 7 kB of script before the 3D part.
- On a throttled mobile test it painted in under 0.3 seconds with no layout shift.
- The deploy writes a public `stats.json` with two counts.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0021: Dark only, no top bar, computed findings and a large scale sim](0021-dark-only-no-top-bar-computed-findings-and-a-large-scale-sim.md)
- [DEC-0028: Parity Academy, short courses with moving pictures](0028-parity-academy-short-courses-with-moving-pictures.md)
- [DEC-0030: Pages that hold still, open in place and come from one library](0030-pages-that-hold-still-open-in-place-and-come-from-one-library.md)
- [REF-0009: UI library](../reference/0009-ui-library.md)
<!-- backlinks:end -->
