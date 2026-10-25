---
id: DEC-0042
title: Parity Academy, a full-screen course player of its own
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [process, ui]
related: [DEC-0028, DEC-0040, DEC-0041, DEC-0039, DEC-0038, DEC-0015, REF-0017, GDE-0007]
---

# Parity Academy, a full-screen course player of its own

## In plain words

The Academy used to be one page inside the product app. It is now its own app that fills the screen, the way Parity Trade does. It has a course library, a page for each course and a lesson player: the lessons of the course down the side, the lesson in the middle, and Previous and Next along the bottom. The arrow keys move between lessons. Each lesson still has its words, its moving picture, its links into Parity and its quick check. Progress is now saved to your account, so it follows you between devices, and the library opens on the lesson you were last on. It lives at academy.endyland.com and at /academy/, behind the same sign-in. The public lesson pages under /learn/academy/ stay and link into it.

## Context

The owner asked for it on 24 October 2026, after Parity Trade became its own app ([DEC-0040](0040-parity-trade-a-full-screen-trading-app-of-its-own.md)): Parity Academy "as a course player", at `/academy/`, with a course library, a focused full-screen lesson player with a progress rail, next and previous, arrow keys, quizzes, progress across courses and resume saved per account or per viewer. DEC-0040 had already recommended this: courses are read and played, not browsed beside other pages.

The courses, the pictures and the quick checks already existed ([DEC-0028](0028-parity-academy-short-courses-with-moving-pictures.md)): 10 courses and 50 lessons in `academy/courses/*.json`, drawn by `src/academy/scenes.ts` and played by `src/academy/Visual.tsx`. Progress was kept in the browser only.

## Decision

1. **A separate entry and build.** `web/academy/index.html`, marked `<html data-space="academy">`, loads `src/academy/main.tsx` and nothing from the product or research app. `vite build --mode academy` writes it to `/academy/` with its files under `/academy/assets/`, the same shape as Trade, so a native wrapper can add it as one more entry.
2. **Addresses.** `/academy/` on parity.endyland.com and `academy.endyland.com`, which the owner approved and set up as a Pages custom domain on 24 October 2026. The Pages middleware serves `/academy/` at the subdomain's front page, keeps the sign-in pages and assets public there, and sends the other apps back to the main address. `academyUrl()` in `src/lib/space.ts` points at the subdomain on endyland.com and at `/academy/` elsewhere; one constant, `ACADEMY_SUBDOMAIN`, switches it back to the path. Supabase's redirect list already allows every endyland.com subdomain, and the session cookie is shared across endyland.com, so nothing changed in sign-in.
3. **The app.** A slim left rail (Library, Continue, Progress, Settings), a top bar with Back, the course name and a count of lessons done.
   - **Library.** A Continue panel with the last lesson opened (or the first lesson), totals (lessons done, courses finished, length of all courses) and every course as a card with its picture, level, length, progress bar and Start, Continue or Review. A level filter.
   - **Course page.** The course's picture, summary, progress and a start button, then its lessons with done marks, scores and the one last opened.
   - **Lesson player.** The course's lessons in a rail on the left (L hides it; a drawer on phones), the lesson in the middle with the words beside a larger picture, glossary words that open their short meaning in place, the links into Parity (each opens in a new tab, in whichever app now holds that page), the quick check, and a pager at the bottom with Previous, a dot per lesson and Next. Left and right arrows change lesson; on the picture they change its step, as before.
   - **Progress.** Per course: lessons done, a bar, quick check answers right, last opened, and a button to continue. Clearing progress asks first.
   - **Settings.** Whether pictures play once on their own, text size, the keys, clearing progress, and links to the public course pages, the glossary and the legal pages.
4. **Progress in the account.** A new table, `academy_progress`, holds one row per person, course and lesson: the best quick check score, when it was finished and when it was last opened. The newest `opened_at` is where Continue goes. Row level security lets each person read and write only their own rows; course and lesson ids must look like ids; scores are small and never above the question count. Progress from the old in-app Academy (browser storage) is copied into the account the first time the account has none, then removed from the browser. The local preview keeps the rows in the browser, as the Trade tables do.
5. **The look.** The front page's style ([DEC-0039](0039-a-front-page-for-verify-dark-glass-and-scroll-scenes.md)): frosted glass panels over slow red orbs, white primary buttons, red for progress. Dark only. Every region has its size before progress loads; the layout shift audit includes the Academy pages and reads 0.000.
6. **Teaching copy stays.** It is a learning product, so lessons keep their explanations ([REF-0017](../reference/0017-parity-copy-rules.md) rule 13). The frame around them is terse. One line at the bottom carries the disclaimer.
7. **One home for courses.** The product app's sidebar Academy item and the research app's Academy link open Parity Academy in a new tab. Old links keep working: `#/academy` opens the library, `#/academy/<course>` the course and `#/academy/<course>/<lesson>` the lesson. Links to `#/academy` inside the product app open it in a new tab. Start here, the research home and the Edge Lab link straight to it. `src/pages/Academy.tsx` is gone; nothing is duplicated.
8. **The public pages stay.** `/learn/academy/` and its course and lesson pages are still built by `scripts/seo/build_public.py` for search engines. Each now links into the same place in Parity Academy, and a lesson link to another course goes to that course's public page.

## Alternatives considered

- **Keep the Academy in the product app and add a full-screen mode.** Rejected for the same reasons as Trade: the product sidebar and the page scroll would still be there.
- **Progress in browser storage only.** Rejected. The owner asked for resume per account, and a course is often started on one device and finished on another.
- **One row per person holding all progress as a JSON object.** Rejected. Two devices saving at once would overwrite each other's lessons. One row per lesson merges by itself, and the best score is kept on save.
- **A separate step-by-step player (words, then picture, then check as three screens).** Not now. The lessons are short enough to read on one screen, and the picture beside the words is how they were written.

## Consequences

- `/academy/` and `academy.endyland.com` are behind the sign-in, like the other apps; the middleware and redirect tests cover both.
- One migration adds `academy_progress` with row level security, the same policy shape as the Trade tables.
- The layout shift audit and the accessibility audit include the Academy pages.
- Writing a new course is unchanged ([GDE-0007](../guides/0007-writing-a-new-academy-course.md)): the JSON file is the only source, for the app and the public pages.
- A native wrapper can add `academy` as an entry the same way as `trade`: the entry HTML has the same structure and the build writes `/academy/index.html` and `/academy/assets/`.
- The installable site ([DEC-0041](0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md)) covers it: Parity Academy has its own manifest at `/academy/manifest.webmanifest`, a shortcut in the main manifest, and the service worker keeps its built files like Trade's.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0028: Parity Academy, short courses with moving pictures](0028-parity-academy-short-courses-with-moving-pictures.md)
<!-- backlinks:end -->
