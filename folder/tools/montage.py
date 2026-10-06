"""Tile slide images for quick review: python3 tools/montage.py <stem> <out.png> n1 n2 ..."""
import sys
from pathlib import Path
from PIL import Image
d = Path(__file__).resolve().parent.parent / "work" / sys.argv[1] / "img"
files = sorted(d.glob("*.jpg"))
ims = [Image.open(files[int(n) - 1]) for n in sys.argv[3:]]
w, h = ims[0].size
m = Image.new("RGB", (w * 2, h * ((len(ims) + 1) // 2)), "white")
for k, im in enumerate(ims):
    m.paste(im.resize((w, h)), ((k % 2) * w, (k // 2) * h))
m.save(sys.argv[2])
