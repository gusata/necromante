"""Os 63 itens e os 6 ícones de escola. As bases (cajado, capuz, manto, amuleto, anel) estão em designs.py."""
from __future__ import annotations

import math

from designs import (VOID, chain, clasp, cloak_base, collar, cord, drop, gem, heart, hood_base, item, orb, ring_band,
                     school, shaft, skull, stitches)

YEW_LEAF = ("#6a8a58", "#4a6a3c", "#2e4a26", "#1a2e16")
ROT_WOOD = ("#8a8058", "#5e5636", "#3e3a22", "#262212")
SICK_BONE = ("#e8eebc", "#c0c888", "#808a50", "#4a5230")
PEST_CLOTH = ("#e0e8b8", "#c8d890", "#8a9a5a", "#55623a")
SEER_BLUE = ("#9ac4e0", "#6fa8c8", "#3e6e8e", "#22445c")
MAGGOT_CLOTH = ("#c8c090", "#a8a070", "#6e6a44", "#44422a")
OSS_GREY = ("#d8d0bc", "#b8ae98", "#7a7260", "#4a4436")
FEVER = ("#f4f8a0", "#d8d860", "#9a9a30", "#5a5a18")
TOMB = ("#9a96a8", "#6e6a7c", "#4a4658", "#2c2a36")
PINK = ("#ffc8d0", "#e890a0", "#b05a6c", "#6e3040")
BANNER = ("#4a4658", "#2a2732", "#1a1820", "#0e0c12")

# ================================================================== CAJADOS


@item
def staff_yew(ic):
    shaft(ic, "wood", a=(7, 32), b=(22, 13), w=3.2)
    ic.add(ic.S().arc(24, 9, 5.5, 5.5, 110, 430, 3.0), "wood", group="shaft", name="curl")
    ic.add(ic.S().poly([(27, 15), (32, 14), (29, 19)]).poly([(17, 6), (19, 2), (21, 5.5)]).poly([(12, 22), (8, 20), (10, 25)]),
           YEW_LEAF, name="leaves")
    ic.add(ic.S().ell(24, 9, 2.0), "soul", name="seed")


@item
def staff_grimoire(ic):
    shaft(ic, "wood", a=(6, 33), b=(19, 17), w=3.0)
    ic.add(ic.S().poly([(15, 6), (29, 2.5), (32.5, 14), (18, 18)]), "robe", group="book", name="cover")
    ic.add(ic.S().poly([(29, 2.5), (32.5, 14), (31, 15), (28, 4)]), "holy", group="book", name="pages")
    ic.add(ic.S().ell(23.5, 10, 3.0), "soul", name="sigil")
    ic.glint(22, 9)
    s = ic.S()
    for (x, y) in ((17, 19), (14.5, 21.5), (21, 19.5), (25.5, 18.5)):
        s.ring(x, y, 1.8, 1.8, 0.9)
    ic.add(s, "iron", name="chains")


@item
def staff_bone(ic):
    shaft(ic, "bone", a=(8, 31), b=(21, 15), w=3.2)
    ic.add(ic.S().ell(8, 31, 2.6).ell(6.5, 29.5, 2.0).ell(9.5, 32.5, 2.0), "bone", group="shaft")
    skull(ic, 23.5, 10.5, 7.5)


@item
def staff_lich(ic):
    shaft(ic, "iron", a=(6, 33), b=(20, 16), w=2.8)
    ic.add(ic.S().arc(24, 11, 7.5, 8.5, 20, 340, 2.0), "iron", group="cage", name="cage")
    gem(ic, 24, 11, 6.5, "soul")
    ic.add(ic.S().ell(20, 17, 2.6), "iron", name="knot")


@item
def staff_stitch(ic):
    ic.add(ic.S().poly([(4, 33), (25.5, 6), (29, 2.5), (32, 6), (28.5, 9.5)]).cut_ell(29.2, 5.6, 1.2), "iron", group="needle",
           name="needle")
    ic.add(ic.S().line([(29, 5.5), (24, 2.5), (17, 5), (15, 11), (19, 15), (24, 13)], 1.5), "flesh", name="thread")


