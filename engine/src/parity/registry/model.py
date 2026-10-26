"""The fields of the registry and the words allowed in them (DEC-0064).

The same names and checks are in supabase/migrations/20261107000000_data_registry.sql, so a
row that passes here is accepted there.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

#: public: anyone may see the values. internal: team members only (DEC-0056). research:
#: used to compute research results, values never shown. none: not used at all.
DISPLAY_RIGHTS = ("public", "internal", "research", "none")
#: candidate: found, not yet accepted. enrolled: passed the gate. live: data arriving and
#: fresh. degraded: late, stale or failing. retired: dead too long, or removed.
STATUSES = ("candidate", "enrolled", "live", "degraded", "retired")
HEALTH = ("ok", "late", "stale", "dead", "idle", "unknown")
ORIGINS = ("catalog", "discovered", "live")
USES = ("research", "feed", "display")
FREQUENCIES = ("T", "D", "W", "M", "Q", "A")
EVENT_KINDS = ("seeded", "discovered", "enrolled", "rejected", "status", "health", "retry",
               "failover", "retired", "backtest", "licence", "schema")
LINEAGE_KINDS = ("strategy", "page", "feed", "search", "derived")
SOURCE_STATUSES = ("on", "off", "planned", "no key", "team")

ASSET_CLASSES = ("fx", "rates", "credit", "equity", "commodity", "crypto", "macro",
                 "positioning", "volatility", "property", "factor", "other")
THEMES = ("fx", "rates", "money", "inflation", "credit", "equity", "factor", "energy",
          "metals", "agriculture", "crypto", "macro", "positioning", "volatility",
          "property", "funds", "other")


@dataclass
class Source:
    id: str
    name: str
    display_rights: str
    provider: str = ""
    access_method: str = ""
    licence: str = ""
    terms_url: str = ""
    terms_read_on: str | None = None  # ISO date
    cost: str = ""
    rate_limit: str = ""
    key_name: str | None = None  # name of the environment or vault entry, never the value
    status: str = "on"
    note: str = ""

    def row(self) -> dict:
        return asdict(self)


@dataclass
class Record:
    """One series in the registry: metadata and state, never values."""

    id: str
    source_id: str
    name: str
    frequency: str
    status: str
    display_rights: str
    code: str = ""
    symbol: str = ""
    asset_class: str = "other"
    region: str = ""
    units: str = ""
    start_date: str | None = None
    end_date: str | None = None
    published_after: int | None = None
    lag_days: int = 0
    tags: list[str] = field(default_factory=list)
    labels: dict = field(default_factory=dict)
    quality: float | None = None
    origin: str = "catalog"
    intended_use: str = "research"
    required: bool = False
    reason: str = ""
    discovered_by: str = ""
    discovered_at: str | None = None
    enrolled_at: str | None = None
    health: str = "unknown"
    health_checked_at: str | None = None
    health_detail: dict = field(default_factory=dict)
    last_obs: str | None = None
    backup_id: str | None = None

    def row(self) -> dict:
        return asdict(self)


def check_source(s: Source) -> None:
    if s.display_rights not in DISPLAY_RIGHTS:
        raise ValueError(f"{s.id}: display rights {s.display_rights!r} not one of {DISPLAY_RIGHTS}")
    if s.status not in SOURCE_STATUSES:
        raise ValueError(f"{s.id}: status {s.status!r} not one of {SOURCE_STATUSES}")


def check_record(r: Record) -> None:
    for name, value, allowed in (("status", r.status, STATUSES),
                                 ("display rights", r.display_rights, DISPLAY_RIGHTS),
                                 ("frequency", r.frequency, FREQUENCIES),
                                 ("origin", r.origin, ORIGINS),
                                 ("intended use", r.intended_use, USES),
                                 ("health", r.health, HEALTH)):
        if value not in allowed:
            raise ValueError(f"{r.id}: {name} {value!r} not one of {allowed}")
    if r.quality is not None and not 0 <= r.quality <= 1:
        raise ValueError(f"{r.id}: quality {r.quality} outside 0 to 1")
    if len(r.tags) > 20:
        raise ValueError(f"{r.id}: more than 20 tags")
