/**
 * Sprites em pixel art. Cada string é uma linha; cada letra é uma cor de palette.ts.
 * '.' = transparente. Editar aqui muda o jogo direto (substituir por PNGs do Aseprite depois).
 */

export const NECRO = [
  '...........kGk..',
  '....kkkk..kgGgk.',
  '...kppppk..kgk..',
  '..kpPPPppk..M...',
  '..kpPdddpk..M...',
  '.kppddddddk.M...',
  '.kpdGdddGdk.M...',
  '.kpddddddddkM...',
  '..kpddddddkbk...',
  '..kppppppppbk...',
  '.kppPpppppppk...',
  '.kpPpppppppPk...',
  '.kpPpppkppppPk..',
  'kppPppkppppppPk.',
  'kpPpppkppppPppk.',
  'kpPppkppppppPpk.',
  'kppppkpppppppppk',
  'kpppkppppppppppk',
  '.kkkkkkkkkkkkkk.',
];

const SKEL_TOP = [
  '...kkkk...',
  '..kwwwwk..',
  '..kgkwgk..',
  '..kwwwwk..',
  '...kbkbk..',
  '...kkkk...',
  '..kbwwbk..',
  '.kbkwwkbk.',
  '.kk.kwk.kk',
  '...kwwk...',
];
export const SKEL = [
  [...SKEL_TOP, '..kbk.kbk.', '..kk..kk..'],
  [...SKEL_TOP, '...kbkbk..', '...kk.kk..'],
];

const PEASANT_TOP = [
  '........O.',
  '...kkkk.Oo',
  '..knnnnk.o',
  '..kfkfkk.N',
  '..kffffk.N',
  '...kkkk.kN',
  '..kNNNNkfk',
  '.kNNNNNNk.',
  '.kfNNNNk..',
  '..knnnnk..',
];
export const PEASANT = [
  [...PEASANT_TOP, '..kn.nk...', '..kk.kk...'],
  [...PEASANT_TOP, '...knnk...', '...kkkk...'],
];

const SOLDIER_TOP = [
  '.........m',
  '...kkkk..m',
  '..kmmmmk.m',
  '..kMkkMk.m',
  '..kffffk.m',
  '...kkkk.km',
  '..kmmmmkfk',
  '.kMmmmmMk.',
  '.kMmMMmMk.',
  '..kMMMMk..',
];
export const SOLDIER = [
  [...SOLDIER_TOP, '..kM.Mk...', '..kk.kk...'],
  [...SOLDIER_TOP, '...kMMk...', '...kkkk...'],
];

const PRIEST_TOP = [
  '...kkkk...',
  '..kcccck..',
  '..kfkfkk..',
  '..kffffk..',
  '..kckkck..',
  '.kccyccck.',
  '.kcyyyCck.',
  '.kccyCCck.',
  '.kcCyCCck.',
  '.kcCCCCck.',
];
export const PRIEST = [
  [...PRIEST_TOP, 'kcCCCCCCck', 'kkkkkkkkkk'],
  [...PRIEST_TOP, '.kCCCCCCk.', '.kkkkkkkk.'],
];

export const CORPSE = [
  '...kkk......',
  '..kfffkkkkk.',
  '..kfkNNNNNNk',
  '.rrkkkkkkkkr',
  'rRRrrrrRRrr.',
];

export const SPLAT = [
  '..r.....',
  '.rRr..r.',
  'rRRRrr..',
  '.rRRRr.r',
  '..r.r...',
];

export const TOMB = [
  '..kkkkk..',
  '.kZZZZZk.',
  'kZzzzzzZk',
  'kZzzkzzZk',
  'kZzkkkzZk',
  'kZzzkzzZk',
  'kZzzkzzZk',
  'kZzzzzzZk',
  'kZzzzzzZk',
  'kkkkkkkkk',
];

export const CANDLE = [
  ['.O.', 'oOo', '.o.', 'kck', 'kck', 'kCk', 'kkk'],
  ['.o.', '.Oo', '.o.', 'kck', 'kck', 'kCk', 'kkk'],
];

export const SOUL_ICON = ['..g..', '.gG..', '.gGg.', 'gGGGg', 'gGGGg', '.ggg.'];
export const SKULL_ICON = ['.www.', 'wwwww', 'wkwkw', '.www.', '.w.w.'];
export const HEART_ICON = ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'];

/** Fonte 3x5. Desenhada em branco, recebe tint na cena. */
export const FONT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :!./+-?<>()%=';
export const FONT: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  ' ': ['...', '...', '...', '...', '...'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '.': ['...', '...', '...', '...', '.#.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'],
  ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '=': ['...', '###', '...', '###', '...'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
};
