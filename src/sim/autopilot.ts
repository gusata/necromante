import { NECRO } from './defs';
import { EVENT_BY_ID } from './events';
import type { World } from './world';

/**
 * Jogador automático: usado no modo debug (?auto) e no simulador de balanceamento.
 * Não é ótimo de propósito: aproxima um jogador mediano.
 */
export function autopilot(w: World, skill = 1): void {
  if (w.phase === 'event' && w.event) {
    const def = EVENT_BY_ID[w.event.id];
    w.resolveEvent(def?.auto ? def.auto(w) : 0);
    return;
  }
  // persegue o vivo mais perto do necromante
  let best: { x: number; y: number } | undefined;
  let bestD = Infinity;
  for (const u of w.units) {
    if (!u.alive || u.faction !== 'living') continue;
    const d = Math.hypot(u.x - NECRO.x, u.y - NECRO.y);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  const lerp = 0.04 * skill;
  if (best) w.setCircle(w.circle.x + (best.x - w.circle.x) * lerp, w.circle.y + (best.y - w.circle.y) * lerp);
  // horda: explodir só vale com muitos mortos e muitos vivos perto
  const near = w.units.filter((u) => u.alive && u.faction === 'living' && Math.hypot(u.x - w.circle.x, u.y - w.circle.y) < w.circle.r + 12).length;
  if (w.canFuse() && w.deadInCircle('skeleton').length >= 12) w.fuse();
  if (w.canRitual() && w.units.filter((u) => u.alive && u.faction === 'living').length >= 15) w.castRitual();
  if (w.necro.hp < w.necro.maxHp * 0.5 && w.canConsume()) w.consume();
  const inCircle = w.deadInCircle().length;
  if (((bestD < 30 && inCircle >= 4) || (near >= 10 && inCircle >= 10)) && w.canExplode()) w.explode();
}
