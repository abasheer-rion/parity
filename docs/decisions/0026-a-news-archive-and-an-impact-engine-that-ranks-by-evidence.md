---
id: DEC-0026
title: A news archive and an impact engine that ranks by evidence
type: decision
status: accepted
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [data, method, news]
related: [REF-0013, DEC-0015, REF-0015]
---

# A news archive and an impact engine that ranks by evidence

## In plain words

The News page now keeps every headline forever and can search it. It also has an "impact search": pick an asset to see which news came before its most unusual moves, or pick a kind of news (OPEC, rate hikes, war, inflation, bank failures) to see what usually happened next, compared with random days. Every number shows how many events it rests on, and the page says when a pattern could be luck. It describes the past. It is never a prediction.

The owner asked for "a news section as well, latest news or even older news, algos to search for news that impacts certain stocks or commodities at certain periods or ranges".

## Context

Until now the News page showed only the newest 400 headlines and the biggest market days since 1999 ([REF-0013](../reference/0013-news-sources-and-market-impact.md)). Older news was thrown away, and there was no way to ask "what tends to happen after this kind of news?".

Asking that question is easy to do badly. Sorting hundreds of headlines by the size of the move that followed always finds dramatic examples, by chance alone. Events close together share the same days, so they look like more evidence than they are. And trying many topics and assets at once guarantees some false hits.

## Decision

1. **A yearly archive.** Every fetched headline also goes into `engine/data/news/archive/<year>.parquet`, tagged with topics (21 plain word lists) and the catalog assets it is about. Search by words, years, topic, asset and source (`parity news search`).
2. **Backfill only from sources whose terms allow it** (`parity news backfill`):
   - Federal Reserve press releases, 2016 on (public domain);
   - ECB press releases, 1997 to 2024 (reuse allowed with the ECB named);
   - Bank of Japan monetary policy releases, 1998 on (reuse allowed with the Bank named);
   - our own 76 event descriptions in `catalog/events`, 1971 on;
   - GDELT headlines by month and topic, 2017 on (headline and link only);
   - SEC 8-K filings with their item numbers for 13 large companies, only when `PARITY_CONTACT` is set.
   - Not used: OPEC and the EIA press archive refuse automated requests, and the Bank of England has not confirmed headline reuse.
3. **The impact engine** (`engine/src/parity/news/study.py`) works on any series in the data catalog:
   - Moves are divided by the asset's normal daily move over the year before (z), over 1, 5 and 20 trading days.
   - Headlines on the same day are one event, so days are counted, not items.
   - Every event study is compared with random days from the same years. The p-value comes from those random days, so fat tails and drift are in the baseline.
   - Events that overlap (within 20 trading days of another) are marked, and the averages are repeated for non-overlapping events only.
   - Rankings across topics or assets report a q-value (Benjamini-Hochberg), the p-value corrected for how many pairs were tried, and are sorted by it, never by the size of the move.
   - Under 5 events there is no p-value. Under 20 there is a warning.
   - "Rate hike" and "rate cut" also count a central bank decision day when its policy rate (BIS) moved that way, because official headlines say "FOMC statement", not "raises rates".
4. **The product page** `#/news` gets two tabs, Archive and Impact search, with a plain words explainer. The export writes `news/archive/<year>.json` and `news/impact.json`, precomputed for 21 topics and 13 assets.
5. **Research use goes through the CLI.** `parity news impact --asset cmd.BRENT --topic "OPEC" --from 2010 --to 2024` prints the full event study table; `--rank assets` and `--rank topics` print the rankings. No separate research page yet: the product page already shows N, bands, overlap and q, and the wall in [DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md) is kept because the page only presents results.

## Alternatives considered

- **Scrape news sites for older headlines.** Rejected. Their terms forbid it (REF-0013).
- **A normal-table p-value.** Rejected. Daily returns have fat tails and drift, so random days are a fairer baseline.
- **Rank by the biggest average move.** Rejected. It rewards topics with few events and lucky outliers.

## Consequences

- Most topics are thin today. GDELT throttles hard, so the hourly job adds one month of topic queries per run, and the archive fills over about two weeks. Until then many studies say "too few events".
- The archive lives in the Actions data cache, like the price cache. If that cache is lost, the backfill rebuilds the official sources in one run, but GDELT history takes weeks again.
- The export takes about a minute and `impact.json` is about 2.5 MB before compression.
- The ECB has no year page for 2025 on; its RSS feed covers those years.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0028: Parity Academy, short courses with moving pictures](0028-parity-academy-short-courses-with-moving-pictures.md)
- [REF-0013: News sources and market impact](../reference/0013-news-sources-and-market-impact.md)
<!-- backlinks:end -->
