import type { BossKind, DeadKind, LivingKind, UnitDef, UnitKind } from './types';

/** Área jogável (a faixa de baixo, de 296 a 320, é do HUD). */
export const FIELD = { w: 180, h: 296 } as const;

export const NECRO = {
  x: 90,
  y: 274,
  hp: 18,
  dmg: 1,
  castCd: 0.3,
  radius: 12,
  staffDx: 10,
  staffDy: -32,
} as const;

/** sprites 16x22: o corpo ocupa mais espaço que o antigo 12x14 */
export const SIZE_SCALE = 1.3;
/** altura do meio do corpo acima dos pés (onde raios e flechas acertam) */
export const BODY_MID = 10;
export const CIRCLE_R = 30;
/** cadáveres a até esta distância da borda do círculo também levantam */
export const RAISE_PAD = 12;
/** distância máxima entre o necromante e o centro do círculo (impede acampar no spawn) */
export const CIRCLE_REACH = 180;
/** Modo horda: o exército é uma maré, não um esquadrão. */
export const ARMY_CAP = 60;
export const START_SKELETONS = 6;
/** raios saltam para mais alvos desde o começo */
export const BOLT_CHAIN = 2;

export const RAISE_TIME = 0.7;
export const CORPSE_LIFE = 8;

export const EXPLODE_R = 18;
export const EXPLODE_DMG = 3;
export const CONSUME_HEAL = 1;
export const CONSUME_MAX = 8;
export const FUSE_COUNT = 3;

export const AGGRO_DEAD = 40;
export const AGGRO_LIVING = 14;
export const FORMATION_R = 15;

export const INTERMISSION = 1.2;

// ---- escala da horda
/** multiplicador do orçamento de ameaça das ondas */
export const HORDE_BUDGET = 7;
/** almas por ponto de ameaça abatido */
export const SOULS_PER_THREAT = 0.4;
/** velocidade global (o jogo era lento demais) */
export const LIVING_SPEED_MUL = 1.35;
export const DEAD_SPEED_MUL = 1.2;
/** elites ficam mais raros, já que há muito mais vivos */
export const ELITE_MUL = 0.3;
export const WAVES_PER_REGION = 6; // 5 ondas + chefe
export const REGION_COUNT = 4;

export const POISON_DPS = 1;
export const POISON_TIME = 3;
export const CLOUD_R = 14;
export const CLOUD_TIME = 3;

export const waveHpMul = (wave: number) => 1 + 0.09 * (wave - 1);

type Base = Pick<UnitDef, 'name' | 'desc' | 'hp' | 'dmg' | 'speed' | 'range' | 'atkCd' | 'radius'>;

const living = (d: Base & Partial<UnitDef> & { threat: number }): UnitDef => ({
  faction: 'living',
  armyCost: 0,
  raisable: true,
  ...d,
});

const dead = (d: Base & Partial<UnitDef> & { armyCost: number }): UnitDef => ({
  faction: 'dead',
  raisable: false,
  threat: 0,
  ...d,
});

