---
id: DEC-0028
title: Parity Academy, short courses with moving pictures
type: decision
status: accepted
created: 2026-10-23
updated: 2026-10-26
authors: [ayan]
tags: [ui]
related: [DEC-0015, DEC-0017, DEC-0021, DEC-0023, DEC-0027, GDE-0007]
---

# Parity Academy, short courses with moving pictures

## In plain words

The owner asked to "fully deck out research, make it usable, even mini courses explaining things with AI visuals, in motion perhaps". Parity now has an **Academy**:

- **8 short courses, 40 lessons.** Reading a backtest, luck vs skill, how markets move, currencies, rates and yield curves, crypto and perps, private markets basics, and reading news impact.
- **Each lesson takes two or three minutes.** It has a few plain paragraphs, one picture that moves step by step, a link to the real page in Parity and a quick check of two or three questions with feedback.
- **The pictures are drawn by code**, not video. A curve twists, paths fan out, a drawdown fills. You press Next, use the arrow keys, or let it play once. People who ask for less motion get still frames.
- **It lives in the product app** at `/app/#/academy`, in the menu, on Start here, on the research home and in the Edge Lab. (Since [DEC-0042](0042-parity-academy-a-full-screen-course-player-of-its-own.md) it is its own app, Parity Academy, at `/academy/`.)
- **Every lesson also has a public page** at `/learn/academy/`, with the text, a still of the picture and the quick check, so search engines can read it.
- **Progress stays in your browser.** Nothing is sent anywhere. (Since DEC-0042 progress is saved to the account.)

It teaches. It never says what to buy or sell.

## Context

The research side has the docs, the glossary and the Edge Lab ([DEC-0027](0027-new-edge-families-from-the-wider-data.md)), but they are reference material. A newcomer has no path through them, and the hardest ideas (luck from many tries, smoothing, a yield curve changing shape) are much easier to see than to read.

The owner mentioned AI visuals. Generated video costs money, cannot be checked against our docs line by line, and goes stale when a number changes. Pictures drawn by code from the same numbers as the text can be checked by a test and cost nothing.

## Decision

1. **Courses are data.** Each course is one JSON file in `academy/courses/` at the repo root (added to the allowed top-level folders). The app and the public pages read the same files. [GDE-0007](../guides/0007-writing-a-new-academy-course.md) explains how to add one.
2. **Pictures are a short list of kinds** in `web/src/academy/scenes.ts`: growth, paths, drawdown, costs, the best of many tries, the gauntlet, a yield curve, bars, lines, an event study, leverage, a fund's cash flows, a currency seesaw and a trend rule. A lesson picks a kind, gives it settings and lists its steps. Each kind is a pure function of the settings and a position between steps, so the same code:
   - animates in the app, easing from one step to the next in 0.7 seconds;
   - draws the still frames for the public pages at build time (`web/scripts/academy-frames.ts`, run by `scripts/seo/build_public.py` with Node 22.6 or later). Without Node the public pages still build, with the step captions and no picture.
3. **Motion follows [DEC-0017](0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md).** The picture explains a change, plays through once when it first scrolls into view, can be paused, and stops at the last step. It never loops. With reduced motion it never plays on its own and each step is a still frame. "All steps" shows every frame side by side with its caption.
4. **Accessibility.** Every picture has alt text and a caption per step, read out as it changes. Back, Next, Play and All steps are buttons, and the arrow keys, Home and End move between steps. The quick check uses normal radio buttons in fieldsets.
5. **It belongs to the product side** ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)): the route `academy` is a product route, and the research menu links across to it. Lessons link to pages on either side.
6. **Claims match the repo.** Words link to the glossary, numbers come from the glossary, the gauntlet ([REF-0006](../reference/0006-the-gauntlet.md)), the KPIs ([REF-0002](../reference/0002-kpis.md)) and the impact engine ([DEC-0026](0026-a-news-archive-and-an-impact-engine-that-ranks-by-evidence.md)). Pictures with invented numbers say so. `web/tests/academy.test.ts` checks that every word, doc and page a lesson points at exists, that every picture draws at every step, that each lesson has 2 or 3 questions with a reason each, and the plain-writing rules.
7. **Progress** is a small record in `localStorage` (`parity.academy.v1`), read and written inside try and catch, so a private window still works. Clearing it is one button.
8. **Public pages** ([DEC-0023](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)): `/learn/academy/`, one page per course and one per lesson, in the sitemap, marked up as a Course and its lessons. The quick check shows its answers behind "Show the answer".

## Alternatives considered

- **Generated or recorded video.** Rejected for now: it costs money, cannot be tested against the docs and goes stale.
- **A slide or animation library.** Not needed. The pictures are small SVG drawn by plain functions, and React only swaps the frame.
- **Markdown course files.** JSON was chosen because a lesson is mostly structured parts (picture settings, steps, questions) with short text.

## Consequences

- The private markets course is kept short on purpose. A deeper private markets section is being written separately and can link into it later.
- Adding a picture kind means adding a function to `scenes.ts`. Adding a course needs no code.
- The public build calls Node once to draw about 120 frames, which takes under a second.
- Update 2026-10-26: lessons can now use the signature chart system ([DEC-0067](0067-one-signature-chart-system-for-lessons-strategy-pages-and-clips.md)). "Reading a backtest" moved all five lessons, and "Luck vs skill" moved three to the `distribution` scene. The app plays them with the signature player, and the public lesson pages show the last step with the table of numbers behind it.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0035: Bot Battle and shareable clips: win rate is not profit](0035-bot-battle-and-shareable-clips-win-rate-is-not-profit.md)
- [DEC-0042: Parity Academy, a full-screen course player of its own](0042-parity-academy-a-full-screen-course-player-of-its-own.md)
- [DEC-0067: One signature chart system for lessons, strategy pages and clips](0067-one-signature-chart-system-for-lessons-strategy-pages-and-clips.md)
- [GDE-0007: Writing a new Academy course](../guides/0007-writing-a-new-academy-course.md)
<!-- backlinks:end -->
