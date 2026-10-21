"""The ledger: an append-only, hash-chained record of official runs and the data
they used. See docs/decisions/0007-official-results-come-only-from-the-ledger.md.

Each line of ledger/runs.jsonl is one entry. Every entry carries the hash of the
entry before it, and its own hash over its contents. Changing, deleting or
reordering any past entry breaks every hash after it, which `parity ledger verify`
(and CI) catches. Only the official-run workflow appends here; people never edit
these files by hand.

Full details of each run sit next to the chain in ledger/runs/RUN-xxxxxx.json, and
its hash is stored in the chain entry, so the detail file cannot be edited either.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
LEDGER = ROOT / "ledger"
CHAIN = LEDGER / "runs.jsonl"
DETAILS = LEDGER / "runs"
GENESIS = "0" * 64


def canonical(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True,
                      default=str).encode()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def entries(path: Path = CHAIN) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def next_run_id(path: Path = CHAIN) -> str:
    return f"RUN-{len(entries(path)) + 1:06d}"


def append(record: dict, details: dict, path: Path = CHAIN) -> dict:
    """Add one run. `record` is the short summary kept in the chain; `details` is the
    full result written beside it. Returns the chain entry."""
    existing = entries(path)
    problems = verify(path)
    if problems:
        raise RuntimeError("Refusing to append to a broken ledger: " + "; ".join(problems))
    run_id = f"RUN-{len(existing) + 1:06d}"
    details = {**details, "run_id": run_id}
    detail_bytes = json.dumps(details, indent=1, sort_keys=True, default=str).encode() + b"\n"
    DETAILS.mkdir(parents=True, exist_ok=True)
    (DETAILS / f"{run_id}.json").write_bytes(detail_bytes)
    entry = {
        "seq": len(existing) + 1,
        "run_id": run_id,
        "recorded_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "prev": existing[-1]["hash"] if existing else GENESIS,
        "details_sha256": sha256(detail_bytes),
        **record,
    }
    entry["hash"] = sha256(canonical({k: v for k, v in entry.items() if k != "hash"}))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as fh:
        fh.write(json.dumps(entry, sort_keys=True, separators=(",", ":")) + "\n")
    return entry


def verify(path: Path = CHAIN, details_dir: Path | None = None) -> list[str]:
    """Return a list of problems. An empty list means the chain is intact."""
    details_dir = details_dir or DETAILS
    problems = []
    prev = GENESIS
    for i, entry in enumerate(entries(path), start=1):
        rid = entry.get("run_id", f"line {i}")
        if entry.get("seq") != i:
            problems.append(f"{rid}: sequence number {entry.get('seq')} should be {i}")
        if entry.get("prev") != prev:
            problems.append(f"{rid}: previous hash does not match the entry before it")
        body = {k: v for k, v in entry.items() if k != "hash"}
        if sha256(canonical(body)) != entry.get("hash"):
            problems.append(f"{rid}: contents do not match its hash (edited after recording)")
        detail = details_dir / f"{rid}.json"
        if not detail.exists():
            problems.append(f"{rid}: details file is missing")
        elif sha256(detail.read_bytes()) != entry.get("details_sha256"):
            problems.append(f"{rid}: details file was changed after recording")
        prev = entry.get("hash")
    return problems


def details(run_id: str) -> dict:
    return json.loads((DETAILS / f"{run_id}.json").read_text())


def trials_so_far(strategy_names: list[str], path: Path = CHAIN) -> int:
    """How many strategy evaluations the ledger already holds for these strategies,
    counting each run's gauntlet variants. Used as a floor for the trial count."""
    total = 0
    for entry in entries(path):
        for name, summary in entry.get("results", {}).items():
            if name in strategy_names:
                total += int(summary.get("trials", 1))
    return total


# ---------------------------------------------------------------- git facts


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout.strip()


def git_state() -> dict:
    return {"sha": git("rev-parse", "HEAD"), "dirty": bool(git("status", "--porcelain"))}


def first_committed_version(path: Path) -> tuple[str, str] | None:
    """The commit that first added this file and the file's content at that commit."""
    rel = path.resolve().relative_to(ROOT).as_posix()
    shas = git("log", "--diff-filter=A", "--format=%H", "--", rel).split()
    if not shas:
        return None
    first = shas[-1]
    return first, git("show", f"{first}:{rel}")
