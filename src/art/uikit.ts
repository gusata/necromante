import type Phaser from 'phaser';

/**
 * Kit de interface desenhado à mão (public/assets/ui, ver docs/ARTE.md seção 10).
 *
 * Cada peça é um 9-slice pequeno (o ui.json diz as bordas). As telas usam texturas de painel
 * e botão em tamanhos fixos (btn 56x16, card 24x24...), então em vez de trocar a chave 1 por 1
 * cada textura do jogo é redesenhada esticando o miolo da peça até o tamanho que ela já tinha.
 * Peças com quadros (pronto, aba selecionada, seta, vida baixa) continuam animando, inclusive
 * nas texturas derivadas. Sem o kit, fica a arte gerada no código.
 */

export const UI_DIR = 'assets/ui/';
const KIT_JSON = 'ui-kit';
const raw = (k: string) => `kit:${k}`;

interface Slice {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
interface KitEntry {
  width: number;
  height: number;
  frames: number;
  durationsMs: number[] | null;
  slice: Slice;
}
type Kit = Record<string, KitEntry>;

/** textura do jogo ← peça do kit */
const DERIVED: Record<string, string> = {
  // painéis, cartões e linhas
  panel: 'ui-panel',
  card: 'ui-panel',
  tile: 'ui-panel',
  'item-card': 'ui-panel',
  row: 'ui-row',
  'sel-row': 'ui-row-sel',
  // botões comuns e apertados
  btn: 'ui-btn',
  'btn-wide': 'ui-btn',
  'btn-modal': 'ui-btn',
  'btn-half': 'ui-btn',
  'btn-90': 'ui-btn',
  'small-btn': 'ui-btn',
  'arrow-btn': 'ui-btn',
  act: 'ui-btn',
  'gear-btn': 'ui-btn',
  'btn-down': 'ui-btn-down',
  'btn-wide-down': 'ui-btn-down',
  'btn-modal-down': 'ui-btn-down',
  'btn-half-down': 'ui-btn-down',
  'btn-90-down': 'ui-btn-down',
  'small-btn-down': 'ui-btn-down',
  'arrow-btn-down': 'ui-btn-down',
  'act-down': 'ui-btn-down',
  // botão principal
  'btn-gold': 'ui-btn-main',
  'btn-gold-l': 'ui-btn-main',
  'btn-gold-90': 'ui-btn-main',
  'btn-gold-down': 'ui-btn-main-down',
  'btn-gold-l-down': 'ui-btn-main-down',
  'btn-gold-90-down': 'ui-btn-main-down',
  // botão vermelho (fechar, equipar, ações perigosas)
  'btn-red': 'ui-btn-close',
  'btn-modal-red': 'ui-btn-close',
  'btn-red-down': 'ui-btn-close-down',
  'btn-modal-red-down': 'ui-btn-close-down',
  // pronto (pulsa)
  'btn-ready': 'ui-btn-ready',
  'act-ready': 'ui-btn-ready',
  // abas da barra de navegação
  subtab: 'ui-nav',
  nav: 'ui-nav',
  'subtab-on': 'ui-nav-sel',
  'nav-on': 'ui-nav-sel',
  // espaços de item por raridade
  'slot-common': 'ui-card-comum',
  'slot-magic': 'ui-card-magico',
  'slot-rare': 'ui-card-raro',
  'slot-epic': 'ui-card-epico',
  'slot-legendary': 'ui-card-lendario',
  'slot-set': 'ui-card-conjunto',
};

/** Reserva: sem a moldura épica do pacote de itens, sai do cartão raro com a cor trocada para o roxo. */
const EPIC_FROM = 'ui-card-raro';
const EPIC_KEY = 'ui-card-epico';
const EPIC_RECOLOR: [number, number][] = [
  [0xe0b840, 0xb468e0],
  [0x7a5a1a, 0x5a2a7a],
];

/** Lê o ui.json no preload (opcional: sem ele, nada acontece). */
export function queueUiKitJson(scene: Phaser.Scene) {
  scene.load.json(KIT_JSON, `${UI_DIR}ui.json`);
}

/** Enfileira as imagens do kit. Devolve se há algo para carregar. */
export function queueUiKit(scene: Phaser.Scene): boolean {
  const kit = scene.cache.json.get(KIT_JSON) as Kit | undefined;
  if (!kit) return false;
  for (const k of Object.keys(kit)) scene.load.image(raw(k), `${UI_DIR}${k}.png`);
  return true;
}

interface Anim {
  tex: Phaser.Textures.CanvasTexture;
  img: CanvasImageSource;
  e: KitEntry;
  ms: number[];
  total: number;
  shown: number;
}
const anims: Anim[] = [];
let clock = 0;
let ticking = false;

/** Desenha o quadro `f` da peça esticado para w x h (cantos fixos, bordas esticam num eixo, miolo nos dois). */
function drawSlice(ctx: CanvasRenderingContext2D, img: CanvasImageSource, e: KitEntry, f: number, w: number, h: number) {
  const s = e.slice;
  const fx = f * e.width;
  const sx = [0, s.left, e.width - s.right, e.width];
  const sy = [0, s.top, e.height - s.bottom, e.height];
  const dx = [0, s.left, w - s.right, w];
  const dy = [0, s.top, h - s.bottom, h];
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const sw = sx[i + 1] - sx[i];
      const sh = sy[j + 1] - sy[j];
      const dw = dx[i + 1] - dx[i];
      const dh = dy[j + 1] - dy[j];
      if (sw > 0 && sh > 0 && dw > 0 && dh > 0) ctx.drawImage(img, fx + sx[i], sy[j], sw, sh, dx[i], dy[j], dw, dh);
    }
}

