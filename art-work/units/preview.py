"""Folha de revisão dos humanoides com a mesma borda sel-out do jogo (src/art/generate.ts: selout).

uso: npx tsx art-work/units/dump_humanoids.ts > art-work/units/out/humanoids.json
     python art-work/units/preview.py
"""
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
OUT = HERE / "out"
OUTLINE = "#07050b"


def mix(a, b, t):
    pa, pb = int(a[1:], 16), int(b[1:], 16)
    ch = lambda s: round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)  # noqa: E731
    return "#%02x%02x%02x" % (ch(16), ch(8), ch(0))


def edge(c):
    return mix(c, "#0b0810", 0.55)


def grid(rows, colors):
    w = max(len(r) for r in rows)
    return [[(colors.get(r[x]) if x < len(r) and r[x] != "." else None) for x in range(w)] for r in rows]


def at(g, x, y):
    return None if y < 0 or y >= len(g) or x < 0 or x >= len(g[0]) else g[y][x]


def selout(g):
    out = [row[:] for row in g]
    fill = lambda c: c is not None and c != OUTLINE  # noqa: E731
    for y in range(len(g)):
        for x in range(len(g[0])):
            if g[y][x] != OUTLINE:
                continue
            l, r, u, d = at(g, x - 1, y), at(g, x + 1, y), at(g, x, y - 1), at(g, x, y + 1)
            outer = any(c is None for c in (l, r, u, d))
            sh = [c for c in (l, u) if fill(c)]
            li = [c for c in (r, d) if fill(c)]
            if not outer:
                n = sh + li
                if n:
                    out[y][x] = edge(n[0])
                continue
            if sh:
                out[y][x] = edge(sh[0])
            elif li:
                out[y][x] = li[0]
            elif any(fill(at(g, x + dx, y + dy)) for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1))):
                out[y][x] = None
    return out


def to_img(g):
    im = Image.new("RGBA", (len(g[0]), len(g)), (0, 0, 0, 0))
    for y, row in enumerate(g):
        for x, c in enumerate(row):
            if c:
                im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im


def main():
    data = json.loads((OUT / "humanoids.json").read_text(encoding="utf8"))
    names = list(data)
    cols = 6
    cw, ch = 3 * 18 + 6, 26
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cw, rows * ch), "#16141c")
    frames_dir = OUT / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    for i, n in enumerate(names):
        d = data[n]
        for f, rows_ in enumerate(d["frames"]):
            img = to_img(selout(grid(rows_, d["colors"])))
            img.save(frames_dir / f"{n}{f}.png")
            sheet.alpha_composite(img, ((i % cols) * cw + 2 + f * 18, (i // cols) * ch + 2))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(OUT / "humanoids-review.png")
    print(json.dumps({"units": len(names), "review": str(OUT / "humanoids-review.png")}))


if __name__ == "__main__":
    main()
