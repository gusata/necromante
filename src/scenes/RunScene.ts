import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { charKey, unitKey } from '../art/generate';
import { CHAR_GLOW } from '../art/sprites';
import { COL } from '../art/palette';
import { pxText, setPxText } from '../art/text';
import { DEBUG } from '../debug';
import { button, curtain, DEPTH, flash, floatText, Shaker, shatter, transitionIn, transitionTo } from '../fx/juice';
import { buzz, heartbeat } from '../platform/haptics';
import { meta, saveMeta } from '../platform/save';
import { autopilot } from '../sim/autopilot';
import { CARD_BY_ID, DOMINION_AT, MASTERY_AT, SCHOOL_ORDER, SCHOOLS } from '../sim/cards';
import { BOSS_DEFS, CIRCLE_REACH, FIELD, NECRO, UNIT_DEFS } from '../sim/defs';
import { ITEM_BY_ID, ITEM_PRICE, RARITY_COLOR, rollItem } from '../sim/items';
import { buildingLevel, gainItem, metaMods, rollMarket, schoolBonus, unlockedSchools } from '../sim/meta';
import { circleName } from '../sim/regions';
import type { BossKind, Corpse, GameEvent, School, Unit } from '../sim/types';
import { World } from '../sim/world';
import { wrap } from './BestiaryScene';
import { Darkness, Scenery, type Light } from './scenery';

const STEP = 1 / 60;
const DRAG_GAIN = 1.25;
const ROMAN = ['I', 'II', 'III', 'IV'];

interface UnitView {
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  key: string;
  flashUntil: number;
  attackUntil: number;
  lungeX: number;
  lungeY: number;
  squash: number;
  trailAt: number;
  born: number;
  outline?: Phaser.GameObjects.Sprite[];
}
interface CorpseView {
  img: Phaser.GameObjects.Image;
  rising?: Phaser.GameObjects.Image;
  shownAt: number;
}
interface Fx {
  kind: 'bolt' | 'ring' | 'beam' | 'column';
  pts?: number[];
  x: number;
  y: number;
  r: number;
  color: number;
  life: number;
  max: number;
}
interface ActionButton {
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  can: () => boolean;
  act: () => boolean;
  downUntil: number;
  x: number;
  y: number;
}
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterName = 'blood' | 'bone' | 'soul' | 'spark' | 'gold' | 'poison' | 'fire' | 'dust' | 'frenzy';

const hexOf = (s: string) => parseInt(s.slice(1), 16);

export class RunScene extends Phaser.Scene {
  private world!: World;
  private acc = 0;
  private units = new Map<number, UnitView>();
  private corpses = new Map<number, CorpseView>();
  private projectiles = new Map<number, Phaser.GameObjects.Image>();
  private seenTelegraphs = new Set<number>();
  private fxList: Fx[] = [];
  private tempLights: (Light & { life: number; max: number })[] = [];
  private scenery!: Scenery;
  private overlay!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private dark!: Darkness;
  private decals!: Phaser.GameObjects.RenderTexture;
  private necro!: Phaser.GameObjects.Sprite;
  private orb!: Phaser.GameObjects.Image;
  private necroFlashUntil = 0;
  private castUntil = 0;
  private emit!: Record<EmitterName, Emitter>;
  private shaker!: Shaker;
  private drag: { px: number; py: number; cx: number; cy: number } | null = null;
  private spin = 0;
  private buttons: ActionButton[] = [];
  private hud!: {
    wave: Phaser.GameObjects.BitmapText;
    souls: Phaser.GameObjects.BitmapText;
    soulIcon: Phaser.GameObjects.Image;
    army: Phaser.GameObjects.BitmapText;
    schools: { school: School; icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.BitmapText }[];
    bossName: Phaser.GameObjects.BitmapText;
    hpFlashUntil: number;
    hpShake: number;
    shownSouls: number;
    bossShownHp: number;
  };
  private vignette!: Phaser.GameObjects.Image;
  private nextBeat = 0;
  private hitstopUntil = 0;
  private slowUntil = 0;
  private slowFactor = 1;
  private modal: Phaser.GameObjects.GameObject[] = [];
  private cardViews: { id: string; c: Phaser.GameObjects.Container }[] = [];
  private modalKind: 'cards' | 'pause' | 'results' | 'merchant' | null = null;
  private merchantPending = false;
  private necroKey = 'necro';
  private bag!: { icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.BitmapText };
  private ended = false;

  constructor() {
    super('Run');
  }

  // ================================================================ criação

  create() {
    this.units.clear();
    this.corpses.clear();
    this.projectiles.clear();
    this.seenTelegraphs.clear();
    this.fxList = [];
    this.tempLights = [];
    this.buttons = [];
    this.modal = [];
    this.cardViews = [];
    this.modalKind = null;
    this.drag = null;
    this.ended = false;
    this.acc = 0;
    this.hitstopUntil = 0;
    this.slowUntil = 0;
    this.merchantPending = false;
    this.necroKey = charKey(meta.character);

    const sel = meta.selectedChampion;
    const champ = sel && buildingLevel(meta, 'hall') > 0 && meta.champions[sel] ? sel : null;
    this.world = new World({
      seed: (Math.random() * 2 ** 31) | 0,
      mods: metaMods(meta),
      schools: unlockedSchools(meta),
      champion: champ ? { boss: champ, rank: meta.champions[champ]! } : null,
      schoolBonus: schoolBonus(meta),
    });

    this.shaker = new Shaker(this.cameras.main);
    this.scenery = new Scenery(this);
    this.scenery.build(0);
    if (DEBUG.startWave > 1) {
      this.world.wave = DEBUG.startWave - 1;
      const r = this.world.regionIndex;
      this.scenery.build(r % 4, this.world.abyss);
    }
    this.decals = this.add.renderTexture(0, 0, FIELD.w, FIELD.h).setOrigin(0).setDepth(DEPTH.decal);
    this.dark = new Darkness(this, 0.54);
    this.overlay = this.add.graphics().setDepth(DEPTH.overlay);
    this.hudGfx = this.add.graphics().setDepth(DEPTH.hud + 1);

    this.add.image(NECRO.x, NECRO.y + 3, 'altar').setDepth(DEPTH.altar);
    this.necro = this.add.sprite(NECRO.x, NECRO.y + 4, `${this.necroKey}0`).setOrigin(0.5, 1).setDepth(DEPTH.world + NECRO.y);
    this.necro.play(`${this.necroKey}-idle`);
    this.orb = this.add
      .image(NECRO.x + NECRO.staffDx, NECRO.y + NECRO.staffDy, 'glow16')
      .setTint(CHAR_GLOW[meta.character] ?? COL.g)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow);
    this.tweens.add({ targets: this.orb, alpha: 0.55, scale: 1.25, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });

    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setTint(COL.R).setAlpha(0).setDepth(DEPTH.hud - 1);

    this.createParticles();
    this.createHud();
    this.createInput();

