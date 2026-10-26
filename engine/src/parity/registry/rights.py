"""What a series' display rights allow (DEC-0064).

Every place that serves data asks here: the site export, the registry's chart previews and
the research app. Four levels, widest first:

    public     anyone may see the values (with the source named where its terms ask)
    internal   team members only (DEC-0056); never the public, never a connected AI app
    research   used to compute research results; the values are never shown to anyone
    none       not used at all

A series never has wider rights than its source.
"""

from __future__ import annotations

from ..data import catalog

RANK = {"none": 0, "research": 1, "internal": 2, "public": 3}

#: Who is asking: the public site, a team member, or a computation whose output is a
#: research result (a backtest, a correlation), not the values themselves.
AUDIENCES = ("public", "team", "research")


def narrowest(*rights: str) -> str:
    return min(rights, key=lambda r: RANK[r])


def may_show(rights: str, audience: str) -> bool:
    """May the values be shown to this audience."""
    if audience not in AUDIENCES:
        raise ValueError(f"unknown audience {audience!r}")
    need = {"public": "public", "team": "internal", "research": "research"}[audience]
    return RANK[rights] >= RANK[need]


def may_use(rights: str, use: str) -> bool:
    """May a series with these rights be enrolled for this use. Research needs any rights
    but none; a team feed needs internal or wider; showing on the public site needs public."""
    need = {"research": "research", "feed": "internal", "display": "public"}[use]
    return RANK[rights] >= RANK[need]


def catalog_rights(s: catalog.Series) -> str:
    """Display rights for a curated catalog series, from the terms the terminal export
    already records per source and agency (REF-0010). Data the terms keep off the site but
    allow for research (IMF prices, S&P index levels) is research-only; Yahoo is cross-check
    only, so none."""
    from .. import terminal

    if s.source == "yahoo":
        return "none"
    term = terminal.TERMS.get(terminal.terms_for(s))
    if term is None:
        return "research"
    return "public" if term[2] else "research"


def series_rights(key: str) -> str:
    """Display rights for any series key: the registry's record if it has one, else the
    catalog's terms, else none."""
    from . import db

    rec = db.lookup(key)
    if rec is not None:
        return rec["display_rights"]
    s = catalog.CATALOG.get(key)
    return catalog_rights(s) if s else "none"
