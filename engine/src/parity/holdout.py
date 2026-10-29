"""Frozen date boundary for research and prospective evaluation.

The research search is frozen at the date this boundary was introduced. New data
after that date is reserved for forward evaluation and must not tune candidates.
"""

from __future__ import annotations

from datetime import date

RESEARCH_CUTOFF = "2026-10-29"
HOLDOUT_START = "2026-10-30"


def clamp_config(config):
    """Return a copy whose end date cannot include the sealed holdout."""
    from .backtest import BacktestConfig

    values = config.to_dict()
    if values.get("end") is None or values["end"] > RESEARCH_CUTOFF:
        values["end"] = RESEARCH_CUTOFF
    if values.get("start") and values["start"] > RESEARCH_CUTOFF:
        raise ValueError(f"research start must be on or before {RESEARCH_CUTOFF}")
    return BacktestConfig(**values)


def forward_start(committed: str | None) -> str:
    """Start no earlier than the sealed holdout or registration's commit date."""
    start = date.fromisoformat(HOLDOUT_START)
    if committed:
        committed_day = date.fromisoformat(committed[:10])
        if committed_day >= start:
            committed_day = date.fromordinal(committed_day.toordinal() + 1)
            while committed_day.weekday() >= 5:
                committed_day = date.fromordinal(committed_day.toordinal() + 1)
            start = committed_day
    return start.isoformat()
