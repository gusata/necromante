import type Phaser from 'phaser';

/**
 * Pipeline Aseprite → jogo.
 *
 * Exporte do Aseprite com "File > Export Sprite Sheet" (Output: JSON Data, Array ou Hash,
 * com "Tags" marcado) para `public/assets/sprites/<arquivo>.png` + `.json` e registre no
 * `public/assets/sprites/manifest.json`. A arte exportada substitui a gerada no código,
 * usando as mesmas chaves de textura, então nada mais precisa mudar.
 * A arte é desenhada no tamanho do mundo, uma grade só (ART_RES): veja docs/ARTE.md.
 *
 * Duas formas de registrar:
 *   { "key": "peasant", "file": "peasant" }
 *       unidade animada: tag "walk" (2 quadros) vira peasant0/peasant1, tag "attack" vira peasant2.
 *       Sem tags: quadros 0, 1 e 2 na ordem.
 *   { "file": "necro", "frames": { "necro0": 0, "necro1": 1, "necro-cast": 2 } }
 *       mapeamento explícito de quadro → chave de textura (cenário, ícones, necromante...).
 *   { "file": "icones-anim", "anims": { "icon-soul": { "frames": [0, 1, 2, 3], "ms": [140, 140, 140, 140] } } }
 *       ícone animado: a textura "icon-soul" troca de quadro sozinha, então toda imagem
 *       que usa essa chave anima sem mudar nada na tela (veja tickIconAnims).
 */

export interface SpriteEntry {
  file: string;
  key?: string;
  frames?: Record<string, number>;
  /** ícones animados: chave de textura → quadros da folha e duração de cada um em ms */
  anims?: Record<string, { frames: number[]; ms: number[]; loop?: boolean }>;
  /** pixels da arte por pixel do mundo (padrão ART_RES = 1; ícones de item, 2) */
  res?: number;
}

/** parte interna do quadro do Phaser que define o tamanho dele */
interface FrameData {
  cut: { w: number; h: number };
  sourceSize: { w: number; h: number };
  spriteSourceSize: { w: number; h: number };
  radius: number;
  drawImage: { width: number; height: number };
}

/** zoom da câmera: o mundo tem 180x320 e a tela 360x640 */
export const ZOOM = 2;
/**
 * Pixels da arte por pixel do mundo. A direção de arte (docs/ARTE.md) pede uma grade só:
 * 1 pixel da arte = 1 pixel do mundo (um esqueleto de 16x22 é desenhado com 16x22).
 * Os ícones de item são a exceção técnica: aparecem com escala 2 na interface, então são
 * desenhados com 18x18 e lidos com res 2, para que cada pixel deles continue igual a 1 do mundo.
 */
export const ART_RES = 1;

/**
 * Faz a textura ocupar 1/res do tamanho no mundo sem perder pixels: o quadro passa a medir
 * w/res x h/res (posição, origem, toque e colisão), mas as coordenadas de textura (UV)
 * continuam cobrindo a imagem inteira. Só vale no WebGL (o jogo força WebGL).
 */
export function setArtRes(tex: Phaser.Textures.Texture, res: number) {
  if (res === 1) return;
  const f = tex.get() as Phaser.Textures.Frame & { data: FrameData };
  const w = Math.round(f.cutWidth / res);
  const h = Math.round(f.cutHeight / res);
  f.cutWidth = w;
  f.cutHeight = h;
  f.width = w;
  f.height = h;
  f.halfWidth = w / 2;
  f.halfHeight = h / 2;
  f.centerX = Math.floor(w / 2);
  f.centerY = Math.floor(h / 2);
  f.data.cut.w = w;
  f.data.cut.h = h;
  f.data.sourceSize.w = w;
  f.data.sourceSize.h = h;
  f.data.spriteSourceSize.w = w;
  f.data.spriteSourceSize.h = h;
  f.data.radius = 0.5 * Math.sqrt(w * w + h * h);
  f.data.drawImage.width = w;
  f.data.drawImage.height = h;
  (tex as unknown as { customData: Record<string, unknown> }).customData.res = res;
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
    if (e.anims) {
      for (const [target, a] of Object.entries(e.anims)) if (addIconAnim(scene, key, names, target, a, e.res)) replaced.push(target);
      continue;
    }
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
      // ícones de item aparecem com escala 2 na interface: arte de 36x36 bate 1 para 1 com a tela
      setArtRes(tex, e.res ?? (target.startsWith('item-') ? ART_RES * 2 : ART_RES));
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

// ------------------------------------------------------------ ícones animados

interface IconAnim {
  tex: Phaser.Textures.CanvasTexture;
  frames: Phaser.Textures.Frame[];
  ms: number[];
  loop: boolean;
  total: number;
  shown: number;
}
const iconAnims: IconAnim[] = [];
let iconClock = 0;

function addIconAnim(scene: Phaser.Scene, sheet: string, names: string[], target: string, a: { frames: number[]; ms: number[]; loop?: boolean }, res?: number) {
  const frames = a.frames.map((i) => scene.textures.getFrame(sheet, names[i])).filter((f): f is Phaser.Textures.Frame => !!f);
  if (!frames.length) {
    console.warn(`[aseprite] animação sem quadros: ${target}`);
    return false;
  }
  const { cutWidth: w, cutHeight: h } = frames[0];
  if (scene.textures.exists(target)) scene.textures.remove(target);
  const tex = scene.textures.createCanvas(target, w, h)!;
  // itens animados (relíquias, conjuntos) seguem a regra dos parados: res 2
  setArtRes(tex, res ?? (target.startsWith('item-') ? ART_RES * 2 : ART_RES));
  const ms = frames.map((_, i) => Math.max(16, a.ms[i] ?? 100));
  const anim: IconAnim = { tex, frames, ms, loop: a.loop !== false, total: ms.reduce((x, y) => x + y, 0), shown: -1 };
  drawIconFrame(anim, 0);
  iconAnims.push(anim);
  if (iconAnims.length === 1) scene.game.events.on('step', (_t: number, dt: number) => tickIconAnims(dt));
  return true;
}

function drawIconFrame(a: IconAnim, i: number) {
  if (a.shown === i) return;
  a.shown = i;
  const f = a.frames[i];
  const ctx = a.tex.getContext();
  ctx.clearRect(0, 0, a.tex.width, a.tex.height);
  ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
  a.tex.refresh();
}

/** Avança todos os ícones animados num relógio só (todas as telas veem o mesmo quadro). */
function tickIconAnims(dt: number) {
  iconClock += dt;
  for (const a of iconAnims) {
    let t = a.loop ? iconClock % a.total : Math.min(iconClock, a.total - 1);
    let i = 0;
    while (i < a.ms.length - 1 && t >= a.ms[i]) t -= a.ms[i++];
    drawIconFrame(a, i);
  }
}
