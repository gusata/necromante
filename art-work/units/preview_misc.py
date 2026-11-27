"""Folha de revisão do resto da arte (necromantes, fantasmas, colosso, bichos, cenário, ícones),
com a mesma borda sel-out e o mesmo Scale2x do jogo (src/art/generate.ts).

uso: npx tsx art-work/units/dump_misc.ts > art-work/units/out/misc.json
     python art-work/units/preview_misc.py
"""
import json

from PIL import Image

from preview import OUT, OUTLINE, at, edge, grid, selout, to_img


def scale2x(src):
    h, w = len(src), len(src[0])
    out = [[None] * (w * 2) for _ in range(h * 2)]
    for y in range(h):
        for x in range(w):
            p = src[y][x]
            a, b, c, d = at(src, x, y - 1), at(src, x + 1, y), at(src, x - 1, y), at(src, x, y + 1)
            out[y * 2][x * 2] = a if (c == a and c != d and a != b) else p
            out[y * 2][x * 2 + 1] = b if (a == b and a != c and b != d) else p
            out[y * 2 + 1][x * 2] = c if (d == c and d != b and c != a) else p
            out[y * 2 + 1][x * 2 + 1] = d if (b == d and b != a and d != c) else p
    return out


def upscale(g):
    stripped = [[(None if c == OUTLINE and any(n is None for n in (at(g, x - 1, y), at(g, x + 1, y), at(g, x, y - 1), at(g, x, y + 1))) else c)
                 for x, c in enumerate(row)] for y, row in enumerate(g)]
    big = selout(scale2x(stripped))
    out = [row[:] for row in big]
    for y in range(len(big)):
        for x in range(len(big[0])):
            if big[y][x] is None:
                f = at(big, x - 1, y) or at(big, x, y - 1)
                if f and f != OUTLINE:
                    out[y][x] = edge(f)
    return out


def main():
    data = json.loads((OUT / "misc.json").read_text(encoding="utf8"))
    imgs = []
    for name, d in data.items():
        row = []
        for rows in d["frames"]:
            g = grid([r for r in rows], d["colors"])
            row.append(to_img(upscale(g) if d.get("up") else selout(g)))
        imgs.append((name, row))
    W = max(sum(i.width + 3 for i in r) for _, r in imgs) + 6
    H = sum(max(i.height for i in r) + 4 for _, r in imgs) + 4
    sheet = Image.new("RGBA", (W, H), "#16141c")
    y = 3
    for _, r in imgs:
        x = 3
        for im in r:
            sheet.alpha_composite(im, (x, y))
            x += im.width + 3
        y += max(i.height for i in r) + 4
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(OUT / "misc-review.png")
    print(sheet.size)


if __name__ == "__main__":
    main()
