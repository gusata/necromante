import { CHARACTER_BY_ID, CHARACTERS, type CharacterId } from './characters';
import { EQUIP_SLOTS, type EquipSlot, ITEM_BY_ID, ITEM_PRICE, MAX_ITEM_LEVEL, rollItem, SLOT_OF, upgradeCost } from './items';
import { baseMods, type Mods } from './mods';
import type { BossKind, School, UnitKind } from './types';

export const SAVE_VERSION = 3;
export const MARKET_SIZE = 4;
export const MARKET_REFRESH_COST = 25;

export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  /** 0..1 */
  shake: number;
}

export interface MetaState {
  version: number;
  /** almas guardadas para gastar no cemitério */
  souls: number;
  totalSouls: number;
  buildings: Record<string, number>;
  /** chefe -> rank do campeão (0 = não tem) */
  champions: Partial<Record<BossKind, number>>;
  selectedChampion: BossKind | null;
  kills: Partial<Record<UnitKind, number>>;
  /** maior região cujo chefe foi derrotado (0 = nenhum) */
  bossesBeaten: number;
  best: { wave: number; souls: number };
  runs: number;
  settings: Settings;
  /** item -> nível (0..5). Ter a chave = possuir o item. */
  items: Record<string, number>;
  equipped: Partial<Record<EquipSlot, string>>;
  /** itens à venda no Mercado do Coveiro */
  market: string[];
  character: CharacterId;
  characters: CharacterId[];
}

export function freshMeta(): MetaState {
  return {
    version: SAVE_VERSION,
    souls: 0,
    totalSouls: 0,
    buildings: {},
    champions: {},
    selectedChampion: null,
    kills: {},
    bossesBeaten: 0,
    best: { wave: 0, souls: 0 },
    runs: 0,
    settings: { sfx: true, music: true, haptics: true, shake: 1 },
    items: {},
    equipped: {},
    market: [],
    character: 'necro',
    characters: ['necro'],
  };
}

/** Converte saves antigos para o formato atual. */
export function migrate(raw: unknown): MetaState {
  const base = freshMeta();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<MetaState> & { wave?: number; souls?: number };
  // v1: só guardava { wave, souls } do recorde
  if (r.version === undefined) {
    base.best = { wave: r.wave ?? 0, souls: r.souls ?? 0 };
    return base;
  }
  return {
    ...base,
    ...r,
    version: SAVE_VERSION,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    best: { ...base.best, ...(r.best ?? {}) },
    buildings: { ...(r.buildings ?? {}) },
    champions: { ...(r.champions ?? {}) },
    kills: { ...(r.kills ?? {}) },
    items: { ...(r.items ?? {}) },
    equipped: { ...(r.equipped ?? {}) },
    market: [...(r.market ?? [])],
    characters: [...new Set<CharacterId>(['necro', ...(r.characters ?? [])])],
  };
}

export interface Building {
  id: string;
  name: string;
  desc: string;
  icon: string;
  costs: number[];
  apply: (m: Mods, level: number) => void;
  /** texto do efeito no nível atual */
  effect: (level: number) => string;
}