export const LIVING_DEFS: Record<LivingKind, UnitDef> = {
  // ---- A Vila
  peasant: living({ name: 'Camponês', desc: 'Forcado e coragem. Pouca coisa além disso.', hp: 1, dmg: 1, speed: 11, range: 6, atkCd: 1.0, radius: 4, threat: 1 }),
  torch: living({ name: 'Tocheiro', desc: 'Queima os cadáveres por onde passa. Mate antes que ele chegue aos corpos.', hp: 2, dmg: 1, speed: 12, range: 6, atkCd: 1.0, radius: 4, threat: 2, traits: ['burnCorpses'] }),
  militia: living({ name: 'Miliciano', desc: 'Lança de ferro e um capacete emprestado.', hp: 3, dmg: 1, speed: 10, range: 8, atkCd: 0.9, radius: 4, threat: 2 }),
  hunter: living({ name: 'Caçador', desc: 'Atira flechas de longe nos seus mortos.', hp: 2, dmg: 1, speed: 10, range: 48, atkCd: 1.6, radius: 4, threat: 2, projectile: 90 }),
  hound: living({ name: 'Cão de Caça', desc: 'Rápido e faminto. Fura a linha e morde o altar.', hp: 2, dmg: 1, speed: 26, range: 5, atkCd: 0.6, radius: 3, threat: 1 }),
  // ---- O Mosteiro
  monk: living({ name: 'Monge', desc: 'Punhos treinados em anos de silêncio.', hp: 3, dmg: 1, speed: 14, range: 6, atkCd: 0.7, radius: 4, threat: 2 }),
  priest: living({ name: 'Padre', desc: 'Cura os vivos em volta. Solo sagrado: não pode ser levantado.', hp: 3, dmg: 1, speed: 8, range: 6, atkCd: 1.4, radius: 4, threat: 4, raisable: false, traits: ['healer'] }),
  nun: living({ name: 'Freira', desc: 'Sua lanterna queima os mortos que chegam perto.', hp: 3, dmg: 1, speed: 9, range: 6, atkCd: 1.2, radius: 4, threat: 3, traits: ['holyLight'] }),
  ringer: living({ name: 'Sineiro', desc: 'O sino apressa os vivos em volta.', hp: 3, dmg: 1, speed: 9, range: 6, atkCd: 1.2, radius: 4, threat: 3, traits: ['speedAura'] }),
  flagellant: living({ name: 'Flagelante', desc: 'Explode em luz sagrada ao morrer.', hp: 3, dmg: 2, speed: 13, range: 6, atkCd: 1.0, radius: 4, threat: 3, traits: ['holyBurst'] }),
  // ---- A Fortaleza
  soldier: living({ name: 'Soldado', desc: 'Espada, cota de malha e ordens claras.', hp: 4, dmg: 2, speed: 9, range: 7, atkCd: 1.2, radius: 5, threat: 3 }),
  crossbow: living({ name: 'Besteiro', desc: 'Virotes pesados de muito longe.', hp: 3, dmg: 2, speed: 8, range: 70, atkCd: 2.4, radius: 4, threat: 4, projectile: 130 }),
  shield: living({ name: 'Escudeiro', desc: 'O escudo bloqueia metade dos raios do necromante.', hp: 8, dmg: 1, speed: 7, range: 7, atkCd: 1.3, radius: 5, threat: 4, traits: ['shieldBlock'] }),
  knight: living({ name: 'Cavaleiro', desc: 'Investe com tudo quando o alvo está perto.', hp: 10, dmg: 3, speed: 9, range: 8, atkCd: 1.3, radius: 5, threat: 6, traits: ['charge'] }),
  halberd: living({ name: 'Alabardeiro', desc: 'A alabarda acerta vários mortos de uma vez.', hp: 6, dmg: 2, speed: 8, range: 10, atkCd: 1.5, radius: 5, threat: 4, traits: ['cleave'] }),
  // ---- A Catedral
  paladin: living({ name: 'Paladino', desc: 'Consagra o chão: cadáveres perto dele não levantam.', hp: 11, dmg: 2, speed: 9, range: 7, atkCd: 1.1, radius: 5, threat: 6, raisable: false, traits: ['consecrate', 'holyWeapon'] }),
  inquisitor: living({ name: 'Inquisidor', desc: 'Pulsos sagrados que destroem mortos em volta.', hp: 6, dmg: 1, speed: 9, range: 6, atkCd: 1.2, radius: 4, threat: 5, traits: ['banish'] }),
  witchhunter: living({ name: 'Caçador de Bruxas', desc: 'Ignora o exército e atira direto no necromante.', hp: 5, dmg: 2, speed: 14, range: 60, atkCd: 1.8, radius: 4, threat: 5, projectile: 120, traits: ['necroHunter'] }),
  templar: living({ name: 'Templário', desc: 'Armadura pesada e lâmina abençoada.', hp: 14, dmg: 3, speed: 8, range: 7, atkCd: 1.2, radius: 5, threat: 7, traits: ['holyWeapon'] }),
  hurler: living({ name: 'Arremessador', desc: 'Fica longe e atira os próprios aliados por cima do seu exército, direto no altar.', hp: 6, dmg: 1, speed: 8, range: 6, atkCd: 1.2, radius: 5, threat: 5, traits: ['hurler'] }),
  bishop: living({ name: 'Bispo', desc: 'Cura e protege os vivos em volta.', hp: 8, dmg: 1, speed: 7, range: 6, atkCd: 1.5, radius: 5, threat: 7, raisable: false, traits: ['healer', 'armorAura'] }),
};

