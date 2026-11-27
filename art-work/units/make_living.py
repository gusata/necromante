"""
Vivos (inimigos) desenhados por código: 20 tipos x 3 quadros (16x22) + cadáver próprio de cada um (16x6).

Cada vivo tem um PORTE (esquelético, atarracado, alto e magro, gordo, de hábito, blindado, magro sem camisa,
brutamontes), uma cabeça, um objeto que identifica a classe e uma pose de ataque exagerada. O braço é traçado do
ombro até a mão e o objeto é posicionado em relação à mão, então cada porte segura as coisas no lugar certo.

Depois, um sombreamento automático segue docs/ARTE.md:
  - luz de cima e da esquerda; lado direito e base na sombra (tom frio, puxado para o roxo);
  - a borda é o tom mais escuro do próprio material, só no lado da sombra (sem contorno preto);
  - perna, bota e braço de trás num tom abaixo, para ler o passo no tamanho real;
  - olhos, chamas, ouro e metal de arma são cores chapadas.

Saída: public/assets/sprites/vivos.png + .json (formato do Aseprite) e a entrada no manifesto (com --install).
Revisão: art-work/units/out/living-review.png (4x) e living-real.png (1x e 2x, sobre o chão do jogo).

uso: python art-work/units/make_living.py [--install]
"""
import argparse
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "out"
W, H = 16, 22

# --------------------------------------------------------------------------- cor


def mix(a, b, t):
    pa, pb = int(a[1:], 16), int(b[1:], 16)
    ch = lambda s: round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)  # noqa: E731
    return "#%02x%02x%02x" % (ch(16), ch(8), ch(0))


def ramp(base):
    """luz quente, base, sombra fria e borda funda (a sombra puxa para o roxo)"""
    return {
        "light": mix(base, "#fff2d8", 0.22),
        "base": base,
        "shadow": mix(base, "#241a38", 0.38),
        "edge": mix(base, "#0d0914", 0.62),
    }


# materiais sombreados: s pele · h cabelo/chapéu · c roupa · d 2ª cor · l calça · b bota · m armadura · w linho
# t tabardo · q couro/saco
SHADED = set("shcdlbmwtq")
# versões "de trás" (um tom abaixo): perna, bota, braço de roupa, braço de armadura, pele
BACK = {"v": "l", "z": "b", "a": "c", "g": "m", "i": "s"}
SKIN = {"s": "#b07e60"}
PALE = {"s": "#c9a68e"}
FLAT_DEFAULT = {
    "e": "#1a1220",  # olho
    "N": "#8a6038",  # madeira, luz
    "n": "#5a3c22",  # madeira, sombra
    "K": "#e8ecf2",  # aço da lâmina, brilho
    "k": "#9aa4b6",  # aço
    "j": "#4a5262",  # aço, sombra
    "y": "#e6b84a",  # ouro
    "Y": "#9a6a1e",  # ouro, sombra
    "O": "#fff0a0",  # chama, núcleo / luz
    "o": "#f08a2a",  # chama
    "u": "#b8401a",  # chama, borda
    "R": "#c0283c",  # vermelho heráldico
    "r": "#6e1222",  # vermelho, sombra
    "x": "#2a1c14",  # cinto
    "p": "#efe6cf",  # haste clara (flecha, virote), página
    "G": "#6e6a62",  # pedra
}

# --------------------------------------------------------------------------- cabeças (9 linhas, olhando para a direita)

