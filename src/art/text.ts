import type Phaser from 'phaser';

/** Fonte só tem maiúsculas sem acento: normaliza qualquer texto. */
export const clean = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

export function pxText(scene: Phaser.Scene, x: number, y: number, text: string, tint = 0xffffff, flat = false) {
  return scene.add.bitmapText(x, y, flat ? 'px-flat' : 'px', clean(text)).setTint(tint);
}

export function setPxText(t: Phaser.GameObjects.BitmapText, text: string) {
  const c = clean(text);
  if (t.text !== c) t.setText(c);
}
