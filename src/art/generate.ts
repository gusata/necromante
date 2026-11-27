import type Phaser from 'phaser';
import { SCHOOLS } from '../sim/cards';
import { CHARACTERS } from '../sim/characters';
import { GEMS } from '../sim/gems';
import { ITEMS } from '../sim/items';
import { FIELD, LIVING_KINDS } from '../sim/defs';
import { RNG } from '../sim/rng';
import { BOSS_SPECS, HUMANOIDS, humanoidFrames, mix, undeadColors } from './humanoid';
import { PAL, UI } from './palette';
import { TINY5 } from './fontData';
import * as S from './sprites';
import { VIEW_H } from '../fx/view';

type Ctx = CanvasRenderingContext2D;
type Colors = Record<string, string>;

const OUTLINE = PAL.k;

function canvas(scene: Phaser.Scene, key: string, w: number, h: number): { tex: Phaser.Textures.CanvasTexture; ctx: Ctx } {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  return { tex, ctx: tex.getContext() };
}

function px(ctx: Ctx, x: number, y: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
  ctx.globalAlpha = 1;
}

const colorOf = (c: string, colors?: Colors) => colors?.[c] ?? PAL[c];

/** Converte linhas de caracteres em grade de cores (null = transparente). */
function toGrid(rows: string[], colors?: Colors): (string | null)[][] {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((row) => Array.from({ length: w }, (_, x) => (row[x] && row[x] !== '.' ? (colorOf(row[x], colors) ?? null) : null)));
}

function drawGrid(scene: Phaser.Scene, key: string, grid: (string | null)[][]) {
  const h = grid.length;
  const w = grid[0]?.length ?? 1;
  const { tex, ctx } = canvas(scene, key, w, h);
  grid.forEach((row, y) => row.forEach((c, x) => c && px(ctx, x, y, c)));
  tex.refresh();
}

/** Desenha linhas de caracteres já no estilo da direção de arte (borda sel-out, sem contorno preto). */
export function spriteTex(scene: Phaser.Scene, key: string, rows: string[], colors?: Colors) {
  drawGrid(scene, key, selout(toGrid(rows, colors)));
}

type Grid = (string | null)[][];
const at = (g: Grid, x: number, y: number) => (y < 0 || y >= g.length || x < 0 || x >= g[0].length ? null : g[y][x]);
/** tom de borda: o tom mais escuro do próprio material */
const edgeOf = (c: string) => mix(c, '#0b0810', 0.55);

/**
 * Direção de arte (docs/ARTE.md): sem contorno preto. Mesma ideia do outline "selout" da skill codeart2d:
 * - contorno de fora no lado da luz (em cima e à esquerda da forma) vira o tom base do que ele encosta;
 * - contorno de fora no lado da sombra (embaixo e à direita) vira o tom mais escuro desse material;
 * - contorno que só encosta na quina some (cantos arredondados);
 * - contorno de dentro (olhos, junções) vira o tom escuro da peça ao lado.
 * Regiões que são só contorno (a sombra no chão) ficam como estão.
 */
function selout(g: Grid): Grid {
  const out = g.map((row) => [...row]);
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      if (g[y][x] !== OUTLINE) continue;
      const left = at(g, x - 1, y);
      const right = at(g, x + 1, y);
      const up = at(g, x, y - 1);
      const down = at(g, x, y + 1);
      const fill = (c: string | null): c is string => c !== null && c !== OUTLINE;
      const outer = [left, right, up, down].some((c) => c === null);
      const shadowSide = [left, up].filter(fill);
      const lightSide = [right, down].filter(fill);
      if (!outer) {
        const n = [...shadowSide, ...lightSide];
        if (n.length) out[y][x] = edgeOf(n[0]);
        continue;
      }
      if (shadowSide.length) out[y][x] = edgeOf(shadowSide[0]);
      else if (lightSide.length) out[y][x] = lightSide[0];
      else {
        const diag = [at(g, x - 1, y - 1), at(g, x + 1, y - 1), at(g, x - 1, y + 1), at(g, x + 1, y + 1)].some(fill);
        if (diag) out[y][x] = null;
      }
    }
  }
  return out;
}

