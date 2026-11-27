/**
 * Gerador de humanoides em pixel art (16x22) por camadas: cabeça, corpo, pernas, arma, escudo.
 * Letras de cor nos moldes:
 *   k contorno · H/h chapéu/cabelo · A/a corpo · f/F pele · e olhos · L pernas
 *   o resto vem da paleta global (m, M, N, y, O, o, c...)
 */

export type Head = 'hair' | 'bald' | 'cap' | 'helmet' | 'greathelm' | 'hood' | 'mitre' | 'brim';
export type Body = 'tunic' | 'armor' | 'robe' | 'reach';
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

// 16x22, virado para a direita em 3/4 (docs/ARTE.md): cabeça grande nas linhas 0-8 com o rosto à direita
// (olhos nas colunas 9 e 11), tronco 9-16 com o braço da frente segurando a arma (mão em 12-13, linha 13),
// pernas 17-21. O "k" marca a borda: o gerador a troca pelo tom escuro do material (sel-out), nunca preto.
const HEADS: Record<Head, Layer> = {
  hair: {
    1: '.....kkkkk......',
    2: '....kHHHHHkk....',
    3: '...kHHHHHHHHk...',
    4: '...kHHHhfffffk..',
    5: '...kHHhffefefk..',
    6: '...kHhfffffffk..',
    7: '....kffffffFk...',
    8: '.....kkFFFkk....',
  },
  bald: {
    1: '.....kkkkk......',
    2: '....kffffffk....',
    3: '...kffffffffk...',
    4: '...kffffffffFk..',
    5: '...kfffffefeFk..',
    6: '...kFffffffffk..',
    7: '....kffffffFk...',
    8: '.....kkFFFkk....',
  },
  cap: {
    0: '.....kkkkk......',
    1: '....kHHHHHk.....',
    2: '...kHHHHHHHk....',
    3: '...khhhhhhhhhk..',
    4: '...kHffffffffk..',
    5: '...kHHhffefefk..',
    6: '...kHhfffffffk..',
    7: '....kffffffFk...',
    8: '.....kkFFFkk....',
  },
  helmet: {
    0: '.....kkkkk......',
    1: '....kHHHHHk.....',
    2: '...kHHHHHHHk....',
    3: '...kHHHHHHHHk...',
    4: '...khhhhhhhhhk..',
    5: '...kHHhffefefk..',
    6: '...kHhfffffffk..',
    7: '....kffffffFk...',
    8: '.....kkFFFkk....',
  },
  greathelm: {
    1: '....kkkkkkk.....',
    2: '...kHHHHHHHk....',
    3: '...kHHHHHHHHk...',
    4: '...kHHHHHHHHHk..',
    5: '...kHHhkekekkk..',
    6: '...kHHHHHHHHHk..',
    7: '....kHhhyhhhk...',
    8: '.....kkkkkkk....',
  },
  hood: {
    1: '.....kkkkk......',
    2: '....kHHHHHHk....',
    3: '...kHHHHHHHHk...',
    4: '...kHHhffffffk..',
    5: '...kHhfffefefk..',
    6: '...kHhfffffffk..',
    7: '...kHHhfffffFk..',
    8: '...kHHHkkkkkk...',
  },
  mitre: {
    0: '......kHk.......',
    1: '.....kHyHk......',
    2: '....kHHyHHk.....',
    3: '...kHHHyHHHk....',
    4: '...khhhhhhhhhk..',
    5: '...kfffffefeFk..',
    6: '...kFffffffffk..',
    7: '....kffffffFk...',
    8: '.....kkFFFkk....',
  },
  brim: {
    1: '......kkkk......',
    2: '.....kHHHHk.....',
    3: '.....khhhhk.....',
    4: '.kHHHHHHHHHHHHk.',
    5: '...kffffefefk...',
    6: '...kfffffffFk...',
    7: '....kffffFk.....',
    8: '.....kkFFk......',
  },
};