export const BOSS_DEFS: Record<BossKind, UnitDef> = {
  woodcutter: living({
    name: 'O Lenhador',
    desc: 'Chefe da Vila. O machado parte o chão em volta.',
    hp: 260, dmg: 5, speed: 7, range: 12, atkCd: 1.6, radius: 9, threat: 30, raisable: false, boss: true,
    traits: ['cleave'],
    abilities: [{ id: 'slam', cd: 5 }, { id: 'summon', cd: 9 }],
  }),
  abbot: living({
    name: 'O Abade',
    desc: 'Chefe do Mosteiro. Cura seus fiéis e pulsa luz sagrada.',
    hp: 380, dmg: 3, speed: 6, range: 10, atkCd: 1.4, radius: 9, threat: 40, raisable: false, boss: true,
    abilities: [{ id: 'nova', cd: 5 }, { id: 'healAll', cd: 7 }, { id: 'summon', cd: 10 }],
  }),
  commander: living({
    name: 'O Comandante',
    desc: 'Chefe da Fortaleza. Investe em linha reta contra o altar.',
    hp: 340, dmg: 5, speed: 7, range: 12, atkCd: 1.4, radius: 9, threat: 50, raisable: false, boss: true,
    traits: ['cleave'],
    abilities: [{ id: 'charge', cd: 6 }, { id: 'summon', cd: 9 }],
  }),
  archbishop: living({
    name: 'O Arcebispo',
    desc: 'Chefe da Catedral. Colunas de luz que apagam seus mortos.',
    hp: 280, dmg: 4, speed: 6, range: 12, atkCd: 1.4, radius: 9, threat: 60, raisable: false, boss: true,
    abilities: [{ id: 'beam', cd: 4 }, { id: 'nova', cd: 7 }, { id: 'summon', cd: 10 }],
  }),
  seraph: living({
    name: 'O Serafim',
    desc: 'Chefe secreto do abismo. Seis asas, nenhuma piedade.',
    hp: 420, dmg: 5, speed: 6, range: 14, atkCd: 1.2, radius: 10, threat: 80, raisable: false, boss: true,
    traits: ['cleave'],
    abilities: [{ id: 'beam', cd: 3 }, { id: 'nova', cd: 6 }, { id: 'healAll', cd: 8 }, { id: 'summon', cd: 9 }],
  }),
};

