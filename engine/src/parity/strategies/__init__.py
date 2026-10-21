"""Strategy registry. Every module in this package is imported on first use, so a
strategy only has to exist as a file with a @register decorated class."""

from __future__ import annotations

import importlib
import pkgutil

from .base import Strategy

_REGISTRY: dict[str, type[Strategy]] = {}
_loaded = False


def register(cls: type[Strategy]) -> type[Strategy]:
    if cls.name in _REGISTRY:
        raise ValueError(f"Two strategies are named '{cls.name}'")
    _REGISTRY[cls.name] = cls
    return cls


def _load_all() -> None:
    global _loaded
    if _loaded:
        return
    for mod in pkgutil.iter_modules(__path__):
        if mod.name != "base" and not mod.name.startswith("_"):
            importlib.import_module(f"{__name__}.{mod.name}")
    _loaded = True


def available() -> dict[str, type[Strategy]]:
    _load_all()
    return dict(sorted(_REGISTRY.items()))


def get(name: str, **params) -> Strategy:
    strategies = available()
    if name not in strategies:
        raise KeyError(f"No strategy named '{name}'. Known: {', '.join(strategies)}")
    return strategies[name](**params)


__all__ = ["Strategy", "register", "available", "get"]
