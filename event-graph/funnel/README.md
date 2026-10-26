# News funnel

The front of Parity's news-impact engine. It reads news feeds, merges copies of the same story, tags each story with tickers, a kind of event and the details in its summary, and hands the important ones to the engine's triage queue. There is no AI model in it: every step is a text rule, so it costs no GPU time and reading its output costs very few tokens.

**In plain words:** many outlets report the same thing. The funnel collects the headlines and short summaries, groups the copies into one story, notes which companies it is about and pulls out the numbers that matter (how much, for how long, who, where). Then it passes only the stories that could move a price to the reasoning engine.

The rest of the engine (the world graph, the mechanisms, the past cases) is in [event-graph/](../README.md). The funnel only needs its company names, read from the engine's database `eg`, and it writes to that database's `event_candidate` table.

## Run it

Needs Python 3.11 or later, `psycopg2` and the engine's Postgres (by default the socket in `~/event-graph/.pgdata`, port 5499; set `PGHOST`, `PGPORT` and `PGUSER` to change it).

```bash
python3 funnel.py init                 # create the `funnel` database and its feeds; safe to re-run
python3 funnel.py poll                 # poll every feed that is due, once, then exit
python3 funnel.py digest --material    # one line per story, details on the line under it
python3 funnel.py find "force majeure" # stories that mention a word, phrase, name, place or ticker
python3 funnel.py terms --add "letter of intent" --label LOI   # watch a new phrase
python3 funnel.py refacts              # re-read stored stories after changing a rule or a phrase
python3 funnel.py stats                # what each feed cost
python3 funnel.py promote              # hand material stories to eg.event_candidate (catalog 'news')
```

The funnel keeps its own database, `funnel`, because the engine's build script drops and rebuilds `eg`. Run `promote` again after every rebuild; it updates rows rather than adding duplicates.

## Sources

Only sources whose robots.txt or terms allow automated reading, checked on 26 October 2026. The funnel names itself honestly in every request (set `FUNNEL_UA` to add a contact) and never poses as a browser.

| Feed | What it gives | Cost per poll |
| --- | --- | --- |
| Business Wire RSS | Press releases, often the company's own words; "(NYSE: TEX)" tags give the ticker | About 12 KB, or nothing when unchanged |
| GDELT 15-minute event file | Conflict, coercion and sanctions between countries or with a government or military side | About 90 KB every 15 minutes |
| GDELT article search | World news that names the engine's companies, in batches of 8 names | One request per 5 seconds, GDELT's rule |
| Alpaca news (Benzinga) | Headlines and summaries with tickers on every article | Off until `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` are set |

Not used: Yahoo Finance (its news feeds and its `query1` API disallow all robots), Google News RSS (disallowed) and GlobeNewswire (refuses automated requests). On 26 October 2026 GDELT's article search refused every request from our network with "too many requests"; the funnel backs off, doubling the wait after each failure up to 6 hours.

## Why it is cheap to read

- The full article is never downloaded. A feed item is about 700 bytes; a full article page is 100 KB or more, tens of thousands of tokens.
- The feed's whole description is read for details, then only 300 characters are kept.
- Unchanged feeds answer "not modified" with no body, and a link seen before is skipped (tracking codes are stripped first, so two links to one article count once).
- Copies of one story from several outlets become one line.

In the first test, 80,000 tokens of raw feeds became 1,000 tokens of stored items and 820 tokens of digest.

## What it pulls from a summary

`facts.py` reads each headline and description with rules. Each story's details are merged across its copies and shown under its headline:

```
10-26 10:48 deal   SGRY   HealthSpan Partners to Acquire Surgery Partners ... [1x/1p]
            > $5.7B
```

| Detail | Example text | Kept as |
| --- | --- | --- |
| Amounts | "plans to raise up to $95 billion" | `$95B` (negative when money is lost or cut) |
| Percentages and what they measure | "about 30% of its automotive output", "Chipotle shares fell 7.5%" | `30% output`, `-7.5% Chipotle shares` |
| How long | "for two weeks", "a 3 to 6 month hit" | `2 weeks` (14 days), `6 months` (180 days) |
| When | "taking effect December 2", "resume by Q2" | `taking effect December 2` |
| People and roles | "named Brian Niccol as chief executive, replacing Laxman Narasimhan" | `CEO: Brian Niccol`, `out: Laxman Narasimhan` |
| Places | "a fire at its Naka plant", a press release's dateline | `Naka plant`, `Phoenix` |
| Quantities | "14 plants", "40,000 vehicles" | as written |
| Watch phrases | "declared force majeure" | `force majeure` (about 75 phrases to start, in the `watch_term` table) |

`promote` passes these details to the engine with each story, already in the shape of a claim: a size and unit, a duration in days, the people and the places.

Rules miss some ways of saying things. When one slips through, add a rule to `facts.py` or a phrase with `terms --add`, then run `refacts`.