export const BUILDINGS: Building[] = [
  {
    id: 'crypts',
    name: 'Criptas',
    desc: 'Mais espaço para os mortos.',
    icon: 'b-crypt',
    costs: [25, 60, 120, 220, 360],
    apply: (m, l) => (m.armyCap += l),
    effect: (l) => `+${l} limite do exército`,
  },
  {
    id: 'ossuary',
    name: 'Ossuário',
    desc: 'Ossos mais duros, golpes mais fortes.',
    icon: 'b-ossuary',
    costs: [30, 70, 140, 250, 400],
    apply: (m, l) => {
      m.deadHpMul *= 1 + 0.1 * l;
      m.deadDmgMul *= 1 + 0.08 * l;
    },
    effect: (l) => `mortos +${l * 10}% vida, +${l * 8}% dano`,
  },
  {
    id: 'altar',
    name: 'Altar de Sangue',
    desc: 'O necromante resiste mais.',
    icon: 'b-altar',
    costs: [20, 50, 100, 180, 300],
    apply: (m, l) => (m.necroMaxHp += 4 * l),
    effect: (l) => `+${l * 4} vida do necromante`,
  },
  {
    id: 'library',
    name: 'Biblioteca Proibida',
    desc: 'Raios mais rápidos e mais fortes.',
    icon: 'b-library',
    costs: [40, 90, 180, 320, 500],
    apply: (m, l) => {
      m.castCdMul *= 1 - 0.06 * l;
      if (l >= 3) m.necroDmg += 1;
    },
    effect: (l) => `raios ${l * 6}% mais rápidos${l >= 3 ? ', +1 dano' : ''}`,
  },
  {
    id: 'bell',
    name: 'Torre do Sino',
    desc: 'Mais escolhas de cartas.',
    icon: 'b-bell',
    costs: [60, 150, 300],
    apply: (m, l) => {
      if (l >= 1) m.cardChoices += 1;
      m.rerolls += Math.max(0, l - 1);
    },
    effect: (l) => (l === 0 ? 'nada ainda' : l === 1 ? '4 cartas por escolha' : `4 cartas, ${l - 1} troca(s)`),
  },
  {
    id: 'gravedigger',
    name: 'Casa do Coveiro',
    desc: 'Começa com mais mortos.',
    icon: 'b-grave',
    costs: [35, 90, 200],
    apply: (m, l) => {
      m.startSkeletons += l;
      m.corpseLife += l;
    },
    effect: (l) => `+${l} esqueleto(s), cadáver +${l}s`,
  },
  {
    id: 'reliquary',
    name: 'Relicário',
    desc: 'Mais almas por run.',
    icon: 'b-reliquary',
    costs: [50, 120, 240, 400, 600],
    apply: (m, l) => (m.soulMul += 0.1 * l),
    effect: (l) => `+${l * 10}% almas`,
  },
  {
    id: 'hall',
    name: 'Salão dos Campeões',
    desc: 'Leve um chefe derrotado para a batalha.',
    icon: 'b-hall',
    costs: [80, 200, 400],
    apply: (m, l) => (m.championMul *= 1 + 0.2 * Math.max(0, l - 1)),
    effect: (l) => (l === 0 ? 'sem campeões' : `campeão liberado${l > 1 ? `, +${(l - 1) * 20}% força` : ''}`),
  },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<string, Building>;

export const buildingLevel = (meta: MetaState, id: string) => meta.buildings[id] ?? 0;
export const nextCost = (meta: MetaState, b: Building): number | null => b.costs[buildingLevel(meta, b.id)] ?? null;

export function buy(meta: MetaState, id: string): boolean {
  const b = BUILDING_BY_ID[id];
  const cost = nextCost(meta, b);
  if (cost === null || meta.souls < cost) return false;
  meta.souls -= cost;
  meta.buildings[id] = buildingLevel(meta, id) + 1;
  return true;
}

/** Escolas liberadas: Ossos e Carne no início, uma nova a cada chefe derrotado, mais as do personagem. */
export function unlockedSchools(meta: MetaState): School[] {
  const order: School[] = ['bone', 'flesh', 'plague', 'spirit', 'blood'];
  const own = CHARACTER_BY_ID[meta.character]?.schools ?? [];
  return order.filter((s, i) => i < 2 + meta.bossesBeaten || own.includes(s));
}

/** Construções + itens equipados + personagem. */
export function metaMods(meta: MetaState): Mods {
  const m = baseMods();
  for (const b of BUILDINGS) {
    const l = buildingLevel(meta, b.id);
    if (l > 0) b.apply(m, l);
  }
  for (const id of equippedItems(meta)) ITEM_BY_ID[id].apply(m, meta.items[id] ?? 0);
  CHARACTER_BY_ID[meta.character]?.apply(m);
  m.armyCap = Math.max(4, m.armyCap);
  m.necroMaxHp = Math.max(6, m.necroMaxHp);
  return m;
}

/** Cartas "de graça" por escola, vindas de itens e do personagem. */
export function schoolBonus(meta: MetaState): Partial<Record<School, number>> {
  const out: Partial<Record<School, number>> = {};
  const add = (b?: Partial<Record<School, number>>) => {
    for (const [s, v] of Object.entries(b ?? {})) out[s as School] = (out[s as School] ?? 0) + (v ?? 0);
  };
  for (const id of equippedItems(meta)) add(ITEM_BY_ID[id].school);
  add(CHARACTER_BY_ID[meta.character]?.school);
  return out;
}

// ------------------------------------------------------------ itens

export function equippedItems(meta: MetaState): string[] {
  return EQUIP_SLOTS.map((s) => meta.equipped[s]).filter((id): id is string => !!id && id in meta.items && !!ITEM_BY_ID[id]);
}

/** Ganha um item: se já tiver, sobe um nível (fundir cópias). Devolve o nível final. */
export function gainItem(meta: MetaState, id: string): number {
  if (id in meta.items) meta.items[id] = Math.min(MAX_ITEM_LEVEL, meta.items[id] + 1);
  else {
    meta.items[id] = 0;
    // equipa sozinho se o espaço estiver vazio
    const slot = EQUIP_SLOTS.find((s) => SLOT_OF[s] === ITEM_BY_ID[id].slot && !meta.equipped[s]);
    if (slot) meta.equipped[slot] = id;
  }
  return meta.items[id];
}

export function equip(meta: MetaState, id: string, slot?: EquipSlot): boolean {
  const item = ITEM_BY_ID[id];
  if (!item || !(id in meta.items)) return false;
  const slots = EQUIP_SLOTS.filter((s) => SLOT_OF[s] === item.slot);
  for (const s of slots) if (meta.equipped[s] === id) delete meta.equipped[s];
  const target = slot ?? slots.find((s) => !meta.equipped[s]) ?? slots[0];
  if (SLOT_OF[target] !== item.slot) return false;
  meta.equipped[target] = id;
  return true;
}

export function unequip(meta: MetaState, slot: EquipSlot) {
  delete meta.equipped[slot];
}

export function forge(meta: MetaState, id: string): boolean {
  const lvl = meta.items[id];
  if (lvl === undefined || lvl >= MAX_ITEM_LEVEL) return false;
  const cost = upgradeCost(ITEM_BY_ID[id], lvl);
  if (meta.souls < cost) return false;
  meta.souls -= cost;
  meta.items[id] = lvl + 1;
  return true;
}

export function marketPrice(meta: MetaState, id: string): number {
  const item = ITEM_BY_ID[id];
  return id in meta.items ? upgradeCost(item, meta.items[id]) : ITEM_PRICE[item.rarity];
}

export function rollMarket(meta: MetaState, rand: () => number = Math.random) {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < MARKET_SIZE && guard++ < 100) {
    const id = rollItem(rand, Math.min(1, meta.bossesBeaten * 0.25));
    if ((meta.items[id] ?? -1) < MAX_ITEM_LEVEL) out.add(id);
  }
  meta.market = [...out];
}

