/**
 * Sprites desenhados à mão. Cada string é uma linha; cada letra é uma cor de palette.ts
 * (ou de um mapa de cores passado junto). '.' = transparente.
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

/** Necromante conjurando: cajado erguido, orbe maior, olhos acesos. */
export const NECRO_CAST = [
  '..........kGGGk.',
  '....kkkk.kGGGGGk',
  '...kppppk.kGGGk.',
  '..kpPPPppk.kMk..',
  '..kpPdddpk..M...',
  '.kppddddddk.M...',
  '.kpdGGddGGk.M...',
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
  '....kkkk....',
  '...kwwwwk...',
  '...kgkwgk...',
  '...kwwwwk...',
  '....kbkbk...',
  '....kkkk....',
  '...kbwwbk...',
  '..kbkwwkbk..',
  '..kk.kwk.kk.',
  '....kwwk....',
];
export const SKEL = [
  [...SKEL_TOP, '...kbk.kbk..', '...kk..kk...'],
  [...SKEL_TOP, '....kbkbk...', '....kk.kk...'],
  // ataque: braço à frente
  [...SKEL_TOP.slice(0, 7), '..kbkwwkbbk.', '..kk.kwk..kk', '....kwwk....', '...kbk.kbk..', '...kk..kk...'],
];

const BOW = ['..........Nk', '...........N', '...........N', '...........N', '...........N', '...........N', '..........Nk'];
const withBow = (rows: string[]) => rows.map((r, i) => (i >= 4 && i <= 10 ? overlay(r, BOW[i - 4]) : r));
export const SKEL_ARCHER = SKEL.map(withBow);

export function overlay(base: string, top: string): string {
  let out = '';
  for (let i = 0; i < Math.max(base.length, top.length); i++) out += top[i] && top[i] !== '.' ? top[i] : (base[i] ?? '.');
  return out;
}

export const RAT = [
  ['.....kk.', '.kkkkbbk', 'kbbbbbGk', '.kbkkbkk', 'k.k..k..'],
  ['.....kk.', '.kkkkbbk', 'kbbbbbGk', '.kbbkbk.', '.k..k...'],
];

export const GHOST = [
  ['...kkkk...', '..kGGGGk..', '.kGkGGkGk.', '.kGGGGGGk.', '.kGgkkgGk.', '.kGGGGGGk.', '.kgGGGGgk.', '.kgGgGGgk.', '..kgGgGgk.', '..kg.gk.k.', '...k..k...'],
  ['...kkkk...', '..kGGGGk..', '.kGkGGkGk.', '.kGGGGGGk.', '.kGgkkgGk.', '.kGGGGGGk.', '.kgGGGGgk.', '.kgGgGGgk.', '.kgGgGgk..', '.k.kg.gk..', '....k..k..'],
];

export const HOUND = [
  ['........kk..', '.......kNNk.', 'k.....kNNONk', 'kNkkkkNNNNkk', '.kNNNNNNNk..', '.kNnNNNnNk..', '.kk.kk.kk...', '.k..k..k....'],
  ['........kk..', '.......kNNk.', '.k....kNNONk', '.kNkkkNNNNkk', '.kNNNNNNNk..', '.kNnNNNnNk..', '..kk.kk.kk..', '...k..k..k..'],
];

/** Cadáver genérico: recebe as cores do humanoide (H cabeça, A/a corpo, f pele). */
export const CORPSE = ['..kkk.......', '.kHHHkkkkkk.', '.kfefAAAAAAk', '.kkkkaaaaaak', 'rr.rkkkkkkkr'];
export const CORPSE_HOUND = ['............', '...kkkkkk...', '.kkNNNNNNkk.', 'kONNnNNnNNk.', '.rkkkkkkkkr.'];
export const BONE_PILE = ['............', '....kkk.....', '..kkwbwkk...', '.kwbkwwbwk..', '..kkkkkkkk..'];

export const SPLAT = ['..r.....', '.rRr..r.', 'rRRRrr..', '.rRRRr.r', '..r.r...'];
export const SCORCH = ['..kxk...', '.kxzxk..', 'kxzozxk.', '.kxzxkx.', '..kk.k..'];

