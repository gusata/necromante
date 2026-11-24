/**
 * Gerador de humanoides em pixel art (16x22) por camadas: cabeça, corpo, pernas, arma, escudo.
 * Letras de cor nos moldes:
 *   k contorno · H/h chapéu/cabelo · A/a corpo · f/F pele · e olhos · L pernas
 *   o resto vem da paleta global (m, M, N, y, O, o, c...)
 */

export type Head = 'hair' | 'bald' | 'cap' | 'helmet' | 'greathelm' | 'hood' | 'mitre' | 'brim';
export type Body = 'tunic' | 'armor' | 'robe';
export type Weapon =
  | 'torch'
  | 'pitchfork'
  | 'sword'
  | 'spear'
  | 'bow'
  | 'crossbow'
  | 'staffcross'
  | 'bell'
  | 'axe'
  | 'flail'
  | 'lantern'
  | 'halberd'
  | 'mace'
  | 'none';

export interface HumanoidSpec {
  head: Head;
  body: Body;
  weapon: Weapon;
  shield?: boolean;
  book?: boolean;
  cross?: boolean;
  colors: Record<string, string>;
}

const W = 16;
const H = 22;
type Layer = Record<number, string>;

// 16x22: cabeça nas linhas 0-8 (olhos na 5), tronco 9-16, pernas 17-21
const HEADS: Record<Head, Layer> = {
  hair: {
    1: '.....kkkkkk.....',
    2: '....kHHHHHHk....',
    3: '...kHHHHHHHHk...',
    4: '...kHhffffhHk...',
    5: '...kHeffffeHk...',
    6: '...kffffffffk...',
    7: '....kffFFffk....',
    8: '.....kFFFFk.....',
  },
  bald: {
    1: '.....kkkkkk.....',
    2: '....kffffffk....',
    3: '...kffffffffk...',
    4: '...kffffffffk...',
    5: '...kfeffffefk...',
    6: '...kffffffffk...',
    7: '....kffFFffk....',
    8: '.....kFFFFk.....',
  },
  cap: {
    0: '......kkkk......',
    1: '.....kHHHHk.....',
    2: '....kHHHHHHk....',
    3: '...khhhhhhhhk...',
    4: '...kffffffffk...',
    5: '...kfeffffefk...',
    6: '...kffffffffk...',
    7: '....kffFFffk....',
    8: '.....kFFFFk.....',
  },
  helmet: {
    0: '......kkkk......',
    1: '.....kHHHHk.....',
    2: '....kHHHHHHk....',
    3: '...kHHHHHHHHk...',
    4: '...khhhhhhhhk...',
    5: '...kfeffffefk...',
    6: '...kffffffffk...',
    7: '....kffFFffk....',
    8: '.....kFFFFk.....',
  },
  greathelm: {
    1: '....kkkkkkkk....',
    2: '...kHHHHHHHHk...',
    3: '...kHHHHHHHHk...',
    4: '...kkkkkkkkkk...',
    5: '...kHekkkkeHk...',
    6: '...kHHHhhHHHk...',
    7: '...kHhhyyhhHk...',
    8: '....kkkkkkkk....',
  },
  hood: {
    1: '.....kkkkkk.....',
    2: '....kHHHHHHk....',
    3: '...kHHhhhhHHk...',
    4: '...kHhffffhHk...',
    5: '...kHfeffefHk...',
    6: '...kHffffffHk...',
    7: '...kHhFFFFhHk...',
    8: '...khkkkkkkhk...',
  },
  mitre: {
    0: '......kHHk......',
    1: '.....kHyyHk.....',
    2: '....kHHyyHHk....',
    3: '...kkHHHHHHkk...',
    4: '...kffffffffk...',
    5: '...kfeffffefk...',
    6: '...kffffffffk...',
    7: '....kffFFffk....',
    8: '.....kFFFFk.....',
  },
  brim: {
    1: '.....kkkkkk.....',
    2: '....kHHHHHHk....',
    3: '....kHhhhhHk....',
    4: '.kkkhhhhhhhhkkk.',
    5: '.kHHHHHHHHHHHHk.',
    6: '...kfeffffefk...',
    7: '....kffFFffk....',
    8: '.....kFFFFk.....',
  },
};