    audio.setRegion(0);
    audio.setIntensity(0);
    transitionIn(this);
  }

  private createParticles() {
    const mk = (cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, tex = 'px') =>
      this.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(DEPTH.fx);
    this.emit = {
      blood: mk({ speed: { min: 15, max: 60 }, angle: { min: 200, max: 340 }, gravityY: 180, lifespan: { min: 250, max: 600 }, tint: [COL.r, COL.R] }),
      bone: mk({ speed: { min: 20, max: 70 }, angle: { min: 200, max: 340 }, gravityY: 200, lifespan: { min: 300, max: 650 }, tint: [COL.w, COL.b, COL.B] }),
      soul: mk({ speed: { min: 4, max: 26 }, angle: { min: 230, max: 310 }, gravityY: -30, lifespan: { min: 400, max: 900 }, tint: [COL.g, COL.G], alpha: { start: 1, end: 0 } }),
      spark: mk({ speed: { min: 20, max: 80 }, lifespan: { min: 100, max: 260 }, tint: [COL.G, 0xffffff], alpha: { start: 1, end: 0 } }),
      gold: mk({ speed: { min: 5, max: 30 }, angle: { min: 230, max: 310 }, gravityY: -20, lifespan: { min: 300, max: 700 }, tint: [COL.y, COL.O, 0xffffff], alpha: { start: 1, end: 0 } }),
      poison: mk({ speed: { min: 3, max: 14 }, angle: { min: 230, max: 310 }, gravityY: -12, lifespan: { min: 500, max: 1100 }, tint: [0x8fbf3a, 0x5a8a2a, 0xc8ff8a], alpha: { start: 0.9, end: 0 } }, 'px2'),
      fire: mk({ speed: { min: 8, max: 30 }, angle: { min: 240, max: 300 }, gravityY: -40, lifespan: { min: 200, max: 500 }, tint: [COL.O, COL.o, COL.R], alpha: { start: 1, end: 0 } }),
      dust: mk({ speed: { min: 20, max: 60 }, angle: { min: 180, max: 360 }, gravityY: 60, lifespan: { min: 300, max: 700 }, tint: [0x3a3340, 0x2a2430, 0x4a4250], alpha: { start: 0.9, end: 0 } }, 'px2'),
      frenzy: mk({ speed: { min: 2, max: 10 }, angle: { min: 250, max: 290 }, lifespan: 400, tint: [COL.R, 0xff6070], alpha: { start: 1, end: 0 } }),
    };
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

    const wave = pxText(this, 4, 2, 'I-1', COL.c).setDepth(DEPTH.hud);
    const soulIcon = this.add.image(80, 4, 'icon-soul').setDepth(DEPTH.hud);
    const souls = pxText(this, 85, 2, '0', COL.G).setDepth(DEPTH.hud);
    this.add.image(132, 4, 'icon-skull').setDepth(DEPTH.hud);
    const army = pxText(this, 138, 2, '0/10', COL.w).setDepth(DEPTH.hud);

    const pause = this.add.image(174, 5, 'icon-pause').setDepth(DEPTH.hud).setInteractive({ useHandCursor: true });
    pause.input!.hitArea.setTo(-5, -5, 15, 15);
    pause.on('pointerdown', () => this.togglePause());

    const schools = unlockedSchools(meta).map((s, i) => {
      const icon = this.add.image(7 + i * 17, 16, `school-${s}`).setDepth(DEPTH.hud).setAlpha(0.35);
      const count = pxText(this, 12 + i * 17, 13, '0', COL.C).setDepth(DEPTH.hud).setAlpha(0.35);
      return { school: s, icon, count };
    });
    const bossName = pxText(this, 90, 22, '', COL.R).setOrigin(0.5, 0).setDepth(DEPTH.hud).setVisible(false);
    this.hud = { wave, souls, soulIcon, army, schools, bossName, hpFlashUntil: 0, hpShake: 0, shownSouls: 0, bossShownHp: 1 };
    this.add.image(3, FIELD.h + 3, 'icon-heart').setOrigin(0).setDepth(DEPTH.hud);
    this.bag = {
      icon: this.add.image(150, 16, 'item-ring_iron').setDepth(DEPTH.hud).setVisible(false),
      count: pxText(this, 156, 13, '', COL.y).setDepth(DEPTH.hud),
    };

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
      const btn: ActionButton = { img, label, can, act, downUntil: 0, x, y };
      img.on('pointerdown', () => this.press(btn));
      this.buttons.push(btn);
    });
  }

  private createInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.ended || this.modalKind || p.y >= FIELD.h || (p.y < 12 && p.x > 160)) return;
      this.drag = { px: p.x, py: p.y, cx: this.world.circle.x, cy: this.world.circle.y };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown || this.modalKind) return;
      this.world.setCircle(this.drag.cx + (p.x - this.drag.px) * DRAG_GAIN, this.drag.cy + (p.y - this.drag.py) * DRAG_GAIN);
    });
    this.input.on('pointerup', () => (this.drag = null));

    const kb = this.input.keyboard;
    if (!kb) return;
    const keys: [string[], number][] = [
      [['ONE', 'Q'], 0],
      [['TWO', 'W'], 1],
      [['THREE', 'E'], 2],
    ];
    for (const [ks, i] of keys) {
      for (const k of ks) {
        kb.on(`keydown-${k}`, () => {
          if (this.modalKind === 'cards') this.pickByIndex(i);
          else if (!this.modalKind) this.press(this.buttons[i]);
        });
      }
    }
    kb.on('keydown-FOUR', () => this.modalKind === 'cards' && this.pickByIndex(3));
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
  }

  private press(b: ActionButton) {
    if (this.ended || this.modalKind) return;
    if (b.act()) {
      b.downUntil = this.time.now + 140;
      buzz('medium');
    } else {
      audio.play('deny');
      this.tweens.add({ targets: [b.img, b.label], x: '+=1', duration: 30, yoyo: true, repeat: 2 });
    }
  }

  // ================================================================ laço

  update(time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.shaker.update(dt);
    if (DEBUG.autopilot && !this.ended && this.modalKind !== 'pause') autopilot(this.world);

    const slow = time < this.slowUntil ? this.slowFactor : 1;
    if (!this.ended && !this.modalKind && time >= this.hitstopUntil) {
      this.acc = Math.min(this.acc + dt * slow, 0.25);
      while (this.acc >= STEP) {
        this.world.update(STEP);
        this.acc -= STEP;
      }
    }
    if (this.modalKind === 'cards' && this.world.phase !== 'choosing') this.closeModal();
    if (this.merchantPending && !this.modalKind && !this.ended && this.world.phase === 'intermission') {
      if (DEBUG.autopilot) this.merchantPending = false;
      else this.showMerchant();
    }

    const events = this.world.events;
    this.world.events = [];
    for (const e of events) this.onEvent(e, time);

    this.overlay.clear();
    this.hudGfx.clear();
    this.syncCorpses(time);
    this.syncUnits(time);
    this.syncProjectiles();
    this.drawClouds(time);
    this.drawTelegraphs(time);
    this.drawCircle(delta);
    this.drawFx(dt);
    this.syncNecro(time);
    this.syncHud(time, dt);
    this.drawDarkness(time, dt);
  }

  // ================================================================ eventos → efeitos

  private onEvent(e: GameEvent, time: number) {
    const w = this.world;
    switch (e.type) {
      case 'bolt':
        this.fxList.push({ kind: 'bolt', pts: this.jagged(e.x1, e.y1, e.x2, e.y2), x: e.x2, y: e.y2, r: 0, color: COL.G, life: 0.12, max: 0.12 });
        this.emit.spark.explode(4, e.x2, e.y2);
        this.tempLights.push({ x: e.x2, y: e.y2, key: 'light24', life: 0.12, max: 0.12 });
        this.castUntil = time + 110;
        audio.play('bolt');
        break;
      case 'hit': {
        const v = this.units.get(e.id);
        if (v) {
          v.flashUntil = time + 70;
          v.squash = 1;
        }
        if (e.dtype === 'poison') {
          if (Math.random() < 0.3) this.emit.poison.explode(1, e.x, e.y - 6);
          break;
        }
        if (e.faction === 'living') {
          this.emit.blood.explode(e.big ? 6 : 3, e.x, e.y - 5);
          audio.play('hit');
          if (e.dmg >= 2 || e.dtype === 'explode') floatText(this, e.x, e.y - 14, `${Math.round(e.dmg)}`, e.dtype === 'explode' ? COL.O : e.big ? COL.y : COL.w, e.big);
        } else {
          this.emit.bone.explode(2, e.x, e.y - 5);
          audio.play('hitDead');
          if (e.dtype === 'holy') {
            this.emit.gold.explode(3, e.x, e.y - 6);
            floatText(this, e.x, e.y - 14, `${Math.round(e.dmg)}`, COL.y);
          }
        }
        break;
      }
      case 'swing': {
        const v = this.units.get(e.id);
        if (v) {
          v.attackUntil = time + 130;
          const dx = e.tx - v.spr.x;
          const dy = e.ty - v.spr.y;
          const len = Math.hypot(dx, dy) || 1;
          v.lungeX = (dx / len) * 3;
          v.lungeY = (dy / len) * 2;
        }
        break;
      }
      case 'shoot': {
        const v = this.units.get(e.id);
        if (v) v.attackUntil = time + 160;
        audio.play('arrow');
        break;
      }
      case 'death':
        this.onDeath(e);
        break;
      case 'raiseStart':
        this.emit.dust.explode(4, e.x, e.y);
        this.emit.soul.explode(4, e.x, e.y);
        break;
      case 'raised':
        this.emit.soul.explode(14, e.x, e.y - 5);
        this.emit.dust.explode(6, e.x, e.y);
        this.tempLights.push({ x: e.x, y: e.y - 5, key: 'light24', life: 0.35, max: 0.35 });
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 2, r: 10, color: COL.g, life: 0.25, max: 0.25 });
        audio.play('raise');
        this.shaker.add(0.06);
        buzz('light');
        break;
      case 'explode':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 3, r: e.r, color: COL.G, life: 0.3, max: 0.3 });
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 3, r: e.r * 0.6, color: 0xffffff, life: 0.15, max: 0.15 });
        this.emit.soul.explode(12, e.x, e.y - 3);
        this.emit.bone.explode(14, e.x, e.y - 3);
        this.emit.spark.explode(10, e.x, e.y - 3);
        this.emit.fire.explode(8, e.x, e.y - 3);
        this.decals.draw('scorch', Math.round(e.x - 4), Math.round(e.y - 3));
        this.tempLights.push({ x: e.x, y: e.y, key: 'light48', scale: 1.4, life: 0.35, max: 0.35 });
        this.shaker.add(0.32);
        this.shaker.kick((Math.random() - 0.5) * 4, 2);
        this.hitstop(45);
        flash(this, 0xffffff, 0.12, 90);
        audio.play('explode');
        buzz('heavy');
        break;
      case 'fuse':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 6, r: 22, color: COL.g, life: 0.4, max: 0.4 });
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 6, r: 10, color: COL.w, life: 0.25, max: 0.25 });
        this.emit.soul.explode(28, e.x, e.y - 8);
        this.emit.bone.explode(16, e.x, e.y - 8);
        this.tempLights.push({ x: e.x, y: e.y - 6, key: 'light48', scale: 1.3, life: 0.5, max: 0.5 });
        this.shaker.add(0.35);
        this.hitstop(70);
        audio.play('fuse');
        buzz('heavy');
        break;
      case 'consume':
        this.fxList.push({ kind: 'beam', pts: [e.x, e.y - 5, NECRO.x, NECRO.y - 8], x: e.x, y: e.y, r: 0, color: COL.G, life: 0.3, max: 0.3 });
        this.flyMotes(e.x, e.y - 5, NECRO.x, NECRO.y - 8, 5, COL.G);
        audio.play('consume');
        break;
      case 'heal':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 4, r: e.r, color: e.faction === 'living' ? COL.y : COL.g, life: 0.4, max: 0.4 });
        (e.faction === 'living' ? this.emit.gold : this.emit.soul).explode(10, e.x, e.y - 8);
        this.tempLights.push({ x: e.x, y: e.y - 4, key: 'light24', life: 0.4, max: 0.4 });
        audio.play('heal');
        break;
      case 'necroHit':
        this.necroFlashUntil = time + 120;
        this.hud.hpFlashUntil = time + 220;
        this.hud.hpShake = 1;
        this.emit.blood.explode(7, NECRO.x, NECRO.y - 8);
        this.shaker.add(0.3);
        this.shaker.kick(Math.sign(NECRO.x - e.x) * 2, 2);
        this.vignette.setAlpha(0.5);
        this.hitstop(35);
        floatText(this, NECRO.x + 8, NECRO.y - 22, `-${Math.round(e.dmg)}`, COL.R, e.dmg >= 3);
        audio.play('hurt');
        buzz('heavy');
        break;
      case 'necroHeal':
        floatText(this, NECRO.x - 8, NECRO.y - 22, `+${Math.round(e.amount)}`, COL.G);
        this.emit.soul.explode(8, NECRO.x, NECRO.y - 6);
        break;
      case 'burn':
        this.emit.fire.explode(10, e.x, e.y - 2);
        this.decals.draw('scorch', Math.round(e.x - 4), Math.round(e.y - 3));
        audio.play('burn');
        break;
      case 'holyBurst':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, color: COL.y, life: 0.3, max: 0.3 });
        this.emit.gold.explode(8, e.x, e.y);
        this.tempLights.push({ x: e.x, y: e.y, key: 'light48', life: 0.3, max: 0.3 });
        audio.play('holy');
        break;
      case 'scream':
        this.fxList.push({ kind: 'ring', x: NECRO.x, y: NECRO.y - 10, r: 220, color: 0x8fd3ff, life: 0.7, max: 0.7 });
        this.fxList.push({ kind: 'ring', x: NECRO.x, y: NECRO.y - 10, r: 140, color: 0xffffff, life: 0.5, max: 0.5 });
        flash(this, 0x8fd3ff, 0.25, 250);
        this.shaker.add(0.45);
        audio.play('scream');
        buzz('heavy');
        break;
      case 'telegraphEnd':
        this.onTelegraphEnd(e);
        break;
      case 'charge':
        audio.play('whoosh');
        break;
      case 'summon':
        this.emit.dust.explode(18, e.x, e.y);
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y, r: 20, color: COL.R, life: 0.3, max: 0.3 });
        audio.play('warn');
        break;
      case 'cloud':
        this.emit.poison.explode(10, e.x, e.y - 2);
        audio.play('burn', 0.5);
        break;
      case 'regionStart':
        this.onRegionStart(e.region);
        break;
      case 'waveStart':
        if (!e.boss) this.banner(`ONDA ${e.local}`, COL.R, 120, w.region.name.toUpperCase());
        audio.play('bell');
        audio.setIntensity(e.boss ? 2 : 1);
        break;
      case 'bossSpawn':
        this.onBossSpawn(e.boss);
        break;
      case 'bossDeath':
        this.onBossDeath(e.boss, e.x, e.y);
        break;
      case 'waveCleared':
        this.onWaveCleared(e.souls);
        break;
      case 'cardOffer':
        this.time.delayedCall(650, () => this.world.phase === 'choosing' && !this.ended && this.showCards());
        break;
      case 'synergy':
        this.onSynergy(e.school, e.level);
        break;
      case 'scythe':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, color: 0xe3dccb, life: 0.22, max: 0.22 });
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y, r: e.r * 0.7, color: 0xffffff, life: 0.14, max: 0.14 });
        for (let a = 0; a < 6; a++) this.emit.spark.explode(2, e.x + Math.cos(a) * e.r * 0.8, e.y + Math.sin(a) * e.r * 0.8);
        this.castUntil = time + 160;
        this.shaker.add(0.08);
        audio.play('whoosh');
        break;
      case 'itemDrop':
        this.onItemDrop(e.item, e.x, e.y);
        break;
      case 'gameOver':
        this.onGameOver();
        break;
    }
  }

  /** Item caiu: feixe na cor da raridade, ícone salta e voa para a bolsa. */
  private onItemDrop(id: string, x: number, y: number) {
    const it = ITEM_BY_ID[id];
    const color = parseInt(RARITY_COLOR[it.rarity].slice(1), 16);
    const big = it.rarity === 'rare' || it.rarity === 'legendary';
    this.fxList.push({ kind: 'column', x, y: 0, r: big ? 6 : 3, color, life: 0.6, max: 0.6 });
    this.tempLights.push({ x, y: y - 6, key: 'light48', life: 0.8, max: 0.8 });
    this.emit.gold.explode(big ? 24 : 10, x, y - 6);
    audio.play(big ? 'synergy' : 'buy');
    buzz(big ? 'heavy' : 'medium');
    if (big) this.shaker.add(it.rarity === 'legendary' ? 0.6 : 0.3);
    if (it.rarity === 'legendary') flash(this, color, 0.3, 300);
    const icon = this.add.image(x, y - 6, `item-${id}`).setDepth(DEPTH.hud + 2).setScale(2);
    const frame = this.add.image(x, y - 6, `slot-${it.rarity}`).setDepth(DEPTH.hud + 1).setScale(0.9);
    const name = pxText(this, x, y - 24, it.name.toUpperCase(), color).setOrigin(0.5).setDepth(DEPTH.hud + 2);
    name.x = Phaser.Math.Clamp(x, name.width / 2 + 2, FIELD.w - name.width / 2 - 2);
    this.tweens.add({ targets: [icon, frame], y: y - 22, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: name, y: y - 40, alpha: 0, delay: 700, duration: 400, onComplete: () => name.destroy() });
    this.tweens.add({
      targets: [icon, frame],
      x: this.bag.icon.x,
      y: this.bag.icon.y,
      scale: 0.5,
      delay: 800,
      duration: 450,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        icon.destroy();
        frame.destroy();
        this.bag.icon.setTexture(`item-${id}`).setVisible(true);
        setPxText(this.bag.count, `${this.world.loot.length}`);
        this.tweens.add({ targets: this.bag.icon, scale: 1.8, duration: 80, yoyo: true });
        audio.play('soul');
      },
    });
  }

  private onDeath(e: Extract<GameEvent, { type: 'death' }>) {
    const v = this.units.get(e.id);
    if (e.boss) return; // tratado em bossDeath
    if (e.faction === 'living') {
      this.emit.blood.explode(12, e.x, e.y - 5);
      this.decals.draw('splat', Math.round(e.x - 4), Math.round(e.y - 3));
      audio.play('death');
      this.shaker.add(0.04);
      if (v) this.fallAnimation(v, e.facing);
    } else if (e.spent) {
      if (v) {
        const g = this.add.sprite(v.spr.x, v.spr.y, v.spr.texture.key).setOrigin(0.5, 1).setFlipX(v.spr.flipX).setDepth(v.spr.depth).setTintFill(COL.G);
        this.tweens.add({ targets: g, scaleX: 1.5, scaleY: 0.3, alpha: 0, duration: 170, onComplete: () => g.destroy() });
      }
    } else {
      this.emit.bone.explode(e.kind === 'giant' || e.kind === 'champion' ? 24 : 10, e.x, e.y - 5);
      audio.play('bones');
      if (v) {
        const c = this.add.sprite(v.spr.x, v.spr.y, v.spr.texture.key).setOrigin(0.5, 1).setFlipX(v.spr.flipX).setDepth(v.spr.depth);
        this.tweens.add({ targets: c, scaleY: 0.1, scaleX: 1.3, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
      }
    }
  }

  /** O vivo tomba de lado antes de virar cadáver. */
  private fallAnimation(v: UnitView, facing: 1 | -1) {
    const f = this.add.sprite(v.spr.x, v.spr.y, `${v.key}0`).setOrigin(0.5, 1).setFlipX(v.spr.flipX).setDepth(v.spr.depth).setTintFill(0xffffff);
    this.time.delayedCall(50, () => f.active && f.clearTint());
    this.tweens.add({ targets: f, angle: -90 * facing, y: f.y - 2, duration: 170, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: f, alpha: 0, delay: 150, duration: 80, onComplete: () => f.destroy() });
  }

  private onTelegraphEnd(e: Extract<GameEvent, { type: 'telegraphEnd' }>) {
    const vsLiving = e.hits === 'living';
    switch (e.ability) {
      case 'slam':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, color: vsLiving ? COL.G : COL.R, life: 0.35, max: 0.35 });
        this.emit.dust.explode(24, e.x, e.y);
        this.decals.draw('scorch', Math.round(e.x - 4), Math.round(e.y - 3));
        this.shaker.add(vsLiving ? 0.3 : 0.55);
        this.hitstop(70);
        flash(this, vsLiving ? COL.g : 0xffffff, 0.15, 100);
        audio.play('slam');
        buzz('heavy');
        break;
      case 'nova':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 4, r: e.r, color: COL.y, life: 0.4, max: 0.4 });
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 4, r: e.r * 0.6, color: 0xffffff, life: 0.25, max: 0.25 });
        this.emit.gold.explode(20, e.x, e.y - 4);
        this.tempLights.push({ x: e.x, y: e.y, key: 'light80', life: 0.4, max: 0.4 });
        flash(this, COL.y, 0.15, 150);
        this.shaker.add(0.3);
        audio.play('holy');
        buzz('medium');
        break;
      case 'beam':
        this.fxList.push({ kind: 'column', x: e.x, y: 0, r: e.r, color: vsLiving ? COL.G : 0xfff0b0, life: 0.35, max: 0.35 });
        for (let y = 20; y < FIELD.h; y += 24) {
          (vsLiving ? this.emit.soul : this.emit.gold).explode(3, e.x, y);
          this.tempLights.push({ x: e.x, y, key: 'light24', life: 0.35, max: 0.35 });
        }
        flash(this, vsLiving ? COL.g : 0xfff0b0, 0.2, 150);
        this.shaker.add(0.45);
        this.hitstop(50);
        audio.play('holy');
        audio.play('slam');
        buzz('heavy');
        break;
      case 'charge':
        this.shaker.add(0.2);
        break;
      default:
        break;
    }
  }

  private onRegionStart(region: number) {
    const w = this.world;
    const r = w.region;
    const abyss = w.abyss;
    audio.setRegion(abyss > 0 ? 4 : region % 4);
    const title = abyss > 0 ? circleName(abyss).toUpperCase() : ROMAN[region % 4];
    const show = () => this.regionCard(title, r.name.toUpperCase(), abyss > 0 ? 'o abismo te encara' : r.subtitle, abyss > 0);
    if (region === 0) {
      show();
      return;
    }
    curtain(this, () => {
      this.scenery.build(region % 4, abyss);
      this.dark.color = abyss > 0 ? 0x1a0306 : 0x050309;
      this.dark.amount = abyss > 0 ? 0.62 : region % 4 === 3 ? 0.5 : 0.54;
      this.decals.clear();
      show();
    });
  }

  private regionCard(numeral: string, name: string, subtitle: string, abyss: boolean) {
    const color = abyss ? COL.R : COL.G;
    const objs = [
      pxText(this, 90, 92, numeral, color).setOrigin(0.5).setScale(2),
      pxText(this, 90, 112, name, COL.w).setOrigin(0.5).setScale(2),
      pxText(this, 90, 128, subtitle, COL.C).setOrigin(0.5),
    ];
    const line = this.add.rectangle(90, 102, 90, 1, color).setDepth(DEPTH.hud).setScale(0, 1);
    this.tweens.add({ targets: line, scaleX: 1, duration: 400, ease: 'Cubic.easeOut' });
    objs.forEach((o, i) => {
      o.setDepth(DEPTH.hud).setAlpha(0);
      o.y += 6;
      this.tweens.add({ targets: o, alpha: 1, y: o.y - 6, delay: 100 + i * 120, duration: 350, ease: 'Cubic.easeOut' });
    });
    this.tweens.add({ targets: [...objs, line], alpha: 0, delay: 2000, duration: 400, onComplete: () => [...objs, line].forEach((o) => o.destroy()) });
  }

  private onBossSpawn(boss: BossKind) {
    const def = BOSS_DEFS[boss];
    this.dark.amount += 0.1;
    this.time.delayedCall(1800, () => (this.dark.amount -= 0.1));
    this.shaker.add(0.6);
    flash(this, COL.R, 0.25, 300);
    audio.play('boss');
    buzz('heavy');
    const t1 = pxText(this, -60, 120, def.name.toUpperCase(), COL.R).setOrigin(0.5).setScale(2).setDepth(DEPTH.hud);
    const t2 = pxText(this, 90, 136, 'CHEFE', COL.C).setOrigin(0.5).setDepth(DEPTH.hud).setAlpha(0);
    this.tweens.add({ targets: t1, x: 90, duration: 450, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t2, alpha: 1, delay: 300, duration: 300 });
    this.tweens.add({ targets: [t1, t2], alpha: 0, delay: 2000, duration: 400, onComplete: () => [t1, t2].forEach((t) => t.destroy()) });
    setPxText(this.hud.bossName, def.name.toUpperCase());
    this.hud.bossShownHp = 1;
  }

  private onBossDeath(boss: BossKind, x: number, y: number) {
    this.slowFactor = 0.2;
    this.slowUntil = this.time.now + 1100;
    flash(this, 0xffffff, 0.7, 400);
    this.shaker.add(1);
    this.hitstop(120);
    shatter(this, `${boss}0`, x, y, { power: 80 });
    this.emit.blood.explode(40, x, y - 14);
    this.emit.gold.explode(30, x, y - 14);
    this.tempLights.push({ x, y: y - 14, key: 'light80', scale: 1.5, life: 1, max: 1 });
    audio.play('bossDeath');
    buzz('heavy');
    this.time.delayedCall(180, () => buzz('heavy'));
    this.time.delayedCall(360, () => buzz('heavy'));
    const rank = Math.min(5, (meta.champions[boss] ?? 0) + 1);
    this.time.delayedCall(900, () => this.banner(rank > 1 ? `CAMPEÃO RANK ${rank}` : 'NOVO CAMPEÃO', COL.y, 150, BOSS_DEFS[boss].name.toUpperCase()));
  }

  private onWaveCleared(souls: number) {
    audio.setIntensity(0);
    if (this.world.localWave === 3) this.merchantPending = true;
    this.banner(`+${souls} ALMAS`, COL.G, 120);
    let i = 0;
    for (const u of this.world.units) {
      if (u.faction !== 'dead' || i > 14) continue;
      const { x, y } = u;
      this.time.delayedCall(i * 50, () => this.flyMotes(x, y - 6, this.hud.soulIcon.x, this.hud.soulIcon.y, 1, COL.G, true));
      i++;
    }
  }

  private onSynergy(school: School, level: 1 | 2) {
    const info = SCHOOLS[school];
    const color = hexOf(info.color);
    this.time.delayedCall(250, () => {
      flash(this, color, 0.35, 350);
      this.shaker.add(0.5);
      audio.play('synergy');
      buzz('heavy');
      const title = level === 1 ? `MAESTRIA: ${info.name.toUpperCase()}` : `DOMÍNIO: ${info.dominionName.toUpperCase()}`;
      const scale = level === 2 ? 2 : 1;
      const t1 = pxText(this, 90, 56, title, color).setOrigin(0.5).setScale(scale * 1.5).setDepth(DEPTH.hud).setAlpha(0);
      const t2 = pxText(this, 90, 68, wrap(level === 1 ? info.mastery : info.dominion, 40), COL.c).setOrigin(0.5, 0).setCenterAlign().setDepth(DEPTH.hud).setAlpha(0);
      this.tweens.add({ targets: [t1, t2], alpha: 1, duration: 250 });
      this.tweens.add({ targets: t1, scale, duration: 350, ease: 'Back.easeOut' });
      this.tweens.add({ targets: [t1, t2], alpha: 0, delay: 2600, duration: 400, onComplete: () => [t1, t2].forEach((t) => t.destroy()) });
      const p = this.add
        .particles(0, 0, 'px2', {
          x: { min: 0, max: 180 },
          y: { min: 290, max: 296 },
          speedY: { min: -120, max: -40 },
          lifespan: 1400,
          tint: [color, 0xffffff],
          alpha: { start: 1, end: 0 },
          quantity: 4,
          frequency: 20,
          duration: 600,
        })
        .setDepth(DEPTH.fx);
      this.time.delayedCall(2200, () => p.destroy());
    });
  }

  private onGameOver() {
    this.ended = true;
    audio.play('gameOver');
    audio.setIntensity(0);
    buzz('heavy');
    this.shaker.add(0.9);
    flash(this, COL.R, 0.5, 600);
    shatter(this, `${this.necroKey}0`, NECRO.x, NECRO.y + 4, { power: 50 });
    this.necro.setVisible(false);
    this.orb.setVisible(false);
    this.time.delayedCall(1300, () => this.showResults(false));
  }

  // ================================================================ sincronizar sprites

  private syncUnits(time: number) {
    const seen = new Set<number>();
    const w = this.world;
    for (const u of w.units) {
      if (!u.alive) continue;
      seen.add(u.id);
      const v = this.units.get(u.id) ?? this.makeUnitView(u, time);
      const lx = Math.round(v.lungeX);
      const ly = Math.round(v.lungeY);
      v.lungeX *= 0.75;
      v.lungeY *= 0.75;
      v.squash = Math.max(0, v.squash - 0.15);
      const sq = v.squash * 0.25;
      let sx = 1 + sq;
      let sy = 1 - sq;
      // ao levantar: estica e assenta
      const age = time - v.born;
      if (age < 220) {
        sx = 0.6 + (age / 220) * 0.4;
        sy = 1.4 - (age / 220) * 0.4;
      }
      v.spr.setScale(sx, sy);
      const bob = u.kind === 'ghost' ? Math.round(Math.sin(time * 0.006 + u.id) * 1.5) - 2 : 0;
      v.spr.setPosition(Math.round(u.x) + lx, Math.round(u.y) + ly + bob).setDepth(DEPTH.world + u.y);
      v.spr.setFlipX(u.facing < 0);
      v.shadow.setPosition(Math.round(u.x), Math.round(u.y));

      if (time < v.attackUntil) {
        if (v.spr.anims.isPlaying) v.spr.anims.pause();
        v.spr.setTexture(`${v.key}2`);
      } else {
        if (v.spr.anims.isPaused) v.spr.anims.resume();
        v.spr.anims.timeScale = u.stunT > 0 ? 0.01 : u.moving ? 1 : 0.25;
      }

      if (time < v.flashUntil) v.spr.setTintFill(0xffffff);
      else if (u.stunT > 0) v.spr.setTint(0x90b8ff);
      else if (u.faction === 'living' && u.poisonT > 0) v.spr.setTint(0xb8f090);
      else if (u.faction === 'dead' && w.frenzyT > 0) v.spr.setTint(0xffa0a0);
      else v.spr.clearTint();
      if (u.kind === 'ghost') v.spr.setAlpha(0.8);
      if (v.outline) {
        const pulse = 0.55 + Math.sin(time * 0.012) * 0.45;
        for (const o of v.outline) {
          const [dx, dy] = o.getData('d') as [number, number];
          o.setTexture(v.spr.texture.key, v.spr.frame.name).setPosition(v.spr.x + dx, v.spr.y + dy).setFlipX(v.spr.flipX);
          o.setScale(v.spr.scaleX, v.spr.scaleY).setDepth(v.spr.depth - 0.5).setAlpha(pulse);
        }
        if (Math.random() < 0.06) this.emit.gold.explode(1, u.x + Phaser.Math.Between(-4, 4), u.y - v.spr.height);
      }

      // rastro da investida
      if (u.chargeT > 0 && time > v.trailAt) {
        v.trailAt = time + 35;
        const g = this.add.sprite(v.spr.x, v.spr.y, v.spr.texture.key).setOrigin(0.5, 1).setFlipX(v.spr.flipX).setDepth(v.spr.depth - 1);
        g.setTintFill(u.faction === 'living' ? COL.R : COL.G).setAlpha(0.5);
        this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
      }
      if (u.faction === 'dead' && w.frenzyT > 0 && Math.random() < 0.05) this.emit.frenzy.explode(1, u.x, u.y - 8);
      if (u.stunT > 0 && Math.random() < 0.1) this.emit.spark.explode(1, u.x, u.y - v.spr.displayHeight);

      if (u.hp < u.maxHp && !UNIT_DEFS[u.kind].boss) {
        const top = Math.round(u.y - v.spr.height - 3);
        const bw = u.radius >= 7 ? 14 : 8;
        const x = Math.round(u.x - bw / 2);
        this.overlay.fillStyle(COL.k).fillRect(x - 1, top - 1, bw + 2, 3);
        this.overlay.fillStyle(u.faction === 'living' ? COL.R : COL.g).fillRect(x, top, Math.max(1, Math.round((bw * u.hp) / u.maxHp)), 1);
      }
    }
    for (const [id, v] of this.units) {
      if (seen.has(id)) continue;
      v.spr.destroy();
      v.shadow.destroy();
      for (const o of v.outline ?? []) o.destroy();
      this.units.delete(id);
    }
  }

  private makeUnitView(u: Unit, time: number): UnitView {
    const key = unitKey(u.kind, u.boss);
    const spr = this.add.sprite(u.x, u.y, `${key}0`).setOrigin(0.5, 1);
    spr.play({ key: `${key}-walk`, startFrame: u.id % 2 });
    const shadow = this.add.image(u.x, u.y, 'shadow').setAlpha(0.6).setDepth(DEPTH.decal + 1);
    if (u.radius >= 7) shadow.setScale(2, 1.5);
    const v: UnitView = { spr, shadow, key, flashUntil: 0, attackUntil: 0, lungeX: 0, lungeY: 0, squash: 0, trailAt: 0, born: u.faction === 'dead' ? time : -1000 };
    if (u.faction === 'living') {
      spr.setAlpha(0);
      this.tweens.add({ targets: spr, alpha: 1, duration: 250 });
    }
    if (u.elite) {
      // contorno dourado: 4 cópias deslocadas atrás do sprite
      v.outline = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ].map(([dx, dy]) => this.add.sprite(u.x + dx, u.y + dy, `${key}0`).setOrigin(0.5, 1).setTintFill(0xf6cf6a).setData('d', [dx, dy]));
    }
    if (u.kind === 'champion') {
      this.emit.soul.explode(20, u.x, u.y - 10);
      this.fxList.push({ kind: 'column', x: u.x, y: 0, r: 6, color: COL.G, life: 0.5, max: 0.5 });
    }
    this.units.set(u.id, v);
    return v;
  }

  private syncCorpses(time: number) {
    const seen = new Set<number>();
    const w = this.world;
    for (const c of w.corpses) {
      seen.add(c.id);
      const v = this.corpses.get(c.id) ?? this.makeCorpseView(c, time);
      const appear = Math.min(1, Math.max(0, (time - v.shownAt) / 120));
      if (c.raise >= 0) {
        if (!v.rising) v.rising = this.add.image(Math.round(c.x), Math.round(c.y), 'skel0').setOrigin(0.5, 1).setDepth(DEPTH.world + c.y);
        const h = v.rising.height;
        const shown = Math.max(1, Math.ceil(h * c.raise));
        v.rising.setCrop(0, 0, v.rising.width, shown);
        v.rising.x = Math.round(c.x) + (Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0);
        v.rising.y = Math.round(c.y) + (h - shown);
        v.rising.setTintFill(time % 160 < 80 ? COL.G : COL.g);
        v.img.setAlpha(1 - c.raise);
        if (Math.random() < 0.25) this.emit.soul.explode(1, c.x + Phaser.Math.Between(-4, 4), c.y);
      } else if (c.holy || !c.raisable) {
        v.img.setTint(0xe8d9a0).setAlpha(appear);
        if (c.holy && Math.random() < 0.03) this.emit.gold.explode(1, c.x, c.y - 2);
      } else {
        v.img.clearTint();
        const life = w.mods.corpseLife;
        v.img.setAlpha(c.age > life - 2 ? (time % 240 < 120 ? 0.35 : 0.8) : appear);
      }
    }
    for (const [id, v] of this.corpses) {
      if (seen.has(id)) continue;
      if (!v.rising) {
        const img = v.img;
        this.tweens.add({ targets: img, alpha: 0, y: img.y + 2, duration: 200, onComplete: () => img.destroy() });
      } else {
        v.img.destroy();
        v.rising.destroy();
      }
      this.corpses.delete(id);
    }
  }

  private makeCorpseView(c: Corpse, time: number): CorpseView {
    const key = c.bones ? 'corpse-bones' : `corpse-${c.kind}`;
    const img = this.add
      .image(Math.round(c.x), Math.round(c.y) + 1, this.textures.exists(key) ? key : 'corpse-peasant')
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.world + c.y - 2)
      .setAlpha(0)
      .setFlipX(c.id % 2 === 0);
    const v: CorpseView = { img, shownAt: time + (c.bones ? 0 : 160) };
    this.corpses.set(c.id, v);
    return v;
  }

  private syncProjectiles() {
    const seen = new Set<number>();
    for (const p of this.world.projectiles) {
      seen.add(p.id);
      let img = this.projectiles.get(p.id);
      if (!img) {
        const key = p.faction === 'dead' ? 'bonearrow' : p.sourceKind === 'crossbow' || p.sourceKind === 'witchhunter' ? 'boltp' : 'arrow';
        img = this.add.image(p.x, p.y, key).setDepth(DEPTH.fx);
        this.projectiles.set(p.id, img);
      }
      img.setPosition(Math.round(p.x), Math.round(p.y));
      img.setRotation(Math.atan2(p.ty - p.y, p.tx - p.x));
    }
    for (const [id, img] of this.projectiles) {
      if (seen.has(id)) continue;
      this.emit.spark.explode(2, img.x, img.y);
      img.destroy();
      this.projectiles.delete(id);
    }
  }

  private syncNecro(time: number) {
    const n = this.world.necro;
    if (time < this.castUntil) {
      this.necro.anims.pause();
      this.necro.setTexture(`${this.necroKey}-cast`);
    } else if (this.necro.anims.isPaused) {
      this.necro.anims.resume();
    }
    if (time < this.necroFlashUntil) this.necro.setTintFill(COL.R);
    else this.necro.clearTint();

    // vida baixa: vinheta pulsando e batida de coração
    const low = n.hp > 0 && n.hp <= n.maxHp * 0.3;
    const target = low ? 0.25 + Math.sin(time * 0.008) * 0.15 : 0;
    this.vignette.setAlpha(Math.max(target, this.vignette.alpha - 0.02));
    if (low && !this.ended && !this.modalKind && time > this.nextBeat) {
      this.nextBeat = time + 1100;
      heartbeat();
    }
  }

  // ================================================================ desenho

  private drawCircle(delta: number) {
    if (this.ended) return;
    const g = this.overlay;
    const { x, y, r } = this.world.circle;
    this.spin += delta * 0.012;
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (this.drag) {
      g.fillStyle(COL.g, 0.35);
      for (let a = Math.PI; a < Math.PI * 2; a += 1 / CIRCLE_REACH) {
        const px = Math.round(NECRO.x + Math.cos(a) * CIRCLE_REACH);
        const py = Math.round(NECRO.y + Math.sin(a) * CIRCLE_REACH);
        if ((px + py) % 4 === 0 && px >= 0 && px < FIELD.w) g.fillRect(px, py, 1, 1);
      }
    }
    const miasma = this.world.mods.circleMiasma > 0;
    g.fillStyle(miasma ? 0x8fbf3a : COL.g, miasma ? 0.1 : 0.06).fillCircle(cx, cy, r);
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
    for (let i = 0; i < 4; i++) {
      const a = this.spin * 0.05 + (i * Math.PI) / 2;
      g.fillStyle(COL.G, 1).fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
    }
  }

  private drawTelegraphs(time: number) {
    const g = this.overlay;
    for (const t of this.world.telegraphs) {
      if (!this.seenTelegraphs.has(t.id)) {
        this.seenTelegraphs.add(t.id);
        audio.play('warn');
      }
      const p = 1 - t.t / t.max;
      const pulse = 0.5 + Math.sin(time * 0.03) * 0.5;
      const color = t.ability === 'nova' || t.ability === 'beam' ? COL.y : COL.R;
      if (t.shape === 'circle') {
        const owner = t.ability === 'nova' ? this.world.units.find((u) => u.id === t.ownerId) : undefined;
        const cx = owner ? owner.x : t.x;
        const cy = owner ? owner.y : t.y;
        g.fillStyle(color, 0.08 + pulse * 0.08).fillCircle(cx, cy, t.r);
        g.fillStyle(color, 0.25).fillCircle(cx, cy, t.r * p);
        g.lineStyle(1, color, 0.6 + pulse * 0.4).strokeCircle(cx, cy, t.r);
      } else {
        const dx = t.x2 - t.x;
        const dy = t.y2 - t.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * t.r;
        const ny = (dx / len) * t.r;
        const poly = (k: number) => [
          { x: t.x + nx, y: t.y + ny },
          { x: t.x + dx * k + nx, y: t.y + dy * k + ny },
          { x: t.x + dx * k - nx, y: t.y + dy * k - ny },
          { x: t.x - nx, y: t.y - ny },
        ];
        g.fillStyle(color, 0.08 + pulse * 0.08).fillPoints(poly(1), true);
        g.fillStyle(color, 0.22).fillPoints(poly(Math.max(0.01, p)), true);
        g.lineStyle(1, color, 0.6 + pulse * 0.4).strokePoints(poly(1), true);
      }
    }
  }

  private drawClouds(time: number) {
    const g = this.overlay;
    for (const c of this.world.clouds) {
      const a = Math.min(1, c.t / 0.5) * 0.18;
      g.fillStyle(0x8fbf3a, a).fillCircle(c.x, c.y - 2, c.r);
      g.fillStyle(0xc8ff8a, a * 0.6).fillCircle(c.x + Math.sin(time * 0.004 + c.id) * 3, c.y - 4, c.r * 0.6);
      if (Math.random() < 0.15) this.emit.poison.explode(1, c.x + Phaser.Math.Between(-c.r, c.r), c.y + Phaser.Math.Between(-c.r / 2, c.r / 2));
    }
  }

  private drawFx(dt: number) {
    const g = this.overlay;
    for (const f of this.fxList) {
      f.life -= dt;
      const t = Math.max(0, f.life / f.max);
      if (f.kind === 'bolt' && f.pts) {
        g.lineStyle(2, COL.g, t * 0.5).strokePoints(this.toPoints(f.pts));
        g.lineStyle(1, f.color, t).strokePoints(this.toPoints(f.pts));
      } else if (f.kind === 'beam' && f.pts) {
        g.lineStyle(1, f.color, t).lineBetween(f.pts[0], f.pts[1], f.pts[2], f.pts[3]);
      } else if (f.kind === 'ring') {
        g.lineStyle(1, f.color, t).strokeCircle(f.x, f.y, Math.round(f.r * (1.1 - t * 0.7)));
      } else if (f.kind === 'column') {
        const wdt = Math.max(1, Math.round(f.r * 2 * t));
        g.fillStyle(f.color, t * 0.8).fillRect(Math.round(f.x - wdt / 2), 0, wdt, FIELD.h);
        g.fillStyle(0xffffff, t).fillRect(Math.round(f.x - wdt / 4), 0, Math.max(1, Math.round(wdt / 2)), FIELD.h);
      }
    }
    this.fxList = this.fxList.filter((f) => f.life > 0);
  }

  private toPoints(arr: number[]): Phaser.Types.Math.Vector2Like[] {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < arr.length; i += 2) pts.push({ x: arr[i], y: arr[i + 1] });
    return pts;
  }

  private jagged(x1: number, y1: number, x2: number, y2: number): number[] {
    const pts = [x1, y1];
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      pts.push(x1 + (x2 - x1) * t + Phaser.Math.Between(-3, 3), y1 + (y2 - y1) * t + Phaser.Math.Between(-3, 3));
    }
    pts.push(x2, y2);
    return pts;
  }

  /** Partículas que voam de um ponto a outro (almas indo para o contador ou para o necromante). */
  private flyMotes(x1: number, y1: number, x2: number, y2: number, n: number, color: number, toHud = false) {
    for (let i = 0; i < n; i++) {
      const m = this.add.image(x1, y1, 'px2').setTint(color).setDepth(toHud ? DEPTH.hud + 2 : DEPTH.fx);
      const cx = (x1 + x2) / 2 + Phaser.Math.Between(-30, 30);
      const cy = Math.min(y1, y2) - Phaser.Math.Between(10, 40);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x1, y1), new Phaser.Math.Vector2(cx, cy), new Phaser.Math.Vector2(x2, y2));
      const s = { t: 0 };
      this.tweens.add({
        targets: s,
        t: 1,
        delay: i * 40,
        duration: 450 + Math.random() * 150,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          const p = curve.getPoint(s.t);
          m.setPosition(Math.round(p.x), Math.round(p.y));
        },
        onComplete: () => {
          m.destroy();
          if (toHud) {
            audio.play('soul');
            this.tweens.add({ targets: this.hud.soulIcon, scale: 1.6, duration: 60, yoyo: true });
          }
        },
      });
    }
  }

  private drawDarkness(time: number, dt: number) {
    for (const l of this.tempLights) l.life -= dt;
    this.tempLights = this.tempLights.filter((l) => l.life > 0);
    const { x, y, r } = this.world.circle;
    const lights: Light[] = [...this.scenery.lights, { x: NECRO.x, y: NECRO.y - 8, key: 'light80' }];
    if (!this.ended) lights.push({ x, y, key: 'light80', scale: (r * 2.4) / 80, alpha: 0.75 });
    for (const l of this.tempLights) lights.push({ ...l, alpha: l.life / l.max });
    for (const u of this.world.units) {
      if (u.kind === 'torch' || u.kind === 'nun') lights.push({ x: u.x, y: u.y - 10, key: 'light24' });
      else if (u.elite) lights.push({ x: u.x, y: u.y - 8, key: 'light24', alpha: 0.8 });
    }
    for (const t of this.world.telegraphs) lights.push({ x: t.x, y: t.y, key: 'light24', alpha: 0.6 });
    this.dark.draw(lights, time);
  }

  // ================================================================ HUD

  private syncHud(time: number, dt: number) {
    const w = this.world;
    const label = w.abyss > 0 ? `C${w.abyss}-${w.localWave}` : `${ROMAN[w.regionIndex % 4]}-${Math.max(1, w.localWave)}`;
    setPxText(this.hud.wave, label);
    const souls = Math.floor(w.souls);
    if (this.hud.shownSouls < souls) this.hud.shownSouls += Math.max(1, Math.round((souls - this.hud.shownSouls) * 0.15));
    if (this.hud.shownSouls > souls) this.hud.shownSouls = souls;
    setPxText(this.hud.souls, `${this.hud.shownSouls}`);
    const used = w.armyUsed();
    setPxText(this.hud.army, `${used}/${w.mods.armyCap}`);
    this.hud.army.setTint(used >= w.mods.armyCap ? COL.y : COL.w);

    const counts = w.schoolCounts();
    for (const s of this.hud.schools) {
      const n = counts[s.school];
      setPxText(s.count, `${n}`);
      const on = n > 0;
      s.icon.setAlpha(on ? 1 : 0.35);
      s.count.setAlpha(on ? 1 : 0.35).setTint(n >= DOMINION_AT ? COL.y : n >= MASTERY_AT ? COL.G : COL.C);
    }

    // barra do chefe
    const boss = w.boss;
    if (boss) {
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      this.hud.bossShownHp += (ratio - this.hud.bossShownHp) * Math.min(1, dt * 4);
      const bx = 20;
      const by = 30;
      const bw = 140;
      const g = this.hudGfx;
      g.fillStyle(COL.k).fillRect(bx - 1, by - 1, bw + 2, 5);
      g.fillStyle(0x3a0c18).fillRect(bx, by, bw, 3);
      g.fillStyle(0xf6cf6a).fillRect(bx, by, Math.round(bw * this.hud.bossShownHp), 3);
      g.fillStyle(ratio < 0.5 && time % 300 < 150 ? 0xff6070 : COL.R).fillRect(bx, by, Math.round(bw * ratio), 3);
      this.hud.bossName.setVisible(true);
    } else if (this.hud.bossName.visible) {
      this.hud.bossName.setVisible(false);
    }

    // vida do necromante (treme ao levar dano)
    const g = this.hudGfx;
    this.hud.hpShake = Math.max(0, this.hud.hpShake - dt * 4);
    const bx = 10 + Math.round((Math.random() - 0.5) * 3 * this.hud.hpShake);
    const by = FIELD.h + 4;
    const bw = 166;
    g.fillStyle(COL.k).fillRect(bx - 1, by - 1, bw + 2, 5);
    g.fillStyle(COL.r).fillRect(bx, by, bw, 3);
    const fill = Math.max(0, Math.round((bw * w.necro.hp) / w.necro.maxHp));
    g.fillStyle(time < this.hud.hpFlashUntil ? 0xffffff : COL.R).fillRect(bx, by, fill, 3);
    g.fillStyle(0xffffff, 0.25).fillRect(bx, by, fill, 1);
    const segs = Math.min(Math.round(w.necro.maxHp), 40);
    for (let i = 1; i < segs; i++) g.fillStyle(COL.k, 0.6).fillRect(bx + Math.round((bw * i) / segs), by, 1, 3);

    for (const b of this.buttons) {
      const ok = b.can() && !this.ended;
      const pressed = time < b.downUntil;
      b.img.setTexture(pressed ? 'btn-down' : ok ? 'btn-ready' : 'btn').setAlpha(ok || pressed ? 1 : 0.5);
      b.img.y = b.y + (pressed ? 1 : 0);
      b.label.y = b.y + 5 + (pressed ? 1 : 0);
      b.label.setTint(ok ? (Math.sin(time * 0.008) > 0 ? COL.G : 0xd8ffe0) : COL.B);
    }
  }

  private banner(text: string, color: number, y = 120, sub?: string) {
    const t = pxText(this, FIELD.w + 60, y, text, color).setOrigin(0.5).setScale(2).setDepth(DEPTH.hud);
    this.tweens.add({ targets: t, x: FIELD.w / 2, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, x: -60, delay: 1100, duration: 250, ease: 'Back.easeIn', onComplete: () => t.destroy() });
    if (sub) {
      const s = pxText(this, FIELD.w / 2, y + 12, sub, COL.C).setOrigin(0.5).setDepth(DEPTH.hud).setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, delay: 150, duration: 200 });
      this.tweens.add({ targets: s, alpha: 0, delay: 1100, duration: 200, onComplete: () => s.destroy() });
    }
  }

  private hitstop(ms: number) {
    this.hitstopUntil = Math.max(this.hitstopUntil, this.time.now + ms);
  }

  // ================================================================ cartas

  private showCards() {
    if (this.modalKind) return;
    this.modalKind = 'cards';
    this.drag = null;
    this.cardViews = [];
    const w = this.world;
    const shade = this.add.rectangle(0, 0, 180, 320, 0x050309, 0).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: 0.82, duration: 250 });
    const title = pxText(this, 90, 30, 'ESCOLHA UM PACTO', COL.G).setOrigin(0.5).setDepth(DEPTH.modal + 1).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: 26, duration: 300 });
    this.modal.push(shade, title);
    audio.play('card');

    const counts = w.schoolCounts();
    const startY = 40;
    w.offer.forEach((id, i) => {
      const card = CARD_BY_ID[id];
      const school = card.school ?? 'neutral';
      const color = card.school ? hexOf(SCHOOLS[card.school].color) : COL.y;
      const finalY = startY + i * 56;
      const c = this.add.container(5, finalY + 200).setDepth(DEPTH.modal + 1).setAlpha(0);
      const parts: Phaser.GameObjects.GameObject[] = [
        this.add.image(0, 0, `card-${school}-${card.rarity}`).setOrigin(0),
        this.add.image(16, 25, `school-${school}`).setScale(2),
        pxText(this, 38, 6, card.name.toUpperCase(), color),
        pxText(this, 38, 16, wrap(card.desc, 31), COL.c),
        pxText(this, 6, 42, `${i + 1}`, COL.B),
      ];
      if (card.rarity !== 'common') parts.push(pxText(this, 165, 6, card.rarity === 'rare' ? 'RARO' : 'LENDÁRIO', card.rarity === 'rare' ? 0x6fa8c8 : COL.O).setOrigin(1, 0));
      if (card.school) {
        const n = counts[card.school] + 1;
        const goal = n <= MASTERY_AT ? MASTERY_AT : DOMINION_AT;
        const tag = n === MASTERY_AT ? 'MAESTRIA!' : n === DOMINION_AT ? 'DOMÍNIO!' : n > DOMINION_AT ? '' : `${n}/${goal}`;
        if (tag) parts.push(pxText(this, 165, 40, `${SCHOOLS[card.school].name.toUpperCase()} ${tag}`, n === MASTERY_AT || n === DOMINION_AT ? COL.y : color).setOrigin(1, 0));
      }
      c.add(parts);
      c.setInteractive(new Phaser.Geom.Rectangle(0, 0, 170, 50), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', () => this.pickCard(id, c));
      this.tweens.add({ targets: c, y: finalY, alpha: 1, delay: 80 + i * 90, duration: 380, ease: 'Back.easeOut' });
      this.time.delayedCall(80 + i * 90, () => audio.play('click'));
      this.modal.push(c);
      this.cardViews.push({ id, c });
    });

    if (w.rerollsLeft > 0) {
      const b = button(
        this,
        90,
        startY + w.offer.length * 56 + 8,
        `TROCAR (${w.rerollsLeft})`,
        () => {
          if (this.world.reroll()) {
            this.closeModal();
            this.showCards();
          }
        },
        { depth: DEPTH.modal + 1 },
      );
      this.modal.push(b.img, b.label);
    }
  }

  private pickByIndex(i: number) {
    const v = this.cardViews[i];
    if (v) this.pickCard(v.id, v.c);
  }

  private pickCard(id: string, c: Phaser.GameObjects.Container) {
    if (this.modalKind !== 'cards' || this.world.phase !== 'choosing' || c.getData('picked')) return;
    for (const v of this.cardViews) v.c.setData('picked', true);
    audio.play('card');
    buzz('medium');
    this.shaker.add(0.15);
    for (const v of this.cardViews) if (v.c !== c) this.tweens.add({ targets: v.c, alpha: 0, y: v.c.y + 40, duration: 200 });
    const fl = this.add.rectangle(c.x, c.y, 170, 50, 0xffffff, 0.8).setOrigin(0).setDepth(DEPTH.modal + 2);
    this.tweens.add({ targets: fl, alpha: 0, duration: 200, onComplete: () => fl.destroy() });
    this.tweens.add({
      targets: c,
      y: -60,
      delay: 150,
      duration: 300,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.world.pickCard(id);
        this.closeModal();
      },
    });
  }

  /** Mercador Encapuzado: troca almas da run por itens que ficam com você. */
  private showMerchant() {
    if (this.modalKind || this.ended) return;
    this.merchantPending = false;
    this.modalKind = 'merchant';
    const w = this.world;
    const offer = [0, 1, 2].map(() => rollItem(Math.random, 0.2 + this.world.regionIndex * 0.15));
    const shade = this.add.rectangle(0, 0, 180, 320, 0x050309, 0).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: 0.86, duration: 250 });
    const hood = this.add.sprite(90, 70, 'char-reaper0').setOrigin(0.5, 1).setScale(2).setDepth(DEPTH.modal + 1).setTint(0x9a8a70);
    const t1 = pxText(this, 90, 78, 'MERCADOR ENCAPUZADO', COL.y).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    const t2 = pxText(this, 90, 88, 'almas da run por itens que ficam com você', COL.C).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    const soulsLine = pxText(this, 90, 100, '', COL.G).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    this.modal.push(shade, hood, t1, t2, soulsLine);
    audio.play('bell');
    const refresh = () => setPxText(soulsLine, `você tem ${Math.floor(w.souls)} almas`);
    refresh();
    offer.forEach((id, i) => {
      const it = ITEM_BY_ID[id];
      const price = Math.round(ITEM_PRICE[it.rarity] * 0.45);
      const y = 114 + i * 48;
      const c = this.add.container(5, y + 120).setDepth(DEPTH.modal + 1).setAlpha(0);
      const parts: Phaser.GameObjects.GameObject[] = [
        this.add.image(0, 0, 'item-card').setOrigin(0),
        this.add.image(16, 22, `slot-${it.rarity}`),
        this.add.image(16, 22, `item-${id}`).setScale(2),
        pxText(this, 32, 4, it.name.toUpperCase(), parseInt(RARITY_COLOR[it.rarity].slice(1), 16)),
        pxText(this, 32, 13, wrap(it.desc(meta.items[id] !== undefined ? meta.items[id] + 1 : 0), 33), COL.c),
        pxText(this, 165, 34, `${price} almas`, w.souls >= price ? COL.G : COL.B).setOrigin(1, 0),
      ];
      c.add(parts);
      c.setInteractive(new Phaser.Geom.Rectangle(0, 0, 170, 44), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', () => {
        if (c.getData('sold')) return;
        if (w.souls < price) {
          audio.play('deny');
          this.tweens.add({ targets: c, x: 7, duration: 40, yoyo: true, repeat: 2 });
          return;
        }
        c.setData('sold', true);
        w.souls -= price;
        w.loot.push(id);
        refresh();
        setPxText(this.bag.count, `${w.loot.length}`);
        this.bag.icon.setTexture(`item-${id}`).setVisible(true);
        audio.play('buy');
        buzz('medium');
        this.shaker.add(0.2);
        this.tweens.add({ targets: c, alpha: 0.35, duration: 200 });
        (parts[5] as Phaser.GameObjects.BitmapText).setText('VENDIDO').setTint(COL.y);
      });
      this.tweens.add({ targets: c, y, alpha: 1, delay: 100 + i * 90, duration: 350, ease: 'Back.easeOut' });
      this.modal.push(c);
    });
    const b = button(this, 90, 270, 'SEGUIR', () => this.closeModal(), { depth: DEPTH.modal + 1, color: COL.G });
    this.modal.push(b.img, b.label);
  }

  private closeModal() {
    for (const o of this.modal) o.destroy();
    this.modal = [];
    this.cardViews = [];
    this.modalKind = null;
  }

  // ================================================================ pausa e resultados

  private togglePause() {
    if (this.ended) return;
    if (this.modalKind === 'pause') {
      this.closeModal();
      if (this.world.phase === 'choosing') this.showCards();
      return;
    }
    if (this.modalKind === 'cards') this.closeModal();
    if (this.modalKind) return;
    this.modalKind = 'pause';
    audio.play('click');
    const shade = this.add.rectangle(0, 0, 180, 320, 0x050309, 0.88).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    const t = pxText(this, 90, 40, 'PAUSA', COL.G).setOrigin(0.5).setScale(2).setDepth(DEPTH.modal + 1);
    this.modal.push(shade, t);
    const counts = this.world.schoolCounts();
    let y = 64;
    for (const s of SCHOOL_ORDER) {
      if (!counts[s]) continue;
      const info = SCHOOLS[s];
      const n = counts[s];
      const lvl = n >= DOMINION_AT ? info.dominionName.toLowerCase() : n >= MASTERY_AT ? 'maestria' : `${n}/${MASTERY_AT}`;
      this.modal.push(this.add.image(20, y + 3, `school-${s}`).setDepth(DEPTH.modal + 1));
      this.modal.push(pxText(this, 28, y, `${info.name.toUpperCase()}: ${lvl}`, hexOf(info.color)).setDepth(DEPTH.modal + 1));
      y += 12;
    }
    const names = this.world.cards.map((id) => CARD_BY_ID[id].name.toLowerCase());
    this.modal.push(
      pxText(this, 90, y + 6, names.length ? wrap(names.join(', '), 42) : 'nenhum pacto ainda', names.length ? COL.C : COL.B)
        .setOrigin(0.5, 0)
        .setCenterAlign()
        .setDepth(DEPTH.modal + 1),
    );
    const b1 = button(this, 90, 250, 'CONTINUAR', () => this.togglePause(), { depth: DEPTH.modal + 1, color: COL.G });
    const b2 = button(
      this,
      90,
      274,
      'DESISTIR',
      () => {
        this.closeModal();
        this.ended = true;
        this.showResults(true);
      },
      { depth: DEPTH.modal + 1, color: COL.R },
    );
    this.modal.push(b1.img, b1.label, b2.img, b2.label);
  }

  /** Aplica o resultado da run na meta-progressão e mostra o placar. */
  private showResults(quit: boolean) {
    if (this.modalKind === 'results') return;
    this.closeModal();
    this.modalKind = 'results';
    const w = this.world;
    const earned = Math.floor(w.souls);
    const record = w.wave > meta.best.wave;
    meta.souls += earned;
    meta.totalSouls += earned;
    meta.runs++;
    for (const [k, n] of Object.entries(w.killsByKind)) {
      const key = k as keyof typeof meta.kills;
      meta.kills[key] = (meta.kills[key] ?? 0) + (n ?? 0);
    }
    const champs: string[] = [];
    for (const b of w.bossesKilled) {
      const rank = Math.min(5, (meta.champions[b] ?? 0) + 1);
      meta.champions[b] = rank;
      if (!meta.selectedChampion) meta.selectedChampion = b;
      meta.kills[b] = (meta.kills[b] ?? 0) + 1;
      champs.push(`${BOSS_DEFS[b].name.toLowerCase()} rank ${rank}`);
    }
    const loot: string[] = [];
    for (const id of w.loot) {
      const lvl = gainItem(meta, id);
      loot.push(`${ITEM_BY_ID[id].name.toLowerCase()}${lvl > 0 ? ` (nível ${lvl})` : ''}`);
    }
    rollMarket(meta);
    const before = meta.bossesBeaten;
    meta.bossesBeaten = Math.max(before, Math.min(4, w.bossesKilled.length));
    if (record) meta.best = { wave: w.wave, souls: earned };
    saveMeta();

    const shade = this.add.rectangle(0, 0, 180, 320, 0x050309, 0).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: 0.88, duration: 500 });
    this.modal.push(shade);
    const where = w.abyss > 0 ? `${circleName(w.abyss).toUpperCase()} - ONDA ${w.localWave}` : `${w.region.name.toUpperCase()} - ONDA ${Math.max(1, w.localWave)}`;
    const lines: [string, number, number][] = [
      [quit ? 'VOCÊ DESISTIU' : 'O NECROMANTE CAIU', COL.R, 2],
      [where, COL.c, 1],
      ['', 0, 1],
      [`abates: ${w.kills}`, COL.c, 1],
      [`pactos: ${w.cards.length}`, COL.c, 1],
      [`+${earned} almas para o cemitério`, COL.G, 1],
    ];
    for (const c of champs) lines.push([`campeão: ${c}`, COL.y, 1]);
    for (const l of loot.slice(0, 5)) lines.push([`item: ${l}`, 0xe0b040, 1]);
    if (loot.length > 5) lines.push([`+${loot.length - 5} itens`, 0xe0b040, 1]);
    if (meta.bossesBeaten > before && before < 3) lines.push(['nova escola liberada!', COL.y, 1]);
    if (record) lines.push(['NOVO RECORDE!', COL.y, 1]);
    let y = 70;
    lines.forEach(([text, color, scale], i) => {
      if (!text) {
        y += 6;
        return;
      }
      const t = pxText(this, 90, y, text, color).setOrigin(0.5).setScale(scale).setDepth(DEPTH.modal + 1).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, delay: 300 + i * 160, duration: 250, onStart: () => i > 2 && audio.play('click') });
      this.modal.push(t);
      y += scale === 2 ? 20 : 12;
    });
    const again = button(this, 90, 250, 'DE NOVO', () => transitionTo(this, 'Run'), { depth: DEPTH.modal + 1, color: COL.G });
    const menu = button(this, 90, 274, 'MENU', () => transitionTo(this, 'Menu'), { depth: DEPTH.modal + 1 });
    for (const o of [again.img, again.label, menu.img, menu.label]) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, delay: 400 + lines.length * 160, duration: 300 });
    }
    this.modal.push(again.img, again.label, menu.img, menu.label);
  }
}
