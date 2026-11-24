import type { Mods } from './mods';
import type { School } from './types';

export type Slot = 'staff' | 'hood' | 'cloak' | 'amulet' | 'ring';
export type EquipSlot = 'staff' | 'hood' | 'cloak' | 'amulet' | 'ring1' | 'ring2';
export type ItemRarity = 'common' | 'magic' | 'rare' | 'legendary' | 'set';

export const EQUIP_SLOTS: EquipSlot[] = ['staff', 'hood', 'cloak', 'amulet', 'ring1', 'ring2'];
export const SLOT_OF: Record<EquipSlot, Slot> = { staff: 'staff', hood: 'hood', cloak: 'cloak', amulet: 'amulet', ring1: 'ring', ring2: 'ring' };
export const SLOT_NAME: Record<Slot, string> = { staff: 'Cajado', hood: 'Capuz', cloak: 'Manto', amulet: 'Amuleto', ring: 'Anel' };
export const RARITY_NAME: Record<ItemRarity, string> = { common: 'comum', magic: 'mágico', rare: 'raro', legendary: 'lendário', set: 'conjunto' };
export const RARITY_COLOR: Record<ItemRarity, string> = { common: '#a49c86', magic: '#6fa8c8', rare: '#e0b040', legendary: '#ff7a3a', set: '#4ee08a' };
/** nível máximo do item (cópias repetidas) */
export const MAX_ITEM_LEVEL = 5;
/** nível máximo da forja de cada espaço */
export const MAX_SLOT_LEVEL = 5;
/** custo de forjar o espaço do nível n para n+1 */
export const SLOT_FORGE_COST = [40, 90, 160, 260, 400];
/** nível efetivo = nível do item + nível do espaço */
export const effectiveLevel = (itemLvl: number, slotLvl: number) => itemLvl + slotLvl;

export interface Item {
  id: string;
  name: string;
  slot: Slot;
  rarity: ItemRarity;
  /** cor principal do ícone */
  color: string;
  /** texto do efeito no nível dado */
  desc: (lvl: number) => string;
  /** conta como cartas extras de uma escola (para as sinergias) */
  school?: Partial<Record<School, number>>;
  apply: (m: Mods, lvl: number) => void;
  /** peça de conjunto */
  set?: string;
  /** bônus permanente do tesouro (lendários e conjuntos), equipado ou não */
  hoard?: { desc: (lvl: number) => string; apply: (m: Mods, lvl: number) => void };
}

/** Conjuntos: 3 peças que misturam duas escolas. Bônus com 2 e com 3 peças equipadas. */
export interface ItemSet {
  id: string;
  name: string;
  color: string;
  two: string;
  three: string;
  apply: (m: Mods, pieces: number) => void;
}

export const SETS: ItemSet[] = [
  {
    id: 'pest',
    name: 'Ossos Pestilentos',
    color: '#9fcf4a',
    two: 'esqueletos e arqueiros envenenam ao acertar',
    three: 'mortos de ossos soltam nuvem ao cair. veneno +30%',
    apply: (m, n) => {
      if (n >= 2) m.boneVenom = true;
      if (n >= 3) {
        m.boneDeathCloud = true;
        m.poisonDmgMul *= 1.3;
      }
    },
  },
  {
    id: 'crimson',
    name: 'Pacto Carmesim',
    color: '#d0405a',
    two: 'mortos de carne bebem sangue (+1 vida por golpe) e +20% vida',
    three: 'cada morto consumido levanta um carniçal',
    apply: (m, n) => {
      if (n >= 2) {
        m.fleshLeech = true;
        m.kindHpMul.zombie = (m.kindHpMul.zombie ?? 1) * 1.2;
        m.kindHpMul.ghoul = (m.kindHpMul.ghoul ?? 1) * 1.2;
      }
      if (n >= 3) m.consumeRaise += 1;
    },
  },
  {
    id: 'choir',
    name: 'Coro Fantasma',
    color: '#bfe9ff',
    two: 'raios saltam +1 alvo. quem morre por raio levanta em qualquer lugar',
    three: 'mortos que caem: 30% de chance de voltar como fantasma. fantasmas +50% vida',
    apply: (m, n) => {
      if (n >= 2) {
        m.boltChain += 1;
        m.boltForce = true;
      }
      if (n >= 3) {
        m.ghostOnDeath += 0.3;
        m.kindHpMul.ghost = (m.kindHpMul.ghost ?? 1) * 1.5;
      }
    },
  },
];