const BODIES: Record<Body, Layer> = {
  tunic: {
    9: '.....kAAAAk.....',
    10: '....kAAAAAAk....',
    11: '...kAAAAAAAAk...',
    12: '...kAAAAAAAAAk..',
    13: '...kaAAAAAAkffk.',
    14: '....kaaaaaakkk..',
    15: '....kaaaaaak....',
    16: '....kLLkkLLk....',
  },
  armor: {
    9: '.....kAAAAk.....',
    10: '....kAAaaAAk....',
    11: '...kAAaAAaAAk...',
    12: '...kAAAaaAAAAk..',
    13: '...kaAAAAAAkffk.',
    14: '....kAAAAAAkkk..',
    15: '....kaAkkAak....',
    16: '....kLLkkLLk....',
  },
  robe: {
    9: '.....kAAAAk.....',
    10: '....kAAAAAAk....',
    11: '...kAAAAaAAAk...',
    12: '...kAAAAaAAAAk..',
    13: '...kAAAAaAAkffk.',
    14: '...kAAAAaAAkkk..',
    15: '...kAAAAaAAAk...',
    16: '...kAAAAaAAAk...',
  },
  // mortos que andam de braços esticados (zumbi, carniçal)
  reach: {
    9: '.....kAAAAk.....',
    10: '....kAAAAAAk....',
    11: '...kAAAAAAAkkkk.',
    12: '...kAAAAAAAffffk',
    13: '...kaAAAAAAkkkk.',
    14: '....kaaaaaak....',
    15: '....kaaaaaak....',
    16: '....kLLkkLLk....',
  },
};

const LEGS: [Layer, Layer] = [
  { 17: '....kLLkkLLk....', 18: '...kLLk..kLLk...', 19: '...kLLk..kLLk...', 20: '..kLLLk..kLLLk..', 21: '..kkkkk..kkkkk..' },
  { 17: '.....kLLLLk.....', 18: '.....kLLLLk.....', 19: '.....kLLkLk.....', 20: '....kLLLkLLLk...', 21: '....kkkkkkkkk...' },
];
const ROBE_HEM: [Layer, Layer] = [
  { 17: '..kAAAAaAAAAk...', 18: '..kAAAAaAAAAk...', 19: '..kAAAAaAAAAAk..', 20: '..kaaaaaaaaaak..', 21: '..kkkkkkkkkkkk..' },
  { 17: '...kAAAaAAAAk...', 18: '...kAAAaAAAAk...', 19: '...kAAAaAAAAk...', 20: '...kaaaaaaaak...', 21: '...kkkkkkkkkk...' },
];

const col = (n: number) => '.'.repeat(n);
const at = (c: number, s: string) => (col(c) + s).padEnd(W, '.');
const handle = (from: number, to: number, c = 13, ch = 'N'): Layer => {
  const l: Layer = {};
  for (let r = from; r <= to; r++) l[r] = at(c, ch);
  return l;
};

