"""The contract every strategy follows.

A strategy is a small class that turns a panel of market data into target
portfolio weights. It does not trade, size for volatility, or charge costs; the
backtester does that the same way for every strategy so results are comparable.

To add one, drop a new file in this folder and decorate the class with
@register. To remove one, delete the file. Nothing else needs to change.
See docs/decisions/0003-strategies-are-plugins.md.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import ClassVar

import pandas as pd

TAG_KEYS = ("family", "asset", "style", "horizon")
FAMILIES = ("carry", "trend", "value", "calendar", "volatility", "mixed", "benchmark")
ASSETS = ("fx", "stocks", "commodities", "mixed")


class Strategy(ABC):
    #: Short unique id, used in the CLI, the database and the dashboard.
    name: ClassVar[str]
    #: One plain sentence on what the strategy bets on.
    summary: ClassVar[str]
    #: Name people see on the dashboard, e.g. "Currency carry". Falls back to `name`.
    display_name: ClassVar[str] = ""
    #: One short plain sentence for people. Falls back to `summary`.
    description: ClassVar[str] = ""
    #: Labels for grouping and filtering. Keys are exactly TAG_KEYS.
    #: family: carry, trend, value, calendar, volatility, mixed or benchmark
    #: asset: fx, stocks, commodities or mixed
    #: style: a short phrase, e.g. "momentum", "mean reversion", "risk premium"
    #: horizon: how often it trades, e.g. "daily", "monthly", "multi-month"
    tags: ClassVar[dict[str, str]] = {}
    #: Link to the hypothesis or paper this tests, relative to docs/.
    reference: ClassVar[str] = ""
    #: Treat as a benchmark rather than a candidate strategy.
    is_benchmark: ClassVar[bool] = False
    #: Nearby settings the gauntlet tries, to see if the result depends on one lucky choice.
    #: Keys are __init__ arguments. Keep it small; every combination counts as a trial.
    param_grid: ClassVar[dict[str, list]] = {}
    #: Largest sum of absolute weights the strategy may hold. Overlays exceed 1.
    max_gross: ClassVar[float] = 1.0
    #: True if the strategy invests its capital (stocks, cash). False for self-financing
    #: long-short currency books, whose collateral earns the T-bill on top. See DEC-0009.
    funded: ClassVar[bool] = False

    @abstractmethod
    def instruments(self) -> list[str]:
        """Catalog keys of the prices the strategy holds, e.g. ["fx.EUR", "fx.JPY"]."""

    def required(self) -> list[str]:
        """Every catalog key the strategy reads. Defaults to its instruments."""
        return self.instruments()

    @abstractmethod
    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        """Target weights decided at each date's close, one column per instrument.

        Weights at date t may only use data up to and including t. The backtester
        holds them from t+1, so there is no need to shift them here.
        """

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame | None:
        """Optional raw forecast before it becomes weights.

        If provided, the dashboard shows how well it predicts future returns
        (the information coefficient) at several horizons.
        """
        return None

    def params(self) -> dict:
        return {k: v for k, v in vars(self).items() if not k.startswith("_")}

    @classmethod
    def label(cls) -> dict:
        """display_name, description and tags with safe defaults, for reports."""
        tags = {k: str(cls.tags.get(k) or "unknown") for k in TAG_KEYS}
        return {"display_name": cls.display_name or cls.name,
                "description": cls.description or cls.summary,
                "tags": tags}
