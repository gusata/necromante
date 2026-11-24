import Phaser from 'phaser';
import { SCHOOLS } from '../sim/cards';
import { CHARACTERS } from '../sim/characters';
import { GEMS } from '../sim/gems';
import { ITEMS } from '../sim/items';
import { FIELD, LIVING_KINDS } from '../sim/defs';
import { RNG } from '../sim/rng';
import { BOSS_SPECS, HUMANOIDS, humanoidFrames, mix, undeadColors } from './humanoid';
import { PAL } from './palette';
import * as S from './sprites';

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

export function spriteTex(scene: Phaser.Scene, key: string, rows: string[], colors?: Colors) {
  drawGrid(scene, key, toGrid(rows, colors));
}

/**
 * Amplia 2x e refina: afina o contorno duplo para 1px e adiciona luz/sombra nas bordas.
 * Mantém a densidade de pixel coerente com o resto da arte.
 */
function upscale(rows: string[], colors?: Colors): (string | null)[][] {
  const src = toGrid(rows, colors);
  const h = src.length * 2;
  const w = src[0].length * 2;
  const g: (string | null)[][] = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => src[y >> 1][x >> 1]));
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : g[y][x]);
  // contorno: só fica o pixel que encosta no vazio
  const thin = g.map((row) => [...row]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== OUTLINE) continue;
      const n = [get(x - 1, y), get(x + 1, y), get(x, y - 1), get(x, y + 1)];
      if (n.some((c) => c === null)) continue;
      const fill = n.find((c) => c !== OUTLINE);
      if (fill) thin[y][x] = fill;
    }
  }
  // luz em cima/esquerda, sombra embaixo/direita
  const out = thin.map((row) => [...row]);
  const t = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : thin[y][x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = thin[y][x];
      if (!c || c === OUTLINE) continue;
      const up = t(x, y - 1);
      const down = t(x, y + 1);
      const right = t(x + 1, y);
      if (up === OUTLINE || up === null) out[y][x] = mix(c, '#ffffff', 0.18);
      else if (down === OUTLINE || right === OUTLINE) out[y][x] = mix(c, '#000000', 0.22);
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
  S.SKEL.forEach((f, i) => drawGrid(scene, `giant${i}`, upscale(f)));
  for (const k of ['zombie', 'ghoul', 'thrall', 'lich', 'plaguebearer', 'bloodknight']) frames3(k, humanoidFrames(HUMANOIDS[k]));
  // abominação: um zumbi ampliado, como o colosso
  humanoidFrames(HUMANOIDS.abomination).forEach((f, i) => drawGrid(scene, `abomination${i}`, upscale(f, withPal(HUMANOIDS.abomination.colors))));
  frames3('banshee', S.GHOST, { G: '#f4eefc', g: '#a08cc8', k: '#2a1d3a' });
  frames3('rat', S.RAT, { b: '#5e6151', B: '#3f4237', G: '#c8ff8a' });
  frames3('ghost', S.GHOST, { G: '#bfe9ff', g: '#6fa8c8' });

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
    spriteTex(scene, `${key}0`, base, colors);
    spriteTex(scene, `${key}1`, ['................', ...base.slice(0, 10), ...base.slice(11)], colors);
    spriteTex(scene, `${key}-cast`, cast, colors);
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

export const GROUND_STYLES: GroundStyle[] = [
  { base: '#110e14', a: '#18141c', b: '#211b26', c: '#2e2735', accent: '#141a12', kind: 'dirt' },
  { base: '#121118', a: '#1a1820', b: '#24212c', c: '#302c3a', accent: '#13180f', kind: 'tiles' },
  { base: '#100f13', a: '#1b1a20', b: '#26242c', c: '#35323c', accent: '#2a1214', kind: 'cobble' },
  { base: '#0e0c12', a: '#17131d', b: '#201a27', c: '#2c2434', accent: '#3a0c18', kind: 'marble' },
];

function groundTex(scene: Phaser.Scene, key: string, st: GroundStyle, seed: number) {
  const w = FIELD.w;
  const h = 320;
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
    for (let i = 0; i < 520; i++) {
      ctx.fillStyle = rng.next() < 0.7 ? st.a : st.b;
      const x = rng.int(0, w);
      const y = rng.int(0, h);
      ctx.fillRect(x, y, rng.int(1, 3), rng.int(1, 2));
      if (rng.next() < 0.3) px(ctx, x, y, st.c);
    }
    // tufos de grama morta
    for (let i = 0; i < 70; i++) {
      const x = rng.int(0, w);
      const y = rng.int(0, h);
      if (Math.abs(x - 90) < 22) continue;
      px(ctx, x, y, '#2a3322');
      px(ctx, x - 1, y + 1, '#1d2418');
      px(ctx, x + 1, y + 1, '#1d2418');
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
    for (let i = 0; i < 900; i++) {
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
    for (let i = 0; i < 40; i++) {
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
        px(ctx, x, y, edge ? OUTLINE : trim ? '#8a6a22' : (x + y) % 7 === 0 ? '#4a1020' : st.accent);
      }
    }
  }
  // rachaduras
  for (let i = 0; i < 18; i++) {
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
      const edge = Math.min(x, w - 1 - x, y * 0.7, (FIELD.h - 1 - y) * 2);
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

/** Painel com borda chanfrada. */
export function panelTex(scene: Phaser.Scene, key: string, w: number, h: number, fill: string, light: string, border = PAL.k) {
  const { tex, ctx } = canvas(scene, key, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = light;
  ctx.fillRect(1, 1, w - 2, 1);
  ctx.fillStyle = mix(fill, '#000000', 0.4);
  ctx.fillRect(1, h - 2, w - 2, 1);
  for (const [x, y] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]) ctx.clearRect(x, y, 1, 1);
  tex.refresh();
}

function hudTex(scene: Phaser.Scene) {
  const { tex, ctx } = canvas(scene, 'hudbar', FIELD.w, 24);
  ctx.fillStyle = '#0a0810';
  ctx.fillRect(0, 0, FIELD.w, 24);
  ctx.fillStyle = PAL.P;
  ctx.fillRect(0, 0, FIELD.w, 1);
  ctx.fillStyle = PAL.k;
  ctx.fillRect(0, 1, FIELD.w, 1);
  tex.refresh();

  const top = canvas(scene, 'topbar', FIELD.w, 11);
  for (let y = 0; y < 11; y++) for (let x = 0; x < FIELD.w; x++) if (y < 9 || (x + y) % 2 === 0) px(top.ctx, x, y, '#07050b', y < 9 ? 0.85 : 0.6);
  top.tex.refresh();

  // vinheta vermelha de vida baixa
  const v = canvas(scene, 'vignette', FIELD.w, 320);
  for (let y = 0; y < 320; y++) {
    for (let x = 0; x < FIELD.w; x++) {
      const e = Math.min(x, FIELD.w - 1 - x, y, 319 - y);
      if (e < 4 || (e < 10 && (x + y) % 2 === 0) || (e < 18 && (x + y) % 4 === 0)) px(v.ctx, x, y, '#ffffff');
    }
  }
  v.tex.refresh();
}

function fontTex(scene: Phaser.Scene) {
  const chars = S.FONT_CHARS;
  const { tex, ctx } = canvas(scene, 'font', chars.length * 4, 6);
  [...chars].forEach((ch, i) => {
    const g = S.FONT[ch];
    if (!g) return;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y][x] === '#') px(ctx, i * 4 + x + 1, y + 1, '#000000');
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y][x] === '#') px(ctx, i * 4 + x, y, '#ffffff');
  });
  tex.refresh();
  scene.cache.bitmapFont.add(
    'px',
    Phaser.GameObjects.RetroFont.Parse(scene, {
      image: 'font',
      width: 4,
      height: 6,
      chars,
      charsPerRow: chars.length,
      'spacing.x': 0,
      'spacing.y': 0,
      'offset.x': 0,
      'offset.y': 0,
      lineSpacing: 2,
    }),
  );
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
  const rar = { common: '#6b6452', magic: '#6fa8c8', rare: '#e0b040', legendary: '#ff7a3a', set: '#4ee08a' } as const;
  for (const [r, col] of Object.entries(rar)) panelTex(scene, `slot-${r}`, 24, 24, '#0e0b14', mix(col, '#0e0b14', 0.3), col);
  panelTex(scene, 'slot-empty', 24, 24, '#0a0810', '#1a1424', '#2a2036');
  panelTex(scene, 'tab', 56, 14, PAL.d, PAL.P);
  panelTex(scene, 'tab-on', 56, 14, '#132a1e', PAL.g, PAL.g);
  panelTex(scene, 'item-card', 170, 44, '#0e0b14', '#2a2036');
}

