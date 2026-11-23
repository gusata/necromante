import { ARMY_CAP, CIRCLE_R, CONSUME_MAX, CORPSE_LIFE, EXPLODE_R, FUSE_COUNT, NECRO, START_SKELETONS } from './defs';
import type { DeadKind } from './types';

/**
 * Todos os modificadores de uma run. Começa em baseMods(), recebe a meta-progressão
 * (cemitério) e depois as cartas escolhidas e as sinergias de escola.
 */
export interface Mods {
  necroDmg: number;
  castCdMul: number;
  circleR: number;
  necroMaxHp: number;
  /** vida por segundo */
  necroRegen: number;
  armyCap: number;
  startSkeletons: number;
  freeSkeletonsPerWave: number;
  raiseTimeMul: number;
  corpseLife: number;

  deadHpMul: number;
  deadDmgMul: number;
  deadSpeedMul: number;
  /** fração de dano que os mortos ignoram */
  deadArmor: number;
  kindHpMul: Partial<Record<DeadKind, number>>;
  kindDmgAdd: Partial<Record<DeadKind, number>>;
  /** pesos do que levanta de um cadáver */
  raisePool: Partial<Record<DeadKind, number>>;

  explodeDmgMul: number;
  explodeR: number;
  explodePoison: boolean;
  consumeHealMul: number;
  consumeMax: number;
  consumeSouls: number;
  fuseCount: number;
  giantMul: number;

  poisonOnHit: boolean;
  poisonDmgMul: number;
  poisonDurMul: number;
  poisonSlow: boolean;
  poisonedRaisable: boolean;
  ratExplode: boolean;
  circleMiasma: number;
  circleSlow: number;

  boltChain: number;
  ghostOnDeath: number;
  soulMul: number;
  /** chance de curar 1 ao acertar */
  lifesteal: number;
  frenzyDmg: number;
  frenzyTime: number;

  cardChoices: number;
  rerolls: number;
  championMul: number;

  // itens lendários e personagens
  /** mortos pelo raio levantam mesmo com o exército cheio */
  boltOvercap: boolean;
  /** mortos perdem vida aos poucos */
  lichDecay: boolean;
  /** chance de explodir sem gastar o morto */
  explodeKeep: number;
  /** foice: acerta todos no círculo */
  scythe: boolean;
  /** vida perdida por segundo */
  necroDrain: number;
  /** vida ganha por abate */
  killHeal: number;
  /** cada cadáver levanta 2 */
  doubleRaise: boolean;

  // sinergias (definidas pela contagem de cartas por escola)
  boneRebirth: number;
  boneDominion: boolean;
  fleshInfect: boolean;
  fleshDominion: boolean;
  plagueDeathCloud: boolean;
  plagueDominion: boolean;
  spiritMastery: boolean;
  spiritDominion: boolean;
  bloodMastery: boolean;
  bloodDominion: boolean;
}

export function baseMods(): Mods {
  return {
    necroDmg: NECRO.dmg,
    castCdMul: 1,
    circleR: CIRCLE_R,
    necroMaxHp: NECRO.hp,
    necroRegen: 0,
    armyCap: ARMY_CAP,
    startSkeletons: START_SKELETONS,
    freeSkeletonsPerWave: 0,
    raiseTimeMul: 1,
    corpseLife: CORPSE_LIFE,
    deadHpMul: 1,
    deadDmgMul: 1,
    deadSpeedMul: 1,
    deadArmor: 0,
    kindHpMul: {},
    kindDmgAdd: {},
    raisePool: { skeleton: 3 },
    explodeDmgMul: 1,
    explodeR: EXPLODE_R,
    explodePoison: false,
    consumeHealMul: 1,
    consumeMax: CONSUME_MAX,
    consumeSouls: 0,
    fuseCount: FUSE_COUNT,
    giantMul: 1,
    poisonOnHit: false,
    poisonDmgMul: 1,
    poisonDurMul: 1,
    poisonSlow: false,
    poisonedRaisable: false,
    ratExplode: false,
    circleMiasma: 0,
    circleSlow: 0,
    boltChain: 0,
    ghostOnDeath: 0,
    soulMul: 1,
    lifesteal: 0,
    frenzyDmg: 0,
    frenzyTime: 0,
    cardChoices: 3,
    rerolls: 0,
    championMul: 1,
    boltOvercap: false,
    lichDecay: false,
    explodeKeep: 0,
    scythe: false,
    necroDrain: 0,
    killHeal: 0,
    doubleRaise: false,
    boneRebirth: 0,
    boneDominion: false,
    fleshInfect: false,
    fleshDominion: false,
    plagueDeathCloud: false,
    plagueDominion: false,
    spiritMastery: false,
    spiritDominion: false,
    bloodMastery: false,
    bloodDominion: false,
  };
}

export const cloneMods = (m: Mods): Mods => ({
  ...m,
  kindHpMul: { ...m.kindHpMul },
  kindDmgAdd: { ...m.kindDmgAdd },
  raisePool: { ...m.raisePool },
});
