"""Merge docs/_system/references.json during a rebase: stage 2 (base) and 3 (mine)."""
import json, subprocess
def stage(n):
    return json.loads(subprocess.run(["git", "show", f":{n}:docs/_system/references.json"], capture_output=True, check=True).stdout.decode("utf-8"))
base, mine = stage(2), stage(3)
bk = {r["key"]: r for r in base["references"]}
out = {r["key"]: r for r in mine["references"]}
added = 0
for k, r in bk.items():
    if k not in out:
        out[k] = r; added += 1
    else:
        u = out[k].setdefault("used_in", [])
        for x in r.get("used_in", []):
            if x not in u: u.append(x)
mine["references"] = sorted(out.values(), key=lambda r: r["key"])
for k in base:
    if k != "references" and k not in mine: mine[k] = base[k]
open("docs/_system/references.json", "w", encoding="utf-8", newline="\n").write(json.dumps(mine, indent=2, ensure_ascii=False) + "\n")
print("added from base:", added, "total:", len(mine["references"]))
