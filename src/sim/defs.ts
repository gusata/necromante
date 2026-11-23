import type { UnitDef, UnitKind } from './types';

/** Área jogável (a faixa de baixo, de 296 a 320, é do HUD). */
export const FIELD = { w: 180, h: 296 } as const;

export const NECRO = {
  x: 90,
  y: 274,
  hp: 20,
  dmg: 1,
  /** segundos entre raios */
  castCd: 0.42,
  radius: 8,
  /** ponta do cajado, relativa a (x, y) */
  staffDx: 5,
  staffDy: -15,
} as const;

export const CIRCLE_R = 24;
/** distância máxima entre o necromante e o centro do círculo (impede acampar no spawn) */
export const CIRCLE_REACH = 180;
export const ARMY_CAP = 10;
export const START_SKELETONS = 2;

export const RAISE_TIME = 0.7;
export const CORPSE_LIFE = 8;

export const EXPLODE_R = 18;
export const EXPLODE_DMG = 3;
export const CONSUME_HEAL = 2;
export const CONSUME_MAX = 3;
export const FUSE_COUNT = 3;

export const AGGRO_DEAD = 40;
export const AGGRO_LIVING = 14;
export const FORMATION_R = 15;

export const PRIEST_HEAL = 2;
export const PRIEST_HEAL_R = 26;
export const PRIEST_HEAL_CD = 2.5;

export const INTERMISSION = 3.5;

export const waveBudget = (wave: number) => 4 + wave * 4;
export const spawnInterval = (wave: number) => Math.max(0.35, 1.1 - wave * 0.06);
export const waveHpMul = (wave: number) => 1 + 0.12 * (wave - 1);

const living = (d: Pick<UnitDef, 'hp' | 'dmg' | 'speed' | 'range' | 'atkCd' | 'radius' | 'raisable' | 'threat' | 'minWave'>): UnitDef => ({
  ...d,
  faction: 'living',
  armyCost: 0,
});

const dead = (d: Pick<UnitDef, 'hp' | 'dmg' | 'speed' | 'range' | 'atkCd' | 'radius' | 'armyCost'>): UnitDef => ({
  ...d,
  faction: 'dead',
  raisable: false,
  threat: 0,
  minWave: 0,
});

export const UNIT_DEFS: Record<UnitKind, UnitDef> = {
  peasant: living({ hp: 3, dmg: 1, speed: 11, range: 6, atkCd: 1.0, radius: 4, raisable: true, threat: 1, minWave: 1 }),
  soldier: living({ hp: 8, dmg: 2, speed: 9, range: 7, atkCd: 1.2, radius: 5, raisable: true, threat: 3, minWave: 3 }),
  // padres não podem ser levantados: solo sagrado
  priest: living({ hp: 5, dmg: 1, speed: 8, range: 6, atkCd: 1.4, radius: 4, raisable: false, threat: 4, minWave: 4 }),
  skeleton: dead({ hp: 5, dmg: 1, speed: 20, range: 6, atkCd: 0.7, radius: 4, armyCost: 1 }),
  giant: dead({ hp: 20, dmg: 3, speed: 12, range: 9, atkCd: 1.0, radius: 7, armyCost: 2 }),
};

export const LIVING_KINDS: UnitKind[] = ['peasant', 'soldier', 'priest'];
