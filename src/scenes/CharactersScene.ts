import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { charKey } from '../art/generate';
import { COL } from '../art/palette';
import { CHAR_GLOW } from '../art/sprites';
import { pxText, setPxText } from '../art/text';
import { button, DEPTH, flash, Shaker, transitionIn, transitionTo, type UIButton } from '../fx/juice';
import { buzz } from '../platform/haptics';
import { meta, saveMeta } from '../platform/save';
import { CHARACTERS } from '../sim/characters';
import { HERESY, heresyName } from '../sim/heresy';
import { buyCharacter, characterState } from '../sim/meta';
import { Darkness, Scenery } from './scenery';

/** Escolha do necromante antes da run. */
export class CharactersScene extends Phaser.Scene {
  private index = 0;
  private sprite!: Phaser.GameObjects.Sprite;
  private glow!: Phaser.GameObjects.Image;
  private name!: Phaser.GameObjects.BitmapText;
  private title!: Phaser.GameObjects.BitmapText;
  private traits!: Phaser.GameObjects.BitmapText;
  private status!: Phaser.GameObjects.BitmapText;
  private soulsText!: Phaser.GameObjects.BitmapText;
  private action!: UIButton;
  private dots: Phaser.GameObjects.Rectangle[] = [];
  private heresyText?: Phaser.GameObjects.BitmapText;
  private heresyDesc?: Phaser.GameObjects.BitmapText;
  private dark!: Darkness;
  private scenery!: Scenery;
  private shaker!: Shaker;

  constructor() {
    super('Characters');
  }

