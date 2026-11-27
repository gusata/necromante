"""Arte pequena desenhada à mão, pixel a pixel (estilo PixelSpec do codeart2d): ícones de HUD, barra de navegação,
ramos da árvore, cenário, projéteis, manchas e os bichos pequenos (rato, cão, fantasma, banshee).

Direção (docs/ARTE.md): uma grade só, sem contorno preto, 2 a 3 tons por material, borda no tom mais escuro do
lado da sombra, luz de cima-esquerda. Cenário escuro e calmo; fogo e almas são as únicas luzes.
Cada entrada: chave de textura -> (paleta, [quadros]). Os tamanhos são os mesmos da arte antiga (o layout depende).
"""

# ------------------------------------------------------------------ paletas

ICON = {
    "W": "#f8f4e8", "w": "#e3dccb", "b": "#a49c86", "B": "#6b6452", "x": "#241c2c",
    "G": "#aef5bf", "g": "#38b46a", "q": "#1f6a3e", "Q": "#f0fff4",
    "R": "#e0304a", "r": "#9e2236", "d": "#5a0f1d", "P": "#ffa0b0",
    "Y": "#f6cf6a", "y": "#c9a23a", "z": "#8a5a18",
    "F": "#fff8e0", "O": "#f0a040", "o": "#d0662a", "v": "#8a3a14",
    "M": "#c8d0e0", "m": "#8a94a6", "n": "#464e5e", "N": "#2a2f3a",
    "T": "#a07a54", "t": "#6e4d36", "u": "#4a3222", "U": "#2e1f16",
    "c": "#f2e3c6", "C": "#a89078",
    "p": "#8a6aa8", "h": "#6a4888", "H": "#4c2f61",
    "S": "#8a8098", "s": "#5e5670", "k": "#3a3448",
}

SCENE = {
    "S": "#4a4254", "s": "#352e3e", "c": "#241e2b", "C": "#16121b",
    "a": "#4a3a2e", "b": "#2e241c", "e": "#1c1612",
    "w": "#a89c86", "W": "#d8ccb0", "B": "#6b6452",
    "Y": "#fff0b0", "O": "#f0a040", "o": "#d0662a", "E": "#8a3a14",
    "n": "#2a2630", "m": "#464e5e", "M": "#6a7284",
    "R": "#7a1c24", "r": "#4d1117", "y": "#8a6a22", "z": "#5a4614",
    "v": "#5a0f1d", "d": "#3a0812", "k": "#0d0a10", "t": "#6e4d36", "u": "#4a3222",
    "x": "#3a3040", "X": "#2a2230", "Z": "#1c1622",
}

BONE = {"W": "#f8f4e8", "w": "#e3dccb", "b": "#a49c86", "B": "#6b6452", "x": "#241c2c", "G": "#aef5bf"}
RAT = {"h": "#7a7462", "H": "#54503f", "j": "#3a3729", "G": "#c8ff8a", "p": "#b07a78"}
HOUND = {"K": "#8a6448", "k": "#5e4030", "i": "#3d2a20", "O": "#e0a040", "w": "#e3dccb"}
GHOST = {"A": "#e8f8ff", "a": "#bfe9ff", "e": "#6fa8c8", "E": "#3e6e8e", "x": "#1a2a3c"}
BANSHEE = {"A": "#fbf6ff", "a": "#e0d4f4", "e": "#a08cc8", "E": "#6a5a94", "x": "#2a1e3a"}

# ------------------------------------------------------------------ HUD

