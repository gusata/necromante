import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { unitKey } from '../art/generate';
import { COL } from '../art/palette';
import { pxText } from '../art/text';
import { button, DEPTH, transitionIn, transitionTo } from '../fx/juice';
import { meta } from '../platform/save';
import { buildingLevel } from '../sim/meta';
import { Darkness, Scenery } from './scenery';

export class MenuScene extends Phaser.Scene {
  private dark!: Darkness;
  private scenery!: Scenery;
  private extraLights: { x: number; y: number; key: 'light80'; scale: number }[] = [];

  constructor() {
    super('Menu');
  }

  create() {
    audio.setRegion(Math.min(3, meta.bossesBeaten));
    audio.setIntensity(0);
    this.scenery = new Scenery(this);
    this.scenery.build(Math.min(3, meta.bossesBeaten));
    this.dark = new Darkness(this, 0.74, 320);

    const cx = 90;
    const baseY = 150;
    this.add.image(cx, baseY, 'altar').setScale(2).setDepth(DEPTH.altar);
    const necro = this.add.image(cx, baseY, 'necro0').setOrigin(0.5, 1).setScale(3).setDepth(DEPTH.world + baseY);
    this.tweens.add({ targets: necro, y: baseY - 2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const orb = this.add.image(cx + 15, baseY - 54, 'glow32').setTint(COL.g).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow);
    this.tweens.add({ targets: orb, alpha: 0.5, scale: 1.25, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.extraLights = [{ x: cx, y: baseY - 26, key: 'light80', scale: 1.3 }];

    // campeão escolhido ao lado do necromante
    const champ = meta.selectedChampion;
    if (champ && meta.champions[champ] && buildingLevel(meta, 'hall') > 0) {
      const key = unitKey('champion', champ);
      const s = this.add.sprite(cx + 40, baseY, `${key}0`).setOrigin(0.5, 1).setDepth(DEPTH.world + baseY).setFlipX(true);
      s.play(`${key}-walk`);
      s.anims.timeScale = 0.3;
    }

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

    const title = pxText(this, cx, 26, 'NECROMANTE', COL.G).setOrigin(0.5).setScale(2).setDepth(DEPTH.hud);
    this.tweens.add({ targets: title, y: 24, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    pxText(this, cx, 42, 'os mortos lutam por você', COL.b).setOrigin(0.5).setDepth(DEPTH.hud);

    this.add.image(cx - 22, 164, 'icon-soul').setDepth(DEPTH.hud);
    pxText(this, cx - 16, 162, `${meta.souls} almas`, COL.G).setDepth(DEPTH.hud);
    if (meta.best.wave > 0) pxText(this, cx, 174, `recorde: onda ${meta.best.wave}`, COL.y).setOrigin(0.5).setDepth(DEPTH.hud);

    const items: [string, () => void, number][] = [
      ['JOGAR', () => transitionTo(this, 'Run'), COL.G],
      ['CEMITÉRIO', () => transitionTo(this, 'Graveyard'), COL.c],
      ['BESTIÁRIO', () => transitionTo(this, 'Bestiary'), COL.c],
      ['OPÇÕES', () => transitionTo(this, 'Options'), COL.c],
    ];
    items.forEach(([label, fn, color], i) => {
      const b = button(this, cx, 196 + i * 22, label, fn, { color });
      // entram em sequência
      b.img.setAlpha(0);
      b.label.setAlpha(0);
      this.tweens.add({ targets: [b.img, b.label], alpha: 1, x: `+=0`, delay: 200 + i * 80, duration: 250 });
      b.img.x -= 20;
      b.label.x -= 20;
      this.tweens.add({ targets: [b.img, b.label], x: '+=20', delay: 200 + i * 80, duration: 300, ease: 'Back.easeOut' });
    });

    if (meta.runs === 0) {
      const hint = pxText(this, cx, 290, 'toque em jogar para começar', COL.B).setOrigin(0.5).setDepth(DEPTH.hud);
      this.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });
    }
    this.input.keyboard?.once('keydown-ENTER', () => transitionTo(this, 'Run'));
    this.input.keyboard?.once('keydown-SPACE', () => transitionTo(this, 'Run'));
    transitionIn(this);
  }

  update(time: number) {
    this.dark.draw([...this.scenery.lights, ...this.extraLights], time);
  }
}