@item
def staff_rot(ic):
    ic.add(ic.S().line([(7, 33), (11, 26), (10, 22), (16, 17), (20, 15)], 3.2), ROT_WOOD, group="shaft", name="shaft")
    ic.add(ic.S().line([(11, 24), (6, 21)], 1.8), ROT_WOOD, group="shaft")
    skull(ic, 24, 10, 7, mat=SICK_BONE, eye="#d0e880")
    drop(ic, 28.5, 22, 1.8, "plague")
    drop(ic, 18.5, 23, 1.4, "plague")


@item
def staff_censer(ic):
    shaft(ic, "iron", a=(5, 33), b=(15, 8), w=2.6)
    ic.add(ic.S().line([(15, 8), (26, 5)], 2.2), "iron", group="shaft")
    ic.add(ic.S().line([(26, 5), (26, 17)], 1.3), "iron", name="chain")
    ic.add(ic.S().ell(26, 23.5, 6, 5.5).rect(21.5, 19, 30.5, 21), "bronze", group="censer", name="censer")
    ic.add(ic.S().poly([(22, 19), (26, 15.5), (30, 19)]), "bronze", group="censer")
    for x, y in ((23, 23), (26, 22), (29, 23), (24, 26), (28, 26)):
        ic.px(x, y, "#aef5bf")
    ic.add(ic.S().ell(20, 21, 2.6).ell(18, 16, 2.2).ell(20.5, 12, 1.8), "plague", name="smoke")


@item
def staff_storm(ic):
    shaft(ic, "dark", a=(6, 33), b=(20, 16), w=3.0)
    orb(ic, 24, 10, 7.5, "spirit", glint=False)
    ic.add(ic.S().poly([(26, 3), (20, 11), (23.5, 11), (20, 18), (29, 8.5), (25, 8.5), (28.5, 3)]), "#f0faff", name="bolt")


@item
def staff_thirst(ic):
    shaft(ic, "dark", a=(6, 33), b=(20, 17), w=3.0)
    ic.add(ic.S().line([(20, 17), (17, 10)], 2.0).line([(20, 17), (28, 15)], 2.0), "iron", group="claw", name="claws")
    drop(ic, 23.5, 11, 5.5, "blood")
    ic.glint(21, 10)
    drop(ic, 11, 27, 1.6, "blood")


@item
def staff_harvest(ic):
    shaft(ic, "wood", a=(9, 33), b=(19, 6), w=3.0)
    b = ic.S().ell(22, 10, 12, 7.5).cut_ell(19.5, 14.5, 12.5, 8.0).cut_rect(1, 1, 18, 35)
    ic.add(b, "soul", name="blade")
    ic.add(ic.S().ell(19, 7, 2.8), "iron", name="collar")
    ic.glint(25, 5).glint(30, 8)


@item
def staff_banner(ic):
    ic.add(ic.S().line([(8, 34), (8, 4)], 2.6), "dark", group="pole", name="pole")
    ic.add(ic.S().line([(8, 5), (30, 5)], 2.0), "dark", group="pole")
    ic.add(ic.S().ell(8, 3.2, 1.9), "iron", name="finial")
    flag = ic.S().poly([(9.5, 6), (30, 6), (30, 27), (25, 22.5), (20, 28), (15, 22.5), (9.5, 27)])
    ic.add(flag, BANNER, name="flag")
    skull(ic, 20, 13.5, 4.6)


@item
def staff_pest(ic):
    shaft(ic, "bone", a=(7, 32), b=(20, 16), w=3.2)
    ic.add(ic.S().ell(7, 32, 2.5).ell(5.5, 30.5, 1.9).ell(8.5, 33, 1.9), "bone", group="shaft")
    ic.add(ic.S().arc(24, 11, 7, 7, 100, 250, 2.0).arc(24, 11, 7, 7, 290, 440, 2.0), "bone", group="ribs", name="ribs")
    gem(ic, 24, 11, 5.5, "plague")
    orb(ic, 30, 21, 2.0, "plague")
    orb(ic, 15, 6, 1.8, "plague")


@item
def staff_choir(ic):
    ic.add(ic.S().line([(9, 30), (26, 9)], 2.2), "mist", group="baton", name="baton")
    ic.add(ic.S().ell(9, 30, 3.4), PINK, name="grip")
    ic.add(ic.S().line([(10, 27), (5, 24), (7, 19)], 1.6), PINK, name="ribbon")
    ic.add(ic.S().ell(18, 12, 3.4, 2.6).line([(21, 11.5), (21, 3)], 1.6).line([(21, 3), (26, 6)], 1.8), "spirit", name="note")


