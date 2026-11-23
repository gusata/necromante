import Phaser from 'phaser';
import { COL } from '../art/palette';
import { pxText } from '../art/text';
import { loadBest } from '../platform/storage';
import { buildScenery, Darkness, DEPTH, type Light } from './scenery';

export class MenuScene extends Phaser.Scene {
  private dark!: Darkness;
  private glowLights: Light[] = [];

  constructor() {
    super('Menu');
  }

  create() {
    this.glowLights = buildScenery(this);
    this.dark = new Darkness(this, 0.72, 320);

    const cx = 90;
    this.add.image(cx, 168, 'altar').setScale(2).setDepth(DEPTH.altar);
    this.add.image(cx, 168, 'necro').setOrigin(0.5, 1).setScale(3).setDepth(DEPTH.world + 168);
    const orb = this.add.image(cx + 15, 116, 'glow32').setTint(COL.g).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow);
    this.tweens.add({ targets: orb, alpha: 0.5, scale: 1.2, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.glowLights.push({ x: cx, y: 140, key: 'light80', scale: 1.3 });

    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: 180 },
      y: { min: 40, max: 320 },
      lifespan: { min: 2000, max: 4000 },
      speedY: { min: -8, max: -2 },
      speedX: { min: -2, max: 2 },
      alpha: { start: 0.8, end: 0 },
      tint: [COL.g, COL.G],
      frequency: 180,
    }).setDepth(DEPTH.glow);

    const t = (y: number, s: string, c: number, scale = 1) =>
      pxText(this, cx, y, s, c).setOrigin(0.5).setScale(scale).setDepth(DEPTH.hud);

    t(30, 'NECROMANTE', COL.G, 2);
    t(46, 'os mortos lutam por você', COL.b);

    const best = loadBest();
    if (best.wave > 0) t(188, `recorde: onda ${best.wave}  ${best.souls} almas`, COL.y);

    t(212, 'arraste para mover o círculo', COL.c);
    t(222, 'quem morre no círculo levanta', COL.c);
    t(236, 'explodir: mortos viram bombas', COL.C);
    t(246, 'fundir: 3 esqueletos = colosso', COL.C);
    t(256, 'consumir: sacrifica e cura', COL.C);
    t(268, 'teclado: 1 2 3 ou q w e', COL.B);

    const start = t(294, 'toque para começar', COL.G);
    this.tweens.add({ targets: start, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });

    this.input.once('pointerdown', () => this.scene.start('Run'));
    this.input.keyboard?.once('keydown', () => this.scene.start('Run'));
  }

  update(time: number) {
    this.dark.draw(this.glowLights, time);
  }
}
