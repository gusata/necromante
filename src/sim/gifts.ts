import type { Mods } from './mods';
import type { School } from './types';

/**
 * Dádivas: a build que cresce dentro da run.
 * A cada tantos abates, no fim da onda, o jogador escolhe 1 entre 3.
 * As dádivas de escola somam 1 ponto naquela escola só nesta run, então
 * a maestria (2), o domínio (4) e a apoteose (6) também podem nascer no meio da partida.
 */
export interface Gift {
  id: string;
  name: string;
  desc: string;
  school?: School;
  /** quantas vezes dá para pegar */
  max: number;
  apply: (m: Mods) => void;
}

export const GIFTS: Gift[] = [
  // ---- gerais
  { id: 'g_bolt', name: 'Raio Faminto', desc: 'raios do necromante +40% dano', max: 3, apply: (m) => (m.necroDmg *= 1.4) },
  { id: 'g_haste', name: 'Mãos Ágeis', desc: 'raios 15% mais rápidos', max: 3, apply: (m) => (m.castCdMul *= 0.85) },
  { id: 'g_circle', name: 'Círculo Largo', desc: 'círculo 15% maior', max: 2, apply: (m) => (m.circleR = Math.round(m.circleR * 1.15)) },
  { id: 'g_cap', name: 'Legião', desc: '+8 no limite do exército', max: 3, apply: (m) => (m.armyCap += 8) },
  { id: 'g_vigor', name: 'Ossos Duros', desc: 'mortos +15% vida', max: 3, apply: (m) => (m.deadHpMul *= 1.15) },
  { id: 'g_fury', name: 'Fúria Antiga', desc: 'mortos +12% dano', max: 3, apply: (m) => (m.deadDmgMul *= 1.12) },
  { id: 'g_heart', name: 'Coração Negro', desc: '+40 de vida máxima', max: 3, apply: (m) => (m.necroMaxHp += 4) },
  { id: 'g_regen', name: 'Sangue Frio', desc: 'regenera 10 de vida a cada 4s', max: 2, apply: (m) => (m.necroRegen += 0.25) },
  {
    id: 'g_soil',
    name: 'Terra Fofa',
    desc: 'cadáveres duram +3s e levantam 25% mais rápido',
    max: 2,
    apply: (m) => {
      m.corpseLife += 3;
      m.raiseTimeMul *= 0.75;
    },
  },
  {
    id: 'g_boom',
    name: 'Pólvora de Osso',
    desc: 'explosão +30% dano e maior',
    max: 2,
    apply: (m) => {
      m.explodeDmgMul *= 1.3;
      m.explodeR += 3;
    },
  },
  { id: 'g_feast', name: 'Banquete', desc: 'consumir cura +50%', max: 2, apply: (m) => (m.consumeHealMul *= 1.5) },
  { id: 'g_greed', name: 'Avareza', desc: '+20% almas', max: 3, apply: (m) => (m.soulMul += 0.2) },
  { id: 'g_rite', name: 'Liturgia', desc: 'ritual carrega 25% mais rápido', max: 2, apply: (m) => (m.ritualMul *= 0.75) },
  { id: 'g_march', name: 'Marcha Fúnebre', desc: 'mortos 12% mais rápidos', max: 2, apply: (m) => (m.deadSpeedMul *= 1.12) },
  { id: 'g_armor', name: 'Mortalha', desc: 'mortos ignoram 10% do dano', max: 2, apply: (m) => (m.deadArmor = Math.min(0.6, m.deadArmor + 0.1)) },

  // ---- escolas: cada uma soma 1 ponto na escola nesta run
  {
    id: 'b_marrow',
    school: 'bone',
    name: 'Medula',
    desc: 'esqueletos +30% vida',
    max: 2,
    apply: (m) => (m.kindHpMul.skeleton = (m.kindHpMul.skeleton ?? 1) * 1.3),
  },
  {
    id: 'b_quiver',
    school: 'bone',
    name: 'Aljava de Costela',
    desc: 'esqueletos e arqueiros +1 dano',
    max: 2,
    apply: (m) => {
      m.kindDmgAdd.skeleton = (m.kindDmgAdd.skeleton ?? 0) + 0.5;
      m.kindDmgAdd.archer = (m.kindDmgAdd.archer ?? 0) + 0.5;
    },
  },
  {
    id: 'f_rot',
    school: 'flesh',
    name: 'Podridão',
    desc: 'zumbis e carniçais +30% vida',
    max: 2,
    apply: (m) => {
      m.kindHpMul.zombie = (m.kindHpMul.zombie ?? 1) * 1.3;
      m.kindHpMul.ghoul = (m.kindHpMul.ghoul ?? 1) * 1.3;
    },
  },
  {
    id: 'f_hunger',
    school: 'flesh',
    name: 'Fome',
    desc: '+5 no limite do exército, consumir cura +25%',
    max: 2,
    apply: (m) => {
      m.armyCap += 5;
      m.consumeHealMul *= 1.25;
    },
  },
  { id: 'p_miasma', school: 'plague', name: 'Miasma', desc: 'veneno dura 40% mais', max: 2, apply: (m) => (m.poisonDurMul *= 1.4) },
  { id: 'p_bile', school: 'plague', name: 'Bile Negra', desc: 'veneno +30% dano', max: 2, apply: (m) => (m.poisonDmgMul *= 1.3) },
  {
    id: 'e_echo',
    school: 'spirit',
    name: 'Eco',
    desc: 'raios 10% mais rápidos e +20% dano',
    max: 2,
    apply: (m) => {
      m.castCdMul *= 0.9;
      m.necroDmg *= 1.2;
    },
  },
  { id: 'e_veil', school: 'spirit', name: 'Véu', desc: 'mortos que caem: 12% viram fantasma', max: 2, apply: (m) => (m.ghostOnDeath += 0.12) },
  { id: 'v_thirst', school: 'blood', name: 'Sede', desc: 'mortos roubam vida (+15%)', max: 2, apply: (m) => (m.lifesteal += 0.15) },
  {
    id: 'v_rage',
    school: 'blood',
    name: 'Ira Rubra',
    desc: 'mortos +10% dano e +10% vida',
    max: 2,
    apply: (m) => {
      m.deadDmgMul *= 1.1;
      m.deadHpMul *= 1.1;
    },
  },
];