/** Scale2x (AdvMAME2x): amplia 2x criando curvas no pixel de destino, em vez de blocos 2x2. */
function scale2x(src: Grid): Grid {
  const h = src.length;
  const w = src[0].length;
  const out: Grid = Array.from({ length: h * 2 }, () => Array<string | null>(w * 2).fill(null));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = src[y][x];
      const a = at(src, x, y - 1);
      const b = at(src, x + 1, y);
      const c = at(src, x - 1, y);
      const d = at(src, x, y + 1);
      out[y * 2][x * 2] = c === a && c !== d && a !== b ? a : p;
      out[y * 2][x * 2 + 1] = a === b && a !== c && b !== d ? b : p;
      out[y * 2 + 1][x * 2] = d === c && d !== b && c !== a ? c : p;
      out[y * 2 + 1][x * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  return out;
}

/**
 * Amplia 2x sem quebrar a grade única: tira o contorno de fora, amplia com Scale2x (cada pixel novo é
 * 1 pixel do mundo, com curvas, não blocos) e devolve uma borda de 1 px no lado da sombra.
 */
function upscale(rows: string[], colors?: Colors): Grid {
  const src = toGrid(rows, colors);
  const stripped = src.map((row, y) =>
    row.map((c, x) => (c === OUTLINE && [at(src, x - 1, y), at(src, x + 1, y), at(src, x, y - 1), at(src, x, y + 1)].some((n) => n === null) ? null : c)),
  );
  const big = selout(scale2x(stripped));
  const out = big.map((row) => [...row]);
  for (let y = 0; y < big.length; y++) {
    for (let x = 0; x < big[0].length; x++) {
      if (big[y][x] !== null) continue;
      const from = at(big, x - 1, y) ?? at(big, x, y - 1);
      if (from && from !== OUTLINE) out[y][x] = edgeOf(from);
    }
  }
  return out;
}

// ------------------------------------------------------------ unidades

/** Chave de textura do necromante jogável (o padrão mantém 'necro'). */
export const charKey = (id: string) => (id === 'necro' ? 'necro' : `char-${id}`);

export function unitKey(kind: string, boss?: string): string {
  if (kind === 'champion') return `champ-${boss}`;
  if (kind === 'skeleton') return 'skel';
  return kind;
}

function unitTextures(scene: Phaser.Scene) {
  const frames3 = (key: string, frames: string[][], colors?: Colors) =>
    [0, 1, 2].forEach((i) => spriteTex(scene, `${key}${i}`, frames[Math.min(i, frames.length - 1)], colors));
  // fantasmas ampliados 2x (20x22), da altura dos humanoides
  const big = (key: string, frames: string[][], colors: Colors) => [0, 1, 2].forEach((i) => drawGrid(scene, `${key}${i}`, upscale(frames[Math.min(i, frames.length - 1)], withPal(colors))));

  // vivos humanoides + cadáveres com as mesmas cores
  for (const kind of LIVING_KINDS) {
    if (kind === 'hound') continue;
    const spec = HUMANOIDS[kind];
    frames3(kind, humanoidFrames(spec));
    const c = { ...spec.colors };
    if (spec.head === 'bald') c.H = c.f;
    spriteTex(scene, `corpse-${kind}`, S.CORPSE, c);
  }
  const houndColors = { N: '#5a4030', n: '#3d2a20', O: '#e0a040' };
  frames3('hound', S.HOUND, houndColors);
  spriteTex(scene, 'corpse-hound', S.CORPSE_HOUND, houndColors);
  spriteTex(scene, 'corpse-bones', S.BONE_PILE);

  // mortos
  frames3('skel', S.SKEL);
  frames3('archer', S.SKEL_ARCHER);
  S.GIANT_BASE.forEach((f, i) => drawGrid(scene, `giant${i}`, upscale(f)));
  for (const k of ['zombie', 'ghoul', 'thrall', 'lich', 'plaguebearer', 'bloodknight']) frames3(k, humanoidFrames(HUMANOIDS[k]));
  // abominação: um zumbi ampliado, como o colosso
  humanoidFrames(HUMANOIDS.abomination).forEach((f, i) => drawGrid(scene, `abomination${i}`, upscale(f, withPal(HUMANOIDS.abomination.colors))));
  big('banshee', S.GHOST, { G: '#f4eefc', g: '#a08cc8', k: PAL.k });
  frames3('rat', S.RAT, { b: '#5e6151', B: '#3f4237', G: '#c8ff8a' });
  big('ghost', S.GHOST, { G: '#bfe9ff', g: '#6fa8c8' });

  // chefes e campeões
  for (const [boss, spec] of Object.entries(BOSS_SPECS)) {
    humanoidFrames(spec).forEach((f, i) => drawGrid(scene, `${boss}${i}`, upscale(f, withPal(spec.colors))));
    const und = undeadColors(spec);
    humanoidFrames(und).forEach((f, i) => drawGrid(scene, `champ-${boss}${i}`, upscale(f, withPal(und.colors))));
  }

  // necromantes jogáveis: parado, respirando, conjurando
  for (const c of CHARACTERS) {
    const base = c.id === 'necro' ? S.NECRO : S.charSprite(c.id);
    const cast = c.id === 'necro' ? S.NECRO_CAST : S.charSprite(c.id, true);
    const colors = S.CHAR_COLORS[c.id];
    const key = charKey(c.id);
    // o necromante é desenhado em 16x19 e ampliado 2x: maior que os bichos, como protagonista
    const pal = withPal(colors ?? {});
    drawGrid(scene, `${key}0`, upscale(base, pal));
    drawGrid(scene, `${key}1`, upscale(['................', ...base.slice(0, 10), ...base.slice(11)], pal));
    drawGrid(scene, `${key}-cast`, upscale(cast, pal));
    scene.anims.create({ key: `${key}-idle`, frames: [{ key: `${key}0` }, { key: `${key}1` }], frameRate: 1.5, repeat: -1 });
  }

  const walk = (key: string, rate = 6) =>
    scene.anims.create({ key: `${key}-walk`, frames: [{ key: `${key}0` }, { key: `${key}1` }], frameRate: rate, repeat: -1 });
  for (const k of [
    ...LIVING_KINDS,
    'skel',
    'archer',
    'giant',
    'zombie',
    'ghoul',
    'thrall',
    'rat',
    'ghost',
    'lich',
    'abomination',
    'plaguebearer',
    'banshee',
    'bloodknight',
  ])
    walk(k, k === 'rat' || k === 'hound' ? 10 : k === 'abomination' ? 4 : 6);
  for (const b of Object.keys(BOSS_SPECS)) {
    walk(b, 4);
    walk(`champ-${b}`, 4);
  }
  // sem borda verde nos mortos (docs/ARTE.md): o lado se lê pela cor (mortos frios e pálidos, olhos
  // verde-alma; vivos quentes e saturados)
}

/** As cores do humanoide + a paleta global (para o upscale ler armas e contornos). */
const withPal = (c: Colors): Colors => ({ ...PAL, ...c });

// ------------------------------------------------------------ chão das regiões

interface GroundStyle {
  base: string;
  a: string;
  b: string;
  c: string;
  accent: string;
  kind: 'dirt' | 'tiles' | 'cobble' | 'marble';
}

/** Cada região tem uma cor forte: terra quente, pedra esverdeada, aço azulado, mármore roxo. */
export const GROUND_STYLES: GroundStyle[] = [
  // palco escuro (docs/ARTE.md): nenhum pixel de chão passa de uns 20% de brilho, contraste baixíssimo
  { base: '#1a120e', a: '#20160f', b: '#281b13', c: '#2e2016', accent: '#1a2014', kind: 'dirt' },
  { base: '#10181c', a: '#141e22', b: '#1a262a', c: '#1f2c30', accent: '#18200f', kind: 'tiles' },
  { base: '#12151e', a: '#171b26', b: '#1d2230', c: '#232a3a', accent: '#2a1014', kind: 'cobble' },
  { base: '#170f1c', a: '#1d1324', b: '#24182c', c: '#2c1e36', accent: '#3e1020', kind: 'marble' },
];
/** cor e força da escuridão por região (índice 4 = abismo) */
export const REGION_DARK: { color: number; amount: number }[] = [
  // palco escuro (docs/ARTE.md): a luz do necromante e das tochas é o que mostra a batalha
  { color: 0x140904, amount: 0.5 },
  { color: 0x031210, amount: 0.52 },
  { color: 0x040814, amount: 0.52 },
  { color: 0x10040f, amount: 0.48 },
  { color: 0x1e0306, amount: 0.58 },
];

/**
 * O chão vai além do campo para cima: em celular comprido a partida mostra a sobra acima
 * do campo (veja src/fx/view.ts). Múltiplo de 10 e 12 para os ladrilhos caírem no mesmo lugar.
 * A imagem fica em y = -GROUND_TOP.
 */
export const GROUND_TOP = 120;

function groundTex(scene: Phaser.Scene, key: string, st: GroundStyle, seed: number) {
  const w = FIELD.w;
  const h = GROUND_TOP + 320;
  // mesma densidade de detalhes por área que no chão de 320
  const k = h / 320;
  const { tex, ctx } = canvas(scene, key, w, h);
  const rng = new RNG(seed);
  ctx.fillStyle = st.base;
  ctx.fillRect(0, 0, w, h);

  if (st.kind === 'dirt') {
    for (let y = 0; y < h; y++) {
      const half = 14 + Math.sin(y * 0.05) * 4 + (y / h) * 10;
      const cx = 90 + Math.sin(y * 0.021) * 6;
      for (let x = Math.floor(cx - half); x < cx + half; x++) if (rng.next() < 0.55) px(ctx, x, y, st.a);
    }
    for (let i = 0; i < Math.round(k * 520); i++) {
      ctx.fillStyle = rng.next() < 0.7 ? st.a : st.b;
      const x = rng.int(0, w);
      const y = rng.int(0, h);
      ctx.fillRect(x, y, rng.int(1, 3), rng.int(1, 2));
      if (rng.next() < 0.3) px(ctx, x, y, st.c);
    }
    // tufos de grama morta
    for (let i = 0; i < Math.round(k * 70); i++) {
      const x = rng.int(0, w);
      const y = rng.int(0, h);
      if (Math.abs(x - 90) < 22) continue;
      px(ctx, x, y, '#1f2618');
      px(ctx, x - 1, y + 1, '#181d13');
      px(ctx, x + 1, y + 1, '#181d13');
    }
  } else if (st.kind === 'tiles') {
    const s = 12;
    for (let ty = 0; ty < h; ty += s) {
      for (let tx = (ty / s) % 2 ? -6 : 0; tx < w; tx += s) {
        ctx.fillStyle = rng.next() < 0.5 ? st.a : st.b;
        ctx.fillRect(tx + 1, ty + 1, s - 1, s - 1);
        ctx.fillStyle = st.c;
        ctx.fillRect(tx + 1, ty + 1, s - 2, 1);
        if (rng.next() < 0.25) for (let j = 0; j < 5; j++) px(ctx, tx + rng.int(2, s - 2), ty + rng.int(2, s - 2), OUTLINE);
        if (rng.next() < 0.2) for (let j = 0; j < 6; j++) px(ctx, tx + rng.int(1, s - 1), ty + s - rng.int(1, 3), st.accent);
      }
    }
  } else if (st.kind === 'cobble') {
    for (let i = 0; i < Math.round(k * 900); i++) {
      const x = rng.int(0, w);
      const y = rng.int(0, h);
      const sw = rng.int(3, 6);
      const sh = rng.int(2, 4);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 1, y - 1, sw + 2, sh + 2);
      ctx.fillStyle = rng.next() < 0.5 ? st.a : st.b;
      ctx.fillRect(x, y, sw, sh);
      ctx.fillStyle = st.c;
      ctx.fillRect(x, y, sw - 1, 1);
    }
    for (let i = 0; i < Math.round(k * 40); i++) {
      const x = rng.int(0, w);
      const y = rng.int(0, h);
      for (let j = 0; j < 6; j++) px(ctx, x + rng.int(-3, 3), y + rng.int(-2, 2), st.accent);
    }
  } else {
    const s = 10;
    for (let ty = 0; ty < h; ty += s) {
      for (let tx = 0; tx < w; tx += s) {
        const dark = ((tx + ty) / s) % 2 === 0;
        ctx.fillStyle = dark ? st.a : st.b;
        ctx.fillRect(tx, ty, s, s);
        if (!dark && rng.next() < 0.4) {
          let vx = tx + rng.int(0, s);
          for (let j = 0; j < s; j++) px(ctx, (vx += rng.int(-1, 1)), ty + j, st.c, 0.6);
        }
      }
    }
    // tapete vermelho até o altar
    for (let y = 0; y < h; y++) {
      for (let x = 72; x < 108; x++) {
        const edge = x === 72 || x === 107;
        const trim = x === 74 || x === 105;
        px(ctx, x, y, edge ? OUTLINE : trim ? '#4a3814' : (x + y) % 7 === 0 ? '#2e0a16' : st.accent);
      }
    }
  }
  // rachaduras
  for (let i = 0; i < Math.round(k * 18); i++) {
    let x = rng.int(0, w);
    let y = rng.int(0, h);
    const len = rng.int(5, 14);
    for (let j = 0; j < len; j++) {
      px(ctx, x, y, OUTLINE);
      x += rng.int(-1, 1);
      y += 1;
    }
  }
  // vinheta pontilhada
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, w - 1 - x, y * 0.7, (GROUND_TOP + FIELD.h - 1 - y) * 2);
      if (edge < 16 && (x + y) % 2 === 0 && rng.next() > edge / 16) px(ctx, x, y, OUTLINE);
    }
  }
  tex.refresh();
}

