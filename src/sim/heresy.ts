import type { Mods } from './mods';

/**
 * Heresia: níveis de dificuldade liberados depois de vencer a Catedral.
 * Cada nível soma o seu efeito aos anteriores e dá +10% de almas.
 */
export interface HeresyLevel {
  name: string;
  desc: string;
}

export const MAX_HERESY = 10;

export const HERESY: HeresyLevel[] = [
  { name: 'Dúvida', desc: 'vivos +15% vida' },
  { name: 'Suspeita', desc: 'elites 2x mais comuns' },
  { name: 'Blasfêmia', desc: 'necromante -40 vida' },
  { name: 'Sacrilégio', desc: 'ondas 20% maiores' },
  { name: 'Profanação', desc: 'cadáveres duram 25% menos' },
  { name: 'Apostasia', desc: 'chefes +30% vida' },
  { name: 'Anátema', desc: 'vivos 10% mais rápidos' },
  { name: 'Excomunhão', desc: 'elites derrubam menos itens' },
  { name: 'Cruzada', desc: 'vivos +10 dano' },
  { name: 'Juízo Final', desc: 'sem esqueletos iniciais, exército -10%' },
];

/** Multiplicadores que a simulação lê durante a run. */
export interface HeresyEffects {
  livingHp: number;
  eliteMul: number;
  waveSize: number;
  bossHp: number;
  livingSpeed: number;
  livingDmg: number;
}

export function heresyEffects(level: number): HeresyEffects {
  const on = (n: number) => level >= n;
  return {
    livingHp: on(1) ? 1.15 : 1,
    eliteMul: on(2) ? 2 : 1,
    waveSize: on(4) ? 1.2 : 1,
    bossHp: on(6) ? 1.3 : 1,
    livingSpeed: on(7) ? 1.1 : 1,
    livingDmg: on(9) ? 1 : 0,
  };
}

/** Efeitos de heresia que mexem nos modificadores da run. */
export function applyHeresy(m: Mods, level: number): void {
  if (level <= 0) return;
  m.soulMul += 0.1 * level;
  if (level >= 3) m.necroMaxHp = Math.max(6, m.necroMaxHp - 4);
  if (level >= 5) m.corpseLife *= 0.75;
  if (level >= 8) m.eliteLootBonus -= 0.1;
  if (level >= 10) {
    m.startSkeletons = 0;
    m.armyCap = Math.max(4, Math.round(m.armyCap * 0.9));
  }
}

export const heresyName = (level: number) => (level <= 0 ? 'nenhuma' : `${level} - ${HERESY[level - 1].name}`);