# ================================================================== CAPUZES

@item
def hood_worn(ic):
    hood_base(ic, "burlap")
    ic.add(ic.S().poly([(6.5, 22), (12, 21), (12.5, 27), (7, 28)]), "wool", name="patch")
    stitches(ic, [(7, 21), (9, 21), (11, 20), (12, 23), (13, 25), (8, 28), (10, 28)], "#c8b890")
    stitches(ic, [(14, 6), (15, 8), (14, 10)], "#2a1c14")


@item
def hood_skull(ic):
    skull(ic, 18, 15, 13, eye=None)
    ic.add(ic.S().line([(9, 6), (12, 9), (11, 12)], 1.2), "#6b6452", group="skull")


@item
def hood_maggot(ic):
    hood_base(ic, MAGGOT_CLOTH, eyes="#aef5bf")
    s = ic.S()
    for x, y in ((10, 10), (25, 8), (7, 26), (28, 27), (17, 4.5)):
        s.ell(x, y, 2.2, 1.2)
    ic.add(s, "maggot", name="maggots")


@item
def hood_plague(ic):
    ic.add(ic.S().ell(16, 15, 12, 12.5).poly([(4, 34), (30, 34), (27, 20), (6, 20)]), "robe", group="hood", name="hood")
    ic.add(ic.S().ell(15, 15, 8.5, 9.5), "oldbone", group="mask", name="mask")
    ic.add(ic.S().poly([(18, 15), (33, 27), (30, 29), (16, 23)]), "oldbone", group="beak", name="beak")
    orb(ic, 11.5, 13, 3.0, "plague")
    orb(ic, 19, 12.5, 2.7, "plague")


@item
def hood_seer(ic):
    hood_base(ic, SEER_BLUE, eyes="#8fd3ff")
    ic.add(ic.S().ell(18, 8.5, 4.2, 2.4), "holy", name="eye")
    ic.px(18, 8, "#2a4a70").px(19, 8, "#8fd3ff")


@item
def hood_banshee(ic):
    s = ic.S().ring(18, 26, 13, 6.5, 3.5, 2.6)
    for x, h in ((7, 13), (12.5, 8), (18, 3), (23.5, 8), (29, 13)):
        s.poly([(x - 3, 25), (x, h), (x + 3, 25)])
    ic.add(s, "mist", group="crown", name="crown")
    m = ic.S()
    for x, y in ((12.5, 17), (18, 13), (23.5, 17)):
        m.ell(x, y, 1.1, 1.8)
    ic.add(m, VOID, name="mouths")
    ic.add(ic.S().ell(18, 26, 1.8), "spirit", name="stone")


@item
def hood_crimson(ic):
    ic.add(ic.S().line([(8, 12), (4, 6), (5, 2)], 2.4).line([(28, 12), (32, 6), (31, 2)], 2.4), "bone", name="horns")
    ic.add(ic.S().ell(18, 15, 11, 11.5).rect(7, 15, 29, 32), "crimson", group="helm", name="helm")
    ic.add(ic.S().rect(10, 15, 26, 18).rect(16.5, 18, 19.5, 25), VOID, name="visor")
    ic.px(12, 16, "#e0304a").px(13, 16, "#e0304a").px(22, 16, "#e0304a").px(23, 16, "#e0304a")
    for x, y in ((9, 22), (27, 22), (9, 28), (27, 28)):
        ic.px(x, y, "#8a94a6")


@item
def hood_lich(ic):
    s = ic.S().rect(5, 20, 31, 30)
    s.poly([(5, 21), (5, 9), (10.5, 15), (14, 4), (18, 13), (22, 4), (25.5, 15), (31, 9), (31, 21)])
    ic.add(s, "gold", group="crown", name="crown")
    ic.add(ic.S().rect(5, 27, 31, 30), "bronze", group="crown")
    gem(ic, 18, 23.5, 3.4, "soul")
    orb(ic, 10, 23.5, 2.0, "soul", glint=False)
    orb(ic, 26, 23.5, 2.0, "soul", glint=False)
    ic.glint(14, 5).glint(22, 5)


