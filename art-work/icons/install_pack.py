"""Instala um pacote de ícones desenhados à mão (zip ou pasta) no jogo.

uso: python art-work/icons/install_pack.py <pacote.zip | pasta>

O pacote traz:
  png/<chave>.png        um quadro por ícone, com o nome da chave de textura do jogo
  anim/<chave>.png       tira horizontal com os quadros da animação
  anim/animations.json   { chave: { frameWidth, frameHeight, frames, durationsMs, loop } }

Cada grupo de ícones vira uma folha (formato JSON do Aseprite) em public/assets/sprites
e é registrado no manifesto. As animações vão para a folha "icones-anim", com a duração
de cada quadro; src/art/aseprite.ts troca o quadro da textura sozinho, então toda tela
que mostra o ícone já anima.
"""
from __future__ import annotations

import json
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DST = ROOT / "public/assets/sprites"

# folha -> filtro de chave. A ordem importa: a primeira folha que aceita a chave fica com ela.
GROUPS = [
    ("hud", lambda k: k.startswith("icon-")),
    ("nav", lambda k: k.startswith("nav-")),
    ("arvore", lambda k: k.startswith("b-") or k == "necropolis"),
    ("escolas", lambda k: k.startswith("school-")),
    ("gemas", lambda k: k.startswith("gem-")),
    ("botoes", lambda k: k.startswith("act-round")),
    ("nos", lambda k: k.startswith("node-")),
]
ANIM_FILE = "icones-anim"


def pack(images: dict[str, Image.Image], name: str) -> dict[str, int]:
    """Enfileira os quadros lado a lado (1 px de folga) e grava png + json."""
    keys = list(images)
    W = sum(images[k].width + 1 for k in keys) - 1
    H = max(images[k].height for k in keys)
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    frames, x = [], 0
    for k in keys:
        im = images[k]
        sheet.paste(im, (x, 0))
        w, h = im.size
        frames.append({"filename": k, "frame": {"x": x, "y": 0, "w": w, "h": h}, "rotated": False, "trimmed": False,
                       "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h}, "duration": 100})
        x += w + 1
    sheet.save(DST / f"{name}.png")
    meta = {"app": "install_pack.py (arte desenhada à mão)", "version": "1", "image": f"{name}.png", "format": "RGBA8888",
            "size": {"w": W, "h": H}, "scale": "1", "frameTags": [], "layers": [], "slices": []}
    (DST / f"{name}.json").write_text(json.dumps({"frames": frames, "meta": meta}, indent=1), encoding="utf8")
    return {k: i for i, k in enumerate(keys)}


def main():
    src = Path(sys.argv[1])
    if src.suffix == ".zip":
        tmp = Path(tempfile.mkdtemp(prefix="icones-"))
        with zipfile.ZipFile(src) as z:
            z.extractall(tmp)
        src = tmp
    # o zip pode ter uma pasta-raiz
    if not (src / "png").is_dir():
        src = next(p.parent for p in src.rglob("png") if p.is_dir())

    statics = {p.stem: Image.open(p).convert("RGBA") for p in sorted((src / "png").glob("*.png"))}
    entries, used = [], set()
    for name, accept in GROUPS:
        group = {k: im for k, im in statics.items() if accept(k) and k not in used}
        if not group:
            continue
        used |= group.keys()
        entries.append({"file": name, "frames": pack(group, name)})
    left = sorted(set(statics) - used)

    # animações: cada quadro vira um quadro da folha; o manifesto guarda índices e durações
    anims = {}
    meta_path = src / "anim" / "animations.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf8"))
        frames: dict[str, Image.Image] = {}
        for key, m in meta.items():
            strip = Image.open(src / "anim" / f"{key}.png").convert("RGBA")
            fw, fh, n = m["frameWidth"], m["frameHeight"], m["frames"]
            idx = []
            for i in range(n):
                frames[f"{key}#{i}"] = strip.crop((i * fw, 0, (i + 1) * fw, fh))
                idx.append(len(frames) - 1)
            anims[key] = {"frames": idx, "ms": m["durationsMs"], "loop": m.get("loop", True)}
        pack(frames, ANIM_FILE)

    man_path = DST / "manifest.json"
    man = json.loads(man_path.read_text(encoding="utf8"))
    ours = {n for n, _ in GROUPS} | {ANIM_FILE}
    sprites = [s for s in man.get("sprites", []) if s.get("file") not in ours]
    sprites += entries
    if anims:
        sprites.append({"file": ANIM_FILE, "anims": anims})
    man["sprites"] = sprites
    man_path.write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(json.dumps({"estaticos": len(used), "fora_de_grupo": left, "animacoes": len(anims),
                      "folhas": [e["file"] for e in entries]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
