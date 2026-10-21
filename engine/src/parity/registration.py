"""Pre-registration: write down exactly what will be run, and how it will be
judged, before running it. See docs/decisions/0007-official-results-come-only-from-the-ledger.md.

A registration is a JSON file in registrations/. An official run will only start if:

  * the registration file is committed to git,
  * it is byte-for-byte the same as when it was first committed (to change a plan,
    write a new registration; the old one stays as a record),
  * the working tree has no uncommitted changes,
  * every strategy it names exists, with exactly the parameters it lists.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from . import ledger, strategies

DIR = ledger.ROOT / "registrations"
ID_RE = re.compile(r"^REG-\d{4}$")
REQUIRED = ("id", "title", "created", "authors", "hypotheses", "question", "strategies",
            "backtest", "pass_criteria", "prior_trials", "what_would_change_our_mind")


@dataclass
class Registration:
    data: dict
    path: Path

    @property
    def id(self) -> str:
        return self.data["id"]


def path_for(reg_id: str) -> Path:
    matches = sorted(DIR.glob(f"{reg_id}-*.json"))
    if len(matches) != 1:
        raise FileNotFoundError(f"Expected exactly one file for {reg_id} in registrations/")
    return matches[0]


def load(reg_id: str) -> Registration:
    path = path_for(reg_id)
    return Registration(json.loads(path.read_text()), path)


def problems(reg: Registration, require_committed: bool = True,
             require_clean: bool = True) -> list[str]:
    out = []
    d = reg.data
    for key in REQUIRED:
        if key not in d:
            out.append(f"missing field '{key}'")
    if not ID_RE.match(d.get("id", "")):
        out.append("id must look like REG-0001")
    if not reg.path.name.startswith(d.get("id", "?") + "-"):
        out.append("file name must start with the id")
    known = strategies.available()
    for s in d.get("strategies", []):
        name = s.get("name")
        if name not in known:
            out.append(f"unknown strategy '{name}'")
            continue
        try:
            known[name](**s.get("params", {}))
        except TypeError as exc:
            out.append(f"bad params for {name}: {exc}")
    if require_committed:
        first = ledger.first_committed_version(reg.path)
        if first is None:
            out.append("not committed to git yet; commit the plan before running it")
        elif first[1].strip() != reg.path.read_text().strip():
            out.append(f"changed since it was first committed in {first[0][:8]}; plans are "
                       "frozen, write a new registration instead")
        if require_clean and ledger.git_state()["dirty"]:
            out.append("uncommitted changes in the working tree; "
                       "official runs need a clean checkout")
    return out


def all_registrations() -> list[Registration]:
    return [Registration(json.loads(p.read_text()), p) for p in sorted(DIR.glob("REG-*.json"))]