HUD = {
    "icon-soul": (ICON, [["..G..", ".gG..", ".gGG.", "gGQGg", "gGGGg", ".qgq."]]),
    "icon-skull": (ICON, [[".www.", "wwwwb", "wxwxb", ".wbw.", ".b.b."]]),
    "icon-heart": (ICON, [[".R.R.", "RPRRr", "RRRRr", ".RRr.", "..d.."]]),
    "icon-pause": (ICON, [["cC.cC", "cC.cC", "cC.cC", "cC.cC", "CC.CC"]]),
    "icon-lock": (ICON, [[".mmm.", "m...n", "yyyyz", "yYxyz", "yyxyz", "zzzzz"]]),
    "icon-explode": (ICON, [["...O...", ".o.O.o.", "..OYO..", "OOYFYOO", "..OYO..", ".o.O.o.", "...o..."]]),
    "icon-fuse": (ICON, [["w.....w", ".b...b.", "..www..", ".wxwxw.", ".wwwwb.", "..bwb..", "..b.b.."]]),
    "icon-consume": (ICON, [["...R...", "..RRr..", ".RRRRr.", ".RPRRr.", "RRRRRrr", ".RRRrr.", "..ddd.."]]),
    "icon-hand": (ICON, [[
        "...Ww.....",
        "...wb.....",
        "...wb.....",
        "...wbWwWw.",
        ".Wwwbwbwbb",
        "wwbwwwwwwb",
        "wwwwwwwwwb",
        ".wwwwwwwb.",
        "..wwwwwwb.",
        "...bbbbb..",
        "..........",
    ]]),
    "icon-ritual": (ICON, [[
        "...ggggg...",
        "..g.....g..",
        ".g...G...g.",
        "g...G.G...g",
        "gGGGGGGGGGg",
        "g.G.....G.g",
        "g..G...G..g",
        ".g.GG.GG.g.",
        "..gG.G.Gg..",
        "...ggggg...",
    ]]),
}

# ------------------------------------------------------------------ barra de navegação (11x11)

NAV = {
    "nav-home": (ICON, [[
        "....hhh....",
        "...hpphH...",
        "..hpphhhH..",
        "..hhxxxhH..",
        ".hhxGxGxhH.",
        ".hhxxxxxhH.",
        ".hhhxxxhhH.",
        "hhhhhhhhhhH",
        "hphhhhhhhHH",
        "hphhhhhhhHH",
        ".HHHHHHHHH.",
    ]]),
    "nav-market": (ICON, [[
        "...........",
        ".RcRcRcRcR.",
        "RcRcRcRcRcr",
        ".r.r.r.r.r.",
        ".T.......u.",
        ".T..yYy..u.",
        ".T.yYyyz.u.",
        ".TTTTTTTTu.",
        ".TtttttttU.",
        ".T.......u.",
        ".u.......U.",
    ]]),
    "nav-arsenal": (ICON, [[
        "........MM.",
        ".......Mmn.",
        "......Mmn..",
        ".....Mmn...",
        "....Mmn....",
        ".y.Mmn.....",
        "..yyn......",
        "..tyy......",
        ".tu..y.....",
        "tu.........",
        "Y..........",
    ]]),
    "nav-tree": (ICON, [[
        "..G..g..G..",
        "..gt.t.tg..",
        "...t.t.t...",
        "...ttttt.G.",
        ".G..ttu.tg.",
        ".gt.tu.t...",
        "...ttu.....",
        "....tu.....",
        "...tttu....",
        "..tt..uu...",
        ".bbbbbbbbB.",
    ]]),
    "nav-altar": (ICON, [[
        ".....G.....",
        "....GGg....",
        "...GQGgq...",
        "....Ggq....",
        ".....q.....",
        "SSSSSSSSSSs",
        ".sksssssks.",
        ".sksssssks.",
        ".sksssssks.",
        "SSSSSSSSSSs",
        "kkkkkkkkkkk",
    ]]),
    "nav-hoard": (ICON, [[
        "...........",
        "..ttttttt..",
        ".tTTTTTTTt.",
        ".tTTTTTTTu.",
        ".yyyyyyyyz.",
        ".tuuuYuuuU.",
        ".tuuyxyuuU.",
        ".tuuuyuuuU.",
        ".tuuuuuuuU.",
        ".yyyyyyyyz.",
        "...........",
    ]]),
    "nav-bestiary": (ICON, [[
        "..wwwwww...",
        ".wWwwwwwwb.",
        ".wwwwwwwwb.",
        ".wxxwwxxwb.",
        ".wxGwwxGwb.",
        ".wwwwxwwwb.",
        "..bwwwwwb..",
        "..wbwbwbw..",
        "..bwbwbwb..",
        "...bbbbb...",
        "...........",
    ]]),
    "nav-records": (ICON, [[
        "...........",
        ".yYYYYYYYz.",
        "y.yYYYYYz.z",
        "y.yYYYYyz.z",
        ".y.yYYyz.z.",
        "....yYz....",
        ".....y.....",
        "....yyz....",
        "...yYyyz...",
        "...zzzzz...",
        "...........",
    ]]),
    "nav-options": (ICON, [[
        "...........",
        "....m.m....",
        "..m.mMm.n..",
        "...mMMMm...",
        ".mmMmnmMmn.",
        "..mMnxnMn..",
        ".mmMmnmMnn.",
        "...mMmmn...",
        "..m.mmn.n..",
        "....n.n....",
        "...........",
    ]]),
}

