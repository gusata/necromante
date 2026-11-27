// Exporta os desenhos de sprites.ts que não são humanoides (necromantes, fantasmas, colosso, bichos, cadáveres,
// cenário, ícones), com as cores que o jogo usa, para a folha de revisão (preview_misc.py).
import { CHARACTERS } from '../../src/sim/characters';
import { PAL } from '../../src/art/palette';
import * as S from '../../src/art/sprites';

type Entry = { frames: string[][]; colors: Record<string, string>; up?: boolean };
const out: Record<string, Entry> = {};
const add = (k: string, frames: string[][], colors: Record<string, string> = {}, up = false) =>
  (out[k] = { frames, colors: { ...PAL, ...colors }, up });

for (const c of CHARACTERS) {
  const base = c.id === 'necro' ? S.NECRO : S.charSprite(c.id);
  const cast = c.id === 'necro' ? S.NECRO_CAST : S.charSprite(c.id, true);
  add(`char-${c.id}`, [base, cast], S.CHAR_COLORS[c.id] ?? {}, true);
}
add('ghost', S.GHOST, { G: '#bfe9ff', g: '#6fa8c8' }, true);
add('banshee', S.GHOST, { G: '#f4eefc', g: '#a08cc8' }, true);
add('giant', S.GIANT_BASE, {}, true);
add('rat', S.RAT, { b: '#5e6151', B: '#3f4237', G: '#c8ff8a' });
add('hound', S.HOUND, { N: '#5a4030', n: '#3d2a20', O: '#e0a040' });
add('corpse', [S.CORPSE], { H: '#6e5a3a', h: '#4d3f29', A: '#634532', a: '#3d2a20', L: '#3d2a20', f: '#a97a5e', F: '#7a5240', e: '#07050b' });
add('bones', [S.BONE_PILE, S.BONES_DECOR, S.SPLAT, S.SCORCH, S.ARROW, S.BOLT_PROJ, S.BONE_ARROW]);
add('props', [S.TOMB, S.TOMB2, S.CROSS_GRAVE, S.FENCE, S.PILLAR, S.WALL, S.BARREL, S.PEW], { N: '#3a2c22', n: '#2a1a12' });
add('props2', [S.DEAD_TREE, ...S.CANDLE, ...S.BRAZIER, ...S.BANNER, ...S.CANDELABRA], { N: '#2a2230', n: '#1c1622' });
add('icons', [S.SOUL_ICON, S.SKULL_ICON, S.HEART_ICON, S.PAUSE_ICON, S.EXPLODE_ICON, S.FUSE_ICON, S.CONSUME_ICON, S.LOCK_ICON, S.GEM_ICON]);
add('nav', Object.values(S.NAV_ICONS), { L: '#c8ffd8', C: '#1f5a3a' });
add('build', Object.values(S.BUILDING_ICONS));
add('ritual', [S.RITUAL_ICON, S.HAND_ICON]);
process.stdout.write(JSON.stringify(out));
