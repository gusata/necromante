import { SCHOOL_ORDER } from './cards';
import { BOSS_DEFS, UNIT_DEFS } from './defs';
import { MAX_HERESY } from './heresy';
import { ITEM_BY_ID } from './items';
import { gainGem, gainItem, type MetaState, rollMarket } from './meta';
import { ENDLESS_MODS, REGIONS } from './regions';
import { RNG } from './rng';
import type { BossKind, School, UnitKind } from './types';
import type { RunStats } from './world';

/** Tudo o que a meta-progressão precisa saber de uma run que terminou. */
export interface RunResult {
  wave: number;
  where: string;
  souls: number;
  kills: number;
  killsByKind: Partial<Record<UnitKind, number>>;
  bossesKilled: BossKind[];
  loot: string[];
  /** gemas ganhas na run */
  gems?: string[];
  cards: number;
  schoolCounts: Record<School, number>;
  character: string;
  heresy: number;
  daily: string | null;
  quit: boolean;
  time: number;
  stats: RunStats;
}

export interface HistoryEntry {
  at: number;
  char: string;
  wave: number;
  where: string;
  kills: number;
  souls: number;
  school: School | null;
  heresy: number;
  daily: boolean;
  quit: boolean;
  time: number;
  mvp: string | null;
}

export interface LifetimeStats {
  kills: number;
  raised: number;
  exploded: number;
  rituals: number;
  bossKills: number;
  victories: number;
  time: number;
  bestKills: number;
  bestArmy: number;
}

export const HISTORY_SIZE = 20;

// ------------------------------------------------------------ conquistas

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  reward: number;
  check: (m: MetaState, r: RunResult) => boolean;
}

const beat = (r: RunResult, b: BossKind) => r.bossesKilled.includes(b);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'Primeiro Sangue', desc: 'vença a primeira onda', reward: 200, check: (_, r) => r.wave >= 2 },
  { id: 'woodcutter', name: 'Machado no Chão', desc: 'derrote o lenhador', reward: 400, check: (_, r) => beat(r, 'woodcutter') },
  { id: 'abbot', name: 'Silêncio Eterno', desc: 'derrote o abade', reward: 600, check: (_, r) => beat(r, 'abbot') },
  { id: 'commander', name: 'Muralhas Caídas', desc: 'derrote o comandante', reward: 800, check: (_, r) => beat(r, 'commander') },
  { id: 'cathedral', name: 'Fim da Luz', desc: 'derrote o arcebispo', reward: 1500, check: (_, r) => beat(r, 'archbishop') },
  { id: 'abyss', name: 'Olhar o Abismo', desc: 'chegue ao abismo', reward: 1000, check: (_, r) => r.wave > REGIONS.length * 6 },
  { id: 'seraph', name: 'Asas Partidas', desc: 'derrote o chefe secreto', reward: 3000, check: (_, r) => beat(r, 'seraph') },
  { id: 'army', name: 'Maré de Ossos', desc: 'tenha 40 mortos ao mesmo tempo', reward: 800, check: (_, r) => r.stats.maxArmy >= 40 },
  { id: 'army100', name: 'Legião', desc: 'tenha 100 mortos ao mesmo tempo', reward: 2000, check: (_, r) => r.stats.maxArmy >= 100 },
  { id: 'kills500', name: 'Ceifeiro', desc: '500 abates numa run', reward: 600, check: (_, r) => r.kills >= 500 },
  { id: 'kills2000', name: 'Massacre', desc: '2.000 abates numa run', reward: 1500, check: (_, r) => r.kills >= 2000 },
  { id: 'kills20k', name: 'Praga Ambulante', desc: '20.000 abates no total', reward: 2000, check: (m) => m.stats.kills >= 20000 },
  { id: 'boom', name: 'Fogos de Artifício', desc: 'exploda 20 mortos de uma vez', reward: 600, check: (_, r) => r.stats.bigExplode >= 20 },
  { id: 'rituals', name: 'Sacerdote das Trevas', desc: 'use o ritual 10 vezes numa run', reward: 800, check: (_, r) => r.stats.rituals >= 10 },
  { id: 'dominion', name: 'Domínio', desc: 'chegue ao domínio de uma escola', reward: 500, check: (_, r) => SCHOOL_ORDER.some((s) => r.schoolCounts[s] >= 5) },
  { id: 'five', name: 'Mestre das Cinco', desc: 'domínio nas 5 escolas, em qualquer run', reward: 3000, check: (m) => m.dominions.length >= 5 },
  { id: 'heresy5', name: 'Herege', desc: 'vença a catedral na heresia 5', reward: 2000, check: (_, r) => r.heresy >= 5 && beat(r, 'archbishop') },
  { id: 'heresy10', name: 'Juízo Final', desc: 'vença a catedral na heresia 10', reward: 5000, check: (_, r) => r.heresy >= 10 && beat(r, 'archbishop') },
  {
    id: 'legend',
    name: 'Lendário',
    desc: 'consiga um item lendário',
    reward: 800,
    check: (m) => Object.keys(m.items).some((id) => ITEM_BY_ID[id]?.rarity === 'legendary'),
  },
  { id: 'daily', name: 'Rotina Macabra', desc: 'chegue à onda 6 num desafio diário', reward: 600, check: (_, r) => !!r.daily && r.wave >= 6 },
];

// ------------------------------------------------------------ desafio diário