# ------------------------------------------------------------------ ramos da árvore (11x11) e a cidadela (21x14)

TREE = {
    "b-crypt": (ICON, [[
        "...SSSSs...",
        "..SSSSSSs..",
        ".SSsssssks.",
        ".Ssxxxxxsk.",
        ".Ssxxxxxsk.",
        ".SsxxGxxsk.",
        ".Ssxxxxxsk.",
        ".Ssxxxxxsk.",
        ".Ssxxxxxsk.",
        "SSSSSSSSSSk",
        "kkkkkkkkkkk",
    ]]),
    "b-ossuary": (ICON, [[
        "...........",
        "....www....",
        "...wWwwb...",
        "...xwxwb...",
        "...bwwb....",
        ".www..www..",
        "wWwwbwWwwb.",
        "xwxwbxwxwb.",
        "bwwb.bwwb..",
        ".bb...bb...",
        "BBBBBBBBBBB",
    ]]),
    "b-altar": (ICON, [[
        ".....R.....",
        "....RRr....",
        "....RPr....",
        ".....r.....",
        "...........",
        "SSSSSSSSSSs",
        "sRrRrrRrrRk",
        ".s.r...r.k.",
        ".s.......k.",
        "SSSSSSSSSSs",
        "kkkkkkkkkkk",
    ]]),
    "b-library": (ICON, [[
        "...........",
        ".hhhhhhhH..",
        ".hppppphH..",
        ".hphGphhH..",
        ".hpGgGhhH..",
        ".hphGphhH..",
        ".hphhhhhH..",
        ".hphhhhhHw.",
        ".hhhhhhhHw.",
        "..wwwwwwwb.",
        "...........",
    ]]),
    "b-bell": (ICON, [[
        ".....u.....",
        "....yYy....",
        "...yYYyz...",
        "...yYyyz...",
        "..yYyyyyz..",
        "..yYyyyyz..",
        ".yYyyyyyyz.",
        "yyyyyyyyyzz",
        "...zzzzz...",
        ".....n.....",
        ".....m.....",
    ]]),
    "b-grave": (ICON, [[
        "...........",
        "....SSs....",
        "..SSSSSSs..",
        "..SSxSSSk..",
        "..SxxxSSk..",
        "..SSxSSSk..",
        "..SSxSSSk..",
        "..SSSSSSk..",
        ".qSSSSSSSq.",
        ".ttttttttu.",
        "...........",
    ]]),
    "b-reliquary": (ICON, [[
        ".....y.....",
        "....yYy....",
        ".....y.....",
        "..yyyyyyy..",
        ".yYYYYYYyz.",
        ".yYYRYYYyz.",
        ".yYYYYYYyz.",
        ".yyyyyyyyz.",
        ".zyzzzzyzz.",
        "..z.....z..",
        "...........",
    ]]),
    "b-hall": (ICON, [[
        "...........",
        "...........",
        ".y...y...y.",
        ".yy.yYy.yy.",
        ".yYyyYyyYy.",
        ".yYYYYYYYy.",
        ".yRYYGYYRy.",
        ".yYYYYYYYy.",
        ".zzzzzzzzz.",
        "...........",
        "...........",
    ]]),
    "necropolis": (ICON, [[
        "..........G..........",
        "..........s..........",
        ".........SSk.........",
        "........SSssk........",
        ".S.S...SSsssk...S.S..",
        ".SSk..SSsssssk..SSk..",
        ".SGk.SSSSSSSSSk.SGk..",
        ".Ssk.SsssssssskkSsk..",
        ".SskkSsGssGssGskSsk..",
        ".SssssssssssssssSsk..",
        ".SsGsssxxxxxsssGssk..",
        ".SssssssxGGxssssssk..",
        ".SssssssxGGxssssssk..",
        "kkkkkkkkkkkkkkkkkkkkk",
    ]]),
}

# ------------------------------------------------------------------ cenário (escuro, calmo)

