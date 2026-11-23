import { CARD_BY_ID } from './cards';
import { NECRO } from './defs';
import type { School } from './types';
import type { World } from './world';

/**
 * Jogador automático: usado no modo debug (?auto) e no simulador de balanceamento.
 * Não é ótimo de propósito: aproxima um jogador mediano.
 */
export function autopilot(w: World, skill = 1, focus?: School): void {
  if (w.phase === 'choosing') {
    pickCard(w, focus);
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
  if (w.canFuse()) w.fuse();
  if (w.necro.hp < w.necro.maxHp * 0.5 && w.canConsume()) w.consume();
  if (bestD < 40 && w.deadInCircle().length >= 2 && w.canExplode()) w.explode();
}

/** Prefere a escola em que já investiu (persegue sinergias), ou a escola `focus` se houver. */
export function pickCard(w: World, focus?: School): void {
  const counts = w.schoolCounts();
  let best = w.offer[0];
  let bestScore = -Infinity;
  for (const id of w.offer) {
    const c = CARD_BY_ID[id];
    const score = (focus && c.school === focus ? 100 : 0) + (c.school ? counts[c.school] * 2 : 1) + (c.rarity === 'rare' ? 1.5 : c.rarity === 'legendary' ? 3 : 0) + w.rng.next();
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  if (best) w.pickCard(best);
}