export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Seed e modificadores do dia: iguais para todo mundo. */
export function dailySetup(key: string): { seed: number; endless: string[] } {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const seed = h >>> 0;
  const rng = new RNG(seed);
  const pool = ENDLESS_MODS.map((e) => e.id);
  const endless: string[] = [];
  while (endless.length < 2) endless.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return { seed, endless };
}

// ------------------------------------------------------------ aplicar o resultado

export interface RunSummary {
  earned: number;
  bonus: number;
  record: boolean;
  champions: string[];
  loot: string[];
  newSchool: boolean;
  heresyUnlocked: number | null;
  achievements: Achievement[];
  dailyBest: boolean;
  mvp: string | null;
}

export function mvpOf(r: RunResult): UnitKind | null {
  let best: UnitKind | null = null;
  for (const [k, n] of Object.entries(r.stats.deadKills) as [UnitKind, number][]) if (!best || n > (r.stats.deadKills[best] ?? 0)) best = k;
  return best;
}

/** Aplica o resultado da run na meta-progressão. Não salva: quem chama decide. */
export function applyRunResult(meta: MetaState, r: RunResult): RunSummary {
  let earned = Math.floor(r.souls);
  const record = r.wave > meta.best.wave && !r.daily;
  meta.runs++;
  for (const [k, n] of Object.entries(r.killsByKind)) {
    const key = k as UnitKind;
    meta.kills[key] = (meta.kills[key] ?? 0) + (n ?? 0);
  }
  const champions: string[] = [];
  for (const b of r.bossesKilled) {
    const rank = Math.min(5, (meta.champions[b] ?? 0) + 1);
    meta.champions[b] = rank;
    if (!meta.selectedChampion) meta.selectedChampion = b;
    meta.kills[b] = (meta.kills[b] ?? 0) + 1;
    champions.push(`${BOSS_DEFS[b].name.toLowerCase()} rank ${rank}`);
  }
  const loot: string[] = [];
  for (const id of r.loot) {
    const lvl = gainItem(meta, id);
    loot.push(`${ITEM_BY_ID[id].name.toLowerCase()}${lvl > 0 ? ` (nível ${lvl})` : ''}`);
  }
  for (const g of r.gems ?? []) gainGem(meta, g);
  rollMarket(meta);
  const before = meta.bossesBeaten;
  const mainBosses = r.bossesKilled.filter((b) => b !== 'seraph').length;
  meta.bossesBeaten = Math.max(before, Math.min(4, mainBosses));
  if (record) meta.best = { wave: r.wave, souls: earned };

  // heresia: vencer a catedral libera o próximo nível
  let heresyUnlocked: number | null = null;
  if (r.bossesKilled.includes('archbishop') && !r.daily) {
    const next = Math.min(MAX_HERESY, r.heresy + 1);
    if (next > meta.heresyMax) {
      meta.heresyMax = next;
      heresyUnlocked = next;
    }
  }

  // escolas dominadas (para a conquista das cinco)
  for (const s of SCHOOL_ORDER) if (r.schoolCounts[s] >= 5 && !meta.dominions.includes(s)) meta.dominions.push(s);

  // estatísticas da vida toda
  const st = meta.stats;
  st.kills += r.kills;
  st.raised += r.stats.raised;
  st.exploded += r.stats.exploded;
  st.rituals += r.stats.rituals;
  st.bossKills += r.bossesKilled.length;
  if (r.bossesKilled.includes('archbishop')) st.victories++;
  st.time += r.time;
  st.bestKills = Math.max(st.bestKills, r.kills);
  st.bestArmy = Math.max(st.bestArmy, r.stats.maxArmy);

  // desafio diário: bônus na primeira tentativa do dia
  let bonus = 0;
  let dailyBest = false;
  if (r.daily) {
    if (meta.daily.date !== r.daily) meta.daily = { date: r.daily, best: 0, tries: 0 };
    if (meta.daily.tries === 0) bonus += r.wave * 30;
    meta.daily.tries++;
    if (r.wave > meta.daily.best) {
      meta.daily.best = r.wave;
      dailyBest = true;
    }
  }

  // histórico
  const top = SCHOOL_ORDER.reduce<School | null>((a, s) => (r.schoolCounts[s] > 0 && (!a || r.schoolCounts[s] > r.schoolCounts[a]) ? s : a), null);
  const mvp = mvpOf(r);
  meta.history.unshift({
    at: Date.now(),
    char: r.character,
    wave: r.wave,
    where: r.where,
    kills: r.kills,
    souls: earned,
    school: top,
    heresy: r.heresy,
    daily: !!r.daily,
    quit: r.quit,
    time: Math.round(r.time),
    mvp: mvp ? UNIT_DEFS[mvp].name : null,
  });
  meta.history.length = Math.min(meta.history.length, HISTORY_SIZE);

  // conquistas
  const achievements: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (meta.achievements.includes(a.id) || !a.check(meta, r)) continue;
    meta.achievements.push(a.id);
    achievements.push(a);
    bonus += a.reward;
  }

  earned += bonus;
  meta.souls += earned;
  meta.totalSouls += earned;
  return {
    earned,
    bonus,
    record,
    champions,
    loot,
    newSchool: meta.bossesBeaten > before && before < 3,
    heresyUnlocked,
    achievements,
    dailyBest,
    mvp: mvp ? UNIT_DEFS[mvp].name : null,
  };
}