HEADS = {
    "straw": [
        "................",
        "....hhhhhh......",
        "...hhhhhhhh.....",
        "..hhhhhhhhhhh...",
        "...dhsssssss....",
        "...ddssssses....",
        "...dssssssss....",
        "....sssssss.....",
        "......ssss......",
    ],
    "hair": [
        "................",
        ".....hhhhh......",
        "....hhhhhhhh....",
        "...hhhhhhhhh....",
        "...hhhhsssss....",
        "...hhhsssesse...",
        "...hhsssssssss..",
        "....hsssssss....",
        "......ssss......",
    ],
    "bald": [
        "................",
        ".....sssss......",
        "....sssssss.....",
        "...sssssssss....",
        "...sssssssss....",
        "...sssssesse....",
        "...ssssssssss...",
        "....ssssssss....",
        "......ssss......",
    ],
    # cabeça pequena (brutamontes): fica baixa, enterrada nos ombros
    "smallbald": [
        "................",
        "................",
        ".....ssss.......",
        "....sssssss.....",
        "....ssssesse....",
        "....ssssssss....",
        ".....sssssss....",
        "......ssss......",
        "................",
    ],
    "hood": [
        "....hh..........",
        "...hhhhhh.......",
        "..hhhhhhhhh.....",
        "..hhhhhhhhhh....",
        "..hhhhssssshh...",
        "..hhhssssesh....",
        "..hhhsssssssh...",
        "..hhhhsssssh....",
        "...hhhhhhhhh....",
    ],
    "veil": [
        "................",
        "....hhhhhhh.....",
        "...hhhhhhhhhh...",
        "..hhwwwwwwwwh...",
        "..hhwsssssssh...",
        "..hhwssssesh....",
        "..hhwssssssh....",
        "..hhhwsssssh....",
        "..hhhhhhhhhh....",
    ],
    "kettle": [
        "................",
        ".....mmmmm......",
        "....mmmmmmmm....",
        "...mmmmmmmmmm...",
        "..mmmmmmmmmmmm..",
        "...hhssssesse...",
        "...hssssssssss..",
        "....ssssssss....",
        "......ssss......",
    ],
    "nasal": [
        "................",
        ".....mmmmm......",
        "....mmmmmmmm....",
        "...mmmmmmmmmm...",
        "...mmmmmmmkmm...",
        "...mmsssseke....",
        "...mmssssskss...",
        "....msssssss....",
        "......ssss......",
    ],
    # elmo fechado de topo redondo (cavaleiro, com penacho)
    "great": [
        "................",
        "....mmmmmmm.....",
        "...mmmmmmmmmm...",
        "...mmmmmmmmmm...",
        "...mmmmmmmmmmm..",
        "...mmmmmeeeeem..",
        "...mmmmmmmmmmm..",
        "...mmmmmmmmmmm..",
        "....mmmmmmmmm...",
    ],
    # elmo de balde de topo reto com a cruz na viseira (templário)
    "bucket": [
        "................",
        "...mmmmmmmmmm...",
        "...mmmmmmmmmm...",
        "...mmmmmmmmmm...",
        "...mmmmmmmRmm...",
        "...mmmmeeeRee...",
        "...mmmmmmmRmm...",
        "...mmmmmmmRmm...",
        "...mmmmmmmmmm...",
    ],
    # elmo com coroa de ouro (paladino)
    "crown": [
        "...y..y..y......",
        "...yyyyyyyy.....",
        "...mmmmmmmmmm...",
        "...mmmmmmmmmm...",
        "...mmmmmmmmmmm..",
        "...mmmmmmeeeem..",
        "...mmmmmmmmmmm..",
        "...mmmmmmmmmm...",
        "....mmmmmmmm....",
    ],
    "mitre": [
        ".......w........",
        "......wyw.......",
        ".....wwyww......",
        "....wwwywww.....",
        "...yyyyyyyyy....",
        "...sssssssese...",
        "...sssssssssss..",
        "....ssssssss....",
        "......ssss......",
    ],
    "brim": [
        ".....hhhhh......",
        ".....hhhhh......",
        ".....dddddd.....",
        ".hhhhhhhhhhhhhh.",
        "...ssssssssss...",
        "...ssssssesse...",
        "...sssssssssss..",
        "....ssssssss....",
        "......ssss......",
    ],
}

# --------------------------------------------------------------------------- portes
# torso: (y inicial, linhas). legs: (y inicial, linhas) para o passo (0) e a passagem (1).
# A passagem sobe cabeça e tronco 1 px; por isso as pernas da passagem começam 1 linha acima.
# shoulder: onde o braço da frente nasce; hand: mão andando / atacando; lean: quanto o corpo avança no ataque.

