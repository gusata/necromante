/**
 * Paleta única do jogo. Cada letra é usada nos mapas de pixels de sprites.ts.
 * Tons frios e escuros; o verde-alma é a única cor "viva" do necromante.
 */
export const PAL: Record<string, string> = {
  k: '#07050b', // contorno
  d: '#17111f', // sombra de capuz
  p: '#2e1d3b', // manto
  P: '#4c2f61', // manto, luz
  g: '#38b46a', // alma
  G: '#aef5bf', // alma brilhante
  b: '#a49c86', // osso, sombra
  B: '#6b6452', // osso, sombra funda
  w: '#e3dccb', // osso
  n: '#3d2a20', // roupa camponesa
  N: '#634532', // roupa camponesa, luz
  f: '#a97a5e', // pele
  F: '#7a5240', // pele, sombra
  m: '#8a94a6', // metal
  M: '#464e5e', // metal, sombra
  r: '#5a0f1d', // sangue escuro
  R: '#9e2236', // sangue
  y: '#c9a23a', // ouro
  c: '#bdb7c9', // túnica sagrada
  C: '#7f7990', // túnica, sombra
  o: '#d0662a', // chama
  O: '#f6cf6a', // chama, núcleo
  x: '#110e16', // chão
  X: '#18141f', // chão, pedra
  z: '#221d2a', // pedra
  Z: '#302939', // pedra, luz
  q: '#0c0a11', // musgo morto
  // interface (tema quente: marrom e ouro)
  u: '#f2e3c6', // texto principal, creme
  v: '#a89078', // texto secundário
  U: '#f0c050', // ouro claro (títulos, preços)
};

/** Cores da interface: painéis marrom-escuros com moldura dourada. */
export const UI = {
  bg: '#14100c',
  panel: '#1f1712',
  panel2: '#2a1f17',
  edge: '#4a3524',
  edge2: '#6a4c32',
  dark: '#0b0806',
  gold: '#e0b040',
  goldLight: '#ffe08a',
  goldDark: '#8a5a18',
  green: '#3fb070',
} as const;

export const hex = (c: string) => parseInt(c.slice(1), 16);

/** Cores como número, para tint/Graphics do Phaser. */
export const COL = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hex(v)])) as Record<string, number>;