@item
def hood_eye(ic):
    s = ic.S()
    for pts in (((10, 26), (6, 31), (8, 34)), ((15, 28), (14, 33)), ((22, 28), (24, 33)), ((26, 26), (31, 30), (30, 34))):
        s.line(list(pts), 2.0)
    ic.add(s, "abyss", name="tendrils")
    ic.add(ic.S().ell(18, 16, 13, 12), "rose", group="eye", name="sclera")
    ic.add(ic.S().ell(20, 16, 6.5), "abyss", name="iris")
    ic.add(ic.S().ell(21, 16, 1.6, 4.0), VOID, name="pupil")
    ic.glint(17, 13)
    for x, y in ((8, 12), (9, 13), (7, 18), (10, 22), (28, 10), (29, 11), (30, 19)):
        ic.px(x, y, "#9e2236")


@item
def hood_pest(ic):
    hood_base(ic, PEST_CLOTH, eyes="#aef5bf")
    ic.add(ic.S().arc(18, 30, 13, 6, 190, 250, 1.6).arc(18, 30, 13, 6, 290, 350, 1.6), "bone", name="ribs")
    skull(ic, 18, 30.5, 2.6, eye=None, jaw=False)
    orb(ic, 8, 9, 1.8, "plague", glint=False)
    orb(ic, 27, 6, 1.5, "plague", glint=False)


@item
def hood_choir(ic):
    s = ic.S().ell(18, 13, 11, 10.5).poly([(5, 34), (31, 34), (28, 14), (8, 14)])
    for x in (8, 14.5, 21, 27.5):
        s.cut_poly([(x - 2.5, 34.5), (x, 30), (x + 2.5, 34.5)])
    ic.add(s, "mist", group="veil", name="veil")
    ic.add(ic.S().ell(18, 18, 5.5, 6.5), VOID, group="face", name="face")
    ic.px(16, 17, "#8fd3ff").px(20, 17, "#8fd3ff")
    ic.add(ic.S().arc(18, 8, 10, 4, 180, 360, 2.0), PINK, name="ribbon")


# ================================================================== MANTOS

@item
def cloak_wool(ic):
    cloak_base(ic, "wool")
    collar(ic, "wool")
    clasp(ic, "iron", 18, 11)


@item
def cloak_ossuary(ic):
    cloak_base(ic, OSS_GREY)
    s = ic.S()
    for y in (16, 20.5, 25):
        s.line([(10, y + 1), (14, y), (22, y), (26, y + 1)], 1.6)
    ic.add(s, "bone", name="ribs")
    collar(ic, OSS_GREY)
    skull(ic, 18, 9.5, 3.4, eye="#aef5bf", jaw=False)


@item
def cloak_flesh(ic):
    cloak_base(ic, "flesh", folds=False)
    ic.add(ic.S().line([(17, 10), (13, 32)], 1.2).line([(21, 13), (27, 24)], 1.2), "#7a3040", group="cloak", name="seams")
    stitches(ic, [(15, 13), (17, 15), (14, 19), (16, 21), (13, 25), (15, 27), (12, 30), (14, 31),
                  (22, 14), (24, 16), (23, 19), (26, 20), (25, 23), (27, 23)], "#2a1c14")
    collar(ic, "flesh")
    clasp(ic, "bone", 18, 11, 2.3)


@item
def cloak_bile(ic):
    cloak_base(ic, "bile")
    collar(ic, "bile")
    clasp(ic, "rust", 18, 11)
    drop(ic, 9, 33, 1.6, "plague")
    drop(ic, 21, 33.5, 1.5, "plague")
    orb(ic, 24, 20, 1.8, "plague", glint=False)
    orb(ic, 12, 22, 1.5, "plague", glint=False)


@item
def cloak_shroud(ic):
    cloak_base(ic, "mist", hem="tatter", folds=False)
    ic.add(ic.S().ell(14.5, 17, 2.2, 3).ell(21.5, 17, 2.2, 3).ell(18, 25, 2.4, 3.4), "#2a4a70", name="face")
    ic.add(ic.S().line([(12, 10), (9, 30)], 1.2).line([(24, 10), (27, 30)], 1.2), "#7fb0cc", group="cloak")


