import type { Mods } from './mods';

/**
 * Níveis da Descida: os mesmos 4 cercos, cada nível mais cruel que o anterior.
 * O nível I é o jogo base; vencer a Catedral num nível libera o próximo.
 * Internamente o nível escolhido ainda se chama `heresy` (0 = nível I).
 * Cada nível soma o seu efeito aos anteriores e dá +20% de almas.
 */
export interface HeresyLevel {
  name: string;
  desc: string;
  /** cor da faixa do nível na Descida */
  color: number;
}

export const MAX_HERESY = 5;

/** nome do nível I (sem efeito) */
export const BASE_LEVEL = { name: 'Os Vivos', desc: 'o cerco como ele é', color: 0x6b6452 };

export const HERESY: HeresyLevel[] = [
  { name: 'Dúvida', desc: 'vivos +20% vida, elites 2x', color: 0x6a7fa8 },
  { name: 'Blasfêmia', desc: 'ondas 20% maiores, necromante -40 vida', color: 0x8a5ab0 },
  { name: 'Profanação', desc: 'chefes +30% vida, cadáveres duram 25% menos', color: 0xb0603a },
  { name: 'Cruzada', desc: 'vivos 10% mais rápidos e +10 dano', color: 0xb03a3a },
  { name: 'Juízo Final', desc: 'sem esqueletos iniciais, exército -10%, vivos +15% vida', color: 0xd02a2a },
];

export const SOUL_BONUS_PER_LEVEL = 0.2;

export const levelInfo = (level: number) => (level <= 0 ? BASE_LEVEL : HERESY[Math.min(MAX_HERESY, level) - 1]);

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
  level = Math.min(MAX_HERESY, level);
  const on = (n: number) => level >= n;
  return {
    livingHp: (on(1) ? 1.2 : 1) * (on(5) ? 1.15 : 1),
    eliteMul: on(1) ? 2 : 1,
    waveSize: on(2) ? 1.2 : 1,
    bossHp: on(3) ? 1.3 : 1,
    livingSpeed: on(4) ? 1.1 : 1,
    livingDmg: on(4) ? 1 : 0,
  };
}

/** Efeitos de nível que mexem nos modificadores da run. */
export function applyHeresy(m: Mods, level: number): void {
  level = Math.min(MAX_HERESY, level);
  if (level <= 0) return;
  m.soulMul += SOUL_BONUS_PER_LEVEL * level;
  if (level >= 2) m.necroMaxHp = Math.max(6, m.necroMaxHp - 4);
  if (level >= 3) m.corpseLife *= 0.75;
  if (level >= 4) m.eliteLootBonus -= 0.1;
  if (level >= 5) {
    m.startSkeletons = 0;
    m.armyCap = Math.max(4, Math.round(m.armyCap * 0.9));
  }
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const levelRoman = (level: number) => ROMAN[level] ?? `${level + 1}`;
export const heresyName = (level: number) => `${levelRoman(level)} - ${levelInfo(level).name}`;
