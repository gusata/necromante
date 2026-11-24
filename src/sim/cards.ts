import { cloneMods, type Mods } from './mods';
import type { DeadKind, School } from './types';

/**
 * Escolas: não existem mais cartas. Cada item equipado conta para a escola dele
 * (peças de conjunto contam para duas). Com 2 itens da mesma escola vem a Maestria,
 * com 4 o Domínio. Cada degrau também libera um tipo de morto para levantar.
 */
export const MASTERY_AT = 2;
export const DOMINION_AT = 4;

export interface SchoolInfo {
  id: School;
  name: string;
  color: string;
  mastery: string;
  dominionName: string;
  dominion: string;
  /** morto liberado na maestria e no domínio */
  units: [DeadKind[], DeadKind[]];
}

export const SCHOOLS: Record<School, SchoolInfo> = {
  bone: {
    id: 'bone',
    name: 'Ossos',
    color: '#e3dccb',
    mastery: 'Levanta arqueiros. Mortos caídos deixam ossos: 35% de chance de virar cadáver de novo.',
    dominionName: 'Colosso',
    dominion: 'Levanta liches. Fundir pede só 2 esqueletos. Colossos +50% vida e golpes que estilhaçam.',
    units: [['archer'], ['lich']],
  },
  flesh: {
    id: 'flesh',
    name: 'Carne',
    color: '#b5525e',
    mastery: 'Levanta zumbis e carniçais. Vivos mortos por eles levantam na hora, em qualquer lugar.',
    dominionName: 'Abominação',
    dominion: 'Levanta abominações. +8 no limite do exército. Mortos de carne regeneram e devoram vivos fracos.',
    units: [['zombie', 'ghoul'], ['abomination']],
  },
  plague: {
    id: 'plague',
    name: 'Praga',
    color: '#8fbf3a',
    mastery: 'Levanta ratos. Todo morto que cai solta uma nuvem de veneno.',
    dominionName: 'Pestilência',
    dominion: 'Levanta portadores da peste. Veneno +60%. Vivos envenenados espalham a praga ao morrer.',
    units: [['rat'], ['plaguebearer']],
  },
  spirit: {
    id: 'spirit',
    name: 'Espírito',
    color: '#8fd3ff',
    mastery: 'Levanta fantasmas. Raios saltam para mais um alvo e atravessam escudos.',
    dominionName: 'Banshee',
    dominion: 'Levanta banshees. A cada 7s um grito atordoa todos os vivos.',
    units: [['ghost'], ['banshee']],
  },
  blood: {
    id: 'blood',
    name: 'Sangue',
    color: '#e0304a',
    mastery: 'Levanta servos. Mortos +30% vida e roubam vida. O necromante cura 10 a cada 20 abates.',
    dominionName: 'Lorde Vampiro',
    dominion: 'Levanta cavaleiros rubros. Mortos +25% dano. Todo sacrifício dá frenesi: +60% dano e velocidade por 6s.',
    units: [['thrall'], ['bloodknight']],
  },
};

export const SCHOOL_ORDER: School[] = ['bone', 'flesh', 'plague', 'spirit', 'blood'];

/** peso de cada tipo de morto liberado no sorteio do levantar (esqueleto pesa 3) */
const UNIT_WEIGHT: Partial<Record<DeadKind, number>> = { archer: 2, zombie: 2, ghoul: 2, rat: 3, ghost: 2, thrall: 3, lich: 1, abomination: 1, plaguebearer: 2, banshee: 1, bloodknight: 1 };

/** Efeito de evento que dura a run toda (o que antes eram cartas escondidas). */
export interface Boon {
  id: string;
  name: string;
  desc: string;
  apply: (m: Mods) => void;
}

export const BOONS: Boon[] = [
  { id: 'ev_scar', name: 'Cicatriz', desc: '-50 de vida máxima.', apply: (m) => (m.necroMaxHp = Math.max(6, m.necroMaxHp - 5)) },
  {
    id: 'ev_crypt',
    name: 'Cripta Aberta',
    desc: '+10 no limite do exército, cadáveres duram 2s a menos.',
    apply: (m) => {
      m.armyCap += 10;
      m.corpseLife = Math.max(2, m.corpseLife - 2);
    },
  },
];

export const BOON_BY_ID: Record<string, Boon> = Object.fromEntries(BOONS.map((b) => [b.id, b]));

export function schoolCounts(bonus: Partial<Record<School, number>> = {}): Record<School, number> {
  const n: Record<School, number> = { bone: 0, flesh: 0, plague: 0, spirit: 0, blood: 0 };
  for (const [s, v] of Object.entries(bonus)) n[s as School] += v ?? 0;
  return n;
}

/** Aplica os efeitos de evento e as sinergias das escolas por cima dos modificadores base. */
export function computeMods(base: Mods, boons: string[], bonus: Partial<Record<School, number>> = {}): Mods {
  const m = cloneMods(base);
  for (const id of boons) BOON_BY_ID[id]?.apply(m);
  const n = schoolCounts(bonus);
  for (const s of SCHOOL_ORDER) {
    const tiers = n[s] >= DOMINION_AT ? 2 : n[s] >= MASTERY_AT ? 1 : 0;
    for (let t = 0; t < tiers; t++) for (const k of SCHOOLS[s].units[t]) m.raisePool[k] = Math.max(m.raisePool[k] ?? 0, UNIT_WEIGHT[k] ?? 1);
  }
  if (n.bone >= MASTERY_AT) m.boneRebirth = Math.max(m.boneRebirth, 0.35);
  if (n.bone >= DOMINION_AT) {
    m.boneDominion = true;
    m.fuseCount = 2;
    m.giantMul *= 1.5;
  }
  if (n.flesh >= MASTERY_AT) m.fleshInfect = true;
  if (n.flesh >= DOMINION_AT) {
    m.fleshDominion = true;
    m.armyCap += 8;
  }
  if (n.plague >= MASTERY_AT) m.plagueDeathCloud = true;
  if (n.plague >= DOMINION_AT) {
    m.plagueDominion = true;
    m.poisonDmgMul *= 1.6;
  }
  if (n.spirit >= MASTERY_AT) {
    m.spiritMastery = true;
    m.boltChain += 1;
  }
  if (n.spirit >= DOMINION_AT) m.spiritDominion = true;
  if (n.blood >= MASTERY_AT) {
    m.bloodMastery = true;
    m.lifesteal += 0.35;
    m.deadHpMul *= 1.3;
  }
  if (n.blood >= DOMINION_AT) {
    m.bloodDominion = true;
    m.deadDmgMul *= 1.25;
    m.frenzyDmg += 0.6;
    m.frenzyTime = Math.max(m.frenzyTime, 6);
  }
  return m;
}
