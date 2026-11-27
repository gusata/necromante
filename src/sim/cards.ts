import { GIFT_BY_ID } from './gifts';
import { cloneMods, type Mods } from './mods';
import type { DeadKind, School } from './types';

/**
 * Escolas: não existem mais cartas. Cada item equipado conta para a escola dele
 * (peças de conjunto contam para duas). Um item já dá o efeito básico da escola;
 * com 2 vem a Maestria, com 4 o Domínio e com 6 (tudo numa escola) a Apoteose.
 * Maestria e Domínio também liberam um tipo de morto para levantar.
 */
export const BASE_AT = 1;
export const MASTERY_AT = 2;
export const DOMINION_AT = 4;
export const APOTHEOSIS_AT = 6;

/** 0 nada, 1 maestria, 2 domínio, 3 apoteose (o básico vale com 1 item e não conta como degrau) */
export type SchoolTier = 0 | 1 | 2 | 3;
export const schoolTier = (n: number): SchoolTier => (n >= APOTHEOSIS_AT ? 3 : n >= DOMINION_AT ? 2 : n >= MASTERY_AT ? 1 : 0);
export const TIER_NAME = ['', 'maestria', 'domínio', 'apoteose'] as const;

export interface SchoolInfo {
  id: School;
  name: string;
  color: string;
  /** efeito com 1 item */
  base: string;
  mastery: string;
  dominionName: string;
  dominion: string;
  apotheosisName: string;
  apotheosis: string;
  /** morto liberado na maestria e no domínio */
  units: [DeadKind[], DeadKind[]];
}

