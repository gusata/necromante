export type Faction = 'living' | 'dead';
export type School = 'bone' | 'flesh' | 'plague' | 'spirit' | 'blood';

export type LivingKind =
  | 'peasant'
  | 'torch'
  | 'militia'
  | 'hunter'
  | 'hound'
  | 'monk'
  | 'priest'
  | 'nun'
  | 'ringer'
  | 'flagellant'
  | 'soldier'
  | 'crossbow'
  | 'shield'
  | 'knight'
  | 'halberd'
  | 'paladin'
  | 'inquisitor'
  | 'witchhunter'
  | 'templar'
  | 'bishop';
export type BossKind = 'woodcutter' | 'abbot' | 'commander' | 'archbishop';
export type DeadKind = 'skeleton' | 'archer' | 'giant' | 'zombie' | 'ghoul' | 'rat' | 'ghost' | 'thrall' | 'champion';
export type UnitKind = LivingKind | BossKind | DeadKind;

export type DamageType = 'normal' | 'holy' | 'poison' | 'magic' | 'explode';

export type Trait =
  | 'burnCorpses' // tocheiro: queima cadáveres por perto
  | 'healer' // cura vivos em volta
  | 'holyLight' // fere mortos em volta, devagar
  | 'speedAura' // vivos por perto andam mais rápido
  | 'holyBurst' // explode em luz ao morrer
  | 'shieldBlock' // metade do dano dos raios do necromante
  | 'charge' // investida quando o alvo está perto
  | 'cleave' // ataque em área
  | 'consecrate' // cadáveres perto dele não podem ser levantados
  | 'banish' // pulso sagrado periódico
  | 'necroHunter' // ignora o exército e vai no necromante
  | 'armorAura' // vivos por perto levam menos dano
  | 'holyWeapon'; // ataques sagrados: dobro de dano em mortos

export type AbilityId = 'slam' | 'summon' | 'healAll' | 'nova' | 'charge' | 'beam' | 'healDead';

export interface UnitDef {
  faction: Faction;
  name: string;
  desc: string;
  hp: number;
  dmg: number;
  speed: number;
  range: number;
  atkCd: number;
  radius: number;
  /** quanto ocupa do limite do exército (mortos) */
  armyCost: number;
  /** pode ser levantado ao morrer (vivos) */
  raisable: boolean;
  /** custo no orçamento da onda (vivos) e almas por abate */
  threat: number;
  /** velocidade do projétil, se ataca à distância */
  projectile?: number;
  /** atravessa os vivos (fantasmas) */
  flying?: boolean;
  traits?: Trait[];
  school?: School;
  boss?: boolean;
  abilities?: { id: AbilityId; cd: number }[];
}

export interface Ability {
  id: AbilityId;
  cd: number;
  t: number;
}

export interface Unit {
  id: number;
  kind: UnitKind;
  faction: Faction;
  /** chefe de origem, para campeões */
  boss?: BossKind;
  rank: number;
  x: number;
  /** y = pés */
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
  /** temporizador genérico de traços (cura, queimar, banir...) */
  traitTimer: number;
  abilities: Ability[];
  slotAngle: number;
  slotDist: number;
  poisonT: number;
  poisonDps: number;
  poisonTick: number;
  stunT: number;
  chargeT: number;
  chargeCd: number;
  chargeVx: number;
  chargeVy: number;
  /** escola de quem acertou por último (para infecção) */
  lastHitBy?: UnitKind;
  /** marcados por paladinos não deixam nada */
  age: number;
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
  /** levanta mesmo fora do círculo (infecção) */
  forced: boolean;
  /** cadáver de morto (pilha de ossos) */
  bones: boolean;
  gone: boolean;
  /** consagrado por um paladino próximo neste quadro */
  holy: boolean;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  /** alvo especial: o necromante */
  atNecro: boolean;
  tx: number;
  ty: number;
  speed: number;
  dmg: number;
  type: DamageType;
  faction: Faction;
  sourceKind: UnitKind;
  gone: boolean;
}

export interface Telegraph {
  id: number;
  shape: 'circle' | 'line';
  x: number;
  y: number;
  r: number;
  x2: number;
  y2: number;
  t: number;
  max: number;
  ability: AbilityId;
  ownerId: number;
  /** facção atingida */
  hits: Faction;
  dmg: number;
}

export interface Cloud {
  id: number;
  x: number;
  y: number;
  r: number;
  dps: number;
  t: number;
  max: number;
}

export type GameEvent =
  | { type: 'bolt'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'hit'; id: number; x: number; y: number; faction: Faction; dmg: number; dtype: DamageType; big: boolean }
  | { type: 'swing'; id: number; tx: number; ty: number }
  | { type: 'shoot'; id: number }
  | { type: 'death'; id: number; kind: UnitKind; x: number; y: number; faction: Faction; facing: 1 | -1; spent: boolean; boss?: BossKind }
  | { type: 'raiseStart'; corpseId: number; x: number; y: number }
  | { type: 'raised'; corpseId: number; unitId: number; x: number; y: number; kind: UnitKind }
  | { type: 'explode'; x: number; y: number; r: number }
  | { type: 'fuse'; x: number; y: number; unitId: number }
  | { type: 'consume'; x: number; y: number }
  | { type: 'heal'; x: number; y: number; r: number; faction: Faction }
  | { type: 'necroHit'; dmg: number; x: number; y: number }
  | { type: 'necroHeal'; amount: number }
  | { type: 'burn'; x: number; y: number }
  | { type: 'holyBurst'; x: number; y: number; r: number }
  | { type: 'scream' }
  | { type: 'telegraphEnd'; ability: AbilityId; x: number; y: number; x2: number; y2: number; r: number; hits: Faction }
  | { type: 'charge'; id: number }
  | { type: 'summon'; x: number; y: number }
  | { type: 'cloud'; x: number; y: number; r: number }
  | { type: 'regionStart'; region: number }
  | { type: 'waveStart'; wave: number; local: number; boss: boolean }
  | { type: 'bossSpawn'; id: number; boss: BossKind }
  | { type: 'bossDeath'; boss: BossKind; x: number; y: number }
  | { type: 'waveCleared'; wave: number; souls: number }
  | { type: 'cardOffer' }
  | { type: 'synergy'; school: School; level: 1 | 2 }
  | { type: 'gameOver' };
