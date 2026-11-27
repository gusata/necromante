"""Amplia alguns vivos (3 quadros) a 8x para revisar detalhe. uso: python zoom.py nome1 nome2 ..."""
import sys
from pathlib import Path
from PIL import Image
OUT = Path(__file__).parent / "out"
sheet = Image.open(OUT / "vivos.png")
import json
meta = {f["filename"]: f["frame"] for f in json.loads((OUT / "vivos.json").read_text(encoding="utf8"))["frames"]}
names = sys.argv[1:]
rv = Image.new("RGBA", (3 * 18 + 2, len(names) * 24 + 2), "#1a120e")
for i, n in enumerate(names):
    for f in range(3):
        fr = meta[f"{n}{f}"]
        rv.alpha_composite(sheet.crop((fr["x"], 0, fr["x"] + fr["w"], fr["h"])), (2 + f * 18, 1 + i * 24))
rv.resize((rv.width * 8, rv.height * 8), Image.NEAREST).save(OUT / "zoom.png")
