---
id: GDE-0008
title: Rendering shareable clips from the sims
type: guide
status: current
created: 2026-10-23
updated: 2026-10-27
authors: [ayan]
tags: [process]
related: [DEC-0035, DEC-0067, GDE-0007]
---

# Rendering shareable clips from the sims

## In plain words

One command turns the sims into short videos and GIFs for TikTok, Reels, Shorts and other feeds. Each clip has the Parity wordmark, burned-in captions, the data and its period on screen, the line "Hypothetical, educational, not investment advice." in every frame, and an end card with paritytrading.app. Nothing is posted for you: download the files and post them yourself. The decision behind this is [DEC-0035](../decisions/0035-bot-battle-and-shareable-clips-win-rate-is-not-profit.md).

## Summary

### What you get

For each scene, in `content/out/` at the repo root (ignored by git):

| File | What it is |
| --- | --- |
| `<scene>-9x16.mp4` | 1080 x 1920, about 20 seconds, for TikTok, Reels and Shorts |
| `<scene>-1x1.mp4` | 1080 x 1080, for feeds that prefer squares |
| `<scene>.gif` | under 8 MB, for chats and posts that do not play video |
| `manifest.json` | each clip's title, period, a suggested caption, hashtags and file sizes |

The scenes are:

- `bot-battle`: "99% win rate vs 45% win rate: who wins?", from Bot Battle on US stocks since 1928;
- `strategy-race`: every strategy we test, replayed, from the latest strategy run;
- `crisis-replay`: 2008 across stocks, banks, oil, the yen and Treasuries;
- `luck-vs-skill`: 400 made-up coin-flipping traders and the luckiest one;
- `smoothing-illusion`: US stocks priced weekly against the same values appraised quarterly.

### Steps

1. Build the data the scenes read, in `engine/`:

   ```bash
   parity bots export      # engine/output/bots/
   parity world export     # engine/output/world.json
   parity run              # engine/output/latest.json, for the strategy race
   ```

   A scene whose file is missing is skipped, and the manifest lists it under `skipped_for_missing_data`.

2. Render, in `web/` (needs Node 22.6 or later, Playwright's Chromium and ffmpeg):

   ```bash
   npm run content                                    # every scene, every format
   npm run content -- --scenes bot-battle,luck-vs-skill
   npm run content -- --formats vertical,gif          # skip the square video
   npm run content -- --stills                        # a few PNG frames, no video
   npm run content -- --examples                      # also refresh web/public/content/*.gif
   ```

   Other options: `--fps 30`, `--data <folder>`, `--out <folder>`, `--ffmpeg <path>` (it uses `/opt/homebrew/bin/ffmpeg` when that exists). A full run takes a few minutes.

3. Check the manifest, watch each clip once, then post it with the suggested caption. Keep the caption's period and "not investment advice" wording.

### In GitHub Actions

The **Content clips** workflow (`.github/workflows/content.yml`) runs every Monday and on demand. It builds the data from public prices, renders every scene and keeps `content/out/` as an artifact for 30 days. Open the run and download `parity-clips-<number>`.

### Signature clips

`npm run content -- --signature` renders clips in the signature chart style ([DEC-0067](../decisions/0067-one-signature-chart-system-for-lessons-strategy-pages-and-clips.md)) instead of the sim scenes. It needs no engine data. Each clip is one picture played step by step: the first step draws in, each step holds long enough to read its caption, and the last step holds on the verdict.

- **Academy lessons.** Every lesson whose picture uses a signature scene, read from `academy/courses/`. Today that is the five lessons of "Reading a backtest" and the five of "Luck vs skill".
- **Methodology explainers.** Equity against a benchmark, a bootstrap distribution with its 95% range, wins and losses by kind of market, how far below its last high an account sat, and the numbers with a verdict. They use the example data in `web/src/ui/signature/examples.ts`.

```bash
npm run content -- --signature                                   # every clip, 9:16 and 1:1
npm run content -- --signature --scenes explainer-regimes          # one clip
npm run content -- --signature --formats vertical                  # 9:16 only
npm run content -- --signature --stills                            # one PNG per step, no video
```

They go to `~/Desktop/parity-clips/signature/` (`9x16/` and `1x1/`, with `manifest.json`) unless `--out` says otherwise. Every frame carries the Parity brand line, a tag saying where the numbers come from (an example, hypothetical, or a real run when the lesson sets `params.tag`), and the risk line with the site address. A clip on real results says "Past results" in its risk line instead of "Hypothetical". The clip definitions are in `web/scripts/content/signature.ts`. A lesson moved to a signature scene becomes a clip with no other change.

### Academy lesson films

`npm run content -- --reels` renders the Academy's lesson films ([DEC-0085](../decisions/0085-academy-lessons-play-as-short-motion-films.md)), the TikTok-style versions of each lesson: big words, a chart that draws, a counting number, camera moves and cuts.

```
npm run content -- --reels                                          # every film
npm run content -- --reels --scenes reading-a-backtest-return       # one film
npm run content -- --reels --formats vertical --no-site             # 9:16 only, leave the Academy's copy alone
```

Each film gives a 9:16 and a 1:1 MP4 with burned-in captions and the risk line, a WebVTT caption file and a voice-over script with times, in `~/Desktop/parity-clips/academy-motion/` with `manifest.json`. It also writes the 16:9 film (no burned-in captions, with its caption file) to `web/public/content/academy/`, which the Academy plays when motion is reduced, and records it in `academy/reels.json`. A film takes about 90 seconds. Commit the new files under `web/public/content/academy/` and `academy/reels.json`.

### Adding a scene

A scene is a function in `web/scripts/content/scenes.ts` that returns a hook, a period line, captions, a social caption with hashtags, an end card line and a `body(t, box)` that draws the chart at moment `t` as SVG. Add it to `allScenes`. The frame around it (wordmark, captions, risk line, end card) is shared, so a new scene cannot leave them out.

### The rules every clip follows

- Every number says whether it is hypothetical, backtested or simulated, and over which dates.
- The risk line is on screen in every frame, and again on the end card.
- No clip says what to buy, and none promises a result. The words "buy now", "guaranteed" and "you should" never appear.
- Clips use only data the site may show (the same files the pages read).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0035: Bot Battle and shareable clips: win rate is not profit](../decisions/0035-bot-battle-and-shareable-clips-win-rate-is-not-profit.md)
- [DEC-0067: One signature chart system for lessons, strategy pages and clips](../decisions/0067-one-signature-chart-system-for-lessons-strategy-pages-and-clips.md)
- [DEC-0085: Academy lessons play as short motion films](../decisions/0085-academy-lessons-play-as-short-motion-films.md)
- [GDE-0007: Writing a new Academy course](0007-writing-a-new-academy-course.md)
<!-- backlinks:end -->