export const SCHOOLS: Record<School, SchoolInfo> = {
  bone: {
    id: 'bone',
    name: 'Ossos',
    color: '#e3dccb',
    base: 'Golpes de esqueletos e arqueiros empurram o vivo para trás.',
    mastery: 'Levanta arqueiros. Mortos caídos deixam ossos: 35% de chance de virar cadáver de novo.',
    dominionName: 'Colosso',
    dominion: 'Levanta liches. Fundir pede só 2 esqueletos. Colossos +50% vida e golpes que estilhaçam.',
    apotheosisName: 'Rei Ossudo',
    apotheosis: 'Esqueleto que cai se remonta sozinho depois de 3s, se houver espaço no exército.',
    units: [['archer'], ['lich']],
  },
  flesh: {
    id: 'flesh',
    name: 'Carne',
    color: '#b5525e',
    base: 'Mortos de carne curam 5 de vida a cada golpe.',
    mastery: 'Levanta zumbis e carniçais. Vivos mortos por eles levantam na hora, em qualquer lugar.',
    dominionName: 'Abominação',
    dominion: 'Levanta abominações. +10 no limite do exército. Mortos de carne regeneram e devoram vivos fracos.',
    apotheosisName: 'Banquete',
    apotheosis: 'Consumir não tem limite. A cada 6 mortos consumidos nasce uma abominação.',
    units: [['zombie', 'ghoul'], ['abomination']],
  },
  plague: {
    id: 'plague',
    name: 'Praga',
    color: '#8fbf3a',
    base: 'Ataques dos mortos têm 12% de chance de envenenar.',
    mastery: 'Levanta ratos. Todo morto que cai solta uma nuvem de veneno.',
    dominionName: 'Pestilência',
    dominion: 'Levanta portadores da peste. Veneno +45%. Vivos envenenados espalham a praga ao morrer.',
    apotheosisName: 'Paciente Zero',
    apotheosis: 'As nuvens de veneno andam atrás dos vivos. Quem chega perto do necromante é envenenado.',
    units: [['rat'], ['plaguebearer']],
  },
  spirit: {
    id: 'spirit',
    name: 'Espírito',
    color: '#8fd3ff',
    base: 'O raio deixa o alvo 30% mais lento por 1,5s.',
    mastery: 'Levanta fantasmas. Raios saltam para mais um alvo e atravessam escudos.',
    dominionName: 'Banshee',
    dominion: 'Levanta banshees. A cada 7s um grito atordoa todos os vivos.',
    apotheosisName: 'Véu Rasgado',
    apotheosis: 'Todo morto que cai volta uma vez como fantasma, se houver espaço no exército.',
    units: [['ghost'], ['banshee']],
  },
  blood: {
    id: 'blood',
    name: 'Sangue',
    color: '#e0304a',
    base: 'O necromante cura 10 a cada 20 abates.',
    mastery: 'Levanta servos. Mortos +30% vida e roubam vida. O necromante cura 10 a cada 20 abates.',
    dominionName: 'Frenesi',
    dominion: 'Levanta cavaleiros rubros. Mortos +35% dano. Todo sacrifício dá frenesi: +60% dano e velocidade por 6s.',
    apotheosisName: 'Lorde Vampiro',
    apotheosis: 'Mortos +20% vida. Cura acima da vida máxima vira escudo (até metade da vida). Os mortos curam 10 a cada 6 abates.',
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
  { id: 'ev_wound', name: 'Ferida', desc: '-30 de vida máxima.', apply: (m) => (m.necroMaxHp = Math.max(6, m.necroMaxHp - 3)) },
  { id: 'ev_tithe', name: 'Dízimo', desc: '+40 de vida máxima.', apply: (m) => (m.necroMaxHp += 4) },
  { id: 'ev_banner', name: 'Estandarte', desc: 'mortos +10% dano.', apply: (m) => (m.deadDmgMul *= 1.1) },
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
  for (const id of boons) (BOON_BY_ID[id] ?? GIFT_BY_ID[id])?.apply(m);
  const n = schoolCounts(bonus);
  for (const s of SCHOOL_ORDER) {
    const tiers = n[s] >= DOMINION_AT ? 2 : n[s] >= MASTERY_AT ? 1 : 0;
    for (let t = 0; t < tiers; t++) for (const k of SCHOOLS[s].units[t]) m.raisePool[k] = Math.max(m.raisePool[k] ?? 0, UNIT_WEIGHT[k] ?? 1);
  }
  // básico: vale com 1 item da escola
  if (n.bone >= BASE_AT) m.boneKnock = Math.max(m.boneKnock, 2);
  if (n.flesh >= BASE_AT) m.fleshMend = Math.max(m.fleshMend, 0.5);
  if (n.plague >= BASE_AT) m.plagueTouch = Math.max(m.plagueTouch, 0.12);
  if (n.spirit >= BASE_AT) m.spiritChill = Math.max(m.spiritChill, 1.5);
  if (n.blood >= BASE_AT) m.killHeal += 1 / 20;

  if (n.bone >= MASTERY_AT) m.boneRebirth = Math.max(m.boneRebirth, 0.35);
  if (n.bone >= DOMINION_AT) {
    m.boneDominion = true;
    m.fuseCount = 2;
    m.giantMul *= 1.5;
  }
  if (n.flesh >= MASTERY_AT) m.fleshInfect = true;
  if (n.flesh >= DOMINION_AT) {
    m.fleshDominion = true;
    m.armyCap += 10;
  }
  if (n.plague >= MASTERY_AT) m.plagueDeathCloud = true;
  if (n.plague >= DOMINION_AT) {
    m.plagueDominion = true;
    m.poisonDmgMul *= 1.45;
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
    m.deadDmgMul *= 1.35;
    m.frenzyDmg += 0.6;
    m.frenzyTime = Math.max(m.frenzyTime, 6);
  }

  // apoteose: tudo numa escola só
  if (n.bone >= APOTHEOSIS_AT) m.boneApo = true;
  if (n.flesh >= APOTHEOSIS_AT) {
    m.fleshApo = true;
    m.consumeMax = Math.max(m.consumeMax, 999);
  }
  if (n.plague >= APOTHEOSIS_AT) m.plagueApo = true;
  if (n.spirit >= APOTHEOSIS_AT) {
    m.spiritApo = true;
    m.ghostOnDeath = Math.max(m.ghostOnDeath, 1);
  }
  if (n.blood >= APOTHEOSIS_AT) {
    m.bloodApo = true;
    m.killHeal += 1 / 6;
    m.deadHpMul *= 1.2;
  }
  return m;
}
