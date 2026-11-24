import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { charKey, REGION_DARK, unitKey } from '../art/generate';
import { CHAR_GLOW } from '../art/sprites';
import { COL } from '../art/palette';
import { pxText, setPxText } from '../art/text';
import { DEBUG } from '../debug';
import { button, curtain, DEPTH, flash, floatText, Shaker, shatter, transitionIn, transitionTo } from '../fx/juice';
import { fmt, showNum } from '../fx/numbers';
import { buzz, heartbeat } from '../platform/haptics';
import { deviceInfo, logRun } from '../platform/telemetry';
import { clearRun, meta, saveMeta, saveRun, savedRun } from '../platform/save';
import { autopilot } from '../sim/autopilot';
import { DOMINION_AT, MASTERY_AT, SCHOOL_ORDER, SCHOOLS } from '../sim/cards';
import { CHARACTER_BY_ID } from '../sim/characters';
import { BOSS_DEFS, CIRCLE_REACH, FIELD, NECRO, UNIT_DEFS } from '../sim/defs';
import { ITEM_BY_ID, ITEM_PRICE, RARITY_COLOR, rollItem } from '../sim/items';
import { maxStartRegion, metaMods, schoolBonus, unlockedSchools } from '../sim/meta';
import { championUnlocked } from '../sim/tree';
import { EVENT_BY_ID, ROUTE_BY_ID } from '../sim/events';
import { GEMS, parseGem, RANK_NAME } from '../sim/gems';
import { applyRunResult, dailySetup, todayKey } from '../sim/progress';
import { circleName } from '../sim/regions';
import type { BossKind, Corpse, GameEvent, School, Unit } from '../sim/types';
import { World } from '../sim/world';
import { wrap } from './BestiaryScene';
import { Darkness, Scenery, type Light } from './scenery';
import { Tutorial } from './tutorial';

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
  icon: Phaser.GameObjects.Image;
  can: () => boolean;
  act: () => boolean;
  downUntil: number;
  x: number;
  y: number;
}
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterName = 'blood' | 'bone' | 'soul' | 'spark' | 'gold' | 'poison' | 'fire' | 'dust' | 'frenzy';

