import { CARD_BY_ID, computeMods, DOMINION_AT, MASTERY_AT, rollOffer, schoolCounts } from './cards';
import {
  AGGRO_DEAD,
  AGGRO_LIVING,
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
  RAISE_TIME,
  UNIT_DEFS,
  WAVES_PER_REGION,
  waveHpMul,
} from './defs';
import type { Mods } from './mods';
import { ENDLESS_MODS, REGIONS } from './regions';
import { RNG } from './rng';
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

export type Phase = 'intermission' | 'spawning' | 'fighting' | 'choosing' | 'over';

export interface RunSetup {
  seed: number;
  /** modificadores vindos da meta-progressão */
  mods: Mods;
  schools: School[];
  champion?: { boss: BossKind; rank: number } | null;
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
};

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
  cards: string[] = [];
  offer: string[] = [];
  rerollsLeft: number;

  necro: { x: number; y: number; hp: number; maxHp: number; castTimer: number; radius: number; regenAcc: number };
  circle: { x: number; y: number; r: number };

  wave = 0;
  phase: Phase = 'intermission';
  phaseTimer = 1.2;
  spawnQueue: UnitKind[] = [];
  spawnTimer = 0;
  endless: string[] = [];
  bossId: number | null = null;

  souls = 0;
  kills = 0;
  killsByKind: Partial<Record<UnitKind, number>> = {};
  bossesKilled: BossKind[] = [];

  frenzyT = 0;
  screamT = 10;
  private bloodKills = 0;
  private chargeHits = new Map<number, Set<number>>();
  // caches por quadro
  private ringers: Unit[] = [];
  private paladins: Unit[] = [];
  private bishops: Unit[] = [];

  events: GameEvent[] = [];

  constructor(setup: RunSetup) {
    this.setup = setup;
    this.rng = new RNG(setup.seed);
    this.base = setup.mods;
    this.mods = computeMods(this.base, []);
    this.rerollsLeft = this.mods.rerolls;
    this.necro = { x: NECRO.x, y: NECRO.y, hp: this.mods.necroMaxHp, maxHp: this.mods.necroMaxHp, castTimer: 0.5, radius: NECRO.radius, regenAcc: 0 };
    this.circle = { x: FIELD.w / 2, y: 200, r: this.mods.circleR };
    for (let i = 0; i < this.mods.startSkeletons; i++) {
      this.spawnDead('skeleton', this.circle.x + this.rng.range(-10, 10), this.circle.y + this.rng.range(-8, 8));
    }
    if (setup.champion) this.spawnChampion(setup.champion.boss, setup.champion.rank, this.circle.x, this.circle.y + 10);
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
    return this.bossId === null ? undefined : this.units.find((u) => u.id === this.bossId && u.alive);
  }

  armyUsed(): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.faction === 'dead') n += UNIT_DEFS[u.kind].armyCost;
    for (const c of this.corpses) if (c.raise >= 0) n += 1;
    return n;
  }

  schoolCounts(): Record<School, number> {
    return schoolCounts(this.cards);
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
    return this.phase !== 'over' && this.phase !== 'choosing';
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
    const m = this.mods;
    for (const d of this.deadInCircle()) {
      const dmg = EXPLODE_DMG * UNIT_DEFS[d.kind].armyCost * m.explodeDmgMul;
      this.spend(d);
      this.events.push({ type: 'explode', x: d.x, y: d.y, r: m.explodeR });
      this.aoe(d.x, d.y, m.explodeR, 'living', dmg, 'explode');
      if (m.explodePoison) this.addCloud(d.x, d.y);
    }
    this.afterSacrifice();
    this.prune();
    return true;
  }

  fuse(): boolean {
    if (!this.canFuse()) return false;
    const parts = this.deadInCircle('skeleton').slice(0, this.mods.fuseCount);
    let cx = 0;
    let cy = 0;
    for (const p of parts) {
      cx += p.x / parts.length;
      cy += p.y / parts.length;
      this.spend(p);
    }
    const giant = this.spawnDead('giant', cx, cy);
    this.events.push({ type: 'fuse', x: cx, y: cy, unitId: giant.id });
    this.prune();
    return true;
  }

  consume(): boolean {
    if (!this.canConsume()) return false;
    const m = this.mods;
    let heal = 0;
    for (const d of this.deadInCircle().slice(0, m.consumeMax)) {
      heal += CONSUME_HEAL * UNIT_DEFS[d.kind].armyCost * m.consumeHealMul;
      this.souls += m.consumeSouls;
      this.spend(d);
      this.events.push({ type: 'consume', x: d.x, y: d.y });
    }
    this.healNecro(heal);
    this.afterSacrifice();
    this.prune();
    return true;
  }

  pickCard(id: string): boolean {
    if (this.phase !== 'choosing' || !this.offer.includes(id)) return false;
    const before = this.schoolCounts();
    this.cards.push(id);
    this.recomputeMods();
    const s = CARD_BY_ID[id].school;
    if (s) {
      const n = this.schoolCounts()[s];
      if (before[s] < MASTERY_AT && n >= MASTERY_AT) this.events.push({ type: 'synergy', school: s, level: 1 });
      if (before[s] < DOMINION_AT && n >= DOMINION_AT) this.events.push({ type: 'synergy', school: s, level: 2 });
    }
    this.offer = [];
    this.phase = 'intermission';
    this.phaseTimer = INTERMISSION;
    return true;
  }

  reroll(): boolean {
    if (this.phase !== 'choosing' || this.rerollsLeft <= 0) return false;
    this.rerollsLeft--;
    this.offer = rollOffer(() => this.rng.next(), this.cards, this.setup.schools, this.mods.cardChoices);
    return true;
  }

  private recomputeMods() {
    const oldMax = this.mods.necroMaxHp;
    this.mods = computeMods(this.base, this.cards);
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

    this.tickPhase(dt);
    this.updateGlobal(dt);
    this.updateNecro(dt);
    this.updateCorpses(dt);
    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    this.updateProjectiles(dt);
    this.updateTelegraphs(dt);
    this.updateClouds(dt);
    this.separate();
    this.prune();
    this.checkWaveEnd();

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
        const kind = this.spawnQueue.shift();
        if (kind) this.spawnLiving(kind as LivingKind);
        this.spawnTimer = Math.max(0.22, 0.95 - this.localWave * 0.06 - this.regionIndex * 0.07);
      }
      if (this.spawnQueue.length === 0) this.phase = 'fighting';
    }
  }

  private checkWaveEnd(): void {
    if (this.phase !== 'fighting') return;
    if (this.units.some((u) => u.alive && u.faction === 'living')) return;
    const gained = Math.round((2 + this.regionIndex * 2 + this.armyUsed() * 0.5) * this.mods.soulMul);
    this.souls += gained;
    this.events.push({ type: 'waveCleared', wave: this.wave, souls: gained });
    this.projectiles = [];
    this.telegraphs = [];
    this.offer = rollOffer(() => this.rng.next(), this.cards, this.setup.schools, this.mods.cardChoices);
    if (this.offer.length) {
      this.phase = 'choosing';
      this.events.push({ type: 'cardOffer' });
    } else {
      this.phase = 'intermission';
      this.phaseTimer = INTERMISSION;
    }
  }

  startWave(n: number): void {
    this.wave = n;
    this.bossId = null;
    const local = this.localWave;
    if (local === 1) {
      if (this.abyss > 0 && this.regionIndex % REGIONS.length === 0) {
        const free = ENDLESS_MODS.filter((e) => !this.endless.includes(e.id));
        if (free.length) this.endless.push(this.rng.pick(free).id);
      }
      this.events.push({ type: 'regionStart', region: this.regionIndex });
    }
    if (this.isBossWave) {
      const boss = this.spawnBoss(this.region.boss);
      this.bossId = boss.id;
      this.spawnQueue = [...this.region.escort];
      this.events.push({ type: 'bossSpawn', id: boss.id, boss: this.region.boss });
    } else {
      this.spawnQueue = this.buildQueue(local);
    }
    for (let i = 0; i < this.mods.freeSkeletonsPerWave; i++) {
      this.spawnDead('skeleton', this.circle.x + this.rng.range(-8, 8), this.circle.y + this.rng.range(-6, 6));
    }
    this.phase = 'spawning';
    this.spawnTimer = 0.4;
    this.events.push({ type: 'waveStart', wave: n, local, boss: this.isBossWave });
  }

  private buildQueue(local: number): UnitKind[] {
    const region = this.region;
    let budget = region.budget(local) * 1.6 ** this.abyss * (this.hasEndless('horde') ? 1.25 : 1);
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
          this.screamT = 10;
          this.events.push({ type: 'scream' });
          for (const u of living) {
            if (!UNIT_DEFS[u.kind].boss) u.stunT = Math.max(u.stunT, 1.5);
            this.damage(u, 1, 'magic');
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
    let t = this.rng.pick(targets);
    let fromX = n.x + NECRO.staffDx;
    let fromY = n.y + NECRO.staffDy;
    const hit = new Set<number>();
    for (let i = 0; i <= this.mods.boltChain && t; i++) {
      hit.add(t.id);
      this.events.push({ type: 'bolt', x1: fromX, y1: fromY, x2: t.x, y2: t.y - 4 });
      fromX = t.x;
      fromY = t.y - 4;
      const from = t;
      this.damage(t, this.mods.necroDmg, 'magic');
      t = this.nearest(from, 'living', 34, (o) => !hit.has(o.id))!;
    }
    n.castTimer = NECRO.castCd * this.mods.castCdMul;
  }

  private updateCorpses(dt: number): void {
    const m = this.mods;
    let used = this.armyUsed();
    const life = m.corpseLife * (this.hasEndless('dawn') ? 0.5 : 1);
    for (const c of this.corpses) {
      c.age += dt;
      c.holy = this.paladins.some((p) => dist2(p.x, p.y, c.x, c.y) < 24 * 24);
      if (c.raise >= 0) {
        c.raise += dt / (RAISE_TIME * m.raiseTimeMul);
        if (c.raise >= 1) {
          c.gone = true;
          const kind = c.bones ? 'skeleton' : this.pickRaise();
          const u = this.spawnDead(kind, c.x, c.y);
          this.events.push({ type: 'raised', corpseId: c.id, unitId: u.id, x: c.x, y: c.y, kind });
        }
      } else if (c.raisable && !c.holy && used < m.armyCap && (c.forced || this.inCircle(c.x, c.y))) {
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
    this.traits(u, dt);

    if (u.faction === 'living') this.livingAI(u, dt);
    else this.deadAI(u, dt);
  }

  private livingAI(u: Unit, dt: number) {
    const def = UNIT_DEFS[u.kind];
    if (!has(u, 'necroHunter')) {
      const aggro = def.projectile ? u.range : AGGRO_LIVING + (u.kind === 'hound' ? 10 : 0) + (def.boss ? 10 : 0);
      const t = this.nearest(u, 'dead', aggro);
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
          this.hurtNecro(this.dmgOf(u), u.x, u.y);
        }
      }
    } else {
      this.moveToward(u, n.x, n.y, dt);
    }
  }

  private deadAI(u: Unit, dt: number) {
    const def = UNIT_DEFS[u.kind];
    let t: Unit | undefined;
    if (u.kind === 'ghost') {
      t = this.mods.spiritMastery ? this.backline() : this.nearest(u, 'living', AGGRO_DEAD * 1.6);
    } else {
      t = this.nearest(u, 'living', def.projectile ? u.range + 10 : AGGRO_DEAD + (u.kind === 'champion' ? 20 : 0));
    }
    if (t) {
      this.engage(u, t, dt);
      return;
    }
    const tx = this.circle.x + Math.cos(u.slotAngle) * FORMATION_R * u.slotDist * (this.circle.r / 24);
    const ty = this.circle.y + Math.sin(u.slotAngle) * FORMATION_R * u.slotDist * (this.circle.r / 24);
    if (dist2(u.x, u.y, tx, ty) > 4) this.moveToward(u, tx, ty, dt);
  }

  private backline(): Unit | undefined {
    let best: Unit | undefined;
    for (const o of this.units) if (o.alive && o.faction === 'living' && o.y > 4 && (!best || o.y < best.y)) best = o;
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
            for (const o of this.units) {
              if (o.alive && o.faction === foe && dist2(o.x, o.y, t.x, t.y) <= 10 * 10) this.damage(o, this.dmgOf(u), dtype, u);
            }
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
      s *= this.mods.deadSpeedMul;
      if (this.frenzyT > 0 && this.mods.bloodDominion) s *= 1.3;
    } else {
      if (this.hasEndless('fervor')) s *= 1.15;
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
      y: u.y - 6,
      targetId: t?.id ?? -1,
      atNecro: !t,
      tx: t ? t.x : this.necro.x,
      ty: t ? t.y - 4 : this.necro.y - 6,
      speed: def.projectile ?? 100,
      dmg: this.dmgOf(u),
      type: 'normal',
      faction: u.faction,
      sourceKind: u.kind,
      gone: false,
    });
  }

  private traits(u: Unit, dt: number) {
    const def = UNIT_DEFS[u.kind];
    if (!def.traits || u.faction !== 'living') return;
    u.traitTimer -= dt;
    if (u.traitTimer > 0) return;
    if (has(u, 'healer')) {
      u.traitTimer = 2.5;
      const big = u.kind === 'bishop';
      const r = big ? 32 : 26;
      let healed = false;
      for (const o of this.units) {
        if (o.alive && o.faction === 'living' && o.hp < o.maxHp && dist2(o.x, o.y, u.x, u.y) <= r * r) {
          o.hp = Math.min(o.maxHp, o.hp + (big ? 3 : 2));
          healed = true;
        }
      }
      if (healed) this.events.push({ type: 'heal', x: u.x, y: u.y, r, faction: 'living' });
    } else if (has(u, 'holyLight')) {
      u.traitTimer = 1.5;
      let any = false;
      for (const o of this.units) {
        if (o.alive && o.faction === 'dead' && dist2(o.x, o.y, u.x, u.y) <= 22 * 22) {
          this.damage(o, 1, 'holy');
          any = true;
        }
      }
      if (any) this.events.push({ type: 'holyBurst', x: u.x, y: u.y - 4, r: 22 });
    } else if (has(u, 'burnCorpses')) {
      u.traitTimer = 0.6;
      for (const c of this.corpses) {
        if (!c.gone && c.raise < 0 && dist2(c.x, c.y, u.x, u.y) <= 14 * 14) {
          c.gone = true;
          this.events.push({ type: 'burn', x: c.x, y: c.y });
        }
      }
      this.corpses = this.corpses.filter((c) => !c.gone);
    } else if (has(u, 'banish')) {
      u.traitTimer = 4;
      if (this.units.some((o) => o.alive && o.faction === 'dead' && dist2(o.x, o.y, u.x, u.y) < 30 * 30)) {
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
        const list = SUMMONS[u.boss ?? (u.kind as BossKind)] ?? [];
        for (const k of list) {
          const s = this.spawnLiving(k);
          s.x = u.x + this.rng.range(-14, 14);
          s.y = Math.max(0, u.y + this.rng.range(-8, 4));
        }
        this.events.push({ type: 'summon', x: u.x, y: u.y });
        return true;
      }
      case 'healAll': {
        let any = false;
        for (const o of this.units) {
          if (o.alive && o.faction === 'living' && o !== u && o.hp < o.maxHp && dist2(o.x, o.y, u.x, u.y) < 60 * 60) {
            o.hp = Math.min(o.maxHp, o.hp + 6);
            any = true;
          }
        }
        u.hp = Math.min(u.maxHp, u.hp + 8);
        this.events.push({ type: 'heal', x: u.x, y: u.y, r: 60, faction: 'living' });
        return any || true;
      }
      case 'nova': {
        if (!this.units.some((o) => o.alive && o.faction === 'dead' && dist2(o.x, o.y, u.x, u.y) < 40 * 40)) return false;
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
        for (const o of this.units) {
          if (o.alive && o.faction === 'dead' && o.hp < o.maxHp && dist2(o.x, o.y, u.x, u.y) < 40 * 40) {
            o.hp = Math.min(o.maxHp, o.hp + 4 * mul);
            any = true;
          }
        }
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
      const owner = this.units.find((u) => u.id === t.ownerId && u.alive);
      if (!owner) continue;
      this.events.push({ type: 'telegraphEnd', ability: t.ability, x: t.x, y: t.y, x2: t.x2, y2: t.y2, r: t.r, hits: t.hits });
      if (t.ability === 'charge') {
        this.startDash(owner, t.x2, t.y2);
        continue;
      }
      if (t.shape === 'circle') {
        // o chefe da nova acompanha o próprio corpo
        const cx = t.ability === 'nova' ? owner.x : t.x;
        const cy = t.ability === 'nova' ? owner.y : t.y;
        this.aoe(cx, cy, t.r, t.hits, t.dmg, 'holy', owner);
        if (t.hits === 'dead' && dist2(cx, cy, this.necro.x, this.necro.y) <= (t.r + this.necro.radius) ** 2) this.hurtNecro(Math.ceil(t.dmg / 2), cx, cy);
      } else {
        for (const o of this.units) {
          if (o.alive && o.faction === t.hits && distToSegment2(o.x, o.y, t.x, t.y, t.x2, t.y2) <= t.r * t.r) this.damage(o, t.dmg, 'holy', owner);
        }
        if (t.hits === 'dead' && distToSegment2(this.necro.x, this.necro.y, t.x, t.y, t.x2, t.y2) <= (t.r + this.necro.radius) ** 2) {
          this.hurtNecro(3, this.necro.x, this.necro.y);
        }
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => t.t > 0 && this.units.some((u) => u.id === t.ownerId && u.alive));
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
    for (const o of this.units) {
      if (o.alive && o.faction === foe && !hits.has(o.id) && dist2(o.x, o.y, u.x, u.y) <= (u.radius + o.radius + 2) ** 2) {
        hits.add(o.id);
        this.damage(o, dmg, 'normal', u);
      }
    }
    if (u.faction === 'living' && dist2(u.x, u.y, this.necro.x, this.necro.y) <= (u.radius + this.necro.radius + 4) ** 2) {
      this.hurtNecro(4, u.x, u.y);
      u.chargeT = 0;
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
        p.ty = this.necro.y - 6;
      } else {
        const t = this.units.find((u) => u.id === p.targetId && u.alive);
        if (t) {
          p.tx = t.x;
          p.ty = t.y - 4;
        } else p.targetId = -1;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const len = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (len <= step + 2) {
        p.gone = true;
        if (p.atNecro) this.hurtNecro(p.dmg, p.x, p.y);
        else {
          const t = this.units.find((u) => u.id === p.targetId && u.alive);
          if (t) this.damage(t, p.dmg, p.type, undefined, p.sourceKind);
        }
      } else {
        p.x += (dx / len) * step;
        p.y += (dy / len) * step;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.gone);
  }

  private addCloud(x: number, y: number) {
    const t = CLOUD_TIME * this.mods.poisonDurMul;
    this.clouds.push({ id: this.nextId++, x, y, r: CLOUD_R, dps: POISON_DPS * 2 * this.mods.poisonDmgMul, t, max: t });
    this.events.push({ type: 'cloud', x, y, r: CLOUD_R });
  }

  private updateClouds(dt: number) {
    const tick = Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2);
    for (const c of this.clouds) {
      c.t -= dt;
      if (!tick) continue;
      for (const u of this.units) {
        if (u.alive && u.faction === 'living' && dist2(u.x, u.y, c.x, c.y) <= c.r * c.r) {
          this.poison(u);
          this.damage(u, c.dps * 0.5, 'poison');
        }
      }
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
    let best: Unit | undefined;
    let bestD = range * range;
    for (const o of this.units) {
      if (!o.alive || o.faction !== faction || o === u) continue;
      if (filter && !filter(o)) continue;
      const d = dist2(u.x, u.y, o.x, o.y);
      if (d <= bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
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

  /** Empurra unidades sobrepostas; as maiores se movem menos. O(n²), suficiente para ~150 unidades. */
  private separate(): void {
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        if (!b.alive) continue;
        if (a.faction !== b.faction && (UNIT_DEFS[a.kind].flying || UNIT_DEFS[b.kind].flying)) continue;
        const min = a.radius + b.radius;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        const nx = d > 0.001 ? dx / d : 1;
        const ny = d > 0.001 ? dy / d : 0;
        const over = min - d;
        const wa = b.radius / min;
        const wb = a.radius / min;
        a.x -= nx * over * wa;
        a.y -= ny * over * wa;
        b.x += nx * over * wb;
        b.y += ny * over * wb;
      }
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
      u.x = Math.min(FIELD.w - 3, Math.max(3, u.x));
      u.y = Math.min(FIELD.h - 2, Math.max(-12, u.y));
    }
  }

  // ================================================================ dano, cura, morte

  private aoe(x: number, y: number, r: number, faction: Faction, dmg: number, type: DamageType, src?: Unit) {
    for (const o of this.units) {
      if (o.alive && o.faction === faction && dist2(o.x, o.y, x, y) <= r * r) this.damage(o, dmg, type, src);
    }
  }

  damage(t: Unit, amount: number, type: DamageType = 'normal', src?: Unit, srcKind?: UnitKind): void {
    if (!t.alive) return;
    let dmg = amount;
    if (t.faction === 'dead') {
      if (type === 'holy' && src && has(src, 'holyWeapon')) dmg *= 2;
      dmg *= 1 - this.mods.deadArmor;
    } else {
      if (type === 'magic' && has(t, 'shieldBlock')) dmg *= 0.5;
      if (this.bishops.some((b) => b !== t && dist2(b.x, b.y, t.x, t.y) < 32 * 32)) dmg *= 0.7;
    }
    t.hp -= dmg;
    const kind = src?.kind ?? srcKind;
    if (kind) t.lastHitBy = kind;
    this.events.push({ type: 'hit', id: t.id, x: t.x, y: t.y, faction: t.faction, dmg, dtype: type, big: dmg >= 4 });

    if (src && src.faction === 'dead' && t.faction === 'living') {
      if (this.mods.lifesteal > 0 && src.hp < src.maxHp && this.rng.next() < this.mods.lifesteal) src.hp = Math.min(src.maxHp, src.hp + 1);
      if (src.kind === 'thrall') src.hp = Math.min(src.maxHp, src.hp + 0.5);
      if (this.mods.poisonOnHit || src.kind === 'rat') this.poison(t);
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
      this.killsByKind[t.kind] = (this.killsByKind[t.kind] ?? 0) + 1;
      this.souls += def.threat * 0.15 * this.mods.soulMul;
      if (this.mods.bloodMastery && ++this.bloodKills % 8 === 0) this.healNecro(1);
      if (has(t, 'holyBurst')) {
        this.events.push({ type: 'holyBurst', x: t.x, y: t.y - 4, r: 18 });
        this.aoe(t.x, t.y, 18, 'dead', 3, 'holy');
      }
      if (this.mods.plagueDominion && t.poisonT > 0) this.addCloud(t.x, t.y);
      if (def.boss) {
        this.bossesKilled.push(t.kind as BossKind);
        this.souls += 12 * (this.regionIndex + 1) * this.mods.soulMul;
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
        forced: this.mods.fleshInfect && schoolOf(t.lastHitBy) === 'flesh',
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
    if (this.mods.plagueDeathCloud) this.addCloud(t.x, t.y);
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

  private hurtNecro(dmg: number, x: number, y: number) {
    if (this.phase === 'over') return;
    this.necro.hp -= dmg;
    this.events.push({ type: 'necroHit', dmg, x, y });
  }

  private healNecro(amount: number) {
    const before = this.necro.hp;
    this.necro.hp = Math.min(this.necro.maxHp, this.necro.hp + amount);
    if (this.necro.hp > before) this.events.push({ type: 'necroHeal', amount: this.necro.hp - before });
  }

  private prune(): void {
    this.units = this.units.filter((u) => u.alive);
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
      radius: d.radius,
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
    };
    this.units.push(u);
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
    return waveHpMul(this.wave) * 1.8 ** this.abyss * (this.hasEndless('iron') ? 1.25 : 1);
  }

  spawnLiving(kind: LivingKind): Unit {
    const d = UNIT_DEFS[kind];
    return this.makeUnit(kind, this.rng.range(10, FIELD.w - 10), -6, d.hp * this.livingHpMul(), d.dmg + this.abyss);
  }

  private spawnBoss(kind: BossKind): Unit {
    const d = BOSS_DEFS[kind];
    const u = this.makeUnit(kind, FIELD.w / 2, -10, d.hp * 1.8 ** this.abyss, d.dmg + this.abyss * 2);
    u.boss = kind;
    return u;
  }
}