export function buyFromMarket(meta: MetaState, id: string): boolean {
  if (!meta.market.includes(id)) return false;
  const price = marketPrice(meta, id);
  if (meta.souls < price || (meta.items[id] ?? -1) >= MAX_ITEM_LEVEL) return false;
  meta.souls -= price;
  gainItem(meta, id);
  meta.market = meta.market.filter((m) => m !== id);
  return true;
}

export function refreshMarket(meta: MetaState): boolean {
  if (meta.souls < MARKET_REFRESH_COST) return false;
  meta.souls -= MARKET_REFRESH_COST;
  rollMarket(meta);
  return true;
}

// ------------------------------------------------------------ personagens

export function characterState(meta: MetaState, id: CharacterId): 'owned' | 'buyable' | 'locked' {
  if (meta.characters.includes(id)) return 'owned';
  return CHARACTER_BY_ID[id].unlock.check(meta) ? 'buyable' : 'locked';
}

export function buyCharacter(meta: MetaState, id: CharacterId): boolean {
  const c = CHARACTER_BY_ID[id];
  if (characterState(meta, id) !== 'buyable' || meta.souls < c.price) return false;
  meta.souls -= c.price;
  meta.characters.push(id);
  return true;
}

export const ALL_CHARACTERS = CHARACTERS;

export const MEDALS = [10, 50, 150] as const;
export const medal = (kills: number): 0 | 1 | 2 | 3 => (kills >= MEDALS[2] ? 3 : kills >= MEDALS[1] ? 2 : kills >= MEDALS[0] ? 1 : 0);
