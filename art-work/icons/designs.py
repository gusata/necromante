"""Desenho de cada ícone (itens 36x36 e escolas 14x14). Luz de cima-esquerda, contorno #07050b."""
from __future__ import annotations

from iconkit import VOID, Icon

ITEMS: dict = {}
SCHOOLS: dict = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


def school(fn):
    SCHOOLS[fn.__name__] = fn
    return fn


# ------------------------------------------------------------------ bases por tipo

def shaft(ic, mat="wood", a=(7, 32), b=(23, 12), w=3.0, group="shaft"):
    ic.add(ic.S().line([a, b], w), mat, group=group, name="shaft")


def ring_band(ic, mat, cx=18, cy=25.5, rx=12, ry=7.5, t=4.2, group="band"):
    ic.add(ic.S().ring(cx, cy, rx, ry, t, t * 0.8), mat, group=group, name="band")


def hood_base(ic, mat, eyes=None, peak=True):
    s = ic.S().ell(18, 14, 10, 11)
    s.poly([(2.5, 34), (33.5, 34), (31, 27), (26.5, 19), (9.5, 19), (5, 27)])
    if peak:
        s.poly([(8.5, 13), (10, 2.5), (18, 3.2)])
    ic.add(s, mat, group="hood", name="hood")
    ic.add(ic.S().ell(19, 16.5, 7.5, 9).poly([(11.6, 17), (26.4, 17), (24, 27.5), (14, 27.5)]), mat_lo(mat), group="hood",
           name="lining")
    o = ic.S().ell(19, 16.5, 5.8, 7.2).poly([(13.3, 17), (24.7, 17), (22.5, 25.5), (15.5, 25.5)])
    ic.add(o, VOID, group="face", name="opening")
    ic.add(ic.S().line([(10, 25), (8, 33)], 1.2).line([(27, 25), (29, 33)], 1.2), mat_lo(mat), group="hood", name="folds")
    if eyes:
        for x in (16, 20):
            ic.px(x, 18, eyes).px(x + 1, 18, eyes)


def cloak_base(ic, mat, hem="wave", folds=True):
    s = ic.S().ell(18, 9, 8.5, 4.5).poly([(9.5, 9), (26.5, 9), (32.5, 34), (3.5, 34)])
    if hem == "tatter":
        for x in (6, 12.5, 19, 25.5):
            s.cut_poly([(x, 34.5), (x + 2.5, 29.5), (x + 5, 34.5)])
    else:
        for x in (8, 16, 24):
            s.cut_ell(x + 2, 35, 3.0, 2.0)
    ic.add(s, mat, group="cloak", name="cloak")
    if folds and ic.k < 1:  # ícone pequeno: uma dobra central só, para dar caimento
        ic.add(ic.S().line([(18, 15), (17, 31)], 2.2), mat_lo(mat), group="cloak", name="fold")
    elif folds:
        ic.add(ic.S().line([(15.5, 14), (11, 31)], 1.3).line([(21, 14), (25, 31)], 1.3).line([(18.5, 18), (18.5, 31)], 1.1),
               mat_lo(mat), group="cloak", name="folds")


def collar(ic, mat):
    if ic.k < 1:  # no ícone pequeno a gola só alarga o topo e apaga a silhueta do manto
        return
    ic.add(ic.S().poly([(8.5, 3), (17, 10), (12, 13), (9, 9)]).poly([(27.5, 3), (19, 10), (24, 13), (27, 9)]),
           mat, group="collar", name="collar")


def clasp(ic, mat="iron", x=18, y=10, r=2.6):
    ic.add(ic.S().ell(x, y, r), mat, name="clasp")
    ic.glint(x - 1, y - 1)


def cord(ic, mat="leather", to=(18, 17), w=1.6):
    s = ic.S().line([(7, 2.5), (10, 10), to], w).line([(29, 2.5), (26, 10), to], w)
    ic.add(s, mat, group="cord", name="cord")


def chain(ic, mat="iron", to=(18, 16)):
    if ic.k < 1:  # pequeno demais para elos: vira um cordão de metal
        return cord(ic, mat, to, w=1.6)
    s = ic.S()
    for side in (-1, 1):
        pts = [(18 + side * 11, 2.5), (18 + side * 8, 9), to]
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            n = 3
            for k in range(n):
                t = (k + 0.5) / n
                s.ring(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1.7, 1.7, 0.9)
    ic.add(s, mat, group="chain", name="chain")


def mat_lo(mat):
    from iconkit import MAT
    return MAT[mat][2] if isinstance(mat, str) and mat in MAT else mat[2]


def mat_mid(mat):
    from iconkit import MAT
    return MAT[mat][1] if isinstance(mat, str) and mat in MAT else mat[1]


def skull(ic, cx, cy, r, mat="bone", eye="#aef5bf", group="skull", jaw=True):
    s = ic.S().ell(cx, cy, r, r * 0.9)
    if jaw:
        s.rect(cx - r * 0.55, cy + r * 0.3, cx + r * 0.55, cy + r * 1.05)
    ic.add(s, mat, group=group, name="skull")
    er = max(1.1, r * 0.3)
    e = ic.S().ell(cx - r * 0.4, cy + r * 0.1, er, er * 1.05).ell(cx + r * 0.4, cy + r * 0.1, er, er * 1.05)
    e.poly([(cx - 0.8, cy + r * 0.55), (cx + 0.8, cy + r * 0.55), (cx, cy + r * 0.3)])
    ic.add(e, VOID, group=group + "-eyes", name="eyes")
    if jaw and r >= 5:
        for i in range(-1, 2):
            ic.px(round(cx + i * r * 0.3 - 0.5), round(cy + r * 0.85), "#6b6452")
    if eye:
        for sx in (-1, 1):
            x, y = cx + sx * r * 0.4, cy + r * 0.1
            ic.px(int(x), int(y), eye)
            if r >= 6:
                ic.px(int(x) - 1, int(y), eye)


def gem(ic, cx, cy, r, mat, glint=True):
    ic.add(ic.S().poly([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]), mat, name="gem")
    if glint:
        ic.glint(cx - 1, cy - 1)


def orb(ic, cx, cy, r, mat, glint=True):
    ic.add(ic.S().ell(cx, cy, r), mat, name="orb")
    if glint:
        ic.glint(round(cx - r * 0.45), round(cy - r * 0.45))


def drop(ic, cx, cy, r, mat):
    ic.add(ic.S().ell(cx, cy + r * 0.3, r).poly([(cx - r * 0.8, cy), (cx, cy - r * 1.7), (cx + r * 0.8, cy)]), mat, name="drop")


def heart(ic, cx, cy, r, mat, group="heart"):
    s = ic.S().ell(cx - r * 0.5, cy - r * 0.2, r * 0.6).ell(cx + r * 0.5, cy - r * 0.2, r * 0.6)
    s.poly([(cx - r * 1.08, cy - r * 0.05), (cx + r * 1.08, cy - r * 0.05), (cx, cy + r * 1.1)])
    ic.add(s, mat, group=group, name="heart")


def stitches(ic, pts, colour="#2a1c14"):
    if ic.k < 1:  # pontos soltos viram ruído no ícone pequeno
        return
    for x, y in pts:
        ic.px(x, y, colour)