function uiTextures(scene: Phaser.Scene) {
  panelTex(scene, 'btn', 56, 16, PAL.d, PAL.P);
  panelTex(scene, 'btn-down', 56, 16, PAL.p, PAL.g);
  panelTex(scene, 'btn-ready', 56, 16, '#132a1e', PAL.g);
  panelTex(scene, 'btn-wide', 120, 18, PAL.d, PAL.P);
  panelTex(scene, 'btn-wide-down', 120, 18, PAL.p, PAL.g);
  panelTex(scene, 'panel', 168, 40, '#0e0b14', PAL.P);
  panelTex(scene, 'row', 172, 27, '#0e0b14', '#2a2036');
  panelTex(scene, 'row-flash', 172, 27, '#1f3a2a', PAL.G);
  panelTex(scene, 'tile', 40, 40, '#0e0b14', '#2a2036');
  panelTex(scene, 'small-btn', 30, 14, PAL.d, PAL.P);
  panelTex(scene, 'small-btn-down', 30, 14, PAL.p, PAL.g);
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
      ctx.fillStyle = '#100c16';
      ctx.fillRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = mix(color, '#100c16', 0.75);
      ctx.fillRect(2, 2, 30, h - 4);
      ctx.fillStyle = mix(color, '#100c16', 0.4);
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
  itemTextures(scene);
  fontTex(scene);
}
