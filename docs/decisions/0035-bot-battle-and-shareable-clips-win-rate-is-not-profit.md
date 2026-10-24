---
id: DEC-0035
title: Bot Battle and shareable clips: win rate is not profit
type: decision
status: accepted
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [process, ui]
related: [DEC-0014, DEC-0020, DEC-0024, DEC-0028, DEC-0030, GDE-0008]
---

# Bot Battle and shareable clips: win rate is not profit

## In plain words

The owner saw a video of trading bots: one won 99% of its trades, another 56%, and the 56% bot made far more because the 99% bot had a few huge losses. He asked for sims like that, and for clips and GIFs we can post. We built three things:

- **Bot Battle.** Seven simple trading bots race with the same hypothetical $10,000 on the same prices, on the shared replay stage (big date, Play at 1x, 4x or 16x, a live leaderboard). Each bot shows its win rate, average win, average loss, profit factor, profit, worst fall and longest time under water. A card works out **expectancy** for the bot you follow: win rate x average win - loss rate x average loss. It runs on real US stocks (from 1928, 1990 or 2007), the euro and Brent oil, and on made-up paths with crashes. It is a Parity Terminal panel (`BOTS`) and a Sim World tab.
- **An Academy course**, "Win rate is not profit": five lessons with moving pictures.
- **Shareable clips.** `npm run content` renders five scenes as 9:16 and 1:1 videos and GIFs with captions, the wordmark, the risk line and an end card, plus a manifest of suggested captions and hashtags. A weekly workflow keeps them as an artifact. Nothing is posted for us. [GDE-0008](../guides/0008-rendering-shareable-clips-from-the-sims.md) says how.

Everything is labelled hypothetical, backtested or simulated, with its period. None of it is advice.

## Context

Win rate is the number bot sellers quote most, and it is the one that misleads most. Parity already explains luck, smoothing and drawdowns ([DEC-0028](0028-parity-academy-short-courses-with-moving-pictures.md)) and has a replay stage for every Sim World tab ([DEC-0020](0020-sim-world-plays-every-tab-like-the-race-on-its-own-full-screen-site.md), [DEC-0024](0024-parity-terminal-a-market-terminal-of-its-own-at-the-sim-address.md)). It had nothing that puts win rate and profit side by side, and no way to turn a sim into something people can share.

## Decision

1. **Bots are short rules on daily closes**, in `engine/src/parity/bots.py`, separate from the weight-based backtester because they need single trades to count wins. Each bot decides at the close of day t from closes up to day t and trades at that close, the same timing as the backtester. The rules:

   | Bot | Rule |
   | --- | --- |
   | Double down | Buy 5% of the account, buy twice as much after each 2% fall, sell all at plus 1% |
   | Picking up pennies | Sell a week of crash insurance on twice the account; the fee is last year's average payout plus 25% |
   | Quick scalper | Three times the account, take profit at plus 0.5%, stop at minus 4% |
   | Trend follower | Long above the 50-day high, short below the 50-day low, out at the 20-day low or high |
   | Grid trader | Buy 10% at each 2% step down, sell each piece 2% higher, at most 10 pieces |
   | Dip buyer | Buy after three down days below the 10-day average, sell above it or after 10 days |
   | Buy and hold | The yardstick |

   Shared assumptions: costs of 2 bp a side, no interest, stops checked at closes, a margin call above 10 times the account, a bot stops below 1% of its start, and trades open on the last day are closed at the last close and counted.
2. **Look-ahead is tested.** `engine/tests/test_bots.py` changes every price after a day and checks that the account and the closed trades up to that day do not change, for every bot at 40 cut points. Feeding a bot one day of the future fails it for 6 of the 7 bots (buy and hold decides only on day one).
3. **The site reads precomputed replays.** `parity bots export` writes `bots/index.json` and one file per replay: weekly frames of each account, the worst fall so far and the longest time under water so far, plus every trade with the week it closed. The page works out the live leaderboard from those (`web/src/lib/botStats.ts`), and a test checks that its numbers on the last frame match the engine's. One implementation of the rules, in Python, keeps the page and the CLI from drifting apart. The made-up mode offers 12 seeded paths and a summary over 100.
4. **The synthetic paths** have calm spells (about 10% a year up, 13% volatility), stressed spells (35% volatility) and crashes of 15% to 40% about once every seven years. They are for showing how rules behave, not a model of any market.
5. **Clips are drawn, not screen-recorded.** Each scene is a pure function from a moment to SVG (`web/scripts/content/scenes.ts`). Headless Chromium photographs each frame and ffmpeg encodes it, so a clip renders the same every time and the shared frame (wordmark, captions, period, risk line, end card) cannot be left out. GIFs are cut until they are under 8 MB; site examples under 2 MB.
6. **Compliance rules** for every clip and the page: label every number hypothetical, backtested or simulated with its period; keep the risk line on screen; never say buy; never promise a result.

## Results on real prices

From `parity bots run`, $10,000 each, on data through 21 October 2026. Backtests of simple rules, not advice.

| Prices | Double down | Trend follower | Buy and hold |
| --- | --- | --- | --- |
| US stocks, 1928 on | 99.1% wins, ends at $992 | 44.9% wins, ends at $3.7m | ends at $126m |
| US stocks, 1990 on | 99.7% wins, ends at $67k | 43.8% wins, ends at $23k | ends at $463k |
| Euro, 1999 on | 97.8% wins, ends at $3.1k | 37.9% wins, ends at $11.6k | ends at $9.5k |

Over 100 made-up paths of 10 years, Double down won about 99% of its trades on the typical path, ended ahead on 31 and was stopped out on 5; the trend follower won about 40% and ended ahead on 70.

## Alternatives considered

- **Port the bots to TypeScript and run them in the browser.** Rejected: two copies of every rule would drift, and the look-ahead test would cover only one of them.
- **Record the live page with a screen recorder.** Rejected: timing would vary run to run, and the layout is not made for 9:16.
- **Generated video.** Rejected for the same reasons as in DEC-0028: cost, and no way to check numbers against the data.

## Consequences

- The deploy writes `dist/data/bots/`, about 3 MB before compression, loaded one replay at a time.
- Bot parameters are fixed. Changing one changes every published number, so it needs a note here.
- Leverage costs nothing in these sims, which flatters the leveraged bots a little. The page says so.
- Posting stays manual: we have no access to social accounts, and the owner decides what goes out.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0036: Verify runs its checks in the browser and holds daily prices only](0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)
- [GDE-0008: Rendering shareable clips from the sims](../guides/0008-rendering-shareable-clips-from-the-sims.md)
<!-- backlinks:end -->