PROPS = {
    "tomb": (SCENE, [[
        "..SSSSc..",
        ".SssssssC",
        "SsssssssC",
        "SsssCsssC",
        "SssCCCssC",
        "SsssCsssC",
        "SsssCsssC",
        "SsssssssC",
        "SsssssssC",
        "CCCCCCCCC",
    ]]),
    "tomb2": (SCENE, [[
        "...SSc...",
        ".SSssscC.",
        "SsssssssC",
        "SsCCCCssC",
        "SsssssssC",
        "SsCCCsssC",
        "SsssssssC",
        "CCCCCCCCC",
    ]]),
    "cross": (SCENE, [[
        "...Sc...",
        "...sC...",
        ".SSssCc.",
        ".sssssC.",
        "...sC...",
        "...sC...",
        "...sC...",
        "..SssC..",
        ".CCCCCC.",
    ]]),
    "tree": (SCENE, [[
        "....x.....x...",
        ".x..x...x.x...",
        "..x.xX..x.X...",
        "...xxX.xX.X.x.",
        ".....xXxX.XX..",
        "......xxXX....",
        ".......xX.....",
        ".......xX.....",
        "......xxXX....",
        ".....xx..XX...",
        "....x......X..",
        "..ZZZZZZZZZZ..",
    ]]),
    "fence": (SCENE, [[
        "a...a...a...",
        "ab..ab..ab..",
        "aaaaaaaaaaab",
        "ab..ab..ab..",
        "aaaaaaaaaaab",
        "ab..ab..ab..",
        "bb..bb..bb..",
    ]]),
    "pillar": (SCENE, [[
        "SSSSSSc",
        "CsssscC",
        ".SscsC.",
        ".SscsC.",
        ".SscsC.",
        ".SscsC.",
        ".SscsC.",
        ".SscsC.",
        ".SscsC.",
        ".SscsC.",
        "CsssscC",
        "SSSSSSc",
        "CCCCCCC",
    ]]),
    "wall": (SCENE, [[
        "SSSSSSSSSSSc",
        "sssCsssssCsC",
        "sssCsssssCsC",
        "CCCCCCCCCCCC",
        "sCsssssCsssC",
        "sCsssssCsssC",
        "CCCCCCCCCCCC",
    ]]),
    "barrel": (SCENE, [[
        ".aabbe.",
        "mmmmmmm",
        "aabbbbe",
        "aabbbbe",
        "aabbbbe",
        "mmmmmmm",
        ".eeeee.",
    ]]),
    "pew": (SCENE, [[
        "aaaaaaaaaaaaab",
        "bbbbbbbbbbbbbe",
        "aaaaaaaaaaaaab",
        "ebbbbbbbbbbbbe",
        ".b.........b..",
        ".e.........e..",
    ]]),
    "bones": (SCENE, [["w......w", ".BwwwwB.", "..B..B..", "........"]]),
    "candle": (SCENE, [
        [".Y.", ".O.", ".n.", "wwB", "wwB", "wwB", "BBB"],
        ["Y..", ".O.", ".n.", "wwB", "wwB", "wwB", "BBB"],
    ]),
    "brazier": (SCENE, [
        ["..Y.o..", ".oYOYo.", ".oOOOo.", "MMMMMMm", ".mMMMm.", "..m.m..", ".mm.mm."],
        [".o..Y..", "..OYOo.", ".oOOOo.", "MMMMMMm", ".mMMMm.", "..m.m..", ".mm.mm."],
    ]),
    "banner": (SCENE, [
        ["mMMMMMm", ".RRrRr.", ".RyyyR.", ".RRyRr.", ".RRrRr.", ".Rr.Rr.", ".R...r."],
        ["mMMMMMm", ".RRrRr.", ".RyyyR.", ".RRyRr.", ".RRRrr.", "..Rr.Rr", "..R...r"],
    ]),
    "candelabra": (SCENE, [
        ["Y.Y.Y", "O.O.O", "w.w.w", "y.y.y", "yyyyz", "..y..", "..y..", ".yyz.", "zzzzz"],
        [".YY.Y", "O.O.O", "w.w.w", "y.y.y", "yyyyz", "..y..", "..y..", ".yyz.", "zzzzz"],
    ]),
}

# ------------------------------------------------------------------ projéteis e manchas

SMALL = {
    "arrow": (ICON, [["u....", ".tttM", "u...."]]),
    "boltp": (ICON, [["nn....", ".uuuuM", "nn...."]]),
    "bonearrow": (BONE, [["b....", ".wwwW", "b...."]]),
    "splat": (SCENE, [["..v.....", ".vdv..v.", "vdddvv..", ".vdddv.v", "..v.v..."]]),
    "scorch": (SCENE, [["..CkC...", ".CkkkC..", "CkkEkkC.", ".CkkkCk.", "..CC.C.."]]),
    "corpse-bones": (BONE, [[
        "................",
        ".....www........",
        "....wxwxb..ww...",
        "..ww.wwb..wbbw..",
        ".wbbwwbbwwbbww..",
        "..BBBBBBBBBBBB..",
    ]]),
}

