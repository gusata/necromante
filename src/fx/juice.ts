import type Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COL } from '../art/palette';
import { pxText, pxWidth } from '../art/text';
import { meta } from '../platform/save';
import { baseScrollY, VIEW_H, VIEW_W } from './view';

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
  transition: 9000,
} as const;

/**
 * Tremor de tela por "trauma": cada impacto soma trauma, que decai sozinho.
 * O deslocamento é trauma² (tremores fortes são raros e marcantes) e sempre inteiro
 * para não borrar o pixel art.
 */
export class Shaker {
  private trauma = 0;
  private kickX = 0;
  private kickY = 0;
  private t = 0;

  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {}

  add(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount * meta.settings.shake);
  }

  /** Empurrão direcional (ex.: na direção de uma explosão). */
  kick(dx: number, dy: number) {
    this.kickX += dx * meta.settings.shake;
    this.kickY += dy * meta.settings.shake;
  }

  update(dt: number) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.kickX *= 0.0005 ** dt;
    this.kickY *= 0.0005 ** dt;
    const s = this.trauma * this.trauma;
    const max = 6;
    const ox = max * s * Math.sin(this.t * 61.3) * Math.cos(this.t * 17.1) + this.kickX;
    const oy = max * s * Math.sin(this.t * 53.7 + 1.3) * Math.cos(this.t * 23.9) + this.kickY;
    this.cam.setScroll(Math.round(ox), Math.round(oy) + baseScrollY(this.cam.scene.scene.key));
  }
}

/** Flash de tela inteira. */
export function flash(scene: Phaser.Scene, color: number, alpha = 0.6, duration = 120) {
  const r = scene.add.rectangle(0, 0, VIEW_W, VIEW_H, color, alpha).setOrigin(0).setDepth(DEPTH.modal - 1).setScrollFactor(0);
  scene.tweens.add({ targets: r, alpha: 0, duration, onComplete: () => r.destroy() });
}

let floating = 0;
/** teto de números flutuantes ao mesmo tempo (os grandes sempre passam) */
/** números flutuantes ao mesmo tempo (mais que isso vira poluição na horda) */
const MAX_FLOATING = 10;

/** Número/texto flutuante que sobe e some. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: number, big = false) {
  if (!big && floating >= MAX_FLOATING) return;
  floating++;
  // grande = cabeçalho (maiúsculas espaçadas), nunca ampliado
  const t = pxText(scene, Math.round(x), Math.round(y), text, color, false, big)
    .setOrigin(0.5)
    .setDepth(DEPTH.overlay + 1);
  scene.tweens.add({ targets: t, y: y - (big ? 16 : 10), duration: 500, ease: 'Cubic.easeOut' });
  scene.tweens.add({
    targets: t,
    alpha: 0,
    delay: 350,
    duration: 250,
    onComplete: () => {
      floating--;
      t.destroy();
    },
  });
  t.once('destroy', () => {
    if (t.alpha > 0) floating = Math.max(0, floating - 1);
  });
}

// ------------------------------------------------------------ transição com dither

/** Cobertura com dither Bayer 4x4: texturas `dither0..16` geradas no Boot. */
function cover(scene: Phaser.Scene, depth: number) {
  return scene.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'dither16').setOrigin(0).setDepth(depth).setScrollFactor(0);
}
const level = (p: number) => `dither${Math.max(0, Math.min(16, Math.round(p * 16)))}`;

/** Fecha a tela com dither e troca de cena. */
export function transitionTo(scene: Phaser.Scene, key: string, data?: object) {
  const s = scene as unknown as { _leaving?: boolean };
  if (s._leaving) return;
  s._leaving = true;
  const img = cover(scene, DEPTH.transition).setTexture('dither0');
  const state = { p: 0 };
  scene.tweens.add({
    targets: state,
    p: 1,
    duration: 260,
    onUpdate: () => img.setTexture(level(state.p)),
    onComplete: () => scene.scene.start(key, data),
  });
}

/** Abre a tela com dither (chamar no create). */
export function transitionIn(scene: Phaser.Scene) {
  (scene as unknown as { _leaving?: boolean })._leaving = false;
  const img = cover(scene, DEPTH.transition);
  const state = { p: 1 };
  scene.tweens.add({
    targets: state,
    p: 0,
    duration: 320,
    onUpdate: () => img.setTexture(level(state.p)),
    onComplete: () => img.destroy(),
  });
}