// ------------------------------------------------------------ efeitos e UI

function altarTex(scene: Phaser.Scene) {
  const w = 40;
  const h = 14;
  const { tex, ctx } = canvas(scene, 'altar', w, h);
  const rx = w / 2 - 0.5;
  const ry = h / 2 - 0.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = ((x - rx) / rx) ** 2 + ((y - ry) / ry) ** 2;
      if (v <= 1 && v > 0.72) px(ctx, x, y, (x + y) % 2 ? PAL.g : '#1f5a3a');
      else if (v <= 0.72) px(ctx, x, y, '#0d0a13');
      if (v > 0.25 && v < 0.33 && (x + y) % 3 === 0) px(ctx, x, y, '#1f5a3a');
    }
  }
  tex.refresh();
}

function lightTex(scene: Phaser.Scene, key: string, size: number) {
  const { tex, ctx } = canvas(scene, key, size, size);
  const c = size / 2 - 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / (size / 2);
      const dither = (x + y) % 2 === 0;
      let a = 0;
      if (d < 0.4) a = 1;
      else if (d < 0.55) a = dither ? 1 : 0.7;
      else if (d < 0.7) a = 0.7;
      else if (d < 0.82) a = dither ? 0.7 : 0.35;
      else if (d < 0.92) a = 0.35;
      else if (d < 1) a = dither ? 0.35 : 0;
      if (a > 0) px(ctx, x, y, '#ffffff', a);
    }
  }
  tex.refresh();
}

function glowTex(scene: Phaser.Scene, key: string, size: number) {
  const { tex, ctx } = canvas(scene, key, size, size);
  const c = size / 2 - 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / (size / 2);
      const a = d < 0.3 ? 0.55 : d < 0.6 ? 0.28 : d < 1 ? ((x + y) % 2 ? 0.12 : 0) : 0;
      if (a > 0) px(ctx, x, y, '#ffffff', a);
    }
  }
  tex.refresh();
}

/**
 * Painel com moldura (docs/ARTE.md, "Interface"), no desenho liso do King Dies Rich:
 * base de todos os botões, painéis, linhas, cartões e abas.
 * - borda externa escura de 1 px e cantos com o pixel cortado;
 * - moldura de 1 px na cor dada, sem relevo, rebite ou cantoneira;
 * - miolo chapado com um filete de luz bem fraco no alto;
 * - botões ('btn…' sem '-down') ganham uma beirada mais escura embaixo, que some ao apertar.
 */
export function panelTex(scene: Phaser.Scene, key: string, w: number, h: number, fill: string, frame: string, border: string = UI.dark) {
  const { tex, ctx } = canvas(scene, key, w, h);
  const rect = (x: number, y: number, rw: number, rh: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, rw, rh);
  };
  rect(0, 0, w, h, border);
  rect(1, 1, w - 2, h - 2, frame);
  rect(2, 2, w - 4, h - 4, fill);
  if (h >= 8) rect(2, 2, w - 4, 1, mix(fill, '#ffffff', 0.07));
  const lip = key.startsWith('btn') && !key.endsWith('-down') && h >= 12;
  if (lip) rect(2, h - 4, w - 4, 2, mix(fill, '#000000', 0.35));
  // cantos cortados
  for (const [x, y] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ])
    ctx.clearRect(x, y, 1, 1);
  for (const [x, y] of [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ])
    rect(x, y, 1, 1, border);
  tex.refresh();
}

// ------------------------------------------------------------ peças de menu com detalhe

/** pedra escura e quente dos nichos, pedestais e encaixes (luz de cima-esquerda) */
const STONE = { deep: '#0d0907', dark: '#1a1410', mid: '#2c221a', light: '#3e3024', top: '#55432f', mortar: '#120d0a' };

/**
 * Espaço de item, como no King Dies Rich: moldura fina na cor da raridade e o fundo tingido dela,
 * chapado. Vazio: só o encaixe escuro.
 */
