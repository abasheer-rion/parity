"""Give Amanda's 22 October logs fixed IDs after main took LOG-0008. Idempotent."""
import pathlib, re
LOGS = {
    "2026-10-22-emerging-markets-energy-futures-and-the-next-official-runs.md": ("LOG-0009", None),
    "2026-10-22-lesser-known-strategies-and-published-firm-research.md": ("LOG-0010", "LOG-0009"),
    "2026-10-22-combining-many-strategies-and-rebasing-on-the-factory.md": ("LOG-0011", "LOG-0010"),
    "2026-10-22-crisis-behaviour-and-a-check-of-sim-world.md": ("LOG-0012", "LOG-0011"),
}
for name, (new, prev) in LOGS.items():
    p = pathlib.Path("docs/log") / name
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    t = re.sub(r"(?m)^id: LOG-\d{4}$", f"id: {new}", t, count=1)
    if prev:
        t = re.sub(r"(?m)^(related: \[)LOG-\d{4}", rf"\g<1>{prev}", t, count=1)
    t = t.replace("Logs were renumbered to LOG-0008 and LOG-0009 because Ayan's log took LOG-0007.",
                  "Logs were renumbered because Ayan's logs took LOG-0007 and LOG-0008; they are now LOG-0009 and LOG-0010.")
    p.write_text(t, encoding="utf-8", newline="\n")
