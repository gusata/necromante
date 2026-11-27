"""Os 5 necromantes jogáveis em 32x38 (codeart2d pixel_finish, desenhados por código, sem modelo de imagem).

Quadros: parado, respirando (corpo desce 1 px) e conjurando (cajado erguido, cristal aceso). O raio sai da ponta
do cajado, uns 10 px à direita e 32 px acima dos pés (docs/ARTE.md).

uso: python art-work/necros/make_necros.py [--install]
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "art-work" / "icons"))
from iconkit import VOID, Icon  # noqa: E402

W, H = 32, 38
SKIN = ("#e8d8cc", "#c9b4a8", "#9a8478", "#6a5650")

CHARS = {
    "necro": dict(robe=("#6a4888", "#4c2f61", "#2e1d3b", "#17111f"), sash=("#3a2448", "#24162e", "#160d1c", "#0c0710"),
                  eye="#aef5bf", eye2="#38b46a", glow=("#e0ffe8", "#aef5bf", "#38b46a", "#1f6a3e"), hat="hood", tool="staff",
                  wood=("#6a5a48", "#4a3e32", "#2e261e", "#1a1510")),
    "witch": dict(robe=("#4a6a38", "#34462a", "#1c2416", "#10140c"), sash=("#5a4a2a", "#3a301c", "#241e12", "#14100a"),
                  eye="#d8ff8a", eye2="#8fbf3a", glow=("#f0ffc0", "#d0e880", "#8fbf3a", "#4e6a1c"), hat="witch", tool="staff",
                  wood=("#6a5a48", "#4a3e32", "#2e261e", "#1a1510")),
    "digger": dict(robe=("#5e5648", "#4a4236", "#2e2a24", "#1a1712"), sash=("#6a4a30", "#4a3a2a", "#2e2418", "#1a140e"),
                   eye="#ffe0a0", eye2="#e0a040", glow=("#fff0c0", "#f0c060", "#e0a040", "#8a5a18"), hat="brim", tool="shovel",
                   wood=("#8a6a4a", "#6e5038", "#4a3424", "#2e2016")),
    "reaper": dict(robe=("#3e3a48", "#2a2732", "#18161e", "#0c0b10"), sash=("#2a2732", "#1a1820", "#100f14", "#08070a"),
                   eye="#f0f4ff", eye2="#9a96a8", glow=("#ffffff", "#c8d0e0", "#8a94a6", "#464e5e"), hat="hood", tool="scythe",
                   wood=("#5a5668", "#3a3644", "#24212c", "#14121a")),
    "vampire": dict(robe=("#8e2038", "#6e1428", "#3a0c18", "#1a0710"), sash=("#2a0a12", "#1a0710", "#10040a", "#080205"),
                    eye="#ff6070", eye2="#c02040", glow=("#ffd0d8", "#ff6070", "#c02040", "#6a1020"), hat="collar", tool="staff",
                    wood=("#3a2a2e", "#2a1e22", "#1a1216", "#0e0a0c")),
}


def draw(ic: Icon, c: dict, breath: int, cast: bool):
    """breath: 0/1 (o tronco desce 1 px). cast: cajado erguido e cristal grande."""
    b = breath
    lift = -4 if cast else 0
    S = ic.S
    # manto
    robe = S().poly([(9.5, 15 + b), (22.5, 15 + b), (28, 37.5), (4, 37.5)])
    for x in (6, 13, 20):
        robe.cut_ell(x + 3, 38.6, 2.6, 1.6)
    ic.add(robe, c["robe"], group="robe", name="robe")
    ic.add(S().line([(13, 26 + b), (10, 36)], 1.2).line([(19, 26 + b), (22, 36)], 1.2), c["robe"][2], group="robe", name="folds")
    ic.add(S().rect(8, 24 + b, 25, 26.5 + b), c["sash"], group="sash", name="sash")
    # ferramenta na frente do manto, atrás da mão
    tx = 27
    if c["tool"] == "staff":
        ic.add(S().line([(tx, 9 + lift), (tx, 37)], 2.0), c["wood"], name="staff")
    elif c["tool"] == "shovel":
        ic.add(S().line([(tx, 8 + lift), (tx, 37)], 2.0), c["wood"], name="shaft")
        ic.add(S().poly([(tx - 3.5, 1.5 + lift), (tx + 3.5, 1.5 + lift), (tx + 3.5, 7 + lift), (tx, 10 + lift), (tx - 3.5, 7 + lift)]),
               "iron", name="blade")
    else:  # foice
        ic.add(S().line([(tx, 4 + lift), (tx, 37)], 2.0), c["wood"], name="shaft")
        blade = S().ell(tx - 8, 6 + lift, 10, 5.5).cut_ell(tx - 7, 9.5 + lift, 10, 5).cut_rect(tx, 0, 32, 38)
        ic.add(blade, "iron", name="blade")
    # gola alta da vampira, atrás da cabeça
    if c["hat"] == "collar":
        ic.add(S().poly([(6, 6 + b), (11, 15 + b), (21, 15 + b), (26, 6 + b), (22, 12 + b), (16, 9 + b), (10, 12 + b)]), c["robe"],
               group="collar", name="collar")
    # cabeça
    if c["hat"] in ("hood", "witch", "brim"):
        hood = S().ell(16, 11 + b, 8, 8.5)
        if c["hat"] == "hood":
            hood.poly([(10, 7 + b), (16, 0.6 + b), (22, 7 + b)])
        ic.add(hood, c["robe"], group="hood", name="hood")
        ic.add(S().ell(16, 13 + b, 5, 5.2), VOID, group="face", name="face")
        for x in (14, 18):
            ic.px(x, 13 + b, c["eye"]).px(x - 1, 13 + b, c["eye2"] if not cast else c["eye"])
    else:  # vampira: rosto pálido, cabelo escuro
        ic.add(S().ell(16, 10 + b, 6.5, 7.5), "#2a1a22" if False else ("#4a2a36", "#2a1a22", "#1a1016", "#0e080c"), group="hair", name="hair")
        ic.add(S().ell(16, 12 + b, 4.6, 5), SKIN, group="face", name="face")
        for x in (14, 18):
            ic.px(x, 12 + b, c["eye"]).px(x - 1 if x == 14 else x, 12 + b, c["eye"])
        ic.px(16, 15 + b, "#6a1020")
    if c["hat"] == "witch":
        ic.add(S().ell(16, 6 + b, 11, 2.2), c["robe"], group="hat", name="brim")
        ic.add(S().poly([(9.5, 6.5 + b), (22.5, 6.5 + b), (20, 2.5 + b), (25, 0.6), (16, 1.5 + b)]), c["robe"], group="hat", name="cone")
    if c["hat"] == "brim":
        ic.add(S().ell(16, 6 + b, 12, 2.4), ("#6a5a48", "#4a3e32", "#2e261e", "#1a1510"), group="hat", name="brim")
        ic.add(S().rect(10, 0.6 + b, 22, 6 + b), ("#6a5a48", "#4a3e32", "#2e261e", "#1a1510"), group="hat", name="crown")
        ic.add(S().rect(10, 4 + b, 22, 5.5 + b), c["sash"], group="hat", name="band")
    # mangas e mãos: a da frente segura a ferramenta
    hy = 20 + b + (lift if cast else 0)
    ic.add(S().ell(25, hy, 3.6, 4.2), c["robe"], group="arm", name="arm")
    ic.add(S().ell(tx, hy + 2, 1.9), SKIN, group="hand", name="hand")
    ic.add(S().ell(9, 21 + b, 3.6, 4.2), c["robe"], group="arm2", name="arm2")
    ic.add(S().ell(9.5, 24 + b, 1.8), SKIN, group="hand2", name="hand2")
    # cristal (o cajado da Bruxa e da Vampira também tem; pá e foice não)
    if c["tool"] == "staff":
        r = 5.5 if cast else 4
        ic.add(S().poly([(tx, 7 + lift - r), (tx + r * 0.75, 7 + lift), (tx, 7 + lift + r), (tx - r * 0.75, 7 + lift)]), c["glow"], name="crystal")
        ic.px(tx - 1, 5 + lift, "#ffffff")
    elif c["tool"] == "shovel" and cast:
        ic.add(S().ell(tx, 4 + lift, 2.5), c["glow"], name="lamp")


def render(cid: str):
    c = CHARS[cid]
    frames = []
    for breath, cast in ((0, False), (1, False), (0, True)):
        ic = Icon(W, H, 1.0)
        draw(ic, c, breath, cast)
        img, _ = ic.render()
        frames.append(img)
    return frames


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--install", action="store_true")
    a = ap.parse_args()
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    review = Image.new("RGBA", (len(CHARS) * (3 * (W + 4)) + 8, H + 8), "#16141c")
    entries = []
    for i, cid in enumerate(CHARS):
        frames = render(cid)
        key = "necro" if cid == "necro" else f"char-{cid}"
        sheet = Image.new("RGBA", (W * 3, H), (0, 0, 0, 0))
        meta_frames = []
        for f, im in enumerate(frames):
            sheet.paste(im, (f * W, 0))
            review.alpha_composite(im, (4 + i * 3 * (W + 4) + f * (W + 4), 4))
            meta_frames.append({"filename": f"{key}{f}", "frame": {"x": f * W, "y": 0, "w": W, "h": H}, "rotated": False,
                                "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": W, "h": H},
                                "sourceSize": {"w": W, "h": H}, "duration": 600})
        name = f"necro-{cid}"
        sheet.save(out / f"{name}.png")
        (out / f"{name}.json").write_text(json.dumps({"frames": meta_frames, "meta": {
            "app": "codeart2d pixel_finish (code-drawn, no image model)", "image": f"{name}.png", "format": "RGBA8888",
            "size": {"w": W * 3, "h": H}, "scale": "1", "frameTags": []}}, indent=1), encoding="utf8")
        entries.append({"file": name, "frames": {f"{key}0": 0, f"{key}1": 1, f"{key}-cast": 2}})
    review.resize((review.width * 3, review.height * 3), Image.NEAREST).save(out / "review.png")
    if a.install:
        dst = ROOT / "public/assets/sprites"
        for e in entries:
            for ext in ("png", "json"):
                shutil.copy(out / f"{e['file']}.{ext}", dst / f"{e['file']}.{ext}")
        man_path = dst / "manifest.json"
        man = json.loads(man_path.read_text(encoding="utf8"))
        man["sprites"] = [s for s in man["sprites"] if not s.get("file", "").startswith("necro-")] + entries
        man_path.write_text(json.dumps(man, indent=2) + "\n", encoding="utf8")
        print("installed")
    print(out / "review.png")


if __name__ == "__main__":
    main()
