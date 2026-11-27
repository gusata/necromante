import Phaser from 'phaser';
import { FIELD } from '../sim/defs';
import { DEPTH } from '../fx/juice';
import { GROUND_TOP } from '../art/generate';

export { DEPTH };

export interface Light {
  x: number;
  y: number;
  key: 'light24' | 'light48' | 'light80';
  scale?: number;
  alpha?: number;
}

type Prop = [key: string, x: number, y: number, light?: 'fire' | 'holy' | 'glass-red' | 'glass-blue' | 'glass-gold'];

/** Disposição do cenário de cada região. Nada no meio da trilha (x 60..120). */
const LAYOUTS: Prop[][] = [
  // A Vila: cemitério na beira da vila
  [
    ['tree', 18, 70], ['tree', 166, 150],
    ['tomb', 16, 118], ['tomb2', 164, 44], ['cross', 30, 182], ['tomb', 150, 210], ['tomb2', 14, 246], ['cross', 168, 252], ['tomb', 44, 30], ['cross', 136, 96],
    ['fence', 150, 120], ['fence', 6, 214],
    ['candle', 24, 120, 'fire'], ['candle', 156, 46, 'fire'], ['candle', 38, 184, 'fire'], ['candle', 142, 212, 'fire'], ['candle', 22, 248, 'fire'], ['candle', 134, 258, 'fire'],
    ['bones', 40, 140], ['bones', 140, 176],
  ],
  // O Mosteiro: claustro com pilares e braseiros
  [
    ['pillar', 14, 70], ['pillar', 166, 70], ['pillar', 14, 160], ['pillar', 166, 160], ['pillar', 14, 250], ['pillar', 166, 250],
    ['brazier', 36, 112, 'fire'], ['brazier', 144, 112, 'fire'], ['brazier', 36, 204, 'fire'], ['brazier', 144, 204, 'fire'],
    ['candle', 30, 40, 'fire'], ['candle', 150, 40, 'fire'],
    ['tomb2', 40, 150], ['tomb2', 140, 150], ['bones', 150, 236],
  ],
  // A Fortaleza: pátio de armas
  [
    ['wall', 10, 40], ['wall', 170, 40], ['wall', 10, 150], ['wall', 170, 150], ['wall', 10, 236], ['wall', 170, 236],
    ['banner', 26, 70], ['banner', 154, 70], ['banner', 26, 180], ['banner', 154, 180],
    ['brazier', 40, 112, 'fire'], ['brazier', 140, 112, 'fire'], ['brazier', 40, 250, 'fire'], ['brazier', 140, 250, 'fire'],
    ['barrel', 18, 100], ['barrel', 162, 206], ['barrel', 26, 208],
  ],
  // A Catedral: bancos, candelabros e vitrais
  [
    ['pew', 26, 60], ['pew', 154, 60], ['pew', 26, 100], ['pew', 154, 100], ['pew', 26, 140], ['pew', 154, 140], ['pew', 26, 180], ['pew', 154, 180],
    ['candelabra', 56, 40, 'holy'], ['candelabra', 124, 40, 'holy'], ['candelabra', 56, 220, 'holy'], ['candelabra', 124, 220, 'holy'],
    ['pillar', 8, 230], ['pillar', 172, 230],
    ['px', 30, 80, 'glass-red'], ['px', 150, 120, 'glass-blue'], ['px', 30, 160, 'glass-gold'], ['px', 150, 200, 'glass-red'], ['px', 90, 20, 'glass-blue'],
  ],
];

const ANIMATED = new Set(['candle', 'brazier', 'banner', 'candelabra']);
const LIGHT_COLOR = { fire: 0xd0662a, holy: 0xf6cf6a, 'glass-red': 0xc0304a, 'glass-blue': 0x4a7ad8, 'glass-gold': 0xe0b040 } as const;

export class Scenery {
  lights: Light[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private ground: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {
    this.ground = scene.add.image(0, -GROUND_TOP, 'ground0').setOrigin(0).setDepth(DEPTH.ground);
  }

  /** Monta a região (0..3); `abyss` > 0 deixa tudo avermelhado. `dy` desce o cenário todo (menu em tela comprida). */
  build(region: number, abyss = 0, dy = 0) {
    this.ground.y = dy - GROUND_TOP;
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.lights = [];
    const r = region % LAYOUTS.length;
    this.ground.setTexture(`ground${r}`);
    if (abyss > 0) this.ground.setTint(0xd08080);
    else this.ground.clearTint();

    LAYOUTS[r].forEach(([key, x, y0, light], i) => {
      const y = y0 + dy;
      if (key !== 'px') {
        const animated = ANIMATED.has(key);
        const o = animated ? this.scene.add.sprite(x, y, `${key}0`) : this.scene.add.image(x, y, key);
        o.setOrigin(0.5, 1).setDepth(DEPTH.world + y);
        if (abyss > 0) o.setTint(0xe0a0a0);
        if (o instanceof Phaser.GameObjects.Sprite) o.play({ key: `${key}-anim`, startFrame: i % 2 });
        this.objects.push(o);
      }
      if (!light) return;
      const glass = light.startsWith('glass');
      const ly = glass ? y : y - (key === 'brazier' ? 7 : key === 'candelabra' ? 9 : 6);
      const glow = this.scene.add
        .image(x, ly, glass ? 'glow64' : 'glow16')
        .setTint(LIGHT_COLOR[light])
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(glass ? DEPTH.decal + 1 : DEPTH.glow)
        .setAlpha(glass ? 0.35 : 0.75);
      if (glass) glow.setScale(1.2, 0.8);
      this.objects.push(glow);
      this.scene.tweens.add({ targets: glow, alpha: glow.alpha * 0.6, duration: 300 + (i % 5) * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.lights.push({ x, y: ly, key: glass ? 'light48' : key === 'brazier' ? 'light48' : 'light24', alpha: glass ? 0.7 : 1, scale: key === 'brazier' ? 0.9 : 1 });
    });
  }
}

/**
 * Camada de escuridão: textura escura por cima do mundo, com buracos onde há luz.
 * Redesenhada a cada quadro.
 */
export class Darkness {
  private rt: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  color = 0x0b0806;

  constructor(
    scene: Phaser.Scene,
    public amount = 0.62,
    height: number = FIELD.h,
    /** y do topo da camada (acima de 0 em tela comprida) */
    private top = 0,
  ) {
    this.rt = scene.add.renderTexture(0, top, FIELD.w, height).setOrigin(0).setDepth(DEPTH.dark);
    this.stamp = scene.make.image({ x: 0, y: 0, key: 'light48' }, false);
  }

  draw(lights: Light[], time: number): void {
    this.rt.clear();
    this.rt.fill(this.color, this.amount);
    for (const l of lights) {
      const flick = 1 + Math.sin(time * 0.011 + l.x) * 0.04;
      this.stamp
        .setTexture(l.key)
        .setPosition(Math.round(l.x), Math.round(l.y - this.top))
        .setScale((l.scale ?? 1) * flick)
        .setAlpha(l.alpha ?? 1);
      this.rt.erase(this.stamp);
    }
  }
}
