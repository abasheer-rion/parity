"""`parity new-strategy`: create every file a new strategy needs, in one step.

It writes a strategy file that runs but holds nothing, a unit test, a catalog
entry with TODO placeholders, and the catalog page (via scripts/docs.py index).
The rule itself is left for you to write. See docs/guides/0002-adding-a-strategy.md.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

from . import ledger, strategies
from .strategies.base import ASSETS, FAMILIES

REPO_ROOT = ledger.ROOT

# Our short family and asset labels, mapped to the catalog's allowed values
# (docs/_system/catalog.json).
CATALOG_FAMILY = {"carry": "carry", "trend": "momentum-trend", "value": "value-mean-reversion",
                  "calendar": "seasonality-calendar", "volatility": "volatility",
                  "mixed": "portfolio-construction", "benchmark": "portfolio-construction"}
CATALOG_MARKETS = {"fx": ["fx"], "stocks": ["equities"], "commodities": ["commodities"],
                   "mixed": ["multi-asset"]}
CATALOG_HORIZONS = ("intraday", "daily", "weekly", "monthly", "quarterly")
DEFAULT_STYLE = {"carry": "risk premium", "trend": "momentum", "value": "mean reversion",
                 "calendar": "seasonal", "volatility": "risk timing", "mixed": "blend",
                 "benchmark": "buy and hold"}

# What the placeholder strategy holds, by asset. All flat until the rule is written.
INSTRUMENTS = {
    "fx": ('[f"fx.{c}" for c in G10]', "from ..data.catalog import G10\n", False),
    "stocks": ('["eq.US_TOTAL", "cash.USD"]', "", True),
    "commodities": ('["cmd.BRENT", "cmd.HH_GAS"]', "", False),
    "mixed": ('["eq.US_TOTAL", "cash.USD"] + [f"fx.{c}" for c in G10]',
              "from ..data.catalog import G10\n", True),
}

ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")


class ScaffoldError(ValueError):
    pass


def make_id(display_name: str) -> str:
    sid = re.sub(r"[^a-z0-9]+", "_", display_name.lower()).strip("_")
    return sid if sid and sid[0].isalpha() else f"s_{sid}"


def class_name(sid: str) -> str:
    return "".join(p.capitalize() for p in sid.split("_") if p) or "NewStrategy"


def _catalog_horizon(horizon: str) -> str:
    if horizon in CATALOG_HORIZONS:
        return horizon
    return "quarterly" if "month" in horizon and horizon != "monthly" else "monthly"


def _next_alg_number(catalog_dir: Path) -> int:
    nums = []
    for p in catalog_dir.glob("*.json"):
        m = re.fullmatch(r"ALG-(\d{4})", json.loads(p.read_text()).get("id", ""))
        if m:
            nums.append(int(m.group(1)))
    return max(nums, default=0) + 1


def strategy_source(sid: str, display_name: str, description: str, tags: dict,
                    reference: str) -> str:
    instruments, extra_import, funded = INSTRUMENTS[tags["asset"]]
    funded_line = "    funded = True  # it invests its own capital (stocks or cash)\n" if funded \
        else ""
    return f'''"""{display_name}.