export const SET_BY_ID: Record<string, ItemSet> = Object.fromEntries(SETS.map((s) => [s.id, s]));

/** multiplicador de nível: +25% do efeito por nível de forja */
const f = (lvl: number) => 1 + 0.25 * lvl;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const r1 = (v: number) => Math.round(v * 10) / 10;

const it = (i: Item) => i;

export const ITEMS: Item[] = [
  // ------------------------------------------------ cajados
  it({ id: 'staff_yew', name: 'Cajado de Teixo', slot: 'staff', rarity: 'common', color: '#6e4d36', desc: (l) => `raios ${pct(0.08 * f(l))} mais rápidos`, apply: (m, l) => (m.castCdMul *= 1 - 0.08 * f(l)) }),
  it({ id: 'staff_bone', name: 'Cajado de Osso', slot: 'staff', rarity: 'magic', color: '#e3dccb', school: { bone: 1 }, desc: (l) => `conta 1 carta de ossos. mortos +${pct(0.06 * f(l))} dano`, apply: (m, l) => (m.deadDmgMul *= 1 + 0.06 * f(l)) }),
  it({ id: 'staff_rot', name: 'Cajado Pútrido', slot: 'staff', rarity: 'magic', color: '#8fbf3a', school: { plague: 1 }, desc: (l) => `conta 1 carta de praga. veneno +${pct(0.15 * f(l))}`, apply: (m, l) => (m.poisonDmgMul *= 1 + 0.15 * f(l)) }),
  it({ id: 'staff_storm', name: 'Cajado da Tempestade', slot: 'staff', rarity: 'rare', color: '#8fd3ff', desc: (l) => `raios saltam +1 alvo. +${r1(0.3 * f(l))} dano`, apply: (m, l) => { m.boltChain += 1; m.necroDmg += 0.3 * f(l); } }),
  it({ id: 'staff_harvest', name: 'Cajado da Colheita', slot: 'staff', rarity: 'legendary', color: '#aef5bf', desc: (l) => `quem morre pelo raio levanta mesmo com o exército cheio. raios +${pct(0.05 * f(l))}`, apply: (m, l) => { m.boltOvercap = true; m.castCdMul *= 1 - 0.05 * f(l); }, hoard: { desc: (l) => `raios ${pct(0.02 + 0.01 * l)} mais rápidos`, apply: (m, l) => (m.castCdMul *= 1 - (0.02 + 0.01 * l)) } }),
  // ------------------------------------------------ capuzes
  it({ id: 'hood_worn', name: 'Capuz Puído', slot: 'hood', rarity: 'common', color: '#4a3b2a', desc: (l) => `círculo +${r1(2 * f(l))} de raio`, apply: (m, l) => (m.circleR += 2 * f(l)) }),
  it({ id: 'hood_seer', name: 'Capuz do Vidente', slot: 'hood', rarity: 'magic', color: '#6fa8c8', school: { spirit: 1 }, desc: (l) => `conta 1 carta de espírito. círculo +${r1(1.5 * f(l))}`, apply: (m, l) => (m.circleR += 1.5 * f(l)) }),
  it({ id: 'hood_plague', name: 'Máscara da Peste', slot: 'hood', rarity: 'rare', color: '#c8b890', school: { plague: 1 }, desc: (l) => `conta 1 carta de praga. o círculo envenena (${r1(0.25 * f(l))}/s)`, apply: (m, l) => (m.circleMiasma += 0.25 * f(l)) }),
  it({ id: 'hood_lich', name: 'Coroa do Lich', slot: 'hood', rarity: 'legendary', color: '#c9a23a', desc: (l) => `limite do exército +${15 + 3 * l}, mas os mortos apodrecem devagar`, apply: (m, l) => { m.armyCap += 15 + 3 * l; m.lichDecay = true; }, hoard: { desc: (l) => `+${2 + l} no limite do exército`, apply: (m, l) => (m.armyCap += 2 + l) } }),
  // ------------------------------------------------ mantos
  it({ id: 'cloak_wool', name: 'Manto de Lã', slot: 'cloak', rarity: 'common', color: '#5a4a6b', desc: (l) => `necromante +${Math.round(3 * f(l))} vida`, apply: (m, l) => (m.necroMaxHp += Math.round(3 * f(l))) }),
  it({ id: 'cloak_flesh', name: 'Manto de Couro Humano', slot: 'cloak', rarity: 'magic', color: '#b5525e', school: { flesh: 1 }, desc: (l) => `conta 1 carta de carne. mortos +${pct(0.08 * f(l))} vida`, apply: (m, l) => (m.deadHpMul *= 1 + 0.08 * f(l)) }),
  it({ id: 'cloak_crimson', name: 'Manto Rubro', slot: 'cloak', rarity: 'rare', color: '#9e2236', school: { blood: 1 }, desc: (l) => `conta 1 carta de sangue. regenera 1 vida a cada ${r1(10 / f(l))}s`, apply: (m, l) => (m.necroRegen += f(l) / 10) }),
  it({ id: 'cloak_reaper', name: 'Manto do Ceifador', slot: 'cloak', rarity: 'legendary', color: '#2a2732', desc: (l) => `explodir tem ${pct(Math.min(0.75, 0.4 + 0.07 * l))} de chance de não gastar o morto`, apply: (m, l) => (m.explodeKeep = Math.min(0.75, 0.4 + 0.07 * l)), hoard: { desc: (l) => `explosões +${pct(0.04 + 0.02 * l)} dano`, apply: (m, l) => (m.explodeDmgMul *= 1.04 + 0.02 * l) } }),
  // ------------------------------------------------ amuletos
  it({ id: 'amulet_tooth', name: 'Colar de Dentes', slot: 'amulet', rarity: 'common', color: '#e3dccb', desc: (l) => `+${pct(0.1 * f(l))} almas`, apply: (m, l) => (m.soulMul += 0.1 * f(l)) }),
  it({ id: 'amulet_digger', name: 'Amuleto do Coveiro', slot: 'amulet', rarity: 'magic', color: '#8a6a22', desc: (l) => `cadáveres +${r1(2 * f(l))}s, levantar ${pct(0.1 * f(l))} mais rápido`, apply: (m, l) => { m.corpseLife += 2 * f(l); m.raiseTimeMul *= 1 - 0.1 * f(l); } }),
  it({ id: 'amulet_reliquary', name: 'Relicário Roubado', slot: 'amulet', rarity: 'rare', color: '#f6cf6a', desc: (l) => `+${1 + Math.floor(l / 2)} troca(s) de cartas por run`, apply: (m, l) => (m.rerolls += 1 + Math.floor(l / 2)) }),
  it({ id: 'amulet_hunger', name: 'Coração Faminto', slot: 'amulet', rarity: 'legendary', color: '#e0304a', desc: (l) => `consumir cura ${r1(2 * f(l))}x e sacrifica até +4`, apply: (m, l) => { m.consumeHealMul *= 2 * f(l); m.consumeMax += 4; }, hoard: { desc: (l) => `+${1 + Math.floor(l / 2)} vida do necromante`, apply: (m, l) => (m.necroMaxHp += 1 + Math.floor(l / 2)) } }),
  // ------------------------------------------------ anéis
  it({ id: 'ring_iron', name: 'Anel de Ferro', slot: 'ring', rarity: 'common', color: '#8a94a6', desc: (l) => `mortos +${pct(0.07 * f(l))} dano`, apply: (m, l) => (m.deadDmgMul *= 1 + 0.07 * f(l)) }),
  it({ id: 'ring_bone', name: 'Anel de Osso', slot: 'ring', rarity: 'magic', color: '#e3dccb', school: { bone: 1 }, desc: (l) => `conta 1 carta de ossos. colossos +${pct(0.1 * f(l))}`, apply: (m, l) => (m.giantMul *= 1 + 0.1 * f(l)) }),
  it({ id: 'ring_flesh', name: 'Anel de Carne', slot: 'ring', rarity: 'magic', color: '#b5525e', school: { flesh: 1 }, desc: (l) => `conta 1 carta de carne. cadáveres +${r1(0.5 * f(l))}s`, apply: (m, l) => (m.corpseLife += 0.5 * f(l)) }),
  it({ id: 'ring_plague', name: 'Anel da Praga', slot: 'ring', rarity: 'magic', color: '#8fbf3a', school: { plague: 1 }, desc: (l) => `conta 1 carta de praga. veneno dura +${pct(0.1 * f(l))}`, apply: (m, l) => (m.poisonDurMul *= 1 + 0.1 * f(l)) }),
  it({ id: 'ring_spirit', name: 'Anel Etéreo', slot: 'ring', rarity: 'magic', color: '#8fd3ff', school: { spirit: 1 }, desc: (l) => `conta 1 carta de espírito. raios ${pct(0.04 * f(l))} mais rápidos`, apply: (m, l) => (m.castCdMul *= 1 - 0.04 * f(l)) }),
  it({ id: 'ring_blood', name: 'Anel de Sangue', slot: 'ring', rarity: 'magic', color: '#e0304a', school: { blood: 1 }, desc: (l) => `conta 1 carta de sangue. +${Math.round(2 * f(l))} vida`, apply: (m, l) => (m.necroMaxHp += Math.round(2 * f(l))) }),
  it({ id: 'ring_abyss', name: 'Anel do Abismo', slot: 'ring', rarity: 'legendary', color: '#5a0f1d', desc: (l) => `mortos +${pct(0.25 * f(l))} dano, necromante -6 vida`, apply: (m, l) => { m.deadDmgMul *= 1 + 0.25 * f(l); m.necroMaxHp -= 6; }, hoard: { desc: (l) => `mortos +${pct(0.02 + 0.01 * l)} dano`, apply: (m, l) => (m.deadDmgMul *= 1.02 + 0.01 * l) } }),
  // ------------------------------------------------ conjuntos (cada peça conta para as duas escolas)
  it({ id: 'staff_pest', name: 'Cajado Pestilento', slot: 'staff', rarity: 'set', set: 'pest', color: '#9fcf4a', school: { bone: 1, plague: 1 }, desc: (l) => `ossos e praga. veneno +${pct(0.1 * f(l))}`, apply: (m, l) => (m.poisonDmgMul *= 1 + 0.1 * f(l)), hoard: { desc: (l) => `veneno +${pct(0.03 + 0.01 * l)}`, apply: (m, l) => (m.poisonDmgMul *= 1.03 + 0.01 * l) } }),
  it({ id: 'hood_pest', name: 'Capuz do Ossário', slot: 'hood', rarity: 'set', set: 'pest', color: '#c8d890', school: { bone: 1, plague: 1 }, desc: (l) => `ossos e praga. círculo +${r1(1.5 * f(l))}`, apply: (m, l) => (m.circleR += 1.5 * f(l)), hoard: { desc: (l) => `esqueletos +${pct(0.04 + 0.02 * l)} vida`, apply: (m, l) => (m.kindHpMul.skeleton = (m.kindHpMul.skeleton ?? 1) * (1.04 + 0.02 * l)) } }),
  it({ id: 'ring_pest', name: 'Anel da Tíbia Podre', slot: 'ring', rarity: 'set', set: 'pest', color: '#9fcf4a', school: { bone: 1, plague: 1 }, desc: (l) => `ossos e praga. mortos +${pct(0.05 * f(l))} dano`, apply: (m, l) => (m.deadDmgMul *= 1 + 0.05 * f(l)), hoard: { desc: (l) => `veneno dura +${pct(0.04 + 0.02 * l)}`, apply: (m, l) => (m.poisonDurMul *= 1.04 + 0.02 * l) } }),
  it({ id: 'cloak_pact', name: 'Manto do Pacto', slot: 'cloak', rarity: 'set', set: 'crimson', color: '#d0405a', school: { flesh: 1, blood: 1 }, desc: (l) => `carne e sangue. mortos +${pct(0.08 * f(l))} vida`, apply: (m, l) => (m.deadHpMul *= 1 + 0.08 * f(l)), hoard: { desc: (l) => `mortos +${pct(0.02 + 0.01 * l)} vida`, apply: (m, l) => (m.deadHpMul *= 1.02 + 0.01 * l) } }),
  it({ id: 'amulet_pact', name: 'Coração Costurado', slot: 'amulet', rarity: 'set', set: 'crimson', color: '#b5525e', school: { flesh: 1, blood: 1 }, desc: (l) => `carne e sangue. consumir cura +${pct(0.3 * f(l))}`, apply: (m, l) => (m.consumeHealMul *= 1 + 0.3 * f(l)), hoard: { desc: (l) => `cadáveres +${r1(0.5 + 0.25 * l)}s`, apply: (m, l) => (m.corpseLife += 0.5 + 0.25 * l) } }),
  it({ id: 'ring_pact', name: 'Anel de Sangue Coalhado', slot: 'ring', rarity: 'set', set: 'crimson', color: '#d0405a', school: { flesh: 1, blood: 1 }, desc: (l) => `carne e sangue. +${Math.round(2 * f(l))} vida`, apply: (m, l) => (m.necroMaxHp += Math.round(2 * f(l))), hoard: { desc: (l) => `+${1 + Math.floor(l / 2)} vida do necromante`, apply: (m, l) => (m.necroMaxHp += 1 + Math.floor(l / 2)) } }),
  it({ id: 'staff_choir', name: 'Batuta do Coro', slot: 'staff', rarity: 'set', set: 'choir', color: '#bfe9ff', school: { spirit: 1, flesh: 1 }, desc: (l) => `espírito e carne. raios ${pct(0.06 * f(l))} mais rápidos`, apply: (m, l) => (m.castCdMul *= 1 - 0.06 * f(l)), hoard: { desc: (l) => `raios ${pct(0.02 + 0.01 * l)} mais rápidos`, apply: (m, l) => (m.castCdMul *= 1 - (0.02 + 0.01 * l)) } }),
  it({ id: 'hood_choir', name: 'Véu do Coro', slot: 'hood', rarity: 'set', set: 'choir', color: '#d8f0ff', school: { spirit: 1, flesh: 1 }, desc: (l) => `espírito e carne. +${pct(0.08 * f(l))} almas`, apply: (m, l) => (m.soulMul += 0.08 * f(l)), hoard: { desc: (l) => `+${pct(0.03 + 0.01 * l)} almas`, apply: (m, l) => (m.soulMul += 0.03 + 0.01 * l) } }),
  it({ id: 'cloak_choir', name: 'Mortalha do Coro', slot: 'cloak', rarity: 'set', set: 'choir', color: '#bfe9ff', school: { spirit: 1, flesh: 1 }, desc: (l) => `espírito e carne. mortos +${pct(0.06 * f(l))} velocidade`, apply: (m, l) => (m.deadSpeedMul *= 1 + 0.06 * f(l)), hoard: { desc: (l) => `círculo +${r1(0.5 + 0.25 * l)}`, apply: (m, l) => (m.circleR += 0.5 + 0.25 * l) } }),
];