const BODIES: Record<Body, Layer> = {
  tunic: {
    9: '.....kAAAAk.....',
    10: '...kkAAAAAAkk...',
    11: '..kAAAAAAAAAAk..',
    12: '..kAkAAAAAAkAk..',
    13: '..kAkAAAAAAkAk..',
    14: '..kfkaAAAAakfk..',
    15: '....kaaaaaak....',
    16: '....kaakkaak....',
  },
  armor: {
    9: '.....kAAAAk.....',
    10: '...kkAaAAaAkk...',
    11: '..kAAAAaaAAAAk..',
    12: '..kAkAAAAAAkAk..',
    13: '..kAkaAAAAakAk..',
    14: '..kfkAAAAAAkfk..',
    15: '....kaAkkAak....',
    16: '....kaakkaak....',
  },
  robe: {
    9: '.....kAAAAk.....',
    10: '...kkAAAAAAkk...',
    11: '..kAAAAaAAAAAk..',
    12: '..kAkAAaAAAkAk..',
    13: '..kAkAAaAAAkAk..',
    14: '..kfkAAaAAAkfk..',
    15: '...kAAAaAAAAk...',
    16: '...kAAAaAAAAk...',
  },
};

const LEGS: [Layer, Layer] = [
  { 17: '....kLLkkLLk....', 18: '....kLLkkLLk....', 19: '...kLLk..kLLk...', 20: '...kLLk..kLLk...', 21: '...kkkk..kkkk...' },
  { 17: '.....kLLLLk.....', 18: '.....kLLLLk.....', 19: '.....kLkkLk.....', 20: '.....kLkkLk.....', 21: '.....kkkkkk.....' },
];
const ROBE_HEM: [Layer, Layer] = [
  { 17: '...kAAAaAAAAk...', 18: '..kAAAAaAAAAAk..', 19: '..kAAAAaAAAAAk..', 20: '..kaaaaaaaaaak..', 21: '..kkkkkkkkkkkk..' },
  { 17: '...kAAAaAAAAk...', 18: '...kAAAaAAAAk...', 19: '..kAAAAaAAAAk...', 20: '..kaaaaaaaaak...', 21: '..kkkkkkkkkkk...' },
];

const col = (n: number) => '.'.repeat(n);
const at = (c: number, s: string) => (col(c) + s).padEnd(W, '.');
const handle = (from: number, to: number, c = 13, ch = 'N'): Layer => {
  const l: Layer = {};
  for (let r = from; r <= to; r++) l[r] = at(c, ch);
  return l;
};

// armas na mão direita (coluna 13, mão na linha 14)
const WEAPONS: Record<Weapon, Layer> = {
  none: {},
  torch: { 6: at(13, 'O'), 7: at(12, 'oOo'), 8: at(13, 'o'), ...handle(9, 14) },
  pitchfork: { 1: at(12, 'm.m'), 2: at(12, 'm.m'), 3: at(12, 'mmm'), ...handle(4, 20) },
  sword: { 5: at(13, 'w'), 6: at(13, 'm'), 7: at(13, 'm'), 8: at(13, 'm'), 9: at(13, 'm'), 10: at(13, 'm'), 11: at(13, 'm'), 12: at(12, 'yMy'), 13: at(13, 'N') },
  spear: { 0: at(13, 'w'), 1: at(13, 'm'), ...handle(2, 21) },
  bow: { 7: at(13, 'Nk'), 16: at(13, 'Nk'), ...handle(8, 15, 14) },
  crossbow: { 13: at(10, 'MMMMm'), 14: at(12, 'NN') },
  staffcross: { 1: at(13, 'y'), 2: at(12, 'yyy'), 3: at(13, 'y'), ...handle(4, 21) },
  bell: { 14: at(13, 'y'), 15: at(12, 'yyy'), 16: at(12, 'yyy'), 17: at(12, 'kOk') },
  axe: { 5: at(11, 'kmN'), 6: at(11, 'mmN'), 7: at(11, 'mmN'), 8: at(11, 'kmN'), ...handle(9, 15) },
  flail: { 6: at(13, 'kM'), 7: at(13, 'MM'), 8: at(13, 'k'), 9: at(13, 'k'), ...handle(10, 14) },
  lantern: { 14: at(13, 'k'), 15: at(12, 'kOk'), 16: at(12, 'kok'), 17: at(12, 'kkk') },
  halberd: { 0: at(13, 'w'), 1: at(12, 'mmm'), 2: at(12, 'mmm'), 3: at(13, 'mm'), ...handle(4, 21) },
  mace: { 8: at(13, 'M'), 9: at(12, 'MMM'), 10: at(12, 'MMM'), 11: at(13, 'M'), ...handle(12, 14) },
};

