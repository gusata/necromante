import { ARMY_CAP, BOLT_CHAIN, CIRCLE_R, CONSUME_MAX, CORPSE_LIFE, EXPLODE_R, FUSE_COUNT, NECRO, START_SKELETONS } from './defs';
import type { DeadKind } from './types';

/**
 * Todos os modificadores de uma run. Começa em baseMods(), recebe a meta-progressão
 * (cemitério) e depois os efeitos de evento e as sinergias de escola.
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

  // conjuntos de itens
  /** esqueletos e arqueiros envenenam */
  boneVenom: boolean;
  /** mortos de ossos soltam nuvem ao cair */
  boneDeathCloud: boolean;
  /** mortos de carne curam 1 por golpe */
  fleshLeech: boolean;
  /** carniçais levantados por morto consumido */
  consumeRaise: number;
  /** vivos mortos pelo raio levantam em qualquer lugar */
  boltForce: boolean;

  // itens (épicos e raros que mudam regra)
  /** multiplicador do dano que o necromante leva */
  necroDmgTakenMul: number;
  /** multiplicador do dano dos mortos em elites e chefes */
  eliteDmgMul: number;
  /** chance de um vivo morto pelos mortos explodir */
  killExplode: number;
  /** chance de um vivo morto envenenado soltar nuvem */
  killCloud: number;
  /** almas por morto gasto (explodir, fundir, consumir) */
  spendSouls: number;
  /** vida do necromante por morto gasto (frações acumulam) */
  spendHeal: number;
  /** multiplicador das almas de quem morre pelo raio */
  boltSoulMul: number;

  // árvore da necrópole
  doubleRaiseChance: number;
  /** esqueletos grátis no começo de cada região */
  regionSkeletons: number;
  /** chance de um morto levantado nascer elite */
  eliteRaise: number;
  /** redução do dano sagrado nos mortos */
  holyResist: number;
  /** multiplicador de abates para carregar o ritual */
  ritualMul: number;
  ritualKeep: number;
  /** volta uma vez por run */
  revive: boolean;
  routeChoices: number;
  eventChance: number;
  /** sorte de raridade nos itens que caem */
  itemLuck: number;
  /** chefes derrubam item raro ou melhor */
  bossRareLoot: boolean;
  /** multiplicador da chance de relíquia */
  relicLuck: number;
  merchantDiscount: number;
  merchantExtra: number;
  eliteLootBonus: number;
  gemMul: number;

  // sinergias (definidas pela contagem de itens por escola)
  /** básico de ossos: empurrão (px) dos golpes de esqueletos e arqueiros */
  boneKnock: number;
  /** básico de carne: vida por golpe dos mortos de carne */
  fleshMend: number;
  /** básico de praga: chance de envenenar ao acertar */
  plagueTouch: number;
  /** básico de espírito: segundos de lentidão do raio */
  spiritChill: number;
  boneApo: boolean;
  fleshApo: boolean;
  plagueApo: boolean;
  spiritApo: boolean;
  bloodApo: boolean;
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
    boltChain: BOLT_CHAIN,
    ghostOnDeath: 0,
    soulMul: 1,
    lifesteal: 0,
    frenzyDmg: 0,
    frenzyTime: 0,
    championMul: 1,
    boltOvercap: false,
    lichDecay: false,
    explodeKeep: 0,
    scythe: false,
    necroDrain: 0,
    killHeal: 0,
    doubleRaise: false,
    boneVenom: false,
    boneDeathCloud: false,
    fleshLeech: false,
    consumeRaise: 0,
    boltForce: false,
    necroDmgTakenMul: 1,
    eliteDmgMul: 1,
    killExplode: 0,
    killCloud: 0,
    spendSouls: 0,
    spendHeal: 0,
    boltSoulMul: 1,
    doubleRaiseChance: 0,
    regionSkeletons: 0,
    eliteRaise: 0,
    holyResist: 0,
    ritualMul: 1,
    ritualKeep: 0,
    revive: false,
    routeChoices: 2,
    eventChance: 1,
    itemLuck: 0,
    bossRareLoot: false,
    relicLuck: 1,
    merchantDiscount: 0,
    merchantExtra: 0,
    eliteLootBonus: 0,
    gemMul: 1,
    boneKnock: 0,
    fleshMend: 0,
    plagueTouch: 0,
    spiritChill: 0,
    boneApo: false,
    fleshApo: false,
    plagueApo: false,
    spiritApo: false,
    bloodApo: false,
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