@item
def cloak_crimson(ic):
    cloak_base(ic, "crimson")
    collar(ic, "crimson")
    clasp(ic, "iron", 18, 11)
    drop(ic, 18, 31, 1.7, "blood")


@item
def cloak_reaper(ic):
    cloak_base(ic, "dark", hem="tatter", folds=True)
    ic.add(ic.S().ell(18, 10, 8.5, 8.5).poly([(10, 12), (18, 1.5), (26, 12)]), "dark", group="hood", name="hood")
    ic.add(ic.S().ell(18, 12, 5, 5.5), VOID, group="face", name="face")
    ic.px(16, 12, "#aef5bf").px(20, 12, "#aef5bf").px(16, 13, "#38b46a").px(20, 13, "#38b46a")
    ic.add(ic.S().ell(5, 22, 1.4).ell(31, 18, 1.3), "soul", name="wisps")


@item
def cloak_pact(ic):
    cloak_base(ic, "crimson")
    collar(ic, "crimson")
    heart(ic, 18, 21, 5.5, "flesh")
    stitches(ic, [(17, 17), (18, 19), (17, 21), (18, 23), (17, 25)], "#2a1c14")
    clasp(ic, "iron", 18, 11, 2.2)


@item
def cloak_choir(ic):
    cloak_base(ic, "mist", hem="tatter", folds=True)
    collar(ic, "mist")
    ic.add(ic.S().line([(9, 14), (18, 19), (27, 14)], 2.0).line([(18, 19), (15, 27)], 1.6), PINK, name="ribbon")
    ic.add(ic.S().ell(18, 19, 2.3), "spirit", name="knot")


# ================================================================== AMULETOS

@item
def amulet_tooth(ic):
    cord(ic, "leather", (18, 16))
    for i, x in enumerate((9, 13.5, 18, 22.5, 27)):
        y = 11 + (2 - abs(i - 2)) * 2.5
        ic.add(ic.S().poly([(x - 2.2, y), (x + 2.2, y), (x, y + 9 - abs(i - 2) * 1.5)]), "bone", name=f"tooth{i}")


@item
def amulet_digger(ic):
    chain(ic, "iron", (18, 15))
    ic.add(ic.S().line([(18, 14), (18, 22)], 2.2).line([(15.5, 14.5), (20.5, 14.5)], 1.8), "wood", group="handle", name="handle")
    ic.add(ic.S().poly([(12.5, 22), (23.5, 22), (23.5, 29), (18, 33.5), (12.5, 29)]), "bronze", name="blade")
    ic.glint(14, 23)


@item
def amulet_reliquary(ic):
    chain(ic, "gold", (18, 14))
    ic.add(ic.S().ell(18, 24, 8.5, 9.5), "gold", group="case", name="case")
    ic.add(ic.S().ell(18, 24, 5.5, 6.5), "holy", group="glass", name="window")
    ic.add(ic.S().rect(17, 19.5, 19, 29).rect(14.5, 22, 21.5, 24), "gold", name="cross")
    gem(ic, 18, 14.5, 2.4, "blood")


@item
def amulet_quiver(ic):
    cord(ic, "leather", (17, 13))
    for (a, b) in (((15, 15), (9, 4)), ((18, 14), (16, 3)), ((21, 15), (25, 4))):
        ic.add(ic.S().line([a, b], 1.4), "bone", group="arrows")
        ic.add(ic.S().poly([(b[0] - 2, b[1] + 2.5), (b[0], b[1] - 1.5), (b[0] + 2, b[1] + 2.5)]), "soul", name="fletch")
    ic.add(ic.S().poly([(11, 16), (24, 14), (27, 31), (16, 34)]), "oldbone", group="quiver", name="quiver")
    ic.add(ic.S().line([(12, 20), (25, 18)], 1.2).line([(13, 25), (26, 23)], 1.2).line([(14.5, 30), (26.5, 28)], 1.2),
           "#5c5238", group="quiver", name="ribs")


@item
def amulet_ancestor(ic):
    cord(ic, "leather", (18, 14))
    s = ic.S()
    for a, b in (((9, 30), (26, 16)), ((10, 16), (27, 30)), ((18, 14), (18, 33))):
        s.line([a, b], 2.6).ell(a[0], a[1], 2.0).ell(b[0], b[1], 2.0)
    ic.add(s, "oldbone", group="bones", name="bones")
    ic.add(ic.S().ell(18, 23, 3.6, 3.0), "leather", name="knot")


