import { RNG } from './rng';
import {
  AGGRO_DEAD,
  AGGRO_LIVING,
  ARMY_CAP,
  CIRCLE_R,
  CIRCLE_REACH,
  CONSUME_HEAL,
  CONSUME_MAX,
  CORPSE_LIFE,
  EXPLODE_DMG,
  EXPLODE_R,
  FIELD,
  FORMATION_R,
  FUSE_COUNT,
  INTERMISSION,
  LIVING_KINDS,
  NECRO,
  PRIEST_HEAL,
  PRIEST_HEAL_CD,
  PRIEST_HEAL_R,
  RAISE_TIME,
  START_SKELETONS,
  UNIT_DEFS,
  spawnInterval,
  waveBudget,
  waveHpMul,
} from './defs';
import type { Corpse, Faction, GameEvent, Unit, UnitKind } from './types';

export type Phase = 'intermission' | 'spawning' | 'fighting' | 'over';

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

/**
 * Estado completo de uma run. Não conhece o Phaser: a cena só lê o estado
 * e consome `events` para desenhar efeitos.
 */
export class World {
  readonly rng: RNG;
  time = 0;
  private nextId = 1;

  units: Unit[] = [];
  corpses: Corpse[] = [];
  necro = { x: NECRO.x, y: NECRO.y, hp: NECRO.hp as number, maxHp: NECRO.hp as number, castTimer: 0.5, radius: NECRO.radius as number };
  circle = { x: FIELD.w / 2, y: 200, r: CIRCLE_R };

  wave = 0;
  phase: Phase = 'intermission';
  phaseTimer = 1.5;
  spawnQueue: UnitKind[] = [];
  spawnTimer = 0;

  souls = 0;
  kills = 0;
  armyCap = ARMY_CAP;

  /** Eventos gerados desde a última leitura. A cena esvazia a lista. */
  events: GameEvent[] = [];

  constructor(seed: number) {
    this.rng = new RNG(seed);
    for (let i = 0; i < START_SKELETONS; i++) {
      this.spawnUnit('skeleton', this.circle.x + this.rng.range(-8, 8), this.circle.y + this.rng.range(-6, 6));
    }
  }

  // ---------------------------------------------------------------- consultas

