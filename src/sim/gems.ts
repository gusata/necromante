import type { Mods } from './mods';

/**
 * Gemas: caem na run, três iguais viram uma de nível acima e vão nos encaixes do altar.
 * Chave de uma gema: tipo + nível, ex.: 'ruby1', 'diamond3'.
 */
export type GemType = 'ruby' | 'sapphire' | 'emerald' | 'amethyst' | 'diamond';

export const GEM_TYPES: GemType[] = ['ruby', 'sapphire', 'emerald', 'amethyst', 'diamond'];
export const MAX_GEM_RANK = 5;
/** encaixes do altar sem melhorias (a árvore vai abrir mais) */
export const BASE_SOCKETS = 3;
/** quanto cada nível multiplica o efeito base */
export const RANK_MUL = [0, 1, 2.5, 4.5, 7, 10];
export const RANK_NAME = ['', 'I', 'II', 'III', 'IV', 'V'];

export interface GemDef {
  type: GemType;
  name: string;
  color: string;
  desc: (rank: number) => string;
  apply: (m: Mods, rank: number) => void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const r1 = (v: number) => Math.round(v * 10) / 10;

export const GEMS: Record<GemType, GemDef> = {
  ruby: {
    type: 'ruby',
    name: 'Rubi',
    color: '#e0304a',
    desc: (r) => `mortos +${pct(0.02 * RANK_MUL[r])} dano`,
    apply: (m, r) => (m.deadDmgMul *= 1 + 0.02 * RANK_MUL[r]),
  },
  sapphire: {
    type: 'sapphire',
    name: 'Safira',
    color: '#4a8ae0',
    desc: (r) => `raios ${pct(0.02 * RANK_MUL[r])} mais rápidos`,
    apply: (m, r) => (m.castCdMul *= 1 - 0.02 * RANK_MUL[r]),
  },
  emerald: {
    type: 'emerald',
    name: 'Esmeralda',
    color: '#38b46a',
    desc: (r) => `mortos +${pct(0.025 * RANK_MUL[r])} vida`,
    apply: (m, r) => (m.deadHpMul *= 1 + 0.025 * RANK_MUL[r]),
  },
  amethyst: {
    type: 'amethyst',
    name: 'Ametista',
    color: '#a060d0',
    desc: (r) => `círculo +${r1(0.4 * RANK_MUL[r])}`,
    apply: (m, r) => (m.circleR += 0.4 * RANK_MUL[r]),
  },
  diamond: {
    type: 'diamond',
    name: 'Diamante',
    color: '#e8f4ff',
    desc: (r) => `+${Math.round(RANK_MUL[r])} vida do necromante`,
    apply: (m, r) => (m.necroMaxHp += Math.round(RANK_MUL[r])),
  },
};

export const gemKey = (type: GemType, rank: number) => `${type}${rank}`;
export function parseGem(key: string): { type: GemType; rank: number } | null {
  const m = /^([a-z]+)(\d)$/.exec(key);
  if (!m || !(m[1] in GEMS)) return null;
  return { type: m[1] as GemType, rank: Number(m[2]) };
}

/** Sorteia uma gema. `bonus` (0..1) puxa para o nível 2 e acima. */
export function rollGem(rand: () => number, bonus = 0, minRank = 1): string {
  const type = GEM_TYPES[Math.floor(rand() * GEM_TYPES.length)];
  let rank = minRank;
  while (rank < 3 && rand() < 0.08 + bonus * 0.3) rank++;
  return gemKey(type, rank);
}

/** Aplica as gemas encaixadas no altar. */
export function applyGems(m: Mods, sockets: (string | null)[]) {
  for (const key of sockets) {
    const g = key ? parseGem(key) : null;
    if (g) GEMS[g.type].apply(m, g.rank);
  }
}

/** Funde de 3 em 3, do nível mais baixo para o mais alto. Devolve quantas fusões fez. */
export function mergeGems(bag: Record<string, number>): number {
  let merges = 0;
  for (const type of GEM_TYPES) {
    for (let r = 1; r < MAX_GEM_RANK; r++) {
      const k = gemKey(type, r);
      while ((bag[k] ?? 0) >= 3) {
        bag[k] -= 3;
        const up = gemKey(type, r + 1);
        bag[up] = (bag[up] ?? 0) + 1;
        merges++;
      }
      if (bag[k] === 0) delete bag[k];
    }
  }
  return merges;
}