BUILDS = {
    # esquelético e curvado: cabeça baixa e para a frente, tronco estreito, pernas finas
    "scrawny": dict(
        head=(1, 2),
        torso=(10, [
            ".....ccccc......",
            "....cccccc......",
            "...acccccc......",
            "...acccccc......",
            "...axxxxxx......",
            "....cccccc......",
            "....cccccc......",
        ]),
        legs=((17, [
            ".....v...l......",
            "....v.....l.....",
            "....v.....l.....",
            "...zz.....bb....",
            "..zzz.....bbb...",
        ]), (16, [
            "....cccccc......",
            "......vl........",
            "......vl........",
            "......vl........",
            ".....zzbb.......",
            ".....zzbbb......",
        ])),
        shoulder=(9, 11), hand=((11, 14), (13, 12)), lean=1,
    ),
    # atarracado: ombros largos, tronco cheio, pernas curtas e grossas
    "stocky": dict(
        head=(0, 1),
        torso=(9, [
            "....cccccc......",
            "...cccccccc.....",
            "..acccccccc.....",
            "..acccccccc.....",
            "..axxxxxxxx.....",
            "...cccccccc.....",
            "...cccccccc.....",
            "...llllllll.....",
            "...vvvvllll.....",
        ]),
        legs=((18, [
            "...vv...ll......",
            "..vv.....ll.....",
            "..zzz....bbb....",
            "..zzz....bbbb...",
        ]), (17, [
            "...vvvvllll.....",
            "....vvll........",
            "....vvll........",
            "...zzzbbb.......",
            "...zzzbbbb......",
        ])),
        shoulder=(10, 10), hand=((11, 14), (13, 12)), lean=1,
    ),
    # alto e magro: cabeça no topo, tronco estreito, pernas longas
    "tall": dict(
        head=(0, 0),
        torso=(9, [
            ".....cccc.......",
            "....cccccc......",
            "....accccc......",
            "....accccc......",
            "....xxxxxx......",
            "....cccccc......",
            "....llllll......",
        ]),
        legs=((16, [
            "....vv..ll......",
            "...vv....ll.....",
            "...vv....ll.....",
            "..vv......ll....",
            "..zz......bb....",
            ".zzz......bbb...",
        ]), (15, [
            "....vvvlll......",
            ".....vvll.......",
            ".....vvll.......",
            ".....vvll.......",
            ".....vvll.......",
            ".....zzbb.......",
            "....zzzbbb......",
        ])),
        shoulder=(9, 10), hand=((11, 13), (13, 11)), lean=2,
    ),
    # gordo: barriga para a frente, hábito até os pés
    "round": dict(
        head=(0, 1),
        torso=(9, [
            ".....cccccc.....",
            "....cccccccc....",
            "...accccccccc...",
            "...acccccccccc..",
            "...axxxxxxxxcc..",
            "...cccccccccc...",
            "...ccccccccc....",
            "...ccccccccc....",
        ]),
        legs=((17, [
            "...ccccccccc....",
            "..cccccccccc....",
            "..cccccccccc....",
            "..ccccccccccc...",
            "...zz....bb.....",
        ]), (16, [
            "...ccccccccc....",
            "...ccccccccc....",
            "...ccccccccc....",
            "..cccccccccc....",
            "..cccccccccc....",
            "....zzz.bbb.....",
        ])),
        shoulder=(11, 10), hand=((12, 13), (14, 11)), lean=2,
    ),
    # clero: ombros estreitos, barra larga que abre até o chão
    "robe": dict(
        head=(0, 1),
        torso=(9, [
            ".....cccccc.....",
            "....cccccccc....",
            "...acccccccc....",
            "...acccccccc....",
            "...axxxxxxxx....",
            "...cccccccccc...",
            "..ccccccccccc...",
            "..ccccccccccc...",
        ]),
        legs=((17, [
            "..cccccccccccc..",
            ".ccccccccccccc..",
            ".ccccccccccccc..",
            ".cccccccccccccc.",
            "..zzz.....bbb...",
        ]), (16, [
            "..ccccccccccc...",
            "..cccccccccccc..",
            "..cccccccccccc..",
            ".ccccccccccccc..",
            ".ccccccccccccc..",
            "....zzzbbb......",
        ])),
        shoulder=(10, 10), hand=((12, 13), (13, 11)), lean=1,
    ),
    # blindado: ombreiras largas, pernas grossas
    "heavy": dict(
        head=(0, 0),
        torso=(9, [
            "...mmmmmmmmm....",
            "..mmmmmmmmmmm...",
            "..gmmmmmmmmmm...",
            "...gcccccccc....",
            "...xxxxxxxxx....",
            "...cccccccc.....",
            "...cccccccc.....",
            "...vvvvlllll....",
        ]),
        legs=((17, [
            "...vvv..lll.....",
            "..vvv....lll....",
            "..vvv....lll....",
            "..zzz....bbb....",
            ".zzzz....bbbb...",
        ]), (16, [
            "...vvvvlllll....",
            "....vvvlll......",
            "....vvvlll......",
            "....vvvlll......",
            "....zzzbbb......",
            "...zzzzbbbb.....",
        ])),
        shoulder=(11, 10), hand=((12, 14), (14, 12)), lean=2,
    ),
    # soldado comum: proporção média, cota nos ombros
    "standard": dict(
        head=(0, 0),
        torso=(9, [
            "....mmmmmm......",
            "...mmmmmmmm.....",
            "...gcccccccc....",
            "...gccccccc.....",
            "...xxxxxxxx.....",
            "....ccccccc.....",
            "....ccccccc.....",
            "....vvvllll.....",
        ]),
        legs=((17, [
            "....vv...ll.....",
            "...vv.....ll....",
            "...vv.....ll....",
            "..zzz.....bbb...",
            "..zzz.....bbbb..",
        ]), (16, [
            "....vvvllll.....",
            ".....vvll.......",
            ".....vvll.......",
            ".....vvll.......",
            "....zzzbbb......",
            "....zzzbbbb.....",
        ])),
        shoulder=(10, 10), hand=((11, 14), (13, 12)), lean=1,
    ),
    # magro sem camisa: costelas à mostra, braços longos
    "lean": dict(
        head=(0, 0),
        torso=(9, [
            ".....sssss......",
            "....sssssss.....",
            "....isssssss....",
            "....isssssss....",
            ".....sssss......",
            "....dddddd......",
            "....dddddd......",
            "....vvvlll......",
        ]),
        legs=((17, [
            "....vv..ll......",
            "...vv....ll.....",
            "...vv....ll.....",
            "..zz......bb....",
            ".zzz......bbb...",
        ]), (16, [
            "....vvvlll......",
            ".....vvll.......",
            ".....vvll.......",
            ".....vvll.......",
            ".....zzbb.......",
            "....zzzbbb......",
        ])),
        shoulder=(9, 10), hand=((11, 15), (13, 10)), lean=1,
    ),
    # brutamontes: ombros enormes, cabeça pequena enterrada, braços até o joelho
    "hulk": dict(
        head=(2, 3),
        torso=(8, [
            "...cccccccc.....",
            "..cccccccccccc..",
            ".acccccccccccc..",
            ".acccccccccccc..",
            ".acccccccccccc..",
            "..xxxxxxxxxxx...",
            "..ccccccccccc...",
            "...ccccccccc....",
            "...vvvvvlllll...",
        ]),
        legs=((17, [
            "...vvv...lll....",
            "..vvv.....lll...",
            "..vvv.....lll...",
            ".zzzz.....bbbb..",
            ".zzzz.....bbbb..",
        ]), (16, [
            "...vvvvvlllll...",
            "....vvvvlll.....",
            "....vvvvlll.....",
            "....vvvvlll.....",
            "...zzzzbbbb.....",
            "...zzzzbbbb.....",
        ])),
        shoulder=(12, 10), hand=((13, 16), (13, 4)), lean=1,
    ),
}

# --------------------------------------------------------------------------- objetos, relativos à mão
# (0, 0) é a empunhadura: a coluna da direita da mão, na linha de cima dela. Cada objeto: (andando, atacando).


def rel(x0, y0, rows):
    out = []
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch != ".":
                out.append((x0 + dx, y0 + dy, ch))
    return out


def shaft(x, y0, y1, ch="N", dark_from=None):
    return [(x, y, "n" if dark_from is not None and y >= dark_from else ch) for y in range(y0, y1 + 1)]


