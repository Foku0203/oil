"""Print units of a doc compactly: python3 tools/dump.py <stem> [from] [to]"""
import json, re, sys
from pathlib import Path
d = json.loads((Path(__file__).resolve().parent.parent / "work" / sys.argv[1] / "source.json").read_text())
a = int(sys.argv[2]) if len(sys.argv) > 2 else 1
b = int(sys.argv[3]) if len(sys.argv) > 3 else 9999
for u in d["units"]:
    if a <= int(u["id"][1:]) <= b:
        print("=== " + u["id"]); print("\n".join(u["texts"]))
        have = re.sub(r"\W+", "", " ".join(u["texts"])).lower()
        extra = [l for l in u.get("rendered", []) if re.sub(r"\W+", "", l).lower() not in have and not l.startswith("•")]
        if extra: print("--- (diagram text only in rendered slide)"); print("\n".join(extra))
        if u["notes"]: print("--- notes"); print("\n".join(u["notes"]))
