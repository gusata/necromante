"""Instala um pacote de itens desenhados à mão (zip ou pasta) no jogo.

uso: python art-work/icons/install_items.py <pacote.zip | pasta>

O pacote traz (formato do Claude Design):
  itens/item-<id>.png       18x18, um por item (o jogo lê com res 2: veja docs/ARTE.md)
  animados/item-<id>.png    tira horizontal de quadros 18x18 (relíquias e conjuntos)
  molduras/slot-<r>.png     24x24, moldura de cada raridade e o espaço vazio
  itens.json                { "item-<id>": { "quadros": n, "durationsMs": [...] , ... } }

Gera em public/assets/sprites:
  itens.png/json        todos os itens parados (substitui a folha antiga)
  itens-anim.png/json   quadros dos animados; o manifesto guarda índices e durações
  molduras.png/json     molduras de raridade
e registra as três no manifest.json, logo depois da entrada "itens". Não mexe na folha
de ícones animados da interface (icones-anim), que é do install_pack.py.
"""
from __future__ import annotations

import json
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image

from install_pack import DST, pack

ITEM = 18
FILES = ("itens", "itens-anim", "molduras")


def main():
    src = Path(sys.argv[1])
    if src.suffix == ".zip":
        tmp = Path(tempfile.mkdtemp(prefix="itens-"))
        with zipfile.ZipFile(src) as z:
            z.extractall(tmp)
        src = tmp
    # o zip pode ter uma pasta-raiz
    if not (src / "itens.json").exists():
        src = next(p.parent for p in src.rglob("itens.json"))
    meta = json.loads((src / "itens.json").read_text(encoding="utf8"))

    # parados, na ordem do itens.json
    statics: dict[str, Image.Image] = {}
    for key in meta:
        im = Image.open(src / "itens" / f"{key}.png").convert("RGBA")
        if im.size != (ITEM, ITEM):
            raise SystemExit(f"{key}: {im.size}, esperava {ITEM}x{ITEM}")
        statics[key] = im
    entries = [{"file": "itens", "frames": pack(statics, "itens")}]

    # animados: cada quadro da tira vira um quadro da folha
    frames: dict[str, Image.Image] = {}
    anims = {}
    for key, m in meta.items():
        n = m.get("quadros") or 1
        if n <= 1:
            continue
        strip = Image.open(src / "animados" / f"{key}.png").convert("RGBA")
        if strip.size != (ITEM * n, ITEM):
            raise SystemExit(f"{key}: tira {strip.size}, esperava {ITEM * n}x{ITEM}")
        idx = []
        for i in range(n):
            frames[f"{key}#{i}"] = strip.crop((i * ITEM, 0, (i + 1) * ITEM, ITEM))
            idx.append(len(frames) - 1)
        ms = m.get("durationsMs") or [120] * n
        anims[key] = {"frames": idx, "ms": ms, "loop": True}
    if anims:
        pack(frames, "itens-anim")
        entries.append({"file": "itens-anim", "anims": anims})

    # molduras de raridade
    rims = {p.stem: Image.open(p).convert("RGBA") for p in sorted((src / "molduras").glob("slot-*.png"))}
    if rims:
        entries.append({"file": "molduras", "frames": pack(rims, "molduras")})

    # manifesto: as três entram no lugar da entrada "itens" antiga (a ordem importa: animados depois dos parados)
    man_path = DST / "manifest.json"
    man = json.loads(man_path.read_text(encoding="utf8"))
    sprites = man.get("sprites", [])
    at = next((i for i, s in enumerate(sprites) if s.get("file") == "itens"), len(sprites))
    rest = [s for s in sprites if s.get("file") not in FILES]
    at = min(at, len(rest))
    man["sprites"] = rest[:at] + entries + rest[at:]
    man_path.write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(json.dumps({"itens": len(statics), "animados": len(anims), "molduras": sorted(rims)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
