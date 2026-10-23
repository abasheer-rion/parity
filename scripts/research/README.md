# Research helper scripts

Scripts Amanda's research sessions used on 21 and 22 October 2026 to write the documents in PRs #16, #17, #18, #27 and #36. They are kept so the work can be traced and repeated. None of them is part of the engine or CI. Run them from the repo root with the engine's Python, for example `engine/.venv/bin/python scripts/research/add_refs.py . docs/research/0016-*.md`.

Reusable:

| Script | What it does |
| --- | --- |
| `add_refs.py` | Adds records for new links in the given files to `docs/_system/references.json`, without rewriting the rest. Use it instead of running `scripts/references.py` on everything, which drops hand-made fields. Paper metadata is in its `PAPERS` table. |
| `pdftext.py` | Downloads a PDF (or reads a local one) and saves its text, page by page, for reading and quoting. |
| `merge_refs.py` | During a rebase, merges the two sides of a conflicted `references.json` by key. |
| `mutate.py` | Hand-written mutation test for the EM and energy engine code: changes one line at a time and checks a test fails. |

One-off, kept for the record:

| Script | What it did |
| --- | --- |
| `new_catalog.py`, `new_catalog2.py`, `new_catalog3.py` | Wrote the algorithm catalog entries ALG-0083 to ALG-0098 and their pages. |
| `write_hyps.py`, `write_exps.py`, `write_regs.py` | Wrote HYP-0009 to HYP-0015, experiments EXP-0005 to EXP-0009, and registrations REG-0004 to REG-0008. |
| `resolve_sources.py`, `resolve_catalog.py` | Resolved the rebase of PR #17 on main's wider data sources (#30). |
| `renumber_logs.py` | Renumbered Amanda's 22 October logs to LOG-0009 to LOG-0012 after main took LOG-0008. |

The screenshots of the public front page from that session are in `docs/screenshots/2026-10-22-front-page/`. They were taken locally with headless Chrome. The narrow one is 520 pixels wide, because headless Chrome would not go narrower.