WEAPONS = {
    "pitchfork": (
        rel(-2, -13, ["k.k.k", "k.k.k", "kkkkk"]) + shaft(0, -10, 7, dark_from=2),
        [(x, 0, "N") for x in range(-8, 1)] + rel(1, -2, ["kkK", "k..", "kkK", "k..", "kkK"]),
    ),
    "torch": (
        rel(-1, -9, [".O.", "oOo", "uOo", ".u."]) + shaft(0, -5, 4, dark_from=1),
        rel(1, -8, ["..O.", ".oOo", "uoOo", ".uo."]) + [(0, -1, "N"), (1, -2, "N"), (1, -3, "N"), (2, -4, "N")],
    ),
    "spear": (
        rel(-1, -16, [".K.", "kKk", ".k."]) + shaft(0, -13, 7, dark_from=2),
        [(x, 0, "N") for x in range(-10, 3)] + rel(3, -1, ["k..", "kKK", "k.."]),
    ),
    "bow": (
        rel(0, -8, [".n", "n.", "nj", "nj", "nj", "nj", "nj", "nj", "nj", "nj", "nj", "nj", "nj", "n.", ".n"]),
        rel(1, -6, ["..n.", ".n..", "n...", "n...", "n...", "n...", ".n..", "..n."]) + [(x, -3, "p") for x in range(-4, 5)] + [(5, -3, "K"), (-5, -4, "R"), (-5, -2, "R")],
    ),
    "crossbow": (
        [(x, 0, "N") for x in range(-5, 2)] + rel(2, -3, ["n", "n", "n", "k", "n", "n", "n"]) + [(3, 0, "j")],
        [(x, -2, "N") for x in range(-5, 2)] + rel(2, -5, ["n", "n", "n", "k", "n", "n", "n"]) + [(3, -2, "p"), (4, -2, "p"), (5, -2, "K")],
    ),
    "crosier": (
        rel(-1, -15, [".yy.", "y..y", "...y", "..y."]) + [(0, y, "y" if y < -8 else "Y") for y in range(-11, 8)],
        rel(0, -17, [".yy.", "y..y", "...y", "..y."]) + [(1, y, "y" if y < -10 else "Y") for y in range(-13, 2)] + [(4, -16, "O"), (5, -14, "O")],
    ),
    "cross": (
        rel(-1, -15, [".y.", "yyy", ".y."]) + [(0, y, "y" if y < -8 else "Y") for y in range(-12, 8)],
        rel(0, -17, [".y.", "yyy", ".y.", ".y."]) + [(1, y, "Y") for y in range(-13, 2)] + [(-1, -18, "O"), (3, -18, "O"), (1, -19, "O")],
    ),
    "bell": (
        rel(-2, 1, ["..n..", "..y..", ".yyy.", ".yyy.", "yyyyy", "YYYYY", "..O.."]),
        rel(-1, -8, ["..n..", "..y..", ".yyy.", ".yyy.", "yyyyy", "YYYYY", "..O.."]) + [(5, -6, "O"), (6, -4, "O"), (5, -2, "O")],
    ),
    "lantern": (
        rel(-1, 1, [".n.", "jjj", "jOj", "jOj", "jjj"]),
        rel(1, -4, [".n..", "jjjj", "jOOj", "jOOj", "jjjj"]) + [(6, -3, "O"), (6, -1, "O")],
    ),
    # mangual: cabo curto, corrente e uma bola de espinhos grande
    "flail": (
        shaft(0, -1, 3) + [(1, 4, "j"), (1, 5, "j")] + rel(0, 6, [".k.", "kjk", ".k."]),
        shaft(0, -2, 1) + [(1, -3, "j"), (2, -4, "j"), (3, -4, "j"), (4, -3, "j")] + rel(4, -3, [".kk.", "kjjk", "kjjk", ".kk."]),
    ),
    # espada do soldado: apoiada no ombro (andando), golpe horizontal longo (ataque)
    "sword_shoulder": (
        [(-1, 0, "y"), (0, -1, "n"), (1, 0, "y")] + [(1, 1, "K"), (1, 2, "k"), (2, 3, "K"), (2, 4, "k"), (3, 5, "K"), (3, 6, "k")],
        [(-1, 0, "n"), (0, -1, "y"), (0, 0, "y"), (0, 1, "y")] + [(x, 0, "k") for x in range(1, 8)] + [(8, 0, "K")],
    ),
    # espada do cavaleiro: em pé, na frente
    "sword": (
        rel(1, -9, ["K", "K", "K", "K", "K", "K", "K", "K"]) + rel(0, -1, ["yyy"]) + [(1, 1, "n")],
        [(-1, 0, "n"), (0, -1, "y"), (0, 0, "y"), (0, 1, "y")] + [(x, 0, "k") for x in range(1, 7)] + [(7, 0, "K")],
    ),
    # espadão do templário: de ponta no chão, mãos no pomo (andando); golpe largo (ataque)
    "greatsword": (
        [(0, -1, "y"), (-1, 1, "y"), (0, 1, "y"), (1, 1, "y")] + [(0, y, "K") for y in range(2, 8)] + [(1, y, "k") for y in range(2, 7)],
        [(-1, 0, "n"), (0, -1, "y"), (0, 0, "y"), (0, 1, "y")] + [(x, 0, "K") for x in range(1, 9)] + [(x, 1, "k") for x in range(1, 8)],
    ),
    "mace": (
        rel(-1, -5, [".k.", "kjk", "kjk", ".k."]) + shaft(0, -1, 2),
        rel(1, -7, [".k.", "kjk", "kjk", ".k."]) + [(0, -1, "N"), (1, -2, "N"), (1, -3, "N")],
    ),
    # martelo de guerra dourado, de duas mãos, apoiado no ombro (paladino)
    "warhammer": (
        rel(-1, -12, ["yyyy", "yyyy", "YYYY"]) + shaft(0, -9, 3),
        [(i, -1 + i, "N") for i in range(0, 3)] + rel(2, 1, ["yyyy", "yYYy", "yyyy"]) + [(7, 0, "O"), (7, 4, "O")],
    ),
    # alabarda: a mais alta da tela, com a lâmina de machado bem visível
    "halberd": (
        rel(-1, -15, [".K..", ".k..", ".kkkk", ".kkkK", ".kkk.", ".k.."]) + shaft(0, -9, 7, dark_from=2),
        [(x, 0, "N") for x in range(-10, 2)] + rel(2, -3, ["..k..", "kkkk.", "kkkkK", "kkkk.", "..k.."]),
    ),
    "book": (
        rel(-2, -1, ["rRRRr", "rpppr", "rRRRr"]),
        rel(0, -3, ["rRRRr", "rpppr", "rpppr", "rRRRr"]) + [(6, -4, "O"), (6, -1, "O")],
    ),
    "fist": ([], []),
}

