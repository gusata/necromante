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