@item
def amulet_feast(ic):
    cord(ic, "leather", (18, 13))
    ic.add(ic.S().ell(18, 25, 9.5, 8.5).poly([(14, 14), (22, 14), (24, 19), (12, 19)]), "leather", group="pouch", name="pouch")
    ic.add(ic.S().rect(12.5, 17, 23.5, 19.5), "#3a2418", group="pouch", name="tie")
    ic.add(ic.S().arc(18, 16, 4, 3, 180, 360, 2.0), "flesh", name="guts")
    drop(ic, 13, 33, 1.5, "blood")
    drop(ic, 23, 33.5, 1.4, "blood")


@item
def amulet_ghoul(ic):
    cord(ic, "leather", (18, 12))
    ic.add(ic.S().poly([(12, 13), (24, 13), (23, 21), (19, 30), (15.5, 33.5), (16, 25)]), "oldbone", name="fang")
    ic.add(ic.S().rect(12, 12, 24, 15), "leather", name="wrap")
    ic.add(ic.S().poly([(16.6, 29), (19.5, 29.5), (15.5, 33.5)]), "blood", name="blood")


@item
def amulet_rats(ic):
    cord(ic, "leather", (18, 11))
    for i, x in enumerate((9.5, 13.5, 17.5, 21.5, 25.5)):
        ic.add(ic.S().rect(x - 1.9, 11.5, x + 1.9, 33.5 - i * 3.6), "bone" if i % 2 else "oldbone", group=f"pipe{i}", name="pipe")
        ic.px(int(x) - 1, 12, VOID).px(int(x), 12, VOID)
    ic.add(ic.S().rect(7, 16, 29, 18.5), "leather", group="band", name="band")
    ic.add(ic.S().line([(28.5, 18), (32, 23), (30, 28), (32, 32)], 1.3), "flesh", name="tail")


@item
def amulet_veil(ic):
    chain(ic, "iron", (18, 12))
    s = ic.S().ell(18, 19, 8, 8).rect(10, 19, 26, 30)
    for x in (12, 18, 24):
        s.cut_ell(x + 3, 31.5, 2.0, 2.4)
    ic.add(s, "mist", group="ghost", name="ghost")
    ic.add(ic.S().ell(15, 19, 1.6, 2.2).ell(21, 19, 1.6, 2.2).ell(18, 25, 1.6, 2.2), "#2a4a70", name="face")


@item
def amulet_dagger(ic):
    cord(ic, "leather", (18, 9))
    ic.add(ic.S().ell(18, 10, 2.4), "blood", name="pommel")
    ic.add(ic.S().rect(16.5, 11, 19.5, 17), "crimson", group="hilt", name="grip")
    ic.add(ic.S().rect(12, 17, 24, 19.5), "iron", group="guard", name="guard")
    ic.add(ic.S().poly([(15.5, 19.5), (20.5, 19.5), (21.5, 27), (17, 34), (18.5, 27)]), "iron", name="blade")
    ic.px(17, 21, "#e0304a").px(17, 22, "#e0304a")


@item
def amulet_chalice(ic):
    ic.add(ic.S().poly([(6, 6), (30, 6), (26, 17), (10, 17)]).ell(18, 15, 8, 5), "iron", group="cup", name="cup")
    ic.add(ic.S().ell(18, 6.5, 12, 2.6), "blood", group="wine", name="blood")
    ic.add(ic.S().rect(16, 19, 20, 27).ell(18, 30.5, 8, 3), "iron", group="foot", name="foot")
    ic.add(ic.S().line([(8, 7), (7, 12)], 1.5), "blood", name="drip")
    ic.glint(10, 9).glint(14, 28)


@item
def amulet_hunger(ic):
    cord(ic, "leather", (18, 9))
    heart(ic, 18, 20, 13, "blood")
    ic.add(ic.S().ell(18, 21, 6, 3.6), VOID, name="mouth")
    s = ic.S()
    for x in (14, 17, 20, 23):
        s.poly([(x - 1.2, 17.6), (x + 1.2, 17.6), (x, 20.6)])
    for x in (15.5, 18.5, 21.5):
        s.poly([(x - 1.1, 24.4), (x + 1.1, 24.4), (x, 21.8)])
    ic.add(s, "bone", name="teeth")
    ic.glint(10, 14).glint(11, 13)
    for x, y in ((25, 14), (26, 15), (8, 20), (27, 21)):
        ic.px(x, y, "#9e2236")


