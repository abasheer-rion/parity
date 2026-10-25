---
id: DEC-0037
title: Everything runs by itself and the search widens itself
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [infra, method]
related: [DEC-0014, DEC-0016, DEC-0035]
---

# Everything runs by itself and the search widens itself

## In plain words

The owner asked that everything should always run by itself, and keep running more. Before this, only the strategy search ran around the clock. Bot Battle, Sim World paths and the site exports ran only when someone typed a command. Now:

- **A second service runs the sims on a loop.** Every 20 minutes or so it runs every Bot Battle bot on 1,000 new made-up paths with crashes, draws 2,000 new Sim World paths, and rebuilds the site's world, scenario, terminal and Bot Battle files. The totals keep growing, so the Bot Battle page can say "out of 50,000 made-up crashes, this bot was wiped out on 6%" instead of showing one history.
- **The search opens new ground by itself.** When more than half of its recent draws are variations it has already tried, it widens: finer settings, shorter and longer lookbacks, books that trade only part of a universe, bigger blends. Each widening is one plain line in its log.
- **A health line shows both are alive.** The site shows "search: 130,466 tries, last batch 2 min ago; sims: 52,000 bot paths, last cycle 14 min ago". A service silent for two hours shows as stale.

## Context

- The search ([DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md)) runs as a launchd agent on the owner's machine. It restarts every 12 hours and pulls `main` first, so merged code reaches it without anyone logging in.
- Its sampler already draws less from regions that keep giving repeats. But the space itself was fixed by hand: a person had to add new grids or blocks when it ran dry. At about 130,000 tries, roughly 12% of draws were repeats.
- Bot Battle ([DEC-0035](0035-bot-battle-and-shareable-clips-win-rate-is-not-profit.md)) showed a summary of 100 made-up paths, rebuilt from the same seeds at each deploy. Sim World ([DEC-0016](0016-sim-world-2-a-world-map-scenarios-on-it-and-simulated-paths.md)) drew its paths only on request.
- There is no command for forward paper-tests of strategies. Paper trading lives in the signed-in site, per account, so the sims service has nothing to run for it yet.
- The box also hosts other things, and the search must keep most of it.

## Decision

1. **Self-widening search** (`engine/src/parity/search.py`).
   - Every batch is recorded with its tries, failures and repeats.
   - After each batch it looks at the last 20 batches since the last widening. If more than 50% of all draws were repeats, it moves up one level. It never widens twice within 20 batches, and it stops at level 6.
   - The levels are rules, not hand edits:
     - **Level 1 and up:** every number grid gets finer. Each level adds the midpoint between every pair of neighbours (geometric for lookbacks and windows) and one step past each end, inside fixed bounds. Lookbacks run from 2 days to 5 years. Trend and ranking books may also trade a rule-drawn subset of their universe.
     - **Level 2:** blends of up to 4 strategies and one more layer of wrapping.
     - **Level 3:** blends of up to 5 and another layer.
   - Level 0 draws exactly what the search always drew. A test pins the first 500 draws from a fixed seed, so no old id changes meaning.
   - **Every new try counts in the luck check.** The deflated Sharpe now uses the total number of variations ever backtested, failed ones included. Before, it used only the ones that ran, which was slightly too kind.
   - **The honesty guards are unchanged.** A variation that sits in cash is still rejected. Regime filters still read data a business day late, on its release date. Every subset holds only assets that were already tradable. The widened variations pass the same look-ahead and tradable-only tests as the rest.
2. **The sims service** (`engine/src/parity/sims.py`, `parity sims`).
   - One cycle runs:
     - Bot Battle on 1,000 fresh made-up paths. Seeds start at 1,000,000 and never repeat.
     - 2,000 Sim World bootstrap paths of 26 weeks for the euro, yen, oil, US stocks and an equal basket.
     - `world export`, `scenario export`, `terminal export` and `bots export`, through the same command line code as by hand.
   - It keeps running totals and fixed-bin histograms, not the paths, so a million paths still cost a few hundred kilobytes in `engine/output/sims.db`. A step that fails is recorded, and the rest of the cycle still runs.
   - `scripts/sims-service/run.sh` and `install.sh` copy the search service's pattern:
     - launchd label `com.endyland.parity-sims`, running as the user;
     - pull `main`, run for 12 hours, exit, and let launchd start it again;
     - `nice -n 10`, one CPU thread, and a 20-minute rest after each cycle of about two minutes;
     - no network listener.
3. **Publishing.** Both services use the vault entry `parity-supabase-writer-url`, read straight into the environment and never printed. Without it they run without publishing. The new migration adds:
   - `service_heartbeats`: one row per service, readable by anyone. It is written only through `report_heartbeat()`, which stamps the database's own clock and accepts only the names `search` and `sims`.
   - `sim_snapshots`: the sims' summary. Only the writer may add rows, nobody else may read them, and only the newest 20 are kept. The deploy job copies the newest into the site as `data/sims.json`, the same way it copies the search snapshot.
4. **On the site.**
   - Bot Battle gets a card with each bot's share of crash paths that wiped it out, the share that ended ahead, and a bar of where its account ended (5th to 95th percentile).
   - The Strategy search page and that card show the health line, read live.

## Alternatives considered

- **Run the sims in GitHub Actions.** Rejected. It spends the free minutes, and nothing would accumulate between runs without a store.
- **Widen on a timer.** Rejected. Widening should follow evidence that the current space is worked through, not the calendar.
- **Keep every simulated path.** Rejected. The disk on the box is nearly full, and the site needs only the spread.
- **Let the sims service share the search process.** Rejected. A slow export would stall the search, and one crash would stop both.

## Consequences

- The bar for the luck check rises a little now, because failed tries count, and it keeps rising as the widened search adds tries. That is intended.
- Widened variations get longer names, such as "G10 currencies (5 of 9) trend 6m monthly". The recipe in each row shows the exact assets.
- Nothing here is a result. Leads still need registration and an official run ([DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md)).
- If the box goes off, both health parts turn stale after two hours. The site keeps the last numbers.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0045: We track how old our data is at every hop and how fast pages get it](0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md)
- [DEC-0047: Competitor profiles and a feedback collector that runs by itself](0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md)
- [REF-0018: Parity latency baseline](../reference/0018-parity-latency-baseline.md)
- [LOG-0014: Everything runs by itself](../log/2026-10-24-ayan-work-log-everything-runs-by-itself.md)
- [LOG-0017: Ayan work log, competitor profiles, feedback collector and architecture](../log/2026-10-24-ayan-work-log-competitor-profiles-feedback-collector-and-architecture.md)
<!-- backlinks:end -->
