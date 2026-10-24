---
id: GDE-0003
title: Writing and filing docs
type: guide
status: current
created: 2026-10-20
updated: 2026-10-21
authors: [ayan]
tags: [docs, process]
related: [DEC-0001, DEC-0004]
---

# Writing and filing docs

## In plain words

How to write a document in this project so it passes the checks: which folder, which labels, how to link to other documents, and how to keep the writing plain.

## Summary

Use `scripts/docs.py new` to start any document, write in plain words, and run `make docs` before you commit. The pre-commit hook and CI will tell you exactly what to fix. Why the rules exist is in [DEC-0004](../decisions/0004-docs-are-checked-by-a-script.md); the rules themselves are in `docs/_system/schema.json`. Words that appear on Parity's pages follow [REF-0017](../reference/0017-parity-copy-rules.md).

## Which kind of doc

| You want to record | Kind | Command |
| --- | --- | --- |
| A choice and its reason | decision | `python3 scripts/docs.py new decision "Use X for Y"` |
| A claim to test | hypothesis | `python3 scripts/docs.py new hypothesis "X predicts Y"` |
| A run and its numbers | experiment | `python3 scripts/docs.py new experiment "What we ran"` |
| Notes on papers, code or forums | research | `python3 scripts/docs.py new research "Topic"` |
| How to do something | guide | `python3 scripts/docs.py new guide "How to X"` |
| Facts to look up | reference | `python3 scripts/docs.py new reference "Topic"` |
| What happened in a session | log | `python3 scripts/docs.py new log "Short description"` |

Add `--tags fx,carry --author amanda` to set tags and author. The script picks the folder, the next ID, the filename, the front matter and the required sections.

## Front matter

Every doc starts with exactly these keys, in this order:

```yaml
---
id: HYP-0008
title: Plain sentence title
type: hypothesis
status: open
created: 2026-10-21
updated: 2026-10-21
authors: [amanda]
tags: [commodities, fx]
related: [HYP-0003]
---
```

- `id` is the prefix for the folder plus the number in the filename.
- `status` must be one the type allows. The checker lists them if you get it wrong.
- `tags` come from the fixed list in [TAGS.md](../TAGS.md), sorted, at most five. `docs.py check --suggest` proposes tags based on the text.
- `related` lists IDs of closely connected docs. Links in the body also count as connections.
- Change `updated` whenever you change the content.

## Links

- Link to other docs with relative paths: `[HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md)`.
- Link to a section with its anchor: `[how we test it](../hypotheses/0003-commodity-currencies-catch-up.md#how-we-test-it)`. The anchor is the heading in lowercase with spaces as hyphens and punctuation removed.
- Start a link's text with the ID when pointing at a doc, so readers know what kind of thing it is.
- Do not edit the "Referenced by" block at the bottom of each doc. It is rebuilt from links and `related`.

## Writing style

- Write the way you would explain it to a classmate. Short sentences, one idea each.
- Say "we". Say what we do not know.
- Put numbers in tables, with units.
- Use commas, colons or parentheses instead of dashes between clauses. The checker rejects em dashes, en dashes, curly quotes, emojis and a short list of filler words.
- Cite sources with `[@key]` as explained in [Citing sources](#citing-sources). Papers can still be named as "Author (year)" in the sentence, followed by the citation.

## Plain words first

Every doc starts with `## In plain words`: two to four sentences a ten year old could follow. No jargon in that section. If you need a term, explain it or link it to the [glossary](../reference/0004-glossary.md).

To add a term, add an entry to `docs/_system/glossary.json` with `simple`, `analogy` and `precise` text, then run `python3 scripts/docs.py index`. The glossary page and the dashboard's Learn tab both update from that one file.

## Citing sources

Every outside source we rely on (paper, book, dataset, code, web page, forum post) has one record in `docs/_system/references.json`, and [REFERENCES.md](../REFERENCES.md) lists them all as full citations with the pages that cite each one.

To cite a source in any doc, write its key in square brackets with an `@`:

- One source: `Carry has paid since the 1980s [@fama1984].`
- Several: `[@fama1984; @lustig2011]`.

The key is the heading above the entry in [REFERENCES.md](../REFERENCES.md). Papers and books get the first author and year, like `fama1984`; other sources get `url-` and a short code. `docs.py check` fails on a key that does not exist, and `docs.py index` adds a "Sources cited" list to the bottom of the doc.

To add a new source:

1. Put its link in the doc, catalog entry or reading list where you use it.
2. Run `python3 scripts/references.py`. It finds every link in `docs/` and `catalog/`, fills in authors, title and journal from Crossref and arXiv where it can, merges duplicates and keeps existing keys unchanged.
3. Run `python3 scripts/docs.py index` to rebuild [REFERENCES.md](../REFERENCES.md), then cite it with its new key.

The [reading list](../research/0001-reading-list.md) stays the place to say why a paper matters; its entries are picked up automatically.

`docs.py check` fails if any link in `docs/` or `catalog/` is missing from `references.json`, so a new source cannot slip in unrecorded. Whether a source's claims were checked comes from `catalog/verification/sources.json` when that file exists.

## Logs

Add a log entry at the end of each working session with what happened, what was decided and what is still open. Log entries are never edited after they are merged. If something in an old entry was wrong, say so in a new one and link back.

## Commands

| Command | What it does |
| --- | --- |
| `make docs` | Fix mechanical issues, rebuild the indexes, then check everything. |
| `python3 scripts/docs.py check` | Check only. |
| `python3 scripts/docs.py index` | Rebuild [docs/README.md](../README.md), [TAGS.md](../TAGS.md), [REFERENCES.md](../REFERENCES.md) and the backlinks. |
| `python3 scripts/references.py` | Rebuild `docs/_system/references.json` from every link in the docs and catalog. |
| `python3 scripts/docs.py fix` | Trailing spaces, final newlines, sorted tags, then index. |

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0004: Docs follow strict rules that a script checks on every commit](../decisions/0004-docs-are-checked-by-a-script.md)
- [DEC-0010: Every source we rely on is in one checked bibliography](../decisions/0010-every-source-in-one-bibliography.md)
- [GDE-0001: Getting started](0001-getting-started.md)
- [GDE-0004: The research routine](0004-the-research-routine.md)
- [REF-0017: Parity copy rules](../reference/0017-parity-copy-rules.md)
<!-- backlinks:end -->