TODO: say in a few plain sentences what this bets on and why it might work.
Catalog entry: catalog/algorithms/{sid.replace("_", "-")}.json.
"""

from __future__ import annotations

import pandas as pd

{extra_import}from . import register
from ._util import hold_between_rebalances
from .base import Strategy


@register
class {class_name(sid)}(Strategy):
    name = "{sid}"
    display_name = {json.dumps(display_name)}
    description = {json.dumps(description)}
    tags = {{"family": {json.dumps(tags["family"])}, "asset": {json.dumps(tags["asset"])},
            "style": {json.dumps(tags["style"])}, "horizon": {json.dumps(tags["horizon"])}}}
    summary = "TODO: one plain sentence on what it bets on."
    reference = "{reference}"
{funded_line}    param_grid: dict[str, list] = {{}}  # TODO: a few nearby settings for the gauntlet

    def instruments(self) -> list[str]:
        return {instruments}

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        # TODO: write the rule. Use data up to each date only; the backtester holds
        # the weights from the next day. Until then it holds nothing (all zeros).
        w = pd.DataFrame(0.0, index=panel.index, columns=self.instruments())
        return hold_between_rebalances(w, "M")
'''


def test_source(sid: str) -> str:
    return f'''"""Checks for the {sid} strategy. Add tests for the rule once it is written."""

import numpy as np

from parity import strategies
from parity.backtest import BacktestConfig, run
from parity.strategies.base import TAG_KEYS


def test_{sid}_is_registered_with_labels():
    cls = strategies.available()["{sid}"]
    assert cls.display_name and cls.description
    assert set(cls.tags) == set(TAG_KEYS)


def test_{sid}_runs_on_test_data(panel):
    strat = strategies.get("{sid}")
    res = run(strat, panel, BacktestConfig(start=None))
    assert np.isfinite(res.returns).all()
    assert res.weights.abs().sum(axis=1).max() <= strat.max_gross + 1e-9
'''


def catalog_entry(alg_id: str, sid: str, display_name: str, tags: dict, today: str) -> dict:
    todo = "TODO"
    return {
        "id": alg_id,
        "slug": sid.replace("_", "-"),
        "name": display_name,
        "family": CATALOG_FAMILY[tags["family"]],
        "markets": CATALOG_MARKETS[tags["asset"]],
        "horizon": _catalog_horizon(tags["horizon"]),
        "tags": ["our-idea", tags["style"].replace(" ", "-")],
        "origin": {"type": "practitioner", "first_published": dt.date.fromisoformat(today).year,
                   "authors": "Parity team",
                   "source_title": f"{todo}: where the idea comes from", "source_url": ""},
        "how_it_works": {"simple": f"{todo}: explain it so a child could follow.",
                         "analogy": f"{todo}: an everyday comparison.",
                         "precise": f"{todo}: the exact mechanism, for a specialist."},
        "rule": f"{todo}: the exact trading rule, with every number in it.",
        "data_needed": [f"{todo}: each series the rule reads"],
        "economic_rationale": f"{todo}: why it might work.",
        "why_it_might_fail": f"{todo}: why it might not.",
        "reported_results": [],
        "post_publication_evidence": "",
        "implementations": [{"url": f"engine/src/parity/strategies/{sid}.py",
                             "language": "Python", "license": "private",
                             "notes": "Our implementation."}],
        "relevance": {"score": 3, "reason": f"{todo}: why this matters to us."},
        "testable_with_free_data": True,
        "created": today,
        "last_reviewed": today,
        "research": {"stage": 1, "hypothesis": None, "strategy": sid, "registrations": [],
                     "runs": [], "verdict": None, "notes": ""},
    }


def next_steps(sid: str, slug: str) -> list[str]:
    return [
        f"Write the rule: replace the TODO in engine/src/parity/strategies/{sid}.py, and fill "
        f"the TODOs in catalog/algorithms/{slug}.json. Then run "
        "`python3 scripts/docs.py index`.",
        'Write the hypothesis before looking at results: `python3 scripts/docs.py new '
        'hypothesis "Your claim"`, then set research.hypothesis in the catalog entry.',
        "Test it: `make test`.",
        f"Register it: add registrations/REG-NNNN-{slug}.json naming {sid} and its exact "
        "settings, commit it, then `parity registration check REG-NNNN`.",
        f"Run it: `parity run {sid}` to explore, `parity official REG-NNNN` for the record.",
        f"Analyse it: `parity analyse {sid}` writes strengths and weaknesses to "
        f"engine/output/analysis/{sid}.md.",
    ]


def scaffold(display_name: str, family: str, asset: str, style: str | None = None,
             horizon: str | None = None, sid: str | None = None, description: str | None = None,
             root: Path = REPO_ROOT, dry_run: bool = False, build_docs: bool = True,
             today: str | None = None) -> dict:
    """Create the files for a new strategy under `root`. Returns what it made (or would
    make with dry_run) and the next steps. Refuses if the id is taken."""
    root = Path(root)
    today = today or dt.date.today().isoformat()
    if family not in FAMILIES:
        raise ScaffoldError(f"family must be one of: {', '.join(FAMILIES)}")
    if asset not in ASSETS:
        raise ScaffoldError(f"asset must be one of: {', '.join(ASSETS)}")
    sid = sid or make_id(display_name)
    if not ID_RE.match(sid):
        raise ScaffoldError(f"id '{sid}' must be lower case letters, digits and underscores")
    tags = {"family": family, "asset": asset, "style": style or DEFAULT_STYLE[family],
            "horizon": horizon or "monthly"}
    slug = sid.replace("_", "-")
    strat_path = root / "engine/src/parity/strategies" / f"{sid}.py"
    test_path = root / "engine/tests" / f"test_strategy_{sid}.py"
    catalog_dir = root / "catalog/algorithms"
    catalog_path = catalog_dir / f"{slug}.json"

    if sid in strategies.available():
        raise ScaffoldError(f"a strategy named '{sid}' already exists")
    for p in (strat_path, test_path, catalog_path):
        if p.exists():
            raise ScaffoldError(f"{p} already exists")

    n = _next_alg_number(catalog_dir) if catalog_dir.exists() else 1
    alg_id = f"ALG-{n:04d}"
    doc_rel = f"algorithms/{n:04d}-{slug}.md"
    description = description or "TODO: one short plain sentence for people."
    files = {
        strat_path: strategy_source(sid, display_name, description, tags, doc_rel),
        test_path: test_source(sid),
        catalog_path: json.dumps(catalog_entry(alg_id, sid, display_name, tags, today),
                                 indent=2) + "\n",
    }
    doc_path = root / "docs" / doc_rel
    out = {"id": sid, "catalog_id": alg_id, "tags": tags,
           "files": [str(p.relative_to(root)) for p in files] + [f"docs/{doc_rel}"],
           "doc": "not built", "next_steps": next_steps(sid, slug), "dry_run": dry_run}
    if dry_run:
        out["doc"] = "dry run"
        return out
    for path, text in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    docs_script = root / "scripts" / "docs.py"
    if build_docs and docs_script.exists():
        proc = subprocess.run([sys.executable, str(docs_script), "index"], cwd=root,
                              capture_output=True, text=True)
        if proc.returncode == 0 and doc_path.exists():
            out["doc"] = "built"
        else:
            out["doc"] = f"failed: {(proc.stderr or proc.stdout).strip()[-300:]}"
    return out
