import { computeMods, DOMINION_AT, MASTERY_AT, SCHOOL_ORDER, schoolCounts } from './cards';
import {
  AGGRO_DEAD,
  BODY_MID,
  AGGRO_LIVING,
  DEAD_SPEED_MUL,
  ELITE_MUL,
  HORDE_BUDGET,
  LIVING_SPEED_MUL,
  SIZE_SCALE,
  SOULS_PER_THREAT,
  BOSS_DEFS,
  CHAMPION_ABILITY,
  championStats,
  CIRCLE_REACH,
  CLOUD_R,
  CLOUD_TIME,
  CONSUME_HEAL,
  EXPLODE_DMG,
  FIELD,
  FORMATION_R,
  INTERMISSION,
  NECRO,
  POISON_DPS,
  POISON_TIME,
  RAISE_PAD,
  RAISE_TIME,
  UNIT_DEFS,
  WAVES_PER_REGION,
  waveHpMul,
} from './defs';
import { combineFx, EVENT_BY_ID, EVENTS, neutralFx, ROUTE_BY_ID, ROUTES, routeFx, type WaveFx } from './events';
import { applyHeresy, type HeresyEffects, heresyEffects } from './heresy';
import { rollGem } from './gems';
import { cloneMods, type Mods } from './mods';
import { type ItemRarity, RELIC_BOSS_CHANCE, RELIC_ELITE_CHANCE, rollItem, rollRelic } from './items';
import { ENDLESS_MODS, REGIONS } from './regions';
import { RNG } from './rng';
import { FactionGrids } from './spatial';
import type {
  Ability,
  AbilityId,
  BossKind,
  Cloud,
  Corpse,
  DamageType,
  DeadKind,
  Faction,
  GameEvent,
  LivingKind,
  Projectile,
  School,
  Telegraph,
  Trait,
  Unit,
  UnitKind,
} from './types';

export type Phase = 'intermission' | 'spawning' | 'fighting' | 'event' | 'over';

/** Registro da run para a telemetria. Dano no necromante em unidades da simulação (a tela mostra x10). */
export interface RunLog {
  waves: { w: number; t: number; hp: number; army: number; size: number; hurt: Record<string, number> }[];
  hurt: Record<string, number>;
  hurtWave: Record<string, number>;
  actions: { explode: number; fuse: number; consume: number; ritual: number };
  events: string[];
  waveStart: number;
}

/** força que cada chefe vencido dá aos mortos (vida e dano) e vida ao necromante */
export const BOSS_POWER = 0.3;
function grow(m: Mods, power: number): Mods {
  m.deadDmgMul *= 1 + BOSS_POWER * power;
  m.deadHpMul *= 1 + BOSS_POWER * power;
  m.necroMaxHp += 3 * power;
  return m;
}

/** peso de cada lado na hora de se empurrar */
const MASS: Record<string, number> = { living: 1.5, dead: 1 };
/** multiplicador de peso de quem está no meio da luta */
const ENGAGED_MASS = 3;

/** Campos que não entram no save: derivados, recriados ou caches. */
const NOT_SAVED = new Set([
  'rng',
  'setup',
  'base',
  'mods',
  'grids',
  'byId',
  'altarThreat',
  'backlineCache',
  'chargeHits',
  'ringers',
  'paladins',
  'bishops',
  'events',
  'hx',
]);

export interface RunSnapshot {
  v: 1;
  setup: RunSetup;
  rng: number;
  state: Record<string, unknown>;
}

export interface RunSetup {
  seed: number;
  /** modificadores vindos da meta-progressão */
  mods: Mods;
  schools: School[];
  champion?: { boss: BossKind; rank: number } | null;
  /** contagem por escola (itens e personagem) */
  schoolBonus?: Partial<Record<School, number>>;
  /** nível de heresia (dificuldade) */
  heresy?: number;
  /** modificadores do abismo ativos desde a onda 1 (desafio diário) */
  endless?: string[];
  /** personagem (define o ritual) */
  character?: string;
  /** checkpoint: região onde a run começa (0 = Vila) */
  startRegion?: number;
}

/** compensação por região pulada no checkpoint */
export const CHECKPOINT_SKELETONS = 18;

export interface PendingEvent {
  id: string;
  /** rotas oferecidas (só na encruzilhada) */
  choices: string[];
}

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

function distToSegment2(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return dist2(px, py, x1 + dx * t, y1 + dy * t);
}

const has = (u: Unit, t: Trait) => UNIT_DEFS[u.kind].traits?.includes(t) ?? false;
const schoolOf = (k: UnitKind | undefined) => (k ? UNIT_DEFS[k].school : undefined);

const SUMMONS: Record<BossKind, LivingKind[]> = {
  woodcutter: ['peasant', 'peasant', 'hound'],
  abbot: ['monk', 'monk', 'priest'],
  commander: ['soldier', 'shield', 'crossbow'],
  archbishop: ['paladin', 'templar'],
  seraph: ['templar', 'paladin', 'inquisitor'],
};
/** chefes chamam reforços em dobro na horda */
const SUMMON_REPEAT = 2;
/** no máximo tantas nuvens de veneno ao mesmo tempo */
const MAX_CLOUDS = 40;

/** de quanto em quanto tempo cada unidade procura um alvo novo */
const RETARGET = 0.2;

/** Abates necessários para carregar o ritual. */
export const RITUAL_KILLS = 110;

export interface RunStats {
  raised: number;
  exploded: number;
  consumed: number;
  fused: number;
  maxArmy: number;
  /** maior número de mortos explodidos de uma vez */
  bigExplode: number;
  rituals: number;
  /** abates por tipo de morto (o MVP da run) */
  deadKills: Partial<Record<UnitKind, number>>;
}

/**
 * Estado completo de uma run. Não conhece o Phaser: a cena lê o estado
 * e consome `events` para desenhar efeitos.
 */
export class World {
  readonly rng: RNG;
  readonly setup: RunSetup;
  time = 0;
  private nextId = 1;

  units: Unit[] = [];
  corpses: Corpse[] = [];
  projectiles: Projectile[] = [];
  telegraphs: Telegraph[] = [];
  clouds: Cloud[] = [];

  base: Mods;
  mods: Mods;
  /** efeitos de evento que duram a run (cicatriz, cripta aberta) */
  boons: string[] = [];
  /** chefes absorvidos: cada um deixa os mortos mais fortes até o fim da run */
  power = 0;
  /** registro para a telemetria (vai no resumo da run) */
  log: RunLog = { waves: [], hurt: {}, hurtWave: {}, actions: { explode: 0, fuse: 0, consume: 0, ritual: 0 }, events: [], waveStart: 0 };

  necro: { x: number; y: number; hp: number; maxHp: number; castTimer: number; radius: number; regenAcc: number };
  circle: { x: number; y: number; r: number };

  wave = 0;
  phase: Phase = 'intermission';
  phaseTimer = 1.2;
  spawnQueue: UnitKind[] = [];
  spawnTimer = 0;
  /** tamanho total da onda (para o HUD) */
  waveSize = 0;
  endless: string[] = [];
  bossId: number | null = null;

  /** evento esperando escolha */
  event: PendingEvent | null = null;
  eventsSeen: string[] = [];
  private eventDone = false;
  /** já usou o Imortal nesta run */
  revived = false;
  /** rota escolhida na última encruzilhada (vale para a região) */
  route: string | null = null;
  /** efeitos guardados para a próxima onda */
  nextWave: WaveFx = neutralFx();
  /** efeitos da onda atual (rota + próxima onda) */
  waveFx: WaveFx = neutralFx();
  private hx: HeresyEffects;

  souls = 0;
  kills = 0;
  /** itens ganhos nesta run (vão para o inventário no fim) */
  loot: string[] = [];
  /** gemas ganhas nesta run */
  gems: string[] = [];
  private killHealAcc = 0;
  killsByKind: Partial<Record<UnitKind, number>> = {};
  bossesKilled: BossKind[] = [];

  frenzyT = 0;
  screamT = 10;
  /** carga do ritual (0..1) */
  ritual = 0;
  stats: RunStats = { raised: 0, exploded: 0, consumed: 0, fused: 0, maxArmy: 0, bigExplode: 0, rituals: 0, deadKills: {} };
  private bloodKills = 0;
  private chargeHits = new Map<number, Set<number>>();
  // caches por quadro
  private ringers: Unit[] = [];
  private paladins: Unit[] = [];
  private bishops: Unit[] = [];
  private grids = new FactionGrids(FIELD.w, FIELD.h);
  private byId = new Map<number, Unit>();
  /** vivo mais perto do altar neste passo (todos os mortos defendem o mesmo alvo) */
  private altarThreat: Unit | undefined | null = null;
  private backlineCache: Unit | undefined | null = null;
  private deadCountCache = 0;

  events: GameEvent[] = [];

  constructor(setup: RunSetup) {
    this.setup = setup;
    this.rng = new RNG(setup.seed);
    this.hx = heresyEffects(setup.heresy ?? 0);
    this.base = cloneMods(setup.mods);
    applyHeresy(this.base, setup.heresy ?? 0);
    this.endless = [...(setup.endless ?? [])];
    this.mods = grow(computeMods(this.base, [], setup.schoolBonus), 0);
    this.necro = { x: NECRO.x, y: NECRO.y, hp: this.mods.necroMaxHp, maxHp: this.mods.necroMaxHp, castTimer: 0.5, radius: NECRO.radius, regenAcc: 0 };
    this.circle = { x: FIELD.w / 2, y: 200, r: this.mods.circleR };
    for (let i = 0; i < this.mods.startSkeletons; i++) {
      this.spawnDead('skeleton', this.circle.x + this.rng.range(-10, 10), this.circle.y + this.rng.range(-8, 8));
    }
    if (setup.champion) this.spawnChampion(setup.champion.boss, setup.champion.rank, this.circle.x, this.circle.y + 10);
    const start = Math.max(0, Math.min(REGIONS.length - 1, setup.startRegion ?? 0));
    if (start > 0) this.startAtRegion(start);
    // escolas: a maestria e o domínio vêm dos itens equipados, então já valem desde o começo
    const n = this.schoolCounts();
    for (const sc of SCHOOL_ORDER) {
      if (n[sc] >= MASTERY_AT) this.events.push({ type: 'synergy', school: sc, level: n[sc] >= DOMINION_AT ? 2 : 1 });
    }
  }

