"""Markets for the product side: crypto prices, perpetual futures, the US ETF universe
and a "new and trending" feed. Every source is free, needs no key and is optional, so a
dead endpoint never stops anything else. See docs/reference (markets, crypto, perps and
ETF data) and DEC-0016."""

from . import export, sources, stats, store, themes

__all__ = ["export", "sources", "stats", "store", "themes"]