// armas na mão da frente (coluna 13, mão na linha 13). Grandes: é o que identifica a classe.
const WEAPONS: Record<Weapon, Layer> = {
  none: {},
  torch: { 3: at(13, 'O'), 4: at(12, 'oOo'), 5: at(12, 'oOo'), 6: at(12, 'ooo'), 7: at(12, 'NNN'), ...handle(8, 15) },
  pitchfork: { 0: at(11, 'm.m.m'), 1: at(11, 'm.m.m'), 2: at(11, 'm.m.m'), 3: at(11, 'mmmmm'), ...handle(4, 20) },
  sword: { 3: at(13, 'w'), 4: at(13, 'm'), 5: at(13, 'm'), 6: at(13, 'm'), 7: at(13, 'm'), 8: at(13, 'm'), 9: at(13, 'm'), 10: at(13, 'm'), 11: at(12, 'MMM'), 12: at(13, 'N') },
  spear: { 0: at(13, 'w'), 1: at(12, 'mmm'), 2: at(13, 'm'), ...handle(3, 21) },
  bow: { ...handle(6, 18, 13, 'w'), 5: at(13, 'NN'), 6: at(14, 'N'), ...handle(7, 17, 15), 18: at(14, 'N'), 19: at(13, 'NN') },
  crossbow: { 11: at(14, 'm'), 12: at(8, 'NNNNNNMm'), 13: at(11, 'NNN'), 14: at(14, 'm') },
  staffcross: { 0: at(13, 'y'), 1: at(12, 'yyy'), 2: at(13, 'y'), 3: at(13, 'y'), ...handle(4, 21) },
  bell: { 14: at(13, 'N'), 15: at(12, 'yyy'), 16: at(11, 'yyyyy'), 17: at(11, 'yyyyy'), 18: at(12, 'kOk') },
  axe: { 3: at(10, 'kmmN'), 4: at(10, 'mmmN'), 5: at(10, 'mmmN'), 6: at(10, 'kmmN'), ...handle(7, 16) },
  flail: { 5: at(13, 'MM'), 6: at(13, 'MM'), 7: at(13, 'w'), 8: at(13, 'w'), 9: at(13, 'w'), ...handle(10, 15) },
  lantern: { 14: at(13, 'N'), 15: at(12, 'MMM'), 16: at(12, 'MOM'), 17: at(12, 'MoM'), 18: at(12, 'MMM') },
  halberd: { 0: at(13, 'w'), 1: at(11, 'mmmm'), 2: at(11, 'mmmm'), 3: at(12, 'mm'), ...handle(4, 21) },
  mace: { 6: at(13, 'M'), 7: at(12, 'MMM'), 8: at(12, 'MMM'), 9: at(13, 'M'), ...handle(10, 15) },
};

// quadro de ataque: pose própria (estocada, golpe), com o corpo inclinado 1 px para a frente.
// Armas sem pose própria avançam 1 px e descem 1 px.
const ATTACKS: Partial<Record<Weapon, Layer>> = {
  pitchfork: { 11: at(13, 'mmm'), 12: at(13, 'm'), 13: at(4, 'NNNNNNNNNmmm'), 14: at(13, 'm'), 15: at(13, 'mmm') },
  spear: { 12: at(14, 'm'), 13: at(2, 'NNNNNNNNNNNNmw'), 14: at(14, 'm') },
  halberd: { 11: at(11, 'mmm'), 12: at(11, 'mmmm'), 13: at(1, 'NNNNNNNNNNNNmmw'), 14: at(12, 'mm') },
  sword: { 11: at(11, 'M'), 12: at(9, 'NMmmmmw'), 13: at(11, 'M') },
  torch: { 7: at(14, 'O'), 8: at(13, 'oOo'), 9: at(13, 'oOo'), 10: at(13, 'ooo'), 11: at(14, 'N'), 12: at(13, 'N') },
  axe: { 12: at(8, 'NNNNNN'), 13: at(13, 'mmm'), 14: at(13, 'mmm'), 15: at(13, 'mmm'), 16: at(14, 'm') },
  mace: { 10: at(14, 'M'), 11: at(13, 'MMM'), 12: at(13, 'MMM'), 13: at(12, 'NM') },
  flail: { 9: at(14, 'MM'), 10: at(14, 'MM'), 11: at(14, 'w'), 12: at(13, 'w'), 13: at(12, 'NN') },
  staffcross: { 0: at(14, 'y'), 1: at(13, 'yyy'), 2: at(14, 'y'), 3: at(14, 'y'), ...handle(4, 14, 14) },
};