SHIELDS = {
    # escudo de torre: cobre o tronco quase inteiro (o escudeiro)
    "tower": rel(1, 8, [".mmmmm.", "mmmmmmm", "mmmRmmm", "mmRRRmm", "mmmRmmm", "mmmRmmm", "mmmRmmm", "mmmmmmm", ".mmmmm.", "..mmm.."]),
    "heater": rel(2, 11, ["mmmmm", "mRyRm", "myyym", "mRyRm", ".mRm.", "..m.."]),
    "round": rel(1, 11, [".qqq.", "qqyqq", "qyyyq", "qqyqq", ".qqq."]),
}

# --------------------------------------------------------------------------- os vivos

VIVOS = {
    # ---- A Vila: marrom, palha, verde-musgo, laranja
    "peasant": dict(build="scrawny", head="straw", obj="pitchfork",
                    pal={**SKIN, "h": "#c9a24a", "d": "#7a5a2a", "c": "#7a5a3c", "l": "#5a4430", "b": "#3a2a1e", "x": "#3a2414"}),
    "torch": dict(build="scrawny", head="hood", obj="torch",
                  pal={**SKIN, "h": "#5c4a6e", "c": "#5a4632", "l": "#4a3a2a", "b": "#2e241a", "x": "#2a1c14"}),
    "militia": dict(build="stocky", head="kettle", obj="spear", shield="round",
                    pal={**SKIN, "m": "#8a94a6", "h": "#4a3020", "c": "#5c6e38", "l": "#5a4430", "b": "#3a2a1e", "q": "#7a5636"}),
    "hunter": dict(build="tall", head="hood", obj="bow",
                   pal={**SKIN, "h": "#3e5e2e", "c": "#4e6a36", "l": "#6a4c36", "b": "#3a2a1e", "x": "#5a3c22"}),
    # ---- O Mosteiro: burel marrom, branco, um pouco de dourado
    "monk": dict(build="round", head="bald", obj="fist", fist=True,
                 pal={**SKIN, "c": "#6e4c30", "b": "#3a2a1e", "x": "#d8c89a"}),
    "priest": dict(build="robe", head="hood", obj="crosier",
                   pal={**PALE, "h": "#d8d2e0", "c": "#d8d2e0", "b": "#4a3a30", "x": "#c9a23a"}),
    "nun": dict(build="robe", head="veil", obj="lantern",
                pal={**PALE, "h": "#2e2838", "w": "#ece6d8", "c": "#2e2838", "b": "#1e1a24", "x": "#ece6d8"}),
    "ringer": dict(build="round", head="hair", obj="bell",
                   pal={**SKIN, "h": "#4a3326", "c": "#5a4a7a", "b": "#2e2430", "x": "#3a2e4a"}),
    "flagellant": dict(build="lean", head="bald", obj="flail", stripes=True, armmat="s",
                       pal={**PALE, "d": "#6e1424", "l": "#5a0f1d", "b": "#3a1a14"}),
    # ---- A Fortaleza: aço, vermelho heráldico, couro
    "soldier": dict(build="standard", head="nasal", obj="sword_shoulder", armmat="m",
                    pal={**SKIN, "m": "#8a94a6", "c": "#9a2a30", "l": "#4a5262", "b": "#2e2a2a", "x": "#5a3c22"}),
    "crossbow": dict(build="stocky", head="kettle", obj="crossbow",
                     pal={**SKIN, "m": "#6e7787", "h": "#3a2a1e", "c": "#8a2a2a", "l": "#5a4430", "b": "#2e241a", "x": "#4a3020"}),
    "shield": dict(build="heavy", head="nasal", obj="mace", shield="tower", armmat="m",
                   pal={**SKIN, "m": "#6e7787", "c": "#4a5262", "l": "#4a5262", "b": "#2a2a2e", "x": "#4a3020", "R": "#a8303a"}),
    "knight": dict(build="heavy", head="great", obj="sword", shield="heater", plume="#c0283c", armmat="m",
                   pal={"s": "#a9b3c4", "m": "#a9b3c4", "c": "#3a5a9a", "l": "#8a94a6", "b": "#5a6272", "x": "#3a2a1e", "e": "#141018"}),
    # alabardeiro: atarracado, listras amarelas e pretas, a alabarda passa da cabeça
    "halberd": dict(build="stocky", head="kettle", obj="halberd", stripes2=True,
                    pal={**SKIN, "m": "#8a94a6", "h": "#3a2a1e", "c": "#d0a030", "d": "#2a2230", "l": "#2a2230", "b": "#1e1a20", "x": "#2a2230"}),
    # ---- A Catedral: branco, dourado, roxo, vermelho de cardeal
    # paladino: sem escudo, capa dourada, coroa, martelo dourado de duas mãos
    "paladin": dict(build="heavy", head="crown", obj="warhammer", cape="#c9a23a", armmat="m", crest="y",
                    pal={"s": "#c8d0e0", "m": "#c8d0e0", "c": "#ece6d8", "l": "#a9b3c4", "b": "#6e7787", "x": "#c9a23a", "e": "#fff0a0"}),
    "inquisitor": dict(build="robe", head="hood", obj="book",
                       pal={**PALE, "h": "#1e1418", "c": "#7a1a26", "b": "#1a1014", "x": "#1e1418"}),
    "witchhunter": dict(build="tall", head="brim", obj="crossbow", cape="#7a1424",
                        pal={**PALE, "h": "#3a302a", "d": "#c0283c", "c": "#4e4236", "l": "#4a3c30", "b": "#2a201a", "x": "#8a6a3a"}),
    # templário: elmo de balde, tabardo branco comprido com cruz vermelha, escudo, espadão de ponta no chão
    "templar": dict(build="heavy", head="bucket", obj="greatsword", shield="heater", crest="R", longtabard=True, armmat="m",
                    pal={"s": "#9aa0ac", "m": "#9aa0ac", "c": "#ece6d8", "t": "#ece6d8", "l": "#8d93a0", "b": "#5a6070", "x": "#5a3c22", "e": "#141018"}),
    "bishop": dict(build="robe", head="mitre", obj="cross",
                   pal={**PALE, "w": "#ece6d8", "c": "#9a1e3a", "b": "#3a1420", "x": "#e6b84a"}),
    # arremessador: brutamontes com um saco de pedras nas costas; no ataque, a pedra vai acima da cabeça
    "hurler": dict(build="hulk", head="smallbald", obj="fist", fist=True, sack=True,
                   pal={**SKIN, "c": "#7a5a3a", "l": "#4a3626", "b": "#3a2a1e", "x": "#2a1c14", "q": "#8a7048"}),
}


