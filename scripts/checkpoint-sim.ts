/**
 * Compara runs começando em cada região (checkpoint), com o piloto automático.
 *   npx tsx scripts/checkpoint-sim.ts [runs] [nivelMeta]
 */
import { autopilot } from '../src/sim/autopilot';
import { freshMeta, metaMods, schoolBonus, unlockedSchools } from '../src/sim/meta';
import { fillTree } from '../src/sim/tree';
import { REGIONS } from '../src/sim/regions';
import { World } from '../src/sim/world';

const runs = Number(process.argv[2] ?? 8);
const metaLevel = Number(process.argv[3] ?? 2);
const meta = freshMeta();
fillTree(meta, metaLevel);
meta.bossesBeaten = 3;

console.log('início         runs  onda média  chefes vencidos  almas');
for (let start = 0; start < 3; start++) {
  let waves = 0;
  let bosses = 0;
  let souls = 0;
  for (let i = 0; i < runs; i++) {
    const w = new World({ seed: 300 + i, mods: metaMods(meta), schools: unlockedSchools(meta), schoolBonus: schoolBonus(meta), startRegion: start });
    for (let s = 0; s < 60 * 60 * 30 && w.phase !== 'over' && w.wave <= 30; s++) {
      autopilot(w);
      w.update(1 / 60);
      w.events.length = 0;
    }
    waves += w.wave;
    bosses += w.bossesKilled.length;
    souls += w.souls;
  }
  console.log(
    `${REGIONS[start].name.padEnd(14)} ${String(runs).padStart(4)}  ${(waves / runs).toFixed(1).padStart(10)}  ${(bosses / runs).toFixed(1).padStart(15)}  ${Math.round(
      souls / runs,
    )
      .toString()
      .padStart(5)}`,
  );
}