function slotTex(scene: Phaser.Scene, key: string, frame: string | null, size = 24) {
  const { tex, ctx } = canvas(scene, key, size, size);
  const s = size;
  const fr = frame ? mix(frame, '#000000', 0.15) : '#2a2018';
  const fill = frame ? mix(frame, '#0d0a08', 0.8) : '#0f0b09';
  ctx.fillStyle = UI.dark;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = fr;
  ctx.fillRect(1, 1, s - 2, s - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(2, 2, s - 4, s - 4);
  if (frame) {
    ctx.fillStyle = mix(fill, '#ffffff', 0.06);
    ctx.fillRect(2, 2, s - 4, 1);
  }
  for (const [x, y] of [
    [0, 0],
    [s - 1, 0],
    [0, s - 1],
    [s - 1, s - 1],
  ])
    ctx.clearRect(x, y, 1, 1);
  tex.refresh();
}

/** Nicho de pedra em arco (tesouro): blocos com argamassa, fundo escuro pontilhado e degrau de pedra. */
function alcoveTex(scene: Phaser.Scene, key: string, w: number, h: number) {
  const { tex, ctx } = canvas(scene, key, w, h);
  const cx = (w - 1) / 2;
  const arch = Math.min(12, Math.floor(w / 3));
  const top = (x: number, inset: number) => {
    const r = w / 2 - inset;
    const d = Math.min(1, Math.abs(x - cx) / r);
    return inset + Math.round(arch * (1 - Math.sqrt(1 - d * d)));
  };
  const rng = new RNG(w * 131 + h);
  const T = 3; // espessura da moldura de pedra
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < top(x, 0)) continue;
      const inner = x >= T && x < w - T && y >= top(x, T) && y < h - 5;
      if (inner) {
        // fundo: escuro em cima, um pouco mais quente embaixo, transição pontilhada
        const t = (y - top(x, T)) / Math.max(1, h - 5 - top(x, T));
        const lift = t > 0.55 ? 2 : t > 0.3 ? ((x + y) % 2 === 0 ? 2 : 1) : t > 0.15 ? ((x + y) % 2 === 0 ? 1 : 0) : 0;
        px(ctx, x, y, [STONE.deep, '#130e0b', '#1a1310'][lift]);
        continue;
      }
      if (y >= h - 5) {
        // degrau: tampo claro, face média, sombra embaixo
        const r = y - (h - 5);
        px(ctx, x, y, r === 0 ? STONE.top : r === 1 ? STONE.light : r === 4 ? STONE.deep : STONE.mid);
        if (r >= 2 && r <= 3 && (x + 3 * (r - 2)) % 7 === 0) px(ctx, x, y, STONE.mortar);
        continue;
      }
      // moldura em blocos: fileiras de 3 px, juntas desencontradas
      const row = Math.floor((y - top(x, 0)) / 3);
      const joint = (y - top(x, 0)) % 3 === 2 || (x + row * 4) % 8 === 0;
      let c = joint ? STONE.mortar : rng.next() < 0.12 ? STONE.light : STONE.mid;
      if (!joint && (x === 0 || y === top(x, 0))) c = STONE.light;
      if (x === w - 1) c = STONE.dark;
      px(ctx, x, y, c);
    }
  }
  // pedra-chave no alto do arco
  for (let y = 0; y < 4; y++) for (let x = Math.floor(cx) - 2; x <= Math.ceil(cx) + 2; x++) if (y >= top(x, 0)) px(ctx, x, y, y === top(x, 0) ? STONE.top : STONE.light);
  tex.refresh();
}

/** Pedestal de pedra (12x8): tampo claro, coluna, base larga. */
function pedestalTex(scene: Phaser.Scene) {
  const { tex, ctx } = canvas(scene, 'pedestal', 12, 8);
  const rows = ['tttttttttttl', 'mmmmmmmmmmmd', '.dmmmmmmmmd.', '..mlmmmmd...', '..mlmmmmd...', '.mmmmmmmmmd.', 'tllllllllld.', 'dddddddddddd'];
  const pal: Record<string, string> = { t: STONE.top, l: STONE.light, m: STONE.mid, d: STONE.dark };
  rows.forEach((r, y) => [...r].forEach((c, x) => c !== '.' && px(ctx, x, y, pal[c])));
  tex.refresh();
}

/** Encaixe de gema no altar: anel de pedra entalhada com furo escuro; aceso, o anel brilha em ouro. */
function socketTex(scene: Phaser.Scene, key: string, lit: boolean) {
  const s = 26;
  const { tex, ctx } = canvas(scene, key, s, s);
  const c = (s - 1) / 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      if (d > 12.6) continue;
      if (d > 11.6) px(ctx, x, y, UI.dark);
      else if (d > 7.6) {
        const lightSide = dx + dy < -2;
        const notch = (Math.abs(dx) < 1 || Math.abs(dy) < 1) && d > 9.6;
        let col = notch ? STONE.mortar : lightSide ? STONE.light : dx + dy > 4 ? STONE.dark : STONE.mid;
        if (lit && !notch && d > 10.6) col = (x + y) % 2 ? UI.gold : UI.goldDark;
        px(ctx, x, y, col);
      } else if (d > 6.6) px(ctx, x, y, (x + y) % 2 ? STONE.deep : lit ? '#3a2a14' : '#120d0a');
      else px(ctx, x, y, STONE.deep);
    }
  }
  tex.refresh();
}

/**
 * Cartão do bestiário (40x40): moldura, fundo com janela em arco e um degrau iluminado onde o bicho pisa
 * (linha 34), com a sombra dele no chão.
 */
function stageTex(scene: Phaser.Scene) {
  const { tex, ctx } = canvas(scene, 'stage', 40, 40);
  ctx.fillStyle = UI.dark;
  ctx.fillRect(0, 0, 40, 40);
  ctx.fillStyle = UI.edge;
  ctx.fillRect(1, 1, 38, 38);
  ctx.fillStyle = '#100c09';
  ctx.fillRect(2, 2, 36, 36);
  // janela em arco atrás do bicho
  for (let y = 4; y < 33; y++)
    for (let x = 9; x < 31; x++) {
      const d = Math.hypot((x - 19.5) / 10.5, (y - 14) / 10);
      if (y < 14 && d > 1) continue;
      px(ctx, x, y, y < 8 ? '#1d1510' : (x + y) % 2 === 0 || y > 20 ? '#1a130e' : '#1d1510');
    }
  // degrau
  ctx.fillStyle = STONE.top;
  ctx.fillRect(4, 33, 32, 1);
  ctx.fillStyle = STONE.light;
  ctx.fillRect(4, 34, 32, 2);
  ctx.fillStyle = STONE.mid;
  ctx.fillRect(3, 36, 34, 2);
  // sombra no chão
  for (let x = 14; x < 26; x++) px(ctx, x, 33, '#2a1f17');
  for (const [x, y] of [
    [0, 0],
    [39, 0],
    [0, 39],
    [39, 39],
  ])
    ctx.clearRect(x, y, 1, 1);
  tex.refresh();
}