@item
def amulet_pact(ic):
    cord(ic, "leather", (18, 9))
    heart(ic, 18, 21, 12, "flesh")
    ic.add(ic.S().line([(18, 12), (18, 31)], 1.4), "#7a3040", group="heart", name="seam")
    stitches(ic, [(16, 13), (19, 15), (16, 18), (19, 20), (16, 23), (19, 25), (17, 28)], "#5a0f1d")
    ic.glint(11, 15)


# ================================================================== ANÉIS

@item
def ring_iron(ic):
    ring_band(ic, "iron", ry=8.5, t=4.8)
    for x, y in ((10, 22), (25, 21), (14, 31), (24, 31)):
        ic.px(x, y, "#464e5e")
    ic.glint(9, 22).glint(10, 21)


@item
def ring_tomb(ic):
    ring_band(ic, "iron")
    ic.add(ic.S().ell(18, 9, 6.5, 6).rect(11.5, 9, 24.5, 20), TOMB, name="stone")
    ic.add(ic.S().rect(17, 6, 19, 15).rect(14.5, 8, 21.5, 10), "#2c2a36", name="cross")


@item
def ring_tibia(ic):
    ring_band(ic, "bone")
    ic.add(ic.S().ell(13.5, 18.5, 3.2).ell(22.5, 18.5, 3.2).ell(16, 16.5, 2.6).ell(20, 16.5, 2.6), "bone", name="knobs")


@item
def ring_bone(ic):
    ring_band(ic, "bone")
    skull(ic, 18, 11.5, 7)


@item
def ring_flesh(ic):
    ring_band(ic, "flesh", t=5)
    stitches(ic, [(9, 24), (10, 26), (13, 30), (15, 31), (21, 31), (23, 30), (26, 26), (27, 24), (11, 20), (25, 20)], "#2a1c14")
    ic.add(ic.S().ell(18, 17.5, 4.2, 3.2), "flesh", name="lump")


@item
def ring_hide(ic):
    ring_band(ic, "leather", t=5)
    stitches(ic, [(8, 26), (11, 30), (15, 32), (19, 32), (23, 31), (27, 28), (28, 24), (25, 19), (11, 19)], "#c8b890")
    ic.add(ic.S().rect(14, 15, 22, 21).cut_rect(16, 17, 20, 19), "iron", name="buckle")


@item
def ring_plague(ic):
    ring_band(ic, "bile")
    orb(ic, 18, 13, 6, "plague")
    orb(ic, 26, 8, 2.2, "plague", glint=False)
    orb(ic, 10, 9, 1.7, "plague", glint=False)


@item
def ring_fever(ic):
    ring_band(ic, "bronze")
    ic.add(ic.S().poly([(13, 18.5), (23, 18.5), (21, 21), (15, 21)]), "bronze", name="setting")
    orb(ic, 18, 13.5, 5.5, FEVER)
    ic.add(ic.S().arc(18, 13.5, 9, 8, 200, 250, 1.4).arc(18, 13.5, 9, 8, 290, 340, 1.4), "blood", name="heat")


@item
def ring_spores(ic):
    ring_band(ic, "wood")
    for (x, y, r) in ((13, 15, 4.5), (22, 12, 5.5), (27.5, 18, 3.2)):
        ic.add(ic.S().rect(x - 1.2, y, x + 1.2, y + 6), "mush", group=f"st{x}", name="stem")
        ic.add(ic.S().ell(x, y, r, r * 0.7).cut_rect(x - r - 1, y + 0.4, x + r + 1, y + r + 1), "plague", group=f"cap{x}", name="cap")
    for x, y in ((12, 13), (21, 9), (23, 10), (27, 16)):
        ic.px(x, y, "#d0e880")


@item
def ring_chains(ic):
    ic.add(ic.S().ring(13, 19, 8, 12, 3.2), "spirit", group="a", name="link1")
    ic.add(ic.S().ring(23, 19, 8, 12, 3.2).cut_rect(13, 7, 19, 13), "mist", group="b", name="link2")
    ic.glint(8, 12).glint(19, 10)


