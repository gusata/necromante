import type { BossKind, LivingKind } from './types';

export interface Region {
  name: string;
  subtitle: string;
  boss: BossKind;
  /** tipo -> [peso, primeira onda local em que aparece] */
  pool: Partial<Record<LivingKind, [number, number]>>;
  /** orçamento de ameaça da onda local 1..5 */
  budget: (local: number) => number;
  /** acompanhantes do chefe */
  escort: LivingKind[];
}

export const REGIONS: Region[] = [
  {
    name: 'A Vila',
    subtitle: 'os vivos pegam forcados',
    boss: 'woodcutter',
    pool: { peasant: [6, 1], hound: [3, 1], torch: [3, 2], militia: [3, 3], hunter: [2, 3] },
    budget: (l) => 6 + l * 4,
    escort: ['peasant', 'peasant', 'hound', 'torch'],
  },
  {
    name: 'O Mosteiro',
    subtitle: 'orações não salvam ninguém',
    boss: 'abbot',
    pool: { monk: [5, 1], peasant: [2, 1], priest: [2, 1], nun: [3, 2], ringer: [2, 3], flagellant: [3, 3], hunter: [1, 1] },
    budget: (l) => 26 + l * 7,
    escort: ['monk', 'monk', 'priest', 'nun'],
  },
  {
    name: 'A Fortaleza',
    subtitle: 'muralhas, aço e disciplina',
    boss: 'commander',
    pool: { soldier: [5, 1], militia: [2, 1], crossbow: [3, 1], shield: [3, 2], halberd: [3, 3], knight: [2, 4], ringer: [1, 1] },
    budget: (l) => 40 + l * 8,
    escort: ['soldier', 'soldier', 'shield', 'crossbow', 'knight'],
  },
  {
    name: 'A Catedral',
    subtitle: 'a luz final',
    boss: 'archbishop',
    pool: { templar: [3, 1], paladin: [3, 1], soldier: [2, 1], inquisitor: [3, 2], witchhunter: [2, 2], bishop: [2, 3], crossbow: [2, 1], flagellant: [2, 1] },
    budget: (l) => 72 + l * 11,
    escort: ['paladin', 'templar', 'inquisitor', 'bishop', 'witchhunter'],
  },
];

/** Modificadores do modo infinito (um novo a cada círculo do abismo). */
export interface EndlessMod {
  id: string;
  name: string;
  desc: string;
}

export const ENDLESS_MODS: EndlessMod[] = [
  { id: 'fervor', name: 'Fervor', desc: 'Vivos 15% mais rápidos.' },
  { id: 'iron', name: 'Ferro', desc: 'Vivos +25% vida.' },
  { id: 'horde', name: 'Horda', desc: 'Ondas 25% maiores.' },
  { id: 'zeal', name: 'Zelo', desc: 'Vivos +1 dano.' },
  { id: 'dawn', name: 'Aurora', desc: 'Cadáveres duram metade.' },
  { id: 'faith', name: 'Fé', desc: 'Vivos curam 1 vida a cada 4s.' },
];

export const circleName = (n: number) => `Círculo ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] ?? n}`;