// ------------------------------------------------------------ projéteis
export const ARROW = ['kk...', '.mmmw', 'kk...'];
export const BOLT_PROJ = ['kkk...', '.MMMMw', 'kkk...'];
export const BONE_ARROW = ['bb...', '.wwww', 'bb...'];

// ------------------------------------------------------------ cenário
export const TOMB = ['..kkkkk..', '.kZZZZZk.', 'kZzzzzzZk', 'kZzzkzzZk', 'kZzkkkzZk', 'kZzzkzzZk', 'kZzzkzzZk', 'kZzzzzzZk', 'kZzzzzzZk', 'kkkkkkkkk'];
export const TOMB2 = ['...kkk...', '..kZZZk..', '.kZzzzZk.', 'kZzzzzzZk', 'kZzZZZzZk', 'kZzzzzzZk', 'kZzzzzzZk', 'kkkkkkkkk'];
export const CROSS_GRAVE = ['...kk...', '...kZk..', '.kkkZkk.', '.kZZZZk.', '..kkZkk.', '...kzk..', '...kzk..', '..kkzkk.', '.kkkkkk.'];
export const CANDLE = [
  ['.O.', 'oOo', '.o.', 'kck', 'kck', 'kCk', 'kkk'],
  ['.o.', '.Oo', '.o.', 'kck', 'kck', 'kCk', 'kkk'],
];
export const DEAD_TREE = [
  '.....k..k.....',
  '..k..kk.k..k..',
  '...k.kNkk.k...',
  '....kNNk.k....',
  'k....kNkk....k',
  '.kk..kNk...kk.',
  '...kkNNNkkk...',
  '.....kNNk.....',
  '.....kNNk.....',
  '.....kNnk.....',
  '....kNNnNk....',
  '...kkkkkkkk...',
];
export const FENCE = ['k...k...k...', 'Nk.kNk.kNk..', 'NNNNNNNNNNNk', 'Nk.kNk.kNk..', 'NNNNNNNNNNNk', 'Nk.kNk.kNk..', 'kk.kkk.kkk..'];
export const PILLAR = ['kkkkkkk', 'kZZZZZk', '.kzzzk.', '.kzZzk.', '.kzZzk.', '.kzZzk.', '.kzZzk.', '.kzZzk.', '.kzZzk.', '.kzZzk.', '.kzZzk.', 'kZZZZZk', 'kkkkkkk'];
export const BRAZIER = [
  ['..O.O..', '.oOoOo.', '..oOo..', 'kMMMMMk', '.kMMMk.', '..kMk..', '.kMMMk.'],
  ['.O..O..', '..oOOo.', '.oOo...', 'kMMMMMk', '.kMMMk.', '..kMk..', '.kMMMk.'],
];
export const WALL = ['kkkkkkkkkkkk', 'kZZzkZZZzkZk', 'kzzzkzzzzkzk', 'kkkkkkkkkkkk', 'kZzkZZZzkZZk', 'kzzkzzzzkzzk', 'kkkkkkkkkkkk'];
export const BANNER = [
  ['kkkkkkk', '.kRRRk.', '.kRyRk.', '.kRRRk.', '.kRRRk.', '.kRkRk.', '.kk.kk.'],
  ['kkkkkkk', '.kRRRk.', '.kRyRk.', '.kRRRk.', '..kRRRk', '..kRkRk', '..kk.kk'],
];
export const BARREL = ['.kkkkk.', 'kNNNNNk', 'kMMMMMk', 'kNnNnNk', 'kNnNnNk', 'kMMMMMk', '.kkkkk.'];
export const CANDELABRA = [
  ['O.O.O', 'o.o.o', 'c.c.c', 'yyyyy', '..y..', '..y..', '..y..', '.yyy.', 'yyyyy'],
  ['.OO.O', 'o.o.o', 'c.c.c', 'yyyyy', '..y..', '..y..', '..y..', '.yyy.', 'yyyyy'],
];
export const PEW = ['kkkkkkkkkkkkkk', 'kNNNNNNNNNNNNk', 'kkkkkkkkkkkkkk', 'kNnnnnnnnnnnNk', 'kNk........kNk', 'kkk........kkk'];
export const BONES_DECOR = ['..k.....', '.kwk.kk.', 'kwbwkwbk', '.kk.kk..'];