/** Cortina com dither no meio da cena (troca de região): fecha, chama `mid`, abre. */
export function curtain(scene: Phaser.Scene, mid: () => void) {
  const img = cover(scene, DEPTH.modal - 2).setTexture('dither0');
  const state = { p: 0 };
  scene.tweens.add({
    targets: state,
    p: 1,
    duration: 300,
    onUpdate: () => img.setTexture(level(state.p)),
    onComplete: () => {
      mid();
      scene.tweens.add({ targets: state, p: 0, delay: 200, duration: 420, onUpdate: () => img.setTexture(level(state.p)), onComplete: () => img.destroy() });
    },
  });
}

// ------------------------------------------------------------ estilhaçar sprite

/** Explode um sprite em partículas, uma por pixel. */
export function shatter(scene: Phaser.Scene, textureKey: string, x: number, y: number, opts: { scale?: number; power?: number; flipX?: boolean; depth?: number } = {}) {
  const tex = scene.textures.get(textureKey);
  const src = tex.getSourceImage() as HTMLCanvasElement;
  if (!src.getContext) return;
  const ctx = src.getContext('2d')!;
  const w = src.width;
  const h = src.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const scale = opts.scale ?? 1;
  const power = opts.power ?? 60;
  for (let py = 0; py < h; py++) {
    for (let pxl = 0; pxl < w; pxl++) {
      const i = (py * w + pxl) * 4;
      if (data[i + 3] < 128) continue;
      if ((pxl + py) % 2 && w * h > 300) continue; // menos partículas em sprites grandes
      const color = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      const lx = opts.flipX ? w - 1 - pxl : pxl;
      const p = scene.add
        .rectangle(Math.round(x + (lx - w / 2) * scale), Math.round(y + (py - h) * scale), scale, scale, color)
        .setOrigin(0)
        .setDepth(opts.depth ?? DEPTH.fx);
      const ang = Math.atan2(py - h / 2, lx - w / 2) + (Math.random() - 0.5) * 0.8;
      const sp = power * (0.4 + Math.random() * 0.8);
      scene.tweens.add({
        targets: p,
        x: p.x + Math.cos(ang) * sp,
        y: p.y + Math.sin(ang) * sp + 30 + Math.random() * 30,
        alpha: 0,
        duration: 500 + Math.random() * 500,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }
}

// ------------------------------------------------------------ botão

export interface UIButton {
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  setEnabled: (on: boolean) => void;
  destroy: () => void;
}

/** Botão de pixel com afundar, som e vibração. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  onPress: () => void,
  opts: { tex?: string; down?: string; color?: number; depth?: number } = {},
): UIButton {
  const tex = opts.tex ?? 'btn-wide';
  const down = opts.down ?? 'btn-wide-down';
  const depth = opts.depth ?? DEPTH.hud;
  const img = scene.add.image(x, y, tex).setDepth(depth).setInteractive({ useHandCursor: true });
  // botão dourado: texto escuro sem sombra, para ler bem no fundo claro
  const gold = tex.startsWith('btn-gold');
  // espaçamento largo nos rótulos (docs/ARTE.md) quando cabe na largura do botão
  const wide = pxWidth(text, true) <= img.width - 8;
  const label = pxText(scene, x, y - 2, text, gold ? 0x3a1c04 : (opts.color ?? COL.u), gold, wide).setOrigin(0.5, 0).setDepth(depth + 1);
  let enabled = true;
  img.on('pointerdown', () => {
    if (!enabled) {
      audio.play('deny');
      return;
    }
    img.setTexture(down);
    label.y = y - 1;
    audio.play('click');
  });
  const release = (fire: boolean) => {
    img.setTexture(tex);
    label.y = y - 2;
    if (fire && enabled) onPress();
  };
  img.on('pointerup', () => release(true));
  img.on('pointerout', () => release(false));
  return {
    img,
    label,
    setEnabled: (on) => {
      enabled = on;
      img.setAlpha(on ? 1 : 0.45);
      label.setAlpha(on ? 1 : 0.5);
    },
    destroy: () => {
      img.destroy();
      label.destroy();
    },
  };
}
