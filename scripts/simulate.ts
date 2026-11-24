/**
 * Simulador de balanceamento: joga runs com o piloto automático, sem renderizar.
 *
 *   npm run sim -- [runs] [nivelMeta 0..5]          runs livres (equipamento de uma escola que gira por seed)
 *   npm run sim -- [runs] [nivelMeta] builds        compara as 5 escolas: equipamento todo de uma escola
 *   npm run sim -- [runs] [nivelMeta] chars         compara os personagens
 */
import { autopilot } from '../src/sim/autopilot';
import { SCHOOL_ORDER, SCHOOLS } from '../src/sim/cards';
import { CHARACTERS } from '../src/sim/characters';
import { EQUIP_SLOTS, ITEMS, type ItemRarity, SLOT_OF } from '../src/sim/items';
import { equip, freshMeta, type MetaState, metaMods, schoolBonus, unlockedSchools } from '../src/sim/meta';
import { fillTree } from '../src/sim/tree';
import type { School } from '../src/sim/types';
import { World } from '../src/sim/world';

const runs = Number(process.argv[2] ?? 40);
const metaLevel = Number(process.argv[3] ?? 0);
const mode = process.argv[4] ?? 'free';

const meta = freshMeta();
fillTree(meta, metaLevel);

interface Result {
  wave: number;
  souls: number;
  bosses: number;
  build: string;
}

/**
 * Equipamento típico do nível de meta: 0 nada, 1 comuns, 2 até mágicos, 3+ até raros.
 * Metade dos espaços (ou todos, no modo builds) puxa a escola `focus`.
 */
function geared(base: MetaState, focus: School | undefined, all = false): MetaState {
  const m: MetaState = { ...base, items: { ...base.items }, equipped: {} };
  if (metaLevel <= 0) return m;
  const order: ItemRarity[] = ['common', 'magic', 'rare'];
  const cap = Math.min(2, metaLevel - 1);
  const lvl = Math.max(0, metaLevel - 2);
  EQUIP_SLOTS.forEach((slot, i) => {
    const want = focus && (all || i % 2 === 0) ? focus : undefined;
    const fits = ITEMS.filter((it) => it.slot === SLOT_OF[slot] && order.indexOf(it.rarity) >= 0 && order.indexOf(it.rarity) <= cap && !Object.values(m.equipped).includes(it.id));
    const pick =
      fits.filter((it) => (want ? it.school?.[want] : !it.school)).sort((a, b) => order.indexOf(b.rarity) - order.indexOf(a.rarity))[0] ??
      fits.sort((a, b) => order.indexOf(b.rarity) - order.indexOf(a.rarity))[0];
    if (!pick) return;
    m.items[pick.id] = lvl;
    equip(m, pick.id, slot);
  });
  return m;
}

function play(seed: number, schools: School[], focus?: School, m0 = meta, all = false): Result {
  const m = geared(m0, focus ?? SCHOOL_ORDER[seed % SCHOOL_ORDER.length], all);
  const w = new World({ seed, mods: metaMods(m), schools, schoolBonus: schoolBonus(m), character: m.character });
  // para na onda 40: no abismo profundo a horda fica enorme e a simulação demora demais
  for (let s = 0; s < 60 * 60 * 40 && w.phase !== 'over' && w.wave <= 40; s++) {
    autopilot(w, 1);
    w.update(1 / 60);
    w.events.length = 0;
  }
  const counts = w.schoolCounts();
  const top = SCHOOL_ORDER.reduce((a, b) => (counts[b] > counts[a] ? b : a));
  const build = counts[top] >= 4 ? `${top}*` : counts[top] >= 2 ? top : 'misto';
  return { wave: w.wave, souls: Math.floor(w.souls), bosses: w.bossesKilled.length, build };
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (a: Result[], n: number) => `${Math.round((100 * a.filter((r) => r.bosses >= n).length) / Math.max(1, a.length))}%`.padStart(5);
const t0 = Date.now();

function table(rows: [string, Result[]][]) {
  console.log('build          runs  onda  med  chefe1 chefe2 chefe3 chefe4  almas');
  for (const [name, rs] of rows) {
    const waves = rs.map((r) => r.wave).sort((a, b) => a - b);
    console.log(
      `${name.padEnd(14)} ${String(rs.length).padStart(4)}  ${avg(waves).toFixed(1).padStart(4)}  ${String(waves[Math.floor(waves.length / 2)] ?? 0).padStart(3)}  ${pct(rs, 1)}  ${pct(rs, 2)}  ${pct(rs, 3)}  ${pct(rs, 4)}  ${avg(rs.map((r) => r.souls)).toFixed(0).padStart(5)}`,
    );
  }
}

if (mode === 'chars') {
  const rows: [string, Result[]][] = CHARACTERS.map((c) => {
    const m = { ...meta, character: c.id, bossesBeaten: Math.min(3, metaLevel) };
    return [c.name.replace(/^(O|A) /, ''), Array.from({ length: runs }, (_, i) => play(7000 + i, unlockedSchools(m), undefined, m))];
  });
  console.log(`runs=${runs} por personagem, meta=${metaLevel} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  table(rows);
} else if (mode === 'builds') {
  // todas as escolas liberadas; cada linha força uma escola
  const rows: [string, Result[]][] = SCHOOL_ORDER.map((s) => [SCHOOLS[s].name, Array.from({ length: runs }, (_, i) => play(5000 + i, SCHOOL_ORDER, s, meta, true))]);
  console.log(`runs=${runs} por escola, meta=${metaLevel} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  table(rows);
} else {
  const schools = SCHOOL_ORDER.slice(0, Math.min(5, 2 + Math.min(3, metaLevel)));
  const all = Array.from({ length: runs }, (_, i) => play(1000 + i, schools));
  console.log(`runs=${runs} meta=${metaLevel} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const groups = new Map<string, Result[]>();
  for (const r of all) groups.set(r.build, [...(groups.get(r.build) ?? []), r]);
  table([['TODAS', all], ...[...groups.entries()].sort((a, b) => b[1].length - a[1].length)]);
  console.log('(* = domínio da escola)');
}
