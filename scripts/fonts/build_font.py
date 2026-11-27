"""
Gera src/art/fontData.ts a partir das fontes bitmap Tiny5 e Tiny5 Duo (BDF).

Tiny5 é de Stefan Schmidt (https://github.com/Gissio/font_Tiny5), licença SIL OFL 1.1 (scripts/fonts/OFL.txt).
Uso: python scripts/fonts/build_font.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

# ASCII imprimível, Latin-1 (acentos do português e vizinhos) e alguns símbolos usados nos textos
CHARS = (
    [chr(c) for c in range(32, 127)]
    + [chr(c) for c in range(0xC0, 0x100) if c not in (0xD7, 0xF7)]
    + list('·—–…•×°ºª')
)


def load(path: Path):
    glyphs = {}
    meta = {}
    lines = path.read_text(encoding='latin-1').splitlines()
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith('FONT_ASCENT'):
            meta['ascent'] = int(ln.split()[1])
        elif ln.startswith('STARTCHAR'):
            g = {}
            i += 1
            while not lines[i].startswith('BITMAP'):
                p = lines[i].split()
                if p[0] == 'ENCODING':
                    g['cp'] = int(p[1])
                elif p[0] == 'DWIDTH':
                    g['adv'] = int(p[1])
                elif p[0] == 'BBX':
                    g['w'], g['h'], g['x'], g['y'] = map(int, p[1:5])
                i += 1
            i += 1
            rows = []
            while lines[i] != 'ENDCHAR':
                rows.append(lines[i])
                i += 1
            g['rows'] = rows
            glyphs[g['cp']] = g
        i += 1
    return glyphs, meta


def encode(path: Path) -> str:
    glyphs, meta = load(path)
    out = []
    for ch in CHARS:
        g = glyphs.get(ord(ch))
        if g is None:
            continue
        nbits = ((g['w'] + 7) // 8) * 8
        # cada linha vira uma string de '#' e '.', sem a margem vazia da direita
        rows = []
        for r in g['rows']:
            v = int(r, 16)
            rows.append(''.join('#' if (v >> (nbits - 1 - c)) & 1 else '.' for c in range(g['w'])))
        # topo do desenho medido a partir do topo das maiúsculas (ascent - altura das maiúsculas = 2)
        top = meta['ascent'] - g['y'] - g['h'] - 2
        key = ch.replace('\\', '\\\\').replace("'", "\\'")
        out.append(f"  '{key}': [{g['adv']}, {g['x']}, {top}, '{'/'.join(rows)}'],")
    return '\n'.join(out)


def main():
    body = [
        '// Gerado por scripts/fonts/build_font.py — não edite à mão.',
        '// Fonte Tiny5 e Tiny5 Duo, de Stefan Schmidt (https://github.com/Gissio/font_Tiny5), licença SIL OFL 1.1.',
        '',
        '/** Cada letra: [avanço, x, topo (0 = topo das maiúsculas; acentos ficam acima), linhas com # e . separadas por /]. */',
        'export type Glyph = [number, number, number, string];',
        '',
        'export const TINY5: Record<string, Glyph> = {',
        encode(HERE / 'Tiny5.bdf'),
        '};',
        '',
        'export const TINY5_DUO: Record<string, Glyph> = {',
        encode(HERE / 'Tiny5Duo.bdf'),
        '};',
        '',
    ]
    dst = ROOT / 'src' / 'art' / 'fontData.ts'
    dst.write_text('\n'.join(body), encoding='utf-8')
    print(f'{dst.relative_to(ROOT)}: {len(CHARS)} caracteres pedidos')


if __name__ == '__main__':
    main()
