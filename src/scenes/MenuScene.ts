import Phaser from 'phaser';
import { pageOpen } from '../sim/unlocks';
import { audio } from '../audio/audio';
import { charKey, GROUND_STYLES, unitKey } from '../art/generate';
import { COL } from '../art/palette';
import { CHAR_GLOW } from '../art/sprites';
import { cap, pxText, pxWidth, setPxText } from '../art/text';
import { button, DEPTH, flash, Shaker, transitionIn, transitionTo, type UIButton } from '../fx/juice';
import { fmt } from '../fx/numbers';
import { wrap } from './BestiaryScene';
import { buzz } from '../platform/haptics';
import { meta, saveMeta, savedRun } from '../platform/save';
import { CHARACTERS } from '../sim/characters';
import { BOSS_DEFS, BOSS_KINDS } from '../sim/defs';
import { levelInfo, levelRoman, MAX_HERESY, SOUL_BONUS_PER_LEVEL } from '../sim/heresy';
import { buyCharacter, characterState, levelUnlocked, maxStartRegion } from '../sim/meta';
import { todayKey } from '../sim/progress';
import { REGIONS } from '../sim/regions';
import { championUnlocked } from '../sim/tree';
import type { BossKind } from '../sim/types';
import { relicsOf } from '../sim/items';
import { CHECKPOINT_SKELETONS } from '../sim/world';
import { type NavBar, navBar } from './nav';
import { Darkness, Scenery } from './scenery';
import { GROW, MENU_TOP, screenTop, VIEW_H } from '../fx/view';

const CX = 90;
/** em tela comprida, 60% da sobra vai para cima do palco e o resto entre o cerco e os botões */
const LIFT = Math.round(GROW * 0.6);
/** pés do necromante no altar */
const BASE_Y = 118 + LIFT;
/** altura das setas de troca */
const STAGE_Y = 82 + LIFT;
/** topo do cartão do personagem */
const CARD_Y = 136 + LIFT;
/** linha do cerco e da heresia */
const ROW_Y = 204 + LIFT;
/** botões presos na base, logo acima da barra de abas */
const START_Y = 252 + GROW;
const SECOND_Y = 276 + GROW;

/** Ícone do chefe de um cerco (o sprite dele parado). */
function bossIcon(scene: Phaser.Scene, region: number): string {
  const boss = REGIONS[region].boss;
  for (const k of [`${unitKey(boss)}0`, `${boss}0`, `champ-${boss}0`]) if (scene.textures.exists(k)) return k;
  return 'icon-skull';
}

/**
 * Tela inicial: o necromante no altar, troca de personagem, onde começar, heresia e INICIAR.
 * Em cima, a barra de ícones leva para o resto (mercado, arsenal, árvore...).
 */
export class MenuScene extends Phaser.Scene {
  private dark!: Darkness;
  private scenery!: Scenery;
  private shaker!: Shaker;
  private nav!: NavBar;
  private index = 0;
  private sprite!: Phaser.GameObjects.Sprite;
  private glow!: Phaser.GameObjects.Image;
  private champ?: Phaser.GameObjects.Sprite;
  private name!: Phaser.GameObjects.BitmapText;
  private title!: Phaser.GameObjects.BitmapText;
  private traits!: Phaser.GameObjects.BitmapText;
  private dots: Phaser.GameObjects.Image[] = [];
  private regionText?: Phaser.GameObjects.BitmapText;
  private regionSub?: Phaser.GameObjects.BitmapText;
  private regionBoss?: Phaser.GameObjects.Image;
  private descent: Phaser.GameObjects.GameObject[] = [];
  private levelDesc?: Phaser.GameObjects.BitmapText;
  private start!: UIButton;
  private ringBack?: Phaser.GameObjects.Graphics;
  private ringFront?: Phaser.GameObjects.Graphics;
  private motes: Phaser.GameObjects.Image[] = [];
  private ringFlashUntil = 0;

  constructor() {
    super('Menu');
  }

