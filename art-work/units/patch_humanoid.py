"""Reescreve as peças do gerador de humanoides (src/art/humanoid.ts) no estilo da direção de arte nova."""
from pathlib import Path

p = Path(__file__).resolve().parents[2] / "src/art/humanoid.ts"
s = p.read_text(encoding="utf8")
a = s.index("// 16x22: cabeça nas linhas 0-8 (olhos na 5), tronco 9-16, pernas 17-21")
b = s.index("function blank(): string[][] {")
new = (Path(__file__).with_name("humanoid_parts.ts")).read_text(encoding="utf8")
s = s[:a] + new + "\n" + s[b:]

s = s.replace("""    stamp(g, HEADS[spec.head]);
    stamp(g, BODIES[spec.body]);
    stamp(g, spec.body === 'robe' ? ROBE_HEM[legFrame] : LEGS[legFrame]);
    if (spec.cross) stamp(g, CROSS);
    if (spec.shield) stamp(g, SHIELD, f === 2 ? 1 : 0);
    if (spec.book) stamp(g, BOOK);
    // ataque: arma avança e desce um pixel
    stamp(g, WEAPONS[spec.weapon], f === 2 ? 1 : 0, f === 2 ? 1 : 0);""", """    const lean = f === 2 ? 1 : 0;
    stamp(g, spec.body === 'robe' ? ROBE_HEM[legFrame] : LEGS[legFrame]);
    stamp(g, BODIES[spec.body], lean);
    stamp(g, HEADS[spec.head], lean);
    if (spec.cross) stamp(g, CROSS, lean);
    if (spec.shield) stamp(g, SHIELD, lean);
    if (spec.book) stamp(g, BOOK, lean);
    // ataque: pose própria da arma (estocada, golpe); sem pose, a arma avança e desce 1 px
    const attack = f === 2 ? ATTACKS[spec.weapon] : undefined;
    if (attack) stamp(g, attack);
    else stamp(g, WEAPONS[spec.weapon], lean, lean);""")
s = s.replace("export type Body = 'tunic' | 'armor' | 'robe';", "export type Body = 'tunic' | 'armor' | 'robe' | 'reach';")
s = s.replace("  zombie: { head: 'hair', body: 'tunic', weapon: 'none',", "  zombie: { head: 'hair', body: 'reach', weapon: 'none',")
s = s.replace("  ghoul: { head: 'bald', body: 'tunic', weapon: 'none',", "  ghoul: { head: 'bald', body: 'reach', weapon: 'none',")
p.write_text(s, encoding="utf8")
print("ok")
