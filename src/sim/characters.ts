import type { MetaState } from './meta';
import type { Mods } from './mods';
import type { School } from './types';

export type CharacterId = 'necro' | 'witch' | 'reaper' | 'vampire' | 'digger';

export interface Character {
  id: CharacterId;
  name: string;
  title: string;
  /** como o personagem muda o jogo, em linhas curtas */
  traits: string[];
  /** conta como cartas extras de uma escola */
  school?: Partial<Record<School, number>>;
  /** escolas sempre liberadas para este personagem */
  schools?: School[];
  price: number;
  unlock: { text: string; check: (m: MetaState) => boolean };
  apply: (m: Mods) => void;
}

export const CHARACTERS: Character[] = [
  {
    id: 'necro',
    name: 'O Necromante',
    title: 'equilibrado',
    traits: ['raios rápidos em um alvo', 'nenhuma fraqueza, nenhum truque'],
    price: 0,
    unlock: { text: '', check: () => true },
    apply: () => {},
  },
  {
    id: 'witch',
    name: 'A Bruxa da Praga',
    title: 'veneno e paciência',
    traits: ['começa com 1 carta de praga', 'o círculo envenena', 'explodir deixa nuvem tóxica', 'raios 30% mais lentos, -4 vida'],
    school: { plague: 1 },
    schools: ['plague'],
    price: 120,
    unlock: { text: 'derrote o lenhador', check: (m) => m.bossesBeaten >= 1 },
    apply: (m) => {
      m.circleMiasma += 0.15;
      m.explodePoison = true;
      m.castCdMul *= 1.3;
      m.necroMaxHp -= 4;
    },
  },
  {
    id: 'digger',
    name: 'O Coveiro',
    title: 'quantidade acima de tudo',
    traits: ['cada cadáver levanta 2 mortos', 'limite do exército -4', 'cadáveres duram +4s'],
    price: 150,
    unlock: { text: 'jogue 3 runs', check: (m) => m.runs >= 3 },
    apply: (m) => {
      m.doubleRaise = true;
      m.armyCap -= 4;
      m.corpseLife += 4;
    },
  },
  {
    id: 'reaper',
    name: 'O Ceifador',
    title: 'a foice não escolhe',
    traits: ['a foice acerta todos no círculo', 'golpes mais lentos e pesados', 'círculo maior', 'começa com 1 carta de espírito'],
    school: { spirit: 1 },
    schools: ['spirit'],
    price: 250,
    unlock: { text: 'derrote o abade', check: (m) => m.bossesBeaten >= 2 },
    apply: (m) => {
      m.scythe = true;
      m.circleR += 4;
      m.necroDmg += 0.5;
    },
  },
  {
    id: 'vampire',
    name: 'A Vampira',
    title: 'vive do que mata',
    traits: ['perde 1 vida a cada 8s', 'cada 2 abates cura 1', 'mortos +15% dano e roubam vida', 'consumir cura o dobro', 'começa com 1 carta de sangue'],
    school: { blood: 1 },
    schools: ['blood'],
    price: 350,
    unlock: { text: 'derrote o comandante', check: (m) => m.bossesBeaten >= 3 },
    apply: (m) => {
      m.necroDrain += 0.12;
      m.killHeal += 1 / 2;
      m.deadDmgMul *= 1.15;
      m.lifesteal += 0.2;
      m.consumeHealMul *= 2;
      m.necroMaxHp += 6;
    },
  },
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<CharacterId, Character>;
