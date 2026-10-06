"""Build a Thai study PDF from work/<doc>/source.json + work/<doc>/th/*.md.

Translation markup (th/*.md, concatenated in name order):
  === S001            start of a unit (must match source ids, in order)
  # text              slide title
  - text / "  - "     bullet / sub-bullet (two spaces per level)
  ```                 code block fence
  > text              note box
  --- notes           switch to speaker-notes section of the current unit
  anything else       paragraph

Usage: python3 tools/build.py <doc-stem> "<Thai title>"
"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LABELS = {"S": "สไลด์", "P": "หน้า", "L": "ส่วน"}
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

CSS = """
@page { size: A4; margin: 1.5cm; }
body { margin: 0; font-family: "Sarabun", "Loma", sans-serif; font-size: 8pt; line-height: 1.35; color: #000; }
.cols { column-count: 2; column-gap: 0.6cm; column-rule: 0.5pt solid #ccc; }
h1 { font-size: 12pt; margin: 0 0 2pt; line-height: 1.25; }
.sub { color: #333; margin: 0 0 6pt; }
.unit { margin: 0 0 5pt; }
.unit + .unit { border-top: 0.5pt solid #999; padding-top: 4pt; }
.tag { font-weight: bold; color: #444; margin: 0 0 2pt; break-after: avoid; }
.unit img { display: block; width: 62%; margin: 0 0 3pt; border: 0.5pt solid #bbb; break-inside: avoid; break-after: avoid; }
h2 { font-size: 9pt; margin: 2pt 0 2pt; line-height: 1.3; break-after: avoid; }
h3 { font-size: 8pt; margin: 3pt 0 1pt; color: #333; break-after: avoid; }
p { margin: 0 0 2pt; }
ul { margin: 0 0 2pt; padding-left: 1.1em; }
li { margin: 0 0 1pt; }
.notes { border-left: 1.5pt solid #888; padding: 0 0 0 5pt; margin-top: 3pt; }
.box { border-left: 1.5pt solid #888; padding: 0 0 0 5pt; margin: 2pt 0 3pt; }
pre { font-family: "Liberation Mono", monospace; font-size: 7pt; line-height: 1.25; border: 0.5pt solid #bbb;
      padding: 2pt 4pt; white-space: pre-wrap; word-break: break-all; margin: 2pt 0 3pt; }
code { font-family: "Liberation Mono", monospace; font-size: 7pt; }
table { border-collapse: collapse; margin: 2pt 0 3pt; break-inside: avoid; }
th, td { border: 0.5pt solid #999; padding: 1pt 3pt; text-align: left; vertical-align: top; }
th { font-weight: bold; }
.lab .unit + .unit { border-top: none; padding-top: 0; }
.lab h2 { font-size: 10pt; border-bottom: 0.5pt solid #999; padding-bottom: 1pt; margin-top: 6pt; }
"""


def inline(t):
    t = html.escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", t)


def parse(text):
    """Return {unit_id: {"body": [lines], "notes": [lines]}} preserving order."""
    units, cur, sect = {}, None, "body"
    for ln in text.split("\n"):
        m = re.match(r"^=== ([SP]\d{3}|L\d{3})\s*$", ln)
        if m:
            cur, sect = m.group(1), "body"
            if cur in units:
                raise SystemExit(f"duplicate unit {cur}")
            units[cur] = {"body": [], "notes": []}
        elif ln.strip() == "--- notes":
            sect = "notes"
        elif cur:
            units[cur][sect].append(ln)
    return units


def render_lines(lines):
    out, stack, code, table = [], [], None, []

    def flush_table():
        if table:
            rows = []
            for i, r in enumerate(table):
                tag = "th" if i == 0 else "td"
                rows.append("<tr>" + "".join(f"<{tag}>{inline(c.strip())}</{tag}>" for c in r.strip().strip("|").split("|")) + "</tr>")
            out.append("<table>" + "".join(rows) + "</table>")
            table.clear()

    def close_lists(level=0):
        while len(stack) > level:
            out.append("</li></ul>")
            stack.pop()

    for ln in lines:
        if code is not None:
            if ln.strip() == "```":
                out.append("<pre>" + html.escape("\n".join(code)) + "</pre>")
                code = None
            else:
                code.append(ln)
            continue
        if ln.strip() == "```":
            close_lists()
            code = []
            continue
        if ln.startswith("|"):
            close_lists()
            table.append(ln)
            continue
        flush_table()
        if not ln.strip():
            continue
        m = re.match(r"^( *)- (.*)$", ln)
        if m:
            level = len(m.group(1)) // 2 + 1
            if len(stack) >= level:
                close_lists(level)
                out.append(f"</li><li>{inline(m.group(2))}")
            else:
                while len(stack) < level:
                    out.append("<ul><li>")
                    stack.append(1)
                out[-1] += inline(m.group(2))
            continue
        close_lists()
        if ln.startswith("## "):
            out.append(f"<h2>{inline(ln[3:])}</h2>")
        elif ln.startswith("# "):
            out.append(f"<h2>{inline(ln[2:])}</h2>")
        elif ln.startswith("### "):
            out.append(f"<h3>{inline(ln[4:])}</h3>")
        elif ln.startswith("> "):
            out.append(f'<div class="box">{inline(ln[2:])}</div>')
        else:
            out.append(f"<p>{inline(ln)}</p>")
    flush_table()
    close_lists()
    return "\n".join(out)


def main(stem, title):
    d = ROOT / "work" / stem
    src = json.loads((d / "source.json").read_text())
    th = parse("\n".join(p.read_text() for p in sorted((d / "th").glob("*.md"))))
    is_lab = src.get("kind") == "lab"
    parts = [f"<h1>{html.escape(title)}</h1>",
             f'<p class="sub">แปลและเรียบเรียงจากไฟล์ต้นฉบับ <b>{html.escape(src["file"])}</b>'
             + f' · ครบทั้ง {len(src["units"])} {LABELS[src["units"][0]["id"][0]]}' 
             + "</p>", '<div class="cols">']
    n = len(src["units"])
    for u in src["units"]:
        t = th.get(u["id"], {"body": ["(ยังไม่ได้แปล)"], "notes": []})
        label = LABELS[u["id"][0]]
        block = ['<section class="unit">']
        block.append(f'<div class="tag">{label} {int(u["id"][1:])} / {n}</div>')
        block.append(render_lines(t["body"]))
        if any(x.strip() for x in t["notes"]):
            block.append('<div class="notes"><h3>คำบรรยายประกอบสไลด์ (Speaker notes)</h3>'
                         + render_lines(t["notes"]) + "</div>")
        block.append("</section>")
        parts.append("\n".join(block))
    doc = (f'<!doctype html><html lang="th"><head><meta charset="utf-8"><title>{html.escape(title)}</title>'
           f"<style>{CSS}</style></head><body class=\"{'lab' if is_lab else ''}\">" + "\n".join(parts) + "</div></body></html>")
    out_html = d / "th.html"
    out_html.write_text(doc)
    out_pdf = ROOT / "output" / f"{stem}-TH.pdf"
    subprocess.run([CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                    "--allow-file-access-from-files", f"--print-to-pdf={out_pdf}", out_html.as_uri()],
                   check=True, capture_output=True)
    print(out_pdf)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