export const GIFT_BY_ID: Record<string, Gift> = Object.fromEntries(GIFTS.map((g) => [g.id, g]));

/** quantas dádivas oferecer de cada vez */
export const GIFT_CHOICES = 3;

/** abates para a primeira dádiva; cada nova pede GIFT_STEP a mais que a anterior */
export const GIFT_FIRST = 150;
export const GIFT_STEP = 130;
export const giftCost = (taken: number) => GIFT_FIRST + GIFT_STEP * taken;

/** pontos de escola vindos das dádivas pegas */
export function giftSchools(taken: string[]): Partial<Record<School, number>> {
  const out: Partial<Record<School, number>> = {};
  for (const id of taken) {
    const s = GIFT_BY_ID[id]?.school;
    if (s) out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

/**
 * Sorteia as dádivas oferecidas. Escolas que o jogador já tem pesam mais,
 * para a build convergir; escolas ainda não liberadas nunca aparecem.
 */
export function rollGifts(rand: () => number, taken: string[], allowed: School[], counts: Record<School, number>, n = GIFT_CHOICES): string[] {
  const times = (id: string) => taken.filter((t) => t === id).length;
  const pool = GIFTS.filter((g) => times(g.id) < g.max && (!g.school || !allowed.length || allowed.includes(g.school)));
  const weight = (g: Gift) => (g.school ? (counts[g.school] > 0 ? 3 : 1.2) : 1);
  const out: string[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, g) => a + weight(g), 0);
    let r = rand() * total;
    let i = 0;
    while (i < pool.length - 1 && r > weight(pool[i])) r -= weight(pool[i++]);
    out.push(pool.splice(i, 1)[0].id);
  }
  return out;
}