const SHIELD: Layer = { 11: '.kkk', 12: 'kmymk', 13: 'kmmmk', 14: 'kmmmk', 15: '.kmk' };
const BOOK: Layer = { 13: 'kkk', 14: 'kyk', 15: 'kkk' };
const CROSS: Layer = { 11: at(7, 'y'), 12: at(6, 'yyy'), 13: at(7, 'y') };

function blank(): string[][] {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
}

function stamp(grid: string[][], layer: Layer, dx = 0, dy = 0) {
  for (const [r, row] of Object.entries(layer)) {
    const y = Number(r) + dy;
    if (y < 0 || y >= H) continue;
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      const gx = x + dx;
      if (c !== '.' && gx >= 0 && gx < W) grid[y][gx] = c;
    }
  }
}

/** Devolve [andar0, andar1, ataque] como linhas de caracteres. */
export function humanoidFrames(spec: HumanoidSpec): string[][] {
  const frames: string[][] = [];
  for (let f = 0; f < 3; f++) {
    const g = blank();
    const legFrame = f === 1 ? 1 : 0;
    stamp(g, HEADS[spec.head]);
    stamp(g, BODIES[spec.body]);
    stamp(g, spec.body === 'robe' ? ROBE_HEM[legFrame] : LEGS[legFrame]);
    if (spec.cross) stamp(g, CROSS);
    if (spec.shield) stamp(g, SHIELD, f === 2 ? 1 : 0);
    if (spec.book) stamp(g, BOOK);
    // ataque: arma avança e desce um pixel
    stamp(g, WEAPONS[spec.weapon], f === 2 ? 1 : 0, f === 2 ? 1 : 0);
    frames.push(g.map((r) => r.join('')));
  }
  return frames;
}

// ------------------------------------------------------------ cores

const SKIN = { f: '#a97a5e', F: '#7a5240', e: '#07050b' };
const PALE = { f: '#c4a68f', F: '#8e7466', e: '#07050b' };
const ZOMBIE = { f: '#7d9466', F: '#56684a', e: '#c8ff8a' };
const GHOUL = { f: '#8d8f84', F: '#5d5f55', e: '#e0304a' };
const VAMP = { f: '#c7b8c0', F: '#8f7f88', e: '#ff4a5e' };

