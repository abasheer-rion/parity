---
id: REF-0024
title: App speed, how we measure it and what we changed
type: reference
status: current
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [infra, ui]
related: [DEC-0058, DEC-0045, REF-0018, REF-0019, DEC-0041]
---

# App speed, how we measure it and what we changed

## In plain words

The owner found the apps slow. We measured every app on a laptop-like connection with a made-up account, then cut what each app downloads, stopped the browser asking again for files that never change, split the largest data file in two, and started the data download while the code is still arriving. The product app now shows its page in about 0.4 s instead of 1.6 s and downloads a third of the code.

## Summary

- Product: largest paint 1.6 s to 0.4 s, code 1.26 MB to 0.38 MB. Terminal: code 574 KB to 294 KB.
- A second visit asks the server about no code files at all (before: every one).
- Research is still over the 1.5 s goal; the fix is a small summary file (below).

## How to measure

Everything runs on this machine against a copy of the built site and a fake Supabase, so no real account is used (web/scripts/perf/).

1. Build with the fake Supabase address: `VITE_SUPABASE_URL=http://127.0.0.1:54399` before each `vite build` mode.
2. Browser: `node scripts/perf/measure.mjs` (options `--before`, `--dist <dir>`, `--data <dir>`). It opens each app at 1440 by 900 with 40 ms of delay each way and 30 Mbit/s down, then a second visit in a new tab, then one route change. `--before` serves files with the old cache headers. `--data` points at a folder with a real-size latest.json (18.6 MB).
3. Desktop: `node ../desktop/scripts/prepare-web.mjs`, then `node scripts/perf/desktop.mjs sections` prints when each section first draws in Electron; `occlude` hides, minimises and restarts graphics and takes a screen picture after each.

## Before and after (browser)

Largest paint (LCP) in ms on the first and second visit, JS sent in KB (compressed, everything fetched in the first seconds, including files fetched after the first paint), code files the second visit had to ask the server about, and a route change in ms. Before is main at 5b7418e with the live cache headers; after is this change. Same machine, same data.

| App | LCP before | LCP after | 2nd visit before | 2nd visit after | JS before | JS after | Asked again before | Asked again after | Route before | Route after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| site | 264 | 224 | 372 | 160 | 17 | 17 | 0 | 1 | - | - |
| product | 1624 | 380 | 1064 | 536 | 1263 | 376 | 4 | 0 | 28 | 29 |
| research | 2056 | 1764 | 840 | 944 | 1263 | 375 | 4 | 0 | 70 | 18 |
| sim | 404 | 320 | 236 | 112 | 574 | 294 | 3 | 0 | 19 | 23 |
| trade | 272 | 320 | 152 | 124 | 245 | 246 | 1 | 0 | 20 | 19 |
| academy | 308 | 392 | 272 | 212 | 242 | 246 | 1 | 0 | 52 | 38 |
| lab | 256 | 312 | 160 | 344 | 291 | 227 | 1 | 0 | 34 | 19 |

- Product and research JS after includes about 165 KB (the catalog and glossary for the palette and hover cards) fetched once the page has drawn; the code needed for the first page is about 210 KB.
- Research is still over the 1.5 s goal: its home waits for the run (11.6 MB) and then fades in.
- Small apps (Trade, Academy, Workbench) were already fast; their numbers move within the noise of a run.
- Desktop: the first visible paint of a section went from about 200 to 240 ms to 140 to 210 ms, and windows now open already drawn.

## What changed

- **Code splitting.** Every product and research page is its own file, loaded when opened, started on hover and, for the usual next pages, a few seconds after load. The Terminal has its own entry and no longer downloads the dashboard (and the other way round). Workbench and Trade views other than the first load on demand. React and Supabase are their own files, so a deploy that changes only Parity's code leaves them cached.
- **Docs only when shown.** The docs file (about 0.9 MB compressed) loaded on every product and research visit; now only the reader, the palette when opened and hover cards load it. The research home reads a small list of doc titles instead.
- **Cache.** Built files have a content hash in their name. Signed in, the apps' built files are now kept a year (`private, max-age=31536000, immutable`) instead of checked on every visit, and the site's public built files the same, publicly. Pages and data are still checked each time.
- **Data.** The deploy writes each run three ways: the whole run, a `.lite.json` without the strategies' settings tests (about 40 percent smaller on the wire), and the settings tests alone, which only Workbench's Try settings reads. Until the next deploy writes them, the apps read the whole file as before. Each run is read once per page for five minutes, and the dashboard asks for it as soon as its code starts.
- **First paint.** Web fonts no longer hold up the first paint, and each app paints its loading screen at once ([DEC-0058](../decisions/0058-a-parity-page-is-never-black-it-shows-a-loading-screen-or-says-what-went-wrong.md)).
- **Desktop.** Windows show once drawn, the two most recent other sections open in the background, and the app's disk cache keeps built files between launches.

## Not done yet

- Web workers for Verify's checks and the indicators, and list virtualising beyond what exists.
- A smaller summary file for the dashboard homes, so research meets the 1.5 s goal.
- Self-hosted, subset fonts.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0058: A Parity page is never black, it shows a loading screen or says what went wrong](../decisions/0058-a-parity-page-is-never-black-it-shows-a-loading-screen-or-says-what-went-wrong.md)
<!-- backlinks:end -->
