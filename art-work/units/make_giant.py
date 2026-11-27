"""Colosso de Ossos 24x28 em PixelSpec (codeart2d), no estilo do esqueleto novo: chapado, sem contorno preto."""
import json
from pathlib import Path

W = 24
HEAD = [
    "........wwwwwwww........",
    ".......wwwwwwwwwwb......",
    "......wwwwwwwwwwwwb.....",
    "......wwwwxxwwwxxwb.....",
    "......wwwwxGwwwxGwb.....",
    "......bwwwwwxwwwwbb.....",
    ".......bwBwBwBwBwb......",
    "........bbbbbbbbb.......",
]
TORSO = [
    ".....wwwwwwwwwwwwb......",
    "....wwwwwwbbwwwwwwb.....",
    "....wxxxxxbbxxxxxwb.....",
    "....bwwwwwbbwwwwwwb.....",
    ".....wxxxxbbxxxxwb......",
    ".....bwwwwbbwwwwwb......",
    "......wxxxbbxxxwb.......",
    ".......bwwbbwwwb........",
    ".........wwwwb..........",
    ".......wwwwwwwwwb.......",
    "......wwwbbbbbwwwb......",
    "......bwb.....bwwb......",
]
ARMS = [
    "...bb.............wwb...",
    "..bbB.............wwwb..",
    "..bB..............bwwb..",
    ".bbB...............bwwb.",
    ".bB................bwwb.",
    ".bB................bwwb.",
    "bbB...............wwwwb.",
    "bbbB..............wwwwwb",
    "bbbBB.............wwwwwb",
    "BbbB..............bwwwbb",
    ".BB................bbb..",
]
ARMS_ATTACK = [
    "...................wwww.",
    "..................wwwwwb",
    "..................wwwwwb",
    "...................bwwb.",
    "...................bwb..",
    "..................bwwb..",
    "..................bwwb..",
    ".................bwwb...",
    "...bb...........bwwb....",
    "..bbB...................",
    "..bB....................",
    ".bbB....................",
    ".bB.....................",
    ".bB.....................",
    "bbB.....................",
    "bbbB....................",
    "bbbBB...................",
    "BbbB....................",
    ".BB.....................",
]
STRIDE = [
    "........bbB....wwb......",
    ".......bbB.....bwwb.....",
    ".......bbB.....bwwb.....",
    "......bbB.......bwwb....",
    "......bbB.......bwwb....",
    ".....bbBB.......bwwwb...",
    "....bbbBB.......wwwwwb..",
    "...bbbbBB.......wwwwwwb.",
]
PASS = [
    "........bbB..wwb........",
    "........bbB..wwb........",
    "........bbB..wwb........",
    "........bbB..bwwb.......",
    ".......bbB...bwwb.......",
    ".......bbB...bwwwb......",
    "......bbbBB..wwwwwb.....",
    ".....bbbbBB..wwwwwwb....",
]
for name, block in (("HEAD", HEAD), ("TORSO", TORSO), ("ARMS", ARMS), ("ARMS_ATTACK", ARMS_ATTACK), ("STRIDE", STRIDE), ("PASS", PASS)):
    for i, r in enumerate(block):
        assert len(r) == W, f"{name}[{i}] tem {len(r)} colunas"

spec = {
    "schema": "codeart2d.pixelspec.v1",
    "name": "giant",
    "canvas": [W, 28],
    "anchor_px": [12, 28],
    "palette": {"w": "#e3dccb", "b": "#a49c86", "B": "#6b6452", "x": "#241c2c", "G": "#aef5bf"},
    "outline": {"mode": "none"},
    "poses": {"stride": STRIDE, "pass": PASS, "arms": ARMS, "arms_attack": ARMS_ATTACK},
    "layers": [
        {"name": "legs", "z": 0, "origin": [0, 20], "rows": "stride"},
        {"name": "torso", "z": 1, "origin": [0, 8], "rows": TORSO},
        {"name": "head", "z": 2, "origin": [0, 0], "rows": HEAD},
        {"name": "arms", "z": 3, "origin": [0, 8], "rows": "arms"},
    ],
    "frames": [
        {"name": "walk0"},
        {"name": "walk1", "layers": {"legs": {"rows": "pass"}}},
        {"name": "attack", "layers": {"arms": {"rows": "arms_attack", "dy": -8}}},
    ],
    "clips": {
        "walk": {"frames": ["walk0", "walk1"], "duration_ms": 166, "loop": True},
        "attack": {"frames": ["attack"], "duration_ms": 200, "loop": False},
    },
}
out = Path(__file__).resolve().parents[1] / "giant24.pixelspec.json"
out.write_text(json.dumps(spec, indent=1), encoding="utf8")
print(out)