  armyUsed(): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.faction === 'dead') n += UNIT_DEFS[u.kind].armyCost;
    for (const c of this.corpses) if (c.raise >= 0) n += 1;
    return n;
  }

  inCircle(x: number, y: number, pad = 0): boolean {
    return dist2(x, y, this.circle.x, this.circle.y) <= (this.circle.r + pad) ** 2;
  }

  /** Mortos dentro do círculo, do centro para fora. */
  deadInCircle(kind?: UnitKind): Unit[] {
    return this.units
      .filter((u) => u.alive && u.faction === 'dead' && (!kind || u.kind === kind) && this.inCircle(u.x, u.y))
      .sort((a, b) => dist2(a.x, a.y, this.circle.x, this.circle.y) - dist2(b.x, b.y, this.circle.x, this.circle.y));
  }

  canExplode(): boolean {
    return this.phase !== 'over' && this.deadInCircle().length > 0;
  }
  canFuse(): boolean {
    return this.phase !== 'over' && this.deadInCircle('skeleton').length >= FUSE_COUNT;
  }
  canConsume(): boolean {
    return this.phase !== 'over' && this.necro.hp < this.necro.maxHp && this.deadInCircle().length > 0;
  }

  // ---------------------------------------------------------------- comandos do jogador

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

  /** Todos os mortos no círculo explodem, ferindo os vivos em volta. */
  explode(): boolean {
    if (!this.canExplode()) return false;
    for (const d of this.deadInCircle()) {
      const dmg = EXPLODE_DMG * UNIT_DEFS[d.kind].armyCost;
      this.removeUnit(d);
      this.events.push({ type: 'explode', x: d.x, y: d.y, r: EXPLODE_R });
      for (const l of this.units) {
        if (l.alive && l.faction === 'living' && dist2(l.x, l.y, d.x, d.y) <= EXPLODE_R ** 2) this.damage(l, dmg);
      }
    }
    this.prune();
    return true;
  }

  /** Três esqueletos do círculo viram um Colosso de Ossos. */
  fuse(): boolean {
    if (!this.canFuse()) return false;
    const parts = this.deadInCircle('skeleton').slice(0, FUSE_COUNT);
    let cx = 0;
    let cy = 0;
    for (const p of parts) {
      cx += p.x / parts.length;
      cy += p.y / parts.length;
      this.removeUnit(p);
    }
    const giant = this.spawnUnit('giant', cx, cy);
    this.events.push({ type: 'fuse', x: cx, y: cy, unitId: giant.id });
    this.prune();
    return true;
  }

  /** Até três mortos do círculo são sacrificados para curar o necromante. */
  consume(): boolean {
    if (!this.canConsume()) return false;
    let heal = 0;
    for (const d of this.deadInCircle().slice(0, CONSUME_MAX)) {
      heal += CONSUME_HEAL * UNIT_DEFS[d.kind].armyCost;
      this.removeUnit(d);
      this.events.push({ type: 'consume', x: d.x, y: d.y });
    }
    this.necro.hp = Math.min(this.necro.maxHp, this.necro.hp + heal);
    this.prune();
    return true;
  }

  // ---------------------------------------------------------------- simulação

  update(dt: number): void {
    if (this.phase === 'over') return;
    this.time += dt;
    this.tickPhase(dt);
    this.updateNecro(dt);
    this.updateCorpses(dt);
    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    this.separate();
    this.prune();
    this.updateWaves();

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
        if (kind) this.spawnLiving(kind);
        this.spawnTimer = spawnInterval(this.wave);
      }
      if (this.spawnQueue.length === 0) this.phase = 'fighting';
    }
  }

  private updateWaves(): void {
    if (this.phase !== 'fighting') return;
    if (this.units.some((u) => u.alive && u.faction === 'living')) return;
    let gained = this.wave;
    for (const u of this.units) if (u.alive && u.faction === 'dead') gained += UNIT_DEFS[u.kind].armyCost;
    this.souls += gained;
    this.events.push({ type: 'waveCleared', wave: this.wave, souls: gained });
    this.phase = 'intermission';
    this.phaseTimer = INTERMISSION;
  }

  startWave(n: number): void {
    this.wave = n;
    this.spawnQueue = this.buildQueue(n);
    this.phase = 'spawning';
    this.spawnTimer = 0.3;
    this.events.push({ type: 'waveStart', wave: n });
  }

  private buildQueue(n: number): UnitKind[] {
    let budget = waveBudget(n);
    const options = LIVING_KINDS.filter((k) => UNIT_DEFS[k].minWave <= n);
    const q: UnitKind[] = [];
    while (budget > 0) {
      const afford = options.filter((k) => UNIT_DEFS[k].threat <= budget);
      if (!afford.length) break;
      const k = this.rng.pick(afford);
      q.push(k);
      budget -= UNIT_DEFS[k].threat;
    }
    return q;
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
    const t = this.rng.pick(targets);
    this.events.push({ type: 'bolt', x1: n.x + NECRO.staffDx, y1: n.y + NECRO.staffDy, x2: t.x, y2: t.y - 4 });
    this.damage(t, NECRO.dmg);
    n.castTimer = NECRO.castCd;
  }

  private updateCorpses(dt: number): void {
    let used = this.armyUsed();
    for (const c of this.corpses) {
      c.age += dt;
      if (c.raise >= 0) {
        c.raise += dt / RAISE_TIME;
        if (c.raise >= 1) {
          c.gone = true;
          const u = this.spawnUnit('skeleton', c.x, c.y);
          this.events.push({ type: 'raised', corpseId: c.id, unitId: u.id, x: c.x, y: c.y });
        }
      } else if (c.raisable && used < this.armyCap && this.inCircle(c.x, c.y)) {
        c.raise = 0;
        used++;
        this.events.push({ type: 'raiseStart', corpseId: c.id, x: c.x, y: c.y });
      } else if (c.age > CORPSE_LIFE) {
        c.gone = true;
      }
    }
    this.corpses = this.corpses.filter((c) => !c.gone);
  }

  private updateUnit(u: Unit, dt: number): void {
    u.atkTimer = Math.max(0, u.atkTimer - dt);
    u.moving = false;

    if (u.faction === 'living') {
      if (u.kind === 'priest') this.priestHeal(u, dt);
      const t = this.nearest(u, 'dead', AGGRO_LIVING);
      if (t) {
        this.engage(u, t, dt);
        return;
      }
      const n = this.necro;
      const reach = n.radius + u.range;
      if (dist2(u.x, u.y, n.x, n.y) <= reach * reach) {
        if (u.atkTimer === 0) {
          u.atkTimer = u.atkCd;
          n.hp -= u.dmg;
          this.events.push({ type: 'swing', id: u.id });
          this.events.push({ type: 'necroHit', dmg: u.dmg, x: u.x, y: u.y });
        }
      } else {
        this.moveToward(u, n.x, n.y, dt);
      }
      return;
    }

    // mortos: caçam vivos por perto, senão voltam para a formação no círculo
    const t = this.nearest(u, 'living', AGGRO_DEAD);
    if (t) {
      this.engage(u, t, dt);
      return;
    }
    const tx = this.circle.x + Math.cos(u.slotAngle) * FORMATION_R * u.slotDist;
    const ty = this.circle.y + Math.sin(u.slotAngle) * FORMATION_R * u.slotDist;
    if (dist2(u.x, u.y, tx, ty) > 4) this.moveToward(u, tx, ty, dt);
  }

  private priestHeal(u: Unit, dt: number): void {
    u.healTimer -= dt;
    if (u.healTimer > 0) return;
    u.healTimer = PRIEST_HEAL_CD;
    let healed = false;
    for (const o of this.units) {
      if (o.alive && o.faction === 'living' && o.hp < o.maxHp && dist2(o.x, o.y, u.x, u.y) <= PRIEST_HEAL_R ** 2) {
        o.hp = Math.min(o.maxHp, o.hp + PRIEST_HEAL);
        healed = true;
      }
    }
    if (healed) this.events.push({ type: 'heal', x: u.x, y: u.y, r: PRIEST_HEAL_R });
  }

  private engage(u: Unit, t: Unit, dt: number): void {
    const reach = u.range + t.radius;
    if (dist2(u.x, u.y, t.x, t.y) <= reach * reach) {
      if (t.x !== u.x) u.facing = t.x > u.x ? 1 : -1;
      if (u.atkTimer === 0) {
        u.atkTimer = u.atkCd;
        this.events.push({ type: 'swing', id: u.id });
        this.damage(t, u.dmg);
      }
    } else {
      this.moveToward(u, t.x, t.y, dt);
    }
  }

  private nearest(u: Unit, faction: Faction, range: number): Unit | undefined {
    let best: Unit | undefined;
    let bestD = range * range;
    for (const o of this.units) {
      if (!o.alive || o.faction !== faction) continue;
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
    const step = Math.min(len, u.speed * dt);
    u.x += (dx / len) * step;
    u.y += (dy / len) * step;
    u.moving = true;
    if (Math.abs(dx) > 0.3) u.facing = dx > 0 ? 1 : -1;
  }

  /** Empurra unidades sobrepostas. O(n²): suficiente para o protótipo (trocar por grade espacial depois). */
  private separate(): void {
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        if (!b.alive) continue;
        const min = a.radius + b.radius;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        const nx = d > 0.001 ? dx / d : 1;
        const ny = d > 0.001 ? dy / d : 0;
        const push = (min - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
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
      u.y = Math.min(FIELD.h - 2, Math.max(-10, u.y));
    }
  }

  // ---------------------------------------------------------------- vida e morte

  damage(t: Unit, amount: number): void {
    if (!t.alive) return;
    t.hp -= amount;
    this.events.push({ type: 'hit', id: t.id, x: t.x, y: t.y, faction: t.faction });
    if (t.hp <= 0) this.kill(t);
  }

  private kill(t: Unit): void {
    t.alive = false;
    this.events.push({ type: 'death', id: t.id, kind: t.kind, x: t.x, y: t.y, faction: t.faction });
    if (t.faction === 'living') {
      this.kills++;
      this.corpses.push({
        id: this.nextId++,
        kind: t.kind,
        x: t.x,
        y: t.y,
        age: 0,
        raise: -1,
        raisable: UNIT_DEFS[t.kind].raisable,
        gone: false,
      });
    }
  }

  /** Remove um morto gasto pelo jogador (não deixa cadáver). */
  private removeUnit(u: Unit): void {
    u.alive = false;
    this.events.push({ type: 'death', id: u.id, kind: u.kind, x: u.x, y: u.y, faction: u.faction });
  }

  private prune(): void {
    this.units = this.units.filter((u) => u.alive);
  }

  spawnUnit(kind: UnitKind, x: number, y: number, hpMul = 1): Unit {
    const d = UNIT_DEFS[kind];
    const hp = Math.round(d.hp * hpMul);
    const u: Unit = {
      id: this.nextId++,
      kind,
      faction: d.faction,
      x,
      y,
      hp,
      maxHp: hp,
      dmg: d.dmg,
      speed: d.speed,
      range: d.range,
      atkCd: d.atkCd,
      atkTimer: 0,
      radius: d.radius,
      alive: true,
      moving: false,
      facing: 1,
      healTimer: PRIEST_HEAL_CD,
      slotAngle: this.rng.range(0, Math.PI * 2),
      slotDist: this.rng.range(0.15, 1),
    };
    this.units.push(u);
    return u;
  }

  private spawnLiving(kind: UnitKind): void {
    this.spawnUnit(kind, this.rng.range(10, FIELD.w - 10), -4, waveHpMul(this.wave));
  }
}
