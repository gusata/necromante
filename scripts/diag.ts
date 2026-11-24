/**
 * Diagnóstico de ritmo: uma run com o piloto automático, onda a onda.
 *   npx tsx scripts/diag.ts [seed] [nivelMeta] [personagem]
 */
import { autopilot } from '../src/sim/autopilot';
import { freshMeta, metaMods, schoolBonus, unlockedSchools } from '../src/sim/meta';
import { fillTree } from '../src/sim/tree';
import { World } from '../src/sim/world';

const seed = Number(process.argv[2] ?? 1);
const metaLevel = Number(process.argv[3] ?? 2);
const meta = freshMeta();
meta.character = (process.argv[4] ?? 'necro') as typeof meta.character;
fillTree(meta, metaLevel);
meta.bossesBeaten = Math.min(3, metaLevel);
const w = new World({ seed, mods: metaMods(meta), schools: unlockedSchools(meta), schoolBonus: schoolBonus(meta), character: meta.character });
if (process.env.START) w.wave = Number(process.env.START) - 1;
const tStart = performance.now();
let steps = 0;

let wave = 0;
let t0 = 0;
let hp0 = w.necro.hp;
let peakLiving = 0;
let peakDead = 0;
let peakAll = 0;
let kills0 = 0;
let prevSize = 0;
console.log('onda  tempo  vivos(tot/pico)  mortos(pico)  tela(pico)  abates  vida  -vida  eventos');
for (let s = 0; s < 60 * 60 * 90 && w.phase !== 'over'; s++) {
  autopilot(w);
  w.update(1 / 60);
  steps++;
  w.events.length = 0;
  let l = 0;
  let d = 0;
  for (const u of w.units) if (u.alive) u.faction === 'living' ? l++ : d++;
  peakLiving = Math.max(peakLiving, l);
  peakDead = Math.max(peakDead, d);
  peakAll = Math.max(peakAll, l + d + w.corpses.length);
  if (w.wave !== wave) {
    if (wave > 0) {
      console.log(
        `${String(wave).padStart(4)}  ${(w.time - t0).toFixed(0).padStart(5)}s  ${String(prevSize).padStart(6)}/${String(peakLiving).padEnd(6)}  ${String(peakDead).padStart(10)}  ${String(peakAll).padStart(10)}  ${String(w.kills - kills0).padStart(6)}  ${w.necro.hp.toFixed(0).padStart(4)}  ${(hp0 - w.necro.hp).toFixed(0).padStart(5)}  ${w.boons.length}`,
      );
    }
    wave = w.wave;
    t0 = w.time;
    hp0 = w.necro.hp;
    kills0 = w.kills;
    peakLiving = 0;
    peakDead = 0;
    peakAll = 0;
    prevSize = w.waveSize;
  }
}
console.log(`fim: onda ${w.wave}, ${w.kills} abates, ${Math.floor(w.souls)} almas, exército máx ${w.stats.maxArmy}, tempo ${(w.time / 60).toFixed(1)} min`);
console.log(`custo médio da simulação: ${((performance.now() - tStart) / steps).toFixed(3)} ms por passo`);