// ------------------------------------------------------------ ícones
export const SOUL_ICON = ['..g..', '.gG..', '.gGg.', 'gGGGg', 'gGGGg', '.ggg.'];
export const SKULL_ICON = ['.www.', 'wwwww', 'wkwkw', '.www.', '.w.w.'];
export const HEART_ICON = ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'];
export const PAUSE_ICON = ['kk.kk', 'cc.cc', 'cc.cc', 'cc.cc', 'kk.kk'];
export const LOCK_ICON = ['.kkk.', 'k...k', 'kkkkk', 'kyyyk', 'kykyk', 'kkkkk'];

/** Ícones das escolas (7x7), desenhados com a letra 's' = cor da escola. */
export const SCHOOL_ICONS: Record<string, string[]> = {
  bone: ['.sssss.', 'sssssss', 'skssks.', 'sssssss', '.sksks.', 's.....s', '.s...s.'],
  flesh: ['.ss.ss.', 'sssssss', 'sssssss', 'sssssss', '.sssss.', '..sss..', '...s...'],
  plague: ['...s...', '..sss..', '.sssss.', 'ssskss.', 'ssksss.', '.sssss.', '..sss..'],
  spirit: ['..sss..', '.sssss.', 'sksssks', 'sssssss', 'sssssss', 's.s.s.s', '.......'],
  blood: ['...s...', '...s...', '..sss..', '.sssss.', 'sssssss', 'sssssss', '.sssss.'],
  neutral: ['sssssss', 's.....s', 's.sss.s', 's.s.s.s', 's.sss.s', 's.....s', 'sssssss'],
};

/** Ícones das construções do cemitério (11x11). */
export const BUILDING_ICONS: Record<string, string[]> = {
  'b-crypt': ['....kkk....', '...kZZZk...', '..kZzzzZk..', '.kZzkkkzZk.', '.kZkdddkZk.', '.kZkdddkZk.', '.kZkdddkZk.', '.kZkdddkZk.', 'kZZkdddkZZk', 'kkkkkkkkkkk', '...........'],
  'b-ossuary': ['...........', '....kkk....', '...kwwwk...', '...kgkgk...', '...kwwwk...', '..k.kkk.k..', '.kwk...kwk.', 'kwbwkkkwbwk', '.kkwbwbwkk.', '..kkkkkkk..', '...........'],
  'b-altar': ['...........', '.....R.....', '....kRk....', '...kRRRk...', 'kkkkkkkkkkk', 'kpPPPPPPPpk', 'kkkkkkkkkkk', '.kpk...kpk.', '.kpk...kpk.', '.kkk...kkk.', '...........'],
  'b-library': ['...........', '.kkk.kkk...', '.kRk.kgk.kk', '.kRk.kgkkyk', '.kRk.kgkkyk', '.kRk.kgkkyk', '.kRk.kgkkyk', 'kkkkkkkkkkk', 'kNNNNNNNNNk', 'kkkkkkkkkkk', '...........'],
  'b-bell': ['.....k.....', '....kyk....', '...kyyyk...', '..kyyyyyk..', '..kyyyyyk..', '..kyyyyyk..', '.kyyyyyyyk.', '.kkkkkkkkk.', '.....k.....', '....kOk....', '.....k.....'],
  'b-grave': ['.......kk..', '......kmMk.', '.....kmMk..', '....kNk....', '...kNk.....', '..kNk......', '.kNk.......', 'kNk........', 'kk..kkkkk..', '...kxxxxxk.', '..kxxxxxxxk'],
  'b-reliquary': ['...........', '...kkkkk...', '..kyyyyyk..', '.kyyOyOyyk.', '.kkkkkkkkk.', '.kNyNNNyNk.', '.kNNNyNNNk.', '.kNyNNNyNk.', '.kkkkkkkkk.', '...........', '...........'],
  'b-hall': ['...........', '.k..k..k...', '.yk.y.ky...', '.yyyyyyy...', '.yOyyyOy...', '.yyyyyyy...', '.kkkkkkk...', '...........', '...........', '...........', '...........'],
};

/** Fonte 3x5. Desenhada em branco, recebe tint na cena. */
export const FONT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :!./+-?<>()%=,\'"';
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
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '=': ['...', '###', '...', '###', '...'],
  ',': ['...', '...', '...', '.#.', '#..'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  '"': ['#.#', '#.#', '...', '...', '...'],
};
