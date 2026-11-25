import { CHARACTER_BY_ID, CHARACTERS, type CharacterId } from './characters';
import { applyGems, BASE_SOCKETS, mergeGems } from './gems';
import {
  EQUIP_SLOTS,
  type EquipSlot,
  effectiveLevel,
  HOARD_COMPLETE,
  HOARD_ITEMS,
  ITEM_BY_ID,
  ITEM_PRICE,
  MAX_ITEM_LEVEL,
  MAX_SLOT_LEVEL,
  rollItem,
  SET_BY_ID,
  SLOT_FORGE_COST,
  SLOT_OF,
  upgradeCost,
} from './items';
import { baseMods, type Mods } from './mods';
import type { HistoryEntry, LifetimeStats } from './progress';
import { applyTree, extraMarket, extraSlotLevel, extraSockets, forgeDiscount, refreshDiscount } from './tree';
import type { BossKind, School, UnitKind } from './types';

export const SAVE_VERSION = 5;
export const MARKET_SIZE = 4;
export const MARKET_REFRESH_COST = 250;

export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  /** 0..1 */
  shake: number;
  /** velocidade do jogo na run (1 ou 2) */
  speed: number;
  /** mira: arrastar (relativo) ou tocar direto onde o círculo deve ir */
  aim: 'drag' | 'direct';
  /** envia estatísticas anônimas de jogo (teste e equilíbrio) */
  telemetry: boolean;
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
  /** passos do tutorial já mostrados */
  tutorial: string[];
  /** heresia escolhida para a próxima run */
  heresy: number;
  /** maior heresia liberada (0 = ainda não venceu a Catedral) */
  heresyMax: number;
  /** checkpoint escolhido: região onde a próxima run começa */
  startRegion: number;
  history: HistoryEntry[];
  stats: LifetimeStats;
  achievements: string[];
  /** escolas que já chegaram ao domínio em alguma run */
  dominions: School[];
  daily: { date: string; best: number; tries: number };
  /** nível da forja de cada espaço (vale para qualquer item ali) */
  slots: Partial<Record<EquipSlot, number>>;
  /** gemas guardadas (chave tipo+nível -> quantidade), fora do altar */
  gems: Record<string, number>;
  /** encaixes do altar */
  sockets: (string | null)[];
  /** árvore da necrópole: nó -> nível */
  tree: Record<string, number>;
}

const freshStats = (): LifetimeStats => ({ kills: 0, raised: 0, exploded: 0, rituals: 0, bossKills: 0, victories: 0, time: 0, bestKills: 0, bestArmy: 0 });

