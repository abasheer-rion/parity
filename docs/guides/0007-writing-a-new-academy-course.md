---
id: GDE-0007
title: Writing a new Academy course
type: guide
status: current
created: 2026-10-23
updated: 2026-10-27
authors: [ayan]
tags: [ui]
related: [DEC-0028, DEC-0067]
---

# Writing a new Academy course

## In plain words

A course is one JSON file in `academy/courses/`. Copy an existing one, change the words, pick a picture for each lesson, write two or three questions, and run the tests. No code is needed unless you want a new kind of picture. The reasons for the design are in [DEC-0028](../decisions/0028-parity-academy-short-courses-with-moving-pictures.md).

## Summary

### 1. Make the file

Name it `NN-<course-id>.json`, where `NN` is its place in the list. The course needs:

| Key | What it is |
| --- | --- |
| `id` | Lower case words joined by dashes. It becomes the web address. |
| `order` | Its place in the list. |
| `level` | A short label, such as "Start here", "Core" or "Markets". |
| `title`, `summary` | A plain name and one or two sentences. |
| `docs` | IDs of the docs it relies on, such as `REF-0006`. |
| `lessons` | 5 to 8 lessons. |

### 2. Write each lesson

| Key | What it is |
| --- | --- |
| `id`, `title` | The lesson's address and name. |
| `minutes` | 2 or 3. |
| `body` | Two to four short paragraphs. `**bold**` works. |
| `terms` | Glossary IDs from `docs/_system/glossary.json`. |
| `visual` | The picture (step 3). |
| `inParity` | Links into Parity: `label`, `href` (such as `#/compare` or `#/doc/HYP-0001`) and `space` (`product`, `research` or `both`). |
| `check` | 2 or 3 questions: `q`, `options`, `answer` (the position of the right option, from 0) and `why`. |

Write it the way you would say it out loud. Use the glossary's numbers and the docs' rules, and link the doc. Say so when a picture uses made-up numbers. Never say what to buy or sell. No em dashes or curly quotes.

### 3. Pick a picture

`visual` has a `kind`, an `alt` text that describes the whole picture, `params` for the kind, and `steps`. Each step has a `caption` and the settings that change at that step. A setting a step leaves out keeps its last value, and numbers ease from one step to the next.

New lessons should use the signature chart system ([DEC-0067](../decisions/0067-one-signature-chart-system-for-lessons-strategy-pages-and-clips.md)). The app plays these with the signature player (slider, data table, still frames with reduced motion), the public lesson pages show the last step and the table, and `npm run content -- --signature` turns them into clips. Every step also takes `title`, `verdict` and `tone`. Give each picture a teaching arc: show the thing, compare it, call out the number, and put a `verdict` on the last step. Keep a verdict under about 95 characters so it fits above the chart.

| Signature kind | Shows | Step settings |
| --- | --- | --- |
| `equity` | Lines that draw in, with value pills at the tips | `to` (0 to 1), `zoom`, `show`, `callouts`, `bands`, `par`, `stat`. A series with `role: "crowd"` is a faint background path (simulated tries, say) with no value pill; the table sums the crowd up as its highest and lowest |
| `split` | Two charts side by side | `to`, `winner` (`left` or `right`) |
| `underwater` | An account and how far below its last high it is | `to`, `worst`, `equity` |
| `distribution` | Where one result sits in a pile of others | `grow`, `band`, `marker` |
| `heatmap` | Rolling correlation as a strip of cells | `to`, `highlight`, `highlightLabel` |
| `regimes` | Wins and losses by kind of market | `reveal`, `highlight` |
| `scorecard` | Number cards | `reveal` |

The `params` each signature kind reads are in `web/src/ui/signature/scenes.ts`, and `web/src/ui/signature/examples.ts` has one example of each. "Reading a backtest" uses `equity`, `split` and `underwater`, and "Luck vs skill" uses `equity`, `distribution` and `scorecard`. A lesson's numbers live in its JSON, so compute them once (seeded, from the formula the lesson teaches, or from a real run) and write the values in; the captions, alt text and quiz must quote the same numbers.

A lesson can use Parity's own results. "Luck vs skill" uses the carry strategy from official run 1 (`ledger/runs/RUN-000001.json`): its weekly record, its deflated Sharpe, its 500 placebo copies and its 11 tests, reproduced exactly from the run's code and data snapshot. Set `params.tag` to say where the numbers come from, such as "Real result, official run 1" or "Carry real, others simulated". Clips show the tag and switch the risk line to past results.

#### A lesson film (`reel`)