export const DEAD_DEFS: Record<DeadKind, UnitDef> = {
  skeleton: dead({ name: 'Esqueleto', desc: 'O soldado de sempre.', hp: 5, dmg: 1, speed: 20, range: 6, atkCd: 0.7, radius: 4, armyCost: 1, school: 'bone' }),
  archer: dead({ name: 'Arqueiro de Osso', desc: 'Atira de trás da linha.', hp: 3, dmg: 1, speed: 18, range: 40, atkCd: 1.1, radius: 4, armyCost: 1, school: 'bone', projectile: 100 }),
  giant: dead({ name: 'Colosso de Ossos', desc: 'Três esqueletos fundidos.', hp: 20, dmg: 3, speed: 12, range: 9, atkCd: 1.0, radius: 7, armyCost: 2, school: 'bone' }),
  zombie: dead({ name: 'Zumbi', desc: 'Lento, resistente e com fome.', hp: 13, dmg: 2, speed: 11, range: 6, atkCd: 0.9, radius: 4, armyCost: 1, school: 'flesh' }),
  ghoul: dead({ name: 'Carniçal', desc: 'Rápido e voraz.', hp: 7, dmg: 2, speed: 26, range: 6, atkCd: 0.6, radius: 4, armyCost: 1, school: 'flesh' }),
  rat: dead({ name: 'Rato da Peste', desc: 'Pequeno, rápido e infeccioso.', hp: 2, dmg: 1, speed: 32, range: 5, atkCd: 0.4, radius: 3, armyCost: 1, school: 'plague' }),
  ghost: dead({ name: 'Fantasma', desc: 'Atravessa a linha e ataca a retaguarda.', hp: 6, dmg: 3, speed: 22, range: 6, atkCd: 0.9, radius: 4, armyCost: 1, school: 'spirit', flying: true }),
  thrall: dead({ name: 'Servo de Sangue', desc: 'Bebe a vida de quem acerta.', hp: 12, dmg: 3, speed: 17, range: 6, atkCd: 0.8, radius: 4, armyCost: 1, school: 'blood' }),
  lich: dead({ name: 'Lich', desc: 'Raios mágicos que explodem em área.', hp: 8, dmg: 2, speed: 14, range: 50, atkCd: 1.6, radius: 4, armyCost: 2, school: 'bone', projectile: 110 }),
  abomination: dead({ name: 'Abominação', desc: 'Carne costurada. Esmaga vários de uma vez.', hp: 45, dmg: 4, speed: 9, range: 10, atkCd: 1.3, radius: 7, armyCost: 3, school: 'flesh', traits: ['cleave'] }),
  plaguebearer: dead({ name: 'Portador da Peste', desc: 'Envenena todos os vivos em volta.', hp: 10, dmg: 1, speed: 13, range: 6, atkCd: 1.0, radius: 4, armyCost: 1, school: 'plague' }),
  banshee: dead({ name: 'Banshee', desc: 'Voa sobre a linha. O grito atordoa os vivos.', hp: 7, dmg: 2, speed: 24, range: 6, atkCd: 0.9, radius: 4, armyCost: 2, school: 'spirit', flying: true }),
  bloodknight: dead({ name: 'Cavaleiro Rubro', desc: 'Investe nos vivos e bebe o sangue deles.', hp: 18, dmg: 3, speed: 16, range: 7, atkCd: 1.0, radius: 5, armyCost: 2, school: 'blood', traits: ['charge'] }),
  champion: dead({ name: 'Campeão', desc: 'Um chefe que voltou para servir.', hp: 40, dmg: 4, speed: 12, range: 10, atkCd: 1.1, radius: 8, armyCost: 2 }),
};

export const UNIT_DEFS: Record<UnitKind, UnitDef> = { ...LIVING_DEFS, ...BOSS_DEFS, ...DEAD_DEFS };

/** Habilidade dos campeões (a mesma do chefe, apontada para os vivos). */
export const CHAMPION_ABILITY: Record<BossKind, { id: 'slam' | 'healDead' | 'charge' | 'beam'; cd: number }> = {
  woodcutter: { id: 'slam', cd: 4 },
  abbot: { id: 'healDead', cd: 5 },
  commander: { id: 'charge', cd: 5 },
  archbishop: { id: 'beam', cd: 4 },
  seraph: { id: 'beam', cd: 2.5 },
};

export const championStats = (rank: number) => ({ hpMul: 1 + 0.3 * (rank - 1), dmgMul: 1 + 0.25 * (rank - 1) });

export const LIVING_KINDS = Object.keys(LIVING_DEFS) as LivingKind[];
export const BOSS_KINDS = Object.keys(BOSS_DEFS) as BossKind[];
export const DEAD_KINDS = Object.keys(DEAD_DEFS) as DeadKind[];