  /** Checkpoint: a run começa numa região mais funda, com os mortos que teria ganho no caminho. */
  private startAtRegion(r: number) {
    this.wave = r * WAVES_PER_REGION;
    // os chefes do caminho contam como absorvidos
    this.power = r;
    this.mods = grow(computeMods(this.base, this.boons, this.setup.schoolBonus), this.power);
    this.necro.maxHp = this.mods.necroMaxHp;
    this.necro.hp = this.necro.maxHp;
    for (let i = 0; i < r * CHECKPOINT_SKELETONS; i++) {
      this.spawnDead('skeleton', this.circle.x + this.rng.range(-16, 16), this.circle.y + this.rng.range(-10, 10));
    }
    // abre a encruzilhada antes da primeira onda do cerco
    this.afterChoice();
  }

  // ================================================================ salvar e retomar

  /** Foto completa da run (JSON puro). Dá para salvar em qualquer momento, até no meio da onda. */
  snapshot(): RunSnapshot {
    const state: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this)) if (!NOT_SAVED.has(k)) state[k] = v;
    return JSON.parse(JSON.stringify({ v: 1, setup: this.setup, rng: this.rng.state, state }));
  }

  static restore(snap: RunSnapshot): World {
    const w = new World(snap.setup);
    w.units = [];
    Object.assign(w, JSON.parse(JSON.stringify(snap.state)));
    w.rng.state = snap.rng;
    w.boons = w.boons ?? [];
    w.power = w.power ?? 0;
    w.log = w.log ?? { waves: [], hurt: {}, hurtWave: {}, actions: { explode: 0, fuse: 0, consume: 0, ritual: 0 }, events: [], waveStart: 0 };
    w.mods = grow(computeMods(w.base, w.boons, w.setup.schoolBonus), w.power);
    w.circle.r = w.mods.circleR;
    w.events = [];
    w.rebuildGrids(true);
    return w;
  }

  // ================================================================ consultas

  get regionIndex(): number {
    return Math.floor((Math.max(1, this.wave) - 1) / WAVES_PER_REGION);
  }
  get region() {
    return REGIONS[this.regionIndex % REGIONS.length];
  }
  /** 0 na primeira passada; 1+ nos círculos do abismo */
  get abyss(): number {
    return Math.floor(this.regionIndex / REGIONS.length);
  }
  get localWave(): number {
    return ((Math.max(1, this.wave) - 1) % WAVES_PER_REGION) + 1;
  }
  get isBossWave(): boolean {
    return this.localWave === WAVES_PER_REGION;
  }
  get boss(): Unit | undefined {
    return this.bossId === null ? undefined : this.unitById(this.bossId);
  }

  unitById(id: number): Unit | undefined {
    const u = this.byId.get(id);
    return u?.alive ? u : undefined;
  }

  armyUsed(): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.faction === 'dead') n += UNIT_DEFS[u.kind].armyCost;
    for (const c of this.corpses) if (c.raise >= 0) n += 1;
    return n;
  }

  schoolCounts(): Record<School, number> {
    return schoolCounts(this.setup.schoolBonus);
  }

  inCircle(x: number, y: number, pad = 0): boolean {
    return dist2(x, y, this.circle.x, this.circle.y) <= (this.circle.r + pad) ** 2;
  }

  deadInCircle(kind?: DeadKind): Unit[] {
    return this.units
      .filter((u) => u.alive && u.faction === 'dead' && u.kind !== 'champion' && (!kind || u.kind === kind) && this.inCircle(u.x, u.y))
      .sort((a, b) => dist2(a.x, a.y, this.circle.x, this.circle.y) - dist2(b.x, b.y, this.circle.x, this.circle.y));
  }

  private get playing() {
    return this.phase !== 'over' && this.phase !== 'event';
  }
  canExplode(): boolean {
    return this.playing && this.deadInCircle().length > 0;
  }
  canFuse(): boolean {
    return this.playing && this.deadInCircle('skeleton').length >= this.mods.fuseCount;
  }
  canConsume(): boolean {
    return this.playing && this.necro.hp < this.necro.maxHp && this.deadInCircle().length > 0;
  }

  hasEndless(id: string) {
    return this.endless.includes(id);
  }

  // ================================================================ comandos do jogador

  setCircle(x: number, y: number): void {
    const dx = x - this.necro.x;
    const dy = y - this.necro.y;
    const d = Math.hypot(dx, dy);
    if (d > CIRCLE_REACH) {
      x = this.necro.x + (dx / d) * CIRCLE_REACH;
      y = this.necro.y + (dy / d) * CIRCLE_REACH;
    }
    const r = this.circle.r;
    this.circle.x = Math.min(FIELD.w - r / 2, Math.max(r / 2, x));
    this.circle.y = Math.min(FIELD.h - r / 2, Math.max(r, y));
  }

  explode(): boolean {
    if (!this.canExplode()) return false;
    this.log.actions.explode++;
    this.rebuildGrids();
    const m = this.mods;
    const list = this.deadInCircle();
    this.stats.exploded += list.length;
    this.stats.bigExplode = Math.max(this.stats.bigExplode, list.length);
    for (const d of list) {
      const dmg = EXPLODE_DMG * UNIT_DEFS[d.kind].armyCost * m.explodeDmgMul;
      if (!(m.explodeKeep > 0 && this.rng.next() < m.explodeKeep)) this.spend(d);
      this.events.push({ type: 'explode', x: d.x, y: d.y, r: m.explodeR });
      this.aoe(d.x, d.y, m.explodeR, 'living', dmg, 'explode');
      if (m.explodePoison) this.addCloud(d.x, d.y);
    }
    this.afterSacrifice();
    this.prune();
    return true;
  }

  /** Funde esqueletos do círculo em colossos: até 4 de uma vez na horda. */
  fuse(): boolean {
    if (!this.canFuse()) return false;
    this.log.actions.fuse++;
    const skels = this.deadInCircle('skeleton');
    const n = this.mods.fuseCount;
    for (let g = 0; g < 4 && skels.length >= n; g++) {
      const parts = skels.splice(0, n);
      let cx = 0;
      let cy = 0;
      for (const p of parts) {
        cx += p.x / parts.length;
        cy += p.y / parts.length;
        this.spend(p);
      }
      const giant = this.spawnDead('giant', cx, cy);
      this.stats.fused++;
      this.events.push({ type: 'fuse', x: cx, y: cy, unitId: giant.id });
    }
    this.prune();
    return true;
  }

  consume(): boolean {
    if (!this.canConsume()) return false;
    this.log.actions.consume++;
    const m = this.mods;
    let heal = 0;
    const eaten = this.deadInCircle().slice(0, m.consumeMax);
    for (const d of eaten) {
      heal += CONSUME_HEAL * UNIT_DEFS[d.kind].armyCost * m.consumeHealMul;
      this.stats.consumed++;
      this.souls += m.consumeSouls;
      this.spend(d);
      this.events.push({ type: 'consume', x: d.x, y: d.y });
    }
    this.healNecro(heal);
    if (m.consumeRaise > 0) this.raiseFree('ghoul', eaten.length * m.consumeRaise);
    this.afterSacrifice();
    this.prune();
    return true;
  }

  // ================================================================ eventos e encruzilhadas

  /** Fim da onda: talvez um evento, senão o intervalo até a próxima onda. */
  private afterChoice() {
    if (!this.eventDone) {
      this.eventDone = true;
      const ev = this.rollEvent();
      if (ev) {
        this.event = ev;
        this.phase = 'event';
        this.events.push({ type: 'eventOffer' });
        return;
      }
    }
    this.phase = 'intermission';
    this.phaseTimer = INTERMISSION;
  }

  private rollEvent(): PendingEvent | null {
    if (this.wave <= 0) return null;
    if (this.isBossWave) {
      const pool = [...ROUTES];
      const choices: string[] = [];
      while (choices.length < this.mods.routeChoices && pool.length) choices.push(pool.splice(Math.floor(this.rng.next() * pool.length), 1)[0].id);
      return { id: 'route', choices };
    }
    const local = this.localWave;
    if ((local !== 2 && local !== 4) || this.rng.next() > 0.65 * this.mods.eventChance) return null;
    const ok = EVENTS.filter((e) => !e.can || e.can(this));
    const fresh = ok.filter((e) => !this.eventsSeen.includes(e.id));
    const pool = fresh.length ? fresh : ok;
    if (!pool.length) return null;
    const ev = this.rng.pick(pool);
    this.eventsSeen.push(ev.id);
    return { id: ev.id, choices: [] };
  }

  resolveEvent(choice: number): boolean {
    if (this.phase !== 'event' || !this.event) return false;
    const ev = this.event;
    this.event = null;
    this.log.events.push(ev.id === 'route' ? `rota:${ev.choices[choice] ?? ev.choices[0]}` : `${ev.id}:${choice}`);
    if (ev.id === 'route') {
      const r = ROUTE_BY_ID[ev.choices[choice] ?? ev.choices[0]];
      this.route = r.id;
      r.now?.(this);
      this.events.push({ type: 'route', id: r.id });
    } else {
      EVENT_BY_ID[ev.id]?.resolve(this, choice);
    }
    if (this.phase === 'event') {
      this.phase = 'intermission';
      this.phaseTimer = INTERMISSION;
    }
    return true;
  }

  deadCount(): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.faction === 'dead' && u.kind !== 'champion') n++;
    return n;
  }

  /** Gasta metade do exército (o campeão fica). */
  sacrificeHalf() {
    const dead = this.units.filter((u) => u.alive && u.faction === 'dead' && u.kind !== 'champion');
    for (const u of dead.slice(0, Math.ceil(dead.length / 2))) this.spend(u);
    this.prune();
  }

  /** Eventos: um item raro ou melhor cai no círculo. */
  grantRareItem() {
    this.dropItem(this.circle.x, this.circle.y, 0.5 + this.regionIndex * 0.15, 'rare');
  }

  /** Levanta mortos de graça perto do círculo, mesmo acima do limite. */
  raiseFree(kind: DeadKind, n: number) {
    for (let i = 0; i < n; i++) {
      const u = this.spawnDead(kind, this.circle.x + this.rng.range(-12, 12), this.circle.y + this.rng.range(-8, 8));
      this.events.push({ type: 'raised', corpseId: -1, unitId: u.id, x: u.x, y: u.y, kind });
    }
  }

  /** Efeito de evento que dura a run. */
  grantBoon(id: string) {
    this.boons.push(id);
    this.recomputeMods();
  }

  grantItem() {
    this.dropItem(this.circle.x, this.circle.y, 0.3 + this.regionIndex * 0.15);
  }

  // ================================================================ ritual (habilidade especial do personagem)

  canRitual(): boolean {
    return this.playing && this.ritual >= 1 && this.units.some((u) => u.alive && u.faction === 'living');
  }

  /** Cada necromante tem um ritual próprio, carregado por abates. */
  castRitual(): boolean {
    if (!this.canRitual()) return false;
    this.log.actions.ritual++;
    this.rebuildGrids();
    this.ritual = this.mods.ritualKeep > 0 && this.rng.next() < this.mods.ritualKeep ? 1 : 0;
    this.stats.rituals++;
    const m = this.mods;
    const c = this.circle;
    const living = this.units.filter((u) => u.alive && u.faction === 'living');
    const char = this.setup.character ?? 'necro';
    this.events.push({ type: 'ritual', char, x: c.x, y: c.y, r: char === 'reaper' ? 56 : char === 'vampire' ? 64 : c.r * 2 });
    switch (char) {
      case 'witch':
        // Peste Negra: tudo envenenado, nuvens pelo campo
        for (const u of living) {
          this.poison(u);
          u.poisonT *= 2;
        }
        this.addCloud(c.x, c.y);
        for (let i = 0; i < 4 && living.length; i++) {
          const u = this.rng.pick(living);
          this.addCloud(u.x, u.y);
        }
        break;
      case 'digger':
        // Cova Coletiva: todo cadáver do campo levanta, sem limite
        for (const k of this.corpses) {
          if (k.raise < 0 && !k.holy) {
            k.raisable = true;
            k.forced = true;
            k.overcap = true;
          }
        }
        this.raiseFree('skeleton', 3);
        break;
      case 'reaper':
        // Grande Colheita: corte enorme em volta do círculo, executa os feridos
        this.around(c.x, c.y, 56, 'living', (u) => {
          if (!UNIT_DEFS[u.kind].boss && u.hp < u.maxHp * 0.35) u.hp = 0.0001;
          this.damage(u, 6 * m.necroDmg, 'magic');
        });
        break;
      case 'vampire': {
        // Banquete: drena todos por perto, cura e dá frenesi
        let drained = 0;
        this.around(c.x, c.y, 64, 'living', (u) => {
          this.damage(u, 3 * m.necroDmg, 'magic');
          drained++;
        });
        this.healNecro(Math.min(10, Math.ceil(drained / 2)));
        this.frenzyT = Math.max(this.frenzyT, 6);
        break;
      }
      default: {
        // Tempestade de Almas: um raio em cada vivo do campo
        const n = this.necro;
        const dmg = 3 + m.necroDmg * 2;
        for (const u of living) {
          this.events.push({ type: 'bolt', x1: n.x + NECRO.staffDx, y1: n.y + NECRO.staffDy, x2: u.x, y2: u.y - BODY_MID });
          this.damage(u, dmg, 'magic');
        }
      }
    }
    this.prune();
    return true;
  }

  private recomputeMods() {
    const oldMax = this.mods.necroMaxHp;
    this.mods = grow(computeMods(this.base, this.boons, this.setup.schoolBonus), this.power);
    const m = this.mods;
    this.necro.maxHp = m.necroMaxHp;
    if (m.necroMaxHp > oldMax) this.necro.hp += m.necroMaxHp - oldMax;
    this.necro.hp = Math.min(this.necro.hp, this.necro.maxHp);
    this.circle.r = m.circleR;
    for (const u of this.units) {
      if (!u.alive || u.faction !== 'dead' || u.kind === 'champion') continue;
      const s = this.deadStats(u.kind as DeadKind);
      const ratio = u.hp / u.maxHp;
      u.maxHp = s.hp;
      u.hp = Math.max(1, s.hp * ratio);
      u.dmg = s.dmg;
    }
  }

  // ================================================================ simulação

  update(dt: number): void {
    if (!this.playing) return;
    this.time += dt;
    this.ringers = [];
    this.paladins = [];
    this.bishops = [];
    for (const u of this.units) {
      if (!u.alive || u.faction !== 'living') continue;
      if (has(u, 'speedAura')) this.ringers.push(u);
      if (has(u, 'consecrate')) this.paladins.push(u);
      if (has(u, 'armorAura')) this.bishops.push(u);
    }

    this.rebuildGrids();
    this.tickPhase(dt);
    this.updateGlobal(dt);
    this.updateNecro(dt);
    this.updateCorpses(dt);
    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    this.updateProjectiles(dt);
    this.updateTelegraphs(dt);
    this.updateClouds(dt);
    // a grade do começo do passo serve: as posições andaram menos de 1px desde então
    this.separate();
    const army = this.armyUsed();
    if (army > this.stats.maxArmy) this.stats.maxArmy = army;
    this.prune();
    this.checkWaveEnd();

    if (this.necro.hp <= 0 && this.mods.revive && !this.revived) {
      // coroa do Altar de Sangue: o necromante volta, e o exército paga o preço
      this.revived = true;
      this.necro.hp = this.necro.maxHp / 2;
      this.sacrificeHalf();
      this.events.push({ type: 'revive' });
    }
    if (this.necro.hp <= 0) {
      this.necro.hp = 0;
      this.phase = 'over';
      this.events.push({ type: 'gameOver' });
    }
  }

  private tickPhase(dt: number): void {
    if (this.phase === 'intermission') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.startWave(this.wave + 1);
    } else if (this.phase === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        // os vivos chegam em bandos, não em fila
        const pack = Math.round(this.rng.range(6, 11) + this.localWave * 2 + this.regionIndex * 3 + this.abyss * 5);
        const cx = this.rng.range(24, FIELD.w - 24);
        // a partir do Mosteiro, alguns bandos entram pelas laterais
        const sideChance = this.regionIndex === 0 ? 0 : Math.min(0.5, 0.15 + 0.1 * this.regionIndex);
        const side = this.rng.next() < sideChance ? (this.rng.next() < 0.5 ? -1 : 1) : 0;
        const sy = this.rng.range(40, 170);
        for (let i = 0; i < pack && this.spawnQueue.length; i++) {
          const u = this.spawnLiving(this.spawnQueue.shift() as LivingKind);
          if (side) {
            u.x = side < 0 ? -4 - this.rng.range(0, 12) : FIELD.w + 4 + this.rng.range(0, 12);
            u.y = sy + this.rng.range(-20, 20);
          } else {
            u.x = Math.min(FIELD.w - 6, Math.max(6, cx + this.rng.range(-22, 22)));
            u.y = -6 - this.rng.range(0, 18);
          }
        }
        if (side) this.events.push({ type: 'flank', side, y: sy });
        this.spawnTimer = Math.max(0.55, 1.3 - this.localWave * 0.08 - this.regionIndex * 0.1);
      }
      if (this.spawnQueue.length === 0) this.phase = 'fighting';
    }
  }

  private checkWaveEnd(): void {
    if (this.phase !== 'fighting') return;
    if (this.units.some((u) => u.alive && u.faction === 'living')) return;
    const gained = Math.round((20 + this.regionIndex * 20 + this.armyUsed()) * this.mods.soulMul * this.waveFx.souls);
    this.souls += gained;
    this.events.push({ type: 'waveCleared', wave: this.wave, souls: gained });
    this.log.waves.push({
      w: this.wave,
      t: Math.round(this.time - this.log.waveStart),
      hp: Math.round(this.necro.hp * 10),
      army: this.armyUsed(),
      size: this.waveSize,
      hurt: Object.fromEntries(Object.entries(this.log.hurtWave).map(([k, v]) => [k, Math.round(v * 10)])),
    });
    this.log.hurtWave = {};
    this.projectiles = [];
    this.telegraphs = [];
    this.afterChoice();
  }

  startWave(n: number): void {
    this.wave = n;
    this.log.waveStart = this.time;
    this.bossId = null;
    this.eventDone = false;
    this.waveFx = combineFx(routeFx(this.route), this.nextWave);
    this.nextWave = neutralFx();
    const local = this.localWave;
    if (local === 1) {
      if (this.abyss > 0 && this.regionIndex % REGIONS.length === 0) {
        const free = ENDLESS_MODS.filter((e) => !this.endless.includes(e.id));
        if (free.length) this.endless.push(this.rng.pick(free).id);
      }
      this.events.push({ type: 'regionStart', region: this.regionIndex });
    }
    if (this.isBossWave) {
      // o primeiro chefe do abismo é o Serafim, o chefe secreto
      const secret = this.abyss === 1 && this.regionIndex % REGIONS.length === 0;
      const kind: BossKind = secret ? 'seraph' : this.region.boss;
      const boss = this.spawnBoss(kind);
      this.bossId = boss.id;
      const escort: LivingKind[] = secret ? ['templar', 'paladin', 'inquisitor', 'bishop', 'templar'] : this.region.escort;
      this.spawnQueue = [...escort, ...escort, ...escort];
      this.events.push({ type: 'bossSpawn', id: boss.id, boss: kind });
    } else {
      this.spawnQueue = this.buildQueue(local);
    }
    this.waveSize = this.spawnQueue.length;
    if (local === 1 && this.mods.regionSkeletons > 0) this.raiseFree('skeleton', this.mods.regionSkeletons);
    for (let i = 0; i < this.mods.freeSkeletonsPerWave; i++) {
      this.spawnDead('skeleton', this.circle.x + this.rng.range(-8, 8), this.circle.y + this.rng.range(-6, 6));
    }
    this.phase = 'spawning';
    this.spawnTimer = 0.4;
    this.events.push({ type: 'waveStart', wave: n, local, boss: this.isBossWave });
  }

  private buildQueue(local: number): UnitKind[] {
    const region = this.region;
    let budget = region.budget(local) * HORDE_BUDGET * 1.6 ** this.abyss * (this.hasEndless('horde') ? 1.25 : 1) * this.hx.waveSize * this.waveFx.size;
    const options = (Object.entries(region.pool) as [LivingKind, [number, number]][]).filter(([, [, min]]) => min <= local);
    const q: UnitKind[] = [];
    while (budget > 0) {
      const afford = options.filter(([k]) => UNIT_DEFS[k].threat <= budget);
      if (!afford.length) break;
      const total = afford.reduce((a, [, [w]]) => a + w, 0);
      let r = this.rng.next() * total;
      let i = 0;
      while (r > afford[i][1][0]) r -= afford[i++][1][0];
      const k = afford[i][0];
      q.push(k);
      budget -= UNIT_DEFS[k].threat;
    }
    return q;
  }

  private updateGlobal(dt: number): void {
    const m = this.mods;
    this.frenzyT = Math.max(0, this.frenzyT - dt);
    if (m.necroDrain > 0 && (this.phase === 'spawning' || this.phase === 'fighting')) this.necro.hp -= m.necroDrain * dt;
    if (m.lichDecay) for (const u of this.units) if (u.alive && u.faction === 'dead' && u.kind !== 'champion') u.hp -= u.maxHp * 0.012 * dt;
    if (m.necroRegen > 0 && this.necro.hp < this.necro.maxHp) {
      this.necro.regenAcc += m.necroRegen * dt;
      if (this.necro.regenAcc >= 1) {
        this.necro.regenAcc -= 1;
        this.healNecro(1);
      }
    }
    if (m.spiritDominion) {
      this.screamT -= dt;
      if (this.screamT <= 0) {
        const living = this.units.filter((u) => u.alive && u.faction === 'living');
        if (living.length) {
          this.screamT = 7;
          this.events.push({ type: 'scream' });
          for (const u of living) {
            if (!UNIT_DEFS[u.kind].boss) u.stunT = Math.max(u.stunT, 1.5);
            this.damage(u, 2, 'magic');
          }
        }
      }
    }
    if (m.circleMiasma > 0 && Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) {
      for (const u of this.units) {
        if (u.alive && u.faction === 'living' && this.inCircle(u.x, u.y)) this.damage(u, m.circleMiasma * 0.5 * m.poisonDmgMul, 'poison');
      }
    }
  }

  private updateNecro(dt: number): void {
    const n = this.necro;
    n.castTimer -= dt;
    if (n.castTimer > 0) return;
    const targets = this.units.filter((u) => u.alive && u.faction === 'living' && this.inCircle(u.x, u.y, 2));
    if (!targets.length) {
      n.castTimer = 0;
      return;
    }
    if (this.mods.scythe) {
      // foice: um golpe largo em todos dentro do círculo
      this.events.push({ type: 'scythe', x: this.circle.x, y: this.circle.y, r: this.circle.r });
      for (const u of targets) this.damage(u, this.mods.necroDmg, 'magic');
      n.castTimer = NECRO.castCd * 1.8 * this.mods.castCdMul;
      return;
    }
    let t = this.rng.pick(targets);
    let fromX = n.x + NECRO.staffDx;
    let fromY = n.y + NECRO.staffDy;
    const hit = new Set<number>();
    for (let i = 0; i <= this.mods.boltChain && t; i++) {
      hit.add(t.id);
      this.events.push({ type: 'bolt', x1: fromX, y1: fromY, x2: t.x, y2: t.y - BODY_MID });
      fromX = t.x;
      fromY = t.y - BODY_MID;
      const from = t;
      this.damage(t, this.mods.necroDmg, 'magic');
      t = this.nearest(from, 'living', 34, (o) => !hit.has(o.id))!;
    }
    n.castTimer = NECRO.castCd * this.mods.castCdMul;
  }

  private updateCorpses(dt: number): void {
    const m = this.mods;
    let used = this.armyUsed();
    const life = m.corpseLife * (this.hasEndless('dawn') ? 0.5 : 1) * this.waveFx.corpseLife;
    for (const c of this.corpses) {
      c.age += dt;
      c.holy = this.paladins.some((p) => dist2(p.x, p.y, c.x, c.y) < 24 * 24);
      if (c.raise >= 0) {
        c.raise += dt / (RAISE_TIME * m.raiseTimeMul);
        if (c.raise >= 1) {
          c.gone = true;
          const kind = c.bones ? 'skeleton' : this.pickRaise();
          const u = this.spawnDead(kind, c.x, c.y);
          if (m.eliteRaise > 0 && this.rng.next() < m.eliteRaise) {
            u.elite = true;
            u.maxHp *= 1.6;
            u.hp = u.maxHp;
            u.dmg *= 1.6;
          }
          this.stats.raised++;
          this.events.push({ type: 'raised', corpseId: c.id, unitId: u.id, x: c.x, y: c.y, kind });
          if ((m.doubleRaise || (m.doubleRaiseChance > 0 && this.rng.next() < m.doubleRaiseChance)) && this.armyUsed() < m.armyCap) {
            const u2 = this.spawnDead(kind, c.x + this.rng.range(-5, 5), c.y + this.rng.range(-3, 3));
            this.events.push({ type: 'raised', corpseId: -1, unitId: u2.id, x: u2.x, y: u2.y, kind });
          }
        }
      } else if (c.raisable && !c.holy && (used < m.armyCap || c.overcap) && (c.forced || c.overcap || this.inCircle(c.x, c.y, RAISE_PAD))) {
        c.raise = 0;
        used++;
        this.events.push({ type: 'raiseStart', corpseId: c.id, x: c.x, y: c.y });
      } else if (c.age > life) {
        c.gone = true;
      }
    }
    this.corpses = this.corpses.filter((c) => !c.gone);
  }

  private pickRaise(): DeadKind {
    const pool = Object.entries(this.mods.raisePool) as [DeadKind, number][];
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let r = this.rng.next() * total;
    for (const [k, w] of pool) {
      if (r < w) return k;
      r -= w;
    }
    return 'skeleton';
  }

  // ================================================================ unidades

  private updateUnit(u: Unit, dt: number): void {
    u.age += dt;
    u.tgtT -= dt;
    u.atkTimer = Math.max(0, u.atkTimer - dt);
    u.chargeCd = Math.max(0, u.chargeCd - dt);
    u.moving = false;

    if (u.poisonT > 0) {
      u.poisonT -= dt;
      u.poisonTick -= dt;
      if (u.poisonTick <= 0) {
        u.poisonTick = 0.5;
        this.damage(u, u.poisonDps * 0.5, 'poison');
        if (!u.alive) return;
      }
    }
    if (u.faction === 'dead' && this.mods.fleshDominion && schoolOf(u.kind) === 'flesh') u.hp = Math.min(u.maxHp, u.hp + 0.5 * dt);
    if (u.faction === 'living' && this.hasEndless('faith')) u.hp = Math.min(u.maxHp, u.hp + 0.25 * dt);

    // investida (chefe/campeão): movimento forçado
    if (u.chargeT > 0 && (u.chargeVx || u.chargeVy)) {
      this.dashStep(u, dt);
      return;
    }
    if (u.chargeT > 0) u.chargeT -= dt;
    if (u.stunT > 0) {
      u.stunT -= dt;
      return;
    }

    for (const a of u.abilities) {
      a.t -= dt;
      if (a.t <= 0) {
        const enraged = u.faction === 'living' && u.hp < u.maxHp / 2;
        a.t = this.useAbility(u, a.id) ? a.cd * (enraged ? 0.7 : 1) : 0.5;
      }
    }
    if (u.faction === 'living') this.traits(u, dt);
    else this.deadTraits(u, dt);

    if (u.faction === 'living') this.livingAI(u, dt);
    else this.deadAI(u, dt);
  }

  private livingAI(u: Unit, dt: number) {
    const def = UNIT_DEFS[u.kind];
    if (has(u, 'hurler')) {
      // fica longe do altar e arremessa (ver traits)
      if (dist2(u.x, u.y, this.necro.x, this.necro.y) > 120 * 120) this.moveToward(u, this.necro.x, this.necro.y, dt);
      return;
    }
    if (!has(u, 'necroHunter')) {
      const aggro = def.projectile ? u.range : AGGRO_LIVING + (u.kind === 'hound' ? 10 : 0) + (def.boss ? 10 : 0);
      const t = this.targetOf(u, 'dead', aggro);
      if (t) {
        this.engage(u, t, dt);
        return;
      }
    }
    const n = this.necro;
    const reach = n.radius + u.range;
    const d2 = dist2(u.x, u.y, n.x, n.y);
    if (has(u, 'charge') && u.chargeCd === 0 && d2 < 60 * 60) this.knightCharge(u);
    if (d2 <= reach * reach) {
      if (u.x !== n.x) u.facing = n.x > u.x ? 1 : -1;
      if (u.atkTimer === 0) {
        u.atkTimer = u.atkCd;
        if (def.projectile) this.fire(u, null);
        else {
          this.events.push({ type: 'swing', id: u.id, tx: n.x, ty: n.y });
          this.hurtNecro(this.dmgOf(u), u.x, u.y, u.kind);
        }
      }
    } else {
      this.moveToward(u, n.x, n.y, dt);
    }
  }

  private deadAI(u: Unit, dt: number) {
    const def = UNIT_DEFS[u.kind];
    // defender o altar vem primeiro
    if (this.altarThreat === null) this.altarThreat = this.nearest(this.necro, 'living', 34);
    let t: Unit | undefined = this.altarThreat?.alive ? this.altarThreat : undefined;
    if (t && dist2(u.x, u.y, t.x, t.y) > 90 * 90) t = undefined;
    if (t) {
      this.engage(u, t, dt);
      return;
    }
    if (u.kind === 'ghost' || u.kind === 'banshee') {
      t = this.mods.spiritMastery ? this.backline() : this.nearest(u, 'living', AGGRO_DEAD * 1.6);
    } else {
      // caçada: no fim da onda os mortos vão atrás dos últimos vivos, para a onda não travar
      const aggro = this.hunting ? 400 : def.projectile ? u.range + 10 : AGGRO_DEAD + (u.kind === 'champion' ? 20 : 0);
      t = this.targetOf(u, 'living', aggro);
    }
    if (t) {
      this.engage(u, t, dt);
      return;
    }
    const spread = FORMATION_R * u.slotDist * (this.circle.r / 24) * this.formationScale;
    const tx = this.circle.x + Math.cos(u.slotAngle) * spread;
    const ty = this.circle.y + Math.sin(u.slotAngle) * spread * 0.8;
    if (dist2(u.x, u.y, tx, ty) > 4) this.moveToward(u, tx, ty, dt);
  }

  /** fim da onda: poucos vivos restantes */
  private get hunting(): boolean {
    if (this.phase !== 'fighting') return false;
    const left = this.grids.count('living');
    return left > 0 && left <= Math.max(6, this.waveSize * 0.2);
  }

  /** a formação abre conforme o exército cresce */
  private get formationScale(): number {
    return Math.min(2.6, Math.sqrt(Math.max(1, this.deadCountCache / 12)));
  }

  private backline(): Unit | undefined {
    if (this.backlineCache !== null) return this.backlineCache;
    let best: Unit | undefined;
    for (const o of this.units) if (o.alive && o.faction === 'living' && o.y > 4 && (!best || o.y < best.y)) best = o;
    this.backlineCache = best;
    return best;
  }

  private engage(u: Unit, t: Unit, dt: number): void {
    const def = UNIT_DEFS[u.kind];
    const reach = def.projectile ? u.range : u.range + t.radius;
    if (has(u, 'charge') && u.chargeCd === 0 && dist2(u.x, u.y, t.x, t.y) < 50 * 50) this.knightCharge(u);
    if (dist2(u.x, u.y, t.x, t.y) <= reach * reach) {
      if (t.x !== u.x) u.facing = t.x > u.x ? 1 : -1;
      if (u.atkTimer === 0) {
        u.atkTimer = u.atkCd;
        if (def.projectile) {
          this.fire(u, t);
        } else {
          this.events.push({ type: 'swing', id: u.id, tx: t.x, ty: t.y });
          const cleave = has(u, 'cleave') || (u.kind === 'giant' && this.mods.boneDominion);
          const dtype: DamageType = has(u, 'holyWeapon') ? 'holy' : 'normal';
          if (cleave) {
            const foe: Faction = u.faction === 'living' ? 'dead' : 'living';
            const dmg = this.dmgOf(u);
            this.around(t.x, t.y, 10, foe, (o) => this.damage(o, dmg, dtype, u));
          } else {
            this.damage(t, this.dmgOf(u), dtype, u);
          }
        }
      }
    } else {
      this.moveToward(u, t.x, t.y, dt);
    }
  }

  private knightCharge(u: Unit) {
    u.chargeT = 0.7;
    u.chargeCd = 5;
    u.chargeVx = 0;
    u.chargeVy = 0;
    this.events.push({ type: 'charge', id: u.id });
  }

  private dmgOf(u: Unit): number {
    let d = u.dmg;
    if (u.faction === 'dead' && this.frenzyT > 0) d *= 1 + this.mods.frenzyDmg;
    if (u.faction === 'living' && this.hasEndless('zeal')) d += 1;
    return d;
  }

  private speedOf(u: Unit): number {
    let s = u.speed;
    if (u.faction === 'dead') {
      s *= this.mods.deadSpeedMul * DEAD_SPEED_MUL;
      if (this.frenzyT > 0 && this.mods.bloodDominion) s *= 1.3;
    } else {
      if (this.hasEndless('fervor')) s *= 1.15;
      s *= this.hx.livingSpeed * this.waveFx.speed * LIVING_SPEED_MUL;
      if (this.mods.circleSlow > 0 && this.inCircle(u.x, u.y)) s *= 1 - this.mods.circleSlow;
      if (u.poisonT > 0 && this.mods.poisonSlow) s *= 0.65;
      if (this.ringers.some((r) => r !== u && dist2(r.x, r.y, u.x, u.y) < 30 * 30)) s *= 1.3;
    }
    if (u.chargeT > 0) s *= 3;
    return s;
  }

  private fire(u: Unit, t: Unit | null) {
    const def = UNIT_DEFS[u.kind];
    this.events.push({ type: 'shoot', id: u.id });
    this.projectiles.push({
      id: this.nextId++,
      x: u.x,
      y: u.y - BODY_MID - 2,
      targetId: t?.id ?? -1,
      atNecro: !t,
      tx: t ? t.x : this.necro.x,
      ty: t ? t.y - BODY_MID : this.necro.y - 14,
      speed: def.projectile ?? 100,
      dmg: this.dmgOf(u),
      type: u.kind === 'lich' ? 'magic' : 'normal',
      faction: u.faction,
      sourceKind: u.kind,
      gone: false,
    });
  }

  /** Poderes passivos dos mortos novos. */
  private deadTraits(u: Unit, dt: number) {
    if (u.kind !== 'plaguebearer' && u.kind !== 'banshee') return;
    u.traitTimer -= dt;
    if (u.traitTimer > 0) return;
    if (u.kind === 'plaguebearer') {
      u.traitTimer = 2.2;
      let any = false;
      this.around(u.x, u.y, 16, 'living', (o) => {
        this.poison(o);
        any = true;
      });
      if (any) this.events.push({ type: 'cloud', x: u.x, y: u.y, r: 16 });
    } else {
      u.traitTimer = 5;
      const r = 26;
      if (!this.nearest(u, 'living', r)) {
        u.traitTimer = 0.5;
        return;
      }
      this.events.push({ type: 'wail', x: u.x, y: u.y, r });
      this.around(u.x, u.y, r, 'living', (o) => {
        if (!UNIT_DEFS[o.kind].boss) o.stunT = Math.max(o.stunT, 1);
        this.damage(o, 1 * this.mods.deadDmgMul, 'magic', u);
      });
    }
  }

  private traits(u: Unit, dt: number) {
    const def = UNIT_DEFS[u.kind];
    if (!def.traits || u.faction !== 'living') return;
    u.traitTimer -= dt;
    if (u.traitTimer > 0) return;
    if (has(u, 'healer')) {
      // horda: dezenas de curandeiros juntos, então cada um cura pouco e perto
      u.traitTimer = 3;
      const big = u.kind === 'bishop';
      const r = big ? 26 : 18;
      let healed = false;
      this.around(u.x, u.y, r, 'living', (o) => {
        if (o.hp < o.maxHp) {
          o.hp = Math.min(o.maxHp, o.hp + (big ? 2 : 1));
          healed = true;
        }
      });
      if (healed) this.events.push({ type: 'heal', x: u.x, y: u.y, r, faction: 'living' });
    } else if (has(u, 'holyLight')) {
      u.traitTimer = 2.5;
      let any = false;
      this.around(u.x, u.y, 18, 'dead', (o) => {
        this.damage(o, 0.75, 'holy');
        any = true;
      });
      if (any) this.events.push({ type: 'holyBurst', x: u.x, y: u.y - 4, r: 18 });
    } else if (has(u, 'burnCorpses')) {
      u.traitTimer = 0.6;
      for (const c of this.corpses) {
        if (!c.gone && c.raise < 0 && dist2(c.x, c.y, u.x, u.y) <= 14 * 14) {
          c.gone = true;
          this.events.push({ type: 'burn', x: c.x, y: c.y });
        }
      }
      this.corpses = this.corpses.filter((c) => !c.gone);
    } else if (has(u, 'hurler')) {
      u.traitTimer = 3.2;
      if (dist2(u.x, u.y, this.necro.x, this.necro.y) > 150 * 150 || u.y < 0) {
        u.traitTimer = 0.5;
        return;
      }
      const ri = this.regionIndex % REGIONS.length;
      const payload: LivingKind = ri <= 1 ? 'peasant' : ri === 2 ? 'militia' : 'flagellant';
      const tx = this.necro.x + this.rng.range(-34, 34);
      const ty = this.necro.y - this.rng.range(18, 56);
      this.telegraphs.push({ id: this.nextId++, shape: 'circle', x: tx, y: ty, r: 10, x2: u.x, y2: u.y - BODY_MID - 2, t: 1, max: 1, ability: 'throw', ownerId: u.id, hits: 'dead', dmg: 2, payload });
      this.events.push({ type: 'swing', id: u.id, tx, ty });
    } else if (has(u, 'banish')) {
      u.traitTimer = 4;
      if (this.nearest(u, 'dead', 30)) {
        this.telegraph('circle', u, u.x, u.y, 20, 0, 0, 0.7, 'nova', 'dead', 3);
      }
    } else {
      u.traitTimer = 999;
    }
  }

  // ================================================================ habilidades

  private useAbility(u: Unit, id: AbilityId): boolean {
    const vsDead = u.faction === 'living';
    const champ = u.faction === 'dead';
    const mul = champ ? championStats(u.rank).dmgMul * this.mods.championMul : 1;
    switch (id) {
      case 'slam': {
        if (champ) {
          const t = this.nearest(u, 'living', 40);
          if (!t) return false;
          this.events.push({ type: 'telegraphEnd', ability: 'slam', x: t.x, y: t.y, x2: 0, y2: 0, r: 20, hits: 'living' });
          this.aoe(t.x, t.y, 20, 'living', 5 * mul, 'normal', u);
          return true;
        }
        const t = this.nearest(u, 'dead', 60);
        const target = t ?? (dist2(u.x, u.y, this.necro.x, this.necro.y) < 60 * 60 ? this.necro : null);
        if (!target) return false;
        this.telegraph('circle', u, target.x, target.y, 22, 0, 0, 1.0, 'slam', 'dead', 6);
        return true;
      }
      case 'summon': {
        const base = SUMMONS[u.boss ?? (u.kind as BossKind)] ?? [];
        const list = Array.from({ length: SUMMON_REPEAT }, () => base).flat();
        for (const k of list) {
          const s = this.spawnLiving(k, false);
          s.x = u.x + this.rng.range(-14, 14);
          s.y = Math.max(0, u.y + this.rng.range(-8, 4));
        }
        this.events.push({ type: 'summon', x: u.x, y: u.y });
        return true;
      }
      case 'healAll': {
        let any = false;
        this.around(u.x, u.y, 60, 'living', (o) => {
          if (o !== u && o.hp < o.maxHp) {
            o.hp = Math.min(o.maxHp, o.hp + 6);
            any = true;
          }
        });
        u.hp = Math.min(u.maxHp, u.hp + 8);
        this.events.push({ type: 'heal', x: u.x, y: u.y, r: 60, faction: 'living' });
        return any || true;
      }
      case 'nova': {
        if (!this.nearest(u, 'dead', 40)) return false;
        this.telegraph('circle', u, u.x, u.y, 32, 0, 0, 0.9, 'nova', 'dead', 5);
        return true;
      }
      case 'charge': {
        if (champ) {
          const t = this.nearest(u, 'living', 80);
          if (!t) return false;
          this.startDash(u, t.x, t.y);
          return true;
        }
        this.telegraph('line', u, u.x, u.y, 8, this.necro.x, this.necro.y, 1.1, 'charge', 'dead', 6);
        return true;
      }
      case 'beam': {
        if (champ) {
          const t = this.nearest(u, 'living', 120);
          if (!t) return false;
          this.events.push({ type: 'telegraphEnd', ability: 'beam', x: t.x, y: 0, x2: t.x, y2: FIELD.h, r: 7, hits: 'living' });
          for (const o of this.units) if (o.alive && o.faction === 'living' && Math.abs(o.x - t.x) <= 7) this.damage(o, 6 * mul, 'holy', u);
          return true;
        }
        const dead = this.units.filter((o) => o.alive && o.faction === 'dead');
        const x = dead.length ? this.rng.pick(dead).x : this.necro.x;
        this.telegraph('line', u, x, 0, 7, x, FIELD.h, 1.2, 'beam', 'dead', 8);
        return true;
      }
      case 'healDead': {
        let any = false;
        this.around(u.x, u.y, 40, 'dead', (o) => {
          if (o.hp < o.maxHp) {
            o.hp = Math.min(o.maxHp, o.hp + 4 * mul);
            any = true;
          }
        });
        if (any) this.events.push({ type: 'heal', x: u.x, y: u.y, r: 40, faction: 'dead' });
        return any;
      }
    }
    return vsDead;
  }

  private telegraph(shape: 'circle' | 'line', owner: Unit, x: number, y: number, r: number, x2: number, y2: number, time: number, ability: AbilityId, hits: Faction, dmg: number) {
    this.telegraphs.push({ id: this.nextId++, shape, x, y, r, x2, y2, t: time, max: time, ability, ownerId: owner.id, hits, dmg });
  }

  private updateTelegraphs(dt: number) {
    for (const t of this.telegraphs) {
      t.t -= dt;
      if (t.t > 0) continue;
      const owner = this.unitById(t.ownerId);
      if (!owner) continue;
      this.events.push({ type: 'telegraphEnd', ability: t.ability, x: t.x, y: t.y, x2: t.x2, y2: t.y2, r: t.r, hits: t.hits });
      if (t.ability === 'throw') {
        // o vivo arremessado cai em cima dos mortos e já começa a lutar
        this.aoe(t.x, t.y, t.r, 'dead', t.dmg, 'normal', owner);
        const s = this.spawnLiving(t.payload ?? 'peasant', false);
        s.x = t.x;
        s.y = t.y;
        s.stunT = 0.3;
        continue;
      }
      if (t.ability === 'charge') {
        this.startDash(owner, t.x2, t.y2);
        continue;
      }
      if (t.shape === 'circle') {
        // o chefe da nova acompanha o próprio corpo
        const cx = t.ability === 'nova' ? owner.x : t.x;
        const cy = t.ability === 'nova' ? owner.y : t.y;
        this.aoe(cx, cy, t.r, t.hits, t.dmg, 'holy', owner);
        if (t.hits === 'dead' && dist2(cx, cy, this.necro.x, this.necro.y) <= (t.r + this.necro.radius) ** 2) this.hurtNecro(Math.ceil(t.dmg / 2), cx, cy, owner.kind);
      } else {
        for (const o of this.units) {
          if (o.alive && o.faction === t.hits && distToSegment2(o.x, o.y, t.x, t.y, t.x2, t.y2) <= t.r * t.r) this.damage(o, t.dmg, 'holy', owner);
        }
        if (t.hits === 'dead' && distToSegment2(this.necro.x, this.necro.y, t.x, t.y, t.x2, t.y2) <= (t.r + this.necro.radius) ** 2) {
          this.hurtNecro(3, this.necro.x, this.necro.y, owner.kind);
        }
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => t.t > 0 && this.unitById(t.ownerId));
  }

  private startDash(u: Unit, tx: number, ty: number) {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const len = Math.hypot(dx, dy) || 1;
    u.chargeVx = (dx / len) * 260;
    u.chargeVy = (dy / len) * 260;
    u.chargeT = Math.min(0.45, len / 260);
    this.chargeHits.set(u.id, new Set());
    this.events.push({ type: 'charge', id: u.id });
  }

  private dashStep(u: Unit, dt: number) {
    u.chargeT -= dt;
    u.x += u.chargeVx * dt;
    u.y += u.chargeVy * dt;
    u.moving = true;
    if (u.chargeVx) u.facing = u.chargeVx > 0 ? 1 : -1;
    const hits = this.chargeHits.get(u.id) ?? new Set<number>();
    const foe: Faction = u.faction === 'living' ? 'dead' : 'living';
    const dmg = u.faction === 'living' ? 6 : 6 * championStats(u.rank).dmgMul * this.mods.championMul;
    this.around(u.x, u.y, u.radius + 11, foe, (o) => {
      if (!hits.has(o.id) && dist2(o.x, o.y, u.x, u.y) <= (u.radius + o.radius + 2) ** 2) {
        hits.add(o.id);
        this.damage(o, dmg, 'normal', u);
      }
    });
    if (u.faction === 'living' && dist2(u.x, u.y, this.necro.x, this.necro.y) <= (u.radius + this.necro.radius + 4) ** 2) {
      this.hurtNecro(3, u.x, u.y, u.kind);
      // o altar repele: o chefe é arremessado de volta e fica tonto
      const dx = u.x - this.necro.x;
      const dy = u.y - this.necro.y;
      const len = Math.hypot(dx, dy) || 1;
      u.x = this.necro.x + (dx / len) * 40;
      u.y = this.necro.y + (dy / len) * 40;
      u.stunT = 1.2;
      u.chargeT = 0;
      this.events.push({ type: 'holyBurst', x: this.necro.x, y: this.necro.y - 6, r: 30 });
    }
    if (u.chargeT <= 0) {
      u.chargeT = 0;
      u.chargeVx = 0;
      u.chargeVy = 0;
      this.chargeHits.delete(u.id);
    }
  }

  // ================================================================ projéteis e nuvens

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (p.atNecro) {
        p.tx = this.necro.x;
        p.ty = this.necro.y - 14;
      } else {
        const t = this.unitById(p.targetId);
        if (t) {
          p.tx = t.x;
          p.ty = t.y - BODY_MID;
        } else p.targetId = -1;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const len = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (len <= step + 2) {
        p.gone = true;
        if (p.atNecro) this.hurtNecro(p.dmg, p.x, p.y, p.sourceKind);
        else {
          const t = this.unitById(p.targetId);
          if (t) {
            this.damage(t, p.dmg, p.type, undefined, p.sourceKind);
            if (p.sourceKind === 'lich') {
              this.events.push({ type: 'explode', x: t.x, y: t.y, r: 12, small: true });
              this.aoe(t.x, t.y, 12, 'living', p.dmg * 0.6, 'magic');
            }
          }
        }
      } else {
        p.x += (dx / len) * step;
        p.y += (dy / len) * step;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.gone);
  }

  private addCloud(x: number, y: number) {
    if (this.clouds.length >= MAX_CLOUDS) return;
    const t = CLOUD_TIME * this.mods.poisonDurMul;
    this.clouds.push({ id: this.nextId++, x, y, r: CLOUD_R, dps: POISON_DPS * 1.5 * this.mods.poisonDmgMul, t, max: t });
    this.events.push({ type: 'cloud', x, y, r: CLOUD_R });
  }

  private updateClouds(dt: number) {
    const tick = Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2);
    for (const c of this.clouds) {
      c.t -= dt;
      if (!tick) continue;
      this.around(c.x, c.y, c.r, 'living', (u) => {
        this.poison(u);
        this.damage(u, c.dps * 0.5, 'poison');
      });
    }
    this.clouds = this.clouds.filter((c) => c.t > 0);
  }

  private poison(u: Unit) {
    u.poisonT = POISON_TIME * this.mods.poisonDurMul;
    u.poisonDps = POISON_DPS * this.mods.poisonDmgMul;
    if (u.poisonTick <= 0) u.poisonTick = 0.5;
  }

  // ================================================================ movimento

  private nearest(u: { x: number; y: number }, faction: Faction, range: number, filter?: (o: Unit) => boolean): Unit | undefined {
    return this.grids.by[faction].nearest(u.x, u.y, range, u as Unit, filter);
  }

  /** Chama `fn` para cada unidade viva da facção a até `r` de (x, y). */
  private around(x: number, y: number, r: number, faction: Faction, fn: (o: Unit) => void) {
    const r2 = r * r;
    // +2: as posições na grade podem estar um passo atrasadas
    this.grids.by[faction].each(x, y, r + 2, (o) => {
      if (o.alive && dist2(o.x, o.y, x, y) <= r2) fn(o);
    });
  }

  private rebuildGrids(full = false) {
    this.grids.rebuild(this.units);
    if (full) {
      this.byId.clear();
      for (const u of this.units) if (u.alive) this.byId.set(u.id, u);
    }
    this.altarThreat = null;
    this.backlineCache = null;
    this.deadCountCache = this.grids.count('dead');
  }

  private moveToward(u: Unit, tx: number, ty: number, dt: number): void {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const step = Math.min(len, this.speedOf(u) * dt);
    u.x += (dx / len) * step;
    u.y += (dy / len) * step;
    u.moving = true;
    if (Math.abs(dx) > 0.3) u.facing = dx > 0 ? 1 : -1;
  }

  /** Empurra unidades sobrepostas; as maiores se movem menos. Pela grade, só compara vizinhos. */
  private separate(): void {
    const us = this.units;
    const grid = this.grids.all;
    const reach = grid.maxRadius * 2 + 2;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      if (!a.alive) continue;
      const flyA = UNIT_DEFS[a.kind].flying;
      grid.each(a.x, a.y, reach, (b) => {
        if (b.id <= a.id || !b.alive) return;
        if (a.faction !== b.faction && (flyA || UNIT_DEFS[b.kind].flying)) return;
        const min = a.radius + b.radius;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) return;
        const d = Math.sqrt(d2);
        // sobreposição exata: desempata pelo id para não depender da ordem
        const nx = d > 0.001 ? dx / d : b.id % 2 ? 1 : -1;
        const ny = d > 0.001 ? dy / d : 0;
        const over = min - d;
        // peso: quem está lutando (golpeou há pouco) finca o pé; os de trás não empurram a linha da frente.
        // os vivos pesam um pouco mais, para o exército não varrer a horda para cima
        const ma = MASS[a.faction] * a.radius * a.radius * (a.atkTimer > 0 ? ENGAGED_MASS : 1);
        const mb = MASS[b.faction] * b.radius * b.radius * (b.atkTimer > 0 ? ENGAGED_MASS : 1);
        const wa = mb / (ma + mb);
        const wb = ma / (ma + mb);
        a.x -= nx * over * wa;
        a.y -= ny * over * wa;
        b.x += nx * over * wb;
        b.y += ny * over * wb;
      });
    }
    const n = this.necro;
    for (const u of us) {
      if (!u.alive) continue;
      const min = n.radius + u.radius - 2;
      const dx = u.x - n.x;
      const dy = u.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d < min && d > 0.001) {
        u.x = n.x + (dx / d) * min;
        u.y = n.y + (dy / d) * min;
      }
      // quem entra pela lateral é empurrado para dentro aos poucos, não de uma vez
      if (u.x < 3) u.x = Math.min(3, u.x + 60 / 60);
      else if (u.x > FIELD.w - 3) u.x = Math.max(FIELD.w - 3, u.x - 60 / 60);
      u.y = Math.min(FIELD.h - 2, Math.max(-12, u.y));
    }
  }

  // ================================================================ dano, cura, morte

  private aoe(x: number, y: number, r: number, faction: Faction, dmg: number, type: DamageType, src?: Unit) {
    this.around(x, y, r, faction, (o) => this.damage(o, dmg, type, src));
  }

  damage(t: Unit, amount: number, type: DamageType = 'normal', src?: Unit, srcKind?: UnitKind): void {
    if (!t.alive) return;
    let dmg = amount;
    if (t.faction === 'dead') {
      if (type === 'holy' && src && has(src, 'holyWeapon')) dmg *= 2;
      if (type === 'holy') dmg *= 1 - Math.min(0.6, this.mods.holyResist);
      dmg *= 1 - this.mods.deadArmor;
    } else {
      if (type === 'magic' && has(t, 'shieldBlock') && !this.mods.spiritMastery) dmg *= 0.5;
      if (this.bishops.some((b) => b !== t && dist2(b.x, b.y, t.x, t.y) < 32 * 32)) dmg *= 0.7;
    }
    t.hp -= dmg;
    t.lastDtype = type;
    const kind = src?.kind ?? srcKind;
    if (kind) t.lastHitBy = kind;
    this.events.push({ type: 'hit', id: t.id, x: t.x, y: t.y, faction: t.faction, dmg, dtype: type, big: dmg >= 4 });

    if (src && src.faction === 'dead' && t.faction === 'living') {
      if (this.mods.lifesteal > 0 && src.hp < src.maxHp && this.rng.next() < this.mods.lifesteal) src.hp = Math.min(src.maxHp, src.hp + 1);
      if (src.kind === 'thrall' || src.kind === 'bloodknight' || (this.mods.fleshLeech && schoolOf(src.kind) === 'flesh')) src.hp = Math.min(src.maxHp, src.hp + 1);
      if (this.mods.poisonOnHit || src.kind === 'rat' || (this.mods.boneVenom && schoolOf(src.kind) === 'bone')) this.poison(t);
      if (this.mods.fleshDominion && schoolOf(src.kind) === 'flesh' && t.hp <= 3 && !UNIT_DEFS[t.kind].boss) t.hp = 0;
    }
    if (t.hp <= 0.001) this.kill(t);
  }

  private kill(t: Unit): void {
    t.alive = false;
    const def = UNIT_DEFS[t.kind];
    this.events.push({ type: 'death', id: t.id, kind: t.kind, x: t.x, y: t.y, faction: t.faction, facing: t.facing, spent: false, boss: def.boss ? (t.kind as BossKind) : undefined });
    if (t.faction === 'living') {
      this.kills++;
      if (this.ritual < 1) {
        this.ritual = Math.min(1, this.ritual + 1 / (RITUAL_KILLS * this.mods.ritualMul) + 1e-9);
        if (this.ritual >= 1) this.events.push({ type: 'ritualReady' });
      }
      if (t.lastHitBy && UNIT_DEFS[t.lastHitBy].faction === 'dead') this.stats.deadKills[t.lastHitBy] = (this.stats.deadKills[t.lastHitBy] ?? 0) + 1;
      if (this.mods.killHeal > 0) {
        this.killHealAcc += this.mods.killHeal;
        if (this.killHealAcc >= 1) {
          this.killHealAcc -= 1;
          this.healNecro(1);
        }
      }
      if (t.elite && (this.waveFx.eliteLoot || this.rng.next() < 0.22 + this.mods.eliteLootBonus)) this.dropItem(t.x, t.y, 0.15 * this.regionIndex);
      if (def.boss) this.dropItem(t.x, t.y, 0.3 + 0.15 * this.regionIndex, this.mods.bossRareLoot ? 'rare' : 'magic');
      // relíquias: cada cerco guarda as suas, e quase nunca caem
      const relicP = (def.boss ? RELIC_BOSS_CHANCE : t.elite ? RELIC_ELITE_CHANCE : 0) * this.mods.relicLuck * (1 + 0.5 * this.abyss);
      if (relicP > 0 && this.rng.next() < relicP) this.dropRelic(t.x, t.y);
      // gemas: elites às vezes, chefes sempre (duas), e raramente de qualquer vivo
      const gm = this.mods.gemMul;
      if (t.elite && this.rng.next() < 0.25 * gm) this.dropGem(t.x, t.y, 0.1 * this.regionIndex + (gm - 1) * 0.4);
      if (def.boss) {
        this.dropGem(t.x - 6, t.y, 0.2 + 0.15 * this.regionIndex, 1 + Math.min(1, this.abyss));
        this.dropGem(t.x + 6, t.y, 0.2 + 0.15 * this.regionIndex);
      }
      if (!t.elite && !def.boss && this.rng.next() < 0.0015 * gm) this.dropGem(t.x, t.y, (gm - 1) * 0.4);
      this.killsByKind[t.kind] = (this.killsByKind[t.kind] ?? 0) + 1;
      this.souls += def.threat * SOULS_PER_THREAT * this.mods.soulMul * this.waveFx.souls;
      if (this.mods.bloodMastery && ++this.bloodKills % 20 === 0) this.healNecro(1);
      if (has(t, 'holyBurst')) {
        this.events.push({ type: 'holyBurst', x: t.x, y: t.y - 4, r: 14 });
        this.aoe(t.x, t.y, 14, 'dead', 1.5, 'holy');
      }
      if (this.mods.plagueDominion && t.poisonT > 0) this.addCloud(t.x, t.y);
      if (def.boss) {
        this.bossesKilled.push(t.kind as BossKind);
        // o exército absorve o chefe: mais vida e dano até o fim da run
        this.power++;
        this.recomputeMods();
        this.events.push({ type: 'eventResult', text: `mortos absorvem o chefe: +${Math.round(BOSS_POWER * 100)}%`, good: true });
        this.souls += 120 * (this.regionIndex + 1) * this.mods.soulMul;
        this.events.push({ type: 'bossDeath', boss: t.kind as BossKind, x: t.x, y: t.y });
        // o chefe cai: os vivos restantes fogem
        for (const o of this.units) if (o.alive && o.faction === 'living' && o !== t) o.stunT = 0.6;
        return;
      }
      const poisoned = t.poisonT > 0;
      this.corpses.push({
        id: this.nextId++,
        kind: t.kind,
        x: t.x,
        y: t.y,
        age: 0,
        raise: -1,
        raisable: def.raisable || (poisoned && this.mods.poisonedRaisable),
        overcap: this.mods.boltOvercap && t.lastDtype === 'magic',
        forced: (this.mods.fleshInfect && schoolOf(t.lastHitBy) === 'flesh') || (this.mods.boltForce && t.lastDtype === 'magic'),
        bones: false,
        gone: false,
        holy: false,
      });
      return;
    }
    // mortos que caem em combate
    this.deadDeathEffects(t, false);
  }

  private deadDeathEffects(t: Unit, spent: boolean) {
    if (t.kind === 'rat' && this.mods.ratExplode) {
      this.events.push({ type: 'explode', x: t.x, y: t.y, r: 12 });
      this.aoe(t.x, t.y, 12, 'living', 2, 'explode');
    }
    if (this.mods.plagueDeathCloud || (this.mods.boneDeathCloud && schoolOf(t.kind) === 'bone')) this.addCloud(t.x, t.y);
    if (spent) return;
    if (this.mods.boneRebirth > 0 && schoolOf(t.kind) === 'bone' && this.rng.next() < this.mods.boneRebirth) {
      this.corpses.push({ id: this.nextId++, kind: 'skeleton', x: t.x, y: t.y, age: 0, raise: -1, raisable: true, forced: false, bones: true, gone: false, holy: false });
    }
    if (this.mods.ghostOnDeath > 0 && t.kind !== 'ghost' && t.kind !== 'champion' && this.rng.next() < this.mods.ghostOnDeath) {
      const g = this.spawnDead('ghost', t.x, t.y);
      this.events.push({ type: 'raised', corpseId: -1, unitId: g.id, x: t.x, y: t.y, kind: 'ghost' });
    }
  }

  /** Morto gasto pelo jogador (explodir/fundir/consumir). */
  private spend(u: Unit): void {
    u.alive = false;
    this.events.push({ type: 'death', id: u.id, kind: u.kind, x: u.x, y: u.y, faction: u.faction, facing: u.facing, spent: true });
    this.deadDeathEffects(u, true);
  }

  private afterSacrifice() {
    if (this.mods.frenzyTime > 0 && this.mods.frenzyDmg > 0) this.frenzyT = this.mods.frenzyTime;
  }

  private hurtNecro(dmg: number, x: number, y: number, src = '?') {
    if (this.phase === 'over') return;
    this.necro.hp -= dmg;
    this.log.hurt[src] = (this.log.hurt[src] ?? 0) + dmg;
    this.log.hurtWave[src] = (this.log.hurtWave[src] ?? 0) + dmg;
    this.events.push({ type: 'necroHit', dmg, x, y });
  }

  healNecro(amount: number) {
    const before = this.necro.hp;
    this.necro.hp = Math.min(this.necro.maxHp, this.necro.hp + amount);
    if (this.necro.hp > before) this.events.push({ type: 'necroHeal', amount: this.necro.hp - before });
  }

  private prune(): void {
    let n = 0;
    for (const u of this.units) {
      if (u.alive) this.units[n++] = u;
      else this.byId.delete(u.id);
    }
    this.units.length = n;
  }

  /** Alvo com memória: só procura de novo a cada RETARGET segundos ou se o alvo morreu/saiu do alcance. */
  private targetOf(u: Unit, faction: Faction, range: number): Unit | undefined {
    if (u.tgtT > 0) {
      if (u.tgt < 0) return undefined;
      const t = this.unitById(u.tgt);
      if (t && dist2(u.x, u.y, t.x, t.y) <= range * range) return t;
    }
    const t = this.nearest(u, faction, range);
    u.tgt = t ? t.id : -1;
    u.tgtT = RETARGET;
    return t;
  }

  // ================================================================ criação

  private makeUnit(kind: UnitKind, x: number, y: number, hp: number, dmg: number): Unit {
    const d = UNIT_DEFS[kind];
    const u: Unit = {
      id: this.nextId++,
      kind,
      faction: d.faction,
      rank: 0,
      x,
      y,
      hp,
      maxHp: hp,
      dmg,
      speed: d.speed,
      range: d.range,
      atkCd: d.atkCd,
      atkTimer: 0,
      radius: d.radius * SIZE_SCALE,
      alive: true,
      moving: false,
      facing: 1,
      traitTimer: 1 + this.rng.next(),
      abilities: (d.abilities ?? []).map((a): Ability => ({ id: a.id, cd: a.cd, t: a.cd * 0.6 })),
      slotAngle: this.rng.range(0, Math.PI * 2),
      slotDist: this.rng.range(0.15, 1),
      poisonT: 0,
      poisonDps: 0,
      poisonTick: 0,
      stunT: 0,
      chargeT: 0,
      chargeCd: 0,
      chargeVx: 0,
      chargeVy: 0,
      age: 0,
      elite: false,
      tgt: -1,
      // escalona a primeira busca de alvo para não cair tudo no mesmo passo
      tgtT: (this.nextId % 12) / 60,
    };
    this.units.push(u);
    this.byId.set(u.id, u);
    this.grids.all.insert(u);
    this.grids.by[u.faction].insert(u);
    return u;
  }

  deadStats(kind: DeadKind): { hp: number; dmg: number } {
    const d = UNIT_DEFS[kind];
    const m = this.mods;
    const giant = kind === 'giant' ? m.giantMul : 1;
    return {
      hp: d.hp * m.deadHpMul * (m.kindHpMul[kind] ?? 1) * giant,
      dmg: (d.dmg + (m.kindDmgAdd[kind] ?? 0)) * m.deadDmgMul * giant,
    };
  }

  spawnDead(kind: DeadKind, x: number, y: number): Unit {
    const s = this.deadStats(kind);
    return this.makeUnit(kind, x, y, s.hp, s.dmg);
  }

  spawnChampion(boss: BossKind, rank: number, x: number, y: number): Unit {
    const d = UNIT_DEFS.champion;
    const st = championStats(rank);
    const mul = this.mods.championMul;
    const u = this.makeUnit('champion', x, y, d.hp * st.hpMul * mul * this.mods.deadHpMul, d.dmg * st.dmgMul * mul * this.mods.deadDmgMul);
    u.boss = boss;
    u.rank = rank;
    const ab = CHAMPION_ABILITY[boss];
    u.abilities = [{ id: ab.id, cd: ab.cd, t: 2 }];
    if (boss === 'commander') u.speed = 16;
    return u;
  }

  private livingHpMul(): number {
    return waveHpMul(this.wave) * 1.8 ** this.abyss * (this.hasEndless('iron') ? 1.25 : 1) * this.hx.livingHp * this.waveFx.hp;
  }

  spawnLiving(kind: LivingKind, canBeElite = true): Unit {
    const d = UNIT_DEFS[kind];
    const u = this.makeUnit(kind, this.rng.range(10, FIELD.w - 10), -6, d.hp * this.livingHpMul(), d.dmg + this.abyss + this.hx.livingDmg);
    const eliteChance = Math.min(0.5, Math.min(0.12, 0.02 + this.wave * 0.004) * ELITE_MUL * this.hx.eliteMul * this.waveFx.elites);
    if (canBeElite && this.wave >= 2 && this.rng.next() < eliteChance) {
      u.elite = true;
      u.maxHp *= 2.5;
      u.hp = u.maxHp;
      u.dmg += 1;
    }
    return u;
  }

  private dropGem(x: number, y: number, bonus: number, minRank = 1) {
    const gem = rollGem(() => this.rng.next(), bonus, minRank);
    this.gems.push(gem);
    this.events.push({ type: 'gemDrop', x, y, gem });
  }

  private dropRelic(x: number, y: number) {
    const item = rollRelic(() => this.rng.next(), this.regionIndex % REGIONS.length);
    if (!item) return;
    this.loot.push(item);
    this.events.push({ type: 'itemDrop', x, y, item });
  }

  private dropItem(x: number, y: number, luck: number, min: ItemRarity = 'common') {
    const item = rollItem(() => this.rng.next(), luck + this.mods.itemLuck, min);
    this.loot.push(item);
    this.events.push({ type: 'itemDrop', x, y, item });
  }

  private spawnBoss(kind: BossKind): Unit {
    const d = BOSS_DEFS[kind];
    const u = this.makeUnit(kind, FIELD.w / 2, -10, d.hp * 1.8 ** this.abyss * this.hx.bossHp, d.dmg + this.abyss * 2);
    u.boss = kind;
    return u;
  }
}