const hexOf = (s: string) => parseInt(s.slice(1), 16);
/** mira direta: o círculo fica um pouco acima do dedo */
const DIRECT_OFFSET = 14;
const RITUAL_X = 166;
const RITUAL_Y = 282;
/** botões de ação redondos (centro) */
const ACT_X = [14, 38, 62];
const ACT_Y = 283;
/** borda direita da coluna de almas/exército no topo */
const HUD_RIGHT = 163;
/** tetos de efeitos visuais simultâneos (horda) */
const MAX_TEMP_SPRITES = 40;
const MAX_TEMP_LIGHTS = 16;
const MAX_UNIT_LIGHTS = 10;

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
    region: Phaser.GameObjects.BitmapText;
    souls: Phaser.GameObjects.BitmapText;
    soulIcon: Phaser.GameObjects.Image;
    army: Phaser.GameObjects.BitmapText;
    armyIcon: Phaser.GameObjects.Image;
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
  private modalKind: 'pause' | 'results' | 'merchant' | 'event' | null = null;
  private merchantPending = false;
  private necroKey = 'necro';
  private bag!: { icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.BitmapText };
  private ritualBtn!: Phaser.GameObjects.Image;
  private ritualReadyAt = 0;
  // horda: pools de sprites e agregação de efeitos por quadro
  private sprPool: Phaser.GameObjects.Sprite[] = [];
  private shadowPool: Phaser.GameObjects.Image[] = [];
  private tempSprites = 0;
  private boomCount = 0;
  private boomX = 0;
  private boomY = 0;
  private combo = 0;
  private comboAt = 0;
  private comboBest = 0;
  private comboText!: Phaser.GameObjects.BitmapText;
  private darkDt = 0;
  private speedText!: Phaser.GameObjects.BitmapText;
  private hpText!: Phaser.GameObjects.BitmapText;
  private ended = false;
  private resume = false;
  private firstRegionNoCurtain = false;
  /** data do desafio diário (null = run normal) */
  private daily: string | null = null;
  private tut: Tutorial | null = null;
  private onHide = () => {
    if (document.visibilityState !== 'hidden') return;
    this.persist();
    if (!this.modalKind && !this.ended) this.togglePause();
  };

  constructor() {
    super('Run');
  }

  init(data?: { resume?: boolean; daily?: boolean }) {
    this.resume = !!data?.resume && !!savedRun;
    this.daily = this.resume ? (savedRun?.scene.daily ?? null) : data?.daily ? todayKey() : null;
  }

  /** Salva a run em andamento (para retomar depois de fechar o app). */
  /** quadros por segundo, amostrados a cada segundo (telemetria) */
  private fps = { sum: 0, n: 0, min: 999 };

  /** Resumo da run para a telemetria: o que foi usado, onde morreu e do quê. */
  private report(outcome: 'death' | 'quit' | 'exit') {
    const w = this.world;
    const equipped = Object.entries(meta.equipped).map(([slot, id]) => ({ slot, id, lvl: meta.items[id ?? ''] ?? 0, forge: meta.slots[slot as keyof typeof meta.slots] ?? 0 }));
    const hurt = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 10)]));
    logRun(outcome, w.wave, w.setup.character ?? meta.character, {
      where: w.abyss > 0 ? `círculo ${w.abyss} onda ${w.localWave}` : `${w.region.name} onda ${w.localWave}`,
      time: Math.round(w.time),
      souls: Math.floor(w.souls),
      kills: w.kills,
      bosses: w.bossesKilled,
      power: w.power,
      loot: w.loot,
      gems: w.gems,
      startRegion: w.setup.startRegion ?? 0,
      heresy: w.setup.heresy ?? 0,
      daily: !!this.daily,
      champion: w.setup.champion ?? null,
      equipped,
      schools: w.schoolCounts(),
      tree: meta.tree,
      boons: w.boons,
      route: w.route,
      hurtTotal: hurt(w.log.hurt),
      hurtLastWave: hurt(w.log.hurtWave),
      waves: w.log.waves,
      actions: w.log.actions,
      events: w.log.events,
      stats: w.stats,
      maxHp: Math.round(w.necro.maxHp * 10),
      metaRuns: meta.runs,
      bestWave: meta.best.wave,
      settings: { speed: meta.settings.speed, aim: meta.settings.aim },
      fps: { avg: this.fps.n ? Math.round(this.fps.sum / this.fps.n) : 0, min: this.fps.n ? Math.round(this.fps.min) : 0 },
      device: deviceInfo(),
    });
  }

  private persist() {
    if (this.ended || !this.world || this.world.phase === 'over') return;
    saveRun({ snap: this.world.snapshot(), scene: { merchantPending: this.merchantPending, daily: this.daily }, at: Date.now() });
  }

  // ================================================================ criação

  create() {
    this.units.clear();
    this.corpses.clear();
    this.sprPool = [];
    this.shadowPool = [];
    this.ringImgs = [];
    this.domTint = undefined;
    this.thrown = new Map();
    this.tempSprites = 0;
    this.combo = 0;
    this.comboBest = 0;
    this.projectiles.clear();
    this.seenTelegraphs.clear();
    this.fxList = [];
    this.tempLights = [];
    this.buttons = [];
    this.modal = [];
    this.modalKind = null;
    this.drag = null;
    this.ended = false;
    this.acc = 0;
    this.hitstopUntil = 0;
    this.slowUntil = 0;
    this.merchantPending = false;
    this.necroKey = charKey(meta.character);

    if (this.resume && savedRun) {
      this.world = World.restore(savedRun.snap);
      this.merchantPending = savedRun.scene.merchantPending;
    } else {
      const sel = meta.selectedChampion;
      const champ = sel && championUnlocked(meta) && meta.champions[sel] ? sel : null;
      const day = this.daily ? dailySetup(this.daily) : null;
      this.world = new World({
        seed: day ? day.seed : (Math.random() * 2 ** 31) | 0,
        mods: metaMods(meta),
        schools: unlockedSchools(meta),
        champion: champ ? { boss: champ, rank: meta.champions[champ]! } : null,
        schoolBonus: schoolBonus(meta),
        heresy: day ? 0 : Math.min(meta.heresy, meta.heresyMax),
        character: meta.character,
        endless: day?.endless,
        startRegion: day ? 0 : Math.min(meta.startRegion, maxStartRegion(meta)),
      });
      // checkpoint: já começa com o visual da região, sem a cortina da troca
      this.firstRegionNoCurtain = this.world.wave > 0;
      if (DEBUG.startWave > 1) this.world.wave = DEBUG.startWave - 1;
      clearRun();
    }

    this.shaker = new Shaker(this.cameras.main);
    this.scenery = new Scenery(this);
    this.decals = this.add.renderTexture(0, 0, FIELD.w, FIELD.h).setOrigin(0).setDepth(DEPTH.decal);
    this.dark = new Darkness(this, 0.54);
    // no checkpoint a onda atual é o chefe da região anterior: o visual já é o da próxima
    this.applyRegionLook(this.world.wave > 0 ? (this.firstRegionNoCurtain ? this.world.regionIndex + 1 : this.world.regionIndex) : 0);
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
    this.fps = { sum: 0, n: 0, min: 999 };
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.modalKind || this.ended) return;
        const f = this.game.loop.actualFps;
        this.fps.sum += f;
        this.fps.n++;
        if (this.fps.n > 3) this.fps.min = Math.min(this.fps.min, f);
      },
    });
    this.createInput();
    this.tut =
      Tutorial.wanted() && !DEBUG.autopilot
        ? new Tutorial(
            this,
            () => this.world,
            (i) => this.buttons[i],
          )
        : null;

    audio.setIntensity(0);
    transitionIn(this);

    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.onHide);
      window.removeEventListener('pagehide', this.onHide);
    });
    if (this.resume) {
      // volta pausado no meio da onda, para o jogador se situar
      if (this.world.phase === 'event') this.time.delayedCall(400, () => this.showEvent());
      else if (this.world.phase === 'spawning' || this.world.phase === 'fighting') this.time.delayedCall(50, () => this.togglePause());
    }
  }

  /** Cenário, escuridão e música de uma região. */
  private applyRegionLook(region: number) {
    const abyss = this.world.abyss;
    this.scenery.build(region % 4, abyss);
    const look = REGION_DARK[abyss > 0 ? 4 : region % 4];
    this.dark.color = look.color;
    this.dark.amount = look.amount;
    audio.setRegion(abyss > 0 ? 4 : region % 4);
  }

  private createParticles() {
    // teto de partículas vivas por emissor: a horda não pode afogar a GPU
    const mk = (cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, tex = 'px') =>
      this.add.particles(0, 0, tex, { emitting: false, maxAliveParticles: 220, ...cfg }).setDepth(DEPTH.fx);
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
    // topo sem faixa: uma sombra suave e o texto flutuando por cima do campo
    this.add.image(0, 0, 'topbar').setOrigin(0).setDepth(DEPTH.hud - 1);
    this.add.image(0, FIELD.h, 'hudbar').setOrigin(0).setDepth(DEPTH.hud);

    // esquerda: onda grande e o nome da região embaixo
    const wave = pxText(this, 4, 3, 'ONDA 1', COL.u).setScale(2).setDepth(DEPTH.hud);
    const region = pxText(this, 4, 15, '', COL.y).setDepth(DEPTH.hud);
    // direita: almas, exército e itens achados, alinhados pela direita
    const soulIcon = this.add.image(0, 7, 'icon-soul').setDepth(DEPTH.hud);
    const souls = pxText(this, HUD_RIGHT, 3, '0', COL.G).setScale(2).setOrigin(1, 0).setDepth(DEPTH.hud);
    const armyIcon = this.add.image(0, 18, 'icon-skull').setDepth(DEPTH.hud);
    const army = pxText(this, HUD_RIGHT, 15, '0/10', COL.w).setOrigin(1, 0).setDepth(DEPTH.hud);

    const pause = this.add.image(174, 5, 'icon-pause').setDepth(DEPTH.hud).setInteractive({ useHandCursor: true });
    pause.input!.hitArea.setTo(-5, -5, 15, 15);
    pause.on('pointerdown', () => this.togglePause());

    // escolas: só aparecem as que você tem, numa fileira embaixo da onda
    const schools = unlockedSchools(meta).map((s) => {
      const icon = this.add.image(0, 27, `school-${s}`).setDepth(DEPTH.hud).setVisible(false);
      const count = pxText(this, 0, 24, '0', COL.v).setDepth(DEPTH.hud).setVisible(false);
      return { school: s, icon, count };
    });
    const bossName = pxText(this, 90, 33, '', COL.O).setOrigin(0.5, 0).setDepth(DEPTH.hud).setVisible(false);
    // velocidade do jogo (1x / 2x), embaixo da pausa
    this.speedText = pxText(this, 177, 15, `${meta.settings.speed}X`, meta.settings.speed > 1 ? COL.y : COL.v)
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud);
    const speedHit = this.add.zone(170, 18, 18, 12).setInteractive({ useHandCursor: true }).setDepth(DEPTH.hud);
    speedHit.on('pointerdown', () => this.toggleSpeed());
    this.comboText = pxText(this, 90, 60, '', COL.w).setOrigin(0.5).setDepth(DEPTH.hud).setVisible(false);
    this.hud = { wave, region, souls, soulIcon, army, armyIcon, schools, bossName, hpFlashUntil: 0, hpShake: 0, shownSouls: 0, bossShownHp: 1 };
    // vida: barra grossa no rodapé, com o número dentro
    this.add.image(7, FIELD.h + 12, 'icon-heart').setDepth(DEPTH.hud + 2).setScale(1.5);
    this.hpText = pxText(this, 95, FIELD.h + 10, '', COL.u).setOrigin(0.5, 0).setDepth(DEPTH.hud + 2);
    this.bag = {
      icon: this.add.image(0, 29, 'item-ring_iron').setDepth(DEPTH.hud).setVisible(false),
      count: pxText(this, HUD_RIGHT, 26, '', COL.y).setOrigin(1, 0).setDepth(DEPTH.hud),
    };

    const defs: [string, () => boolean, () => boolean][] = [
      ['icon-explode', () => this.world.canExplode(), () => this.world.explode()],
      ['icon-fuse', () => this.world.canFuse(), () => this.world.fuse()],
      ['icon-consume', () => this.world.canConsume(), () => this.world.consume()],
    ];
    // ritual: carregado por abates, no canto de baixo do campo
    this.ritualBtn = this.add.image(RITUAL_X, RITUAL_Y, 'icon-ritual').setDepth(DEPTH.hud).setInteractive({ useHandCursor: true });
    this.ritualBtn.input!.hitArea.setTo(-6, -6, 23, 22);
    this.ritualBtn.on('pointerdown', () => this.pressRitual());
    this.ritualBtn.setTint(CHAR_GLOW[meta.character] ?? COL.g);

    // ações: três botões redondos só com ícone, no canto de baixo à esquerda
    defs.forEach(([iconKey, can, act], i) => {
      const x = ACT_X[i];
      const y = ACT_Y;
      const img = this.add.image(x, y, 'act-round').setDepth(DEPTH.hud).setInteractive({ useHandCursor: true });
      img.input!.hitArea.setTo(-3, -3, 28, 28);
      const icon = this.add.image(x, y, iconKey).setDepth(DEPTH.hud).setScale(1.5);
      const btn: ActionButton = { img, icon, can, act, downUntil: 0, x, y };
      img.on('pointerdown', () => this.press(btn));
      this.buttons.push(btn);
    });
  }

  private createInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.ended || this.modalKind || p.y >= FIELD.h || (p.y < 12 && p.x > 160) || (p.y < 22 && p.x > 158)) return;
      if (Math.hypot(p.x - RITUAL_X, p.y - RITUAL_Y) < 12) return;
      if (ACT_X.some((x) => Math.hypot(p.x - x, p.y - ACT_Y) < 13)) return;
      this.drag = { px: p.x, py: p.y, cx: this.world.circle.x, cy: this.world.circle.y };
      // mira direta: o círculo vai para onde o dedo tocou (um pouco acima, para o dedo não cobrir)
      if (meta.settings.aim === 'direct') this.world.setCircle(p.x, p.y - DIRECT_OFFSET);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown || this.modalKind) return;
      if (meta.settings.aim === 'direct') this.world.setCircle(p.x, p.y - DIRECT_OFFSET);
      else this.world.setCircle(this.drag.cx + (p.x - this.drag.px) * DRAG_GAIN, this.drag.cy + (p.y - this.drag.py) * DRAG_GAIN);
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
          if (this.modalKind === 'event') this.pickEvent(i);
          else if (!this.modalKind) this.press(this.buttons[i]);
        });
      }
    }
    kb.on('keydown-FOUR', () => this.pressRitual());
    kb.on('keydown-R', () => this.pressRitual());
    kb.on('keydown-S', () => this.toggleSpeed());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
  }

  private press(b: ActionButton) {
    if (this.ended || this.modalKind) return;
    if (b.act()) {
      b.downUntil = this.time.now + 140;
      buzz('medium');
      this.tut?.pressed(this.buttons.indexOf(b));
    } else {
      audio.play('deny');
      this.tweens.add({ targets: [b.img, b.icon], x: '+=1', duration: 30, yoyo: true, repeat: 2 });
    }
  }

  private toggleSpeed() {
    meta.settings.speed = meta.settings.speed > 1 ? 1 : 2;
    saveMeta();
    setPxText(this.speedText, `${meta.settings.speed}X`);
    this.speedText.setTint(meta.settings.speed > 1 ? COL.y : COL.v);
    this.tweens.add({ targets: this.speedText, scale: 1.6, duration: 80, yoyo: true });
    audio.play('click');
    buzz('light');
  }

  private pressRitual() {
    if (this.ended || this.modalKind) return;
    if (this.world.castRitual()) {
      buzz('heavy');
    } else {
      audio.play('deny');
      this.tweens.add({ targets: this.ritualBtn, x: RITUAL_X + 1, duration: 30, yoyo: true, repeat: 2 });
    }
  }

  // ================================================================ laço

  update(time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.shaker.update(dt);
    if (DEBUG.autopilot && !this.ended && this.modalKind !== 'pause') autopilot(this.world);

    this.tut?.update(dt, time, !!this.modalKind || this.ended);
    const slow = (time < this.slowUntil ? this.slowFactor : 1) * (this.tut?.slow ?? 1);
    if (!this.ended && !this.modalKind && time >= this.hitstopUntil) {
      const speed = meta.settings.speed > 1 ? 2 : 1;
      this.acc = Math.min(this.acc + dt * slow * speed, 0.25 * speed);
      while (this.acc >= STEP) {
        this.world.update(STEP);
        this.acc -= STEP;
      }
    }
    if (this.modalKind === 'event' && this.world.phase !== 'event') this.closeModal();
    if (this.merchantPending && !this.modalKind && !this.ended && this.world.phase === 'intermission') {
      if (DEBUG.autopilot) this.merchantPending = false;
      else this.showMerchant();
    }

    const events = this.world.events;
    this.world.events = [];
    this.boomCount = 0;
    for (const e of events) this.onEvent(e, time);
    if (this.boomCount > 0) this.bigBoom(this.boomCount);

    this.overlay.clear();
    this.hudGfx.clear();
    this.syncCorpses(time);
    this.syncUnits(time);
    this.syncProjectiles();
    this.drawClouds(time);
    this.drawTelegraphs(time);
    this.cleanThrown();
    this.drawCircle(delta);
    this.drawDominions(time);
    this.drawFx(dt);
    this.syncNecro(time);
    this.syncHud(time, dt);
    // a escuridão é redesenhada a cada 2 quadros: as luzes mudam devagar e isso custa caro
    this.darkDt += dt;
    if ((this.game.loop.frame & 1) === 0) {
      this.drawDarkness(time, this.darkDt);
      this.darkDt = 0;
    }
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
          this.emit.blood.explode(e.big ? 6 : 3, e.x, e.y - 9);
          audio.play('hit');
          if (e.dmg >= 1 || e.dtype === 'explode') floatText(this, e.x, e.y - 24, showNum(e.dmg), e.dtype === 'explode' ? COL.O : e.big ? COL.y : COL.w, e.big);
        } else {
          this.emit.bone.explode(2, e.x, e.y - 9);
          audio.play('hitDead');
          if (e.dtype === 'holy') {
            this.emit.gold.explode(3, e.x, e.y - 6);
            floatText(this, e.x, e.y - 24, showNum(e.dmg), COL.y);
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
        this.emit.soul.explode(14, e.x, e.y - 9);
        this.emit.dust.explode(6, e.x, e.y);
        this.tempLights.push({ x: e.x, y: e.y - 9, key: 'light24', life: 0.35, max: 0.35 });
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 2, r: 10, color: COL.g, life: 0.25, max: 0.25 });
        audio.play('raise');
        this.shaker.add(0.025);
        buzz('light');
        break;
      case 'explode':
        if (e.small) {
          this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 3, r: e.r, color: COL.G, life: 0.2, max: 0.2 });
          this.emit.soul.explode(5, e.x, e.y - 3);
          this.tempLights.push({ x: e.x, y: e.y, key: 'light24', life: 0.2, max: 0.2 });
          audio.play('bolt', 0.7);
          break;
        }
        {
          // cada morto explode no lugar; tremor, flash e som saem uma vez só, somados, em bigBoom()
          const many = this.boomCount > 8;
          this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 3, r: e.r, color: COL.G, life: 0.3, max: 0.3 });
          if (!many) this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 3, r: e.r * 0.6, color: 0xffffff, life: 0.15, max: 0.15 });
          this.emit.soul.explode(many ? 4 : 12, e.x, e.y - 3);
          this.emit.bone.explode(many ? 5 : 14, e.x, e.y - 3);
          this.emit.spark.explode(many ? 3 : 10, e.x, e.y - 3);
          this.emit.fire.explode(many ? 3 : 8, e.x, e.y - 3);
          this.decals.draw('scorch', Math.round(e.x - 4), Math.round(e.y - 3));
          if (this.boomCount < 6) this.tempLights.push({ x: e.x, y: e.y, key: 'light48', scale: 1.4, life: 0.35, max: 0.35 });
          this.boomX += (e.x - this.boomX) / (this.boomCount + 1);
          this.boomY += (e.y - this.boomY) / (this.boomCount + 1);
          this.boomCount++;
          break;
        }
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
        this.fxList.push({ kind: 'beam', pts: [e.x, e.y - 9, NECRO.x, NECRO.y - 16], x: e.x, y: e.y, r: 0, color: COL.G, life: 0.3, max: 0.3 });
        this.flyMotes(e.x, e.y - 9, NECRO.x, NECRO.y - 16, 5, COL.G);
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
        this.emit.blood.explode(7, NECRO.x, NECRO.y - 16);
        this.shaker.add(0.3);
        this.shaker.kick(Math.sign(NECRO.x - e.x) * 2, 2);
        this.vignette.setAlpha(0.5);
        this.hitstop(35);
        floatText(this, NECRO.x + 8, NECRO.y - 40, `-${showNum(e.dmg)}`, COL.R, e.dmg >= 3);
        audio.play('hurt');
        buzz('heavy');
        break;
      case 'necroHeal':
        floatText(this, NECRO.x - 8, NECRO.y - 40, `+${showNum(e.amount)}`, COL.G);
        this.emit.soul.explode(8, NECRO.x, NECRO.y - 14);
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
        this.fxList.push({ kind: 'ring', x: NECRO.x, y: NECRO.y - 20, r: 220, color: 0x8fd3ff, life: 0.7, max: 0.7 });
        this.fxList.push({ kind: 'ring', x: NECRO.x, y: NECRO.y - 20, r: 140, color: 0xffffff, life: 0.5, max: 0.5 });
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
        this.persist();
        break;
      case 'eventOffer':
        this.time.delayedCall(450, () => this.world.phase === 'event' && !this.ended && this.showEvent());
        break;
      case 'eventResult':
        this.banner(e.text.toUpperCase(), e.good ? COL.G : COL.R, 140);
        audio.play(e.good ? 'synergy' : 'hurt');
        this.shaker.add(0.3);
        break;
      case 'route': {
        const r = ROUTE_BY_ID[e.id];
        this.banner(r.name.toUpperCase(), COL.y, 140, r.desc);
        audio.play('bell');
        break;
      }
      case 'synergy':
        this.onSynergy(e.school, e.level);
        break;
      case 'ritual':
        this.onRitual(e.char, e.x, e.y, e.r, time);
        break;
      case 'ritualReady':
        this.ritualReadyAt = time;
        this.emit.soul.explode(16, RITUAL_X, RITUAL_Y);
        audio.play('synergy');
        buzz('medium');
        break;
      case 'wail':
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 4, r: e.r, color: 0xf4eefc, life: 0.35, max: 0.35 });
        this.fxList.push({ kind: 'ring', x: e.x, y: e.y - 4, r: e.r * 0.6, color: 0xa08cc8, life: 0.25, max: 0.25 });
        audio.play('scream', 1.6);
        this.shaker.add(0.08);
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
      case 'gemDrop':
        this.onGemDrop(e.gem, e.x, e.y);
        break;
      case 'flank': {
        // aviso: um bando vai entrar pela lateral
        const x = e.side < 0 ? 6 : FIELD.w - 6;
        floatText(this, x, e.y, e.side < 0 ? '>' : '<', COL.R, true);
        this.fxList.push({ kind: 'beam', pts: [x, e.y - 24, x, e.y + 24], x, y: e.y, r: 0, color: COL.R, life: 0.5, max: 0.5 });
        audio.play('warn');
        break;
      }
      case 'gameOver':
        this.onGameOver();
        break;
    }
  }

  /** Todas as explosões do quadro viram um impacto só, mais forte quanto mais mortos explodiram. */
  private bigBoom(n: number) {
    const k = Math.min(1, n / 25);
    this.shaker.add(0.3 + k * 0.6);
    this.shaker.kick((Math.random() - 0.5) * (4 + k * 6), 2 + k * 3);
    this.hitstop(45 + Math.round(k * 70));
    flash(this, 0xffffff, 0.12 + k * 0.25, 90 + Math.round(k * 160));
    audio.play('explode');
    if (n >= 6) this.time.delayedCall(70, () => audio.play('explode', 0.7));
    if (n >= 15) {
      this.time.delayedCall(140, () => audio.play('slam'));
      this.tempLights.push({ x: this.boomX, y: this.boomY, key: 'light80', scale: 1 + k * 1.5, life: 0.5, max: 0.5 });
      this.fxList.push({ kind: 'ring', x: this.boomX, y: this.boomY, r: 30 + n * 2, color: 0xffffff, life: 0.35, max: 0.35 });
      floatText(this, this.boomX, this.boomY - 20, `${n}x BOOM`, COL.O, true);
    }
    buzz('heavy');
    this.boomX = 0;
    this.boomY = 0;
  }

  /** O ritual do personagem: o maior momento da run. */
  private onRitual(char: string, x: number, y: number, r: number, time: number) {
    const color = CHAR_GLOW[char] ?? COL.g;
    const info = CHARACTER_BY_ID[char as keyof typeof CHARACTER_BY_ID]?.ritual;
    this.castUntil = time + 500;
    flash(this, color, 0.45, 350);
    this.shaker.add(0.75);
    this.hitstop(90);
    audio.play('synergy');
    audio.play('explode');
    buzz('heavy');
    this.time.delayedCall(150, () => buzz('heavy'));
    this.fxList.push({ kind: 'ring', x, y, r, color, life: 0.6, max: 0.6 });
    this.fxList.push({ kind: 'ring', x, y, r: r * 0.6, color: 0xffffff, life: 0.4, max: 0.4 });
    this.fxList.push({ kind: 'column', x: NECRO.x, y: 0, r: 8, color, life: 0.5, max: 0.5 });
    this.tempLights.push({ x, y, key: 'light80', scale: 2, life: 0.8, max: 0.8 });
    this.tempLights.push({ x: NECRO.x, y: NECRO.y - 20, key: 'light80', scale: 1.5, life: 0.8, max: 0.8 });
    const emitter = char === 'witch' ? this.emit.poison : char === 'vampire' ? this.emit.blood : this.emit.soul;
    for (let a = 0; a < 12; a++) emitter.explode(4, x + Math.cos((a / 12) * Math.PI * 2) * r * 0.8, y + Math.sin((a / 12) * Math.PI * 2) * r * 0.8);
    if (info) this.banner(info.name.toUpperCase(), color, 100);
    if (char === 'vampire') {
      for (const u of this.world.units)
        if (u.alive && u.faction === 'living' && Math.hypot(u.x - x, u.y - y) < r) this.flyMotes(u.x, u.y - 5, NECRO.x, NECRO.y - 16, 1, COL.R);
    }
  }

  /** Gema caiu: brilha na cor dela e voa para a bolsa. */
  private onGemDrop(key: string, x: number, y: number) {
    const g = parseGem(key);
    if (!g) return;
    const color = hexOf(GEMS[g.type].color);
    this.emit.spark.explode(10, x, y - 6);
    this.tempLights.push({ x, y: y - 6, key: 'light24', life: 0.5, max: 0.5 });
    audio.play('soul');
    if (g.rank > 1) floatText(this, x, y - 16, `${GEMS[g.type].name.toLowerCase()} ${RANK_NAME[g.rank]}`, color);
    const icon = this.add.image(x, y - 6, `gem-${g.type}`).setDepth(DEPTH.hud + 2);
    this.tweens.add({ targets: icon, y: y - 18, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: icon,
      x: this.bag.icon.x,
      y: this.bag.icon.y,
      delay: 450,
      duration: 400,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        icon.destroy();
        this.tweens.add({ targets: this.bag.count, scale: 1.8, duration: 80, yoyo: true });
      },
    });
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
      this.emit.blood.explode(this.combo > 30 ? 6 : 12, e.x, e.y - 9);
      this.decals.draw('splat', Math.round(e.x - 4), Math.round(e.y - 3));
      audio.play('death');
      this.shaker.add(0.012);
      this.combo++;
      this.comboAt = this.time.now;
      if (v) this.fallAnimation(v, e.facing);
    } else if (e.spent) {
      if (v && this.tempSprites < MAX_TEMP_SPRITES) {
        this.tempSprites++;
        const g = this.add.sprite(v.spr.x, v.spr.y, v.spr.texture.key).setOrigin(0.5, 1).setFlipX(v.spr.flipX).setDepth(v.spr.depth).setTintFill(COL.G);
        this.tweens.add({ targets: g, scaleX: 1.5, scaleY: 0.3, alpha: 0, duration: 170, onComplete: () => this.dropTemp(g) });
      }
    } else {
      this.emit.bone.explode(e.kind === 'giant' || e.kind === 'champion' || e.kind === 'abomination' ? 24 : 10, e.x, e.y - 9);
      audio.play('bones');
      if (v && this.tempSprites < MAX_TEMP_SPRITES) {
        this.tempSprites++;
        const c = this.add.sprite(v.spr.x, v.spr.y, v.spr.texture.key).setOrigin(0.5, 1).setFlipX(v.spr.flipX).setDepth(v.spr.depth);
        this.tweens.add({ targets: c, scaleY: 0.1, scaleX: 1.3, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => this.dropTemp(c) });
      }
    }
  }

  private dropTemp(o: Phaser.GameObjects.GameObject) {
    this.tempSprites--;
    o.destroy();
  }

  /** O vivo tomba de lado antes de virar cadáver (com teto de animações simultâneas). */
  private fallAnimation(v: UnitView, facing: 1 | -1) {
    if (this.tempSprites >= MAX_TEMP_SPRITES) return;
    this.tempSprites++;
    const f = this.add.sprite(v.spr.x, v.spr.y, `${v.key}0`).setOrigin(0.5, 1).setFlipX(v.spr.flipX).setDepth(v.spr.depth).setTintFill(0xffffff);
    this.time.delayedCall(50, () => f.active && f.clearTint());
    this.tweens.add({ targets: f, angle: -90 * facing, y: f.y - 2, duration: 170, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: f, alpha: 0, delay: 150, duration: 80, onComplete: () => this.dropTemp(f) });
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
    const title = abyss > 0 ? circleName(abyss).toUpperCase() : ROMAN[region % 4];
    const show = () => this.regionCard(title, r.name.toUpperCase(), abyss > 0 ? 'o abismo te encara' : r.subtitle, abyss > 0);
    if (region === 0 || this.firstRegionNoCurtain) {
      this.firstRegionNoCurtain = false;
      this.applyRegionLook(region);
      show();
      return;
    }
    curtain(this, () => {
      this.applyRegionLook(region);
      this.decals.clear();
      show();
    });
  }

  private regionCard(numeral: string, name: string, subtitle: string, abyss: boolean) {
    const color = abyss ? COL.R : COL.G;
    const objs = [
      pxText(this, 90, 92, numeral, color).setOrigin(0.5).setScale(2),
      pxText(this, 90, 112, name, COL.w).setOrigin(0.5).setScale(2),
      pxText(this, 90, 128, subtitle, COL.v).setOrigin(0.5),
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
    const t2 = pxText(this, 90, 136, 'CHEFE', COL.v).setOrigin(0.5).setDepth(DEPTH.hud).setAlpha(0);
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
      flash(this, color, level === 2 ? 0.55 : 0.35, level === 2 ? 600 : 350);
      this.shaker.add(level === 2 ? 0.9 : 0.5);
      if (level === 2) {
        // domínio: uma onda da cor da escola atravessa a tela inteira
        this.fxList.push({ kind: 'ring', x: NECRO.x, y: NECRO.y - 20, r: 340, color, life: 0.9, max: 0.9 });
        this.fxList.push({ kind: 'ring', x: NECRO.x, y: NECRO.y - 20, r: 220, color: 0xffffff, life: 0.6, max: 0.6 });
        this.hitstop(120);
        this.time.delayedCall(120, () => audio.play('explode'));
      }
      audio.play('synergy');
      buzz('heavy');
      const title = level === 1 ? `MAESTRIA: ${info.name.toUpperCase()}` : `DOMÍNIO: ${info.dominionName.toUpperCase()}`;
      const scale = level === 2 ? 2 : 1;
      const t1 = pxText(this, 90, 56, title, color).setOrigin(0.5).setScale(scale * 1.5).setDepth(DEPTH.hud).setAlpha(0);
      const t2 = pxText(this, 90, 68, wrap(level === 1 ? info.mastery : info.dominion, 40), COL.u).setOrigin(0.5, 0).setCenterAlign().setDepth(DEPTH.hud).setAlpha(0);
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
      const ghostly = u.kind === 'ghost' || u.kind === 'banshee';
      const bob = ghostly ? Math.round(Math.sin(time * 0.006 + u.id) * 1.5) - 2 : 0;
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
      if (ghostly) v.spr.setAlpha(0.8);
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

      // horda: bucha de canhão não ganha barra (centenas de barras pesam e poluem)
      if (u.hp < u.maxHp && !UNIT_DEFS[u.kind].boss && (u.maxHp >= 5 || u.elite)) {
        const top = Math.round(u.y - v.spr.height - 3);
        const bw = u.radius >= 9 ? 18 : 10;
        const x = Math.round(u.x - bw / 2);
        this.overlay.fillStyle(COL.k).fillRect(x - 1, top - 1, bw + 2, 3);
        this.overlay.fillStyle(u.faction === 'living' ? COL.R : COL.g).fillRect(x, top, Math.max(1, Math.round((bw * u.hp) / u.maxHp)), 1);
      }
    }
    for (const [id, v] of this.units) {
      if (seen.has(id)) continue;
      // volta para o pool em vez de destruir: a horda cria e mata centenas por minuto
      this.tweens.killTweensOf(v.spr);
      v.spr.anims.stop();
      v.spr.setVisible(false).setActive(false);
      v.shadow.setVisible(false);
      this.sprPool.push(v.spr);
      this.shadowPool.push(v.shadow);
      for (const o of v.outline ?? []) o.destroy();
      this.units.delete(id);
    }
  }

  private makeUnitView(u: Unit, time: number): UnitView {
    const key = unitKey(u.kind, u.boss);
    const pooled = this.sprPool.pop();
    const spr = pooled
      ? pooled.setVisible(true).setActive(true).setTexture(`${key}0`).setPosition(u.x, u.y).setAlpha(1).setScale(1).setAngle(0).clearTint()
      : this.add.sprite(u.x, u.y, `${key}0`).setOrigin(0.5, 1);
    spr.anims.timeScale = 1;
    spr.play({ key: `${key}-walk`, startFrame: u.id % 2 });
    const pooledShadow = this.shadowPool.pop();
    const shadow = pooledShadow
      ? pooledShadow.setVisible(true).setPosition(u.x, u.y).setScale(1)
      : this.add
          .image(u.x, u.y, 'shadow')
          .setAlpha(0.6)
          .setDepth(DEPTH.decal + 1);
    shadow.setScale(u.radius >= 9 ? 3 : 1.6, u.radius >= 9 ? 2 : 1.3);
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
    if (this.ended) {
      for (const i of this.ringImgs) i.setVisible(false);
      return;
    }
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
    // anéis tracejados: texturas pré-desenhadas por deslocamento (antes eram ~300 retângulos por quadro)
    this.placeRing(0, cx, cy, r, this.spin, 5, 7, 1);
    this.placeRing(1, cx, cy, r - 4, -this.spin * 0.7, 2, 6, 0.55);
    for (let i = 0; i < 4; i++) {
      const a = this.spin * 0.05 + (i * Math.PI) / 2;
      g.fillStyle(COL.G, 1).fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
    }
  }

  private ringImgs: Phaser.GameObjects.Image[] = [];
  private domAcc = 0;
  private domTint?: Phaser.GameObjects.Rectangle;

  /**
   * Domínio de uma escola (4 itens) muda o clima da partida inteira:
   * chuva de ossos, sangue escorrendo, névoa de praga, almas subindo, névoa rubra.
   */
  private drawDominions(time: number) {
    if (this.ended || this.modalKind) return;
    const c = this.world.schoolCounts();
    const on = (s: School) => c[s] >= DOMINION_AT;
    const any = SCHOOL_ORDER.some(on);
    if (!any) {
      this.domTint?.setVisible(false);
      return;
    }
    this.domAcc += 1;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    if (on('bone') && this.domAcc % 4 === 0) this.emit.bone.explode(1, rnd(0, FIELD.w), rnd(20, 60));
    if (on('flesh') && this.domAcc % 6 === 0) {
      const dead = this.world.units.filter((u) => u.alive && u.faction === 'dead');
      const u = dead[Math.floor(Math.random() * dead.length)];
      if (u) this.emit.blood.explode(2, u.x, u.y - 6);
    }
    if (on('plague') && this.domAcc % 3 === 0) this.emit.poison.explode(2, rnd(0, FIELD.w), rnd(30, FIELD.h - 20));
    if (on('spirit') && this.domAcc % 3 === 0) this.emit.soul.explode(1, rnd(0, FIELD.w), rnd(60, FIELD.h));
    // véu de cor por cima do campo (praga verde, sangue vermelho)
    const veil = on('plague') ? 0x8fbf3a : on('blood') ? 0xe0304a : on('spirit') ? 0x8fd3ff : 0;
    if (veil) {
      if (!this.domTint) this.domTint = this.add.rectangle(0, 0, FIELD.w, FIELD.h, veil, 0).setOrigin(0).setDepth(DEPTH.fx - 1).setBlendMode(Phaser.BlendModes.ADD);
      this.domTint.setVisible(true).setFillStyle(veil, 0.05 + Math.sin(time * 0.002) * 0.025);
    } else this.domTint?.setVisible(false);
  }
  private thrown = new Map<number, Phaser.GameObjects.Image>();

  /** O vivo arremessado voa em arco da mão do arremessador até o alvo. */
  private drawThrown(t: { id: number; x: number; y: number; x2: number; y2: number; payload?: string }, p: number) {
    let img = this.thrown.get(t.id);
    if (!img) {
      img = this.add.image(t.x2, t.y2, `${t.payload ?? 'peasant'}0`).setOrigin(0.5, 1);
      this.thrown.set(t.id, img);
    }
    const x = t.x2 + (t.x - t.x2) * p;
    const y = t.y2 + (t.y - t.y2) * p - Math.sin(p * Math.PI) * 44;
    img.setPosition(Math.round(x), Math.round(y)).setAngle(p * 540).setDepth(DEPTH.fx);
  }

  private cleanThrown() {
    for (const [id, img] of this.thrown) {
      if (this.world.telegraphs.some((t) => t.id === id)) continue;
      img.destroy();
      this.thrown.delete(id);
    }
  }

  private placeRing(slot: number, cx: number, cy: number, rad: number, offset: number, on: number, period: number, alpha: number) {
    const off = (((Math.floor(offset) % period) + period) % period) as number;
    const key = `ring-${rad.toFixed(1)}-${on}-${period}-${off}`;
    const c = Math.ceil(rad) + 1;
    if (!this.textures.exists(key)) {
      const size = c * 2 + 1;
      const tex = this.textures.createCanvas(key, size, size)!;
      const ctx = tex.getContext();
      ctx.fillStyle = '#38b46a';
      const n = Math.floor(2 * Math.PI * rad);
      for (let i = 0; i < n; i++) {
        if ((i + off) % period >= on) continue;
        const a = (i / n) * Math.PI * 2;
        ctx.fillRect(Math.round(c + Math.cos(a) * rad), Math.round(c + Math.sin(a) * rad), 1, 1);
      }
      tex.refresh();
    }
    let img = this.ringImgs[slot];
    if (!img?.active) img = this.ringImgs[slot] = this.add.image(0, 0, key).setOrigin(0).setDepth(DEPTH.overlay);
    img
      .setTexture(key)
      .setPosition(cx - c, cy - c)
      .setAlpha(alpha)
      .setVisible(true);
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
      if (t.ability === 'throw') this.drawThrown(t, p);
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
    const lights: Light[] = [...this.scenery.lights, { x: NECRO.x, y: NECRO.y - 16, key: 'light80' }];
    if (!this.ended) lights.push({ x, y, key: 'light80', scale: (r * 2.4) / 80, alpha: 0.75 });
    if (this.tempLights.length > MAX_TEMP_LIGHTS) this.tempLights.splice(0, this.tempLights.length - MAX_TEMP_LIGHTS);
    for (const l of this.tempLights) lights.push({ ...l, alpha: l.life / l.max });
    let unitLights = 0;
    for (const u of this.world.units) {
      if (unitLights >= MAX_UNIT_LIGHTS) break;
      if (u.kind === 'torch' || u.kind === 'nun') lights.push({ x: u.x, y: u.y - 10, key: 'light24' });
      else if (u.elite) lights.push({ x: u.x, y: u.y - 8, key: 'light24', alpha: 0.8 });
      else continue;
      unitLights++;
    }
    for (const t of this.world.telegraphs) lights.push({ x: t.x, y: t.y, key: 'light24', alpha: 0.6 });
    this.dark.draw(lights, time);
  }

  // ================================================================ HUD

  private syncHud(time: number, dt: number) {
    const w = this.world;
    setPxText(this.hud.wave, `ONDA ${Math.max(1, w.localWave)}`);
    const regionName = w.abyss > 0 ? circleName(w.abyss).toUpperCase() : w.region.name.toUpperCase();
    if (this.hud.region.text !== regionName) setPxText(this.hud.region, regionName);
    const souls = Math.floor(w.souls);
    if (this.hud.shownSouls < souls) this.hud.shownSouls += Math.max(1, Math.round((souls - this.hud.shownSouls) * 0.15));
    if (this.hud.shownSouls > souls) this.hud.shownSouls = souls;
    setPxText(this.hud.souls, fmt(this.hud.shownSouls));
    this.hud.soulIcon.x = HUD_RIGHT - this.hud.souls.width - 6;
    const used = w.armyUsed();
    setPxText(this.hud.army, `${used}/${w.mods.armyCap}`);
    this.hud.army.setTint(used >= w.mods.armyCap ? COL.y : COL.w);
    this.hud.armyIcon.x = HUD_RIGHT - this.hud.army.width - 6;
    this.bag.icon.x = HUD_RIGHT - this.bag.count.width - 6;

    const counts = w.schoolCounts();
    let sx = 7;
    for (const s of this.hud.schools) {
      const n = counts[s.school];
      const on = n > 0;
      s.icon.setVisible(on);
      s.count.setVisible(on);
      if (!on) continue;
      setPxText(s.count, `${n}`);
      s.icon.x = sx;
      s.count.x = sx + 5;
      s.count.setTint(n >= DOMINION_AT ? COL.y : n >= MASTERY_AT ? COL.G : COL.u);
      sx += 10 + s.count.width;
    }

    // barra do chefe
    const boss = w.boss;
    if (boss) {
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      this.hud.bossShownHp += (ratio - this.hud.bossShownHp) * Math.min(1, dt * 4);
      const bx = 20;
      const by = 41;
      const bw = 140;
      const g = this.hudGfx;
      g.fillStyle(COL.k).fillRoundedRect(bx - 2, by - 2, bw + 4, 9, 3);
      g.fillStyle(0x3a0c18).fillRect(bx, by, bw, 5);
      g.fillStyle(0xf6cf6a).fillRect(bx, by, Math.round(bw * this.hud.bossShownHp), 5);
      g.fillStyle(ratio < 0.5 && time % 300 < 150 ? 0xff6070 : 0xc8303e).fillRect(bx, by, Math.round(bw * ratio), 5);
      g.fillStyle(0xffffff, 0.2).fillRect(bx, by, Math.round(bw * ratio), 1);
      this.hud.bossName.setVisible(true);
    } else if (this.hud.bossName.visible) {
      this.hud.bossName.setVisible(false);
    }

    // vida do necromante (treme ao levar dano)
    const g = this.hudGfx;
    this.hud.hpShake = Math.max(0, this.hud.hpShake - dt * 4);
    const bx = 15 + Math.round((Math.random() - 0.5) * 3 * this.hud.hpShake);
    const by = FIELD.h + 7;
    const bw = 160;
    const bh = 10;
    g.fillStyle(COL.k).fillRoundedRect(bx - 2, by - 2, bw + 4, bh + 4, 4);
    g.fillStyle(COL.r).fillRoundedRect(bx, by, bw, bh, 3);
    const fill = Math.max(0, Math.round((bw * w.necro.hp) / w.necro.maxHp));
    if (fill >= 6) {
      g.fillStyle(time < this.hud.hpFlashUntil ? 0xffffff : 0xc8303e).fillRoundedRect(bx, by, fill, bh, 3);
      g.fillStyle(0xffffff, 0.22).fillRect(bx + 2, by + 1, fill - 4, 2);
      g.fillStyle(0x000000, 0.18).fillRect(bx + 2, by + bh - 3, fill - 4, 2);
    } else if (fill > 0) g.fillStyle(0xc8303e).fillRect(bx, by + 1, fill, bh - 2);
    setPxText(this.hpText, `${showNum(Math.max(0, w.necro.hp))}/${showNum(w.necro.maxHp)}`);
    this.hpText.setTint(w.necro.hp <= w.necro.maxHp * 0.3 && time % 400 < 200 ? COL.O : 0xffffff);

    // combo: abates seguidos sem pausa de mais de 1,6s
    if (this.combo > 0 && time - this.comboAt > 1600) {
      if (this.combo >= 40 && this.combo > this.comboBest) {
        this.comboBest = this.combo;
        floatText(this, 90, 58, `recorde de combo: ${this.combo}`, COL.y);
      }
      this.combo = 0;
    }
    if (this.combo >= 10 && !this.ended) {
      const c = this.comboText.setVisible(true);
      if (c.text !== `${this.combo} ABATES`) {
        setPxText(c, `${this.combo} ABATES`);
        c.setScale(Math.min(2.6, 1.3 + this.combo / 80) + 0.4);
      } else c.setScale(Math.max(Math.min(2.6, 1.3 + this.combo / 80), c.scale - dt * 4));
      c.setTint(this.combo >= 100 ? (time % 200 < 100 ? COL.R : COL.O) : this.combo >= 50 ? COL.O : this.combo >= 25 ? COL.y : COL.w);
      c.setAlpha(Math.min(1, 1.6 - (time - this.comboAt) / 1000));
    } else this.comboText.setVisible(false);

    // medidor do ritual: arco que enche com os abates
    const rit = w.ritual;
    const ready = rit >= 1 && !this.ended;
    const glow = CHAR_GLOW[meta.character] ?? COL.g;
    g.lineStyle(3, COL.k, 0.9).strokeCircle(RITUAL_X, RITUAL_Y, 9);
    if (rit > 0) {
      g.lineStyle(1, ready ? (time % 300 < 150 ? 0xffffff : glow) : glow, 1);
      g.beginPath();
      g.arc(RITUAL_X, RITUAL_Y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rit, false);
      g.strokePath();
    }
    this.ritualBtn.setAlpha(ready ? 1 : 0.45);
    const pop = time - this.ritualReadyAt < 300 ? 1.6 - ((time - this.ritualReadyAt) / 300) * 0.6 : 1;
    this.ritualBtn.setScale(ready ? pop + Math.sin(time * 0.01) * 0.08 : 1);

    for (const b of this.buttons) {
      const ok = b.can() && !this.ended;
      const pressed = time < b.downUntil;
      b.img.setTexture(pressed ? 'act-round-down' : ok ? 'act-round-ready' : 'act-round').setAlpha(ok || pressed ? 1 : 0.6);
      b.img.setScale(pressed ? 0.9 : ok ? 1 + Math.max(0, Math.sin(time * 0.008)) * 0.06 : 1);
      b.icon.y = b.y + (pressed ? 1 : 0);
      b.icon.setAlpha(ok || pressed ? 1 : 0.35);
      if (ok) g.lineStyle(1, COL.G, 0.25 + Math.max(0, Math.sin(time * 0.008)) * 0.5).strokeCircle(b.x, b.y, 13);
    }
  }

  private banner(text: string, color: number, y = 120, sub?: string) {
    const t = pxText(this, FIELD.w + 60, y, text, color).setOrigin(0.5).setScale(2).setDepth(DEPTH.hud);
    this.tweens.add({ targets: t, x: FIELD.w / 2, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, x: -60, delay: 1100, duration: 250, ease: 'Back.easeIn', onComplete: () => t.destroy() });
    if (sub) {
      const s = pxText(this, FIELD.w / 2, y + 12, sub, COL.v).setOrigin(0.5).setDepth(DEPTH.hud).setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, delay: 150, duration: 200 });
      this.tweens.add({ targets: s, alpha: 0, delay: 1100, duration: 200, onComplete: () => s.destroy() });
    }
  }

  private hitstop(ms: number) {
    this.hitstopUntil = Math.max(this.hitstopUntil, this.time.now + ms);
  }

  // ================================================================ eventos

  /** Mercador Encapuzado: troca almas da run por itens que ficam com você. */
  private showMerchant() {
    if (this.modalKind || this.ended) return;
    this.merchantPending = false;
    this.modalKind = 'merchant';
    const w = this.world;
    // Contrabando (árvore): desconto e um item a mais
    const offer = Array.from({ length: 3 + w.mods.merchantExtra }, () => rollItem(Math.random, 0.2 + this.world.regionIndex * 0.15));
    const shade = this.add.rectangle(0, 0, 180, 320, 0x0b0806, 0).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: 0.86, duration: 250 });
    const hood = this.add.sprite(90, 70, 'char-reaper0').setOrigin(0.5, 1).setScale(1).setDepth(DEPTH.modal + 1).setTint(0x9a8a70);
    const t1 = pxText(this, 90, 78, 'MERCADOR ENCAPUZADO', COL.y).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    const t2 = pxText(this, 90, 88, 'almas da run por itens que ficam com você', COL.v).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    const soulsLine = pxText(this, 90, 100, '', COL.G).setOrigin(0.5, 0).setDepth(DEPTH.modal + 1);
    this.modal.push(shade, hood, t1, t2, soulsLine);
    audio.play('bell');
    const refresh = () => setPxText(soulsLine, `você tem ${fmt(w.souls)} almas`);
    refresh();
    offer.forEach((id, i) => {
      const it = ITEM_BY_ID[id];
      const price = Math.round((ITEM_PRICE[it.rarity] * 0.45 * (1 - w.mods.merchantDiscount)) / 10) * 10;
      const y = offer.length > 3 ? 104 + i * 40 : 114 + i * 48;
      const c = this.add.container(5, y + 120).setDepth(DEPTH.modal + 1).setAlpha(0);
      const parts: Phaser.GameObjects.GameObject[] = [
        this.add.image(0, 0, 'item-card').setOrigin(0),
        this.add.image(16, 22, `slot-${it.rarity}`),
        this.add.image(16, 22, `item-${id}`).setScale(2),
        pxText(this, 32, 4, it.name.toUpperCase(), parseInt(RARITY_COLOR[it.rarity].slice(1), 16)),
        pxText(this, 32, 13, wrap(it.desc(meta.items[id] !== undefined ? meta.items[id] + 1 : 0), 33), COL.u),
        pxText(this, 165, 34, `${fmt(price)} almas`, w.souls >= price ? COL.G : COL.B).setOrigin(1, 0),
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
    const b = button(
      this,
      90,
      offer.length > 3 ? 284 : 270,
      'SEGUIR',
      () => {
        this.closeModal();
        this.persist();
      },
      { depth: DEPTH.modal + 1, color: COL.G },
    );
    this.modal.push(b.img, b.label);
  }

  /** Evento entre ondas ou encruzilhada: 2 escolhas em painéis. */
  private showEvent() {
    if (this.modalKind || this.ended) return;
    const w = this.world;
    const ev = w.event;
    if (!ev) return;
    this.modalKind = 'event';
    this.drag = null;
    const route = ev.id === 'route';
    const def = EVENT_BY_ID[ev.id];
    const shade = this.add.rectangle(0, 0, 180, 320, 0x0b0806, 0).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: 0.86, duration: 250 });
    const title = pxText(this, 90, 60, route ? 'ENCRUZILHADA' : def.title.toUpperCase(), route ? COL.y : COL.G)
      .setOrigin(0.5)
      .setScale(2)
      .setDepth(DEPTH.modal + 1)
      .setAlpha(0);
    const text = pxText(this, 90, 76, wrap(route ? 'escolha o caminho até a próxima região' : def.text, 40), COL.v)
      .setOrigin(0.5, 0)
      .setCenterAlign()
      .setDepth(DEPTH.modal + 1)
      .setAlpha(0);
    this.tweens.add({ targets: [title, text], alpha: 1, duration: 300 });
    this.modal.push(shade, title, text);
    audio.play(route ? 'bell' : 'card');

    const options: [string, string][] = route ? ev.choices.map((id) => [ROUTE_BY_ID[id].name.toUpperCase(), ROUTE_BY_ID[id].desc]) : def.options;
    options.forEach(([label, desc], i) => {
      const y = 104 + i * 54;
      const c = this.add
        .container(5, y + 160)
        .setDepth(DEPTH.modal + 1)
        .setAlpha(0);
      const color = route ? COL.y : i === 0 ? COL.G : COL.u;
      c.add([
        this.add.image(0, 0, 'item-card').setOrigin(0),
        pxText(this, 8, 6, label, color),
        pxText(this, 8, 17, wrap(desc, 38), COL.u),
        pxText(this, 165, 34, `${i + 1}`, COL.B).setOrigin(1, 0),
      ]);
      c.setInteractive(new Phaser.Geom.Rectangle(0, 0, 170, 44), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', () => this.pickEvent(i));
      this.tweens.add({ targets: c, y, alpha: 1, delay: 120 + i * 100, duration: 350, ease: 'Back.easeOut' });
      this.modal.push(c);
    });
  }

  private pickEvent(i: number) {
    if (this.modalKind !== 'event' || this.world.phase !== 'event') return;
    audio.play('card');
    buzz('medium');
    this.shaker.add(0.15);
    this.world.resolveEvent(i);
    this.closeModal();
    this.persist();
  }

  private closeModal() {
    for (const o of this.modal) o.destroy();
    this.modal = [];
    this.modalKind = null;
  }

  // ================================================================ pausa e resultados

  private togglePause() {
    if (this.ended) return;
    if (this.modalKind === 'pause') {
      this.closeModal();
      if (this.world.phase === 'event') this.showEvent();
      return;
    }
    if (this.modalKind === 'event') this.closeModal();
    if (this.modalKind) return;
    this.modalKind = 'pause';
    audio.play('click');
    const shade = this.add.rectangle(0, 0, 180, 320, 0x0b0806, 0.88).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
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
    if (this.world.route) {
      this.modal.push(
        pxText(this, 90, y, `rota: ${ROUTE_BY_ID[this.world.route].name.toLowerCase()}`, COL.y)
          .setOrigin(0.5, 0)
          .setDepth(DEPTH.modal + 1),
      );
      y += 12;
    }
    if (y === 64) {
      this.modal.push(
        pxText(this, 90, y + 6, wrap('nenhuma escola ativa. equipe 2 itens da mesma escola para a maestria', 40), COL.B)
          .setOrigin(0.5, 0)
          .setCenterAlign()
          .setDepth(DEPTH.modal + 1),
      );
    }
    const b1 = button(this, 90, 226, 'CONTINUAR', () => this.togglePause(), { depth: DEPTH.modal + 1, color: COL.G });
    const b3 = button(
      this,
      90,
      250,
      'SAIR E SALVAR',
      () => {
        this.persist();
        this.report('exit');
        this.ended = true;
        transitionTo(this, 'Menu');
      },
      { depth: DEPTH.modal + 1 },
    );
    this.modal.push(b3.img, b3.label);
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
    clearRun();
    this.report(quit ? 'quit' : 'death');
    const w = this.world;
    const where =
      w.abyss > 0 ? `${circleName(w.abyss).toUpperCase()} - ONDA ${w.localWave}` : `${w.region.name.toUpperCase()} - ONDA ${Math.max(1, w.localWave)}`;
    const sum = applyRunResult(meta, {
      wave: w.wave,
      where: where.toLowerCase(),
      souls: w.souls,
      kills: w.kills,
      killsByKind: w.killsByKind,
      bossesKilled: w.bossesKilled,
      loot: w.loot,
      gems: w.gems,
      cards: 0,
      schoolCounts: w.schoolCounts(),
      character: w.setup.character ?? meta.character,
      heresy: w.setup.heresy ?? 0,
      daily: this.daily,
      quit,
      time: w.time,
      stats: w.stats,
    });
    saveMeta();

    const shade = this.add.rectangle(0, 0, 180, 320, 0x0b0806, 0).setOrigin(0).setDepth(DEPTH.modal).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: 0.88, duration: 500 });
    this.modal.push(shade);
    const lines: [string, number, number][] = [
      [quit ? 'VOCÊ DESISTIU' : 'O NECROMANTE CAIU', COL.R, 2],
      [this.daily ? `DESAFIO DIÁRIO - ${where}` : where, COL.u, 1],
      ['', 0, 1],
      [`abates: ${w.kills}   exército máximo: ${w.stats.maxArmy}`, COL.u, 1],
    ];
    if (sum.mvp) lines.push([`mvp: ${sum.mvp.toLowerCase()}`, COL.u, 1]);
    lines.push([`+${sum.earned} almas para o cemitério`, COL.G, 1]);
    if (sum.bonus > 0) lines.push([`(inclui +${sum.bonus} de bônus)`, COL.g, 1]);
    for (const c of sum.champions) lines.push([`campeão: ${c}`, COL.y, 1]);
    for (const l of sum.loot.slice(0, 3)) lines.push([`item: ${l}`, 0xe0b040, 1]);
    if (sum.loot.length > 3) lines.push([`+${sum.loot.length - 3} itens`, 0xe0b040, 1]);
    if (w.gems.length) lines.push([`gemas: ${w.gems.length} (para o altar)`, 0xa060d0, 1]);
    for (const a of sum.achievements.slice(0, 3)) lines.push([`conquista: ${a.name.toLowerCase()} +${a.reward}`, COL.G, 1]);
    if (sum.achievements.length > 3) lines.push([`+${sum.achievements.length - 3} conquistas`, COL.G, 1]);
    if (sum.newSchool) lines.push(['nova escola liberada!', COL.y, 1]);
    if (sum.heresyUnlocked) lines.push([`heresia ${sum.heresyUnlocked} liberada!`, COL.R, 1]);
    if (sum.record) lines.push(['NOVO RECORDE!', COL.y, 1]);
    if (sum.dailyBest) lines.push(['melhor marca do dia!', COL.y, 1]);
    let y = 62;
    lines.slice(0, 15).forEach(([text, color, scale], i) => {
      if (!text) {
        y += 6;
        return;
      }
      const t = pxText(this, 90, y, text, color)
        .setOrigin(0.5)
        .setScale(scale)
        .setDepth(DEPTH.modal + 1)
        .setAlpha(0);
      this.tweens.add({
        targets: t,
        alpha: 1,
        delay: 300 + i * 140,
        duration: 250,
        onStart: () => {
          if (i <= 2) return;
          audio.play(text.startsWith('conquista') ? 'synergy' : 'click');
          if (text.startsWith('conquista')) buzz('medium');
        },
      });
      this.modal.push(t);
      y += scale === 2 ? 20 : 11;
    });
    const again = button(this, 90, 250, 'DE NOVO', () => transitionTo(this, 'Run', this.daily ? { daily: true } : undefined), {
      depth: DEPTH.modal + 1,
      color: COL.G,
    });
    const menu = button(this, 90, 274, 'MENU', () => transitionTo(this, 'Menu'), { depth: DEPTH.modal + 1 });
    for (const o of [again.img, again.label, menu.img, menu.label]) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, delay: 400 + lines.length * 140, duration: 300 });
    }
    this.modal.push(again.img, again.label, menu.img, menu.label);
  }
}
