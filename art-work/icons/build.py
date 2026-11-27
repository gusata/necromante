"""Renderiza todos os ícones, monta as folhas (formato JSON do Aseprite) e uma folha de revisão.

uso: python art-work/icons/build.py [--out art-work/icons/out] [--install]
  --install copia itens.png/json e escolas.png/json para public/assets/sprites e registra no manifesto.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

import designs
import art_items  # noqa: F401  (registra os desenhos)
from iconkit import Icon

ROOT = Path(__file__).resolve().parents[2]
ITEM, SCHOOL = 18, 7  # uma grade só: 1 px da arte = 1 px do mundo (itens aparecem com escala 2)
RARITY = {"common": "#a49c86", "magic": "#6fa8c8", "rare": "#e0b040", "legendary": "#ff7a3a", "set": "#4ee08a"}


def item_rarities():
    import re
    src = (ROOT / "src/sim/items.ts").read_text(encoding="utf8")
    return dict(re.findall(r"id: '(\w+)'.*?rarity: '(\w+)'", src))


def render_all(table, size, k):
    out, reports = {}, {}
    for name, fn in table.items():
        ic = Icon(size, size, k)
        fn(ic)
        img, rep = ic.render()
        out[name], reports[name] = img, rep
    return out, reports


def sheet(images, prefix, size, cols, path_png, path_json):
    keys = list(images)
    rows = (len(keys) + cols - 1) // cols
    W, H = cols * size, rows * size
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    frames = []
    for i, k in enumerate(keys):
        x, y = (i % cols) * size, (i // cols) * size
        im.paste(images[k], (x, y))
        frames.append({"filename": f"{prefix}{k}", "frame": {"x": x, "y": y, "w": size, "h": size}, "rotated": False,
                       "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": size, "h": size},
                       "sourceSize": {"w": size, "h": size}, "duration": 100})
    im.save(path_png)
    meta = {"app": "codeart2d pixel_finish (code-drawn, no image model)", "version": "1", "image": path_png.name,
            "format": "RGBA8888", "size": {"w": W, "h": H}, "scale": "1", "frameTags": [], "layers": [], "slices": []}
    path_json.write_text(json.dumps({"frames": frames, "meta": meta}, indent=1), encoding="utf8")
    return {f"{prefix}{k}": i for i, k in enumerate(keys)}


def review(items, schools, rar, path, zoom=6):
    """Folha de revisão: cada item na moldura da raridade, sobre o painel do jogo, em 1x e ampliado."""
    cols = 8
    cell = ITEM * zoom + 12
    keys = list(items)
    rows = (len(keys) + cols - 1) // cols
    sch_h = SCHOOL * zoom * 2 + 20
    im = Image.new("RGB", (cols * cell + 60, rows * cell + sch_h + 10), "#14100c")
    d = ImageDraw.Draw(im)
    for i, k in enumerate(keys):
        x, y = (i % cols) * cell + 4, (i // cols) * cell + 4
        d.rectangle([x, y, x + ITEM * zoom + 3, y + ITEM * zoom + 3], fill="#1f1712", outline=RARITY.get(rar.get(k, ""), "#4a3524"), width=2)
        big = items[k].resize((ITEM * zoom, ITEM * zoom), Image.NEAREST)
        im.paste(big, (x + 2, y + 2), big)
    y0 = rows * cell + 6
    for i, (k, img) in enumerate(schools.items()):
        big = img.resize((SCHOOL * zoom * 2, SCHOOL * zoom * 2), Image.NEAREST)
        x = 4 + i * (SCHOOL * zoom * 2 + 30)
        im.paste(big, (x, y0), big)
        im.paste(img, (x + SCHOOL * zoom * 2 + 6, y0), img)
    im.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "art-work/icons/out"))
    ap.add_argument("--install", action="store_true")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    items, irep = render_all(designs.ITEMS, ITEM, ITEM / 36)
    schools, srep = render_all(designs.SCHOOLS, SCHOOL, SCHOOL / 14)
    rar = item_rarities()
    missing = [k for k in rar if k not in items]
    fmap = sheet(items, "item-", ITEM, 8, out / "itens.png", out / "itens.json")
    smap = sheet(schools, "school-", SCHOOL, 6, out / "escolas.png", out / "escolas.json")
    review(items, schools, rar, out / "review.png")
    border = {k: r["border_contact_px"] for k, r in {**irep, **srep}.items() if r["border_contact_px"]}
    print(json.dumps({"items": len(items), "schools": len(schools), "missing_items": missing, "border_contact": border}))

    if a.install:
        dst = ROOT / "public/assets/sprites"
        for f in ("itens.png", "itens.json", "escolas.png", "escolas.json"):
            shutil.copy(out / f, dst / f)
        man_path = dst / "manifest.json"
        man = json.loads(man_path.read_text(encoding="utf8"))
        sprites = [s for s in man.get("sprites", []) if s.get("file") not in ("itens", "escolas")]
        sprites.append({"file": "itens", "frames": fmap})
        sprites.append({"file": "escolas", "frames": smap})
        man["sprites"] = sprites
        man_path.write_text(json.dumps(man, indent=2) + "\n", encoding="utf8")
        print("installed")


if __name__ == "__main__":
    main()