/** Itens que entram no tesouro (lendários e peças de conjunto). */
export const HOARD_ITEMS = (): Item[] => ITEMS.filter((i) => i.hoard);
/** Tesouro completo: todas as peças achadas. */
export const HOARD_COMPLETE = { desc: '+10% almas e mortos +5% dano', apply: (m: Mods) => { m.soulMul += 0.1; m.deadDmgMul *= 1.05; } };

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const ITEM_PRICE: Record<ItemRarity, number> = { common: 40, magic: 90, rare: 200, legendary: 450, set: 260 };
export const upgradeCost = (item: Item, lvl: number) => Math.round(ITEM_PRICE[item.rarity] * 0.6 * (lvl + 1));

const RARITY_WEIGHT: Record<ItemRarity, number> = { common: 60, magic: 28, rare: 10, legendary: 2, set: 1.2 };

/** Sorteia um item. `luck` (0..1) puxa para raridades maiores; `minRarity` corta as baixas. */
export function rollItem(rand: () => number, luck = 0, minRarity: ItemRarity = 'common'): string {
  // conjunto fica no mesmo degrau do raro (peça por peça, menos chance)
  const order: ItemRarity[] = ['common', 'magic', 'rare', 'legendary'];
  const tier = (r: ItemRarity) => (r === 'set' ? 2 : order.indexOf(r));
  const min = order.indexOf(minRarity);
  const pool = ITEMS.filter((i) => tier(i.rarity) >= min);
  const w = pool.map((i) => RARITY_WEIGHT[i.rarity] * (1 + luck * tier(i.rarity)));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < pool.length; k++) {
    if (r < w[k]) return pool[k].id;
    r -= w[k];
  }
  return pool[pool.length - 1].id;
}