# ------------------------------------------------------------------ bichos pequenos

def _pad_top(rows, n, w):
    return ["." * w] * n + rows


GHOST_BASE = [
    "......aaaaaa........",
    ".....aAAAAAAe.......",
    "....aAAAAAAAAe......",
    "...aAAAAAAAAAAe.....",
    "...aAAxxAAxxAAe.....",
    "...aAAxxAAxxAAe.....",
    "...aAAAAAAAAAAe.....",
    "...aAAAAAxxAAAe.....",
]
GHOST_TAILS = [
    [
        "..aaAAAAAAAAAAee....",
        ".aa.aAAAAAAAAAe.ee..",
        "aa..aAAAAAAAAAe..ee.",
        "....aAAAAAAAAAe.....",
        "....aaAAAAAAAAe.....",
        "....aaaAAAAAAee.....",
        ".....aaaAAAaaee.....",
        ".....aa.aaa.aee.....",
        ".....a..aa..ae......",
        "........a....e......",
    ],
    [
        "..aaAAAAAAAAAAee....",
        "..aaaAAAAAAAAAeee...",
        "...a.aAAAAAAAAe..e..",
        "....aAAAAAAAAAe.....",
        "....aaAAAAAAAAe.....",
        "....aaaAAAAAAee.....",
        "....aaaAAAAaaee.....",
        "....aa.aaa.aaee.....",
        ".....a..aa..ae......",
        ".....a......e.......",
    ],
    [
        "..aaAAAAAxxxAAeeee..",
        "..aaAAAAAAAAAAe..ee.",
        "....aAAAAAAAAAe.....",
        "....aAAAAAAAAAe.....",
        "....aaAAAAAAAAe.....",
        "....aaaAAAAAAee.....",
        ".....aaaAAAaaee.....",
        ".....aa.aaa.aee.....",
        "......a.aa..e.......",
        "........a...........",
    ],
]
# ataque: boca aberta
GHOST_ATTACK_FACE = GHOST_BASE[:7] + ["...aAAAAAxxxAAe....."]


def ghost_frames():
    f0 = _pad_top(GHOST_BASE + GHOST_TAILS[0], 4, 20)
    f1 = _pad_top(GHOST_BASE + GHOST_TAILS[1], 4, 20)
    f2 = _pad_top(GHOST_ATTACK_FACE + GHOST_TAILS[2], 4, 20)
    return [f0, f1, f2]


UNITS = {
    "rat": (RAT, [
        ["........", "....hh..", ".hhhhhGh", "phHhhhhj", ".j..j.j."],
        ["........", "....hh..", ".hhhhhGh", "phHhhhhj", "..j.j..j"],
        ["........", "...hhh..", "hhhhhhGh", "pHhhhhjj", ".j.j...."],
    ]),
    "hound": (HOUND, [
        [
            "........KK..",
            ".......KKKK.",
            "k......KKOKk",
            ".kKKKKKKKKi.",
            "..KKKKKKKi..",
            "..kKiiikKi..",
            "..K.k..K.k..",
            ".k..k.k..k..",
        ],
        [
            "........KK..",
            ".......KKKK.",
            "k......KKOKk",
            ".kKKKKKKKKi.",
            "..KKKKKKKi..",
            "..kKiiikKi..",
            "...Kk..Kk...",
            "...k.k..k.k.",
        ],
        [
            "............",
            ".........KK.",
            "k.......KKKK",
            ".kKKKKKKKOKk",
            "..KKKKKKKKiw",
            "..kKiiikKi..",
            ".K..k..K.k..",
            "k...k.k...k.",
        ],
    ]),
    "ghost": (GHOST, ghost_frames()),
    "banshee": (BANSHEE, ghost_frames()),
}

# arquivo de saída -> grupo
SHEETS = {"hud": HUD, "nav": NAV, "arvore": TREE, "cenario": PROPS, "pequenos": SMALL, "bichos": UNITS}
# entradas com vários quadros: chave do quadro i (as unidades usam chave0..2; os enfeites, chave0..1)