  create() {
    this.motes = [];
    this.ringFlashUntil = 0;
    this.shaker = new Shaker(this.cameras.main);
    const region = Math.min(3, meta.bossesBeaten);
    audio.setRegion(region);
    audio.setIntensity(0);
    this.scenery = new Scenery(this);
    this.scenery.build(region, 0, LIFT);
    this.dark = new Darkness(this, 0.6, VIEW_H, MENU_TOP);
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === meta.character));

    this.add
      .particles(0, 0, 'px', {
        x: { min: 0, max: 180 },
        y: { min: 40, max: VIEW_H },
        lifespan: { min: 2000, max: 4000 },
        speedY: { min: -8, max: -2 },
        speedX: { min: -2, max: 2 },
        alpha: { start: 0.8, end: 0 },
        tint: [COL.g, COL.G],
        frequency: 160,
      })
      .setDepth(DEPTH.glow);

    this.nav = navBar(this, 'home');

    // ---- palco: o necromante no altar, com setas para trocar
    this.add.image(CX, BASE_Y, 'altar').setScale(2).setDepth(DEPTH.altar);
    this.glow = this.add.image(CX, BASE_Y - 34, 'glow64').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow).setAlpha(0.45);
    this.tweens.add({ targets: this.glow, alpha: 0.25, scale: 1.15, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.sprite = this.add.sprite(CX, BASE_Y, 'necro0').setOrigin(0.5, 1).setScale(1.5).setDepth(DEPTH.world + BASE_Y);
    this.tweens.add({ targets: this.sprite, y: BASE_Y - 2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const [x, dir] of [
      [11, -1],
      [169, 1],
    ]) {
      const b = this.add.image(x, STAGE_Y, 'arrow-btn').setDepth(DEPTH.hud).setInteractive({ useHandCursor: true });
      const a = pxText(this, x, STAGE_Y - 3, dir < 0 ? '<' : '>', COL.U).setOrigin(0.5, 0).setDepth(DEPTH.hud + 1);
      b.on('pointerdown', () => {
        b.setTexture('arrow-btn-down');
        a.y = STAGE_Y - 2;
        this.move(dir);
      });
      const up = () => {
        b.setTexture('arrow-btn');
        a.y = STAGE_Y - 3;
      };
      b.on('pointerup', up).on('pointerout', up);
    }
    // deslizar o dedo sobre o necromante também troca
    let startX = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (startX = p.worldX));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (Math.abs(p.worldX - startX) > 30 && p.worldY > 24 && p.worldY < BASE_Y + 8) this.move(p.worldX < startX ? 1 : -1);
    });
    this.renderChampion();
    // um ponto por personagem, o atual aceso
    this.dots = CHARACTERS.map((_, i) =>
      this.add.image(CX - (CHARACTERS.length - 1) * 3 + i * 6, BASE_Y + 14, 'px2').setDepth(DEPTH.hud),
    );
    if (meta.best.wave > 0) pxText(this, 6, 22, `recorde: onda ${meta.best.wave}`, COL.v).setDepth(DEPTH.hud).setAlpha(0.85);

    const firstUi = this.children.length;
    // ---- cartão do personagem: nome, título (ou o que falta para liberar) e características
    this.add.nineslice(CX, CARD_Y + 31, 'card', undefined, 168, 62, 6, 6, 6, 6).setDepth(DEPTH.hud - 1).setAlpha(0.95);
    this.name = pxText(this, CX, CARD_Y + 5, '', COL.u, false, true).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.title = pxText(this, CX, CARD_Y + 18, '', COL.v).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.add.rectangle(CX, CARD_Y + 27, 120, 1, COL.y, 0.25).setDepth(DEPTH.hud);
    this.traits = pxText(this, CX, CARD_Y + 30, '', COL.u).setOrigin(0.5, 0).setCenterAlign().setDepth(DEPTH.hud);

    // ---- a run: nível da Descida e cerco onde começa (abre "A Descida")
    meta.heresy = Math.max(0, Math.min(meta.heresy, meta.heresyMax));
    meta.startRegion = Math.min(meta.startRegion, maxStartRegion(meta));
    const rx = 6;
    const regionW = 168;
    // faixa do cerco: a do kit de interface (acende ao passar o mouse), ou o chip gerado
    const kit = this.textures.exists('ui-siege');
    const band = this.add
      .nineslice(rx + regionW / 2, ROW_Y + 12, kit ? 'ui-siege' : 'chip', undefined, regionW, 24, kit ? 4 : 6, kit ? 4 : 6, kit ? 4 : 6, kit ? 4 : 6)
      .setDepth(DEPTH.hud)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openDescent());
    if (kit && this.textures.exists('ui-siege-hover')) {
      band.on('pointerover', () => band.setTexture('ui-siege-hover')).on('pointerout', () => band.setTexture('ui-siege'));
    }
    this.regionBoss = this.add.image(rx + 12, ROW_Y + 13, '__WHITE').setDepth(DEPTH.hud);
    this.regionText = pxText(this, rx + 24, ROW_Y + 5, '', COL.u).setDepth(DEPTH.hud);
    this.regionSub = pxText(this, rx + 24, ROW_Y + 14, '', COL.v).setDepth(DEPTH.hud);
    if (this.textures.exists('ui-chevron')) {
      // seta do kit: aponta para baixo (abre a Descida) e já balança sozinha
      this.add.image(rx + regionW - 8, ROW_Y + 12, 'ui-chevron').setDepth(DEPTH.hud);
    } else {
      const chev = pxText(this, rx + regionW - 7, ROW_Y + 9, '>', COL.U).setOrigin(0.5, 0).setDepth(DEPTH.hud);
      this.tweens.add({ targets: chev, x: chev.x + 2, duration: 260, yoyo: true, repeat: -1, repeatDelay: 1800, ease: 'Sine.easeInOut' });
    }
    this.levelDesc = pxText(this, CX, ROW_Y + 28, '', COL.v).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.refreshRegion();

    // ---- botões: iniciar (dourado e grande), continuar e diário
    this.start = button(this, CX, START_Y, 'INICIAR', () => this.act(), { tex: 'btn-gold-l', down: 'btn-gold-l-down', color: COL.k });
    const today = todayKey();
    const dailyDone = meta.daily.date === today && meta.daily.tries > 0;
    if (savedRun) {
      const wave = Math.max(1, (savedRun.snap.state.wave as number) ?? 1);
      button(this, 47, SECOND_Y, `CONTINUAR ${wave}`, () => transitionTo(this, 'Run', { resume: true }), { tex: 'btn-half', down: 'btn-half-down', color: COL.y });
    }
    // o desafio diário só aparece depois da primeira run
    if (pageOpen(meta, 'daily')) {
      button(this, savedRun ? 133 : CX, SECOND_Y, dailyDone ? `DIÁRIO: ${meta.daily.best}` : 'DESAFIO DIÁRIO', () => transitionTo(this, 'Run', { daily: true }), {
        tex: 'btn-half',
        down: 'btn-half-down',
        color: dailyDone ? COL.v : COL.U,
      });
    }
    if (meta.runs === 0 && !savedRun) {
      // primeira vez: o botão dourado respira para chamar o dedo
      this.tweens.add({ targets: [this.start.img, this.start.label], scale: 1.04, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });
    }

    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.act());
    this.refresh(0);
    this.introCascade(this.children.list.slice(firstUi));
    this.startAmbient();
    transitionIn(this);
  }

  // ---------------------------------------------------------------- campeão

  /** O campeão fica ao lado do altar; tocar troca entre os que você tem. */
  private renderChampion() {
    this.champ?.destroy();
    this.champ = undefined;
    if (!championUnlocked(meta)) return;
    const owned = BOSS_KINDS.filter((b) => (meta.champions[b] ?? 0) > 0);
    if (!owned.length) return;
    const sel = meta.selectedChampion && owned.includes(meta.selectedChampion) ? meta.selectedChampion : null;
    const key = sel ? unitKey('champion', sel) : 'champ-woodcutter';
    const s = this.add
      .sprite(CX + 52, BASE_Y, `${key}0`)
      .setOrigin(0.5, 1)
      .setScale(0.75)
      .setFlipX(true)
      .setDepth(DEPTH.world + BASE_Y)
      .setInteractive({ useHandCursor: true });
    if (sel) {
      s.play(`${key}-walk`);
      s.anims.timeScale = 0.3;
    } else s.setTintFill(0x2a2018).setAlpha(0.6);
    s.on('pointerdown', () => {
      const opts: (BossKind | null)[] = [null, ...owned];
      const next = opts[(opts.indexOf(sel) + 1) % opts.length];
      meta.selectedChampion = next;
      saveMeta();
      audio.play('click');
      buzz('light');
      this.renderChampion();
      this.toast(next ? `campeão: ${BOSS_DEFS[next].name.toLowerCase()} rank ${meta.champions[next]}` : 'sem campeão');
    });
    this.champ = s;
  }

  private toast(text: string) {
    const t = pxText(this, CX, 36, text, COL.y).setOrigin(0.5, 0).setDepth(DEPTH.hud + 1);
    this.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 300, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- vida no menu

  /** Entrada: o que fica embaixo do palco sobe em cascata, de cima para baixo. */
  private introCascade(objs: Phaser.GameObjects.GameObject[]) {
    for (const o of objs) {
      const t = o as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Visible;
      if (typeof t.y !== 'number' || typeof t.alpha !== 'number' || !t.visible) continue;
      const y = t.y;
      const a = t.alpha;
      t.y = y + 8;
      t.alpha = 0;
      this.tweens.add({ targets: t, y, alpha: a, duration: 260, delay: 40 + Math.max(0, y - CARD_Y) * 1.4, ease: 'Cubic.easeOut' });
    }
  }

  /** Anel de runas, almas em órbita, feitiço de vez em quando, fantasma no fundo e brilho no botão. */
  private startAmbient() {
    // acima da escuridão do cenário (senão some); a parte de trás não passa por cima do corpo
    this.ringBack = this.add.graphics().setDepth(DEPTH.glow);
    this.ringFront = this.add.graphics().setDepth(DEPTH.glow + 1);
    this.motes = [0, 1, 2].map((i) =>
      this.add.image(CX, BASE_Y, 'px2').setTint(i === 1 ? COL.G : COL.g).setBlendMode(Phaser.BlendModes.ADD),
    );
    this.time.addEvent({ delay: 6500, startAt: 3500, loop: true, callback: () => this.castSpark() });
    this.time.addEvent({ delay: 15000, startAt: 9000, loop: true, callback: () => this.ghostFly() });
    this.time.addEvent({ delay: 4200, startAt: 2600, loop: true, callback: () => this.shine() });
  }

  private glowColor() {
    return CHAR_GLOW[CHARACTERS[this.index].id] ?? COL.g;
  }

  /** Anel tracejado girando em volta do altar: a metade de trás fica atrás do necromante. */
  private drawRing(time: number) {
    const back = this.ringBack;
    const front = this.ringFront;
    if (!back || !front) return;
    back.clear();
    front.clear();
    const col = this.glowColor();
    const boost = Math.max(0, this.ringFlashUntil - time) / 500;
    const cx = CX;
    const cy = BASE_Y - 2;
    const rx = 56;
    const ry = 14;
    const spin = time * 0.00035;
    const N = 96;
    for (let i = 0; i < N; i++) {
      if ((i + Math.floor(time * 0.004)) % 6 >= 4) continue;
      const a = (i / N) * Math.PI * 2 + spin;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      const behind = Math.sin(a) <= 0;
      if (behind && Math.abs(x - cx) < 15) continue;
      (behind ? back : front).fillStyle(col, Math.min(1, (behind ? 0.45 : 0.85) + boost)).fillRect(x, y, 1, 1);
    }
    // quatro runas: pontos de 2 px mais claros, girando no sentido contrário
    for (let k = 0; k < 4; k++) {
      const a = -spin * 2 + (k * Math.PI) / 2;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      const behind = Math.sin(a) <= 0;
      if (behind && Math.abs(x - cx) < 15) continue;
      (behind ? back : front).fillStyle(COL.G, behind ? 0.6 : 1).fillRect(x - 1, y, 2, 1);
    }
    // almas em órbita: passam atrás e na frente do necromante
    this.motes.forEach((m, i) => {
      const a = time * 0.0011 + (i * Math.PI * 2) / 3;
      const s = Math.sin(a);
      m.setPosition(Math.round(CX + Math.cos(a) * 24), Math.round(BASE_Y - 26 + s * 6 + Math.sin(time * 0.003 + i) * 2));
      m.setDepth(DEPTH.glow + 2);
      // atrás do corpo: some
      const hidden = s <= 0 && Math.abs(m.x - CX) < 13;
      m.setAlpha(hidden ? 0 : 0.5 + 0.45 * Math.abs(Math.sin(time * 0.004 + i * 1.7)));
    });
  }

  /** O cajado faísca, o brilho pulsa e uma alma sobe do altar. */
  private castSpark() {
    if (this.descent.length || characterState(meta, CHARACTERS[this.index].id) === 'locked') return;
    const col = this.glowColor();
    const sx = CX + 15;
    const sy = this.sprite.y - 48;
    const burst = this.add
      .particles(sx, sy, 'px', { speed: { min: 8, max: 26 }, lifespan: { min: 300, max: 650 }, alpha: { start: 1, end: 0 }, tint: [col, COL.G, 0xffffff], emitting: false })
      .setDepth(DEPTH.glow + 1);
    burst.explode(14);
    this.time.delayedCall(900, () => burst.destroy());
    this.tweens.add({ targets: this.glow, alpha: 0.85, duration: 120, yoyo: true });
    this.ringFlashUntil = this.time.now + 500;
    const soul = this.add.image(CX + Phaser.Math.Between(-12, 12), BASE_Y - 6, 'px2').setTint(COL.G).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow);
    this.tweens.add({ targets: soul, y: BASE_Y - 80, alpha: 0, duration: 1600, ease: 'Sine.easeIn', onComplete: () => soul.destroy() });
  }

  /** Um fantasma atravessa o fundo do palco, devagar e translúcido. */
  private ghostFly() {
    if (this.descent.length || !this.textures.exists('ghost0')) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y0 = Phaser.Math.Between(42, 72) + LIFT;
    const g = this.add
      .sprite(dir > 0 ? -10 : 190, y0, 'ghost0')
      .setOrigin(0.5, 1)
      .setFlipX(dir < 0)
      .setAlpha(0)
      .setDepth(DEPTH.altar + 1);
    if (this.anims.exists('ghost-walk')) g.play('ghost-walk');
    this.tweens.add({ targets: g, alpha: 0.35, duration: 800 });
    this.tweens.add({
      targets: g,
      x: dir > 0 ? 190 : -10,
      duration: 9000,
      ease: 'Linear',
      onUpdate: (tw) => (g.y = Math.round(y0 + Math.sin(tw.progress * Math.PI * 6) * 3)),
      onComplete: () => g.destroy(),
    });
  }

  /** Reflexo de luz atravessando o botão dourado. */
  private shine() {
    const img = this.start.img;
    if (this.descent.length || !img.visible || img.alpha < 1) return;
    const b = img.getBounds();
    const mask = this.make.graphics({}, false).fillRect(b.x + 2, b.y + 2, b.width - 4, b.height - 5);
    const band = this.add.graphics().setDepth(img.depth + 0.5).setBlendMode(Phaser.BlendModes.ADD);
    band.fillStyle(0xffffff, 0.35);
    band.fillPoints([new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(5, 0), new Phaser.Math.Vector2(-3, b.height), new Phaser.Math.Vector2(-8, b.height)], true);
    band.fillStyle(0xffffff, 0.18);
    band.fillPoints([new Phaser.Math.Vector2(7, 0), new Phaser.Math.Vector2(9, 0), new Phaser.Math.Vector2(1, b.height), new Phaser.Math.Vector2(-1, b.height)], true);
    band.setPosition(b.x - 10, b.y);
    band.setMask(mask.createGeometryMask());
    this.tweens.add({
      targets: band,
      x: b.right + 10,
      duration: 520,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        band.destroy();
        mask.destroy();
      },
    });
  }

  /** Troca de personagem: almas explodem do altar e o anel acende. */
  private swapBurst() {
    const col = this.glowColor();
    const p = this.add
      .particles(CX, BASE_Y - 4, 'px', { speed: { min: 10, max: 40 }, angle: { min: 200, max: 340 }, lifespan: { min: 300, max: 700 }, alpha: { start: 1, end: 0 }, tint: [col, COL.G], emitting: false })
      .setDepth(DEPTH.glow + 1);
    p.explode(18);
    this.time.delayedCall(900, () => p.destroy());
    this.ringFlashUntil = this.time.now + 500;
    for (const t of [this.title, this.traits]) {
      const a = t.alpha;
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: a, duration: 220, delay: 60 });
    }
  }

  // ---------------------------------------------------------------- personagem

  private move(dir: number) {
    this.index = (this.index + dir + CHARACTERS.length) % CHARACTERS.length;
    audio.play('click');
    buzz('light');
    this.refresh(dir);
  }

  private refresh(dir: number) {
    const c = CHARACTERS[this.index];
    const state = characterState(meta, c.id);
    const key = charKey(c.id);
    this.sprite.setTexture(`${key}0`).play(`${key}-idle`);
    if (state === 'locked') this.sprite.setTintFill(0x0b0806);
    else this.sprite.clearTint();
    this.glow.setTint(CHAR_GLOW[c.id] ?? COL.g);
    if (dir) {
      this.swapBurst();
      this.sprite.x = CX + dir * 40;
      this.sprite.alpha = 0;
      this.tweens.add({ targets: this.sprite, x: CX, alpha: 1, duration: 250, ease: 'Cubic.easeOut' });
    }
    setPxText(this.name, state === 'locked' ? '???' : c.name.toUpperCase());
    // três características e o ritual: cabe no cartão
    setPxText(this.traits, [...c.traits.slice(0, 3), `ritual: ${c.ritual.name}`].map(cap).join('\n'));
    this.traits.setAlpha(state === 'locked' ? 0.4 : 1);
    this.dots.forEach((d, i) => d.setTint(i === this.index ? COL.U : COL.B).setAlpha(i === this.index ? 1 : 0.6));
    // a linha do título diz o que falta quando o personagem não é seu
    if (state === 'owned') {
      setPxText(this.title, c.title);
      this.title.setTint(COL.v);
      this.start.label.setText('INICIAR');
      this.start.setEnabled(true);
    } else if (state === 'buyable') {
      setPxText(this.title, 'liberado! compre com almas');
      this.title.setTint(COL.y);
      this.start.label.setText(`COMPRAR ${fmt(c.price)}`);
      this.start.setEnabled(meta.souls >= c.price);
    } else {
      setPxText(this.title, `bloqueado: ${c.unlock.text}`);
      this.title.setTint(COL.R);
      this.start.label.setText('BLOQUEADO');
      this.start.setEnabled(false);
    }
  }

  private act() {
    const c = CHARACTERS[this.index];
    const state = characterState(meta, c.id);
    if (state === 'owned') {
      meta.character = c.id;
      saveMeta();
      transitionTo(this, 'Run');
    } else if (state === 'buyable' && buyCharacter(meta, c.id)) {
      meta.character = c.id;
      saveMeta();
      audio.play('synergy');
      buzz('heavy');
      this.shaker.add(0.6);
      flash(this, CHAR_GLOW[c.id] ?? COL.g, 0.4, 300);
      this.nav.setSouls(meta.souls);
      this.tweens.add({ targets: this.sprite, scaleX: 1.8, scaleY: 1.3, duration: 90, yoyo: true });
      this.refresh(0);
    }
  }

  // ---------------------------------------------------------------- região e heresia

  private refreshRegion() {
    if (!this.regionText || !this.regionSub || !this.regionBoss) return;
    const r = meta.startRegion;
    const l = meta.heresy;
    setPxText(this.regionText, `${levelRoman(l)} · ${REGIONS[r].name.toUpperCase()}`);
    const parts = [r === 0 ? 'do começo' : `+${r * CHECKPOINT_SKELETONS} ossos`];
    if (l > 0) parts.push(`almas +${Math.round(l * SOUL_BONUS_PER_LEVEL * 100)}%`);
    setPxText(this.regionSub, parts.join(', '));
    this.regionSub.setTint(l > 0 ? levelInfo(l).color | 0x404040 : COL.v);
    this.regionBoss.setTexture(bossIcon(this, r)).setScale(0.5);
    if (this.levelDesc) {
      const info = levelInfo(l);
      const full = l === 0 ? (meta.heresyMax > 0 ? 'toque no cerco para descer mais fundo' : '') : `${info.name}: ${info.desc}`;
      setPxText(this.levelDesc, pxWidth(full) <= 172 ? full : pxWidth(info.desc) <= 172 ? info.desc : info.name);
      this.levelDesc.setTint(l === 0 ? COL.B : COL.v);
    }
  }

  /**
   * "A Descida": uma linha por nível, com os mesmos 4 cercos em cada uma.
   * Vencer um chefe libera começar no cerco seguinte daquele nível;
   * vencer a Catedral abre o nível de baixo.
   */
  private openDescent() {
    if (this.descent.length) return;
    audio.play('click');
    buzz('light');
    const D = DEPTH.modal;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.descent.push(o);
      return o;
    };
    const TOP = 18 + LIFT;
    const H = 290;
    add(this.add.rectangle(0, screenTop(this.scene.key), 180, VIEW_H, 0x0b0806, 0.88).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', () => this.closeDescent());
    add(this.add.nineslice(CX, TOP + H / 2, 'panel', undefined, 176, H, 5, 5, 5, 5).setDepth(D).setInteractive());
    add(pxText(this, CX, TOP + 8, 'A DESCIDA', COL.U, false, true).setOrigin(0.5, 0).setDepth(D + 1));
    add(pxText(this, CX, TOP + 24, 'os mesmos cercos, cada nível pior', COL.v).setOrigin(0.5, 0).setDepth(D + 1));

    const ROW0 = TOP + 36;
    const ROW_H = 28;
    const TILE = 20;
    const STEP = 22;
    const tileX = (i: number) => 171 - (REGIONS.length - i) * STEP + 1;
    const rows = MAX_HERESY + 1;
    const FOOT = ROW0 + rows * ROW_H + 4;
    const sel = add(this.add.graphics().setDepth(D + 4));
    const footName = add(pxText(this, 10, FOOT + 2, '', COL.u).setDepth(D + 1));
    const footDesc = add(pxText(this, 10, FOOT + 11, '', COL.v).setDepth(D + 1));
    const relicIcons: Phaser.GameObjects.Image[] = [];
    // relíquias do cerco: no tamanho normal do item (escala 2 = pixel do mundo)
    for (let k = 0; k < 2; k++) {
      const x = 141 + k * 23;
      add(this.add.nineslice(x, FOOT + 11, 'slot-legendary', undefined, 22, 22, 4, 4, 4, 4).setDepth(D + 1));
      relicIcons.push(add(this.add.image(x, FOOT + 11, '__WHITE').setScale(2).setDepth(D + 2)));
    }

    const draw = () => {
      const l = meta.heresy;
      const r = meta.startRegion;
      const x = tileX(r);
      const y = ROW0 + l * ROW_H + (ROW_H - TILE) / 2;
      sel.clear();
      sel.lineStyle(2, 0xf0c050, 1).strokeRect(x - 1, y - 1, TILE + 2, TILE + 2);
      const info = levelInfo(l);
      setPxText(footName, `${levelRoman(l)} ${info.name.toUpperCase()} - ${REGIONS[r].name.toUpperCase()}`);
      footName.setTint(l > 0 ? info.color | 0x404040 : COL.u);
      const bonus = l > 0 ? `almas +${Math.round(l * SOUL_BONUS_PER_LEVEL * 100)}%. ${info.desc}${l > 1 ? ', mais os níveis de cima' : ''}` : 'o cerco como ele é. as relíquias ao lado só caem neste cerco';
      setPxText(footDesc, wrap(bonus, 26));
      relicsOf(r).forEach((it, k) => {
        if (!relicIcons[k]) return;
        relicIcons[k].setTexture(`item-${it.id}`);
        if (it.id in meta.items) relicIcons[k].clearTint();
        else relicIcons[k].setTintFill(0x1a120c);
      });
    };

    for (let l = 0; l < rows; l++) {
      const y = ROW0 + l * ROW_H;
      const open = levelUnlocked(meta, l);
      const info = levelInfo(l);
      const done = meta.levels[l] ?? 0;
      const g = add(this.add.graphics().setDepth(D + 1));
      g.fillStyle(l % 2 ? 0x1c1510 : 0x16110d, 1).fillRect(6, y + 1, 168, ROW_H - 2);
      // faixa do nível: a cor esquenta conforme desce
      g.fillStyle(open ? info.color : 0x3a2e24, 1).fillRect(6, y + 1, 3, ROW_H - 2);
      const nameCol = open ? (l === 0 ? COL.u : info.color | 0x404040) : COL.B;
      add(pxText(this, 12, y + 5, levelRoman(l), open ? COL.U : COL.B).setDepth(D + 2));
      add(pxText(this, 25, y + 5, open ? info.name.toUpperCase() : '???', nameCol).setDepth(D + 2));
      const sub = !open ? 'bloqueado' : l === 0 ? `chefes ${done}/4` : `+${Math.round(l * SOUL_BONUS_PER_LEVEL * 100)}% almas ${done}/4`;
      add(pxText(this, 12, y + 15, sub, open ? COL.v : COL.B).setDepth(D + 2));
      REGIONS.forEach((_, i) => {
        const tx = tileX(i);
        const ty = y + (ROW_H - TILE) / 2;
        const can = open && i <= Math.min(3, done);
        const beaten = open && i < done;
        const st = GROUND_STYLES[i];
        const t = add(this.add.graphics().setDepth(D + 2));
        t.fillStyle(0x0b0806, 1).fillRect(tx - 1, ty - 1, TILE + 2, TILE + 2);
        t.fillStyle(can ? parseInt(st.b.slice(1), 16) : 0x15100c, 1).fillRect(tx, ty, TILE, TILE);
        if (can) t.fillStyle(parseInt(st.c.slice(1), 16), 0.5).fillRect(tx + 1, ty + 1, TILE - 2, TILE / 2);
        const icon = add(this.add.image(tx + TILE / 2, ty + TILE - 1, bossIcon(this, i)).setOrigin(0.5, 1).setDepth(D + 3));
        icon.setScale(Math.min(1, (TILE - 3) / Math.max(icon.frame.width, icon.frame.height)));
        if (!can) icon.setTintFill(0x07050b).setAlpha(open ? 0.8 : 0.45);
        // chefe vencido neste nível: marca dourada no canto
        if (beaten) t.fillStyle(0xf0c050, 1).fillRect(tx + TILE - 4, ty + 1, 3, 3);
        if (!can && open && i === done + 1) add(this.add.image(tx + TILE / 2, ty + TILE / 2, 'icon-lock').setDepth(D + 3).setAlpha(0.85));
        add(this.add.zone(tx + TILE / 2, ty + TILE / 2, STEP, ROW_H).setDepth(D + 5).setInteractive({ useHandCursor: can })).on('pointerdown', () => {
          if (!can) {
            audio.play('deny');
            this.toast(!open ? `vença a catedral no nível ${levelRoman(l - 1)}` : 'vença o chefe anterior neste nível');
            return;
          }
          const deeper = l > meta.heresy;
          audio.play(deeper ? 'hurt' : 'click');
          buzz(deeper ? 'medium' : 'light');
          if (deeper) this.shaker.add(0.15 + l * 0.05);
          meta.heresy = l;
          meta.startRegion = i;
          saveMeta();
          this.refreshRegion();
          draw();
        });
      });
    }
    draw();
    const close = button(this, CX, TOP + H - 15, 'FECHAR', () => this.closeDescent(), { tex: 'btn-red', down: 'btn-red-down', color: COL.u, depth: D + 2 });
    add(close.img);
    add(close.label);
  }

  private closeDescent() {
    for (const o of this.descent) o.destroy();
    this.descent = [];
  }

  update(time: number, delta: number) {
    this.shaker.update(delta / 1000);
    this.drawRing(time);
    this.dark.draw([...this.scenery.lights, { x: CX, y: BASE_Y - 26, key: 'light80', scale: 1.5 }], time);
  }
}