function frameAt(a: Anim, t: number): number {
  let r = t % a.total;
  for (let i = 0; i < a.ms.length; i++) {
    if (r < a.ms[i]) return i;
    r -= a.ms[i];
  }
  return 0;
}

function tick(dt: number) {
  clock += dt;
  for (const a of anims) {
    const f = frameAt(a, clock);
    if (f === a.shown) continue;
    a.shown = f;
    drawSlice(a.tex.getContext(), a.img, a.e, f, a.tex.width, a.tex.height);
    a.tex.refresh();
  }
}

/** Cria (ou recria) a textura `key` com w x h a partir da peça; anima se ela tiver quadros. */
function makeTex(scene: Phaser.Scene, key: string, img: CanvasImageSource, e: KitEntry, w: number, h: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  drawSlice(tex.getContext(), img, e, 0, w, h);
  tex.refresh();
  if (e.frames > 1 && e.durationsMs?.length) {
    const ms = e.durationsMs.map((m) => Math.max(16, m));
    anims.push({ tex, img, e, ms, total: ms.reduce((a, b) => a + b, 0), shown: 0 });
    if (!ticking) {
      ticking = true;
      scene.game.events.on('step', (_t: number, dt: number) => tick(dt));
    }
  }
}

/** Cartão épico: copia o raro e troca as cores da moldura. */
function epicCard(src: HTMLImageElement | HTMLCanvasElement, e: KitEntry): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = e.width * e.frames;
  c.height = e.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const rgb = (d.data[i] << 16) | (d.data[i + 1] << 8) | d.data[i + 2];
    const to = EPIC_RECOLOR.find(([from]) => from === rgb)?.[1];
    if (to === undefined) continue;
    d.data[i] = to >> 16;
    d.data[i + 1] = (to >> 8) & 0xff;
    d.data[i + 2] = to & 0xff;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

/**
 * Aplica o kit depois da arte gerada e das folhas do Aseprite. Registra cada peça com a
 * própria chave ('ui-panel', 'ui-chevron'...) no tamanho original e redesenha as texturas
 * do jogo listadas em DERIVED, menos as de `keep` (já trocadas por arte própria).
 * Devolve as chaves trocadas.
 */
export function applyUiKit(scene: Phaser.Scene, keep: ReadonlySet<string> = new Set()): string[] {
  const kit = scene.cache.json.get(KIT_JSON) as Kit | undefined;
  if (!kit) return [];
  const src: Record<string, { img: CanvasImageSource; e: KitEntry }> = {};
  for (const [k, e] of Object.entries(kit)) {
    if (!scene.textures.exists(raw(k))) continue;
    src[k] = { img: scene.textures.get(raw(k)).getSourceImage() as HTMLImageElement, e };
  }
  if (src[EPIC_FROM]) src[EPIC_KEY] = { img: epicCard(src[EPIC_FROM].img as HTMLImageElement, src[EPIC_FROM].e), e: src[EPIC_FROM].e };

  const replaced: string[] = [];
  for (const [k, { img, e }] of Object.entries(src)) {
    makeTex(scene, k, img, e, e.width, e.height);
    replaced.push(k);
  }
  for (const [target, from] of Object.entries(DERIVED)) {
    const s = src[from];
    // arte própria já carregada (ex.: molduras de item do pacote de itens) vale mais que a peça esticada
    if (!s || keep.has(target) || !scene.textures.exists(target)) continue;
    const old = scene.textures.get(target).get();
    makeTex(scene, target, s.img, s.e, old.width, old.height);
    replaced.push(target);
  }
  return replaced;
}
