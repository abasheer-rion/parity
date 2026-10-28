# News funnel

The front of Parity's news-impact engine. It reads news feeds, merges copies of the same story, tags each story with tickers, a kind of event and the details in its summary, and hands the important ones to the engine's triage queue. There is no AI model in it: every step is a text rule, so it costs no GPU time and reading its output costs very few tokens.

It takes in everything first and sorts it later. Every entry from every source lands whole in the `raw` table the moment we see it, before any rule looks at it. The rules that pick tickers, kinds and details read from `raw` afterwards and can be re-run over the past when a rule changes (`normalize --again`). Nothing a rule drops is lost.

**In plain words:** many outlets report the same thing. The funnel collects the headlines and short summaries, groups the copies into one story, notes which companies it is about and pulls out the numbers that matter (how much, for how long, who, where). Then it passes only the stories that could move a price to the reasoning engine.

The rest of the engine (the world graph, the mechanisms, the past cases) is in [event-graph/](../README.md). The funnel only needs its company names, read from the engine's database `eg`, and it writes to that database's `event_candidate` table.

## Run it

Needs Python 3.11 or later, `psycopg2` and the engine's Postgres (by default the socket in `~/event-graph/.pgdata`, port 5499; set `PGHOST`, `PGPORT` and `PGUSER` to change it).

```bash
python3 funnel.py init                 # create the `funnel` database and its feeds; safe to re-run
python3 funnel.py run                  # poll forever: what launchd runs (run.sh)
python3 funnel.py poll                 # poll every feed that is due, once, then exit
python3 funnel.py normalize --again    # re-read every raw entry after changing a rule in sources.py
python3 funnel.py digest --material    # one line per story, details on the line under it
python3 funnel.py find "force majeure" # stories that mention a word, phrase, name, place or ticker
python3 funnel.py terms --add "letter of intent" --label LOI   # watch a new phrase
python3 funnel.py refacts              # re-read stored stories after changing a rule or a phrase
python3 funnel.py stats                # what each feed cost, and our lag behind each source
python3 funnel.py promote              # hand material stories to eg.event_candidate (catalog 'news')
```

### Always on

`run.sh` starts the engine's Postgres if it is down, reads keys from `.env` (`SEC_USER_AGENT`, `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY`, `NYT_API_KEY`, `GUARDIAN_API_KEY`, one `export NAME=value` a line; a feed without its key is skipped) and runs `funnel.py run`. That loop polls each feed on its own schedule (30 seconds for Nasdaq halts and SEC filings, 60 for the wires, the Fed and GDELT, up to 30 minutes for slow feeds), reads new entries into stories, hands material ones to the engine every 10 minutes and logs to `run.log`. To keep it running across logins and restarts:

```bash
cp com.parity.funnel.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.parity.funnel.plist
```

GDELT's event rows are about 100 MB a day. GDELT keeps every file public, so the runner deletes its rows after 14 days unless they became an item. Everything else is kept.

The funnel keeps its own database, `funnel`, because the engine's build script drops and rebuilds `eg`. Run `promote` again after every rebuild; it updates rows rather than adding duplicates.

## Sources

Only sources whose robots.txt or terms allow automated reading, checked on 26 October 2026. The funnel names itself honestly in every request (set `FUNNEL_UA` to add a contact) and never poses as a browser. The full list with schedules is `FEEDS` in `sources.py`.

| Group | Feeds |
| --- | --- |
| Company press releases | Business Wire, PR Newswire |
| Exchanges and filings | Nasdaq trading halts; SEC EDGAR's live feed of every filing (off until `SEC_USER_AGENT` is set: the SEC requires a real contact) |
| US government | Federal Reserve press, Federal Register public inspection (documents on file before publication), OFAC recent actions, White House presidential actions, FDA, Justice Department, CFTC, EIA |
| Other central banks and governments | ECB, Bank of England, Bank of Japan, European Commission |
| Disasters and health | USGS earthquakes (M4.5+, last hour), GDACS alerts, National Hurricane Center (Atlantic), WHO |
| Newsrooms (headline, link and summary) | CNBC, BBC Business, FT, Guardian Business, Al Jazeera, Seeking Alpha market currents, Investing.com, Nasdaq |
| Newsroom APIs (keyed) | NYT Times Newswire (`NYT_API_KEY`), Guardian Open Platform (`GUARDIAN_API_KEY`), each polled every 3 minutes to stay inside the free 500-a-day limit. Both free keys are for non-commercial use: a paid licence is needed before customers see their text |
| Aggregates | GDELT 15-minute event file (every row), GDELT article search for the engine's companies, Alpaca news (off until `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` are set) |

Not used, because robots.txt or the server refuses automated readers: Yahoo Finance, Google News RSS, GlobeNewswire, the weather.gov API, BLS, BEA, Dow Jones and MarketWatch feeds, Reddit, OPEC and the European Parliament. GDELT's article search has refused every request from our network with "too many requests" since 26 October 2026; the funnel backs off, doubling the wait after each failure up to 6 hours.

Publisher RSS is read for the headline, link and summary. Check a publisher's terms before showing its text to paying users.

## Why it is cheap to read

- The full article is never downloaded. A feed item is about 700 bytes; a full article page is 100 KB or more, tens of thousands of tokens.
- The raw table keeps each entry whole; the story digest a person or model reads keeps 300 characters of summary.
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
