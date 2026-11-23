import Phaser from 'phaser';
import { COL } from '../art/palette';
import { pxText, setPxText } from '../art/text';
import { DEBUG } from '../debug';
import { buzz } from '../platform/haptics';
import { loadBest, saveBest } from '../platform/storage';
import { CIRCLE_REACH, CORPSE_LIFE, FIELD, NECRO } from '../sim/defs';
import type { GameEvent, Unit } from '../sim/types';
import { World } from '../sim/world';
import { buildScenery, Darkness, DEPTH, type Light } from './scenery';

const STEP = 1 / 60;
const DRAG_GAIN = 1.25;
const GIANT_TINT = 0xc9f2d4;

const SPRITE_KEY: Record<Unit['kind'], string> = {
  peasant: 'peasant',
  soldier: 'soldier',
  priest: 'priest',
  skeleton: 'skel',
  giant: 'skel',
};

interface UnitView {
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  flashUntil: number;
  lunge: number;
}
interface CorpseView {
  img: Phaser.GameObjects.Image;
  rising?: Phaser.GameObjects.Image;
}
interface Fx {
  kind: 'bolt' | 'ring' | 'beam';
  pts?: number[];
  x: number;
  y: number;
  r: number;
  color: number;
  life: number;
  max: number;
}
interface Button {
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  can: () => boolean;
  act: () => boolean;
  downUntil: number;
}

export class RunScene extends Phaser.Scene {
  private world!: World;
  private acc = 0;
  private units = new Map<number, UnitView>();
  private corpses = new Map<number, CorpseView>();
  private fxList: Fx[] = [];
  private tempLights: (Light & { life: number; max: number })[] = [];
  private staticLights: Light[] = [];
  private overlay!: Phaser.GameObjects.Graphics;
  private dark!: Darkness;
  private decals!: Phaser.GameObjects.RenderTexture;
  private necro!: Phaser.GameObjects.Image;
  private orb!: Phaser.GameObjects.Image;
  private necroFlashUntil = 0;
  private emit!: Record<'blood' | 'bone' | 'soul' | 'spark' | 'gold', Phaser.GameObjects.Particles.ParticleEmitter>;
  private drag: { px: number; py: number; cx: number; cy: number } | null = null;
  private spin = 0;
  private buttons: Button[] = [];
  private hud!: { wave: Phaser.GameObjects.BitmapText; souls: Phaser.GameObjects.BitmapText; army: Phaser.GameObjects.BitmapText; hpFlashUntil: number };
  private ended = false;

  constructor() {
    super('Run');
  }

  create() {
    // a instância da cena é reaproveitada no restart: zerar tudo aqui
    this.world = new World((Math.random() * 2 ** 31) | 0);
    this.acc = 0;
    this.units.clear();
    this.corpses.clear();
    this.fxList = [];
    this.tempLights = [];
    this.buttons = [];
    this.drag = null;
    this.ended = false;

    this.staticLights = buildScenery(this);
    this.decals = this.add.renderTexture(0, 0, FIELD.w, FIELD.h).setOrigin(0).setDepth(DEPTH.decal);
    this.dark = new Darkness(this, 0.6);
    this.overlay = this.add.graphics().setDepth(DEPTH.hud + 1);

    this.add.image(NECRO.x, NECRO.y + 3, 'altar').setDepth(DEPTH.altar);
    this.necro = this.add.image(NECRO.x, NECRO.y + 4, 'necro').setOrigin(0.5, 1).setDepth(DEPTH.world + NECRO.y);
    this.orb = this.add
      .image(NECRO.x + NECRO.staffDx, NECRO.y + NECRO.staffDy, 'glow16')
      .setTint(COL.g)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow);
    this.tweens.add({ targets: this.orb, alpha: 0.55, scale: 1.25, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });

    this.createParticles();
    this.createHud();
    this.createInput();
  }

  // ================================================================ setup

  private createParticles() {
    const mk = (cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, 'px', { emitting: false, ...cfg }).setDepth(DEPTH.fx);
    this.emit = {
      blood: mk({ speed: { min: 15, max: 55 }, angle: { min: 200, max: 340 }, gravityY: 170, lifespan: { min: 250, max: 550 }, tint: [COL.r, COL.R] }),
      bone: mk({ speed: { min: 20, max: 60 }, angle: { min: 200, max: 340 }, gravityY: 190, lifespan: { min: 300, max: 600 }, tint: [COL.w, COL.b, COL.B] }),
      soul: mk({ speed: { min: 4, max: 24 }, angle: { min: 230, max: 310 }, gravityY: -30, lifespan: { min: 400, max: 900 }, tint: [COL.g, COL.G], alpha: { start: 1, end: 0 } }),
      spark: mk({ speed: { min: 20, max: 70 }, lifespan: { min: 100, max: 260 }, tint: [COL.G, 0xffffff], alpha: { start: 1, end: 0 } }),
      gold: mk({ speed: { min: 5, max: 20 }, angle: { min: 230, max: 310 }, gravityY: -20, lifespan: { min: 300, max: 700 }, tint: [COL.y, COL.O], alpha: { start: 1, end: 0 } }),
    };
    // almas vagando pelo cemitério
    this.add
      .particles(0, 0, 'px', {
        x: { min: 0, max: FIELD.w },
        y: { min: 20, max: FIELD.h },
        lifespan: { min: 2000, max: 4000 },
        speedY: { min: -6, max: -2 },
        speedX: { min: -2, max: 2 },
        alpha: { start: 0.7, end: 0 },
        tint: [COL.g, COL.B],
        frequency: 260,
      })
      .setDepth(DEPTH.glow);
  }

  private createHud() {
    this.add.image(0, 0, 'topbar').setOrigin(0).setDepth(DEPTH.hud);
    this.add.image(0, FIELD.h, 'hudbar').setOrigin(0).setDepth(DEPTH.hud);

    const wave = pxText(this, 4, 2, 'ONDA 0', COL.c).setDepth(DEPTH.hud);
    this.add.image(78, 1, 'icon-soul').setOrigin(0).setDepth(DEPTH.hud);
    const souls = pxText(this, 85, 2, '0', COL.G).setDepth(DEPTH.hud);
    this.add.image(152, 2, 'icon-skull').setOrigin(0).setDepth(DEPTH.hud);
    const army = pxText(this, 176, 2, '0/10', COL.w).setOrigin(1, 0).setDepth(DEPTH.hud);
    this.hud = { wave, souls, army, hpFlashUntil: 0 };
    this.add.image(3, FIELD.h + 3, 'icon-heart').setOrigin(0).setDepth(DEPTH.hud);

    const defs: [string, () => boolean, () => boolean][] = [
      ['EXPLODIR', () => this.world.canExplode(), () => this.world.explode()],
      ['FUNDIR', () => this.world.canFuse(), () => this.world.fuse()],
      ['CONSUMIR', () => this.world.canConsume(), () => this.world.consume()],
    ];
    defs.forEach(([name, can, act], i) => {
      const x = 3 + i * 59;
      const y = FIELD.h + 10;
      const img = this.add.image(x, y, 'btn').setOrigin(0).setDepth(DEPTH.hud).setInteractive();
      const label = pxText(this, x + 28, y + 5, name, COL.c).setOrigin(0.5, 0).setDepth(DEPTH.hud);
      const btn: Button = { img, label, can, act, downUntil: 0 };
      img.on('pointerdown', () => this.press(btn));
      this.buttons.push(btn);
    });
  }

  private createInput() {
    // arrastar move o círculo de forma relativa (o dedo não cobre o círculo)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.ended || p.y >= FIELD.h) return;
      this.drag = { px: p.x, py: p.y, cx: this.world.circle.x, cy: this.world.circle.y };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      this.world.setCircle(this.drag.cx + (p.x - this.drag.px) * DRAG_GAIN, this.drag.cy + (p.y - this.drag.py) * DRAG_GAIN);
    });
    this.input.on('pointerup', () => (this.drag = null));

    const kb = this.input.keyboard;
    if (kb) {
      const bind = (keys: string[], i: number) => keys.forEach((k) => kb.on(`keydown-${k}`, () => this.press(this.buttons[i])));
      bind(['ONE', 'Q'], 0);
      bind(['TWO', 'W'], 1);
      bind(['THREE', 'E'], 2);
      kb.on('keydown-ESC', () => this.scene.start('Menu'));
    }
  }

  private press(b: Button) {
    if (this.ended) return;
    if (b.act()) {
      b.downUntil = this.time.now + 120;
      buzz('medium');
    }
  }

  // ================================================================ loop

  update(time: number, delta: number) {
    if (DEBUG.autopilot) this.autopilot();
    if (!this.ended) {
      this.acc = Math.min(this.acc + delta / 1000, 0.25);
      while (this.acc >= STEP) {
        this.world.update(STEP);
        this.acc -= STEP;
      }
    }
    const events = this.world.events;
    this.world.events = [];
    for (const e of events) this.onEvent(e, time);

    this.overlay.clear();
    this.syncCorpses(time);
    this.syncUnits(time);
    this.drawCircle(delta);
    this.drawFx(delta);
    this.syncNecro(time);
    this.syncHud(time);
    this.drawDarkness(time, delta);
  }

  /** Debug: persegue o vivo mais perto do necromante e usa as ações sozinho. */
  private autopilot() {
    const w = this.world;
    let best: Unit | undefined;
    let bestD = Infinity;
    for (const u of w.units) {
      if (u.faction !== 'living') continue;
      const d = Math.hypot(u.x - NECRO.x, u.y - NECRO.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (best) w.setCircle(w.circle.x + (best.x - w.circle.x) * 0.05, w.circle.y + (best.y - w.circle.y) * 0.05);
    if (w.canFuse()) this.press(this.buttons[1]);
    if (w.necro.hp < w.necro.maxHp / 2 && w.canConsume()) this.press(this.buttons[2]);
    if (bestD < 30 && w.canExplode()) this.press(this.buttons[0]);
  }

  // ================================================================ eventos → efeitos

  private onEvent(e: GameEvent, time: number) {
    switch (e.type) {
      case 'bolt': {
        this.fxList.push({ kind: 'bolt', pts: this.jagged(e.x1, e.y1, e.x2, e.y2), x: e.x2, y: e.y2, r: 0, color: COL.G, life: 0.1, max: 0.1 });
        this.emit.spark.explode(4, e.x2, e.y2);
        this.tempLights.push({ x: e.x2, y: e.y2, key: 'light24', life: 0.12, max: 0.12 });
        break;
      }
      case 'hit': {
        const v = this.units.get(e.id);
        if (v) v.flashUntil = time + 70;
        if (e.faction === 'living') this.emit.blood.explode(3, e.x, e.y - 4);
        else this.emit.bone.explode(2, e.x, e.y - 4);
        break;
      }
      case 'swing': {
        const v = this.units.get(e.id);
        if (v) v.lunge = 1;
        break;
      }
      case 'death': {
        if (e.faction === 'living') {
          this.emit.blood.explode(10, e.x, e.y - 4);
          this.decals.draw('splat', Math.round(e.x - 4), Math.round(e.y - 3));
        } else {
          this.emit.bone.explode(e.kind === 'giant' ? 18 : 8, e.x, e.y - 5);
        }
        break;
      }
      case 'raiseStart':
        this.emit.soul.explode(5, e.x, e.y);
        break;
      case 'raised':
        this.emit.soul.explode(12, e.x, e.y - 5);
        this.tempLights.push({ x: e.x, y: e.y - 5, key: 'light24', life: 0.3, max: 0.3 });
        break;
      case 'explode':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 3, r: e.r, color: COL.G, life: 0.25, max: 0.25 });
        this.emit.soul.explode(10, e.x, e.y - 3);
        this.emit.bone.explode(10, e.x, e.y - 3);
        this.emit.spark.explode(8, e.x, e.y - 3);
        this.tempLights.push({ x: e.x, y: e.y, key: 'light48', life: 0.3, max: 0.3 });
        this.cameras.main.shake(110, 0.012);
        break;
      case 'fuse':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 6, r: 14, color: COL.g, life: 0.35, max: 0.35 });
        this.emit.soul.explode(24, e.x, e.y - 6);
        this.tempLights.push({ x: e.x, y: e.y - 6, key: 'light48', life: 0.4, max: 0.4 });
        this.cameras.main.shake(80, 0.008);
        break;
      case 'consume':
        this.fxList.push({ kind: 'beam', pts: [e.x, e.y - 5, NECRO.x, NECRO.y - 8], x: e.x, y: e.y, r: 0, color: COL.g, life: 0.3, max: 0.3 });
        this.emit.soul.explode(8, e.x, e.y - 5);
        this.emit.soul.explode(6, NECRO.x, NECRO.y - 8);
        break;
      case 'heal':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 4, r: e.r, color: COL.y, life: 0.35, max: 0.35 });
        this.emit.gold.explode(8, e.x, e.y - 8);
        this.tempLights.push({ x: e.x, y: e.y - 4, key: 'light24', life: 0.35, max: 0.35 });
        break;
      case 'necroHit':
        this.necroFlashUntil = time + 110;
        this.hud.hpFlashUntil = time + 200;
        this.emit.blood.explode(5, NECRO.x, NECRO.y - 8);
        this.cameras.main.shake(90, 0.01);
        buzz('heavy');
        break;
      case 'waveStart':
        this.banner(`ONDA ${e.wave}`, COL.R);
        break;
      case 'waveCleared':
        this.banner(`+${e.souls} ALMAS`, COL.G);
        break;
      case 'gameOver':
        this.gameOver();
        break;
    }
  }

  private jagged(x1: number, y1: number, x2: number, y2: number): number[] {
    const pts = [x1, y1];
    const n = 5;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push(x1 + (x2 - x1) * t + Phaser.Math.Between(-3, 3), y1 + (y2 - y1) * t + Phaser.Math.Between(-3, 3));
    }
    pts.push(x2, y2);
    return pts;
  }

  private banner(text: string, color: number) {
    const t = pxText(this, FIELD.w / 2, 110, text, color).setOrigin(0.5).setScale(2).setDepth(DEPTH.hud);
    this.tweens.add({ targets: t, y: 100, alpha: 0, delay: 900, duration: 500, onComplete: () => t.destroy() });
  }

  // ================================================================ sincronizar sprites com a simulação

  private syncUnits(time: number) {
    const seen = new Set<number>();
    for (const u of this.world.units) {
      if (!u.alive) continue;
      seen.add(u.id);
      let v = this.units.get(u.id);
      if (!v) {
        const key = SPRITE_KEY[u.kind];
        const spr = this.add.sprite(u.x, u.y, `${key}0`).setOrigin(0.5, 1);
        spr.play({ key: `${key}-walk`, startFrame: u.id % 2 });
        const shadow = this.add.image(u.x, u.y, 'shadow').setAlpha(0.6).setDepth(DEPTH.decal + 1);
        if (u.kind === 'giant') {
          spr.setScale(2);
          shadow.setScale(2);
        }
        v = { spr, shadow, flashUntil: 0, lunge: 0 };
        this.units.set(u.id, v);
      }
      const lungeX = v.lunge > 0 ? u.facing * Math.round(v.lunge * 2) : 0;
      v.lunge = Math.max(0, v.lunge - 0.2);
      v.spr.setPosition(Math.round(u.x) + lungeX, Math.round(u.y)).setDepth(DEPTH.world + u.y);
      v.spr.setFlipX(u.facing < 0);
      v.spr.anims.timeScale = u.moving ? 1 : 0.25;
      v.shadow.setPosition(Math.round(u.x), Math.round(u.y));
      if (time < v.flashUntil) v.spr.setTintFill(0xffffff);
      else if (u.kind === 'giant') v.spr.setTint(GIANT_TINT);
      else v.spr.clearTint();

      if (u.hp < u.maxHp) {
        const top = Math.round(u.y - v.spr.displayHeight - 3);
        const w = u.kind === 'giant' ? 14 : 8;
        const x = Math.round(u.x - w / 2);
        this.overlay.fillStyle(COL.k).fillRect(x - 1, top - 1, w + 2, 3);
        this.overlay.fillStyle(u.faction === 'living' ? COL.R : COL.g).fillRect(x, top, Math.max(1, Math.round((w * u.hp) / u.maxHp)), 1);
      }
    }
    for (const [id, v] of this.units) {
      if (seen.has(id)) continue;
      v.spr.destroy();
      v.shadow.destroy();
      this.units.delete(id);
    }
  }

  private syncCorpses(time: number) {
    const seen = new Set<number>();
    for (const c of this.world.corpses) {
      seen.add(c.id);
      let v = this.corpses.get(c.id);
      if (!v) {
        const img = this.add.image(Math.round(c.x), Math.round(c.y) + 1, 'corpse').setOrigin(0.5, 1).setDepth(DEPTH.world + c.y - 2);
        img.setFlipX(c.id % 2 === 0);
        if (!c.raisable) img.setTint(0xe8d9a0); // padre: solo sagrado, não levanta
        v = { img };
        this.corpses.set(c.id, v);
      }
      if (c.raise >= 0) {
        if (!v.rising) v.rising = this.add.image(Math.round(c.x), Math.round(c.y), 'skel0').setOrigin(0.5, 1).setDepth(DEPTH.world + c.y);
        const h = v.rising.height;
        const shown = Math.max(1, Math.ceil(h * c.raise));
        v.rising.setCrop(0, 0, v.rising.width, shown);
        v.rising.y = Math.round(c.y) + (h - shown);
        v.rising.setTintFill(time % 200 < 100 ? COL.G : COL.g);
        v.img.setAlpha(1 - c.raise);
      } else if (c.age > CORPSE_LIFE - 2) {
        v.img.setAlpha(time % 240 < 120 ? 0.35 : 0.8);
      }
    }
    for (const [id, v] of this.corpses) {
      if (seen.has(id)) continue;
      v.img.destroy();
      v.rising?.destroy();
      this.corpses.delete(id);
    }
  }

  private syncNecro(time: number) {
    if (time < this.necroFlashUntil) this.necro.setTintFill(COL.R);
    else this.necro.clearTint();
  }

  // ================================================================ desenho

  private drawCircle(delta: number) {
    const g = this.overlay;
    const { x, y, r } = this.world.circle;
    this.spin += delta * 0.012;
    const cx = Math.round(x);
    const cy = Math.round(y);

    // enquanto arrasta, mostra o alcance da magia
    if (this.drag) {
      g.fillStyle(COL.g, 0.35);
      for (let a = Math.PI; a < Math.PI * 2; a += 1 / CIRCLE_REACH) {
        const px = Math.round(NECRO.x + Math.cos(a) * CIRCLE_REACH);
        const py = Math.round(NECRO.y + Math.sin(a) * CIRCLE_REACH);
        if ((px + py) % 4 === 0 && px >= 0 && px < FIELD.w) g.fillRect(px, py, 1, 1);
      }
    }
    g.fillStyle(COL.g, 0.06).fillCircle(cx, cy, r);
    const ring = (rad: number, offset: number, on: number, period: number, color: number, alpha: number) => {
      const n = Math.floor(2 * Math.PI * rad);
      g.fillStyle(color, alpha);
      for (let i = 0; i < n; i++) {
        if ((i + Math.floor(offset)) % period >= on) continue;
        const a = (i / n) * Math.PI * 2;
        g.fillRect(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad), 1, 1);
      }
    };
    ring(r, this.spin, 5, 7, COL.g, 1);
    ring(r - 4, -this.spin * 0.7, 2, 6, COL.g, 0.55);
    // runas nos 4 pontos
    for (let i = 0; i < 4; i++) {
      const a = this.spin * 0.05 + (i * Math.PI) / 2;
      g.fillStyle(COL.G, 1).fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
    }
  }

  private drawFx(delta: number) {
    const dt = delta / 1000;
    const g = this.overlay;
    for (const f of this.fxList) {
      f.life -= dt;
      const t = Math.max(0, f.life / f.max);
      if (f.kind === 'bolt' && f.pts) {
        g.lineStyle(1, f.color, t).strokePoints(this.toPoints(f.pts));
      } else if (f.kind === 'beam' && f.pts) {
        g.lineStyle(1, f.color, t).lineBetween(f.pts[0], f.pts[1], f.pts[2], f.pts[3]);
      } else if (f.kind === 'ring') {
        g.lineStyle(1, f.color, t).strokeCircle(f.x, f.y, Math.round(f.r * (1.1 - t * 0.6)));
      }
    }
    this.fxList = this.fxList.filter((f) => f.life > 0);
  }

  private toPoints(arr: number[]): Phaser.Types.Math.Vector2Like[] {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < arr.length; i += 2) pts.push({ x: arr[i], y: arr[i + 1] });
    return pts;
  }

  private drawDarkness(time: number, delta: number) {
    const dt = delta / 1000;
    for (const l of this.tempLights) l.life -= dt;
    this.tempLights = this.tempLights.filter((l) => l.life > 0);
    const { x, y, r } = this.world.circle;
    const lights: Light[] = [
      ...this.staticLights,
      { x: NECRO.x, y: NECRO.y - 8, key: 'light80' },
      { x, y, key: 'light80', scale: (r * 2.4) / 80, alpha: 0.75 },
      ...this.tempLights.map((l) => ({ ...l, alpha: l.life / l.max })),
    ];
    this.dark.draw(lights, time);
  }

  private syncHud(time: number) {
    const w = this.world;
    setPxText(this.hud.wave, `ONDA ${w.wave}`);
    setPxText(this.hud.souls, `${w.souls}`);
    setPxText(this.hud.army, `${w.armyUsed()}/${w.armyCap}`);
    this.hud.army.setTint(w.armyUsed() >= w.armyCap ? COL.y : COL.w);

    // barra de vida do necromante
    const g = this.overlay;
    const bx = 10;
    const by = FIELD.h + 4;
    const bw = 166;
    g.fillStyle(COL.k).fillRect(bx - 1, by - 1, bw + 2, 5);
    g.fillStyle(COL.r).fillRect(bx, by, bw, 3);
    const fill = Math.round((bw * w.necro.hp) / w.necro.maxHp);
    g.fillStyle(time < this.hud.hpFlashUntil ? 0xffffff : COL.R).fillRect(bx, by, fill, 3);
    g.fillStyle(0xffffff, 0.25).fillRect(bx, by, fill, 1);
    for (let i = 1; i < w.necro.maxHp; i++) g.fillStyle(COL.k, 0.6).fillRect(bx + Math.round((bw * i) / w.necro.maxHp), by, 1, 3);

    for (const b of this.buttons) {
      const ok = b.can();
      b.img.setTexture(time < b.downUntil ? 'btn-down' : 'btn').setAlpha(ok ? 1 : 0.45);
      b.label.setTint(ok ? COL.G : COL.B);
    }
  }

  // ================================================================ fim de jogo

  private gameOver() {
    this.ended = true;
    const w = this.world;
    const best = loadBest();
    const record = w.wave > best.wave || (w.wave === best.wave && w.souls > best.souls);
    if (record) saveBest({ wave: w.wave, souls: w.souls });

    this.emit.bone.explode(30, NECRO.x, NECRO.y - 8);
    this.emit.soul.explode(30, NECRO.x, NECRO.y - 8);
    this.necro.setVisible(false);
    this.orb.setVisible(false);

    const cx = FIELD.w / 2;
    const shade = this.add.rectangle(0, 0, FIELD.w, 320, 0x050309, 0).setOrigin(0).setDepth(DEPTH.modal);
    this.tweens.add({ targets: shade, fillAlpha: 0.85, duration: 600 });
    const t = (y: number, s: string, c: number, scale = 1) =>
      pxText(this, cx, y, s, c).setOrigin(0.5).setScale(scale).setDepth(DEPTH.modal + 1).setAlpha(0);
    const texts = [
      t(110, 'O NECROMANTE', COL.R, 2),
      t(124, 'CAIU', COL.R, 2),
      t(150, `onda ${w.wave}`, COL.c),
      t(160, `${w.souls} almas  ${w.kills} abates`, COL.c),
      t(174, record ? 'novo recorde!' : `recorde: onda ${Math.max(best.wave, w.wave)}`, record ? COL.y : COL.B),
      t(210, 'toque para recomeçar', COL.G),
      t(222, 'esc: menu', COL.B),
    ];
    this.tweens.add({ targets: texts, alpha: 1, delay: 400, duration: 400 });
    this.time.delayedCall(900, () => {
      this.input.once('pointerdown', () => this.scene.restart());
      this.input.keyboard?.once('keydown-SPACE', () => this.scene.restart());
    });
  }
}
