/**
 * Simulador de balanceamento: joga N runs com o piloto automático, sem renderizar.
 * Uso: npm run sim -- [runs] [nivelMeta 0..5]
 */
import { autopilot } from '../src/sim/autopilot';
import { BUILDINGS, freshMeta, metaMods, unlockedSchools } from '../src/sim/meta';
import { World } from '../src/sim/world';

const runs = Number(process.argv[2] ?? 40);
const metaLevel = Number(process.argv[3] ?? 0);

const meta = freshMeta();
for (const b of BUILDINGS) meta.buildings[b.id] = Math.min(metaLevel, b.costs.length);
meta.bossesBeaten = Math.min(3, metaLevel);

const waves: number[] = [];
const souls: number[] = [];
const bosses: Record<string, number> = {};
const t0 = Date.now();
for (let i = 0; i < runs; i++) {
  const w = new World({ seed: 1000 + i, mods: metaMods(meta), schools: unlockedSchools(meta) });
  const maxSteps = 60 * 60 * 40; // 40 min de jogo
  for (let s = 0; s < maxSteps && w.phase !== 'over'; s++) {
    autopilot(w);
    w.update(1 / 60);
    w.events.length = 0;
  }
  waves.push(w.wave);
  souls.push(Math.floor(w.souls));
  for (const b of w.bossesKilled) bosses[b] = (bosses[b] ?? 0) + 1;
}
const sorted = [...waves].sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`runs=${runs} meta=${metaLevel} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`onda: média ${avg(waves)} | p10 ${pct(0.1)} | mediana ${pct(0.5)} | p90 ${pct(0.9)} | max ${sorted.at(-1)}`);
console.log(`almas por run: média ${avg(souls)}`);
console.log('chefes derrotados:', bosses);
const hist: Record<number, number> = {};
for (const w of waves) hist[w] = (hist[w] ?? 0) + 1;
console.log('distribuição:', Object.entries(hist).map(([k, v]) => `${k}:${v}`).join(' '));