@item
def ring_spirit(ic):
    ring_band(ic, "iron")
    ic.add(ic.S().poly([(13, 19), (23, 19), (21, 22), (15, 22)]), "iron", name="setting")
    orb(ic, 18, 13, 6.5, "spirit")


@item
def ring_blood(ic):
    ring_band(ic, "iron")
    ic.add(ic.S().poly([(13, 19), (23, 19), (21, 22.5), (15, 22.5)]), "iron", name="setting")
    gem(ic, 18, 13, 7, "blood")


@item
def ring_fury(ic):
    ring_band(ic, "crimson")
    s = ic.S()
    for a, b in (((18, 13), (18, 1.5)), ((18, 13), (8, 5)), ((18, 13), (28, 5)), ((18, 13), (6, 15)), ((18, 13), (30, 15))):
        s.poly([(a[0] - 2.2, a[1]), b, (a[0] + 2.2, a[1])])
    ic.add(s, "iron", name="spikes")
    gem(ic, 18, 13, 5.5, "blood")


@item
def ring_rosary(ic):
    s = ic.S()
    for i in range(14):
        a = math.radians(i * 360 / 14)
        s.ell(18 + 12 * math.cos(a), 17 + 9 * math.sin(a), 2.0)
    ic.add(s, "rose", name="beads")
    ic.add(ic.S().rect(16.5, 25, 19.5, 34).rect(13, 29.5, 23, 32), "crimson", name="cross")


@item
def ring_abyss(ic):
    ring_band(ic, "dark")
    orb(ic, 18, 13, 7, "abyss", glint=False)
    ic.add(ic.S().ell(18, 13, 1.6, 4.6), VOID, name="pupil")
    ic.px(19, 10, "#ff7080").glint(14, 9)


@item
def ring_pest(ic):
    ring_band(ic, "bone")
    ic.add(ic.S().ell(13.5, 18.5, 3.0).ell(22.5, 18.5, 3.0), "bone", name="knobs")
    gem(ic, 18, 12.5, 5.5, "plague")
    orb(ic, 27, 9, 1.8, "plague", glint=False)


@item
def ring_pact(ic):
    ring_band(ic, "crimson")
    heart(ic, 18, 13, 7, "flesh")
    stitches(ic, [(17, 9), (18, 11), (17, 13), (18, 15)], "#5a0f1d")


# ================================================================== ESCOLAS (7x7, à mão)

SCHOOL_PAL = {
    "w": "#e3dccb", "b": "#a49c86", "B": "#6b6452", "G": "#aef5bf", "x": "#241c2c",
    "f": "#b5525e", "F": "#7a3040", "p": "#e8a0a8",
    "g": "#8fbf3a", "q": "#5a7a20", "Q": "#d0e880",
    "s": "#8fd3ff", "S": "#4a8ab8", "t": "#e8f8ff",
    "r": "#e0304a", "R": "#9e2236", "o": "#ff7080",
    "y": "#c9a23a", "Y": "#f6cf6a", "z": "#8a5a18",
}

SCHOOL_ROWS = {
    "bone": [".wwwww.", "wwwwwwb", "wxwbxwb", "wGwbGwb", ".bwxwb.", ".bBbBb.", "......."],
    "flesh": [".pf.ff.", "pfffffF", "fffffFF", "ffffFFF", ".fffFF.", "..fFF..", "...F..."],
    "plague": ["...g...", "..ggg..", ".gQggq.", ".Qgggq.", "gggggqq", ".gggqq.", "..qqq.."],
    "spirit": [".ttss..", "tssssS.", "sxssxS.", "sssssS.", "ssssSS.", "sSsSsS.", "s.S.S.."],
    "blood": ["...r...", "..rrr..", ".orrrR.", ".orrrR.", "rrrrrRR", ".rrrRR.", "..RRR.."],
    "neutral": ["..yyy..", ".yzzzy.", "yz.Y.zy", "yzYYYzy", "yz.Y.zy", ".yzzzy.", "..yyy.."],
}


def _school_from_rows(name):
    def draw(ic):
        ic.rows = SCHOOL_ROWS[name]
    draw.__name__ = name
    return draw


for _n in SCHOOL_ROWS:
    school(_school_from_rows(_n))