def line(p0, p1):
    (x0, y0), (x1, y1) = p0, p1
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def build(name, spec, frame):
    """Grade 16x22 de letras de um quadro (0, 1 andando; 2 atacando)."""
    B = BUILDS[spec["build"]]
    g = [["."] * W for _ in range(H)]

    def put(cells, dx=0, dy=0, under=False):
        for x, y, ch in cells:
            X, Y = x + dx, y + dy
            if 0 <= X < W and 0 <= Y < H and (not under or g[Y][X] == "."):
                g[Y][X] = ch

    attack = frame == 2
    passing = frame == 1
    lean = B["lean"] if attack else 0
    bob = -1 if passing else 0
    # capa atrás do corpo
    if spec.get("cape"):
        put(rel(1, 10 + bob, ["PP..", "PPP.", "PPP.", "PPPP", "PPPP", "PPPP", ".PPP", "..PP", "...P"]), lean // 2)
    # pernas (ou barra do hábito), fixas no chão
    ly, lrows = B["legs"][1 if passing else 0]
    put(rel(0, ly, lrows))
    ty, trows = B["torso"]
    put(rel(0, ty + bob, trows), lean)
    if spec.get("longtabard"):
        put(rel(5, 12 + bob, ["ttttt", "ttttt", "ttttt", "ttttt", "ttttt", ".ttt.", ".ttt."]), lean)
    if spec.get("crest"):
        c = spec["crest"]
        put([(7, 12 + bob, c), (6, 13 + bob, c), (7, 13 + bob, c), (8, 13 + bob, c), (7, 14 + bob, c), (7, 15 + bob, c)], lean)
    if spec.get("stripes"):  # costas marcadas pelo chicote
        put([(5, 11 + bob, "d"), (7, 11 + bob, "d"), (6, 12 + bob, "d"), (8, 12 + bob, "d")], lean)
    if spec.get("stripes2"):  # gibão listrado (alabardeiro)
        put([(x, y + bob, "d") for y in range(9, 16) for x in (4, 7, 10) if trows[y - ty][x] == "c"], lean)
    if spec.get("sack"):
        put(rel(0, 3 + bob, ["..q..", ".qqqq", "qqqqq", "qqqqq", "qqqqq", "qqqqq", ".qqq."]), lean)
    hx, hy = B["head"]
    put(rel(hx, hy + bob, HEADS[spec["head"]]), lean)
    if spec.get("plume"):
        put([(5, 0 + bob, "P"), (4, 0 + bob, "P"), (3, 1 + bob, "P"), (2, 2 + bob, "P"), (2, 3 + bob, "P")], lean)
    # braço da frente: do ombro até a mão; objeto relativo à mão; mão por cima do cabo
    sx, sy = B["shoulder"]
    hand = B["hand"][1 if attack else 0]
    sx, sy = sx + lean, sy + bob
    hxx, hyy = hand[0] + (0 if attack else 0), hand[1] + (0 if attack else bob)
    arm = spec.get("armmat", "c")
    obj_walk, obj_attack = WEAPONS[spec["obj"]]
    obj = obj_attack if attack else obj_walk
    if obj:
        # a ponta do objeto cabe no quadro: no ataque a mão recua o que for preciso (o braço continua esticado)
        over = max(x for x, _, _ in obj) + hxx + 1 - (W - 1)
        if over > 0:
            hxx -= over
    gx, gy = hxx + 1, hyy
    put([(x + gx, y + gy, ch) for x, y, ch in obj])
    for x, y in line((sx, sy), (hxx, hyy)):
        put([(x, y, arm), (x - 1, y, arm)])
    hand_mat = "m" if arm == "m" else "s"
    size = 3 if spec.get("fist") else 2
    hxx = min(hxx, W - size)  # o punho inteiro fica dentro do quadro
    put(rel(hxx, hyy, [hand_mat * size] * size))
    if spec["build"] == "hulk" and attack:
        # a pedra que ele vai jogar, acima da cabeça
        put(rel(hxx - 1, hyy - 4, [".GGG", "GGGG", "GGGG", ".GG."]))
    if spec.get("shield"):
        put(SHIELDS[spec["shield"]], lean, bob)
    return ["".join(r) for r in g]


# --------------------------------------------------------------------------- sombreamento


def shade(rows, pal, extra=None):
    flat = {**FLAT_DEFAULT, **{k: v for k, v in pal.items() if k not in SHADED}, **(extra or {})}
    ramps = {k: ramp(v) for k, v in pal.items() if k in SHADED}
    grid = [list(r) for r in rows]

    def at(x, y):
        return grid[y][x] if 0 <= x < W and 0 <= y < len(grid) else "."

    out = [[None] * len(grid[0]) for _ in range(len(grid))]
    for y in range(len(grid)):
        for x in range(len(grid[0])):
            ch = grid[y][x]
            if ch == ".":
                continue
            back = ch in BACK
            mat = BACK.get(ch, ch)
            if mat not in SHADED:
                if ch not in flat:
                    raise SystemExit(f"cor '{ch}' sem definição")
                out[y][x] = flat[ch]
                continue
            if mat not in ramps:
                raise SystemExit(f"material '{mat}' sem cor")
            r = ramps[mat]
            L, R, U, D = at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)
            if back:
                tone = "edge" if (R == "." or D == ".") and L != "." else "shadow"
            elif (R == "." and L != ".") or (D == "." and U != "." and y >= len(grid) - 7):
                tone = "edge"
            elif R == "." or D == ".":
                tone = "shadow"
            elif U == "." or (U not in SHADED and U not in BACK and U != ch and L == "."):
                tone = "light"
            elif L == ".":
                tone = "base"
            else:
                x0 = x
                while at(x0 - 1, y) == ch:
                    x0 -= 1
                x1 = x
                while at(x1 + 1, y) == ch:
                    x1 += 1
                run = x1 - x0 + 1
                if R != ch and R != "." and R not in "Rry":
                    tone = "shadow"
                elif run >= 4 and x - x0 >= run * 2 / 3:
                    tone = "shadow"
                else:
                    tone = "base"
            out[y][x] = r[tone]
    return out


