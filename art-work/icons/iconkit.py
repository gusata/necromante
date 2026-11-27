"""Kit de formas para ícones em pixel art (codeart2d, route D: pixel_finish).

Cada ícone é uma lista de "slots" (forma + material), de trás para a frente. O pixel_finish da skill
codeart2d cobre a forma em supersample, sombreia cada slot com luz de cima-esquerda, desenha as
linhas internas entre peças e fecha o contorno externo de 1 px. Arte desenhada por código, sem
modelo de imagem.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SKILL = Path(__file__).resolve().parents[2] / ".claude" / "skills" / "codeart2d" / "scripts"
sys.path.insert(0, str(SKILL))
import codeart_core as cc  # noqa: E402

SS = 8
OUTLINE = "#07050b"
VOID = "#17111f"

# materiais: (luz, base, sombra, sombra funda) — paleta de docs/ARTE.md
MAT = {
    "bone": ("#f8f4e8", "#e3dccb", "#a49c86", "#6b6452"),
    "oldbone": ("#e8dfc4", "#c8b890", "#8f8160", "#5c5238"),
    "wood": ("#9a7050", "#6e4d36", "#4a3222", "#2e1f16"),
    "iron": ("#c8d0e0", "#8a94a6", "#464e5e", "#2a2f3a"),
    "rust": ("#c07a48", "#8a4a26", "#5e2e18", "#3a1a0e"),
    "gold": ("#f6cf6a", "#c9a23a", "#8a5a18", "#5a3a10"),
    "bronze": ("#c8a050", "#8a6a22", "#5e4614", "#3a2a0c"),
    "flesh": ("#e8a0a8", "#b5525e", "#7a3040", "#4a1a26"),
    "plague": ("#d0e880", "#8fbf3a", "#5a7a20", "#34480f"),
    "bile": ("#b8d060", "#7a9a30", "#4e6a1c", "#2e400e"),
    "spirit": ("#e8f8ff", "#8fd3ff", "#4a8ab8", "#2a4a70"),
    "mist": ("#f0faff", "#bfe9ff", "#7fb0cc", "#4a7490"),
    "blood": ("#ff7080", "#e0304a", "#9e2236", "#5a0f1d"),
    "crimson": ("#d04050", "#9e2236", "#6a1424", "#3e0a14"),
    "soul": ("#e0ffe8", "#aef5bf", "#38b46a", "#1f6a3e"),
    "leather": ("#b08060", "#8a5a3a", "#5a3a26", "#3a2418"),
    "robe": ("#6a4888", "#4c2f61", "#2e1d3b", "#17111f"),
    "wool": ("#7c6a90", "#5a4a6b", "#3c3048", "#241c2e"),
    "burlap": ("#7d5a40", "#634532", "#3d2a20", "#2a1c14"),
    "dark": ("#5a5668", "#3a3644", "#24212c", "#14121a"),
    "holy": ("#ece8f4", "#bdb7c9", "#7f7990", "#4a4658"),
    "rose": ("#f4ecff", "#d8ccf0", "#9a8cb8", "#5e527a"),
    "abyss": ("#c83040", "#7a1428", "#4a0a18", "#24040c"),
    "mush": ("#e8d8b0", "#c8a878", "#8a6a48", "#5a4430"),
    "maggot": ("#f8f0d0", "#e0d4a0", "#a89a68", "#6a5e3c"),
}


def ramp(m):
    """Ramp do codeart2d: no máximo 3 tons (luz, base, sombra) e a borda na cor mais escura do material."""
    hi, mid, lo, dark = MAT[m] if isinstance(m, str) else m
    return [hi, mid, lo, lo, dark]


class Shape:
    """Máscara em supersample. Coordenadas no espaço de desenho (36x36); k converte para o ícone real."""

    def __init__(self, w, h, k=1.0):
        self.w, self.h, self.k = w, h, k
        self.img = Image.new("L", (w * SS, h * SS), 0)
        self.d = ImageDraw.Draw(self.img, "L")
        self.d._k = k

    def _b(self, cx, cy, rx, ry):
        k = self.k
        cx, cy, rx, ry = cx * k, cy * k, max(rx * k, 0.55), max(ry * k, 0.55)
        return [(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS - 1, (cy + ry) * SS - 1]

    def ell(self, cx, cy, rx, ry=None, on=True):
        self.d.ellipse(self._b(cx, cy, rx, rx if ry is None else ry), fill=255 if on else 0)
        return self

    def cut_ell(self, cx, cy, rx, ry=None):
        return self.ell(cx, cy, rx, ry, on=False)

    def poly(self, pts, on=True):
        k = self.k
        self.d.polygon([(x * k * SS, y * k * SS) for x, y in pts], fill=255 if on else 0)
        return self

    def cut_poly(self, pts):
        return self.poly(pts, on=False)

    def rect(self, x0, y0, x1, y1, on=True):
        k = self.k
        self.d.rectangle([x0 * k * SS, y0 * k * SS, x1 * k * SS - 1, y1 * k * SS - 1], fill=255 if on else 0)
        return self

    def cut_rect(self, x0, y0, x1, y1):
        return self.rect(x0, y0, x1, y1, on=False)

    def line(self, pts, w, on=True):
        """Linha grossa com juntas e pontas redondas."""
        fill = 255 if on else 0
        k = self.k
        pts = [(x * k, y * k) for x, y in pts]
        w = max(w * k, 1.0)
        p = [(x * SS, y * SS) for x, y in pts]
        self.d.line(p, fill=fill, width=max(1, int(round(w * SS))))
        for x, y in pts:
            self.d.ellipse([x * SS - w * SS / 2, y * SS - w * SS / 2, x * SS + w * SS / 2, y * SS + w * SS / 2], fill=fill)
        return self

    def cut_line(self, pts, w):
        return self.line(pts, w, on=False)

    def ring(self, cx, cy, rx, ry, t, ty=None):
        self.ell(cx, cy, rx, ry)
        return self.cut_ell(cx, cy, rx - t, ry - (t if ty is None else ty))

    def arc(self, cx, cy, rx, ry, a0, a1, w, steps=24):
        pts = [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / steps)),
                cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / steps))) for i in range(steps + 1)]
        return self.line(pts, w)

    def mask(self):
        return np.asarray(self.img, dtype=np.uint8)


class Icon:
    """w, h: tamanho real do ícone. k: escala do espaço de desenho (os desenhos usam 36x36; 18x18 -> k=0.5)."""

    def __init__(self, w=36, h=36, k=1.0):
        self.w, self.h, self.k = w, h, k
        self.slots, self.stamps = [], []

    def S(self):
        return Shape(self.w, self.h, self.k)

    def add(self, shape, mat, group=None, name=None):
        """mat: nome de material, tupla de 4 cores (rampa) ou '#rrggbb' (cor chapada)."""
        slot = {"alpha": shape.mask(), "name": name or f"s{len(self.slots)}"}
        if isinstance(mat, str) and mat.startswith("#"):
            slot["fill"] = mat
        else:
            slot["ramp"] = ramp(mat)
        if group is not None:
            slot["group"] = group
        self.slots.append(slot)
        return self

    def px(self, x, y, colour):
        """Pixel avulso; coordenadas no espaço de desenho (convertidas por k, repetidos ignorados)."""
        p = (min(self.w - 1, int(x * self.k)), min(self.h - 1, int(y * self.k)))
        if all((sx, sy) != p for sx, sy, _ in self.stamps):
            self.stamps.append((p[0], p[1], colour))
        return self

    def glint(self, x, y, colour="#ffffff"):
        return self.px(x, y, colour)

    def render(self):
        rows = getattr(self, "rows", None)
        if rows:  # desenho à mão, pixel a pixel
            from art_items import SCHOOL_PAL
            img = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
            for y, row in enumerate(rows):
                for x, ch in enumerate(row):
                    if ch != ".":
                        c = SCHOOL_PAL[ch]
                        img.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
            return img, {"border_contact_px": 0, "hand": True}
        rgba, report = cc.pixel_finish(self.slots, (self.w, self.h), ss=SS, outline="selout",
                                       outline_color=OUTLINE, light=(-1.0, -1.0), bands=(0.18, 0.62, 0.95),
                                       inner_lines=False, stamps=self.stamps)
        return Image.fromarray(rgba, "RGBA"), report
