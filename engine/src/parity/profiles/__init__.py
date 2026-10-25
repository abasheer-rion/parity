"""Competitor profiles: public feedback on the trading products we study (CMP docs),
collected only from sources whose terms allow it, scored by simple rules.

    sources.py   where we look, and each source's terms
    net.py       one polite HTTP session that obeys robots.txt
    signals.py   sentiment and themes from a piece of text
    store.py     the local SQLite store, with dedupe and retention
    collect.py   one pass, the summary for the site, and the daily hook for the sims
    cli.py       `parity profiles ...`
"""
