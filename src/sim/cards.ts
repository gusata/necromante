import { cloneMods, type Mods } from './mods';
import type { School } from './types';

export const MASTERY_AT = 3;
export const DOMINION_AT = 5;

export interface SchoolInfo {
  id: School;
  name: string;
  color: string;
  mastery: string;
  dominionName: string;
  dominion: string;
}

export const SCHOOLS: Record<School, SchoolInfo> = {
  bone: {
    id: 'bone',
    name: 'Ossos',
    color: '#e3dccb',
    mastery: 'Mortos caídos deixam ossos: 35% de chance de virar cadáver de novo.',
    dominionName: 'Colosso',
    dominion: 'Fundir pede só 2 esqueletos. Colossos +50% vida e golpes que estilhaçam.',
  },
  flesh: {
    id: 'flesh',
    name: 'Carne',
    color: '#b5525e',
    mastery: 'Vivos mortos por zumbis e carniçais levantam na hora, em qualquer lugar.',
    dominionName: 'Abominação',
    dominion: '+2 no limite do exército. Mortos de carne regeneram e devoram vivos fracos.',
  },
  plague: {
    id: 'plague',
    name: 'Praga',
    color: '#8fbf3a',
    mastery: 'Todo morto que cai solta uma nuvem de veneno.',
    dominionName: 'Pestilência',
    dominion: 'Veneno +60%. Vivos envenenados espalham a praga ao morrer.',
  },
  spirit: {
    id: 'spirit',
    name: 'Espírito',
    color: '#8fd3ff',
    mastery: 'Raios saltam para mais um alvo e atravessam escudos. Fantasmas caçam a retaguarda.',
    dominionName: 'Banshee',
    dominion: 'A cada 7s um grito atordoa todos os vivos.',
  },
  blood: {
    id: 'blood',
    name: 'Sangue',
    color: '#e0304a',
    mastery: 'Mortos +30% vida e roubam vida. O necromante cura 1 a cada 5 abates.',
    dominionName: 'Lorde Vampiro',
    dominion: 'Mortos +25% dano. Todo sacrifício dá frenesi: +60% dano e velocidade por 6s.',
  },
};

export const SCHOOL_ORDER: School[] = ['bone', 'flesh', 'plague', 'spirit', 'blood'];

export type Rarity = 'common' | 'rare' | 'legendary';

export interface Card {
  id: string;
  name: string;
  desc: string;
  school: School | null;
  rarity: Rarity;
  /** quantas vezes pode ser escolhida */
  max: number;
  /** só aparece se o jogador já tiver uma destas cartas */
  requires?: string[];
  apply: (m: Mods) => void;
}

const add = (rec: Partial<Record<string, number>>, k: string, v: number) => (rec[k] = (rec[k] ?? 0) + v);
const mul = (rec: Partial<Record<string, number>>, k: string, v: number) => (rec[k] = (rec[k] ?? 1) * v);

const c = (id: string, school: School | null, rarity: Rarity, max: number, name: string, desc: string, apply: (m: Mods) => void, requires?: string[]): Card => ({
  requires,
  id,
  school,
  rarity,
  max,
  name,
  desc,
  apply,
});

