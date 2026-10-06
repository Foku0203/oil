"""Check a Thai translation against its source and the built PDF. Exit 1 on any problem.

Checks:
  1. every source unit (slide/page/section) has a translation, in order, none extra;
  2. a unit with slide text / notes in the source has slide text / notes in the translation;
  3. length ratio: translated text must not be much shorter than the source (catches dropped lines);
  4. tokens that must survive translation verbatim (numbers, codes, commands, AWS names with digits) are present;
  5. the built PDF contains a "สไลด์ N / total" (or "หน้า N / total") tag for every unit.

Usage: python3 tools/verify.py <doc-stem>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build import ROOT, parse  # noqa: E402

# numbers, codes, URLs and acronyms (IAM, SAML, ACLs...) are kept verbatim in the Thai text, so they must survive
TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/-]*\d[A-Za-z0-9._:/-]*|\d+|\b[A-Z][A-Z0-9]+s?\b")
MIN_RATIO = 0.55  # Thai chars per English char; real translations land around 0.8-1.1


def tokens(text):
    return {t.rstrip(".:,") for t in TOKEN.findall(text) if len(t.rstrip(".:,")) >= 1}


def chars(lines):
    return len(re.sub(r"\s+", "", "".join(lines)))


def main(stem):
    d = ROOT / "work" / stem
    src = json.loads((d / "source.json").read_text())
    th = parse("\n".join(p.read_text() for p in sorted((d / "th").glob("*.md"))))
    problems, warnings = [], []
    ids = [u["id"] for u in src["units"]]

    missing = [i for i in ids if i not in th]
    extra = [i for i in th if i not in ids]
    if missing:
        problems.append(f"missing units: {missing}")
    if extra:
        problems.append(f"unknown units: {extra}")
    if not missing and list(th)[: len(ids)] != ids:
        problems.append("units out of order")

    for u in src["units"]:
        t = th.get(u["id"])
        if not t:
            continue
        for part, s_lines, t_lines in (("slide", u["texts"] + u.get("rendered", []), t["body"]), ("notes", u["notes"], t["notes"])):
            s_len = chars(u["texts"] if part == "slide" else s_lines)
            t_len = chars([x for x in t_lines if x.strip()])
            if s_len and not t_len:
                problems.append(f"{u['id']} {part}: source has text, translation empty")
                continue
            if s_len > 80 and t_len / s_len < MIN_RATIO:
                problems.append(f"{u['id']} {part}: translation looks short ({t_len} vs {s_len} chars)")
            noise = {str(int(u["id"][1:])), "2019", "2020", "AW"}  # page number, copyright year, logo text
            lost = sorted(x for x in tokens(" ".join(s_lines)) - tokens(" ".join(t_lines))
                          if x not in noise and not re.fullmatch(r"[a-z]*\d+[a-z]+", x))
            if lost:
                warnings.append(f"{u['id']} {part}: tokens not found verbatim: {lost}")

    pdf = ROOT / "output" / f"{stem}-TH.pdf"
    if pdf.exists() and src.get("kind") != "lab":
        txt = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True).stdout
        found = {int(n) for n in re.findall(r"(?:สไลด์|หน้า)\s+(\d+)\s*/\s*" + str(len(ids)), txt)}
        absent = sorted(set(range(1, len(ids) + 1)) - found)
        if absent:
            problems.append(f"PDF missing unit tags: {absent}")
        pages = re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout)
        print(f"PDF: {pdf.name}, {pages.group(1)} pages, unit tags found {len(found)}/{len(ids)}")
    elif not pdf.exists():
        problems.append("PDF not built")

    for w in warnings:
        print("WARN ", w)
    for p in problems:
        print("FAIL ", p)
    print(f"{stem}: {len(ids)} units, {len(problems)} problems, {len(warnings)} token warnings")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main(sys.argv[1])