  create() {
    this.shaker = new Shaker(this.cameras.main);
    this.scenery = new Scenery(this);
    this.scenery.build(1);
    this.dark = new Darkness(this, 0.62, 320);
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === meta.character));

    pxText(this, 90, 10, 'ESCOLHA O NECROMANTE', COL.G).setOrigin(0.5).setDepth(DEPTH.hud);
    this.add.image(64, 24, 'icon-soul').setDepth(DEPTH.hud);
    this.soulsText = pxText(this, 70, 22, `${meta.souls}`, COL.G).setDepth(DEPTH.hud);

    this.add.image(90, 130, 'altar').setScale(2).setDepth(DEPTH.altar);
    this.glow = this.add.image(90, 90, 'glow64').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow).setAlpha(0.5);
    this.tweens.add({ targets: this.glow, alpha: 0.25, scale: 1.15, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.sprite = this.add.sprite(90, 130, 'necro0').setOrigin(0.5, 1).setScale(3).setDepth(DEPTH.world + 130);

    this.add.rectangle(90, 196, 176, 104, 0x050309, 0.7).setDepth(DEPTH.hud - 1);
    this.name = pxText(this, 90, 142, '', COL.w).setOrigin(0.5, 0).setScale(2).setDepth(DEPTH.hud);
    this.title = pxText(this, 90, 158, '', COL.C).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.traits = pxText(this, 90, 174, '', COL.c).setOrigin(0.5, 0).setCenterAlign().setDepth(DEPTH.hud);
    this.status = pxText(this, 90, 232, '', COL.y).setOrigin(0.5, 0).setDepth(DEPTH.hud);

    CHARACTERS.forEach((_, i) => {
      this.dots.push(this.add.rectangle(90 + (i - (CHARACTERS.length - 1) / 2) * 8, 244, 4, 4, COL.B).setDepth(DEPTH.hud));
    });

    // setas
    const arrow = (x: number, dir: number) => {
      const a = pxText(this, x, 90, dir < 0 ? '<' : '>', COL.G).setOrigin(0.5).setScale(3).setDepth(DEPTH.hud);
      const hit = this.add.zone(x, 90, 40, 80).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.move(dir));
      this.tweens.add({ targets: a, x: x + dir * 2, yoyo: true, repeat: -1, duration: 500 });
    };
    arrow(16, -1);
    arrow(164, 1);
    // deslizar o dedo também troca
    let startX = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (startX = p.x));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (Math.abs(p.x - startX) > 30 && p.y < 230) this.move(p.x < startX ? 1 : -1);
    });
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.act());
    this.input.keyboard?.once('keydown-ESC', () => transitionTo(this, 'Menu'));

    // heresia (dificuldade): liberada depois de vencer a Catedral
    if (meta.heresyMax > 0) {
      meta.heresy = Math.min(meta.heresy, meta.heresyMax);
      this.heresyText = pxText(this, 90, 251, '', COL.R).setOrigin(0.5, 0).setDepth(DEPTH.hud);
      this.heresyDesc = pxText(this, 90, 259, '', COL.C).setOrigin(0.5, 0).setDepth(DEPTH.hud);
      const side = (x: number, dir: number) => {
        pxText(this, x, 251, dir < 0 ? '<' : '>', COL.R)
          .setOrigin(0.5, 0)
          .setDepth(DEPTH.hud);
        this.add
          .zone(x, 256, 30, 18)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.heresyStep(dir));
      };
      side(12, -1);
      side(168, 1);
      this.input.keyboard?.on('keydown-UP', () => this.heresyStep(1));
      this.input.keyboard?.on('keydown-DOWN', () => this.heresyStep(-1));
      this.refreshHeresy();
    }

    this.action = button(this, 90, 279, 'JOGAR', () => this.act(), { color: COL.G });
    button(this, 90, 304, 'VOLTAR', () => transitionTo(this, 'Menu'));
    this.refresh(0);
    transitionIn(this);
  }

  private heresyStep(dir: number) {
    const next = Math.max(0, Math.min(meta.heresyMax, meta.heresy + dir));
    if (next === meta.heresy) {
      audio.play('deny');
      return;
    }
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
    this.heresyText.setTint(h === 0 ? COL.C : COL.R);
    setPxText(this.heresyDesc, h === 0 ? `ate o nivel ${meta.heresyMax}` : `${HERESY[h - 1].desc}. almas +${h * 10}%`);
  }

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
    if (state === 'locked') this.sprite.setTintFill(0x07050b);
    else this.sprite.clearTint();
    this.glow.setTint(CHAR_GLOW[c.id]);
    if (dir) {
      this.sprite.x = 90 + dir * 40;
      this.sprite.alpha = 0;
      this.tweens.add({ targets: this.sprite, x: 90, alpha: 1, duration: 250, ease: 'Cubic.easeOut' });
    }
    setPxText(this.name, state === 'locked' ? '???' : c.name.toUpperCase());
    setPxText(this.title, c.title);
    this.traits.setText(
      [...c.traits.map((t) => `- ${t}`), `ritual: ${c.ritual.name}`]
        .join('\n')
        .toUpperCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, ''),
    );
    this.traits.setAlpha(state === 'locked' ? 0.4 : 1);
    this.dots.forEach((d, i) => d.setFillStyle(i === this.index ? COL.G : COL.B));

    if (state === 'owned') {
      setPxText(this.status, meta.character === c.id ? 'selecionado' : '');
      this.action.label.setText('JOGAR');
      this.action.setEnabled(true);
    } else if (state === 'buyable') {
      setPxText(this.status, `liberado! custa ${c.price} almas`);
      this.action.label.setText(`COMPRAR ${c.price}`);
      this.action.setEnabled(meta.souls >= c.price);
    } else {
      setPxText(this.status, `bloqueado: ${c.unlock.text}`);
      this.action.label.setText('BLOQUEADO');
      this.action.setEnabled(false);
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
      flash(this, CHAR_GLOW[c.id], 0.4, 300);
      setPxText(this.soulsText, `${meta.souls}`);
      this.tweens.add({ targets: this.sprite, scaleX: 3.6, scaleY: 2.6, duration: 90, yoyo: true });
      this.refresh(0);
    }
  }

  update(time: number, delta: number) {
    this.shaker.update(delta / 1000);
    this.dark.draw([...this.scenery.lights, { x: 90, y: 100, key: 'light80', scale: 1.4 }], time);
  }
}