/** Célula da bolsa de gemas: pequena gaveta afundada; cheia, com borda de madeira. */
function cellTex(scene: Phaser.Scene, key: string, full: boolean) {
  const { tex, ctx } = canvas(scene, key, 20, 16);
  ctx.fillStyle = UI.dark;
  ctx.fillRect(0, 0, 20, 16);
  ctx.fillStyle = full ? UI.edge : '#1f1712';
  ctx.fillRect(1, 1, 18, 14);
  ctx.fillStyle = full ? '#241a13' : '#100c09';
  ctx.fillRect(2, 2, 16, 12);
  ctx.fillStyle = full ? '#170f0b' : '#0a0706';
  ctx.fillRect(2, 2, 16, 1);
  ctx.fillRect(2, 2, 1, 12);
  if (full) {
    ctx.fillStyle = UI.edge2;
    ctx.fillRect(1, 1, 18, 1);
  }
  for (const [x, y] of [
    [0, 0],
    [19, 0],
    [0, 15],
    [19, 15],
  ])
    ctx.clearRect(x, y, 1, 1);
  tex.refresh();
}

/** Linha de livro-razão (registros): fundo, marcador em losango à esquerda e um pontilhado de guia embaixo. */
function ledgerTex(scene: Phaser.Scene, key: string, fill: string) {
  const { tex, ctx } = canvas(scene, key, 172, 14);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 172, 14);
  ctx.fillStyle = mix(fill, '#ffffff', 0.06);
  ctx.fillRect(0, 0, 172, 1);
  for (let x = 2; x < 170; x += 2) px(ctx, x, 12, UI.edge);
  for (const [x, y, c] of [
    [3, 6, UI.edge2],
    [2, 7, UI.edge2],
    [4, 7, UI.edge],
    [3, 8, UI.edge],
  ] as const)
    px(ctx, x, y, c);
  tex.refresh();
}

function menuPieceTextures(scene: Phaser.Scene) {
  ledgerTex(scene, 'ledger', '#14100c');
  ledgerTex(scene, 'ledger-alt', '#1a140f');
  alcoveTex(scene, 'alcove-40x42', 40, 42);
  alcoveTex(scene, 'alcove-54x38', 54, 38);
  pedestalTex(scene);
  socketTex(scene, 'socket', false);
  socketTex(scene, 'socket-on', true);
  stageTex(scene);
  cellTex(scene, 'cell', false);
  cellTex(scene, 'cell-on', true);
  for (const gd of Object.values(GEMS)) for (let r = 1; r <= 5; r++) gemTex(scene, `gem-${gd.type}-${r}`, gd.color, r);
  // espaço vazio: silhueta do tipo de item (como no King Dies Rich), apagada
  for (const [slot, rows] of Object.entries(S.SLOT_SILHOUETTES)) spriteTex(scene, `slot-sil-${slot}`, rows, { s: '#4a3a2c' });
  // selinho de escola no canto do item: o ícone com contorno preto de 1 px
  for (const [id, info] of Object.entries(SCHOOLS)) badgeTex(scene, `badge-${id}`, S.SCHOOL_ICONS[id], info.color);
}

function badgeTex(scene: Phaser.Scene, key: string, rows: string[], color: string) {
  const w = rows[0].length + 2;
  const h = rows.length + 2;
  const { tex, ctx } = canvas(scene, key, w, h);
  const on = (x: number, y: number) => rows[y]?.[x] === 's';
  for (let y = -1; y <= rows.length; y++) {
    for (let x = -1; x <= rows[0].length; x++) {
      if (on(x, y)) px(ctx, x + 1, y + 1, color);
      else if (rows[y]?.[x] === 'k') px(ctx, x + 1, y + 1, '#07050b');
      else {
        let near = false;
        for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1 && !near; ox++) near = on(x + ox, y + oy);
        if (near) px(ctx, x + 1, y + 1, '#07050b');
      }
    }
  }
  tex.refresh();
}

/**
 * Arte importada (manifesto) troca os ícones `school-*` depois que os selos já foram gerados:
 * refaz `badge-*` a partir do ícone novo, com o mesmo contorno escuro de 1 px.
 */