export const TUTORIAL_STEPS = ['drag', 'explode', 'consume', 'fuse'] as const;

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
    settings: { sfx: true, music: true, haptics: true, shake: 1, speed: 1, aim: 'drag', telemetry: true },
    items: {},
    equipped: {},
    market: [],
    character: 'necro',
    characters: ['necro'],
    tutorial: [],
    heresy: 0,
    heresyMax: 0,
    startRegion: 0,
    history: [],
    stats: freshStats(),
    achievements: [],
    dominions: [],
    daily: { date: '', best: 0, tries: 0 },
    slots: {},
    gems: {},
    sockets: Array.from({ length: BASE_SOCKETS }, () => null),
    tree: {},
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
  // v5: a economia de almas foi multiplicada por 10 (números maiores, mesmo equilíbrio)
  if (r.version < 5) {
    r.souls = (r.souls ?? 0) * 10;
    r.totalSouls = (r.totalSouls ?? 0) * 10;
    if (r.best) r.best = { ...r.best, souls: (r.best.souls ?? 0) * 10 };
    if (r.history) r.history = r.history.map((h) => ({ ...h, souls: h.souls * 10 }));
    // as construções deram lugar à árvore: devolve 100% das almas gastas (já em x10)
    let refund = 0;
    for (const b of BUILDINGS) for (let i = 0; i < (r.buildings?.[b.id] ?? 0); i++) refund += b.costs[i] ?? 0;
    r.souls += refund;
    // quem já tinha o salão continua com o campeão liberado
    if ((r.buildings?.hall ?? 0) > 0) r.tree = { ...(r.tree ?? {}), salao: 1 };
    r.buildings = {};
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
    history: [...(r.history ?? [])],
    stats: { ...freshStats(), ...(r.stats ?? {}) },
    achievements: [...(r.achievements ?? [])],
    dominions: [...(r.dominions ?? [])],
    daily: { ...base.daily, ...(r.daily ?? {}) },
    slots: { ...(r.slots ?? {}) },
    gems: { ...(r.gems ?? {}) },
    sockets: r.sockets ? [...r.sockets] : base.sockets,
    tree: { ...(r.tree ?? {}) },
    // quem já jogava antes do tutorial existir não precisa dele
    tutorial: r.tutorial ? [...r.tutorial] : (r.runs ?? 0) > 0 ? [...TUTORIAL_STEPS] : [],
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
    costs: [250, 600, 1200, 2200, 3600],
    apply: (m, l) => (m.armyCap += 4 * l),
    effect: (l) => `+${4 * l} limite do exército`,
  },
  {
    id: 'ossuary',
    name: 'Ossuário',
    desc: 'Ossos mais duros, golpes mais fortes.',
    icon: 'b-ossuary',
    costs: [300, 700, 1400, 2500, 4000],
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
    costs: [200, 500, 1000, 1800, 3000],
    apply: (m, l) => (m.necroMaxHp += 4 * l),
    effect: (l) => `+${l * 40} vida do necromante`,
  },
  {
    id: 'library',
    name: 'Biblioteca Proibida',
    desc: 'Raios mais rápidos e mais fortes.',
    icon: 'b-library',
    costs: [400, 900, 1800, 3200, 5000],
    apply: (m, l) => {
      m.castCdMul *= 1 - 0.06 * l;
      if (l >= 3) m.necroDmg += 1;
    },
    effect: (l) => `raios ${l * 6}% mais rápidos${l >= 3 ? ', +10 dano' : ''}`,
  },
  {
    id: 'bell',
    name: 'Torre do Sino',
    desc: 'Mais escolhas de cartas (removida: só serve para devolver as almas).',
    icon: 'b-bell',
    costs: [600, 1500, 3000],
    apply: () => {},
    effect: () => '',
  },
  {
    id: 'gravedigger',
    name: 'Casa do Coveiro',
    desc: 'Começa com mais mortos.',
    icon: 'b-grave',
    costs: [350, 900, 2000],
    apply: (m, l) => {
      m.startSkeletons += 3 * l;
      m.corpseLife += l;
    },
    effect: (l) => `+${3 * l} esqueletos, cadáver +${l}s`,
  },
  {
    id: 'reliquary',
    name: 'Relicário',
    desc: 'Mais almas por run.',
    icon: 'b-reliquary',
    costs: [500, 1200, 2400, 4000, 6000],
    apply: (m, l) => (m.soulMul += 0.1 * l),
    effect: (l) => `+${l * 10}% almas`,
  },
  {
    id: 'hall',
    name: 'Salão dos Campeões',
    desc: 'Leve um chefe derrotado para a batalha.',
    icon: 'b-hall',
    costs: [800, 2000, 4000],
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
/** Checkpoint: maior região onde dá para começar (a do último chefe vencido em sequência). */
export const maxStartRegion = (meta: MetaState) => Math.min(3, meta.bossesBeaten);

export function unlockedSchools(meta: MetaState): School[] {
  const order: School[] = ['bone', 'flesh', 'plague', 'spirit', 'blood'];
  const own = CHARACTER_BY_ID[meta.character]?.schools ?? [];
  return order.filter((s, i) => i < 2 + meta.bossesBeaten || own.includes(s));
}

/** Construções + itens equipados + personagem. */
export function metaMods(meta: MetaState): Mods {
  const m = baseMods();
  applyTree(m, meta);
  // itens equipados: nível do item + nível da forja do espaço
  const setPieces: Record<string, number> = {};
  for (const slot of EQUIP_SLOTS) {
    const id = meta.equipped[slot];
    if (!id || !(id in meta.items) || !ITEM_BY_ID[id]) continue;
    const it = ITEM_BY_ID[id];
    it.apply(m, effectiveLevel(meta.items[id] ?? 0, meta.slots[slot] ?? 0));
    if (it.set) setPieces[it.set] = (setPieces[it.set] ?? 0) + 1;
  }
  for (const [set, n] of Object.entries(setPieces)) SET_BY_ID[set]?.apply(m, n);
  // tesouro: lendários e conjuntos dão bônus permanente, equipados ou não
  const hoard = HOARD_ITEMS();
  for (const it of hoard) if (it.id in meta.items) it.hoard?.apply(m, meta.items[it.id]);
  if (hoard.every((it) => it.id in meta.items)) HOARD_COMPLETE.apply(m);
  applyGems(m, meta.sockets);
  CHARACTER_BY_ID[meta.character]?.apply(m);
  m.armyCap = Math.max(15, m.armyCap);
  m.necroMaxHp = Math.max(6, m.necroMaxHp);
  return m;
}

/** Contagem de cada escola: itens equipados (conjuntos contam duas) e o personagem. */
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

/** Custo para forjar o espaço (null = no máximo). */
export function slotForgeCost(meta: MetaState, slot: EquipSlot): number | null {
  const lvl = meta.slots[slot] ?? 0;
  if (lvl >= maxSlotLevel(meta)) return null;
  // nível extra da Bigorna custa 50% a mais que o último
  const base = SLOT_FORGE_COST[lvl] ?? SLOT_FORGE_COST[SLOT_FORGE_COST.length - 1] * 1.5;
  return Math.round((base * (1 - forgeDiscount(meta))) / 10) * 10;
}

export const maxSlotLevel = (meta: MetaState) => MAX_SLOT_LEVEL + extraSlotLevel(meta);

/** Forja o espaço: o bônus fica no espaço e vale para qualquer item equipado ali. */
export function forgeSlot(meta: MetaState, slot: EquipSlot): boolean {
  const lvl = meta.slots[slot] ?? 0;
  const cost = slotForgeCost(meta, slot);
  if (cost === null || meta.souls < cost) return false;
  meta.souls -= cost;
  meta.slots[slot] = lvl + 1;
  return true;
}

/** O altar tem 3 encaixes mais os da árvore (Encaixe). */
export function syncSockets(meta: MetaState) {
  const want = BASE_SOCKETS + extraSockets(meta);
  while (meta.sockets.length < want) meta.sockets.push(null);
}

/** Espaço onde o item está equipado. */
export const slotOfItem = (meta: MetaState, id: string): EquipSlot | undefined => EQUIP_SLOTS.find((s) => meta.equipped[s] === id);

// ------------------------------------------------------------ gemas

/** Põe uma gema da bolsa num encaixe (o primeiro vazio, se não disser qual). A que estava lá volta para a bolsa. */
export function socketGem(meta: MetaState, key: string, index?: number): boolean {
  if (!meta.gems[key]) return false;
  const i = index ?? meta.sockets.indexOf(null);
  if (i < 0 || i >= meta.sockets.length) return false;
  const old = meta.sockets[i];
  if (old) meta.gems[old] = (meta.gems[old] ?? 0) + 1;
  meta.gems[key]--;
  if (!meta.gems[key]) delete meta.gems[key];
  meta.sockets[i] = key;
  return true;
}

export function unsocketGem(meta: MetaState, index: number): boolean {
  const key = meta.sockets[index];
  if (!key) return false;
  meta.sockets[index] = null;
  meta.gems[key] = (meta.gems[key] ?? 0) + 1;
  return true;
}

export const mergeAllGems = (meta: MetaState) => mergeGems(meta.gems);

export function gainGem(meta: MetaState, key: string) {
  meta.gems[key] = (meta.gems[key] ?? 0) + 1;
}

export function marketPrice(meta: MetaState, id: string): number {
  const item = ITEM_BY_ID[id];
  return id in meta.items ? upgradeCost(item, meta.items[id]) : ITEM_PRICE[item.rarity];
}

export function rollMarket(meta: MetaState, rand: () => number = Math.random) {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < MARKET_SIZE + extraMarket(meta) && guard++ < 100) {
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

export const refreshCost = (meta: MetaState) => Math.round(MARKET_REFRESH_COST * (1 - refreshDiscount(meta)));

export function refreshMarket(meta: MetaState): boolean {
  const cost = refreshCost(meta);
  if (meta.souls < cost) return false;
  meta.souls -= cost;
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