const SHIELD: Layer = { 10: '.kkkk', 11: 'kmmmk', 12: 'kmymk', 13: 'kyyyk', 14: 'kmymk', 15: 'kmmmk', 16: '.kmk.' };
const BOOK: Layer = { 12: at(11, 'kkkk'), 13: at(11, 'kyyk'), 14: at(11, 'kkkk') };
const CROSS: Layer = { 10: at(7, 'y'), 11: at(6, 'yyy'), 12: at(7, 'y'), 13: at(7, 'y') };

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
    const lean = f === 2 ? 1 : 0;
    stamp(g, spec.body === 'robe' ? ROBE_HEM[legFrame] : LEGS[legFrame]);
    stamp(g, BODIES[spec.body], lean);
    stamp(g, HEADS[spec.head], lean);
    if (spec.cross) stamp(g, CROSS, lean);
    if (spec.shield) stamp(g, SHIELD, lean);
    if (spec.book) stamp(g, BOOK, lean);
    // ataque: pose própria da arma (estocada, golpe); sem pose, a arma avança e desce 1 px
    const attack = f === 2 ? ATTACKS[spec.weapon] : undefined;
    if (attack) stamp(g, attack);
    else stamp(g, WEAPONS[spec.weapon], lean, lean);
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
  torch: { head: 'hood', body: 'tunic', weapon: 'torch', colors: { ...SKIN, H: '#5a4e6a', h: '#3e3550', A: '#4a3b2a', a: '#2e2419', L: '#2e2419' } },
  militia: { head: 'helmet', body: 'tunic', weapon: 'spear', colors: { ...SKIN, H: '#7c8796', h: '#4a5260', A: '#5c6b3a', a: '#3a4425', L: '#3d2a20' } },
  hunter: { head: 'hood', body: 'tunic', weapon: 'bow', colors: { ...SKIN, H: '#3f5a33', h: '#2a3d22', A: '#4f6b3d', a: '#334527', L: '#3d2a20' } },
  // ---- Mosteiro
  monk: { head: 'bald', body: 'robe', weapon: 'none', colors: { ...SKIN, A: '#6b4a2e', a: '#4a321e' } },
  priest: { head: 'hood', body: 'robe', weapon: 'staffcross', cross: true, colors: { ...PALE, H: '#bdb7c9', h: '#8d879a', A: '#bdb7c9', a: '#7f7990' } },
  nun: { head: 'hood', body: 'robe', weapon: 'lantern', colors: { ...PALE, H: '#e3dccb', h: '#a49c86', A: '#4a4260', a: '#332d44' } },
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
  inquisitor: { head: 'brim', body: 'robe', weapon: 'none', book: true, colors: { ...PALE, H: '#4a2a2a', h: '#9e2236', A: '#5a3030', a: '#9e2236' } },
  witchhunter: { head: 'brim', body: 'tunic', weapon: 'crossbow', colors: { ...PALE, H: '#4a4038', h: '#2e2822', A: '#5a4c3e', a: '#3e342a', L: '#3e342a' } },
  templar: { head: 'greathelm', body: 'armor', weapon: 'sword', shield: true, cross: true, colors: { ...SKIN, H: '#c9ccd4', h: '#8d93a0', A: '#e3dccb', a: '#9e2236', L: '#8d93a0', e: '#07050b' } },
  bishop: { head: 'mitre', body: 'robe', weapon: 'staffcross', cross: true, colors: { ...PALE, H: '#e3dccb', h: '#c9a23a', A: '#8f1f3a', a: '#5e1426' } },
  hurler: { head: 'bald', body: 'tunic', weapon: 'none', shield: true, colors: { ...SKIN, A: '#7a5a3a', a: '#4d3826', L: '#3d2a20', m: '#a97a5e', y: '#634532' } },
  // ---- mortos humanoides
  zombie: { head: 'hair', body: 'reach', weapon: 'none', colors: { ...ZOMBIE, H: '#2e2a20', A: '#4a4a3a', a: '#2f2f24', L: '#2f2f24' } },
  ghoul: { head: 'bald', body: 'reach', weapon: 'none', colors: { ...GHOUL, A: '#6d6f64', a: '#4a4c43', L: '#4a4c43' } },
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
