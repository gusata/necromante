export type Faction = 'living' | 'dead';
export type UnitKind = 'peasant' | 'soldier' | 'priest' | 'skeleton' | 'giant';

export interface UnitDef {
  faction: Faction;
  hp: number;
  dmg: number;
  /** pixels por segundo */
  speed: number;
  /** alcance do ataque, em pixels */
  range: number;
  /** segundos entre ataques */
  atkCd: number;
  /** raio de colisão */
  radius: number;
  /** quanto ocupa do limite do exército (só mortos) */
  armyCost: number;
  /** pode ser levantado ao morrer (só vivos) */
  raisable: boolean;
  /** custo no orçamento da onda (só vivos) */
  threat: number;
  /** primeira onda em que aparece (só vivos) */
  minWave: number;
}

export interface Unit {
  id: number;
  kind: UnitKind;
  faction: Faction;
  x: number;
  /** y = posição dos pés */
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  range: number;
  atkCd: number;
  atkTimer: number;
  radius: number;
  alive: boolean;
  moving: boolean;
  facing: 1 | -1;
  healTimer: number;
  /** posição na formação em volta do círculo (só mortos) */
  slotAngle: number;
  slotDist: number;
}

export interface Corpse {
  id: number;
  kind: UnitKind;
  x: number;
  y: number;
  age: number;
  /** -1 = parado; 0..1 = progresso do levantar */
  raise: number;
  raisable: boolean;
  gone: boolean;
}

export type GameEvent =
  | { type: 'bolt'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'hit'; id: number; x: number; y: number; faction: Faction }
  | { type: 'swing'; id: number }
  | { type: 'death'; id: number; kind: UnitKind; x: number; y: number; faction: Faction }
  | { type: 'raiseStart'; corpseId: number; x: number; y: number }
  | { type: 'raised'; corpseId: number; unitId: number; x: number; y: number }
  | { type: 'explode'; x: number; y: number; r: number }
  | { type: 'fuse'; x: number; y: number; unitId: number }
  | { type: 'consume'; x: number; y: number }
  | { type: 'heal'; x: number; y: number; r: number }
  | { type: 'necroHit'; dmg: number; x: number; y: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveCleared'; wave: number; souls: number }
  | { type: 'gameOver' };