export const CARDS: Card[] = [
  // ------------------------------------------------ Ossos
  c('bone_sharp', 'bone', 'common', 3, 'Ossos Afiados', 'Esqueletos e arqueiros +1 dano.', (m) => {
    add(m.kindDmgAdd, 'skeleton', 1);
    add(m.kindDmgAdd, 'archer', 1);
  }),
  c('bone_archers', 'bone', 'common', 1, 'Arqueiros de Osso', 'Cadáveres podem levantar como arqueiros.', (m) => add(m.raisePool, 'archer', 2)),
  c('bone_marrow', 'bone', 'common', 3, 'Medula Fria', 'Mortos +20% vida.', (m) => (m.deadHpMul *= 1.2)),
  c('bone_ossuary', 'bone', 'rare', 2, 'Ossuário Portátil', '+2 no limite do exército.', (m) => (m.armyCap += 2)),
  c('bone_colossus', 'bone', 'rare', 2, 'Colosso Faminto', 'Colossos +50% vida e dano.', (m) => (m.giantMul *= 1.5)),
  c('bone_rain', 'bone', 'common', 3, 'Chuva de Ossos', 'Explosões +4 de raio.', (m) => (m.explodeR += 4)),
  c('bone_ancestor', 'bone', 'rare', 2, 'Esqueleto Ancestral', 'Cada onda começa com +1 esqueleto de graça.', (m) => (m.freeSkeletonsPerWave += 1)),
  c('bone_dance', 'bone', 'common', 2, 'Dança Macabra', 'Mortos +20% velocidade.', (m) => (m.deadSpeedMul *= 1.2)),
  // ------------------------------------------------ Carne
  c('flesh_pact', 'flesh', 'common', 1, 'Pacto da Carne', 'Cadáveres podem levantar como zumbis.', (m) => add(m.raisePool, 'zombie', 3)),
  c('flesh_hunger', 'flesh', 'common', 1, 'Fome Insaciável', 'Cadáveres podem levantar como carniçais.', (m) => add(m.raisePool, 'ghoul', 2)),
  c('flesh_rot', 'flesh', 'common', 3, 'Carne Podre', 'Zumbis +50% vida.', (m) => mul(m.kindHpMul, 'zombie', 1.5), ['flesh_pact']),
  c('flesh_bite', 'flesh', 'common', 3, 'Mordida Infecciosa', 'Zumbis e carniçais +1 dano.', (m) => {
    add(m.kindDmgAdd, 'zombie', 1);
    add(m.kindDmgAdd, 'ghoul', 1);
  }, ['flesh_pact', 'flesh_hunger']),
  c('flesh_hide', 'flesh', 'rare', 2, 'Couro Curtido', 'Mortos ignoram 20% do dano.', (m) => (m.deadArmor = 1 - (1 - m.deadArmor) * 0.8)),
  c('flesh_feast', 'flesh', 'common', 2, 'Banquete', 'Consumir cura +50%.', (m) => (m.consumeHealMul *= 1.5)),
  c('flesh_quick', 'flesh', 'common', 2, 'Levantar Ligeiro', 'Levantar 35% mais rápido.', (m) => (m.raiseTimeMul *= 0.65)),
  c('flesh_fresh', 'flesh', 'common', 2, 'Cadáveres Frescos', 'Cadáveres duram +5s.', (m) => (m.corpseLife += 5)),
  // ------------------------------------------------ Praga
  c('plague_nest', 'plague', 'common', 1, 'Ninho de Ratos', 'Cadáveres podem levantar como ratos.', (m) => add(m.raisePool, 'rat', 3)),
  c('plague_bile', 'plague', 'common', 1, 'Bile Tóxica', 'Explosões deixam uma nuvem de veneno.', (m) => (m.explodePoison = true)),
  c('plague_spores', 'plague', 'rare', 1, 'Esporos', 'Ataques dos mortos envenenam.', (m) => (m.poisonOnHit = true)),
  c('plague_ratbomb', 'plague', 'common', 1, 'Ratos Explosivos', 'Ratos explodem ao morrer.', (m) => (m.ratExplode = true), ['plague_nest']),
  c('plague_miasma', 'plague', 'rare', 2, 'Miasma', 'O círculo envenena quem está dentro.', (m) => (m.circleMiasma += 0.4)),
  c('plague_black', 'plague', 'common', 3, 'Peste Negra', 'Veneno +40% dano e duração.', (m) => {
    m.poisonDmgMul *= 1.4;
    m.poisonDurMul *= 1.4;
  }),
  c('plague_fever', 'plague', 'common', 1, 'Febre', 'Vivos envenenados andam 35% mais devagar.', (m) => (m.poisonSlow = true)),
  c('plague_contagion', 'plague', 'rare', 1, 'Contágio', 'Quem morre envenenado sempre pode levantar.', (m) => (m.poisonedRaisable = true)),
  // ------------------------------------------------ Espírito
  c('spirit_veil', 'spirit', 'common', 1, 'Véu', 'Cadáveres podem levantar como fantasmas.', (m) => add(m.raisePool, 'ghost', 3)),
  c('spirit_wail', 'spirit', 'common', 3, 'Lamento', 'Fantasmas +2 dano.', (m) => add(m.kindDmgAdd, 'ghost', 2), ['spirit_veil']),
  c('spirit_echo', 'spirit', 'rare', 2, 'Eco', 'Raios do necromante saltam para +1 alvo.', (m) => (m.boltChain += 1)),
  c('spirit_gaze', 'spirit', 'common', 3, 'Olhar Vazio', 'Raios 25% mais rápidos.', (m) => (m.castCdMul *= 0.75)),
  c('spirit_wide', 'spirit', 'common', 3, 'Círculo Ampliado', 'Círculo +4 de raio.', (m) => (m.circleR += 4)),
  c('spirit_haunt', 'spirit', 'rare', 2, 'Assombração', 'Mortos que caem têm 45% de chance de virar fantasma.', (m) => (m.ghostOnDeath += 0.45)),
  c('spirit_chains', 'spirit', 'common', 2, 'Grilhões Etéreos', 'Vivos no círculo andam 30% mais devagar.', (m) => (m.circleSlow = 1 - (1 - m.circleSlow) * 0.7)),
  c('spirit_bound', 'spirit', 'common', 3, 'Alma Vinculada', '+25% almas e +1 no limite do exército.', (m) => {
    m.soulMul += 0.25;
    m.armyCap += 1;
  }),
  // ------------------------------------------------ Sangue
  c('blood_servants', 'blood', 'common', 1, 'Servos de Sangue', 'Cadáveres podem levantar como servos.', (m) => add(m.raisePool, 'thrall', 4)),
  c('blood_thirst', 'blood', 'common', 3, 'Sede', 'Mortos +15% dano e 25% de chance de curar 1 ao acertar.', (m) => {
    m.lifesteal += 0.25;
    m.deadDmgMul *= 1.15;
  }),
  c('blood_pact', 'blood', 'common', 3, 'Pacto Rubro', 'Necromante +8 vida máxima.', (m) => (m.necroMaxHp += 8)),
  c('blood_ritual', 'blood', 'common', 3, 'Sacrifício Ritual', 'Explosões +50% dano.', (m) => (m.explodeDmgMul *= 1.5)),
  c('blood_heart', 'blood', 'rare', 2, 'Coração Negro', 'Necromante regenera 1 vida a cada 4s.', (m) => (m.necroRegen += 1 / 4)),
  c('blood_offering', 'blood', 'common', 2, 'Transfusão', 'Mortos +25% vida. Sacrifícios dão +1 alma.', (m) => {
    m.deadHpMul *= 1.25;
    m.consumeSouls += 1;
  }),
  c('blood_fury', 'blood', 'rare', 2, 'Fúria Sanguínea', 'Sacrifícios dão +30% dano aos mortos por 5s.', (m) => {
    m.frenzyDmg += 0.3;
    m.frenzyTime = Math.max(m.frenzyTime, 5);
  }),
  c('blood_chalice', 'blood', 'common', 2, 'Cálice', 'Consumir sacrifica até +2 mortos.', (m) => (m.consumeMax += 2)),
  // ------------------------------------------------ Neutras
  c('grimoire', null, 'rare', 3, 'Grimório Proibido', 'Raios do necromante +1 dano.', (m) => (m.necroDmg += 1)),
  c('tomb', null, 'common', 3, 'Lápide Vazia', '+1 no limite do exército.', (m) => (m.armyCap += 1)),
  c('ward', null, 'common', 3, 'Selo de Proteção', 'Necromante +4 vida máxima.', (m) => (m.necroMaxHp += 4)),
  c('hourglass', null, 'legendary', 1, 'Ampulheta Partida', 'Raios 35% mais rápidos e +1 dano.', (m) => {
    m.castCdMul *= 0.65;
    m.necroDmg += 1;
  }),
];

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((k) => [k.id, k]));

