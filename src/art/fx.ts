import type Phaser from 'phaser';

/**
 * Efeitos desenhados à mão (explosão, levantar, fusão, nuvem, coluna de luz, grito, raio, rituais).
 *
 * Cada efeito é uma tira horizontal em `public/assets/fx/<chave>.png`, descrita em
 * `public/assets/fx/fx.json` ({ chave: { frameWidth, frameHeight, frames, durationsMs, loop } }).
 * Instale um pacote com `python art-work/icons/install_fx.py <pacote.zip>`.
 * Cada chave vira uma spritesheet e uma animação com o mesmo nome. Sem o arquivo, a partida
 * continua com os efeitos desenhados no código (veja `hasFx`).
 */

export interface FxDef {
  frameWidth: number;
  frameHeight: number;
  frames: number;
  durationsMs: number[];
  loop?: boolean;
}

const FX_DIR = 'assets/fx/';
const FX_MANIFEST = 'fx-manifest';

/** Enfileira o fx.json (opcional). */
export function queueFxManifest(scene: Phaser.Scene) {
  scene.load.json(FX_MANIFEST, `${FX_DIR}fx.json`);
}

const fxDefs = (scene: Phaser.Scene) => (scene.cache.json.get(FX_MANIFEST) ?? {}) as Record<string, FxDef>;

/** Enfileira as tiras listadas no fx.json. Devolve quantas. */
export function queueFx(scene: Phaser.Scene): number {
  const defs = fxDefs(scene);
  for (const [key, d] of Object.entries(defs)) {
    scene.load.spritesheet(key, `${FX_DIR}${key}.png`, { frameWidth: d.frameWidth, frameHeight: d.frameHeight });
  }
  return Object.keys(defs).length;
}

/** Cria uma animação por efeito, com a duração de cada quadro. Devolve as chaves criadas. */
export function createFxAnims(scene: Phaser.Scene): string[] {
  const made: string[] = [];
  for (const [key, d] of Object.entries(fxDefs(scene))) {
    if (!scene.textures.exists(key) || scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      // frameRate alto: cada quadro dura ~1 ms + a duração própria dele
      frameRate: 1000,
      frames: Array.from({ length: d.frames }, (_, i) => ({ key, frame: i, duration: Math.max(0, (d.durationsMs[i] ?? 100) - 1) })),
      repeat: d.loop ? -1 : 0,
    });
    made.push(key);
  }
  return made;
}

export const hasFx = (scene: Phaser.Scene, key: string) => scene.anims.exists(key);

/** Escala inteira que faz um efeito de `size` px cobrir `diameter` px (pixel art não aceita escala quebrada). */
export const fxScale = (diameter: number, size: number) => Math.max(1, Math.round(diameter / size));

/** Ritual de cada personagem → efeito. */
export const RITUAL_FX: Record<string, string> = {
  necro: 'fx-ritual-necromante',
  witch: 'fx-ritual-bruxa',
  digger: 'fx-ritual-coveiro',
  reaper: 'fx-ritual-ceifador',
  vampire: 'fx-ritual-vampiro',
};
