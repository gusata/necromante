"""Instala um pacote de efeitos desenhados à mão (zip ou pasta) no jogo.

uso: python art-work/icons/install_fx.py <pacote.zip | pasta>

O pacote traz:
  efeitos.json             { chave: { frameWidth, frameHeight, frames, durationsMs, loop, nota } }
  <chave>/<chave>.png      tira horizontal com os quadros

Copia cada tira para public/assets/fx/<chave>.png e grava public/assets/fx/fx.json.
src/art/fx.ts carrega tudo e cria uma animação por chave.
"""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DST = ROOT / "public/assets/fx"


def main():
    src = Path(sys.argv[1])
    if src.suffix == ".zip":
        tmp = Path(tempfile.mkdtemp(prefix="efeitos-"))
        with zipfile.ZipFile(src) as z:
            z.extractall(tmp)
        src = tmp
    meta_path = next(src.rglob("efeitos.json"))
    base = meta_path.parent
    meta = json.loads(meta_path.read_text(encoding="utf8"))

    DST.mkdir(parents=True, exist_ok=True)
    out, problems = {}, []
    for key, m in meta.items():
        strip = base / key / f"{key}.png"
        if not strip.exists():
            problems.append(f"{key}: sem {strip.name}")
            continue
        w, h = Image.open(strip).size
        if w != m["frameWidth"] * m["frames"] or h != m["frameHeight"]:
            problems.append(f"{key}: tira {w}x{h} não bate com {m['frames']}x {m['frameWidth']}x{m['frameHeight']}")
            continue
        shutil.copy(strip, DST / f"{key}.png")
        out[key] = {k: m[k] for k in ("frameWidth", "frameHeight", "frames", "durationsMs")} | {"loop": bool(m.get("loop"))}
    (DST / "fx.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(json.dumps({"instalados": len(out), "problemas": problems}, ensure_ascii=False))


if __name__ == "__main__":
    main()