# --------------------------------------------------------------------------- cadáveres (16x6, deitados, cabeça à direita)
# cada um mantém uma pista da classe: o chapéu ao lado, a arma caída, a cor do hábito, o brilho da armadura.

CORPSE_BODY = [
    "................",
    "................",
    ".zllcccccc......",
    "zvvlcccccc......",
    ".vv.cccccc......",
    "................",
]
CORPSE_CUES = {
    "peasant": (["...........hhh..", "..........hhhhh.", "..........ss....", "..........sss...", "kk.NNNNNNNNNNN..", "................"], {}),
    "torch": (["................", "...........hhh..", "..........hhss..", "..........hsss..", ".NNNNnno........", "........u.......".replace("u", "o")], {}),
    "militia": (["............mm..", "...........mmmm.", "..........ss....", "..........sss...", "NNNNNNNNNNNNNKk.", "................"], {}),
    "hunter": (["................", "...........hhh..", "..........hhss..", "..........hsss..", ".nnnnnnnnnnn....", "..jjjjjjjjj....."], {}),
    "monk": (["................", "................", "..........sss...", "..........ssss..", "..ccccccc.ss....", "................"], {}),
    "priest": (["....y...........", "...yyy.....hhh..", "....y.....hhss..", "....Y.....hsss..", "..ccccccc.......", "................"], {}),
    "nun": (["................", "...........www..", "..........hwss..", "..........hhss..", "..ccccccc.......", "...........jOj.."], {}),
    "ringer": (["................", ".............y..", "..........ssyyy.", "..........syyyyy", "..ccccccc..YYYYY", "................"], {}),
    "flagellant": (["................", "................", "..........sss...", "..........ssss..", "...........jkk..", "...........kjk.."], {}),
    "soldier": (["................", "...........mmm..", "..........mss...", "..........sss...", ".....nykkkkkkkK.", "................"], {}),
    "crossbow": (["................", "............mm..", "..........ssmm..", "..........sss...", "....n...........", "...NNNNNnj......"], {}),
    "shield": (["................", "...mmmmmm..mm...", "..mmmRmmm.mss...", "..mmRRRmm.sss...", "...mmRmm........", "................"], {}),
    "knight": (["................", "..........PP....", "..........mmmm..", "..........meem..", "...K.K....mmm...", "................"], {}),
    "halberd": (["................", "............mm..", "..........ssmm..", "..........sss...", "NNNNNNNNNNNkkk..", "...........kkK.."], {}),
    "paladin": (["................", "..........y.y...", "..........mmmm..", "..........meem..", ".yyyNNNN........", ".yyy............"], {}),
    "inquisitor": (["................", "...........hhh..", "..........hhss..", "..........hsss..", "..ccccccc.rRRr..", "..........rppr.."], {}),
    "witchhunter": (["..........hh....", ".........hhhhhh.", "..........sss...", "..........sss...", ".NNNNNNnj.......", "................"], {}),
    "templar": (["................", "......R...mmmm..", ".....RRR..meRe..", "......R...mmmm..", ".KKKKKKKyn......", "................"], {}),
    "bishop": (["...........w....", "..........wyw...", ".........wwyww..", "..........sss...", "..ccccccc.ss.Y..", "............Y..."], {}),
    "hurler": (["................", "................", "..........sss...", "..........ssss..", ".qqq.G.G........", "qqqqqGG.G......."], {}),
}