export const HUMANOIDS: Record<string, HumanoidSpec> = {
  // ---- vivos: Vila
  peasant: { head: 'cap', body: 'tunic', weapon: 'pitchfork', colors: { ...SKIN, H: '#6e5a3a', h: '#4d3f29', A: '#634532', a: '#3d2a20', L: '#3d2a20' } },
  torch: { head: 'hood', body: 'tunic', weapon: 'torch', colors: { ...SKIN, H: '#3b3346', h: '#28222f', A: '#4a3b2a', a: '#2e2419', L: '#2e2419' } },
  militia: { head: 'helmet', body: 'tunic', weapon: 'spear', colors: { ...SKIN, H: '#7c8796', h: '#4a5260', A: '#5c6b3a', a: '#3a4425', L: '#3d2a20' } },
  hunter: { head: 'hood', body: 'tunic', weapon: 'bow', colors: { ...SKIN, H: '#3f5a33', h: '#2a3d22', A: '#4f6b3d', a: '#334527', L: '#3d2a20' } },
  // ---- Mosteiro
  monk: { head: 'bald', body: 'robe', weapon: 'none', colors: { ...SKIN, A: '#6b4a2e', a: '#4a321e' } },
  priest: { head: 'hood', body: 'robe', weapon: 'staffcross', cross: true, colors: { ...PALE, H: '#bdb7c9', h: '#8d879a', A: '#bdb7c9', a: '#7f7990' } },
  nun: { head: 'hood', body: 'robe', weapon: 'lantern', colors: { ...PALE, H: '#1c1824', h: '#e3dccb', A: '#1c1824', a: '#2e2838' } },
  ringer: { head: 'hair', body: 'robe', weapon: 'bell', colors: { ...SKIN, H: '#4a3326', A: '#5a4a6b', a: '#3e3249' } },
  flagellant: { head: 'bald', body: 'tunic', weapon: 'flail', colors: { ...PALE, A: '#d8cfc0', a: '#9e2236', L: '#5a0f1d' } },
  // ---- Fortaleza
  soldier: { head: 'helmet', body: 'armor', weapon: 'sword', colors: { ...SKIN, H: '#8a94a6', h: '#4b5361', A: '#8a94a6', a: '#4b5361', L: '#4b5361' } },
  crossbow: { head: 'cap', body: 'tunic', weapon: 'crossbow', colors: { ...SKIN, H: '#7a1c24', h: '#4d1117', A: '#7a1c24', a: '#4d1117', L: '#3d2a20' } },
  shield: { head: 'helmet', body: 'armor', weapon: 'mace', shield: true, colors: { ...SKIN, H: '#6e7787', h: '#434a57', A: '#6e7787', a: '#434a57', L: '#434a57' } },
  knight: { head: 'greathelm', body: 'armor', weapon: 'sword', shield: true, colors: { ...SKIN, H: '#a9b3c4', h: '#6e7787', A: '#a9b3c4', a: '#6e7787', L: '#6e7787', e: '#07050b' } },
  halberd: { head: 'helmet', body: 'armor', weapon: 'halberd', colors: { ...SKIN, H: '#8a94a6', h: '#4b5361', A: '#7a1c24', a: '#4d1117', L: '#4b5361' } },
  // ---- Catedral
  paladin: { head: 'greathelm', body: 'armor', weapon: 'mace', cross: true, colors: { ...SKIN, H: '#d9c27a', h: '#a08a45', A: '#e3dccb', a: '#a49c86', L: '#a08a45', e: '#f6cf6a' } },
  inquisitor: { head: 'brim', body: 'robe', weapon: 'none', book: true, colors: { ...PALE, H: '#2a1d1d', h: '#7a1c24', A: '#2a1d1d', a: '#7a1c24' } },
  witchhunter: { head: 'brim', body: 'tunic', weapon: 'crossbow', colors: { ...PALE, H: '#2e2a26', h: '#1a1714', A: '#3f362e', a: '#2a241f', L: '#2a241f' } },
  templar: { head: 'greathelm', body: 'armor', weapon: 'sword', shield: true, cross: true, colors: { ...SKIN, H: '#c9ccd4', h: '#8d93a0', A: '#e3dccb', a: '#9e2236', L: '#8d93a0', e: '#07050b' } },
  bishop: { head: 'mitre', body: 'robe', weapon: 'staffcross', cross: true, colors: { ...PALE, H: '#e3dccb', h: '#c9a23a', A: '#8f1f3a', a: '#5e1426' } },
  hurler: { head: 'bald', body: 'tunic', weapon: 'none', shield: true, colors: { ...SKIN, A: '#7a5a3a', a: '#4d3826', L: '#3d2a20', m: '#a97a5e', y: '#634532' } },
  // ---- mortos humanoides
  zombie: { head: 'hair', body: 'tunic', weapon: 'none', colors: { ...ZOMBIE, H: '#2e2a20', A: '#4a4a3a', a: '#2f2f24', L: '#2f2f24' } },
  ghoul: { head: 'bald', body: 'tunic', weapon: 'none', colors: { ...GHOUL, A: '#6d6f64', a: '#4a4c43', L: '#4a4c43' } },
  thrall: { head: 'hood', body: 'robe', weapon: 'none', colors: { ...VAMP, H: '#5e1426', h: '#3a0c18', A: '#5e1426', a: '#3a0c18' } },
  lich: {
    head: 'hood',
    body: 'robe',
    weapon: 'staffcross',
    colors: { f: '#e3dccb', F: '#a49c86', e: '#aef5bf', H: '#6e4a8a', h: '#8f6aae', A: '#6e4a8a', a: '#4c2f61', y: '#aef5bf', N: '#a49c86' },
  },
  abomination: { head: 'bald', body: 'tunic', weapon: 'none', colors: { f: '#8a9c70', F: '#5e6e4a', e: '#e0304a', A: '#7d6a5a', a: '#4a3a30', L: '#4a3a30' } },
  plaguebearer: {
    head: 'hood',
    body: 'robe',
    weapon: 'lantern',
    colors: { ...ZOMBIE, H: '#5e7a34', h: '#3f5424', A: '#5e7a34', a: '#3f5424', O: '#c8ff8a', o: '#8fbf3a' },
  },
  bloodknight: {
    head: 'greathelm',
    body: 'armor',
    weapon: 'sword',
    colors: { ...VAMP, H: '#5e1426', h: '#3a0c18', A: '#7a1c24', a: '#3a0c18', L: '#3a0c18', e: '#ff4a5e', y: '#e0304a' },
  },
};

