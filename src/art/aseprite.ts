import type Phaser from 'phaser';

/**
 * Pipeline Aseprite → jogo.
 *
 * Exporte do Aseprite com "File > Export Sprite Sheet" (Output: JSON Data, Array ou Hash,
 * com "Tags" marcado) para `public/assets/sprites/<arquivo>.png` + `.json` e registre no
 * `public/assets/sprites/manifest.json`. A arte exportada substitui a gerada no código,
 * usando as mesmas chaves de textura, então nada mais precisa mudar.
 *
 * Duas formas de registrar:
 *   { "key": "peasant", "file": "peasant" }
 *       unidade animada: tag "walk" (2 quadros) vira peasant0/peasant1, tag "attack" vira peasant2.
 *       Sem tags: quadros 0, 1 e 2 na ordem.
 *   { "file": "necro", "frames": { "necro0": 0, "necro1": 1, "necro-cast": 2 } }
 *       mapeamento explícito de quadro → chave de textura (cenário, ícones, necromante...).
 */

export interface SpriteEntry {
  file: string;
  key?: string;
  frames?: Record<string, number>;
}

interface AseJson {
  frames: Record<string, unknown> | { filename: string }[];
  meta?: { frameTags?: { name: string; from: number; to: number }[] };
}

export const SPRITE_DIR = 'assets/sprites/';
export const MANIFEST_KEY = 'sprite-manifest';
const aseKey = (file: string) => `ase:${file}`;

/** Enfileira o manifesto (opcional: se não existir, nada acontece). */
export function queueManifest(scene: Phaser.Scene) {
  scene.load.json(MANIFEST_KEY, `${SPRITE_DIR}manifest.json`);
}

/** Lê o manifesto e enfileira cada spritesheet. Devolve as entradas válidas. */
export function queueSheets(scene: Phaser.Scene): SpriteEntry[] {
  const manifest = scene.cache.json.get(MANIFEST_KEY) as { sprites?: SpriteEntry[] } | undefined;
  const entries = (manifest?.sprites ?? []).filter((e) => e && typeof e.file === 'string');
  for (const e of entries) scene.load.aseprite(aseKey(e.file), `${SPRITE_DIR}${e.file}.png`, `${SPRITE_DIR}${e.file}.json`);
  return entries;
}

/** Ordem dos quadros e tags de um JSON do Aseprite (formato Array ou Hash). */
export function parseAse(json: AseJson): { names: string[]; tags: Record<string, number[]> } {
  const names = Array.isArray(json.frames) ? json.frames.map((f) => f.filename) : Object.keys(json.frames);
  const tags: Record<string, number[]> = {};
  for (const t of json.meta?.frameTags ?? []) {
    tags[t.name.toLowerCase()] = Array.from({ length: t.to - t.from + 1 }, (_, i) => t.from + i);
  }
  return { names, tags };
}

/** Qual quadro vai para qual chave de textura. */
export function frameMapping(entry: SpriteEntry, tags: Record<string, number[]>): Record<string, number> {
  if (entry.frames) return entry.frames;
  if (!entry.key) return {};
  const walk = tags.walk ?? [0, 1];
  const attack = tags.attack ?? [walk.length > 2 ? walk[2] : 2];
  return { [`${entry.key}0`]: walk[0], [`${entry.key}1`]: walk[1] ?? walk[0], [`${entry.key}2`]: attack[0] ?? walk[0] };
}

/** Copia os quadros carregados para as texturas do jogo, substituindo as geradas. Devolve as chaves trocadas. */
export function applySheets(scene: Phaser.Scene, entries: SpriteEntry[]): string[] {
  const replaced: string[] = [];
  for (const e of entries) {
    const key = aseKey(e.file);
    const json = scene.cache.json.get(key) as AseJson | undefined;
    if (!json || !scene.textures.exists(key)) {
      console.warn(`[aseprite] não carregou: ${e.file}`);
      continue;
    }
    const { names, tags } = parseAse(json);
    for (const [target, index] of Object.entries(frameMapping(e, tags))) {
      const frame = scene.textures.getFrame(key, names[index]);
      if (!frame) {
        console.warn(`[aseprite] ${e.file}: quadro ${index} não existe`);
        continue;
      }
      if (scene.textures.exists(target)) scene.textures.remove(target);
      const tex = scene.textures.createCanvas(target, frame.cutWidth, frame.cutHeight)!;
      const src = frame.source.image as CanvasImageSource;
      tex.getContext().drawImage(src, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
      tex.refresh();
      replaced.push(target);
    }
  }
  rebuildAnims(scene, new Set(replaced));
  return replaced;
}

/** Animações guardam referência ao quadro antigo: recria as que usam texturas trocadas. */
function rebuildAnims(scene: Phaser.Scene, keys: Set<string>) {
  if (!keys.size) return;
  const all = (scene.anims as unknown as { anims: { entries: Record<string, Phaser.Animations.Animation> } }).anims.entries;
  for (const [name, anim] of Object.entries(all)) {
    const frames = anim.frames.map((f) => f.textureKey);
    if (!frames.some((k) => keys.has(k))) continue;
    const { frameRate, repeat } = anim;
    scene.anims.remove(name);
    scene.anims.create({ key: name, frames: frames.map((k) => ({ key: k })), frameRate, repeat });
  }
}