export function schoolCounts(cards: string[], bonus: Partial<Record<School, number>> = {}): Record<School, number> {
  const n: Record<School, number> = { bone: 0, flesh: 0, plague: 0, spirit: 0, blood: 0 };
  for (const [s, v] of Object.entries(bonus)) n[s as School] += v ?? 0;
  for (const id of cards) {
    const s = CARD_BY_ID[id]?.school;
    if (s) n[s]++;
  }
  return n;
}

/** Aplica cartas e sinergias por cima dos modificadores base. */
export function computeMods(base: Mods, cards: string[], bonus: Partial<Record<School, number>> = {}): Mods {
  const m = cloneMods(base);
  for (const id of cards) CARD_BY_ID[id]?.apply(m);
  const n = schoolCounts(cards, bonus);
  if (n.bone >= MASTERY_AT) m.boneRebirth = 0.35;
  if (n.bone >= DOMINION_AT) {
    m.boneDominion = true;
    m.fuseCount = 2;
    m.giantMul *= 1.5;
  }
  if (n.flesh >= MASTERY_AT) m.fleshInfect = true;
  if (n.flesh >= DOMINION_AT) {
    m.fleshDominion = true;
    m.armyCap += 2;
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

const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 4, legendary: 1 };

/** Sorteia `count` cartas diferentes que ainda podem ser escolhidas. */
export function rollOffer(rand: () => number, owned: string[], schools: School[], count: number, bonus: Partial<Record<School, number>> = {}): string[] {
  const have = (id: string) => owned.filter((o) => o === id).length;
  const pool = CARDS.filter(
    (k) => (k.school === null || schools.includes(k.school)) && have(k.id) < k.max && (!k.requires || k.requires.some((r) => owned.includes(r))),
  );
  const counts = schoolCounts(owned, bonus);
  const out: string[] = [];
  while (out.length < count && pool.length) {
    // escolas em que o jogador já investiu aparecem um pouco mais
    const weights = pool.map((k) => RARITY_WEIGHT[k.rarity] * (k.school ? 1 + counts[k.school] * 0.35 : 0.8));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let i = 0;
    while (r > weights[i]) r -= weights[i++];
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  return out;
}