/** Chefes: desenhados em 12x14 e ampliados com refinamento para 24x28. */
export const BOSS_SPECS: Record<string, HumanoidSpec> = {
  woodcutter: { head: 'hair', body: 'tunic', weapon: 'axe', colors: { ...SKIN, H: '#7a3a1c', A: '#8a2a22', a: '#5a1a16', L: '#2e2419' } },
  abbot: { head: 'mitre', body: 'robe', weapon: 'staffcross', cross: true, colors: { ...PALE, H: '#d9d2c3', h: '#c9a23a', A: '#2c2433', a: '#1b1620' } },
  commander: {
    head: 'helmet',
    body: 'armor',
    weapon: 'sword',
    shield: true,
    colors: { ...SKIN, H: '#c9a23a', h: '#8a6a22', A: '#a9b3c4', a: '#7a1c24', L: '#6e7787' },
  },
  archbishop: {
    head: 'mitre',
    body: 'robe',
    weapon: 'staffcross',
    cross: true,
    book: true,
    colors: { ...PALE, H: '#f6cf6a', h: '#c9a23a', A: '#e3dccb', a: '#a49c86' },
  },
  seraph: {
    head: 'hair',
    body: 'robe',
    weapon: 'sword',
    cross: true,
    colors: { f: '#f0e6d0', F: '#c9b890', e: '#fff8c0', H: '#f6cf6a', A: '#ffffff', a: '#d9d2c3', m: '#fff0b0', y: '#f6cf6a' },
  },
};

/** Versão morta-viva de um chefe (campeão). */
export function undeadColors(spec: HumanoidSpec): HumanoidSpec {
  const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(spec.colors)) colors[k] = mix(v, '#1a1424', 0.45);
  Object.assign(colors, { f: '#7d9466', F: '#56684a', e: '#aef5bf' });
  return { ...spec, colors };
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}
