import type Phaser from 'phaser';
import { TINY5 } from './fontData';

/**
 * Prepara o texto para a fonte: troca letras que ela não tem pela versão sem acento
 * e começa o texto com maiúscula (os textos do jogo são escritos em minúsculas).
 * Listas em várias linhas usam `cap` em cada item.
 */
export const clean = (s: string) =>
  [...s]
    .map((ch) => (ch in TINY5 ? ch : ch.normalize('NFD').replace(/\p{Diacritic}/gu, '')))
    .join('')
    .replace(/^\p{Ll}/u, (c) => c.toUpperCase());

/** Primeira letra maiúscula (para cada item de uma lista em várias linhas). */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Cabeçalho, como no King Dies Rich: a mesma fonte fina, só que em maiúsculas e com as letras
 * espaçadas. Título não fica maior nem mais grosso: a hierarquia vem da cor e do espaçamento.
 */
export const HEAD_SPACING = 2;
const upper = (s: string) => clean(s.toUpperCase());

/**
 * Texto do jogo. Uma fonte só (Tiny5, traço de 1 px, 5 px de altura), nunca ampliada.
 * `head` = estilo de cabeçalho (maiúsculas espaçadas). `flat` = sem sombra (texto escuro em botão claro).
 */
export function pxText(scene: Phaser.Scene, x: number, y: number, text: string, tint = 0xffffff, flat = false, head = false) {
  const t = scene.add.bitmapText(x, y, flat ? 'px-flat' : 'px', head ? upper(text) : clean(text)).setTint(tint);
  if (head) t.setLetterSpacing(HEAD_SPACING).setData('head', true);
  return t;
}

/** Número com contorno preto em volta, para ficar por cima de ícones (quantidades, níveis). */
export function pxCount(scene: Phaser.Scene, x: number, y: number, text: string, tint = 0xffffff) {
  return scene.add.bitmapText(x, y, 'px-out', clean(text)).setTint(tint);
}

/** Largura do texto em pixels (a linha mais larga), sem a sombra. */
export function pxWidth(text: string, head = false) {
  const g = TINY5;
  return Math.max(
    ...(head ? upper(text) : clean(text))
      .split('\n')
      .map((ln) => [...ln].reduce((s, ch) => s + (ch === ' ' ? g[' '][0] + 1 : (g[ch]?.[0] ?? 4)), 0) - 1 + (head ? HEAD_SPACING * Math.max(0, [...ln].length - 1) : 0)),
  );
}

export function setPxText(t: Phaser.GameObjects.BitmapText, text: string) {
  const c = t.getData('head') ? upper(text) : clean(text);
  if (t.text !== c) t.setText(c);
}
