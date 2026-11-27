// Lista o tamanho atual de cada ícone e peça de cenário (o layout depende deles).
import * as S from '../../src/art/sprites';

const sz = (r: string[]) => `${Math.max(...r.map((x) => x.length))}x${r.length}`;
const mod = S as unknown as Record<string, unknown>;
const o: Record<string, unknown> = {};
for (const k of ['SOUL_ICON', 'SKULL_ICON', 'HEART_ICON', 'PAUSE_ICON', 'EXPLODE_ICON', 'FUSE_ICON', 'CONSUME_ICON', 'GEM_ICON', 'RITUAL_ICON', 'HAND_ICON', 'LOCK_ICON', 'TOMB', 'TOMB2', 'CROSS_GRAVE', 'DEAD_TREE', 'FENCE', 'PILLAR', 'WALL', 'BARREL', 'PEW', 'BONES_DECOR', 'BONE_PILE', 'SPLAT', 'SCORCH', 'ARROW', 'BOLT_PROJ', 'BONE_ARROW', 'CORPSE', 'CORPSE_HOUND'])
  o[k] = sz(mod[k] as string[]);
for (const k of ['CANDLE', 'BRAZIER', 'BANNER', 'CANDELABRA', 'RAT', 'GHOST', 'HOUND']) {
  const f = mod[k] as string[][];
  o[k] = `${sz(f[0])} x${f.length}`;
}
o.NAV = Object.fromEntries(Object.entries(S.NAV_ICONS).map(([k, v]) => [k, sz(v)]));
o.BUILD = Object.fromEntries(Object.entries(S.BUILDING_ICONS).map(([k, v]) => [k, sz(v)]));
console.log(JSON.stringify(o, null, 0));
