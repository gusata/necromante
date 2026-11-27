"""Monta as folhas da arte desenhada à mão (hand_art.py): valida tamanhos, gera PNG + JSON no formato do Aseprite,
uma folha de revisão e, com --install, copia para public/assets/sprites e registra no manifesto.

uso: python art-work/pixel/build_hand.py [--install]
"""
import argparse
import json
import shutil
from pathlib import Path

from PIL import Image

import hand_art

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "out"


def rgba(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def render(pal, rows, name):
    w = len(rows[0])
    for i, r in enumerate(rows):
        if len(r) != w:
            raise SystemExit(f"{name}: linha {i} tem {len(r)} colunas, esperado {w}")
    im = Image.new("RGBA", (w, len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".":
                if ch not in pal:
                    raise SystemExit(f"{name}: cor '{ch}' fora da paleta")
                im.putpixel((x, y), rgba(pal[ch]))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--install", action="store_true")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    entries = []
    review_rows = []
    for sheet_name, group in hand_art.SHEETS.items():
        frames = []  # (texture key, image)
        for key, (pal, fr) in group.items():
            imgs = [render(pal, rows, f"{key}[{i}]") for i, rows in enumerate(fr)]
            if len(imgs) == 1:
                frames.append((key, imgs[0]))
            else:
                frames += [(f"{key}{i}", im) for i, im in enumerate(imgs)]
        # folha em uma linha
        W = sum(im.width for _, im in frames) + len(frames) - 1
        H = max(im.height for _, im in frames)
        sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        meta_frames = []
        x = 0
        for key, im in frames:
            sheet.paste(im, (x, 0))
            meta_frames.append({"filename": key, "frame": {"x": x, "y": 0, "w": im.width, "h": im.height}, "rotated": False,
                                "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height},
                                "sourceSize": {"w": im.width, "h": im.height}, "duration": 100})
            x += im.width + 1
        sheet.save(OUT / f"{sheet_name}.png")
        (OUT / f"{sheet_name}.json").write_text(json.dumps({"frames": meta_frames, "meta": {
            "app": "desenhado à mão em texto (hand_art.py, estilo PixelSpec do codeart2d)", "image": f"{sheet_name}.png",
            "format": "RGBA8888", "size": {"w": W, "h": H}, "scale": "1", "frameTags": []}}, indent=1), encoding="utf8")
        entries.append({"file": sheet_name, "frames": {k: i for i, (k, _) in enumerate(frames)}})
        review_rows.append(sheet)
        for i, (k, im) in enumerate(frames):
            im.save(OUT / f"frame-{k}.png")

    # revisão: cada folha numa faixa, sobre o fundo escuro do jogo, 4x
    RW = max(s.width for s in review_rows) + 8
    RH = sum(s.height + 6 for s in review_rows) + 4
    rev = Image.new("RGBA", (RW, RH), "#16141c")
    y = 4
    for s in review_rows:
        rev.alpha_composite(s, (4, y))
        y += s.height + 6
    rev.resize((RW * 4, RH * 4), Image.NEAREST).save(OUT / "review.png")

    if a.install:
        dst = ROOT / "public/assets/sprites"
        names = [e["file"] for e in entries]
        for n in names:
            for ext in ("png", "json"):
                shutil.copy(OUT / f"{n}.{ext}", dst / f"{n}.{ext}")
        man_path = dst / "manifest.json"
        man = json.loads(man_path.read_text(encoding="utf8"))
        man["sprites"] = [s for s in man["sprites"] if s.get("file") not in names] + entries
        man_path.write_text(json.dumps(man, indent=2) + "\n", encoding="utf8")
        print("installed", names)
    print(json.dumps({"sheets": [e["file"] for e in entries], "frames": sum(len(e["frames"]) for e in entries)}))


if __name__ == "__main__":
    main()
