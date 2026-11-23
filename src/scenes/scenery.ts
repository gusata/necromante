import Phaser from 'phaser';
import { FIELD } from '../sim/defs';

export const DEPTH = {
  ground: 0,
  decal: 1,
  altar: 2,
  world: 10, // + y
  dark: 1000,
  glow: 1010,
  fx: 1020,
  overlay: 1030,
  hud: 2000,
  modal: 3000,
} as const;

const TOMBS: [number, number][] = [
  [16, 58], [164, 44], [26, 132], [152, 150], [12, 226], [168, 214], [58, 26], [128, 100], [40, 190], [142, 252],
];
const CANDLES: [number, number][] = [
  [24, 60], [156, 46], [34, 136], [144, 154], [20, 228], [160, 218], [134, 254],
];

export interface Light {
  x: number;
  y: number;
  key: 'light24' | 'light48' | 'light80';
  scale?: number;
  alpha?: number;
}

/** Chão, lápides e velas. Devolve as luzes fixas das velas. */
export function buildScenery(scene: Phaser.Scene): Light[] {
  scene.add.image(0, 0, 'ground').setOrigin(0).setDepth(DEPTH.ground);
  for (const [x, y] of TOMBS) scene.add.image(x, y, 'tomb').setOrigin(0.5, 1).setDepth(DEPTH.world + y);
  const lights: Light[] = [];
  CANDLES.forEach(([x, y], i) => {
    const c = scene.add.sprite(x, y, 'candle0').setOrigin(0.5, 1).setDepth(DEPTH.world + y);
    c.play({ key: 'candle-burn', startFrame: i % 2 });
    scene.add.image(x, y - 6, 'glow16').setTint(0xd0662a).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow).setAlpha(0.7);
    lights.push({ x, y: y - 5, key: 'light24' });
  });
  return lights;
}

/**
 * Camada de escuridão: uma textura preta por cima do mundo, com buracos onde há luz.
 * Redesenhada a cada quadro.
 */
export class Darkness {
  private rt: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private amount = 0.62,
    height: number = FIELD.h,
  ) {
    this.rt = scene.add.renderTexture(0, 0, FIELD.w, height).setOrigin(0).setDepth(DEPTH.dark);
    this.stamp = scene.make.image({ x: 0, y: 0, key: 'light48' }, false);
  }

  draw(lights: Light[], time: number): void {
    this.rt.clear();
    this.rt.fill(0x050309, this.amount);
    for (const l of lights) {
      // tremulação leve
      const flick = 1 + Math.sin(time * 0.011 + l.x) * 0.04;
      this.stamp.setTexture(l.key).setPosition(Math.round(l.x), Math.round(l.y)).setScale((l.scale ?? 1) * flick).setAlpha(l.alpha ?? 1);
      this.rt.erase(this.stamp);
    }
  }
}
