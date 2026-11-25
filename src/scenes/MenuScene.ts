import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { charKey, GROUND_STYLES, unitKey } from '../art/generate';
import { COL } from '../art/palette';
import { CHAR_GLOW } from '../art/sprites';
import { pxText, setPxText } from '../art/text';
import { button, DEPTH, flash, Shaker, transitionIn, transitionTo, type UIButton } from '../fx/juice';
import { fmt } from '../fx/numbers';
import { buzz } from '../platform/haptics';
import { meta, saveMeta, savedRun } from '../platform/save';
import { CHARACTERS } from '../sim/characters';
import { BOSS_DEFS, BOSS_KINDS } from '../sim/defs';
import { HERESY, heresyName } from '../sim/heresy';
import { buyCharacter, characterState, maxStartRegion } from '../sim/meta';
import { todayKey } from '../sim/progress';
import { REGIONS } from '../sim/regions';
import { championUnlocked } from '../sim/tree';
import type { BossKind } from '../sim/types';
import { relicsOf } from '../sim/items';
import { CHECKPOINT_SKELETONS } from '../sim/world';
import { type NavBar, navBar } from './nav';
import { Darkness, Scenery } from './scenery';

const CX = 90;
const BASE_Y = 128;
const ROMAN = ['I', 'II', 'III', 'IV'];

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
  private status!: Phaser.GameObjects.BitmapText;
  private regionText?: Phaser.GameObjects.BitmapText;
  private regionSub?: Phaser.GameObjects.BitmapText;
  private regionBoss?: Phaser.GameObjects.Image;
  private descent: Phaser.GameObjects.GameObject[] = [];
  private heresyText?: Phaser.GameObjects.BitmapText;
  private heresyDesc?: Phaser.GameObjects.BitmapText;
  private start!: UIButton;

  constructor() {
    super('Menu');
  }

  create() {
    this.shaker = new Shaker(this.cameras.main);
    const region = Math.min(3, meta.bossesBeaten);
    audio.setRegion(region);
    audio.setIntensity(0);
    this.scenery = new Scenery(this);
    this.scenery.build(region);
    this.dark = new Darkness(this, 0.6, 320);
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === meta.character));

    this.add
      .particles(0, 0, 'px', {
        x: { min: 0, max: 180 },
        y: { min: 40, max: 320 },
        lifespan: { min: 2000, max: 4000 },
        speedY: { min: -8, max: -2 },
        speedX: { min: -2, max: 2 },
        alpha: { start: 0.8, end: 0 },
        tint: [COL.g, COL.G],
        frequency: 160,
      })
      .setDepth(DEPTH.glow);

    this.nav = navBar(this, 'home');

    // o necromante no altar, com setas para trocar
    this.add.image(CX, BASE_Y, 'altar').setScale(2).setDepth(DEPTH.altar);
    this.glow = this.add.image(CX, BASE_Y - 34, 'glow64').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow).setAlpha(0.45);
    this.tweens.add({ targets: this.glow, alpha: 0.25, scale: 1.15, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.sprite = this.add.sprite(CX, BASE_Y, 'necro0').setOrigin(0.5, 1).setScale(1.5).setDepth(DEPTH.world + BASE_Y);
    this.tweens.add({ targets: this.sprite, y: BASE_Y - 2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const [x, dir] of [
      [14, -1],
      [166, 1],
    ]) {
      const a = pxText(this, x, 96, dir < 0 ? '<' : '>', COL.U).setOrigin(0.5).setScale(2).setDepth(DEPTH.hud);
      this.tweens.add({ targets: a, x: x + dir * 2, yoyo: true, repeat: -1, duration: 500 });
      this.add
        .zone(x, 96, 34, 70)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.move(dir));
    }
    // deslizar o dedo sobre o necromante também troca
    let startX = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (startX = p.x));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (Math.abs(p.x - startX) > 30 && p.y > 40 && p.y < 140) this.move(p.x < startX ? 1 : -1);
    });
    this.renderChampion();

    // painel com o personagem e as opções da run
    this.add.image(CX, 188, 'panel').setDisplaySize(176, 104).setDepth(DEPTH.hud - 1).setAlpha(0.92);
    this.name = pxText(this, CX, 140, '', COL.u).setOrigin(0.5, 0).setScale(2).setDepth(DEPTH.hud);
    this.title = pxText(this, CX, 154, '', COL.v).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.traits = pxText(this, CX, 164, '', COL.u).setOrigin(0.5, 0).setCenterAlign().setDepth(DEPTH.hud);
    this.status = pxText(this, CX, 195, '', COL.y).setOrigin(0.5, 0).setDepth(DEPTH.hud);

    // onde o cerco começa: uma faixa com o chefe e o nome; tocar abre "A Descida"
    meta.startRegion = Math.min(meta.startRegion, maxStartRegion(meta));
    this.add
      .image(CX, 216, 'sel-row')
      .setDepth(DEPTH.hud)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openDescent());
    this.regionBoss = this.add.image(17, 217, '__WHITE').setDepth(DEPTH.hud);
    this.regionText = pxText(this, 30, 209, '', COL.u).setDepth(DEPTH.hud);
    this.regionSub = pxText(this, 30, 218, '', COL.v).setDepth(DEPTH.hud);
    pxText(this, 168, 213, 'V', COL.U).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.refreshRegion();
    if (meta.heresyMax > 0) {
      meta.heresy = Math.min(meta.heresy, meta.heresyMax);
      this.heresyText = pxText(this, CX, 228, '', COL.R).setOrigin(0.5, 0).setDepth(DEPTH.hud);
      this.heresyDesc = pxText(this, CX, 236, '', COL.v).setOrigin(0.5, 0).setDepth(DEPTH.hud);
      this.arrows(228, COL.R, (d) => this.heresyStep(d));
      this.refreshHeresy();
    }

    // botões: iniciar (dourado), continuar e diário
    this.start = button(this, CX, 254, 'INICIAR', () => this.act(), { tex: 'btn-gold', down: 'btn-gold-down', color: COL.k });
    const today = todayKey();
    const dailyDone = meta.daily.date === today && meta.daily.tries > 0;
    if (savedRun) {
      const wave = Math.max(1, (savedRun.snap.state.wave as number) ?? 1);
      button(this, 46, 280, `CONTINUAR ${wave}`, () => transitionTo(this, 'Run', { resume: true }), { tex: 'btn-half', down: 'btn-half-down', color: COL.y });
    }
    button(this, savedRun ? 134 : CX, 280, dailyDone ? `DIÁRIO: ${meta.daily.best}` : 'DESAFIO DIÁRIO', () => transitionTo(this, 'Run', { daily: true }), {
      tex: 'btn-half',
      down: 'btn-half-down',
      color: dailyDone ? COL.v : COL.U,
    });
    if (meta.best.wave > 0) pxText(this, CX, 298, `recorde: onda ${meta.best.wave}`, COL.v).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    if (meta.runs === 0 && !savedRun) {
      const hint = pxText(this, CX, 308, 'toque em iniciar para começar', COL.B).setOrigin(0.5, 0).setDepth(DEPTH.hud);
      this.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });
    }

    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.act());
    this.refresh(0);
    transitionIn(this);
  }

  private arrows(y: number, color: number, step: (dir: number) => void) {
    for (const [x, dir] of [
      [8, -1],
      [172, 1],
    ]) {
      pxText(this, x, y, dir < 0 ? '<' : '>', color).setOrigin(0.5, 0).setDepth(DEPTH.hud);
      this.add
        .zone(x, y + 3, 24, 10)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => step(dir));
    }
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
      this.sprite.x = CX + dir * 40;
      this.sprite.alpha = 0;
      this.tweens.add({ targets: this.sprite, x: CX, alpha: 1, duration: 250, ease: 'Cubic.easeOut' });
    }
    setPxText(this.name, state === 'locked' ? '???' : c.name.toUpperCase());
    setPxText(this.title, c.title);
    // três características e o ritual: cabe no painel
    setPxText(this.traits, [...c.traits.slice(0, 3), `ritual: ${c.ritual.name}`].join('\n'));
    this.traits.setAlpha(state === 'locked' ? 0.4 : 1);
    if (state === 'owned') {
      setPxText(this.status, CHARACTERS.length > 1 ? `${this.index + 1}/${CHARACTERS.length}` : '');
      this.status.setTint(COL.v);
      this.start.label.setText('INICIAR');
      this.start.setEnabled(true);
    } else if (state === 'buyable') {
      setPxText(this.status, 'liberado! compre com almas');
      this.status.setTint(COL.y);
      this.start.label.setText(`COMPRAR ${fmt(c.price)}`);
      this.start.setEnabled(meta.souls >= c.price);
    } else {
      setPxText(this.status, `bloqueado: ${c.unlock.text}`);
      this.status.setTint(COL.R);
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
    setPxText(this.regionText, REGIONS[r].name.toUpperCase());
    setPxText(this.regionSub, r === 0 ? `cerco ${ROMAN[r]}: do começo` : `cerco ${ROMAN[r]}: +${r * CHECKPOINT_SKELETONS} esqueletos`);
    this.regionBoss.setTexture(bossIcon(this, r)).setScale(0.5);
  }

  /** "A Descida": escolhe em que cerco a run começa e mostra as relíquias de cada um. */
  private openDescent() {
    if (this.descent.length) return;
    audio.play('click');
    buzz('light');
    const D = DEPTH.modal;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.descent.push(o);
      return o;
    };
    add(this.add.rectangle(0, 0, 180, 320, 0x0b0806, 0.86).setOrigin(0).setDepth(D).setInteractive()).on('pointerdown', () => this.closeDescent());
    add(this.add.image(CX, 160, 'panel').setDisplaySize(174, 262).setDepth(D).setInteractive());
    add(pxText(this, CX, 38, 'A DESCIDA', COL.U).setOrigin(0.5, 0).setScale(2).setDepth(D + 1));
    add(pxText(this, CX, 54, 'escolha onde os cercos começam', COL.v).setOrigin(0.5, 0).setDepth(D + 1));
    const max = maxStartRegion(meta);
    const frames: Phaser.GameObjects.Graphics[] = [];
    REGIONS.forEach((reg, i) => {
      const x = i % 2 === 0 ? 10 : 92;
      const y = 66 + Math.floor(i / 2) * 92;
      const w = 78;
      const h = 86;
      const locked = i > max;
      const st = GROUND_STYLES[i];
      const g = add(this.add.graphics().setDepth(D + 1));
      g.fillStyle(0x0b0806).fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 4);
      g.fillStyle(parseInt(st.b.slice(1), 16)).fillRoundedRect(x, y, w, h, 3);
      g.fillStyle(parseInt(st.c.slice(1), 16), 0.6).fillRect(x + 3, y + 3, w - 6, 40);
      const frame = add(this.add.graphics().setDepth(D + 3));
      frames.push(frame);
      // chefe do cerco
      const boss = add(this.add.image(x + w / 2, y + 40, bossIcon(this, i)).setOrigin(0.5, 1).setDepth(D + 2));
      if (locked) boss.setTintFill(0x0b0806).setAlpha(0.7);
      add(pxText(this, x + w / 2, y + 46, reg.name.toUpperCase(), locked ? COL.B : COL.u).setOrigin(0.5, 0).setDepth(D + 2));
      add(pxText(this, x + w / 2, y + 54, `cerco ${ROMAN[i]}`, locked ? COL.B : COL.v).setOrigin(0.5, 0).setDepth(D + 2));
      // relíquias que só caem aqui: achadas aparecem, as outras são uma silhueta
      relicsOf(i).forEach((it, k) => {
        const rx = x + w / 2 - 10 + k * 20;
        const ry = y + 73;
        add(this.add.image(rx, ry, 'slot-legendary').setDisplaySize(16, 16).setDepth(D + 2));
        const have = it.id in meta.items;
        const icon = add(this.add.image(rx, ry, `item-${it.id}`).setDepth(D + 2));
        if (!have) icon.setTintFill(0x1a120c);
      });
      if (locked) {
        add(this.add.rectangle(x, y, w, h, 0x0b0806, 0.45).setOrigin(0).setDepth(D + 2));
        add(this.add.image(x + w - 8, y + 8, 'icon-lock').setDepth(D + 3));
      }
      add(this.add.zone(x + w / 2, y + h / 2, w, h).setDepth(D + 4).setInteractive({ useHandCursor: !locked })).on('pointerdown', () => {
        if (locked) {
          audio.play('deny');
          this.toast('vença o chefe do cerco anterior');
          return;
        }
        audio.play('click');
        buzz('light');
        meta.startRegion = i;
        saveMeta();
        this.refreshRegion();
        draw();
      });
    });
    const draw = () =>
      frames.forEach((f, i) => {
        const x = i % 2 === 0 ? 10 : 92;
        const y = 66 + Math.floor(i / 2) * 92;
        f.clear();
        if (i === meta.startRegion) f.lineStyle(2, 0xf0c050, 1).strokeRoundedRect(x, y, 78, 86, 3);
      });
    draw();
    add(pxText(this, CX, 252, 'as relíquias só caem no cerco delas', COL.v).setOrigin(0.5, 0).setDepth(D + 1));
    const close = button(this, CX, 274, 'FECHAR', () => this.closeDescent(), { tex: 'btn-red', down: 'btn-red-down', color: COL.u, depth: D + 2 });
    add(close.img);
    add(close.label);
  }

  private closeDescent() {
    for (const o of this.descent) o.destroy();
    this.descent = [];
  }

  private heresyStep(dir: number) {
    const next = Math.max(0, Math.min(meta.heresyMax, meta.heresy + dir));
    if (next === meta.heresy) return audio.play('deny');
    meta.heresy = next;
    saveMeta();
    audio.play(dir > 0 ? 'hurt' : 'click');
    buzz(dir > 0 ? 'medium' : 'light');
    if (dir > 0) this.shaker.add(0.15 + meta.heresy * 0.03);
    this.refreshHeresy();
  }

  private refreshHeresy() {
    if (!this.heresyText || !this.heresyDesc) return;
    const h = meta.heresy;
    setPxText(this.heresyText, h === 0 ? 'heresia: nenhuma' : `heresia ${heresyName(h)}`);
    this.heresyText.setTint(h === 0 ? COL.v : COL.R);
    setPxText(this.heresyDesc, h === 0 ? `liberada até o nível ${meta.heresyMax}` : `${HERESY[h - 1].desc}. almas +${h * 10}%`);
  }

  update(time: number, delta: number) {
    this.shaker.update(delta / 1000);
    this.dark.draw([...this.scenery.lights, { x: CX, y: BASE_Y - 26, key: 'light80', scale: 1.5 }], time);
  }
}
