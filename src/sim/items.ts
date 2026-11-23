import type { Mods } from './mods';
import type { School } from './types';

export type Slot = 'staff' | 'hood' | 'cloak' | 'amulet' | 'ring';
export type EquipSlot = 'staff' | 'hood' | 'cloak' | 'amulet' | 'ring1' | 'ring2';
export type ItemRarity = 'common' | 'magic' | 'rare' | 'legendary';

export const EQUIP_SLOTS: EquipSlot[] = ['staff', 'hood', 'cloak', 'amulet', 'ring1', 'ring2'];
export const SLOT_OF: Record<EquipSlot, Slot> = { staff: 'staff', hood: 'hood', cloak: 'cloak', amulet: 'amulet', ring1: 'ring', ring2: 'ring' };
export const SLOT_NAME: Record<Slot, string> = { staff: 'Cajado', hood: 'Capuz', cloak: 'Manto', amulet: 'Amuleto', ring: 'Anel' };
export const RARITY_NAME: Record<ItemRarity, string> = { common: 'comum', magic: 'mágico', rare: 'raro', legendary: 'lendário' };
export const RARITY_COLOR: Record<ItemRarity, string> = { common: '#a49c86', magic: '#6fa8c8', rare: '#e0b040', legendary: '#ff7a3a' };
export const MAX_ITEM_LEVEL = 5;

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
}

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
  it({ id: 'staff_harvest', name: 'Cajado da Colheita', slot: 'staff', rarity: 'legendary', color: '#aef5bf', desc: (l) => `quem morre pelo raio levanta mesmo com o exército cheio. raios +${pct(0.05 * f(l))}`, apply: (m, l) => { m.boltOvercap = true; m.castCdMul *= 1 - 0.05 * f(l); } }),
  // ------------------------------------------------ capuzes
  it({ id: 'hood_worn', name: 'Capuz Puído', slot: 'hood', rarity: 'common', color: '#4a3b2a', desc: (l) => `círculo +${r1(2 * f(l))} de raio`, apply: (m, l) => (m.circleR += 2 * f(l)) }),
  it({ id: 'hood_seer', name: 'Capuz do Vidente', slot: 'hood', rarity: 'magic', color: '#6fa8c8', school: { spirit: 1 }, desc: (l) => `conta 1 carta de espírito. círculo +${r1(1.5 * f(l))}`, apply: (m, l) => (m.circleR += 1.5 * f(l)) }),
  it({ id: 'hood_plague', name: 'Máscara da Peste', slot: 'hood', rarity: 'rare', color: '#c8b890', school: { plague: 1 }, desc: (l) => `conta 1 carta de praga. o círculo envenena (${r1(0.25 * f(l))}/s)`, apply: (m, l) => (m.circleMiasma += 0.25 * f(l)) }),
  it({ id: 'hood_lich', name: 'Coroa do Lich', slot: 'hood', rarity: 'legendary', color: '#c9a23a', desc: (l) => `limite do exército +${Math.round(4 + l)}, mas os mortos apodrecem devagar`, apply: (m, l) => { m.armyCap += Math.round(4 + l); m.lichDecay = true; } }),
  // ------------------------------------------------ mantos
  it({ id: 'cloak_wool', name: 'Manto de Lã', slot: 'cloak', rarity: 'common', color: '#5a4a6b', desc: (l) => `necromante +${Math.round(3 * f(l))} vida`, apply: (m, l) => (m.necroMaxHp += Math.round(3 * f(l))) }),
  it({ id: 'cloak_flesh', name: 'Manto de Couro Humano', slot: 'cloak', rarity: 'magic', color: '#b5525e', school: { flesh: 1 }, desc: (l) => `conta 1 carta de carne. mortos +${pct(0.08 * f(l))} vida`, apply: (m, l) => (m.deadHpMul *= 1 + 0.08 * f(l)) }),
  it({ id: 'cloak_crimson', name: 'Manto Rubro', slot: 'cloak', rarity: 'rare', color: '#9e2236', school: { blood: 1 }, desc: (l) => `conta 1 carta de sangue. regenera 1 vida a cada ${r1(10 / f(l))}s`, apply: (m, l) => (m.necroRegen += f(l) / 10) }),
  it({ id: 'cloak_reaper', name: 'Manto do Ceifador', slot: 'cloak', rarity: 'legendary', color: '#2a2732', desc: (l) => `explodir tem ${pct(Math.min(0.75, 0.4 + 0.07 * l))} de chance de não gastar o morto`, apply: (m, l) => (m.explodeKeep = Math.min(0.75, 0.4 + 0.07 * l)) }),
  // ------------------------------------------------ amuletos
  it({ id: 'amulet_tooth', name: 'Colar de Dentes', slot: 'amulet', rarity: 'common', color: '#e3dccb', desc: (l) => `+${pct(0.1 * f(l))} almas`, apply: (m, l) => (m.soulMul += 0.1 * f(l)) }),
  it({ id: 'amulet_digger', name: 'Amuleto do Coveiro', slot: 'amulet', rarity: 'magic', color: '#8a6a22', desc: (l) => `cadáveres +${r1(2 * f(l))}s, levantar ${pct(0.1 * f(l))} mais rápido`, apply: (m, l) => { m.corpseLife += 2 * f(l); m.raiseTimeMul *= 1 - 0.1 * f(l); } }),
  it({ id: 'amulet_reliquary', name: 'Relicário Roubado', slot: 'amulet', rarity: 'rare', color: '#f6cf6a', desc: (l) => `+${1 + Math.floor(l / 2)} troca(s) de cartas por run`, apply: (m, l) => (m.rerolls += 1 + Math.floor(l / 2)) }),
  it({ id: 'amulet_hunger', name: 'Coração Faminto', slot: 'amulet', rarity: 'legendary', color: '#e0304a', desc: (l) => `consumir cura ${r1(2 * f(l))}x e sacrifica até +2`, apply: (m, l) => { m.consumeHealMul *= 2 * f(l); m.consumeMax += 2; } }),
  // ------------------------------------------------ anéis
  it({ id: 'ring_iron', name: 'Anel de Ferro', slot: 'ring', rarity: 'common', color: '#8a94a6', desc: (l) => `mortos +${pct(0.07 * f(l))} dano`, apply: (m, l) => (m.deadDmgMul *= 1 + 0.07 * f(l)) }),
  it({ id: 'ring_bone', name: 'Anel de Osso', slot: 'ring', rarity: 'magic', color: '#e3dccb', school: { bone: 1 }, desc: (l) => `conta 1 carta de ossos. colossos +${pct(0.1 * f(l))}`, apply: (m, l) => (m.giantMul *= 1 + 0.1 * f(l)) }),
  it({ id: 'ring_flesh', name: 'Anel de Carne', slot: 'ring', rarity: 'magic', color: '#b5525e', school: { flesh: 1 }, desc: (l) => `conta 1 carta de carne. cadáveres +${r1(0.5 * f(l))}s`, apply: (m, l) => (m.corpseLife += 0.5 * f(l)) }),
  it({ id: 'ring_plague', name: 'Anel da Praga', slot: 'ring', rarity: 'magic', color: '#8fbf3a', school: { plague: 1 }, desc: (l) => `conta 1 carta de praga. veneno dura +${pct(0.1 * f(l))}`, apply: (m, l) => (m.poisonDurMul *= 1 + 0.1 * f(l)) }),
  it({ id: 'ring_spirit', name: 'Anel Etéreo', slot: 'ring', rarity: 'magic', color: '#8fd3ff', school: { spirit: 1 }, desc: (l) => `conta 1 carta de espírito. raios ${pct(0.04 * f(l))} mais rápidos`, apply: (m, l) => (m.castCdMul *= 1 - 0.04 * f(l)) }),
  it({ id: 'ring_blood', name: 'Anel de Sangue', slot: 'ring', rarity: 'magic', color: '#e0304a', school: { blood: 1 }, desc: (l) => `conta 1 carta de sangue. +${Math.round(2 * f(l))} vida`, apply: (m, l) => (m.necroMaxHp += Math.round(2 * f(l))) }),
  it({ id: 'ring_abyss', name: 'Anel do Abismo', slot: 'ring', rarity: 'legendary', color: '#5a0f1d', desc: (l) => `mortos +${pct(0.25 * f(l))} dano, necromante -6 vida`, apply: (m, l) => { m.deadDmgMul *= 1 + 0.25 * f(l); m.necroMaxHp -= 6; } }),
];

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const ITEM_PRICE: Record<ItemRarity, number> = { common: 40, magic: 90, rare: 200, legendary: 450 };
export const upgradeCost = (item: Item, lvl: number) => Math.round(ITEM_PRICE[item.rarity] * 0.6 * (lvl + 1));

const RARITY_WEIGHT: Record<ItemRarity, number> = { common: 60, magic: 28, rare: 10, legendary: 2 };

/** Sorteia um item. `luck` (0..1) puxa para raridades maiores; `minRarity` corta as baixas. */
export function rollItem(rand: () => number, luck = 0, minRarity: ItemRarity = 'common'): string {
  const order: ItemRarity[] = ['common', 'magic', 'rare', 'legendary'];
  const min = order.indexOf(minRarity);
  const pool = ITEMS.filter((i) => order.indexOf(i.rarity) >= min);
  const w = pool.map((i) => RARITY_WEIGHT[i.rarity] * (1 + luck * order.indexOf(i.rarity)));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < pool.length; k++) {
    if (r < w[k]) return pool[k].id;
    r -= w[k];
  }
  return pool[pool.length - 1].id;
}