A signature lesson can also carry a `reel`: the lesson told as a 30 to 90 second film that the Academy plays instead of the step player ([DEC-0085](../decisions/0085-academy-lessons-play-as-short-motion-films.md)). Every lesson of "Reading a backtest" and "Luck vs skill" has one. A reel is a list of beats; each beat is one spoken line and what the screen does while it is said:

| Key | What it does |
| --- | --- |
| `say` | The line, shown as the caption and timed at about 2.6 words a second. Put `*stars*` round the words that light up. |
| `shot` | `{"kind": "chart"}` (the lesson's own picture), `{"kind": "statement", "lines": [...]}` (big words, a line can take a `tone`), `{"kind": "grid", "series": [...]}` (many small paths) or `{"kind": "panels", "series": [...]}` (a few side by side). Left out, the last shot carries on; a new shot is a cut. |
| `s` | Chart shots: the step position reached by the end of the beat. The chart draws from where it was. |
| `cam` | `{"z": 1.25, "x": 0.8, "y": 0.4}`: zoom in towards a point (0 to 1 across and down). Keep `z` at 1.3 or less; the chart already fits itself to what is drawn. |
| `head` | The big line: `{"text": "...", "sub": "..."}`, `{"tip": 0}` to count along series 0 as it draws, or `{"text": "{n}", "count": [0, 1000], "fmt": "int"}`. `null` clears it. |
| `chapter` | Starts a chapter, named in the position bar and the transcript. |

Give the reel an `alt` that says what the whole film shows and a `tag` saying what the numbers are. Then render its MP4 for reduced motion and the social clips with `npm run content -- --reels --scenes <course>-<lesson>` ([GDE-0008](0008-rendering-shareable-clips-from-the-sims.md)); the tests fail until the rendered film matches the lesson. The 10 existing reels in `academy/courses/01-*.json` and `02-*.json` show every shot.

The older kinds below still work for the courses that have not moved yet.

| Kind | Shows | Step settings |
| --- | --- | --- |
| `growth` | Money growing at several yearly rates | `reveal` (0 to 1) |
| `paths` | Random paths, named ones or a fan of many | `reveal`, `n`, `best`, `band`, `show` |
| `drawdown` | An account, its peak and the fall from the peak | `reveal`, `peak`, `fill`, `mark` |
| `costs` | Before and after trading costs | `cost` (basis points per trade) |
| `maxof` | The best result of many unskilled tries | `n`, `hurdle` |
| `gauntlet` | The eleven tests lighting up | `upto`, `verdict` |
| `curve` | A yield curve changing shape | `yields`, `label`, `ghost` |
| `bars` | Bars growing and shrinking | `values`, `label`, `unit` |
| `lines` | Named lines from points, a random walk, or a smoothed copy | `reveal`, `show`, `label` |
| `event` | An event study against random days | `n`, `avg`, `band` |
| `leverage` | Where the margin is gone at each leverage | `lev` |
| `jcurve` | A private fund's calls, distributions and value | `reveal`, `nav` |
| `seesaw` | Two currencies and their rate | `rate`, `label` |
| `trend` | A price, its average and a trend rule | `reveal`, `ma`, `shade` |

The `params` each kind reads are at the top of its function in `web/src/academy/scenes.ts`. The existing courses show every kind in use. A new kind is a new function in that file, added to `KINDS`.

### 4. Check it

```
cd web
npx vitest run academy                     # shape, links, words, pictures, writing rules
VITE_AUTH_BYPASS=1 npx vite --port 5199    # open /academy/#/<course-id> (Parity Academy, DEC-0042)
npm run build                              # also writes the public pages under dist/learn/academy/
```

The test fails if a glossary word, doc or page does not exist, if a picture cannot draw a step, if a signature picture has no verdict on its last step or no data table, or if a lesson has the wrong number of questions. `npx vitest run reel` checks the films: their length, that every moment draws at every size, and that each rendered MP4 is current. Then run `python3 scripts/docs.py check` as for any change.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0028: Parity Academy, short courses with moving pictures](../decisions/0028-parity-academy-short-courses-with-moving-pictures.md)
- [DEC-0042: Parity Academy, a full-screen course player of its own](../decisions/0042-parity-academy-a-full-screen-course-player-of-its-own.md)
- [DEC-0085: Academy lessons play as short motion films](../decisions/0085-academy-lessons-play-as-short-motion-films.md)
- [GDE-0008: Rendering shareable clips from the sims](0008-rendering-shareable-clips-from-the-sims.md)
<!-- backlinks:end -->