def corpse(name, spec):
    pal = spec["pal"]
    cue, _ = CORPSE_CUES[name]
    rows = [list(r) for r in CORPSE_BODY]
    for y, r in enumerate(cue):
        for x, ch in enumerate(r):
            if ch != ".":
                rows[y][x] = ch
    # pernas e corpo do cadáver usam as cores do vivo; o resto, as chapadas
    out = shade(["".join(r) for r in rows], {**pal, "c": pal.get("t", pal.get("c", "#5a4030")), "l": pal.get("l", pal.get("c", "#4a3626")),
                                               "b": pal.get("b", "#2a1c14"), "h": pal.get("h", pal.get("s")), "m": pal.get("m", "#8a94a6"),
                                               "w": pal.get("w", "#ece6d8"), "q": pal.get("q", "#7a5636")}, {"P": spec.get("plume", "#c0283c")})
    # cadáver: cor apagada, um pouco puxada para o chão
    return [[(mix(c, "#1a1424", 0.28) if c else None) for c in row] for row in out] + [[None] * 16 for _ in range(0)]


def to_img(g):
    im = Image.new("RGBA", (len(g[0]), len(g)), (0, 0, 0, 0))
    for y, row in enumerate(g):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--install", action="store_true")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    frames = []
    for name, spec in VIVOS.items():
        extra = {"P": spec["plume"]} if spec.get("plume") else {}
        if spec.get("cape"):
            extra["P"] = spec["cape"]
        for f in range(3):
            frames.append((f"{name}{f}", to_img(shade(build(name, spec, f), spec["pal"], extra))))
        frames.append((f"corpse-{name}", to_img(corpse(name, spec))))
    Wt = sum(im.width + 1 for _, im in frames)
    sheet = Image.new("RGBA", (Wt, H), (0, 0, 0, 0))
    meta = []
    x = 0
    for key, im in frames:
        sheet.paste(im, (x, 0))
        meta.append({"filename": key, "frame": {"x": x, "y": 0, "w": im.width, "h": im.height}, "rotated": False, "trimmed": False,
                     "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height}, "sourceSize": {"w": im.width, "h": im.height},
                     "duration": 100})
        x += im.width + 1
    sheet.save(OUT / "vivos.png")
    (OUT / "vivos.json").write_text(json.dumps({"frames": meta, "meta": {
        "app": "desenhado por código (art-work/units/make_living.py)", "image": "vivos.png", "format": "RGBA8888",
        "size": {"w": Wt, "h": H}, "scale": "1", "frameTags": []}}, indent=1), encoding="utf8")

    fr = dict(frames)
    names = list(VIVOS)
    # revisão 4x: 4 por linha, 3 quadros + cadáver
    cols, cw, chh = 4, 3 * 18 + 20, 26
    rv = Image.new("RGBA", (cols * cw + 4, ((len(names) + cols - 1) // cols) * chh + 4), "#1a120e")
    for i, n in enumerate(names):
        ox, oy = (i % cols) * cw + 2, (i // cols) * chh + 2
        for f in range(3):
            rv.alpha_composite(fr[f"{n}{f}"], (ox + f * 18, oy))
        rv.alpha_composite(fr[f"corpse-{n}"], (ox + 54, oy + 16))
    rv.resize((rv.width * 4, rv.height * 4), Image.NEAREST).save(OUT / "living-review.png")
    # escala real: todos parados lado a lado em 1x (o jogo usa zoom 2) e em 2x
    line_ = Image.new("RGBA", (len(names) * 17 + 2, 26), "#1a120e")
    for i, n in enumerate(names):
        line_.alpha_composite(fr[f"{n}0"], (1 + i * 17, 2))
    real = Image.new("RGBA", (line_.width * 2, 26 + 52 + 4), "#1a120e")
    real.alpha_composite(line_, (0, 0))
    real.alpha_composite(line_.resize((line_.width * 2, 52), Image.NEAREST), (0, 28))
    real.save(OUT / "living-real.png")

    if a.install:
        dst = ROOT / "public" / "assets" / "sprites"
        sheet.save(dst / "vivos.png")
        (dst / "vivos.json").write_text((OUT / "vivos.json").read_text(encoding="utf8"), encoding="utf8")
        man_path = dst / "manifest.json"
        man = json.loads(man_path.read_text(encoding="utf8"))
        man["sprites"] = [e for e in man["sprites"] if e.get("file") != "vivos"]
        man["sprites"].append({"file": "vivos", "frames": {k: i for i, (k, _) in enumerate(frames)}})
        man_path.write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(json.dumps({"units": len(names), "frames": len(frames), "review": str(OUT / "living-review.png"), "installed": a.install}))


if __name__ == "__main__":
    main()