export function rebuildBadges(scene: Phaser.Scene, replaced: string[]) {
  for (const id of Object.keys(SCHOOLS)) {
    if (!replaced.includes(`school-${id}`)) continue;
    const src = scene.textures.get(`school-${id}`).getSourceImage() as HTMLCanvasElement;
    const w = src.width;
    const h = src.height;
    const icon = src.getContext('2d')!.getImageData(0, 0, w, h).data;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && icon[(y * w + x) * 4 + 3] > 0;
    const key = `badge-${id}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const { tex, ctx } = canvas(scene, key, w + 2, h + 2);
    for (let y = -1; y <= h; y++)
      for (let x = -1; x <= w; x++) {
        if (on(x, y)) continue;
        let near = false;
        for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1 && !near; ox++) near = on(x + ox, y + oy);
        if (near) px(ctx, x + 1, y + 1, '#07050b');
      }
    ctx.drawImage(src, 1, 1);
    tex.refresh();
  }
}

/**
 * Gemas por nível, como no King Dies Rich: o nível é a forma, não um número.
 * 1 pedra bruta, 2 lapidada, 3 brilhante, 4 octaedro, 5 cabochão com aro de ouro.
 * 16x16, no pixel do mundo (sem escala). Chaves `gem-<tipo>-<nível>`.
 */
function gemTex(scene: Phaser.Scene, key: string, c: string, rank: number) {
  const S = 16;
  const { tex, ctx } = canvas(scene, key, S, S);
  const H = mix(c, '#ffffff', 0.75);
  const L = mix(c, '#ffffff', 0.4);
  const M = c;
  const Sd = mix(c, '#000000', 0.3);
  const D = mix(c, '#000000', 0.55);
  const GOLD = ['#f6cf6a', '#c9a23a', '#8a5a18'];
  const cx = (S - 1) / 2;
  const g: (string | null)[][] = Array.from({ length: S }, () => Array<string | null>(S).fill(null));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - cx;
      const dy = y - cx;
      let col: string | null = null;
      if (rank === 1) {
        // pedra bruta: oval torta e pequena
        const e = (dx / 4.3) ** 2 + ((dy - 0.5) / 3.4) ** 2;
        if (e <= 1 && !(dx > 2.5 && dy < -1.5)) {
          const t = dx + dy;
          col = t < -3 ? L : t < 0.5 ? M : t < 3 ? Sd : D;
          if (e > 0.62 && t > -1) col = D;
        }
      } else if (rank === 2) {
        // lapidada: quadrado de cantos cortados com a mesa clara no meio
        if (Math.abs(dx) <= 5 && Math.abs(dy) <= 5 && Math.abs(dx) + Math.abs(dy) <= 8) {
          if (Math.abs(dx) <= 2.5 && Math.abs(dy) <= 2.5 && Math.abs(dx) + Math.abs(dy) <= 4) col = dx + dy < 0 ? L : M;
          else {
            col = dy < -2.5 && dx < 2 ? L : dx < -2.5 || dy < -2.5 ? M : dx + dy < 6 ? Sd : D;
            if (dx > 2.5 && dy > 2.5) col = D;
          }
        }
      } else if (rank === 3) {
        // brilhante visto de lado: coroa (trapézio) e pavilhão (triângulo)
        const ry = y - 3;
        if (ry >= 0 && ry <= 2 && Math.abs(dx) <= 4.5 + ry) {
          col = ry === 0 && dx >= -3 && dx <= -1 ? H : dx < -1.5 ? L : dx < 1.5 ? M : Sd;
          if (ry === 2) col = dx < 0 ? L : M;
        } else if (ry >= 3 && ry <= 9) {
          const half = 6.5 - (ry - 3);
          if (Math.abs(dx) <= half) col = dx < -half + 1.5 ? L : dx < -0.5 ? M : dx < 2 ? Sd : D;
        }
      } else if (rank === 4) {
        // octaedro: losango de quatro faces com a aresta do meio
        if (Math.abs(dx) + Math.abs(dy) <= 6.8) {
          col = dy < 0 ? (dx < 0 ? L : M) : dx < 0 ? M : D;
          if (Math.abs(dx) < 0.6) col = dy < 0 ? H : Sd;
          if (dy < 0 && dx < 0 && Math.abs(dx) + Math.abs(dy) > 5.6) col = M;
        }
      } else {
        // cabochão com aro de ouro
        const d = Math.hypot(dx, dy);
        if (d <= 6.9) {
          const t = dx + dy;
          if (d > 5.9) col = t < -3 ? GOLD[0] : t < 3 ? GOLD[1] : GOLD[2];
          else {
            col = t < -3.5 ? L : t < 1.5 ? M : t < 5 ? Sd : D;
            if (dx >= -4 && dx <= -2 && dy >= -4 && dy <= -2 && t <= -5) col = H;
          }
        }
      }
      g[y][x] = col;
    }
  }
  // brilho de 1 px
  const [sx, sy] = ([[-2, -1], [-1, -2], [-3, -4], [-2, -2], [-3, -3]] as const)[rank - 1];
  const bx = Math.floor(cx + sx + 0.5);
  const by = Math.floor(cx + sy + 0.5);
  if (g[by][bx]) g[by][bx] = H;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (g[y][x]) px(ctx, x, y, g[y][x] as string);
  tex.refresh();
}


function hudTex(scene: Phaser.Scene) {
  const { tex, ctx } = canvas(scene, 'hudbar', FIELD.w, 24);
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, FIELD.w, 24);
  ctx.fillStyle = UI.edge;
  ctx.fillRect(0, 0, FIELD.w, 1);
  ctx.fillStyle = UI.dark;
  ctx.fillRect(0, 1, FIELD.w, 1);
  tex.refresh();

  // topo: só uma sombra que some, o texto flutua por cima do campo (como no King Dies Rich)
  const top = canvas(scene, 'topbar', FIELD.w, 40);
  for (let y = 0; y < 40; y++) {
    top.ctx.globalAlpha = 0.92 * Math.min(1, 1.6 * (1 - y / 40)) ** 1.4;
    top.ctx.fillStyle = UI.dark;
    top.ctx.fillRect(0, y, FIELD.w, 1);
  }
  top.ctx.globalAlpha = 1;
  top.tex.refresh();

  // botões redondos de ação (ícone só, como o espaço de poção)
  const round = (key: string, fill: string, frame: string) => {
    const r = canvas(scene, key, 22, 22);
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < 22; x++) {
        const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 11);
        if (d > 11) continue;
        px(r.ctx, x, y, d > 10 ? UI.dark : d > 8.6 ? frame : y < 9 ? fill : UI.panel, 1);
      }
    }
    r.tex.refresh();
  };
  round('act-round', UI.panel2, UI.edge2);
  round('act-round-ready', '#1e3a26', '#5fd08a');
  round('act-round-down', '#3a2a1c', UI.gold);

  // vinheta vermelha de vida baixa
  // do tamanho da tela inteira (a altura muda com o celular)
  const v = canvas(scene, 'vignette', FIELD.w, VIEW_H);
  for (let y = 0; y < VIEW_H; y++) {
    for (let x = 0; x < FIELD.w; x++) {
      const e = Math.min(x, FIELD.w - 1 - x, y, VIEW_H - 1 - y);
      if (e < 4 || (e < 10 && (x + y) % 2 === 0) || (e < 18 && (x + y) % 4 === 0)) px(v.ctx, x, y, '#ffffff');
    }
  }
  v.tex.refresh();
}

/**
 * Fontes do jogo (Tiny5, de Stefan Schmidt, OFL; dados em fontData.ts):
 * - 'px' / 'px-flat': Tiny5, texto corrido, com e sem sombra;
 * - 'px-out': contorno preto em volta, para números por cima de ícones.
 * Títulos usam a mesma fonte em maiúsculas espaçadas (veja pxText): nada de fonte grossa nem ampliada.
 * A sombra preta (1 px para baixo e para a direita) vai na própria imagem, como antes; o 'flat' é para texto escuro em botão claro.
 * O y do texto é o topo das maiúsculas: acentos sobem acima dele e as pernas (g, ç) descem abaixo da linha.
 */
function fontTex(scene: Phaser.Scene) {
  for (const [key, glyphs] of [
    ['px', TINY5],
  ] as const) {
    // 'px' (sombra), 'px-flat' (sem sombra) e 'px-out' (contorno preto em volta: números por cima de ícones)
    for (const mode of ['shadow', 'flat', 'out'] as const) {
      const shadow = mode === 'shadow';
      const out = mode === 'out';
      const name = shadow ? key : out ? 'px-out' : key.replace('px', 'px-flat');
      const entries = Object.entries(glyphs);
      // uma linha com todas as letras; cada célula tem 1 px a mais para a sombra
      const cells = entries.map(([ch, [adv, x, top, rows]]) => {
        const bits = rows ? rows.split('/') : [];
        const w = bits.reduce((m, r) => Math.max(m, r.length), 0);
        // o espaço da Tiny5 é estreito demais para frases: alarga 1 px
        return { ch, adv: ch === ' ' ? adv + 1 : adv, x, top, bits, w, h: bits.length };
      });
      const pad = out ? 2 : 1;
      const W = cells.reduce((s, c) => s + c.w + 2 + pad, 0);
      const H = cells.reduce((m, c) => Math.max(m, c.h), 0) + pad;
      const { tex, ctx } = canvas(scene, `font-${name}`, W, H);
      // o Phaser lê xAdvance, data e kerning, que faltam no tipo dele
      const chars: Record<number, Record<string, unknown>> = {};
      let cx = 0;
      for (const c of cells) {
        const draw = (dx: number, dy: number, color: string) =>
          c.bits.forEach((row, y) => [...row].forEach((b, x) => b === '#' && px(ctx, cx + x + dx, y + dy, color)));
        if (shadow) draw(1, 1, '#000000');
        if (out) for (const [ox, oy] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]]) draw(ox, oy, '#000000');
        draw(out ? 1 : 0, out ? 1 : 0, '#ffffff');
        const cw = c.w + (shadow ? 1 : out ? 2 : 0);
        const ch = c.h + (shadow ? 1 : out ? 2 : 0);
        chars[c.ch.codePointAt(0)!] = {
          x: cx,
          y: 0,
          width: cw,
          height: ch,
          centerX: Math.floor(cw / 2),
          centerY: Math.floor(ch / 2),
          xOffset: c.x - (out ? 1 : 0),
          yOffset: c.top - (out ? 1 : 0),
          xAdvance: c.adv,
          data: {},
          kerning: {},
          u0: cx / W,
          v0: 0,
          u1: (cx + cw) / W,
          v1: ch / H,
        };
        cx += c.w + 2 + pad;
      }
      tex.refresh();
      scene.cache.bitmapFont.add(name, {
        data: { font: name, size: 5, lineHeight: 8, retroFont: false, chars } as unknown as Phaser.Types.GameObjects.BitmapText.BitmapFontData,
        texture: `font-${name}`,
        frame: null,
      });
    }
  }
}

function propTextures(scene: Phaser.Scene) {
  spriteTex(scene, 'tomb', S.TOMB);
  spriteTex(scene, 'tomb2', S.TOMB2);
  spriteTex(scene, 'cross', S.CROSS_GRAVE);
  spriteTex(scene, 'tree', S.DEAD_TREE, { N: '#2a2230', n: '#1c1622' });
  spriteTex(scene, 'fence', S.FENCE, { N: '#3a2c22' });
  spriteTex(scene, 'pillar', S.PILLAR);
  spriteTex(scene, 'wall', S.WALL);
  spriteTex(scene, 'barrel', S.BARREL);
  spriteTex(scene, 'pew', S.PEW, { N: '#3a2418', n: '#2a1a12' });
  spriteTex(scene, 'bones', S.BONES_DECOR);
  S.CANDLE.forEach((f, i) => spriteTex(scene, `candle${i}`, f));
  S.BRAZIER.forEach((f, i) => spriteTex(scene, `brazier${i}`, f));
  S.BANNER.forEach((f, i) => spriteTex(scene, `banner${i}`, f));
  S.CANDELABRA.forEach((f, i) => spriteTex(scene, `candelabra${i}`, f));
  for (const k of ['candle', 'brazier', 'banner', 'candelabra']) {
    scene.anims.create({ key: `${k}-anim`, frames: [{ key: `${k}0` }, { key: `${k}1` }], frameRate: k === 'banner' ? 2 : 5, repeat: -1 });
  }
}

function iconTextures(scene: Phaser.Scene) {
  spriteTex(scene, 'icon-soul', S.SOUL_ICON);
  spriteTex(scene, 'icon-skull', S.SKULL_ICON);
  spriteTex(scene, 'icon-heart', S.HEART_ICON);
  spriteTex(scene, 'icon-pause', S.PAUSE_ICON);
  spriteTex(scene, 'icon-lock', S.LOCK_ICON);
  spriteTex(scene, 'icon-hand', S.HAND_ICON);
  spriteTex(scene, 'icon-ritual', S.RITUAL_ICON);
  spriteTex(scene, 'icon-explode', S.EXPLODE_ICON);
  for (const [id, rows] of Object.entries(S.NAV_ICONS)) spriteTex(scene, `nav-${id}`, rows, { L: '#c8ffd8', C: '#1f5a3a' });
  spriteTex(scene, 'icon-fuse', S.FUSE_ICON);
  spriteTex(scene, 'icon-consume', S.CONSUME_ICON);
  spriteTex(scene, 'icon-attack', S.ATTACK_ICON);
  spriteTex(scene, 'icon-bag', S.BAG_ICON);
  spriteTex(scene, 'icon-guard', S.GUARD_ICON);
  for (const g of Object.values(GEMS)) spriteTex(scene, `gem-${g.type}`, S.GEM_ICON, { g: g.color, L: mix(g.color, '#ffffff', 0.5), C: mix(g.color, '#000000', 0.4) });
  for (const [id, info] of Object.entries(SCHOOLS)) spriteTex(scene, `school-${id}`, S.SCHOOL_ICONS[id], { s: info.color, k: PAL.k });
  spriteTex(scene, 'school-neutral', S.SCHOOL_ICONS.neutral, { s: '#c9a23a', k: PAL.k });
  for (const [id, rows] of Object.entries(S.BUILDING_ICONS)) spriteTex(scene, id, rows);
  spriteTex(scene, 'arrow', S.ARROW);
  spriteTex(scene, 'boltp', S.BOLT_PROJ);
  spriteTex(scene, 'bonearrow', S.BONE_ARROW);
  spriteTex(scene, 'splat', S.SPLAT);
  spriteTex(scene, 'scorch', S.SCORCH);
  spriteTex(scene, 'shadow', ['.kkkkkk.', 'kkkkkkkk', '.kkkkkk.']);
  spriteTex(scene, 'px', ['w'], { w: '#ffffff' });
  spriteTex(scene, 'px2', ['ww', 'ww'], { w: '#ffffff' });
  spriteTex(scene, 'px3', ['.w.', 'www', '.w.'], { w: '#ffffff' });
}

function itemTextures(scene: Phaser.Scene) {
  for (const it of ITEMS) {
    const ring = it.slot === 'ring';
    const c = ring ? '#c9a23a' : it.color;
    spriteTex(scene, `item-${it.id}`, S.ITEM_ICONS[it.slot], {
      c,
      L: mix(c, '#ffffff', 0.35),
      C: mix(c, '#000000', 0.35),
      y: ring || it.slot === 'staff' ? it.color : mix(it.color, '#ffffff', 0.5),
      d: '#17111f',
      N: '#5a4030',
    });
  }
  // moldura de raridade para ícones
  const rar = { common: '#6b6452', magic: '#6fa8c8', rare: '#e0b040', epic: '#b468e0', legendary: '#ff7a3a', set: '#4ee08a' } as const;
  for (const [r, col] of Object.entries(rar)) slotTex(scene, `slot-${r}`, col);
  slotTex(scene, 'slot-empty', null);
  // casas do catálogo de gemas
  slotTex(scene, 'gcell', null, 18);
  slotTex(scene, 'gcell-on', '#6b5a48', 18);
  panelTex(scene, 'tab', 56, 14, UI.panel, UI.edge);
  panelTex(scene, 'tab-on', 56, 14, '#3a2a14', UI.gold);
  panelTex(scene, 'item-card', 170, 44, UI.panel, UI.edge);
}

/**
 * Navegação dos menus (src/scenes/nav.ts) e peças da tela inicial:
 * cabeçalho, barra de abas embaixo, sub-abas, engrenagem, botão principal grande e chips.
 */
function navTextures(scene: Phaser.Scene) {
  const bar = '#100b08';
  // cabeçalho: faixa escura com filete de moldura embaixo
  {
    const { tex, ctx } = canvas(scene, 'nav-header', 180, 17);
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, 180, 15);
    ctx.fillStyle = UI.edge;
    ctx.fillRect(0, 15, 180, 1);
    ctx.fillStyle = UI.dark;
    ctx.fillRect(0, 16, 180, 1);
    tex.refresh();
  }
  // barra de abas: filete claro em cima; as abas são quadradinhos desenhados por cima (nav.ts)
  {
    const { tex, ctx } = canvas(scene, 'nav-tabbar', 180, 30);
    ctx.fillStyle = UI.dark;
    ctx.fillRect(0, 0, 180, 1);
    ctx.fillStyle = UI.edge2;
    ctx.fillRect(0, 1, 180, 1);
    ctx.fillStyle = UI.edge;
    ctx.fillRect(0, 2, 180, 1);
    ctx.fillStyle = bar;
    ctx.fillRect(0, 3, 180, 27);
    tex.refresh();
  }
  panelTex(scene, 'subtab', 24, 14, UI.panel, UI.edge);
  panelTex(scene, 'subtab-on', 24, 14, '#3a2a14', UI.gold);
  panelTex(scene, 'gear-btn', 20, 14, UI.panel2, UI.edge2);
  panelTex(scene, 'gear-btn-on', 20, 14, '#3a2a14', UI.gold);
  // tela inicial: botão principal grande, chip do cerco, chip da heresia e setas
  panelTex(scene, 'btn-gold-l', 150, 24, '#d9a63a', UI.goldLight, '#3a2408');
  panelTex(scene, 'btn-gold-l-down', 150, 24, '#b0822a', UI.gold, '#3a2408');
  panelTex(scene, 'chip', 24, 24, UI.panel2, UI.edge2);
  panelTex(scene, 'chip-down', 24, 24, '#3a2a1c', UI.gold);
  panelTex(scene, 'chip-red', 24, 24, '#2a1214', '#8a2a30');
  panelTex(scene, 'chip-red-on', 24, 24, '#4a1418', '#d04848');
  panelTex(scene, 'arrow-btn', 16, 26, UI.panel2, UI.edge2);
  panelTex(scene, 'arrow-btn-down', 16, 26, '#3a2a1c', UI.gold);
  panelTex(scene, 'card', 24, 24, UI.panel, UI.edge);
  // popup do item (arsenal): moldura dourada, caixas de ganho e perda, botões largos
  panelTex(scene, 'card-gold', 24, 24, '#16110d', UI.gold);
  panelTex(scene, 'box-good', 16, 16, '#14201a', '#3f9a5a');
  panelTex(scene, 'box-bad', 16, 16, '#22120f', '#b0444a');
  panelTex(scene, 'btn-modal-red', 148, 20, '#b0443a', '#d0705a', '#3a0c08');
  panelTex(scene, 'btn-modal-red-down', 148, 20, '#8a3028', '#b0503a', '#3a0c08');
  panelTex(scene, 'btn-modal', 148, 20, UI.panel2, UI.edge2);
  panelTex(scene, 'btn-modal-down', 148, 20, '#3a2a1c', UI.gold);
  panelTex(scene, 'btn-modal-line', 148, 20, '#16110d', UI.edge2);
}

function uiTextures(scene: Phaser.Scene) {
  panelTex(scene, 'btn', 56, 16, UI.panel2, UI.edge2);
  panelTex(scene, 'btn-down', 56, 16, '#3a2a1c', UI.gold);
  panelTex(scene, 'btn-ready', 56, 16, '#1e3a26', '#5fd08a');
  panelTex(scene, 'btn-wide', 120, 18, UI.panel2, UI.edge2);
  panelTex(scene, 'btn-wide-down', 120, 18, '#3a2a1c', UI.gold);
  // botão principal: dourado, texto escuro
  panelTex(scene, 'btn-gold', 120, 20, '#d9a63a', UI.goldLight, '#3a2408');
  panelTex(scene, 'btn-gold-down', 120, 20, '#b0822a', UI.gold, '#3a2408');
  panelTex(scene, 'panel', 168, 40, UI.panel, UI.edge);
  // faixa da escolha de cerco e botão vermelho de fechar
  panelTex(scene, 'sel-row', 168, 22, '#2a1f17', UI.gold);
  panelTex(scene, 'btn-red', 120, 20, '#a8403a', '#d0705a', '#3a0c08');
  panelTex(scene, 'btn-red-down', 120, 20, '#88302a', '#b0503a', '#3a0c08');
  panelTex(scene, 'row', 172, 27, UI.panel, UI.edge);
  panelTex(scene, 'row-flash', 172, 27, '#203a26', '#7fe0a0');
  panelTex(scene, 'tile', 40, 40, UI.panel, UI.edge);
  panelTex(scene, 'small-btn', 30, 14, UI.panel2, UI.edge2);
  panelTex(scene, 'small-btn-down', 30, 14, '#3a2a1c', UI.gold);
  panelTex(scene, 'hud-banner', 26, 12, '#6a1820', UI.gold);
  panelTex(scene, 'btn-half', 86, 18, UI.panel2, UI.edge2);
  panelTex(scene, 'btn-90', 90, 16, UI.panel2, UI.edge2);
  panelTex(scene, 'btn-90-down', 90, 16, '#3a2a1c', UI.gold);
  panelTex(scene, 'btn-gold-90', 90, 16, '#d9a63a', UI.goldLight, '#3a2408');
  panelTex(scene, 'btn-gold-90-down', 90, 16, '#b0822a', UI.gold, '#3a2408');
  panelTex(scene, 'btn-half-down', 86, 18, '#3a2a1c', UI.gold);
  panelTex(scene, 'nav', 20, 20, UI.panel, UI.edge);
  panelTex(scene, 'nav-on', 20, 20, '#3a2a14', UI.gold);
  navTextures(scene);
  panelTex(scene, 'act', 42, 18, UI.panel2, UI.edge2);
  panelTex(scene, 'act-ready', 42, 18, '#1e3a26', '#5fd08a');
  panelTex(scene, 'act-down', 42, 18, '#3a2a1c', UI.gold);
  // cartas: uma moldura por escola e raridade
  const rar = { common: PAL.B, rare: '#6fa8c8', legendary: '#f6cf6a' } as const;
  for (const s of [...Object.keys(SCHOOLS), 'neutral']) {
    const color = s === 'neutral' ? '#c9a23a' : SCHOOLS[s as keyof typeof SCHOOLS].color;
    for (const [r, rc] of Object.entries(rar)) {
      const key = `card-${s}-${r}`;
      const w = 170;
      const h = 50;
      const { tex, ctx } = canvas(scene, key, w, h);
      ctx.fillStyle = PAL.k;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rc;
      ctx.fillRect(1, 1, w - 2, h - 2);
      ctx.fillStyle = UI.panel;
      ctx.fillRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = mix(color, UI.panel, 0.72);
      ctx.fillRect(2, 2, 30, h - 4);
      ctx.fillStyle = mix(color, UI.panel, 0.4);
      ctx.fillRect(32, 2, 1, h - 4);
      for (const [x, y] of [
        [0, 0],
        [w - 1, 0],
        [0, h - 1],
        [w - 1, h - 1],
      ]) ctx.clearRect(x, y, 1, 1);
      tex.refresh();
    }
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 17 níveis de cobertura com dither, para as transições. */
function ditherTextures(scene: Phaser.Scene) {
  for (let lvl = 0; lvl <= 16; lvl++) {
    // padrão 4x4 repetido por TileSprite: quase nenhuma memória
    const { tex, ctx } = canvas(scene, `dither${lvl}`, 4, 4);
    ctx.fillStyle = '#050309';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (BAYER[y * 4 + x] < lvl) ctx.fillRect(x, y, 1, 1);
    tex.refresh();
  }
}

export function generateArt(scene: Phaser.Scene) {
  ditherTextures(scene);
  unitTextures(scene);
  propTextures(scene);
  iconTextures(scene);
  GROUND_STYLES.forEach((st, i) => groundTex(scene, `ground${i}`, st, 1337 + i));
  altarTex(scene);
  lightTex(scene, 'light24', 24);
  lightTex(scene, 'light48', 48);
  lightTex(scene, 'light80', 80);
  glowTex(scene, 'glow16', 16);
  glowTex(scene, 'glow32', 32);
  glowTex(scene, 'glow64', 64);
  hudTex(scene);
  uiTextures(scene);
  menuPieceTextures(scene);
  itemTextures(scene);
  fontTex(scene);
}
