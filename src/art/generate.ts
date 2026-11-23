import Phaser from 'phaser';
import { RNG } from '../sim/rng';
import { FIELD } from '../sim/defs';
import { PAL } from './palette';
import * as S from './sprites';

type Ctx = CanvasRenderingContext2D;

function canvas(scene: Phaser.Scene, key: string, w: number, h: number): { tex: Phaser.Textures.CanvasTexture; ctx: Ctx } {
  const tex = scene.textures.createCanvas(key, w, h)!;
  return { tex, ctx: tex.getContext() };
}

function px(ctx: Ctx, x: number, y: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
  ctx.globalAlpha = 1;
}

function drawRows(ctx: Ctx, rows: string[], ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c !== '.' && PAL[c]) px(ctx, ox + x, oy + y, PAL[c]);
    }
  });
}

/** Cria uma textura a partir de um mapa de pixels. */
export function spriteTex(scene: Phaser.Scene, key: string, rows: string[]) {
  const w = Math.max(...rows.map((r) => r.length));
  const { tex, ctx } = canvas(scene, key, w, rows.length);
  drawRows(ctx, rows);
  tex.refresh();
}

/** Chão de cemitério: pedras, rachaduras, musgo morto e vinheta pontilhada. */
function groundTex(scene: Phaser.Scene) {
  const { w, h } = { w: FIELD.w, h: 320 };
  const { tex, ctx } = canvas(scene, 'ground', w, h);
  const rng = new RNG(1337);
  ctx.fillStyle = PAL.x;
  ctx.fillRect(0, 0, w, h);

  // trilha de terra até o altar
  for (let y = 0; y < h; y++) {
    const half = 14 + Math.sin(y * 0.05) * 4 + (y / h) * 10;
    const cx = 90 + Math.sin(y * 0.021) * 6;
    for (let x = Math.floor(cx - half); x < cx + half; x++) {
      if (rng.next() < 0.55) px(ctx, x, y, PAL.X);
    }
  }
  // pedras
  for (let i = 0; i < 520; i++) {
    const x = rng.int(0, w);
    const y = rng.int(0, h);
    const sw = rng.int(1, 3);
    const sh = rng.int(1, 2);
    ctx.fillStyle = rng.next() < 0.7 ? PAL.X : PAL.z;
    ctx.fillRect(x, y, sw, sh);
    if (rng.next() < 0.3) px(ctx, x, y, PAL.Z);
  }
  // musgo morto
  for (let i = 0; i < 260; i++) px(ctx, rng.int(0, w), rng.int(0, h), PAL.q);
  // rachaduras
  for (let i = 0; i < 22; i++) {
    let x = rng.int(0, w);
    let y = rng.int(0, h);
    const len = rng.int(5, 14);
    for (let j = 0; j < len; j++) {
      px(ctx, x, y, PAL.k);
      x += rng.int(-1, 1);
      y += 1;
    }
  }
  // vinheta pontilhada nas bordas
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, w - 1 - x, y * 0.7, (FIELD.h - 1 - y) * 2);
      if (edge < 16 && (x + y) % 2 === 0 && rng.next() > edge / 16) px(ctx, x, y, PAL.k);
    }
  }
  tex.refresh();
}

/** Círculo ritual sob o necromante. */
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

/** Luz em degraus pontilhados: apaga a escuridão (alpha = força da luz). */
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

/** Brilho aditivo (usar com tint + BlendModes.ADD). */
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

function panelTex(scene: Phaser.Scene, key: string, w: number, h: number, fill: string, light: string) {
  const { tex, ctx } = canvas(scene, key, w, h);
  ctx.fillStyle = PAL.k;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = light;
  ctx.fillRect(1, 1, w - 2, 1);
  ctx.fillStyle = PAL.k;
  ctx.fillRect(1, h - 2, w - 2, 1);
  // cantos chanfrados
  ctx.clearRect(0, 0, 1, 1);
  ctx.clearRect(w - 1, 0, 1, 1);
  ctx.clearRect(0, h - 1, 1, 1);
  ctx.clearRect(w - 1, h - 1, 1, 1);
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
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < FIELD.w; x++) {
      if (y < 9 || (x + y) % 2 === 0) px(top.ctx, x, y, '#07050b', y < 9 ? 0.85 : 0.6);
    }
  }
  top.tex.refresh();
}

/** Fonte bitmap 3x5 com sombra (célula 4x6). */
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

export function generateArt(scene: Phaser.Scene) {
  spriteTex(scene, 'necro', S.NECRO);
  S.SKEL.forEach((f, i) => spriteTex(scene, `skel${i}`, f));
  S.PEASANT.forEach((f, i) => spriteTex(scene, `peasant${i}`, f));
  S.SOLDIER.forEach((f, i) => spriteTex(scene, `soldier${i}`, f));
  S.PRIEST.forEach((f, i) => spriteTex(scene, `priest${i}`, f));
  S.CANDLE.forEach((f, i) => spriteTex(scene, `candle${i}`, f));
  spriteTex(scene, 'corpse', S.CORPSE);
  spriteTex(scene, 'splat', S.SPLAT);
  spriteTex(scene, 'tomb', S.TOMB);
  spriteTex(scene, 'icon-soul', S.SOUL_ICON);
  spriteTex(scene, 'icon-skull', S.SKULL_ICON);
  spriteTex(scene, 'icon-heart', S.HEART_ICON);
  spriteTex(scene, 'shadow', ['.kkkkkk.', 'kkkkkkkk', '.kkkkkk.']);
  spriteTex(scene, 'px', ['w']);

  groundTex(scene);
  altarTex(scene);
  lightTex(scene, 'light24', 24);
  lightTex(scene, 'light48', 48);
  lightTex(scene, 'light80', 80);
  glowTex(scene, 'glow16', 16);
  glowTex(scene, 'glow32', 32);
  panelTex(scene, 'btn', 56, 16, PAL.d, PAL.P);
  panelTex(scene, 'btn-down', 56, 16, PAL.p, PAL.g);
  hudTex(scene);
  fontTex(scene);

  const anim = (key: string, frames: string[], frameRate: number) =>
    scene.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate, repeat: -1 });
  for (const k of ['skel', 'peasant', 'soldier', 'priest']) anim(`${k}-walk`, [`${k}0`, `${k}1`], 6);
  anim('candle-burn', ['candle0', 'candle1'], 5);
}
